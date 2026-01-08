# Phase 2: Frontend Cleanup

**Estimated Tokens:** ~25,000

## Phase Goal

Execute manual cleanup of the frontend component using the audit report from Phase 1. Remove dead code, apply aggressive performance optimizations, extract secrets to environment variables, consolidate utilities, clean up comments, and update tests.

### Success Criteria
- All frontend dead code identified in audit report is removed
- Aggressive performance optimizations applied to React components and hooks
- All frontend hardcoded secrets extracted to environment variables
- Frontend utility functions consolidated in `shared/lib/utils.ts`
- TODO/FIXME comments reviewed and removed where stale
- Frontend test suite passes after all changes

---

## Prerequisites

- [ ] Phase 1 complete
- [ ] `reports/audit-report.json` exists
- [ ] `reports/audit-report.md` reviewed (frontend section)
- [ ] `npm run test:frontend` passes
- [ ] Clean git working tree

---

## Tasks

### Task 1: Frontend Dead Code Removal

**Goal:** Remove all dead code from frontend identified by knip analysis.

**Files to Modify/Create:**
- Files listed in `reports/audit-report.json` under `components.frontend.deadCode`
- `frontend/src/**/*.ts` and `frontend/src/**/*.tsx` (various)

**Prerequisites:**
- Phase 1 Task 8 complete
- Review `reports/audit-report.md` frontend section

**Implementation Steps:**
1. Open `reports/audit-report.json` and locate `components.frontend.deadCode`
2. For each item in `unusedExports`:
   - Navigate to the file and export
   - Verify the export is truly unused (search codebase for imports)
   - Delete the export and its implementation
   - If entire file becomes empty, delete the file
3. For each item in `unusedFiles`:
   - Verify no dynamic imports reference the file
   - Delete the file
   - Remove any import statements that referenced it
4. For each item in `unreachableFunctions`:
   - Trace call chain from entry points
   - If truly unreachable, delete the function
5. Run `npm run lint:frontend` after changes to catch any broken references
6. Run `npm run test:frontend` after each significant deletion

**Verification Checklist:**
- [ ] All items from `unusedExports` addressed
- [ ] All items from `unusedFiles` addressed
- [ ] All items from `unreachableFunctions` addressed
- [ ] `npm run lint:frontend` passes with no errors
- [ ] `npm run test:frontend` passes
- [ ] No TypeScript errors in IDE

**Testing Instructions:**
- Run lint: `cd frontend && npm run lint`
- Run type check: `cd frontend && npx tsc --noEmit`
- Run tests: `cd frontend && npm run test`
- Manually verify app builds: `cd frontend && npm run build`

**Commit Message Template:**
```
refactor(frontend): remove dead code identified by knip

- Delete unused exports: [list key removals]
- Delete unused files: [list files]
- Remove unreachable functions
```

---

### Task 2: Frontend Performance Optimization

**Goal:** Apply aggressive performance optimizations to frontend code, focusing on hot paths and React rendering.

**Files to Modify/Create:**
- `frontend/src/features/**/*.tsx` - Feature components
- `frontend/src/shared/hooks/*.ts` - Custom hooks
- `frontend/src/shared/lib/*.ts` - Utility functions

**Prerequisites:**
- Task 1 complete

**Implementation Steps:**
1. **Optimize array operations:**
   - Find `.map().filter()` chains, replace with single-pass `reduce()` or `for` loop
   - Find `.forEach()` on known-length arrays, replace with `for` loop
   - Find spread in loops (`[...arr, item]`), replace with `push()` mutation where safe
2. **Optimize React patterns:**
   - Find inline function definitions in JSX, extract to `useCallback`
   - Find expensive computations in render, wrap with `useMemo`
   - Find prop drilling patterns, consider if optimization needed
3. **Optimize object operations:**
   - Find `Object.keys().forEach()`, replace with `for...in` or `Object.entries()`
   - Find repeated object spreads, use `Object.assign()` in loops
4. **Inline small utilities:**
   - Find utility functions called once, inline them
   - Find tiny wrapper functions, inline them
