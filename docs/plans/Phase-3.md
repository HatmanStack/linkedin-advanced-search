# Phase 3: Code Organization Restructuring

## Phase Goal

Restructure the codebase to improve logical organization, create clear separation of concerns, and establish consistent patterns for file and directory structure. This phase focuses on moving files into more intuitive locations, grouping related code together, and creating a more maintainable project structure.

**Success Criteria**:
- Consistent directory structure across all layers
- Logical grouping of files by feature or domain
- Clear separation of concerns (UI, business logic, data access)
- All imports updated to reflect new structure
- All tests still passing after reorganization
- Improved developer experience (easier to find files)

**Estimated Tokens**: ~45,000

## Prerequisites

- **Phase 1 completed**: Test suite provides safety net for refactoring
- **Phase 2 completed**: Dead code removed, cleaner codebase
- All tests passing

## Overview

This phase is organized into 6 tasks:

1. **Audit Current Structure and Design New Organization** - Analyze and plan improvements
2. **Reorganize Frontend by Feature** - Group components, hooks, and services by domain
3. **Reorganize Backend Services and Controllers** - Improve backend structure
4. **Standardize Lambda Function Structure** - Create consistent Lambda organization
5. **Consolidate Configuration and Constants** - Centralize config management
6. **Update All Imports and Verify** - Fix all import paths after restructuring

---

## Task 1: Audit Current Structure and Design New Organization

**Goal**: Analyze the current directory structure, identify organizational issues, and design an improved structure that follows best practices.

**Files to Modify/Create**:
- `docs/refactoring/structure-audit.md` - Document current structure analysis
- `docs/refactoring/proposed-structure.md` - Document proposed new structure

**Prerequisites**:
- Phase 2 completed (dead code removed)

**Implementation Steps**:

1. **Analyze Current Frontend Structure**:
   - Map out current `src/` directory structure
   - Identify components, hooks, and services that are feature-specific vs. shared
   - Note any misplaced files or unclear organization
   - Identify opportunities for feature-based grouping

2. **Analyze Current Backend Structure**:
   - Map out `puppeteer-backend/` structure
   - Identify related services that could be grouped
   - Check for utilities that belong with specific services
   - Look for opportunities to group by domain (LinkedIn, Auth, Workflow, etc.)

3. **Analyze Lambda Structure**:
   - Review each Lambda function's internal organization
   - Check for consistency across Lambda functions
   - Identify shared code that could be extracted
   - Note any configuration or utility duplication

4. **Identify Organizational Patterns**:
   - **Feature-based**: Group by feature (connections, messages, search, profile)
   - **Layer-based**: Group by type (components, hooks, services)
   - **Hybrid**: Features within layers, or layers within features
   - Decide which pattern fits this codebase best

5. **Design Proposed Structure**:
   - Create detailed proposed directory tree for frontend
   - Create detailed proposed directory tree for backend
   - Create standardized structure template for Lambda functions
   - Document rationale for organizational decisions

6. **Identify Migration Complexity**:
   - Count files that need to move
   - Identify high-risk moves (heavily imported files)
   - Estimate number of import updates required
   - Plan migration order (low-risk to high-risk)

7. **Consider Best Practices**:
   - React: Feature folders, barrel exports, clear UI/logic separation
   - Node.js: Domain-driven structure, clear layers (controllers, services, data)
   - Lambda: Consistent structure, shared utilities, clear entry points

**Verification Checklist**:
- [ ] Current structure fully documented
- [ ] Organizational issues identified and documented
- [ ] Proposed structure designed and documented
- [ ] Rationale provided for structural decisions
- [ ] Migration complexity estimated
- [ ] Files categorized for relocation

**Testing Instructions**:
- This is a planning task, no tests required
- Review proposed structure with architectural best practices

**Commit Message Template**:
```
docs(refactor): audit structure and design reorganization plan

- Document current frontend, backend, and Lambda structure
- Identify organizational issues and improvement opportunities
- Design proposed structure following best practices
- Plan migration strategy and estimate complexity
```

**Estimated Tokens**: ~5,000

---

## Task 2: Reorganize Frontend by Feature

**Goal**: Restructure the frontend code to organize components, hooks, and services by feature domain, improving discoverability and maintainability.

