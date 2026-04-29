const jwt = require('jsonwebtoken');

/**
 * Generate a JWT access token
 * @param {object} payload - Data to encode in the token
 * @param {string} expiresIn - Token expiration time
 * @returns {string} - Generated JWT token
 */
const generateToken = (payload, expiresIn = '24h') => {
  const secret = process.env.JWT_SECRET || 'fallback_jwt_secret_change_in_production';
  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Verify a JWT token
 * @param {string} token - JWT token to verify
 * @returns {object|null} - Decoded token payload or null if invalid
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Token verification failed:', error.message);
    }
    return null;
  }
};

/**
 * Generate a refresh token
 * @param {object} payload - Data to encode in the token
 * @returns {string} - Generated refresh token
 */
const generateRefreshToken = (payload) => {
  const secret = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_change_in_production';
  return jwt.sign(payload, secret, { expiresIn: '7d' });
};

module.exports = { generateToken, verifyToken, generateRefreshToken };