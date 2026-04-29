const express = require('express');
const router = express.Router();
const { 
  getRoles, 
  getRolePermissions, 
  assignRole, 
  getUserPermissions 
} = require('../controllers/roleController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// Get all roles (Admin+)
router.get('/', authorize('Admin', 'Super Admin'), getRoles);

// Get permissions for a specific role
router.get('/:role/permissions', authorize('Admin', 'Super Admin'), getRolePermissions);

// Get user permissions
router.get('/user/:userId/permissions', authorize('Admin', 'Super Admin'), getUserPermissions);

// Assign role to user (Admin+)
router.post('/assign/:userId', authorize('Admin', 'Super Admin'), assignRole);

module.exports = router;