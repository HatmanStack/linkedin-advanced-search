# Phase 2: Integration and Cleanup

## Phase Goal

Integrate the RAGStack client (from Phase 1) with the existing LinkedIn contact service, update all callers to use the new methods, and remove deprecated screenshot pipeline code.

**Success Criteria:**
- LinkedInContactService uses RAGStack scrapeProfile() method
- All callers updated to use scrapeProfile() instead of deprecated method
- Screenshot and text extraction services deleted
- Orphaned configuration cleaned up
- All tests pass without external dependencies

**Estimated Tokens:** ~35,000

---

## Prerequisites

- **Phase 1 complete** - RAGStack client components exist and tests pass
- Puppeteer backend builds successfully

---

## Task 1: Refactor LinkedInContactService

### Goal
Replace screenshot-based data collection with RAGStack scraping in the LinkedInContactService.

### Files to Modify
- `puppeteer/src/domains/linkedin/services/linkedinContactService.js` - MAJOR REFACTOR (rename to .ts)

### Prerequisites
- Phase 1 Tasks 1-4 complete (RAGStack client ready)

### Implementation Steps

1. **Rename file** from `.js` to `.ts`:
   ```bash
   git mv puppeteer/src/domains/linkedin/services/linkedinContactService.js \
          puppeteer/src/domains/linkedin/services/linkedinContactService.ts
   ```

2. **Rewrite the service** to use RAGStack:

   **Remove these imports:**
   - `S3Client`, `PutObjectCommand` from `@aws-sdk/client-s3`
   - `uuid`
   - `fs/promises`
   - `sharp`
   - `TextExtractionService`
   - `S3TextUploadService`

   **Add these imports:**
   ```typescript
   import { RagstackScrapeService, extractLinkedInCookies } from '../../ragstack/index.js';
   import { ragstackConfig } from '#shared-config/index.js';
   import type { ScrapeJob } from '../../ragstack/types/ragstack.js';
   ```

   **Simplify constructor:**
   ```typescript
   export class LinkedInContactService {
     private puppeteer: PuppeteerService;
     private ragstackService: RagstackScrapeService | null = null;

     constructor(puppeteerService: PuppeteerService) {
       this.puppeteer = puppeteerService;

       // Initialize RAGStack if configured
       if (ragstackConfig.isConfigured()) {
         this.ragstackService = new RagstackScrapeService();
       } else {
         logger.warn('RAGStack not configured. Profile scraping disabled.');
       }
     }
   }
   ```

   **Add new `scrapeProfile` method:**
   ```typescript
   /**
    * Scrape a LinkedIn profile using RAGStack.
    *
    * @param profileId - LinkedIn profile ID (e.g., "john-doe")
    * @param status - Connection status (for metadata, not used in scraping)
    * @returns Scrape result with job details
    */
   async scrapeProfile(
     profileId: string,
     status: string = 'possible'
   ): Promise<ScrapeProfileResult> {
     if (!this.ragstackService) {
       return {
         success: false,
         message: 'RAGStack not configured',
         profileId,
       };
     }

     const page = this.puppeteer.getPage();
     if (!page) {
       return {
         success: false,
         message: 'Browser not initialized',
         profileId,
       };
     }

     try {
       logger.info(`Starting RAGStack scrape for profile: ${profileId}`);

       // Extract cookies from current session
       const cookies = await extractLinkedInCookies(page);

       // Start scrape job
       const job = await this.ragstackService.startScrape(profileId, cookies);
       logger.info(`Scrape job started: ${job.jobId}`, { profileId, status: job.status });

       // Wait for completion (with timeout)
       const finalJob = await this.ragstackService.waitForCompletion(job.jobId, {
         pollInterval: 3000,  // 3 seconds
         timeout: 180000,     // 3 minutes
       });

       const success = finalJob.status === 'COMPLETED';

       logger.info(`Scrape job ${success ? 'completed' : 'failed'}: ${job.jobId}`, {
         profileId,
         status: finalJob.status,
         processedCount: finalJob.processedCount,
         totalUrls: finalJob.totalUrls,
       });

       return {
         success,
         message: success
           ? `Profile scraped successfully (${finalJob.processedCount} pages)`
           : `Scrape failed with status: ${finalJob.status}`,
         profileId,
         jobId: job.jobId,
         scrapeJob: finalJob,
       };
     } catch (error) {
       const message = error instanceof Error ? error.message : String(error);
       logger.error(`Profile scrape failed for ${profileId}:`, { error: message });

       return {
         success: false,
         message: `Scrape failed: ${message}`,
         profileId,
       };
     }
   }
   ```

   **Add result type:**
   ```typescript
   export interface ScrapeProfileResult {
     success: boolean;
     message: string;
     profileId: string;
     jobId?: string;
     scrapeJob?: ScrapeJob;
   }
   ```

   **Delete these methods entirely:**
   - `_waitForContentStableAndScrollTop()`
   - `_createSessionDirectory()`
   - `captureRequiredScreenshots()`
   - `_expandAllContent()`
   - `_autoScroll()`
   - `_captureSingleScreenshot()`
   - `_uploadToS3()`
   - `_cleanup()`

   **Keep backward compatibility (temporarily):**
   ```typescript
   /**
    * @deprecated Use scrapeProfile() instead. This method now calls scrapeProfile.
    */
   async takeScreenShotAndUploadToS3(
     profileId: string,
     status: string = 'ally',
     _options: Record<string, unknown> = {}
   ): Promise<{ success: boolean; message: string; data?: unknown }> {
     logger.warn('takeScreenShotAndUploadToS3 is deprecated. Use scrapeProfile().');
     const result = await this.scrapeProfile(profileId, status);
     return {
       success: result.success,
       message: result.message,
       data: result.scrapeJob ? { jobId: result.jobId } : undefined,
     };
   }
   ```

