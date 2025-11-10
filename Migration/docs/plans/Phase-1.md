# Phase 1: Code Cleanup & Dead Code Removal

## Phase Goal

Remove all Pinecone-related code, infrastructure, and dependencies from the codebase. This is the **largest** part of the refactor and must be completed before implementing new functionality. By the end of this phase, the codebase will be clean, with no references to Pinecone, and all stale documentation removed.

**Success Criteria:**
- All Pinecone Lambda functions deleted
- All Pinecone test files deleted
- Pinecone dependency removed from `package.json`
- Pinecone environment variables removed from `.env.example`
- CloudFormation templates updated to remove Pinecone references
- Stale README TODO section removed
- All grep searches for "pinecone" (case-insensitive) return zero results in source code

**Estimated tokens:** ~25,000

---

## Prerequisites

- **Previous Phases:** Phase 0 (Foundation & Architecture) must be complete
- **External Dependencies:** None
- **Environment Requirements:** Local development environment with access to repository

---

## Tasks

### Task 1: Identify All Pinecone References

**Goal:** Create a comprehensive inventory of all Pinecone-related files and references to ensure nothing is missed during cleanup.

**Files to Create:**
- `Migration/docs/pinecone-cleanup-inventory.md` - Detailed inventory of all Pinecone references

**Prerequisites:**
- Repository cloned locally
- Access to grep/search tools

**Implementation Steps:**

1. **Search for Pinecone references across the entire codebase:**
   - Use case-insensitive grep to find "pinecone" in all files
   - Search for "vector search", "embedding", "semantic search" which may relate to Pinecone
   - Check all file types: `.js`, `.ts`, `.tsx`, `.py`, `.json`, `.yaml`, `.md`, `.sh`, `.env.example`
   - Document findings by category: Lambda functions, tests, infrastructure, dependencies, documentation

2. **Categorize findings:**
   - **Lambda Functions:** List all Lambda directories that reference Pinecone
   - **Test Files:** List all test files and test documentation
   - **Dependencies:** Identify package.json entries
   - **Infrastructure:** CloudFormation templates, deployment scripts
   - **Documentation:** README sections, inline comments
   - **Environment Configuration:** .env.example entries
   - **Frontend Code:** Any UI components or services referencing Pinecone search

3. **Create deletion checklist:**
   - For each identified item, note the file path and line numbers
   - Mark items as "DELETE" (complete removal) or "MODIFY" (partial removal)
   - Identify any dependencies between items (e.g., imports that will break)

4. **Verify no hidden dependencies:**
   - Check `package-lock.json` for transitive Pinecone dependencies
   - Review Lambda layer configurations
   - Check for environment variable references in deployment scripts

**Verification Checklist:**
- [ ] Comprehensive inventory document created
- [ ] All categories populated with specific file paths
- [ ] Deletion checklist includes all identified items
- [ ] No Pinecone references found in unexpected locations

**Testing Instructions:**
- Run grep searches to verify inventory completeness:
  ```bash
  grep -ri "pinecone" --exclude-dir=node_modules --exclude-dir=.git
  grep -ri "vector.*search" --exclude-dir=node_modules --exclude-dir=.git
  ```
- Manually review inventory document for accuracy

**Commit Message Template:**
```
docs(cleanup): create Pinecone cleanup inventory

- Comprehensive grep search for all Pinecone references
- Categorized findings by type (Lambda, tests, infra, docs)
- Created deletion checklist with file paths
- Identified 19+ files requiring deletion
- Identified 5+ files requiring modification
```

**Estimated tokens:** ~3,000

---

### Task 2: Delete Pinecone Lambda Functions

**Goal:** Remove all Lambda function directories and code related to Pinecone indexing and search.

**Files to Delete:**
- `lambda-processing/linkedin-advanced-search-pinecone-indexer-prod/` (entire directory)
- `lambda-processing/linkedin-advanced-search-pinecone-search-prod/` (entire directory)
- `lambda-processing/linkedin-advanced-search-profile-processing-dev/` (if Pinecone-related)

**Prerequisites:**
- Task 1 inventory complete
- Backup of repository (git commit) before deletion

