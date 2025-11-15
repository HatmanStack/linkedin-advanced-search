# LinkedIn Advanced Search - AWS Infrastructure

Serverless infrastructure for LinkedIn Advanced Search using AWS SAM (Serverless Application Model).

## Components

- **DynamoDB** - Single-table design for profiles, connections, and messages
- **Lambda Functions** - Edge processing, DynamoDB API, Placeholder search
- **API Gateway HTTP** - RESTful API with CORS and Cognito JWT authentication
- **Cognito User Pool** - User authentication and authorization
- **S3** - Screenshot and media storage

## Prerequisites

1. **AWS SAM CLI** installed:
   ```bash
   # Check if installed
   sam --version

   # Install if needed (Linux)
   pip install aws-sam-cli
   ```

2. **AWS Credentials** configured:
   ```bash
   aws configure
   # Enter: Access Key ID, Secret Access Key, Region (us-west-2)
   ```

3. **Python 3.13+** for local development:
   ```bash
   python3 --version
   ```

4. **Node.js 20+** for Node Lambda:
   ```bash
   node --version
   ```

---

## Quick Start

### 1. Setup Environment Files

```bash
# Copy .env.example to .env (get all defaults)
cp .env.example .env

# Generate encryption keypair
cd puppeteer-backend
node scripts/generate-device-keypair.js
cd ..
```

### 2. Setup Local Development Environment

```bash
cd RAG-CloudStack

# Create venv and install dependencies
./setup-dev.sh

# Activate venv (optional - for local testing only)
source venv/bin/activate
```

### 3. Build Lambda Functions

```bash
# SAM builds all Lambda functions automatically
sam build
```

This will:
- Package Python Lambdas with `requirements.txt` dependencies
- Package Node.js Lambda with `package.json` dependencies
- Create deployment artifacts in `.aws-sam/build/`

### 4. Deploy to AWS

**First time deployment:**
```bash
sam deploy --guided
```

**Prompts:**
- Stack Name: `linkedin-advanced-search` (or your choice)
- AWS Region: `us-west-2`
- Confirm changes before deploy: `Y`
- Allow SAM CLI IAM role creation: `Y`
- Disable rollback: `N`
- Save arguments to configuration file: `Y`
- SAM configuration file: `samconfig.toml` (default)

**Subsequent deployments:**
```bash
# Uses saved config from samconfig.toml
sam deploy
```

### 5. Update .env File Automatically

After deployment, automatically update your `.env` file with AWS outputs:

```bash
# Automatically update .env with deployment outputs
./get-env-vars.sh linkedin-advanced-search --update-env
```

**What this does:**
- Fetches CloudFormation stack outputs
- Updates or adds AWS variables to `../.env`
- Shows you what was updated

**Output example:**
```
✅ Stack outputs retrieved!
📝 Updating ../.env...
  ✓ Updated VITE_API_GATEWAY_URL
  ✓ Updated VITE_COGNITO_USER_POOL_ID
  ✓ Updated VITE_COGNITO_USER_POOL_WEB_CLIENT_ID
  ✓ Added DYNAMODB_TABLE
✅ Updated ../.env with AWS deployment outputs!
```

**Or view without updating:**
```bash
# Just show the values (don't update .env)
./get-env-vars.sh linkedin-advanced-search
```

### 6. Restart Your Servers

**Important:** Environment variables are only read on startup!

```bash
# Stop and restart frontend dev server
# Ctrl+C to stop
cd ..
npm run dev

# Restart backend (in another terminal)
cd puppeteer-backend
npm start
```

### 7. Test Your Deployment

```bash
# Get API URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name linkedin-advanced-search \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

echo "API URL: $API_URL"

# Test health (should return 403 - needs auth)
curl $API_URL/edge

# Expected: {"message":"Unauthorized"}
# This is correct - means API Gateway is working, just needs JWT token
```

---

## Architecture

### Lambda Functions

| Function | Runtime | Endpoint | Description |
|----------|---------|----------|-------------|
| **EdgeProcessingFunction** | Python 3.13 | `POST /edge` | Manages DynamoDB edges (connections) |
| **DynamoDBApiFunction** | Python 3.13 | `POST /dynamodb` | DynamoDB CRUD operations |
| **PlaceholderSearchFunction** | Node.js 20 | `POST /search` | Placeholder search (returns empty results) |

### API Endpoints

All endpoints require Cognito JWT authentication via `Authorization: Bearer <token>` header.

**Base URL:** `https://{api-id}.execute-api.us-west-2.amazonaws.com/prod`

- `POST /edge` - Edge processing operations
- `POST /dynamodb` - DynamoDB operations
- `POST /search` - Search profiles (placeholder)

### DynamoDB Schema

**Table:** `{stack-name}-profiles`

**Keys:**
- `PK` (Partition Key) - `USER#{userId}` or `PROFILE#{profileId}`
- `SK` (Sort Key) - `CONNECTION#{profileUrl}` or `EDGE#{edgeType}`

