# Phase 1: RAGStack Client Foundation

## Phase Goal

Build the standalone RAGStack client components for LinkedIn profile scraping. This phase creates all new code without modifying existing files (except config exports).

**Success Criteria:**
- RAGStack configuration module with validation
- TypeScript types for GraphQL operations
- Scrape service with retry logic and polling
- Cookie extraction utility for Puppeteer sessions
- All tests pass without external dependencies

**Estimated Tokens:** ~30,000

---

## Prerequisites

- Phase 0 complete (ADRs understood)
- RAGStack endpoint URL and API key available
- Puppeteer backend builds successfully (`npm run build` or `npx tsc`)

---

## Task 1: Create RAGStack Configuration

### Goal
Add RAGStack configuration to the puppeteer backend's config system.

### Files to Create/Modify
- `puppeteer/src/shared/config/ragstack.ts` - NEW: RAGStack config module
- `puppeteer/src/shared/config/index.js` - MODIFY: Export ragstack config
- `puppeteer/config/index.js` - MODIFY: Add ragstack to main config object

### Prerequisites
- None (first task)

### Implementation Steps

1. **Create ragstack config file** at `puppeteer/src/shared/config/ragstack.ts`:
   - Export a `ragstackConfig` object with:
     - `endpoint`: string from `RAGSTACK_GRAPHQL_ENDPOINT` env var
     - `apiKey`: string from `RAGSTACK_API_KEY` env var
     - `scrape` object with: `maxPages`, `maxDepth`, `scrapeMode`, `scope`
     - `retry` object with: `maxAttempts`, `baseDelay`, `maxDelay`
   - Include validation helper `isConfigured()` that returns true if endpoint and apiKey are set

2. **Update config barrel export** in `puppeteer/src/shared/config/index.js`:
   - Add export for `ragstackConfig` from `./ragstack.js`

3. **Update main config** in `puppeteer/config/index.js`:
   - Import `ragstackConfig`
   - Add `ragstack` key to the exported config object

### Verification Checklist
- [x] `import { ragstackConfig } from '#shared-config/index.js'` works
- [x] `ragstackConfig.isConfigured()` returns false when env vars missing
- [x] `ragstackConfig.isConfigured()` returns true when env vars set
- [x] TypeScript compiles without errors

### Testing Instructions

Create `puppeteer/src/shared/config/ragstack.test.ts`:
```typescript
describe('ragstackConfig', () => {
  it('should return isConfigured false when env vars missing', () => {
    // Clear env vars, test isConfigured()
  });

  it('should parse numeric config from env vars', () => {
    // Set RAGSTACK_SCRAPE_MAX_PAGES=10, verify parsed as number
  });
});
```

Run: `npm test -- ragstack.test.ts`

### Commit Message Template
```
feat(config): add RAGStack configuration module

- Add ragstackConfig with endpoint, apiKey, scrape settings
- Add isConfigured() validation helper
- Export from shared config barrel
```

---

## Task 2: Create RAGStack Types

### Goal
Define TypeScript types for RAGStack GraphQL operations.

### Files to Create
- `puppeteer/src/domains/ragstack/types/ragstack.ts` - NEW: Type definitions
- `puppeteer/src/domains/ragstack/index.ts` - NEW: Barrel export

### Prerequisites
- Task 1 complete

### Implementation Steps

1. **Create directory structure:**
   ```bash
   mkdir -p puppeteer/src/domains/ragstack/types
   mkdir -p puppeteer/src/domains/ragstack/services
   mkdir -p puppeteer/src/domains/ragstack/utils
   ```

