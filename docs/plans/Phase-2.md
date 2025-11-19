# Phase 2: Dead Code Removal

## Phase Goal

Systematically identify and remove all dead, unused, and unnecessary code across the entire codebase. This includes unused imports, variables, functions, files, commented-out code, and any other code that serves no functional purpose.

**Success Criteria**:
- Zero unused imports across all files
- Zero unused variables or functions
- No commented-out code blocks (except necessary documentation)
- All tests still passing after removal
- Build completes with zero warnings
- ESLint passes with no unused warnings

**Estimated Tokens**: ~35,000

## Prerequisites

- **Phase 1 completed**: Comprehensive test suite in place and all tests passing
- ESLint configured with unused variable detection
- TypeScript strict mode enabled (already present)

## Overview

This phase is organized into 5 tasks:

1. **Audit and Identify Dead Code** - Systematically find all unused code
2. **Remove Unused Imports and Variables** - Clean up frontend and backend
3. **Remove Unused Functions and Classes** - Eliminate dead business logic
4. **Remove Unused Files and Directories** - Clean up file system
5. **Remove Commented Code and TODOs** - Clean up code comments

Each removal task includes verification steps to ensure no functional code is accidentally deleted.

---

## Task 1: Audit and Identify Dead Code

**Goal**: Create a comprehensive inventory of all dead code across the codebase to guide removal efforts.

**Files to Modify/Create**:
- `docs/refactoring/dead-code-audit.md` - Document findings

**Prerequisites**:
- Phase 1 completed (all tests passing)

**Implementation Steps**:

1. **Run ESLint for Unused Code**:
   - Execute `npm run lint` to identify unused variables and imports
   - Review ESLint output and save to file for reference
   - Note any ESLint warnings about unused code

2. **Use TypeScript Compiler for Unused Exports**:
   - Run `tsc --noEmit --noUnusedLocals --noUnusedParameters`
   - Identify unused exports, parameters, and variables
   - Document TypeScript warnings

3. **Search for Commented-Out Code**:
   - Search for patterns like `// `, `/* */`, `<!--` in code files (not markdown)
   - Manually review to distinguish comments vs. commented code
   - Create list of files with significant commented code blocks

4. **Identify Unused Files**:
   - Look for files not imported anywhere
   - Check for orphaned utility files
   - Check root directory for old scripts or test files
   - Review utility directories for files with no imports

5. **Check for TODOs and FIXMEs**:
   - Search for `TODO`, `FIXME`, `HACK`, `XXX` comments
   - Document location and context
   - Decide if they should be converted to issues or removed

6. **Review Build Warnings**:
   - Run `npm run build` and check for warnings
   - Note any unused code warnings from Vite or TypeScript
   - Document warnings about deprecated code

7. **Create Dead Code Inventory**:
   - Categorize findings: imports, variables, functions, files, comments
   - Prioritize by safety (safe to remove vs. needs investigation)
   - Estimate impact of removal

**Verification Checklist**:
- [ ] ESLint output reviewed and documented
- [ ] TypeScript compiler warnings captured
- [ ] Commented-out code blocks identified
- [ ] Unused files listed
- [ ] TODO/FIXME comments catalogued
- [ ] Build warnings documented
- [ ] Audit document created with comprehensive findings

**Testing Instructions**:
- This is an analysis task, no tests required
- Verify audit document is comprehensive and well-organized

**Commit Message Template**:
```
docs(refactor): audit and document dead code findings

- Run ESLint and TypeScript to identify unused code
- Search for commented-out code blocks
- Identify orphaned files and unused utilities
- Document TODOs and FIXMEs
- Create comprehensive dead code inventory
```

**Estimated Tokens**: ~4,000

---

## Task 2: Remove Unused Imports and Variables

**Goal**: Remove all unused imports and variables across frontend, backend, and Lambda code.

**Files to Modify/Create**:
- Multiple files across `src/`, `puppeteer-backend/`, `lambda-processing/`

**Prerequisites**:
- Task 1 completed (audit identifying unused imports/variables)

**Implementation Steps**:

1. **Use ESLint Auto-Fix**:
   - Run `npm run lint -- --fix` to automatically remove some unused imports
   - Review changes made by auto-fix before committing
   - Note any imports ESLint couldn't auto-fix

