# Phase 1: Structure Migration

## Phase Goal

Migrate the existing codebase into the target monorepo structure. This phase moves files to their new locations, updates all import paths, and reorganizes tests by deployment target. No functional changes are made to the code itself.

**Success Criteria:**
- All source files moved to target locations
- All import/require paths updated and working
- All tests relocated and passing
- Root package.json converted to orchestration-only
- Application builds and runs from new structure

**Estimated Tokens:** ~45,000

## Prerequisites

- Phase 0 complete (ADRs and conventions reviewed)
- Clean git working tree
- All current tests passing

---

## Task 1: Create Directory Scaffold

**Goal:** Create the target directory structure before moving any files.

**Files to Create:**
- `frontend/` directory
- `backend/` directory
- `backend/lambdas/` directory
- `backend/scripts/` directory
- `puppeteer/` directory
- `tests/frontend/unit/` directory
- `tests/frontend/integration/` directory
- `tests/backend/unit/` directory
- `tests/backend/integration/` directory
- `tests/puppeteer/unit/` directory
- `tests/e2e/` directory
- `tests/fixtures/` directory
- `scripts/deploy/` directory
- `scripts/dev-tools/` directory
- `scripts/benchmarks/` directory

**Prerequisites:**
- None

**Implementation Steps:**

1. Create the full directory tree for the target structure
2. Add `.gitkeep` files to empty directories to ensure they're tracked
3. Verify the structure matches the target diagram in the README

**Verification Checklist:**
- [x] All directories exist as specified
- [x] `tree` command shows expected structure
- [x] Git tracks the new directories

**Testing Instructions:**
- No tests required for this task
- Visual verification via `tree` command

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

chore(structure): create target directory scaffold

- Create frontend/, backend/, puppeteer/ directories
- Create tests/ subdirectory structure
- Create scripts/ subdirectory structure
- Add .gitkeep files for empty directories
```

---

## Task 2: Migrate Frontend Source

**Goal:** Move the React/Vite frontend from `src/` to `frontend/src/` with all configuration files.

**Files to Modify/Create:**
- Move `src/` → `frontend/src/`
- Move `public/` → `frontend/public/`
- Move `index.html` → `frontend/index.html`
- Move `vite.config.ts` → `frontend/vite.config.ts`
- Move `tsconfig.json` → `frontend/tsconfig.json`
- Move `tsconfig.app.json` → `frontend/tsconfig.app.json`
- Move `tsconfig.node.json` → `frontend/tsconfig.node.json`
- Move `tailwind.config.ts` → `frontend/tailwind.config.ts`
- Move `eslint.config.js` → `frontend/eslint.config.js`
- Move `components.json` → `frontend/components.json`
- Create `frontend/package.json` (extract frontend deps from root)

**Note:** `postcss.config.js` does not exist in the current codebase (PostCSS config is likely inlined in vite.config.ts or uses Tailwind defaults).

**Prerequisites:**
- Task 1 complete

**Implementation Steps:**

1. Move the `src/` directory to `frontend/src/` using git mv to preserve history
2. Move all frontend configuration files to `frontend/`
3. Move `public/` and `index.html` to `frontend/`
4. Create a new `frontend/package.json` by extracting:
   - All runtime dependencies from root package.json
   - Frontend-specific devDependencies (vite, vitest, typescript, eslint, tailwind, etc.)
   - Scripts: `dev`, `build`, `preview`, `lint`, `test`, `test:watch`, `test:ui`
5. Update `frontend/vite.config.ts`:
   - Adjust any path references
   - Ensure `@/` alias points to `./src/`
6. Update `frontend/tsconfig.json` and `frontend/tsconfig.app.json`:
   - Adjust `baseUrl` and `paths` for new location
   - Update `include` and `exclude` patterns
7. Update `frontend/eslint.config.js` for new file locations
8. Update `frontend/tailwind.config.ts` content paths

**Verification Checklist:**
- [ ] `cd frontend && npm install` succeeds
- [ ] `cd frontend && npm run dev` starts Vite server
- [ ] `cd frontend && npm run build` produces `dist/` folder
- [ ] `cd frontend && npm run lint` passes
- [ ] No TypeScript errors (`npx tsc --noEmit`)

**Testing Instructions:**
- Run existing frontend tests after migration
- Verify dev server shows the application correctly
- Verify production build works

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(frontend): migrate src/ to frontend/src/

- Move source files preserving git history
- Move all configuration files
- Create frontend-specific package.json
- Update path aliases and configs
```

