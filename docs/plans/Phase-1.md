# Phase 1: Comprehensive Test Suite

## Phase Goal

Write a comprehensive unit test suite covering the entire codebase: React frontend, Puppeteer backend, and all AWS Lambda functions. This test suite will provide a safety net for all subsequent refactoring phases, ensuring that functional behavior is preserved throughout code quality improvements.

**Success Criteria**:
- 60-70% overall code coverage across all layers
- 80-90% coverage for business-critical code (LinkedIn automation, Lambda APIs)
- All tests pass with zero failures
- Test suite completes in under 60 seconds for JS/TS tests
- All external dependencies properly mocked (no real API calls)

**Estimated Tokens**: ~100,000

## Prerequisites

- Phase 0 read and understood
- Node.js v18+ installed
- Python 3.13+ installed
- All dependencies installed via `npm install`
- ESLint and TypeScript configured (already present)

## Overview

This phase is organized into 9 tasks, grouped by layer:

1. **Test Infrastructure Setup** - Configure test frameworks and shared utilities
2. **Frontend Services Tests** - Test API clients and business logic services
3. **Frontend Hooks Tests** - Test custom React hooks
4. **Frontend Component Tests** - Test React UI components (tiered approach)
5. **Backend Service Tests** - Test Puppeteer automation and core services
6. **Backend Controller Tests** - Test Express API endpoints
7. **Backend Utility Tests** - Test helper functions and utilities
8. **Lambda Python Tests** - Test all Python Lambda functions
9. **Lambda Node.js Tests** - Test Node.js Lambda function

Each task includes specific guidance on test patterns, mocking strategies, and verification criteria.

---

## Task 1: Test Infrastructure Setup

**Goal**: Configure test frameworks, create shared test utilities, and establish test data fixtures for use across all test suites.

**Files to Modify/Create**:
- `tests/setup.ts` - Vitest global setup for frontend/backend
- `tests/setupTests.ts` - Testing Library configuration
- `tests/fixtures/mockProfiles.json` - Sample LinkedIn profile data
- `tests/fixtures/mockDynamoDBResponses.json` - Sample DynamoDB API responses
- `tests/fixtures/mockS3Responses.json` - Sample S3 responses
- `tests/utils/testHelpers.ts` - Shared test utilities (wrappers, builders)
- `tests/utils/mockFactories.ts` - Factory functions for test data generation
- `lambda-processing/requirements-test.txt` - Python test dependencies
- `lambda-processing/pytest.ini` - pytest configuration
- `lambda-processing/conftest.py` - pytest fixtures and setup

**Prerequisites**:
- None (this is the first task)

**Implementation Steps**:

1. **Configure Vitest for Frontend/Backend**:
   - Update `vite.config.ts` to include test configuration
   - Configure jsdom environment for React component testing
   - Set up coverage reporting with appropriate thresholds
   - Configure global mocks for browser APIs (localStorage, sessionStorage)

2. **Create Testing Library Setup**:
   - Configure @testing-library/react with custom render function
   - Set up query extensions for common patterns
   - Configure cleanup after each test
   - Add jest-dom matchers for improved assertions

3. **Create Test Fixtures**:
   - Generate realistic mock LinkedIn profile data (10-15 samples)
   - Create mock DynamoDB responses matching your table schema
   - Create mock S3 responses for profile text uploads
   - Ensure fixture data covers edge cases (empty profiles, long text, special characters)

4. **Build Shared Test Utilities**:
   - Create custom render wrapper with common providers (React Query, Router, Auth context)
   - Build mock factory functions for creating test data programmatically
   - Create helper functions for common assertions
   - Add utilities for async testing (waitFor helpers, promise utilities)

5. **Configure Python Testing**:
   - Create `requirements-test.txt` with pytest, moto, pytest-cov, responses
   - Configure pytest.ini with test discovery patterns and coverage settings
   - Create conftest.py with fixtures for AWS service mocks (DynamoDB, S3, Cognito)
   - Set up moto decorators for AWS service mocking

**Verification Checklist**:
- [ ] Running `npm test` executes Vitest successfully (even with no tests yet)
- [ ] Running `pytest` in lambda-processing directory works (even with no tests)
- [ ] Coverage reporting is configured and displays in console
- [ ] Test fixtures are valid JSON and load without errors
- [ ] Custom render wrapper works with a simple test component
- [ ] AWS mocks (moto) can be imported and initialized

