# Codebase Map - LinkedIn Advanced Search

**Purpose:** Comprehensive map of codebase structure, critical files, and service interfaces.

**Status:** Template - To be completed in Phase 0.5

**Last Updated:** 2025-11-09

---

## Directory Structure

### Root Structure
```
linkedin-advanced-search/
├── src/                          # Frontend (React/Vite)
├── puppeteer-backend/            # Backend (Node.js/Express)
├── lambda-processing/            # AWS Lambda functions
├── RAG-CloudStack/               # CloudFormation templates
├── tests/                        # Test files
└── Migration/                    # Refactor documentation
```

---

## Puppeteer Backend Structure

### Directory Tree
```
puppeteer-backend/
├── src/
│   ├── server.js                 # [TO DOCUMENT] Main entry point
│   └── routes/                   # [TO DOCUMENT] Route handlers
├── controllers/                  # [TO DOCUMENT] Business logic
├── services/                     # [TO DOCUMENT] Service layer
├── utils/                        # [TO DOCUMENT] Utilities
├── config/                       # [TO DOCUMENT] Configuration
└── package.json
```

### Services

#### LinkedInService
- **File Path:** [TO BE LOCATED in Phase 0.5]
- **Purpose:** [TO DOCUMENT]
- **Key Methods:**
  - [ ] `login(username, password, ...)`
  - [ ] `searchCompany(companyName)`
  - [ ] `analyzeContactActivity(profileUrl, jwtToken)`
  - [ ] [ADDITIONAL METHODS TO DOCUMENT]
- **Dependencies:** [TO DOCUMENT]

#### LinkedInContactService
- **File Path:** [TO BE LOCATED in Phase 0.5]
- **Purpose:** [TO DOCUMENT - Screenshot capture and profile processing]
- **Key Methods:**
  - [ ] `takeScreenShotAndUploadToS3(profileUrl, status)` - **CRITICAL for Phase 2**
  - [ ] [ADDITIONAL METHODS TO DOCUMENT]
- **Dependencies:** [TO DOCUMENT]
- **Notes:** Phase 2 will integrate text extraction into this service

#### DynamoDBService
- **File Path:** [TO BE LOCATED in Phase 0.5]
- **Purpose:** [TO DOCUMENT]
- **Key Methods:**
  - [ ] `saveProfile(profileData)` - **CRITICAL for Phase 2 & 3**
  - [ ] [ADDITIONAL METHODS TO DOCUMENT]
- **Dependencies:** [TO DOCUMENT]

#### PuppeteerService
- **File Path:** [TO BE LOCATED in Phase 0.5]
- **Purpose:** [TO DOCUMENT - Browser management]
- **Key Methods:**
  - [ ] `initialize()`
  - [ ] [ADDITIONAL METHODS TO DOCUMENT]
- **Dependencies:** [TO DOCUMENT]

#### [OTHER SERVICES TO DISCOVER]
- **S3 Upload Service:** [Check if exists]
- **Google AI Service:** [Noted in package.json]
- **Profile Init Service:** [Check if exists]
- **Heal & Restore Service:** [Noted in routes]

### Controllers

#### SearchController
- **File Path:** [TO BE LOCATED in Phase 0.5]
- **Purpose:** [TO DOCUMENT]
- **Key Methods:**
  - [ ] `performSearch(req, res)`
  - [ ] `performSearchFromState(state)`
  - [ ] [ADDITIONAL METHODS TO DOCUMENT]

#### [OTHER CONTROLLERS TO DISCOVER]
- **LinkedInInteractionController:** [TO LOCATE]
- **ProfileInitController:** [TO LOCATE]

### Routes

#### /search
- **File Path:** [TO BE LOCATED]
- **Endpoints:**
  - [ ] `POST /search` - [DOCUMENT PARAMETERS]
  - [ ] `GET /search/results`
  - [ ] `GET /search/health`

#### /heal-restore
- **File Path:** [TO BE LOCATED]
- **Endpoints:**
  - [ ] `GET /heal-restore/status`
  - [ ] `POST /heal-restore/authorize`

#### /profile-init
- **File Path:** [TO BE LOCATED]
- **Endpoints:**
  - [ ] `POST /profile-init`
  - [ ] `GET /profile-init/health`

