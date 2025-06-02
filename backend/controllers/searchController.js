import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import FileHelpers from '../utils/fileHelpers.js';
import PuppeteerService from '../services/puppeteerService.js';
import LinkedInService from '../services/linkedinService.js';

export class SearchController {
  async performSearch(req, res) {
    const { companyName, companyRole, companyLocation, searchName, searchPassword } = req.body;
    
    logger.info('Starting LinkedIn search request', {
      companyName,
      companyRole,
      companyLocation,
      username: searchName ? '[REDACTED]' : 'not provided'
    });

    let puppeteerService;
    
    try {
      // Validate required fields
      if (!companyName || !companyRole || !companyLocation || !searchName || !searchPassword) {
        return res.status(400).json({
          error: 'Missing required fields: companyName, companyRole, companyLocation, searchName, searchPassword'
        });
      }

      // Initialize Puppeteer service
      puppeteerService = new PuppeteerService();
      await puppeteerService.initialize();

      // Initialize LinkedIn service
      const linkedInService = new LinkedInService(puppeteerService);

      // Step 1: Login to LinkedIn
      logger.info('Logging in to LinkedIn with provided credentials');
      await linkedInService.login(searchName, searchPassword);
      logger.info('Successfully logged in to LinkedIn');
      
      // Step 2: Search for company
      const companyFound = await linkedInService.searchCompany(companyName);
      if (!companyFound) {
        return res.status(404).json({
          error: `Company "${companyName}" not found or not accessible`
        });
      }

      // Step 3: Navigate to jobs section and set location
      await linkedInService.navigateToJobs(companyLocation);

      // Step 4: Extract company and geo numbers from URL
      const { extractedCompanyNumber, extractedGeoNumber } = await linkedInService.extractCompanyAndGeoNumbers();
      
      if (!extractedCompanyNumber || !extractedGeoNumber) {
        return res.status(400).json({
          error: 'Failed to extract company or location information from LinkedIn'
        });
      }

      // Step 5: Search through people pages
      const encodedRole = encodeURIComponent(companyRole);
      let allLinks = [];
      
      const { pageNumberStart, pageNumberEnd } = config.linkedin;
      
      for (let pageNumber = pageNumberStart; pageNumber <= pageNumberEnd; pageNumber++) {
        try {
          const pageLinks = await linkedInService.getLinksFromPeoplePage(
            pageNumber, 
            extractedCompanyNumber, 
            encodedRole, 
            extractedGeoNumber
          );
          
          if (pageLinks.length === 0) {
            logger.info(`No more links found, stopping at page ${pageNumber}`);
            break;
          }
          
          allLinks.push(...pageLinks);
          
          // Save progress periodically
          if (pageNumber % 5 === 0) {
            await FileHelpers.writeJSON(config.paths.linksFile, allLinks);
            logger.info(`Progress saved: ${allLinks.length} links after page ${pageNumber}`);
          }
          
        } catch (error) {
          logger.warn(`Error processing page ${pageNumber}:`, error);
          continue; // Continue with next page
        }
      }

      // Remove duplicates
      const uniqueLinks = [...new Set(allLinks)];
      await FileHelpers.writeJSON(config.paths.linksFile, uniqueLinks);
      
      
      logger.info(`Found ${uniqueLinks.length} unique profile links`);

      // Step 6: Analyze contacts for activity
      const goodContacts = [];
      const totalLinks = uniqueLinks.length;
      
      for (let i = 0; i < totalLinks; i++) {
        const link = uniqueLinks[i];
        
        // Skip certain profile types
        if (/ACoA/.test(link)) {
          logger.debug(`Skipping profile with ACoA: ${link}`);
          continue;
        }

        try {
          logger.info(`Analyzing contact ${i + 1}/${totalLinks}: ${link}`);
          
          const isGoodContact = await linkedInService.analyzeContactActivity(link);
          
          if (isGoodContact) {
            goodContacts.push(link);
            logger.info(`Good contact found: ${link} (${goodContacts.length} total)`);
          }

          // Save progress periodically
          if ((i + 1) % 10 === 0) {
            await FileHelpers.writeJSON(config.paths.goodConnectionsFile, goodContacts);
            logger.info(`Progress saved: ${goodContacts.length} good contacts after ${i + 1} analyses`);
          }
          
        } catch (error) {
          logger.warn(`Error analyzing contact ${link}:`, error);
          continue; // Continue with next contact
        }
      }

      // Final save
      await FileHelpers.writeJSON(config.paths.goodConnectionsFile, goodContacts);
      
      logger.info(`Search completed successfully. Found ${goodContacts.length} good contacts out of ${uniqueLinks.length} profiles`);

      // Return results
      res.json({
        response: goodContacts,
        metadata: {
          totalProfilesAnalyzed: uniqueLinks.length,
          goodContactsFound: goodContacts.length,
          successRate: ((goodContacts.length / uniqueLinks.length) * 100).toFixed(2) + '%',
          searchParameters: {
            companyName,
            companyRole,
            companyLocation,
            pagesSearched: pageNumberEnd - pageNumberStart + 1
          }
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
      // Always clean up Puppeteer
      if (puppeteerService) {
        await puppeteerService.close();
      }
    }
  }

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