**Testing Instructions**:
- Create a simple sanity test in `tests/sanity.test.ts` that imports fixtures and uses test helpers
- Verify it passes with `npm test`
- Create a simple Python test in `lambda-processing/test_sanity.py` that uses moto
- Verify it passes with `pytest`

**Commit Message Template**:
```
test(infrastructure): set up comprehensive test framework

- Configure Vitest for frontend and backend testing
- Set up pytest with moto for Lambda testing
- Create shared test fixtures and utilities
- Add custom Testing Library render wrapper
- Configure coverage reporting
```

**Estimated Tokens**: ~8,000

---

## Task 2: Frontend Services Tests

**Goal**: Write unit tests for all frontend service modules that handle API communication and business logic.

**Files to Modify/Create**:
- `tests/frontend/services/puppeteerApiService.test.ts`
- `tests/frontend/services/cognitoService.test.ts`
- `tests/frontend/services/healAndRestoreService.test.ts`
- `tests/frontend/services/messageGenerationService.test.ts`
- `tests/frontend/services/workflowProgressService.test.ts`
- `tests/frontend/services/lambdaApiService.test.ts`
- `tests/frontend/services/connectionDataContextService.test.ts`
- `tests/frontend/services/postsService.test.ts`

**Prerequisites**:
- Task 1 completed (test infrastructure ready)

**Implementation Steps**:

1. **Mock External Dependencies**:
   - Mock axios for HTTP requests using `vi.mock('axios')`
   - Create mock responses for each API endpoint
   - Consider using axios-mock-adapter for more complex scenarios
   - Mock AWS SDK clients (Cognito) where applicable

2. **Test Service Methods**:
   - Test each public method in isolation
   - Cover success paths (happy path testing)
   - Cover error paths (network errors, API errors, validation errors)
   - Test edge cases (empty responses, malformed data, null values)

3. **Focus on Business Logic**:
   - **High Priority (80%+ coverage)**: lambdaApiService, messageGenerationService, cognitoService
   - **Medium Priority (60-70% coverage)**: puppeteerApiService, workflowProgressService, healAndRestoreService
   - **Basic Priority (40-50% coverage)**: connectionDataContextService, postsService

4. **Test Patterns to Use**:
   - Arrange-Act-Assert pattern for all tests
   - Use describe blocks to group tests by method
   - Use it/test blocks with descriptive names
   - Mock timers for any debouncing or throttling logic

5. **Specific Service Considerations**:
   - **cognitoService**: Mock AWS Cognito SDK, test authentication flows
   - **lambdaApiService**: Test request construction, response parsing, error handling
   - **messageGenerationService**: Test message template logic and personalization
   - **healAndRestoreService**: Test checkpoint save/load logic

**Verification Checklist**:
- [ ] All service files have corresponding test files
- [ ] No real HTTP requests are made (all mocked)
- [ ] Tests cover both success and error scenarios
- [ ] Coverage meets tiered targets (see Focus on Business Logic)
- [ ] All tests pass independently (no shared state)
- [ ] Tests run in under 5 seconds

**Testing Instructions**:
- Run `npm test -- services` to run only service tests
- Verify coverage report shows appropriate coverage per file
- Run tests in watch mode during development
- Ensure no console errors or warnings

**Commit Message Template**:
```
test(frontend): add comprehensive service layer tests

- Add tests for all 8 frontend service modules
- Mock axios and AWS SDK for external dependencies
- Cover success paths, error handling, and edge cases
- Achieve 60-80% coverage based on service criticality
```

**Estimated Tokens**: ~12,000

---

## Task 3: Frontend Hooks Tests

**Goal**: Write unit tests for all custom React hooks using @testing-library/react-hooks patterns.

**Files to Modify/Create**:
- `tests/frontend/hooks/useWorkflowProgress.test.ts`
- `tests/frontend/hooks/useSearchResults.test.ts`
- `tests/frontend/hooks/useProgressTracker.test.ts`
- `tests/frontend/hooks/useErrorHandler.test.ts`
- `tests/frontend/hooks/useAuth.test.ts` (if exists)
- `tests/frontend/hooks/useConnections.test.ts` (if exists)
- Additional tests for any other custom hooks (~12 total)