#### /linkedin-interactions
- **File Path:** [TO BE LOCATED]
- **Endpoints:**
  - [ ] `POST /linkedin-interactions/send-message`
  - [ ] `POST /linkedin-interactions/add-connection`
  - [ ] `POST /linkedin-interactions/create-post`
  - [ ] `GET /linkedin-interactions/session-status`

### Utilities

#### Critical Utilities (to locate and document)
- [ ] `humanBehaviorManager.js` - Human behavior simulation
- [ ] `interactionQueue.js` - In-memory FIFO queue
- [ ] `healingManager.js` - Heal & restore checkpoint system
- [ ] `linkedinErrorHandler.js` - Error handling
- [ ] `fileHelpers.js` - File operations
- [ ] `crypto.js` - Sealbox encryption
- [ ] `logger.js` - Winston logging
- [ ] [ADDITIONAL UTILITIES TO DISCOVER]

### Configuration

#### config/index.js
- **Location:** [TO BE LOCATED]
- **Structure:** [TO DOCUMENT]
- **Key Sections:**
  - [ ] AWS configuration
  - [ ] S3 configuration
  - [ ] LinkedIn settings
  - [ ] Timeouts
  - [ ] Feature flags

---

## Frontend Structure

### Directory Tree
```
src/
├── components/                   # [TO DOCUMENT] UI components
├── hooks/                        # [TO DOCUMENT] Custom hooks
├── services/                     # [TO DOCUMENT] API services
├── contexts/                     # [TO DOCUMENT] React contexts
├── pages/                        # [TO DOCUMENT] Page components
├── types/                        # [TO DOCUMENT] TypeScript types
├── utils/                        # [TO DOCUMENT] Utilities
└── main.tsx                      # [TO DOCUMENT] Entry point
```

### Services

#### lambdaApiService
- **File Path:** [TO BE LOCATED in Phase 0.5] - Assumed: `src/services/lambdaApiService.ts`
- **Purpose:** [TO DOCUMENT - API Gateway communication]
- **Key Methods:**
  - [ ] `getConnectionsByStatus(status)` - **May exist**
  - [ ] `searchProfiles(query, filters)` - **May NOT exist (to be added in Phase 5)**
  - [ ] [ADDITIONAL METHODS TO DOCUMENT]
- **Notes:** Phase 5 will add `searchProfiles` method for placeholder API

#### puppeteerApiService
- **File Path:** [TO BE LOCATED in Phase 0.5] - Assumed: `src/services/puppeteerApiService.ts`
- **Purpose:** [TO DOCUMENT - Puppeteer backend communication]
- **Key Methods:**
  - [ ] `searchLinkedIn(searchData)`
  - [ ] [ADDITIONAL METHODS TO DOCUMENT]

### Hooks

#### useSearchResults
- **File Path:** [TO BE LOCATED in Phase 0.5] - Assumed: `src/hooks/useSearchResults.ts`
- **Purpose:** [TO DOCUMENT - Search results management]
- **Exists:** [✓ or ✗ - TO VERIFY]
- **Current Implementation:** [TO DOCUMENT]
- **Phase 5 Changes:** Will update to call placeholder search API

#### useConnections
- **File Path:** [TO BE LOCATED]
- **Purpose:** [TO DOCUMENT]

#### useApi
- **File Path:** [TO BE LOCATED]
- **Purpose:** [TO DOCUMENT]

#### [OTHER HOOKS TO DISCOVER]

### Components

#### Search-Related Components (for Phase 5)
- [ ] **ConnectionFilters.tsx** - [TO LOCATE - May contain search UI]
- [ ] **ResearchResultsCard.tsx** - [TO LOCATE - May display search results]
- [ ] **Search Input Component** - [TO LOCATE OR NOTE AS MISSING]
- [ ] **Search Results Display** - [TO LOCATE OR NOTE AS MISSING]

#### Connection Components
- [ ] **ConnectionCard.tsx** - [LIKELY EXISTS]
- [ ] **ConnectionsTab.tsx** - [LIKELY EXISTS]
- [ ] **NewConnectionCard.tsx** - [LIKELY EXISTS]
- [ ] **NewConnectionsTab.tsx** - [LIKELY EXISTS]

#### Other Components
- [ ] **Dashboard.tsx** - [Page component]
- [ ] **ProgressIndicator.tsx** - [For loading states]
- [ ] [ADDITIONAL COMPONENTS TO DISCOVER]

### Contexts

