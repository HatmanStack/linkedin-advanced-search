# Phase 3: Puppeteer + Backend Cleanup + CI + Final Verification

**Estimated Tokens:** ~30,000

## Phase Goal

Complete the codebase cleanup by processing puppeteer and backend components. Remove dead code, apply aggressive performance optimizations, extract secrets, consolidate utilities, clean up comments, update tests, apply CI tweaks, and generate final audit report.

### Success Criteria
- All puppeteer dead code identified in audit report is removed
- All backend (Python Lambda) dead code identified in audit report is removed
- Aggressive performance optimizations applied to both components
- All hardcoded secrets extracted to environment variables
- Utility functions consolidated within each component
- TODO/FIXME comments reviewed and removed where stale
- Full test suite passes after all changes
- CI workflow has minor improvements applied
- Final audit report shows significant reduction in findings

---

## Prerequisites

- [ ] Phase 2 complete (frontend cleanup done)
- [ ] `reports/audit-report.json` exists
- [ ] `reports/audit-report.md` reviewed (puppeteer and backend sections)
- [ ] `npm run test:frontend` still passes
- [ ] Clean git working tree

---

## Tasks

### Task 1: Puppeteer Dead Code Removal

**Goal:** Remove all dead code from puppeteer backend identified by knip analysis.

**Files to Modify/Create:**
- Files listed in `reports/audit-report.json` under `components.puppeteer.deadCode`
- `puppeteer/src/**/*.js` and `puppeteer/routes/*.js` (various)

**Prerequisites:**
- Phase 2 complete

**Implementation Steps:**
1. Open `reports/audit-report.json` and locate `components.puppeteer.deadCode`
2. Follow same process as Phase 2 Task 1 for frontend:
   - Remove unused exports
   - Delete unused files
   - Remove unreachable functions
3. Pay special attention to:
   - Express route handlers in `puppeteer/routes/*.js` (ensure routes are active)
   - Puppeteer automation functions (may be called dynamically)
   - Utility functions in `puppeteer/src/shared/utils/`
4. Run lint and tests after each deletion

**Verification Checklist:**
- [ ] All items from audit report addressed
- [ ] `cd puppeteer && npm run lint` passes
- [ ] `cd puppeteer && npm run test` passes
- [ ] Express server starts without errors

**Testing Instructions:**
- Run lint: `cd puppeteer && npm run lint`
- Run tests: `cd puppeteer && npm run test`
- Start server: `cd puppeteer && npm start` (verify no startup errors)

**Commit Message Template:**
```
refactor(puppeteer): remove dead code identified by knip

- Delete unused exports and files
- Remove unreachable functions
```

---

### Task 2: Puppeteer Performance Optimization

**Goal:** Apply aggressive performance optimizations to puppeteer backend code.

**Files to Modify/Create:**
- `puppeteer/src/domains/**/*.js` - Domain logic
- `puppeteer/routes/*.js` - Route handlers (NOT under src/)
- `puppeteer/src/shared/utils/*.js` - Utilities

**Prerequisites:**
- Task 1 complete

**Implementation Steps:**
1. **Optimize async patterns:**
   - Find sequential `await` calls that can be parallelized → use `Promise.all()`
   - Find `await` in loops → batch operations where possible
2. **Optimize array operations:**
   - Same patterns as frontend (map/filter chains, forEach)
3. **Optimize Puppeteer-specific patterns:**
   - Find repeated `page.evaluate()` calls → batch into single call
   - Find slow selectors → optimize for performance
4. **Optimize object operations:**
   - Same patterns as frontend
5. **Inline small utilities:**
   - Same approach as frontend

**Verification Checklist:**
- [ ] Sequential awaits parallelized where possible
- [ ] Array operations optimized
- [ ] Puppeteer calls batched where beneficial
- [ ] `cd puppeteer && npm run test` passes

**Testing Instructions:**
- Run tests after each optimization: `cd puppeteer && npm run test`
- Verify no behavior changes

**Commit Message Template:**
```
perf(puppeteer): optimize async and array patterns

- Parallelize independent async operations
- Batch Puppeteer page.evaluate calls
- Optimize array iteration patterns
```