5. **Verify each optimization:**
   - Run tests after each file modification
   - Ensure behavior is identical

**Verification Checklist:**
- [ ] No `.map().filter()` chains in hot paths
- [ ] No `.forEach()` on arrays where `for` loop is better
- [ ] React hooks optimizations applied where beneficial
- [ ] `npm run test:frontend` passes
- [ ] Build size has not increased: `cd frontend && npm run build`

**Testing Instructions:**
- Run tests after each optimization: `npm run test:frontend`
- Verify no regressions in functionality
- Build and check bundle size

**Commit Message Template:**
```
perf(frontend): optimize array and React patterns

- Replace map/filter chains with single-pass loops
- Add useMemo/useCallback for expensive operations
- Inline trivial utility functions
```

---

### Task 3: Frontend Secrets Extraction

**Goal:** Extract any hardcoded secrets in frontend code to environment variables.

**Files to Modify/Create:**
- Files listed in `reports/audit-report.json` under `components.frontend.secrets`
- `frontend/.env.example` - Document new variables
- `frontend/src/shared/config/*.ts` - Configuration files

**Prerequisites:**
- Task 1 complete

**Implementation Steps:**
1. Review `components.frontend.secrets.highEntropyStrings` in `reports/audit-report.json`
2. For each finding:
   - Determine if it's a true secret or false positive
   - False positives: Base64 images, UUIDs in tests, hash constants → skip
   - True secrets: API keys, tokens, credentials → extract
3. For true secrets:
   - Create environment variable name following pattern: `VITE_[SERVICE]_[TYPE]`
   - Replace hardcoded value with `import.meta.env.VITE_[NAME]`
   - Add variable to `.env.example` with placeholder value
   - Add TypeScript type declaration if needed
4. Verify Vite environment variable handling:
   - Only `VITE_` prefixed variables are exposed to browser
   - Ensure no sensitive backend secrets are exposed

**Verification Checklist:**
- [ ] All true secrets from audit report extracted
- [ ] `.env.example` updated with new variables
- [ ] No `VITE_` variables expose sensitive backend secrets
- [ ] `npm run test:frontend` passes
- [ ] `npm run build` succeeds (variables resolved)

**Testing Instructions:**
- Create local `.env` with test values
- Run build and verify no undefined variables
- Run tests to verify functionality

**Commit Message Template:**
```
fix(frontend): extract hardcoded secrets to environment variables

- Add VITE_[variables] for [services]
- Update .env.example with placeholders
```

---

### Task 4: Frontend Utility Consolidation

**Goal:** Merge redundant utility functions within the frontend component.

**Files to Modify/Create:**
- `frontend/src/shared/lib/utils.ts` - Primary utility file
- Various files with duplicate utilities

**Prerequisites:**
- Tasks 1-3 complete

**Implementation Steps:**
1. Identify duplicate utilities:
   - Search for similar function names across frontend
   - Look for copy-pasted implementations
   - Check audit report for any utility duplication findings
2. For each duplicate set:
   - Compare implementations for differences
   - Choose the most robust/performant version
   - Move to `frontend/src/shared/lib/utils.ts`
   - Update all import statements
   - Delete the duplicate implementations
3. Ensure no circular dependencies introduced
4. Run lint to verify all imports resolve

**Verification Checklist:**
- [ ] No duplicate utility functions remain in frontend
- [ ] `utils.ts` contains consolidated utilities
- [ ] All imports updated correctly
- [ ] No circular dependencies
- [ ] `npm run lint:frontend` passes
- [ ] `npm run test:frontend` passes

**Testing Instructions:**
- Run lint: `npm run lint:frontend`
- Run tests: `npm run test:frontend`
- Search for common utility patterns to verify no duplicates

**Commit Message Template:**
```
refactor(frontend): consolidate duplicate utilities

- Merge [utilities] into shared/lib/utils.ts
- Update imports across feature modules
- Delete redundant implementations
```

---

### Task 5: Frontend Comment Cleanup