**Files to Modify/Create**:
- Reorganize files in `src/` directory based on Task 1 design
- Create new directories for feature groups
- Move files to appropriate locations

**Prerequisites**:
- Task 1 completed (proposed structure designed)

**Implementation Steps**:

1. **Proposed Frontend Structure** (example - adjust based on Task 1 design):
   ```
   src/
   ├── features/                    # Feature-based organization
   │   ├── connections/             # Connection management feature
   │   │   ├── components/          # Connection-specific components
   │   │   ├── hooks/               # Connection-specific hooks
   │   │   ├── services/            # Connection-specific services
   │   │   └── types/               # Connection-specific types
   │   ├── messages/                # Messaging feature
   │   │   ├── components/
   │   │   ├── hooks/
   │   │   └── services/
   │   ├── profile/                 # Profile management feature
   │   │   ├── components/
   │   │   ├── hooks/
   │   │   └── services/
   │   ├── search/                  # Search feature
   │   │   ├── components/
   │   │   ├── hooks/
   │   │   └── services/
   │   ├── posts/                   # LinkedIn posts feature
   │   │   ├── components/
   │   │   └── services/
   │   └── auth/                    # Authentication feature
   │       ├── components/
   │       ├── services/
   │       └── types/
   │
   ├── shared/                      # Shared/common code
   │   ├── components/              # Shared components
   │   │   └── ui/                  # Radix UI wrappers (keep as-is)
   │   ├── hooks/                   # Shared hooks
   │   ├── services/                # Shared services (base API client, etc.)
   │   ├── types/                   # Shared types
   │   ├── utils/                   # Utility functions
   │   └── constants/               # App-wide constants
   │
   ├── contexts/                    # React contexts (keep at root or move to shared)
   ├── pages/                       # Route pages (keep at root)
   └── App.tsx                      # Main app component
   ```

2. **Create Feature Directories**:
   - Create directory structure for each feature
   - Move feature-specific components to respective feature folders
   - Move feature-specific hooks to respective feature folders
   - Move feature-specific services to respective feature folders

3. **Organize Shared Code**:
   - Create `shared/` directory for truly shared code
   - Move Radix UI components to `shared/components/ui/` (keep existing structure)
   - Move shared hooks to `shared/hooks/`
   - Move utility functions to `shared/utils/`
   - Create `shared/constants/` for app-wide constants

4. **Handle Hybrid Cases**:
   - Some components might be shared across features
   - Start by categorizing by primary feature
   - If truly shared, place in `shared/`
   - Document decision rationale in code comments if needed

5. **Update Barrel Exports (index.ts)**:
   - Create `index.ts` in each feature directory
   - Export public API of each feature
   - This simplifies imports: `import { Component } from '@/features/connections'`

6. **Move Files Incrementally**:
   - Move one feature at a time (e.g., start with connections)
   - Update imports for that feature
   - Run tests to verify nothing broke
   - Commit before moving to next feature

7. **Update Path Aliases**:
   - Update `tsconfig.json` path aliases if needed
   - Consider adding `@/features/*`, `@/shared/*` aliases
   - Update Vite config if path resolution changes

**Verification Checklist**:
- [ ] All feature directories created
- [ ] Components organized by feature
- [ ] Hooks organized by feature
- [ ] Services organized by feature
- [ ] Shared code properly separated
- [ ] Barrel exports created for each feature
- [ ] Path aliases updated if needed
- [ ] All imports updated (no broken imports)
- [ ] All tests still passing
- [ ] Build completes successfully

**Testing Instructions**:
- Run `npm test` after reorganizing each feature
- Run `npm run build` to catch any import errors
- Manually test affected features in the browser

**Commit Message Template**:
```
refactor(frontend): reorganize by feature domain

- Create feature-based directory structure (connections, messages, profile, etc.)
- Move components, hooks, and services to respective feature folders
- Create shared/ directory for common code
- Add barrel exports for cleaner imports
- Update all import paths
- All tests passing, build successful
```

**Estimated Tokens**: ~12,000

---

## Task 3: Reorganize Backend Services and Controllers

**Goal**: Restructure the Puppeteer backend to group services and controllers by domain, creating clearer separation of concerns.

**Files to Modify/Create**:
- Reorganize files in `puppeteer-backend/` based on Task 1 design
- Create domain-based directory structure

