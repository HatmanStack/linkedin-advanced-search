import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import FileHelpers from '../utils/fileHelpers.js';
import PuppeteerService from '../services/puppeteerService.js';
import LinkedInService from '../services/linkedinService.js';
import LinkedInContactService from '../services/linkedinContactService.js';
import EdgeService from '../services/edgeService.js';
import path from 'path';

export class SearchController {
  async performSearch(req, res, opts = {}) {
    const {
      companyName,
      companyRole,
      companyLocation,
      searchName,
      searchPassword,
      userId
    } = req.body;

    // Validate required userId
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User ID is required to perform searches'
      });
    }

    logger.info(companyName, companyRole, companyLocation, searchName, searchPassword);
    if (!searchName || !searchPassword) {
      return res.status(400).json({ 
        error: 'Missing required fields: searchName, searchPassword' 
      });
    }

    logger.info('Starting LinkedIn search request', {
      companyName,
      companyRole,
      companyLocation,
      username: searchName ? '[REDACTED]' : 'not provided'
    });

    // Build the state object required by both in-process and background worker runs
    const state = {
      companyName,
      companyRole,
      companyLocation,
      searchName,
      searchPassword,
      ...opts,
      userId: req.user.sub  // Add user ID to state
    };

    try {
      let result = await this.performSearchFromState(state);

      // If result is undefined, healing was started and work continues in a background process
      if (result === undefined) {
        return res.status(202).json({
          status: 'healing',
          message: 'Worker process started for healing/recovery.'
        });
      }

      // Otherwise, send the result
      res.json({
        response: result.allGoodContacts,
        metadata: {
          totalProfilesAnalyzed: result.uniqueLinks?.length,
          goodContactsFound: result.allGoodContacts?.length,
          successRate: result.stats?.successRate,
          searchParameters: { companyName, companyRole, companyLocation }
        }
      });
    } catch (e) {
      logger.error('Search failed:', e);
      res.status(500).json({
        error: 'Internal server error during search',
        message: e.message,
        details: process.env.NODE_ENV === 'development' ? e.stack : undefined
      });
    }
  }

  async performSearchFromState({
    companyName,
    companyRole,
    companyLocation,
    searchName,
    searchPassword,
    resumeIndex = 0,
    recursionCount = 0,
    lastPartialLinksFile = null,
    extractedCompanyNumber = null,
    extractedGeoNumber = null,
    healPhase = null,
    healReason = null,
    userId = null,
  }) {

    let puppeteerService;
    let linkedInService;
    let linkedInContactService;
    let edgeService;
    let uniqueLinks;
    let goodContacts;
    let allLinks;
    
    try {
      if (!searchName || !searchPassword || !userId) {
        throw new Error('Missing required fields: searchName, searchPassword, or userId.');
      }

      puppeteerService = new PuppeteerService();
      await puppeteerService.initialize();
      linkedInService = new LinkedInService(puppeteerService);
      linkedInContactService = new LinkedInContactService(puppeteerService);
      edgeService = new EdgeService();

      logger.info('Logging in...');
      await linkedInService.login(searchName, searchPassword, lastPartialLinksFile);
      logger.info('Login success.');
      if(healPhase){
        logger.info(`Heal Phase: ${healPhase}  \nReason: ${healReason}`)
      }
      
      if (healPhase === 'profile-parsing') {
         uniqueLinks = JSON.parse(await fs.readFile(lastPartialLinksFile));
      } else { 
        
        if (!extractedCompanyNumber && companyName) {
          extractedCompanyNumber = await linkedInService.searchCompany(companyName);
          if (!extractedCompanyNumber) {
            throw new Error(`Company "${companyName}" not found.`);
          }
        }
        // Step 3: Apply location filter and get geo number
        
        if (!extractedGeoNumber && companyLocation) {
          extractedGeoNumber = await linkedInService.applyLocationFilter(companyLocation, companyName);
        }

        // Scrape links as before:
        const encodedRole = companyRole ? encodeURIComponent(companyRole) : null;
        allLinks = JSON.parse(await fs.readFile(config.paths.linksFile));
        const { pageNumberStart, pageNumberEnd } = config.linkedin;
        let emptyPageCount = 0;
        let pageNumber = resumeIndex !== 0 && resumeIndex > pageNumberStart
        ? resumeIndex
        : pageNumberStart;

        while (pageNumber <= pageNumberEnd) {
          try {
            const pageLinks = await linkedInService.getLinksFromPeoplePage(pageNumber, extractedCompanyNumber, encodedRole, extractedGeoNumber);
            if (pageLinks.length === 0) {
              emptyPageCount++;
              if (emptyPageCount >= 3 && pageNumber < pageNumberEnd) {
                logger.warn(`Initiating self-healing restart.`);
                // Close browser and restart healing
                logger.info('Restarting with fresh Puppeteer instance..');
                const healReasonText = emptyPageCount < 3 ?  'TimeoutError: Navigation timeout of 30000 ms exceeded'  : '3 blank pages in a row';
                await this.healAndRestart({
                  companyName,
                  companyRole,
                  companyLocation,
                  searchName,
                  searchPassword,
                  userId,  // Include userId
                  resumeIndex: pageNumber - 3,
                  recursionCount: recursionCount + 1,
                  extractedCompanyNumber,
                  extractedGeoNumber,
                  healPhase: 'link-collection',
                  healReason: healReasonText,
                });
                return; 
              }
              pageNumber++;
              continue;
            } else {
              emptyPageCount = 0;
            }
            allLinks.push(...pageLinks);
            await FileHelpers.writeJSON(config.paths.linksFile, allLinks);
            pageNumber++;
          } catch (error) {
            logger.warn(`Error on page ${pageNumber}`, error);
            pageNumber++;
            continue;
          }
        }
        uniqueLinks = [...new Set(allLinks)];
        await FileHelpers.writeJSON(config.paths.linksFile, uniqueLinks);
        
      }
      
      
      logger.info(`Loaded ${uniqueLinks.length} unique links to process. Starting at index: ${resumeIndex}`);

      goodContacts = JSON.parse(await fs.readFile(config.paths.goodConnectionsFile));
      let errorQueue = [];
      let i = resumeIndex;

      while (i < uniqueLinks.length) {
        const link = uniqueLinks[i];
        if (/ACoA/.test(link)) {
          logger.debug(`Skipping profile: ${link}`);
          i++;
          continue;
        }
        try {
          logger.info(`Analyzing contact ${i+1}/${uniqueLinks.length}: ${link}`);
          const result = await linkedInService.analyzeContactActivity(link);
          
          if (result.isGoodContact) {
            errorQueue = [];
            goodContacts.push(link);
            logger.info(`Found good contact: ${link} (${goodContacts.length})`);
            await linkedInContactService.takeScreenShotAndUploadToS3(link, result.tempDir);
            edgeService.checkAndCreateEdges(userId, link).catch(error => {
              logger.error('Error creating edges:', error);
            });
            await FileHelpers.writeJSON(config.paths.goodConnectionsFile, goodContacts);
          }
          i++;
        } catch (error) {
          logger.error(`Error collecting contact: ${link}`);
          errorQueue.push(link);
          i++;
          if (errorQueue.length >= 3) {
            logger.warn(`3 errors in a row, pausing 5min and retrying...`);
            const linksToRetry = [...errorQueue];
            errorQueue = [];
            await new Promise(resolve => setTimeout(resolve, 300000)); 
            let allRetriesFailed = true;
            for (let retry of linksToRetry) {
              try {
                const retryResult = await linkedInService.analyzeContactActivity(retry);
                if (retryResult.isGoodContact) {
                  goodContacts.push(retry);
                  logger.info(`Retry success: ${retry}`);
                  allRetriesFailed = false;
                }
              } catch (e) {
                logger.error(`Retry failed: ${retry}`);
              }
            }

            if (allRetriesFailed) {
              logger.warn(`All retry links failed. Initiating self-healing restart.`);
              let restartIndex = i - linksToRetry.length;
              if (restartIndex < 0) restartIndex = 0;
              let remainingLinks = uniqueLinks.slice(restartIndex);
              if (remainingLinks[0] !== linksToRetry[0]) {
                remainingLinks.unshift(linksToRetry[0]);
              }
              logger.info(`possible-links-partial-${Date.now()}.json`);
              const newPartialLinksFile = path.join(path.dirname(config.paths.linksFile), `possible-links-partial-${Date.now()}.json`);
              await fs.writeFile(newPartialLinksFile, JSON.stringify(remainingLinks, null, 2));
              logger.info('written')
              logger.info('Restarting with fresh Puppeteer instance...');
              await this.healAndRestart({
                companyName,
                companyRole,
                companyLocation,
                searchName,
                searchPassword,
                userId,  // Include userId
                resumeIndex: 0,
                recursionCount: recursionCount + 1,
                lastPartialLinksFile: newPartialLinksFile,
                extractedCompanyNumber,
                extractedGeoNumber,
                healPhase: 'profile-parsing',
                healReason: 'Links failed',
              });
              return; 
            }
          }
          continue;
        }
      } 
      uniqueLinks = JSON.parse(await fs.readFile(config.paths.linksFile));
      return {
        goodContacts,
        uniqueLinks,
        stats: {
          successRate: ((goodContacts.length / uniqueLinks.length) * 100).toFixed(2) + '%'
        }
      };

    } catch (error) {
      logger.error('Search failed:', error);
      throw error;
    } finally {
        logger.info('In finally, closing browser:', !!puppeteerService);
      if (puppeteerService) {
        await puppeteerService.close();
        logger.info('Closed browser in finally!');
      }
    }
  }

  async healAndRestart({
    companyName,
    companyRole,
    companyLocation,
    searchName,
    searchPassword,
    userId,  // Add userId to destructured parameters
    resumeIndex = 0,
    recursionCount = 0,
    lastPartialLinksFile = null,
    extractedCompanyNumber = null,
    extractedGeoNumber = null,
    healPhase = null,
    healReason = null,
  }) {
    const fsSync = await import('fs');
    const stateFile = path.join('data', `search-heal-${Date.now()}.json`);
    fsSync.writeFileSync(stateFile, JSON.stringify({
      companyName,
      companyRole,
      companyLocation,
      searchName,
      searchPassword,
      userId,  // Include userId in state file
      resumeIndex,
      recursionCount,
      lastPartialLinksFile,
      extractedCompanyNumber,
      extractedGeoNumber,
      healPhase,
      healReason
    }, null, 2));
    const { spawn } = await import('child_process');
    const worker = spawn('node', ['searchWorker.js', stateFile], {
      detached: true,
      stdio: 'ignore'
    });
    worker.unref();
    logger.info(`Launched healing worker with state file: ${stateFile}`);
  }

}

export default SearchController;