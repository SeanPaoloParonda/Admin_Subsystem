// ── What this file does ──────────────────────────────────────────────────────
// This file contains the controller functions for role management:
//   - getRoles:          list all roles and their permissions
//   - getRolePermissions: get permissions for a specific role
//   - createRole:        create a new role with optional permissions
//   - updateRole:        update a role's name, subsystem, status, or permissions
//   - assignRole:        assign a role to a specific user
//   - getUserPermissions: get the permissions a specific user has (via their role)
//   - checkPermission:   utility to check if a role has a specific permission
//
// These functions are called by the routes in routes/roleRoutes.js.
// ─────────────────────────────────────────────────────────────────────────────

// Import the models needed for role management
const User = require('../models/user');
const Role = require('../models/role');
const Permission = require('../models/permission');
const RolePermission = require('../models/rolePermission');

// sequelize is needed to run database transactions
// A transaction groups multiple DB operations so they all succeed or all fail together
const sequelize = require('../config/db');

// logAdminAction records important events in the audit log
const { logAdminAction } = require('../utils/auditUtils');

/**
 * getRoles
 *
 * Returns all roles in the system, each with their associated permissions.
 * Used to populate the Roles Management page in the frontend.
 *
 * GET /admin/api/roles
 */
const getRoles = async (req, res) => {
  try {
    const roles = await Role.findAll({
      include: [{
        model: Permission,
        through: { attributes: [] }, // don't include the join table (role_permission) columns
        attributes: ['permission_id', 'action'] // only fetch the ID and action name
      }]
    });

    res.json({ roles });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ message: 'Server error fetching roles' });
  }
};

/**
 * getRolePermissions
 *
 * Returns the permissions assigned to a specific role.
 *
 * GET /admin/api/roles/:roleId/permissions
 */
const getRolePermissions = async (req, res) => {
  try {
    const { roleId } = req.params;

    // Find the role by its ID and include its permissions
    const role = await Role.findByPk(roleId, {
      include: [{
        model: Permission,
        through: { attributes: [] },
        attributes: ['permission_id', 'action']
      }]
    });

    // Return 404 if the role doesn't exist
    if (!role) return res.status(404).json({ message: 'Role not found' });

    res.json({ role });
  } catch (error) {
    console.error('Get role permissions error:', error);
    res.status(500).json({ message: 'Server error fetching role permissions' });
  }
};

/**
 * createRole
 *
 * Creates a new role and optionally assigns permissions to it.
 * Uses a database transaction so that if the permission assignment fails,
 * the role creation is also rolled back (no partial data is saved).
 *
 * POST /admin/api/roles
 * Body: { name, subsystem, permissions: ['Create', 'View', 'Patch'] }
 */
const createRole = async (req, res) => {
  // Start a transaction — all DB operations inside will be atomic
  const transaction = await sequelize.transaction();
  try {
    const { name, subsystem, permissions } = req.body;

    // Both name and subsystem are required
    if (!name || !subsystem) return res.status(400).json({ message: 'Role name and subsystem are required' });

    // Create the role record inside the transaction
    const role = await Role.create({ name, subsystem, status: 'active' }, { transaction });

    // For each permission action provided, find or create the Permission record
    // findOrCreate: if a Permission with this module+action already exists, use it;
    // otherwise create a new one. This avoids duplicate permission records.
    const permissionRecords = await Promise.all((permissions || []).map(async (action) => {
      const [permission] = await Permission.findOrCreate({
        where: { module: 'Role', action },
        defaults: { description: '' },
        transaction
      });
      return permission;
    }));

    // Link the permissions to the role using Sequelize's setPermissions helper
    // This writes the rows into the role_permission join table
    await role.setPermissions(permissionRecords, { transaction });

    // All operations succeeded — commit the transaction to save everything
    await transaction.commit();

    // Fetch the newly created role with its permissions for the response
    const roleWithPermissions = await Role.findByPk(role.role_id, {
      include: [{ model: Permission, through: { attributes: [] }, attributes: ['permission_id', 'action'] }]
    });

    // Record the role creation in the audit log
    await logAdminAction({
      user_id: req.user.user_id,
      action_type: 'ROLE_CREATED',
      details: `Role "${name}" created in subsystem "${subsystem}" by ${req.user.username}`,
      ip_addr: req.ip
    });

    res.status(201).json({ role: roleWithPermissions });
  } catch (error) {
    // Something went wrong — roll back all changes so the DB stays consistent
    await transaction.rollback();
    console.error('Create role error:', error);

    // Handle the case where a role with this name already exists in this subsystem
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'A role with this name already exists in the selected subsystem.' });
    }
    res.status(500).json({ message: 'Server error creating role' });
  }
};

