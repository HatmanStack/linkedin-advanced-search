import { logger } from './logger.js';
import FileHelpers from './fileHelpers.js';
import fs from 'fs/promises';
import path from 'path';

export class ContactProcessor {
  constructor(linkedInService, linkedInContactService, dynamoDBService, config) {
    this.linkedInService = linkedInService;
    this.linkedInContactService = linkedInContactService;
    this.dynamoDBService = dynamoDBService;
    this.config = config;
  }

  async processAllContacts(uniqueLinks, state, onHealingNeeded) {
    const goodContacts = await this._loadExistingGoodContacts();
    let errorQueue = [];
    let i = state.resumeIndex;

    while (i < uniqueLinks.length) {
      const link = uniqueLinks[i];
      
      if (this._shouldSkipProfile(link)) {
        i++;
        continue;
      }

      try {
        const result = await this._processContact(link, state.jwtToken, goodContacts, i, uniqueLinks.length);
        if (result.processed) {
          errorQueue = [];
        }
        i++;
      } catch (error) {
        logger.error(`Error collecting contact: ${link}`);
        errorQueue.push(link);
        i++;
        
        if (errorQueue.length >= 3) {
          const shouldHeal = await this._handleErrorQueue(errorQueue, state.jwtToken, goodContacts);
          errorQueue = [];
          
          if (shouldHeal) {
            const restartParams = await this._prepareHealingRestart(uniqueLinks, i, errorQueue, state);
            await onHealingNeeded(restartParams);
            return;
          }
        }
      }
    }

    return goodContacts;
  }

  async _processContact(link, jwtToken, goodContacts, index, total) {
    logger.info(`Analyzing contact ${index + 1}/${total}: ${link}`);
    const result = await this.linkedInService.analyzeContactActivity(link, jwtToken);

    if (result.isGoodContact) {
      goodContacts.push(link);
      logger.info(`Found good contact: ${link} (${goodContacts.length})`);
      
      // During Search, capture Profile and Recent-Activity, and mark edges as "possible"
      // Temp directory is now managed inside LinkedInContactService
      await this.linkedInContactService.takeScreenShotAndUploadToS3(link, 'possible');
    
      await FileHelpers.writeJSON(this.config.paths.goodConnectionsFile, goodContacts);
    }

    return { processed: true };
  }

  async _handleErrorQueue(errorQueue, jwtToken, goodContacts) {
    logger.warn(`3 errors in a row, pausing 5min and retrying...`);
    const linksToRetry = [...errorQueue];
    
    await new Promise(resolve => setTimeout(resolve, 300000));
    
    let allRetriesFailed = true;
    for (let retry of linksToRetry) {
      try {
        const retryResult = await this.linkedInService.analyzeContactActivity(retry, jwtToken);
        if (retryResult.isGoodContact) {
          goodContacts.push(retry);
          logger.info(`Retry success: ${retry}`);
          allRetriesFailed = false;
        }
      } catch (e) {
        logger.error(`Retry failed: ${retry}`);
      }
    }

    return allRetriesFailed;
  }

  async _prepareHealingRestart(uniqueLinks, currentIndex, errorQueue, state) {
    let restartIndex = currentIndex - errorQueue.length;
    if (restartIndex < 0) restartIndex = 0;
    
    let remainingLinks = uniqueLinks.slice(restartIndex);
    if (remainingLinks[0] !== errorQueue[0]) {
      remainingLinks.unshift(errorQueue[0]);
    }

    const newPartialLinksFile = path.join(
      path.dirname(this.config.paths.linksFile), 
      `possible-links-partial-${Date.now()}.json`
    );
    
    await fs.writeFile(newPartialLinksFile, JSON.stringify(remainingLinks, null, 2));
    logger.info(`Written partial links file: ${newPartialLinksFile}`);

    return {
      ...state,
      resumeIndex: 0,
      recursionCount: state.recursionCount + 1,
      lastPartialLinksFile: newPartialLinksFile
    };
  }

  async _loadExistingGoodContacts() {
    try {
      const fileContent = await fs.readFile(this.config.paths.goodConnectionsFile);
      return JSON.parse(fileContent);
    } catch (error) {
      return [];
    }
  }

  _shouldSkipProfile(link) {
    if (/ACoA/.test(link)) {
      logger.debug(`Skipping profile: ${link}`);
      return true;
    }
    return false;
  }
}
