// ── What this file does ──────────────────────────────────────────────────────
// This file defines the audit log routes — API endpoints for reading,
// filtering, exporting, and ingesting audit log entries.
//
// All routes here are prefixed with /admin/api/audit (set in server.js).
//
// There are two types of routes here:
//   1. Public ingest endpoint (/ingest) — used by other subsystems to submit
//      their audit logs. Authenticated with X-Subsystem-Key, NOT a JWT.
//   2. Protected read endpoints — require a valid JWT and 'View' permission.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();

const {
  getAllLogs,
  getLogById,
  getUserLogs,
  getRecentActivity,
  getActionTypes,
  exportLogs
} = require('../controllers/auditController');

// Receives audit logs POSTed by other subsystems
const { ingestAuditLogs } = require('../controllers/subsystemAuditController');

// Fetches logs from the Customer Support subsystem's own external API
const { getCustomerAuditLogs } = require('../controllers/externalAuditController');

const { protect, requirePermission } = require('../middleware/authMiddleware');

/**
 * POST /admin/api/audit/ingest
 *
 * Public endpoint — does NOT require a JWT.
 * Other subsystems POST their audit log entries here so we have a
 * central audit trail across the entire hospital system.
 * Authentication is done via the X-Subsystem-Key header (verified inside the controller).
 * Accepts a single log entry or an array of up to 100 entries.
 */
router.post('/ingest', ingestAuditLogs);

// Apply the protect middleware to ALL routes defined AFTER this line.
// Every request below must have a valid JWT token.
router.use(protect);

// GET /admin/api/audit — Get all audit logs with filtering and pagination
// Supports: page, limit, user_id, action_type, startDate, endDate, subsystem
router.get('/', requirePermission('View'), getAllLogs);

// GET /admin/api/audit/export — Export audit logs as JSON for reporting
router.get('/export', requirePermission('View'), exportLogs);

// GET /admin/api/audit/recent — Get the most recent entries (used on dashboard)
router.get('/recent', requirePermission('View'), getRecentActivity);

// GET /admin/api/audit/action-types — Get all distinct action types (for filter dropdowns)
router.get('/action-types', requirePermission('View'), getActionTypes);

// GET /admin/api/audit/external/customer
// Fetch and normalize audit logs from the Customer Support subsystem's external API
// (stored in their own MongoDB database, fetched on demand)
router.get('/external/customer', requirePermission('View'), getCustomerAuditLogs);

// GET /admin/api/audit/user/:userId — Get all logs for a specific user
router.get('/user/:userId', requirePermission('View'), getUserLogs);

// GET /admin/api/audit/:id — Get a single audit log entry by its log_id
router.get('/:id', requirePermission('View'), getLogById);

module.exports = router;
