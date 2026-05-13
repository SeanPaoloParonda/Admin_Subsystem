import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import './UserManagement.css';

// Must match the `subsystem` column values in the role table
const subsystemMap = [
  { label: 'All Subsystems',                          value: '' },
  { label: 'Admin Subsystem',                         value: 'Admin' },
  { label: 'Patient Management Subsystem',            value: 'Patient' },
  { label: 'Predictive Analysis Subsystem',           value: 'Predictive' },
  { label: 'Inventory and Pharmaceutical Subsystem',  value: 'Inventory' },
  { label: 'Customer Support Subsystem',              value: 'Customer' },
  { label: 'Billing & Finance Subsystem',             value: 'Billing' },
  { label: 'Healthcare Staff Management Subsystem',   value: 'Staff' },
];

const emptyForm = {
  first_name: '',
  last_name: '',
  username: '',
  password: '',
  subsystem: '',
  role_id: '',
  status: 'active',
};

const PasswordVisibilityIcon = ({ visible }) => (
  <svg
    width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false"
  >
    {visible ? (
      <>
        <path d="M2 2l20 20" />
        <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
        <path d="M9.88 4.18A10.6 10.6 0 0 1 12 4c5 0 9.27 3.11 11 8a12.36 12.36 0 0 1-3.06 4.55" />
        <path d="M6.11 6.11A12.28 12.28 0 0 0 1 12c1.73 4.89 6 8 11 8a10.93 10.93 0 0 0 5.89-1.69" />
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

const CloseIcon = () => (
  <svg
    width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.4"
    strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false"
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const UserManagementPage = () => {
  const location = useLocation();
  const highlightId = new URLSearchParams(location.search).get('highlight');
  const highlightRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [subsystemFilter, setSubsystemFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);

  // Add User modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [modalRoles, setModalRoles] = useState([]);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Edit User modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editModalRoles, setEditModalRoles] = useState([]);
  const [editFormError, setEditFormError] = useState('');
  const [editFormLoading, setEditFormLoading] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Deactivate confirm modal state
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateTargets, setDeactivateTargets] = useState([]);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [activateTargets, setActivateTargets] = useState([]);

  const fetchUsers = (subsystem = '') => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('accessToken');
    const url = subsystem
      ? `/admin/api/users?subsystem=${encodeURIComponent(subsystem)}`
      : '/admin/api/users';

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        const userList = Array.isArray(data) ? data : Array.isArray(data.users) ? data.users : [];
        setUsers(userList);
        const roles = Array.from(new Set(userList.map(u => u.Role?.name).filter(Boolean)));
        setAvailableRoles(roles);
        setRoleFilter('');
      })
      .catch(err => {
        console.error('Failed to fetch users:', err);
        setError('Failed to load users. Please try again.');
      })
      .finally(() => setLoading(false));
  };

  // Fetch roles for a given subsystem (used in the modal)
  const fetchRolesForSubsystem = (subsystem) => {
    if (!subsystem) { setModalRoles([]); return; }
    const token = localStorage.getItem('accessToken');
    fetch('/admin/api/roles', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        const all = data.roles || [];
        setModalRoles(all.filter(r => r.subsystem === subsystem));
      })
      .catch(() => setModalRoles([]));
  };

  useEffect(() => {
    fetchUsers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to highlighted user when data loads
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, users]);

  const handleSubsystemChange = (value) => {
    setSubsystemFilter(value);
    fetchUsers(value);
  };

  const handleToggleSelectUser = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    const visibleIds = filteredUsers.map(u => u.user_id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedUsers.includes(id));
    setSelectedUsers(allSelected ? [] : visibleIds);
  };

  const getUserDisplayName = (user) => {
    const firstName = user.first_name?.trim() || '';
    const lastName = user.last_name?.trim() || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    return fullName || user.username || 'Unknown User';
  };

  const [lastLoginSort, setLastLoginSort] = useState(null); // null | 'asc' | 'desc'

  const getUserInitials = (user) => {
    const displayName = getUserDisplayName(user);
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (parts[0] || user.username || 'U').slice(0, 2).toUpperCase();
  };

  const filteredUsers = users
    .filter(user => {
      const roleName = user.Role?.name || '';
      const matchesSearch =
        roleName.toLowerCase().includes(search.toLowerCase()) ||
        (user.username || '').toLowerCase().includes(search.toLowerCase()) ||
        getUserDisplayName(user).toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter ? roleName === roleFilter : true;
      const matchesStatus = statusFilter ? user.status === statusFilter : true;
      return matchesSearch && matchesRole && matchesStatus;
    })
    .sort((a, b) => {
      if (!lastLoginSort) return 0;
      const da = a.last_login ? new Date(a.last_login).getTime() : 0;
      const db = b.last_login ? new Date(b.last_login).getTime() : 0;
      return lastLoginSort === 'asc' ? da - db : db - da;
    });

  const formatLastLogin = (lastLogin) => {
    if (!lastLogin) return '-';
    const date = new Date(lastLogin);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  // ── Add User modal handlers ──────────────────────────────────────────────

  const openAddModal = () => {
    setForm(emptyForm);
    setModalRoles([]);
    setFormError('');
    setShowPassword(false);
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setFormError('');
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));

    // When subsystem changes, reload roles and clear role selection
    if (name === 'subsystem') {
      setForm(prev => ({ ...prev, subsystem: value, role_id: '' }));
      fetchRolesForSubsystem(value);
    }
  };

  const handleAddUserSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.username.trim()) return setFormError('Username is required.');
    if (!form.password.trim()) return setFormError('Password is required.');
    if (form.password.length < 6) return setFormError('Password must be at least 6 characters.');
    if (!form.subsystem) return setFormError('Please select a subsystem.');
    if (!form.role_id) return setFormError('Please select a role.');

    setFormLoading(true);
    const token = localStorage.getItem('accessToken');

    try {
      const res = await fetch('/admin/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        // Password is sent plain — the backend hashes it with bcrypt before storing
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          username: form.username.trim(),
          password: form.password,
          role_id: parseInt(form.role_id),
          status: form.status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create user');

      closeAddModal();
      fetchUsers(subsystemFilter); // refresh the table
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  // ── Edit User modal handlers ─────────────────────────────────────────────

  const openEditModal = (user) => {
    const subsystem = user.Role?.subsystem || '';
    setEditUser(user);
    setEditForm({
      first_name: user.first_name || '',
      last_name:  user.last_name  || '',
      username:   user.username   || '',
      password:   '',
      subsystem,
      role_id:    user.role_id    ? String(user.role_id) : '',
      status:     user.status     || 'active',
    });
    setEditingPassword(false);
    setShowEditPassword(false);
    setEditFormError('');
    // Load roles for this subsystem
    if (subsystem) {
      const token = localStorage.getItem('accessToken');
      fetch('/admin/api/roles', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setEditModalRoles((data.roles || []).filter(r => r.subsystem === subsystem)))
        .catch(() => setEditModalRoles([]));
    } else {
      setEditModalRoles([]);
    }
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditUser(null);
    setEditFormError('');
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));

    if (name === 'subsystem') {
      setEditForm(prev => ({ ...prev, subsystem: value, role_id: '' }));
      if (value) {
        const token = localStorage.getItem('accessToken');
        fetch('/admin/api/roles', { headers: { Authorization: `Bearer ${token}` } })
          .then(res => res.json())
          .then(data => setEditModalRoles((data.roles || []).filter(r => r.subsystem === value)))
          .catch(() => setEditModalRoles([]));
      } else {
        setEditModalRoles([]);
      }
    }
  };

  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    setEditFormError('');

    if (!editForm.username.trim()) return setEditFormError('Username is required.');
    if (editingPassword) {
      if (!editForm.password.trim()) return setEditFormError('Password cannot be empty.');
      if (editForm.password.length < 6) return setEditFormError('Password must be at least 6 characters.');
    }
    if (!editForm.role_id) return setEditFormError('Please select a role.');

    setEditFormLoading(true);
    const token = localStorage.getItem('accessToken');

    try {
      const body = {
        first_name: editForm.first_name.trim(),
        last_name:  editForm.last_name.trim(),
        username:   editForm.username.trim(),
        role_id:    parseInt(editForm.role_id),
        status:     editForm.status,
      };
      // Only include password if admin chose to change it
      if (editingPassword && editForm.password.trim()) {
        body.password = editForm.password;
      }

      const res = await fetch(`/admin/api/users/${editUser.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update user');

      closeEditModal();
      fetchUsers(subsystemFilter);
    } catch (err) {
      setEditFormError(err.message);
    } finally {
      setEditFormLoading(false);
    }
  };

  // Activate a single user — now shows confirm modal
  const openActivateSingle = (user) => {
    setActivateTargets([user]);
    setShowActivateModal(true);
  };

  // Activate all selected inactive users — shows confirm modal
  const openActivateBulk = () => {
    const targets = users.filter(u => selectedUsers.includes(u.user_id) && u.status !== 'active');
    if (targets.length === 0) return;
    setActivateTargets(targets);
    setShowActivateModal(true);
  };

  const closeActivateModal = () => {
    setShowActivateModal(false);
    setActivateTargets([]);
  };

  const handleConfirmActivate = async () => {
    const token = localStorage.getItem('accessToken');
    try {
      await Promise.all(
        activateTargets.map(u =>
          fetch(`/admin/api/users/${u.user_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: 'active' }),
          })
        )
      );
      closeActivateModal();
      setSelectedUsers([]);
      fetchUsers(subsystemFilter);
    } catch (err) {
      console.error('Activate error:', err);
    }
  };

  // Open deactivate modal for a single user (from row button or edit modal)
  const openDeactivateSingle = (user) => {
    setDeactivateTargets([user]);
    setShowDeactivateModal(true);
  };

  // Open deactivate modal for all selected active users
  const openDeactivateBulk = () => {
    const targets = users.filter(u => selectedUsers.includes(u.user_id) && u.status === 'active');
    if (targets.length === 0) return;
    setDeactivateTargets(targets);
    setShowDeactivateModal(true);
  };

  const closeDeactivateModal = () => {
    setShowDeactivateModal(false);
    setDeactivateTargets([]);
  };

  const handleConfirmDeactivate = async () => {
    const token = localStorage.getItem('accessToken');
    const errors = [];
    try {
      await Promise.all(
        deactivateTargets.map(async u => {
          const res = await fetch(`/admin/api/users/${u.user_id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) {
            const data = await res.json();
            errors.push(data.message || `Failed to deactivate ${u.username}`);
          }
        })
      );
      closeDeactivateModal();
      closeEditModal();
      setSelectedUsers([]);
      fetchUsers(subsystemFilter);
      if (errors.length > 0) alert(errors.join('\n'));
    } catch (err) {
      console.error('Deactivate error:', err);
    }
  };

  // Used by edit modal's Deactivate User button
  const handleDeactivateUser = () => {
    if (!editUser) return;
    openDeactivateSingle(editUser);
  };

  return (
    <div className="user-management">
      <Sidebar />

      {/* Main Content */}
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1>User Management</h1>
            <p>Manage employee accounts and permissions.</p>
          </div>
          <div className="header-actions">
            {selectedUsers.length > 0 && (() => {
              const selectedObjs = users.filter(u => selectedUsers.includes(u.user_id));
              const hasInactive = selectedObjs.some(u => u.status !== 'active');
              const hasActive   = selectedObjs.some(u => u.status === 'active');
              return (
                <>
                  {hasActive && (
                    <button className="deactivate-selected-btn" onClick={openDeactivateBulk}>
                      Deactivate Selected ({selectedObjs.filter(u => u.status === 'active').length})
                    </button>
                  )}
                  {hasInactive && (
                    <button className="activate-selected-btn" onClick={openActivateBulk}>
                      Reactivate Selected ({selectedObjs.filter(u => u.status !== 'active').length})
                    </button>
                  )}
                </>
              );
            })()}
            <button className="add-user-btn" onClick={openAddModal}>+ Add User</button>
          </div>
        </header>

        {/* Search & Filters */}
        <div className="filters">
          <input
            type="text"
            className="search-input"
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select value={subsystemFilter} onChange={e => handleSubsystemChange(e.target.value)}>
            {subsystemMap.map(({ label, value }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">All Roles</option>
            {availableRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* User Table */}
        <section className="user-box">
          {loading ? (
            <p>Loading users...</p>
          ) : error ? (
            <p className="error-msg">{error}</p>
          ) : filteredUsers.length === 0 ? (
            <p>No users found.</p>
          ) : (
            <div className="table-wrapper">
              <table className="user-table">
                <thead>
                  <tr>
                    <th className="select-cell">
                      <input
                        type="checkbox"
                        checked={filteredUsers.length > 0 && filteredUsers.every(u => selectedUsers.includes(u.user_id))}
                        onChange={handleSelectAll}
                        aria-label="Select all users"
                      />
                    </th>
                    <th>User</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>
                      <button
                        className="sort-header-btn"
                        onClick={() => setLastLoginSort(s => s === 'desc' ? 'asc' : 'desc')}
                        title={lastLoginSort === 'desc' ? 'Newest first — click for oldest first' : 'Click to sort by last login'}
                      >
                        Last Login
                        <span className="sort-header-icon">
                          {lastLoginSort === 'desc' ? ' ↓' : lastLoginSort === 'asc' ? ' ↑' : ' ↕'}
                        </span>
                      </button>
                    </th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr
                      key={user.user_id}
                      ref={user.user_id === highlightId ? highlightRef : null}
                      className={`${selectedUsers.includes(user.user_id) ? 'row-selected' : ''} ${user.user_id === highlightId ? 'row-highlighted' : ''}`}
                    >
                      <td className="select-cell">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.user_id)}
                          onChange={() => handleToggleSelectUser(user.user_id)}
                          aria-label={`Select ${getUserDisplayName(user)}`}
                        />
                      </td>
                      <td>
                        <div className="user-cell-name">
                          <span className="user-cell-title">{getUserDisplayName(user)}</span>
                          <span className="user-cell-meta">{user.username}</span>
                        </div>
                      </td>                      <td>{user.username}</td>
                      <td>{user.Role?.name || '-'}</td>
                      <td>
                        <span className={`status-pill ${user.status || 'unknown'}`}>
                          {user.status || 'Unknown'}
                        </span>
                      </td>
                      <td>{formatLastLogin(user.last_login)}</td>
                      <td className="actions-cell">
                        <button
                          className="action-btn action-edit"
                          onClick={() => openEditModal(user)}
                        >
                          Edit
                        </button>
                        {user.status === 'active' ? (
                          <button className="action-btn action-deactivate" onClick={() => openDeactivateSingle(user)}>Deactivate</button>
                        ) : (
                          <button className="action-btn action-activate" onClick={() => openActivateSingle(user)}>Reactivate</button>
                        )}                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* ── Add User Modal ─────────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={closeAddModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add User</h2>
              <button className="modal-close" onClick={closeAddModal} aria-label="Close modal">
                <CloseIcon />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleAddUserSubmit}>
              <div className="form-row">
                <label htmlFor="first_name">First Name:</label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  value={form.first_name}
                  onChange={handleFormChange}
                  placeholder="Enter first name"
                />
              </div>

              <div className="form-row">
                <label htmlFor="last_name">Last Name:</label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  value={form.last_name}
                  onChange={handleFormChange}
                  placeholder="Enter last name"
                />
              </div>

              <div className="form-row">
                <label htmlFor="username">Username: <span className="required">*</span></label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={form.username}
                  onChange={handleFormChange}
                  placeholder="Enter username"
                  required
                />
              </div>

              <div className="form-row">
                <label htmlFor="password">Password: <span className="required">*</span></label>
                <div className="password-input-wrapper">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleFormChange}
                    placeholder="Min. 6 characters"
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(p => !p)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <PasswordVisibilityIcon visible={showPassword} />
                  </button>
                </div>
              </div>

              <div className="form-row">
                <label htmlFor="modal-subsystem">Subsystem: <span className="required">*</span></label>
                <select
                  id="modal-subsystem"
                  name="subsystem"
                  value={form.subsystem}
                  onChange={handleFormChange}
                  required
                >
                  <option value="">— Select Subsystem —</option>
                  {subsystemMap.filter(s => s.value !== '').map(({ label, value }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label htmlFor="modal-role">Role: <span className="required">*</span></label>
                <select
                  id="modal-role"
                  name="role_id"
                  value={form.role_id}
                  onChange={handleFormChange}
                  disabled={!form.subsystem}
                  required
                >
                  <option value="">— Select Role —</option>
                  {modalRoles.map(role => (
                    <option key={role.role_id} value={role.role_id}>{role.name}</option>
                  ))}
                </select>
                {form.subsystem && modalRoles.length === 0 && (
                  <span className="field-hint">No roles found for this subsystem.</span>
                )}
              </div>

              <div className="form-row">
                <label htmlFor="modal-status">Status:</label>
                <select
                  id="modal-status"
                  name="status"
                  value={form.status}
                  onChange={handleFormChange}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {formError && <p className="form-error">{formError}</p>}

              <div className="modal-actions">
                <button type="button" className="modal-cancel" onClick={closeAddModal}>
                  Cancel
                </button>
                <button type="submit" className="modal-create" disabled={formLoading}>
                  {formLoading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Edit User Modal ─────────────────────────────────────────────────── */}
      {showEditModal && editUser && (
        <div className="modal-backdrop" onClick={closeEditModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit User</h2>
              <button className="modal-close" onClick={closeEditModal} aria-label="Close modal">
                <CloseIcon />
              </button>
            </div>

            <form className="modal-form" onSubmit={handleEditUserSubmit}>
              <div className="form-row">
                <label htmlFor="edit-first_name">First Name:</label>
                <input
                  id="edit-first_name"
                  name="first_name"
                  type="text"
                  value={editForm.first_name}
                  onChange={handleEditFormChange}
                  placeholder="Enter first name"
                />
              </div>

              <div className="form-row">
                <label htmlFor="edit-last_name">Last Name:</label>
                <input
                  id="edit-last_name"
                  name="last_name"
                  type="text"
                  value={editForm.last_name}
                  onChange={handleEditFormChange}
                  placeholder="Enter last name"
                />
              </div>

              <div className="form-row">
                <label htmlFor="edit-username">Username: <span className="required">*</span></label>
                <input
                  id="edit-username"
                  name="username"
                  type="text"
                  value={editForm.username}
                  onChange={handleEditFormChange}
                  required
                />
              </div>

              <div className="form-row">
                <label>Password: <span className="required">*</span></label>
                {editingPassword ? (
                  <div className="password-input-wrapper">
                    <input
                      name="password"
                      type={showEditPassword ? 'text' : 'password'}
                      value={editForm.password}
                      onChange={handleEditFormChange}
                      placeholder="Enter new password (min. 6 chars)"
                      autoFocus
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowEditPassword(p => !p)}
                      aria-label={showEditPassword ? 'Hide password' : 'Show password'}
                    >
                      <PasswordVisibilityIcon visible={showEditPassword} />
                    </button>
                  </div>
                ) : (
                  <div className="password-input-wrapper">
                    <input
                      type="password"
                      value="••••••••"
                      readOnly
                      className="password-placeholder"
                    />
                    <button
                      type="button"
                      className="edit-password-btn"
                      onClick={() => setEditingPassword(true)}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>

              <div className="form-row">
                <label htmlFor="edit-subsystem">Subsystem: <span className="required">*</span></label>
                <select
                  id="edit-subsystem"
                  name="subsystem"
                  value={editForm.subsystem}
                  onChange={handleEditFormChange}
                  required
                >
                  <option value="">— Select Subsystem —</option>
                  {subsystemMap.filter(s => s.value !== '').map(({ label, value }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label htmlFor="edit-role">Role: <span className="required">*</span></label>
                <select
                  id="edit-role"
                  name="role_id"
                  value={editForm.role_id}
                  onChange={handleEditFormChange}
                  disabled={!editForm.subsystem}
                  required
                >
                  <option value="">— Select Role —</option>
                  {editModalRoles.map(role => (
                    <option key={role.role_id} value={role.role_id}>{role.name}</option>
                  ))}
                </select>
                {editForm.subsystem && editModalRoles.length === 0 && (
                  <span className="field-hint">No roles found for this subsystem.</span>
                )}
              </div>

              <div className="form-row">
                <label htmlFor="edit-status">Status:</label>
                <select
                  id="edit-status"
                  name="status"
                  value={editForm.status}
                  onChange={handleEditFormChange}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {editFormError && <p className="form-error">{editFormError}</p>}

              <div className="modal-actions modal-actions-edit">
                <button
                  type="button"
                  className="modal-deactivate"
                  onClick={handleDeactivateUser}
                  disabled={editFormLoading}
                >
                  Deactivate User
                </button>
                <div className="modal-actions-right">
                  <button type="button" className="modal-cancel" onClick={closeEditModal}>
                    Cancel
                  </button>
                  <button type="submit" className="modal-create" disabled={editFormLoading}>
                    {editFormLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Deactivate Confirm Modal ─────────────────────────────────────────── */}
      {showDeactivateModal && (
        <div className="modal-backdrop" onClick={closeDeactivateModal}>
          <div className="modal-content deactivate-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Deactivate {deactivateTargets.length === 1 ? 'User' : 'Users'}?</h2>
              <button className="modal-close" onClick={closeDeactivateModal}>×</button>
            </div>
            <div className="deactivate-body">
              {deactivateTargets.length === 1 ? (
                <>
                  <p className="deactivate-main">
                    Are you sure you want to deactivate the account for{' '}
                    <strong>{getUserDisplayName(deactivateTargets[0])}</strong>?
                  </p>
                  <p className="deactivate-sub">This will disable the user and revoke all access to the system.</p>
                </>
              ) : (
                <>
                  <p className="deactivate-main">
                    You are about to deactivate <strong>{deactivateTargets.length} user accounts</strong>.
                  </p>
                  <p className="deactivate-sub">This will revoke access for all selected users.</p>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={closeDeactivateModal}>Cancel</button>
              <button className="modal-deactivate" onClick={handleConfirmDeactivate}>Deactivate</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Activate Confirm Modal ─────────────────────────────────────────── */}
      {showActivateModal && (
        <div className="modal-backdrop" onClick={closeActivateModal}>
          <div className="modal-content deactivate-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reactivate {activateTargets.length === 1 ? 'User' : 'Users'}?</h2>
              <button className="modal-close" onClick={closeActivateModal}>×</button>
            </div>
            <div className="deactivate-body">
              {activateTargets.length === 1 ? (
                <>
                  <p className="deactivate-main">
                    Are you sure you want to reactivate the account for{' '}
                    <strong>{getUserDisplayName(activateTargets[0])}</strong>?
                  </p>
                  <p className="deactivate-sub">This will restore the user's access to the system.</p>
                </>
              ) : (
                <>
                  <p className="deactivate-main">
                    You are about to reactivate <strong>{activateTargets.length} user accounts</strong>.
                  </p>
                  <p className="deactivate-sub">This will restore access for all selected users.</p>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={closeActivateModal}>Cancel</button>
              <button className="modal-create" onClick={handleConfirmActivate}>Reactivate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;
