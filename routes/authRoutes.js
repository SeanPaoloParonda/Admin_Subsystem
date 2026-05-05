const express = require('express');
const { login, logout, refreshToken, verifyToken } = require('../controllers/authController');
const { subsystemLogin } = require('../controllers/subsystemAuthController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', login);
router.post('/refresh', refreshToken);
router.get('/verify', protect, verifyToken);
router.post('/logout', protect, logout);

/**
 * Cross-subsystem authentication endpoint
 * Other subsystems POST { username, password } with X-Subsystem-Key header
 * Returns JWT + permissions for the authenticated user
 */
router.post('/subsystem-login', subsystemLogin);

module.exports = router;
