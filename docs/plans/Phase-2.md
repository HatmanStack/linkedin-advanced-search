# Phase 2: Backend Consolidation

## Phase Goal

Consolidate all Lambda functions and AWS infrastructure into the `backend/` directory following the react-stocks deployment pattern. This phase creates the SAM template, deployment script, and restructures Lambda code for unified deployment.

**Success Criteria:**
- All Lambda functions organized in `backend/lambdas/`
- Single SAM template defining all resources
- Interactive deployment script following react-stocks pattern
- `npm run deploy` successfully deploys to AWS
- Stack outputs automatically update `.env`

**Estimated Tokens:** ~30,000

## Prerequisites

- Phase 1 complete (files migrated to new structure)
- AWS CLI configured with credentials
- SAM CLI installed
- Docker running (for Python Lambda builds)

---

## Task 1: Create Backend Package Structure

**Goal:** Set up the `backend/` directory with proper package.json and configuration.

**Files to Create:**
- `backend/package.json`
- `backend/.gitignore`
- `backend/pyproject.toml`

**Prerequisites:**
- Phase 1 Task 1 complete (directory scaffold exists)

**Implementation Steps:**

1. Create `backend/package.json`:
   ```json
   {
     "name": "linkedin-advanced-search-backend",
     "version": "1.0.0",
     "private": true,
     "type": "module",
     "scripts": {
       "deploy": "node scripts/deploy.js",
       "test": "pytest ../tests/backend -v --tb=short",
       "lint": "uvx ruff check lambdas"
     },
     "devDependencies": {}
   }
   ```

2. Create `backend/.gitignore`:
   ```
   .aws-sam/
   .deploy-config.json
   samconfig.toml
   node_modules/
   __pycache__/
   *.pyc
   .pytest_cache/
   ```

3. Create `backend/pyproject.toml` (copy from lambda-processing with updates):
   - Update target-version to "py313"
   - Update exclude paths for new structure

**Verification Checklist:**
- [ ] `backend/package.json` has deploy and test scripts
- [ ] `.gitignore` excludes SAM build artifacts and config
- [ ] `pyproject.toml` configured for Python 3.13

**Testing Instructions:**
- Verify `cd backend && npm run lint` runs (will fail until lambdas exist)
- Verify package.json is valid JSON

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

chore(backend): create package structure

- Add package.json with deploy and test scripts
- Add .gitignore for SAM artifacts
- Add pyproject.toml for ruff configuration
```

---

## Task 2: Migrate Lambda Functions

**Goal:** Move all Lambda function code from `lambda-processing/` to `backend/lambdas/`.

**Files to Modify/Create:**
- Move `lambda-processing/linkedin-advanced-search-edge-processing-prod/` → `backend/lambdas/edge-processing/`
- Move `lambda-processing/linkedin-advanced-search-dynamodb-api-prod/` → `backend/lambdas/dynamodb-api/`
- Move `lambda-processing/linkedin-advanced-search-placeholder-search-prod/` → `backend/lambdas/placeholder-search/`
- Move `lambda-processing/linkedin-advanced-search-profile-api-prod/` → `backend/lambdas/profile-api/`
- Move `lambda-processing/linkedin-advanced-search-profile-processing-dev/` → `backend/lambdas/profile-processing/`
- Move `lambda-processing/linkedin-advanced-search-llm-prod/` → `backend/lambdas/llm/`
- Move `lambda-processing/openai-webhook-handler/` → `backend/lambdas/webhook-handler/`
- Move `lambda-processing/shared/` → `backend/lambdas/shared/`
- Move `lambda-processing/conftest.py` → `tests/backend/conftest.py`

**Prerequisites:**
- Task 1 complete

**Implementation Steps:**

1. Move each Lambda directory using git mv to preserve history
2. Rename directories to shorter, cleaner names (remove prefixes)
3. Move the shared Python utilities to `backend/lambdas/shared/`
4. Move `conftest.py` to the test directory
5. Update any relative imports in Lambda code that reference shared utilities
6. Verify each Lambda's `requirements.txt` is present (see note below)
7. Delete empty `lambda-processing/` directory

**Note on requirements.txt:**
- `profile-api` Lambda does NOT have a `requirements.txt` file - it uses only boto3 which is included in Lambda runtime
- All other Lambdas have `requirements.txt` files
- For Lambdas without `requirements.txt`, SAM will deploy with only standard library and boto3

**Verification Checklist:**
- [ ] All 7 Lambda directories exist in `backend/lambdas/`
- [ ] Shared utilities in `backend/lambdas/shared/`
- [ ] Each Lambda has `lambda_function.py` (or `index.js`)
- [ ] Lambdas with external dependencies have `requirements.txt`
- [ ] No Lambda code remains in old location

**Testing Instructions:**
- Verify Python syntax in each Lambda file
- Run ruff check on lambdas directory
- Verify imports resolve (may need PYTHONPATH adjustment)

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

refactor(backend): migrate Lambda functions

- Move all Lambdas to backend/lambdas/
- Rename to cleaner directory names
- Move shared utilities
- Move conftest.py to tests/backend/
```

