const jwt = require('jsonwebtoken');
const { ROLE_PERMISSIONS } = require('../config/roles');

/**
 * Verify JWT token and attach user to request
 */
const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) return res.status(401).json({ message: "No token, access denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Adds user info to the request
    next();
  } catch (error) {
    res.status(401).json({ message: "Token is not valid" });
  }
};

/**
 * Role-based authorization middleware
 * @param {string[]} allowedRoles - Array of roles allowed to access the route
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: "Access denied. You do not have permission to perform this action." 
      });
    }

    next();
  };
};

/**
 * Permission-based authorization middleware
 * @param {string} requiredPermission - The permission required to access the route
 */
const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userPermissions = ROLE_PERMISSIONS[req.user.role] || [];

    if (!userPermissions.includes(requiredPermission)) {
      return res.status(403).json({ 
        message: "Access denied. Insufficient permissions." 
      });
    }

    next();
  };
};

module.exports = { protect, authorize, requirePermission };
