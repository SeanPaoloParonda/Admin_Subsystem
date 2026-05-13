// ── What this file does ──────────────────────────────────────────────────────
// This file contains "middleware" functions — code that runs BETWEEN receiving
// a request and sending a response. Middleware is used to check things like:
//   - Is the user logged in? (protect)
//   - Does the user belong to the right subsystem? (enforceSubsystem)
//   - Does the user have the right role? (authorize)
//   - Does the user have the right permission? (requirePermission)
//
// If a check fails, the middleware sends an error response and stops the request.
// If it passes, it calls next() to continue to the actual route handler.
// ─────────────────────────────────────────────────────────────────────────────

const jwt = require('jsonwebtoken');
const Role = require('../models/role');
const Permission = require('../models/permission');

/**
 * protect middleware
 *
 * Runs on every protected route to verify the user is logged in.
 * Reads the Authorization header, extracts the JWT token,
 * and verifies it using the JWT_SECRET from the .env file.
 *
 * If valid, attaches the decoded user info to req.user so controllers can use it.
 * If missing or invalid, returns a 401 Unauthorized error.
 */
const protect = (req, res, next) => {
  // The token is sent as: "Bearer <token>" — we split and take the second part
  const token = req.headers.authorization?.split(' ')[1];

  // If no token was provided, deny access immediately
  if (!token) return res.status(401).json({ message: "No token, access denied" });

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return res.status(500).json({ message: 'Server misconfiguration: JWT_SECRET not set' });

    // Verify the token — checks the signature and expiry
    // If valid, 'decoded' contains the user data embedded in the token
    const decoded = jwt.verify(token, jwtSecret);

    // Attach the decoded user info to the request object
    // Controllers can now access req.user.user_id, req.user.role, etc.
    req.user = decoded;

    // Token is valid — continue to the next middleware or route handler
    next();
  } catch (error) {
    console.error('Token verify error:', error.message);
    return res.status(401).json({ message: "Token is not valid" });
  }
};

/**
 * enforceSubsystem middleware
 *
 * Checks that the logged-in user belongs to the expected subsystem.
 * For example, only users with subsystem = 'Admin' can access Admin routes.
 * This prevents a Patient subsystem user from accessing Admin pages.
 *
 * @param {string} expectedSubsystem - The subsystem name to check (e.g., 'Admin')
 */
const enforceSubsystem = (expectedSubsystem) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });

    if (req.user.subsystem !== expectedSubsystem) {
      return res.status(403).json({ message: "Access denied: wrong subsystem" });
    }

    next();
  };
};

/**
 * authorize middleware
 *
 * Checks that the logged-in user has one of the allowed roles.
 * Looks up the user's role from the database to get the current role name.
 *
 * @param {...string} allowedRoles - One or more role names that are permitted
 */
const authorize = (...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });

    const role = await Role.findByPk(req.user.role_id);
    if (!role || !allowedRoles.includes(role.name)) {
      return res.status(403).json({ message: "Access denied. Role not permitted." });
    }

    next();
  };
};

/**
 * requirePermission middleware
 *
 * Checks that the logged-in user has a specific permission action.
 * Permissions are: 'Create', 'View', 'Patch', 'Delete'
 *
 * These map to HTTP operations:
 *   Create → POST (creating new records)
 *   View   → GET  (reading records)
 *   Patch  → PATCH / DELETE (editing or deactivating records)
 *
 * Admin and Super Admin roles bypass this check — they always have full access.
 *
 * @param {string} requiredPermission - The permission action needed (e.g., 'View')
 */
const requirePermission = (requiredPermission) => {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

    try {
      // Look up the user's role AND its associated permissions from the database
      const role = await Role.findByPk(req.user.role_id, {
        include: [{
          model: Permission,
          through: { attributes: [] },
          attributes: ['action']
        }]
      });

      if (!role) return res.status(403).json({ message: 'Access denied. Role not found.' });

      // Admin and Super Admin have full access — skip the permission check
      if (role.name === 'Admin' || role.name === 'Super Admin') return next();

      // Use permissions from the JWT token if available (faster — no extra DB query)
      // Fall back to permissions loaded from the database
      const userPermissions = req.user.permissions && req.user.permissions.length > 0
        ? req.user.permissions
        : (role.Permissions || []).map(p => p.action);

      // Normalize to lowercase so 'View' and 'view' both match
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