**Prerequisites**:
- Task 1 completed (proposed structure designed)

**Implementation Steps**:

1. **Proposed Backend Structure** (example - adjust based on Task 1 design):
   ```
   puppeteer-backend/
   ├── src/
   │   ├── domains/                 # Domain-driven organization
   │   │   ├── linkedin/            # LinkedIn automation domain
   │   │   │   ├── services/        # linkedinService, contactService, interactionService
   │   │   │   ├── controllers/     # linkedinInteractionController
   │   │   │   └── utils/           # LinkedIn-specific utilities
   │   │   ├── profile/             # Profile management domain
   │   │   │   ├── services/        # profileInitService, textExtractionService
   │   │   │   ├── controllers/     # profileInitController
   │   │   │   └── utils/           # Profile-specific utilities
   │   │   ├── storage/             # Storage domain (S3, DynamoDB)
   │   │   │   ├── services/        # s3TextUploadService, dynamoDBService
   │   │   │   └── utils/           # Storage utilities
   │   │   └── automation/          # Browser automation domain
   │   │       ├── services/        # puppeteerService
   │   │       └── utils/           # humanBehaviorManager, interactionQueue, healingManager
   │   │
   │   ├── shared/                  # Shared backend code
   │   │   ├── middleware/          # Express middleware
   │   │   ├── utils/               # General utilities
   │   │   └── config/              # Configuration management
   │   │
   │   ├── routes/                  # Express routes (may organize by domain)
   │   ├── config/                  # App configuration
   │   └── server.js                # Express app entry point
   │
   └── tests/                       # Backend tests (mirror structure)
   ```

2. **Create Domain Directories**:
   - Create `domains/linkedin/`, `domains/profile/`, `domains/storage/`, `domains/automation/`
   - Within each domain, create `services/`, `controllers/`, `utils/` as needed

3. **Migrate LinkedIn Domain**:
   - Move `linkedinService.js`, `linkedinContactService.js`, `linkedinInteractionService.js` to `domains/linkedin/services/`
   - Move `linkedinInteractionController.js` to `domains/linkedin/controllers/`
   - Update imports within these files

4. **Migrate Profile Domain**:
   - Move `profileInitService.js`, `textExtractionService.js` to `domains/profile/services/`
   - Move `profileInitController.js` to `domains/profile/controllers/`
   - Update imports

5. **Migrate Storage Domain**:
   - Move `s3TextUploadService.js`, `dynamoDBService.js` (if exists) to `domains/storage/services/`
   - Move related utilities

6. **Migrate Automation Domain**:
   - Move `puppeteerService.js` to `domains/automation/services/`
   - Move `humanBehaviorManager.js`, `interactionQueue.js`, `healingManager.js` to `domains/automation/utils/`

7. **Organize Shared Code**:
   - Move truly shared utilities to `shared/utils/`
   - Move middleware to `shared/middleware/`
   - Move general config to `shared/config/`

8. **Update Route Imports**:
   - Update route files to import from new locations
   - Consider organizing routes by domain as well
   - Update route registration in `server.js`

9. **Update Test File Locations**:
   - Move test files to mirror new structure
   - Update test imports

**Verification Checklist**:
- [ ] Domain directories created
- [ ] Services grouped by domain
- [ ] Controllers grouped by domain
- [ ] Utilities grouped by domain or shared
- [ ] All imports updated
- [ ] Routes updated and working
- [ ] Tests relocated and updated
- [ ] All tests still passing
- [ ] Server starts without errors

**Testing Instructions**:
- Run `npm test` to verify backend tests pass
- Start the Puppeteer backend server
- Verify API endpoints still work
- Check for any import or module resolution errors

**Commit Message Template**:
```
refactor(backend): reorganize by domain

- Create domain-driven structure (linkedin, profile, storage, automation)
- Group services, controllers, and utils by domain
- Create shared/ directory for common backend code
- Update all import paths and route registrations
- Relocate tests to mirror new structure
- All tests passing, server runs successfully
```

**Estimated Tokens**: ~10,000

---

## Task 4: Standardize Lambda Function Structure

**Goal**: Create a consistent internal structure for all Lambda functions and organize shared Lambda utilities.