3. **Update type imports** throughout the file for Puppeteer types.

### Verification Checklist
- [x] Service compiles as TypeScript
- [x] Constructor initializes RAGStack service when configured
- [x] `scrapeProfile()` extracts cookies and starts scrape job
- [x] `scrapeProfile()` waits for job completion
- [x] `scrapeProfile()` handles errors gracefully
- [x] Deprecated `takeScreenShotAndUploadToS3()` calls new method
- [x] All screenshot-related code removed
- [x] No S3 imports remain
- [x] No sharp/fs imports remain

### Testing Instructions

Create `puppeteer/src/domains/linkedin/services/linkedinContactService.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LinkedInContactService } from './linkedinContactService.js';

// Mock dependencies
vi.mock('../../ragstack/index.js', () => ({
  RagstackScrapeService: vi.fn().mockImplementation(() => ({
    startScrape: vi.fn(),
    waitForCompletion: vi.fn(),
  })),
  extractLinkedInCookies: vi.fn(),
}));

vi.mock('#shared-config/index.js', () => ({
  ragstackConfig: {
    isConfigured: vi.fn().mockReturnValue(true),
  },
}));

import { RagstackScrapeService, extractLinkedInCookies } from '../../ragstack/index.js';
import { ragstackConfig } from '#shared-config/index.js';

describe('LinkedInContactService', () => {
  let service: LinkedInContactService;
  let mockPuppeteerService: any;
  let mockRagstackService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPuppeteerService = {
      getPage: vi.fn().mockReturnValue({
        cookies: vi.fn().mockResolvedValue([]),
      }),
    };

    mockRagstackService = {
      startScrape: vi.fn().mockResolvedValue({
        jobId: 'job-123',
        status: 'PENDING',
      }),
      waitForCompletion: vi.fn().mockResolvedValue({
        jobId: 'job-123',
        status: 'COMPLETED',
        processedCount: 2,
        totalUrls: 2,
      }),
    };

    (RagstackScrapeService as any).mockImplementation(() => mockRagstackService);
    (extractLinkedInCookies as any).mockResolvedValue('li_at=token');
    (ragstackConfig.isConfigured as any).mockReturnValue(true);

    service = new LinkedInContactService(mockPuppeteerService);
  });

  describe('scrapeProfile', () => {
    it('should scrape profile successfully', async () => {
      const result = await service.scrapeProfile('john-doe');

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job-123');
      expect(extractLinkedInCookies).toHaveBeenCalled();
      expect(mockRagstackService.startScrape).toHaveBeenCalledWith('john-doe', 'li_at=token');
      expect(mockRagstackService.waitForCompletion).toHaveBeenCalledWith('job-123', expect.any(Object));
    });

    it('should return failure when RAGStack not configured', async () => {
      (ragstackConfig.isConfigured as any).mockReturnValue(false);
      const unconfiguredService = new LinkedInContactService(mockPuppeteerService);

      const result = await unconfiguredService.scrapeProfile('john-doe');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not configured');
    });

    it('should handle scrape failures', async () => {
      mockRagstackService.waitForCompletion.mockResolvedValue({
        jobId: 'job-123',
        status: 'FAILED',
      });

      const result = await service.scrapeProfile('john-doe');

      expect(result.success).toBe(false);
      expect(result.message).toContain('FAILED');
    });

    it('should handle errors gracefully', async () => {
      mockRagstackService.startScrape.mockRejectedValue(new Error('Network error'));

      const result = await service.scrapeProfile('john-doe');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network error');
    });
  });

  describe('takeScreenShotAndUploadToS3 (deprecated)', () => {
    it('should call scrapeProfile internally', async () => {
      const result = await service.takeScreenShotAndUploadToS3('john-doe', 'ally');

      expect(result.success).toBe(true);
      expect(mockRagstackService.startScrape).toHaveBeenCalled();
    });
  });
});
```

