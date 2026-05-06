const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ReferenceData = sequelize.define('ReferenceData', {
  service_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  service_name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false
  },
  is_available: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  base_cost: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  last_updated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'reference_data',
  timestamps: true,
  updatedAt: 'last_updated',
  createdAt: false
});

module.exports = ReferenceData;
