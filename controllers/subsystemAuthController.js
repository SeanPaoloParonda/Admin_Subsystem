const User = require('../models/user');
const Role = require('../models/role');
const Permission = require('../models/permission');
const AuditLog = require('../models/auditLog');
const { comparePassword } = require('../utils/passwordUtils');
const { generateToken, generateRefreshToken } = require('../utils/tokenUtils');

/**
 * Cross-subsystem login
 *
 * Other subsystems POST to /admin/api/auth/subsystem-login with:
 *   Headers:
 *     X-Subsystem-Key: <shared secret>
 *     Content-Type: application/json
 *   Body:
 *     { "username": "...", "password": "..." }
 *
 * Response (200):
 *   {
 *     "accessToken": "...",
 *     "refreshToken": "...",
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
      }).catch(() => {}); // don't let audit failure block the response
      return res.status(401).json({ message: 'Invalid subsystem key' });
    }

    // ── 2. Validate request body ─────────────────────────────────────────────
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'username and password are required' });
    }

    // ── 3. Find the user ─────────────────────────────────────────────────────
    const user = await User.findOne({ where: { username } });

    if (!user) {
      await AuditLog.create({
        user_id: '00000000-0000-0000-0000-000000000000',
        action_type: 'SUBSYSTEM_LOGIN_FAILED',
        details: `Subsystem login failed — unknown username: ${username}`,
        ip_addr: req.ip || req.connection.remoteAddress
      }).catch(() => {});
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // ── 4. Check account status ──────────────────────────────────────────────
    if (user.status !== 'active') {
      await AuditLog.create({
        user_id: user.user_id,
        action_type: 'SUBSYSTEM_LOGIN_FAILED',
        details: `Subsystem login failed — inactive account: ${username}`,
        ip_addr: req.ip || req.connection.remoteAddress
      }).catch(() => {});
      return res.status(401).json({ message: 'Account is inactive' });
    }

    // ── 5. Verify password ───────────────────────────────────────────────────
    const isMatch = await comparePassword(password, user.pwd_hash);
    if (!isMatch) {
      await AuditLog.create({
        user_id: user.user_id,
        action_type: 'SUBSYSTEM_LOGIN_FAILED',
        details: `Subsystem login failed — wrong password for: ${username}`,
        ip_addr: req.ip || req.connection.remoteAddress
      }).catch(() => {});
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

    // ── 7. Build token payload ───────────────────────────────────────────────
    const payload = {
      user_id:     user.user_id,
      username:    user.username,
      role_id:     user.role_id,
      role:        roleName,
      subsystem:   roleSubsystem,
      permissions: rolePermissions   // e.g. ['Create', 'View', 'Patch']
    };

    const accessToken  = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Update last_login
    await user.update({ last_login: new Date() }).catch(() => {});

    // ── 8. Audit log ─────────────────────────────────────────────────────────
    await AuditLog.create({
      user_id:     user.user_id,
      action_type: 'SUBSYSTEM_LOGIN_SUCCESS',
      details:     `Subsystem login granted for ${username} (${roleName} / ${roleSubsystem}) — permissions: [${rolePermissions.join(', ')}]`,
      ip_addr:     req.ip || req.connection.remoteAddress
    }).catch(() => {});

    // ── 9. Respond ───────────────────────────────────────────────────────────
    return res.json({
      accessToken,
      refreshToken,
      user: {
        user_id:     user.user_id,
        username:    user.username,
        role:        roleName,
        subsystem:   roleSubsystem,
        permissions: rolePermissions,
        status:      user.status
      }
    });

  } catch (error) {
    console.error('Subsystem login error:', error);
    return res.status(500).json({ message: 'Server error during subsystem login' });
  }
};

module.exports = { subsystemLogin };
