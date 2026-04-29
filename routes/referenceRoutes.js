const express = require('express');
const router = express.Router();
const { 
  getAllServices, 
  getServiceById, 
  createService, 
  updateService, 
  deleteService 
} = require('../controllers/referenceController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// Reference data routes (Super Admin only for CRUD)
router.get('/', getAllServices);
router.get('/:id', getServiceById);
router.post('/', authorize('Super Admin'), createService);
router.put('/:id', authorize('Super Admin'), updateService);
router.delete('/:id', authorize('Super Admin'), deleteService);

module.exports = router;