**Implementation Steps:**

1. **Review Lambda function purpose:**
   - Read the README.md in each Pinecone Lambda directory
   - Confirm the function is exclusively for Pinecone (not dual-purpose)
   - Check for any shared utilities that might be needed elsewhere

2. **Check for dependencies:**
   - Review any CloudFormation templates that reference these Lambdas
   - Identify API Gateway routes that call these Lambdas
   - Check for any frontend code calling these Lambda endpoints

3. **Delete Lambda directories:**
   - Use `rm -rf` to delete each Pinecone Lambda directory
   - Ensure deletion is complete (no orphaned files)
   - Verify no symlinks point to deleted directories

4. **Update related infrastructure:**
   - Remove Lambda function references from CloudFormation templates (will be done in Task 4)
   - Document any API routes that will become defunct

**Verification Checklist:**
- [ ] `linkedin-advanced-search-pinecone-indexer-prod` directory deleted
- [ ] `linkedin-advanced-search-pinecone-search-prod` directory deleted
- [ ] No references to deleted Lambda functions in remaining code
- [ ] No broken imports in remaining Lambda functions

**Testing Instructions:**
- Verify directories are deleted:
  ```bash
  ls -la lambda-processing/ | grep pinecone
  # Should return no results
  ```
- Check for import errors:
  ```bash
  grep -r "pinecone-indexer\|pinecone-search" lambda-processing/
  # Should return no results
  ```

**Commit Message Template:**
```
refactor(lambda): remove Pinecone Lambda functions

- Delete linkedin-advanced-search-pinecone-indexer-prod/
- Delete linkedin-advanced-search-pinecone-search-prod/
- Remove all Pinecone vector indexing logic
- Remove all Pinecone search functionality
- Part of Pinecone removal refactor (Phase 1)
```

**Estimated tokens:** ~4,000

---

### Task 3: Delete Pinecone Test Files

**Goal:** Remove all test files, test scripts, and test documentation related to Pinecone functionality.

**Files to Delete:**
- `tests/test-pinecone-connectivity.py`
- `tests/test-pinecone-integration.py`
- `tests/test-lambda-unit.py` (if Pinecone-specific; review first)
- `tests/run-pinecone-search-tests.js`
- `tests/README-pinecone-search-tests.md`

**Prerequisites:**
- Task 1 inventory complete
- Task 2 Lambda deletions complete

**Implementation Steps:**

1. **Review each test file:**
   - Confirm the test is exclusively for Pinecone functionality
   - Check `test-lambda-unit.py` - it may test other Lambdas, so review carefully
   - Identify any shared test utilities or fixtures

2. **Delete Pinecone-specific test files:**
   - Delete Python test files: `test-pinecone-connectivity.py`, `test-pinecone-integration.py`
   - Delete JavaScript test files: `run-pinecone-search-tests.js`
   - Delete test documentation: `README-pinecone-search-tests.md`
   - If `test-lambda-unit.py` is Pinecone-only, delete it; otherwise, edit to remove Pinecone tests

3. **Clean up test configuration:**
   - Remove any Pinecone-related test scripts from `package.json` (if present)
   - Remove test fixtures or mock data for Pinecone
   - Update test runner configurations if they reference deleted tests

4. **Update test documentation:**
   - Remove references to Pinecone tests from main test README (if it exists)
   - Update test coverage reports to exclude Pinecone tests

**Verification Checklist:**
- [ ] All Pinecone test files deleted
- [ ] No Pinecone test scripts in package.json
- [ ] No broken test imports or references
- [ ] Test runner configurations updated

**Testing Instructions:**
- Verify test files deleted:
  ```bash
  ls tests/ | grep pinecone
  # Should return no results
  ```
- Run remaining tests to ensure no breakage:
  ```bash
  npm run test
  # All tests should pass
  ```

**Commit Message Template:**
```
test(cleanup): remove Pinecone test suite

- Delete test-pinecone-connectivity.py
- Delete test-pinecone-integration.py
- Delete run-pinecone-search-tests.js
- Delete README-pinecone-search-tests.md
- Remove Pinecone test fixtures and mocks
- Part of Pinecone removal refactor (Phase 1)
```

