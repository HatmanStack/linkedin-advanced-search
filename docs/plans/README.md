# RAGStack Profile Ingestion Implementation Plan

## Feature Overview

This plan replaces the screenshot-based LinkedIn profile data collection with RAGStack-Lambda's web scraping feature. Currently, the puppeteer backend takes screenshots of LinkedIn profiles, uploads them to S3, and a Lambda processes them via OCR. This approach is expensive, slow, and creates unnecessary complexity.

The new approach passes authenticated LinkedIn session cookies from Puppeteer to RAGStack's scraper, which fetches profile pages directly and indexes them into a vector knowledge base. This enables semantic search across profiles while eliminating screenshot storage and OCR processing costs.

**Key Changes:**
- Add RAGStack GraphQL client to puppeteer backend (TypeScript)
- Export LinkedIn session cookies from Puppeteer browser
- Call RAGStack `startScrape` mutation with cookies for authenticated scraping
- Remove screenshot capture, text extraction service, and S3 text upload service

## Prerequisites

### Environment Setup
- Node.js v24 LTS (via nvm)
- RAGStack-Lambda deployed with web scraping enabled
- Environment variables configured:
  - `RAGSTACK_GRAPHQL_ENDPOINT` - RAGStack GraphQL API URL
  - `RAGSTACK_API_KEY` - API key for RAGStack authentication

### Dependencies to Add
- `graphql-request` - GraphQL client for Node.js (or use native fetch)
- No new production dependencies required if using native fetch

### Verification
```bash
# Verify RAGStack endpoint is accessible
curl -X POST "$RAGSTACK_GRAPHQL_ENDPOINT" \
  -H "x-api-key: $RAGSTACK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "query { __typename }"}'
```

## Phase Summary

| Phase | Goal | Est. Tokens |
|-------|------|-------------|
| [Phase-0](./Phase-0.md) | Foundation: ADRs, patterns, testing strategy | ~5,000 |
| [Phase-1](./Phase-1.md) | RAGStack client foundation (4 tasks - all new code) | ~30,000 |
| [Phase-2](./Phase-2.md) | Integration and cleanup (5 tasks - modify/delete existing) | ~35,000 |

## Commit Guidelines

**IMPORTANT:** Commit messages should NOT include:
- `Co-Authored-By:` lines
- `Generated with Claude Code` or similar attribution

Use conventional commits format:
```
type(scope): brief description

- Detail 1
- Detail 2
```

## Navigation

1. **Start Here:** [Phase-0.md](./Phase-0.md) - Architecture decisions and patterns
2. **Foundation:** [Phase-1.md](./Phase-1.md) - RAGStack client components (new code)
3. **Integration:** [Phase-2.md](./Phase-2.md) - Integration and cleanup (modify existing)

## File Structure After Implementation

```
puppeteer/
├── config/
│   ├── index.js                           # MODIFIED (remove s3/extraction)
│   └── extractionConfig.js                # REMOVED
├── schemas/
│   └── profileTextSchema.js               # REMOVED
└── src/
    ├── domains/
    │   ├── ragstack/                      # NEW DIRECTORY
    │   │   ├── services/
    │   │   │   └── ragstackScrapeService.ts
    │   │   ├── types/
    │   │   │   └── ragstack.ts
    │   │   ├── utils/
    │   │   │   └── cookieExtractor.ts
    │   │   └── index.ts
    │   ├── linkedin/
    │   │   ├── services/
    │   │   │   └── linkedinContactService.ts  # MODIFIED (was .js)
    │   │   └── utils/
    │   │       └── contactProcessor.js        # MODIFIED
    │   ├── profile/
    │   │   └── services/
    │   │       ├── profileInitService.ts      # MODIFIED
    │   │       └── textExtractionService.js   # REMOVED
    │   └── storage/
    │       └── services/
    │           └── s3TextUploadService.js     # REMOVED
    └── shared/
        └── config/
            └── ragstack.ts                    # NEW
```
