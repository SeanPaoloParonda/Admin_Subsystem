const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./user');

const AuditLog = sequelize.define('AuditLog', {
  log_id: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true 
  },
  created_at: {
    type: DataTypes.DATE,          // maps to TIMESTAMPTZ in Postgres
    defaultValue: DataTypes.NOW
  },
  user_id: { 
    type: DataTypes.UUID, 
    allowNull: false 
  },
  action_type: { 
    type: DataTypes.STRING(50),    // tighten length for consistency
    allowNull: false
  },
  details: { 
    type: DataTypes.TEXT 
  },
  ip_addr: { 
    type: DataTypes.STRING(45)     // enough for IPv4/IPv6
  },
}, {
  tableName: 'audit_logs',
  timestamps: false,               // we manage created_at manually
  freezeTableName: true
});

// Association for fetching username in activities
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = AuditLog;
