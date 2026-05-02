const express = require('express');
const router = express.Router();
const { 
  getAllServices, 
  getServiceById, 
  createService, 
  updateService, 
  deleteService 
} = require('../controllers/referenceController');
const { protect, enforceSubsystem, requirePermission } = require('../middleware/authMiddleware');

// All routes require authentication + Admin subsystem enforcement
router.use(protect);
router.use(enforceSubsystem('Admin'));

// Any authenticated user with the right permission can access
router.get('/', requirePermission('View'), getAllServices);
router.get('/:id', requirePermission('View'), getServiceById);
router.post('/', requirePermission('Create'), createService);
router.patch('/:id', requirePermission('Patch'), updateService);
router.patch('/:id/deactivate', requirePermission('Patch'), deleteService);

module.exports = router;
