import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import FileHelpers from '../utils/fileHelpers.js';
import PuppeteerService from '../services/puppeteerService.js';
import LinkedInService from '../services/linkedinService.js';
import fs from 'fs/promises';
import path from 'path';

export class SearchController {
  // ---- MAIN SEARCH METHOD ----
  async performSearch(req, res, {
    resumeIndex = 0,
    persistGoodContacts = [],
    recursionCount = 0,
    lastPartialLinksFile = null
  } = {}) {
    const { companyName, companyRole, companyLocation, searchName, searchPassword } = req.body;

    logger.info('Starting LinkedIn search request', {
      companyName,
      companyRole,
      companyLocation,
      username: searchName ? '[REDACTED]' : 'not provided',
      recursionCount
    });

    // Set up file paths
    const linksDir = path.dirname(config.paths.linksFile);
    let goodConnectionsFile;
    let goodConnectionsBase = 'good-connection-links';

    // Always create a new partial file for each healing run
    const goodConnectionsIndex = await SearchController.getNextGoodConnectionsFileIndex(linksDir, goodConnectionsBase);
    goodConnectionsFile = path.join(linksDir, `${goodConnectionsBase}-${goodConnectionsIndex}.json`);

    let puppeteerService;
    let linkedInService;
    let uniqueLinks;

    try {
        // Validate required fields
        if (!companyName || !companyRole || !companyLocation || !searchName || !searchPassword) {
            return res.status(400).json({ error: 'Missing required fields: companyName, companyRole, companyLocation, searchName, searchPassword' });
        }

        puppeteerService = new PuppeteerService();
        await puppeteerService.initialize();
        linkedInService = new LinkedInService(puppeteerService);

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
                return res.status(404).json({ error: `Company "${companyName}" not found` });
            }
            await linkedInService.navigateToJobs(companyLocation);

            const { extractedCompanyNumber, extractedGeoNumber } = await linkedInService.extractCompanyAndGeoNumbers();
            if (!extractedCompanyNumber || !extractedGeoNumber) {
                return res.status(400).json({ error: 'Failed to extract company or location info' });
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
        }

        logger.info(`Loaded ${uniqueLinks.length} unique links to process. Starting at index: ${resumeIndex}`);

        // Preserved good contacts:
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
                    await FileHelpers.writeJSON(goodConnectionsFile, goodContacts);
                }
                i++;
            } catch (error) {
                logger.error(`Error collecting contact: ${link}`);
                errorQueue.push(link);
                i++;
                if (errorQueue.length >= 3) {
                    // Retry the batch that's now in errorQueue:
                    logger.warn(`3 errors in a row, pausing 10min and retrying...`);
                    const linksToRetry = [...errorQueue];
                    errorQueue = [];
                    await new Promise(resolve => setTimeout(resolve, 600000)); // 10 min
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

                        // Step 1: Write a NEW links file for the remaining queue, starting from the failed one onward (plus current errorQueue[0])
                        // The first error in this batch may not be at i-3, so we back up:
                        let restartIndex = i - linksToRetry.length;
                        if (restartIndex < 0) restartIndex = 0;
                        // Remaining unprocessed links
                        let remainingLinks = uniqueLinks.slice(restartIndex);
                        // (Optional, to guarantee current errorQueue[0] is included)
                        if (remainingLinks[0] !== linksToRetry[0]) {
                            remainingLinks.unshift(linksToRetry[0]);
                        }
                        // Save split file to disk for recovery
                        const newPartialLinksFile = path.join(linksDir, `possible-links-partial-${Date.now()}.json`);
                        await fs.writeFile(newPartialLinksFile, JSON.stringify(remainingLinks, null, 2));

                        // SAVE the current goodContacts in their own chunk file (already done above!)

                        // Cleanup Puppeteer because we're about to restart the browser!
                        if (puppeteerService) {
                            await puppeteerService.close();
                        }
                        // Recursively call self with new start index and good contacts, as well as new links file
                        return await this.performSearch(req, res, {
                            resumeIndex: 0, // We're starting at 0 in the sliced links file.
                            persistGoodContacts: goodContacts,
                            recursionCount: recursionCount + 1,
                            lastPartialLinksFile: newPartialLinksFile
                        });
                    }
                }
                continue;
            }
        } // while loop

        // Final save for chunk
        await FileHelpers.writeJSON(goodConnectionsFile, goodContacts);

        // If this was the last "healing" cycle, do merging of good contacts!
        if (recursionCount > 0) {
            // Not the original invocation, if called recursively, allow stack to unwind to the parent (do not send end response!)
            return goodContacts;
        }

        // Original request returns here. Merge all partials.
        const allGoodContacts = await SearchController.mergeAndCleanGoodConnectionsFiles(linksDir, goodConnectionsBase, 'good-connections-links.json');

        // Send response
        res.json({
            response: allGoodContacts,
            metadata: {
                totalProfilesAnalyzed: uniqueLinks.length,
                goodContactsFound: allGoodContacts.length,
                successRate: ((allGoodContacts.length / uniqueLinks.length) * 100).toFixed(2) + '%',
                searchParameters: { companyName, companyRole, companyLocation }
            }
        });

    } catch (error) {
        logger.error('Search failed:', error);
        res.status(500).json({
            error: 'Internal server error during search',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        if (puppeteerService) {
            await puppeteerService.close();
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
      // Write combined file
      const allArr = Array.from(allContacts);
      await fs.writeFile(path.join(dir, keepName), JSON.stringify(allArr, null, 2));
      // Remove chunk files
      await Promise.all(files.map(f => fs.unlink(path.join(dir, f))));
      return allArr;
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