2. **Create types file** at `puppeteer/src/domains/ragstack/types/ragstack.ts`:

   Define these types based on RAGStack's GraphQL schema:

   ```typescript
   // Scrape input
   export interface StartScrapeInput {
     url: string;
     maxPages?: number;
     maxDepth?: number;
     scope?: 'SUBPAGES' | 'HOSTNAME' | 'DOMAIN';
     includePatterns?: string[];
     excludePatterns?: string[];
     scrapeMode?: 'AUTO' | 'FAST' | 'FULL';
     cookies?: string;
     forceRescrape?: boolean;
   }

   // Scrape job response
   export interface ScrapeJob {
     jobId: string;
     baseUrl: string;
     status: ScrapeJobStatus;
     totalUrls?: number;
     processedCount?: number;
     failedCount?: number;
   }

   export type ScrapeJobStatus =
     | 'PENDING'
     | 'DISCOVERING'
     | 'PROCESSING'
     | 'COMPLETED'
     | 'FAILED'
     | 'CANCELLED';

   // GraphQL response wrappers
   export interface StartScrapeResponse {
     startScrape: ScrapeJob;
   }

   export interface GetScrapeJobResponse {
     getScrapeJob: {
       job: ScrapeJob;
     };
   }

   // Search types (for future use)
   export interface SearchResult {
     content: string;
     source: string;
     score: number;
   }

   export interface SearchKnowledgeBaseResponse {
     searchKnowledgeBase: {
       results: SearchResult[];
     };
   }

   // Error types
   export class RagstackError extends Error {
     constructor(message: string) {
       super(message);
       this.name = 'RagstackError';
     }
   }

   export class RagstackHttpError extends RagstackError {
     readonly statusCode: number;
     readonly responseBody: string;

     constructor(statusCode: number, responseBody: string) {
       super(`HTTP ${statusCode}: ${responseBody}`);
       this.name = 'RagstackHttpError';
       this.statusCode = statusCode;
       this.responseBody = responseBody;
     }
   }

   export class RagstackGraphQLError extends RagstackError {
     readonly errors: Array<{ message: string }>;

     constructor(errors: Array<{ message: string }>) {
       super(`GraphQL errors: ${errors.map(e => e.message).join(', ')}`);
       this.name = 'RagstackGraphQLError';
       this.errors = errors;
     }
   }
   ```

3. **Create barrel export** at `puppeteer/src/domains/ragstack/index.ts`:
   ```typescript
   export * from './types/ragstack.js';
   ```

### Verification Checklist
- [x] Types can be imported: `import { StartScrapeInput } from '../domains/ragstack/index.js'`
- [x] Error classes can be instantiated and thrown
- [x] TypeScript compiles without errors

### Testing Instructions

No tests needed for pure type definitions. Types are verified at compile time.

Run: `npx tsc --noEmit` to verify types compile

### Commit Message Template
```
feat(ragstack): add RAGStack TypeScript types

- Define StartScrapeInput and ScrapeJob types
- Define GraphQL response wrapper types
- Add custom error classes for HTTP and GraphQL errors
```

---

## Task 3: Create RAGStack Scrape Service

### Goal
Implement the core RAGStack client service that handles scraping operations.

### Files to Create
- `puppeteer/src/domains/ragstack/services/ragstackScrapeService.ts` - NEW

### Prerequisites
- Task 1 complete (config)
- Task 2 complete (types)

### Implementation Steps

