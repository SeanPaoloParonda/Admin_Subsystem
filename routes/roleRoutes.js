// ── What this file does ──────────────────────────────────────────────────────
// This file defines the role management routes — API endpoints for creating,
// reading, updating roles, and assigning roles to users.
//
// All routes here are prefixed with /admin/api/roles (set in server.js).
// The protect and enforceSubsystem('Admin') middleware are applied in server.js.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();

const {
  getRoles,
  getRolePermissions,
  createRole,
  updateRole,
  assignRole,
  getUserPermissions
} = require('../controllers/roleController');

const { protect, requirePermission } = require('../middleware/authMiddleware');

// Apply the protect middleware to ALL routes in this file
router.use(protect);

// GET /admin/api/roles — Get all roles and their permissions
// Requires the 'View' permission
router.get('/', requirePermission('View'), getRoles);

// GET /admin/api/roles/user/:userId/permissions
// Get the permissions for a specific user (based on their assigned role).
// IMPORTANT: This specific route MUST be defined BEFORE /:roleId/permissions below,
// otherwise Express would try to match 'user' as a roleId parameter.
router.get('/user/:userId/permissions', requirePermission('View'), getUserPermissions);

// GET /admin/api/roles/:roleId/permissions — Get permissions for a specific role
// Requires the 'View' permission
router.get('/:roleId/permissions', requirePermission('View'), getRolePermissions);

// POST /admin/api/roles — Create a new role with optional permissions
// Requires the 'Create' permission
router.post('/', requirePermission('Create'), createRole);

// PATCH /admin/api/roles/:id — Update a role's name, subsystem, status, or permissions
// Requires the 'Patch' permission
router.patch('/:id', requirePermission('Patch'), updateRole);

// POST /admin/api/roles/assign/:userId — Assign a role to a specific user
// Requires the 'Patch' permission — changing a user's role is a modification
router.post('/assign/:userId', requirePermission('Patch'), assignRole);

module.exports = router;
