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
router.get('/:role/permissions', requirePermission('View'), getRolePermissions);
router.get('/user/:userId/permissions', requirePermission('View'), getUserPermissions);

// Create/update require Create/Patch permissions
router.post('/', requirePermission('Create'), createRole);
router.patch('/:id', requirePermission('Patch'), updateRole);
router.post('/assign/:userId', requirePermission('Patch'), assignRole);

module.exports = router;
