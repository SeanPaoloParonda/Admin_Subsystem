const express = require('express');
const sequelize = require('./config/db');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import models
const User = require('./models/user');
const AuditLog = require('./models/auditLog');
const ReferenceData = require('./models/referenceData');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const auditRoutes = require('./routes/auditRoutes');
const referenceRoutes = require('./routes/referenceRoutes');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { message: 'Too many requests, please try again later.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many authentication attempts, please try again later.' }
});

app.use(generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/refresh', authLimiter);

app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/reference', referenceRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Admin Subsystem is running' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Admin Subsystem',
    version: '1.0.0',
    description: 'Healthcare Management System - Admin Subsystem',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      roles: '/api/roles',
      audit: '/api/audit',
      reference: '/api/reference'
    },
    health: '/api/health'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;
  res.status(statusCode).json({ message });
});

// Sync Database
sequelize.sync({ alter: true })
  .then(() => console.log('✅ PostgreSQL Synced'))
  .catch(err => console.log('❌ Error: ' + err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Admin Hub running on port ${PORT}`));
