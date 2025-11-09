# Phase 0: Foundation & Architecture

## Overview

This phase establishes the architectural foundation, design decisions, and shared conventions for the LinkedIn Advanced Search refactor. This refactor is a **decoupling and simplification** effort focused on removing Pinecone vector search infrastructure and transitioning to a simpler text extraction and external search architecture.

---

## Architectural Vision

### Current Architecture (As-Is)

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite)                       │
│  - Connection management UI                                     │
│  - Search interface                                             │
│  - Post composer                                                │
└───────────┬──────────────────────────────┬──────────────────────┘
            │                              │
            │                              │
            v                              v
┌───────────────────────┐      ┌──────────────────────────────────┐
│  Puppeteer Backend    │      │   AWS Lambda Functions           │
│  (Node.js/Express)    │      │  - Pinecone Indexer (DEAD)       │
│  - LinkedIn scraping  │      │  - Pinecone Search (DEAD)        │
│  - Profile processing │      │  - LLM (OpenAI)                  │
│  - Screenshot capture │      │  - Edge processing               │
│  - In-memory queue    │      │  - Profile processing            │
│  - Heal & Restore     │      └──────────────────────────────────┘
└───────────┬───────────┘                   │
            │                               │
            v                               v
┌───────────────────────────────────────────────────────────────────┐
│                    AWS Infrastructure                             │
│  - DynamoDB (profile storage)                                     │
│  - S3 (screenshots)                                               │
│  - Pinecone (vector search) ← TO BE REMOVED                       │
│  - Cognito (authentication)                                       │
│  - API Gateway                                                    │
└───────────────────────────────────────────────────────────────────┘
```

### Target Architecture (To-Be)

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite)                       │
│  - Connection management UI                                     │
│  - Search interface (NEW: calls placeholder Search API)         │
│  - Post composer                                                │
└───────────┬──────────────────────────────┬──────────────────────┘
            │                              │
            │                              │
            v                              v
┌───────────────────────┐      ┌──────────────────────────────────┐
│  Puppeteer Backend    │      │   AWS Lambda Functions           │
│  (Node.js/Express)    │      │  - LLM (OpenAI)                  │
│  - LinkedIn scraping  │      │  - Edge processing               │
│  - TEXT EXTRACTION ← │      │  - Profile processing            │
│  - S3 text upload    │      │  - Search API (NEW PLACEHOLDER)  │
│  - In-memory queue    │      └──────────────────────────────────┘
│  - Heal & Restore     │                   │
└───────────┬───────────┘                   │
            │                               │
            v                               v
┌───────────────────────────────────────────────────────────────────┐
│                    AWS Infrastructure                             │
│  - DynamoDB (profile storage)                                     │
│  - S3 (extracted text files) ← NEW ROLE                           │
│  - Cognito (authentication)                                       │
│  - API Gateway                                                    │
└────────────┬──────────────────────────────────────────────────────┘
             │
             v
┌────────────────────────────────────────────────────────────────┐
│              External Search System (Future)                    │
│  - Ingests text files from S3                                  │
│  - Powers Search API backend                                   │
│  - NOT implemented in this refactor                            │
└────────────────────────────────────────────────────────────────┘
```

---

## Key Architectural Decisions

### ADR-001: Remove Pinecone Vector Search

**Status:** Accepted

**Context:**
The current system uses Pinecone for semantic profile search. This introduces complexity, cost, and coupling that is no longer desired.

**Decision:**
Remove all Pinecone integration including:
- Lambda functions for indexing and search
- Pinecone client dependencies
- Infrastructure configuration
- Test suites
- Documentation references

**Consequences:**
- Simplified architecture with fewer dependencies
- Reduced operational costs (no Pinecone subscription)
- Loss of semantic search capability (to be replaced by external system)
- Significant code deletion required

### ADR-002: Transition to Text Extraction and S3 Upload

**Status:** Accepted

**Context:**
Previously, Puppeteer scraped profiles and took screenshots. Screenshots were uploaded to S3 and profile data was sent to Pinecone for indexing.

**Decision:**
Refactor Puppeteer backend to:
1. Extract clean text from profile pages (name, title, company, experience, skills, etc.)
2. Format extracted data as structured text (JSON or plain text)
3. Upload text files to S3 (one file per profile)
4. Maintain DynamoDB storage for metadata

**Consequences:**
- S3 becomes the single source of truth for extracted profile content
- External systems can easily ingest text files
- Simpler data pipeline (no vector embedding generation)
- Text extraction logic must be robust and well-tested