**Files to Modify/Create**:
- Reorganize files within each Lambda function directory
- Create shared utilities directory for Lambda functions

**Prerequisites**:
- Task 1 completed (proposed structure designed)

**Implementation Steps**:

1. **Proposed Standard Lambda Structure**:
   ```
   lambda-processing/
   ├── shared/                      # Shared Lambda utilities
   │   ├── python/                  # Shared Python code
   │   │   ├── utils/               # Common utilities
   │   │   ├── models/              # Shared data models
   │   │   └── aws_clients/         # AWS client factories
   │   └── nodejs/                  # Shared Node.js code
   │       └── utils/
   │
   ├── [function-name]/             # Each Lambda function
   │   ├── lambda_function.py       # Main handler (Python)
   │   ├── index.js                 # Main handler (Node.js)
   │   ├── services/                # Business logic services
   │   ├── utils/                   # Function-specific utilities
   │   ├── models/                  # Data models (if needed)
   │   ├── requirements.txt         # Python dependencies
   │   ├── package.json             # Node.js dependencies (if applicable)
   │   └── tests/                   # Lambda function tests
   │       ├── test_lambda_function.py
   │       └── fixtures/
   │
   └── requirements-test.txt        # Shared test dependencies
   ```

2. **Create Shared Lambda Utilities**:
   - Create `lambda-processing/shared/python/` directory
   - Create `lambda-processing/shared/nodejs/` directory
   - Identify code duplicated across Lambda functions
   - Extract to shared utilities

3. **Standardize Each Python Lambda**:
   - For each Python Lambda:
     - Keep `lambda_function.py` as entry point
     - Create `services/` directory if business logic is complex
     - Create `utils/` for function-specific helpers
     - Move tests to `tests/` subdirectory within function
     - Update imports to use relative paths

4. **Standardize Node.js Lambda**:
   - For `placeholder-search-prod`:
     - Keep `index.js` as entry point
     - Create subdirectories if function grows
     - Follow same pattern as Python Lambdas

5. **Extract Common Code**:
   - **Response builders**: Common response formatting logic
   - **DynamoDB helpers**: Common query/scan patterns
   - **S3 helpers**: Common upload/download patterns
   - **Error handlers**: Common error handling and logging

6. **Update Lambda Imports**:
   - Update imports to use shared utilities
   - Update relative imports after restructuring
   - Ensure Lambda deployment packages include shared code

7. **Update Deployment Configuration**:
   - Update SAM template if structure changes affect deployment
   - Ensure shared utilities are included in Lambda packages
   - Test Lambda packaging (dry run deployment)

**Verification Checklist**:
- [ ] Shared Lambda utilities directory created
- [ ] Common code extracted to shared utilities
- [ ] All Lambda functions follow consistent structure
- [ ] Subdirectories created for services and utils where needed
- [ ] Tests relocated to function-specific test directories
- [ ] All imports updated
- [ ] Python Lambda tests still passing (pytest)
- [ ] Node.js Lambda tests still passing
- [ ] Lambda packaging includes shared utilities (verify dry run)

**Testing Instructions**:
- Run `cd lambda-processing && pytest` to verify Python tests pass
- Run Lambda-specific tests individually
- Test Lambda packaging with SAM build (if applicable)

**Commit Message Template**:
```
refactor(lambda): standardize function structure

- Create shared utilities directory for Lambda functions
- Extract common code to shared/python and shared/nodejs
- Standardize internal structure for all Lambda functions
- Relocate tests to function-specific directories
- Update all imports and deployment configuration
- All tests passing, packaging verified
```

**Estimated Tokens**: ~9,000

---

## Task 5: Consolidate Configuration and Constants

**Goal**: Centralize configuration management and constants across all layers, reducing duplication and improving maintainability.

**Files to Modify/Create**:
- `src/config/` - Frontend configuration
- `src/constants/` - Frontend constants
- `puppeteer-backend/src/config/` - Backend configuration
- `puppeteer-backend/src/constants/` - Backend constants
- `lambda-processing/shared/config/` - Lambda configuration

**Prerequisites**:
- Tasks 2-4 completed (reorganization done)

**Implementation Steps**:

1. **Audit Configuration Files**:
   - Identify all config files across frontend, backend, and Lambda
   - Identify hardcoded configuration values in code
   - Identify constants scattered throughout codebase
   - Map environment variables used

