import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger.js';
import RandomHelpers from '../utils/randomHelpers.js';

export class LinkedInContactService {
  constructor(puppeteerService) {
    this.puppeteer = puppeteerService;
    this.s3Client = new S3Client({ 
      region: process.env.AWS_REGION || "us-west-2" 
    });
    this.bucketName = process.env.S3_SCREENSHOT_BUCKET_NAME || "";
    this.cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN || "";
  }

  async takeScreenshot(profileUrl) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'linkedin-screenshots-'));
    const screenshotPaths = [];
    const s3UploadedObjects = [];

    try {
      logger.info(`Taking screenshots for profile: ${profileUrl}`);
      
      // Navigate to profile
      await this.puppeteer.goto(profileUrl);
      await RandomHelpers.randomDelay(2000, 4000);

      // Expand all content
      await this._expandAllContent();
      
      // Take scrolling screenshots
      const screenshots = await this._captureScrollingScreenshots(tempDir);
      screenshotPaths.push(...screenshots);

      // Upload to S3
      const uploadResults = await this._uploadToS3(screenshotPaths, profileUrl);
      s3UploadedObjects.push(...uploadResults);

      logger.info(`Successfully captured ${s3UploadedObjects.length} screenshots`);
      
      return {
        success: true,
        message: `Screenshots captured and uploaded (${s3UploadedObjects.length} parts)`,
        data: {
          cloudFrontUrls: s3UploadedObjects.map(obj => obj.cloudFrontUrl),
          s3ObjectUrls: s3UploadedObjects.map(obj => obj.s3ObjectUrl),
          profileUrl
        }
      };

    } catch (error) {
      logger.error(`Screenshot capture failed for ${profileUrl}:`, error);
      return {
        success: false,
        message: `Failed to capture screenshots: ${error.message}`
      };
    } finally {
      await this._cleanup(tempDir);
    }
  }

  async _expandAllContent() {
    logger.info('Expanding all "see more" content...');
    
    // Initial scroll to load content
    await this._autoScroll();
    
    // Find and click "see more" buttons
    const seeMoreSelectors = [
      '::-p-aria(…see more)',
      '::-p-text(…see more)',
      '::-p-text(see more)',
      'button[aria-expanded="false"]'
    ];

    let attempts = 0;
    const maxAttempts = 10;
    let foundButtons = false;

    do {
      foundButtons = false;
      attempts++;
      logger.debug(`Expansion attempt ${attempts}`);

      for (const selector of seeMoreSelectors) {
        try {
          const buttons = await this.puppeteer.getPage()
            .locator(selector)
            .setVisibility('visible')
            .queryAll();
          
          for (const button of buttons) {
            await button.click({ timeout: 5000, delay: 500 });
            foundButtons = true;
            await RandomHelpers.randomDelay(1000, 2000);
          }
        } catch (error) {
          logger.debug(`Selector ${selector} failed: ${error.message}`);
        }
      }
    } while (foundButtons && attempts < maxAttempts);

    logger.info(`Content expansion completed after ${attempts} attempts`);
  }

  async _autoScroll() {
    await this.puppeteer.getPage().evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const delay = 100;
        const maxScrolls = 200;
        let scrolls = 0;

        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          scrolls++;

          if (totalHeight >= scrollHeight - window.innerHeight || scrolls >= maxScrolls) {
            clearInterval(timer);
            resolve();
          }
        }, delay);
      });
    });
  }

  async _captureScrollingScreenshots(tempDir) {
    logger.info('Starting scrolling screenshot capture...');
    
    const screenshotPaths = [];
    
    // Scroll to top
    await this.puppeteer.getPage().evaluate(() => window.scrollTo(0, 0));
    await RandomHelpers.randomDelay(1000, 2000);

    let screenshotIndex = 0;
    let moreToScroll = true;
    const maxScreenshots = 20;

    while (moreToScroll && screenshotIndex < maxScreenshots) {
      const tempFilePath = path.join(tempDir, `screenshot-${screenshotIndex}-${uuidv4()}.png`);
      
      await this.puppeteer.screenshot(tempFilePath, { fullPage: false });
      screenshotPaths.push(tempFilePath);
      
      logger.debug(`Captured screenshot ${screenshotIndex}`);
      screenshotIndex++;

      // Scroll by viewport height
      const scrollInfo = await this.puppeteer.getPage().evaluate(() => {
        const pageHeight = document.body.scrollHeight;
        const viewportHeight = window.innerHeight;
        const currentScroll = window.scrollY;
        
        window.scrollBy(0, viewportHeight);
        
        return {
          pageHeight,
          viewportHeight,
          previousScroll: currentScroll,
          newScroll: window.scrollY
        };
      });

      await RandomHelpers.randomDelay(1000, 2000);

      // Check if we've reached the bottom
      if (scrollInfo.newScroll <= scrollInfo.previousScroll || 
          (scrollInfo.newScroll + scrollInfo.viewportHeight) >= scrollInfo.pageHeight) {
        moreToScroll = false;
        logger.info('Reached end of page');
      }
    }

    logger.info(`Captured ${screenshotPaths.length} screenshots`);
    return screenshotPaths;
  }

  async _uploadToS3(screenshotPaths, profileUrl) {
    logger.info('Uploading screenshots to S3...');
    
    const uploadResults = [];
    const profileId = profileUrl.split('/').filter(Boolean).pop() || 'unknown-profile';
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '_');

    for (let i = 0; i < screenshotPaths.length; i++) {
      const filePath = screenshotPaths[i];
      const screenshotBuffer = await fs.readFile(filePath);
      const s3Key = `linkedin-profiles/${profileId}/${timestamp}-part-${i}-${uuidv4()}.png`;

      try {
        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
          Body: screenshotBuffer,
          ContentType: 'image/png',
        });

        const result = await this.s3Client.send(command);
        
        if (result.$metadata.httpStatusCode === 200) {
          const s3ObjectUrl = `https://${this.bucketName}.s3.${process.env.AWS_REGION || "us-west-2"}.amazonaws.com/${s3Key}`;
          const cloudFrontUrl = `https://${this.cloudFrontDomain}/${s3Key}`;
          uploadResults.push({ s3ObjectUrl, cloudFrontUrl, s3Key });
          logger.debug(`Uploaded screenshot ${i} to S3 and available via CloudFront`);
        }
      } catch (error) {
        logger.error(`Failed to upload screenshot ${i}:`, error);
      }
    }

    return uploadResults;
  }

  async _cleanup(tempDir) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      logger.debug(`Cleaned up temporary directory: ${tempDir}`);
    } catch (error) {
      logger.error(`Cleanup failed for ${tempDir}:`, error);
    }
  }
}

export default LinkedInContactService;
