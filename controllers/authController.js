const User = require('../models/user');
const Role = require('../models/role');
const jwt = require('jsonwebtoken');
const { comparePassword } = require('../utils/passwordUtils');
const { generateToken, generateRefreshToken } = require('../utils/tokenUtils');
const { logAdminAction } = require('../utils/auditUtils');

/**
 * Login user and generate access + refresh tokens
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

// Try to find user without Role include first
    let user = await User.findOne({
      where: { username }
    });

    // If user has role_id, try to get role name separately
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

    if (!user) {
      await logAdminAction({
        user_id: '00000000-0000-0000-0000-000000000000', // System placeholder for unknown user
        action_type: 'LOGIN_FAILED',
        details: `Failed login attempt for username: ${username}`,
        ip_addr: req.ip
      });
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Check status
    if (!user.status || user.status !== 'active') {
      await logAdminAction({
        user_id: user.user_id,
        action_type: 'LOGIN_FAILED',
        details: 'Inactive account login attempt',
        ip_addr: req.ip
      });
      return res.status(401).json({ message: 'Account is inactive' });
    }

    // Verify password
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

    // Block non-Admin subsystem users from logging into the Admin panel
    if (roleSubsystem !== 'Admin') {
      await logAdminAction({
        user_id: user.user_id,
        action_type: 'LOGIN_FAILED',
        details: `User ${username} (subsystem: ${roleSubsystem}) attempted to log into Admin panel`,
        ip_addr: req.ip
      });
      return res.status(403).json({ message: 'Access denied: this account does not belong to the Admin subsystem' });
    }

// Use the roleName and roleSubsystem we fetched above
    const payload = {
      user_id: user.user_id,
      username: user.username,
      role_id: user.role_id,
      role: roleName,
      subsystem: roleSubsystem,
      permissions: rolePermissions   // e.g. ['Create', 'View', 'Patch']
    };

    const accessToken = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Update last_login timestamp
    await user.update({ last_login: new Date() });

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
        user_id: user.user_id,
        username: user.username,
        role_id: user.role_id,
        role: roleName,
        subsystem: roleSubsystem,
        permissions: rolePermissions,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

/**
 * Logout user
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
 * Refresh access token — Admin subsystem users only
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return res.status(400).json({ message: 'Refresh token is required' });

    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!jwtRefreshSecret) return res.status(500).json({ message: 'Server misconfiguration: JWT_REFRESH_SECRET not set' });
    const decoded = jwt.verify(token, jwtRefreshSecret);

    // Refresh tokens are only valid for Admin subsystem users
    if (decoded.subsystem !== 'Admin') {
      return res.status(403).json({ message: 'Token refresh is not available for this subsystem' });
    }

    const newAccessToken = generateToken({
      user_id: decoded.user_id,
      username: decoded.username,
      role_id: decoded.role_id,
      role: decoded.role,
      subsystem: decoded.subsystem,
      permissions: decoded.permissions
    });

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
};

/**
 * Verify access token
 */
const verifyToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

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
