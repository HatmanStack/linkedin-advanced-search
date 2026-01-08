# Phase 1: Lambda Refactoring

## Phase Goal

Refactor the three largest Lambda functions (`edge-processing`, `profile-processing`, `llm`) from monolithic handlers into layered architecture with handler, service, and error layers. This phase applies the patterns established in Phase 0.

**Success Criteria:**
- Each Lambda handler reduced to ~100-150 lines (routing + validation only)
- Business logic extracted into independently testable service classes
- Dependency injection used for all AWS clients
- Conversion likelihood uses enum (not percentage)
- All existing tests pass (no regression)
- New unit tests for each service class

**Estimated Tokens:** ~40,000

## Prerequisites

- Phase 0 complete
- Base service class available in `shared/python/services/`
- Exception classes available in `shared/python/errors/`
- `ConversionLikelihood` enum available in `shared/python/models/`
- Test infrastructure configured

---

## Tasks

### Task 1: Refactor edge-processing Lambda (TDD)

**Goal:** Extract business logic from `edge-processing/lambda_function.py` (716 lines) into `EdgeService` class following TDD.

**Files to Modify/Create:**
- `backend/lambdas/edge-processing/services/edge_service.py` - New service class
- `backend/lambdas/edge-processing/lambda_function.py` - Thin handler
- `tests/backend/unit/test_edge_service.py` - Unit tests (write first)

**Prerequisites:**
- Phase 0 Task 2 complete (base service class exists)
- Phase 0 Task 3 complete (ConversionLikelihood enum exists)

**Implementation Steps:**

**Step 1: Write Tests First**

Before modifying any production code, write comprehensive unit tests for the `EdgeService` class. The tests define the expected behavior:

1. Analyze `edge-processing/lambda_function.py` to identify distinct operations:
   - `create_edge` - Create user-to-profile edge
   - `update_status` - Update edge status
   - `add_message` - Add message to edge
   - `get_connections` - List user's connections
   - `get_messages` - Get message history
   - `update_metadata` - Update edge metadata
   - `create_edges` - Bulk create edges

2. For each operation, write test cases:
   - Happy path with valid input
   - Missing required parameters
   - Resource not found scenarios
   - DynamoDB error handling
   - Auth validation (user ID required)

3. Use moto fixtures from conftest.py to mock DynamoDB
4. Test the `_calculate_conversion_likelihood` replacement using enum

**Step 2: Create EdgeService Class**

Extract business logic into service class:

1. Create `EdgeService` with constructor injection:
   - `table` - DynamoDB Table resource
   - `lambda_client` - Lambda client (for RAGStack proxy calls)
   - `ragstack_function_name` - Function name for RAGStack (optional)

2. Move each operation to a method on EdgeService:
   - Method receives parsed parameters (not raw event)
   - Method returns domain objects or raises ServiceError
   - No HTTP response formatting in service layer

3. Replace `_calculate_conversion_likelihood` percentage logic with enum:
   - Import `ConversionLikelihood` from shared models
   - Use classification rules from ADR-003
   - Return enum value instead of integer 0-100

4. Handle inter-Lambda invocation:
   - Move RAGStack proxy invocation to service
   - Accept `lambda_client` via constructor injection
   - Make invocation optional (skip if no function name)

**Step 3: Slim Down Handler**

Refactor `lambda_function.py` to thin handler:

1. Keep in handler:
   - Event parsing (`_parse_body`)
   - User ID extraction (`_extract_user_id`)
   - Operation routing
   - HTTP response construction (`_resp`)

2. Move to service:
   - All DynamoDB operations
   - Business logic (filtering, formatting)
   - External service calls (RAGStack)

3. Handler structure:
   ```python
   def handler(event, context):
       user_id = _extract_user_id(event)
       if not user_id:
           return _resp(401, {'error': 'Unauthorized'})

       body = _parse_body(event)
       operation = body.get('operation')

       service = EdgeService(table, lambda_client, RAGSTACK_FUNCTION)

       try:
           if operation == 'create':
               result = service.create_edge(user_id, body)
           elif operation == 'get_connections':
               result = service.get_connections(user_id, body)
           # ... other operations
           return _resp(200, result)
       except ValidationError as e:
           return _resp(400, {'error': str(e)})
       except NotFoundError as e:
           return _resp(404, {'error': str(e)})
       except ServiceError as e:
           return _resp(500, {'error': str(e)})
   ```

**Step 4: Update Response Format**