Run: `npm test -- linkedinContactService.test.ts`

### Commit Message Template
```
refactor(linkedin): replace screenshots with RAGStack scraping

- Convert linkedinContactService to TypeScript
- Add scrapeProfile() method using RAGStack API
- Integrate cookie extraction for authenticated scraping
- Remove screenshot capture, S3 upload, and text extraction
- Deprecate takeScreenShotAndUploadToS3 with redirect to new method
```

---

## Task 2: Verify Service Factory

### Goal
Verify the service factory works with the refactored TypeScript services.

### Files to Verify
- `puppeteer/src/shared/utils/serviceFactory.js` - VERIFY (likely no changes needed)

### Prerequisites
- Task 1 complete (LinkedInContactService refactored)

### Implementation Steps

1. **Understand tsx resolution behavior:**

   The codebase uses `tsx` for runtime TypeScript compilation. This means:
   - `.js` import extensions automatically resolve to `.ts` files
   - No changes are needed for existing imports

   The current imports already work:
   ```javascript
   import { PuppeteerService } from '../../domains/automation/services/puppeteerService.js';
   import { LinkedInService } from '../../domains/linkedin/services/linkedinService.js';
   import { LinkedInContactService } from '../../domains/linkedin/services/linkedinContactService.js';
   ```

   These resolve to the `.ts` versions at runtime via tsx.

2. **Verify the factory still works** by checking:
   - `initializeLinkedInServices()` returns all expected services
   - `cleanupLinkedInServices()` properly cleans up
   - The LinkedInContactService instance has the new `scrapeProfile()` method

3. **No code changes required** unless imports fail at runtime.

### Verification Checklist
- [x] Factory loads without import errors
- [x] Factory function returns LinkedInContactService instance
- [x] Returned LinkedInContactService has `scrapeProfile()` method
- [x] No compilation errors

### Testing Instructions

Existing tests should continue to pass. Run:
```bash
npm test -- serviceFactory
```

If no tests exist, verify manually:
```typescript
// Quick verification in test file
import { initializeLinkedInServices } from './serviceFactory.js';

const services = await initializeLinkedInServices();
console.log('scrapeProfile exists:', typeof services.linkedInContactService.scrapeProfile === 'function');
```

### Commit Message Template
```
test(utils): verify serviceFactory works with TypeScript services
```

---

## Task 3: Remove Deprecated Files

### Goal
Delete the deprecated text extraction and S3 upload services.

### Files to Delete
- `puppeteer/src/domains/profile/services/textExtractionService.js`
- `puppeteer/src/domains/storage/services/s3TextUploadService.js`
- `puppeteer/schemas/profileTextSchema.js` (orphaned after textExtractionService removal)

### Prerequisites
- Task 1 complete (LinkedInContactService no longer imports these)
- Task 2 complete (service factory verified)

### Implementation Steps

