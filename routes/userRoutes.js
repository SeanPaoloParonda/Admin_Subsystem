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
const { protect, requirePermission } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

router.get('/me', async (req, res) => {
  try {
    const User = require('../models/user');
    const user = await User.findByPk(req.user.user_id, {
      attributes: ['user_id', 'username', 'role_id', 'status']
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

// Any authenticated user with Create permission can create users
router.post('/', requirePermission('Create'), createUser);
// Any authenticated user with Patch permission can update/deactivate
router.patch('/:id', requirePermission('Patch'), updateUser);
router.delete('/:id', requirePermission('Patch'), deleteUser);
router.post('/:id/change-password', requirePermission('Patch'), changePassword);

// Any authenticated user with View permission can read users
router.get('/', requirePermission('View'), getAllUsers);
router.get('/:id', requirePermission('View'), getUserById);

module.exports = router;