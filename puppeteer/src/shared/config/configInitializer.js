import { logger } from './logger.js';
import { ConfigManager } from './configManager.js';
import ConfigValidator from './configValidator.js';


export class ConfigInitializer {
  
  
  static async initialize() {
    try {
      logger.info('Initializing LinkedIn interaction configuration system...');

      const validation = ConfigValidator.validateOnStartup();
      
      if (!validation.isValid) {
        logger.error('Configuration validation failed during startup', {
          errorCount: validation.errors.length,
          errors: validation.errors
        });
        
        if (process.env.NODE_ENV === 'production') {
          logger.error('Exiting due to invalid configuration in production environment');
          process.exit(1);
        }
      }

      const configManager = ConfigManager.getInstance();
      
      this.logConfigurationSummary(configManager);
      
      this.setupConfigurationMonitoring(configManager);
      
      this.validateFeatureDependencies(configManager);
      
      logger.info('LinkedIn interaction configuration system initialized successfully');
      return true;

    } catch (error) {
      logger.error('Failed to initialize configuration system:', error);
      
      if (process.env.NODE_ENV === 'production') {
        logger.error('Exiting due to configuration initialization failure in production');
        process.exit(1);
      }
      
      return false;
    }
  }

  
  static logConfigurationSummary(configManager) {
    const summary = {
      environment: configManager.getEnvironmentConfig(),
      features: {
        messageSending: configManager.isFeatureEnabled('messageSending'),
        connectionRequests: configManager.isFeatureEnabled('connectionRequests'),
        postCreation: configManager.isFeatureEnabled('postCreation'),
        humanBehavior: configManager.isFeatureEnabled('humanBehavior'),
        suspiciousActivityDetection: configManager.isFeatureEnabled('suspiciousActivityDetection')
      },
      limits: {
        maxConcurrentInteractions: configManager.get('maxConcurrentInteractions'),
        rateLimitMax: configManager.get('rateLimitMax'),
        dailyInteractionLimit: configManager.get('dailyInteractionLimit'),
        hourlyInteractionLimit: configManager.get('hourlyInteractionLimit')
      },
      timeouts: configManager.getTimeoutConfig(),
      monitoring: {
        auditLoggingEnabled: configManager.get('auditLoggingEnabled'),
        performanceLoggingEnabled: configManager.get('performanceLoggingEnabled'),
        debugMode: configManager.get('debugMode')
      }
    };

    logger.info('LinkedIn interaction configuration summary', summary);
  }

  
  static setupConfigurationMonitoring(configManager) {
    configManager.addConfigWatcher((event, data) => {
      if (event === 'validation') {
        if (!data.isValid) {
          logger.warn('Configuration validation failed during runtime', {
            errorCount: data.errors.length,
            errors: data.errors
          });
        }
      }
    });

    setInterval(() => {
      const health = configManager.getHealthStatus();
      
      if (!health.isValid) {
        logger.warn('Configuration health check failed', health);
      } else {
        logger.debug('Configuration health check passed', health);
      }
    }, 600000);

    logger.debug('Configuration monitoring and health checks initialized');
  }

  
  static validateFeatureDependencies(configManager) {
    const warnings = [];

    const enabledFeatures = [
      'messageSending',
      'connectionRequests',
      'postCreation'
    ].filter(feature => configManager.isFeatureEnabled(feature));

    if (enabledFeatures.length === 0) {
      warnings.push('No LinkedIn interaction features are enabled');
    }

    if (enabledFeatures.length > 0 && !configManager.isFeatureEnabled('humanBehavior')) {
      warnings.push('Human behavior simulation is disabled but interaction features are enabled - this may trigger detection');
    }

    if (configManager.isFeatureEnabled('suspiciousActivityDetection') && !configManager.isFeatureEnabled('humanBehavior')) {
      warnings.push('Suspicious activity detection is enabled but human behavior simulation is disabled');
    }

    const rateLimitConfig = configManager.getRateLimitConfig();
    if (rateLimitConfig.max > 20) {
      warnings.push('Rate limit is set high - this may trigger LinkedIn detection');
    }

    const maxConcurrent = configManager.get('maxConcurrentInteractions');
    if (maxConcurrent > 5) {
      warnings.push('High concurrent interaction limit may trigger rate limiting');
    }

    warnings.forEach(warning => {
      logger.warn('Configuration dependency warning:', warning);
    });

    if (warnings.length === 0) {
      logger.info('All feature dependencies validated successfully');
    }
  }

  
  static getInitializationStatus() {
    const configManager = ConfigManager.getInstance();
    
    return {
      initialized: true,
      timestamp: new Date().toISOString(),
      configurationValid: configManager.getLastValidation()?.isValid || false,
      featuresEnabled: [
        'messageSending',
        'connectionRequests',
        'postCreation',
        'humanBehavior',
        'suspiciousActivityDetection'
      ].filter(feature => configManager.isFeatureEnabled(feature)),
      environment: process.env.NODE_ENV,
      healthStatus: configManager.getHealthStatus()
    };
  }

  
  static async reinitialize() {
    logger.info('Reinitializing LinkedIn interaction configuration...');
    
    try {
      const configManager = ConfigManager.getInstance();
      configManager.clearCache();
      
      const validation = configManager.validateConfiguration();
      
      if (!validation.isValid) {
        logger.error('Configuration revalidation failed', {
          errorCount: validation.errors.length,
          errors: validation.errors
        });
        return false;
      }
      
      this.logConfigurationSummary(configManager);
      
      logger.info('Configuration reinitialization completed successfully');
      return true;
      
    } catch (error) {
      logger.error('Failed to reinitialize configuration:', error);
      return false;
    }
  }

  
  static exportConfiguration() {
    const configManager = ConfigManager.getInstance();
    
    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      configuration: configManager.getAll(),
      validation: configManager.getLastValidation(),
      statistics: configManager.getStatistics(),
      healthStatus: configManager.getHealthStatus()
    };
  }

  
  static generateConfigurationReport() {
    const configManager = ConfigManager.getInstance();
    const validation = configManager.getLastValidation();
    
    return {
      reportTimestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      status: {
        initialized: true,
        valid: validation?.isValid || false,
        errorCount: validation?.errors?.length || 0,
        warningCount: validation?.warnings?.length || 0
      },
      features: {
        messageSending: configManager.isFeatureEnabled('messageSending'),
        connectionRequests: configManager.isFeatureEnabled('connectionRequests'),
        postCreation: configManager.isFeatureEnabled('postCreation'),
        humanBehavior: configManager.isFeatureEnabled('humanBehavior'),
        suspiciousActivityDetection: configManager.isFeatureEnabled('suspiciousActivityDetection')
      },
      limits: configManager.getRateLimitConfig(),
      performance: {
        sessionTimeout: configManager.get('sessionTimeout'),
        maxConcurrentInteractions: configManager.get('maxConcurrentInteractions'),
        retryAttempts: configManager.get('retryAttempts')
      },
      monitoring: configManager.getMonitoringConfig(),
      recommendations: validation?.recommendations || []
    };
  }
}

export default ConfigInitializer;
