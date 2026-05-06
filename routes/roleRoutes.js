const express = require('express');
const router = express.Router();
const { 
  getRoles, 
  getRolePermissions, 
  createRole,
  updateRole,
  assignRole, 
  getUserPermissions 
} = require('../controllers/roleController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// Any authenticated user with View permission can read roles
router.get('/', requirePermission('View'), getRoles);
// Specific routes must come before parameterized ones to avoid conflicts
router.get('/user/:userId/permissions', requirePermission('View'), getUserPermissions);
router.get('/:roleId/permissions', requirePermission('View'), getRolePermissions);

// Create/update require Create/Patch permissions
router.post('/', requirePermission('Create'), createRole);
router.patch('/:id', requirePermission('Patch'), updateRole);
router.post('/assign/:userId', requirePermission('Patch'), assignRole);

module.exports = router;
