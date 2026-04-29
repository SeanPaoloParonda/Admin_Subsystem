const User = require('../models/user');
const AuditLog = require('../models/auditLog');
const { ROLE_PERMISSIONS } = require('../config/roles');

/**
 * Get all roles and their permissions
 */
const getRoles = async (req, res) => {
  try {
    const roles = Object.keys(ROLE_PERMISSIONS).map(role => ({
      role,
      permissions: ROLE_PERMISSIONS[role]
    }));

    res.json({ roles });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ message: 'Server error fetching roles' });
  }
};

/**
 * Get permissions for a specific role
 */
const getRolePermissions = async (req, res) => {
  try {
    const { role } = req.params;

    if (!ROLE_PERMISSIONS[role]) {
      return res.status(404).json({ message: 'Role not found' });
    }

    res.json({
      role,
      permissions: ROLE_PERMISSIONS[role]
    });
  } catch (error) {
    console.error('Get role permissions error:', error);
    res.status(500).json({ message: 'Server error fetching role permissions' });
  }
};

/**
 * Assign role to a user
 */
const assignRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ message: 'Role is required' });
    }

    if (!ROLE_PERMISSIONS[role]) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent changing Super Admin role
    if (user.role === 'Super Admin' && req.user.role !== 'Super Admin') {
      return res.status(403).json({ message: 'Cannot modify Super Admin role' });
    }

    await user.update({ role });

    // Log role assignment
    await AuditLog.create({
      user_id: req.user.user_id,
      action_type: 'ROLE_ASSIGNED',
      details: `Role ${role} assigned to user ${user.username} by ${req.user.username}`,
      ip_addr: req.ip || req.connection.remoteAddress
    });

    res.json({
      message: 'Role assigned successfully',
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Assign role error:', error);
    res.status(500).json({ message: 'Server error assigning role' });
  }
};

/**
 * Get user permissions based on role
 */
const getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const permissions = ROLE_PERMISSIONS[user.role] || [];

    res.json({
      user_id: user.user_id,
      username: user.username,
      role: user.role,
      permissions
    });
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({ message: 'Server error fetching user permissions' });
  }
};

/**
 * Check if user has specific permission
 */
const checkPermission = (userRole, requiredPermission) => {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(requiredPermission);
};

module.exports = {
  getRoles,
  getRolePermissions,
  assignRole,
  getUserPermissions,
  checkPermission,
  ROLE_PERMISSIONS
};