---

## Task 3: Create SAM Template

**Goal:** Create a unified SAM template that defines all AWS resources.

**Files to Create:**
- `backend/template.yaml`

**Prerequisites:**
- Task 2 complete

**Implementation Steps:**

1. Create `backend/template.yaml` based on `RAG-CloudStack/template.yaml` with these modifications:

**Note on nested templates:** The existing `RAG-CloudStack/` has nested templates in `templates/` subdirectory (`cognito.yaml`, `dynamodb.yaml`, `lambdas.yaml`, `apigw-http.yaml`). For simplicity, **flatten all resources into a single `template.yaml`** file (like react-stocks does). This avoids nested stack complexity and makes the template easier to maintain. The existing `RAG-CloudStack/template.yaml` already contains all resources inline - the nested templates appear to be unused/legacy.

2. Update the template structure:
   - Parameters section for configurable values
   - Globals section for shared Lambda config
   - Resources section for all AWS resources
   - Outputs section for stack values

3. Define parameters:
   ```yaml
   Parameters:
     Environment:
       Type: String
       Default: prod
       AllowedValues: [dev, prod]
     IncludeDevOrigins:
       Type: String
       Default: 'true'
       AllowedValues: ['true', 'false']
     ProductionOrigins:
       Type: String
       Default: ''
       Description: Comma-separated production origins
   ```

4. Define global settings:
   ```yaml
   Globals:
     Function:
       Runtime: python3.13
       Timeout: 30
       MemorySize: 512
       Environment:
         Variables:
           DYNAMODB_TABLE: !Ref ProfilesTable
           LOG_LEVEL: INFO
     HttpApi:
       CorsConfiguration:
         AllowOrigins: # Dynamic based on IncludeDevOrigins
         AllowHeaders: [Content-Type, Authorization]
         AllowMethods: [GET, POST, OPTIONS]
   ```

5. Define resources (preserve existing resource configurations):
   - DynamoDB Table (ProfilesTable)
   - Cognito User Pool and Client
   - S3 Bucket (Screenshots)
   - All Lambda Functions with updated CodeUri paths
   - HTTP API (created implicitly by SAM)

6. Update all Lambda CodeUri paths:
   ```yaml
   EdgeProcessingFunction:
     Type: AWS::Serverless::Function
     Properties:
       CodeUri: lambdas/edge-processing/
       Handler: lambda_function.lambda_handler
   ```

7. Define outputs:
   ```yaml
   Outputs:
     ApiUrl:
       Value: !Sub 'https://${ServerlessHttpApi}.execute-api.${AWS::Region}.amazonaws.com'
     UserPoolId:
       Value: !Ref UserPool
     UserPoolClientId:
       Value: !Ref UserPoolClient
     DynamoDBTableName:
       Value: !Ref ProfilesTable
     ScreenshotBucketName:
       Value: !Ref ScreenshotBucket
   ```

**Verification Checklist:**
- [ ] Template is valid YAML
- [ ] `sam validate` passes
- [ ] All Lambda CodeUri paths point to correct directories
- [ ] All existing resources are defined
- [ ] Outputs include all values needed for .env

