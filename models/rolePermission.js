const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Role = require('./role');
const Permission = require('./permission');

const RolePermission = sequelize.define('RolePermission', {
  role_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Role,
      key: 'role_id'
    },
    primaryKey: true
  },
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

// Associations needed for eager loading in middleware and controllers
RolePermission.belongsTo(Permission, { foreignKey: 'permission_id' });
RolePermission.belongsTo(Role, { foreignKey: 'role_id' });
Permission.hasMany(RolePermission, { foreignKey: 'permission_id' });
Role.hasMany(RolePermission, { foreignKey: 'role_id' });

module.exports = RolePermission;
