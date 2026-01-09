# Phase 0: Foundation

## Phase Goal

Establish the architectural decisions, deployment infrastructure, and testing patterns that will be used throughout the remediation. This phase creates the foundation that all subsequent phases build upon.

**Success Criteria:**
- ADRs documented for all major architectural decisions
- `npm run deploy` script functional with interactive config and `.env` injection
- Testing strategy documented with examples of mocking patterns
- CI pipeline validated for mocked integration tests

**Estimated Tokens:** ~15,000

## Prerequisites

- Clean git working directory
- Node.js v24 LTS installed
- Python 3.13 installed
- AWS CLI configured with deployment credentials
- SAM CLI installed

---

## Architecture Decision Records (ADRs)

### ADR-001: Lambda Layered Architecture

**Context:** Lambda functions (`edge-processing`, `profile-processing`, `llm`) have grown to 500-720 lines, making them difficult to test, maintain, and extend.

**Decision:** Adopt a three-layer architecture for Lambda functions:

```
lambda_function.py (Handler Layer)
    ├── Parses events, extracts parameters
    ├── Validates input, handles auth
    ├── Delegates to service layer
    └── Returns HTTP responses

services/
    └── {domain}_service.py (Business Logic Layer)
        ├── Pure business logic
        ├── No AWS SDK calls directly
        ├── Receives injected dependencies
        └── Returns domain objects

errors/
    └── exceptions.py (Error Layer)
        ├── Custom exception classes
        ├── Error code constants
        └── Error response builders
```

**Consequences:**
- Handler becomes thin (~100-150 lines)
- Business logic is independently testable
- Dependencies can be mocked at service boundaries
- Enables parallel development on different layers

### ADR-002: Dependency Injection for AWS Clients

**Context:** Lambda functions create AWS clients (DynamoDB, Lambda, S3) at module level, making them hard to mock and creating tight coupling.

**Decision:** Use constructor injection for AWS clients:

```python
# Before (tight coupling)
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])

def handler(event, context):
    table.get_item(...)  # Hard to mock

# After (dependency injection)
class EdgeService:
    def __init__(self, table, lambda_client=None):
        self.table = table
        self.lambda_client = lambda_client

    def get_connection(self, user_id, profile_id):
        return self.table.get_item(...)  # Easy to mock

# Handler creates real clients, tests inject mocks
def handler(event, context):
    service = EdgeService(table, lambda_client)
    return service.get_connection(...)
```

**Consequences:**
- Services become pure and testable
- Real AWS clients created only in handler
- Tests inject mock clients without patching
- Enables offline testing

### ADR-003: Enum-Based Conversion Likelihood

**Context:** Current conversion likelihood uses weighted percentage calculation (0-100) with arbitrary weights. No validation data supports the weights.

**Decision:** Replace with simple enum:

```python
class ConversionLikelihood(str, Enum):
    HIGH = "high"      # Complete profile + recent + no prior attempts
    MEDIUM = "medium"  # Partial profile OR older OR some attempts
    LOW = "low"        # Incomplete profile OR old OR many attempts
```

**Mapping Rules:**
- HIGH: Has headline AND summary AND (added < 7 days) AND (attempts == 0)
- LOW: Missing headline OR missing summary OR (attempts > 2)
- MEDIUM: Everything else

**Consequences:**
- Simpler logic, easier to understand
- No magic numbers or arbitrary weights
- Frontend displays as badge color, not percentage
- Future: Can add ML scoring behind enum interface

### ADR-004: Testing Strategy

**Context:** Backend has ~15% test coverage. Need comprehensive testing without requiring live AWS resources in CI.

**Decision:** Two-layer testing approach:

**Layer 1: Unit Tests (moto)**
- Mock AWS services with moto decorators
- Test business logic in isolation
- Run in CI (no AWS credentials needed)
- Target: 80%+ coverage on service layer

**Layer 2: Integration Tests (LocalStack or mocked)**
- Test handler → service → (mocked) AWS flow
- Use requests-mock for external HTTP calls
- Run in CI with mocked responses
- Target: Happy path + error paths covered

**Test File Structure:**
```
tests/backend/
├── unit/
│   ├── test_edge_service.py       # Service layer tests
│   ├── test_profile_service.py
│   └── test_llm_service.py
├── integration/
│   ├── test_edge_handler.py       # Handler → service flow
│   └── test_profile_handler.py
└── conftest.py                    # Shared fixtures
```

**Consequences:**
- Fast unit tests (~seconds)
- Comprehensive mocked integration tests
- CI runs without AWS credentials
- Clear separation of test concerns

### ADR-005: Type Safety in Frontend API Layer

**Context:** `useConnections.ts` uses `any` type due to API response shape mismatch. Validators exist but aren't used.

**Decision:** Add response transformation layer:

```typescript
// services/puppeteerApiService.ts
async getConnections(filters): Promise<ApiResponse<Connection[]>> {
  const response = await axios.get('/connections', { params: filters });

  // Transform and validate API response
  const validated = response.data.connections.map(conn => {
    const result = validateConnection(conn, { sanitize: true });
    if (!result.valid) {
      logger.warn('Connection validation failed', { errors: result.errors });
    }
    return result.sanitizedData ?? conn;
  });

  return { success: true, data: validated };
}
```

