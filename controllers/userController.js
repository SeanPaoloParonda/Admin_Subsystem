const User = require('../models/user');
const AuditLog = require('../models/auditLog');
const { hashPassword } = require('../utils/passwordUtils');

/**
 * Get all users (with pagination and filtering)
 */
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, status } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (role) where.role = role;
    if (status) where.status = status;

    const users = await User.findAndCountAll({
      where,
      attributes: { exclude: ['pwd_hash'] },
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      users: users.rows,
      total: users.count,
      page: parseInt(page),
      totalPages: Math.ceil(users.count / limit)
    });
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
      attributes: { exclude: ['pwd_hash'] }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

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
    const { staff_id, username, password, role, status } = req.body;

    // Validate required fields
    if (!staff_id || !username || !password || !role) {
      return res.status(400).json({ message: 'staff_id, username, password, and role are required' });
    }

    // Check for duplicate username
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Check for duplicate staff_id
    const existingStaff = await User.findOne({ where: { staff_id } });
    if (existingStaff) {
      return res.status(400).json({ message: 'Staff ID already linked to another account' });
    }

    // Hash password
    const pwd_hash = await hashPassword(password);

    // Create user
    const user = await User.create({
      staff_id,
      username,
      pwd_hash,
      role,
      status: status || 'active'
    });

    // Log user creation
    await AuditLog.create({
      user_id: req.user.user_id,
      action_type: 'USER_CREATED',
      details: `New user created: ${username} with role: ${role}`,
      ip_addr: req.ip || req.connection.remoteAddress
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        user_id: user.user_id,
        staff_id: user.staff_id,
        username: user.username,
        role: user.role,
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
    const { staff_id, username, role, status } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deletion of Super Admin by non-Super Admin
    if (user.role === 'Super Admin' && req.user.role !== 'Super Admin') {
      return res.status(403).json({ message: 'Cannot modify Super Admin account' });
    }

    // Check for duplicate username (if changing)
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ where: { username } });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }
    }

    // Check for duplicate staff_id (if changing)
    if (staff_id && staff_id !== user.staff_id) {
      const existingStaff = await User.findOne({ where: { staff_id } });
      if (existingStaff) {
        return res.status(400).json({ message: 'Staff ID already linked to another account' });
      }
    }

    // Update user fields
    await user.update({
      staff_id: staff_id || user.staff_id,
      username: username || user.username,
      role: role || user.role,
      status: status || user.status
    });

    // Log user update
    await AuditLog.create({
      user_id: req.user.user_id,
      action_type: 'USER_UPDATED',
      details: `User ${user.username} updated by ${req.user.username}`,
      ip_addr: req.ip || req.connection.remoteAddress
    });

    res.json({
      message: 'User updated successfully',
      user: {
        user_id: user.user_id,
        staff_id: user.staff_id,
        username: user.username,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error updating user' });
  }
};

/**
 * Delete (deactivate) user
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deletion of Super Admin
    if (user.role === 'Super Admin') {
      return res.status(403).json({ message: 'Cannot delete Super Admin account' });
    }

    // Prevent self-deletion
    if (user.user_id === req.user.user_id) {
      return res.status(403).json({ message: 'Cannot delete your own account' });
    }

    // Deactivate instead of hard delete
    await user.update({ status: 'inactive' });

    // Log user deletion
    await AuditLog.create({
      user_id: req.user.user_id,
      action_type: 'USER_DELETED',
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

    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash new password
    const pwd_hash = await hashPassword(newPassword);
    await user.update({ pwd_hash });

    // Log password change
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