# Phase 0: Foundation

This phase establishes architectural decisions, coding patterns, and testing strategies that apply to all subsequent phases.

## Estimated Tokens: ~5,000

---

## Architecture Decision Records (ADRs)

### ADR-001: RAGStack Client in TypeScript

**Context:** The puppeteer backend is migrating from JavaScript to TypeScript. The existing Python RAGStack client in `backend/lambdas/shared/python/shared_services/ragstack_client.py` provides a reference implementation.

**Decision:** Create a new TypeScript RAGStack client in the puppeteer backend that:
1. Uses native `fetch` API (no external dependencies)
2. Follows the same GraphQL patterns as the Python client
3. Implements retry logic with exponential backoff
4. Supports circuit breaker pattern (optional, can defer)

**Consequences:**
- Consistent patterns between Python and TypeScript codebases
- No new npm dependencies required
- Type safety for GraphQL operations

### ADR-002: Cookie Extraction Strategy

**Context:** RAGStack's web scraper supports a `cookies` parameter for authenticated scraping. LinkedIn requires authentication, which Puppeteer already handles.

**Decision:** Extract cookies from Puppeteer's browser session using `page.cookies()` and serialize them to the format RAGStack expects (semicolon-separated `name=value` pairs).

**Format:**
```
li_at=AQE....; JSESSIONID=ajax:123...; liap=true
```

**Consequences:**
- LinkedIn session is shared with RAGStack's scraper
- Session expiry affects RAGStack scrapes (acceptable - sessions refresh on each search)
- Cookie extraction happens just before scrape request (fresh cookies)

### ADR-003: Scrape Configuration

**Context:** RAGStack's scraper supports various configuration options. LinkedIn profiles have a predictable URL structure.

**Decision:** Use these default scrape parameters per profile:
```typescript
{
  url: `https://www.linkedin.com/in/${profileId}/`,
  maxPages: 5,           // Profile + activity subpages
  maxDepth: 1,           // Only follow immediate links
  scope: 'SUBPAGES',     // Stay within /in/{profileId}/*
  includePatterns: [`/in/${profileId}/*`],
  excludePatterns: [],
  scrapeMode: 'FULL',    // Use headless browser (JS-heavy site)
  forceRescrape: false   // Use cached content if unchanged
}
```

**Consequences:**
- Captures main profile + any discoverable activity pages
- If activity pages aren't linked, only main profile is scraped (acceptable per requirements)
- FULL mode is slower but handles LinkedIn's dynamic content

### ADR-004: Remove Screenshot Pipeline

**Context:** The current flow takes screenshots, uploads to S3, and triggers Lambda for OCR. This is being replaced entirely.

**Decision:** Remove these files/services completely:
- `textExtractionService.js` - Local DOM text extraction (RAGStack handles this)
- `s3TextUploadService.js` - S3 upload for extracted text
- Screenshot capture code in `linkedinContactService.js`

**Keep:**
- S3 client configuration (may be used elsewhere)
- Sharp dependency (used for other image processing)

**Consequences:**
- Significant code reduction
- Single data flow: Puppeteer auth → RAGStack scrape → RAGStack KB
- Need to update `serviceFactory.js` to reflect removed services

### ADR-005: Error Handling Strategy

**Context:** RAGStack scraping can fail for various reasons (auth, network, rate limits).

**Decision:** Implement three-tier error handling:

1. **Retriable Errors** (network timeouts, 5xx errors, rate limits)
   - Retry up to 3 times with exponential backoff
   - Base delay: 1 second, max delay: 30 seconds

2. **Non-Retriable Errors** (401 auth, 400 bad request, GraphQL errors)
   - Fail immediately, log error
   - Return failure response to caller

3. **Partial Success**
   - If scrape starts but discovers no activity pages, consider it success
   - Log warning but return success with partial data flag

**Consequences:**
- Predictable failure modes
- No infinite retry loops
- Caller can decide how to handle partial success

---

## Tech Stack

### Language & Runtime
- **TypeScript 5.x** - All new code in TypeScript
- **Node.js 24 LTS** - Runtime environment
- **ES Modules** - Use `import/export` syntax

### HTTP Client
- **Native fetch** - Built into Node.js 18+, no external dependency
- Alternative: `graphql-request` if more GraphQL features needed

### Testing
- **Vitest** - Already used in puppeteer backend
- **MSW (Mock Service Worker)** - For mocking HTTP requests (if not already present)
- Alternative: Manual fetch mocking with `vi.mock`

### Linting
- **ESLint** - Existing configuration applies
- **TypeScript strict mode** - Enable in new files

---

## Shared Patterns

### GraphQL Request Pattern

```typescript
// Standard pattern for GraphQL requests
async function executeGraphQL<T>(
  endpoint: string,
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new RagstackHttpError(response.status, await response.text());
  }

  const result = await response.json();

  if (result.errors) {
    throw new RagstackGraphQLError(result.errors);
  }

  return result.data;
}
```

### Cookie Serialization Pattern

```typescript
// Convert Puppeteer cookies to RAGStack format
function serializeCookies(cookies: Protocol.Network.Cookie[]): string {
  return cookies
    .filter(c => c.domain.includes('linkedin.com'))
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
}
```

### Service Class Pattern

Follow existing service patterns in the codebase:

```typescript
export class SomeService {
  private readonly config: SomeConfig;
  private readonly logger: Logger;