**Prerequisites**:
- Task 1 completed (test infrastructure ready)
- Task 2 completed (service tests can inform hook test patterns)

**Implementation Steps**:

1. **Use renderHook Pattern**:
   - Import `renderHook` from @testing-library/react
   - Wrap hooks that depend on context with appropriate providers
   - Use the custom render wrapper created in Task 1

2. **Test Hook Behavior**:
   - Test initial state values
   - Test state updates after actions
   - Test side effects (useEffect behavior)
   - Test cleanup functions
   - Test dependencies and re-renders

3. **Mock Dependencies**:
   - Mock service calls used within hooks
   - Mock React Query when hooks use useQuery/useMutation
   - Mock router hooks (useNavigate, useParams) when used

4. **Test Patterns for Hooks**:
   - Test hooks that manage state (useState, useReducer)
   - Test hooks with side effects (useEffect, useLayoutEffect)
   - Test hooks that call APIs (integration with React Query)
   - Test custom hooks that compose other hooks

5. **Coverage Priority**:
   - **High Priority (70-80%)**: useAuth, useSearchResults, useWorkflowProgress
   - **Medium Priority (60-70%)**: useProgressTracker, useErrorHandler, useConnections
   - **Basic Priority (50%)**: Simple wrapper hooks or very straightforward hooks

**Verification Checklist**:
- [ ] All custom hooks have test files
- [ ] Tests use renderHook for hook testing
- [ ] Tests verify state changes and side effects
- [ ] No warnings about act() or state updates
- [ ] Coverage meets target based on hook complexity
- [ ] Tests complete quickly (under 3 seconds)

**Testing Instructions**:
- Run `npm test -- hooks` to run only hook tests
- Check for React warnings in console (act warnings, state update warnings)
- Verify hooks work correctly with context providers
- Test hooks that use React Query with mocked query client

**Commit Message Template**:
```
test(frontend): add comprehensive custom hook tests

- Add tests for all 12+ custom React hooks
- Use renderHook pattern for isolated hook testing
- Mock service dependencies and React Query
- Cover state management, side effects, and cleanup
- Achieve 60-80% coverage based on hook complexity
```

**Estimated Tokens**: ~10,000

---

## Task 4: Frontend Component Tests

**Goal**: Write unit tests for React components, focusing on business-critical components and using a tiered coverage approach.

**Files to Modify/Create**:
- `tests/frontend/components/Dashboard.test.tsx` (high priority)
- `tests/frontend/components/ConnectionList.test.tsx` (high priority)
- `tests/frontend/components/MessageModal.test.tsx` (already exists, expand)
- `tests/frontend/components/ProfileView.test.tsx` (high priority)
- `tests/frontend/components/SearchInterface.test.tsx` (high priority)
- `tests/frontend/components/ConversationTopicPanel.test.tsx` (already exists, expand)
- Additional ~15-20 component tests for feature components
- Basic tests for ~10-15 simple UI components

**Prerequisites**:
- Task 1 completed (test infrastructure)
- Task 2 completed (services mocked)
- Task 3 completed (hooks mocked)

**Implementation Steps**:

1. **Use Testing Library Best Practices**:
   - Query by role, label, or text (not by class or ID)
   - Use `screen` for queries
   - Use `userEvent` for interactions (not fireEvent)
   - Write tests from user perspective, not implementation

2. **Tiered Testing Approach**:

   **Tier 1 - High Priority Components (60-70% coverage)**:
   - Dashboard, ConnectionList, ProfileView, SearchInterface
   - Test user interactions (clicks, form inputs, navigation)
   - Test data rendering and conditional display
   - Test error states and loading states

   **Tier 2 - Medium Priority Components (40-50% coverage)**:
   - MessageModal, ConversationTopicPanel, ProgressIndicator
   - Test basic rendering and prop handling
   - Test key interactions

   **Tier 3 - Low Priority Components (20-30% coverage)**:
   - Simple UI components (buttons, inputs, cards)
   - Smoke tests only (render without crashing)
   - Test prop variations if complex

3. **Component Test Patterns**:
   - Render component with required props
   - Test initial render state
   - Simulate user interactions
   - Assert on DOM changes or side effects
   - Test accessibility (ARIA labels, keyboard navigation)

4. **Mock Component Dependencies**:
   - Mock child components that are complex (replace with simple divs)
   - Mock hooks using vi.mock()
   - Mock services and API calls
   - Mock router navigation

