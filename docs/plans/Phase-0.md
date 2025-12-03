# Phase 0: Foundation

## Phase Goal

Establish the testing infrastructure, mocking patterns, and shared utilities required for all subsequent test phases. This phase creates the scaffolding that enables consistent, maintainable tests across the frontend codebase.

**Success Criteria:**
- Centralized test directory structure created at `frontend/__tests__/`
- Vitest configuration updated for coverage reporting and centralized tests
- Mock modules created for all external dependencies (Cognito, API services, localStorage)
- Test utilities and render helpers established
- CI pipeline updated to run frontend tests (non-blocking)
- A smoke test passes to validate the infrastructure

**Estimated Tokens:** ~25,000

## Prerequisites

- Node.js v24 installed
- Frontend dependencies installed (`npm install` in `frontend/`)
- Understanding of Vitest configuration and React Testing Library

---

## Architecture Decisions

### ADR-001: Centralized Test Directory

**Decision:** All frontend tests will live in `frontend/__tests__/` rather than co-located with source files.

**Rationale:**
- Matches user preference for centralized test organization
- Mirrors the puppeteer project's established pattern
- Easier to manage test utilities, mocks, and setup files in one location
- Clear separation between production code and test code

**Structure:**
```
frontend/__tests__/
├── setup.ts                    # Global test setup
├── utils/                      # Test utilities and helpers
│   ├── renderWithProviders.tsx # Custom render with all providers
│   └── mockFactories.ts        # Factory functions for test data
├── mocks/                      # Manual mock modules
│   ├── cognitoService.ts       # Mock Cognito authentication
│   ├── apiServices.ts          # Mock API services
│   ├── localStorage.ts         # Mock localStorage/sessionStorage
│   └── router.ts               # Mock react-router
├── features/                   # Feature module tests
│   ├── auth/
│   ├── search/
│   ├── connections/
│   ├── messages/
│   ├── posts/
│   ├── profile/
│   └── workflow/
└── shared/                     # Shared utilities tests
    ├── hooks/
    └── utils/
```

### ADR-002: Manual Mocking Strategy

**Decision:** Use manual module mocks via `vi.mock()` rather than MSW (Mock Service Worker).

**Rationale:**
- Simpler setup with less infrastructure overhead
- Faster test execution (no network layer)
- Consistent with puppeteer test patterns already in the codebase
- Sufficient for unit and integration testing at the component level
- Easier for engineers unfamiliar with MSW

**Pattern:**
```typescript
// Mocks are hoisted - define before imports
vi.mock('@/features/auth/services/cognitoService', () => ({
  CognitoAuthService: {
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    getCurrentUser: vi.fn(),
    getCurrentUserToken: vi.fn(),
  }
}));
```

### ADR-003: Testing Library Best Practices

**Decision:** Follow React Testing Library philosophy - test behavior, not implementation.

**Guidelines:**
- Query by accessible roles, labels, and text (not test IDs unless necessary)
- Simulate user interactions with `userEvent` over `fireEvent`
- Assert on visible outcomes, not internal state
- Avoid testing implementation details (internal state, private methods)

### ADR-004: Coverage Reporting Without Thresholds

**Decision:** Generate coverage reports but do not enforce thresholds in CI.

**Rationale:**
- Allows gradual coverage improvement without blocking merges
- Coverage reports provide visibility for manual review
- Avoids artificial pressure to write low-value tests just to hit numbers
- Can add thresholds later once baseline is established

---

## Testing Strategy Overview

### Test Categories

1. **Unit Tests** - Isolated component/hook tests with all dependencies mocked
   - Use for: Simple components, utility functions, hooks
   - Mocking: All external dependencies mocked
   - Speed: Fast (<100ms per test)

2. **Integration Tests** - Multi-component flows with minimal mocking
   - Use for: Complex user flows (login, search submission)
   - Mocking: Only external services (API, Cognito), not internal components
   - Speed: Medium (<500ms per test)

### Mocking Boundaries

**Always Mock:**
- `CognitoAuthService` - External AWS service
- `puppeteerApiService` - Backend API calls
- `lambdaApiService` - Backend API calls
- `localStorage` / `sessionStorage` - Browser APIs
- `window.location` - Navigation

**Never Mock:**
- React Router components (use `MemoryRouter` instead)
- Radix UI primitives (test actual rendering)
- Internal React state and hooks

### Test File Naming

- Unit tests: `ComponentName.test.tsx` or `hookName.test.ts`
- Integration tests: `featureName.integration.test.tsx`

---

## Tasks

### Task 1: Create Test Directory Structure

