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

// Serve frontend build files (works in both dev and production)
const frontendPath = path.join(__dirname, 'frontend/build');
app.use(express.static(frontendPath));

// Handle React routing - serve index.html for all non-API routes
app.use((req, res, next) => {
  if (!req.path.startsWith('/admin/api') && !req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  } else {
    next();
  }
});

app.set('trust proxy', 1);

// Rate limiting
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

app.use(generalLimiter);
app.use('/admin/api/auth/login', authLimiter);
app.use('/admin/api/auth/refresh', authLimiter);
app.use('/admin/api/auth/subsystem-login', authLimiter);

// Routes
app.use('/admin/api/auth', authRoutes);
app.use('/admin/api/users', protect, enforceSubsystem('Admin'), userRoutes);
app.use('/admin/api/roles', protect, enforceSubsystem('Admin'), roleRoutes);
// Audit ingest (/admin/api/audit/ingest) is public — uses X-Subsystem-Key, not JWT
// All other audit routes are protected by the router itself
app.use('/admin/api/audit', auditRoutes);
app.use('/admin/api/reference', protect, enforceSubsystem('Admin'), referenceRoutes);
app.use('/admin/api', adminRoutes);

// Health check
app.get('/admin/health', (req, res) => res.json({ status: 'ok', message: 'Admin Subsystem is running' }));

// DB connection
sequelize.authenticate()
  .then(() => console.log('✅ Connected to Supabase'))
  .catch(err => console.error('❌ Connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Admin Hub running on port ${PORT}`));
