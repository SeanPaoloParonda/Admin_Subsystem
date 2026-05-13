// ── What this file does ──────────────────────────────────────────────────────
// This file defines the authentication routes — the API endpoints related to
// logging in, logging out, and managing tokens.
//
// All routes here are prefixed with /admin/api/auth (set in server.js).
// So for example, the login endpoint is: POST /admin/api/auth/login
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');

// Import the controller functions that handle each auth action
const { login, logout, refreshToken, verifyToken } = require('../controllers/authController');

// Import the subsystem login handler (used by other subsystems, not the Admin UI)
const { subsystemLogin } = require('../controllers/subsystemAuthController');

// protect middleware: checks that the user has a valid JWT before allowing access
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /admin/api/auth/login
// Public endpoint — no token required.
// The user submits their username and password; if correct, they receive tokens.
router.post('/login', login);

// POST /admin/api/auth/refresh
// Public endpoint — the refresh token IS the credential here.
// The user sends their refresh token to get a new access token when it expires.
// Only available to Admin subsystem users.
router.post('/refresh', refreshToken);

// GET /admin/api/auth/verify
// Protected — requires a valid JWT.
// Used by the frontend to check if the current token is still valid.
router.get('/verify', protect, verifyToken);

// POST /admin/api/auth/logout
// Protected — requires a valid JWT.
// Records a logout event in the audit log.
router.post('/logout', protect, logout);

/**
 * POST /admin/api/auth/subsystem-login
 *
 * Cross-subsystem authentication endpoint.
 * NOT for the Admin UI — for other subsystems (Patient, Billing, etc.)
 * that need to authenticate their users against the Admin user database.
 *
 * The calling subsystem must include:
 *   - Header: X-Subsystem-Key (shared secret key)
 *   - Body: { username, password, subsystem }
 *
 * Returns a JWT access token scoped to the user's subsystem.
 * No refresh token is issued — token refresh is Admin-only.
 */
router.post('/subsystem-login', subsystemLogin);

module.exports = router;
