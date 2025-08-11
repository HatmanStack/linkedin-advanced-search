import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import FileHelpers from '../utils/fileHelpers.js';
import PuppeteerService from '../services/puppeteerService.js';
import LinkedInService from '../services/linkedinService.js';
import LinkedInContactService from '../services/linkedinContactService.js';
import DynamoDBService from '../services/dynamoDBService.js'
import { SearchRequestValidator } from '../utils/searchRequestValidator.js';
import { SearchStateManager } from '../utils/searchStateManager.js';
import { LinkCollector } from '../utils/linkCollector.js';
import { ContactProcessor } from '../utils/contactProcessor.js';
import { HealingManager } from '../utils/healingManager.js';
import path from 'path';
import fs from 'fs/promises';

export class SearchController {
  async performSearch(req, res, opts = {}) {
    this._logRequestDetails(req);
    
    const jwtToken = this._extractJwtToken(req);
    if (!jwtToken) {
      return res.status(401).json({
        error: 'Missing or invalid Authorization header'
      });
    }

    const validationResult = SearchRequestValidator.validateRequest(req.body, jwtToken);
    if (!validationResult.isValid) {
      return res.status(validationResult.statusCode).json({
        error: validationResult.error,
        message: validationResult.message
      });
    }

    const { companyName, companyRole, companyLocation, linkedinCredentialsCiphertext } = req.body;
    // Do not decrypt or extract plaintext here; pass ciphertext through and decrypt at login
    const searchName = null;
    const searchPassword = null;
    
    logger.info('Starting LinkedIn search request', {
      companyName,
      companyRole,
      companyLocation,
      username: searchName ? '[REDACTED]' : 'not provided'
    });
    
    const state = SearchStateManager.buildInitialState({
      companyName,
      companyRole,
      companyLocation,
      searchName,
      searchPassword,
      credentialsCiphertext: linkedinCredentialsCiphertext,
      jwtToken,
      ...opts
    });

    if (!state.healPhase) {
      // Fresh run: clear link and good-contact caches to avoid stale data
      await FileHelpers.writeJSON(config.paths.linksFile, []);
      await FileHelpers.writeJSON(config.paths.goodConnectionsFile, []);
    }
    
    try {
      const result = await this.performSearchFromState(state);

      if (result === undefined) {
        return res.status(202).json({
          status: 'healing',
          message: 'Worker process started for healing/recovery.'
        });
      }

      res.json(this._buildSuccessResponse(result, { companyName, companyRole, companyLocation }));
    } catch (e) {
      logger.error('Search failed:', e);
      res.status(500).json(this._buildErrorResponse(e));
    }
  }

  async performSearchFromState(state) {
    const services = await this._initializeServices();
    let searchData = {};

    try {
      
      
      await this._performLogin(services.linkedInService, state);
      
      if (state.healPhase === 'profile-parsing') {
        searchData.uniqueLinks = await this._loadLinksFromFile(state.lastPartialLinksFile);
      } else {
        const companyData = await this._extractCompanyData(services.linkedInService, state);
        searchData = await this._collectLinks(services.linkedInService, state, companyData);
      }

      const goodContacts = await this._processContacts(services, searchData.uniqueLinks, state);
      
      return this._buildSearchResult(goodContacts, searchData.uniqueLinks);

    } catch (error) {
      logger.error('Search failed:', error);
      throw error;
    } finally {
      await this._cleanupServices(services);
    }
  }

  async _initializeServices() {
    const puppeteerService = new PuppeteerService();
    await puppeteerService.initialize();
    
    return {
      puppeteerService,
      linkedInService: new LinkedInService(puppeteerService),
      linkedInContactService: new LinkedInContactService(puppeteerService),
      dynamoDBService: new DynamoDBService()
    };
  }

  async _performLogin(linkedInService, state) {
    logger.info('Logging in...');
    await linkedInService.login(
      state.searchName,
      state.searchPassword,
      state.lastPartialLinksFile,
      state.credentialsCiphertext,
      'search-controller'
    );
    logger.info('Login success.');
    
    if (state.healPhase) {
      logger.info(`Heal Phase: ${state.healPhase}\nReason: ${state.healReason}`);
    }
  }

