const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./user');

const Alert = sequelize.define('Alert', {
  alert_id: { type: DataTypes.INTEGER, primaryKey: true }, // comes from audit_logs.log_id
  user_id: { type: DataTypes.UUID },
  action_type: { type: DataTypes.STRING },
  message: { type: DataTypes.STRING },
  type: { type: DataTypes.STRING },
  ip_addr: { type: DataTypes.STRING(45) },
  created_at: { type: DataTypes.DATE }
}, {
  tableName: 'alerts',   // this is the VIEW
  timestamps: false
});

Alert.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = Alert;
