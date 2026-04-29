const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AuditLog = sequelize.define('AuditLog', {
  log_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  user_id: { type: DataTypes.UUID, allowNull: true },
  action_type: { type: DataTypes.STRING, allowNull: false },
  details: { type: DataTypes.TEXT },
  ip_addr: { type: DataTypes.STRING }
});

module.exports = AuditLog;