### ADR-003: Implement Placeholder Search API

**Status:** Accepted

**Context:**
The frontend needs a search endpoint to replace Pinecone search. The actual search backend will be an external system.

**Decision:**
Create a minimal Search API that:
1. Accepts search queries from the frontend
2. Logs the query for debugging
3. Returns a placeholder success response
4. Provides a hook point for future external search integration

**Consequences:**
- Frontend can remain functional during refactor
- Clear integration point for external search system
- No actual search functionality in the short term
- Frontend must handle placeholder responses gracefully

### ADR-004: Preserve Core Puppeteer Architecture

**Status:** Accepted

**Context:**
The Puppeteer backend has proven features including in-memory queue, polling, and heal & restore.

**Decision:**
Preserve the following components:
- Local Puppeteer backend server (Node.js/Express)
- In-memory FIFO queue for LinkedIn interactions
- Polling mechanism for frontend status updates
- Heal & Restore checkpoint-based recovery
- Session management and human behavior simulation

**Consequences:**
- Minimal disruption to proven workflows
- Queue and polling mechanisms remain functional
- Heal & Restore continues to work during long-running operations
- Focus effort on text extraction and dead code removal

### ADR-005: AWS SDK for S3 Integration

**Status:** Accepted

**Context:**
The Puppeteer backend already has `@aws-sdk/client-s3` installed for screenshot uploads.

**Decision:**
Reuse existing AWS SDK infrastructure for text file uploads:
- Use same S3 client configuration
- Create new bucket or prefix for text files
- Leverage existing credential management
- Follow existing upload patterns

**Consequences:**
- No new dependencies required
- Consistent AWS integration patterns
- Same IAM permissions model
- Existing error handling can be reused

---

## Tech Stack

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite 6
- **Language:** TypeScript 5
- **UI Library:** Radix UI + Tailwind CSS
- **State Management:** React Context + Local Storage
- **HTTP Client:** Axios
- **Authentication:** AWS Cognito (amazon-cognito-identity-js)

### Backend (Puppeteer)
- **Runtime:** Node.js 22+
- **Framework:** Express 4
- **Automation:** Puppeteer 24
- **Language:** JavaScript (ES Modules)
- **Logging:** Winston
- **Encryption:** libsodium-wrappers-sumo (Sealbox)
- **AWS SDK:** @aws-sdk/client-s3, @aws-sdk/client-dynamodb

### Cloud Infrastructure
- **Compute:** AWS Lambda (Node.js 20 runtime)
- **Database:** DynamoDB (single-table design)
- **Storage:** S3 (text files + screenshots)
- **API:** API Gateway HTTP API (v2)
- **Authentication:** AWS Cognito User Pools
- **IaC:** CloudFormation (RAG-CloudStack templates)

### Dependencies to Remove
- `@pinecone-database/pinecone` (devDependency in root package.json)

---

## Data Flow

### Profile Scraping and Extraction Flow

```
1. User initiates search → Frontend
2. Search request → Puppeteer Backend
3. Puppeteer navigates to LinkedIn profile
4. Extract structured text data:
   - Profile URL
   - Name, headline, location
   - Current company and title
   - Experience history (companies, titles, dates)
   - Skills and endorsements
   - Education
   - About/summary section
5. Format as JSON or structured text
6. Upload to S3: s3://bucket/profiles/<profile-id>.json
7. Save metadata to DynamoDB
8. Return success to frontend
```

### Search Flow (Placeholder)

```
1. User enters search query → Frontend
2. POST request to Search API (API Gateway + Lambda)
3. Lambda logs query
4. Lambda returns placeholder response: { success: true, message: "Search queued", results: [] }
5. Frontend displays placeholder message
[Future: External system processes query and returns real results]
```

---

## Shared Patterns and Conventions

### File Naming Conventions
- **React Components:** PascalCase (e.g., `ConnectionCard.tsx`)
- **Hooks:** camelCase with `use` prefix (e.g., `useConnections.ts`)
- **Services:** camelCase with `Service` suffix (e.g., `puppeteerService.js`)
- **Utilities:** camelCase (e.g., `linkedinErrorHandler.js`)
- **Controllers:** PascalCase with `Controller` suffix (e.g., `SearchController`)