**Goal:** Establish the centralized test directory with proper folder hierarchy.

**Files to Create:**
- `frontend/__tests__/` - Root test directory
- `frontend/__tests__/utils/` - Test utilities
- `frontend/__tests__/mocks/` - Mock modules
- `frontend/__tests__/features/auth/` - Auth feature tests
- `frontend/__tests__/features/search/` - Search feature tests
- `frontend/__tests__/features/connections/` - Connections feature tests
- `frontend/__tests__/features/messages/` - Messages feature tests
- `frontend/__tests__/features/posts/` - Posts feature tests
- `frontend/__tests__/features/profile/` - Profile feature tests
- `frontend/__tests__/features/workflow/` - Workflow feature tests
- `frontend/__tests__/shared/hooks/` - Shared hooks tests
- `frontend/__tests__/shared/utils/` - Shared utils tests

**Implementation Steps:**
- Create all directories under `frontend/__tests__/`
- Add a `.gitkeep` file to empty directories to ensure they're tracked
- Verify the structure matches the source code organization

**Verification Checklist:**
- [ ] All directories exist under `frontend/__tests__/`
- [ ] Directory structure mirrors `frontend/src/` feature modules
- [ ] Git tracks the new directories

**Commit Message Template:**
```
Author & Commiter : HatmanStack
Email : 82614182+HatmanStack@users.noreply.github.com

chore(frontend): create centralized test directory structure

Add __tests__ directory with feature-based organization
Create placeholder directories for all feature modules
```

---

### Task 2: Update Vitest Configuration

**Goal:** Configure Vitest to find tests in the centralized directory and generate coverage reports.

**Files to Modify:**
- `frontend/vite.config.ts` - Update test configuration

**Prerequisites:**
- Task 1 complete (directory structure exists)

**Implementation Steps:**
- Modify the `test` configuration in `vite.config.ts`
- Change `include` pattern to find tests in `__tests__/` directory
- Add coverage configuration with v8 provider
- Configure reporters for text and HTML output
- Add setup file reference for global test configuration
- Ensure path aliases work in test files

**Key Configuration Points:**
- Include pattern: `__tests__/**/*.test.{ts,tsx}`
- Coverage provider: v8 (already in devDependencies)
- Coverage reporters: text (console), HTML (visual), lcov (CI integration)
- Coverage exclude: node_modules, test files, config files
- Setup files: `__tests__/setup.ts`

**Verification Checklist:**
- [ ] `npm test` command runs without configuration errors
- [ ] Coverage report generates to `frontend/coverage/` directory
- [ ] Path alias `@/` resolves correctly in test files
- [ ] jsdom environment is active for React component tests

**Commit Message Template:**
```
Author & Commiter : HatmanStack
Email : 82614182+HatmanStack@users.noreply.github.com

feat(frontend): configure vitest for centralized tests and coverage

Update include pattern for __tests__ directory
Add coverage reporting with v8 provider
Configure setup file for global test utilities
```

---

### Task 3: Create Global Test Setup

**Goal:** Establish global test setup with Testing Library matchers and common configuration.

**Files to Create:**
- `frontend/__tests__/setup.ts` - Global setup file

**Prerequisites:**
- Task 2 complete (Vitest configuration updated)

**Implementation Steps:**
- Import and extend Vitest with jest-dom matchers
- Configure global mocks for browser APIs (localStorage, sessionStorage, matchMedia)
- Set up cleanup after each test
- Add any global test utilities or polyfills needed

**Setup File Requirements:**
- Import `@testing-library/jest-dom` for DOM matchers
- Mock `window.matchMedia` (required by some Radix UI components)
- Mock `localStorage` and `sessionStorage` with functional implementations
- Mock `ResizeObserver` (required by some UI components)
- Configure any global `beforeEach` / `afterEach` hooks

**Verification Checklist:**
- [ ] jest-dom matchers available (e.g., `toBeInTheDocument()`)
- [ ] localStorage mock works in tests
- [ ] No console errors about missing browser APIs
- [ ] Tests properly clean up after each run

**Commit Message Template:**
```
Author & Commiter : HatmanStack
Email : 82614182+HatmanStack@users.noreply.github.com

feat(frontend): add global test setup with jest-dom matchers

Configure Testing Library jest-dom extension
Add browser API mocks (localStorage, matchMedia, ResizeObserver)
Set up automatic test cleanup
```

---

### Task 4: Create Mock Modules

**Goal:** Create reusable mock modules for all external dependencies.

