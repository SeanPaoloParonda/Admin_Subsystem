const express = require('express');
const router = express.Router();
const { 
  getAllLogs, 
  getLogById, 
  getUserLogs, 
  getRecentActivity, 
  exportLogs 
} = require('../controllers/auditController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// Admin and Super Admin can view audit logs
router.get('/', authorize('Admin', 'Super Admin'), getAllLogs);
router.get('/export', authorize('Admin', 'Super Admin'), exportLogs);
router.get('/recent', authorize('Admin', 'Super Admin'), getRecentActivity);
router.get('/user/:userId', authorize('Admin', 'Super Admin'), getUserLogs);
router.get('/:id', authorize('Admin', 'Super Admin'), getLogById);

module.exports = router;
