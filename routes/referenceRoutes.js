const express = require('express');
const router = express.Router();
const { 
  getAllServices, 
  getServiceById, 
  createService, 
  updateService, 
  deleteService 
} = require('../controllers/referenceController');
const { requirePermission } = require('../middleware/authMiddleware');

// Note: protect + enforceSubsystem('Admin') are already applied in server.js when mounting this router

// Any authenticated user with the right permission can access
router.get('/', requirePermission('View'), getAllServices);
router.get('/:id', requirePermission('View'), getServiceById);
router.post('/', requirePermission('Create'), createService);
router.patch('/:id', requirePermission('Patch'), updateService);
router.patch('/:id/deactivate', requirePermission('Patch'), deleteService);

module.exports = router;
