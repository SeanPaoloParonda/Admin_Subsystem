// ── What this file does ──────────────────────────────────────────────────────
// This file contains the controller functions for user management:
//   - getAllUsers:     list all users with optional filtering and pagination
//   - getUserById:    get a single user by their ID
//   - createUser:     create a new user account
//   - updateUser:     update an existing user's details
//   - deleteUser:     deactivate a user account (not a hard delete)
//   - changePassword: change a user's password (admin-initiated)
//
// These functions are called by the routes in routes/userRoutes.js.
// ─────────────────────────────────────────────────────────────────────────────

// Import the User and Role models for database queries
const User = require('../models/user');
const Role = require('../models/role');

// hashPassword converts a plain text password into a secure bcrypt hash
const { hashPassword } = require('../utils/passwordUtils');

// logAdminAction records important events in the audit log
const { logAdminAction } = require('../utils/auditUtils');

/**
 * getAllUsers
 *
 * Returns a list of all users. Supports optional filtering by role, status,
 * and subsystem. Also supports pagination via page and limit query parameters.
 *
 * GET /admin/api/users
 * Query params: page, limit, role_id, status, subsystem
 */
const getAllUsers = async (req, res) => {
  try {
    // Extract filter and pagination options from the URL query string
    const { page, limit, role_id, status, subsystem } = req.query;

    // Build the WHERE clause dynamically based on which filters were provided
    const where = {};
    if (role_id) where.role_id = role_id;
    if (status) where.status = status;

    // Build the Role include — optionally filter by subsystem
    // If subsystem is provided, only return users whose role belongs to that subsystem
    const roleInclude = {
      model: Role,
      attributes: ['role_id', 'name', 'subsystem'],
      ...(subsystem ? { where: { subsystem } } : {})
    };

    // ── Paginated response ────────────────────────────────────────────────────
    // If both page and limit are provided, return a paginated subset of users
    if (page && limit) {
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      // Calculate how many records to skip based on the current page
      const offset = (pageNum - 1) * limitNum;

      const users = await User.findAndCountAll({
        where,
        include: [roleInclude],
        attributes: { exclude: ['pwd_hash'] }, // never return the password hash
        limit: limitNum,
        offset
      });

      return res.json({
        users: users.rows,                              // the users for this page
        total: users.count,                             // total matching users
        page: pageNum,
        totalPages: Math.ceil(users.count / limitNum)   // how many pages exist
      });
    }

    // ── Non-paginated response ────────────────────────────────────────────────
    // If no pagination params are provided, return all matching users
    const users = await User.findAll({
      where,
      include: [roleInclude],
      attributes: { exclude: ['pwd_hash'] }, // never return the password hash
      order: [['created_at', 'DESC']]         // newest users first
    });

    res.json({ users });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
};

/**
 * getUserById
 *
 * Returns a single user record by their user_id.
 * Includes the user's role information.
 *
 * GET /admin/api/users/:id
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      include: [{ model: Role, attributes: ['role_id', 'name', 'subsystem'] }],
      attributes: { exclude: ['pwd_hash'] } // never return the password hash
    });

    // If no user was found with that ID, return a 404 error
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ message: 'Server error fetching user' });
  }
};

/**
 * createUser
 *
 * Creates a new user account with a hashed password.
 * Records the creation in the audit log.
 *
 * POST /admin/api/users
 * Body: { first_name, last_name, username, password, role_id, status }
 */
const createUser = async (req, res) => {
  try {
    const { first_name, last_name, username, password, role_id, status } = req.body;

    // Validate required fields
    if (!username || !password || !role_id) {
      return res.status(400).json({ message: 'username, password, and role_id are required' });
    }

    // Check if the username is already taken
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) return res.status(400).json({ message: 'Username already exists' });

    // Hash the password before storing it — NEVER store plain text passwords
    const pwd_hash = await hashPassword(password);

    // Create the new user record in the database
    const user = await User.create({
      first_name,
      last_name,
      username,
      pwd_hash,
      role_id,
      status: status || 'active' // default to active if not specified
    });

    // Record the user creation in the audit log
    await logAdminAction({
      user_id: req.user.user_id, // the admin who performed this action
      action_type: 'USER_CREATED',
      details: `New user created: ${username} with role_id: ${role_id}`,
      ip_addr: req.ip
    });

    // Return the new user's info (without the password hash)
    res.status(201).json({
      message: 'User created successfully',
      user: {
        user_id:    user.user_id,
        first_name: user.first_name,
        last_name:  user.last_name,
        username:   user.username,
        role_id:    user.role_id,
        status:     user.status,
        created_at: user.createdAt
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Server error creating user' });
  }
};

/**
 * updateUser
 *
 * Updates an existing user's details. Can update name, username, role,
 * status (active/inactive), and optionally the password.
 * Records the specific type of change in the audit log.
 *
 * PATCH /admin/api/users/:id
 * Body: { first_name, last_name, username, password, role_id, status }
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, username, password, role_id, status } = req.body;

    // Find the user to update, including their current role
    const user = await User.findByPk(id, { include: [Role] });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // ── Super Admin protection ────────────────────────────────────────────────
    // Only a Super Admin can modify another Super Admin's account.
    // This prevents privilege escalation attacks.
    const role = await Role.findByPk(user.role_id);
    if (role?.name === 'Super Admin' && req.user.role !== 'Super Admin') {
      return res.status(403).json({ message: 'Cannot modify Super Admin account' });
    }

    // ── Username uniqueness check ─────────────────────────────────────────────
    // If the username is being changed, make sure the new one isn't already taken
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ where: { username } });
      if (existingUser) return res.status(400).json({ message: 'Username already exists' });
    }

    // Build the update object — use the new value if provided, otherwise keep the existing value
    const updates = {
      first_name: first_name || user.first_name,
      last_name:  last_name  || user.last_name,
      username:   username   || user.username,
      role_id:    role_id    || user.role_id,
      status:     status     || user.status,
    };

    // If a new password was provided, hash it before saving
    if (password && password.trim()) {
      updates.pwd_hash = await hashPassword(password);
    }

    // Save the changes to the database
    await user.update(updates);

    // ── Determine the audit log action type ───────────────────────────────────
    // We log a specific action type depending on what changed,
    // so the audit trail is more informative than just "USER_UPDATED"
    let actionType = 'USER_UPDATED';
    let actionDetails = `User ${user.username} updated by ${req.user.username}`;

    if (updates.status === 'active' && user.status !== 'active') {
      // User was reactivated
      actionType = 'USER_ACTIVATED';
      actionDetails = `User ${user.username} activated by ${req.user.username}`;
    } else if (updates.status === 'inactive') {
      // User was deactivated
      actionType = 'USER_DEACTIVATED';
      actionDetails = `User ${user.username} deactivated by ${req.user.username}`;
    } else if (password && password.trim()) {
      // Password was changed as part of the edit
      actionType = 'USER_PASSWORD_CHANGED';
      actionDetails = `Password for user ${user.username} changed via edit by ${req.user.username}`;
    }

    await logAdminAction({
      user_id: req.user.user_id,
      action_type: actionType,
      details: actionDetails,
      ip_addr: req.ip
    });

    // Return the updated user info (without the password hash)
    res.json({
      message: 'User updated successfully',
      user: {
        user_id:    user.user_id,
        first_name: user.first_name,
        last_name:  user.last_name,
        username:   user.username,
        role_id:    user.role_id,
        status:     user.status
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error updating user' });
  }
};

/**
 * deleteUser
 *
 * Deactivates a user account by setting their status to 'inactive'.
 * This is a "soft delete" — the user record is kept in the database
 * for audit trail purposes, but the user can no longer log in.
 *
 * DELETE /admin/api/users/:id
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, { include: [Role] });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Super Admin accounts can never be deactivated
    const role = await Role.findByPk(user.role_id);
    if (role?.name === 'Super Admin') {
      return res.status(403).json({ message: 'Cannot deactivate Super Admin account' });
    }

    // Prevent an admin from deactivating their own account
    // (this would lock them out immediately)
    if (user.user_id === req.user.user_id) {
      return res.status(403).json({ message: 'You cannot deactivate your own account' });
    }

    // Set the user's status to inactive — they can no longer log in
    await user.update({ status: 'inactive' });

    // Record the deactivation in the audit log
    await logAdminAction({
      user_id: req.user.user_id,
      action_type: 'USER_DEACTIVATED',
      details: `User ${user.username} deactivated by ${req.user.username}`,
      ip_addr: req.ip
    });

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error deleting user' });
  }
};

/**
 * changePassword
 *
 * Changes a user's password. This is an admin-initiated action —
 * the admin sets a new password for another user without needing
 * to know the current password.
 *
 * POST /admin/api/users/:id/change-password
 * Body: { newPassword }
 */
const changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    // The new password is required
    if (!newPassword) return res.status(400).json({ message: 'New password is required' });

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Hash the new password before saving it
    const pwd_hash = await hashPassword(newPassword);
    await user.update({ pwd_hash });

    // Record the password change in the audit log
    await logAdminAction({
      user_id: req.user.user_id,
      action_type: 'PASSWORD_CHANGED',
      details: `Password for user ${user.username} changed by ${req.user.username}`,
      ip_addr: req.ip
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error changing password' });
  }
};

// Export all functions for use in the user routes
module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changePassword
};