**Estimated tokens:** ~3,500

---

### Task 4: Update CloudFormation Templates

**Goal:** Remove all Pinecone-related configuration from CloudFormation infrastructure templates.

**Files to Modify:**
- `RAG-CloudStack/templates/lambdas.yaml`
- `RAG-CloudStack/templates/apigw-http.yaml`
- `RAG-CloudStack/deploy.sh`
- `RAG-CloudStack/README.md`

**Prerequisites:**
- Task 2 Lambda deletions complete
- Understanding of CloudFormation syntax

**Implementation Steps:**

1. **Review current CloudFormation templates:**
   - Examine `lambdas.yaml` for Pinecone Lambda function definitions
   - Check `apigw-http.yaml` for Pinecone search route (`/pinecone-search`)
   - Review `deploy.sh` for Pinecone-related environment variables
   - Read `RAG-CloudStack/README.md` for Pinecone documentation

2. **Update lambdas.yaml:**
   - Remove Lambda function resources for Pinecone indexer and search
   - Remove Pinecone-related parameters (PineconeApiKey, PineconeHost, PineconeIndexName)
   - Remove environment variable configurations for Pinecone
   - Verify no references to Pinecone Lambda outputs

3. **Update apigw-http.yaml:**
   - Remove the `/pinecone-search` route definition
   - Remove any Pinecone-related API Gateway integrations
   - Update CORS configuration if necessary
   - Verify no broken references to deleted Lambdas

4. **Update deploy.sh:**
   - Remove Pinecone environment variable parameters:
     - `PINECONE_API_KEY`
     - `PINECONE_HOST`
     - `PINECONE_INDEX_NAME`
   - Remove `NODE_ROUTE_PATH=/pinecone-search` (or update to new path)
   - Remove Pinecone-related deployment instructions
   - Update script comments to remove Pinecone references

5. **Update RAG-CloudStack/README.md:**
   - Remove Pinecone section (lines ~63-74)
   - Remove Pinecone environment variables from deploy example
   - Remove MCP quickstart for Pinecone section
   - Update API documentation to remove `/pinecone-search` route
   - Update stack description to reflect simplified architecture

6. **Validate CloudFormation templates:**
   - Use `cfn-lint` or AWS CloudFormation validate-template if available
   - Check for any orphaned references or broken dependencies
   - Ensure template is valid YAML syntax

**Verification Checklist:**
- [ ] No Pinecone Lambda definitions in lambdas.yaml
- [ ] No Pinecone parameters in CloudFormation templates
- [ ] No `/pinecone-search` route in apigw-http.yaml
- [ ] No Pinecone environment variables in deploy.sh
- [ ] CloudFormation templates pass validation
- [ ] README documentation updated

**Testing Instructions:**
- Validate CloudFormation syntax:
  ```bash
  # If cfn-lint is available
  cfn-lint RAG-CloudStack/templates/*.yaml
  ```
- Grep for remaining Pinecone references:
  ```bash
  grep -ri "pinecone" RAG-CloudStack/
  # Should return no results
  ```

**Commit Message Template:**
```
refactor(infra): remove Pinecone from CloudFormation stack

- Remove Pinecone Lambda definitions from lambdas.yaml
- Remove /pinecone-search route from apigw-http.yaml
- Remove Pinecone environment variables from deploy.sh
- Update RAG-CloudStack README to remove Pinecone docs
- Simplify infrastructure to core components only
- Part of Pinecone removal refactor (Phase 1)
```

**Estimated tokens:** ~5,000

---

### Task 5: Remove Pinecone Dependency from package.json

**Goal:** Remove the `@pinecone-database/pinecone` dependency from the root `package.json` and regenerate lockfiles.

**Files to Modify:**
- `package.json` (root)
- `package-lock.json` (root, regenerated)

**Prerequisites:**
- All Pinecone code deleted (Tasks 2, 3)
- CloudFormation templates updated (Task 4)

**Implementation Steps:**

