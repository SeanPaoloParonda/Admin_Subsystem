// ── What this file does ──────────────────────────────────────────────────────
// This file defines the reference data routes — API endpoints for managing
// the hospital's service catalog (e.g., Blood Test, X-Ray, Consultation).
//
// All routes here are prefixed with /admin/api/reference (set in server.js).
// The protect and enforceSubsystem('Admin') middleware are already applied
// in server.js, so all requests here are from authenticated Admin users.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();

const {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService   // Note: this deactivates the service, it does not delete it
} = require('../controllers/referenceController');

const { requirePermission } = require('../middleware/authMiddleware');

// Note: protect + enforceSubsystem('Admin') are already applied in server.js

// GET /admin/api/reference — Get all services with optional filtering and pagination
// Requires the 'View' permission
router.get('/', requirePermission('View'), getAllServices);

// GET /admin/api/reference/:id — Get a single service by its service_id
// Requires the 'View' permission
router.get('/:id', requirePermission('View'), getServiceById);

// POST /admin/api/reference — Create a new service in the catalog
// Requires the 'Create' permission
router.post('/', requirePermission('Create'), createService);

// PATCH /admin/api/reference/:id — Update an existing service's details
// Requires the 'Patch' permission
router.patch('/:id', requirePermission('Patch'), updateService);

// PATCH /admin/api/reference/:id/deactivate — Deactivate a service (soft delete)
// Services are never hard-deleted — deactivating hides them from active use
// while preserving the historical record for billing purposes.
// Requires the 'Patch' permission
router.patch('/:id/deactivate', requirePermission('Patch'), deleteService);

module.exports = router;
