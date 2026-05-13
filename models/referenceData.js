// ── What this file does ──────────────────────────────────────────────────────
// This file defines the ReferenceData model — the blueprint for the
// 'reference_data' table, which stores the hospital's service catalog.
//
// A "service" here is a medical or administrative service the hospital offers,
// such as "Blood Test", "X-Ray", or "Consultation".
//
// This data is used by:
//   - The Admin subsystem to manage the service catalog
//   - The Billing subsystem (via the /subsystem/services endpoint) to look up
//     service names and base costs when generating bills
// ─────────────────────────────────────────────────────────────────────────────

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ReferenceData = sequelize.define('ReferenceData', {

  // service_id: the primary key — auto-incrementing integer
  service_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },

  // service_name: the name of the service (e.g., "Blood Test", "MRI Scan")
  // Must be unique — no two services can have the same name
  service_name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },

  // category: groups services into types (e.g., "Laboratory", "Radiology")
  category: {
    type: DataTypes.STRING,
    allowNull: false
  },

  // is_available: whether this service is currently offered
  // Set to false to "deactivate" a service without deleting it
  is_available: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },

  // base_cost: the standard price of this service
  base_cost: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },

  // last_updated: when this service record was last modified
  // Automatically updated by Sequelize when the record changes
  last_updated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'reference_data',
  timestamps: true,
  // Map Sequelize's built-in 'updatedAt' to our custom column name 'last_updated'
  updatedAt: 'last_updated',
  createdAt: false
});

module.exports = ReferenceData;