**Consequences:**
- Type safety throughout the data flow
- Runtime validation catches API contract drift
- Logging reveals data quality issues
- Gradual migration (sanitize mode allows partial matches)

---

## Tasks

### Task 1: Create Deployment Script

**Goal:** Create `npm run deploy` script that handles configuration interactively and generates `samconfig.toml`.

**Files to Modify/Create:**
- `scripts/deploy/deploy-sam.js` - Main deployment script
- `package.json` - Add deploy script
- `.deploy-config.json.example` - Template for local config
- `.gitignore` - Ensure `.deploy-config.json` is ignored

**Prerequisites:**
- AWS CLI configured
- SAM CLI installed

**Implementation Steps:**
1. Create a Node.js script that:
   - Checks for `.deploy-config.json` existence
   - If missing, prompts user for required values (stack name, region, S3 bucket, parameter overrides)
   - Saves responses to `.deploy-config.json` for future runs
   - Reads config and generates `samconfig.toml` programmatically
   - Executes `sam build` and `sam deploy --config-file samconfig.toml`
   - Parses CloudFormation outputs and updates local `.env` file

2. Config values to collect:
   - `stackName`: CloudFormation stack name
   - `region`: AWS region
   - `s3Bucket`: S3 bucket for SAM artifacts
   - `environment`: dev/prod
   - `openaiApiKey`: OpenAI API key (optional, NoEcho)
   - `ragstackEndpoint`: RAGStack endpoint (optional)
   - `ragstackApiKey`: RAGStack API key (optional, NoEcho)

3. Generated `samconfig.toml` structure:
   ```toml
   version = 0.1
   [default.deploy.parameters]
   stack_name = "{stackName}"
   region = "{region}"
   s3_bucket = "{s3Bucket}"
   capabilities = "CAPABILITY_IAM"
   parameter_overrides = "Environment={environment} OpenAIApiKey={openaiApiKey} ..."
   ```

4. Post-deploy `.env` injection:
   - Parse `sam deploy` output for stack outputs
   - Extract: API Gateway URL, Cognito Pool ID, Cognito Client ID, S3 Bucket name
   - Write/update `.env` file with `VITE_*` prefixed variables

**Verification Checklist:**
- [ ] `npm run deploy` prompts for config on first run
- [ ] `.deploy-config.json` created and persisted
- [ ] Subsequent runs skip prompts (use saved config)
- [ ] `samconfig.toml` generated correctly
- [ ] `.env` updated with stack outputs after successful deploy
- [ ] Script handles deployment failures gracefully

**Testing Instructions:**
- Unit test: Mock `prompts`, file system, and child_process to verify logic flow
- Manual test: Run `npm run deploy` in clean environment, verify prompts and file generation

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(deploy): add interactive SAM deployment script

- Add npm run deploy with config persistence
- Generate samconfig.toml from saved config
- Auto-inject stack outputs into .env
```

---

### Task 2: Create Service Layer Structure for Lambdas

**Goal:** Create the directory structure and base classes for the refactored Lambda architecture without moving any existing code yet.

**Files to Modify/Create:**
- `backend/lambdas/shared/python/services/base_service.py` - Base service class
- `backend/lambdas/shared/python/errors/exceptions.py` - Custom exceptions
- `backend/lambdas/shared/python/errors/handlers.py` - Error handling utilities
- `backend/lambdas/edge-processing/services/__init__.py` - Package init
- `backend/lambdas/profile-processing/services/__init__.py` - Package init
- `backend/lambdas/llm/services/__init__.py` - Package init
- `backend/lambdas/shared/python/models/__init__.py` - Package init for models

**Prerequisites:**
- None (foundational task)

**Implementation Steps:**
1. Create base service class with dependency injection pattern:
   - Constructor accepts AWS clients as parameters
   - Provides logging setup
   - Defines interface for health checks

2. Create exception hierarchy:
   - `ServiceError` - Base exception with error code
   - `ValidationError` - Input validation failures
   - `NotFoundError` - Resource not found
   - `AuthorizationError` - Auth failures
   - `ExternalServiceError` - AWS/external service failures

3. Create error response builders:
   - `build_error_response(exception)` - Convert exception to HTTP response
   - Standard error response format: `{ "error": { "code": "...", "message": "..." } }`

4. Create empty service directories with `__init__.py` for each Lambda that will be refactored

**Verification Checklist:**
- [ ] Base service class importable from shared path
- [ ] Exception classes defined with proper inheritance
- [ ] Error handlers produce consistent JSON responses
- [ ] Service directories created for edge-processing, profile-processing, llm
- [ ] Existing Lambda tests still pass (no behavior change)

**Testing Instructions:**
- Unit test: Test exception classes serialize correctly to JSON
- Unit test: Test error handlers return proper HTTP status codes
- Verify: `npm run test:backend` passes (no regression)

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(backend): add service layer foundation

- Create base service class with DI pattern
- Add custom exception hierarchy
- Add error response builders
- Prepare service directories for Lambda refactoring
```