1. **Create the service file** at `puppeteer/src/domains/ragstack/services/ragstackScrapeService.ts`:

   The service should implement:

   **Constructor:**
   - Accept optional config override (defaults to ragstackConfig)
   - Validate endpoint and apiKey are present
   - Initialize retry settings

   **Private method `_executeGraphQL<T>`:**
   - Accept query string and optional variables
   - Use native `fetch` to POST to GraphQL endpoint
   - Set headers: `Content-Type: application/json`, `x-api-key: {apiKey}`
   - Handle HTTP errors (throw RagstackHttpError)
   - Handle GraphQL errors in response (throw RagstackGraphQLError)
   - Return typed data from response

   **Private method `_executeWithRetry<T>`:**
   - Wrap `_executeGraphQL` with retry logic
   - Retry on: network errors, 5xx status codes, 429 rate limit
   - Do NOT retry on: 4xx client errors, GraphQL errors
   - Use exponential backoff with jitter
   - Max attempts from config (default 3)

   **Public method `startScrape(profileId: string, cookies: string)`:**
   - Build scrape input:
     ```typescript
     const input: StartScrapeInput = {
       url: `https://www.linkedin.com/in/${profileId}/`,
       maxPages: this.config.scrape.maxPages,
       maxDepth: this.config.scrape.maxDepth,
       scope: this.config.scrape.scope,
       includePatterns: [`/in/${profileId}/*`],
       scrapeMode: this.config.scrape.scrapeMode,
       cookies,
       forceRescrape: false,
     };
     ```
   - Execute startScrape mutation
   - Return ScrapeJob object

   **Public method `getScrapeJob(jobId: string)`:**
   - Execute getScrapeJob query
   - Return ScrapeJob object

   **Public method `waitForCompletion(jobId: string, options?)`:**
   - Poll getScrapeJob until status is terminal (COMPLETED, FAILED, CANCELLED)
   - Options: `pollInterval` (default 2000ms), `timeout` (default 300000ms = 5 min)
   - Return final ScrapeJob
   - Throw on timeout

   **GraphQL Queries (as static class properties):**
   ```typescript
   private static START_SCRAPE_MUTATION = `
     mutation StartScrape($input: StartScrapeInput!) {
       startScrape(input: $input) {
         jobId
         baseUrl
         status
       }
     }
   `;

   private static GET_SCRAPE_JOB_QUERY = `
     query GetScrapeJob($jobId: ID!) {
       getScrapeJob(jobId: $jobId) {
         job {
           jobId
           status
           totalUrls
           processedCount
           failedCount
         }
       }
     }
   `;
   ```

2. **Update barrel export** in `puppeteer/src/domains/ragstack/index.ts`:
   ```typescript
   export * from './types/ragstack.js';
   export { RagstackScrapeService } from './services/ragstackScrapeService.js';
   ```

### Verification Checklist
- [x] Service can be instantiated with config
- [x] `startScrape()` builds correct GraphQL mutation
- [x] `getScrapeJob()` queries job status
- [x] `waitForCompletion()` polls until terminal state
- [x] Retry logic handles transient failures
- [x] Non-retriable errors fail immediately
- [x] TypeScript compiles without errors

### Testing Instructions

Create `puppeteer/src/domains/ragstack/services/ragstackScrapeService.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RagstackScrapeService } from './ragstackScrapeService.js';
import { RagstackHttpError, RagstackGraphQLError } from '../types/ragstack.js';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const testConfig = {
  endpoint: 'https://test.appsync-api.amazonaws.com/graphql',
  apiKey: 'test-api-key',
  scrape: {
    maxPages: 5,
    maxDepth: 1,
    scrapeMode: 'FULL' as const,
    scope: 'SUBPAGES' as const,
  },
  retry: {
    maxAttempts: 3,
    baseDelay: 10, // Short for tests
    maxDelay: 100,
  },
};