#### AuthContext
- **File Path:** [TO BE LOCATED] - Assumed: `src/contexts/AuthContext.tsx`
- **Purpose:** [TO DOCUMENT - Cognito authentication]
- **Exists:** [✓ or ✗ - TO VERIFY]

#### [OTHER CONTEXTS TO DISCOVER]

---

## Lambda Functions

### Existing Lambda Functions (Before Refactor)

#### linkedin-advanced-search-pinecone-indexer-prod
- **File Path:** `lambda-processing/linkedin-advanced-search-pinecone-indexer-prod/`
- **Purpose:** Pinecone vector indexing (TO BE DELETED in Phase 1)
- **Status:** ❌ DEAD CODE - Remove in Phase 1

#### linkedin-advanced-search-pinecone-search-prod
- **File Path:** `lambda-processing/linkedin-advanced-search-pinecone-search-prod/`
- **Purpose:** Pinecone vector search (TO BE DELETED in Phase 1)
- **Status:** ❌ DEAD CODE - Remove in Phase 1

#### linkedin-advanced-search-llm-prod
- **File Path:** [TO BE LOCATED]
- **Purpose:** [TO DOCUMENT - OpenAI LLM integration]
- **Status:** ✓ KEEP - Active function

#### linkedin-advanced-search-edge-processing-prod
- **File Path:** [TO BE LOCATED]
- **Purpose:** [TO DOCUMENT]
- **Status:** ✓ KEEP - Active function

#### [OTHER LAMBDA FUNCTIONS TO DISCOVER]

### New Lambda Functions (Refactor)

#### linkedin-advanced-search-placeholder-search-prod
- **File Path:** Will be created in Phase 4
- **Purpose:** Placeholder search API (returns empty results)
- **Status:** ➕ TO BE CREATED in Phase 4

---

## Test Files

### Pinecone Tests (TO BE DELETED in Phase 1)
- [ ] `tests/test-pinecone-connectivity.py`
- [ ] `tests/test-pinecone-integration.py`
- [ ] `tests/run-pinecone-search-tests.js`
- [ ] `tests/README-pinecone-search-tests.md`

### Other Tests (TO KEEP)
- [ ] [TO DOCUMENT - List non-Pinecone tests]

---

## CloudFormation Templates

### RAG-CloudStack/templates/
- [ ] `lambdas.yaml` - Lambda function definitions
- [ ] `apigw-http.yaml` - API Gateway configuration
- [ ] `dynamodb.yaml` - DynamoDB table definition
- [ ] `s3-artifacts.yaml` - S3 bucket for artifacts
- [ ] `cognito.yaml` - Cognito User Pool

---

## Validation Notes

### Files Assumed in Plan but NOT FOUND
[TO BE COMPLETED in Phase 0.5]
- [ ] List any files referenced in Phases 1-5 that don't exist
- [ ] Note impact on plan (e.g., need to create file vs. rename task)

### Files Found but NOT in Plan
[TO BE COMPLETED in Phase 0.5]
- [ ] List any important files not mentioned in plan
- [ ] Note if they need to be addressed in refactor

### Discrepancies
[TO BE COMPLETED in Phase 0.5]
- [ ] Note any differences between plan assumptions and actual code
- [ ] Example: "LinkedInContactService method is named `uploadToS3` not `takeScreenShotAndUploadToS3`"

---

## Phase 0.5 Completion Checklist

- [ ] All services located and documented
- [ ] All controllers located and documented
- [ ] All routes mapped
- [ ] Critical utilities identified
- [ ] Frontend structure mapped
- [ ] Search-related code located (or noted as missing)
- [ ] Lambda functions inventoried
- [ ] Test files categorized (keep vs. delete)
- [ ] CloudFormation templates reviewed
- [ ] File path assumptions validated
- [ ] Discrepancies documented

---

**Instructions for Phase 0.5:**
1. Systematically explore each section above
2. Replace `[TO BE LOCATED]` with actual file paths
3. Replace `[TO DOCUMENT]` with actual descriptions
4. Check all `[ ]` checkboxes as items are verified
5. Document all discrepancies between plan and reality
6. Update this map as exploration progresses

**Related Documents:**
- [Phase 0.5: Codebase Exploration](./plans/Phase-0.5.md)
- [Environment Variables](./environment-variables.md)
- [Prerequisite Validation](./prerequisite-validation.md) (to be created in Phase 0.5)