---

### Task 3: Puppeteer Secrets and Cleanup

**Goal:** Extract secrets, consolidate utilities, and clean up comments in puppeteer.

**Files to Modify/Create:**
- Files from `reports/audit-report.json` secrets section
- `puppeteer/src/shared/utils/*.js` - Consolidate within existing util files
- Various files with comments

**Prerequisites:**
- Task 2 complete

**Implementation Steps:**
1. **Secrets extraction:**
   - Review `reports/audit-report.json` for puppeteer secrets
   - Replace with `process.env.VAR_NAME`
   - Update `.env.example` in project root
2. **Utility consolidation:**
   - Find duplicate utilities within puppeteer
   - Merge into `puppeteer/src/shared/utils/` (7 existing util files)
   - Update imports
3. **Comment cleanup:**
   - Remove stale TODOs/FIXMEs
   - Remove commented-out code
   - Keep suppression comments

**Verification Checklist:**
- [ ] Secrets extracted to environment variables
- [ ] Utilities consolidated
- [ ] Comments cleaned
- [ ] `cd puppeteer && npm run test` passes

**Testing Instructions:**
- Run tests: `cd puppeteer && npm run test`
- Verify server starts with env vars

**Commit Message Template:**
```
refactor(puppeteer): secrets extraction and utility consolidation

- Extract secrets to environment variables
- Consolidate duplicate utilities
- Remove stale comments
```

---

### Task 4: Puppeteer Test Updates

**Goal:** Update puppeteer tests to reflect changes.

**Files to Modify/Create:**
- `puppeteer/src/**/*.test.js`

**Prerequisites:**
- Task 3 complete

**Implementation Steps:**
1. Run test suite: `cd puppeteer && npm run test`
2. Fix failing tests (same approach as Phase 2 Task 6)
3. Remove orphaned tests
4. Verify coverage

**Verification Checklist:**
- [ ] `cd puppeteer && npm run test` passes
- [ ] No orphaned tests

**Testing Instructions:**
- Run tests: `cd puppeteer && npm run test`

**Commit Message Template:**
```
test(puppeteer): update tests for cleanup changes

- Remove tests for deleted code
- Update assertions for optimized implementations
```

---

### Task 5: Backend Dead Code Removal

**Goal:** Remove all dead code from Python lambdas identified by vulture analysis.

**Files to Modify/Create:**
- Files listed in `reports/audit-report.json` under `components.backend.deadCode`
- `backend/lambdas/**/*.py` (various)

**Prerequisites:**
- Task 4 complete (puppeteer cleanup done)

**Implementation Steps:**
1. Open `reports/audit-report.json` and locate `components.backend.deadCode`
2. For each finding:
   - Verify it's not a false positive (Lambda handlers, fixtures)
   - Delete truly dead code
3. Pay special attention to:
   - Lambda handler functions (MUST keep)
   - Shared utility functions in `backend/lambdas/shared/`
   - Imports used only for type hints
4. Run tests after each deletion

**Verification Checklist:**
- [ ] All audit items addressed
- [ ] Lambda handlers preserved
- [ ] `npm run lint:backend` passes (ruff)
- [ ] `npm run test:backend` passes (pytest)

**Testing Instructions:**
- Run lint: `npm run lint:backend`
- Run tests: `npm run test:backend`

**Commit Message Template:**
```
refactor(backend): remove dead code identified by vulture

- Delete unused functions and imports
- Remove unreachable code paths
```

---

### Task 6: Backend Performance Optimization

**Goal:** Apply aggressive performance optimizations to Python Lambda code.

**Files to Modify/Create:**
- `backend/lambdas/**/*.py`

**Prerequisites:**
- Task 5 complete

**Implementation Steps:**
1. **Optimize iteration patterns:**
   - Replace `for i in range(len(list))` with `enumerate()`
   - Replace list comprehensions with generators for large datasets
   - Use `itertools` for complex iterations
2. **Optimize conditionals:**
   - Replace multiple `if/elif` chains with dictionary dispatch
   - Replace `try/except KeyError` with `dict.get()`