describe('RagstackScrapeService', () => {
  let service: RagstackScrapeService;

  beforeEach(() => {
    mockFetch.mockReset();
    service = new RagstackScrapeService(testConfig);
  });

  describe('startScrape', () => {
    it('should start scrape job successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            startScrape: {
              jobId: 'job-123',
              baseUrl: 'https://www.linkedin.com/in/john-doe/',
              status: 'PENDING',
            },
          },
        }),
      });

      const result = await service.startScrape('john-doe', 'li_at=abc123');

      expect(result.jobId).toBe('job-123');
      expect(result.status).toBe('PENDING');

      // Verify request
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(testConfig.endpoint);
      expect(options.headers['x-api-key']).toBe(testConfig.apiKey);

      const body = JSON.parse(options.body);
      expect(body.variables.input.url).toBe('https://www.linkedin.com/in/john-doe/');
      expect(body.variables.input.cookies).toBe('li_at=abc123');
    });

    it('should throw RagstackHttpError on 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(service.startScrape('john-doe', 'bad-cookie'))
        .rejects.toThrow(RagstackHttpError);
    });

    it('should throw RagstackGraphQLError on GraphQL errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          errors: [{ message: 'Invalid input' }],
        }),
      });

      await expect(service.startScrape('john-doe', 'cookie'))
        .rejects.toThrow(RagstackGraphQLError);
    });

    it('should retry on 5xx errors', async () => {
      // First two calls fail with 500, third succeeds
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Error' })
        .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Error' })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { startScrape: { jobId: 'job-123', status: 'PENDING' } },
          }),
        });

      const result = await service.startScrape('john-doe', 'cookie');

      expect(result.jobId).toBe('job-123');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on 400 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });

      await expect(service.startScrape('john-doe', 'cookie'))
        .rejects.toThrow(RagstackHttpError);

      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('getScrapeJob', () => {
    it('should return job status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            getScrapeJob: {
              job: {
                jobId: 'job-123',
                status: 'COMPLETED',
                processedCount: 3,
                totalUrls: 3,
              },
            },
          },
        }),
      });

      const result = await service.getScrapeJob('job-123');

      expect(result.status).toBe('COMPLETED');
      expect(result.processedCount).toBe(3);
    });
  });

  describe('waitForCompletion', () => {
    it('should poll until completed', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { getScrapeJob: { job: { jobId: 'job-123', status: 'PROCESSING' } } },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { getScrapeJob: { job: { jobId: 'job-123', status: 'COMPLETED' } } },
          }),
        });

      const result = await service.waitForCompletion('job-123', { pollInterval: 10 });

      expect(result.status).toBe('COMPLETED');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw on timeout', async () => {
      // Always return PROCESSING
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { getScrapeJob: { job: { jobId: 'job-123', status: 'PROCESSING' } } },
        }),
      });

      await expect(
        service.waitForCompletion('job-123', { pollInterval: 10, timeout: 50 })
      ).rejects.toThrow(/timeout/i);
    });
  });
});
```

Run: `npm test -- ragstackScrapeService.test.ts`

### Commit Message Template
```
feat(ragstack): implement RAGStack scrape service