/**
 * updateRole
 *
 * Updates an existing role's name, subsystem, status, or permissions.
 * Includes several safety checks to prevent accidental lockouts.
 * Uses a transaction to ensure all changes are saved together or not at all.
 *
 * PATCH /admin/api/roles/:id
 * Body: { name, subsystem, permissions, status }
 */
const updateRole = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { name, subsystem, permissions, status } = req.body;

    // Find the role to update
    const role = await Role.findByPk(id, { transaction });
    if (!role) return res.status(404).json({ message: 'Role not found' });

    // ── Safety check: Super Admin role is immutable ───────────────────────────
    // The Super Admin role cannot be modified by anyone.
    // This protects the highest-privilege role from being accidentally changed.
    if (role.name === 'Super Admin') {
      return res.status(403).json({ message: 'The "Super Admin" role cannot be modified' });
    }

    // ── Safety check: Admin role can only be modified by Super Admin ──────────
    if (role.name === 'Admin' && req.user.role !== 'Super Admin') {
      return res.status(403).json({ message: 'The "Admin" role can only be modified by a Super Admin' });
    }

    // ── Safety check: cannot deactivate your own role ─────────────────────────
    // If an admin deactivated their own role, they would lose access immediately
    if (status === 'inactive' && role.role_id === req.user.role_id) {
      return res.status(403).json({ message: 'You cannot deactivate the role currently assigned to your account' });
    }

    // ── Safety check: Admin and Super Admin roles cannot be deactivated ───────
    if (status === 'inactive' && (role.name === 'Admin' || role.name === 'Super Admin')) {
      return res.status(403).json({ message: `The "${role.name}" role cannot be deactivated` });
    }

    // ── Build the update object ───────────────────────────────────────────────
    // Only include fields that were actually provided in the request
    const updateData = {};
    if (name !== undefined) updateData.name = name;

    if (subsystem !== undefined) {
      // Prevent changing the subsystem if users are currently assigned to this role.
      // Moving a role to a different subsystem would break those users' access.
      if (subsystem !== role.subsystem) {
        const assignedUsers = await require('../models/user').count({ where: { role_id: id } });
        if (assignedUsers > 0) {
          return res.status(400).json({
            message: `Cannot change subsystem — ${assignedUsers} user(s) are assigned to this role. Reassign them first.`
          });
        }
      }
      updateData.subsystem = subsystem;
    }

    if (status !== undefined) updateData.status = status;

    // Save the updated fields to the database
    await role.update(updateData, { transaction });

    // ── Update permissions if provided ────────────────────────────────────────
    // Only update permissions if the 'permissions' field was explicitly included in the request.
    // If it was omitted, we leave the existing permissions unchanged.
    if (permissions !== undefined) {
      const permissionRecords = await Promise.all(permissions.map(async (action) => {
        const [permission] = await Permission.findOrCreate({
          where: { module: 'Role', action },
          defaults: { description: '' },
          transaction
        });
        return permission;
      }));
      // Replace all existing permissions with the new set
      await role.setPermissions(permissionRecords, { transaction });
    }

    // All changes succeeded — commit the transaction
    await transaction.commit();

    // Fetch the updated role with its permissions for the response
    const updatedRole = await Role.findByPk(role.role_id, {
      include: [{ model: Permission, through: { attributes: [] }, attributes: ['permission_id', 'action'] }]
    });

    // ── Determine the specific audit log action type ──────────────────────────
    // Log a more specific action type depending on what changed
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
      ip_addr: req.ip
    });

    res.json({ role: updatedRole });
  } catch (error) {
    // Roll back all changes if anything went wrong
    await transaction.rollback();
    console.error('Update role error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'A role with this name already exists in the selected subsystem.' });
    }
    res.status(500).json({ message: 'Server error updating role' });
  }
};