1. **Verify Pinecone is in devDependencies:**
   - Open `package.json` and locate `@pinecone-database/pinecone` (should be in devDependencies)
   - Confirm it's not used anywhere in remaining code (grep search)

2. **Remove dependency:**
   - Manually edit `package.json` to remove the line:
     ```json
     "@pinecone-database/pinecone": "^6.1.1",
     ```
   - Ensure JSON syntax remains valid (no trailing commas)

3. **Regenerate package-lock.json:**
   - Run `npm install` to update the lockfile
   - Verify Pinecone and its transitive dependencies are removed
   - Check that other dependencies are not affected

4. **Clean node_modules (optional but recommended):**
   - Delete `node_modules` directory
   - Run `npm ci` to perform a clean install
   - Verify application still builds and runs

**Verification Checklist:**
- [ ] `@pinecone-database/pinecone` removed from package.json
- [ ] package-lock.json regenerated (no Pinecone entries)
- [ ] No Pinecone packages in node_modules
- [ ] Application builds successfully (`npm run build`)
- [ ] Tests run successfully (`npm test`)

**Testing Instructions:**
- Verify dependency removed:
  ```bash
  grep -i "pinecone" package.json
  # Should return no results
  grep -i "pinecone" package-lock.json
  # Should return no results
  ```
- Build and test:
  ```bash
  npm run build
  npm run test
  # Both should succeed
  ```

**Commit Message Template:**
```
chore(deps): remove Pinecone dependency

- Remove @pinecone-database/pinecone from devDependencies
- Regenerate package-lock.json
- Clean install to verify no breakage
- Part of Pinecone removal refactor (Phase 1)
```

**Estimated tokens:** ~2,500

---

### Task 6: Remove Pinecone Environment Variables

**Goal:** Remove all Pinecone-related environment variables from `.env.example` and related documentation.

**Files to Modify:**
- `.env.example`

**Prerequisites:**
- All Pinecone code deleted (Tasks 2, 3)
- Infrastructure updated (Task 4)
- Dependencies removed (Task 5)

**Implementation Steps:**

1. **Review current .env.example:**
   - Locate Pinecone-related environment variables (lines ~139-142):
     ```
     # PINECONE_API_KEY=
     # OPENAI_API_KEY=
     # PINECONE_HOST=
     # PINECONE_INDEX_NAME=
     ```
   - Confirm these are no longer needed

2. **Remove Pinecone variables:**
   - Delete lines for PINECONE_API_KEY, PINECONE_HOST, PINECONE_INDEX_NAME
   - Keep OPENAI_API_KEY if it's used for LLM Lambda (verify first)
   - Remove any Pinecone-related comments or section headers

3. **Review for other Pinecone references:**
   - Check for any inline comments mentioning Pinecone
   - Ensure no other environment files reference Pinecone (e.g., `.env.production.example`)

4. **Update documentation:**
   - If there's a separate environment variable documentation file, update it
   - Remove Pinecone setup instructions from any deployment guides

**Verification Checklist:**
- [ ] PINECONE_API_KEY removed from .env.example
- [ ] PINECONE_HOST removed from .env.example
- [ ] PINECONE_INDEX_NAME removed from .env.example
- [ ] No other Pinecone references in .env.example
- [ ] Environment variable documentation updated (if exists)

**Testing Instructions:**
- Verify removal:
  ```bash
  grep -i "pinecone" .env.example
  # Should return no results
  ```
- Check for any other .env files:
  ```bash
  find . -name ".env*" -type f | xargs grep -i "pinecone"
  # Should return no results
  ```

**Commit Message Template:**
```
chore(config): remove Pinecone environment variables

- Remove PINECONE_API_KEY from .env.example
- Remove PINECONE_HOST from .env.example
- Remove PINECONE_INDEX_NAME from .env.example
- Part of Pinecone removal refactor (Phase 1)
```

**Estimated tokens:** ~2,000

---

### Task 7: Update Main README.md

**Goal:** Remove all Pinecone references from the main README and delete the stale "Work in Progress / To Do" section.

**Files to Modify:**
- `README.md` (root)

