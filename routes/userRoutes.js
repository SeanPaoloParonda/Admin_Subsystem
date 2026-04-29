const express = require('express');
const router = express.Router();
const { 
  getAllUsers, 
  getUserById, 
  createUser, 
  updateUser, 
  deleteUser,
  changePassword 
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// Admin and Super Admin only routes
router.post('/', authorize('Admin', 'Super Admin'), createUser);
router.put('/:id', authorize('Admin', 'Super Admin'), updateUser);
router.delete('/:id', authorize('Admin', 'Super Admin'), deleteUser);
router.post('/:id/change-password', authorize('Admin', 'Super Admin'), changePassword);

// Admin and Super Admin can view users
router.get('/', authorize('Admin', 'Super Admin'), getAllUsers);
router.get('/:id', authorize('Admin', 'Super Admin'), getUserById);

module.exports = router;