# Dead Code Audit - Phase 2

**Date**: 2025-11-18
**Branch**: `claude/phase-2-014CF6wTG8wfzidDpVzxkaBk`
**Purpose**: Comprehensive inventory of dead, unused, and unnecessary code to guide removal efforts

## Executive Summary

**Total Issues Found**: 392 ESLint errors/warnings
**Unused Variables**: ~30+ instances
**Empty Block Statements**: ~25+ instances
**TODO Comments**: 3 instances
**Commented Code Lines**: 8 instances
**Orphaned Root Scripts**: 3 files requiring investigation
**Build Warnings**: 2 minor warnings (chunk size, dynamic import)

## 1. ESLint Analysis

### Overall Statistics
- **Total errors/warnings**: 392
- **Primary categories**:
  - `@typescript-eslint/no-unused-vars`: ~30+ instances
  - `@typescript-eslint/no-explicit-any`: ~100+ instances (code quality, not dead code)
  - `no-empty`: ~25+ instances (empty catch blocks)
  - `react-hooks/exhaustive-deps`: ~15 warnings
  - `react-refresh/only-export-components`: ~12 warnings

### Unused Variables (High Priority for Removal)

#### Frontend Components
- `src/components/MessageModal.tsx:86` - unused `error` variable
- `src/components/NewConnectionCard.tsx:63` - unused `e` parameter
- `src/components/NewConnectionCard.tsx:195` - unused `e` parameter
- `src/components/ResearchResultsCard.tsx:75-104` - multiple unused `node` parameters (8 instances)
- `src/components/ui/chart.tsx:70` - unused `_` variable

#### Frontend Contexts
- `src/contexts/AuthContext.tsx` - 7 unused `error` variables (lines 85, 139, 186, 244, 254, 264, 274)

#### Frontend Hooks
- `src/hooks/use-toast.ts:18` - `actionTypes` assigned but only used as type
- `src/hooks/useProfile.ts:38` - unused `_updates` parameter

#### Frontend Pages
- `src/pages/Auth.tsx` - 4 unused `_err` variables (lines 62, 109, 144, 175)
- `src/pages/Profile.tsx:75` - unused `err` variable

### Empty Block Statements (Medium Priority)

These are catch blocks and error handlers that should either handle errors or remove the try-catch:

- `src/components/NewConnectionCard.tsx` - 3 empty blocks (lines 135, 271, 277)
- `src/components/PostEditor.tsx` - 2 empty blocks (lines 63, 75)
- `src/contexts/PostComposerContext.tsx` - 14 empty blocks (lines 88, 90, 95, 97, 102, 104, 109, 111, 172, 208, 222, 227, 231, 242, 262)
- `src/contexts/UserProfileContext.tsx` - 5 empty blocks (lines 51, 53, 73, 117, 139)

### Type Safety Issues (Low Priority - Not Dead Code)

The following are code quality issues but not dead code:
- `@typescript-eslint/no-explicit-any`: ~100+ instances across components, hooks, services
- `@typescript-eslint/no-empty-object-type`: 2 instances (command.tsx, textarea.tsx)

## 2. TypeScript Compiler Analysis

Build completed successfully with TypeScript checks passing. No additional unused code warnings beyond ESLint.

## 3. Commented-Out Code

### Code Blocks to Remove (8 instances)

1. **src/components/NewConnectionsTab.tsx:46-47**
   ```typescript
   // const allTags = useMemo(() => {
   //   const tagSet = new Set<string>();
   ```

2. **src/pages/Dashboard.tsx:19**
   ```typescript
   // import ConnectionFiltersComponent from '@/components/ConnectionFilters';
   ```

3. **src/pages/Dashboard.tsx:268**
   ```typescript
   // const messages = await dbConnector.getMessageHistory(connection.id);
   ```

4. **src/pages/Dashboard.tsx:438**
   ```typescript
   // const messageHistory = await dbConnector.getMessageHistory(connection.id);
   ```

5. **src/pages/Dashboard.tsx:532**
   ```typescript
   // if tags active, sort by number of matching tags desc, then name
   ```
   **Note**: This appears to be an explanatory comment, verify if it's explaining removed code

6. **src/pages/Profile.tsx:13**
   ```typescript
   // import { lambdaApiService } from '@/services/lambdaApiService';
   ```

7. **src/services/healAndRestoreService.ts:67**
   ```typescript
   //if (this.isListening) return; // Prevent multiple listeners/pollers
   ```

8. **Various files**: Commented-out console.log statements (not captured in regex, manual review needed)

## 4. TODO/FIXME Comments

### Actionable TODOs (3 instances)

All located in `puppeteer-backend/controllers/linkedinInteractionController.js`:

