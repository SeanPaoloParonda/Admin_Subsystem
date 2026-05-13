// ── What this file does ──────────────────────────────────────────────────────
// This is the main entry point of the backend server.
// It sets up the Express web server, applies security settings,
// connects all the route files, and starts listening for incoming requests.
// Think of this file as the "front door" of the entire backend application.
// ─────────────────────────────────────────────────────────────────────────────

// Express is the web framework that handles incoming HTTP requests (GET, POST, etc.)
const express = require('express');

// 'path' is a built-in Node.js module for working with file and folder paths
const path = require('path');

// Our database connection — this is the Sequelize instance connected to PostgreSQL
const sequelize = require('./config/db');

// CORS (Cross-Origin Resource Sharing) controls which websites are allowed
// to make requests to this server. Without it, browsers block cross-origin requests.
const cors = require('cors');

// Helmet adds security-related HTTP headers automatically.
// It helps protect against common web vulnerabilities like clickjacking and XSS.
const helmet = require('helmet');

// express-rate-limit prevents abuse by limiting how many requests
// a single IP address can make in a given time window.
const rateLimit = require('express-rate-limit');

// Load environment variables from the .env file into process.env
// (e.g., DATABASE_URL, JWT_SECRET, PORT)
require('dotenv').config();

// ── Route files ───────────────────────────────────────────────────────────────
// Each route file groups related API endpoints together.
// For example, authRoutes handles /login, /logout, /refresh, etc.
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const auditRoutes = require('./routes/auditRoutes');
const referenceRoutes = require('./routes/referenceRoutes');
const adminRoutes = require('./routes/adminRoutes');

// ── Model imports and associations ───────────────────────────────────────────
// We import the models here so we can define how they relate to each other.
// Sequelize needs these relationships defined before it can do JOIN queries.
const Role = require('./models/role');
const Permission = require('./models/permission');
const RolePermission = require('./models/rolePermission');

// A Role can have many Permissions, and a Permission can belong to many Roles.
// This is a "many-to-many" relationship, linked through the RolePermission join table.
Role.belongsToMany(Permission, { through: RolePermission, foreignKey: 'role_id', otherKey: 'permission_id' });
Permission.belongsToMany(Role, { through: RolePermission, foreignKey: 'permission_id', otherKey: 'role_id' });

// Import the middleware functions we use to protect routes
// protect: checks the user has a valid login token
// enforceSubsystem: checks the user belongs to the correct subsystem (e.g., 'Admin')
const { protect, enforceSubsystem } = require('./middleware/authMiddleware');

// Create the Express application instance
const app = express();

// Apply Helmet security headers to every response
app.use(helmet());

// ── CORS configuration ────────────────────────────────────────────────────────
// Only allow requests from known frontend origins.
// ALLOWED_ORIGINS can be set in .env as a comma-separated list.
// If not set, defaults to localhost development addresses.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., mobile apps, curl, server-to-server calls)
    // and requests from our known allowed origins
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  // credentials: true allows cookies and Authorization headers to be sent cross-origin
  credentials: true
}));

// Parse incoming JSON request bodies so we can read req.body in controllers
app.use(express.json());

// Trust the first proxy in front of this server (e.g., Nginx, Heroku router).
// This is needed so req.ip returns the real client IP, not the proxy's IP.
app.set('trust proxy', 1);

// ── Rate limiting ─────────────────────────────────────────────────────────────
// In development, limits are relaxed so testing isn't blocked.
// In production, stricter limits protect against brute-force attacks.
const isDevelopment = process.env.NODE_ENV !== 'production';

const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });

// Login limiter — skipSuccessfulRequests means successful logins don't count
const adminLoginLimiter = rateLimit({
  windowMs: isDevelopment ? 60 * 1000 : 5 * 60 * 1000,
  max: isDevelopment ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    message: isDevelopment
      ? 'Too many login attempts. Please try again in 1 minute.'
      : 'Too many login attempts. Please try again in 5 minutes.'
  }
});

const subsystemLoginLimiter = rateLimit({
  windowMs: isDevelopment ? 60 * 1000 : 5 * 60 * 1000,
  max: isDevelopment ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    message: isDevelopment
      ? 'Too many subsystem login attempts. Please try again in 1 minute.'
      : 'Too many subsystem login attempts. Please try again in 5 minutes.'
  }
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many session refresh attempts.' }
});

// Only apply rate limiting in production — dev mode is unrestricted
if (!isDevelopment) {
  app.use(generalLimiter);
  app.use('/admin/api/auth/login', adminLoginLimiter);
  app.use('/admin/api/auth/refresh', refreshLimiter);
  app.use('/admin/api/auth/subsystem-login', subsystemLoginLimiter);
}

// ── Subsystem-facing public endpoints ────────────────────────────────────────
// These endpoints are used by OTHER subsystems (e.g., Billing, Staff Management)
// to read data from the Admin subsystem without a user JWT.
// Instead of a JWT, they authenticate using a shared X-Subsystem-Key header.
// These MUST be registered BEFORE the adminRoutes catch-all below.

// Billing subsystem: read the full service catalog
app.get('/admin/api/subsystem/services', async (req, res) => {
  // Verify the subsystem API key before allowing access
  const providedKey = req.headers['x-subsystem-key'];
  const expectedKey = process.env.SUBSYSTEM_API_KEY;
  if (!expectedKey || providedKey !== expectedKey) {
    return res.status(401).json({ message: 'Invalid or missing subsystem key' });
  }
  // Delegate to the reference controller to fetch all services
  return require('./controllers/referenceController').getAllServices(req, res);
});

