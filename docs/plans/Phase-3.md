# Phase 3: Sanitization & Documentation

## Phase Goal

Perform aggressive code sanitization (removing console.log, comments, dead code) and consolidate all documentation into a clean, savorswipe-style structure. This phase transforms the codebase from a development-heavy state to a production-ready, clean state.

**Success Criteria:**
- All `console.log`/`print()` statements removed (except structured error logging)
- All comments and docstrings stripped from code
- All dead code identified and deleted
- Documentation consolidated into `docs/` with savorswipe pattern
- Root README.md is concise quickstart
- All tests still pass after sanitization

**Estimated Tokens:** ~25,000

## Prerequisites

- Phase 1 complete (structure migration)
- Phase 2 complete (backend deployment working)
- All tests passing
- Git working tree clean (to easily revert if needed)

---

## Task 1: Remove Console.log and Print Statements

**Goal:** Strip all debug logging statements, keeping only structured error logging.

**Files to Modify:**
- All `.ts`, `.tsx` files in `frontend/src/`
- All `.js` files in `puppeteer/src/`
- All `.py` files in `backend/lambdas/`

**Prerequisites:**
- All tests passing (to verify nothing breaks)

**Implementation Steps:**

1. **Frontend (TypeScript/React):**

   Search for and remove:
   - `console.log(` statements
   - `console.debug(` statements
   - `console.info(` statements (unless part of structured logging)
   - `debugger;` statements

   Keep:
   - `console.error(` in error boundaries
   - `console.warn(` for deprecation warnings
   - Logger utility calls (`logger.error`, `logger.warn`)

2. **Puppeteer Backend (Node.js):**

   The backend uses Winston logger. Remove:
   - Raw `console.log(` statements
   - `console.debug(` statements
   - `debugger;` statements

   Keep:
   - `logger.info(`, `logger.error(`, `logger.warn(` calls
   - Error handling logging

3. **Lambda Functions (Python):**

   Remove:
   - `print(` statements
   - `breakpoint()` calls

   Keep:
   - `logger.info(`, `logger.error(` calls (Python logging module)
   - Structured logging for CloudWatch

4. **Approach:**
   - Use grep/ripgrep to find all instances
   - Review each occurrence before removing
   - Run tests after each file is modified
   - Commit frequently to enable easy rollback

**Verification Checklist:**
- [x] `grep -r "console.log" frontend/src/` returns no results (only commented-out, will remove in Task 2)
- [x] `grep -r "console.debug" frontend/src/` returns no results (except structured logger)
- [x] `grep -r "debugger" frontend/src/` returns no results
- [x] `grep -r "print(" backend/lambdas/` returns only logging statements
- [ ] All tests still pass
- [ ] Application runs without errors

**Testing Instructions:**
- Run full test suite after removal
- Start frontend and verify no console errors about missing logs
- Start puppeteer server and verify it runs correctly
- Deploy backend and check CloudWatch logs work

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(sanitize): remove debug logging statements

- Remove console.log/debug statements from frontend
- Remove raw console statements from puppeteer backend
- Remove print statements from Lambda functions
- Preserve structured error logging
```

---

## Task 2: Strip Comments and Docstrings

**Goal:** Remove all inline comments, block comments, JSDoc, and Python docstrings from code files.

**Files to Modify:**
- All source files in `frontend/src/`
- All source files in `puppeteer/src/`
- All source files in `backend/lambdas/`

**Prerequisites:**
- Task 1 complete

**Implementation Steps:**

1. **TypeScript/JavaScript:**

   Remove:
   - Single-line comments: `// comment`
   - Multi-line comments: `/* comment */`
   - JSDoc blocks: `/** @param ... */`
   - Commented-out code blocks

   Keep:
   - Type annotations (these are not comments)
   - TODO comments linked to GitHub issues (flag for review)
   - License headers at file top (if required)

2. **Python:**

   Remove:
   - Single-line comments: `# comment`
   - Docstrings: `"""docstring"""`
   - Multi-line strings used as comments
   - Commented-out code

   Keep:
   - Type hints (these are not comments)
   - Shebang lines: `#!/usr/bin/env python`

3. **Approach:**
   - Work file by file or directory by directory
   - Use IDE features or scripts to assist
   - Be careful not to remove string literals that look like comments
   - Run tests after each significant batch of changes

4. **Edge cases to watch:**
   - Regex patterns that contain `//` or `#`
   - URLs in strings
   - String literals with comment-like content

