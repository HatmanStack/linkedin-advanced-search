# Phase 4: Placeholder Search API Implementation

## Phase Goal

Create a minimal placeholder Search API (API Gateway + Lambda) to replace the removed Pinecone search functionality. This API will accept search queries from the frontend, log them, and return placeholder responses. It serves as a **hook point** for future integration with an external search system. By the end of this phase, the frontend can make search requests without errors, even though actual search functionality is deferred to a future external system.

**Success Criteria:**
- Lambda function created for placeholder search
- API Gateway route configured (POST /search)
- Lambda accepts search query and logs it
- Lambda returns structured placeholder response
- Frontend can successfully call the new search endpoint
- Cognito JWT authentication preserved
- CloudFormation template updated with new Lambda and route

**Estimated tokens:** ~15,000

---

## Prerequisites

- **Previous Phases:** Phase 1 (Code Cleanup) must be complete
- **External Dependencies:**
  - AWS account with Lambda and API Gateway access
  - CloudFormation stack deployed (RAG-CloudStack)
  - Cognito authentication configured
- **Environment Requirements:**
  - AWS CLI configured locally
  - Node.js 20 runtime for Lambda (or Python 3.x if preferred)

**Note:** Phase 4 can be developed in parallel with Phases 2-3, as it is independent of text extraction and S3 upload.

---

## Tasks

### Task 1: Design Placeholder Search API

**Goal:** Define the API contract, request/response format, and behavior for the placeholder search endpoint.

**Files to Create:**
- `Migration/docs/search-api-specification.md` - API specification document

**Prerequisites:**
- Understanding of frontend search requirements
- Review of current (Pinecone) search API contract

**Implementation Steps:**

1. **Review existing search implementation:**
   - Examine how the frontend currently calls search (if implemented)
   - Check `src/hooks/useSearchResults.ts` and `src/services/lambdaApiService.ts`
   - Identify expected request and response formats

2. **Define API endpoint:**
   - **Method:** POST
   - **Path:** `/search` (or `/api/search` depending on API Gateway stage)
   - **Authentication:** Cognito JWT (Bearer token in Authorization header)
   - **Content-Type:** `application/json`

3. **Define request format:**
   ```json
   {
     "query": "software engineer with machine learning experience",
     "filters": {
       "location": "San Francisco Bay Area",
       "company": "TechCorp",
       "skills": ["Python", "AWS"]
     },
     "limit": 10,
     "offset": 0
   }
   ```
   - `query` (required): Search query string
   - `filters` (optional): Additional filters
   - `limit` (optional): Max results to return (default: 10)
   - `offset` (optional): Pagination offset (default: 0)

4. **Define response format (placeholder):**
   ```json
   {
     "success": true,
     "message": "Search functionality is currently unavailable. Placeholder response returned.",
     "query": "software engineer with machine learning experience",
     "results": [],
     "total": 0,
     "timestamp": "2025-11-09T12:00:00Z",
     "metadata": {
       "search_id": "search-uuid-12345",
       "status": "placeholder"
     }
   }
   ```
   - `success`: Always true (for now)
   - `message`: Informational message about placeholder
   - `results`: Empty array (no actual search results)
   - `total`: Always 0
   - `metadata`: Additional context for future integration

5. **Define error response format:**
   ```json
   {
     "success": false,
     "error": "Invalid request: query is required",
     "timestamp": "2025-11-09T12:00:00Z"
   }
   ```

6. **Document behavior:**
   - Lambda logs the query for debugging
   - Lambda validates request structure
   - Lambda returns success with empty results
   - Frontend displays message to user (e.g., "Search coming soon")
   - Future: External system will populate `results` array

**Verification Checklist:**
- [ ] API endpoint path defined
- [ ] Request format documented with examples
- [ ] Response format documented (placeholder)
- [ ] Error response format defined
- [ ] Behavior documented
- [ ] Specification reviewed

**Testing Instructions:**
- Review specification document for completeness
- Verify request/response formats match frontend expectations
- Confirm placeholder response is clear to users

**Commit Message Template:**
```
docs(search): define placeholder search API specification

- Document POST /search endpoint
- Define request format (query, filters, limit, offset)
- Define placeholder response format (empty results)
- Define error response format
- Document behavior and future integration points
- Prepare for Lambda implementation
```

