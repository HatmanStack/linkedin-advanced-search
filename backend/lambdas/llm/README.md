# LLM Lambda

AI-powered content generation for LinkedIn posts via OpenAI APIs.

## Runtime

- Python 3.13
- Handler: `lambda_function.lambda_handler`
- Route: `/llm`

## Operations

| Operation | Model | Mode | Description |
|-----------|-------|------|-------------|
| `generate_ideas` | gpt-4.1 | Synchronous | Generate LinkedIn post ideas from user profile + prompt |
| `research_selected_ideas` | o4-mini-deep-research | Async (background) | Deep research with web search; returns `job_id` for polling |
| `get_research_result` | — | Poll | Check DynamoDB/OpenAI for completed research/ideas/synthesis |
| `synthesize_research` | gpt-5.2 | Synchronous | Synthesize research + ideas into a ready-to-post LinkedIn post |

## Request Format

```json
{
  "operation": "generate_ideas",
  "job_id": "uuid",
  "prompt": "optional seed text",
  "user_profile": { "name": "...", "title": "...", ... }
}
```

## Authentication

Extracts `sub` from JWT claims via API Gateway authorizer:
- HTTP API v2: `event.requestContext.authorizer.jwt.claims.sub`
- REST API fallback: `event.requestContext.authorizer.claims.sub`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `DYNAMODB_TABLE_NAME` | Yes | DynamoDB table for result storage |
| `BEDROCK_MODEL_ID` | No | Bedrock model ID (unused currently) |

## Architecture

```
lambda_function.py     → Route operations, extract user_id
services/llm_service.py → LLMService class (business logic)
prompts.py             → Prompt templates (ideas, research, synthesize)
```

## Async Research Flow

1. `research_selected_ideas` creates an OpenAI background response, stores `openai_response_id` in DynamoDB
2. Frontend polls `get_research_result` every 15s
3. `_check_openai_response` calls `openai_client.responses.retrieve(id)` to check status
4. When `status == 'completed'`, stores content in DynamoDB and returns it
