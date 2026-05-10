const express = require('express');
const router = express.Router();
const AuditLog = require('../models/auditLog');
const User = require('../models/user');
const Role = require('../models/role');
const Alert = require('../models/alert');
const { protect, enforceSubsystem } = require('../middleware/authMiddleware');

// Set up association here so the join works in this router
// (AuditLog no longer declares it globally to avoid FK constraint issues)
if (!AuditLog.associations.user) {
  AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
}

// All admin routes require authentication + subsystem enforcement
router.use(protect);
router.use(enforceSubsystem('Admin'));

router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { status: 'active' } });
    const rolesDefined = await Role.count();
    const auditEvents = await AuditLog.count();

    res.json({ totalUsers, activeUsers, rolesDefined, auditEvents });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

// Activities
router.get('/activities', async (req, res) => {
  try {
    const logs = await AuditLog.findAll({
      limit: 10,
      order: [['created_at', 'DESC']],
      include: [{
        model: User,
        as: 'user',
        attributes: ['username']
      }]
    });
    const transformedLogs = logs.map(log => ({
      log_id: log.log_id,
      user_id: log.user_id,
      username: log.user ? log.user.username : null,
      action_type: log.action_type,
      created_at: log.created_at
    }));
    res.json(transformedLogs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch activities' });
  }
});

// Alerts
router.get('/alerts', async (req, res) => {
  try {
    const alerts = await Alert.findAll({
      limit: 5,
      order: [['created_at', 'DESC']],
      where: {
        action_type: ['LOGIN_FAILED', 'UNAUTHORIZED_ACCESS']
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['username']
      }]
    });

    const transformedAlerts = alerts.map(alert => ({
      alert_id: alert.alert_id,
      message: alert.message,
      type: alert.type || 'warning',
      ip_addr: alert.ip_addr,
      username: alert.user ? alert.user.username : null,
      created_at: alert.created_at
    }));

    res.json(transformedAlerts);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch alerts' });
  }
});

module.exports = router;
