import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import FileHelpers from '../utils/fileHelpers.js';
import PuppeteerService from '../services/puppeteerService.js';
import LinkedInService from '../services/linkedinService.js';
import LinkedInContactService from '../services/linkedinContactService.js';
import fs from 'fs/promises';
import path from 'path';

export class SearchController {
  // ---- MAIN SEARCH METHOD (Express route handler) ----
  async performSearch(req, res, opts = {}) {
    const {
      companyName,
      companyRole,
      companyLocation,
      searchName,
      searchPassword
    } = req.body;
    logger.info(companyName, companyRole, companyLocation, searchName, searchPassword);
    // Validate required fields
    if (!companyName || !companyRole || !companyLocation || !searchName || !searchPassword) {
      return res.status(400).json({ 
        error: 'Missing required fields: companyName, companyRole, companyLocation, searchName, searchPassword' 
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
      ...opts
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

  // ---- WORKER/CORE SEARCH LOGIC ----
  async performSearchFromState({
    companyName,
    companyRole,
    companyLocation,
    searchName,
    searchPassword,
    resumeIndex = 0,
    persistGoodContacts = [],
    recursionCount = 0,
    lastPartialLinksFile = null
  }) {

    // Set up file paths
    const linksDir = path.dirname(config.paths.linksFile);
    let goodConnectionsFile;
    let goodConnectionsBase = 'good-connection-links';

    // Always create a new partial file for each healing run
    const goodConnectionsIndex = await SearchController.getNextGoodConnectionsFileIndex(linksDir, goodConnectionsBase);
    goodConnectionsFile = path.join(linksDir, `${goodConnectionsBase}-${goodConnectionsIndex}.json`);

    let puppeteerService;
    let linkedInService;
    let linkedInContactService;
    let uniqueLinks;

    try {
      // Validate required fields
      if (!companyName || !companyRole || !companyLocation || !searchName || !searchPassword) {
        throw new Error('Missing required fields.');
      }

      puppeteerService = new PuppeteerService();
      await puppeteerService.initialize();
      linkedInService = new LinkedInService(puppeteerService);
      linkedInContactService = new LinkedInContactService(puppeteerService);

      logger.info('Logging in...');
      await linkedInService.login(searchName, searchPassword, lastPartialLinksFile);
      logger.info('Login success.');
      
      // If this is a recursive (restart) call, use the split links file, otherwise, do normal search & extraction.
      if (lastPartialLinksFile) {
         uniqueLinks = JSON.parse(await fs.readFile(lastPartialLinksFile));
      } else { 
        // Step 2: Search for company
        const companyFound = await linkedInService.searchCompany(companyName);
        if (!companyFound) {
          throw new Error(`Company "${companyName}" not found.`);
        }
        await linkedInService.navigateToJobs(companyLocation);

        const { extractedCompanyNumber, extractedGeoNumber } = await linkedInService.extractCompanyAndGeoNumbers();
        if (!extractedCompanyNumber || !extractedGeoNumber) {
          throw new Error('Failed to extract company or location info');
        }

        // Scrape links as before:
        const encodedRole = encodeURIComponent(companyRole);
        let allLinks = [];
        const { pageNumberStart, pageNumberEnd } = config.linkedin;
        for (let pageNumber = pageNumberStart; pageNumber <= pageNumberEnd; pageNumber++) {
          try {
            const pageLinks = await linkedInService.getLinksFromPeoplePage(pageNumber, extractedCompanyNumber, encodedRole, extractedGeoNumber);
            if (pageLinks.length === 0) break;
            allLinks.push(...pageLinks);
            if (pageNumber % 5 === 0) {
              await FileHelpers.writeJSON(config.paths.linksFile, allLinks);
              logger.info(`Progress saved: ${allLinks.length} links after page ${pageNumber}`);
            }
          } catch (error) {
            logger.warn(`Error on page ${pageNumber}`, error);
            continue;
          }
        }
        uniqueLinks = [...new Set(allLinks)];
        await FileHelpers.writeJSON(config.paths.linksFile, uniqueLinks);
        //To use if parsing through profiles is gets stuck, Can change file to current possible-links itteration
        //uniqueLinks = JSON.parse(await fs.readFile('./data/possible-links.json'));
      }
      
      
      logger.info(`Loaded ${uniqueLinks.length} unique links to process. Starting at index: ${resumeIndex}`);

      let goodContacts = [...persistGoodContacts];
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
          if (await linkedInService.analyzeContactActivity(link)) {
            errorQueue = [];
            goodContacts.push(link);
            logger.info(`Found good contact: ${link} (${goodContacts.length})`);
            await linkedInContactService.takeScreenShotAndUploadToS3(link, { screenshotType: 'single' });
            await FileHelpers.writeJSON(goodConnectionsFile, goodContacts);
          }
          i++;
        } catch (error) {
          logger.error(`Error collecting contact: ${link}`);
          errorQueue.push(link);
          i++;
          if (errorQueue.length >= 3) {
            // Retry the batch that's now in errorQueue:
            logger.warn(`3 errors in a row, pausing 5min and retrying...`);
            const linksToRetry = [...errorQueue];
            errorQueue = [];
            await new Promise(resolve => setTimeout(resolve, 300000)); // 5 min
            let allRetriesFailed = true;
            for (let retry of linksToRetry) {
              try {
                if (await linkedInService.analyzeContactActivity(retry)) {
                  goodContacts.push(retry);
                  logger.info(`Retry success: ${retry}`);
                  allRetriesFailed = false;
                }
              } catch (e) {
                logger.error(`Retry failed: ${retry}`);
              }
            }
            // --- HEALING/RESTART CASE ---
            if (allRetriesFailed) {
              logger.warn(`All retry links failed. Initiating self-healing restart.`);
              let restartIndex = i - linksToRetry.length;
              if (restartIndex < 0) restartIndex = 0;
              let remainingLinks = uniqueLinks.slice(restartIndex);
              if (remainingLinks[0] !== linksToRetry[0]) {
                remainingLinks.unshift(linksToRetry[0]);
              }
              logger.info(`possible-links-partial-${Date.now()}.json`);
              const newPartialLinksFile = path.join(linksDir, `possible-links-partial-${Date.now()}.json`);
              await fs.writeFile(newPartialLinksFile, JSON.stringify(remainingLinks, null, 2));
              logger.info('written')
              if (puppeteerService) {
                console.log('closing browser:', !!puppeteerService);
                await puppeteerService.close();
                console.log('closing browser closed');
                puppeteerService = null;
                linkedInService = null;
              }
              logger.info('Restarting with fresh Puppeteer instance...');
              await this.healAndRestart({
                companyName,
                companyRole,
                companyLocation,
                searchName,
                searchPassword,
                resumeIndex: 0,
                persistGoodContacts: goodContacts,
                recursionCount: recursionCount + 1,
                lastPartialLinksFile: newPartialLinksFile
              });
              return; // Stop further processing! Healer will resume
            }
          }
          continue;
        }
      } // while loop
      
      // Final save for chunk
      await FileHelpers.writeJSON(goodConnectionsFile, goodContacts);
      
      // Merge all partials if we're back at root invocation
      let allGoodContacts = goodContacts;
      if (recursionCount > 0) {
        // Return just the new chunk if in worker mode (do not merge)
        return {
          allGoodContacts: goodContacts,
          uniqueLinks,
          stats: {
            successRate: ((goodContacts.length / uniqueLinks.length) * 100).toFixed(2) + '%',
          }
        };
      }
      
      // Root: merge all
      allGoodContacts = await SearchController.mergeAndCleanGoodConnectionsFiles(
        linksDir,
        goodConnectionsBase,
        'good-connections-links.json'
      );
      
      return {
        allGoodContacts,
        uniqueLinks,
        stats: {
          successRate: ((allGoodContacts.length / uniqueLinks.length) * 100).toFixed(2) + '%'
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


  // --- STATIC HELPER METHODS ---
  static async getNextGoodConnectionsFileIndex(dir, baseName = 'good-connection-links') {
    const files = await fs.readdir(dir);
    let max = 0;
    files.forEach(f => {
      const match = f.match(new RegExp(`${baseName}-(\\d+)\\.json$`));
      if (match) {
        const idx = parseInt(match[1]);
        if (idx > max) max = idx;
      }
    });
    return max + 1;
  }

  static async mergeAndCleanGoodConnectionsFiles(dir, baseName = 'good-connection-links', keepName = 'good-connections-links.json') {
    const files = (await fs.readdir(dir)).filter(f => new RegExp(`${baseName}-\\d+\\.json$`).test(f));
    let allContacts = new Set();
    for (let f of files) {
      const data = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
      Array.isArray(data) && data.forEach(link => allContacts.add(link));
    }
    const allArr = Array.from(allContacts);
    await fs.writeFile(path.join(dir, keepName), JSON.stringify(allArr, null, 2));
    // Remove chunk files
    await Promise.all(files.map(f => fs.unlink(path.join(dir, f))));
    return allArr;
  }

  // --- SELF-HEAL: spawn new process
  async healAndRestart(stateObj) {
    // Save to disk
    const fsSync = await import('fs');
    const stateFile = path.join('data', `search-heal-${Date.now()}.json`);
    fsSync.writeFileSync(stateFile, JSON.stringify(stateObj, null, 2));
    // Spawn searchWorker.js (must be at repo root)
    const { spawn } = await import('child_process');
    const worker = spawn('node', ['searchWorker.js', stateFile], {
      detached: true,
      stdio: 'ignore'
    });
    worker.unref();
    logger.info(`Launched healing worker with state file: ${stateFile}`);
  }

  // --- OTHER METHODS UNCHANGED ---
  async getStoredResults(req, res) {
    try {
      const results = await FileHelpers.readJSON(config.paths.goodConnectionsFile);
      if (!results) {
        return res.json({ response: [] });
      }
      res.json({
        response: results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get stored results:', error);
      res.status(500).json({
        error: 'Failed to retrieve stored results'
      });
    }
  }

  async getHealthCheck(req, res) {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      config: {
        nodeEnv: config.nodeEnv,
        hasGoogleAI: !!config.googleAI.apiKey,
        linkedinConfig: config.linkedin
      }
    });
  }
}

export default SearchController;