2. **Manual Review and Removal**:
   - Review ESLint/TypeScript warnings from Task 1 audit
   - Manually remove unused imports that auto-fix missed
   - Remove unused variables and parameters
   - Be conservative: if uncertain, keep the code and investigate further

3. **Frontend (TypeScript/React)**:
   - Remove unused React imports (often `React` itself if using JSX transform)
   - Remove unused hook imports
   - Remove unused type imports
   - Remove unused library imports (lodash, date-fns, etc.)

4. **Backend (Node.js)**:
   - Remove unused service imports
   - Remove unused utility imports
   - Remove unused middleware imports
   - Check for circular dependencies that might appear as "unused"

5. **Lambda Functions**:
   - Remove unused Python imports
   - Remove unused Node.js imports in Lambda
   - Remove unused boto3 clients or methods

6. **Verify After Each Major Change**:
   - Run tests after removing imports: `npm test`
   - Ensure build still works: `npm run build`
   - Check for new errors introduced by removal

7. **Handle Edge Cases**:
   - Keep imports that have side effects (e.g., `import './polyfill.js'`)
   - Keep imports used only in comments or type definitions (verify they're truly unused)
   - Keep imports used dynamically (e.g., `import(variable)`)

**Verification Checklist**:
- [ ] ESLint auto-fix executed successfully
- [ ] All unused imports removed from frontend
- [ ] All unused imports removed from backend
- [ ] All unused imports removed from Lambda functions
- [ ] All tests still passing after removal
- [ ] Build completes with no errors
- [ ] No new ESLint warnings introduced
- [ ] Side-effect imports preserved

**Testing Instructions**:
- Run `npm test` after each batch of removals
- Run `npm run build` to ensure build succeeds
- Run `npm run lint` to verify no new warnings

**Commit Message Template**:
```
refactor: remove unused imports and variables

- Remove unused imports from frontend (React, hooks, utilities)
- Remove unused imports from backend (services, middleware)
- Remove unused imports from Lambda functions
- Remove unused variables and parameters
- All tests passing, build successful
```

**Estimated Tokens**: ~8,000

---

## Task 3: Remove Unused Functions and Classes

**Goal**: Identify and remove functions, methods, and classes that are no longer used anywhere in the codebase.

**Files to Modify/Create**:
- Multiple files across all layers

**Prerequisites**:
- Task 2 completed (unused imports removed)
- Tests still passing

**Implementation Steps**:

1. **Identify Unused Exports**:
   - Search for exported functions/classes not imported elsewhere
   - Use IDE "Find Usages" feature for each export
   - Check if functions are only used in commented code or dead files

2. **Categorize by Risk**:
   - **Low Risk**: Utility functions with no imports, obvious duplicates
   - **Medium Risk**: Service methods with few/no references
   - **High Risk**: Public API methods, exported library functions

3. **Start with Low-Risk Removals**:
   - Remove obvious utility functions with zero usages
   - Remove duplicate helper functions
   - Remove old/deprecated function versions (e.g., `fetchProfileOld`)

4. **Remove Unused Helper Functions**:
   - Check `utils/` directories for unused helpers
   - Verify helpers aren't used by any tests
   - Remove if truly unused

5. **Remove Unused Service Methods**:
   - Identify service methods not called by controllers or components
   - Verify they're not called dynamically
   - Remove if confirmed unused

6. **Remove Unused Classes**:
   - Identify classes that are never instantiated
   - Remove old/deprecated class versions
   - Check for abstract classes or interfaces that might not show up in searches

7. **Handle Dead Callback Functions**:
   - Remove unused event handlers
   - Remove unused middleware functions
   - Remove unused lifecycle methods

8. **Verify Removal Safety**:
   - After removing each function, run tests
   - Check build for errors
   - Use git to easily revert if removal breaks something

**Verification Checklist**:
- [ ] All unused functions removed from frontend
- [ ] All unused functions removed from backend
- [ ] All unused functions removed from Lambda code
- [ ] No functions removed that are used in tests
- [ ] Tests still passing after all removals
- [ ] Build completes successfully
- [ ] No runtime errors in development mode

**Testing Instructions**:
- Run `npm test` after each batch of function removals
- Start the application and verify core functionality works
- Check for runtime errors in browser console

**Commit Message Template**:
```
refactor: remove unused functions and classes

- Remove unused utility functions from frontend and backend
- Remove unused service methods
- Remove unused helper classes
- Verify no impact on tests or build
- All tests passing, application functional
```

**Estimated Tokens**: ~9,000

---

## Task 4: Remove Unused Files and Directories

**Goal**: Delete entire files and directories that are no longer used in the codebase.

**Files to Modify/Create**:
- N/A (files will be deleted)

**Prerequisites**:
- Task 3 completed (unused functions removed)
- Tests still passing

**Implementation Steps**:

1. **Identify Orphaned Files**:
   - Look for files with no imports (not imported anywhere)
   - Check for old test files that no longer have corresponding source files
   - Look for deprecated or old versions of files (e.g., `serviceOld.js`)

2. **Check Root Directory with Verification**:
   - List files in root: `ls -la *.js *.cjs *.mjs 2>/dev/null`
   - For each script file found:

     **Verification Process**:
     a. Search for imports/references: `grep -r "filename" src/ puppeteer-backend/`
     b. Check if mentioned in docs: `grep -r "filename" docs/ README.md`
     c. Check git history: `git log --oneline --all -- filename | head -5`
     d. Check last modified: `git log -1 --format="%ai" -- filename`

     **Decision Matrix**:
     - ✅ Safe to delete: No references, not in docs, >6 months old
     - ⚠️ Move to scripts/deprecated/: Some references but unclear usage
     - ❌ Keep: Referenced in code or docs, or recently modified

   - Examples from codebase:
     - `repair-dynamodb-edges.js`: Check if used in deployment/maintenance
     - `restore-contacts.cjs`: Check if referenced in recovery procedures

3. **Check for Empty Directories**:
   - After file removal, check for empty directories
   - Remove empty directories unless they serve structural purpose

4. **Review Migration and Docs Directories**:
   - Check `/Migration/docs/` - these are documentation of completed refactor
   - Decide if they should be kept for historical reference or removed
   - If keeping, ensure they're clearly marked as historical

5. **Check for Duplicate or Old Files**:
   - Look for files like `component.old.tsx`, `service.backup.js`
   - Remove if no longer needed
   - Check git history if context is needed

6. **Careful with Test Files**:
   - Don't remove test files just created in Phase 1
   - Remove test files for source files that no longer exist
   - Update test file structure if source structure changed

7. **Verify File Removal Safety**:
   - Before deleting, verify file is truly unused (grep for imports)
   - Check if file is referenced in documentation or config
   - Use git to track deletions (easy to revert)

**Verification Checklist**:
- [ ] All orphaned files identified and removed
- [ ] Root directory cleaned up (scripts moved or removed)
- [ ] Empty directories removed
- [ ] No build errors after file deletion
- [ ] All tests still passing
- [ ] No broken imports or references
- [ ] Git shows clear deletion commits

**Testing Instructions**:
- Run `npm test` after removing files
- Run `npm run build` to ensure no broken imports
- Check for missing file errors in console

**Commit Message Template**:
```
refactor: remove unused files and directories

- Remove orphaned utility files
- Clean up root directory scripts (move to scripts/ or delete)
- Remove empty directories
- Remove old/backup file versions
- All tests passing, build successful
```

**Estimated Tokens**: ~6,000

---

## Task 5: Remove Commented Code and Clean Up TODOs

**Goal**: Remove commented-out code blocks and clean up TODO/FIXME comments throughout the codebase.

**Files to Modify/Create**:
- Multiple files across all layers

**Prerequisites**:
- Task 4 completed (unused files removed)
- Tests still passing

**Implementation Steps**:

1. **Distinguish Comments from Commented Code**:
   - **Keep**: Explanatory comments, documentation, JSDoc
   - **Remove**: Commented-out code blocks, old implementations, debug logs
   - When uncertain, check git history for context

2. **Remove Commented Code Blocks**:
   - Search for patterns: `// function`, `// const`, `/* ... */` with code
   - Review each block to confirm it's truly dead code
   - Remove commented console.log statements
   - Remove commented imports

3. **Handle TODO Comments**:
   - Review all TODO/FIXME/HACK comments from Task 1 audit
   - **Option 1**: Convert to GitHub issues and remove comment
   - **Option 2**: Address the TODO now if trivial
   - **Option 3**: Keep if still relevant and actionable, rewrite for clarity
   - **Option 4**: Remove if no longer relevant

4. **Clean Up Debug Comments**:
   - Remove debug console.log comments
   - Remove temporary debugging code
   - Keep intentional logging (errors, important events)

5. **Improve Remaining Comments**:
   - Update comments that refer to code that's been removed
   - Fix comments that are now inaccurate after refactoring
   - Remove redundant comments that just restate code

6. **Handle Special Cases**:
   - **Keep**: Copyright headers, license comments
   - **Keep**: Complex algorithm explanations
   - **Keep**: Warnings about non-obvious behavior
   - **Remove**: Commented-out debugging code
   - **Remove**: Old implementation notes that are no longer relevant

7. **Specific Areas to Check**:
   - Check files mentioned in Task 1 audit (controllers, config files)
   - Review `/repair-dynamodb-edges.js` for TODOs
   - Review `/puppeteer-backend/controllers/linkedinInteractionController.js`
   - Review `/puppeteer-backend/config/index.js`

**Verification Checklist**:
- [ ] All commented-out code blocks removed
- [ ] TODO/FIXME comments addressed (removed, converted to issues, or kept if still relevant)
- [ ] Debug comments cleaned up
- [ ] Remaining comments are accurate and helpful
- [ ] No functional code removed accidentally
- [ ] Tests still passing
- [ ] Build completes successfully

**Testing Instructions**:
- Run `npm test` to ensure no code was accidentally removed
- Review changes carefully in git diff
- Verify application still functions correctly

**Commit Message Template**:
```
refactor: remove commented code and clean up TODOs

- Remove all commented-out code blocks
- Address TODO/FIXME comments (convert to issues or remove)
- Clean up debug comments and console.logs
- Update outdated comments to reflect current code
- All tests passing, no functional changes
```

**Estimated Tokens**: ~8,000

---

## Phase Verification

After completing all 5 tasks, verify the entire phase:

### Verification Steps

1. **Run Full Test Suite**:
   ```bash
   npm test
   cd lambda-processing && pytest
   ```

2. **Run Build**:
   ```bash
   npm run build
   ```
   - Verify build completes with **zero warnings**
   - Check for any unused code warnings

3. **Run ESLint**:
   ```bash
   npm run lint
   ```
   - Verify **zero unused import/variable warnings**
   - Verify no new errors introduced

4. **Manual Code Review**:
   - Browse through key directories
   - Verify code looks clean and organized
   - Check for any accidentally remaining dead code

5. **Git Review**:
   - Review all commits from this phase
   - Ensure deletions are intentional and documented
   - Verify commit messages follow conventional format

### Success Criteria

✅ **Zero unused imports** across all files
✅ **Zero unused variables** or parameters
✅ **Zero unused functions** or classes
✅ **No commented-out code** blocks (except necessary documentation)
✅ **No orphaned files** or empty directories
✅ **All tests passing** (100% pass rate)
✅ **Build completes** with zero warnings
✅ **ESLint passes** with no unused warnings
✅ **Application runs** without errors

### Metrics to Track

**Before Phase 2**:
- ESLint warnings: [Count from initial audit]
- TypeScript warnings: [Count from initial audit]
- Commented code blocks: [Count from initial audit]
- Unused files: [Count from initial audit]

**After Phase 2**:
- ESLint warnings: 0
- TypeScript warnings: 0 (unused code related)
- Commented code blocks: 0 (code blocks only)
- Unused files: 0

### Known Limitations

- Some code might appear unused but is used dynamically (verify carefully)
- Some TODOs might be kept if still relevant and actionable
- Some files in `/Migration/docs/` might be kept for historical reference

### Next Steps

Once this phase is complete and verified, proceed to [Phase 3: Code Organization](./Phase-3.md).

---

**Estimated Total Tokens**: ~35,000