3. **Optimize string operations:**
   - Use `join()` instead of `+` concatenation in loops
   - Use f-strings consistently
4. **Lambda-specific optimizations:**
   - Ensure cold start is minimized (lazy imports where possible)
   - Keep handler functions lean
5. **Inline small functions:**
   - Inline lambdas used once
   - Inline trivial helpers

**Verification Checklist:**
- [ ] Iteration patterns optimized
- [ ] Conditionals optimized
- [ ] String operations optimized
- [ ] `npm run lint:backend` passes
- [ ] `npm run test:backend` passes

**Testing Instructions:**
- Run lint: `npm run lint:backend`
- Run tests: `npm run test:backend`

**Commit Message Template:**
```
perf(backend): optimize Python patterns for Lambda performance

- Optimize iteration and string operations
- Convert if/elif chains to dictionary dispatch
- Inline trivial helper functions
```

---

### Task 7: Backend Secrets and Cleanup

**Goal:** Extract secrets, consolidate utilities, and clean up comments in backend.

**Files to Modify/Create:**
- Files from `reports/audit-report.json` secrets section
- `backend/lambdas/shared/*.py`
- Various files with comments

**Prerequisites:**
- Task 6 complete

**Implementation Steps:**
1. **Secrets extraction:**
   - Review `reports/audit-report.json` for backend secrets
   - Replace with `os.environ.get('VAR_NAME')` or `os.environ['VAR_NAME']`
   - Add to SAM template as environment variables
   - Update any `.env.example`
2. **Utility consolidation:**
   - Find duplicate utilities within backend lambdas
   - Merge into `backend/lambdas/shared/`
   - Update imports
3. **Comment cleanup:**
   - Remove stale TODOs/FIXMEs
   - Remove commented-out code
   - Keep `# noqa` and type hint comments

**Verification Checklist:**
- [ ] Secrets extracted to environment variables
- [ ] Utilities consolidated in shared/
- [ ] Comments cleaned
- [ ] `npm run test:backend` passes

**Testing Instructions:**
- Run tests: `npm run test:backend`

**Commit Message Template:**
```
refactor(backend): secrets extraction and utility consolidation

- Extract secrets to environment variables
- Consolidate duplicate utilities to shared/
- Remove stale comments
```

---

### Task 8: Backend Test Updates

**Goal:** Update backend tests to reflect changes.

**Files to Modify/Create:**
- `tests/backend/unit/*.py`

**Prerequisites:**
- Task 7 complete

**Implementation Steps:**
1. Run test suite: `npm run test:backend`
2. Fix failing tests (same approach as previous)
3. Remove orphaned tests
4. Verify coverage

**Verification Checklist:**
- [ ] `npm run test:backend` passes
- [ ] No orphaned tests

**Testing Instructions:**
- Run tests: `npm run test:backend`

**Commit Message Template:**
```
test(backend): update tests for cleanup changes

- Remove tests for deleted code
- Update assertions for optimized implementations
```

---

### Task 9: CI Workflow Minor Tweaks

**Goal:** Review and apply minor improvements to the existing CI workflow without major restructuring.

**Files to Modify/Create:**
- `.github/workflows/ci.yml`

**Prerequisites:**
- Tasks 1-8 complete

