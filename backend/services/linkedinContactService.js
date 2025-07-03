import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';
import RandomHelpers from '../utils/randomHelpers.js';
import sharp from 'sharp';

export class LinkedInContactService {
  constructor(puppeteerService) {
    this.puppeteer = puppeteerService;
    this.s3Client = new S3Client({ 
      region: process.env.AWS_REGION || "us-west-2" 
    });
    this.bucketName = process.env.S3_SCREENSHOT_BUCKET_NAME || "";
    this.cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN || "";
  }

  async takeScreenShotAndUploadToS3(profileId, tempDir) {
    const s3UploadedObjects = [];
    
    try {
      logger.info(`Taking screenshots for profile: ${profileId}`);
      
      const profileUrl = `https://www.linkedin.com/in/${profileId}/`;
      
      await this.puppeteer.goto(profileUrl);
      await RandomHelpers.randomDelay(2000, 4000);
      
      await this._expandAllContent();
      const screenshotPath = await this._captureSingleScreenshot(tempDir, profileId);
      
      // Collect all screenshots from temp directory
      const allScreenshots = await fs.readdir(tempDir);
      const screenshotPaths = allScreenshots.map(file => path.join(tempDir, file));

      // Upload to S3
      const uploadResults = await this._uploadToS3(screenshotPaths, profileId);
      s3UploadedObjects.push(...uploadResults);

      logger.info(`Successfully captured ${s3UploadedObjects.length} screenshots`);
      
      return {
        success: true,
        message: `Screenshots captured and uploaded (${s3UploadedObjects.length} parts)`,
        data: {
          cloudFrontUrls: s3UploadedObjects.map(obj => obj.cloudFrontUrl),
          s3ObjectUrls: s3UploadedObjects.map(obj => obj.s3ObjectUrl),
          profileId
        }
      };

    } catch (error) {
      logger.error(`Screenshot capture failed for ${profileId}:`, error);
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
      '::-p-text(see more)'
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
          // Wait for at least one button to appear (optional, can skip if not sure)
          const buttons = await this.puppeteer.getPage().$$(`${selector}`);
          for (const button of buttons) {
            try {
              await button.click({ delay: 500 });
              foundButtons = true;
              await RandomHelpers.randomDelay(1000, 2000);
            } catch (err) {
              logger.debug(`Failed to click button for selector ${selector}: ${err.message}`);
            }
          }
        } catch (error) {
          logger.debug(`Selector ${selector} failed: ${error.message}`);
        }
      }
    } while (foundButtons && attempts < maxAttempts);
    await this.puppeteer.getPage().evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
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

  async _captureSingleScreenshot(tempDir, profileId) {
    logger.info('Starting single screenshot capture...');
    const screenshotPath = path.join(tempDir, `screenshot-${uuidv4()}.png`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.puppeteer.screenshot(screenshotPath, { fullPage: true });
    logger.info('Captured single screenshot.');

    // Crop the screenshot to width 850, left 0, top 0, keep original height
    
    const croppedPath = path.join(tempDir, `${profileId}-Profile.png`);
    
    const image = sharp(screenshotPath);
    const metadata = await image.metadata();
    await image
      .extract({ left: 0, top: 0, width: 850, height: metadata.height })
      .toFile(croppedPath);
    logger.info('Cropped screenshot to width 300px from left 0, top 0.');

    // Delete the original screenshot after cropping
    await fs.unlink(screenshotPath);

    return [croppedPath];
}

  async _uploadToS3(screenshotPaths, profileId) {
    logger.info('Uploading screenshots to S3...');
    
    const uploadResults = [];
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '_');

    for (let i = 0; i < screenshotPaths.length; i++) {
      let fileName = path.basename(screenshotPaths[i]);
      fileName = fileName.replace(/\.png$/i, ''); 
      const screenshotBuffer = await fs.readFile(screenshotPaths[i]);
      const s3Key = `linkedin-profiles/${profileId}/${fileName}-${timestamp}.png`;

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
