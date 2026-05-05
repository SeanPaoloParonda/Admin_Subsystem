import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ServiceCatalog.css';

const ServiceCatalog = () => {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState({ username: '', role: '' });

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try { setUserInfo(JSON.parse(storedUser)); }
      catch (err) { console.error('Failed to parse user info:', err); }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const menuItems = [
    { label: 'Dashboard', active: false, path: '/dashboard', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
    )},
    { label: 'User Management', active: false, path: '/users', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    )},
    { label: 'Roles and Permissions', active: false, path: '#', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    )},
    { label: 'Service Catalog', active: true, path: '/services', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
    )},
    { label: 'Audit Logs', active: false, path: '#', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
    )},
  ];

  const services = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    serviceId: 'SRV-001',
    serviceName: 'General Consultation',
    category: 'Outpatient',
    baseCost: '\u20B1 2027',
    status: 'Available',
    lastUpdated: '2025-01-13'
  }));

  return (
    <div className="service-catalog">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <img src="/hospitallogo.png" alt="VitalMed Logo" width="24" height="24" />
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
              onClick={() => item.path !== '#' && navigate(item.path)}
              style={item.path !== '#' ? { cursor: 'pointer' } : {}}
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
              <div className="profile-email">{userInfo.role || 'Administrator'}</div>
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
        {/* Breadcrumb & Header */}
        <div className="sc-header-row">
          <div className="sc-header-left">
            <div className="breadcrumb">
              <span>Dashboard</span>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-active">Service Catalog</span>
            </div>
            <h1 className="sc-page-title">Service Catalog</h1>
          </div>
          <button className="add-service-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Service
          </button>
        </div>

        {/* Services Panel */}
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
              <input type="text" placeholder="Search services.." />
            </div>
            <div className="filter-dropdowns">
              <div className="dropdown">
                <span>All Categories</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Data Table */}
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
                {services.map((service) => (
                  <tr key={service.id}>
                    <td>{service.serviceId}</td>
                    <td>{service.serviceName}</td>
                    <td>
                      <span className="category-badge">{service.category}</span>
                    </td>
                    <td>{service.baseCost}</td>
                    <td>
                      <span className="status-badge available">{service.status}</span>
                    </td>
                    <td className="last-updated">{service.lastUpdated}</td>
                    <td>
                      <button className="actions-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="2"/>
                          <circle cx="12" cy="12" r="2"/>
                          <circle cx="12" cy="19" r="2"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="panel-bottom-sep"></div>
        </div>
      </main>
    </div>
  );
};

export default ServiceCatalog;
