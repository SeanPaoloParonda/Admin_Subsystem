const express = require('express');
const path = require('path');
const sequelize = require('./config/db');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const auditRoutes = require('./routes/auditRoutes');
const referenceRoutes = require('./routes/referenceRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Import models and establish associations
const Role = require('./models/role');
const Permission = require('./models/permission');
const RolePermission = require('./models/rolePermission');

Role.belongsToMany(Permission, { through: RolePermission, foreignKey: 'role_id', otherKey: 'permission_id' });
Permission.belongsToMany(Role, { through: RolePermission, foreignKey: 'permission_id', otherKey: 'role_id' });

// ✅ Import middleware functions properly
const { protect, enforceSubsystem } = require('./middleware/authMiddleware');

const app = express();
app.use(helmet());

// CORS — restrict to known origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());

app.set('trust proxy', 1);

// Rate limiting
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

app.use(generalLimiter);
app.use('/admin/api/auth/login', authLimiter);
app.use('/admin/api/auth/refresh', authLimiter);
app.use('/admin/api/auth/subsystem-login', authLimiter);

// ── Subsystem-facing public endpoints (X-Subsystem-Key auth only) ──────────
// Must be mounted BEFORE adminRoutes to avoid the /admin/api prefix catch-all

// Billing — read service catalog
app.get('/admin/api/subsystem/services', async (req, res) => {
  const providedKey = req.headers['x-subsystem-key'];
  const expectedKey = process.env.SUBSYSTEM_API_KEY;
  if (!expectedKey || providedKey !== expectedKey) {
    return res.status(401).json({ message: 'Invalid or missing subsystem key' });
  }
  return require('./controllers/referenceController').getAllServices(req, res);
});

app.get('/admin/api/subsystem/services/:id', async (req, res) => {
  const providedKey = req.headers['x-subsystem-key'];
  const expectedKey = process.env.SUBSYSTEM_API_KEY;
  if (!expectedKey || providedKey !== expectedKey) {
    return res.status(401).json({ message: 'Invalid or missing subsystem key' });
  }
  return require('./controllers/referenceController').getServiceById(req, res);
});

// Staff Management — GET users for their subsystem + PATCH staff_id
app.get('/admin/api/subsystem/users', async (req, res) => {
  const providedKey = req.headers['x-subsystem-key'];
  const expectedKey = process.env.SUBSYSTEM_API_KEY;
  if (!expectedKey || providedKey !== expectedKey) {
    return res.status(401).json({ message: 'Invalid or missing subsystem key' });
  }

  // subsystem must be declared in query: ?subsystem=Staff
  const { subsystem } = req.query;
  if (!subsystem) {
    return res.status(400).json({ message: 'subsystem query param is required' });
  }

  try {
    const User = require('./models/user');
    const Role = require('./models/role');
    const users = await User.findAll({
      include: [{
        model: Role,
        attributes: ['role_id', 'name', 'subsystem'],
        where: { subsystem }   // only users whose role belongs to this subsystem
      }],
      attributes: { exclude: ['pwd_hash'] },
      order: [['created_at', 'DESC']]
    });
    return res.json({ users });
  } catch (err) {
    console.error('Subsystem GET users error:', err);
    return res.status(500).json({ message: 'Server error fetching users' });
  }
});

app.patch('/admin/api/subsystem/users/:userId/staff-id', async (req, res) => {
  const providedKey = req.headers['x-subsystem-key'];
  const expectedKey = process.env.SUBSYSTEM_API_KEY;
  if (!expectedKey || providedKey !== expectedKey) {
    return res.status(401).json({ message: 'Invalid or missing subsystem key' });
  }

  const { userId } = req.params;
  const { staff_id, subsystem } = req.body;

  if (!subsystem) {
    return res.status(400).json({ message: 'subsystem is required in the request body' });
  }
  if (staff_id === undefined || staff_id === null) {
    return res.status(400).json({ message: 'staff_id is required' });
  }

  try {
    const User = require('./models/user');
    const Role = require('./models/role');

    const user = await User.findByPk(userId, {
      include: [{ model: Role, attributes: ['subsystem'] }]
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Enforce subsystem boundary — Staff can only update users in their own subsystem
    if (user.Role?.subsystem !== subsystem) {
      return res.status(403).json({ message: 'Access denied: user does not belong to your subsystem' });
    }

    // Check staff_id uniqueness
    if (staff_id) {
      const existing = await User.findOne({ where: { staff_id } });
      if (existing && existing.user_id !== userId) {
        return res.status(409).json({ message: 'staff_id is already assigned to another user' });
      }
    }

    await user.update({ staff_id: staff_id || null });
    return res.json({
      message: 'staff_id updated successfully',
      user: {
        user_id: user.user_id,
        username: user.username,
        staff_id: user.staff_id
      }
    });
  } catch (err) {
    console.error('Subsystem PATCH staff_id error:', err);
    return res.status(500).json({ message: 'Server error updating staff_id' });
  }
});

// Routes
app.use('/admin/api/auth', authRoutes);
app.use('/admin/api/users', protect, enforceSubsystem('Admin'), userRoutes);
app.use('/admin/api/roles', protect, enforceSubsystem('Admin'), roleRoutes);
// Audit ingest (/admin/api/audit/ingest) is public — uses X-Subsystem-Key, not JWT
// All other audit routes are protected by the router itself
app.use('/admin/api/audit', auditRoutes);
app.use('/admin/api/reference', protect, enforceSubsystem('Admin'), referenceRoutes);
app.use('/admin/api', adminRoutes);

// Serve frontend build files (works in both dev and production)
const frontendPath = path.join(__dirname, 'frontend/build');
app.use(express.static(frontendPath));

// Handle React routing - serve index.html for all non-API routes (must be after API routes)
app.use((_req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Health check
app.get('/admin/health', (req, res) => res.json({ status: 'ok', message: 'Admin Subsystem is running' }));

// DB connection
sequelize.authenticate()
  .then(() => console.log('✅ Connected to Supabase'))
  .catch(err => console.error('❌ Connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Admin Hub running on port ${PORT}`));