- Add GraphQL client with retry logic
- Implement startScrape, getScrapeJob, waitForCompletion methods
- Handle HTTP and GraphQL errors appropriately
- Add comprehensive unit tests
```

---

## Task 4: Create Cookie Extraction Utility

### Goal
Create a utility to extract and serialize cookies from Puppeteer browser sessions.

### Files to Create
- `puppeteer/src/domains/ragstack/utils/cookieExtractor.ts` - NEW
- `puppeteer/src/domains/ragstack/utils/cookieExtractor.test.ts` - NEW

### Prerequisites
- Task 2 complete (types)

### Implementation Steps

1. **Create cookie extractor** at `puppeteer/src/domains/ragstack/utils/cookieExtractor.ts`:

   ```typescript
   import type { Page, Cookie } from 'puppeteer';
   import { logger } from '#utils/logger.js';

   /**
    * LinkedIn cookie names that are essential for authentication
    */
   const ESSENTIAL_LINKEDIN_COOKIES = [
     'li_at',      // Main auth token
     'JSESSIONID', // Session ID
     'liap',       // Auth preference
     'li_rm',      // Remember me
   ];

   /**
    * Extract LinkedIn cookies from a Puppeteer page and serialize them.
    *
    * @param page - Puppeteer Page instance with active LinkedIn session
    * @returns Serialized cookie string (e.g., "li_at=xxx; JSESSIONID=yyy")
    * @throws Error if no LinkedIn cookies found
    */
   export async function extractLinkedInCookies(page: Page): Promise<string> {
     const cookies = await page.cookies();

     // Filter to LinkedIn domain cookies
     const linkedInCookies = cookies.filter(
       (cookie) =>
         cookie.domain.includes('linkedin.com') ||
         cookie.domain.includes('.linkedin.com')
     );

     if (linkedInCookies.length === 0) {
       throw new Error('No LinkedIn cookies found. User may not be logged in.');
     }

     // Check for essential auth cookies
     const cookieNames = new Set(linkedInCookies.map((c) => c.name));
     const hasAuthCookie = ESSENTIAL_LINKEDIN_COOKIES.some((name) =>
       cookieNames.has(name)
     );

     if (!hasAuthCookie) {
       logger.warn(
         'LinkedIn cookies found but no essential auth cookies (li_at, JSESSIONID). ' +
           'Scraping may fail due to missing authentication.'
       );
     }

     // Serialize cookies
     const serialized = serializeCookies(linkedInCookies);

     logger.debug(`Extracted ${linkedInCookies.length} LinkedIn cookies`, {
       cookieNames: Array.from(cookieNames),
       serializedLength: serialized.length,
     });

     return serialized;
   }

   /**
    * Serialize cookies to standard HTTP cookie format.
    *
    * @param cookies - Array of Puppeteer Cookie objects
    * @returns Serialized string (e.g., "name1=value1; name2=value2")
    */
   export function serializeCookies(cookies: Cookie[]): string {
     return cookies
       .map((cookie) => `${cookie.name}=${cookie.value}`)
       .join('; ');
   }

   /**
    * Check if LinkedIn session appears valid based on cookies.
    *
    * @param page - Puppeteer Page instance
    * @returns True if essential auth cookies are present
    */
   export async function hasValidLinkedInSession(page: Page): Promise<boolean> {
     try {
       const cookies = await page.cookies();
       const linkedInCookies = cookies.filter((c) =>
         c.domain.includes('linkedin.com')
       );
       const cookieNames = new Set(linkedInCookies.map((c) => c.name));

       return ESSENTIAL_LINKEDIN_COOKIES.some((name) => cookieNames.has(name));
     } catch {
       return false;
     }
   }
   ```

2. **Update barrel export** in `puppeteer/src/domains/ragstack/index.ts`:
   ```typescript
   export * from './types/ragstack.js';
   export { RagstackScrapeService } from './services/ragstackScrapeService.js';
   export {
     extractLinkedInCookies,
     serializeCookies,
     hasValidLinkedInSession,
   } from './utils/cookieExtractor.js';
   ```

### Verification Checklist
- [x] `extractLinkedInCookies()` returns serialized cookie string
- [x] Function throws if no LinkedIn cookies present
- [x] Function warns if auth cookies missing
- [x] `hasValidLinkedInSession()` returns boolean correctly
- [x] TypeScript compiles without errors

### Testing Instructions

Create `puppeteer/src/domains/ragstack/utils/cookieExtractor.test.ts`:

```typescript
import { vi, describe, it, expect } from 'vitest';
import {
  extractLinkedInCookies,
  serializeCookies,
  hasValidLinkedInSession,
} from './cookieExtractor.js';

// Mock page object
function createMockPage(cookies: Array<{ name: string; value: string; domain: string }>) {
  return {
    cookies: vi.fn().mockResolvedValue(cookies),
  } as any;
}

