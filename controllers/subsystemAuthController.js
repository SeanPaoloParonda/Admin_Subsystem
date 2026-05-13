// ── What this file does ──────────────────────────────────────────────────────
// This file handles authentication requests from OTHER subsystems
// (e.g., Patient, Billing, Staff Management) that need to log in their users
// using the Admin subsystem's central user database.
//
// Instead of each subsystem maintaining its own user database, all users
// are stored here in the Admin subsystem. Other subsystems call this endpoint
// to authenticate their users and receive a JWT token.
//
// This is different from the regular login (authController.js) in two ways:
//   1. The calling subsystem must prove its identity using a shared API key
//      (X-Subsystem-Key header), not a user JWT.
//   2. The user's role must belong to the same subsystem that is making the request.
//      A Patient subsystem cannot log in a Billing user.
// ─────────────────────────────────────────────────────────────────────────────

// Import the models needed for authentication
const User = require('../models/user');
const Role = require('../models/role');
const Permission = require('../models/permission');
const AuditLog = require('../models/auditLog');

// comparePassword checks if the submitted password matches the stored hash
const { comparePassword } = require('../utils/passwordUtils');

// generateToken creates a short-lived JWT access token (24 hours)
const { generateToken } = require('../utils/tokenUtils');

/**
 * subsystemLogin
 *
 * Authenticates a user on behalf of another subsystem.
 *
 * The calling subsystem must POST to /admin/api/auth/subsystem-login with:
 *   Headers:
 *     X-Subsystem-Key: <shared secret from .env>
 *     Content-Type: application/json
 *   Body:
 *     { "username": "...", "password": "...", "subsystem": "Patient" }
 *
 * The "subsystem" field declares which subsystem is making the request.
 * The user's role must belong to that same subsystem.
 *
 * Returns a JWT access token (no refresh token — that's Admin-only).
 */