---

### Task 3: Add ConversionLikelihood Enum

**Goal:** Create the enum that will replace the over-engineered percentage calculation.

**Files to Modify/Create:**
- `backend/lambdas/shared/python/models/enums.py` - Enum definitions
- `frontend/src/shared/types/index.ts` - Add TypeScript enum mirror
- `tests/backend/unit/test_enums.py` - Unit tests for enum

**Prerequisites:**
- Task 2 complete (shared directory structure exists)

**Implementation Steps:**
1. Create Python enum in shared models:
   ```python
   class ConversionLikelihood(str, Enum):
       HIGH = "high"
       MEDIUM = "medium"
       LOW = "low"
   ```

2. Create function to calculate likelihood from profile data:
   - Input: profile_data dict, edge_item dict
   - Output: ConversionLikelihood enum value
   - Rules per ADR-003

3. Mirror in TypeScript:
   ```typescript
   export type ConversionLikelihood = 'high' | 'medium' | 'low';
   ```

4. Write unit tests covering all classification rules

**Verification Checklist:**
- [ ] Enum importable from `shared.models.enums`
- [ ] TypeScript type exported from `@/shared/types`
- [ ] Classification function handles edge cases (missing data)
- [ ] Unit tests cover HIGH, MEDIUM, LOW scenarios
- [ ] Tests cover missing/null profile data gracefully

**Testing Instructions:**
- Unit test: `test_enums.py` with fixtures for each classification bucket
- Manual: Verify TypeScript type works in IDE autocomplete

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(backend): add ConversionLikelihood enum

- Replace percentage-based scoring with enum
- Add classification function with simple rules
- Mirror enum type in TypeScript
```

---

### Task 4: Configure Test Infrastructure

**Goal:** Ensure test infrastructure supports mocked integration tests in CI.

**Files to Modify/Create:**
- `tests/backend/conftest.py` - Add integration test fixtures
- `tests/backend/integration/__init__.py` - Create integration test package
- `tests/backend/requirements-test.txt` - Add any missing test dependencies
- `.github/workflows/ci.yml` - Verify mocked tests run without AWS

**Prerequisites:**
- None (can run in parallel with Task 2)

**Implementation Steps:**
1. Extend `conftest.py` with:
   - Moto fixtures for DynamoDB, S3, Lambda
   - Factory functions for creating test data
   - Request mock fixtures for external HTTP calls

2. Create integration test directory structure:
   ```
   tests/backend/integration/
   ├── __init__.py
   └── .gitkeep
   ```

3. Verify CI workflow:
   - Confirm `python -m pytest` runs without AWS credentials
   - All moto-decorated tests should pass
   - Add explicit check that no real AWS calls are made

4. Document test patterns in conftest.py docstrings

**Verification Checklist:**
- [ ] `pytest` runs successfully without AWS credentials
- [ ] Moto fixtures create isolated mock resources
- [ ] Integration test directory exists
- [ ] CI workflow runs all tests successfully
- [ ] No real AWS API calls in test suite

**Testing Instructions:**
- Run: `AWS_ACCESS_KEY_ID= pytest tests/backend/` (blank credentials)
- Verify: All tests pass with mocked services
- CI: Push branch, verify GitHub Actions passes

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

test(backend): enhance test infrastructure for mocked integration tests

- Add moto fixtures for DynamoDB, S3, Lambda
- Create integration test directory
- Verify tests pass without AWS credentials
```

---

## Phase Verification

**All Phase 0 tasks are complete when:**

1. **Deployment Script**
   - [ ] `npm run deploy` exists and prompts for config
   - [ ] `.deploy-config.json` persists between runs
   - [ ] `samconfig.toml` generated correctly
   - [ ] `.env` updated with stack outputs

2. **Service Layer Foundation**
   - [ ] Base service class exists in shared path
   - [ ] Exception classes defined and tested
   - [ ] Service directories prepared for refactoring

3. **Enum Implementation**
   - [ ] `ConversionLikelihood` enum created
   - [ ] Classification function tested
   - [ ] TypeScript mirror type exported

4. **Test Infrastructure**
   - [ ] All tests pass with blank AWS credentials
   - [ ] Moto fixtures available
   - [ ] Integration test directory exists

**Run final verification:**
```bash
# All CI checks must pass
npm run check

# Deployment script must work
npm run deploy -- --dry-run  # If implemented

# Backend tests with blank credentials
AWS_ACCESS_KEY_ID= npm run test:backend
```

---

## Known Limitations

- Deployment script requires interactive terminal for first run
- Moto may not perfectly simulate all DynamoDB behaviors
- Some edge cases in conversion likelihood may need refinement after real-world usage

---

## Handoff to Phase 1

Phase 0 establishes the patterns. Phase 1 applies them by:
1. Extracting business logic from `edge-processing` into `EdgeService`
2. Extracting business logic from `profile-processing` into `ProfileService`
3. Extracting business logic from `llm` into `LLMService`
4. Replacing percentage scoring with enum in `EdgeService`
