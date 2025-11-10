# Phase 0.5: Codebase Exploration & Validation

## Phase Goal

Before implementing any changes, thoroughly explore and document the existing codebase structure, locate all critical services and files, and validate assumptions made in the refactor plan. This phase ensures the implementation engineer has an accurate map of the codebase and can proceed confidently without wasting time searching for files or creating duplicates.

**Success Criteria:**
- Codebase map document created with all critical file locations
- All service interfaces documented
- LinkedIn HTML structure captured and analyzed
- File path assumptions validated
- Prerequisites verified for all subsequent phases

**Estimated tokens:** ~5,000

---

## Prerequisites

- **Previous Phases:** Phase 0 (Foundation & Architecture) complete
- **External Dependencies:** None
- **Environment Requirements:**
  - Repository cloned locally
  - Code editor with search capabilities
  - Browser with LinkedIn access (for HTML inspection)

---

## Tasks

### Task 1: Map Puppeteer Backend Structure

**Goal:** Identify and document all existing services, controllers, routes, and utilities in the Puppeteer backend.

**Files to Create:**
- `Migration/docs/codebase-map.md` - Comprehensive codebase structure map

**Prerequisites:**
- Access to repository

**Implementation Steps:**

1. **Explore puppeteer-backend directory structure:**
   - List all directories and their purposes
   - Identify main entry point (`src/server.js` or similar)
   - Map out folder organization (controllers, services, routes, utils, config)

2. **Locate and document all services:**
   - Search for files matching `*Service.js` or `*service.js`
   - For each service found, document:
     - File path
     - Main purpose (1-2 sentence description)
     - Key methods (read file to identify)
     - Dependencies (what other services it imports)
   - Critical services to find:
     - LinkedInService (profile navigation, company search)
     - LinkedInContactService (screenshot capture, profile processing)
     - DynamoDBService (database operations)
     - PuppeteerService (browser management)
     - S3 upload service (if exists)

3. **Locate and document all controllers:**
   - Search for files matching `*Controller.js` or `*controller.js`
   - Document:
     - SearchController (handles LinkedIn search requests)
     - ProfileInitController (if exists)
     - LinkedInInteractionController (messaging, connections, posts)

4. **Map routes:**
   - Locate routes directory (`routes/` or similar)
   - List all route files and endpoints they define
   - Document:
     - `/search` routes
     - `/profile-init` routes
     - `/linkedin-interactions` routes
     - `/heal-restore` routes

5. **Identify utilities:**
   - List all utility files in `utils/` directory
   - Note utilities relevant to refactor:
     - Human behavior manager
     - Interaction queue
     - Healing manager
     - LinkedIn error handler
     - File helpers
     - Crypto utilities

6. **Document configuration:**
   - Locate `config/` directory
   - Identify how configuration is loaded (environment variables, config files)
   - Note existing S3, AWS, DynamoDB, LinkedIn settings

7. **Create initial codebase map:**
   - Document findings in `Migration/docs/codebase-map.md`
   - Use clear structure with file paths and descriptions
   - Include directory tree diagram

**Verification Checklist:**
- [ ] All services identified and documented
- [ ] All controllers identified and documented
- [ ] All routes mapped
- [ ] Critical utilities noted
- [ ] Configuration structure understood
- [ ] Codebase map created

**Testing Instructions:**
- Review codebase-map.md for completeness
- Verify all file paths are accurate (files exist at documented locations)
- Cross-reference with Phase 2-5 task assumptions

**Commit Message Template:**
```
docs(exploration): map Puppeteer backend structure

- Identify all services, controllers, routes
- Document key methods and interfaces
- Map configuration structure
- Create initial codebase-map.md
- Validate file locations for future phases
```

**Estimated tokens:** ~2,000

---

### Task 2: Map Frontend Structure

**Goal:** Identify and document frontend services, hooks, components, and structure relevant to the refactor.

**Files to Modify:**
- `Migration/docs/codebase-map.md` - Add frontend section

**Prerequisites:**
- Task 1 complete

**Implementation Steps:**

1. **Explore src/ directory structure:**
   - List all directories: components, hooks, services, contexts, pages, types, utils
   - Note organization patterns (atomic design, feature-based, etc.)

2. **Locate search-related code:**
   - Search for files containing "search" in name:
     - `useSearchResults` hook (or similar)
     - Search components
     - Search service methods
   - Document current search implementation (if exists)
   - Note: This may be incomplete if Pinecone search was never fully integrated

3. **Locate API services:**
   - Find `lambdaApiService.ts` (or similar API service file)
   - Find `puppeteerApiService.ts` (for backend communication)
   - Document existing API methods
   - Note authentication handling (Cognito)

