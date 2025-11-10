# Placeholder Search API Specification

## Overview

This document defines the API contract for the LinkedIn Advanced Search placeholder search endpoint. This API serves as a **temporary hook point** for future integration with an external search system. It accepts search queries from the frontend, logs them for debugging, and returns structured placeholder responses with empty results.

**Status:** Placeholder implementation
**Future:** Will be replaced with external search system integration
**Version:** 1.0.0
**Last Updated:** 2025-11-10

---

## API Endpoint

### POST /search

**Description:** Accepts search queries and returns placeholder results (empty array).

**Base URL:**
- API Gateway: `https://{api-id}.execute-api.{region}.amazonaws.com/prod/search`
- Local Development (puppeteer backend): `http://localhost:3001/search`

**Authentication:** Cognito JWT (Bearer token in Authorization header)

**Content-Type:** `application/json`

---

## Request Format

### Request Body Schema

```json
{
  "query": "string (required)",
  "filters": {
    "location": "string (optional)",
    "company": "string (optional)",
    "skills": ["string"] (optional)
  },
  "limit": 10 (optional),
  "offset": 0 (optional)
}
```

### Field Definitions

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | **Yes** | N/A | Search query string (e.g., "software engineer with ML experience") |
| `filters` | object | No | `{}` | Additional search filters |
| `filters.location` | string | No | - | Geographic location filter (e.g., "San Francisco Bay Area") |
| `filters.company` | string | No | - | Company name filter (e.g., "TechCorp") |
| `filters.skills` | array of strings | No | - | Skills to filter by (e.g., ["Python", "AWS"]) |
| `limit` | number | No | 10 | Maximum number of results to return (1-100) |
| `offset` | number | No | 0 | Pagination offset for result set |

### Request Examples

**Basic search:**
```json
{
  "query": "software engineer with machine learning experience"
}
```

**Search with filters:**
```json
{
  "query": "software engineer",
  "filters": {
    "location": "San Francisco Bay Area",
    "company": "TechCorp",
    "skills": ["Python", "AWS", "Docker"]
  },
  "limit": 20,
  "offset": 0
}
```

**Paginated search:**
```json
{
  "query": "data scientist",
  "limit": 10,
  "offset": 10
}
```

---

## Response Format

### Success Response Schema (Placeholder)

```json
{
  "success": true,
  "message": "string",
  "query": "string",
  "results": [],
  "total": 0,
  "timestamp": "string (ISO 8601)",
  "metadata": {
    "search_id": "string",
    "status": "placeholder",
    "userId": "string"
  }
}
```

### Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` for successful placeholder responses |
| `message` | string | Informational message explaining placeholder status |
| `query` | string | Echo of the search query from request |
| `results` | array | Always empty array `[]` (placeholder implementation) |
| `total` | number | Always `0` (no results in placeholder) |
| `timestamp` | string | ISO 8601 timestamp of the response |
| `metadata` | object | Additional context for debugging and future integration |
| `metadata.search_id` | string | Unique identifier for this search request |
| `metadata.status` | string | Always `"placeholder"` to indicate temporary implementation |
| `metadata.userId` | string | User ID from Cognito JWT token |

### Success Response Example

```json
{
  "success": true,
  "message": "Search functionality is currently unavailable. This is a placeholder response. External search system integration coming soon.",
  "query": "software engineer with machine learning experience",
  "results": [],
  "total": 0,
  "timestamp": "2025-11-10T15:30:00.123Z",
  "metadata": {
    "search_id": "search-1731252600123-xj4k9s",
    "status": "placeholder",
    "userId": "abc-123-def-456"
  }
}
```

---

## Error Response Format

### Error Response Schema

```json
{
  "success": false,
  "error": "string",
  "timestamp": "string (ISO 8601)"
}
```

### HTTP Status Codes

| Status Code | Description | Response Example |
|-------------|-------------|------------------|
| 200 | Success (placeholder) | See success response above |
| 400 | Bad Request (missing/invalid query) | `{"success": false, "error": "Invalid request: query is required", "timestamp": "2025-11-10T15:30:00Z"}` |
| 401 | Unauthorized (missing/invalid JWT) | `{"success": false, "error": "Unauthorized", "timestamp": "2025-11-10T15:30:00Z"}` |
| 500 | Internal Server Error | `{"success": false, "error": "Internal server error", "timestamp": "2025-11-10T15:30:00Z"}` |