2. **Create Configuration Structure**:

   **Frontend**:
   ```
   src/config/
   ├── index.ts                     # Main config export
   ├── api.ts                       # API endpoints and configuration
   ├── aws.ts                       # AWS configuration (Cognito, etc.)
   └── app.ts                       # App-level configuration

   src/constants/
   ├── index.ts                     # Barrel export
   ├── routes.ts                    # Route paths
   ├── messages.ts                  # UI messages/strings
   └── linkedin.ts                  # LinkedIn-specific constants
   ```

   **Backend**:
   ```
   puppeteer-backend/src/config/
   ├── index.js                     # Main config export
   ├── server.js                    # Server configuration
   ├── aws.js                       # AWS SDK configuration
   ├── linkedin.js                  # LinkedIn automation config
   └── puppeteer.js                 # Puppeteer browser config

   puppeteer-backend/src/constants/
   ├── index.js                     # Barrel export
   ├── selectors.js                 # LinkedIn selectors
   ├── messages.js                  # Error/success messages
   └── limits.js                    # Rate limits, timeouts
   ```

   **Lambda**:
   ```
   lambda-processing/shared/config/
   ├── aws_config.py                # AWS resource names (tables, buckets)
   ├── constants.py                 # Lambda constants
   ```

3. **Consolidate Frontend Config**:
   - Move scattered config to `src/config/`
   - Extract hardcoded API URLs to config
   - Extract AWS configuration to config
   - Create constants for magic strings and numbers
   - Update all imports to use centralized config

4. **Consolidate Backend Config**:
   - Move scattered config to `puppeteer-backend/src/config/`
   - Extract LinkedIn selectors to constants (if not already)
   - Extract timeouts, delays, and limits to constants
   - Create config for all AWS resources
   - Update all imports

5. **Consolidate Lambda Config**:
   - Create shared config for DynamoDB table names
   - Create shared config for S3 bucket names
   - Extract common constants (error messages, status codes)
   - Update Lambda functions to use shared config

6. **Environment Variable Management**:
   - Document all required environment variables
   - Update `.env.example` with all variables
   - Create environment-specific config (dev, prod)
   - Add validation for required environment variables

7. **Remove Magic Numbers and Strings**:
   - Replace hardcoded values with named constants
   - Example: `if (status === 200)` → `if (status === HTTP_STATUS.OK)`
   - Example: `setTimeout(5000)` → `setTimeout(DELAYS.LINKEDIN_ACTION)`

**Verification Checklist**:
- [ ] Configuration directories created for all layers
- [ ] All config consolidated to centralized locations
- [ ] Constants extracted from code
- [ ] Magic numbers and strings replaced with named constants
- [ ] Environment variables documented
- [ ] All imports updated to use new config structure
- [ ] All tests still passing
- [ ] Application runs with centralized config

**Testing Instructions**:
- Run `npm test` to verify config changes don't break tests
- Start frontend and backend to verify config loads correctly
- Test with different environment configurations

**Commit Message Template**:
```
refactor: consolidate configuration and constants

- Create centralized config directories for frontend, backend, and Lambda
- Extract hardcoded values to named constants
- Consolidate environment variable management
- Document all configuration options
- Replace magic numbers/strings with named constants
- All tests passing, applications run successfully
```

**Estimated Tokens**: ~9,000

---

## Task 6: Update All Imports and Verify

**Goal**: Ensure all import paths are correct after reorganization, leverage new structure for cleaner imports, and verify entire application works.

**Files to Modify/Create**:
- Update imports across all files that were affected by reorganization

**Prerequisites**:
- Tasks 2-5 completed (all reorganization done)

**Implementation Steps**:

1. **Automated Import Updates**:
   - Use IDE's refactoring tools to update imports (if available)
   - Use find-and-replace for common patterns
   - TypeScript compiler will identify broken imports