The `conversion_likelihood` field changes from integer to string:

1. Backend returns: `"conversion_likelihood": "high"` (not `75`)
2. Update `_format_connection_object` to use enum `.value`
3. Frontend will be updated in Phase 2 to handle string

**Verification Checklist:**
- [ ] `EdgeService` class created with all operations
- [ ] Constructor injection for DynamoDB table and Lambda client
- [ ] `_calculate_conversion_likelihood` replaced with enum classification
- [ ] Handler reduced to <150 lines
- [ ] All existing `test_edge_processing.py` tests pass
- [ ] New `test_edge_service.py` tests pass
- [ ] `npm run test:backend` passes
- [ ] `npm run lint:backend` passes

**Testing Instructions:**

**Unit Tests (test_edge_service.py):**
```python
# Test structure
class TestEdgeService:
    @pytest.fixture
    def mock_table(self):
        # Moto DynamoDB table fixture

    @pytest.fixture
    def service(self, mock_table):
        return EdgeService(table=mock_table, lambda_client=None)

    def test_create_edge_success(self, service):
        # Given valid profile data
        # When create_edge called
        # Then edge created in DynamoDB

    def test_create_edge_missing_profile_id(self, service):
        # Given missing profileId
        # When create_edge called
        # Then raises ValidationError

    def test_get_connections_returns_formatted_list(self, service):
        # Given edges exist in DynamoDB
        # When get_connections called
        # Then returns formatted connection objects

    def test_conversion_likelihood_high(self, service):
        # Given complete profile + recent + no attempts
        # When classifying
        # Then returns ConversionLikelihood.HIGH

    def test_conversion_likelihood_low(self, service):
        # Given incomplete profile
        # When classifying
        # Then returns ConversionLikelihood.LOW
```

**Integration Tests (test_edge_handler.py):**
- Test full handler → service flow with mocked DynamoDB
- Verify HTTP status codes for error cases
- Verify response format matches API contract

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(backend): extract EdgeService from edge-processing Lambda

- Move business logic to EdgeService class
- Replace percentage scoring with enum
- Add dependency injection for AWS clients
- Add comprehensive unit tests
```

---

### Task 2: Refactor profile-processing Lambda (TDD)

**Goal:** Extract business logic from `profile-processing/lambda_function.py` (719 lines) into `ProfileProcessingService` class following TDD.

**Files to Modify/Create:**
- `backend/lambdas/profile-processing/services/profile_processing_service.py` - New service class
- `backend/lambdas/profile-processing/lambda_function.py` - Thin handler
- `tests/backend/unit/test_profile_processing_service.py` - Unit tests (write first)

**Prerequisites:**
- Task 1 complete (pattern established)
- Moto S3 fixtures available

**Implementation Steps:**

**Step 1: Write Tests First**

Analyze `profile-processing/lambda_function.py` to identify operations:
1. S3 event handling - Extract bucket/key from event
2. Image download - Download screenshot from S3
3. Textract processing - Extract text from image
4. Bedrock/Claude parsing - Parse extracted text into profile data
5. DynamoDB storage - Store parsed profile
6. Error handling - Handle failures gracefully

Write test cases for each operation with mocked AWS services.

**Step 2: Create ProfileProcessingService Class**

Extract business logic:

1. Create service with constructor injection:
   - `s3_client` - S3 client for image download
   - `textract_client` - Textract client for OCR
   - `bedrock_client` - Bedrock client for AI parsing
   - `table` - DynamoDB table for storage

2. Create method for each stage of processing:
   - `download_image(bucket, key) -> bytes`
   - `extract_text(image_bytes) -> str`
   - `parse_profile(text) -> ProfileData`
   - `store_profile(profile_data) -> None`
   - `process(bucket, key) -> ProcessingResult` (orchestrates all)

3. Each method:
   - Receives typed parameters
   - Returns typed results
   - Raises appropriate ServiceError subclass on failure

**Step 3: Slim Down Handler**

Handler responsibilities:
1. Parse S3 event to extract bucket/key
2. Instantiate service with real AWS clients
3. Call `service.process(bucket, key)`
4. Handle exceptions and log results

Target: Handler < 100 lines

**Step 4: Handle Bedrock/Claude Integration**

The profile parsing uses Claude/Bedrock:
1. Keep AI prompt templates in separate module
2. Service receives bedrock_client, calls invoke_model
3. Test with mocked Bedrock responses

**Verification Checklist:**
- [ ] `ProfileProcessingService` class created
- [ ] Constructor injection for S3, Textract, Bedrock, DynamoDB
- [ ] Handler reduced to <100 lines
- [ ] Processing stages independently testable
- [ ] All existing tests pass
- [ ] New unit tests cover happy path and error cases
- [ ] `npm run test:backend` passes
- [ ] `npm run lint:backend` passes

**Testing Instructions:**

**Unit Tests (test_profile_processing_service.py):**
```python
class TestProfileProcessingService:
    @pytest.fixture
    def mock_s3(self):
        # Moto S3 with test image

    @pytest.fixture
    def mock_textract(self):
        # Mock returning extracted text

    @pytest.fixture
    def mock_bedrock(self):
        # Mock returning parsed profile JSON

    def test_download_image_success(self, service, mock_s3):
        # Given image exists in S3
        # When download_image called
        # Then returns image bytes

    def test_download_image_not_found(self, service, mock_s3):
        # Given image does not exist
        # When download_image called
        # Then raises NotFoundError

    def test_extract_text_success(self, service, mock_textract):
        # Given valid image bytes
        # When extract_text called
        # Then returns extracted text

    def test_parse_profile_success(self, service, mock_bedrock):
        # Given valid extracted text
        # When parse_profile called
        # Then returns ProfileData with expected fields

    def test_process_end_to_end(self, service):
        # Given mocked services
        # When process called
        # Then profile stored in DynamoDB
