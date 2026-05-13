// ── What this file does ──────────────────────────────────────────────────────
// This file provides a helper function for recording audit log entries.
//
// An audit log is a record of important actions that happen in the system,
// such as a user logging in, a new user being created, or a role being changed.
// These logs help administrators track what happened, when, and who did it.
//
// This utility is specifically for actions that originate from the Admin subsystem.
// It automatically tags every log entry with subsystem: 'Admin'.
// ─────────────────────────────────────────────────────────────────────────────

// Import the AuditLog model so we can write records to the audit_logs table
const AuditLog = require('../models/auditLog');

/**
 * logAdminAction
 *
 * Creates a new audit log entry in the database, tagged as coming from
 * the Admin subsystem. Call this whenever an important action occurs
 * (login, user creation, role change, etc.).
 *
 * This function is intentionally "fire and forget" — if the audit log
 * fails to save, it logs the error to the console but does NOT crash
 * the main request. Audit logging should never block the user's action.
 *
 * @param {object} data
 * @param {string} data.user_id     - The UUID of the user who performed the action
 * @param {string} data.action_type - A short code describing the action (e.g., 'LOGIN_SUCCESS')
 * @param {string} data.details     - A human-readable description of what happened
 * @param {string} data.ip_addr     - The IP address the request came from
 */
const logAdminAction = (data) => {
  // Create the audit log record, spreading in the provided data
  // and adding subsystem: 'Admin' to identify where this action came from
  return AuditLog.create({
    ...data,
    subsystem: 'Admin'
  }).catch(err => console.error('Audit log failed:', err.message));
  // If saving fails, log the error but don't throw — the main operation continues
};

// Export the function so controllers can import and use it
module.exports = { logAdminAction };