5. **Avoid Over-Testing**:
   - Don't test implementation details (internal state, private methods)
   - Don't test third-party libraries (Radix UI components)
   - Don't test CSS or styling
   - Focus on user-facing behavior

**Verification Checklist**:
- [ ] High-priority components have comprehensive tests (60-70% coverage)
- [ ] Medium-priority components have functional tests (40-50% coverage)
- [ ] Low-priority components have smoke tests (20-30% coverage)
- [ ] Tests use accessible queries (getByRole, getByLabelText)
- [ ] No console warnings or errors during test runs
- [ ] Tests use userEvent for interactions
- [ ] Overall component test suite runs in under 15 seconds

**Testing Instructions**:
- Run `npm test -- components` to run only component tests
- Use `npm run test:ui` to visualize component test results
- Check coverage report for component directory
- Verify no act() warnings in console

**Commit Message Template**:
```
test(frontend): add tiered component test coverage

- Add comprehensive tests for high-priority components (Dashboard, ConnectionList, etc.)
- Add functional tests for medium-priority components
- Add smoke tests for simple UI components
- Use Testing Library best practices (accessible queries, userEvent)
- Achieve 40-70% coverage based on component complexity
```

**Estimated Tokens**: ~18,000

---

## Task 5: Backend Service Tests

**Goal**: Write comprehensive unit tests for Puppeteer backend services, with emphasis on LinkedIn automation logic and core business services.

**Files to Modify/Create**:
- `tests/backend/services/linkedinService.test.js` (critical)
- `tests/backend/services/linkedinContactService.test.js` (critical)
- `tests/backend/services/linkedinInteractionService.test.js` (critical)
- `tests/backend/services/puppeteerService.test.js` (high priority)
- `tests/backend/services/textExtractionService.test.js` (high priority)
- `tests/backend/services/s3TextUploadService.test.js` (high priority)
- `tests/backend/services/profileInitService.test.js` (medium priority)
- Additional service tests as needed (~10-15 total)

**Prerequisites**:
- Task 1 completed (test infrastructure)

**Implementation Steps**:

1. **Mock Puppeteer Extensively**:
   - Mock browser, page, and selector APIs
   - Use vi.mock('puppeteer') to replace entire module
   - Create mock page objects with common methods (goto, click, type, waitForSelector)
   - Mock screenshot and PDF generation methods

2. **Mock LinkedIn Interactions**:
   - DO NOT make real LinkedIn requests
   - Mock all page navigation and selectors
   - Create realistic mock HTML structures for selectors
   - Test selector logic without hitting LinkedIn

3. **Test LinkedIn Automation Services** (Critical - 80-90% coverage):
   - **linkedinService**: Test search, profile parsing, connection requests
   - **linkedinContactService**: Test contact retrieval and management
   - **linkedinInteractionService**: Test messaging, posting, interactions
   - Focus on business logic, not browser automation details
   - Test human behavior randomization logic
   - Test error handling and retry logic

4. **Test Supporting Services** (70-80% coverage):
   - **puppeteerService**: Test browser lifecycle, session management
   - **textExtractionService**: Test OCR text parsing and extraction
   - **s3TextUploadService**: Mock S3 SDK, test upload logic
   - **profileInitService**: Test profile initialization workflow

5. **Mock AWS SDK**:
   - Mock S3 client for upload operations
   - Mock DynamoDB client for data persistence
   - Use aws-sdk-client-mock or manual vi.mock()

6. **Test Patterns**:
   - Test service methods in isolation
   - Mock dependencies (other services, Puppeteer, AWS)
   - Test error paths (network failures, LinkedIn blocking, AWS errors)
   - Test edge cases (empty results, rate limiting, timeout scenarios)

**Verification Checklist**:
- [ ] All backend services have test files
- [ ] No real browser automation or LinkedIn requests in tests
- [ ] LinkedIn automation services have 80%+ coverage
- [ ] AWS SDK calls are properly mocked
- [ ] Tests cover success, error, and edge case scenarios
- [ ] Test suite runs in under 10 seconds
- [ ] No warnings about unhandled promises

**Testing Instructions**:
- Run `npm test -- backend/services` to run only backend service tests
- Verify no real Puppeteer browsers are launched
- Check coverage report for service files
- Ensure mocks accurately represent real API behavior