1. **Line 467**: `// TODO: Implement request validation`
   - **Action**: Convert to GitHub issue or implement if trivial

2. **Line 478**: `// TODO: Extract user ID from JWT token`
   - **Action**: Convert to GitHub issue or implement if trivial

3. **Line 481**: `// TODO: Implement personalized message generation logic via service layer`
   - **Action**: Convert to GitHub issue or implement if trivial

## 5. Unused Files and Orphaned Scripts

### Root Directory Scripts (Require Investigation)

1. **repair-dynamodb-edges.js** (20,680 bytes)
   - **Type**: Maintenance/repair script
   - **Action**: Search for references in docs, determine if actively used
   - **Decision**: Move to `scripts/maintenance/` or delete if obsolete

2. **restore-contacts.cjs** (1,239 bytes)
   - **Type**: Recovery script
   - **Action**: Check if referenced in recovery procedures
   - **Decision**: Move to `scripts/recovery/` or delete if obsolete

3. **test-repair-script.js** (3,068 bytes)
   - **Type**: Test file for repair script
   - **Action**: Likely old test file, verify and remove
   - **Decision**: Delete if repair-dynamodb-edges.js is removed

### Configuration Files (Keep)

- `eslint.config.js` - Active ESLint configuration
- `jest.config.js` - Test configuration
- `postcss.config.js` - PostCSS configuration

## 6. Build Warnings

### Vite Build Warnings (Low Priority)

1. **Dynamic Import Warning**:
   ```
   /src/utils/connectionCache.ts is dynamically imported by NewConnectionCard.tsx
   but also statically imported by NewConnectionsTab.tsx, Dashboard.tsx
   ```
   - **Impact**: Performance (module won't be code-split)
   - **Action**: Decide on static or dynamic import strategy

2. **Chunk Size Warning**:
   ```
   Some chunks are larger than 500 kB after minification
   ```
   - **Impact**: Performance (large bundle size)
   - **Action**: Consider code-splitting strategies (out of scope for dead code removal)

## 7. Categorized Removal Plan

### High Priority (Safe to Remove)

1. **Unused variables in catch blocks** - Remove or handle properly
2. **Unused function parameters** - Remove or prefix with `_`
3. **Commented-out imports** - Delete
4. **Commented-out code blocks** - Delete
5. **Empty catch blocks** - Remove or add error handling

### Medium Priority (Verify Before Removal)

1. **Empty interface declarations** - Verify not used for type extension
2. **Variables used only as types** - May be intentional, review each
3. **Root directory scripts** - Investigate usage before deletion

### Low Priority (Code Quality, Not Dead Code)

1. **`no-explicit-any` warnings** - Type safety improvement (Phase 4)
2. **React hooks warnings** - Dependency array issues (not dead code)
3. **Fast refresh warnings** - Dev experience issue (not dead code)

## 8. Estimated Impact

### Files to Modify
- **Frontend**: ~20 files (components, pages, hooks, contexts)
- **Backend**: ~3 files (controllers)
- **Root**: ~3 script files (investigate and potentially delete)

### Lines to Remove
- **Unused variables**: ~30-40 variable declarations
- **Empty blocks**: ~25 empty catch/if blocks
- **Commented code**: ~10-15 lines
- **Total estimated**: ~65-80 lines of dead code

### Risk Assessment
- **Low Risk**: Unused variables, commented code, empty blocks
- **Medium Risk**: Root scripts (need verification)
- **High Risk**: None identified

## 9. Next Steps

1. **Task 2**: Remove unused imports and variables
   - Use `npm run lint -- --fix` for auto-fix
   - Manually remove remaining unused variables

2. **Task 3**: Remove unused functions and classes
   - Search for exports with zero usages
   - Verify with "Find Usages" before deletion

3. **Task 4**: Remove unused files and directories
   - Investigate root scripts
   - Remove orphaned files

4. **Task 5**: Clean up commented code and TODOs
   - Delete commented code blocks
   - Convert TODOs to issues or implement

## 10. Success Criteria Checklist

After Phase 2 completion, verify:

- [ ] Zero unused imports
- [ ] Zero unused variables
- [ ] Zero empty block statements
- [ ] No commented-out code (except documentation)
- [ ] All TODOs addressed (converted to issues or removed)
- [ ] All tests passing
- [ ] Build completes with zero warnings (except chunk size)
- [ ] ESLint passes with no unused warnings

---

**Generated**: 2025-11-18
**Tool**: ESLint 9.39.1, TypeScript 5.5+, Vite 6.4.1
**Next Phase**: [Task 2: Remove Unused Imports and Variables](../plans/Phase-2.md#task-2)
