/**
 * External Audit Log Controller
 *
 * Fetches audit logs from other subsystems that maintain their own audit trail.
 * Normalizes the response to match our internal audit log format so the frontend
 * can display them consistently.
 *
 * Supported subsystems:
 *   - Customer Support (MongoDB Atlas via linepoint.vercel.app)
 */

/**
 * Fetch and normalize Customer Support audit logs
 * GET /admin/api/audit/external/customer
 */
const getCustomerAuditLogs = async (_req, res) => {
  try {
    const apiKey = process.env.AUDIT_LOGS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'Server misconfiguration: AUDIT_LOGS_API_KEY not set' });
    }

    const response = await fetch('https://linepoint.vercel.app/api/v1/audit-logs', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Customer audit API error:', response.status, text);
      return res.status(502).json({
        message: `Customer Support audit API returned ${response.status}`
      });
    }

    const data = await response.json();

    // Normalize to our internal format
    // Their format (MongoDB) may differ — map common fields defensively
    const rawLogs = Array.isArray(data) ? data : (data.logs || data.data || data.auditLogs || []);

    const normalized = rawLogs.map((log, i) => ({
      log_id:      log._id || log.id || `customer-${i}`,
      created_at:  log.createdAt || null,
      user_id:     log.actorId || null,
      action_type: log.action ? log.action.toUpperCase().replace(/\./g, '_') : 'UNKNOWN',
      details:     log.description || log.title || null,
      ip_addr:     null, // not provided by Customer Support API
      subsystem:   'Customer',
      user: {
        username:   log.actorName || log.staffName || log.actorId || 'Unknown',
        first_name: null,
        last_name:  null,
        // preserve extra fields for the detail modal
        actorRole:  log.actorRole || null,
        inquiryId:  log.inquiryId || null,
        title:      log.title || null,
        metadata:   log.metadata || null,
      }
    }));

    res.json({
      logs: normalized,
      total: normalized.length,
      subsystem: 'Customer'
    });

  } catch (error) {
    console.error('External audit fetch error (Customer):', error.message);
    res.status(500).json({ message: 'Failed to fetch Customer Support audit logs' });
  }
};

module.exports = { getCustomerAuditLogs };