describe('cookieExtractor', () => {
  describe('extractLinkedInCookies', () => {
    it('should extract and serialize LinkedIn cookies', async () => {
      const mockPage = createMockPage([
        { name: 'li_at', value: 'auth-token-123', domain: '.linkedin.com' },
        { name: 'JSESSIONID', value: 'session-456', domain: 'www.linkedin.com' },
        { name: 'other', value: 'ignored', domain: '.google.com' },
      ]);

      const result = await extractLinkedInCookies(mockPage);

      expect(result).toBe('li_at=auth-token-123; JSESSIONID=session-456');
    });

    it('should throw if no LinkedIn cookies found', async () => {
      const mockPage = createMockPage([
        { name: 'other', value: 'value', domain: '.google.com' },
      ]);

      await expect(extractLinkedInCookies(mockPage)).rejects.toThrow(
        /no linkedin cookies found/i
      );
    });

    it('should include all LinkedIn domain cookies', async () => {
      const mockPage = createMockPage([
        { name: 'li_at', value: 'token', domain: '.linkedin.com' },
        { name: 'liap', value: 'true', domain: 'www.linkedin.com' },
        { name: 'li_rm', value: 'remember', domain: 'linkedin.com' },
      ]);

      const result = await extractLinkedInCookies(mockPage);

      expect(result).toContain('li_at=token');
      expect(result).toContain('liap=true');
      expect(result).toContain('li_rm=remember');
    });
  });

  describe('serializeCookies', () => {
    it('should serialize cookies to standard format', () => {
      const cookies = [
        { name: 'a', value: '1' },
        { name: 'b', value: '2' },
      ] as any;

      expect(serializeCookies(cookies)).toBe('a=1; b=2');
    });

    it('should handle empty array', () => {
      expect(serializeCookies([])).toBe('');
    });
  });

  describe('hasValidLinkedInSession', () => {
    it('should return true when li_at cookie present', async () => {
      const mockPage = createMockPage([
        { name: 'li_at', value: 'token', domain: '.linkedin.com' },
      ]);

      expect(await hasValidLinkedInSession(mockPage)).toBe(true);
    });

    it('should return true when JSESSIONID present', async () => {
      const mockPage = createMockPage([
        { name: 'JSESSIONID', value: 'session', domain: '.linkedin.com' },
      ]);

      expect(await hasValidLinkedInSession(mockPage)).toBe(true);
    });

    it('should return false when no auth cookies', async () => {
      const mockPage = createMockPage([
        { name: 'tracking', value: 'id', domain: '.linkedin.com' },
      ]);

      expect(await hasValidLinkedInSession(mockPage)).toBe(false);
    });

    it('should return false on error', async () => {
      const mockPage = {
        cookies: vi.fn().mockRejectedValue(new Error('Browser closed')),
      } as any;

      expect(await hasValidLinkedInSession(mockPage)).toBe(false);
    });
  });
});
```

Run: `npm test -- cookieExtractor.test.ts`

### Commit Message Template
```
feat(ragstack): add cookie extraction utility

- Implement extractLinkedInCookies for Puppeteer sessions
- Add hasValidLinkedInSession validation helper
- Filter to essential LinkedIn auth cookies
- Add unit tests
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
npm test -- ragstack
```

### Manual Verification

Create a quick verification script (don't commit):

```typescript
// verify-phase1.ts
import { RagstackScrapeService, extractLinkedInCookies } from './src/domains/ragstack/index.js';
import { ragstackConfig } from './src/shared/config/index.js';

console.log('Phase 1 Verification');
console.log('====================');
console.log('RAGStack configured:', ragstackConfig.isConfigured());
console.log('Config endpoint:', ragstackConfig.endpoint ? 'SET' : 'NOT SET');
console.log('Config apiKey:', ragstackConfig.apiKey ? 'SET' : 'NOT SET');

if (ragstackConfig.isConfigured()) {
  const service = new RagstackScrapeService();
  console.log('RagstackScrapeService: instantiated successfully');
}

console.log('extractLinkedInCookies: function exists');
console.log('Phase 1 complete!');
```

Run: `npx tsx verify-phase1.ts`

### Files Created Summary

| File | Description |
|------|-------------|
| `src/shared/config/ragstack.ts` | Configuration module |
| `src/shared/config/ragstack.test.ts` | Config tests |
| `src/domains/ragstack/types/ragstack.ts` | TypeScript types |
| `src/domains/ragstack/services/ragstackScrapeService.ts` | GraphQL client |
| `src/domains/ragstack/services/ragstackScrapeService.test.ts` | Service tests |
| `src/domains/ragstack/utils/cookieExtractor.ts` | Cookie utilities |
| `src/domains/ragstack/utils/cookieExtractor.test.ts` | Cookie tests |
| `src/domains/ragstack/index.ts` | Barrel export |

### Files Modified Summary

| File | Change |
|------|--------|
| `src/shared/config/index.js` | Export ragstackConfig |
| `config/index.js` | Add ragstack to config object |

---

## Next Phase

After Phase 1 is complete, proceed to [Phase-2.md](./Phase-2.md) for:
- Integrating RAGStack with LinkedInContactService
- Updating callers to use new methods
- Removing deprecated screenshot pipeline code