/**
 * assignRole
 *
 * Assigns a role to a specific user.
 * Includes a check to prevent non-Super-Admins from modifying Super Admin users.
 *
 * POST /admin/api/roles/assign/:userId
 * Body: { role_id }
 */
const assignRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role_id } = req.body;

    // role_id is required
    if (!role_id) return res.status(400).json({ message: 'role_id is required' });

    // Verify the role exists
    const role = await Role.findByPk(role_id);
    if (!role) return res.status(400).json({ message: 'Invalid role_id' });

    // Verify the user exists
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // ── Super Admin protection ────────────────────────────────────────────────
    // Only a Super Admin can change the role of a user who currently has the Super Admin role
    const currentRole = await Role.findByPk(user.role_id);
    if (currentRole?.name === 'Super Admin' && req.user.role !== 'Super Admin') {
      return res.status(403).json({ message: 'Cannot modify Super Admin role' });
    }

    // Update the user's role_id to the new role
    await user.update({ role_id });

    // Record the role assignment in the audit log
    await logAdminAction({
      user_id: req.user.user_id,
      action_type: 'ROLE_ASSIGNED',
      details: `Role ${role.name} assigned to user ${user.username} by ${req.user.username}`,
      ip_addr: req.ip
    });

    res.json({
      message: 'Role assigned successfully',
      user: {
        user_id:  user.user_id,
        username: user.username,
        role_id:  user.role_id
      }
    });
  } catch (error) {
    console.error('Assign role error:', error);
    res.status(500).json({ message: 'Server error assigning role' });
  }
};

/**
 * getUserPermissions
 *
 * Returns the list of permissions a specific user has,
 * based on the role they are currently assigned.
 *
 * GET /admin/api/roles/user/:userId/permissions
 */
const getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the user and include their role and that role's permissions
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

    // Return a clean summary of the user's role and permissions
    res.json({
      user_id:     user.user_id,
      username:    user.username,
      role:        user.Role.name,
      permissions: user.Role.Permissions.map(p => p.action) // e.g. ['Create', 'View']
    });
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({ message: 'Server error fetching user permissions' });
  }
};

/**
 * checkPermission
 *
 * A utility function (not a route handler) that checks whether a role
 * has a specific permission. Used internally by other parts of the system.
 *
 * @param {number} userRoleId          - The role_id to check
 * @param {string} requiredPermission  - The permission action to look for (e.g., 'View')
 * @returns {Promise<boolean>}         - true if the role has the permission, false otherwise
 */
const checkPermission = async (userRoleId, requiredPermission) => {
  // Fetch all RolePermission records for this role, including the Permission details
  const rolePermissions = await RolePermission.findAll({
    where: { role_id: userRoleId },
    include: [Permission]
  });

  // Extract just the action names into a simple array
  const permissions = rolePermissions.map(rp => rp.Permission.action);

  // Return true if the required permission is in the list
  return permissions.includes(requiredPermission);
};

// Export all functions for use in the role routes
module.exports = {
  getRoles,
  getRolePermissions,
  createRole,
  updateRole,
  assignRole,
  getUserPermissions,
  checkPermission
};