1. **Verify no other imports exist:**
   ```bash
   # From puppeteer directory
   grep -r "textExtractionService" src/ --include="*.js" --include="*.ts"
   grep -r "s3TextUploadService" src/ --include="*.js" --include="*.ts"
   ```

   If any imports found (besides the files themselves), update those files first.

2. **Delete the service files:**
   ```bash
   git rm puppeteer/src/domains/profile/services/textExtractionService.js
   git rm puppeteer/src/domains/storage/services/s3TextUploadService.js
   ```

3. **Check for related test files and delete if they exist:**
   ```bash
   # If these exist, delete them too
   git rm puppeteer/src/domains/profile/services/textExtractionService.test.js 2>/dev/null || true
   git rm puppeteer/src/domains/storage/services/s3TextUploadService.test.js 2>/dev/null || true
   ```

4. **Delete the orphaned schema file:**

   The `textExtractionService.js` imports from `#schemas/profileTextSchema.js`. Check usage:
   ```bash
   # Search entire puppeteer directory (not just src/)
   grep -r "profileTextSchema" . --include="*.js" --include="*.ts" | grep -v "node_modules"
   ```

   **Expected findings:**
   - `textExtractionService.js` - actual import (being deleted)
   - `profileMarkdownGenerator.js` - comment reference only (not an import)
   - `setupTests.js` - comment reference only (not an import)

   Since only `textExtractionService.js` actually imports it, delete the schema:
   ```bash
   git rm puppeteer/schemas/profileTextSchema.js
   ```

### Verification Checklist
- [x] `textExtractionService.js` deleted
- [x] `s3TextUploadService.js` deleted
- [x] `schemas/profileTextSchema.js` deleted
- [x] No remaining imports of deleted files
- [x] TypeScript/build still compiles: `npm run build` or `npx tsc --noEmit`
- [x] Tests still pass: `npm test`

### Testing Instructions

Run full test suite to ensure nothing is broken:
```bash
npm test
npm run lint
npx tsc --noEmit
```

### Commit Message Template
```
chore(cleanup): remove deprecated screenshot pipeline services

- Delete textExtractionService.js (replaced by RAGStack)
- Delete s3TextUploadService.js (no longer needed)
- Delete profileTextSchema.js (orphaned)
- Remove related test files if present
```

---

## Task 4: Update Environment Documentation

### Goal
Document the new RAGStack environment variables and create `.env.example`.

