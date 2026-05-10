const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Role = require('./role');

const User = sequelize.define('Users', {
  user_id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  staff_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    unique: true
  },
  first_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  last_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
pwd_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role_id: {
    type: DataTypes.INTEGER,   // optional FK
    allowNull: true,           // can be NULL
    references: {
      model: Role,
      key: 'role_id'
    }
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active'
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'users',
  timestamps: false
});

// Associations (optional, but safe)
User.belongsTo(Role, { foreignKey: 'role_id', allowNull: true });
Role.hasMany(User, { foreignKey: 'role_id' });

module.exports = User;