### Code Organization
```
puppeteer-backend/
├── src/
│   ├── server.js              # Express app entry point
│   └── routes/                # Route handlers
├── controllers/               # Business logic controllers
├── services/                  # External service integrations
├── utils/                     # Helper utilities
└── config/                    # Configuration management

src/ (frontend)
├── components/                # React components
├── hooks/                     # Custom React hooks
├── services/                  # API service layers
├── contexts/                  # React Context providers
├── types/                     # TypeScript type definitions
└── utils/                     # Helper utilities
```

### Error Handling
- **Backend:** Use Winston logger for all errors with context
- **Frontend:** Use centralized error handling utility (`errorHandling.ts`)
- **API Errors:** Return structured error objects with `error`, `message`, `timestamp`
- **Retries:** Implement exponential backoff for network operations

### Environment Variables
- **Frontend:** Prefix with `VITE_` (e.g., `VITE_API_GATEWAY_URL`)
- **Backend:** No prefix required (e.g., `AWS_REGION`, `S3_SCREENSHOT_BUCKET_NAME`)
- **Secrets:** Never commit `.env` files; use `.env.example` for templates

### AWS Credentials
- **Local Development:** Use AWS CLI configuration (`~/.aws/credentials`)
- **Lambda:** Use IAM roles attached to Lambda functions
- **Puppeteer Backend:** Use environment variables or AWS SDK default credential chain

### S3 Structure
```
s3://linkedin-advanced-search-data/
├── screenshots/               # Existing screenshot storage
│   ├── <profile-id>-profile.png
│   └── <profile-id>-activity.png
└── profiles/                  # NEW: Extracted text files
    ├── <profile-id>.json
    └── <profile-id>.txt
```

### DynamoDB Schema (Preserved)
```
Table: linkedin-advanced-search
PK: PROFILE#<profile_id>
SK: #METADATA

Attributes:
- profile_id
- name, company, title, location
- headline, employment_type
- experience_length, skills, education
- fulltext (raw extracted text)
- screenshot_urls
- status (possible, incoming, outgoing, ally)
- created_at, updated_at
```

---

## Testing Strategy

### Unit Testing
- **Framework:** Vitest (frontend), Node.js test runner or Jest (backend)
- **Coverage Target:** 70% minimum for critical paths
- **Focus Areas:**
  - Text extraction logic
  - S3 upload functionality
  - API endpoint handlers
  - Data transformation utilities

### Integration Testing
- **Puppeteer Backend:** Test LinkedIn login, navigation, text extraction
- **S3 Integration:** Test upload/download with LocalStack or real S3
- **Lambda Functions:** Test with SAM Local or Lambda test events
- **Frontend:** Test API service integration with mock backends

### End-to-End Testing
- **Not required for this refactor**
- Manual testing sufficient for UI workflows
- Focus on smoke testing after each phase

### Test Data
- **Use anonymized sample profiles**
- **Create mock LinkedIn HTML snapshots** for Puppeteer tests
- **Avoid real API calls in automated tests**

---

## Common Pitfalls to Avoid

### 1. Incomplete Dead Code Removal
**Pitfall:** Leaving Pinecone references in environment variables, dependencies, or comments.

**Solution:** Use comprehensive grep searches to find all references. Check:
- `package.json` and `package-lock.json`
- `.env.example` and environment configuration
- CloudFormation templates
- Test files and test documentation
- README and inline comments

### 2. Breaking Existing Functionality
**Pitfall:** Refactoring text extraction breaks screenshot upload or DynamoDB storage.

**Solution:**
- Test existing features before and after changes
- Make incremental commits with clear boundaries
- Preserve existing service interfaces during refactor

### 3. Hardcoded AWS Resource Names
**Pitfall:** Hardcoding S3 bucket names or DynamoDB table names.

**Solution:**
- Use environment variables for all AWS resource identifiers
- Update `.env.example` with new variables
- Document required environment variables in each phase

### 4. Missing Error Handling
**Pitfall:** Text extraction fails silently, leaving profiles partially processed.

**Solution:**
- Wrap all Puppeteer operations in try-catch blocks
- Log errors with full context (profile URL, step, stack trace)
- Implement retry logic for transient failures
- Use Heal & Restore for recovery

### 5. S3 Upload Failures
**Pitfall:** Text files uploaded without proper error handling or validation.

**Solution:**
- Validate extracted text before upload
- Check S3 upload response for success
- Implement retry with exponential backoff
- Log S3 upload metadata (bucket, key, size, timestamp)