const subsystemLogin = async (req, res) => {
  try {
    // ── Step 1: Verify the subsystem API key ──────────────────────────────────
    // The calling subsystem must include the shared secret in the X-Subsystem-Key header.
    // This proves the request is coming from a trusted subsystem, not a random caller.
    const providedKey = req.headers['x-subsystem-key'];
    const expectedKey = process.env.SUBSYSTEM_API_KEY;

    if (!expectedKey) {
      // The secret is not configured on the server — this is a setup error
      console.error('SUBSYSTEM_API_KEY is not set in environment');
      return res.status(500).json({ message: 'Server misconfiguration: subsystem key not set' });
    }

    if (!providedKey || providedKey !== expectedKey) {
      // The key is missing or wrong — log the attempt and deny access
      await AuditLog.create({
        user_id: '00000000-0000-0000-0000-000000000000', // placeholder for unknown caller
        action_type: 'SUBSYSTEM_AUTH_FAILED',
        details: `Invalid or missing X-Subsystem-Key from IP ${req.ip}`,
        ip_addr: req.ip,
        subsystem: 'Unknown'
      }).catch(err => console.error('Audit log failed (SUBSYSTEM_AUTH_FAILED):', err.message));
      return res.status(401).json({ message: 'Invalid subsystem key' });
    }

    // ── Step 2: Validate the request body ────────────────────────────────────
    const { username, password, subsystem } = req.body;

    // username and password are required
    if (!username || !password) {
      return res.status(400).json({ message: 'username and password are required' });
    }

    // subsystem is required — the calling subsystem must declare who they are
    if (!subsystem || typeof subsystem !== 'string') {
      return res.status(400).json({ message: 'subsystem is required — declare which subsystem is making this request' });
    }

    // ── Step 3: Find the user ─────────────────────────────────────────────────
    const user = await User.findOne({ where: { username } });

    if (!user) {
      // Username not found — log the failed attempt and return a generic error
      await AuditLog.create({
        user_id: '00000000-0000-0000-0000-000000000000',
        action_type: 'SUBSYSTEM_LOGIN_FAILED',
        details: `[${subsystem}] Login failed — unknown username: ${username}`,
        ip_addr: req.ip,
        subsystem
      }).catch(err => console.error('Audit log failed (SUBSYSTEM_LOGIN_FAILED):', err.message));
      // Return the same generic error as wrong password — don't reveal if the username exists
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // ── Step 4: Check account status ─────────────────────────────────────────
    // Inactive accounts cannot log in from any subsystem
    if (user.status !== 'active') {
      await AuditLog.create({
        user_id: user.user_id,
        action_type: 'SUBSYSTEM_LOGIN_FAILED',
        details: `[${subsystem}] Login failed — inactive account: ${username}`,
        ip_addr: req.ip,
        subsystem
      }).catch(err => console.error('Audit log failed (SUBSYSTEM_LOGIN_FAILED):', err.message));
      return res.status(401).json({ message: 'Account is inactive' });
    }

    // ── Step 5: Verify the password ───────────────────────────────────────────
    // Compare the submitted password against the stored bcrypt hash
    const isMatch = await comparePassword(password, user.pwd_hash);
    if (!isMatch) {
      await AuditLog.create({
        user_id: user.user_id,
        action_type: 'SUBSYSTEM_LOGIN_FAILED',
        details: `[${subsystem}] Login failed — wrong password for: ${username}`,
        ip_addr: req.ip,
        subsystem
      }).catch(err => console.error('Audit log failed (SUBSYSTEM_LOGIN_FAILED):', err.message));
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // ── Step 6: Load the user's role and permissions ──────────────────────────
    let roleName = 'User';
    let roleSubsystem = '';
    let rolePermissions = [];

    if (user.role_id) {
      const role = await Role.findByPk(user.role_id, {
        attributes: ['name', 'subsystem'],
        include: [{
          model: Permission,
          through: { attributes: [] }, // don't include join table columns
          attributes: ['action']        // only fetch the action name
        }]
      });
      if (role) {
        roleName = role.name;
        roleSubsystem = role.subsystem;
        // Build a simple array of permission strings: ['Create', 'View', 'Patch']
        rolePermissions = (role.Permissions || []).map(p => p.action);
      }
    }

    // ── Step 7: Enforce the subsystem boundary ────────────────────────────────
    // The user's role subsystem must match the subsystem declared in the request.
    //
    // Example: If the Patient subsystem calls this endpoint with subsystem='Patient',
    // but the user's role belongs to 'Billing', the login is denied.
    // This prevents cross-subsystem access — a Billing user cannot get a Patient token.
    if (roleSubsystem !== subsystem) {
      await AuditLog.create({
        user_id: user.user_id,
        action_type: 'SUBSYSTEM_LOGIN_FAILED',
        details: `[${subsystem}] Login denied — user "${username}" belongs to subsystem "${roleSubsystem}", not "${subsystem}"`,
        ip_addr: req.ip,
        subsystem
      }).catch(err => console.error('Audit log failed (SUBSYSTEM_LOGIN_FAILED):', err.message));
      // Return a generic message — don't reveal which subsystem the user actually belongs to
      return res.status(403).json({ message: 'Access denied: user does not belong to this subsystem' });
    }

    // ── Step 8: Build the token payload ──────────────────────────────────────
    // This is the data embedded inside the JWT token.
    // The subsystem is locked to the user's actual role subsystem.
    const payload = {
      user_id:     user.user_id,
      username:    user.username,
      role_id:     user.role_id,
      role:        roleName,
      subsystem:   roleSubsystem,   // locked to the user's actual role subsystem
      permissions: rolePermissions
    };

    // Generate the access token — no refresh token for non-Admin subsystems
    const accessToken = generateToken(payload);

    // Update the last_login timestamp
    await user.update({ last_login: new Date() }).catch(err => console.error('last_login update failed:', err.message));

    // ── Step 9: Record the successful login in the audit log ──────────────────
    await AuditLog.create({
      user_id:     user.user_id,
      action_type: 'SUBSYSTEM_LOGIN_SUCCESS',
      details:     `[${subsystem}] Login granted for "${username}" (${roleName}) — permissions: [${rolePermissions.join(', ')}]`,
      ip_addr:     req.ip,
      subsystem
    }).catch(err => console.error('Audit log failed (SUBSYSTEM_LOGIN_SUCCESS):', err.message));

    // ── Step 10: Send the response ────────────────────────────────────────────
    return res.json({
      accessToken,
      user: {
        user_id:   user.user_id,
        username:  user.username,
        role:      roleName,
        subsystem: roleSubsystem,
        staff_id:  user.staff_id || null, // include staff_id for Staff Management subsystem
        status:    user.status
      }
    });

  } catch (error) {
    console.error('Subsystem login error:', error);
    return res.status(500).json({ message: 'Server error during subsystem login' });
  }
};

// Export the function for use in the auth routes
module.exports = { subsystemLogin };