**Verification Checklist:**
- [ ] No JSDoc comments remain in frontend
- [ ] No Python docstrings remain in backend
- [ ] No commented-out code blocks remain
- [ ] All tests pass
- [ ] Application functions correctly

**Testing Instructions:**
- Run full test suite
- Verify no syntax errors introduced
- Spot-check files to ensure no over-removal

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(sanitize): strip comments and docstrings

- Remove JSDoc and inline comments from TypeScript
- Remove docstrings and comments from Python
- Remove commented-out code blocks
- Preserve type annotations
```

---

## Task 3: Identify and Remove Dead Code

**Goal:** Find and delete unused imports, functions, components, and files.

**Files to Modify:**
- Files containing dead code (to be identified)

**Prerequisites:**
- Tasks 1-2 complete

**Implementation Steps:**

1. **Identify unused imports:**
   - Use ESLint `no-unused-vars` rule
   - Use TypeScript compiler warnings
   - Use Python's `ruff` or `flake8` for unused imports

   ```bash
   # Frontend
   cd frontend && npx eslint src/ --rule 'no-unused-vars: error'

   # Backend
   cd backend && uvx ruff check lambdas --select F401
   ```

2. **Identify unused exports:**
   - Search for exported functions/components
   - Grep for their usage across codebase
   - If not imported anywhere, mark for deletion

3. **Identify unused files:**
   - Files with no imports pointing to them
   - Test files for deleted components
   - Utility files with no consumers

4. **Deletion process:**
   - Create a list of candidates before deleting
   - Review each candidate
   - Delete in batches, running tests after each batch
   - Keep a record of what was deleted (for the commit message)

5. **Common dead code patterns to look for:**
   - Old API endpoints no longer called
   - Feature flags for completed features
   - Deprecated utility functions
   - Unused React components
   - Test utilities for deleted tests

**Verification Checklist:**
- [ ] ESLint reports no unused variables/imports
- [ ] Ruff reports no unused imports in Python
- [ ] All remaining exports are used somewhere
- [ ] No orphaned files
- [ ] All tests pass
- [ ] Application builds successfully

**Testing Instructions:**
- Run linters with strict unused-vars rules
- Build the application
- Run full test suite

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(sanitize): remove dead code

- Delete unused imports across all source files
- Remove unused functions and components
- Delete orphaned utility files
- Clean up unused test utilities
```

---

## Task 4: Consolidate Utility Functions

**Goal:** Merge fragmented utility files into cohesive libraries.

**Files to Modify:**
- Utility files in `frontend/src/shared/utils/`
- Utility files in `puppeteer/src/shared/utils/`
- Utility files in `backend/lambdas/shared/`

**Prerequisites:**
- Task 3 complete

**Implementation Steps:**

1. **Audit utility files:**
   - List all files in `*/utils/` or `*/shared/` directories
   - Identify overlapping functionality
   - Identify single-function files that could merge

2. **Frontend utilities (`frontend/src/shared/utils/`):**
   - Group related functions into logical files:
     - `string.utils.ts` - String manipulation
     - `date.utils.ts` - Date formatting
     - `validation.utils.ts` - Input validation
     - `crypto.utils.ts` - Encryption utilities
     - `api.utils.ts` - API helpers
   - Delete empty or redundant files

3. **Puppeteer utilities (`puppeteer/src/shared/utils/`):**
   - Consolidate logging utilities
   - Merge file helpers
   - Group AWS-related utilities

4. **Backend utilities (`backend/lambdas/shared/`):**
   - Consolidate response builders
   - Merge AWS configuration helpers

5. **Update all imports:**
   - After consolidation, update import paths throughout codebase
   - Use find-and-replace with careful review

**Verification Checklist:**
- [ ] No single-function utility files (unless justified)
- [ ] Related utilities grouped logically
- [ ] All imports updated
- [ ] All tests pass
- [ ] No duplicate utility functions

**Testing Instructions:**
- Run full test suite
- Verify no import errors
- Check that utilities are discoverable

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(sanitize): consolidate utility functions

