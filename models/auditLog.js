// ── What this file does ──────────────────────────────────────────────────────
// This file defines the AuditLog model — the blueprint for the 'audit_logs' table.
//
// Every important action in the system (login, user creation, role change, etc.)
// is recorded here as an audit log entry. This creates a permanent trail of
// "who did what, when, and from where."
//
// Important design note: user_id has NO foreign key constraint.
// This is intentional — audit logs must always be writable, even for
// system-generated events or users that no longer exist in the database.
// A placeholder UUID '00000000-0000-0000-0000-000000000000' is used for system events.
// ─────────────────────────────────────────────────────────────────────────────

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AuditLog = sequelize.define('AuditLog', {

  // log_id: the primary key — auto-incrementing integer
  log_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },

  // created_at: when this log entry was recorded
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },

  // user_id: the UUID of the user who performed the action
  // NOTE: No foreign key reference — audit logs must remain writable
  // even for unknown users (failed logins) or deleted users.
  user_id: {
    type: DataTypes.UUID,
    allowNull: false
  },

  // action_type: a short code describing what happened
  // Examples: 'LOGIN_SUCCESS', 'USER_CREATED', 'ROLE_UPDATED', 'LOGIN_FAILED'
  action_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },

  // details: a human-readable description of the action
  details: {
    type: DataTypes.TEXT
  },

  // ip_addr: the IP address the request came from
  // Stored as a string to support both IPv4 (max 15 chars) and IPv6 (max 45 chars)
  ip_addr: {
    type: DataTypes.STRING(45)
  },

  // subsystem: which part of the system generated this log entry
  // Examples: 'Admin', 'Patient', 'Billing', 'Customer'
  subsystem: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
}, {
  tableName: 'audit_logs',
  timestamps: false,
  freezeTableName: true
});

module.exports = AuditLog;
