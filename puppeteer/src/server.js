import express from 'express';
import cors from 'cors';
import config from '../config/index.js';
import { logger } from '#utils/logger.js';
import FileHelpers from '#utils/fileHelpers.js';
import searchRoutes from '../routes/searchRoutes.js';
import healAndRestoreRoutes from '../routes/healAndRestore.js';
import profileInitRoutes from '../routes/profileInitRoutes.js';
import linkedinInteractionRoutes from '../routes/linkedinInteractionRoutes.js';
import ConfigInitializer from './shared/config/configInitializer.js';

const app = express();

// CORS configuration - Secure origin validation
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin only in development (Postman, curl, etc.)
    if (!origin) {
      if (config.nodeEnv === 'development') {
        return callback(null, true);
      }
      logger.warn('CORS: Rejecting request with no origin in production');
      return callback(new Error('Origin header required'));
    }

    // Get configured origins from env
    const allowedOrigins = config.frontendUrls || [];

    // In development, allow localhost/127.0.0.1 with proper hostname validation
    if (config.nodeEnv === 'development') {
      try {
        const originUrl = new URL(origin);
        const hostname = originUrl.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          logger.debug(`CORS: Allowing development origin: ${origin}`);
          return callback(null, true);
        }
      } catch {
        logger.warn(`CORS: Invalid origin URL format: ${origin}`);
        return callback(new Error('Invalid origin format'));
      }
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      logger.debug(`CORS: Allowing configured origin: ${origin}`);
      return callback(null, true);
    }

    // Reject all other origins
    logger.warn(`CORS: Rejecting origin: ${origin}`);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  methods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204 // Some legacy browsers (IE11) choke on 204
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
// Mount search routes under /search to match frontend expectations
app.use('/search', searchRoutes);
app.use('/heal-restore', healAndRestoreRoutes);
app.use('/profile-init', profileInitRoutes);
app.use('/linkedin-interactions', linkedinInteractionRoutes);

// Health check endpoint with configuration status
app.get('/health', (req, res) => {
  try {
    const configStatus = ConfigInitializer.getInitializationStatus();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
      configuration: {
        initialized: configStatus.initialized,
        valid: configStatus.configurationValid,
        featuresEnabled: configStatus.featuresEnabled,
        healthStatus: configStatus.healthStatus
      },
      memory: process.memoryUsage(),
      version: process.version
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Configuration status endpoint
app.get('/config/status', (req, res) => {
  try {
    const report = ConfigInitializer.generateConfigurationReport();
    res.json(report);
  } catch (error) {
    logger.error('Configuration status check failed:', error);
    res.status(500).json({
      error: 'Failed to generate configuration report',
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((error, req, res, _next) => {
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
    
    // Initialize LinkedIn interaction configuration system
    logger.info('Initializing LinkedIn interaction configuration...');
    const configInitialized = await ConfigInitializer.initialize();
    
    if (!configInitialized) {
      logger.error('Failed to initialize LinkedIn interaction configuration');
      if (config.nodeEnv === 'production') {
        process.exit(1);
      }
    }

    app.listen(config.port, () => {
      logger.info(`🚀 LinkedIn Advanced Search Backend started`, {
        port: config.port,
        nodeEnv: config.nodeEnv,
        frontendUrls: config.frontendUrls,
        hasGoogleAI: !!config.googleAI.apiKey,
        linkedinInteractionsConfigured: configInitialized,
        linkedinTestingMode: config.linkedin.testingMode,
        linkedinBaseUrl: config.linkedin.baseUrl
      });

      if (config.linkedin.testingMode) {
        logger.warn(`🧪 TESTING MODE ENABLED - Using mock LinkedIn at ${config.linkedin.baseUrl}`);
      }

      logger.info('📋 Available endpoints:');
      logger.info(`  POST http://localhost:${config.port}/search           - Perform LinkedIn search`);
      logger.info(`  GET  http://localhost:${config.port}/search/results   - Get stored results`);
      logger.info(`  GET  http://localhost:${config.port}/search/health    - Search route health check`);
      logger.info(`  GET  http://localhost:${config.port}/heal-restore/status - Check heal & restore status`);
      logger.info(`  POST http://localhost:${config.port}/heal-restore/authorize - Authorize heal & restore`);
      logger.info(`  POST http://localhost:${config.port}/profile-init - Initialize LinkedIn profile database`);
      logger.info(`  POST http://localhost:${config.port}/linkedin-interactions/send-message - Send LinkedIn message`);
      logger.info(`  POST http://localhost:${config.port}/linkedin-interactions/add-connection - Send connection request`);
      logger.info(`  POST http://localhost:${config.port}/linkedin-interactions/create-post - Create LinkedIn post`);
      logger.info(`  GET  http://localhost:${config.port}/linkedin-interactions/session-status - Get session status`);
      logger.info(`  GET  http://localhost:${config.port}/profile-init/health - Profile init health check`);
      logger.info(`  POST http://localhost:${config.port}/linkedin-interactions/send-message - Send LinkedIn message`);
      logger.info(`  POST http://localhost:${config.port}/linkedin-interactions/add-connection - Add LinkedIn connection`);
      logger.info(`  POST http://localhost:${config.port}/linkedin-interactions/create-post - Create LinkedIn post`);
      logger.info(`  POST http://localhost:${config.port}/linkedin-interactions/generate-personalized-message - Generate personalized message`);
      logger.info(`  GET  http://localhost:${config.port}/linkedin-interactions/session-status - Get session status`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();