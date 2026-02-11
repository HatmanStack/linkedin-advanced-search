# LinkedIn Advanced Search - Deployment Guide

## Overview

This guide covers deploying LinkedIn Advanced Search with integrated RAGStack for semantic profile search.

## Deployment Options

### Option 1: One-Click Deployment with RAGStack (Recommended)

Deploy everything in a single command - LinkedIn backend + RAGStack nested stack.

**Prerequisites:**
- AWS Account with admin access
- AWS CLI configured (`aws configure`)
- SAM CLI installed ([Install SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))
- Python 3.13+

**Deploy:**

```bash
cd backend

# First time deployment (guided mode)
sam build
sam deploy --guided
```

**During guided deployment, provide:**
- **Stack name:** `linkedin-advanced-search` (or your choice)
- **AWS Region:** `us-east-1` (recommended - Nova Multimodal Embeddings available)
- **DeployRAGStack:** `true` (default)
- **AdminEmail:** Your email address (for RAGStack dashboard login)
- **Environment:** `prod` or `dev`
- **OpenAIApiKey:** Your OpenAI API key (optional, for LLM features)
- **BedrockModelId:** Leave default or customize
- Accept all other defaults

**Deployment takes ~15-20 minutes:**
- LinkedIn stack: ~5 minutes
- RAGStack nested stack: ~10-15 minutes (includes UI build)

**After deployment:**
1. Check your email for RAGStack password (from Cognito)
2. Get stack outputs:
   ```bash
   sam list stack-outputs
   ```
3. Note these values for frontend `.env`:
   - `ApiUrl` - Backend API endpoint
   - `UserPoolId` - Cognito user pool
   - `UserPoolClientId` - Cognito app client
   - `RAGStackDashboardUrl` - RAGStack UI (optional, for viewing indexed profiles)
   - `RAGStackGraphQLEndpoint` - Auto-configured for Lambdas

### Option 2: Separate RAGStack Deployment

Deploy RAGStack separately, then link it to LinkedIn backend.

**Use this if:**
- You already have a RAGStack deployment
- You want to share RAGStack across multiple applications
- You need different deployment schedules

**Steps:**

1. **Deploy RAGStack separately** (from RAGStack-Lambda repo):
   ```bash
   cd ~/projects/RAGStack-Lambda
   python publish.py --project-name linkedin-ragstack --admin-email admin@example.com
   ```

2. **Get RAGStack outputs:**
   ```bash
   aws cloudformation describe-stacks \
     --stack-name linkedin-ragstack \
     --query 'Stacks[0].Outputs'
   ```

3. **Deploy LinkedIn backend with external RAGStack:**
   ```bash
   cd ~/projects/linkedin-advanced-search/backend
   sam build
   sam deploy --guided
   ```

   During deployment:
   - **DeployRAGStack:** `false`
   - **RagstackGraphqlEndpoint:** `<GraphQLApiUrl from step 2>`
   - **RagstackApiKey:** `<ApiKey from step 2>`

## Post-Deployment Setup

### 1. Configure Frontend

Update `frontend/.env`:

```bash
# Get values from stack outputs
cd backend
sam list stack-outputs

# Update frontend/.env
cd ../frontend
cat > .env << EOF
VITE_API_URL=<ApiUrl from outputs>
VITE_COGNITO_USER_POOL_ID=<UserPoolId>
VITE_COGNITO_CLIENT_ID=<UserPoolClientId>
VITE_COGNITO_REGION=us-east-1
EOF
```

### 2. Create Admin User

```bash
# Create user via Cognito
aws cognito-idp admin-create-user \
  --user-pool-id <UserPoolId> \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com \
  --temporary-password TempPass123! \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id <UserPoolId> \
  --username admin@example.com \
  --password YourSecurePassword123! \
  --permanent
```

### 3. Test RAGStack Integration

