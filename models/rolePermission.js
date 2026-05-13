// ── What this file does ──────────────────────────────────────────────────────
// This file defines the RolePermission model — the "join table" that links
// roles to permissions in a many-to-many relationship.
//
// A join table is needed when:
//   - One role can have MANY permissions (e.g., Admin has Create + View + Patch)
//   - One permission can belong to MANY roles (e.g., 'View' is shared by many roles)
//
// This table simply stores pairs of (role_id, permission_id) to record
// which permissions each role has been granted.
//
// Example rows:
//   role_id=1, permission_id=1  → Admin can Create
//   role_id=1, permission_id=2  → Admin can View
//   role_id=2, permission_id=2  → Nurse can View (but not Create)
// ─────────────────────────────────────────────────────────────────────────────

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Role = require('./role');
const Permission = require('./permission');

const RolePermission = sequelize.define('RolePermission', {

  // role_id: foreign key pointing to the role table
  // Together with permission_id, this forms a composite primary key
  role_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Role,
      key: 'role_id'
    },
    primaryKey: true
  },

  // permission_id: foreign key pointing to the permission table
  permission_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Permission,
      key: 'permission_id'
    },
    primaryKey: true
  }
}, {
  tableName: 'role_permission',
  timestamps: false
});

// ── Associations ──────────────────────────────────────────────────────────────
// These let Sequelize do JOIN queries like:
// RolePermission.findAll({ include: [Permission] })
RolePermission.belongsTo(Permission, { foreignKey: 'permission_id' });
RolePermission.belongsTo(Role, { foreignKey: 'role_id' });
Permission.hasMany(RolePermission, { foreignKey: 'permission_id' });
Role.hasMany(RolePermission, { foreignKey: 'role_id' });

module.exports = RolePermission;