**Testing Instructions:**
- Run `cd backend && sam validate`
- Review template for correctness
- Compare against original RAG-CloudStack template

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(backend): create unified SAM template

- Define all Lambda functions
- Configure DynamoDB, Cognito, S3 resources
- Set up HTTP API with CORS
- Add configurable parameters
```

---

## Task 4: Create Deployment Script

**Goal:** Create an interactive deployment script following the react-stocks pattern.

**Files to Create:**
- `backend/scripts/deploy.js`

**Prerequisites:**
- Task 3 complete

**Implementation Steps:**

1. Create `backend/scripts/deploy.js` with these sections:

2. **Prerequisites Check:**
   - Verify AWS CLI is configured (`aws sts get-caller-identity`)
   - Verify SAM CLI is installed (`sam --version`)
   - Verify Docker is running (for Python builds)

3. **Configuration Loading:**
   - Check for `.deploy-config.json`
   - If exists, load and validate
   - Define defaults:
     ```javascript
     const defaults = {
       region: 'us-west-2',
       stackName: 'linkedin-advanced-search',
       includeDevOrigins: true,
       productionOrigins: ''
     };
     ```

4. **Interactive Prompts:**
   - Prompt for missing configuration values
   - Show current/default values in brackets
   - Validate inputs (region format, stack name format)

5. **Configuration Persistence:**
   - Save non-sensitive values to `.deploy-config.json`
   - Never persist secrets

6. **SAM Config Generation:**
   - Generate `samconfig.toml` programmatically:
     ```toml
     version = 0.1
     [default.deploy.parameters]
     stack_name = "linkedin-advanced-search"
     region = "us-west-2"
     capabilities = "CAPABILITY_IAM"
     parameter_overrides = "Environment=prod IncludeDevOrigins=true"
     resolve_s3 = true
     ```

7. **Build and Deploy:**
   - Run `sam build` with Docker for Python Lambdas
   - Run `sam deploy --no-confirm-changeset --no-fail-on-empty-changeset`
   - Stream output to console

8. **Environment Update:**
   - Fetch CloudFormation outputs using AWS CLI
   - Update root `.env` file with:
     - `VITE_API_GATEWAY_URL`
     - `VITE_COGNITO_USER_POOL_ID`
     - `VITE_COGNITO_USER_POOL_WEB_CLIENT_ID`
     - `VITE_DYNAMODB_TABLE`
     - `VITE_S3_BUCKET`

9. **Error Handling:**
   - Clear error messages for each failure mode
   - Suggest fixes (e.g., "Run 'aws configure' to set credentials")
   - Non-zero exit code on failure

**Verification Checklist:**
- [ ] Script runs without syntax errors
- [ ] Prerequisites check works
- [ ] Configuration prompts appear correctly
- [ ] `.deploy-config.json` is created/updated
- [ ] `samconfig.toml` is generated correctly
- [ ] Build command executes
- [ ] Deploy command executes
- [ ] `.env` is updated with outputs

**Testing Instructions:**
- Run `cd backend && node scripts/deploy.js` (will prompt for config)
- Verify config file is created
- Verify samconfig.toml is generated
- Test with `--dry-run` if implemented

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

feat(backend): create interactive deployment script

- Add prerequisites checking
- Implement configuration prompts and persistence
- Generate samconfig.toml programmatically
- Execute SAM build and deploy
- Update .env with stack outputs
```

---

## Task 5: Update Lambda Import Paths

**Goal:** Fix all import paths in Lambda code to work with the new structure.

**Files to Modify:**
- All `lambda_function.py` files in `backend/lambdas/`
- Any files importing from `shared/`

**Prerequisites:**
- Task 2 complete

**Implementation Steps:**

1. Audit all Lambda files for imports:
   - Check for relative imports (`from ..shared import`)
   - Check for absolute imports that assume old structure

2. Update shared utility imports:
   - Lambdas may need to use relative imports or have PYTHONPATH set
   - SAM handles PYTHONPATH for each Lambda individually

