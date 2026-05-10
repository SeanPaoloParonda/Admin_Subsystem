const User = require('../models/user');
const Role = require('../models/role');
const Permission = require('../models/permission');
const RolePermission = require('../models/rolePermission');
const sequelize = require('../config/db');
const { logAdminAction } = require('../utils/auditUtils');

/**
 * Get all roles and their permissions
 */
const getRoles = async (req, res) => {
  try {
    const roles = await Role.findAll({
      include: [{
        model: Permission,
        through: { attributes: [] }, // exclude join table fields
        attributes: ['permission_id', 'action']
      }]
    });

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
    const { roleId } = req.params;

    const role = await Role.findByPk(roleId, {
      include: [{
        model: Permission,
        through: { attributes: [] },
        attributes: ['permission_id', 'action']
      }]
    });

    if (!role) return res.status(404).json({ message: 'Role not found' });

    res.json({ role });
  } catch (error) {
    console.error('Get role permissions error:', error);
    res.status(500).json({ message: 'Server error fetching role permissions' });
  }
};

/**
 * Assign role to a user
 */
const createRole = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { name, subsystem, permissions } = req.body;
    if (!name || !subsystem) return res.status(400).json({ message: 'Role name and subsystem are required' });

    const role = await Role.create({ name, subsystem, status: 'active' }, { transaction });
    const permissionRecords = await Promise.all((permissions || []).map(async (action) => {
      const [permission] = await Permission.findOrCreate({
        where: { module: 'Role', action },
        defaults: { description: '' },
        transaction
      });
      return permission;
    }));

    await role.setPermissions(permissionRecords, { transaction });
    await transaction.commit();

    const roleWithPermissions = await Role.findByPk(role.role_id, {
      include: [{ model: Permission, through: { attributes: [] }, attributes: ['permission_id', 'action'] }]
    });

    await logAdminAction({
      user_id: req.user.user_id,
      action_type: 'ROLE_CREATED',
      details: `Role "${name}" created in subsystem "${subsystem}" by ${req.user.username}`,
      ip_addr: req.ip || req.connection.remoteAddress
    });

    res.status(201).json({ role: roleWithPermissions });
  } catch (error) {
    await transaction.rollback();
    console.error('Create role error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'A role with this name already exists in the selected subsystem.' });
    }
    res.status(500).json({ message: 'Server error creating role' });
  }
};

const updateRole = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { name, subsystem, permissions, status } = req.body;
    const role = await Role.findByPk(id, { transaction });
    if (!role) return res.status(404).json({ message: 'Role not found' });

    // Prevent anyone from modifying Admin or Super Admin roles
    // (except a Super Admin modifying a non-Super-Admin role)
    if (role.name === 'Super Admin') {
      return res.status(403).json({ message: 'The "Super Admin" role cannot be modified' });
    }
    if (role.name === 'Admin' && req.user.role !== 'Super Admin') {
      return res.status(403).json({ message: 'The "Admin" role can only be modified by a Super Admin' });
    }

    // Prevent deactivating the role the requesting user is currently assigned to
    if (status === 'inactive' && role.role_id === req.user.role_id) {
      return res.status(403).json({ message: 'You cannot deactivate the role currently assigned to your account' });
    }

    // Prevent deactivating Admin or Super Admin roles entirely
    if (status === 'inactive' && (role.name === 'Admin' || role.name === 'Super Admin')) {
      return res.status(403).json({ message: `The "${role.name}" role cannot be deactivated` });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (subsystem !== undefined) updateData.subsystem = subsystem;
    if (status !== undefined) updateData.status = status;

    await role.update(updateData, { transaction });

    // Only update permissions if explicitly provided
    if (permissions !== undefined) {
      const permissionRecords = await Promise.all(permissions.map(async (action) => {
        const [permission] = await Permission.findOrCreate({
          where: { module: 'Role', action },
          defaults: { description: '' },
          transaction
        });
        return permission;
      }));
      await role.setPermissions(permissionRecords, { transaction });
    }

    await transaction.commit();

    const updatedRole = await Role.findByPk(role.role_id, {
      include: [{ model: Permission, through: { attributes: [] }, attributes: ['permission_id', 'action'] }]
    });

    // Determine the specific action type for the audit trail
    let actionType = 'ROLE_UPDATED';
    let actionDetails = `Role "${role.name}" updated by ${req.user.username}`;
    if (status === 'inactive') {
      actionType = 'ROLE_DEACTIVATED';
      actionDetails = `Role "${role.name}" deactivated by ${req.user.username}`;
    } else if (status === 'active') {
      actionType = 'ROLE_ACTIVATED';
      actionDetails = `Role "${role.name}" activated by ${req.user.username}`;
    }

    await logAdminAction({
      user_id: req.user.user_id,
      action_type: actionType,
      details: actionDetails,
      ip_addr: req.ip || req.connection.remoteAddress
    });

    res.json({ role: updatedRole });
  } catch (error) {
    await transaction.rollback();
    console.error('Update role error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'A role with this name already exists in the selected subsystem.' });
    }
    res.status(500).json({ message: 'Server error updating role' });
  }
};

const assignRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role_id } = req.body;

    if (!role_id) return res.status(400).json({ message: 'role_id is required' });

    const role = await Role.findByPk(role_id);
    if (!role) return res.status(400).json({ message: 'Invalid role_id' });

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Prevent changing Super Admin role unless requester is Super Admin
    const currentRole = await Role.findByPk(user.role_id);
    if (currentRole?.name === 'Super Admin' && req.user.role !== 'Super Admin') {
      return res.status(403).json({ message: 'Cannot modify Super Admin role' });
    }

    await user.update({ role_id });

    await logAdminAction({
      user_id: req.user.user_id,
      action_type: 'ROLE_ASSIGNED',
      details: `Role ${role.name} assigned to user ${user.username} by ${req.user.username}`,
      ip_addr: req.ip || req.connection.remoteAddress
    });

    res.json({
      message: 'Role assigned successfully',
      user: {
        user_id: user.user_id,
        username: user.username,
        role_id: user.role_id
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

    const user = await User.findByPk(userId, {
      include: [{
        model: Role,
        include: [{
          model: Permission,
          through: { attributes: [] },
          attributes: ['permission_id', 'action']
        }]
      }]
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      user_id: user.user_id,
      username: user.username,
      role: user.Role.name,
      permissions: user.Role.Permissions.map(p => p.action)
    });
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({ message: 'Server error fetching user permissions' });
  }
};

/**
 * Check if user has specific permission
 */
const checkPermission = async (userRoleId, requiredPermission) => {
  const rolePermissions = await RolePermission.findAll({
    where: { role_id: userRoleId },
    include: [Permission]
  });

  const permissions = rolePermissions.map(rp => rp.Permission.action);
  return permissions.includes(requiredPermission);
};

module.exports = {
  getRoles,
  getRolePermissions,
  createRole,
  updateRole,
  assignRole,
  getUserPermissions,
  checkPermission
};
