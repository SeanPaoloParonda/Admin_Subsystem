const User = require('../models/user');
const AuditLog = require('../models/auditLog');
const Role = require('../models/role');
const { hashPassword } = require('../utils/passwordUtils');

/**
 * Get all users (with pagination and filtering)
 */
const getAllUsers = async (req, res) => {
  try {
    const { page, limit, role_id, status, subsystem } = req.query;

    const where = {};
    if (role_id) where.role_id = role_id;
    if (status) where.status = status;

    // Build role include — filter by subsystem if provided
    const roleInclude = {
      model: Role,
      attributes: ['role_id', 'name', 'subsystem'],
      ...(subsystem ? { where: { subsystem } } : {})
    };

    // If pagination params are provided use them, otherwise return all users
    if (page && limit) {
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      const users = await User.findAndCountAll({
        where,
        include: [roleInclude],
        attributes: { exclude: ['pwd_hash'] },
        limit: limitNum,
        offset
      });

      return res.json({
        users: users.rows,
        total: users.count,
        page: pageNum,
        totalPages: Math.ceil(users.count / limitNum)
      });
    }

    // No pagination — return all users
    const users = await User.findAll({
      where,
      include: [roleInclude],
      attributes: { exclude: ['pwd_hash'] },
      order: [['created_at', 'DESC']]
    });

    res.json({ users });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
};

/**
 * Get user by ID
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {
      include: [{ model: Role, attributes: ['role_id', 'name', 'subsystem'] }],
      attributes: { exclude: ['pwd_hash'] }
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ message: 'Server error fetching user' });
  }
};

/**
 * Create a new user
 */
const createUser = async (req, res) => {
  try {
    const { first_name, last_name, username, password, role_id, status } = req.body;

    if (!username || !password || !role_id) {
      return res.status(400).json({ message: 'username, password, and role_id are required' });
    }

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) return res.status(400).json({ message: 'Username already exists' });

    const pwd_hash = await hashPassword(password);

    const user = await User.create({
      first_name,
      last_name,
      username,
      pwd_hash,
      role_id,
      status: status || 'active'
    });

    await AuditLog.create({
      user_id: req.user.user_id,
      action_type: 'USER_CREATED',
      details: `New user created: ${username} with role_id: ${role_id}`,
      ip_addr: req.ip || req.connection.remoteAddress
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        user_id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        role_id: user.role_id,
        status: user.status,
        created_at: user.createdAt
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Server error creating user' });
  }
};

/**
 * Update user
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, username, password, role_id, status } = req.body;

    const user = await User.findByPk(id, { include: [Role] });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Prevent modification of Super Admin by non-Super Admin
    const role = await Role.findByPk(user.role_id);
    if (role?.name === 'Super Admin' && req.user.role !== 'Super Admin') {
      return res.status(403).json({ message: 'Cannot modify Super Admin account' });
    }

    if (username && username !== user.username) {
      const existingUser = await User.findOne({ where: { username } });
      if (existingUser) return res.status(400).json({ message: 'Username already exists' });
    }

    const updates = {
      first_name: first_name || user.first_name,
      last_name:  last_name  || user.last_name,
      username:   username   || user.username,
      role_id:    role_id    || user.role_id,
      status:     status     || user.status,
    };

    // Hash new password if provided
    if (password && password.trim()) {
      updates.pwd_hash = await hashPassword(password);
    }

    await user.update(updates);

    // Determine specific action type — compare against updates, not old user.status
    let actionType = 'USER_UPDATED';
    let actionDetails = `User ${user.username} updated by ${req.user.username}`;

    if (updates.status === 'active' && user.status !== 'active') {
      actionType = 'USER_ACTIVATED';
      actionDetails = `User ${user.username} activated by ${req.user.username}`;
    } else if (updates.status === 'inactive') {
      actionType = 'USER_DEACTIVATED';
      actionDetails = `User ${user.username} deactivated by ${req.user.username}`;
    } else if (password && password.trim()) {
      actionType = 'USER_PASSWORD_CHANGED';
      actionDetails = `Password for user ${user.username} changed via edit by ${req.user.username}`;
    }

    await AuditLog.create({
      user_id: req.user.user_id,
      action_type: actionType,
      details: actionDetails,
      ip_addr: req.ip || req.connection.remoteAddress
    });

    res.json({
      message: 'User updated successfully',
      user: {
        user_id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        role_id: user.role_id,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error updating user' });
  }
};

/**
 * Deactivate user
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, { include: [Role] });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const role = await Role.findByPk(user.role_id);
    if (role?.name === 'Super Admin') {
      return res.status(403).json({ message: 'Cannot deactivate Super Admin account' });
    }

    // Prevent deactivating your own account
    if (user.user_id === req.user.user_id) {
      return res.status(403).json({ message: 'You cannot deactivate your own account' });
    }

    await user.update({ status: 'inactive' });

    await AuditLog.create({
      user_id: req.user.user_id,
      action_type: 'USER_DEACTIVATED',
      details: `User ${user.username} deactivated by ${req.user.username}`,
      ip_addr: req.ip || req.connection.remoteAddress
    });

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error deleting user' });
  }
};

/**
 * Change user password (admin function)
 */
const changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) return res.status(400).json({ message: 'New password is required' });

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const pwd_hash = await hashPassword(newPassword);
    await user.update({ pwd_hash });

    await AuditLog.create({
      user_id: req.user.user_id,
      action_type: 'PASSWORD_CHANGED',
      details: `Password for user ${user.username} changed by ${req.user.username}`,
      ip_addr: req.ip || req.connection.remoteAddress
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error changing password' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changePassword
};