**Goal:** Remove stale TODO/FIXME comments and obvious commented-out code from frontend.

**Files to Modify/Create:**
- Files listed in `reports/audit-report.json` under `components.frontend.sanitization.todoComments`
- Files with commented-out code identified

**Prerequisites:**
- Tasks 1-4 complete

**Implementation Steps:**
1. Review `components.frontend.sanitization.todoComments` in `reports/audit-report.json`
2. For each TODO/FIXME:
   - Read the comment and context
   - If the TODO is completed or obsolete → delete
   - If the TODO is still relevant → keep (but this should be rare)
3. Review `components.frontend.sanitization.commentedCode`:
   - If it's clearly dead code → delete
   - If purpose is unclear → investigate before deleting
4. Search for obvious redundant comments:
   - Comments that just restate the code (`// increment i`)
   - Delete these
5. Do NOT delete:
   - `@ts-ignore` or `@ts-expect-error` suppressions
   - License headers
   - Complex algorithm explanations

**Verification Checklist:**
- [ ] Stale TODOs removed
- [ ] Commented-out code removed
- [ ] Suppression comments preserved
- [ ] `npm run test:frontend` passes

**Testing Instructions:**
- Run tests: `npm run test:frontend`
- Visual review of changes

**Commit Message Template:**
```
chore(frontend): remove stale comments and dead code blocks

- Remove [N] obsolete TODO/FIXME comments
- Remove commented-out code blocks
```

---

### Task 6: Frontend Test Updates

**Goal:** Update frontend tests to reflect changes made in Tasks 1-5, delete orphaned tests.

**Files to Modify/Create:**
- `frontend/src/**/*.test.ts` and `frontend/src/**/*.test.tsx`
- Test files for deleted code → delete

**Prerequisites:**
- Tasks 1-5 complete

**Implementation Steps:**
1. Run test suite to identify failures: `npm run test:frontend`
2. For each failing test:
   - If testing deleted code → delete the test file/case
   - If testing changed behavior → update assertions
   - If testing optimized code → verify behavior unchanged, update if needed
3. Search for orphaned test files:
   - Tests for files that no longer exist
   - Delete these entirely
4. Verify no tests depend on console.log output
5. Ensure test coverage remains acceptable

**Verification Checklist:**
- [ ] `npm run test:frontend` passes (0 failures)
- [ ] No orphaned test files
- [ ] Tests for deleted code removed
- [ ] Test coverage stable

**Testing Instructions:**
- Run full test suite: `npm run test:frontend`
- Run with coverage: `npm run test:frontend -- --coverage`

**Commit Message Template:**
```
test(frontend): update tests for cleanup changes

- Remove tests for deleted code
- Update assertions for optimized implementations
```

---

## Phase Verification

### Phase Complete When:

1. **Frontend tests pass:**
   ```bash
   npm run test:frontend  # Exit code 0
   ```

2. **Frontend lint passes:**
   ```bash
   npm run lint:frontend  # Exit code 0
   ```

3. **Frontend builds:**
   ```bash
   cd frontend && npm run build  # Exit code 0
   ```

4. **TypeScript compiles:**
   ```bash
   cd frontend && npx tsc --noEmit  # Exit code 0
   ```

5. **All commits made with proper format**

### Integration Points Verified:
- [ ] Frontend TypeScript compiles without errors
- [ ] No circular dependencies introduced
- [ ] All imports resolve correctly
- [ ] Build bundle size stable or reduced

### Known Limitations:
- Some knip findings may be false positives (dynamically imported modules)
- Performance gains are not benchmarked (would require separate effort)

### Technical Debt Introduced:
- None—this phase reduces technical debt

---

## Frontend Cleanup Checklist

- [ ] Dead code removed
- [ ] Performance optimizations applied
- [ ] Secrets extracted
- [ ] Utilities consolidated
- [ ] Comments cleaned
- [ ] Tests updated

---

## Handoff to Phase 3

Phase 3 continues with **puppeteer and backend cleanup** using the same audit report. The frontend is now clean and should not be modified in Phase 3 unless integration issues are discovered.