**Commit Message Template**:
```
test(backend): add comprehensive service layer tests

- Add tests for LinkedIn automation services (linkedinService, etc.)
- Add tests for supporting services (Puppeteer, S3, text extraction)
- Mock all Puppeteer browser automation
- Mock AWS SDK (S3, DynamoDB)
- Achieve 70-90% coverage based on service criticality
```

**Estimated Tokens**: ~15,000

---

## Task 6: Backend Controller Tests

**Goal**: Write unit tests for Express API controllers, testing request handling, response formatting, and error handling.

**Files to Modify/Create**:
- `tests/backend/controllers/linkedinInteractionController.test.js`
- `tests/backend/controllers/profileInitController.test.js` (already exists, may need expansion)
- `tests/backend/controllers/authController.test.js` (if exists)
- `tests/backend/controllers/searchController.test.js` (if exists)
- Additional controller tests for all API endpoints (~8-10 total)

**Prerequisites**:
- Task 1 completed (test infrastructure)
- Task 5 completed (backend services mocked)

**Implementation Steps**:

1. **Mock Express Request/Response**:
   - Create mock req and res objects
   - Use node-mocks-http or create manual mocks
   - Mock req.body, req.params, req.query, req.headers
   - Mock res.json, res.status, res.send methods

2. **Test Controller Methods**:
   - Test each API endpoint handler
   - Verify correct service methods are called
   - Verify response status codes and JSON structure
   - Test authentication/authorization logic (if present)

3. **Test Request Validation**:
   - Test with valid request data
   - Test with invalid data (missing fields, wrong types)
   - Test with edge cases (empty strings, very long strings, special characters)
   - Verify appropriate error responses

4. **Test Error Handling**:
   - Test when services throw errors
   - Verify error responses have correct status codes (400, 401, 500)
   - Verify error messages are appropriate and safe (no sensitive data leaked)

5. **Mock Service Dependencies**:
   - Mock all service calls (from Task 5)
   - Return realistic service responses
   - Simulate service errors to test error paths

6. **Coverage Target**: 70-80% for all controllers

**Verification Checklist**:
- [ ] All controller files have test coverage
- [ ] Request/response objects properly mocked
- [ ] Success and error paths tested
- [ ] Service methods are called with correct parameters
- [ ] Response status codes are correct
- [ ] No real services or databases called
- [ ] Tests run in under 5 seconds

**Testing Instructions**:
- Run `npm test -- backend/controllers` to run controller tests
- Verify all endpoints are covered
- Check that error responses have appropriate status codes
- Ensure service mocks are properly isolated

**Commit Message Template**:
```
test(backend): add controller layer tests

- Add tests for all Express API controllers
- Mock Express request and response objects
- Test request validation and error handling
- Achieve 70-80% coverage for controller layer
- Verify correct service integration and response formatting
```

**Estimated Tokens**: ~10,000

---

## Task 7: Backend Utility Tests

**Goal**: Write unit tests for utility functions and helper modules in the Puppeteer backend.

**Files to Modify/Create**:
- `tests/backend/utils/interactionQueue.test.js` (high priority)
- `tests/backend/utils/healingManager.test.js` (high priority)
- `tests/backend/utils/crypto.test.js` (high priority - security critical)
- `tests/backend/utils/humanBehaviorManager.test.js` (medium priority)
- Additional utility tests for ~15-20 helper modules

**Prerequisites**:
- Task 1 completed (test infrastructure)

**Implementation Steps**:

1. **Prioritize Critical Utilities** (80%+ coverage):
   - **crypto.js**: Test Sealbox encryption/decryption (CRITICAL - security)
   - **interactionQueue.js**: Test FIFO queue logic, concurrency control
   - **healingManager.js**: Test checkpoint save/restore logic

2. **Test Medium Priority Utilities** (60-70% coverage):
   - **humanBehaviorManager.js**: Test random delay generation, typing simulation
   - **responseBuilder.js**: Test API response formatting
   - **validators.js**: Test input validation functions

3. **Test Low Priority Utilities** (40-50% coverage):
   - Simple helper functions (string formatting, date utilities)
   - Constants files (light smoke tests)

4. **Testing Pure Functions**:
   - Most utilities should be pure functions (no side effects)
   - Test with various inputs and verify outputs
   - Test edge cases (null, undefined, empty arrays, boundary values)