**Files to Create:**
- `frontend/__tests__/mocks/cognitoService.ts` - Mock Cognito authentication service
- `frontend/__tests__/mocks/apiServices.ts` - Mock puppeteer and lambda API services
- `frontend/__tests__/mocks/appConfig.ts` - Mock app configuration
- `frontend/__tests__/mocks/index.ts` - Export all mocks

**Prerequisites:**
- Task 3 complete (setup file exists)

**Implementation Steps:**
- Study the actual service interfaces in the source code
- Create mock implementations that match the real API signatures
- Use `vi.fn()` for all mock functions to enable assertion/configuration
- Provide sensible default return values
- Export both the mock module and helper functions to configure mocks per test

**Mock Design Pattern:**
```typescript
// Example structure for cognitoService mock
export const mockCognitoService = {
  signIn: vi.fn().mockResolvedValue({ error: null, user: mockUser }),
  signUp: vi.fn().mockResolvedValue({ error: null }),
  signOut: vi.fn().mockResolvedValue(undefined),
  getCurrentUser: vi.fn().mockResolvedValue(null),
  getCurrentUserToken: vi.fn().mockResolvedValue('mock-token'),
  confirmSignUp: vi.fn().mockResolvedValue({ error: null }),
  resendConfirmationCode: vi.fn().mockResolvedValue({ error: null }),
  forgotPassword: vi.fn().mockResolvedValue({ error: null }),
  confirmPassword: vi.fn().mockResolvedValue({ error: null }),
};

// Helper to reset all mocks
export const resetCognitoMocks = () => {
  Object.values(mockCognitoService).forEach(mock => mock.mockReset());
};
```

**Services to Mock:**
1. `CognitoAuthService` - All static methods
2. `puppeteerApiService` - `performLinkedInSearch` and other methods
3. `lambdaApiService` - Backend Lambda calls
4. `appConfig` - `isCognitoConfigured`, `cognitoConfig`, `STORAGE_KEYS`

**Verification Checklist:**
- [ ] All mock functions match real service signatures
- [ ] Mocks can be imported and configured in test files
- [ ] Default mock values are sensible for happy-path tests
- [ ] Reset helpers clear all mock state

**Commit Message Template:**
```
Author & Commiter : HatmanStack
Email : 82614182+HatmanStack@users.noreply.github.com

feat(frontend): create mock modules for external dependencies

Add CognitoAuthService mock with all authentication methods
Add API service mocks for puppeteer and lambda services
Add app config mock for feature flags and constants
Include reset helpers for test isolation
```

---

### Task 5: Create Test Render Utilities

**Goal:** Create a custom render function that wraps components with all required providers.

**Files to Create:**
- `frontend/__tests__/utils/renderWithProviders.tsx` - Custom render with providers
- `frontend/__tests__/utils/mockFactories.ts` - Factory functions for test data
- `frontend/__tests__/utils/index.ts` - Export all utilities

**Prerequisites:**
- Task 4 complete (mocks exist)

**Implementation Steps:**
- Create a custom render function that wraps Testing Library's render
- Include all context providers (AuthProvider, QueryClientProvider, Router)
- Allow overriding provider props for specific test scenarios
- Create factory functions for common test data (users, search results, connections)

**Provider Wrapper Requirements:**
- `MemoryRouter` from react-router-dom with configurable initial entries
- `QueryClientProvider` with a fresh QueryClient per test
- `AuthProvider` (may need to mock or provide test version)
- Any other context providers used in the app

**Factory Function Examples:**
- `createMockUser()` - Returns a valid User object
- `createMockConnection()` - Returns a connection record
- `createMockSearchResult()` - Returns search result data

**Verification Checklist:**
- [ ] `renderWithProviders` correctly wraps components
- [ ] Router context available in rendered components
- [ ] React Query context available
- [ ] Factory functions produce valid typed objects
- [ ] Providers can be configured per-test

**Commit Message Template:**
```
Author & Commiter : HatmanStack
Email : 82614182+HatmanStack@users.noreply.github.com

feat(frontend): add test render utilities and mock factories

Create renderWithProviders with Router and QueryClient
Add mock factory functions for User, Connection, SearchResult
Export utilities from central index file
```

---

### Task 6: Create Smoke Test

**Goal:** Validate the test infrastructure with a simple passing test.

**Files to Create:**
- `frontend/__tests__/smoke.test.ts` - Basic infrastructure validation test

**Prerequisites:**
- Tasks 1-5 complete (all infrastructure in place)

**Implementation Steps:**
- Create a smoke test file that imports test utilities
- Write simple tests that verify:
  - Vitest runs and finds the test file
  - jest-dom matchers work
  - Mocks can be imported and used
  - renderWithProviders works with a simple component
