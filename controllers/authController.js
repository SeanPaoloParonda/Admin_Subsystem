// ── What this file does ──────────────────────────────────────────────────────
// This file contains the controller functions for user authentication:
//   - login:        verifies credentials and issues JWT tokens
//   - logout:       records the logout event in the audit log
//   - refreshToken: issues a new access token using a valid refresh token
//   - verifyToken:  checks whether a given access token is still valid
//
// These functions are called by the routes defined in routes/authRoutes.js.
// ─────────────────────────────────────────────────────────────────────────────

// Import the User and Role models to look up user data from the database
const User = require('../models/user');
const Role = require('../models/role');

// jsonwebtoken is used to verify the refresh token in the refreshToken function
const jwt = require('jsonwebtoken');

// comparePassword checks if the submitted password matches the stored hash
const { comparePassword } = require('../utils/passwordUtils');

// generateToken creates a short-lived access token (24h)
// generateRefreshToken creates a longer-lived refresh token (7 days)
const { generateToken, generateRefreshToken } = require('../utils/tokenUtils');

// logAdminAction records important events in the audit log
const { logAdminAction } = require('../utils/auditUtils');

/**
 * login
 *
 * This runs when a user submits the login form.
 * It checks the username exists, verifies the password,
 * confirms the account is active and belongs to the Admin subsystem,
 * then returns access and refresh tokens along with the user's info.
 *
 * POST /admin/api/auth/login
 * Body: { username, password }
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Both fields are required
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Look up the user by username in the database
    let user = await User.findOne({ where: { username } });

    // ── Fetch the user's role and permissions separately ──────────────────────
    let roleName = 'User';
    let roleSubsystem = 'Admin';
    let rolePermissions = [];

    if (user && user.role_id) {
      try {
        const role = await Role.findByPk(user.role_id, {
          attributes: ['name', 'subsystem'],
          include: [{
            model: require('../models/permission'),
            through: { attributes: [] },
            attributes: ['action']
          }]
        });
        if (role) {
          roleName = role.name;
          roleSubsystem = role.subsystem;
          rolePermissions = (role.Permissions || []).map(p => p.action);
        }
      } catch (roleErr) {
        console.error('Error fetching role:', roleErr);
      }
    }

    // ── User not found ────────────────────────────────────────────────────────
    if (!user) {
      // Use a placeholder UUID because we don't have a real user_id
      await logAdminAction({
        user_id: '00000000-0000-0000-0000-000000000000',
        action_type: 'LOGIN_FAILED',
        details: `Failed login attempt for username: ${username}`,
        ip_addr: req.ip
      });
      // Return a generic error — don't reveal whether the username exists
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // ── Account status check ──────────────────────────────────────────────────
    // Inactive accounts cannot log in
    if (!user.status || user.status !== 'active') {
      await logAdminAction({
        user_id: user.user_id,
        action_type: 'LOGIN_FAILED',
        details: 'Inactive account login attempt',
        ip_addr: req.ip
      });
      return res.status(401).json({ message: 'Account is inactive' });
    }

    // ── Password verification ─────────────────────────────────────────────────
    const isMatch = await comparePassword(password, user.pwd_hash);
    if (!isMatch) {
      await logAdminAction({
        user_id: user.user_id,
        action_type: 'LOGIN_FAILED',
        details: 'Invalid password attempt',
        ip_addr: req.ip
      });
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // ── Subsystem boundary check ──────────────────────────────────────────────
    // Only Admin subsystem users can log into the Admin panel
    if (roleSubsystem !== 'Admin') {
      await logAdminAction({
        user_id: user.user_id,
        action_type: 'LOGIN_FAILED',
        details: `User ${username} (subsystem: ${roleSubsystem}) attempted to log into Admin panel`,
        ip_addr: req.ip
      });
      return res.status(403).json({ message: 'Access denied: this account does not belong to the Admin subsystem' });
    }

    // ── Build the token payload ───────────────────────────────────────────────
    // This data gets embedded inside the JWT token
    const payload = {
      user_id:     user.user_id,
      username:    user.username,
      role_id:     user.role_id,
      role:        roleName,
      subsystem:   roleSubsystem,
      permissions: rolePermissions
    };

    // Generate the short-lived access token (24 hours)
    const accessToken = generateToken(payload);

    // Generate the longer-lived refresh token (7 days) — Admin subsystem only
    const refreshToken = generateRefreshToken(payload);

    // Update the last_login timestamp
    await user.update({ last_login: new Date() });

    // Record the successful login in the audit log
    await logAdminAction({
      user_id: user.user_id,
      action_type: 'LOGIN_SUCCESS',
      details: `User ${username} logged in successfully`,
      ip_addr: req.ip
    });

    res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        user_id:     user.user_id,
        username:    user.username,
        role_id:     user.role_id,
        role:        roleName,
        subsystem:   roleSubsystem,
        permissions: rolePermissions,
        status:      user.status
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

/**
 * logout
 *
 * Records a logout event in the audit log.
 * Token invalidation is handled on the frontend by deleting the stored token.
 *
 * POST /admin/api/auth/logout
 */
const logout = async (req, res) => {
  try {
    const userId = req.user.user_id;

    await logAdminAction({
      user_id: userId,
      action_type: 'LOGOUT',
      details: `User ${req.user.username} logged out`,
      ip_addr: req.ip
    });

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
};

/**
 * refreshToken
 *
 * Issues a new access token when the current one has expired.
 * Only available to Admin subsystem users.
 *
 * POST /admin/api/auth/refresh
 * Body: { refreshToken }
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return res.status(400).json({ message: 'Refresh token is required' });

    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!jwtRefreshSecret) return res.status(500).json({ message: 'Server misconfiguration: JWT_REFRESH_SECRET not set' });

    // Verify the refresh token — throws if expired or tampered with
    const decoded = jwt.verify(token, jwtRefreshSecret);

    // Refresh tokens are only valid for Admin subsystem users
    if (decoded.subsystem !== 'Admin') {
      return res.status(403).json({ message: 'Token refresh is not available for this subsystem' });
    }

    // Issue a new access token using the same user data from the refresh token
    const newAccessToken = generateToken({
      user_id:     decoded.user_id,
      username:    decoded.username,
      role_id:     decoded.role_id,
      role:        decoded.role,
      subsystem:   decoded.subsystem,
      permissions: decoded.permissions
    });

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
};

/**
 * verifyToken
 *
 * Checks whether the current access token is still valid.
 * The frontend calls this on page load to decide whether to show the login page.
 *
 * GET /admin/api/auth/verify
 */
const verifyToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

    // Extract the token part from "Bearer <token>"
    const token = authHeader.split(' ')[1];

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return res.status(500).json({ message: 'Server misconfiguration: JWT_SECRET not set' });

    const decoded = jwt.verify(token, jwtSecret);

    res.json({ valid: true, user: decoded });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(401).json({ valid: false, message: 'Invalid or expired token' });
  }
};

module.exports = { login, logout, refreshToken, verifyToken };