### Error Response Examples

**Missing query field:**
```json
{
  "success": false,
  "error": "Invalid request: query is required",
  "timestamp": "2025-11-10T15:30:00.123Z"
}
```

**Missing authentication:**
```json
{
  "success": false,
  "error": "Unauthorized",
  "timestamp": "2025-11-10T15:30:00.123Z"
}
```

**Server error:**
```json
{
  "success": false,
  "error": "Internal server error",
  "timestamp": "2025-11-10T15:30:00.123Z"
}
```

---

## Behavior Specification

### Lambda Function Behavior

1. **Request Validation:**
   - Verify `query` field exists and is a non-empty string
   - Validate `limit` is between 1-100 (if provided)
   - Validate `offset` is non-negative (if provided)
   - Return 400 error if validation fails

2. **Authentication:**
   - Extract user ID from Cognito JWT claims (`event.requestContext.authorizer.claims.sub`)
   - Log user ID with search query
   - Return 401 error if JWT is missing or invalid (handled by API Gateway)

3. **Query Logging:**
   - Log full search query to CloudWatch Logs
   - Include: userId, query, filters, limit, offset, timestamp
   - Format: Structured JSON for easy parsing and analysis

4. **Response Generation:**
   - Always return empty results array
   - Generate unique search_id (timestamp + random string)
   - Include informational message about placeholder status
   - Set timestamp to current ISO 8601 time

5. **Error Handling:**
   - Catch all exceptions and return 500 error
   - Log error details to CloudWatch
   - Never expose internal error details to client

### Future Integration Points

**When connecting to external search system:**

1. Replace placeholder response generation with:
   ```javascript
   // FUTURE: Call external search system here
   const results = await externalSearchService.search(body.query, body.filters);
   return buildSuccessResponse({
     success: true,
     message: "Search completed successfully",
     results: results.data,
     total: results.total,
     timestamp: new Date().toISOString(),
     metadata: {
       search_id: searchId,
       status: "active",
       userId: userId
     }
   });
   ```

2. Update response schema to include:
   - Actual profile results with name, title, company, etc.
   - Pagination metadata (hasMore, nextOffset)
   - Search relevance scores
   - Facets/aggregations for filters

---

## Frontend Integration

### Expected Frontend Behavior

1. **Making Search Requests:**
   - Send POST request to `/search` endpoint
   - Include Cognito JWT in Authorization header
   - Handle loading state during request
   - Handle success and error responses

2. **Handling Placeholder Response:**
   - Display informational message to user (e.g., "Search functionality coming soon")
   - Show empty state UI (no results)
   - Optionally log search queries locally for user reference

3. **Error Handling:**
   - 400 errors: Show validation error message to user
   - 401 errors: Redirect to login page
   - 500 errors: Show generic error message, optionally retry

### Frontend Code Example

```typescript
// Current implementation in puppeteerApiService.ts
async searchLinkedIn(searchData: SearchFormData): Promise<any> {
  const response = await this.makeRequest<any>(
    '/search',
    {
      method: 'POST',
      body: JSON.stringify(searchData),
    }
  );
  return response;
}
```

**Future:** In Phase 5, this will be updated to call the API Gateway endpoint instead of the local puppeteer backend.

---

## Testing Instructions

### Manual Testing with curl

**Prerequisites:**
- Get Cognito JWT token from logged-in user
- Replace `{jwt-token}` with actual token
- Replace `{api-url}` with API Gateway URL

**Test successful search:**
```bash
curl -X POST \
  https://{api-id}.execute-api.us-west-2.amazonaws.com/prod/search \
  -H "Authorization: Bearer {jwt-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "software engineer with machine learning experience",
    "filters": {
      "location": "San Francisco Bay Area"
    },
    "limit": 10
  }'

# Expected response (200 OK):
# {
#   "success": true,
#   "message": "Search functionality is currently unavailable...",
#   "results": [],
#   "total": 0,
#   ...
# }
```

**Test missing query (400 error):**
```bash
curl -X POST \
  https://{api-url}/prod/search \
  -H "Authorization: Bearer {jwt-token}" \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected response (400 Bad Request):
# {
#   "success": false,
#   "error": "Invalid request: query is required",
#   ...
# }
```