**Prerequisites:**
- All previous cleanup tasks complete
- Understanding of the new architecture (from Phase 0)

**Implementation Steps:**

1. **Remove Pinecone badge:**
   - Delete line 15:
     ```markdown
     [![Pinecone](https://img.shields.io/badge/Pinecone-000000?logo=pinecone&logoColor=white)](https://www.pinecone.io/)
     ```

2. **Update Features section:**
   - Remove line 26: "**Semantic Profile Search**: Pinecone vector database for intelligent connection discovery"
   - Update Application Architecture (line 34) to remove "Pinecone vector search"
   - Update System Architecture diagram (lines 43-51) to remove Pinecone

3. **Update Infrastructure Components:**
   - Remove line 57: "**Vector Search**: Pinecone for semantic profile matching"
   - Update description to reflect S3-based text storage instead

4. **Remove AI Integration - Pinecone section:**
   - Delete lines 122-125 (Pinecone Vector Search subsection)

5. **Delete the stale "Work in Progress / To Do" section:**
   - **DELETE lines 186-213** entirely (the entire "## 🚧 Work in Progress / To Do" section)
   - This section is obsolete and must not be referenced or implemented

6. **Update architecture description:**
   - Revise to reflect the new simplified architecture:
     - Puppeteer extracts text → uploads to S3
     - No vector search (placeholder API instead)
     - External search system (future)

7. **Update Quick Start section:**
   - Remove Pinecone API key from prerequisites (line 67)
   - Remove any Pinecone setup instructions

**Verification Checklist:**
- [ ] Pinecone badge removed
- [ ] Pinecone features removed from Features section
- [ ] System architecture diagram updated
- [ ] Pinecone Vector Search subsection deleted
- [ ] Stale TODO section (lines 186-213) completely deleted
- [ ] Quick Start section updated
- [ ] README accurately reflects new architecture

**Testing Instructions:**
- Verify no Pinecone references:
  ```bash
  grep -i "pinecone" README.md
  # Should return no results
  ```
- Verify TODO section deleted:
  ```bash
  grep -A 10 "Work in Progress" README.md
  # Should return no results
  ```
- Render README in a Markdown viewer to check formatting

**Commit Message Template:**
```
docs(readme): remove Pinecone references and stale TODO

- Remove Pinecone badge and feature descriptions
- Update system architecture to reflect text extraction model
- Remove Pinecone Vector Search section
- Delete obsolete "Work in Progress / To Do" section (lines 186-213)
- Update prerequisites to remove Pinecone API key
- README now reflects simplified architecture
- Part of Pinecone removal refactor (Phase 1)
```

**Estimated tokens:** ~4,000

---

### Task 8: Final Cleanup and Verification

**Goal:** Perform a comprehensive verification that all Pinecone code and references have been removed, and the codebase is clean.

**Files to Review:**
- All source code files
- All configuration files
- All documentation files

**Prerequisites:**
- All previous tasks (1-7) complete

**Implementation Steps:**

1. **Run comprehensive grep searches:**
   - Search for "pinecone" (case-insensitive) across entire codebase:
     ```bash
     grep -ri "pinecone" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=Migration
     ```
   - Search for "vector search", "embedding", "semantic search":
     ```bash
     grep -ri "vector.*search\|embedding\|semantic.*search" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=Migration
     ```
   - Expected result: **Zero matches** in source code (only matches in Migration/docs/plans are OK)

2. **Check for orphaned files:**
   - Look for any files in `lambda-processing/` that shouldn't be there
   - Check for any test files that might be Pinecone-related but not caught earlier
   - Review `tests/` directory for any remaining Pinecone artifacts

3. **Verify directory structure:**
   - List `lambda-processing/` directory and confirm only non-Pinecone Lambdas remain:
     - `linkedin-advanced-search-dynamodb-api-prod`
     - `linkedin-advanced-search-edge-processing-prod`
     - `linkedin-advanced-search-llm-prod`
     - `openai-webhook-handler`
   - Verify `tests/` directory has no Pinecone files

