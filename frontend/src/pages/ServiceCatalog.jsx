import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './ServiceCatalog.css';

const LIMIT = 15;

const formatDate = (ts) => {
  if (!ts) return '-';
  return new Date(ts).toLocaleDateString('en-CA'); // YYYY-MM-DD
};

const formatCost = (cost) => {
  if (cost === null || cost === undefined) return '-';
  return `₱ ${parseFloat(cost).toLocaleString()}`;
};

const ServiceCatalog = () => {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState({ username: '', role: '' });
  const [services, setServices] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);

  // Add/Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [form, setForm] = useState({ service_name: '', category: '', base_cost: '', is_available: true });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Actions dropdown
  const [openMenuId, setOpenMenuId] = useState(null);

  const token = localStorage.getItem('accessToken');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchServices = useCallback(async (currentPage = 1, cat = categoryFilter) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: LIMIT,
        ...(cat && { category: cat }),
      });
      const res = await fetch(`/admin/api/reference?${params}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rows = data.services || [];
      setServices(rows);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);

      // Build category list from all fetched services
      setCategories(prev => {
        const all = Array.from(new Set([...prev, ...rows.map(s => s.category).filter(Boolean)])).sort();
        return all;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try { setUserInfo(JSON.parse(stored)); } catch {}
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchServices(1, categoryFilter);
  }, [categoryFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchServices(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchServices(newPage);
  };

  // Filtered by search client-side (search is fast on small datasets)
  const filteredServices = services.filter(s =>
    s.service_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.category?.toLowerCase().includes(search.toLowerCase())
  );

  const openAddModal = () => {
    setEditingService(null);
    setForm({ service_name: '', category: '', base_cost: '', is_available: true });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (service) => {
    setEditingService(service);
    setForm({
      service_name: service.service_name || '',
      category: service.category || '',
      base_cost: service.base_cost ?? '',
      is_available: service.is_available !== false,
    });
    setFormError('');
    setShowModal(true);
    setOpenMenuId(null);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.service_name.trim()) return setFormError('Service name is required.');

    setFormLoading(true);
    try {
      const body = {
        service_name: form.service_name.trim(),
        category: form.category.trim(),
        base_cost: form.base_cost !== '' ? parseFloat(form.base_cost) : 0,
        is_available: form.is_available,
      };

      const res = editingService
        ? await fetch(`/admin/api/reference/${editingService.service_id}`, {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/admin/api/reference', {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save service');

      setShowModal(false);
      fetchServices(page);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeactivate = async (service) => {
    setOpenMenuId(null);
    if (!window.confirm(`Deactivate "${service.service_name}"?`)) return;
    try {
      await fetch(`/admin/api/reference/${service.service_id}/deactivate`, {
        method: 'PATCH',
        headers,
      });
      fetchServices(page);
    } catch (err) {
      alert('Failed to deactivate: ' + err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const menuItems = [
    { label: 'Dashboard',          path: '/dashboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
    { label: 'User Management',    path: '/users',     icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
    { label: 'Roles & Permissions',path: '/roles',     icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
    { label: 'Service Catalog',    path: '/services',  active: true, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
    { label: 'Audit Logs',         path: '/audit',     icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  ];

  return (
    <div className="service-catalog" onClick={() => openMenuId && setOpenMenuId(null)}>
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
          {menuItems.map((item) => (
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

      {/* Main Content */}
      <main className="main-content">
        <div className="sc-header-row">
          <div className="sc-header-left">
            <div className="breadcrumb">
              <span onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>Dashboard</span>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-active">Service Catalog</span>
            </div>
            <h1 className="sc-page-title">Service Catalog</h1>
          </div>
          <button className="add-service-btn" onClick={openAddModal}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Service
          </button>
        </div>

        <div className="services-panel">
          <div className="panel-header">
            <h3>Medical Services</h3>
            <p className="panel-desc">Reference data for billing and department routing</p>
          </div>

          {/* Filter Bar */}
          <div className="filter-bar">
            <div className="search-input">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search services..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="filter-dropdowns">
              <select
                className="dropdown"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="sc-state">Loading...</div>
          ) : error ? (
            <div className="sc-state sc-error">Error: {error}</div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="services-table">
                  <thead>
                    <tr>
                      <th>Service ID</th>
                      <th>Service Name</th>
                      <th>Category</th>
                      <th>Base Cost</th>
                      <th>Status</th>
                      <th>Last Updated</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServices.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontStyle: 'italic' }}>
                          No services found.
                        </td>
                      </tr>
                    ) : filteredServices.map((service) => (
                      <tr key={service.service_id}>
                        <td className="col-id">SRV-{String(service.service_id).padStart(3, '0')}</td>
                        <td>{service.service_name}</td>
                        <td>
                          <span className="category-badge">{service.category || '-'}</span>
                        </td>
                        <td>{formatCost(service.base_cost)}</td>
                        <td>
                          <span className={`status-badge ${service.is_available ? 'available' : 'unavailable'}`}>
                            {service.is_available ? 'Available' : 'Unavailable'}
                          </span>
                        </td>
                        <td className="last-updated">{formatDate(service.last_updated)}</td>
                        <td className="actions-cell" onClick={e => e.stopPropagation()}>
                          <button
                            className="actions-btn"
                            onClick={() => setOpenMenuId(openMenuId === service.service_id ? null : service.service_id)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="5" r="2"/>
                              <circle cx="12" cy="12" r="2"/>
                              <circle cx="12" cy="19" r="2"/>
                            </svg>
                          </button>
                          {openMenuId === service.service_id && (
                            <div className="actions-menu">
                              <button onClick={() => openEditModal(service)}>Edit</button>
                              {service.is_available && (
                                <button className="danger" onClick={() => handleDeactivate(service)}>Deactivate</button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="sc-pagination">
                <span className="pagination-info">
                  Showing {filteredServices.length === 0 ? 0 : (page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total} entries
                </span>
                <div className="pagination-btns">
                  <button className="page-btn" disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>Previous</button>
                  <button className="page-btn next" disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)}>Next</button>
                </div>
              </div>
            </>
          )}

          <div className="panel-bottom-sep"></div>
        </div>
      </main>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingService ? 'Edit Service' : 'Add Service'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form className="modal-form" onSubmit={handleFormSubmit}>
              <div className="form-row">
                <label>Service Name <span className="required">*</span></label>
                <input
                  type="text"
                  value={form.service_name}
                  onChange={e => setForm(p => ({ ...p, service_name: e.target.value }))}
                  placeholder="e.g. General Consultation"
                  required
                />
              </div>
              <div className="form-row">
                <label>Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                >
                  <option value="">— Select Category —</option>
                  <option value="Outpatient">Outpatient</option>
                  <option value="Radiology">Radiology</option>
                  <option value="Laboratory">Laboratory</option>
                  <option value="Rehabilitation">Rehabilitation</option>
                  <option value="Emergency">Emergency</option>
                  <option value="Dental">Dental</option>
                  <option value="Preventive">Preventive</option>
                  <option value="Surgery">Surgery</option>
                </select>
              </div>
              <div className="form-row">
                <label>Base Cost (₱)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.base_cost}
                  onChange={e => setForm(p => ({ ...p, base_cost: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="form-row">
                <label>Status</label>
                <select
                  value={form.is_available ? 'true' : 'false'}
                  onChange={e => setForm(p => ({ ...p, is_available: e.target.value === 'true' }))}
                >
                  <option value="true">Available</option>
                  <option value="false">Unavailable</option>
                </select>
              </div>
              {formError && <p className="form-error">{formError}</p>}
              <div className="modal-actions">
                <button type="button" className="modal-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="modal-create" disabled={formLoading}>
                  {formLoading ? 'Saving...' : editingService ? 'Save Changes' : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceCatalog;