- This test serves as documentation for how to write tests

**Test Cases to Include:**
1. Basic assertion (`expect(true).toBe(true)`)
2. jest-dom matcher (`expect(element).toBeInTheDocument()`)
3. Mock import and configuration
4. Simple component render with providers

**Verification Checklist:**
- [ ] `npm test` passes with the smoke test
- [ ] Coverage report includes the smoke test
- [ ] No console errors or warnings during test run
- [ ] Test output shows clear pass/fail status

**Testing Instructions:**
- Run `npm test` in frontend directory
- Verify all smoke tests pass
- Run `npm test -- --coverage` to verify coverage reporting

**Commit Message Template:**
```
Author & Commiter : HatmanStack
Email : 82614182+HatmanStack@users.noreply.github.com

test(frontend): add smoke test to validate test infrastructure

Verify Vitest configuration and test discovery
Confirm jest-dom matchers work correctly
Validate mock imports and render utilities
```

---

### Task 7: Update CI Pipeline

**Goal:** Add frontend test execution to CI as a non-blocking step.

**Files to Modify:**
- `.github/workflows/ci.yml` - Add test step to frontend job

**Prerequisites:**
- Task 6 complete (smoke test passes locally)

**Implementation Steps:**
- Add a test step to the frontend job in ci.yml
- Run tests with coverage reporting
- Configure the step to continue on error (non-blocking)
- Upload coverage report as artifact for visibility

**CI Configuration Requirements:**
- Test command: `npm test -- --coverage`
- Continue on error: `continue-on-error: true`
- Upload coverage artifact for PR review
- Position test step after lint and type check

**Verification Checklist:**
- [ ] CI workflow includes frontend test step
- [ ] Test step runs after lint and type check
- [ ] Test failures do not block the pipeline (continue-on-error)
- [ ] Coverage artifact uploaded successfully
- [ ] status-check job still aggregates frontend job result

**Testing Instructions:**
- Push changes to trigger CI
- Verify frontend job includes test step
- Confirm pipeline passes even if tests have failures
- Check that coverage artifact is available

**Commit Message Template:**
```
Author & Commiter : HatmanStack
Email : 82614182+HatmanStack@users.noreply.github.com

ci(frontend): add non-blocking test step with coverage

Add npm test to frontend CI job
Configure continue-on-error for non-blocking execution
Upload coverage report as artifact
```

---

### Task 8: Add Test Scripts to package.json

**Goal:** Add convenient npm scripts for running tests with various options.

**Files to Modify:**
- `frontend/package.json` - Add/update test scripts

**Prerequisites:**
- Task 2 complete (Vitest configured)

**Implementation Steps:**
- Ensure existing test scripts work with new configuration
- Add coverage script if not present
- Add script for running specific test directories

**Scripts to Add/Verify:**
- `test` - Run all tests once
- `test:watch` - Run tests in watch mode
- `test:coverage` - Run tests with coverage report
- `test:ui` - Run Vitest UI (already exists)

**Verification Checklist:**
- [ ] `npm test` runs all tests
- [ ] `npm run test:watch` starts watch mode
- [ ] `npm run test:coverage` generates coverage report
- [ ] `npm run test:ui` opens Vitest UI

**Commit Message Template:**
```
Author & Commiter : HatmanStack
Email : 82614182+HatmanStack@users.noreply.github.com

chore(frontend): add test coverage script

Add test:coverage script for coverage reporting
Verify existing test scripts work with updated config
```

---

## Phase Verification

**Overall Phase 0 Completion Criteria:**

1. **Directory Structure**
   - `frontend/__tests__/` exists with all subdirectories
   - Structure mirrors feature organization

2. **Configuration**
   - Vitest finds and runs tests from `__tests__/`
   - Coverage reports generate correctly
   - Path aliases resolve in test files

3. **Mocks**
   - All external service mocks exist and are importable
   - Mocks have correct type signatures
   - Reset helpers work

4. **Utilities**
   - `renderWithProviders` wraps components correctly
   - Factory functions produce valid test data

5. **CI Integration**
   - Frontend tests run in CI
   - Tests are non-blocking
   - Coverage artifact uploads

6. **Smoke Test**
   - `npm test` passes
   - `npm run test:coverage` shows coverage output

**Integration Points:**
- Vitest config integrates with Vite build
- CI test step integrates with existing frontend job
- Mock modules integrate with source code imports

**Known Limitations:**
- Coverage will be very low until feature tests are added (Phase 1 & 2)
- Some complex components may need additional provider setup
- Radix UI components may require additional mocking for certain features
