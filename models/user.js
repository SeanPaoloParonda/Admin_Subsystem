// ── What this file does ──────────────────────────────────────────────────────
// This file defines the User model — the blueprint for the 'users' table.
// Each property here corresponds to a column in that table.
// Sequelize uses this definition to know how to read and write user records.
// ─────────────────────────────────────────────────────────────────────────────

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Import the Role model so we can define the relationship between users and roles
const Role = require('./role');

// Define the User model — maps to the 'users' table in PostgreSQL
const User = sequelize.define('Users', {

  // user_id: the primary key — a UUID (universally unique identifier)
  // UUIDs look like: "550e8400-e29b-41d4-a716-446655440000"
  // They are generated automatically when a new user is created
  user_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4, // auto-generate a UUID v4 on creation
    primaryKey: true
  },

  // staff_id: an optional link to a staff record in the Staff Management subsystem
  // Must be unique — no two users can share the same staff_id
  staff_id: {
    type: DataTypes.STRING(50),
    allowNull: true,  // not required — a user may not have a staff record yet
    unique: true
  },

  // first_name and last_name: the user's real name (optional)
  first_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  last_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },

  // username: the login name — must be unique across all users
  username: {
    type: DataTypes.STRING(50),
    allowNull: false, // required — every user must have a username
    unique: true
  },

  // pwd_hash: the hashed password — NEVER the plain text password
  // We store only the bcrypt hash for security
  pwd_hash: {
    type: DataTypes.STRING(255),
    allowNull: false // required — every user must have a password
  },

  // role_id: a foreign key linking this user to a role in the 'role' table
  // allowNull: true means a user can exist without a role assigned yet
  role_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Role,    // references the Role model
      key: 'role_id'  // specifically the role_id column
    }
  },

  // status: whether the account is active or inactive
  // Inactive users cannot log in
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active' // new users are active by default
  },

  // last_login: timestamp of the most recent successful login
  // Updated every time the user logs in successfully
  last_login: {
    type: DataTypes.DATE,
    allowNull: true // null means the user has never logged in
  },

  // created_at: when the user account was created
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },

  // updated_at: when the user record was last modified
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'users',
  timestamps: false // we manage created_at and updated_at manually above
});

// ── Associations ──────────────────────────────────────────────────────────────
// A User belongs to one Role (via role_id).
// A Role can have many Users.
// This lets us do: User.findAll({ include: [Role] }) to get role info with users.
User.belongsTo(Role, { foreignKey: 'role_id', allowNull: true });
Role.hasMany(User, { foreignKey: 'role_id' });

module.exports = User;