**Test missing authentication (401 error):**
```bash
curl -X POST \
  https://{api-url}/prod/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'

# Expected response (401 Unauthorized):
# {
#   "success": false,
#   "error": "Unauthorized",
#   ...
# }
```

### Lambda Direct Invocation Testing

```bash
# Invoke Lambda directly with test event
aws lambda invoke \
  --function-name linkedin-advanced-search-placeholder-search \
  --payload '{
    "body": "{\"query\": \"software engineer\"}",
    "requestContext": {
      "authorizer": {
        "claims": {
          "sub": "test-user-123"
        }
      }
    }
  }' \
  response.json

# Check response
cat response.json | jq .
```

### CloudWatch Logs Verification

```bash
# Tail Lambda logs
aws logs tail /aws/lambda/linkedin-advanced-search-placeholder-search --follow

# Expected log entries:
# - "Search request received: {...}"
# - "Search query: { userId: '...', query: '...', ... }"
```

---

## CloudFormation Integration

### Lambda Function Configuration

- **Runtime:** Node.js 20.x
- **Handler:** index.handler
- **Timeout:** 30 seconds
- **Memory:** 512 MB
- **Environment Variables:**
  - `LOG_LEVEL`: INFO

### API Gateway Configuration

- **Route:** `POST /search`
- **Authorization:** JWT (Cognito User Pool)
- **Integration:** AWS_PROXY (Lambda proxy integration)
- **CORS:** Enabled (Access-Control-Allow-Origin: *)

---

## Security Considerations

1. **Authentication:**
   - All requests must include valid Cognito JWT token
   - API Gateway validates JWT before invoking Lambda
   - Lambda extracts user ID from JWT claims

2. **Input Validation:**
   - Validate all request fields
   - Sanitize query string (prevent injection attacks)
   - Limit query length (max 500 characters)
   - Limit filters object depth

3. **Rate Limiting:**
   - API Gateway throttling: 1000 requests/second (default)
   - Per-user rate limiting: TBD (future enhancement)

4. **Error Handling:**
   - Never expose internal error details
   - Log all errors to CloudWatch for debugging
   - Return generic error messages to client

5. **CORS:**
   - Allow all origins for development
   - Future: Restrict to specific frontend domain

---

## Performance Considerations

1. **Response Time:**
   - Target: < 100ms (placeholder response)
   - No external dependencies (just logging and response generation)

2. **Scalability:**
   - Lambda auto-scales based on request volume
   - No database queries in placeholder implementation
   - Future: Add caching for external search system

3. **Cost:**
   - Lambda invocations: ~$0.20 per 1 million requests
   - CloudWatch Logs: ~$0.50 per GB
   - API Gateway: ~$3.50 per 1 million requests

---

## Monitoring and Observability

### CloudWatch Metrics

- **Lambda Metrics:**
  - Invocations
  - Duration
  - Errors
  - Throttles

- **API Gateway Metrics:**
  - Count (total requests)
  - 4XXError
  - 5XXError
  - Latency

### CloudWatch Logs

**Log Format:**
```json
{
  "timestamp": "2025-11-10T15:30:00.123Z",
  "userId": "abc-123",
  "query": "software engineer",
  "filters": {},
  "limit": 10,
  "offset": 0,
  "searchId": "search-1731252600123-xj4k9s"
}
```

### Alarms

**Recommended CloudWatch Alarms:**
- Lambda errors > 10 in 5 minutes
- API Gateway 5XX errors > 5% of requests
- Lambda duration > 10 seconds (p99)

---

## Known Limitations

1. **No Actual Search:**
   - Always returns empty results
   - No real search functionality implemented

2. **No Caching:**
   - Every request hits Lambda
   - No result caching

3. **No Advanced Filtering:**
   - Filters are logged but not processed
   - Future: Implement filter logic in external system

4. **No Pagination:**
   - `limit` and `offset` are logged but ignored
   - Always returns 0 results

5. **No Query Suggestions:**
   - No autocomplete or suggestions
   - Future: Add typeahead endpoint

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-10 | Initial placeholder API specification |

---

## References

- [Phase 4 Implementation Plan](./plans/Phase-4.md)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [API Gateway HTTP API](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api.html)
- [Cognito JWT Tokens](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html)