2. **Update TypeScript Path Aliases**:
   - Review and update `tsconfig.json` path mappings:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./src/*"],
         "@/features/*": ["./src/features/*"],
         "@/shared/*": ["./src/shared/*"],
         "@/config/*": ["./src/config/*"],
         "@/constants/*": ["./src/constants/*"]
       }
     }
   }
   ```

3. **Leverage Barrel Exports**:
   - Update imports to use barrel exports where created
   - Example: `import { ConnectionList } from '@/features/connections'` instead of `import { ConnectionList } from '@/features/connections/components/ConnectionList'`

4. **Standardize Import Order**:
   - Follow Phase 0 import organization conventions
   - External libraries first
   - Internal modules second (using aliases)
   - Types third
   - Styles last

5. **Fix Backend Imports**:
   - Update all backend imports to reflect domain structure
   - Ensure relative imports are correct after moving files
   - Use absolute imports where appropriate (if path aliases configured)

6. **Fix Lambda Imports**:
   - Update Lambda function imports to use shared utilities
   - Fix relative imports within Lambda functions
   - Ensure shared code is properly imported

7. **Run Type Checking**:
   - Run `tsc --noEmit` to catch all import errors
   - Fix any type resolution issues
   - Ensure no circular dependencies introduced

8. **Test Import Resolution**:
   - Run `npm run build` to verify all imports resolve
   - Check for any module resolution warnings
   - Verify tree-shaking still works (check bundle size)

**Verification Checklist**:
- [ ] All imports updated across frontend
- [ ] All imports updated across backend
- [ ] All imports updated across Lambda functions
- [ ] TypeScript path aliases configured correctly
- [ ] Barrel exports used where appropriate
- [ ] Import order follows conventions
- [ ] TypeScript compilation succeeds (`tsc --noEmit`)
- [ ] Build succeeds (`npm run build`)
- [ ] All tests passing
- [ ] No circular dependency warnings
- [ ] Bundle size not significantly increased

**Testing Instructions**:
- Run `tsc --noEmit` to check for type errors
- Run `npm test` to verify all tests pass
- Run `npm run build` to verify build succeeds
- Start the application and manually test core features
- Check browser console for any module loading errors

**Commit Message Template**:
```
refactor: update all imports after restructuring

- Update TypeScript path aliases for new structure
- Leverage barrel exports for cleaner imports
- Standardize import order across all files
- Fix all import paths in frontend, backend, and Lambda
- Verify type checking and build succeed
- All tests passing, application functional
```

**Estimated Tokens**: ~8,000

---

## Phase Verification

After completing all 6 tasks, verify the entire phase:

### Verification Steps

1. **Run Full Test Suite**:
   ```bash
   npm test
   cd lambda-processing && pytest
   ```
   - All tests must pass

2. **Run Type Checking**:
   ```bash
   tsc --noEmit
   ```
   - No type errors

3. **Run Build**:
   ```bash
   npm run build
   ```
   - Build succeeds with no errors or warnings
   - Bundle size is reasonable (not significantly larger)

4. **Run Linter**:
   ```bash
   npm run lint
   ```
   - No linting errors related to imports or structure

5. **Manual Application Testing**:
   - Start frontend and backend
   - Test core user workflows
   - Verify no runtime errors
   - Check browser console for errors

6. **Review Structure**:
   - Browse through directories
   - Verify organization makes sense
   - Check that related files are grouped together
   - Ensure separation of concerns is clear

### Success Criteria

✅ **Consistent directory structure** across all layers
✅ **Logical file grouping** by feature or domain
✅ **Clear separation of concerns** (UI, business logic, data access)
✅ **All imports updated** and resolving correctly
✅ **All tests passing** (100% pass rate)
✅ **Build succeeds** with no warnings
✅ **Application runs** without errors
✅ **Improved developer experience** (easier to navigate codebase)

### Metrics to Track

**Before Phase 3**:
- Directory depth: [Average depth]
- Files per directory: [Average]
- Unorganized/misc files: [Count]

**After Phase 3**:
- Directory depth: [Should be reasonable, 3-5 levels]
- Files per directory: [Should be 5-15 per directory]
- Clear organization: All files in logical locations

### Developer Experience Improvements

- ✅ Easier to find files (feature-based or domain-based)
- ✅ Clear where new code should go
- ✅ Related files grouped together
- ✅ Reduced cognitive load when navigating codebase
- ✅ Better IDE autocomplete with path aliases

### Next Steps

Once this phase is complete and verified, proceed to [Phase 4: Duplication, Patterns & Naming](./Phase-4.md).

---

**Estimated Total Tokens**: ~45,000
