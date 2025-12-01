# Placeholder Search Lambda Function

## Overview

This Lambda function provides a placeholder search API endpoint for the LinkedIn Advanced Search application. It accepts search queries from the frontend, logs them for debugging, and returns structured placeholder responses with empty results.

**Purpose:** Serve as a **temporary hook point** for future integration with an external search system while maintaining frontend functionality.

**Status:** Placeholder implementation (v1.0.0)

**Future:** Will be replaced or extended with external search system integration.

---

## Functionality

### Current Behavior

1. **Accepts Search Requests:**
   - POST requests with JSON body containing `query` field
   - Optional `filters`, `limit`, and `offset` parameters

2. **Validates Input:**
   - Ensures `query` field is present and non-empty
   - Validates `limit` is between 1-100
   - Validates `offset` is non-negative
   - Returns 400 error for invalid requests

3. **Logs Search Queries:**
   - Extracts user ID from Cognito JWT token
   - Generates unique search ID
   - Logs full search query to CloudWatch Logs
   - Includes: query, filters, limit, offset, userId, timestamp

4. **Returns Placeholder Response:**
   - Always returns empty results array
   - Includes informational message about placeholder status
   - Returns unique search ID for tracking
   - Returns 200 status code for valid requests

### Authentication

- **Method:** Cognito JWT (Bearer token)
- **Handled by:** API Gateway (validates JWT before invoking Lambda)
- **User ID:** Extracted from `event.requestContext.authorizer.claims.sub`

---

## Request Format

### Request Body Schema

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

### Field Requirements

- `query` (required): Search query string
- `filters` (optional): Additional filters object
- `limit` (optional): Max results (1-100, default: 10)
- `offset` (optional): Pagination offset (≥0, default: 0)

---

## Response Format

### Success Response

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

### Error Response

```json
{
  "success": false,
  "error": "Invalid request: query is required",
  "timestamp": "2025-11-10T15:30:00.123Z"
}
```

---

## Environment Variables

### Current

- `LOG_LEVEL` (optional): Logging level (default: INFO)
- `AWS_REGION` (auto): AWS region (set by Lambda runtime)

### Future

When integrating with external search system:
- `EXTERNAL_SEARCH_API_URL`: URL of external search service
- `EXTERNAL_SEARCH_API_KEY`: Authentication key for external service
- `SEARCH_TIMEOUT_MS`: Timeout for external search calls (default: 5000)

---

## Local Testing

### Test with sample event

Create a test file `test-event.json`:

```json
{
  "body": "{\"query\": \"software engineer\", \"filters\": {\"location\": \"San Francisco\"}, \"limit\": 10}",
  "requestContext": {
    "authorizer": {
      "claims": {
        "sub": "test-user-123"
      }
    }
  }
}
```

### Run locally (Node.js 20+)

```javascript
// test-local.js
import { handler } from './index.js';
import fs from 'fs';

const testEvent = JSON.parse(fs.readFileSync('test-event.json', 'utf-8'));

const response = await handler(testEvent);
console.log('Response:', JSON.parse(response.body));
```

```bash
node test-local.js
```

### Expected output

```
Search request received: { ... }
Search query: { userId: 'test-user-123', query: 'software engineer', ... }
Returning placeholder response: { searchId: 'search-...', success: true }
Response: {
  success: true,
  message: '...',
  results: [],
  total: 0,
  ...
}
```

---

## Testing Invalid Requests

### Missing query field

```json
{
  "body": "{}",
  "requestContext": {}
}
```

Expected: `400 Bad Request - "Invalid request: query is required"`

### Invalid limit

```json
{
  "body": "{\"query\": \"test\", \"limit\": 150}",
  "requestContext": {}
}
```

Expected: `400 Bad Request - "Invalid request: limit must be between 1 and 100"`

### Invalid offset

```json
{
  "body": "{\"query\": \"test\", \"offset\": -5}",
  "requestContext": {}
}
```

Expected: `400 Bad Request - "Invalid request: offset must be non-negative"`

---

## Deployment

Deploy via SAM from the backend directory:

```bash
cd backend
npm run deploy
```

