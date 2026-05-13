import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import './AuditLogs.css';

const LIMIT = 15;

// Color map for action type badges
const getActionColor = (action = '') => {
  const a = action.toUpperCase();
  if (a.includes('LOGIN_SUCCESS') || a.includes('LOGIN_GRANTED')) return 'badge-green';
  if (a.includes('LOGIN_FAILED') || a.includes('AUTH_FAILED'))    return 'badge-red';
  if (a.includes('LOGOUT'))                                        return 'badge-gray';
  if (a.includes('CREATED') || a.includes('CREATE'))              return 'badge-blue';
  if (a.includes('UPDATED') || a.includes('PATCH'))               return 'badge-yellow';
  if (a.includes('DEACTIVATED') || a.includes('DELETED'))         return 'badge-orange';
  if (a.includes('EXPORT'))                                        return 'badge-purple';
  return 'badge-default';
};

const formatTimestamp = (ts) => {
  if (!ts) return '-';
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

const getUserDisplay = (log) => {
  if (!log.user) return { name: 'System', sub: log.subsystem || log.user_id?.slice(0, 8) + '...' };
  const { first_name, last_name, username, Role: role, actorRole } = log.user;
  const full = [first_name, last_name].filter(Boolean).join(' ');
  return {
    name: full || username || 'Unknown',
    sub: log.subsystem || actorRole || role?.subsystem || username || ''
  };
};

const AuditLogs = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState('');
  const [subsystem, setSubsystem] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [actionTypes, setActionTypes] = useState([]);
  const [logSource, setLogSource] = useState('internal'); // 'internal' | 'customer'

  // External logs stored separately so client-side filters work on full dataset
  const [allExternalLogs, setAllExternalLogs] = useState([]);

  // Detail modal
  const [selectedLog, setSelectedLog] = useState(null);

  const token = localStorage.getItem('accessToken');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchLogs = useCallback(async (currentPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      if (logSource === 'customer') {
        // Fetch all from Customer Support external API — no server-side pagination
        const res = await fetch('/admin/api/audit/external/customer', { headers });
        if (!res.ok) {
          setAllExternalLogs([]);
          setLogs([]);
          setTotal(0);
          setTotalPages(1);
          setError('Customer Support audit logs are unavailable.');
          return;
        }
        const json = await res.json();
        const all = json.logs || [];
        setAllExternalLogs(all);
        setTotal(all.length);
        setTotalPages(1);
        setLogs(all);
      } else {
        // Fetch internal logs
        const params = new URLSearchParams({
          page: currentPage,
          limit: LIMIT,
          sortOrder,
          ...(actionType && { action_type: actionType }),
          ...(subsystem  && { subsystem }),
          ...(search     && { search }),
          ...(startDate  && { startDate }),
          ...(endDate    && { endDate }),
        });
        const res = await fetch(`/admin/api/audit?${params}`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      if (logSource === 'customer') {
        setError('Customer Support audit logs are unavailable.');
      } else if (err.message === 'Failed to fetch') {
        setError('Audit logs are unavailable. Please check if the backend server is running.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [logSource, actionType, subsystem, startDate, endDate, sortOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch distinct action types for dropdown — filtered by selected subsystem
  useEffect(() => {
    const params = subsystem ? `?subsystem=${subsystem}` : '';
    fetch(`/admin/api/audit/action-types${params}`, { headers })
      .then(r => r.json())
      .then(d => setActionTypes(d.actionTypes || []))
      .catch(() => {});
  }, [subsystem]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(1);
    fetchLogs(1);
  }, [fetchLogs]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchLogs(newPage);
  };

  // Search across multiple fields for both internal and external logs
  const matchesSearch = (log) => {
    if (!search) return true;
    const term = search.toLowerCase();
    const u = getUserDisplay(log);
    return [
      log.action_type,
      log.details,
      log.ip_addr,
      log.user_id,
      u.name,
      u.sub,
      log.user?.username,
      log.user?.actorRole,
      log.user?.title,
      log.user?.inquiryId,
    ].filter(Boolean).some(value => String(value).toLowerCase().includes(term));
  };

  // For external logs: apply client-side filters on the full dataset
  const displayedLogs = logSource === 'customer'
    ? allExternalLogs.filter(log => {
        const matchSearch = matchesSearch(log);
        const matchAction = !actionType || log.action_type === actionType;
        const logDate = log.created_at ? new Date(log.created_at) : null;
        const matchStart = !startDate || (logDate && logDate >= new Date(startDate));
        const matchEnd = !endDate || (logDate && logDate <= new Date(endDate + 'T23:59:59'));
        return matchSearch && matchAction && matchStart && matchEnd;
      }).sort((a, b) => {
        const da = new Date(a.created_at || 0);
        const db = new Date(b.created_at || 0);
        return sortOrder === 'ASC' ? da - db : db - da;
      })
    : logs.filter(matchesSearch);

  // Distinct action types from external logs for the dropdown
  const externalActionTypes = [...new Set(allExternalLogs.map(l => l.action_type).filter(Boolean))].sort();

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        ...(actionType && { action_type: actionType }),
        ...(startDate  && { startDate }),
        ...(endDate    && { endDate }),
      });
      const res = await fetch(`/admin/api/audit/export?${params}`, { headers });
      const data = await res.json();

      // Convert to CSV
      const csvRows = [
        ['Log ID', 'Timestamp', 'User', 'Action Type', 'Details', 'IP Address'],
        ...data.logs.map(l => {
          const u = getUserDisplay(l);
          return [
            l.log_id,
            formatTimestamp(l.created_at),
            u.name,
            l.action_type,
            `"${(l.details || '').replace(/"/g, '""')}"`,
            l.ip_addr || '-'
          ];
        })
      ];
      const csv = csvRows.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  };

  return (
    <div className="audit-logs-page">
      <Sidebar />

      {/* Main */}
      <main className="main-content">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          <span onClick={() => navigate('/dashboard')}>Dashboard</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-active">Audit Logs</span>
        </div>

        {/* Page header */}
        <div className="page-header">
          <h1>Audit Logs</h1>
          <button className="export-btn" onClick={handleExport}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Logs
          </button>
        </div>

        {/* Panel */}
        <div className="audit-panel">
          <div className="panel-title-row">
            <div>
              <h3>Activity History</h3>
              <p className="panel-sub">Track all system activities across all subsystems</p>
            </div>
          </div>

          {/* Source tabs */}
          <div className="source-tabs">
            <button
              className={`source-tab ${logSource === 'internal' ? 'active' : ''}`}
              onClick={() => { setLogSource('internal'); setActionType(''); setSearch(''); setStartDate(''); setEndDate(''); }}
            >
              Internal Logs
            </button>
            <button
              className={`source-tab ${logSource === 'customer' ? 'active' : ''}`}
              onClick={() => { setLogSource('customer'); setActionType(''); setSearch(''); setStartDate(''); setEndDate(''); setSubsystem(''); }}
            >
              Customer Support
            </button>
          </div>

          {/* Filters */}
          <div className="filter-bar">
            <div className="search-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search logs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && logSource === 'internal') fetchLogs(1); }}
              />
            </div>
            {logSource === 'internal' && (
              <select className="filter-select" value={subsystem} onChange={e => { setSubsystem(e.target.value); setActionType(''); }}>
                <option value="">All Subsystems</option>
                <option value="Admin">Admin</option>
                <option value="Patient">Patient</option>
                <option value="Predictive">Predictive</option>
                <option value="Inventory">Inventory</option>
                <option value="Customer">Customer</option>
                <option value="Billing">Billing</option>
                <option value="Staff">Staff</option>
              </select>
            )}
            <select className="filter-select" value={actionType} onChange={e => setActionType(e.target.value)}>
              <option value="">All Action Types</option>
              {(logSource === 'customer' ? externalActionTypes : actionTypes).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="date-range">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} title="Start date" />
              <span>—</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} title="End date" />
            </div>
            {(subsystem || actionType || startDate || endDate || search) && (
              <button className="clear-btn" onClick={() => { setSubsystem(''); setActionType(''); setStartDate(''); setEndDate(''); setSearch(''); }}>
                Clear
              </button>
            )}
          </div>


          {/* Table */}
          {loading ? (
            <div className="state-msg">Loading...</div>
          ) : error ? (
            <div className="state-msg error">Error: {error}</div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th>
                        <button
                          className="sort-btn"
                          onClick={() => setSortOrder(s => s === 'DESC' ? 'ASC' : 'DESC')}
                          title={sortOrder === 'DESC' ? 'Newest first — click for oldest first' : 'Oldest first — click for newest first'}
                        >
                          Timestamp
                          <span className="sort-icon">{sortOrder === 'DESC' ? ' ↓' : ' ↑'}</span>
                        </button>
                      </th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Details</th>
                      <th>IP Address</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedLogs.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="empty-row">No logs found.</td>
                      </tr>
                    ) : displayedLogs.map(log => {
                      const u = getUserDisplay(log);
                      return (
                        <tr key={log.log_id}>
                          <td className="col-timestamp">{formatTimestamp(log.created_at)}</td>
                          <td className="col-user">
                            <span className="user-name">{u.name}</span>
                            <span className="user-sub">{u.sub}</span>
                          </td>
                          <td className="col-action">
                            <span className={`action-badge ${getActionColor(log.action_type)}`}>
                              {log.action_type}
                            </span>
                          </td>
                          <td className="col-details">{log.details || '-'}</td>
                          <td className="col-ip">{log.ip_addr || '-'}</td>
                          <td className="col-view">
                            <button
                              className="view-btn"
                              title="View details"
                              onClick={() => setSelectedLog(log)}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="pagination-row">
                <span className="pagination-info">
                  {logSource === 'customer'
                    ? `Showing ${displayedLogs.length} of ${allExternalLogs.length} entries`
                    : `Showing ${logs.length === 0 ? 0 : (page - 1) * LIMIT + 1}–${Math.min(page * LIMIT, total)} of ${total} entries`
                  }
                </span>
                <div className="pagination-btns">
                  {logSource === 'internal' && (
                    <>
                      <button className="page-btn" disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>Previous</button>
                      <span className="page-indicator">Page {page} of {totalPages}</span>
                      <button className="page-btn active-page" disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)}>Next</button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="modal-backdrop" onClick={() => setSelectedLog(null)}>
          <div className="detail-modal" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <h3>Log Details</h3>
              <button className="modal-close" onClick={() => setSelectedLog(null)}>×</button>
            </div>
            <div className="detail-body">
              {[
                ['Log ID',     selectedLog.log_id],
                ['Timestamp',  formatTimestamp(selectedLog.created_at)],
                ['User',       getUserDisplay(selectedLog).name],
                ['Role',       selectedLog.user?.actorRole || selectedLog.user?.Role?.subsystem || '-'],
                ['User ID',    selectedLog.user_id],
                ['Action',     selectedLog.action_type],
                ['Title',      selectedLog.user?.title || '-'],
                ['Details',    selectedLog.details || '-'],
                ['Inquiry ID', selectedLog.user?.inquiryId || '-'],
                ['IP Address', selectedLog.ip_addr || '-'],
              ].filter(([, v]) => v && v !== '-').map(([label, value]) => (
                <div key={label} className="detail-row">
                  <span className="detail-label">{label}</span>
                  <span className="detail-value">{value}</span>
                </div>
              ))}
              {selectedLog.user?.metadata && (
                <div className="detail-row">
                  <span className="detail-label">Metadata</span>
                  <span className="detail-value" style={{ fontFamily: 'monospace', fontSize: '0.82rem', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(selectedLog.user.metadata, null, 2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