  async _extractCompanyData(linkedInService, state) {
    let extractedCompanyNumber = state.extractedCompanyNumber;
    let extractedGeoNumber = state.extractedGeoNumber;

    if (!extractedCompanyNumber && state.companyName) {
      extractedCompanyNumber = await linkedInService.searchCompany(state.companyName);
      if (!extractedCompanyNumber) {
        throw new Error(`Company "${state.companyName}" not found.`);
      }
    }

    if (!extractedGeoNumber && state.companyLocation) {
      extractedGeoNumber = await linkedInService.applyLocationFilter(state.companyLocation, state.companyName);
    }

    return { extractedCompanyNumber, extractedGeoNumber };
  }

  async _collectLinks(linkedInService, state, companyData) {
    const linkCollector = new LinkCollector(linkedInService, config);
    
    if (state.healPhase === "link-collection") {
      const allLinks = await this._loadLinksFromFile(config.paths.linksFile);
      return { uniqueLinks: [...new Set(allLinks)] };
    }

    const allLinks = await linkCollector.collectAllLinks(
      state,
      companyData,
      (pageNumber) => this._handleLinkCollectionHealing(state, companyData, pageNumber)
    );

    const uniqueLinks = [...new Set(allLinks)];
    await FileHelpers.writeJSON(config.paths.linksFile, uniqueLinks);
    
    return { uniqueLinks };
  }

  async _processContacts(services, uniqueLinks, state) {
    const contactProcessor = new ContactProcessor(
      services.linkedInService,
      services.linkedInContactService,
      services.dynamoDBService,
      config
    );

    logger.info(`Loaded ${uniqueLinks.length} unique links to process. Starting at index: ${state.resumeIndex}`);

    return await contactProcessor.processAllContacts(
      uniqueLinks,
      state,
      (restartParams) => this._handleContactProcessingHealing(restartParams)
    );
  }

  async _handleLinkCollectionHealing(state, companyData, pageNumber) {
    logger.warn(`Initiating self-healing restart.`);
    logger.info('Restarting with fresh Puppeteer instance..');
    
    const healReasonText = '3 blank pages in a row';
    await this._initiateHealing({
      ...state,
      ...companyData,
      resumeIndex: pageNumber - 3,
      recursionCount: state.recursionCount + 1,
      healPhase: 'link-collection',
      healReason: healReasonText,
    });
  }

  async _handleContactProcessingHealing(restartParams) {
    logger.warn(`All retry links failed. Initiating self-healing restart.`);
    logger.info('Restarting with fresh Puppeteer instance...');
    
    await this._initiateHealing({
      ...restartParams,
      healPhase: 'profile-parsing',
      healReason: 'Links failed',
    });
  }

  async _initiateHealing(healingParams) {
    const healingManager = new HealingManager();
    await healingManager.healAndRestart(healingParams);
  }

  async _loadLinksFromFile(filePath) {
    try {
      const fileContent = await fs.readFile(filePath);
      return JSON.parse(fileContent);
    } catch (error) {
      return [];
    }
  }

  async _cleanupServices(services) {
    logger.info('In finally, closing browser:', !!services.puppeteerService);
    if (services.puppeteerService) {
      await services.puppeteerService.close();
      logger.info('Closed browser in finally!');
    }
  }

  _logRequestDetails(req) {
    logger.info('Raw request details:', {
      method: req.method,
      url: req.url,
      headers: req.headers,
      bodyType: typeof req.body,
      bodyKeys: req.body ? Object.keys(req.body) : 'no body'
    });
  }

  _extractJwtToken(req) {
    const authHeader = req.headers.authorization;
    return authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;
  }

  _buildSuccessResponse(result, searchParameters) {
    return {
      response: result.goodContacts,
      metadata: {
        totalProfilesAnalyzed: result.uniqueLinks?.length,
        goodContactsFound: result.goodContacts?.length,
        successRate: result.stats?.successRate,
        searchParameters
      }
    };
  }

  _buildErrorResponse(error) {
    return {
      error: 'Internal server error during search',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  }

  _buildSearchResult(goodContacts, uniqueLinks) {
    return {
      goodContacts,
      uniqueLinks,
      stats: {
        successRate: ((goodContacts.length / uniqueLinks.length) * 100).toFixed(2) + '%'
      }
    };
  }

  // Legacy method for backward compatibility
  async healAndRestart(params) {
    const healingManager = new HealingManager();
    await healingManager.healAndRestart(params);
  }
}

export default SearchController;