### Files to Create/Modify
- `puppeteer/.env.example` - CREATE (doesn't exist)
- `puppeteer/README.md` - MODIFY (if environment section exists)

### Prerequisites
- Phase 1 Task 1 complete (config added)

### Implementation Steps

1. **Create `.env.example`:**
   ```bash
   # =============================================================================
   # Server Configuration
   # =============================================================================
   PORT=3001
   NODE_ENV=development

   # =============================================================================
   # LinkedIn Configuration
   # =============================================================================
   LINKEDIN_TESTING_MODE=false
   # LINKEDIN_BASE_URL=https://www.linkedin.com

   # =============================================================================
   # RAGStack Integration (Profile Scraping)
   # =============================================================================
   # GraphQL endpoint for RAGStack-Lambda
   RAGSTACK_GRAPHQL_ENDPOINT=https://xxx.appsync-api.us-east-1.amazonaws.com/graphql

   # API key for RAGStack authentication (from RAGStack dashboard Settings)
   RAGSTACK_API_KEY=da2-xxxxxxxxxxxx

   # Optional: Scrape configuration overrides
   # RAGSTACK_SCRAPE_MAX_PAGES=5
   # RAGSTACK_SCRAPE_MAX_DEPTH=1
   # RAGSTACK_SCRAPE_MODE=FULL

   # =============================================================================
   # Puppeteer Configuration
   # =============================================================================
   HEADLESS=true
   # SLOW_MO=50
   # VIEWPORT_WIDTH=1200
   # VIEWPORT_HEIGHT=1200
   ```

2. **Update README.md** (if it has an environment variables section):
   - Add RAGStack section describing the new variables
   - Note that profile scraping requires RAGStack to be deployed

### Verification Checklist
- [ ] `.env.example` created with RAGStack variables
- [ ] Variables have descriptive comments
- [ ] README updated if applicable

### Testing Instructions

Verify environment loading:
```bash
# Copy example and set real values
cp .env.example .env.test
# Edit .env.test with real values

# Verify config loads (from puppeteer directory)
npx tsx -e "import c from './config/index.js'; console.log('RAGStack:', c.ragstack?.isConfigured?.() ?? 'not found')"
```

### Commit Message Template
```
docs(env): add RAGStack environment variables

- Create .env.example with all configuration
- Add RAGSTACK_GRAPHQL_ENDPOINT and RAGSTACK_API_KEY
- Add optional scrape configuration overrides
```

---

## Task 5: Update Callers and Clean Up Orphaned Code

### Goal
Update all callers of the deprecated `takeScreenShotAndUploadToS3` method to use the new `scrapeProfile()` method, and remove orphaned configuration files.

### Files to Modify
- `puppeteer/src/domains/linkedin/utils/contactProcessor.js` - Update method call
- `puppeteer/src/domains/profile/services/profileInitService.ts` - Update method call
- `puppeteer/src/domains/profile/services/profileInitService.test.js` - Update mock
- `puppeteer/config/index.js` - Remove orphaned config sections

### Files to Delete
- `puppeteer/config/extractionConfig.js` - Orphaned (was only used by textExtractionService)

### Prerequisites
- Task 1 complete (LinkedInContactService has scrapeProfile method)
- Task 3 complete (deprecated services deleted)

### Implementation Steps

1. **Update contactProcessor.js (line ~64):**

   Find the call to `takeScreenShotAndUploadToS3` and replace with `scrapeProfile`:

   ```javascript
   // Before:
   const result = await linkedInContactService.takeScreenShotAndUploadToS3(profileId, status);

   // After:
   const result = await linkedInContactService.scrapeProfile(profileId, status);
   ```

   The return type is compatible - both return `{ success: boolean, message: string, ... }`.

2. **Update profileInitService.ts (line ~1027):**

   Find the call to `takeScreenShotAndUploadToS3` and replace:

   ```typescript
   // Before:
   const result = await this.linkedInContactService.takeScreenShotAndUploadToS3(profileId, status);

   // After:
   const result = await this.linkedInContactService.scrapeProfile(profileId, status);
   ```

3. **Update profileInitService.test.js (line ~83):**

   Update the mock to use the new method name:

   ```javascript
   // Before:
   takeScreenShotAndUploadToS3: vi.fn().mockResolvedValue({ success: true, ... })

   // After:
   scrapeProfile: vi.fn().mockResolvedValue({ success: true, message: 'Scraped', profileId: 'test' })
   ```

4. **Remove orphaned config from config/index.js:**

   Remove these sections that are no longer used:

   ```javascript
   // DELETE: Line 4 - import extractionConfig
   import extractionConfig from './extractionConfig.js';

   // DELETE: Lines ~161-162 - paths.screenshots
   paths: {
     screenshots: process.env.SCREENSHOTS_DIR || './screenshots',  // DELETE this line
     linksFile: process.env.LINKS_FILE || './data/possible-links.json',
     goodConnectionsFile: process.env.GOOD_CONNECTIONS_FILE || './data/good-connections-links.json',
   },

   // DELETE: Lines ~167-180 - s3.screenshots and s3.profileText
   s3: {
     screenshots: {  // DELETE entire block
       bucket: process.env.S3_SCREENSHOT_BUCKET_NAME || '',
       region: process.env.AWS_REGION || 'us-west-2',
     },
     profileText: {  // DELETE entire block
       bucket: process.env.S3_PROFILE_TEXT_BUCKET_NAME || ...
       prefix: process.env.S3_PROFILE_TEXT_PREFIX || ...
       region: process.env.S3_PROFILE_TEXT_REGION || ...
     },
   },

   // DELETE: Line ~183 - extraction config
   extraction: extractionConfig,
   ```

5. **Delete extractionConfig.js:**
   ```bash
   git rm puppeteer/config/extractionConfig.js
   ```

6. **Verify no other references exist:**
   ```bash
   grep -r "extractionConfig" . --include="*.js" --include="*.ts" | grep -v node_modules
   grep -r "paths.screenshots" . --include="*.js" --include="*.ts" | grep -v node_modules
   grep -r "s3.screenshots" . --include="*.js" --include="*.ts" | grep -v node_modules
   grep -r "s3.profileText" . --include="*.js" --include="*.ts" | grep -v node_modules
   ```

### Verification Checklist
- [ ] contactProcessor.js calls `scrapeProfile()` instead of deprecated method
- [ ] profileInitService.ts calls `scrapeProfile()` instead of deprecated method
- [ ] profileInitService.test.js mocks `scrapeProfile()` method
- [ ] extractionConfig.js deleted
- [ ] config/index.js no longer imports extractionConfig
- [ ] config/index.js no longer has s3.screenshots, s3.profileText, paths.screenshots
- [ ] All tests pass: `npm test`
- [ ] No grep results for orphaned config references

### Testing Instructions

Run tests for affected files:
```bash
npm test -- contactProcessor
npm test -- profileInitService
```

Then run full suite:
```bash
npm test
npm run lint
npx tsc --noEmit
```

### Commit Message Template
```
refactor(cleanup): update callers and remove orphaned config

- Update contactProcessor.js to use scrapeProfile()
- Update profileInitService.ts to use scrapeProfile()
- Update profileInitService.test.js mock
- Delete extractionConfig.js (orphaned)
- Remove s3.screenshots, s3.profileText, paths.screenshots from config
- Remove extraction config import
```

---

## Phase Verification

After completing all tasks, verify the phase is complete:

### Build Verification
```bash
cd puppeteer
npx tsc --noEmit
npm run lint
```

### Test Verification
```bash
npm test
```

### Integration Verification

Create a simple integration test script (don't commit, just for verification):

```typescript
// test-ragstack-integration.ts
import { RagstackScrapeService } from './src/domains/ragstack/index.js';
import { ragstackConfig } from './src/shared/config/index.js';

async function verify() {
  console.log('Phase 2 Verification');
  console.log('====================');
  console.log('RAGStack configured:', ragstackConfig.isConfigured());

  if (!ragstackConfig.isConfigured()) {
    console.log('Set RAGSTACK_GRAPHQL_ENDPOINT and RAGSTACK_API_KEY to test');
    return;
  }

  const service = new RagstackScrapeService();
  console.log('Service instantiated successfully');

  // Don't actually start a scrape - just verify the service loads
  console.log('Integration verification complete');
}

verify().catch(console.error);
```

Run: `npx tsx test-ragstack-integration.ts`

### Files Modified Summary

| File | Change |
|------|--------|
| `src/domains/linkedin/services/linkedinContactService.ts` | Major refactor (was .js) |
| `src/domains/linkedin/utils/contactProcessor.js` | Use scrapeProfile() |
| `src/domains/profile/services/profileInitService.ts` | Use scrapeProfile() |
| `src/domains/profile/services/profileInitService.test.js` | Update mock |
| `config/index.js` | Remove orphaned config |
| `.env.example` | Created |

### Files Deleted Summary

| File | Reason |
|------|--------|
| `src/domains/profile/services/textExtractionService.js` | Replaced by RAGStack |
| `src/domains/storage/services/s3TextUploadService.js` | No longer needed |
| `schemas/profileTextSchema.js` | Orphaned |
| `config/extractionConfig.js` | Orphaned |

### Known Limitations

1. **Activity page discovery** - RAGStack may not discover all LinkedIn activity pages if they're not directly linked from the profile. This is acceptable per requirements (partial data is OK).

2. **Cookie expiration** - LinkedIn cookies have limited lifetimes. Scrapes must happen within an active session.

3. **RAGStack dependency** - If RAGStack is down or misconfigured, profile scraping fails entirely. The service gracefully returns failure but cannot fall back to screenshots.

4. **No backward migration** - Once deployed, the screenshot pipeline code is gone. Rolling back requires deploying a previous version.

---

## Implementation Complete

After completing Phase 2, the RAGStack integration is fully operational:

- RAGStack client can start scrape jobs with LinkedIn cookies
- LinkedInContactService uses `scrapeProfile()` method
- All callers updated to use new method
- Screenshot pipeline code removed
- Orphaned configuration cleaned up