**Estimated tokens:** ~3,000

---

### Task 2: Create Placeholder Search Lambda Function

**Goal:** Implement the Lambda function that handles search requests and returns placeholder responses.

**Files to Create:**
- `lambda-processing/linkedin-advanced-search-placeholder-search-prod/index.js` - Lambda handler
- `lambda-processing/linkedin-advanced-search-placeholder-search-prod/package.json` - Dependencies
- `lambda-processing/linkedin-advanced-search-placeholder-search-prod/README.md` - Documentation

**Prerequisites:**
- Task 1 API specification complete
- Node.js 20 or Python 3.x chosen for Lambda runtime

**Implementation Steps:**

1. **Create Lambda directory structure:**
   ```bash
   mkdir -p lambda-processing/linkedin-advanced-search-placeholder-search-prod
   cd lambda-processing/linkedin-advanced-search-placeholder-search-prod
   ```

2. **Create package.json (if Node.js):**
   ```json
   {
     "name": "linkedin-advanced-search-placeholder-search",
     "version": "1.0.0",
     "description": "Placeholder search API for LinkedIn Advanced Search",
     "main": "index.js",
     "type": "module",
     "dependencies": {}
   }
   ```

3. **Implement Lambda handler:**
   ```javascript
   // index.js
   export const handler = async (event) => {
     console.log('Search request received:', JSON.stringify(event, null, 2));

     try {
       // Parse request body
       const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

       // Validate request
       if (!body || !body.query) {
         return buildErrorResponse(400, 'Invalid request: query is required');
       }

       // Extract user ID from Cognito JWT (optional)
       const userId = event.requestContext?.authorizer?.claims?.sub || 'anonymous';

       // Log search query for debugging
       console.log('Search query:', {
         userId,
         query: body.query,
         filters: body.filters,
         limit: body.limit || 10,
         offset: body.offset || 0,
         timestamp: new Date().toISOString(),
       });

       // Return placeholder response
       const response = {
         success: true,
         message: 'Search functionality is currently unavailable. This is a placeholder response. External search system integration coming soon.',
         query: body.query,
         results: [],
         total: 0,
         timestamp: new Date().toISOString(),
         metadata: {
           search_id: `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
           status: 'placeholder',
           userId: userId,
         },
       };

       return buildSuccessResponse(response);

     } catch (error) {
       console.error('Search error:', error);
       return buildErrorResponse(500, 'Internal server error');
     }
   };

   function buildSuccessResponse(data) {
     return {
       statusCode: 200,
       headers: {
         'Content-Type': 'application/json',
         'Access-Control-Allow-Origin': '*', // CORS
       },
       body: JSON.stringify(data),
     };
   }

   function buildErrorResponse(statusCode, message) {
     return {
       statusCode,
       headers: {
         'Content-Type': 'application/json',
         'Access-Control-Allow-Origin': '*', // CORS
       },
       body: JSON.stringify({
         success: false,
         error: message,
         timestamp: new Date().toISOString(),
       }),
     };
   }
   ```

4. **Add request validation:**
   - Validate `query` field (required, string, max length)
   - Validate `filters` (optional, object)
   - Validate `limit` and `offset` (optional, positive integers)
   - Return 400 error for invalid requests

5. **Add comprehensive logging:**
   - Log full request event (for debugging)
   - Log parsed query and filters
   - Log user ID (from Cognito claims)
   - Log any errors with stack traces

6. **Add future integration hook:**
   - Add comment explaining where external search integration will go:
     ```javascript
     // FUTURE: Call external search system here
     // const results = await externalSearchService.search(body.query, body.filters);
     // return buildSuccessResponse({ results, total: results.length, ... });
     ```

7. **Create README.md:**
   - Document Lambda purpose and behavior
   - Document request/response formats
   - Document environment variables (if any)
   - Document testing instructions

**Verification Checklist:**
- [ ] Lambda directory created
- [ ] package.json created (if Node.js)
- [ ] index.js handler implemented
- [ ] Request validation implemented
- [ ] Placeholder response returned
- [ ] Logging implemented
- [ ] Future integration hook documented
- [ ] README.md created

**Testing Instructions:**
- Test Lambda locally with sample event:
  ```javascript
  import { handler } from './index.js';

  const testEvent = {
     body: JSON.stringify({
       query: 'software engineer',
       filters: { location: 'San Francisco' },
       limit: 10,
     }),
     requestContext: {
       authorizer: { claims: { sub: 'user-123' } },
     },
   };

  const response = await handler(testEvent);
  console.log(JSON.parse(response.body));
  // Verify success: true, results: [], total: 0
  ```
- Test with invalid request:
  ```javascript
  const invalidEvent = { body: JSON.stringify({}) };
  const response = await handler(invalidEvent);
  // Verify statusCode: 400, error message present
  ```

**Commit Message Template:**
```
feat(lambda): create placeholder search Lambda function

