// ── What this file does ──────────────────────────────────────────────────────
// This file defines the Role model — the blueprint for the 'role' table.
//
// A role represents a job function or access level, such as 'Admin', 'Nurse',
// or 'Billing Staff'. Each user is assigned one role, and that role determines
// what they are allowed to do in the system.
//
// Roles are scoped to a subsystem — for example, 'Admin' in the Admin subsystem
// is different from 'Admin' in the Patient subsystem.
// ─────────────────────────────────────────────────────────────────────────────

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Role = sequelize.define('Role', {

  // role_id: the primary key — an auto-incrementing integer (1, 2, 3, ...)
  role_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },

  // name: the display name of the role (e.g., 'Admin', 'Super Admin', 'Nurse')
  // Uniqueness is enforced per subsystem (see indexes below), not globally
  name: {
    type: DataTypes.STRING(50),
    allowNull: false
  },

  // subsystem: which part of the hospital system this role belongs to
  // Examples: 'Admin', 'Patient', 'Billing', 'Staff'
  subsystem: {
    type: DataTypes.STRING(50),
    allowNull: false
  },

  // description: an optional longer explanation of what this role is for
  description: {
    type: DataTypes.TEXT
  },

  // status: whether this role is currently active or inactive
  // Inactive roles cannot be assigned to new users
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active' // new roles are active by default
  },

  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },

  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'role',
  timestamps: false,
  indexes: [
    {
      // A role name must be unique WITHIN a subsystem.
      // 'Admin' can exist in both 'Admin' and 'Patient' subsystems,
      // but you cannot have two 'Admin' roles in the same subsystem.
      unique: true,
      fields: ['name', 'subsystem']
    }
  ]
});

module.exports = Role;
