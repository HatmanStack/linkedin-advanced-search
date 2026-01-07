# Phase 1: RAGStack Deployment & Ingestion Pipeline

## Phase Goal

Deploy a dedicated RAGStack instance and build the ingestion pipeline that populates it with LinkedIn profiles. By the end of this phase, profiles will be automatically ingested into RAGStack when connections are established.

**Success Criteria:**
- RAGStack stack deployed and accessible
- Profiles ingested on connection request, follow, and profile-init
- Markdown generation from profile data working
- Ingestion status tracked in DynamoDB
- All tests passing with mocked RAGStack

**Estimated Tokens:** ~45,000

---

## Prerequisites

- Phase 0 documentation reviewed
- AWS CLI configured with appropriate permissions
- Bedrock Nova Embeddings access enabled in target region
- RAGStack-Lambda repository cloned to `~/war/RAGStack-Lambda/`

---

## Tasks

### Task 1: Puppeteer Test Infrastructure

**Goal:** Set up Vitest testing framework in puppeteer package to enable unit testing for new code.

**Files to Create:**
- `puppeteer/vitest.config.js` - Vitest configuration
- `puppeteer/src/setupTests.js` - Test setup file

**Files to Modify:**
- `puppeteer/package.json` - Add test scripts and devDependencies
- `.github/workflows/ci.yml` - Add puppeteer test job

**Prerequisites:**
- None (foundational task)

**Implementation Steps:**

1. Install Vitest and related packages:
   - `vitest` as devDependency
   - `@vitest/coverage-v8` for coverage reports

