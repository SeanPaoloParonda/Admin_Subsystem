// ── What this file does ──────────────────────────────────────────────────────
// This file provides helper functions for creating and verifying JWT tokens.
//
// A JWT (JSON Web Token) is a secure, signed string that proves who a user is.
// When a user logs in, we create a token containing their user info and send it
// back to them. On every future request, they send this token back so we know
// who they are — without needing to look them up in the database every time.
//
// There are two types of tokens used here:
//   - Access token: short-lived (24 hours), used for API requests
//   - Refresh token: longer-lived (7 days), used to get a new access token
//     when the old one expires (Admin subsystem only)
// ─────────────────────────────────────────────────────────────────────────────

// jsonwebtoken is the library that creates and verifies JWT tokens
const jwt = require('jsonwebtoken');

/**
 * generateToken
 *
 * Creates a short-lived access token containing the user's info.
 * This token is sent to the frontend after login and must be included
 * in the Authorization header of every protected API request.
 *
 * @param {object} payload   - The user data to embed in the token
 *                             (e.g., user_id, username, role, permissions)
 * @param {string} expiresIn - How long until the token expires (default: 24 hours)
 * @returns {string}         - The signed JWT token string
 */
const generateToken = (payload, expiresIn = '24h') => {
  // Read the secret key from the environment — this is used to sign the token.
  // Anyone with this secret can create valid tokens, so it must be kept private.
  const secret = process.env.JWT_SECRET;

  // If the secret is not set, we cannot create tokens — throw an error
  if (!secret) throw new Error('JWT_SECRET is not set in environment variables');

  // Sign the payload with the secret and set the expiry time
  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * verifyToken
 *
 * Checks whether a given token is valid and not expired.
 * Returns the decoded user data if valid, or null if invalid.
 *
 * @param {string} token - The JWT token string to verify
 * @returns {object|null} - The decoded payload, or null if the token is invalid
 */
const verifyToken = (token) => {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not set in environment variables');

    // jwt.verify throws an error if the token is expired or tampered with
    return jwt.verify(token, secret);
  } catch (error) {
    // Only log errors outside of production to avoid leaking info in logs
    if (process.env.NODE_ENV !== 'production') {
      console.error('Token verification failed:', error.message);
    }
    return null;
  }
};

/**
 * generateRefreshToken
 *
 * Creates a longer-lived refresh token (7 days).
 * This is only issued to Admin subsystem users at login.
 * When their access token expires, they can send this refresh token
 * to get a new access token without logging in again.
 *
 * A separate secret (JWT_REFRESH_SECRET) is used so that even if the
 * access token secret is compromised, refresh tokens remain secure.
 *
 * @param {object} payload - The user data to embed in the refresh token
 * @returns {string}       - The signed refresh token string
 */
const generateRefreshToken = (payload) => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not set in environment variables');

  // Refresh tokens last 7 days
  return jwt.sign(payload, secret, { expiresIn: '7d' });
};

// Export all three functions for use in controllers and middleware
module.exports = { generateToken, verifyToken, generateRefreshToken };
