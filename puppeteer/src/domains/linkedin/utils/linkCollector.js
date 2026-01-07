import { logger } from './logger.js';
import FileHelpers from './fileHelpers.js';
import fs from 'fs/promises';

export class LinkCollector {
  constructor(linkedInService, config) {
    this.linkedInService = linkedInService;
    this.config = config;
  }

  async collectAllLinks(state, companyData, onHealingNeeded) {
    const { extractedCompanyNumber, extractedGeoNumber } = companyData;
    const encodedRole = state.companyRole ? encodeURIComponent(state.companyRole) : null;

    let allLinks = await this._loadExistingLinks();
    const { pageNumberStart, pageNumberEnd } = this.config.linkedin;
    
    let emptyPageCount = 0;
    let pageNumber = this._calculateStartPage(state.resumeIndex, pageNumberStart);

    while (pageNumber <= pageNumberEnd) {
      try {
        const pageLinks = await this.linkedInService.getLinksFromPeoplePage(
          pageNumber, 
          extractedCompanyNumber, 
          encodedRole, 
          extractedGeoNumber
        );

        if (pageLinks.length === 0) {
          emptyPageCount++;
          if (emptyPageCount >= 3 && pageNumber < pageNumberEnd) {
            await onHealingNeeded(pageNumber);
            return;
          }
          pageNumber++;
          continue;
        } else {
          emptyPageCount = 0;
        }

        allLinks.push(...pageLinks);
        await FileHelpers.writeJSON(this.config.paths.linksFile, allLinks);
        pageNumber++;
      } catch (error) {
        logger.warn(`Error on page ${pageNumber}`, error);
        pageNumber++;
        continue;
      }
    }

    return allLinks;
  }

  async _loadExistingLinks() {
    try {
      const fileContent = await fs.readFile(this.config.paths.linksFile);
      return JSON.parse(fileContent);
    } catch {
      return [];
    }
  }

  _calculateStartPage(resumeIndex, pageNumberStart) {
    return resumeIndex !== 0 && resumeIndex > pageNumberStart
      ? resumeIndex
      : pageNumberStart;
  }
}