5. **Testing Stateful Utilities**:
   - For utilities with state (interactionQueue, healingManager)
   - Test state changes over multiple operations
   - Test concurrency and race conditions if applicable
   - Reset state between tests (use beforeEach)

6. **Mock External Dependencies**:
   - Mock file system operations (fs module)
   - Mock crypto libraries if used
   - Mock timers for delay/timeout functions

**Verification Checklist**:
- [ ] Critical utilities (crypto, queue, healing) have 80%+ coverage
- [ ] All utilities have at least basic test coverage
- [ ] Pure functions tested with various inputs
- [ ] Stateful utilities tested for state changes
- [ ] Edge cases and boundary values tested
- [ ] Tests run in under 5 seconds

**Testing Instructions**:
- Run `npm test -- backend/utils` to run utility tests
- Pay special attention to crypto tests (security critical)
- Verify queue concurrency logic works correctly
- Check healing manager checkpoint logic

**Commit Message Template**:
```
test(backend): add comprehensive utility tests

- Add tests for critical utilities (crypto, queue, healing)
- Add tests for helper utilities (behavior, validation, etc.)
- Test pure functions with various inputs and edge cases
- Test stateful utilities for correct state management
- Achieve 50-80% coverage based on utility criticality
```

**Estimated Tokens**: ~12,000

---

## Task 8: Lambda Python Tests

**Goal**: Write comprehensive unit tests for all Python Lambda functions using pytest and moto for AWS service mocking.

**Files to Modify/Create**:
- `lambda-processing/linkedin-advanced-search-edge-processing-prod/test_lambda_function.py`
- `lambda-processing/linkedin-advanced-search-dynamodb-api-prod/test_lambda_function.py`
- `lambda-processing/linkedin-advanced-search-llm-prod/test_lambda_function.py`
- `lambda-processing/linkedin-advanced-search-placeholder-search-prod/test_lambda_function.py` (if has Python code)
- `lambda-processing/linkedin-advanced-search-profile-api-prod/test_lambda_function.py`
- `lambda-processing/openai-webhook-handler/test_lambda_function.py`
- Additional tests for helper modules in Lambda directories

**Prerequisites**:
- Task 1 completed (Python test infrastructure with pytest and moto)

**Implementation Steps**:

1. **Use Moto for AWS Service Mocking**:
   - Use @mock_dynamodb decorator for DynamoDB tests
   - Use @mock_s3 decorator for S3 tests
   - Use @mock_cognitoidentityprovider for Cognito tests
   - Create test tables and buckets in setUp fixtures

2. **Test Lambda Handler Functions** (80-90% coverage):
   - Test lambda_handler with various event structures
   - Test with valid API Gateway events
   - Test with invalid/malformed events
   - Test error handling and exception paths

3. **Mock External API Calls**:
   - Mock OpenAI API calls (use responses library)
   - Mock Google Gemini API calls
   - Do not make real API calls in tests

4. **Test DynamoDB Operations**:
   - **dynamodb-api-prod**: Test CRUD operations, query patterns, GSI queries
   - **edge-processing-prod**: Test connection edge processing logic
   - **profile-api-prod**: Test profile data management
   - Create mock tables with correct schema before tests
   - Verify correct items written to DynamoDB

5. **Test Business Logic**:
   - **llm-prod**: Test prompt construction, response parsing, error handling
   - **openai-webhook-handler**: Test webhook payload processing
   - Focus on Lambda-specific logic, not AWS SDK internals

6. **Test Patterns for Python**:
   - Use pytest fixtures for setup/teardown
   - Use parametrize for testing multiple input scenarios
   - Use monkeypatch for environment variables
   - Use assert statements for verification

7. **Environment Variable Handling**:
   - Mock environment variables in tests (TABLE_NAME, BUCKET_NAME, etc.)
   - Use monkeypatch fixture or os.environ mocking
   - Test behavior when env vars are missing

**Verification Checklist**:
- [ ] All Python Lambda functions have test files
- [ ] All tests use moto decorators (no real AWS calls)
- [ ] Lambda handlers tested with various event types
- [ ] DynamoDB operations verified with mock tables
- [ ] External API calls properly mocked
- [ ] Coverage is 80-90% for all Lambda functions
- [ ] All tests pass with `pytest`
- [ ] Tests run in under 10 seconds

