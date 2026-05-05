const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Role = sequelize.define('Role', {
  role_id: {
    type: DataTypes.INTEGER,          // SERIAL in Postgres
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(50),       // VARCHAR(50)
    allowNull: false
    // uniqueness is enforced per subsystem via the indexes below
  },
  subsystem: {
    type: DataTypes.STRING(50),       // VARCHAR(50)
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT              // TEXT
  },
  status: {
    type: DataTypes.STRING(20),       // VARCHAR(20)
    defaultValue: 'active'
  },
  created_at: {
    type: DataTypes.DATE,             // TIMESTAMP
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,             // TIMESTAMP
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'role',
  timestamps: false,                  // disable auto timestamps, we manage created_at/updated_at
  indexes: [
    {
      unique: true,
      fields: ['name', 'subsystem']   // role name must be unique within a subsystem
    }
  ]
});

module.exports = Role;
