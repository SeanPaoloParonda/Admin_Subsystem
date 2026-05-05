const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Permission = sequelize.define('Permission', {
  permission_id: {
    type: DataTypes.INTEGER,   // SERIAL → INTEGER autoIncrement
    autoIncrement: true,
    primaryKey: true
  },
  module: {
    type: DataTypes.STRING(50), // VARCHAR(50)
    allowNull: false
  },
  action: {
    type: DataTypes.STRING(50), // VARCHAR(50)
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT        // TEXT
  }
}, {
  tableName: 'permission',
  timestamps: false
});

module.exports = Permission;
