const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AuditLog = sequelize.define('AuditLog', {
  log_id: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true, 
    primaryKey: true 
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  user_id: { 
    type: DataTypes.UUID, 
    allowNull: false
    // No FK reference — audit logs must always be writable even for unknown/system users
  },
  action_type: { 
    type: DataTypes.STRING(50),
    allowNull: false
  },
  details: { 
    type: DataTypes.TEXT 
  },
  ip_addr: { 
    type: DataTypes.STRING(45)
  },
  subsystem: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
}, {
  tableName: 'audit_logs',
  timestamps: false,
  freezeTableName: true
});

module.exports = AuditLog;