4. **Test application builds:**
   - Run `npm install` to ensure dependencies are correct
   - Run `npm run build` to verify frontend builds
   - Run `npm run test` to verify tests pass
   - Start Puppeteer backend to verify it runs:
     ```bash
     cd puppeteer-backend && npm start
     ```

5. **Review git status:**
   - Run `git status` to see all modified and deleted files
   - Verify the changes match expectations from Tasks 1-7
   - Ensure no unintended files were modified

6. **Create final cleanup summary:**
   - Document all files deleted
   - Document all files modified
   - Confirm zero Pinecone references remain
   - Create a summary report in `Migration/docs/phase1-cleanup-summary.md`

**Verification Checklist:**
- [ ] Zero grep matches for "pinecone" in source code
- [ ] All Pinecone Lambda directories deleted
- [ ] All Pinecone test files deleted
- [ ] CloudFormation templates updated and valid
- [ ] package.json and package-lock.json clean
- [ ] .env.example updated
- [ ] README.md updated and stale TODO removed
- [ ] Application builds successfully
- [ ] Tests pass successfully
- [ ] Puppeteer backend starts successfully
- [ ] Cleanup summary document created

**Testing Instructions:**
- Final grep verification:
  ```bash
  # Should return ZERO results in source code
  grep -ri "pinecone" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=Migration .
  ```
- Build verification:
  ```bash
  npm run build && echo "Build successful"
  ```
- Test verification:
  ```bash
  npm run test && echo "Tests successful"
  ```
- Backend verification:
  ```bash
  cd puppeteer-backend
  npm start &
  sleep 5
  curl http://localhost:3001/health
  # Should return healthy status
  pkill -f "node.*server.js"
  ```

**Commit Message Template:**
```
chore(cleanup): complete Pinecone removal verification

- Verified zero Pinecone references in source code
- Confirmed all Lambda directories cleaned
- Verified all test files removed
- Validated CloudFormation templates
- Tested application build and tests
- Created Phase 1 cleanup summary report
- Phase 1 (Code Cleanup) complete
```

**Estimated tokens:** ~3,000

---

## Phase Verification

**How to verify entire Phase 1 is complete:**

1. **Run the comprehensive grep test:**
   ```bash
   grep -ri "pinecone" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=Migration .
   ```
   **Expected:** Zero matches in source code

2. **Verify directory structure:**
   ```bash
   ls lambda-processing/
   # Should NOT include: pinecone-indexer-prod, pinecone-search-prod
   ls tests/ | grep pinecone
   # Should return no results
   ```

3. **Verify dependencies:**
   ```bash
   grep "pinecone" package.json package-lock.json
   # Should return no results
   ```

4. **Verify environment configuration:**
   ```bash
   grep -i "pinecone" .env.example
   # Should return no results
   ```

5. **Verify README:**
   ```bash
   grep -i "pinecone\|work in progress" README.md
   # Should return no results
   ```

6. **Build and test:**
   ```bash
   npm run build && npm run test
   # Both should succeed with no errors
   ```

7. **Review git diff:**
   ```bash
   git diff --stat
   git diff
   # Review all changes to ensure they match Phase 1 tasks
   ```

**Integration points to test:**
- Frontend should build without errors
- Puppeteer backend should start successfully
- No broken imports or missing dependencies
- All existing tests should pass

**Known limitations or technical debt introduced:**
- Search functionality is temporarily broken (will be replaced with placeholder API in Phase 4)
- No vector search capability (to be replaced by external system in future)

---

## Review Feedback

**Review Date:** 2025-11-09
**Reviewer:** Senior Engineer (Code Review)
**Status:** ⚠️ Implementation Not Started

### Verification Results

When reviewing the codebase against Phase 1's success criteria, several questions arose:

**Success Criteria Review:**

1. **Pinecone Lambda Functions:**
   - The success criteria states "All Pinecone Lambda functions deleted"
   - When checking the `lambda-processing/` directory, what files are present?
   - Do any of these directory names contain "pinecone"?
   - How many Pinecone Lambda directories exist currently?

2. **Pinecone Test Files:**
   - The success criteria states "All Pinecone test files deleted"
   - When running `ls tests/ | grep -i pinecone`, what results appear?
   - Are there test files that should have been removed according to Task 2?

