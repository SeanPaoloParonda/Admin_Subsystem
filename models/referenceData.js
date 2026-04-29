const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ReferenceData = sequelize.define('ReferenceData', {
  service_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  service_name: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING },
  is_available: { type: DataTypes.BOOLEAN, defaultValue: true },
  base_cost: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  last_updated: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

module.exports = ReferenceData;