2. Create Vitest configuration:
   - ES modules environment (matches puppeteer's type: module)
   - Include pattern: `src/**/*.test.js`
   - Setup file for common mocks

3. Add package.json scripts:
   ```json
   {
     "test": "vitest run",
     "test:watch": "vitest",
     "test:coverage": "vitest run --coverage"
   }
   ```

4. Create setup file with common mocks:
   - Mock logger to suppress output during tests
   - Mock Puppeteer browser/page objects
   - Mock axios for HTTP calls

5. Update CI workflow:
   - Add `npm test` step to puppeteer job
   - Run after lint step

**Verification Checklist:**
- [ ] `npm test` runs without errors (even with no tests)
- [ ] Vitest config loads correctly
- [ ] Setup file executes
- [ ] CI workflow includes test step
- [ ] Coverage report generates

**Testing Instructions:**
- Create a simple smoke test to verify setup works
- Run `npm test` locally
- Verify CI passes with new test step

**Commit Message Template:**
```
chore(puppeteer): add Vitest test infrastructure

- Configure Vitest for ES modules
- Add test scripts to package.json
- Create setup file with common mocks
- Update CI workflow
```

---

### Task 2: RAGStack Deployment Script

**Goal:** Create automated deployment script for the dedicated RAGStack instance that prompts for configuration, persists settings locally, and captures outputs.

**Files to Create:**
- `scripts/deploy/deploy-ragstack.js` - Main deployment orchestration
- `.gitignore` addition for config files

**Prerequisites:**
- RAGStack-Lambda repository available
- AWS SAM CLI installed

**Implementation Steps:**

1. Create the deployment script that:
   - Checks for existing `.ragstack-config.json`
   - Prompts user interactively for missing values (stack name, region, S3 bucket prefix)
   - Validates AWS credentials and Bedrock model access
   - Generates `samconfig.toml` programmatically for RAGStack-Lambda
   - Executes `sam build` and `sam deploy` in RAGStack directory
   - Parses CloudFormation outputs after deployment
   - Writes outputs to `.env.ragstack`

2. Configuration schema to collect:
   - Stack name (default: `linkedin-profiles-kb`)
   - AWS region (default: `us-west-2`)
   - Path to RAGStack-Lambda repo
   - S3 bucket name for documents

3. Output capture:
   - GraphQL endpoint URL (from AppSync)
   - API key value (retrieve via AWS CLI after deployment)
   - Knowledge Base ID
   - Text Data Source ID

4. Add config files to `.gitignore`:
   - `.ragstack-config.json`
   - `.env.ragstack`

**Verification Checklist:**
- [ ] Script prompts for missing configuration
- [ ] Configuration persisted to `.ragstack-config.json`
- [ ] `samconfig.toml` generated without interactive prompts
- [ ] RAGStack stack deploys successfully
- [ ] `.env.ragstack` contains all required values
- [ ] Subsequent runs skip prompts and use saved config

**Testing Instructions:**
- Unit test configuration loading/saving logic
- Unit test samconfig.toml generation
- Mock AWS CLI calls for deployment simulation
- Integration test requires manual execution (not CI)

**Commit Message Template:**
```
feat(infra): add RAGStack deployment script

- Interactive config collection with persistence
- Programmatic samconfig.toml generation
- Output capture to .env.ragstack
```

---

### Task 3: Profile Markdown Generator

**Goal:** Create utility to convert structured profile JSON into well-formatted markdown suitable for RAGStack ingestion.

**Files to Create:**
- `puppeteer/src/domains/profile/utils/profileMarkdownGenerator.js` - Generator function
- `puppeteer/src/domains/profile/utils/profileMarkdownGenerator.test.js` - Unit tests

**Prerequisites:**
- Task 1 complete (Vitest infrastructure)
- Understanding of `puppeteer/schemas/profileTextSchema.js` structure
- Understanding of RAGStack markdown ingestion format

**Implementation Steps:**

1. Create generator function that accepts profile object matching `profileTextSchema`:
   ```javascript
   function generateProfileMarkdown(profile) {
     // Returns formatted markdown string
   }
   ```

2. Markdown structure to generate:
   - H1 header with full name
   - Metadata block (headline, location, profile ID)
   - About section (if present)
   - Current position section
   - Experience section with each role as H3
   - Education section with each school as H3
   - Skills as comma-separated list

3. Handle missing/optional fields gracefully:
   - Omit sections entirely if data not present
   - Use "Not specified" for required fields with no data
   - Truncate extremely long text (about > 5000 chars)

4. Include profile ID in metadata for correlation:
   - Profile ID must be in document for source attribution
   - Use same base64 encoding as DynamoDB

5. Export function for use in ingestion pipeline

**Verification Checklist:**
- [ ] Generates valid markdown from complete profile
- [ ] Handles profiles with missing optional fields
- [ ] Profile ID included in output
- [ ] Skills formatted as searchable list
- [ ] Experience entries ordered chronologically
- [ ] Output is valid markdown (no broken formatting)

**Testing Instructions:**

Unit tests covering:
- Complete profile with all fields populated
- Minimal profile (only required fields)
- Profile with empty arrays (no experience, no education)
- Profile with very long about section (truncation)
- Profile with special characters in text
- Profile ID encoding consistency

```javascript
// Test pattern
describe('generateProfileMarkdown', () => {
  it('should generate markdown for complete profile', () => {
    const profile = createMockProfile({ /* all fields */ });
    const markdown = generateProfileMarkdown(profile);
    expect(markdown).toContain('# John Doe');
    expect(markdown).toContain('**Headline:**');
    expect(markdown).toContain('## Experience');
  });
});
```

**Commit Message Template:**
```
feat(puppeteer): add profile markdown generator

- Converts profile JSON to RAGStack-compatible markdown
- Handles optional fields gracefully
- Includes profile ID for source correlation
```

---

### Task 4: RAGStack Client Library

**Goal:** Create a Python client for RAGStack GraphQL API to be used by Lambda functions for ingestion and search operations.

**Files to Create:**
- `backend/lambdas/ragstack-proxy/ragstack_client.py` - GraphQL client
- `tests/backend/unit/test_ragstack_client.py` - Unit tests

**Prerequisites:**
- RAGStack GraphQL schema understanding
- API key authentication pattern

**Implementation Steps:**

1. Create client class with methods:
   - `__init__(endpoint, api_key)` - Initialize with config
   - `create_upload_url(filename)` - Get presigned URL for document upload
   - `search(query, max_results=100)` - Search knowledge base
   - `get_document_status(document_id)` - Check ingestion status

2. GraphQL operations to implement:

   ```graphql
   mutation CreateUploadUrl($filename: String!) {
     createUploadUrl(filename: $filename) {
       uploadUrl
       documentId
       fields
     }
   }

   query SearchKnowledgeBase($query: String!, $maxResults: Int) {
     searchKnowledgeBase(query: $query, maxResults: $maxResults) {
       results {
         content
         source
         score
       }
     }
   }
   ```

3. HTTP client setup:
   - Use `requests` library for HTTP calls
   - Set `x-api-key` header for authentication
   - Handle GraphQL errors and network failures
   - Implement retry logic with exponential backoff

4. Response parsing:
   - Extract data from GraphQL response envelope
   - Transform to simple Python dicts
   - Raise typed exceptions for errors

**Verification Checklist:**
- [ ] Client initializes with endpoint and API key
- [ ] `create_upload_url` returns presigned URL structure
- [ ] `search` returns list of results with source IDs
- [ ] GraphQL errors raise appropriate exceptions
- [ ] Network errors handled with retry
- [ ] API key included in all requests

**Testing Instructions:**

Unit tests with mocked HTTP responses:
```python
def test_search_returns_results(mock_requests):
    mock_requests.post.return_value.json.return_value = {
        "data": {
            "searchKnowledgeBase": {
                "results": [{"content": "...", "source": "abc", "score": 0.9}]
            }
        }
    }
    client = RAGStackClient("https://api.example.com", "api-key")
    results = client.search("test query")
    assert len(results) == 1
    assert results[0]["source"] == "abc"
```

Test scenarios:
- Successful search with results
- Search with no results (empty array)
- GraphQL error response
- Network timeout with retry
- Invalid API key (401 response)

**Commit Message Template:**
```
feat(backend): add RAGStack GraphQL client

- Implements search and upload URL mutations
- API key authentication
- Retry logic for transient failures
```

---

### Task 5: Profile Ingestion Service

**Goal:** Create service that uploads profile markdown to RAGStack, triggered when connections are established.

**Files to Create:**
- `backend/lambdas/ragstack-proxy/ingestion_service.py` - Ingestion logic
- `tests/backend/unit/test_ingestion_service.py` - Unit tests

**Prerequisites:**
- Task 4 (RAGStack client) complete
- Understanding of S3 presigned URL upload pattern

**Implementation Steps:**

1. Create ingestion service with methods:
   - `ingest_profile(profile_id, markdown_content, metadata)` - Main entry point
   - `_upload_to_s3(presigned_url, fields, content)` - Upload via presigned URL
   - `_wait_for_indexing(document_id, timeout=60)` - Poll for completion

2. Ingestion flow:
   ```
   1. Call ragstack_client.create_upload_url(f"{profile_id}.md")
   2. Upload markdown content to presigned S3 URL
   3. Optionally wait for indexing to complete
   4. Return document_id and status
   ```

3. Metadata to include:
   - `profile_id` - Base64 encoded LinkedIn URL
   - `user_id` - Owner's Cognito sub
   - `ingested_at` - ISO timestamp
   - `source` - "linkedin_profile"

4. Error handling:
   - S3 upload failures → retry with backoff
   - Indexing timeout → return pending status (don't fail)
   - Document already exists → skip (idempotent)

5. Idempotency:
   - Use profile_id as document_id
   - Re-ingesting same profile updates existing document

**Verification Checklist:**
- [ ] Markdown uploaded to presigned S3 URL
- [ ] Document ID derived from profile ID
- [ ] Metadata attached to document
- [ ] Handles upload failures gracefully
- [ ] Idempotent for repeated ingestion
- [ ] Returns status (indexed, pending, failed)

**Testing Instructions:**

Unit tests with mocked dependencies:
```python
def test_ingest_profile_uploads_markdown(mock_ragstack_client, mock_requests):
    mock_ragstack_client.create_upload_url.return_value = {
        "uploadUrl": "https://s3.example.com/upload",
        "documentId": "doc123",
        "fields": {}
    }
    mock_requests.post.return_value.status_code = 204

    service = IngestionService(mock_ragstack_client)
    result = service.ingest_profile("profile_abc", "# Test", {})

    assert result["status"] == "uploaded"
    mock_requests.post.assert_called_once()
```

Test scenarios:
- Successful ingestion end-to-end
- S3 upload failure with retry
- Presigned URL generation failure
- Metadata correctly attached
- Duplicate ingestion (idempotency)

**Commit Message Template:**
```
feat(backend): add profile ingestion service

- Uploads markdown to RAGStack via presigned URLs
- Supports metadata attachment
- Idempotent profile updates
```

---

### Task 6: RAGStack Proxy Lambda

**Goal:** Create Lambda function that proxies search and ingestion requests to RAGStack, keeping API key secure on backend.

**Files to Create:**
- `backend/lambdas/ragstack-proxy/index.py` - Lambda handler
- `backend/lambdas/ragstack-proxy/requirements.txt` - Dependencies

**Files to Modify:**
- `backend/template.yaml` - Add new Lambda resource

**Prerequisites:**
- Tasks 4-5 complete (client and ingestion service)
- Understanding of existing Lambda patterns in backend

**Implementation Steps:**

1. Create Lambda handler with operations:
   - `search` - Search profiles in knowledge base
   - `ingest` - Ingest a profile (internal use)
   - `status` - Check ingestion status

2. Handler structure:
   ```python
   def handler(event, context):
       operation = event.get("operation")
       if operation == "search":
           return handle_search(event)
       elif operation == "ingest":
           return handle_ingest(event)
       elif operation == "status":
           return handle_status(event)
       else:
           return {"statusCode": 400, "body": "Unknown operation"}
   ```

3. Environment variables required:
   - `RAGSTACK_GRAPHQL_ENDPOINT`
   - `RAGSTACK_API_KEY` (from Secrets Manager or SSM)

4. Request validation:
   - Verify JWT token present
   - Extract user_id from claims
   - Validate required fields per operation

5. Response format:
   ```json
   {
     "statusCode": 200,
     "body": {
       "results": [...],
       "totalResults": 10
     }
   }
   ```

6. SAM template additions:
   - New `RAGStackProxyFunction` resource
   - API Gateway route: `POST /ragstack`
   - IAM permissions for Secrets Manager/SSM
   - Environment variable references

**Verification Checklist:**
- [ ] Lambda handles search operation
- [ ] Lambda handles ingest operation
- [ ] API key retrieved from secure storage
- [ ] JWT validation enforced
- [ ] User ID extracted from claims
- [ ] Error responses properly formatted
- [ ] SAM template valid (`sam validate`)

**Testing Instructions:**

Unit tests with mocked services:
```python
def test_search_operation(mock_ragstack_client):
    event = {
        "operation": "search",
        "query": "software engineer",
        "maxResults": 10,
        "requestContext": {
            "authorizer": {"claims": {"sub": "user123"}}
        }
    }
    response = handler(event, None)
    assert response["statusCode"] == 200
    assert "results" in json.loads(response["body"])
```

Test scenarios:
- Search with valid query
- Search with missing query (validation error)
- Ingest with valid profile data
- Missing JWT token (401)
- RAGStack API failure (502)

**Commit Message Template:**
```
feat(backend): add RAGStack proxy Lambda

- Secure proxy for RAGStack GraphQL API
- Supports search and ingest operations
- API key stored in Secrets Manager
```

---

### Task 7: Edge Processing Ingestion Trigger

**Goal:** Modify edge-processing Lambda to trigger profile ingestion when connection status changes to indicate an established relationship.

**Files to Modify:**
- `backend/lambdas/edge-processing/lambda_function.py` - Add ingestion trigger

**Prerequisites:**
- Task 6 complete (proxy Lambda deployed)
- Understanding of existing edge-processing logic

**Implementation Steps:**

1. Identify trigger points in edge-processing:
   - When status changes to `outgoing` (connection request sent)
   - When status changes to `ally` (connection accepted)
   - When status changes to `followed` (new status to add)

2. Add ingestion logic after edge upsert:
   ```python
   if new_status in ['outgoing', 'ally', 'followed']:
       trigger_profile_ingestion(profile_id, user_id)
   ```

3. Fetch profile data for ingestion:
   - Query profile metadata from DynamoDB
   - Generate markdown from profile data
   - Call RAGStack proxy for ingestion

4. Handle ingestion failures gracefully:
   - Log errors but don't fail edge operation
   - Profile can be re-ingested later
   - Consider SQS queue for async retry

5. Track ingestion status:
   - Add `ragstack_ingested` flag to edge record
   - Store `ragstack_document_id` for reference
   - Update on successful ingestion

6. Add `followed` status to connection status enum if not present

**Verification Checklist:**
- [ ] Ingestion triggered on `outgoing` status
- [ ] Ingestion triggered on `ally` status
- [ ] Ingestion triggered on `followed` status
- [ ] Profile data fetched from DynamoDB
- [ ] Markdown generated correctly
- [ ] Ingestion failure doesn't fail edge operation
- [ ] `ragstack_ingested` flag updated

**Testing Instructions:**

Unit tests with mocked dependencies:
```python
def test_edge_upsert_triggers_ingestion(mock_dynamodb, mock_ragstack_proxy):
    # Setup: profile exists in DynamoDB
    mock_dynamodb.get_item.return_value = {"Item": {"name": "John"}}

    # Execute: upsert edge to 'outgoing'
    handler({"operation": "upsert_status", "profileId": "abc", "status": "outgoing"}, None)

    # Verify: ingestion triggered
    mock_ragstack_proxy.ingest.assert_called_once()
```

Test scenarios:
- Status change to `outgoing` triggers ingestion
- Status change to `ally` triggers ingestion
- Status change to `processed` does NOT trigger
- Profile not found in DynamoDB (skip ingestion)
- Ingestion failure logged but edge succeeds

**Commit Message Template:**
```
feat(backend): trigger RAGStack ingestion on connection events

- Ingest profiles when connection request sent
- Ingest when connection accepted
- Track ingestion status in edge record
```

---

### Task 8: Profile Init Ingestion

**Goal:** Modify profile initialization flow to ingest existing connections into RAGStack during initial database setup.

**Files to Modify:**
- `puppeteer/src/domains/profile/services/profileInitService.js` - Add ingestion call

**Prerequisites:**
- Task 6 complete (proxy Lambda available)
- Task 3 complete (markdown generator)
- Understanding of profile-init workflow

**Implementation Steps:**

1. Identify integration point in `ProfileInitService`:
   - After profile is processed and stored in DynamoDB
   - Before moving to next profile in batch

2. Add ingestion call:
   ```javascript
   // After successful profile processing
   if (connectionType !== 'possible') {
     await this.triggerRAGStackIngestion(profileId, profileData);
   }
   ```

3. Create ingestion trigger method:
   - Generate markdown using `profileMarkdownGenerator`
   - Call RAGStack proxy Lambda via HTTP
   - Handle failures gracefully (log, don't fail init)

4. Batch consideration:
   - Profile init processes many profiles
   - Consider async ingestion (fire and forget)
   - Or batch ingestion requests

5. Skip already-ingested profiles:
   - Check `ragstack_ingested` flag before ingesting
   - Avoid duplicate ingestion during re-init

**Verification Checklist:**
- [ ] Ally connections ingested during init
- [ ] Incoming connections ingested during init
- [ ] Outgoing connections ingested during init
- [ ] Possible connections NOT ingested
- [ ] Already-ingested profiles skipped
- [ ] Init workflow completes despite ingestion failures

**Testing Instructions:**

Unit tests with mocked services:
```javascript
describe('ProfileInitService', () => {
  it('should trigger ingestion for ally connections', async () => {
    const mockIngest = vi.fn().mockResolvedValue({ status: 'success' });
    const service = new ProfileInitService({ ingestProfile: mockIngest });

    await service.processProfile(profileId, 'ally');

    expect(mockIngest).toHaveBeenCalledWith(profileId, expect.any(String));
  });

  it('should not trigger ingestion for possible connections', async () => {
    const mockIngest = vi.fn();
    const service = new ProfileInitService({ ingestProfile: mockIngest });

    await service.processProfile(profileId, 'possible');

    expect(mockIngest).not.toHaveBeenCalled();
  });
});
```

**Commit Message Template:**
```
feat(puppeteer): ingest existing connections during profile init

- Trigger RAGStack ingestion for ally/incoming/outgoing
- Skip possible contacts
- Graceful failure handling
```

---

### Task 9: Follow Profile Functionality

**Goal:** Implement follow functionality that triggers RAGStack ingestion, similar to connection requests.

**Files to Modify:**
- `puppeteer/src/domains/linkedin/services/linkedinInteractionService.js` - Add follow method
- `puppeteer/routes/linkedinInteractionRoutes.js` - Add route
- `puppeteer/src/domains/linkedin/controllers/linkedinInteractionController.js` - Add controller method

**Prerequisites:**
- Understanding of existing connection request flow
- LinkedIn follow button selectors identified

**Implementation Steps:**

1. Add route for follow operation:
   ```javascript
   router.post('/linkedin-interactions/follow', controller.followProfile);
   ```

2. Add controller method:
   - Validate request (profileId, JWT)
   - Enqueue to interaction queue
   - Return async response

3. Add service method `followProfile(profileId, jwtToken)`:
   - Navigate to profile
   - Find and click follow button
   - Verify follow succeeded
   - Create edge with status `followed`
   - Trigger RAGStack ingestion

4. LinkedIn follow button selectors:
   - Primary: `button[aria-label*="Follow"]`
   - Fallback: `button:has-text("Follow")`
   - Verify not already following

5. Error handling:
   - Already following → success (idempotent)
   - Follow button not found → error
   - LinkedIn rate limit → queue for retry

6. Edge creation:
   - Status: `followed`
   - This triggers ingestion via Task 6 logic

**Verification Checklist:**
- [ ] Follow route accessible
- [ ] Profile navigated correctly
- [ ] Follow button clicked
- [ ] Edge created with `followed` status
- [ ] RAGStack ingestion triggered
- [ ] Idempotent for already-followed profiles
- [ ] Errors handled gracefully

**Testing Instructions:**

Unit tests with mocked Puppeteer:
```javascript
describe('followProfile', () => {
  it('should click follow button and create edge', async () => {
    const mockPage = createMockPage({
      followButton: true,
      alreadyFollowing: false
    });

    await service.followProfile('profile123', 'jwt-token');

    expect(mockPage.click).toHaveBeenCalledWith(expect.stringContaining('Follow'));
    expect(mockDynamoDB.upsertEdge).toHaveBeenCalledWith('profile123', 'followed');
  });
});
```

**Commit Message Template:**
```
feat(puppeteer): add follow profile functionality

- New endpoint for following LinkedIn profiles
- Creates edge with 'followed' status
- Triggers RAGStack ingestion
```

---

## Phase Verification

This phase is complete when:

- [ ] RAGStack deployment script works end-to-end
- [ ] `.env.ragstack` contains valid credentials
- [ ] Profile markdown generator produces valid output
- [ ] RAGStack client can search and upload
- [ ] Proxy Lambda deployed and accessible
- [ ] Edge processing triggers ingestion on status changes
- [ ] Profile init ingests existing connections
- [ ] Follow functionality works and triggers ingestion
- [ ] All unit tests pass
- [ ] Integration tests pass with mocked RAGStack

**Manual Verification:**
1. Deploy RAGStack via `npm run deploy:ragstack`
2. Run profile init for a few existing connections
3. Verify profiles appear in RAGStack (via GraphQL explorer or search)
4. Send a connection request, verify ingestion triggered
5. Follow a profile, verify ingestion triggered

---

## Known Limitations

1. **Async ingestion** - Ingestion is fire-and-forget; failures logged but not retried automatically
2. **No re-ingestion trigger** - Profile updates in DynamoDB don't trigger re-ingestion
3. **Follow selectors** - LinkedIn follow button selectors may need maintenance
4. **Batch limits** - Large profile-init may hit RAGStack rate limits
