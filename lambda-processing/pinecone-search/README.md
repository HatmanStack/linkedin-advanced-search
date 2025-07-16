# Pinecone Search Lambda Function

This Lambda function provides semantic search across LinkedIn profiles stored in Pinecone, with user-profile relationship filtering to ensure data privacy and security.

## Features

- **Semantic Search**: Uses Pinecone's integrated embedding for natural language queries
- **User-Profile Filtering**: Only searches profiles the authenticated user has connections to
- **Reranking**: Optional reranking with `bge-reranker-v2-m3` for improved relevance
- **Metadata Filtering**: Additional filters for company, location, skills, title
- **CORS Support**: Ready for frontend integration
- **Error Handling**: Comprehensive error handling with appropriate HTTP status codes

## Environment Variables

```bash
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=linkedin-profiles
PINECONE_HOST=your-index-host.pinecone.io
DYNAMODB_TABLE=linkedin-advanced-search
AWS_REGION=us-west-2
COGNITO_USER_POOL_ID=your_user_pool_id
```

## API Usage

### Request Format

```http
POST /search/profiles
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "query": "software engineer python aws",
  "filters": {
    "company": "Google",
    "location": "San Francisco",
    "skills": ["Python", "AWS"],
    "title": "Senior Engineer"
  },
  "limit": 10,
  "rerank": true
}
```

### Response Format

```json
{
  "results": [
    {
      "profile_id": "PROFILE#xyz",
      "name": "John Doe",
      "title": "Senior Software Engineer",
      "company": "Google",
      "location": "San Francisco",
      "score": 0.85,
      "summary": "John Doe is a Senior Software Engineer...",
      "skills": ["Python", "AWS", "React"],
      "headline": "Senior Software Engineer at Google"
    }
  ],
  "total": 25,
  "query_time_ms": 150
}
```

## Security

- **JWT Authentication**: Validates Cognito JWT tokens
- **User Isolation**: Only searches profiles connected to the authenticated user
- **Input Validation**: Validates all input parameters
- **Error Sanitization**: Prevents sensitive information leakage in errors

## Performance Features

- **Connection Pooling**: Reuses Pinecone client connections
- **Efficient Filtering**: Uses Pinecone metadata filters to reduce processing
- **Reranking**: Optional reranking for improved result quality
- **Result Limiting**: Prevents excessive resource usage

## Deployment

1. Install dependencies: `npm install`
2. Set environment variables
3. Deploy to AWS Lambda
4. Configure API Gateway integration
5. Set up CORS and authentication

## Error Codes

- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (invalid/missing JWT token)
- `500`: Internal Server Error

## Testing

The function can be tested locally or through API Gateway. Ensure you have:
- Valid Cognito JWT token
- User with connected profiles in DynamoDB
- Pinecone index with profile vectors
