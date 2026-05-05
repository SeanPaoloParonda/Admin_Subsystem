const AuditLog = require('../models/auditLog');
const { Op } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Get all audit logs (with pagination and filtering)
 */
const getAllLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, user_id, action_type, startDate, endDate } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const where = {};
    if (user_id) where.user_id = user_id;
    if (action_type) where.action_type = action_type;

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at[Op.gte] = new Date(startDate);
      if (endDate) where.created_at[Op.lte] = new Date(endDate);
    }

    const logs = await AuditLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
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
    console.error('Get all logs error:', error);
    res.status(500).json({ message: 'Server error fetching audit logs' });
  }
};

/**
 * Get audit log by ID
 */
const getLogById = async (req, res) => {
  try {
    const { id } = req.params;
    const log = await AuditLog.findByPk(id);

    if (!log) return res.status(404).json({ message: 'Audit log not found' });

    res.json(log);
  } catch (error) {
    console.error('Get log by ID error:', error);
    res.status(500).json({ message: 'Server error fetching audit log' });
  }
};

/**
 * Get logs for a specific user
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
      order: [['created_at', 'DESC']],
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
 * Get recent activity logs (dashboard)
 */
const getRecentActivity = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const logs = await AuditLog.findAll({
      order: [['created_at', 'DESC']],
      limit: parseInt(limit)
    });

    res.json({ logs });
  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({ message: 'Server error fetching recent activity' });
  }
};

/**
 * Get action type statistics
 */
const getActionStats = async (req, res) => {
  try {
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
 * Export audit logs (for reporting)
 */
const exportLogs = async (req, res) => {
  try {
    const { startDate, endDate, user_id, action_type } = req.query;

    const where = {};
    if (user_id) where.user_id = user_id;
    if (action_type) where.action_type = action_type;

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at[Op.gte] = new Date(startDate);
      if (endDate) where.created_at[Op.lte] = new Date(endDate);
    }

    const logs = await AuditLog.findAll({
      where,
      order: [['created_at', 'DESC']]
    });

    await AuditLog.create({
      user_id: req.user.user_id,
      action_type: 'AUDIT_EXPORT',
      details: `Audit logs exported by ${req.user.username}`,
      ip_addr: req.ip || req.connection.remoteAddress
    });

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

module.exports = {
  getAllLogs,
  getLogById,
  getUserLogs,
  getRecentActivity,
  getActionStats,
  exportLogs
};
