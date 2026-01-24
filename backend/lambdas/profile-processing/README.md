# Profile Processing Lambda

Converts LinkedIn profile screenshots uploaded to S3 into structured DynamoDB items with AI-powered text extraction.

## Runtime

- Python 3.13
- Handler: `lambda_function.lambda_handler`
- Trigger: SQS queue (from S3 upload notifications)
- Timeout: 2 minutes
- Memory: 1024 MB

## Processing Flow

```
S3 Upload → SQS → Lambda → Textract OCR → Bedrock AI Parse → DynamoDB + RAGStack
```

1. **S3 Event**: New screenshot upload triggers SQS message
2. **Download**: Fetch image from S3
3. **OCR**: Amazon Textract extracts text lines from image
4. **S3 Metadata**: Extract LinkedIn URL from S3 object metadata
5. **AI Parse**: Bedrock (Llama 3.2 90B) extracts structured profile fields
6. **DynamoDB**: Store profile metadata item
7. **Markdown**: Generate and save markdown summary to S3
8. **RAGStack**: Auto-ingest markdown for semantic search (best-effort, non-fatal)

## DynamoDB Schema

```
PK: PROFILE#<base64_encoded_linkedin_url>
SK: #METADATA

Attributes:
- name, headline, summary, originalUrl
- currentCompany, currentTitle, currentLocation
- workExperience[], education[], skills[]
- createdAt, updatedAt, fulltext
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DYNAMODB_TABLE_NAME` | Yes | DynamoDB table for profile storage |
| `BEDROCK_MODEL_ID` | No | Override AI model (default: `us.meta.llama3-2-90b-instruct-v1:0`) |
| `RAGSTACK_GRAPHQL_ENDPOINT` | No | RAGStack endpoint for auto-ingestion |
| `RAGSTACK_API_KEY` | No | RAGStack API key |

## IAM Permissions Required

- `textract:DetectDocumentText`
- `bedrock:InvokeModel`
- `s3:GetObject`, `s3:PutObject`, `s3:HeadObject`
- `dynamodb:PutItem`
- `sqs:ReceiveMessage`, `sqs:DeleteMessage`

## Architecture

```
lambda_function.py                          → SQS event handler
services/profile_processing_service.py      → ProfileProcessingService class
```
