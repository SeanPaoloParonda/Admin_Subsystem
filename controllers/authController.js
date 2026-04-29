const User = require('../models/user');
const AuditLog = require('../models/auditLog');
const jwt = require('jsonwebtoken');
const { comparePassword } = require('../utils/passwordUtils');
const { generateToken, generateRefreshToken } = require('../utils/tokenUtils');

/**
 * Login user and generate access token
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Find user by username
    const user = await User.findOne({ where: { username } });

    if (!user) {
      // Log failed login attempt
      await AuditLog.create({
        user_id: null,
        action_type: 'LOGIN_FAILED',
        details: `Failed login attempt for username: ${username}`,
        ip_addr: req.ip || req.connection.remoteAddress
      });
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Check if user is active
    if (user.status !== 'active') {
      await AuditLog.create({
        user_id: user.user_id,
        action_type: 'LOGIN_FAILED',
        details: 'Inactive account login attempt',
        ip_addr: req.ip || req.connection.remoteAddress
      });
      return res.status(401).json({ message: 'Account is inactive' });
    }

    // Verify password
    const isMatch = await comparePassword(password, user.pwd_hash);
    if (!isMatch) {
      await AuditLog.create({
        user_id: user.user_id,
        action_type: 'LOGIN_FAILED',
        details: 'Invalid password attempt',
        ip_addr: req.ip || req.connection.remoteAddress
      });
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Generate tokens
    const payload = {
      user_id: user.user_id,
      username: user.username,
      role: user.role
    };

    const accessToken = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Log successful login
    await AuditLog.create({
      user_id: user.user_id,
      action_type: 'LOGIN_SUCCESS',
      details: `User ${username} logged in successfully`,
      ip_addr: req.ip || req.connection.remoteAddress
    });

    res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

/**
 * Logout user and log the action
 */
const logout = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Log logout action
    await AuditLog.create({
      user_id: userId,
      action_type: 'LOGOUT',
      details: `User ${req.user.username} logged out`,
      ip_addr: req.ip || req.connection.remoteAddress
    });

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
};

/**
 * Refresh access token using refresh token
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    const newAccessToken = generateToken({
      user_id: decoded.user_id,
      username: decoded.username,
      role: decoded.role
    });

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
};

module.exports = { login, logout, refreshToken };