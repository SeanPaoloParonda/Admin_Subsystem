// ── What this file does ──────────────────────────────────────────────────────
// This file fetches audit logs from external subsystems that maintain their
// OWN separate audit trail (rather than submitting logs to us via /ingest).
//
// Currently supported external subsystem:
//   - Customer Support (hosted at linepoint.vercel.app, uses MongoDB Atlas)
//
// Because the Customer Support system stores its logs in a different database
// with a different data format, we fetch them on demand and normalize them
// to match our internal audit log format before sending them to the frontend.
//
// This way, the frontend can display all audit logs — from all subsystems —
// in a consistent format, regardless of where they are stored.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getCustomerAuditLogs
 *
 * Fetches audit logs from the Customer Support subsystem's external API,
 * normalizes them to our internal format, and returns them to the frontend.
 *
 * GET /admin/api/audit/external/customer
 *
 * The Customer Support API requires an API key sent in the x-api-key header.
 * This key is stored in the AUDIT_LOGS_API_KEY environment variable.
 */
const getCustomerAuditLogs = async (_req, res) => {
  try {
    // Read the API key for the Customer Support system from the environment
    const apiKey = process.env.AUDIT_LOGS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ message: 'Server misconfiguration: AUDIT_LOGS_API_KEY not set' });
    }

    // ── Fetch logs from the external API ─────────────────────────────────────
    const response = await fetch('https://linepoint.vercel.app/api/v1/audit-logs', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,          // authenticate with the Customer Support API
        'Content-Type': 'application/json'
      }
    });

    // If the external API returned an error, return a 502 Bad Gateway error.
    // 502 means "we got a bad response from an upstream server."
    if (!response.ok) {
      const text = await response.text();
      console.error('Customer audit API error:', response.status, text);
      return res.status(502).json({
        message: `Customer Support audit API returned ${response.status}`
      });
    }

    const data = await response.json();

    // ── Normalize the response to our internal format ─────────────────────────
    // The Customer Support API uses MongoDB, so its data structure is different.
    // We defensively try several possible field names to find the array of logs.
    const rawLogs = Array.isArray(data) ? data : (data.logs || data.data || data.auditLogs || []);

    // Map each external log entry to our internal audit log format
    const normalized = rawLogs.map((log, i) => ({
      // Use their ID if available, otherwise generate a fallback ID
      log_id:      log._id || log.id || `customer-${i}`,

      // Timestamp of when the action occurred
      created_at:  log.createdAt || null,

      // The ID of the user who performed the action
      user_id:     log.actorId || null,

      // Normalize the action name: convert dots to underscores and uppercase
      // e.g., "inquiry.resolved" becomes "INQUIRY_RESOLVED"
      action_type: log.action ? log.action.toUpperCase().replace(/\./g, '_') : 'UNKNOWN',

      // A human-readable description of what happened
      details:     log.description || log.title || null,

      // IP address is not provided by the Customer Support API
      ip_addr:     null,

      // Tag all these logs as coming from the Customer subsystem
      subsystem:   'Customer',

      // Build a user object in the same shape our frontend expects
      user: {
        username:   log.actorName || log.staffName || log.actorId || 'Unknown',
        first_name: null,
        last_name:  null,
        // Preserve extra fields from the Customer Support API for the detail modal
        actorRole:  log.actorRole || null,
        inquiryId:  log.inquiryId || null,
        title:      log.title || null,
        metadata:   log.metadata || null,
      }
    }));

    res.json({
      logs:      normalized,
      total:     normalized.length,
      subsystem: 'Customer'
    });

  } catch (error) {
    console.error('External audit fetch error (Customer):', error.message);
    res.status(500).json({ message: 'Failed to fetch Customer Support audit logs' });
  }
};

module.exports = { getCustomerAuditLogs };