// Billing subsystem: read a single service by its ID
app.get('/admin/api/subsystem/services/:id', async (req, res) => {
  const providedKey = req.headers['x-subsystem-key'];
  const expectedKey = process.env.SUBSYSTEM_API_KEY;
  if (!expectedKey || providedKey !== expectedKey) {
    return res.status(401).json({ message: 'Invalid or missing subsystem key' });
  }
  return require('./controllers/referenceController').getServiceById(req, res);
});

// Staff Management subsystem: read all users (optionally filtered by subsystem)
app.get('/admin/api/subsystem/users', async (req, res) => {
  const providedKey = req.headers['x-subsystem-key'];
  const expectedKey = process.env.SUBSYSTEM_API_KEY;
  if (!expectedKey || providedKey !== expectedKey) {
    return res.status(401).json({ message: 'Invalid or missing subsystem key' });
  }

  // Optional query parameter: ?subsystem=Staff — if omitted, returns all users
  const { subsystem } = req.query;

  try {
    const User = require('./models/user');
    const Role = require('./models/role');

    // Fetch users and include their role info.
    // If a subsystem filter is provided, only return users whose role belongs to that subsystem.
    const users = await User.findAll({
      include: [{
        model: Role,
        attributes: ['role_id', 'name', 'subsystem'],
        ...(subsystem ? { where: { subsystem } } : {})
      }],
      // Never return the password hash — exclude it from all responses
      attributes: { exclude: ['pwd_hash'] },
      order: [['created_at', 'DESC']]
    });
    return res.json({ users });
  } catch (err) {
    console.error('Subsystem GET users error:', err);
    return res.status(500).json({ message: 'Server error fetching users' });
  }
});

// Staff Management subsystem: assign a staff_id to a user
// This is called when Staff Management links an admin user to a staff record
app.patch('/admin/api/subsystem/users/:userId/staff-id', async (req, res) => {
  const providedKey = req.headers['x-subsystem-key'];
  const expectedKey = process.env.SUBSYSTEM_API_KEY;
  if (!expectedKey || providedKey !== expectedKey) {
    return res.status(401).json({ message: 'Invalid or missing subsystem key' });
  }

  const { userId } = req.params;
  const { staff_id } = req.body;

  // staff_id must be present in the request body (can be null to clear it)
  if (staff_id === undefined || staff_id === null) {
    return res.status(400).json({ message: 'staff_id is required' });
  }

  try {
    const User = require('./models/user');

    // Find the user we want to update
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Make sure the staff_id isn't already assigned to a different user
    if (staff_id) {
      const existing = await User.findOne({ where: { staff_id } });
      if (existing && existing.user_id !== userId) {
        return res.status(409).json({ message: 'staff_id is already assigned to another user' });
      }
    }

    // Save the staff_id (or clear it if null/empty was passed)
    await user.update({ staff_id: staff_id || null });
    return res.json({
      message: 'staff_id updated successfully',
      user: {
        user_id:  user.user_id,
        username: user.username,
        staff_id: user.staff_id
      }
    });
  } catch (err) {
    console.error('Subsystem PATCH staff_id error:', err);
    return res.status(500).json({ message: 'Server error updating staff_id' });
  }
});

// ── Route mounting ────────────────────────────────────────────────────────────
// Each route group is mounted at a specific URL prefix.
// All API routes start with /admin/api/ to distinguish them from frontend routes.

// Auth routes (login, logout, token refresh) — no authentication required here
app.use('/admin/api/auth', authRoutes);

// User management routes — require a valid JWT AND the user must belong to the Admin subsystem
app.use('/admin/api/users', protect, enforceSubsystem('Admin'), userRoutes);

// Role management routes — same protection as users
app.use('/admin/api/roles', protect, enforceSubsystem('Admin'), roleRoutes);

// Audit routes — the /ingest endpoint is public (uses X-Subsystem-Key),
// all other audit routes are protected inside the router itself
app.use('/admin/api/audit', auditRoutes);

// Reference data (service catalog) routes — require JWT + Admin subsystem
app.use('/admin/api/reference', protect, enforceSubsystem('Admin'), referenceRoutes);

// Admin dashboard routes (stats, activities, alerts) — protected inside the router
app.use('/admin/api', adminRoutes);

// ── Frontend serving ──────────────────────────────────────────────────────────
// Serve the compiled React frontend files from the frontend/build folder.
// This makes the backend also serve the frontend in production.
const frontendPath = path.join(__dirname, 'frontend/build');
app.use(express.static(frontendPath));

// For any URL that doesn't match an API route, send back the React app's index.html.
// This allows React Router to handle client-side navigation (e.g., /users, /roles).
// This MUST come after all API routes so API calls are not intercepted.
app.use((_req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Health check endpoint — a simple way to verify the server is running
app.get('/admin/health', (req, res) => res.json({ status: 'ok', message: 'Admin Subsystem is running' }));

// ── Database connection ───────────────────────────────────────────────────────
// Test the database connection when the server starts.
// authenticate() just sends a test query to confirm the connection works.
sequelize.authenticate()
  .then(() => console.log('✅ Connected to Supabase'))
  .catch(err => console.error('❌ Connection error:', err));

// ── Start the server ──────────────────────────────────────────────────────────
// Listen on the PORT from .env, or default to 5000 if not set.
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Admin Hub running on port ${PORT}`));
