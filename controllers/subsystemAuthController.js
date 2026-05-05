const User = require('../models/user');
const Role = require('../models/role');
const Permission = require('../models/permission');
const AuditLog = require('../models/auditLog');
const { comparePassword } = require('../utils/passwordUtils');
const { generateToken } = require('../utils/tokenUtils');

/**
 * Cross-subsystem login
 *
 * Other subsystems POST to /admin/api/auth/subsystem-login with:
 *   Headers:
 *     X-Subsystem-Key: <shared secret>
 *     Content-Type: application/json
 *   Body:
 *     { "username": "...", "password": "...", "subsystem": "Patient" }
 *
 * Rules:
 *   - The requesting subsystem must declare itself via the "subsystem" field in the body
 *   - The user's role must belong to that same subsystem — a Patient user cannot
 *     receive a Billing token, and a Billing subsystem cannot log in a Patient user
 *   - The issued token's subsystem is locked to the declared subsystem
 *   - No refresh token is issued — token refresh is for Admin subsystem users only
 *
 * Response (200):
 *   {
 *     "accessToken": "...",
 *     "user": {
 *       "user_id": "...",
 *       "username": "...",
 *       "role": "...",
 *       "subsystem": "...",
 *       "permissions": ["Create", "View", "Patch"],
 *       "status": "active"
 *     }
 *   }
 */
const subsystemLogin = async (req, res) => {
  try {
    // ── 1. Verify the subsystem API key ──────────────────────────────────────
    const providedKey = req.headers['x-subsystem-key'];
    const expectedKey = process.env.SUBSYSTEM_API_KEY;

    if (!expectedKey) {
      console.error('SUBSYSTEM_API_KEY is not set in environment');
      return res.status(500).json({ message: 'Server misconfiguration: subsystem key not set' });
    }

    if (!providedKey || providedKey !== expectedKey) {
      await AuditLog.create({
        user_id: '00000000-0000-0000-0000-000000000000',
        action_type: 'SUBSYSTEM_AUTH_FAILED',
        details: `Invalid or missing X-Subsystem-Key from IP ${req.ip}`,
        ip_addr: req.ip || req.connection.remoteAddress
      }).catch(err => console.error('Audit log failed (SUBSYSTEM_AUTH_FAILED):', err.message));
      return res.status(401).json({ message: 'Invalid subsystem key' });
    }

    // ── 2. Validate request body ─────────────────────────────────────────────
    const { username, password, subsystem } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'username and password are required' });
    }
    if (!subsystem || typeof subsystem !== 'string') {
      return res.status(400).json({ message: 'subsystem is required — declare which subsystem is making this request' });
    }

    // ── 3. Find the user ─────────────────────────────────────────────────────
    const user = await User.findOne({ where: { username } });

    if (!user) {
      await AuditLog.create({
        user_id: '00000000-0000-0000-0000-000000000000',
        action_type: 'SUBSYSTEM_LOGIN_FAILED',
        details: `[${subsystem}] Login failed — unknown username: ${username}`,
        ip_addr: req.ip || req.connection.remoteAddress
      }).catch(err => console.error('Audit log failed (SUBSYSTEM_LOGIN_FAILED):', err.message));
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // ── 4. Check account status ──────────────────────────────────────────────
    if (user.status !== 'active') {
      await AuditLog.create({
        user_id: user.user_id,
        action_type: 'SUBSYSTEM_LOGIN_FAILED',
        details: `[${subsystem}] Login failed — inactive account: ${username}`,
        ip_addr: req.ip || req.connection.remoteAddress
      }).catch(err => console.error('Audit log failed (SUBSYSTEM_LOGIN_FAILED):', err.message));
      return res.status(401).json({ message: 'Account is inactive' });
    }

    // ── 5. Verify password ───────────────────────────────────────────────────
    const isMatch = await comparePassword(password, user.pwd_hash);
    if (!isMatch) {
      await AuditLog.create({
        user_id: user.user_id,
        action_type: 'SUBSYSTEM_LOGIN_FAILED',
        details: `[${subsystem}] Login failed — wrong password for: ${username}`,
        ip_addr: req.ip || req.connection.remoteAddress
      }).catch(err => console.error('Audit log failed (SUBSYSTEM_LOGIN_FAILED):', err.message));
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // ── 6. Load role + permissions ───────────────────────────────────────────
    let roleName = 'User';
    let roleSubsystem = '';
    let rolePermissions = [];

    if (user.role_id) {
      const role = await Role.findByPk(user.role_id, {
        attributes: ['name', 'subsystem'],
        include: [{
          model: Permission,
          through: { attributes: [] },
          attributes: ['action']
        }]
      });
      if (role) {
        roleName = role.name;
        roleSubsystem = role.subsystem;
        rolePermissions = (role.Permissions || []).map(p => p.action);
      }
    }

    // ── 7. Enforce subsystem boundary ────────────────────────────────────────
    // The user's role subsystem must match the declared subsystem.
    // This prevents a Patient subsystem from logging in a Billing user,
    // and prevents a user from getting a token scoped to the wrong subsystem.
    if (roleSubsystem !== subsystem) {
      await AuditLog.create({
        user_id: user.user_id,
        action_type: 'SUBSYSTEM_LOGIN_FAILED',
        details: `[${subsystem}] Login denied — user "${username}" belongs to subsystem "${roleSubsystem}", not "${subsystem}"`,
        ip_addr: req.ip || req.connection.remoteAddress
      }).catch(err => console.error('Audit log failed (SUBSYSTEM_LOGIN_FAILED):', err.message));
      // Return generic message — don't reveal which subsystem the user belongs to
      return res.status(403).json({ message: 'Access denied: user does not belong to this subsystem' });
    }

    // ── 8. Build token payload ───────────────────────────────────────────────
    const payload = {
      user_id:     user.user_id,
      username:    user.username,
      role_id:     user.role_id,
      role:        roleName,
      subsystem:   roleSubsystem,   // locked to the user's actual role subsystem
      permissions: rolePermissions
    };

    // No refresh token — token refresh is for Admin subsystem users only
    const accessToken = generateToken(payload);

    // Update last_login
    await user.update({ last_login: new Date() }).catch(err => console.error('last_login update failed:', err.message));

    // ── 9. Audit log ─────────────────────────────────────────────────────────
    await AuditLog.create({
      user_id:     user.user_id,
      action_type: 'SUBSYSTEM_LOGIN_SUCCESS',
      details:     `[${subsystem}] Login granted for "${username}" (${roleName}) — permissions: [${rolePermissions.join(', ')}]`,
      ip_addr:     req.ip || req.connection.remoteAddress
    }).catch(err => console.error('Audit log failed (SUBSYSTEM_LOGIN_SUCCESS):', err.message));

    // ── 10. Respond ──────────────────────────────────────────────────────────
    return res.json({
      accessToken,
      user: {
        user_id:   user.user_id,
        username:  user.username,
        role:      roleName,
        subsystem: roleSubsystem,
        status:    user.status
        // permissions intentionally omitted — Admin permissions are not applicable
        // to other subsystems. Define your own permission model internally.
      }
    });

  } catch (error) {
    console.error('Subsystem login error:', error);
    return res.status(500).json({ message: 'Server error during subsystem login' });
  }
};

module.exports = { subsystemLogin };
