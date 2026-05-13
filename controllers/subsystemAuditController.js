// ── What this file does ──────────────────────────────────────────────────────
// This file handles incoming audit log submissions from OTHER subsystems.
//
// Instead of each subsystem maintaining its own separate audit trail,
// they POST their log entries to this endpoint so everything is stored
// centrally in the Admin subsystem's audit_logs table.
//
// Authentication is done via the X-Subsystem-Key header (a shared secret),
// NOT a user JWT — because this is a machine-to-machine call, not a user action.
//
// Supports both single entries and batches of up to 100 entries at once.
// ─────────────────────────────────────────────────────────────────────────────

const AuditLog = require('../models/auditLog');
const User = require('../models/user');

/**
 * ingestAuditLogs
 *
 * Receives audit log entries from other subsystems and saves them to the database.
 *
 * POST /admin/api/audit/ingest
 * Header: X-Subsystem-Key: <shared secret>
 *
 * Body (single entry):
 *   { user_id, action_type, details, ip_addr, subsystem }
 *
 * Body (batch — array of entries):
 *   [ { ...entry }, { ...entry } ]
 *
 * Rules:
 *   - action_type is auto-prefixed with the subsystem name if not already
 *     e.g. "CREATED" from Patient becomes "PATIENT_CREATED"
 *   - user_id must be a valid UUID that exists in the Admin users table
 *   - ip_addr is optional
 *   - Maximum 100 entries per batch
 */
const ingestAuditLogs = async (req, res) => {
  try {
    // ── Step 1: Verify the subsystem API key ──────────────────────────────────
    // The calling subsystem must include the shared secret in the X-Subsystem-Key header.
    // This prevents unauthorized systems from writing to our audit log.
    const providedKey = req.headers['x-subsystem-key'];
    const expectedKey = process.env.SUBSYSTEM_API_KEY;

    if (!expectedKey || providedKey !== expectedKey) {
      return res.status(401).json({ message: 'Invalid or missing subsystem key' });
    }

    // ── Step 2: Normalize the request body to an array ───────────────────────
    // The body can be either a single object or an array of objects.
    // We normalize it to always be an array so the rest of the code is consistent.
    const entries = Array.isArray(req.body) ? req.body : [req.body];

    if (entries.length === 0) {
      return res.status(400).json({ message: 'No entries provided' });
    }

    // Enforce the batch size limit to prevent abuse
    if (entries.length > 100) {
      return res.status(400).json({ message: 'Maximum 100 entries per batch' });
    }

    // ── Step 3: Validate each entry and build the records array ──────────────
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const records = []; // valid entries ready to insert
    const errors  = []; // validation errors to report back

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const idx   = `entry[${i}]`; // used in error messages to identify which entry failed

      // Validate user_id — must be a valid UUID format
      if (!entry.user_id || !UUID_REGEX.test(entry.user_id)) {
        errors.push(`${idx}: user_id must be a valid UUID`);
        continue;
      }

      if (!entry.action_type || typeof entry.action_type !== 'string') {
        errors.push(`${idx}: action_type is required`);
        continue;
      }

      if (!entry.subsystem || typeof entry.subsystem !== 'string') {
        errors.push(`${idx}: subsystem is required`);
        continue;
      }

      // ── Auto-prefix the action_type with the subsystem name ───────────────
      // Example: "CREATED" from the Patient subsystem becomes "PATIENT_CREATED"
      // If it's already prefixed (e.g., "PATIENT_CREATED"), leave it as-is.
      const subsystemPrefix = entry.subsystem.toUpperCase() + '_';
      const actionType = entry.action_type.toUpperCase().startsWith(subsystemPrefix)
        ? entry.action_type.toUpperCase()
        : subsystemPrefix + entry.action_type.toUpperCase();

      records.push({
        user_id:     entry.user_id,
        action_type: actionType.slice(0, 50), // enforce the 50-char DB column limit
        details:     entry.details || null,
        ip_addr:     entry.ip_addr || null,
        subsystem:   entry.subsystem,
      });
    }

    if (records.length === 0) {
      return res.status(400).json({ message: 'No valid entries', errors });
    }

    // ── Step 4: Verify that all user_ids exist in our database ───────────────
    // We only accept audit logs for users registered in the Admin subsystem.
    const uniqueUserIds = [...new Set(records.map(r => r.user_id))];
    const existingUsers = await User.findAll({
      where: { user_id: uniqueUserIds },
      attributes: ['user_id']
    });

    const validUserIds = new Set(existingUsers.map(u => u.user_id));

    const validRecords   = records.filter(r => validUserIds.has(r.user_id));
    const invalidRecords = records.filter(r => !validUserIds.has(r.user_id));

    if (invalidRecords.length > 0) {
      invalidRecords.forEach(r =>
        errors.push(`user_id ${r.user_id} not found in Admin subsystem users`)
      );
    }

    if (validRecords.length === 0) {
      return res.status(400).json({ message: 'No valid entries after user_id check', errors });
    }

    // ── Step 5: Bulk insert all valid records ─────────────────────────────────
    // bulkCreate inserts all records in a single database query — much faster
    // than inserting them one by one in a loop
    await AuditLog.bulkCreate(validRecords);

    return res.status(201).json({
      message:  `${validRecords.length} audit log(s) recorded`,
      accepted: validRecords.length,
      rejected: errors.length,
      errors:   errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Audit ingest error:', error);
    return res.status(500).json({ message: 'Server error recording audit logs' });
  }
};

module.exports = { ingestAuditLogs };