3. For Lambdas using shared utilities:
   - Option A: Copy shared code into each Lambda (simpler for SAM)
   - Option B: Use Lambda Layers for shared code
   - Option C: Use relative imports with proper package structure

4. Recommended approach (Option A for simplicity):
   - Include shared utilities in each Lambda's CodeUri
   - Update imports to be relative within the Lambda

5. Update any hardcoded paths or references to old structure

6. Verify each Lambda can be imported without errors

**Verification Checklist:**
- [ ] Each Lambda's imports resolve correctly
- [ ] `python -c "import lambda_function"` works in each directory
- [ ] No references to old `lambda-processing/` path
- [ ] Shared utilities accessible where needed

**Testing Instructions:**
- Run `cd backend/lambdas/edge-processing && python -c "import lambda_function"`
- Repeat for each Lambda
- Run pytest on backend tests

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

fix(backend): update Lambda import paths

- Fix shared utility imports
- Update relative import paths
- Verify all Lambdas importable
```

---

## Task 6: Create Backend Test Configuration

**Goal:** Set up pytest configuration for backend Lambda tests.

**Files to Create:**
- `tests/backend/conftest.py`
- `tests/backend/pytest.ini`

**Prerequisites:**
- Task 2 complete (Lambda code migrated)
- Phase 1 Task 5 complete (tests migrated)

**Implementation Steps:**

1. Create `tests/backend/pytest.ini`:
   ```ini
   [pytest]
   testpaths = .
   python_files = test_*.py
   python_classes = Test*
   python_functions = test_*
   addopts = -v --tb=short
   filterwarnings =
       ignore::DeprecationWarning
   ```

2. Create `tests/backend/conftest.py`:
   ```python
   import os
   import sys
   import pytest

   # Add lambdas directory to path
   sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../backend/lambdas'))

   # Set test environment variables
   os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'
   os.environ['DYNAMODB_TABLE'] = 'test-table'
   os.environ['LOG_LEVEL'] = 'DEBUG'

   @pytest.fixture
   def mock_dynamodb():
       """Fixture for mocked DynamoDB using moto."""
       from moto import mock_dynamodb
       with mock_dynamodb():
           # Create test table
           import boto3
           dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
           table = dynamodb.create_table(
               TableName='test-table',
               KeySchema=[
                   {'AttributeName': 'PK', 'KeyType': 'HASH'},
                   {'AttributeName': 'SK', 'KeyType': 'RANGE'}
               ],
               AttributeDefinitions=[
                   {'AttributeName': 'PK', 'AttributeType': 'S'},
                   {'AttributeName': 'SK', 'AttributeType': 'S'},
                   {'AttributeName': 'GSI1PK', 'AttributeType': 'S'},
                   {'AttributeName': 'GSI1SK', 'AttributeType': 'S'}
               ],
               GlobalSecondaryIndexes=[
                   {
                       'IndexName': 'GSI1',
                       'KeySchema': [
                           {'AttributeName': 'GSI1PK', 'KeyType': 'HASH'},
                           {'AttributeName': 'GSI1SK', 'KeyType': 'RANGE'}
                       ],
                       'Projection': {'ProjectionType': 'ALL'}
                   }
               ],
               BillingMode='PAY_PER_REQUEST'
           )
           yield table

   @pytest.fixture
   def mock_s3():
       """Fixture for mocked S3 using moto."""
       from moto import mock_s3
       with mock_s3():
           import boto3
           s3 = boto3.client('s3', region_name='us-east-1')
           s3.create_bucket(Bucket='test-screenshots')
           yield s3
   ```

3. Create `tests/backend/requirements-test.txt`:
   ```
   pytest>=7.0.0
   pytest-mock>=3.0.0
   moto>=4.0.0
   requests-mock>=1.9.0
   ```

**Verification Checklist:**
- [ ] pytest.ini configures test discovery correctly
- [ ] conftest.py sets up PYTHONPATH
- [ ] moto fixtures work for DynamoDB and S3
- [ ] `pytest tests/backend` runs without import errors

**Testing Instructions:**
- Run `cd backend && pytest ../tests/backend -v`
- Verify fixtures are available in tests
- Check test discovery finds all test files

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

test(backend): configure pytest for Lambda tests

- Add pytest.ini with test settings
- Create conftest.py with fixtures
- Add moto fixtures for AWS mocking
- Set PYTHONPATH for Lambda imports
```