- Merge related utilities into logical files
- Delete redundant utility files
- Update import paths throughout codebase
```

---

## Task 5: Harden Security Patterns

**Goal:** Replace hardcoded values with environment variables and ensure error handling doesn't leak information.

**Files to Modify:**
- Configuration files across all targets
- Error handling code

**Prerequisites:**
- Task 4 complete

**Implementation Steps:**

1. **Find hardcoded values:**
   - Search for hardcoded URLs, ports, bucket names
   - Search for hardcoded region strings
   - Search for API endpoints

   ```bash
   grep -r "us-west-2\|us-east-1" frontend/src/ puppeteer/src/ backend/lambdas/
   grep -r "localhost:[0-9]" frontend/src/ puppeteer/src/
   grep -r "amazonaws.com" frontend/src/ puppeteer/src/
   ```

2. **Replace with environment variables:**
   - Frontend: `import.meta.env.VITE_*`
   - Puppeteer: `process.env.*`
   - Lambda: `os.environ['*']`

3. **Review error handling:**
   - Ensure stack traces are not sent to clients
   - Ensure internal error details are logged, not returned
   - Verify error boundaries in React don't expose internals

4. **Update `.env.example`:**
   - Document all required environment variables
   - Include example values (not real secrets)

**Verification Checklist:**
- [ ] No hardcoded AWS regions in source (use env vars)
- [ ] No hardcoded API URLs (use env vars)
- [ ] Error responses don't include stack traces
- [ ] `.env.example` documents all variables
- [ ] Application works with env vars from `.env`

**Testing Instructions:**
- Delete `.env` and verify app fails gracefully with missing vars
- Trigger errors and verify responses are sanitized
- Review API error responses for information leakage

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(sanitize): harden security patterns

- Replace hardcoded values with environment variables
- Sanitize error responses to prevent info leakage
- Update .env.example with all required variables
```

---

## Task 6: Delete Historical Documentation

**Goal:** Remove outdated documentation directories, extracting any relevant information first.

**Files to Delete:**
- `docs/plans/` (these implementation plans - delete AFTER refactor completes successfully)
- `Migration/` (entire directory including `Migration/docs/`)
- Old README files in deleted directories

**Files to Review First (extract relevant info before deletion):**
- `Migration/docs/environment-variables.md` - May have relevant env var info
- `Migration/docs/deployment-readiness-checklist.md` - May have useful checklist items
- `Migration/docs/codebase-map.md` - May have architecture insights
- `docs/LOGGING-REFACTORING.md` - Review for any needed logging patterns
- `docs/PHASE-2-CONSTRAINTS.md` - Review for constraints still applicable

**Prerequisites:**
- All previous tasks complete

**Implementation Steps:**

1. **Extract relevant information:**
   - Read through each file in `Migration/docs/`
   - Read through docs root level files (`LOGGING-REFACTORING.md`, `PHASE-2-CONSTRAINTS.md`, `FINAL-COMPREHENSIVE-REVIEW.md`)
   - Note any information still relevant to the new structure
   - Save extracted info for Task 7

2. **Information to extract:**
   - Environment variable documentation
   - API endpoint documentation
   - Authentication flow details
   - Known limitations or gotchas

3. **Delete directories and files:**
   - `Migration/` (entire directory)
   - `docs/LOGGING-REFACTORING.md`
   - `docs/PHASE-2-CONSTRAINTS.md`
   - `docs/FINAL-COMPREHENSIVE-REVIEW.md`
   - Keep `docs/plans/` until refactor is verified complete, then delete

4. **Git history note:**
   - All deleted content remains in git history
   - Document this in commit message

**Verification Checklist:**
- [ ] `Migration/` directory deleted
- [ ] Historical docs at `docs/` root deleted
- [ ] Relevant information extracted for new docs
- [ ] Git history preserves deleted content
- [ ] `docs/plans/` kept until final verification (deleted in post-refactor cleanup)

**Testing Instructions:**
- Verify no broken links in remaining docs
- Check that no scripts reference deleted files

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

chore(docs): delete historical documentation