```

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(backend): extract ProfileProcessingService from profile-processing Lambda

- Move S3/Textract/Bedrock logic to service class
- Add dependency injection for all AWS clients
- Add comprehensive unit tests
```

---

### Task 3: Refactor llm Lambda (TDD)

**Goal:** Extract business logic from `llm/lambda_function.py` (502 lines) into `LLMService` class following TDD.

**Files to Modify/Create:**
- `backend/lambdas/llm/services/llm_service.py` - New service class
- `backend/lambdas/llm/lambda_function.py` - Thin handler
- `tests/backend/unit/test_llm_service.py` - Unit tests (write first)

**Prerequisites:**
- Task 1 and 2 complete (pattern established)

**Implementation Steps:**

**Step 1: Write Tests First**

Analyze `llm/lambda_function.py` to identify operations:
1. `generate_ideas` - Generate content ideas
2. `research_selected_ideas` - Research selected ideas in background
3. `get_research_result` - Retrieve research results
4. `apply_post_style` - Apply writing style to content
5. `synthesize_research` - Combine research into draft

Write tests with mocked OpenAI responses.

**Step 2: Create LLMService Class**

Extract business logic:

1. Create service with constructor injection:
   - `openai_client` - OpenAI client
   - `bedrock_client` - Bedrock client (fallback)
   - `table` - DynamoDB table (for research storage)

2. Move operations to methods:
   - `generate_ideas(topic, num_ideas) -> List[Idea]`
   - `research_ideas(ideas) -> str` (job ID)
   - `get_research_result(job_id) -> ResearchResult`
   - `apply_style(content, style) -> str`
   - `synthesize(research_results) -> str`

3. Handle OpenAI client:
   - Accept client via constructor (not create at module level)
   - Test can inject mock client

**Step 3: Slim Down Handler**

Handler responsibilities:
1. Parse request body
2. Extract user ID from auth
3. Route to appropriate service method
4. Format HTTP response

Target: Handler < 120 lines

**Step 4: Handle Async Operations**

Research runs in background:
1. Service stores job in DynamoDB
2. Returns job ID immediately
3. Separate endpoint retrieves result

Keep this pattern but make it testable.

**Verification Checklist:**
- [ ] `LLMService` class created
- [ ] Constructor injection for OpenAI, Bedrock, DynamoDB
- [ ] Handler reduced to <120 lines
- [ ] Operations independently testable
- [ ] All existing tests pass
- [ ] New unit tests cover each operation
- [ ] `npm run test:backend` passes
- [ ] `npm run lint:backend` passes

**Testing Instructions:**

