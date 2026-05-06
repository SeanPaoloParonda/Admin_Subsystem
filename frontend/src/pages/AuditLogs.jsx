import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const date = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return `${date} ${time}`;
};

const getUserDisplay = (log) => {
  if (!log.user) return { name: 'System', sub: log.user_id?.slice(0, 8) + '...' };
  const { first_name, last_name, username, staff_id, Role: role } = log.user;
  const full = [first_name, last_name].filter(Boolean).join(' ');
  return {
    name: full || username,
    sub: staff_id ? `STF-${String(staff_id).padStart(3, '0')}` : (role?.subsystem || username)
  };
};

const AuditLogs = () => {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState({ username: '', role: '' });
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

  // Detail modal
  const [selectedLog, setSelectedLog] = useState(null);

  const token = localStorage.getItem('accessToken');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchLogs = useCallback(async (currentPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: LIMIT,
        sortOrder,
        ...(actionType && { action_type: actionType }),
        ...(subsystem  && { subsystem }),
        ...(startDate  && { startDate }),
        ...(endDate    && { endDate }),
      });

      const res = await fetch(`/admin/api/audit?${params}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [actionType, subsystem, startDate, endDate, sortOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch distinct action types for dropdown
  useEffect(() => {
    fetch('/admin/api/audit/action-types', { headers })
      .then(r => r.json())
      .then(d => setActionTypes(d.actionTypes || []))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try { setUserInfo(JSON.parse(stored)); } catch {}
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchLogs(1);
  }, [fetchLogs]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchLogs(newPage);
  };

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

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard',          path: '/dashboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
    { label: 'User Management',    path: '/users',     icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
    { label: 'Roles & Permissions',path: '/roles',     icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
    { label: 'Service Catalog',    path: '/services',  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
    { label: 'Audit Logs',         path: '/audit',     active: true, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  ];

  return (
    <div className="audit-logs-page">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <img src="/hospitallogo.png" alt="VitalMed Logo" width="55" height="44" />
          </div>
          <div className="logo-text-wrapper">
            <span className="logo-text">VitalMed</span>
            <span className="logo-subtext">Hospital System</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <div
              key={item.label}
              className={`nav-item ${item.active ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="profile-info">
            <div className="profile-details">
              <div className="profile-name">{userInfo.username || 'Admin'}</div>
              <div className="profile-role">{userInfo.role || 'Administrator'}</div>
            </div>
          </div>
          <button className="logout-btn" title="Logout" onClick={handleLogout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>

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
                onKeyDown={e => e.key === 'Enter' && fetchLogs(1)}
              />
            </div>
            <select
              className="filter-select"
              value={subsystem}
              onChange={e => setSubsystem(e.target.value)}
            >
              <option value="">All Subsystems</option>
              <option value="Admin">Admin</option>
              <option value="Patient">Patient</option>
              <option value="Predictive">Predictive</option>
              <option value="Inventory">Inventory</option>
              <option value="Customer">Customer</option>
              <option value="Billing">Billing</option>
              <option value="Staff">Staff</option>
            </select>
            <select
              className="filter-select"
              value={actionType}
              onChange={e => setActionType(e.target.value)}
            >
              <option value="">All Action Types</option>
              {actionTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="date-range">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                title="Start date"
              />
              <span>—</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                title="End date"
              />
            </div>
            {(subsystem || actionType || startDate || endDate) && (
              <button className="clear-btn" onClick={() => { setSubsystem(''); setActionType(''); setStartDate(''); setEndDate(''); }}>
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
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="empty-row">No logs found.</td>
                      </tr>
                    ) : logs.map(log => {
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
                  Showing {logs.length === 0 ? 0 : (page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total} entries
                </span>
                <div className="pagination-btns">
                  <button
                    className="page-btn"
                    disabled={page <= 1}
                    onClick={() => handlePageChange(page - 1)}
                  >
                    Previous
                  </button>
                  <button
                    className="page-btn active-page"
                    disabled={page >= totalPages}
                    onClick={() => handlePageChange(page + 1)}
                  >
                    Next
                  </button>
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
                ['User ID',    selectedLog.user_id],
                ['Action',     selectedLog.action_type],
                ['Details',    selectedLog.details || '-'],
                ['IP Address', selectedLog.ip_addr || '-'],
              ].map(([label, value]) => (
                <div key={label} className="detail-row">
                  <span className="detail-label">{label}</span>
                  <span className="detail-value">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
