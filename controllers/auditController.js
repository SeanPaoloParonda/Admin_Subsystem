// ── What this file does ──────────────────────────────────────────────────────
// This file contains the controller functions for reading and exporting
// audit log entries:
//   - getAllLogs:       list all audit logs with filtering and pagination
//   - getLogById:       get a single audit log entry by its ID
//   - getUserLogs:      get all audit logs for a specific user
//   - getRecentActivity: get the most recent audit log entries (for dashboard)
//   - getActionTypes:   get a list of all distinct action types (for filters)
//   - exportLogs:       export audit logs as JSON (for reporting)
//
// These functions are called by the routes in routes/auditRoutes.js.
// ─────────────────────────────────────────────────────────────────────────────

// Import the models needed for audit log queries
const AuditLog = require('../models/auditLog');
const User = require('../models/user');
const Role = require('../models/role');

// Op contains Sequelize operators like Op.gte (greater than or equal), Op.iLike (case-insensitive LIKE)
const { Op } = require('sequelize');

// sequelize is needecd for raw SQL functions like DISTINCT
const sequelize = require('../config/db');

// logAdminAction records the export event in the audit log
const { logAdminAction } = require('../utils/auditUtils');

// ── Association setup ─────────────────────────────────────────────────────────
// Set up the AuditLog → User association so we can include usernames in queries.
// The 'if' check prevents the association from being registered twice.
if (!AuditLog.associations.user) {
  AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
}

/**
 * getAllLogs
 *
 * Returns all audit logs with optional filtering by user, action type,
 * date range, subsystem, and search term. Supports pagination.
 *
 * GET /admin/api/audit
 * Query params: page, limit, user_id, action_type, startDate, endDate, search, subsystem, sortOrder
 */
const getAllLogs = async (req, res) => {
  try {
    // Extract filter and pagination options from the query string
    const { page = 1, limit = 20, user_id, action_type, startDate, endDate, search, subsystem, sortOrder = 'DESC' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    // Calculate how many records to skip based on the current page
    const offset = (pageNum - 1) * limitNum;

    // ── Build the WHERE clause dynamically ────────────────────────────────────
    const where = {};

    // Filter by user_id if provided
    if (user_id) where.user_id = user_id;

    // Filter by action_type if provided
    if (action_type) where.action_type = action_type;

    // Filter by search term (case-insensitive partial match on action_type)
    if (search) where.action_type = { [Op.iLike]: `%${search}%` };

    // Filter by subsystem if provided
    if (subsystem) where.subsystem = subsystem;

    // Filter by date range if provided
    if (startDate || endDate) {
      where.created_at = {};
      // Greater than or equal to the start date
      if (startDate) where.created_at[Op.gte] = new Date(startDate);
      // Less than or equal to the end date (set to end of day)
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // include the entire end day
        where.created_at[Op.lte] = end;
      }
    }

    // ── Build the Role include ────────────────────────────────────────────────
    // We include the user's role to get the subsystem info (though subsystem
    // is now stored directly on the audit_log row, this is kept for compatibility)
    const roleInclude = {
      model: Role,
      attributes: ['subsystem'],
    };

    // ── Fetch the logs ────────────────────────────────────────────────────────
    const logs = await AuditLog.findAndCountAll({
      where,
      order: [['created_at', sortOrder === 'ASC' ? 'ASC' : 'DESC']], // sort by date
      limit: limitNum,
      offset,
      include: [{
        model: User,
        as: 'user',
        attributes: ['username', 'first_name', 'last_name'],
        required: false, // LEFT JOIN — include logs even if the user no longer exists
        include: [roleInclude]
      }]
    });

    // Return the logs along with pagination metadata
    res.json({
      logs: logs.rows,                              // the logs for this page
      total: logs.count,                            // total matching logs
      page: pageNum,
      totalPages: Math.ceil(logs.count / limitNum)  // how many pages exist
    });
  } catch (error) {
    console.error('Get all logs error:', error);
    res.status(500).json({ message: 'Server error fetching audit logs' });
  }
};

/**
 * getLogById
 *
 * Returns a single audit log entry by its log_id.
 *
 * GET /admin/api/audit/:id
 */
const getLogById = async (req, res) => {
  try {
    const { id } = req.params;

    const log = await AuditLog.findByPk(id);

    // Return 404 if the log doesn't exist
    if (!log) return res.status(404).json({ message: 'Audit log not found' });

    res.json(log);
  } catch (error) {
    console.error('Get log by ID error:', error);
    res.status(500).json({ message: 'Server error fetching audit log' });
  }
};