4. **Locate connection-related components:**
   - Find components for displaying connections:
     - ConnectionCard, ConnectionFilters, ConnectionsTab, etc.
   - These may need updates for new search

5. **Map hooks:**
   - List all custom hooks in `hooks/` directory
   - Note hooks relevant to refactor:
     - useConnections
     - useSearchResults
     - useApi
     - useLocalStorage

6. **Identify contexts:**
   - List all React contexts
   - Note AuthContext (for Cognito)
   - Note any SearchContext or similar

7. **Update codebase map:**
   - Add Frontend section to codebase-map.md
   - Document file paths, purposes, and interfaces
   - Note missing files (files assumed in plan but don't exist)

**Verification Checklist:**
- [ ] Frontend directory structure documented
- [ ] Search-related files identified (or noted as missing)
- [ ] API service files located
- [ ] Relevant hooks and components mapped
- [ ] Codebase map updated with frontend section

**Testing Instructions:**
- Verify all documented frontend files exist
- Note any files assumed in Phase 5 that don't exist

**Commit Message Template:**
```
docs(exploration): map frontend structure

- Document src/ directory organization
- Locate search-related code
- Map API services and hooks
- Identify components for Phase 5 updates
- Update codebase-map.md with frontend section
```

**Estimated tokens:** ~1,500

---

### Task 3: Capture and Analyze LinkedIn HTML Structure

**Goal:** Capture current LinkedIn profile HTML structure for selector development and create fallback strategy.

**Files to Create:**
- `Migration/docs/linkedin-html-snapshot.html` - Current LinkedIn profile HTML
- `Migration/docs/linkedin-selectors.md` - Selector strategy and fallbacks

**Prerequisites:**
- LinkedIn credentials available
- Browser with DevTools

**Implementation Steps:**

1. **Capture LinkedIn profile HTML:**
   - Log into LinkedIn in browser
   - Navigate to a representative profile (preferably a full, active profile)
   - Open DevTools (F12) → Elements tab
   - Right-click `<html>` element → Copy → Copy Outer HTML
   - Save to `Migration/docs/linkedin-html-snapshot.html`

2. **Capture additional profile types:**
   - Capture HTML for:
     - Entry-level profile (minimal experience)
     - Profile with hidden sections (private settings)
     - Profile with non-English content (if relevant)
   - Save as separate files or note differences

3. **Analyze profile structure:**
   - Identify key sections:
     - Profile header (name, headline, location)
     - Experience section
     - Education section
     - Skills section
     - About section
   - Note HTML structure for each section

4. **Research selectors:**
   - For each section, identify potential selectors:
     - Primary selector (most stable, e.g., data attributes)
     - Secondary selector (class-based)
     - Fallback selector (XPath or text content matching)
   - Test selectors in DevTools console:
     ```javascript
     document.querySelector('.primary-selector')
     document.querySelector('.secondary-selector')
     ```

5. **Document selector strategy:**
   - Create `linkedin-selectors.md` with:
     - Selector for each profile field
     - Fallback selectors
     - XPath alternatives
     - Text content matching patterns
   - Include notes on selector brittleness

6. **Note recent LinkedIn changes:**
   - Check if LinkedIn HTML structure matches assumptions from Phase 2
   - Document any discrepancies
   - Flag high-risk selectors (likely to change)

**Verification Checklist:**
- [ ] LinkedIn HTML snapshot captured
- [ ] Key sections identified in HTML
- [ ] Selectors tested in browser
- [ ] Fallback strategy documented
- [ ] linkedin-selectors.md created

**Testing Instructions:**
- Open `linkedin-html-snapshot.html` in browser
- Verify structure matches live LinkedIn
- Test selectors from `linkedin-selectors.md` against snapshot:
  ```javascript
  // In browser console, load snapshot, then test:
  document.querySelector('.selector-from-doc')
  ```

**Commit Message Template:**
```
docs(exploration): capture LinkedIn HTML structure

- Save LinkedIn profile HTML snapshot
- Analyze profile sections and structure
- Research and test selectors for each field
- Document selector strategy with fallbacks
- Create linkedin-selectors.md guide
- Prepare for Phase 2 text extraction
```

**Estimated tokens:** ~1,500

---

### Task 4: Validate Phase Prerequisites

**Goal:** Verify that all assumptions made in Phases 1-5 are accurate and document any discrepancies.

**Files to Create:**
- `Migration/docs/prerequisite-validation.md` - Validation results

**Files to Modify:**
- `Migration/docs/codebase-map.md` - Add validation notes

**Prerequisites:**
- Tasks 1, 2, 3 complete

**Implementation Steps:**

1. **Validate Phase 1 assumptions:**
   - Verify Pinecone Lambda functions exist at documented paths:
     ```bash
     ls lambda-processing/linkedin-advanced-search-pinecone-*
     ```
   - Verify Pinecone test files exist:
     ```bash
     ls tests/*pinecone*
     ```
   - Confirm `@pinecone-database/pinecone` in package.json
   - Document any files not found

2. **Validate Phase 2 assumptions:**
   - Confirm LinkedInContactService exists and has `takeScreenShotAndUploadToS3` method:
     ```bash
     grep -n "takeScreenShotAndUploadToS3" puppeteer-backend/services/linkedinContactService.js
     ```
   - Verify DynamoDB service structure matches Phase 0 schema
   - Check if text extraction logic already exists (unlikely, but check)
   - Compare LinkedIn HTML with Phase 2 selector assumptions

3. **Validate Phase 3 assumptions:**
   - Check if S3 screenshot upload already uses `@aws-sdk/client-s3`:
     ```bash
     grep "@aws-sdk/client-s3" puppeteer-backend/package.json
     ```
   - Verify current S3 bucket configuration (screenshots)
   - Check DynamoDBService.saveProfile method exists

4. **Validate Phase 4 assumptions:**
   - Verify CloudFormation templates exist at documented paths
   - Confirm API Gateway structure matches plan
   - Check if Lambda deployment process is already established

5. **Validate Phase 5 assumptions:**
   - Verify frontend files exist:
     - `src/hooks/useSearchResults.ts`
     - `src/services/lambdaApiService.ts`
     - Search UI components
   - Check if search functionality is implemented or stubbed
   - Verify Cognito authentication is working

6. **Document discrepancies:**
   - Create `prerequisite-validation.md` with:
     - ✅ Validated assumptions
     - ❌ Invalid assumptions (files don't exist)
     - ⚠️ Partial assumptions (files exist but differ from plan)
   - For each discrepancy, note impact on plan

7. **Update phase plans if needed:**
   - If critical files don't exist, flag which tasks need adjustment
   - Note in codebase-map.md

**Verification Checklist:**
- [ ] Phase 1 assumptions validated (Pinecone files)
- [ ] Phase 2 assumptions validated (LinkedInContactService, selectors)
- [ ] Phase 3 assumptions validated (S3 SDK, DynamoDB methods)
- [ ] Phase 4 assumptions validated (CloudFormation templates)
- [ ] Phase 5 assumptions validated (frontend files)
- [ ] Discrepancies documented
- [ ] prerequisite-validation.md created

**Testing Instructions:**
- Review prerequisite-validation.md
- For each ❌ discrepancy, check if it blocks a phase
- Flag critical issues to address before Phase 1

**Commit Message Template:**
```
docs(exploration): validate phase prerequisites

- Verify all file path assumptions from Phases 1-5
- Test critical method existence
- Compare LinkedIn HTML with Phase 2 expectations
- Document discrepancies and impacts
- Create prerequisite-validation.md
- Flag any blockers for implementation
```

**Estimated tokens:** ~1,000

---

## Phase Verification

**How to verify entire Phase 0.5 is complete:**

1. **Verify codebase map exists:**
   ```bash
   cat Migration/docs/codebase-map.md
   # Should contain:
   # - Puppeteer backend structure
   # - Frontend structure
   # - All services, controllers, routes documented
   ```

2. **Verify LinkedIn HTML snapshot captured:**
   ```bash
   ls -lh Migration/docs/linkedin-html-snapshot.html
   # File should exist and be > 50KB
   ```

3. **Verify selector strategy documented:**
   ```bash
   cat Migration/docs/linkedin-selectors.md
   # Should contain selectors for all profile fields
   ```

4. **Verify prerequisite validation complete:**
   ```bash
   cat Migration/docs/prerequisite-validation.md
   # Should list validation results for Phases 1-5
   ```

5. **Review for critical blockers:**
   - Check prerequisite-validation.md for ❌ items
   - Determine if any blockers prevent starting Phase 1

**Integration points to test:**
- Codebase map aligns with Phase 2-5 task assumptions
- LinkedIn selectors align with Phase 2 extraction plans
- No critical files missing that would block implementation

**Known limitations or technical debt introduced:**
- LinkedIn HTML snapshot is point-in-time (may become stale)
- Selector strategy may need updates if LinkedIn changes structure
- Codebase map may need updates if new files are created

---

**Previous Phase:** [Phase 0: Foundation & Architecture](./Phase-0.md)

**Next Phase:** [Phase 1: Code Cleanup & Dead Code Removal](./Phase-1.md)
