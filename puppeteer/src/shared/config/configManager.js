import { logger } from './logger.js';
import config from '../config/index.js';
import ConfigValidator from './configValidator.js';


export class ConfigManager {
  
  static instance = null;
  static configCache = new Map();
  static lastValidation = null;
  static configWatchers = new Set();

  
  static getInstance() {
    if (!this.instance) {
      this.instance = new ConfigManager();
    }
    return this.instance;
  }

  constructor() {
    this.config = config.linkedinInteractions;
    this.initializeConfiguration();
  }

  
  initializeConfiguration() {
    logger.info('Initializing LinkedIn interaction configuration manager');
    
    this.lastValidation = ConfigValidator.validateOnStartup();
    
    this.cacheFrequentlyUsedConfig();
    
    this.setupConfigurationMonitoring();
  }

  
  cacheFrequentlyUsedConfig() {
    const frequentlyUsed = [
      'sessionTimeout',
      'maxConcurrentInteractions',
      'rateLimitMax',
      'rateLimitWindow',
      'retryAttempts',
      'humanDelayMin',
      'humanDelayMax',
      'navigationTimeout',
      'elementWaitTimeout'
    ];

    frequentlyUsed.forEach(key => {
      ConfigManager.configCache.set(key, this.config[key]);
    });

    logger.debug('Cached frequently used configuration values', {
      cachedKeys: frequentlyUsed
    });
  }

  
  setupConfigurationMonitoring() {
    setInterval(() => {
      this.validateConfiguration();
    }, 300000);

    logger.debug('Configuration monitoring initialized');
  }

  
  get(key, defaultValue = null) {
    if (ConfigManager.configCache.has(key)) {
      return ConfigManager.configCache.get(key);
    }

    const value = this.config[key];
    return value !== undefined ? value : defaultValue;
  }

  
  getAll() {
    return { ...this.config };
  }

  
  getOperationConfig(operationType) {
    const baseConfig = {
      retryAttempts: this.get('retryAttempts'),
      retryBaseDelay: this.get('retryBaseDelay'),
      retryMaxDelay: this.get('retryMaxDelay'),
      humanDelayMin: this.get('humanDelayMin'),
      humanDelayMax: this.get('humanDelayMax'),
      enableHumanBehavior: this.get('enableHumanBehavior')
    };

    switch (operationType) {
      case 'sendMessage':
        return {
          ...baseConfig,
          enabled: this.get('enableMessageSending'),
          timeout: this.get('messageComposeTimeout'),
          maxContentLength: this.get('maxMessageLength')
        };

      case 'addConnection':
        return {
          ...baseConfig,
          enabled: this.get('enableConnectionRequests'),
          timeout: this.get('connectionRequestTimeout'),
          maxMessageLength: this.get('maxConnectionMessageLength')
        };

      case 'createPost':
        return {
          ...baseConfig,
          enabled: this.get('enablePostCreation'),
          timeout: this.get('postCreationTimeout'),
          maxContentLength: this.get('maxPostLength')
        };

      default:
        return baseConfig;
    }
  }

  
  getRateLimitConfig() {
    return {
      window: this.get('rateLimitWindow'),
      max: this.get('rateLimitMax'),
      dailyLimit: this.get('dailyInteractionLimit'),
      hourlyLimit: this.get('hourlyInteractionLimit'),
      suspiciousActivityThreshold: this.get('suspiciousActivityThreshold'),
      suspiciousActivityWindow: this.get('suspiciousActivityWindow')
    };
  }

  
  getHumanBehaviorConfig() {
    return {
      enabled: this.get('enableHumanBehavior'),
      delayMin: this.get('humanDelayMin'),
      delayMax: this.get('humanDelayMax'),
      actionsPerMinute: this.get('actionsPerMinute'),
      actionsPerHour: this.get('actionsPerHour'),
      typingSpeedMin: this.get('typingSpeedMin'),
      typingSpeedMax: this.get('typingSpeedMax'),
      typingPauseChance: this.get('typingPauseChance'),
      typingPauseMin: this.get('typingPauseMin'),
      typingPauseMax: this.get('typingPauseMax'),
      mouseMovementSteps: this.get('mouseMovementSteps'),
      mouseMovementDelay: this.get('mouseMovementDelay'),
      scrollStepSize: this.get('scrollStepSize'),
      scrollDelay: this.get('scrollDelay')
    };
  }

  
  getSessionConfig() {
    return {
      timeout: this.get('sessionTimeout'),
      healthCheckInterval: this.get('sessionHealthCheckInterval'),
      maxErrors: this.get('maxSessionErrors'),
      recoveryTimeout: this.get('sessionRecoveryTimeout'),
      maxConcurrentSessions: this.get('maxConcurrentSessions'),
      browserIdleTimeout: this.get('browserIdleTimeout')
    };
  }

  
  getTimeoutConfig() {
    return {
      navigation: this.get('navigationTimeout'),
      elementWait: this.get('elementWaitTimeout'),
      messageCompose: this.get('messageComposeTimeout'),
      postCreation: this.get('postCreationTimeout'),
      connectionRequest: this.get('connectionRequestTimeout'),
      browserLaunch: this.get('browserLaunchTimeout'),
      pageLoad: this.get('pageLoadTimeout')
    };
  }

  
  getErrorHandlingConfig() {
    return {
      maxConsecutiveErrors: this.get('maxConsecutiveErrors'),
      errorCooldownDuration: this.get('errorCooldownDuration'),
      retryAttempts: this.get('retryAttempts'),
      retryBaseDelay: this.get('retryBaseDelay'),
      retryMaxDelay: this.get('retryMaxDelay'),
      retryJitterFactor: this.get('retryJitterFactor')
    };
  }

  
  getMonitoringConfig() {
    return {
      performanceLoggingEnabled: this.get('performanceLoggingEnabled'),
      auditLoggingEnabled: this.get('auditLoggingEnabled'),
      metricsCollectionInterval: this.get('metricsCollectionInterval'),
      debugMode: this.get('debugMode'),
      screenshotOnError: this.get('screenshotOnError'),
      savePageSourceOnError: this.get('savePageSourceOnError'),
      verboseLogging: this.get('verboseLogging')
    };
  }

  
  isFeatureEnabled(feature) {
    const featureMap = {
      'messageSending': 'enableMessageSending',
      'connectionRequests': 'enableConnectionRequests',
      'postCreation': 'enablePostCreation',
      'humanBehavior': 'enableHumanBehavior',
      'suspiciousActivityDetection': 'enableSuspiciousActivityDetection'
    };

    const configKey = featureMap[feature];
    return configKey ? this.get(configKey, false) : false;
  }

  
  getEnvironmentConfig() {
    const isProduction = config.nodeEnv === 'production';
    const isDevelopment = config.nodeEnv === 'development';

    return {
      environment: config.nodeEnv,
      isProduction,
      isDevelopment,
      adjustments: {
        maxConcurrentInteractions: isProduction ? 
          Math.min(this.get('maxConcurrentInteractions'), 3) : 
          this.get('maxConcurrentInteractions'),
        
        humanDelayMin: isProduction ? 
          Math.max(this.get('humanDelayMin'), 2000) : 
          this.get('humanDelayMin'),
        
        retryAttempts: isProduction ? 
          Math.max(this.get('retryAttempts'), 3) : 
          this.get('retryAttempts'),
        
        debugMode: isDevelopment && this.get('debugMode'),
        screenshotOnError: isDevelopment && this.get('screenshotOnError'),
        verboseLogging: isDevelopment && this.get('verboseLogging')
      }
    };
  }

  
  validateConfiguration() {
    const validation = ConfigValidator.validateConfiguration();
    this.lastValidation = validation;

    this.notifyConfigWatchers('validation', validation);

    return validation;
  }

  
  getLastValidation() {
    return this.lastValidation;
  }

  
  addConfigWatcher(callback) {
    ConfigManager.configWatchers.add(callback);
  }

  
  removeConfigWatcher(callback) {
    ConfigManager.configWatchers.delete(callback);
  }

  
  notifyConfigWatchers(event, data) {
    ConfigManager.configWatchers.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        logger.error('Error in configuration watcher:', error);
      }
    });
  }

  
  getHealthStatus() {
    const validation = this.lastValidation || { isValid: false, errors: ['Not validated'] };
    
    return {
      isValid: validation.isValid,
      lastValidated: validation.timestamp || new Date().toISOString(),
      errorCount: validation.errors?.length || 0,
      warningCount: validation.warnings?.length || 0,
      cacheSize: ConfigManager.configCache.size,
      watcherCount: ConfigManager.configWatchers.size,
      environment: config.nodeEnv
    };
  }

  
  clearCache() {
    ConfigManager.configCache.clear();
    this.cacheFrequentlyUsedConfig();
    logger.info('Configuration cache cleared and refreshed');
  }

  
  getStatistics() {
    return {
      totalConfigKeys: Object.keys(this.config).length,
      cachedKeys: ConfigManager.configCache.size,
      enabledFeatures: [
        'enableMessageSending',
        'enableConnectionRequests',
        'enablePostCreation',
        'enableHumanBehavior',
        'enableSuspiciousActivityDetection'
      ].filter(key => this.get(key)).length,
      environment: config.nodeEnv,
      lastValidation: this.lastValidation?.timestamp,
      validationStatus: this.lastValidation?.isValid ? 'valid' : 'invalid'
    };
  }
}

export default ConfigManager.getInstance();