**Testing Instructions**:
- Run `cd lambda-processing && pytest` to run all Python tests
- Run `pytest --cov=. --cov-report=html` to generate coverage report
- Verify moto creates mock AWS resources correctly
- Check for any boto3 errors or warnings

**Commit Message Template**:
```
test(lambda): add comprehensive Python Lambda tests

- Add tests for all 6 Python Lambda functions
- Use moto for DynamoDB, S3, and Cognito mocking
- Mock external API calls (OpenAI, Gemini)
- Test handler functions with various event types
- Achieve 80-90% coverage for Lambda layer
```

**Estimated Tokens**: ~13,000

---

## Task 9: Lambda Node.js Tests

**Goal**: Write unit tests for the Node.js Lambda function (placeholder-search-prod).

**Files to Modify/Create**:
- `lambda-processing/linkedin-advanced-search-placeholder-search-prod/index.test.js`

**Prerequisites**:
- Task 1 completed (test infrastructure)

**Implementation Steps**:

1. **Mock AWS SDK for Node.js**:
   - Use aws-sdk-client-mock for AWS SDK v3
   - Mock any DynamoDB or S3 clients used
   - Create mock responses for AWS operations

2. **Test Lambda Handler**:
   - Test with various API Gateway event structures
   - Test success path (returns expected search results)
   - Test error paths (malformed input, AWS errors)
   - Verify response format matches API Gateway expectations

3. **Mock External Dependencies**:
   - Mock any external API calls if present
   - Mock environment variables
   - Keep tests isolated and fast

4. **Coverage Target**: 80-90% for this Lambda function

**Verification Checklist**:
- [ ] Node.js Lambda has test file
- [ ] AWS SDK properly mocked (no real AWS calls)
- [ ] Handler tested with various events
- [ ] Response format verified (statusCode, body, headers)
- [ ] Coverage meets 80-90% target
- [ ] Test runs in under 2 seconds

**Testing Instructions**:
- Run `npm test -- lambda` to run Node.js Lambda tests
- Verify no real AWS calls are made
- Check response format matches API Gateway expectations

**Commit Message Template**:
```
test(lambda): add Node.js Lambda function tests

- Add tests for placeholder-search-prod Lambda
- Mock AWS SDK v3 clients
- Test handler with various event types
- Achieve 80-90% coverage
```

**Estimated Tokens**: ~5,000

---

## Phase Verification

After completing all 9 tasks, verify the entire phase:

### Verification Steps

1. **Run Full Test Suite**:
   ```bash
   # Run all JS/TS tests
   npm test

   # Run all Python tests
   cd lambda-processing && pytest
   ```

2. **Check Coverage Reports**:
   ```bash
   # JS/TS coverage
   npm test -- --coverage

   # Python coverage
   cd lambda-processing && pytest --cov=. --cov-report=term
   ```

3. **Verify Coverage Targets**:
   - Overall coverage: 60-70%
   - Critical code (LinkedIn automation, Lambdas): 80-90%
   - Services and controllers: 70-80%
   - Components and hooks: 40-70%
   - Utilities: 40-60%

4. **Check Test Performance**:
   - JS/TS tests complete in under 60 seconds
   - Python tests complete in under 10 seconds
   - No hanging tests or timeouts

5. **Verify No Real External Calls**:
   - No real Puppeteer browsers launched
   - No real LinkedIn requests
   - No real AWS service calls
   - No real AI API calls (OpenAI, Gemini)

### Success Criteria

✅ **All tests pass** with zero failures
✅ **Coverage meets targets** (60-70% overall, tiered by layer)
✅ **Test suite is fast** (under 70 seconds total)
✅ **All external dependencies mocked** (no real API calls)
✅ **No console errors or warnings** during test runs
✅ **Build still passes** after adding tests
✅ **Tests provide confidence** for upcoming refactoring

### Known Limitations

- **No E2E tests**: This phase covers unit tests only
- **Integration tests preserved**: 16 existing integration tests remain but are not expanded
- **No visual regression testing**: UI appearance not tested
- **Mock accuracy**: Mocks may not perfectly represent real services

### Next Steps

Once this phase is complete and verified, proceed to [Phase 2: Dead Code Removal](./Phase-2.md).

---

**Estimated Total Tokens**: ~100,000
