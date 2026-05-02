const express = require('express');
const router = express.Router();
const { 
  getAllLogs, 
  getLogById, 
  getUserLogs, 
  getRecentActivity, 
  exportLogs 
} = require('../controllers/auditController');
const { ingestAuditLogs } = require('../controllers/subsystemAuditController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

/**
 * Cross-subsystem audit ingest — no JWT required, uses X-Subsystem-Key instead
 * Other subsystems POST their action logs here so we have a central audit trail
 */
router.post('/ingest', ingestAuditLogs);

// All routes below require authentication
router.use(protect);

// Any authenticated user with View permission can read audit logs
router.get('/', requirePermission('View'), getAllLogs);
router.get('/export', requirePermission('View'), exportLogs);
router.get('/recent', requirePermission('View'), getRecentActivity);
router.get('/user/:userId', requirePermission('View'), getUserLogs);
router.get('/:id', requirePermission('View'), getLogById);

module.exports = router;
