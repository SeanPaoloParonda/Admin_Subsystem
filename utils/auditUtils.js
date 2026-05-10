const AuditLog = require('../models/auditLog');

/**
 * Create an audit log entry tagged with the Admin subsystem.
 * Use this for all actions originating from the Admin subsystem itself.
 *
 * @param {object} data - { user_id, action_type, details, ip_addr }
 */
const logAdminAction = (data) => {
  return AuditLog.create({
    ...data,
    subsystem: 'Admin'
  }).catch(err => console.error('Audit log failed:', err.message));
};

module.exports = { logAdminAction };