**Implementation Steps:**
1. Review current `ci.yml` for improvement opportunities
2. **Already configured** (verify, don't duplicate):
   - npm caching is present (ci.yml:22-23, ci.yml:46-47)
   - Node 24 and Python 3.13 are pinned
   - `max-warnings: 0` for ESLint
3. Potential tweaks (if not present):
   - Add pip caching for backend job
   - Add timeout limits if missing
   - Verify test commands match standardized format
4. Do NOT:
   - Restructure the workflow
   - Add deployment steps
   - Change fundamental job structure
5. Keep changes minimal—this CI is already well-configured

**Verification Checklist:**
- [ ] CI workflow syntax valid (`act` or push to verify)
- [ ] No functional changes to pipeline behavior
- [ ] Pip caching added if missing
- [ ] Timeouts reasonable

**Testing Instructions:**
- Push to a branch and verify CI runs
- Or use `act` locally to test workflow

**Commit Message Template:**
```
ci: add pip caching and minor optimizations

- Add pip cache for backend job
- [Other minor tweaks]
```

---

### Task 10: Final Verification and Audit Report Update

**Goal:** Run full test suite, regenerate audit report to show improvements, verify all cleanup complete.

**Files to Modify/Create:**
- `reports/audit-report-final.json` - Post-cleanup audit
- `reports/audit-report-final.md` - Post-cleanup summary

**Prerequisites:**
- Tasks 1-9 complete

**Implementation Steps:**
1. Run full test suite: `npm run test`
2. Ensure all tests pass
3. Re-run cleanup script in analysis-only mode:
   ```bash
   ./scripts/cleanup/code-cleanup.sh audit
   ```
4. Compare new findings with original audit:
   - Dead code should be significantly reduced
   - Sanitization issues should be zero
   - Some findings may remain (acceptable false positives)
5. Document any remaining items and rationale for keeping them
6. Rename/copy audit output to final versions

**Verification Checklist:**
- [ ] `npm run test` passes (all components)
- [ ] `npm run lint` passes (all components)
- [ ] `npm run build` passes (frontend)
- [ ] New audit shows reduced issues
- [ ] Any remaining issues documented

**Testing Instructions:**
- Run all lints: `npm run lint`
- Run all tests: `npm run test`
- Run build: `cd frontend && npm run build`
- Compare audit reports

**Commit Message Template:**
```
chore: complete code hygiene cleanup

- All dead code removed
- Performance optimizations applied
- Secrets extracted to environment variables
- Final audit report generated
```

---

## Phase Verification

### Phase Complete When:

1. **All tests pass:**
   ```bash
   npm run test  # Exit code 0
   ```

2. **All lints pass:**
   ```bash
   npm run lint  # Exit code 0
   ```

3. **Frontend builds:**
   ```bash
   cd frontend && npm run build  # Exit code 0
   ```

4. **Puppeteer server starts:**
   ```bash
   cd puppeteer && npm start  # No startup errors
   ```

5. **Backend SAM validates:**
   ```bash
   cd backend && sam validate  # Exit code 0
   ```

6. **Audit comparison shows improvement:**
   - Original audit issues > Final audit issues
   - Ideally 80%+ reduction in findings

7. **All commits made with proper format**

### Integration Points Verified:
- [ ] Frontend TypeScript compiles without errors
- [ ] Puppeteer server starts without errors
- [ ] Backend SAM template valid
- [ ] No circular dependencies introduced
- [ ] All imports resolve correctly

### Known Limitations:
- Some knip/vulture findings may be false positives (documented in final audit)
- Dynamic imports may not be detected by static analysis
- Performance gains are not benchmarked (would require separate effort)

### Technical Debt Introduced:
- None—this phase reduces technical debt

---

## Complete Cleanup Summary Checklist

### Frontend (Phase 2)
- [ ] Dead code removed
- [ ] Performance optimizations applied
- [ ] Secrets extracted
- [ ] Utilities consolidated
- [ ] Comments cleaned
- [ ] Tests updated

### Puppeteer (Phase 3)
- [ ] Dead code removed
- [ ] Performance optimizations applied
- [ ] Secrets extracted
- [ ] Utilities consolidated
- [ ] Comments cleaned
- [ ] Tests updated

### Backend (Phase 3)
- [ ] Dead code removed
- [ ] Performance optimizations applied
- [ ] Secrets extracted
- [ ] Utilities consolidated
- [ ] Comments cleaned
- [ ] Tests updated

### Infrastructure (Phase 3)
- [ ] CI tweaks applied
- [ ] Final audit generated
- [ ] All tests pass
- [ ] All lints pass

---

## Project Complete

When all checklists are complete:
1. Final audit report exists at `reports/audit-report-final.json`
2. All tests pass across all components
3. Codebase is cleaner, faster, and more maintainable
4. No new technical debt introduced