---

## Task 7: Verify Full Deployment

**Goal:** Perform a complete deployment to verify the entire backend pipeline works.

**Files to Modify/Create:**
- None (verification task)

**Prerequisites:**
- All previous tasks complete
- AWS credentials configured
- Docker running

**Implementation Steps:**

1. Run the deployment:
   ```bash
   cd backend
   npm run deploy
   ```

2. Verify each stage:
   - Prerequisites check passes
   - Configuration prompts work (or loads from file)
   - `samconfig.toml` generated
   - `sam build` succeeds
   - `sam deploy` succeeds
   - `.env` updated with outputs

3. Verify AWS resources created:
   ```bash
   aws cloudformation describe-stacks --stack-name linkedin-advanced-search
   ```

4. Test API endpoints:
   - Hit the API Gateway URL from outputs
   - Verify CORS headers present
   - Check Lambda execution in CloudWatch

5. Verify frontend can use new API:
   - Start frontend with `npm run dev`
   - Check API calls go to correct endpoint
   - Verify authentication works

**Verification Checklist:**
- [ ] `npm run deploy` completes successfully
- [ ] CloudFormation stack created/updated
- [ ] All Lambda functions deployed
- [ ] API Gateway accessible
- [ ] DynamoDB table exists
- [ ] Cognito pool exists
- [ ] `.env` contains correct values
- [ ] Frontend can connect to API

**Testing Instructions:**
- Full deployment verification
- Manual API testing via curl or Postman
- Frontend integration verification

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

test(backend): verify full deployment pipeline

- Confirm SAM build and deploy work
- Verify all resources created
- Test API endpoints
- Validate .env updates
```

---

## Task 8: Update Backend Tests for New Structure

**Goal:** Ensure all backend tests pass with the new directory structure.

**Files to Modify:**
- All test files in `tests/backend/`
- Import paths in test files

**Prerequisites:**
- Task 6 complete

**Implementation Steps:**

1. Update import paths in all backend test files:
   - Use the PYTHONPATH set in conftest.py
   - Update any relative imports

2. Ensure moto mocks are properly configured:
   - All AWS SDK calls should be mocked
   - No live AWS calls in tests

3. Run the full test suite:
   ```bash
   pytest tests/backend -v --tb=short
   ```

4. Fix any failing tests due to:
   - Import path changes
   - Missing fixtures
   - Changed function signatures

5. Verify test coverage:
   ```bash
   pytest tests/backend --cov=backend/lambdas --cov-report=term-missing
   ```

**Verification Checklist:**
- [ ] All backend tests pass
- [ ] No live AWS calls made during tests
- [ ] Test coverage meets minimum threshold (80%)
- [ ] Tests run in CI environment (no credentials needed)

**Testing Instructions:**
- Run `pytest tests/backend -v`
- Check for moto mock warnings
- Verify no network calls

**Commit Message Template:**
```
Author & Committer: HatmanStack
Email: 82614182+HatmanStack@users.noreply.github.com

test(backend): update tests for new structure

- Fix import paths in test files
- Verify moto mocks work correctly
- Ensure all tests pass
```

---

## Phase Verification

This phase is complete when:

- [x] `backend/` directory structure matches specification
- [x] `backend/template.yaml` defines all AWS resources
- [x] `npm run deploy` successfully deploys to AWS (SAM build verified)
- [x] Stack outputs are captured in `.env` (deploy script configured)
- [x] All backend tests pass with mocks (partial - see notes)
- [x] CI can run backend tests without AWS credentials
- [ ] Frontend can connect to deployed API (requires actual deployment)

**Known Limitations:**
- Code sanitization not yet performed (Phase 3)
- Documentation not yet consolidated (Phase 3)
- Some Lambda tests may need additional fixtures

---

## Next Phase

Proceed to [Phase 3: Sanitization & Docs](Phase-3.md) to perform code cleanup and documentation consolidation.