- Implement search handler in index.js
- Add request validation (query required)
- Return placeholder response with empty results
- Add comprehensive logging for debugging
- Add future integration hook for external search
- Document Lambda in README.md
- Ready for CloudFormation deployment
```

**Estimated tokens:** ~5,000

---

### Task 3: Update CloudFormation Templates for Search API

**Goal:** Add the new placeholder search Lambda and API Gateway route to the CloudFormation stack.

**Files to Modify:**
- `RAG-CloudStack/templates/lambdas.yaml` - Add Lambda function definition
- `RAG-CloudStack/templates/apigw-http.yaml` - Add /search route
- `RAG-CloudStack/deploy.sh` - Add deployment parameters

**Prerequisites:**
- Task 2 Lambda function implemented
- Understanding of CloudFormation YAML syntax
- Review of existing Lambda and API Gateway configurations

**Implementation Steps:**

1. **Review current CloudFormation structure:**
   - Examine existing Lambda definitions in `lambdas.yaml`
   - Examine existing API routes in `apigw-http.yaml`
   - Understand parameter passing and resource naming conventions

2. **Add Lambda function to lambdas.yaml:**
   ```yaml
   PlaceholderSearchLambda:
     Type: AWS::Lambda::Function
     Properties:
       FunctionName: !Sub "${StackPrefix}-placeholder-search"
       Runtime: nodejs20.x
       Handler: index.handler
       Role: !GetAtt LambdaExecutionRole.Arn
       Code:
         S3Bucket: !Ref ArtifactsBucket
         S3Key: !Sub "lambdas/${PlaceholderSearchZipPath}"
       Environment:
         Variables:
           LOG_LEVEL: INFO
       Timeout: 30
       MemorySize: 512
   ```

3. **Add API Gateway integration:**
   ```yaml
   # In apigw-http.yaml
   PlaceholderSearchRoute:
     Type: AWS::ApiGatewayV2::Route
     Properties:
       ApiId: !Ref HttpApi
       RouteKey: "POST /search"
       AuthorizationType: JWT
       AuthorizerId: !Ref CognitoAuthorizer
       Target: !Sub "integrations/${PlaceholderSearchIntegration}"

   PlaceholderSearchIntegration:
     Type: AWS::ApiGatewayV2::Integration
     Properties:
       ApiId: !Ref HttpApi
       IntegrationType: AWS_PROXY
       IntegrationUri: !Sub "arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${PlaceholderSearchLambda.Arn}/invocations"
       PayloadFormatVersion: "2.0"
   ```

4. **Add Lambda permissions for API Gateway:**
   ```yaml
   PlaceholderSearchLambdaPermission:
     Type: AWS::Lambda::Permission
     Properties:
       FunctionName: !Ref PlaceholderSearchLambda
       Action: lambda:InvokeFunction
       Principal: apigateway.amazonaws.com
       SourceArn: !Sub "arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${HttpApi}/*"
   ```

5. **Add parameters to deploy.sh:**
   - Add parameter for Lambda ZIP path:
     ```bash
     PLACEHOLDER_SEARCH_ZIP_PATH=${PLACEHOLDER_SEARCH_ZIP_PATH:-"placeholder-search.zip"}
     ```
   - Update CloudFormation parameter passing:
     ```bash
     --parameter-overrides \
       PlaceholderSearchZipPath="$PLACEHOLDER_SEARCH_ZIP_PATH" \
       # ... other parameters
     ```

6. **Package Lambda function:**
   - Create deployment script to zip Lambda:
     ```bash
     cd lambda-processing/linkedin-advanced-search-placeholder-search-prod
     zip -r placeholder-search.zip index.js package.json
     aws s3 cp placeholder-search.zip s3://artifacts-bucket/lambdas/
     ```

7. **Add CloudFormation outputs:**
   ```yaml
   Outputs:
     PlaceholderSearchLambdaArn:
       Description: ARN of Placeholder Search Lambda
       Value: !GetAtt PlaceholderSearchLambda.Arn
       Export:
         Name: !Sub "${StackPrefix}-placeholder-search-arn"
   ```

**Verification Checklist:**
- [ ] Lambda function added to lambdas.yaml
- [ ] API Gateway route added (/search)
- [ ] Lambda permissions configured
- [ ] Parameters added to deploy.sh
- [ ] Lambda packaged and uploaded to S3
- [ ] CloudFormation outputs defined
- [ ] Templates validated (cfn-lint)

**Testing Instructions:**
- Validate CloudFormation templates:
  ```bash
  cfn-lint RAG-CloudStack/templates/*.yaml
  ```
- Package Lambda:
  ```bash
  cd lambda-processing/linkedin-advanced-search-placeholder-search-prod
  zip -r placeholder-search.zip index.js package.json
  ```
- Deploy stack (dry-run):
  ```bash
  cd RAG-CloudStack
  # Review deploy.sh, ensure parameters are correct
  # bash deploy.sh (actual deployment in next task)
  ```

**Commit Message Template:**
```
feat(infra): add placeholder search Lambda to CloudFormation

- Add PlaceholderSearchLambda to lambdas.yaml
- Add POST /search route to apigw-http.yaml
- Add Lambda permissions for API Gateway
- Add deployment parameters to deploy.sh
- Add CloudFormation outputs
- Ready for stack deployment
```

**Estimated tokens:** ~4,000

---

### Task 4: Deploy and Test Placeholder Search API

**Goal:** Deploy the updated CloudFormation stack and test the placeholder search API end-to-end.

**Files to Modify:**
- None (deployment only)

**Prerequisites:**
- Task 3 CloudFormation templates updated
- Lambda packaged and uploaded to S3
- AWS credentials configured

**Implementation Steps:**

1. **Package Lambda function:**
   ```bash
   cd lambda-processing/linkedin-advanced-search-placeholder-search-prod
   zip -r placeholder-search.zip index.js package.json
   aws s3 cp placeholder-search.zip s3://artifacts-bucket/lambdas/
   ```

2. **Deploy CloudFormation stack:**
   ```bash
   cd RAG-CloudStack
   bash deploy.sh \
     STACK_PREFIX=linkedin-advanced-search \
     PROJECT_NAME=linkedin-advanced-search \
     AWS_REGION=us-west-2 \
     ARTIFACTS_BUCKET=your-artifacts-bucket \
     PLACEHOLDER_SEARCH_ZIP_PATH=placeholder-search.zip \
     # ... other parameters
   ```

3. **Verify deployment:**
   - Check CloudFormation stack status:
     ```bash
     aws cloudformation describe-stacks \
       --stack-name linkedin-advanced-search-stack \
       --query 'Stacks[0].StackStatus'
     # Expected: CREATE_COMPLETE or UPDATE_COMPLETE
     ```
   - Get API Gateway URL:
     ```bash
     aws cloudformation describe-stacks \
       --stack-name linkedin-advanced-search-stack \
       --query 'Stacks[0].Outputs[?OutputKey==`ApiBaseUrl`].OutputValue' \
       --output text
     ```

4. **Test Lambda directly:**
   - Invoke Lambda with test event:
     ```bash
     aws lambda invoke \
       --function-name linkedin-advanced-search-placeholder-search \
       --payload '{"body": "{\"query\": \"test\"}"}' \
       response.json

     cat response.json | jq .
     # Verify: statusCode: 200, success: true, results: []
     ```

5. **Test via API Gateway:**
   - Get Cognito JWT token (from logged-in user or test user)
   - Make POST request to /search:
     ```bash
     curl -X POST \
       https://{api-id}.execute-api.us-west-2.amazonaws.com/prod/search \
       -H "Authorization: Bearer {jwt-token}" \
       -H "Content-Type: application/json" \
       -d '{"query": "software engineer", "limit": 10}'

     # Expected response:
     # {"success": true, "message": "...", "results": [], "total": 0}
     ```

6. **Test error cases:**
   - Missing query:
     ```bash
     curl -X POST {api-url}/search \
       -H "Authorization: Bearer {jwt-token}" \
       -H "Content-Type: application/json" \
       -d '{}'
     # Expected: 400 error, "query is required"
     ```
   - Missing authentication:
     ```bash
     curl -X POST {api-url}/search \
       -H "Content-Type: application/json" \
       -d '{"query": "test"}'
     # Expected: 401 Unauthorized
     ```

7. **Check CloudWatch logs:**
   - View Lambda logs:
     ```bash
     aws logs tail /aws/lambda/linkedin-advanced-search-placeholder-search --follow
     ```
   - Verify query logging:
     ```
     Search request received: {...}
     Search query: { userId: '...', query: 'software engineer', ... }
     ```

8. **Monitor API Gateway metrics:**
   - Check API Gateway metrics in AWS Console
   - Verify requests are reaching Lambda
   - Check for 4xx or 5xx errors

**Verification Checklist:**
- [ ] Lambda packaged and uploaded to S3
- [ ] CloudFormation stack deployed successfully
- [ ] Lambda function created in AWS
- [ ] API Gateway route configured
- [ ] Lambda invocation successful (direct test)
- [ ] API Gateway request successful (with JWT)
- [ ] Error responses working (400, 401)
- [ ] CloudWatch logs show query logging
- [ ] No errors in deployment

**Testing Instructions:**
- Complete all test steps above
- Document API Gateway URL for frontend integration
- Save sample curl commands for future testing

**Commit Message Template:**
```
deploy(search): deploy placeholder search API

- Package placeholder search Lambda
- Upload Lambda ZIP to S3
- Deploy CloudFormation stack with new Lambda and route
- Test Lambda directly and via API Gateway
- Verify query logging in CloudWatch
- Verify error handling (400, 401)
- API ready for frontend integration
```

**Estimated tokens:** ~4,000

---

## Phase Verification

**How to verify entire Phase 4 is complete:**

1. **Verify Lambda function deployed:**
   ```bash
   aws lambda list-functions --query 'Functions[?contains(FunctionName, `placeholder-search`)].FunctionName'
   # Should return function name
   ```

2. **Verify API Gateway route:**
   ```bash
   aws apigatewayv2 get-routes --api-id {api-id} --query 'Items[?RouteKey==`POST /search`]'
   # Should return route configuration
   ```

3. **Verify end-to-end API call:**
   ```bash
   # With valid JWT token
   curl -X POST {api-url}/search \
     -H "Authorization: Bearer {jwt}" \
     -H "Content-Type: application/json" \
     -d '{"query": "software engineer"}' | jq .

   # Verify response:
   # {
   #   "success": true,
   #   "message": "Search functionality is currently unavailable...",
   #   "results": [],
   #   "total": 0
   # }
   ```

4. **Verify authentication required:**
   ```bash
   # Without JWT token
   curl -X POST {api-url}/search \
     -H "Content-Type: application/json" \
     -d '{"query": "test"}'
   # Expected: 401 Unauthorized
   ```

5. **Verify query logging:**
   ```bash
   aws logs tail /aws/lambda/linkedin-advanced-search-placeholder-search --since 5m
   # Should show logged search queries
   ```

6. **Verify CloudFormation outputs:**
   ```bash
   aws cloudformation describe-stacks --stack-name linkedin-advanced-search-stack \
     --query 'Stacks[0].Outputs'
   # Should include PlaceholderSearchLambdaArn
   ```

**Integration points to test:**
- Frontend can call POST /search endpoint
- Cognito JWT authentication works
- Placeholder response is valid JSON
- Error responses are handled gracefully

**Known limitations or technical debt introduced:**
- No actual search functionality (placeholder only)
- Results array is always empty
- Future integration with external search system required
- No caching or rate limiting (add in future if needed)

---

**Previous Phase:** [Phase 3: S3 Integration & Upload](./Phase-3.md)

**Next Phase:** [Phase 5: Frontend Integration & Testing](./Phase-5.md)