3. **Package Dependencies:**
   - The success criteria states "Pinecone dependency removed from package.json"
   - When running `grep -i pinecone package.json`, what appears?
   - Is the `@pinecone-database/pinecone` package still listed?

4. **Environment Variables:**
   - The success criteria states "Pinecone environment variables removed from .env.example"
   - When running `grep -i pinecone .env.example`, how many lines match?
   - Are there variables like `PINECONE_API_KEY`, `PINECONE_HOST`, `PINECONE_INDEX_NAME` still present?

5. **CloudFormation Templates:**
   - The success criteria states "CloudFormation templates updated to remove Pinecone references"
   - When checking `RAG-CloudStack/templates/lambdas.yaml`, are there still parameters named `PineconeApiKey`, `PineconeHost`, `PineconeIndexName`?
   - When checking `RAG-CloudStack/templates/apigw-http.yaml`, is there still a route path `/pinecone-search`?

6. **README TODO Section:**
   - The success criteria states "Stale README TODO section removed"
   - When running `grep -i "work in progress" README.md`, does line 186 still appear?
   - Does the "🚧 Work in Progress / To Do" section still exist?

7. **Zero Pinecone References:**
   - The success criteria states "All grep searches for 'pinecone' return zero results"
   - When running `grep -ri "pinecone" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=Migration . | wc -l`, what number appears?
   - The target is **0 results** - what is the actual count?

**Git History:**

8. **Commits:**
   - When running `git log --oneline | grep -i "phase 1"`, do any commits appear?
   - When running `git status`, does it show a clean working tree?
   - Have any changes been committed for Phase 1 tasks?

9. **Working Directory:**
   - When running `git status`, are there any uncommitted changes?
   - Are you working on the correct branch: `claude/create-plan-branch-011CUxxjrkvYFvyvfjgRUodq`?

**Prerequisites:**

10. **Phase 0.5 Completion:**
    - The prerequisites state "Phase 0 (Foundation & Architecture) must be complete"
    - Has Phase 0.5 (Codebase Exploration & Validation) been completed?
    - Do the following files exist and are they populated with actual data (not just templates)?
      - `Migration/docs/codebase-map.md`
      - `Migration/docs/prerequisite-validation.md`
      - `Migration/docs/linkedin-html-snapshot.html`
      - `Migration/docs/linkedin-selectors.md`

### Questions to Consider

Before proceeding with Phase 1 implementation:

- Have you started working on Phase 1, or are you still in the planning phase?
- If you haven't started, what is blocking you from beginning the implementation?
- If you have started, where are the changes? Are they on a different branch?
- Should you create the inventory file from Task 1 (`Migration/docs/pinecone-cleanup-inventory.md`) first?
- Have you verified that all prerequisites are met, including Phase 0.5 completion?

### Next Steps

To move forward with Phase 1:

1. Verify you're on the correct branch and have the latest plan files
2. Ensure Phase 0.5 is complete (codebase exploration and validation)
3. Start with Task 1: Create the Pinecone cleanup inventory
4. Proceed through Tasks 2-8 sequentially
5. Commit after each task with the provided commit message templates
6. Run the verification checklist at the end of the phase

### Evidence Required for Approval

For Phase 1 to be marked as complete, the following evidence is needed:

- [ ] `git log` shows commits for each of the 8 tasks in Phase 1
- [ ] `ls lambda-processing/` does NOT show any directories with "pinecone" in the name
- [ ] `ls tests/ | grep -i pinecone` returns zero results
- [ ] `grep -i pinecone package.json` returns zero results
- [ ] `grep -i pinecone .env.example` returns zero results
- [ ] `grep -ri "pinecone" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=Migration .` returns zero results
- [ ] `npm run build` succeeds with no errors
- [ ] `npm run test` succeeds with no failures

---

**Previous Phase:** [Phase 0: Foundation & Architecture](./Phase-0.md)

**Next Phase:** [Phase 2: Puppeteer Refactor for Text Extraction](./Phase-2.md)