### 6. AWS Credential Issues
**Pitfall:** Puppeteer backend can't access S3 due to missing credentials.

**Solution:**
- Document required IAM permissions
- Test with minimal IAM policy first
- Provide clear error messages for credential failures
- Support multiple credential sources (env vars, IAM roles, credential file)

### 7. Ignoring the "Stale TODO List"
**Pitfall:** Implementing features from the old README TODO list.

**Solution:**
- **Completely ignore** the "Work in Progress / To Do" section (lines 186-213 of README.md)
- Focus only on the three primary refactor tasks
- Remove the stale TODO section during cleanup

### 8. Over-engineering the Placeholder API
**Pitfall:** Building complex search logic in the placeholder API.

**Solution:**
- Keep it minimal: accept query, log it, return success
- No database queries, no search logic
- Document that it's a placeholder for future integration

---

## Security Considerations

### 1. LinkedIn Credentials
- Continue using Sealbox encryption for credential storage
- Decrypt credentials only when needed (JIT decryption)
- Never log plaintext credentials
- Use device-specific keypairs

### 2. AWS Credentials
- Never hardcode AWS access keys
- Use IAM roles for Lambda functions
- Rotate credentials regularly
- Follow principle of least privilege

### 3. S3 Access Control
- Configure bucket policies to restrict access
- Use server-side encryption (SSE-S3 or SSE-KMS)
- Enable versioning for data protection
- Implement lifecycle policies for cost management

### 4. API Security
- Maintain Cognito JWT authentication for all APIs
- Validate tokens on every request
- Use HTTPS for all API communication
- Implement rate limiting

### 5. Data Privacy
- Do not store PII unnecessarily
- Anonymize profile data in logs
- Follow LinkedIn's terms of service
- Implement data retention policies

---

## Performance Targets

### Puppeteer Backend
- **Text Extraction:** < 5 seconds per profile
- **S3 Upload:** < 2 seconds per file (< 100KB text files)
- **Queue Processing:** 8-10 profiles per minute (respecting LinkedIn rate limits)

### Frontend
- **Search API Response:** < 500ms (placeholder response)
- **Page Load:** < 2 seconds (initial render)
- **UI Responsiveness:** No blocking operations > 100ms

### Lambda Functions
- **Cold Start:** < 3 seconds
- **Warm Execution:** < 500ms
- **Memory:** 512MB-1024MB (optimize per function)

---

## Migration Phases Summary

This refactor is divided into 5 implementation phases:

1. **Phase 1:** Code Cleanup & Dead Code Removal (~25,000 tokens)
2. **Phase 2:** Puppeteer Refactor for Text Extraction (~30,000 tokens)
3. **Phase 3:** S3 Integration & Upload (~25,000 tokens)
4. **Phase 4:** Placeholder Search API Implementation (~15,000 tokens)
5. **Phase 5:** Frontend Integration & Testing (~25,000 tokens)

**Total Estimated Tokens:** ~120,000

---

## Dependencies Between Phases

```
Phase 0 (Foundation)
    ↓
Phase 1 (Dead Code Removal) ← Must complete before other phases
    ↓
Phase 2 (Text Extraction) ← Core refactor
    ↓
Phase 3 (S3 Upload) ← Depends on Phase 2 text extraction
    ↓
Phase 4 (Search API) ← Independent of Phase 2/3 (can run in parallel)
    ↓
Phase 5 (Frontend Integration) ← Depends on Phase 3 and Phase 4
```

---

## Documentation Standards

### Code Comments
- Explain **why**, not **what**
- Document complex algorithms and business logic
- Add TODO comments for known limitations
- Reference issue numbers or ADRs where applicable

### Commit Messages
Follow Conventional Commits format:
```
type(scope): brief description

- Detail 1
- Detail 2
- Detail 3

Refs: #issue-number
```

**Types:** feat, fix, refactor, docs, test, chore

### API Documentation
- Document all API endpoints with request/response examples
- Include error response formats
- Specify authentication requirements
- Provide curl examples for manual testing

---

## Success Criteria for Phase 0

- [ ] All architectural decisions documented and reviewed
- [ ] Tech stack confirmed and dependencies listed
- [ ] Data flow diagrams created
- [ ] Common pitfalls identified
- [ ] Testing strategy defined
- [ ] Security considerations outlined
- [ ] This Phase-0.md file committed to repository

---

**Next Phase:** [Phase 1: Code Cleanup & Dead Code Removal](./Phase-1.md)