---

## Task 3: Migrate Puppeteer Backend

**Goal:** Move the puppeteer-backend to the top-level `puppeteer/` directory.

**Files to Modify/Create:**
- Move `puppeteer-backend/src/` → `puppeteer/src/`
- Move `puppeteer-backend/routes/` → `puppeteer/routes/`
- Move `puppeteer-backend/config/` → `puppeteer/config/`
- Move `puppeteer-backend/schemas/` → `puppeteer/schemas/`
- Move `puppeteer-backend/utils/uploadMetrics.js` → `puppeteer/utils/uploadMetrics.js`
- Move `puppeteer-backend/package.json` → `puppeteer/package.json`
- Move `puppeteer-backend/package-lock.json` → `puppeteer/package-lock.json`
- Move `puppeteer-backend/.eslintrc.js` → `puppeteer/.eslintrc.js`
- Move `puppeteer-backend/.gitignore` → `puppeteer/.gitignore`
- Move `puppeteer-backend/README.md` → `puppeteer/README.md`
- Move `puppeteer-backend/profileInitWorker.js` → `puppeteer/profileInitWorker.js`
- Move `puppeteer-backend/searchWorker.js` → `puppeteer/searchWorker.js`
- Move `puppeteer-backend/scripts/create-edges.js` → `scripts/dev-tools/create-edges.js`
- Move `puppeteer-backend/scripts/generate-device-keypair.js` → `scripts/dev-tools/generate-device-keypair.js`

**Prerequisites:**
- Task 1 complete

**Implementation Steps:**

1. Move the entire `puppeteer-backend/` contents to `puppeteer/` using git mv
2. Update `puppeteer/package.json`:
   - Verify `main` field points to correct entry
   - Verify scripts work from new location
3. Move puppeteer-specific scripts from `puppeteer-backend/scripts/` to `scripts/dev-tools/`:
   - `create-edges.js`
   - `generate-device-keypair.js`
4. Delete the empty `puppeteer-backend/` directory after all moves complete
5. Update any hardcoded paths within puppeteer source files

**Verification Checklist:**
- [ ] `cd puppeteer && npm install` succeeds
- [ ] `cd puppeteer && npm run lint` passes
- [ ] `cd puppeteer && npm start` starts server (may require env vars)
- [ ] No broken imports within puppeteer code

**Testing Instructions:**
- Verify server starts without import errors
- Check that routes register correctly
- Verify lint passes

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(puppeteer): migrate puppeteer-backend/ to puppeteer/