This Lambda is automatically deployed with:
- **Function Name:** `linkedin-placeholder-search-{env}`
- **Runtime:** Node.js 20.x
- **Handler:** `index.handler`
- **Timeout:** 30 seconds
- **Memory:** 512 MB

---

## CloudWatch Logs

### Log Format

```json
{
  "timestamp": "2025-11-10T15:30:00.123Z",
  "searchId": "search-1731252600123-xj4k9s",
  "userId": "abc-123-def-456",
  "query": "software engineer",
  "filters": { "location": "San Francisco" },
  "limit": 10,
  "offset": 0
}
```

### View logs

```bash
# Tail logs in real-time
aws logs tail /aws/lambda/linkedin-advanced-search-placeholder-search-prod --follow

# Filter for specific user
aws logs filter-log-events \
  --log-group-name /aws/lambda/linkedin-advanced-search-placeholder-search-prod \
  --filter-pattern "{ $.userId = \"abc-123\" }"
```

---

## Monitoring

### CloudWatch Metrics

- **Invocations:** Total number of search requests
- **Duration:** How long each request takes (target: <100ms)
- **Errors:** Number of failed requests (5xx errors)
- **Throttles:** Requests throttled due to concurrency limits

### Recommended Alarms

1. **High Error Rate:**
   - Metric: `Errors > 10` in 5 minutes
   - Action: Notify operations team

2. **High Duration:**
   - Metric: `Duration > 1000ms` (p99)
   - Action: Investigate performance issue

3. **Throttling:**
   - Metric: `Throttles > 0`
   - Action: Increase concurrency limit

---

## Future Integration

### External Search System

When integrating with an external search system, update the Lambda to:

1. **Call external API:**
   ```javascript
   // FUTURE: Replace placeholder response with real search
   const searchResult = await fetch(process.env.EXTERNAL_SEARCH_API_URL, {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${process.env.EXTERNAL_SEARCH_API_KEY}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       query: body.query,
       filters: body.filters,
       limit: body.limit || 10,
       offset: body.offset || 0
     })
   });

   const results = await searchResult.json();
   ```

2. **Update response format:**
   ```javascript
   return buildSuccessResponse({
     success: true,
     message: "Search completed successfully",
     query: body.query,
     results: results.data,        // Actual search results
     total: results.total,          // Total result count
     timestamp: new Date().toISOString(),
     metadata: {
       search_id: searchId,
       status: "active",            // Changed from "placeholder"
       userId: userId,
       processingTime: results.processingTime
     }
   });
   ```

3. **Add error handling:**
   ```javascript
   try {
     const results = await externalSearch(...);
     return buildSuccessResponse(results);
   } catch (error) {
     // Fallback to empty results if external system fails
     console.error('External search failed:', error);
     return buildSuccessResponse({
       success: true,
       message: "Search temporarily unavailable",
       results: [],
       total: 0,
       ...
     });
   }
   ```

### Environment Variables to Add

```yaml
Environment:
  Variables:
    LOG_LEVEL: INFO
    EXTERNAL_SEARCH_API_URL: https://search-api.example.com/search
    EXTERNAL_SEARCH_API_KEY: !Ref ExternalSearchApiKeyParameter
    SEARCH_TIMEOUT_MS: 5000
```

---

## Troubleshooting

### Lambda returns 500 error

1. Check CloudWatch Logs for error stack trace
2. Verify request body is valid JSON
3. Check Lambda execution role has necessary permissions

### Lambda times out

1. Increase timeout in CloudFormation (currently 30s)
2. Check for infinite loops or hanging operations
3. Verify no blocking operations

### CORS errors in frontend

1. Verify `Access-Control-Allow-Origin` header is set
2. Check `Access-Control-Allow-Headers` includes `Authorization`
3. Ensure OPTIONS preflight requests are handled by API Gateway

### User ID shows as 'anonymous'

1. Verify Cognito JWT is included in Authorization header
2. Check API Gateway authorizer is configured correctly
3. Verify JWT is valid and not expired

---

## Related Documentation

- See `docs/` directory for API specifications and implementation plans

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-10 | Initial placeholder implementation |

---

## License

MIT