**Unit Tests (test_llm_service.py):**
```python
class TestLLMService:
    @pytest.fixture
    def mock_openai(self):
        # Mock OpenAI client responses

    @pytest.fixture
    def mock_table(self):
        # Moto DynamoDB table

    def test_generate_ideas_success(self, service, mock_openai):
        # Given topic
        # When generate_ideas called
        # Then returns list of ideas

    def test_generate_ideas_fallback_to_bedrock(self, service):
        # Given OpenAI fails
        # When generate_ideas called
        # Then falls back to Bedrock

    def test_research_ideas_returns_job_id(self, service):
        # Given list of ideas
        # When research_ideas called
        # Then returns job ID and stores in DynamoDB

    def test_apply_style_transforms_content(self, service, mock_openai):
        # Given content and style
        # When apply_style called
        # Then returns styled content
```

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(backend): extract LLMService from llm Lambda

- Move OpenAI/Bedrock logic to service class
- Add dependency injection for clients
- Add comprehensive unit tests
```

---

### Task 4: Update Inter-Lambda Coupling

**Goal:** Replace brittle environment variable coupling for inter-Lambda invocation with explicit configuration.

**Files to Modify/Create:**
- `backend/lambdas/edge-processing/services/edge_service.py` - Update RAGStack invocation
- `backend/lambdas/edge-processing/config.py` - New config module
- `backend/template.yaml` - Verify environment variable setup
- `tests/backend/unit/test_edge_service.py` - Add tests for invocation

**Prerequisites:**
- Task 1 complete (EdgeService exists)

**Implementation Steps:**

1. Create config module that validates environment at import:
   ```python
   # config.py
   import os

   class Config:
       DYNAMODB_TABLE = os.environ.get('DYNAMODB_TABLE_NAME')
       RAGSTACK_FUNCTION = os.environ.get('RAGSTACK_PROXY_FUNCTION', '')

       @classmethod
       def validate(cls):
           if not cls.DYNAMODB_TABLE:
               raise ConfigurationError('DYNAMODB_TABLE_NAME required')

       @classmethod
       def has_ragstack(cls):
           return bool(cls.RAGSTACK_FUNCTION)
   ```

2. Update EdgeService to use config:
   - Constructor accepts optional `ragstack_function_name`
   - If not provided and `Config.has_ragstack()`, use config value
   - If no RAGStack configured, skip invocation (log warning)

3. Make invocation failure non-fatal:
   - Wrap Lambda invoke in try/except
   - Log error but don't fail main operation
   - Return success with warning flag

4. Update tests:
   - Test with RAGStack configured
   - Test with RAGStack not configured (skips invocation)
   - Test with RAGStack invocation failure (continues gracefully)

**Verification Checklist:**
- [ ] Config module validates required env vars
- [ ] EdgeService gracefully handles missing RAGStack config
- [ ] RAGStack invocation failure doesn't fail main operation
- [ ] Tests cover all configuration scenarios
- [ ] `npm run test:backend` passes

**Testing Instructions:**
```python
def test_ragstack_invocation_skipped_when_not_configured(service):
    # Given RAGStack function not configured
    # When create_edge called with trigger status
    # Then completes without Lambda invocation

def test_ragstack_invocation_failure_non_fatal(service, mock_lambda_client):
    # Given RAGStack invocation will fail
    # When create_edge called
    # Then edge created successfully
    # And warning logged
```

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

fix(backend): make inter-Lambda coupling resilient

- Add config module with validation
- Make RAGStack invocation optional and non-fatal
- Add comprehensive tests for config scenarios
```

---

### Task 5: Integration Tests for Refactored Lambdas

**Goal:** Add integration tests that verify handler → service flow works correctly.

**Files to Modify/Create:**
- `tests/backend/integration/test_edge_handler.py` - Edge processing handler tests
- `tests/backend/integration/test_profile_handler.py` - Profile processing handler tests
- `tests/backend/integration/test_llm_handler.py` - LLM handler tests

**Prerequisites:**
- Tasks 1-3 complete (all services refactored)

**Implementation Steps:**

1. Create integration tests that:
   - Call the actual `handler()` function
   - Use moto-mocked AWS services
   - Verify full request → response flow

2. Test scenarios for each Lambda:
   - **edge-processing:**
     - Create edge with valid data
     - Get connections returns formatted list
     - Invalid operation returns 400
     - Unauthorized returns 401

   - **profile-processing:**
     - Valid S3 event triggers processing
     - Invalid event returns error
     - Missing image returns 404

   - **llm:**
     - Generate ideas returns list
     - Apply style transforms content
     - Invalid request returns 400

3. Verify HTTP response format:
   - Status codes correct
   - Response body matches expected schema
   - Headers include CORS

**Verification Checklist:**
- [ ] Integration tests exist for all three refactored Lambdas
- [ ] Tests cover happy path and error cases
- [ ] Tests run with mocked AWS (no credentials needed)
- [ ] All tests pass in CI
- [ ] `npm run test:backend` passes

