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
    this.screenshotsBaseDir = process.env.SCREENSHOTS_DIR || path.join(process.cwd(), 'screenshots');
  }

  /**
   * Waits for dynamic content growth to stabilize, then scrolls to the top.
   * This helps ensure data has populated and the page is positioned correctly
   * before taking a screenshot.
   */
  async _waitForContentStableAndScrollTop() {
    const page = this.puppeteer.getPage();
    logger.debug('Waiting for content to stabilize before screenshot...');

    try {
      // Poll for stability by comparing scrollHeight and text length over time
      const maxChecks = 10;
      let previousHeight = 0;
      let previousTextLength = 0;

      for (let i = 0; i < maxChecks; i++) {
        const { height, textLength } = await page.evaluate(() => ({
          height: document.body.scrollHeight,
          textLength: (document.body.innerText || '').length,
        }));

        const heightDelta = Math.abs(height - previousHeight);
        const textDelta = Math.abs(textLength - previousTextLength);

        // Consider stable if changes are minimal between samples
        if (i > 0 && heightDelta < 50 && textDelta < 200) {
          break;
        }

        previousHeight = height;
        previousTextLength = textLength;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (err) {
      logger.debug(`Stability check skipped/failed: ${err.message}`);
    }

    // Ensure we are at the top before capturing
    try {
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (err) {
      logger.debug(`Scroll-to-top before screenshot failed: ${err.message}`);
    }
  }

  async takeScreenShotAndUploadToS3(profileId, status = 'ally', options = {}) {
    const s3UploadedObjects = [];
    let workingTempDir;

    try {
      logger.info(`Taking screenshots for profile: ${profileId} (status=${status})`);
      workingTempDir = await this._createSessionDirectory(profileId);

      // Capture the required set of screenshots based on status and optional selection
      await this.captureRequiredScreenshots(profileId, workingTempDir, status, options);

      // Collect all PNG screenshots from temp directory
      const allScreenshots = await fs.readdir(workingTempDir);
      const screenshotPaths = allScreenshots
        .filter(name => name.toLowerCase().endsWith('.png'))
        .map(file => path.join(workingTempDir, file));

      // Use a single timestamp for this profile ingestion session
      const sessionTimestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '_');

      // Upload to S3 using consistent timestamp across all screenshots
      const uploadResults = await this._uploadToS3(screenshotPaths, profileId, sessionTimestamp);
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
      // Always clean up the working temp directory after upload is attempted
      if (workingTempDir) await this._cleanup(workingTempDir);
    }
  }

  /**
   * Creates a session-specific temporary directory for screenshots
   */
  async _createSessionDirectory(profileId) {
    try {
      await fs.mkdir(this.screenshotsBaseDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }

    const sessionDir = await fs.mkdtemp(path.join(this.screenshotsBaseDir, `linkedin-screenshots-${profileId}-`));
    return sessionDir;
  }

  /**
   * Capture the required screenshots for a profile depending on the connection status.
   * - ally: Reactions, Profile, Recent Activity, About This Profile, Message History
   * - incoming/outgoing: Reactions, Profile, Recent Activity, About This Profile
   * - possible: Reactions, Profile, Recent Activity
   */
  async captureRequiredScreenshots(profileId, tempDir, status, options = {}) {
    const page = this.puppeteer.getPage();
    // Determine default screens by status; options.screens can override
    let defaultScreens;
    if (status === 'incoming' || status === 'outgoing' || status == 'ally') {
      defaultScreens = ['Reactions', 'Profile', 'Activity', 'Recent-Activity', 'About-This-Profile'];
    } else if (status === 'possible') {
      defaultScreens = ['Reactions', 'Profile', 'Recent-Activity'];
    } else {
      // ally or general: include messages and about profile
      return null;
    }

   
      try {
          const reactionsUrl = `https://www.linkedin.com/in/${profileId}/recent-activity/reactions/`;
          await this.puppeteer.goto(reactionsUrl);
          await RandomHelpers.randomDelay(1200, 2000);
          await this._autoScroll();
          await this._captureSingleScreenshot(tempDir, profileId, 'Reactions');
        
      } catch (err) {
        logger.warn(`Reactions screenshot failed for ${profileId}: ${err.message}`);
      }
  
   
    try {
      
      const profileUrl = `https://www.linkedin.com/in/${profileId}/`;
      await this.puppeteer.goto(profileUrl);
      await RandomHelpers.randomDelay(1500, 2500);
      await this._expandAllContent();
      await this._captureSingleScreenshot(tempDir, profileId, 'Profile');
    } 
      catch (err){
      logger.warn(`Profile page screenshot failed for ${profileId}: ${err.message}`);
    }
  
    try {
      
      const activityUrl = `https://www.linkedin.com/in/${profileId}/recent-activity/all/`;
      await this.puppeteer.goto(activityUrl);
      await RandomHelpers.randomDelay(1500, 2500);
      await this._autoScroll();
      await this._captureSingleScreenshot(tempDir, profileId, 'Recent-Activity');
    } catch (err) {
      logger.warn(`Recent activity (all) screenshot failed for ${profileId}: ${err.message}`);
    }

    
    if (defaultScreens.includes('Activity')) { 
      try {
        const activityPostsUrl = `https://www.linkedin.com/in/${profileId}/recent-activity/posts/`;
        await this.puppeteer.goto(activityPostsUrl);
        await RandomHelpers.randomDelay(1500, 2500);
        await this._autoScroll();
        await this._captureSingleScreenshot(tempDir, profileId, 'Activity');
      } catch (err) {
        logger.warn(`Activity (posts) screenshot failed for ${profileId}: ${err.message}`);
      }
    }

   

    
    if (defaultScreens.includes('About-This-Profile')) {
    try {
      
     
      logger.debug(`Capturing About-This-Profile for ${profileId}`);
      const aboutUrl = `https://www.linkedin.com/in/${profileId}/overlay/about-this-profile/`;
      await this.puppeteer.goto(aboutUrl);
      await RandomHelpers.randomDelay(1500, 2500);
      // Wait briefly to allow overlay to render
      await new Promise(resolve => setTimeout(resolve, 800));
      await this._captureSingleScreenshot(tempDir, profileId, 'About-This-Profile');
      logger.debug(`Successfully captured About-This-Profile for ${profileId}`);
     
  }catch (err) {
      
        logger.warn(`About This Profile screenshot failed for ${profileId}: ${err.message}`);
        logger.debug(`About This Profile error details:`, { profileId, error: err.stack });
    }
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

  async _autoScroll(maxScrolls = 20) {
    await this.puppeteer.getPage().evaluate(async (maxScrolls) => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const delay = 100;
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
    }, maxScrolls);
  }

  async _captureSingleScreenshot(tempDir, profileId, label = 'Profile') {
    logger.info('Starting single screenshot capture...');
    await this.puppeteer.getPage().setViewport({
      width: 1200,
      height: 1200,
      deviceScaleFactor: 1,
    });

    // Wait for content to populate and ensure we are at the top
    await this._waitForContentStableAndScrollTop();

    // Keep a raw temp file name; final name includes unified timestamp during upload
    const screenshotPath = path.join(tempDir, `raw-${uuidv4()}.png`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.puppeteer.screenshot(screenshotPath, { fullPage: true });
    logger.info('Captured single screenshot.');

    // Crop the screenshot to width 850, left 0, top 0, keep original height

    const sanitized = String(label).replace(/[^a-z0-9\-]/gi, '-');
    // Keep filename without timestamp here; timestamp applied at upload
    const croppedPath = path.join(tempDir, `${profileId}-${sanitized}.png`);

    const image = sharp(screenshotPath);
    const metadata = await image.metadata();
    // Preserve original analyzeContact sizing for Reactions; keep existing for others
    const isReactions = String(label).toLowerCase() === 'reactions';
    const cropLeft = isReactions ? 300 : 0;
    const cropWidth = isReactions ? 575 : 850;
    await image
      .extract({ left: cropLeft, top: 0, width: cropWidth, height: metadata.height })
      .toFile(croppedPath);
    logger.info(`Saved screenshot ${croppedPath}`);

    // Delete the original screenshot after cropping
    await fs.unlink(screenshotPath);

    return [croppedPath];
  }

  async _uploadToS3(screenshotPaths, profileId, sessionTimestamp) {
    logger.info(`Uploading ${screenshotPaths.length} screenshots to S3...`);

    const uploadOne = async (absPath, index) => {
      let fileName = path.basename(absPath).replace(/\.png$/i, '');
      if (!fileName.includes(sessionTimestamp)) {
        const base = fileName.replace(/-\d{4}-\d{2}-\d{2}T.*/, '');
        fileName = `${base}-${sessionTimestamp}`;
      }
      const s3Key = `linkedin-profiles/${profileId}/${fileName}.png`;
      try {
        const screenshotBuffer = await fs.readFile(absPath);
        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
          Body: screenshotBuffer,
          ContentType: 'image/png',
        });
        const result = await this.s3Client.send(command);
        if (result.$metadata.httpStatusCode === 200) {
          const s3ObjectUrl = `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-west-2'}.amazonaws.com/${s3Key}`;
          const cloudFrontUrl = `https://${this.cloudFrontDomain}/${s3Key}`;
          logger.debug(`Uploaded screenshot ${index} to S3: ${s3Key}`);
          return { s3ObjectUrl, cloudFrontUrl, s3Key };
        }
        throw new Error(`Unexpected status ${result.$metadata.httpStatusCode}`);
      } catch (err) {
        logger.error(`Failed to upload screenshot ${index} (${absPath}):`, err);
        return null;
      }
    };

    const settled = await Promise.allSettled(screenshotPaths.map((p, idx) => uploadOne(p, idx)));
    const uploadResults = settled
      .map(r => (r.status === 'fulfilled' ? r.value : null))
      .filter(Boolean);
    logger.info(`Uploaded ${uploadResults.length}/${screenshotPaths.length} screenshots to S3.`);
    return uploadResults;
  }

  async _cleanup(tempDir) {
    try {
      //await fs.rm(tempDir, { recursive: true, force: true });
      logger.debug(`Cleaned up temporary directory: ${tempDir}`);
    } catch (error) {
      logger.error(`Cleanup failed for ${tempDir}:`, error);
    }
  }
}

export default LinkedInContactService;