- Move all source and config files
- Relocate utility scripts to scripts/dev-tools/
- Remove old directory
```

---

## Task 4: Update Frontend Import Paths

**Goal:** Update all import statements in frontend code to work with the new structure.

**Files to Modify/Create:**
- All files in `frontend/src/` that use `@/` imports
- `frontend/vite.config.ts` (alias configuration)
- `frontend/tsconfig.app.json` (path mappings)

**Prerequisites:**
- Task 2 complete

**Implementation Steps:**

1. Update `frontend/vite.config.ts` to define the `@` alias:
   ```typescript
   resolve: {
     alias: {
       '@': path.resolve(__dirname, './src')
     }
   }
   ```

2. Update `frontend/tsconfig.app.json` paths:
   ```json
   {
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@/*": ["src/*"]
       }
     }
   }
   ```

3. Scan all frontend source files for imports
4. Verify all `@/` imports resolve correctly
5. Fix any relative imports that broke due to the move
6. Remove any imports that referenced `puppeteer-backend/` directly (these should go through API calls)

**Verification Checklist:**
- [ ] `cd frontend && npx tsc --noEmit` shows no errors
- [ ] `cd frontend && npm run build` succeeds
- [ ] All IDE "cannot find module" errors resolved
- [ ] `npm run lint` passes

**Testing Instructions:**
- Run frontend unit tests to verify imports work
- Start dev server and verify all pages load
- Check browser console for import errors

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(frontend): update import paths for new structure

- Configure @ alias in vite.config.ts
- Update tsconfig paths
- Fix all broken imports
```

---

## Task 5: Migrate Tests to New Structure

**Goal:** Reorganize all tests into the centralized `tests/` directory organized by deployment target.

**Files to Modify/Create:**
- Move `tests/components/` → `tests/frontend/unit/components/`
- Move `tests/hooks/` → `tests/frontend/unit/hooks/`
- Move `tests/services/` → `tests/frontend/unit/services/`
- Move `tests/frontend/services/` → `tests/frontend/unit/services/` (merge)
- Move `tests/integration/` → `tests/frontend/integration/`
- Move `tests/backend/` (puppeteer-backend tests, NOT Lambda tests) → `tests/puppeteer/unit/`
- Move `tests/node-unit/` → `tests/puppeteer/unit/`
- Move `tests/fixtures/` → `tests/fixtures/` (keep in place)
- Move `tests/utils/` → `tests/fixtures/` (test utilities)
- Move Lambda tests from `lambda-processing/*/tests/` → `tests/backend/unit/`
- Move `tests/messageGenerationWorkflow.test.ts` → `tests/frontend/integration/`
- Move `tests/jest.setup.js` → `tests/puppeteer/jest.setup.js` (for puppeteer tests)
- Move `tests/setupTests.ts` → `tests/frontend/setupTests.ts`
- Create `tests/frontend/vitest.config.ts`
- Create `tests/backend/pytest.ini`
- Create `tests/puppeteer/vitest.config.ts`
- Delete: `tests/sanity.test.tsx` (sanity check no longer needed)
- Delete: `tests/*.md` files (PROFILE_INIT_TEST_SUMMARY.md, README-profile-init-tests.md, TASK_10_COMPLETION_SUMMARY.md)
- Delete: `tests/*.py` files at root (test_edge_processing.py, test_existing_files.py, test-lambda-edge-check.py, check-data-corruption.py)

**Prerequisites:**
- Tasks 2 and 3 complete

**Implementation Steps:**

1. Create the test directory structure as specified in Phase 0
2. Move frontend component tests:
   - `tests/components/*.test.tsx` → `tests/frontend/unit/components/`
3. Move frontend hook tests:
   - `tests/hooks/*.test.ts` → `tests/frontend/unit/hooks/`
4. Move frontend service tests:
   - `tests/services/*.test.ts` → `tests/frontend/unit/services/`
   - Merge with `tests/frontend/services/`
5. Move frontend integration tests:
   - `tests/integration/*.test.tsx` → `tests/frontend/integration/`
6. Move puppeteer backend tests:
   - `tests/backend/controllers/` → `tests/puppeteer/unit/controllers/`
   - `tests/backend/services/` → `tests/puppeteer/unit/services/`
   - `tests/backend/utils/` → `tests/puppeteer/unit/utils/`
   - `tests/node-unit/` → `tests/puppeteer/unit/`
7. Move Lambda tests:
   - Each `lambda-processing/*/tests/` → `tests/backend/unit/{lambda-name}/`
8. Move shared fixtures:
   - `tests/fixtures/` stays in place
   - `tests/utils/` (mockFactories, testHelpers) → `tests/fixtures/`
9. Delete loose test files at `tests/` root:
   - `sanity.test.tsx`
   - All `.md` files (test documentation)
   - All `.py` files at root level
10. Create test configuration files:
    - `tests/frontend/vitest.config.ts` pointing to frontend source
    - `tests/backend/pytest.ini` for pytest configuration
    - `tests/puppeteer/vitest.config.ts` pointing to puppeteer source

**Verification Checklist:**
- [ ] `tests/` structure matches Phase 0 specification
- [ ] No test files remain outside the organized structure
- [ ] `cd frontend && npm test` runs frontend tests
- [ ] `pytest tests/backend` runs backend tests
- [ ] All test imports resolve correctly

**Testing Instructions:**
- Run all test suites and verify they pass
- Verify test coverage still collected correctly
- Check that CI workflow paths will match new structure

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(tests): reorganize tests by deployment target

- Move frontend tests to tests/frontend/
- Move puppeteer tests to tests/puppeteer/
- Move Lambda tests to tests/backend/
- Create per-target test configurations
- Delete redundant test files
```

---

## Task 6: Update Test Import Paths

**Goal:** Fix all import paths in test files to reference the new source locations.

**Files to Modify/Create:**
- All test files in `tests/frontend/`
- All test files in `tests/puppeteer/`
- All test files in `tests/backend/`
- `tests/fixtures/mockFactories.ts`
- `tests/fixtures/testHelpers.tsx`

**Prerequisites:**
- Task 5 complete

**Implementation Steps:**

1. Update frontend test imports:
   - Tests now import from `../../frontend/src/` or use path aliases
   - Configure vitest to resolve `@/` to frontend source

2. Update puppeteer test imports:
   - Tests import from `../../puppeteer/src/`
   - Update any direct file references

3. Update backend test imports (Python):
   - Update `PYTHONPATH` references in conftest.py
   - Update relative imports in test files

4. Update shared fixture imports:
   - `mockFactories.ts` and `testHelpers.tsx` may need path updates
   - Consider making these import-agnostic where possible

5. Create/update `tests/frontend/vitest.config.ts`:
   ```typescript
   export default defineConfig({
     test: {
       root: '../../frontend',
       include: ['../../tests/frontend/**/*.test.{ts,tsx}']
     },
     resolve: {
       alias: {
         '@': path.resolve(__dirname, '../../frontend/src')
       }
     }
   })
   ```

6. Update `tests/backend/conftest.py` for Python tests:
   - Set correct `PYTHONPATH`
   - Configure moto mocks

**Verification Checklist:**
- [ ] All frontend tests pass
- [ ] All puppeteer tests pass
- [ ] All backend tests pass
- [ ] No "module not found" errors in any test suite

**Testing Instructions:**
- Run each test suite independently
- Verify imports resolve at runtime
- Check coverage reports generate correctly

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(tests): update test import paths

- Configure vitest aliases for frontend tests
- Update puppeteer test imports
- Update Python test PYTHONPATH
- Fix shared fixture imports
```

---

## Task 7: Migrate Scripts

**Goal:** Consolidate all utility scripts into the `scripts/` directory with logical organization.

**Files to Modify/Create:**
- Move `scripts/benchmark-performance.js` → `scripts/benchmarks/benchmark-performance.js`
- Move `scripts/replace-console-logs.sh` → `scripts/dev-tools/replace-console-logs.sh`
- Delete `scripts/deprecated/` entirely (contains README.md, repair-dynamodb-edges.js, restore-contacts.cjs, test-repair-script.js)
- Move `RAG-CloudStack/deploy.sh` → `scripts/deploy/deploy-legacy.sh` (reference only)
- Move `RAG-CloudStack/get-env-vars.sh` → `scripts/deploy/get-env-vars.sh`
- Move `RAG-CloudStack/setup-dev.sh` → `scripts/dev-tools/setup-dev.sh`
- Delete root shell scripts: `check-cognito-user.sh`, `check-env.sh`, `create-cognito-user.sh`

**Note:** Puppeteer scripts (`create-edges.js`, `generate-device-keypair.js`) are moved in Task 3 directly from `puppeteer-backend/scripts/` to `scripts/dev-tools/`.

**Prerequisites:**
- Task 3 complete

**Implementation Steps:**

1. Move benchmark scripts to `scripts/benchmarks/`
2. Move development utility scripts to `scripts/dev-tools/`
3. Move deployment-related scripts to `scripts/deploy/`
4. Delete deprecated scripts directory entirely
5. Delete root-level shell scripts (functionality will be in deploy.js or npm scripts)
6. Update any cross-references between scripts
7. Update any package.json scripts that reference old locations
8. Create `scripts/README.md` documenting available scripts

**Verification Checklist:**
- [ ] `scripts/` contains only three subdirectories
- [ ] No scripts remain at project root (except standard configs)
- [ ] `npm run benchmark` works (after package.json update)
- [ ] All script shebangs and paths are correct

**Testing Instructions:**
- Run benchmark script to verify it works
- Verify dev-tools scripts are executable
- Check no broken script references remain

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(scripts): consolidate utility scripts

- Organize scripts into deploy/, dev-tools/, benchmarks/
- Delete deprecated scripts
- Delete redundant root shell scripts
- Add scripts README
```

---

## Task 8: Create Root Orchestration Package.json

**Goal:** Convert the root package.json to orchestration-only, delegating all work to subdirectories.

**Files to Modify/Create:**
- Rewrite `package.json` at root
- Verify `package-lock.json` is regenerated correctly

**Prerequisites:**
- Tasks 2, 3, and 7 complete

**Implementation Steps:**

1. Create new root `package.json` with minimal content:
   ```json
   {
     "name": "linkedin-advanced-search",
     "version": "1.0.0",
     "private": true,
     "description": "LinkedIn Advanced Search - Monorepo",
     "scripts": {
       "dev": "cd frontend && npm run dev",
       "dev:puppeteer": "cd puppeteer && npm run dev",
       "build": "cd frontend && npm run build",
       "test": "npm run test:frontend && npm run test:backend && npm run test:puppeteer",
       "test:frontend": "cd frontend && npm test",
       "test:backend": "cd backend && npm run test",
       "test:puppeteer": "cd puppeteer && npm test",
       "lint": "npm run lint:frontend && npm run lint:backend && npm run lint:puppeteer",
       "lint:frontend": "cd frontend && npm run lint",
       "lint:backend": "cd backend && uvx ruff check lambdas",
       "lint:puppeteer": "cd puppeteer && npm run lint",
       "check": "npm run lint && npm run test",
       "deploy": "cd backend && npm run deploy",
       "benchmark": "node scripts/benchmarks/benchmark-performance.js"
     },
     "author": "HatmanStack",
     "license": "Apache-2.0"
   }
   ```

2. Remove all dependencies from root (they belong in subdirectories)
3. Delete root `node_modules/` and `package-lock.json`
4. Run `npm install` in each subdirectory: `frontend/`, `puppeteer/`, `backend/`
5. Verify each subdirectory has its own `node_modules/`

**Verification Checklist:**
- [ ] Root `package.json` has no dependencies
- [ ] Root has no `node_modules/` directory
- [ ] `npm run dev` starts frontend
- [ ] `npm run dev:puppeteer` starts puppeteer server
- [ ] `npm run test` runs all test suites
- [ ] `npm run lint` runs all linters
- [ ] `npm run check` runs lint + tests

**Testing Instructions:**
- Run each npm script and verify it delegates correctly
- Verify no "command not found" errors
- Check that subdirectory commands execute from correct working directory

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(root): convert to orchestration-only package.json

- Remove all dependencies
- Add delegation scripts for all targets
- Each subdirectory now self-contained
```

---

## Task 9: Delete Obsolete Directories and Files

**Goal:** Remove all directories and files that are no longer needed after migration.

**Files to Delete:**
- `RAG-CloudStack/` (entire directory - will be replaced by backend/template.yaml)
- `lambda-processing/` (entire directory - moved to backend/lambdas/)
- `linkedin-profile-processor-mwaa/` (entire directory - MWAA deleted per spec)
- `Migration/` (entire directory - historical docs)
- `src/` (if any remnants - should be empty)
- `puppeteer-backend/` (if any remnants - should be empty)
- Root config files that moved: `vite.config.ts`, `tsconfig*.json`, `tailwind.config.ts`, `eslint.config.js`, `components.json`, `jest.config.js`
- Loose files: `sample-repairs.json`, `check-*.sh`, `create-*.sh`

**Prerequisites:**
- All previous tasks complete
- All tests passing from new locations

**Implementation Steps:**

1. Verify all content has been migrated before deletion
2. Delete `RAG-CloudStack/` directory
3. Delete `lambda-processing/` directory
4. Delete `linkedin-profile-processor-mwaa/` directory
5. Delete `Migration/` directory
6. Delete empty `src/` if it exists
7. Delete empty `puppeteer-backend/` if it exists
8. Delete root config files that were moved to frontend
9. Delete `jest.config.js` (tests use vitest now)
10. Delete miscellaneous files: `sample-repairs.json`
11. Run `git status` to verify deletions

**Verification Checklist:**
- [ ] Only target directories remain: `frontend/`, `backend/`, `puppeteer/`, `tests/`, `docs/`, `scripts/`, `.github/`
- [ ] No orphaned configuration files at root
- [ ] `git status` shows expected deletions
- [ ] Application still builds and runs

**Testing Instructions:**
- Run full test suite after deletions
- Verify no "file not found" errors
- Build and run application

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

chore(cleanup): delete obsolete directories and files

- Remove RAG-CloudStack/ (replaced by backend/)
- Remove lambda-processing/ (moved to backend/lambdas/)
- Remove linkedin-profile-processor-mwaa/ (MWAA deprecated)
- Remove Migration/ (historical docs)
- Remove migrated root config files
```

---

## Task 10: Update GitHub Actions Workflow

**Goal:** Update CI workflow to work with new directory structure.

**Files to Modify/Create:**
- Rewrite `.github/workflows/ci.yml`
- Delete `.github/workflows/lint-and-test.yml` (replaced by ci.yml)
- Delete `.github/workflows/claude.yml` (if not needed)
- Delete `.github/workflows/claude-code-review.yml` (if not needed)
- Keep or update `.github/workflows/README.md`

**Prerequisites:**
- All previous tasks complete

**Implementation Steps:**

1. Create new `.github/workflows/ci.yml` following Phase 0 specification:
   - Triggers: push/PR to main, develop
   - Jobs: frontend-lint, frontend-tests, backend-lint, backend-tests, puppeteer-lint, puppeteer-tests, status-check
   - Node.js 24, Python 3.13
   - Working directories updated for new structure

2. Delete old workflow files that are superseded

3. Update workflow to use correct paths:
   - Frontend: `cd frontend && npm ci && npm run lint`
   - Backend: `uvx ruff check backend/lambdas`
   - Puppeteer: `cd puppeteer && npm ci && npm run lint`
   - Tests: `cd frontend && npm test`, `pytest tests/backend`, etc.

4. Ensure backend tests have correct environment:
   ```yaml
   env:
     AWS_DEFAULT_REGION: us-east-1
     DYNAMODB_TABLE: test-table
     PYTHONPATH: ${{ github.workspace }}/backend/lambdas
   ```

5. Add status-check job that depends on all others

**Verification Checklist:**
- [ ] Workflow file is valid YAML
- [ ] All job paths reference new structure
- [ ] `act` or GitHub Actions dry-run passes (if available)
- [ ] No references to old directory names

**Testing Instructions:**
- Push to a branch and verify CI runs
- Check all jobs execute in correct directories
- Verify status-check job depends on all others

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

ci(workflows): update CI for new monorepo structure

- Rewrite ci.yml for new directory layout
- Remove obsolete workflow files
- Add status-check aggregation job
- Enforce Node.js 24 and Python 3.13
```

---

## Phase Verification

This phase is complete when:

- [ ] Directory structure matches target diagram in README
- [ ] `npm run dev` starts frontend from new location
- [ ] `npm run dev:puppeteer` starts puppeteer server
- [ ] `npm run test` runs all test suites successfully
- [ ] `npm run lint` passes for all targets
- [ ] `npm run build` produces frontend build
- [ ] CI workflow runs successfully on push
- [ ] No references to old directory structure remain
- [ ] Git history preserved for moved files

**Known Limitations:**
- Backend deployment not yet functional (Phase 2)
- Documentation not yet consolidated (Phase 3)
- Code sanitization not yet performed (Phase 3)

---

## Next Phase

Proceed to [Phase 2: Backend Consolidation](Phase-2.md) to set up the Lambda deployment infrastructure.
