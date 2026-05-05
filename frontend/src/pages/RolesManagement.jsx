import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './RolesManagement.css';

// Maps the display label shown in the dropdown to the exact value stored
// in the `subsystem` column of the role table in the database.
const subsystemMap = [
  { label: 'All Subsystems',                         value: '' },
  { label: 'Admin Subsystem',                        value: 'Admin' },
  { label: 'Patient Management Subsystem',           value: 'Patient' },
  { label: 'Predictive Analysis Subsystem',          value: 'Predictive' },
  { label: 'Inventory and Pharmaceutical Subsystem', value: 'Inventory' },
  { label: 'Customer Support Subsystem',             value: 'Customer' },
  { label: 'Billing & Finance Subsystem',            value: 'Billing' },
  { label: 'Healthcare Staff Management Subsystem',  value: 'Staff' },
];

const RolesManagement = () => {
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState('');
  const [subsystem, setSubsystem] = useState('Admin');
  const [userInfo, setUserInfo] = useState({ username: '', role: '' });
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateTargets, setDeactivateTargets] = useState([]);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleSubsystem, setNewRoleSubsystem] = useState('Admin');
  const [newRolePermissions, setNewRolePermissions] = useState({
    create: false,
    view: false,
    patch: false,
    delete: false
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const rawSubsystem = storedUser ? JSON.parse(storedUser)?.subsystem : 'Admin';
    // Normalize: if the stored value is a full label, map it back to the short DB value
    const match = subsystemMap.find(s => s.label === rawSubsystem || s.value === rawSubsystem);
    const normalized = match ? match.value : 'Admin';
    setSubsystem(normalized);
    setNewRoleSubsystem(normalized);

    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUserInfo({ username: parsed.username || '', role: parsed.role || '' });
      } catch (err) { console.error('Failed to parse user info:', err); }
    }

    const token = localStorage.getItem('accessToken');
    fetch('/admin/api/roles', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        const roleData = data.roles || [];
        setRoles(roleData);
      })
      .catch(err => console.error('Failed to fetch roles:', err));
  }, []);

  const filteredRoles = roles
    .filter(role => subsystem === '' || role.subsystem === subsystem)
    .filter(role =>
      role.name.toLowerCase().includes(search.toLowerCase()) ||
      (role.Permissions || []).some(permission => permission.action.toLowerCase().includes(search.toLowerCase()))
    );

  const handleToggleSelectRole = (roleId) => {
    setSelectedRoles(prev =>
      prev.includes(roleId)
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  };

  const handleDeactivateRole = (role) => {
    setDeactivateTargets([role]);
    setShowDeactivateModal(true);
  };

  const handleDeactivateBulk = () => {
    const targets = roles.filter(r => selectedRoles.includes(r.role_id) && r.status !== 'inactive');
    if (targets.length === 0) return;
    setDeactivateTargets(targets);
    setShowDeactivateModal(true);
  };

  const handleActivateBulk = async () => {
    const token = localStorage.getItem('accessToken');
    const targets = roles.filter(r => selectedRoles.includes(r.role_id) && r.status === 'inactive');
    if (targets.length === 0) return;
    try {
      await Promise.all(
        targets.map(r =>
          fetch(`/admin/api/roles/${r.role_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: 'active' }),
          })
        )
      );
      const activatedIds = targets.map(r => r.role_id);
      setRoles(prev => prev.map(r => activatedIds.includes(r.role_id) ? { ...r, status: 'active' } : r));
      setSelectedRoles([]);
    } catch (err) {
      console.error('Bulk activate roles error:', err);
    }
  };

  const closeDeactivateModal = () => {
    setShowDeactivateModal(false);
    setDeactivateTargets([]);
  };

  const handleConfirmDeactivateRoles = async () => {
    const token = localStorage.getItem('accessToken');
    const errors = [];
    try {
      const results = await Promise.all(
        deactivateTargets.map(async r => {
          const res = await fetch(`/admin/api/roles/${r.role_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: 'inactive' }),
          });
          const data = await res.json();
          if (!res.ok) {
            errors.push(data.message || `Failed to deactivate "${r.name}"`);
            return null;
          }
          return r.role_id;
        })
      );
      // Only update local state for roles that succeeded
      const deactivatedIds = results.filter(Boolean);
      setRoles(prev => prev.map(r => deactivatedIds.includes(r.role_id) ? { ...r, status: 'inactive' } : r));
      setSelectedRoles([]);
      closeDeactivateModal();
      if (errors.length > 0) alert(errors.join('\n'));
    } catch (err) {
      console.error('Deactivate roles error:', err);
    }
  };

  const handleActivateRole = async (role) => {
    const token = localStorage.getItem('accessToken');
    try {
      await fetch(`/admin/api/roles/${role.role_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'active' }),
      });
      setRoles(prev => prev.map(r => r.role_id === role.role_id ? { ...r, status: 'active' } : r));
    } catch (err) {
      console.error('Activate role error:', err);
    }
  };

  const handleSelectAll = () => {
    const visibleRoleIds = filteredRoles.map(role => role.role_id);
    const allSelected = visibleRoleIds.every(id => selectedRoles.includes(id));
    setSelectedRoles(allSelected ? [] : visibleRoleIds);
  };

  const resetForm = () => {
    setEditingRoleId(null);
    setNewRoleName('');
    setNewRoleSubsystem(subsystem || 'Admin');
    setNewRolePermissions({ create: false, view: false, patch: false, delete: false });
  };

  const handleOpenAddRole = () => {
    resetForm();
    setShowAddRoleModal(true);
  };

  const handleEditRole = (role) => {
    setEditingRoleId(role.role_id);
    setNewRoleName(role.name);
    setNewRoleSubsystem(role.subsystem || 'Admin');
    const permissions = {
      create: (role.Permissions || []).some(p => p.action.toLowerCase() === 'create'),
      view:   (role.Permissions || []).some(p => p.action.toLowerCase() === 'view'),
      patch:  (role.Permissions || []).some(p => p.action.toLowerCase() === 'patch'),
      delete: (role.Permissions || []).some(p => p.action.toLowerCase() === 'delete')
    };
    setNewRolePermissions(permissions);
    setShowAddRoleModal(true);
  };

  const handleAddRoleSubmit = async (event) => {
    event.preventDefault();
    if (!newRoleName.trim()) return;

    const selectedPermissions = Object.entries(newRolePermissions)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1));

    const token = localStorage.getItem('accessToken');
    try {
      const response = editingRoleId
        ? await fetch(`/admin/api/roles/${editingRoleId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              name: newRoleName.trim(),
              subsystem: newRoleSubsystem,
              permissions: selectedPermissions
            })
          })
        : await fetch('/admin/api/roles', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              name: newRoleName.trim(),
              subsystem: newRoleSubsystem,
              permissions: selectedPermissions
            })
          });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save role');
      }

      const result = await response.json();
      const returnedRole = result.role;

      if (editingRoleId) {
        setRoles(prev => prev.map(role => role.role_id === editingRoleId ? returnedRole : role));
      } else {
        setRoles(prev => [returnedRole, ...prev]);
      }

      setShowAddRoleModal(false);
      resetForm();
    } catch (error) {
      console.error('Failed to save role:', error);
      alert('Unable to save role. Please try again.');
    }
  };

  const togglePermission = (permission) => {
    setNewRolePermissions(prev => ({
      ...prev,
      [permission]: !prev[permission]
    }));
  };

  return (
    <div className="roles-management">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/hospitallogo.png" alt="VitalMed Logo" className="logo-icon" />
          <div className="logo-text-wrapper">
            <span className="logo-text">VitalMed</span>
            <span className="logo-subtext">Hospital System</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-item" onClick={() => navigate('/dashboard')}>Dashboard</div>
          <div className="nav-item" onClick={() => navigate('/users')}>User Management</div>
          <div className="nav-item active" onClick={() => navigate('/roles')}>Roles & Permissions</div>
          <div className="nav-item" onClick={() => navigate('/services')}>Service Catalog</div>
          <div className="nav-item" onClick={() => navigate('/audit')}>Audit Logs</div>
        </nav>
        <div className="sidebar-footer">
          <div className="profile-info">
            <div className="profile-details">
              <div className="profile-role">{userInfo.role || 'Administrator'}</div>
              <div className="profile-name">{userInfo.username || 'Admin'}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={() => {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            navigate('/login');
          }}>Logout</button>
        </div>
      </aside>
      <main className="main-content">
        <div className="roles-header">
          <div>
            <h1>Subsystem Role Management</h1>
            <p>Manage roles and permissions for each subsystem independently.</p>
          </div>
          <div className="header-actions">
            {selectedRoles.length > 0 && (() => {
              const selectedObjs = roles.filter(r => selectedRoles.includes(r.role_id));
              const hasInactive = selectedObjs.some(r => r.status === 'inactive');
              const hasActive   = selectedObjs.some(r => r.status !== 'inactive');
              return (
                <>
                  {hasActive && (
                    <button className="deactivate-selected-btn" onClick={handleDeactivateBulk}>
                      Deactivate Selected ({selectedObjs.filter(r => r.status !== 'inactive').length})
                    </button>
                  )}
                  {hasInactive && (
                    <button className="activate-selected-btn" onClick={handleActivateBulk}>
                      Activate Selected ({selectedObjs.filter(r => r.status === 'inactive').length})
                    </button>
                  )}
                </>
              );
            })()}
            <button className="add-role-btn" onClick={handleOpenAddRole}>
              + Add Role
            </button>
          </div>
        </div>
        <div className="controls-row">
          <div className="subsystem-selector">
            <label htmlFor="subsystem">Select Subsystem</label>
            <select id="subsystem" value={subsystem} onChange={e => setSubsystem(e.target.value)}>
              {subsystemMap.map(({ label, value }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="search-field">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search roles or permissions..."
            />
          </div>
        </div>
        <div className="roles-panel">
          <div className="table-wrapper">
            <table className="roles-table">
              <thead>
                <tr>
                  <th className="select-cell">
                    <input
                      type="checkbox"
                      checked={filteredRoles.length > 0 && filteredRoles.every(role => selectedRoles.includes(role.role_id))}
                      onChange={handleSelectAll}
                      aria-label="Select all roles"
                    />
                  </th>
                  <th>Role</th>
                  {subsystem === '' && <th>Subsystem</th>}
                  <th>Permissions</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredRoles.map(role => (
                  <tr key={role.role_id} className={selectedRoles.includes(role.role_id) ? 'row-selected' : ''}>
                    <td className="select-cell">
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role.role_id)}
                        onChange={() => handleToggleSelectRole(role.role_id)}
                        aria-label={`Select ${role.name}`}
                      />
                    </td>
                    <td>{role.name}</td>
                    {subsystem === '' && (
                      <td>
                        <span className="subsystem-chip">
                          {subsystemMap.find(s => s.value === role.subsystem)?.label || role.subsystem}
                        </span>
                      </td>
                    )}
                    <td>
                      <div className="permission-list">
                        {role.Permissions.map(permission => (
                          <span key={permission.permission_id} className="permission-chip">
                            {permission.action}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td><span className={`status-badge ${role.status || 'active'}`}>{(role.status || 'active').charAt(0).toUpperCase() + (role.status || 'active').slice(1)}</span></td>
                    <td className="actions-cell">
                      <button className="action-btn edit" onClick={() => handleEditRole(role)} disabled={role.name === 'Admin' || role.name === 'Super Admin'} style={(role.name === 'Admin' || role.name === 'Super Admin') ? { opacity: 0.4, cursor: 'not-allowed' } : {}}>Edit</button>
                      {role.status === 'inactive' ? (
                        <button className="action-btn activate" onClick={() => handleActivateRole(role)}>Activate</button>
                      ) : (
                        <button className="action-btn deactivate" onClick={() => handleDeactivateRole(role)}>Deactivate</button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredRoles.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty-state">No roles found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showAddRoleModal && (
          <div className="modal-backdrop" onClick={() => setShowAddRoleModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingRoleId ? 'Edit Role' : 'Add Role'}</h2>
                <button className="modal-close" onClick={() => { setShowAddRoleModal(false); resetForm(); }}>×</button>
              </div>
              <form className="modal-form" onSubmit={handleAddRoleSubmit}>
                <div className="form-row">
                  <label htmlFor="new-subsystem">Subsystem:</label>
                  <select
                    id="new-subsystem"
                    value={newRoleSubsystem}
                    onChange={e => setNewRoleSubsystem(e.target.value)}
                  >
                    {subsystemMap.map(({ label, value }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label htmlFor="new-role-name">Role Name:</label>
                  <input
                    id="new-role-name"
                    type="text"
                    value={newRoleName}
                    onChange={e => setNewRoleName(e.target.value)}
                    placeholder="Enter role name"
                  />
                </div>
                <div className="form-row permissions-row">
                  <label>Permissions:</label>
                  <div className="permission-checkboxes">
                    <label>
                      <input type="checkbox" checked={newRolePermissions.create} onChange={() => togglePermission('create')} />
                      Create
                    </label>
                    <label>
                      <input type="checkbox" checked={newRolePermissions.view} onChange={() => togglePermission('view')} />
                      View
                    </label>
                    <label>
                      <input type="checkbox" checked={newRolePermissions.patch} onChange={() => togglePermission('patch')} />
                      Patch
                    </label>
                    <label>
                      <input type="checkbox" checked={newRolePermissions.delete} onChange={() => togglePermission('delete')} />
                      Delete
                    </label>
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="button" className="modal-cancel" onClick={() => { setShowAddRoleModal(false); resetForm(); }}>Cancel</button>
                  <button type="submit" className="modal-create">{editingRoleId ? 'Save Changes' : 'Create Role'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
        {showDeactivateModal && (
          <div className="modal-backdrop" onClick={closeDeactivateModal}>
            <div className="modal-content deactivate-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Deactivate {deactivateTargets.length === 1 ? 'Role' : 'Roles'}?</h2>
                <button className="modal-close" onClick={closeDeactivateModal}>×</button>
              </div>
              <div className="deactivate-body">
                {deactivateTargets.length === 1 ? (
                  <>
                    <p className="deactivate-main">
                      Are you sure you want to deactivate the role <strong>{deactivateTargets[0].name}</strong>?
                    </p>
                    <p className="deactivate-sub">This will disable the role and revoke all associated permissions.</p>
                  </>
                ) : (
                  <>
                    <p className="deactivate-main">
                      You are about to deactivate <strong>{deactivateTargets.length} roles</strong>.
                    </p>
                    <p className="deactivate-sub">This will revoke access for all users assigned to the selected roles.</p>
                  </>
                )}
              </div>
              <div className="modal-actions">
                <button className="modal-cancel" onClick={closeDeactivateModal}>Cancel</button>
                <button className="modal-deactivate" onClick={handleConfirmDeactivateRoles}>Deactivate</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default RolesManagement;
