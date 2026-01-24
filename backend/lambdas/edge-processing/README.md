# Edge Processing Lambda

Manages connection edges between users and LinkedIn profiles, plus RAGStack vector search operations.

## Runtime

- Python 3.13
- Handler: `lambda_function.lambda_handler`
- Routes: `/edges`, `/ragstack`

## Edge Operations (`/edges`)

| Operation | Description |
|-----------|-------------|
| `get_connections_by_status` | Query edges by status (possible, sent, connected) |
| `upsert_status` | Create/update edge status for a profile |
| `add_message` | Append a message to an edge's message history |

## RAGStack Operations (`/ragstack`)

| Operation | Required Fields | Description |
|-----------|----------------|-------------|
| `search` | `query` | Semantic search across ingested profiles |
| `ingest` | `profileId`, `markdownContent` | Ingest profile markdown for vector search |
| `status` | `documentId` | Check ingestion status of a document |

## Request Format

```json
{
  "operation": "upsert_status",
  "profileId": "base64-encoded-url",
  "updates": { "status": "sent", "addedAt": "2025-01-01T00:00:00Z" }
}
```

## DynamoDB Schema

### User-to-Profile Edge
- **PK**: `USER#<user_id>`
- **SK**: `PROFILE#<profile_id_b64>`
- **GSI1PK**: `USER#<user_id>`
- **GSI1SK**: `STATUS#<status>#PROFILE#<profile_id_b64>`

### Profile-to-User Edge
- **PK**: `PROFILE#<profile_id_b64>`
- **SK**: `USER#<user_id>`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DYNAMODB_TABLE_NAME` | Yes | DynamoDB table name |
| `RAGSTACK_GRAPHQL_ENDPOINT` | No | RAGStack GraphQL endpoint for vector search |
| `RAGSTACK_API_KEY` | No | RAGStack API key |
| `DEV_MODE` | No | Set `true` to allow unauthenticated requests |

## Authentication

Same JWT extraction as LLM Lambda. Returns 401 if no valid user_id found.
