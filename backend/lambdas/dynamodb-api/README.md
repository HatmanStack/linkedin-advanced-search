# DynamoDB API Lambda

User settings, profile CRUD, and LinkedIn credential management.

## Runtime

- Python 3.13
- Handler: `lambda_function.lambda_handler`
- Routes: `/dynamodb`, `/profiles`

## `/dynamodb` Route

### GET (query)

| Query Param | Description |
|-------------|-------------|
| (none) | Returns authenticated user's settings |
| `profileId` | Returns profile metadata for given LinkedIn profile |

### POST (operations)

| Operation | Description |
|-----------|-------------|
| `create` | Create a bad-contact profile entry |
| `update_user_settings` | Update user settings (linkedin_credentials, preferences) |

## `/profiles` Route

| Method | Description |
|--------|-------------|
| `GET` | Get user profile data |
| `PUT` | Update user profile fields |
| `POST` | Operation-based: `get_research_result` (poll LLM results) |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DYNAMODB_TABLE_NAME` | Yes | DynamoDB table name |
| `COGNITO_USER_POOL_ID` | No | Cognito pool for user validation |

## Authentication

Same JWT extraction as other Lambdas. GET with `profileId` is allowed without auth (public profile lookup).