```bash
# Get API key from SSM Parameter Store
RAGSTACK_API_KEY=$(aws ssm get-parameter \
  --name "/linkedin-ragstack-prod/api-key" \
  --with-decryption \
  --query 'Parameter.Value' \
  --output text)

# Test search (should return empty results initially)
curl -X POST '<RAGStackGraphQLEndpoint>' \
  -H 'x-api-key: '"$RAGSTACK_API_KEY"'' \
  -H 'Content-Type: application/json' \
  -d '{"query":"query { searchKnowledgeBase(query: \"software engineer\") { results { content } } }"}'
```

## Updating the Stack

### Update LinkedIn Backend Only

```bash
cd backend
sam build
sam deploy  # No --guided needed after first deployment
```

### Update Both LinkedIn + RAGStack

If you modify RAGStack parameters (BuildDashboard, BuildWebComponent, etc.), redeploy:

```bash
cd backend
sam build
sam deploy --parameter-overrides DeployRAGStack=true AdminEmail=admin@example.com
```

**⚠️ Warning:** Changing `DeployRAGStack` from `true` to `false` or vice versa will orphan resources. Stick with your initial choice.

## Deployment Scenarios

### Development Environment

```bash
sam deploy --parameter-overrides \
  Environment=dev \
  IncludeDevOrigins=true \
  DeployRAGStack=true \
  AdminEmail=dev@example.com
```

### Production Environment

```bash
sam deploy --parameter-overrides \
  Environment=prod \
  IncludeDevOrigins=false \
  ProductionOrigins=https://myapp.com \
  ProductionOrigin=https://myapp.com \
  DeployRAGStack=true \
  AdminEmail=admin@example.com \
  OpenAIApiKey=sk-... \
  BedrockModelId=us.meta.llama3-2-90b-instruct-v1:0
```

## Cost Estimates

**LinkedIn Backend Only:**
- DynamoDB: ~$2-5/month (pay-per-request)
- Lambda: Free tier covers most dev usage
- S3: ~$1/month (screenshot storage)
- Cognito: Free tier (50,000 MAU)
- **Total: ~$3-6/month**

**With RAGStack Nested Stack:**
- RAGStack: ~$7-10/month (1000 docs, Textract + Bedrock)
- LinkedIn Backend: ~$3-6/month
- **Total: ~$10-16/month**

## Troubleshooting

### RAGStack Deployment Fails

**Error:** "Bucket name should not contain uppercase characters"
- **Fix:** Ensure `Environment` parameter is lowercase (use `prod` not `Prod`)

**Error:** "AdminEmail is required"
- **Fix:** Provide `--parameter-overrides AdminEmail=admin@example.com`

**Error:** Nested stack timeout
- **Fix:** This is normal for first deployment (UI build). Wait up to 20 minutes.

### Lambda Environment Variables Not Set

**Symptom:** "RAGStack not configured" errors in logs

**Fix:** Check conditional logic in template.yaml:
```bash
# Verify outputs exist
aws cloudformation describe-stacks \
  --stack-name linkedin-advanced-search \
  --query 'Stacks[0].Outputs[?OutputKey==`RAGStackGraphQLEndpoint`]'

# Check Lambda env vars
aws lambda get-function-configuration \
  --function-name linkedin-edge-processing-prod \
  --query 'Environment.Variables'
```

### Access RAGStack Dashboard

1. Get dashboard URL from outputs:
   ```bash
   sam list stack-outputs | grep RAGStackDashboardUrl
   ```

2. Login with your AdminEmail and password from Cognito email

## Clean Up

**Delete entire stack:**
```bash
sam delete
```

This deletes:
- LinkedIn backend resources
- RAGStack nested stack (if deployed)
- **Note:** S3 buckets and DynamoDB tables have retention policies and may need manual deletion

**Delete RAGStack only** (if deployed as nested):
- Not recommended - will break Lambda integrations
- If needed, change `DeployRAGStack=false` and provide external endpoint

## Next Steps

- [Configure Frontend](../frontend/README.md)
- [Lambda Documentation](lambdas/edge-processing/README.md)
- [RAGStack Configuration](https://github.com/HatmanStack/RAGStack-Lambda/blob/main/docs/CONFIGURATION.md)
