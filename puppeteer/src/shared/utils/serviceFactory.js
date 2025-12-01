

import { PuppeteerService } from '../../domains/automation/services/puppeteerService.js';
import { LinkedInService } from '../../domains/linkedin/services/linkedinService.js';
import { LinkedInContactService } from '../../domains/linkedin/services/linkedinContactService.js';
import { DynamoDBService } from '../../domains/storage/services/dynamoDBService.js';


export async function initializeLinkedInServices() {
  const puppeteerService = new PuppeteerService();
  await puppeteerService.initialize();

  return {
    puppeteerService,
    linkedInService: new LinkedInService(puppeteerService),
    linkedInContactService: new LinkedInContactService(puppeteerService),
    dynamoDBService: new DynamoDBService()
  };
}


export async function cleanupLinkedInServices(services) {
  if (services?.puppeteerService) {
    await services.puppeteerService.close();
  }
}