  constructor(config: SomeConfig) {
    this.config = config;
    this.logger = logger; // Use shared logger
  }

  async doOperation(params: OperationParams): Promise<OperationResult> {
    this.logger.info('Starting operation', { params });
    try {
      // Implementation
      return { success: true, data };
    } catch (error) {
      this.logger.error('Operation failed', { error });
      throw error;
    }
  }
}
```

---

## Testing Strategy

### Unit Tests

**Location:** Co-located with source files (`*.test.ts`)

**Mocking Approach:**
- Mock `fetch` globally for HTTP tests
- No real network calls in unit tests
- Use fixture data for GraphQL responses

**Example:**
```typescript
// ragstackScrapeService.test.ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RagstackScrapeService } from './ragstackScrapeService';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('RagstackScrapeService', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should start scrape job successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          startScrape: {
            jobId: 'job-123',
            status: 'PENDING',
          },
        },
      }),
    });

    const service = new RagstackScrapeService(config);
    const result = await service.startScrape('john-doe', 'cookie=value');

    expect(result.jobId).toBe('job-123');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
```

### Integration Tests

**Approach:** Test service integration without real RAGStack

- Mock RAGStack GraphQL responses
- Test full flow from `linkedinContactService.processProfile()` through to result
- Verify cookie extraction works with mock Puppeteer page

### No Live Service Tests

**Important:** All tests must run without:
- Real RAGStack endpoint
- Real LinkedIn authentication
- Real S3 buckets
- Any cloud resources

Tests should be runnable in CI with no external dependencies.

---

## Configuration

### Environment Variables

Add to `puppeteer/.env.example`:
```bash
# RAGStack Integration
RAGSTACK_GRAPHQL_ENDPOINT=https://xxx.appsync-api.us-east-1.amazonaws.com/graphql
RAGSTACK_API_KEY=da2-xxxxxxxxxxxx

# Optional: Scrape configuration overrides
RAGSTACK_SCRAPE_MAX_PAGES=5
RAGSTACK_SCRAPE_MAX_DEPTH=1
RAGSTACK_SCRAPE_MODE=FULL
```

### Config File Structure

Create `puppeteer/src/shared/config/ragstack.ts`:
```typescript
export const ragstackConfig = {
  endpoint: process.env.RAGSTACK_GRAPHQL_ENDPOINT || '',
  apiKey: process.env.RAGSTACK_API_KEY || '',
  scrape: {
    maxPages: parseInt(process.env.RAGSTACK_SCRAPE_MAX_PAGES || '5', 10),
    maxDepth: parseInt(process.env.RAGSTACK_SCRAPE_MAX_DEPTH || '1', 10),
    scrapeMode: (process.env.RAGSTACK_SCRAPE_MODE || 'FULL') as 'AUTO' | 'FAST' | 'FULL',
    scope: 'SUBPAGES' as const,
  },
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
  },
};
```

---

## Deployment Strategy

### No Backend Changes Required

RAGStack-Lambda is already deployed separately. This feature only modifies the puppeteer backend.

### Deployment Steps

1. Update environment variables in deployment target
2. Deploy puppeteer backend with new code
3. Verify scrape endpoint connectivity
4. Test with a single profile before full rollout

### Rollback Plan

If issues occur:
1. Revert to previous puppeteer deployment
2. Screenshot pipeline will resume (code still in previous version)
3. No data loss - RAGStack KB retains previously indexed profiles

---

## Commit Message Format

Use conventional commits:

```
type(scope): description

- Bullet point details
- Additional context
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code restructuring
- `test` - Adding/updating tests
- `docs` - Documentation
- `chore` - Maintenance

**Scopes:**
- `ragstack` - RAGStack client code
- `linkedin` - LinkedIn service changes
- `config` - Configuration changes

**Example:**
```
feat(ragstack): add RAGStack scrape service

- Implement GraphQL client with retry logic
- Add cookie serialization for authenticated scraping
- Export StartScrapeInput and ScrapeJobStatus types
```

---

## Phase Checklist

Before proceeding to Phase 1, verify:

- [x] This document has been read and understood
- [x] RAGStack endpoint is deployed and accessible
- [x] Environment variables are documented
- [x] Testing approach is clear (mock fetch, no live services)
