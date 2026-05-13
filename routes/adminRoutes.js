// ── What this file does ──────────────────────────────────────────────────────
// This file defines the admin dashboard routes — API endpoints that power
// the main Admin Dashboard page in the frontend.
//
// These endpoints return summary statistics, recent activity, and security alerts
// displayed on the dashboard when an admin logs in.
//
// All routes here are prefixed with /admin/api (set in server.js).
// Both protect and enforceSubsystem('Admin') are applied inside this router.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();

const AuditLog = require('../models/auditLog');
const User = require('../models/user');
const Role = require('../models/role');
const Alert = require('../models/alert');
const { protect, enforceSubsystem } = require('../middleware/authMiddleware');

// Set up the AuditLog → User association here so the JOIN works in this router.
// The 'if' check prevents the association from being registered twice.
if (!AuditLog.associations.user) {
  AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
}

// Apply authentication and subsystem enforcement to ALL routes in this file
router.use(protect);
router.use(enforceSubsystem('Admin'));

// GET /admin/api/stats
// Returns summary counts for the dashboard overview cards:
//   - Total users, Active users, Roles defined, Total audit events
router.get('/stats', async (req, res) => {
  try {
    const totalUsers  = await User.count();
    const activeUsers = await User.count({ where: { status: 'active' } });
    const rolesDefined = await Role.count();
    const auditEvents = await AuditLog.count();

    res.json({ totalUsers, activeUsers, rolesDefined, auditEvents });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats', details: err.message });
  }
});

// GET /admin/api/activities
// Returns the 10 most recent audit log entries for the "Recent Activity" feed.
// Includes the username of the user who performed each action.
router.get('/activities', async (req, res) => {
  try {
    const logs = await AuditLog.findAll({
      limit: 10,
      order: [['created_at', 'DESC']], // newest first
      include: [{
        model: User,
        as: 'user',
        attributes: ['username'] // only fetch the username, not the full user record
      }]
    });

    // Transform into a clean, flat format for the frontend
    const transformedLogs = logs.map(log => ({
      log_id:      log.log_id,
      user_id:     log.user_id,
      username:    log.user ? log.user.username : null, // null if user was deleted
      action_type: log.action_type,
      created_at:  log.created_at
    }));

    res.json(transformedLogs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activities', details: err.message });
  }
});

// GET /admin/api/alerts
// Returns the 5 most recent security alerts for the "Alerts" panel.
// Only shows LOGIN_FAILED and UNAUTHORIZED_ACCESS events — these indicate
// potential security issues that need admin attention.
router.get('/alerts', async (req, res) => {
  try {
    const alerts = await Alert.findAll({
      limit: 10,
      order: [['created_at', 'DESC']],
      // The alerts VIEW already filters for security events,
      // but we add an extra filter here to be explicit
      where: {
        action_type: [
          'LOGIN_FAILED',
          'SUBSYSTEM_AUTH_FAILED',
          'SUBSYSTEM_LOGIN_FAILED',
          'UNAUTHORIZED_ACCESS'
        ]
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['username']
      }]
    });

    const transformedAlerts = alerts.map(alert => ({
      alert_id:   alert.alert_id,
      message:    alert.message,
      type:       alert.type || 'warning',
      ip_addr:    alert.ip_addr,
      username:   alert.user ? alert.user.username : null,
      created_at: alert.created_at
    }));

    res.json(transformedAlerts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts', details: err.message });
  }
});

module.exports = router;
