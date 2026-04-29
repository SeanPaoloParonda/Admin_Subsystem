/**
 * Centralized role-permissions configuration
 * Single source of truth for roles across the application
 */
const ROLE_PERMISSIONS = {
  'Super Admin': [
    'user:create', 'user:read', 'user:update', 'user:delete',
    'role:manage', 'audit:read', 'audit:export',
    'config:read', 'config:update',
    'reference:create', 'reference:read', 'reference:update', 'reference:delete'
  ],
  'Admin': [
    'user:create', 'user:read', 'user:update', 'user:delete',
    'audit:read', 'audit:export',
    'config:read', 'config:update'
  ],
  'Doctor': [
    'patient:read', 'patient:update',
    'appointment:read', 'appointment:create',
    'medical:read', 'medical:create'
  ],
  'Nurse': [
    'patient:read',
    'appointment:read',
    'medical:read'
  ],
  'Staff': [
    'appointment:read', 'appointment:create'
  ]
};

module.exports = { ROLE_PERMISSIONS };

