// Express app setup
// 1. cors(), express.json() middleware
// 2. Mount routes: /api/canvas, /api/tasks, /api/nodes, /api/auth
// 3. Mount auth middleware globally (verify JWT on protected routes)
// 4. Error handler at bottom

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const canvasRoutes = require('./routes/canvas');
const nodesRoutes = require('./routes/nodes');
const tasksRoutes = require('./routes/tasks');
const roomsRoutes = require('./routes/rooms');
const workspacesRoutes = require('./routes/workspaces');
const sharingRoutes = require('./routes/sharing');
const aiRoutes = require('./routes/ai');
const { AppError } = require('./utils/errors');

const app = express();

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000', 'http://localhost:3001'];

console.log('🔒 CORS Configuration:');
console.log('   Allowed Origins:', allowedOrigins);
console.log('   Environment:', process.env.NODE_ENV || 'development');
console.log('   ALLOWED_ORIGINS env:', process.env.ALLOWED_ORIGINS);

// More permissive CORS configuration for production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman, server-side)
    if (!origin) {
      console.log('✅ CORS: Allowing request with no origin');
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      console.log(`✅ CORS: Allowing origin: ${origin}`);
      return callback(null, true);
    }
    
    // Log blocked origin but don't throw error - just deny
    console.warn(`❌ CORS: Blocked origin: ${origin}`);
    console.warn(`   Allowed origins are: ${allowedOrigins.join(', ')}`);
    
    // Return false instead of error to avoid breaking the request
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

app.use(express.json());

const authLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000),
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000),
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 1000), // Increased for development
  keyGenerator: (req) => req.user?.id || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development', // Skip rate limiting in development
});

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api', apiLimiter);
app.use('/api/workspaces', workspacesRoutes);
app.use('/api/canvas', canvasRoutes);
app.use('/api/nodes', nodesRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/rooms', aiRoutes); // AI summary routes
app.use('/api/rooms', sharingRoutes);
app.use('/api/share', sharingRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  // Handle structured AppError instances
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      timestamp: err.timestamp,
      ...(err.errors && { errors: err.errors }), // Include validation errors if present
      ...(err.context && { context: err.context }), // Include RBAC context if present
    });
  }

  // Handle unexpected errors
  console.error('Unexpected error:', err);
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

module.exports = app;
