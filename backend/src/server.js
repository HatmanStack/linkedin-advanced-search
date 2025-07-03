import express from 'express';
import cors from 'cors';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import FileHelpers from '../utils/fileHelpers.js';
import searchRoutes from '../routes/searchRoutes.js';
import healAndRestoreRoutes from '../routes/healAndRestore.js';

const app = express();

// CORS configuration
app.use(cors({
  origin: config.frontendUrls,
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

// Body parser middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.method === 'POST' ? '[BODY REDACTED]' : undefined
  });
  next();
});

// Routes
app.use('/', searchRoutes);
app.use('/heal-restore', healAndRestoreRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Initialize required directories
async function initializeDirectories() {
  try {
    await FileHelpers.ensureDirectoryExists('logs');
    await FileHelpers.ensureDirectoryExists('data');
    await FileHelpers.ensureDirectoryExists(config.paths.screenshots);
    logger.info('Required directories initialized');
  } catch (error) {
    logger.error('Failed to initialize directories:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    await initializeDirectories();
    
    app.listen(config.port, () => {
      logger.info(`🚀 LinkedIn Advanced Search Backend started`, {
        port: config.port,
        nodeEnv: config.nodeEnv,
        frontendUrls: config.frontendUrls,
        hasGoogleAI: !!config.googleAI.apiKey
      });
      
      logger.info('📋 Available endpoints:');
      logger.info(`  POST http://localhost:${config.port}/          - Perform LinkedIn search`);
      logger.info(`  GET  http://localhost:${config.port}/results   - Get stored results`);
      logger.info(`  GET  http://localhost:${config.port}/health    - Health check`);
      logger.info(`  GET  http://localhost:${config.port}/heal-restore/status - Check heal & restore status`);
      logger.info(`  POST http://localhost:${config.port}/heal-restore/authorize - Authorize heal & restore`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();