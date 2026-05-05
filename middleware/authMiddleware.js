const jwt = require('jsonwebtoken');
const Role = require('../models/role');
const Permission = require('../models/permission');


/**
 * Verify JWT token and attach user payload to request
 */
const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: "No token, access denied" });

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return res.status(500).json({ message: 'Server misconfiguration: JWT_SECRET not set' });
    const decoded = jwt.verify(token, jwtSecret);
    console.log('protect middleware - decoded subsystem:', decoded.subsystem);
    req.user = decoded; // { user_id, role_id, subsystem, permissions }
    next();
  } catch (error) {
    console.error('Token verify error:', error.message);
    return res.status(401).json({ message: "Token is not valid" });
  }
};

/**
 * Subsystem enforcement middleware
 * Ensures the token's subsystem matches the route prefix
 */
const enforceSubsystem = (expectedSubsystem) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });

    console.log('enforceSubsystem - expected:', expectedSubsystem, 'actual:', req.user.subsystem);

    if (req.user.subsystem !== expectedSubsystem) {
      return res.status(403).json({ message: "Access denied: wrong subsystem" });
    }

    next();
  };
};

/**
 * Role-based authorization middleware
 * @param {string[]} allowedRoles - Array of role names allowed to access the route
 */
const authorize = (...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });

    // Fetch role from DB
    const role = await Role.findByPk(req.user.role_id);
    if (!role || !allowedRoles.includes(role.name)) {
      return res.status(403).json({ message: "Access denied. Role not permitted." });
    }

    next();
  };
};

/**
 * Permission-based authorization middleware
 *
 * Permission actions stored in DB: 'Create', 'View', 'Patch'
 * These map to HTTP methods:
 *   Create → POST
 *   View   → GET
 *   Patch  → PATCH / DELETE (status changes)
 *
 * Admin and Super Admin bypass this check — their access is gated by authorize().
 */
const requirePermission = (requiredPermission) => {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

    try {
      const role = await Role.findByPk(req.user.role_id, {
        include: [{
          model: Permission,
          through: { attributes: [] },
          attributes: ['action']
        }]
      });

      if (!role) return res.status(403).json({ message: 'Access denied. Role not found.' });

      // Admin and Super Admin have full access
      if (role.name === 'Admin' || role.name === 'Super Admin') return next();

      // Use JWT-embedded permissions if available, otherwise fall back to DB
      const userPermissions = req.user.permissions && req.user.permissions.length > 0
        ? req.user.permissions
        : (role.Permissions || []).map(p => p.action);

      // Normalize to lowercase for comparison
      const normalizedUserPerms = userPermissions.map(p => p.toLowerCase());
      const normalizedRequired = requiredPermission.toLowerCase();

      if (!normalizedUserPerms.includes(normalizedRequired)) {
        return res.status(403).json({
          message: `Access denied. "${requiredPermission}" permission required.`
        });
      }

      next();
    } catch (error) {
      console.error('requirePermission error:', error);
      return res.status(500).json({ message: 'Server error checking permissions.' });
    }
  };
};

module.exports = { protect, enforceSubsystem, authorize, requirePermission };