**GSI1:**
- `GSI1PK` - `USER#{userId}#STATUS#{status}`
- `GSI1SK` - `CONNECTION#{profileUrl}`

---

## Local Testing with SAM

### Test Lambda Locally

```bash
# Test edge processing function
sam local invoke EdgeProcessingFunction -e events/edge-test.json

# Test with custom event
echo '{"body":"{\"operation\":\"test\"}"}' | sam local invoke EdgeProcessingFunction
```

### Run API Locally

```bash
# Start local API Gateway
sam local start-api

# API available at http://localhost:3000
curl -X POST http://localhost:3000/edge \
  -H "Content-Type: application/json" \
  -d '{"operation":"get_connections_by_status","updates":{"status":"possible"}}'
```

### Hot Reload Development

```bash
# Watch for changes and auto-deploy
sam sync --watch

# Make changes to Lambda code
# SAM automatically rebuilds and deploys!
```

### View Logs

```bash
# Tail logs for a function
sam logs -n EdgeProcessingFunction --tail

# View logs from specific time
sam logs -n EdgeProcessingFunction --start-time '10min ago'
```

---

## Development Workflow

### Make Changes to Lambda Code

```bash
# 1. Edit Lambda code
nano ../lambda-processing/linkedin-advanced-search-edge-processing-prod/lambda_function.py

# 2. Test locally (optional)
sam local invoke EdgeProcessingFunction -e events/edge-test.json

# 3. Build
sam build

# 4. Deploy
sam deploy
```

### Update Infrastructure

```bash
# 1. Edit SAM template
nano template.yaml

# 2. Validate
sam validate

# 3. Deploy
sam build && sam deploy
```

---

## Managing Multiple Environments

### Deploy to Dev/Staging/Prod

```bash
# Dev environment
sam deploy --config-env dev
# Creates stack: linkedin-advanced-search-dev

# Staging environment
sam deploy --config-env staging
# Creates stack: linkedin-advanced-search-staging

# Production (default)
sam deploy
# Creates stack: linkedin-advanced-search
```

### Get Environment-Specific Outputs

```bash
# Dev outputs
./get-env-vars.sh linkedin-advanced-search-dev > .env.dev

# Staging outputs
./get-env-vars.sh linkedin-advanced-search-staging > .env.staging

# Production outputs
./get-env-vars.sh linkedin-advanced-search > .env.prod
```

---

## Cleanup

### Delete Stack

```bash
# Delete the entire stack and all resources
sam delete

# Or specify stack name
sam delete --stack-name linkedin-advanced-search

# Confirm deletion when prompted
```

**Warning:** This will delete:
- All Lambda functions
- API Gateway
- DynamoDB table (and all data!)
- S3 bucket (must be empty first)
- Cognito User Pool (and all users!)

### Empty S3 Bucket Before Deletion

```bash
# Get bucket name
BUCKET=$(aws cloudformation describe-stacks \
  --stack-name linkedin-advanced-search \
  --query 'Stacks[0].Outputs[?OutputKey==`ScreenshotBucketName`].OutputValue' \
  --output text)

# Empty bucket
aws s3 rm s3://$BUCKET --recursive

# Now delete stack
sam delete
```

---

## Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
rm -rf .aws-sam/
sam build --use-container  # Uses Docker for consistent builds
```

### Deploy Fails - Secret Not Found

If you see `Secrets Manager can't find the specified secret`:
- The LLMFunction has been removed from template
- Rebuild: `sam build && sam deploy`

### CORS Errors

CORS is configured in the template:
```yaml
CorsConfiguration:
  AllowOrigins: ['*']
  AllowMethods: [GET, POST, OPTIONS]
  AllowHeaders: [Content-Type, Authorization]
```

If still having issues, check API Gateway in AWS Console → CORS settings.

### Lambda Timeout

Default timeout is 30 seconds. To increase:
```yaml
Globals:
  Function:
    Timeout: 60  # Increase to 60 seconds
```

---

## Files

```
RAG-CloudStack/
├── template.yaml              # Main SAM template
├── samconfig.toml            # SAM configuration
├── requirements.txt          # Python dependencies (local dev)
├── setup-dev.sh              # Setup local environment
├── get-env-vars.sh           # Get deployment outputs
├── events/
│   └── edge-test.json        # Sample test event
├── .gitignore                # Git ignore (venv, .aws-sam)
└── README.md                 # This file
```

---

## Additional Resources

- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [SAM CLI Reference](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-command-reference.html)
- [API Gateway HTTP APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api.html)
- [Cognito User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)

---

## Support

For issues or questions:
1. Check CloudWatch Logs for Lambda errors
2. Review API Gateway logs
3. Validate SAM template: `sam validate`
4. Check stack events: `aws cloudformation describe-stack-events --stack-name linkedin-advanced-search`