**Testing Instructions:**
- Run: `pytest tests/backend/integration/ -v`
- Verify: All tests pass
- CI: Verify GitHub Actions passes

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

test(backend): add integration tests for refactored Lambdas

- Test handler → service flow for edge-processing
- Test handler → service flow for profile-processing
- Test handler → service flow for llm
```

---

## Phase Verification

**All Phase 1 tasks are complete when:**

1. **EdgeService**
   - [ ] Service class extracted from 716-line handler
   - [ ] Handler < 150 lines
   - [ ] Conversion likelihood uses enum
   - [ ] Unit tests > 80% coverage
   - [ ] Integration tests pass

2. **ProfileProcessingService**
   - [ ] Service class extracted from 719-line handler
   - [ ] Handler < 100 lines
   - [ ] Processing stages independently testable
   - [ ] Unit tests > 80% coverage
   - [ ] Integration tests pass

3. **LLMService**
   - [ ] Service class extracted from 502-line handler
   - [ ] Handler < 120 lines
   - [ ] OpenAI/Bedrock clients injected
   - [ ] Unit tests > 80% coverage
   - [ ] Integration tests pass

4. **Inter-Lambda Coupling**
   - [ ] Config module validates environment
   - [ ] RAGStack invocation optional and non-fatal
   - [ ] Tests cover configuration scenarios

**Run final verification:**
```bash
# All backend tests must pass
npm run test:backend

# Lint must pass
npm run lint:backend

# Line counts (approximate targets)
wc -l backend/lambdas/edge-processing/lambda_function.py       # < 150
wc -l backend/lambdas/profile-processing/lambda_function.py    # < 100
wc -l backend/lambdas/llm/lambda_function.py                   # < 120
```

---

## Known Limitations

- Conversion likelihood enum changes API response format (frontend update needed)
- Moto may not perfectly simulate Textract/Bedrock (some tests may need request-mock)
- Async research jobs in LLM Lambda maintain existing DynamoDB storage pattern

---

## Handoff to Phase 2

Phase 1 refactors backend. Phase 2 completes remediation by:
1. Fixing TypeScript type safety in `useConnections.ts`
2. Adding frontend tests for connection hooks
3. Updating frontend to handle enum conversion_likelihood
4. Comprehensive test coverage across frontend

---

## Review Feedback (Iteration 1)

### Handler Line Counts - All Exceed Targets

> **Consider:** The Phase Verification section (lines 656-658) specifies these targets:
> - `edge-processing/lambda_function.py` should be **< 150 lines** (currently **205 lines**)
> - `profile-processing/lambda_function.py` should be **< 100 lines** (currently **171 lines**)
> - `llm/lambda_function.py` should be **< 120 lines** (currently **192 lines**)
>
> **Think about:** Looking at `edge-processing/lambda_function.py`, is there routing/operation-dispatch code that could be moved to the service layer? Could helper functions like `_parse_body()` and `_extract_user_id()` be simplified or consolidated?
>
> **Reflect:** The service classes are substantial (596, 454, 455 lines respectively). Could more handler logic be delegated there? Review lines 95-205 of the edge-processing handler - how much is routing vs. actual business logic that belongs in the service?

### Task 5: Missing Integration Tests

> **Consider:** Task 5 (lines 550-613) requires integration tests for **all three refactored Lambdas**:
> - `tests/backend/integration/test_edge_handler.py` ✓ (exists as `test_edge_service_integration.py`)
> - `tests/backend/integration/test_profile_handler.py` ✗ (missing)
> - `tests/backend/integration/test_llm_handler.py` ✗ (missing)
>
> **Think about:** The plan specifies testing "handler → service flow" for profile-processing and llm. Can you follow the same pattern used in `test_edge_service_integration.py` to add integration tests for the other two Lambdas?
>
> **Reflect:** Task 5's verification checklist item "Integration tests exist for all three refactored Lambdas" is not satisfied. What scenarios should these tests cover? (See lines 576-584 for guidance)

### What's Working Well ✓

- All 116 tests pass (47 new service-specific tests)
- Lint passes: `npm run lint:backend` clean
- Service classes properly created with dependency injection
- ConversionLikelihood enum implemented with classification function
- Config module exists with `is_ragstack_configured()` method
- Commit messages follow conventional format
- EdgeService integration tests are comprehensive
