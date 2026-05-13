// ── What this file does ──────────────────────────────────────────────────────
// This file defines the user management routes — API endpoints for creating,
// reading, updating, and deactivating user accounts.
//
// All routes here are prefixed with /admin/api/users (set in server.js).
// The protect and enforceSubsystem('Admin') middleware are already applied
// in server.js, so every request here is from an authenticated Admin user.
//
// Additional permission checks (Create, View, Patch) are applied per route
// to control what each role is allowed to do.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();

const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changePassword
} = require('../controllers/userController');

// requirePermission checks that the user has the specific permission needed
const { requirePermission } = require('../middleware/authMiddleware');

// Note: protect + enforceSubsystem('Admin') are already applied in server.js

// GET /admin/api/users/me
// Returns the currently logged-in user's own profile.
// No extra permission check — any authenticated user can view their own info.
router.get('/me', async (req, res) => {
  try {
    const User = require('../models/user');
    // req.user.user_id comes from the decoded JWT token (set by the protect middleware)
    const user = await User.findByPk(req.user.user_id, {
      attributes: ['user_id', 'username', 'role_id', 'status']
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

// POST /admin/api/users — Create a new user account
// Requires the 'Create' permission
router.post('/', requirePermission('Create'), createUser);

// PATCH /admin/api/users/:id — Update an existing user's details
// Requires the 'Patch' permission
router.patch('/:id', requirePermission('Patch'), updateUser);

// DELETE /admin/api/users/:id — Deactivate a user account (soft delete)
// Requires the 'Patch' permission — deactivation is treated as a modification
router.delete('/:id', requirePermission('Patch'), deleteUser);

// POST /admin/api/users/:id/change-password — Change a user's password (admin-initiated)
// Requires the 'Patch' permission
router.post('/:id/change-password', requirePermission('Patch'), changePassword);

// GET /admin/api/users — Get all users (supports pagination and filtering)
// Requires the 'View' permission
router.get('/', requirePermission('View'), getAllUsers);

// GET /admin/api/users/:id — Get a single user by their user_id
// Requires the 'View' permission
router.get('/:id', requirePermission('View'), getUserById);

module.exports = router;
