// ── What this file does ──────────────────────────────────────────────────────
// This file defines the Permission model — the blueprint for the 'permission' table.
//
// A permission represents a specific action a user is allowed to perform.
// The main permission actions used in this system are:
//   - 'Create' → allowed to add new records (POST requests)
//   - 'View'   → allowed to read records (GET requests)
//   - 'Patch'  → allowed to edit or deactivate records (PATCH/DELETE requests)
//   - 'Delete' → allowed to delete records
//
// Permissions are linked to roles through the RolePermission join table.
// A role can have multiple permissions, and a permission can belong to multiple roles.
// ─────────────────────────────────────────────────────────────────────────────

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Permission = sequelize.define('Permission', {

  // permission_id: the primary key — auto-incrementing integer
  permission_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },

  // module: which part of the system this permission applies to
  // Examples: 'User', 'Role', 'Audit', 'Reference'
  module: {
    type: DataTypes.STRING(50),
    allowNull: false
  },

  // action: what the user is allowed to do
  // Examples: 'Create', 'View', 'Patch', 'Delete'
  action: {
    type: DataTypes.STRING(50),
    allowNull: false
  },

  // description: an optional explanation of what this permission allows
  description: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'permission',
  timestamps: false
});

module.exports = Permission;