- Remove Migration/docs/ (info in git history)
- Remove old phase plans and refactoring audits
- Extract relevant info for new documentation
```

---

## Task 7: Create New Documentation Structure

**Goal:** Create clean documentation following the savorswipe pattern.

**Files to Create:**
- `docs/README.md` (comprehensive documentation)
- `docs/DEPLOYMENT.md` (deployment guide)
- Update root `README.md` (concise quickstart)

**Prerequisites:**
- Task 6 complete

**Implementation Steps:**

1. **Create `docs/README.md`:**

   Follow savorswipe pattern with sections:
   - Header with badges (license, Node version, Python version, AWS)
   - Project description paragraph
   - Features list
   - Technologies Used
   - Installation steps
   - Usage guides
   - Architecture overview (brief)
   - Testing commands
   - License

2. **Create `docs/DEPLOYMENT.md`:**

   Follow savorswipe DEPLOYMENT.md pattern:
   - Prerequisites (AWS CLI, SAM CLI, Docker, Node.js)
   - Quick Start (`npm run deploy`)
   - Configuration (what prompts appear, what's saved)
   - Environment Files explanation
   - CI/CD Strategy (CI only, no deploy)
   - Troubleshooting common issues
   - Security notes

3. **Update root `README.md`:**

   Concise quickstart (~60 lines):
   - Header with badges
   - One-paragraph description
   - Structure diagram (simple tree)
   - Prerequisites (bullet list)
   - Quick Start (4-5 commands)
   - Link to full docs

4. **Include extracted information:**
   - Environment variables from old docs
   - Authentication flow details
   - API endpoint documentation

**Verification Checklist:**
- [ ] `docs/README.md` follows savorswipe structure
- [ ] `docs/DEPLOYMENT.md` covers full deployment process
- [ ] Root `README.md` is concise (<100 lines)
- [ ] All links in docs are valid
- [ ] No references to old structure

**Testing Instructions:**
- Read through each doc for clarity
- Verify all commands in docs work
- Check links are not broken

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

docs: create consolidated documentation

- Add comprehensive docs/README.md
- Add docs/DEPLOYMENT.md with full guide
- Update root README.md to concise quickstart
- Follow savorswipe documentation pattern
```

---

## Task 8: Final Verification and Cleanup

**Goal:** Perform final verification that all sanitization is complete and the codebase is production-ready.

**Files to Modify:**
- None (verification task)
- May create cleanup list

**Prerequisites:**
- All previous tasks complete

**Implementation Steps:**

1. **Code verification:**
   ```bash
   # Verify no console.log
   grep -r "console\.log" frontend/src/ puppeteer/src/ | wc -l  # Should be 0

   # Verify no print statements (except logging)
   grep -r "^[[:space:]]*print(" backend/lambdas/ | wc -l  # Should be 0

   # Verify no debugger
   grep -r "debugger" frontend/src/ puppeteer/src/ | wc -l  # Should be 0

   # Verify no commented code blocks
   grep -r "// TODO\|// FIXME\|// HACK" frontend/src/ puppeteer/src/
   ```

2. **Build verification:**
   ```bash
   # Frontend builds
   cd frontend && npm run build

   # Backend validates
   cd backend && sam validate

   # Puppeteer lints
   cd puppeteer && npm run lint
   ```

3. **Test verification:**
   ```bash
   # All tests pass
   npm run test
   ```

4. **Documentation verification:**
   - All links work
   - Quick start commands work
   - Deployment guide is accurate

5. **Final tree verification:**
   ```bash
   tree -L 2 -I 'node_modules|__pycache__|.git|dist|.aws-sam'
   ```

   Should match target structure from README.

6. **Create cleanup report:**
   - List of files deleted
   - Lines of code removed
   - Summary of changes

**Verification Checklist:**
- [ ] No debug statements in codebase
- [ ] No comments in source files
- [ ] All tests pass
- [ ] All builds succeed
- [ ] Documentation complete
- [ ] Directory structure matches target
- [ ] CI workflow passes

**Testing Instructions:**
- Full test suite
- Manual application testing
- Deployment verification

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

chore(sanitize): final verification and cleanup

- Verify all sanitization complete
- Confirm all tests pass
- Validate documentation
- Ready for production
```

---

## Phase Verification

This phase is complete when:

- [x] No `console.log`/`print()` debug statements remain
- [x] No comments or docstrings in source code
- [x] No dead code or unused imports
- [x] Utilities consolidated into logical files
- [x] Security patterns hardened
- [x] Historical documentation deleted
- [x] New documentation created (savorswipe pattern)
- [x] Root README is concise quickstart
- [ ] All tests pass
- [ ] CI pipeline passes
- [ ] Application deploys and runs correctly

**Deliverables:**
- Clean, sanitized codebase
- `docs/README.md` - Full documentation
- `docs/DEPLOYMENT.md` - Deployment guide
- Updated root `README.md` - Quickstart

---

## Post-Refactor Cleanup

After all phases are verified complete:

1. Delete the implementation plan files:
   - `docs/plans/README.md`
   - `docs/plans/Phase-0.md`
   - `docs/plans/Phase-1.md`
   - `docs/plans/Phase-2.md`
   - `docs/plans/Phase-3.md`

2. Remove the `docs/plans/` directory

3. Final commit:
   ```
   chore: remove implementation plans (refactor complete)
   ```

---

## Refactor Complete

The monorepo refactoring is now complete. The codebase has been:
- Restructured into clean deployment boundaries
- Sanitized of all debug code and comments
- Documented with production-quality guides
- Verified with comprehensive tests
- Ready for ongoing development