/**
 * getUserLogs
 *
 * Returns all audit logs for a specific user, identified by their user_id.
 * Supports pagination.
 *
 * GET /admin/api/audit/user/:userId
 * Query params: page, limit
 */
const getUserLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const logs = await AuditLog.findAndCountAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']], // newest first
      limit: limitNum,
      offset
    });

    res.json({
      logs: logs.rows,
      total: logs.count,
      page: pageNum,
      totalPages: Math.ceil(logs.count / limitNum)
    });
  } catch (error) {
    console.error('Get user logs error:', error);
    res.status(500).json({ message: 'Server error fetching user logs' });
  }
};

/**
 * getRecentActivity
 *
 * Returns the most recent audit log entries.
 * Used on the dashboard to show a "Recent Activity" feed.
 *
 * GET /admin/api/audit/recent
 * Query params: limit (default: 10)
 */
const getRecentActivity = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const logs = await AuditLog.findAll({
      order: [['created_at', 'DESC']], // newest first
      limit: parseInt(limit)
    });

    res.json({ logs });
  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({ message: 'Server error fetching recent activity' });
  }
};

/**
 * getActionTypes
 *
 * Returns a list of all distinct action_type values in the audit log.
 * Used to populate filter dropdowns in the frontend.
 * Optionally filters by subsystem.
 *
 * GET /admin/api/audit/action-types
 * Query params: subsystem (optional)
 */
const getActionTypes = async (req, res) => {
  try {
    const { subsystem } = req.query;

    // Build the WHERE clause — filter by subsystem if provided
    const where = subsystem ? { subsystem } : {};

    // Use Sequelize's fn and col helpers to run a DISTINCT query
    const logs = await AuditLog.findAll({
      where,
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('action_type')), 'action_type']],
      order: [['action_type', 'ASC']] // alphabetical order
    });

    // Extract just the action_type strings into a simple array
    res.json({ actionTypes: logs.map(l => l.action_type) });
  } catch (error) {
    console.error('Get action types error:', error);
    res.status(500).json({ message: 'Server error fetching action types' });
  }
};

/**
 * getActionStats
 *
 * Returns a count of how many times each action_type appears in the audit log.
 * This can be used for analytics or dashboard charts.
 *
 * (Not currently used in the routes, but included here for future use)
 */
const getActionStats = async (req, res) => {
  try {
    // Group by action_type and count how many times each appears
    const logs = await AuditLog.findAll({
      attributes: ['action_type', [sequelize.fn('COUNT', sequelize.col('log_id')), 'count']],
      group: ['action_type']
    });

    res.json({ stats: logs });
  } catch (error) {
    console.error('Get action stats error:', error);
    res.status(500).json({ message: 'Server error fetching action statistics' });
  }
};

/**
 * exportLogs
 *
 * Exports audit logs as a JSON dataset for reporting or download.
 * Supports the same filters as getAllLogs (date range, user, action type).
 * Records the export event in the audit log.
 *
 * GET /admin/api/audit/export
 * Query params: startDate, endDate, user_id, action_type
 */
const exportLogs = async (req, res) => {
  try {
    const { startDate, endDate, user_id, action_type } = req.query;

    // Build the WHERE clause based on the provided filters
    const where = {};
    if (user_id) where.user_id = user_id;
    if (action_type) where.action_type = action_type;

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at[Op.gte] = new Date(startDate);
      if (endDate) where.created_at[Op.lte] = new Date(endDate);
    }

    // Fetch all matching logs (no pagination — export everything)
    const logs = await AuditLog.findAll({
      where,
      order: [['created_at', 'DESC']]
    });

    // Record the export event in the audit log
    await logAdminAction({
      user_id: req.user.user_id,
      action_type: 'AUDIT_EXPORT',
      details: `Audit logs exported by ${req.user.username}`,
      ip_addr: req.ip
    });

    // Return the logs as a JSON array
    res.json({
      message: 'Export successful',
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('Export logs error:', error);
    res.status(500).json({ message: 'Server error exporting audit logs' });
  }
};

// Export all functions for use in the audit routes
module.exports = {
  getAllLogs,
  getLogById,
  getUserLogs,
  getRecentActivity,
  getActionStats,
  getActionTypes,
  exportLogs
};
