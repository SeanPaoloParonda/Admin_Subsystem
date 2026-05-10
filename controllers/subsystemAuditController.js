const AuditLog = require('../models/auditLog');
const User = require('../models/user');

/**
 * Ingest audit log entries from other subsystems
 *
 * Other subsystems POST to /admin/api/audit/ingest with:
 *   Headers:
 *     X-Subsystem-Key: <shared secret>
 *     Content-Type: application/json
 *   Body (single entry):
 *     {
 *       "user_id": "uuid-of-the-user",
 *       "action_type": "PATIENT_CREATED",
 *       "details": "Patient record created by dr.smith",
 *       "ip_addr": "192.168.1.10",
 *       "subsystem": "Patient"
 *     }
 *   Body (batch — array of entries):
 *     [ { ...entry }, { ...entry } ]
 *
 * Rules:
 *   - action_type is prefixed with the subsystem name if not already
 *     e.g. "PATIENT_CREATED" stays as-is, "CREATED" becomes "PATIENT_CREATED"
 *   - user_id must be a valid UUID that exists in our users table
 *   - ip_addr is optional
 *   - Up to 100 entries per batch
 */
const ingestAuditLogs = async (req, res) => {
  try {
    // ── 1. Verify subsystem API key ──────────────────────────────────────────
    const providedKey = req.headers['x-subsystem-key'];
    const expectedKey = process.env.SUBSYSTEM_API_KEY;

    if (!expectedKey || providedKey !== expectedKey) {
      return res.status(401).json({ message: 'Invalid or missing subsystem key' });
    }

    // ── 2. Normalise to array ────────────────────────────────────────────────
    const entries = Array.isArray(req.body) ? req.body : [req.body];

    if (entries.length === 0) {
      return res.status(400).json({ message: 'No entries provided' });
    }
    if (entries.length > 100) {
      return res.status(400).json({ message: 'Maximum 100 entries per batch' });
    }

    // ── 3. Validate and build records ────────────────────────────────────────
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const records = [];
    const errors  = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const idx   = `entry[${i}]`;

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

      // Prefix action_type with subsystem if not already prefixed
      const subsystemPrefix = entry.subsystem.toUpperCase() + '_';
      const actionType = entry.action_type.toUpperCase().startsWith(subsystemPrefix)
        ? entry.action_type.toUpperCase()
        : subsystemPrefix + entry.action_type.toUpperCase();

      records.push({
        user_id:     entry.user_id,
        action_type: actionType.slice(0, 50),
        details:     entry.details || null,
        ip_addr:     entry.ip_addr || null,
        subsystem:   entry.subsystem,
      });
    }

    if (records.length === 0) {
      return res.status(400).json({ message: 'No valid entries', errors });
    }

    // ── 4. Verify user_ids exist in our DB ───────────────────────────────────
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

    // ── 5. Bulk insert ───────────────────────────────────────────────────────
    await AuditLog.bulkCreate(validRecords);

    return res.status(201).json({
      message: `${validRecords.length} audit log(s) recorded`,
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
