# Deployment Guide

## Prerequisites

- AWS CLI configured with appropriate credentials
- SAM CLI installed (`pip install aws-sam-cli`)
- Docker installed (for local Lambda builds)
- Node.js 22+
- Python 3.11+

## Quick Start

```bash
# Deploy AWS infrastructure
cd backend
sam build
sam deploy --guided
```

The guided deployment will prompt for:
- Stack name (e.g., `linkedin-advanced-search`)
- AWS Region
- Cognito domain prefix
- OpenAI API key (stored in Secrets Manager)

## Configuration

### After Deployment

SAM outputs several values needed for frontend configuration:

```bash
# Get outputs from deployed stack
aws cloudformation describe-stacks \
  --stack-name <your-stack-name> \
  --query 'Stacks[0].Outputs'
```

Update your `.env` file with:
- `VITE_API_GATEWAY_URL` - ApiUrl output
- `VITE_COGNITO_USER_POOL_ID` - UserPoolId output
- `VITE_COGNITO_USER_POOL_WEB_CLIENT_ID` - UserPoolClientId output

### Environment Files

| File | Purpose |
|------|---------|
| `.env` | Local development configuration |
| `.env.example` | Template with all variables documented |
| `backend/samconfig.toml` | SAM deployment configuration (auto-generated) |

## Infrastructure Components

### Lambda Functions

| Function | Purpose | Trigger |
|----------|---------|---------|
| `edge-processing` | Connection management | API Gateway |
| `profile-api` | User profile CRUD | API Gateway |
| `llm` | AI content generation | API Gateway |
| `profile-processing` | OCR and text extraction | S3 events |
| `webhook-handler` | OpenAI webhook callbacks | API Gateway |

### AWS Resources

- **DynamoDB** - Single-table design for all data
- **S3** - Screenshot and media storage
- **Cognito** - User authentication
- **API Gateway** - REST API with JWT authorization
- **Secrets Manager** - API key storage
- **CloudWatch** - Logging and monitoring

## CI/CD Strategy

This project uses CI-only strategy (no automatic deployment):

```yaml
# GitHub Actions runs:
- npm run lint
- npm run build
- sam validate

# Deployment is manual:
sam deploy --guided
```

## Troubleshooting

### Common Issues

**SAM Build Fails**
```bash
# Ensure Docker is running
docker info

# Clean and rebuild
sam build --use-container
```

**API Gateway 401 Errors**
- Verify Cognito configuration in `.env`
- Check JWT token is valid and not expired
- Confirm API Gateway authorizer is configured

**Lambda Timeout**
- Default timeout is 30s
- Increase in `template.yaml` if needed
- Check CloudWatch logs for slow operations

**DynamoDB Throttling**
- Default is on-demand capacity
- Check CloudWatch for throttled requests
- Consider provisioned capacity for consistent loads

### Logs

```bash
# View Lambda logs
sam logs -n EdgeProcessingFunction --stack-name <stack-name> --tail

# View all CloudWatch logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/<stack-name>
```

## Security Considerations

- Never commit `.env` files with real credentials
- Rotate API keys regularly
- Enable CloudTrail for audit logging
- Use least-privilege IAM roles
- Enable encryption at rest for DynamoDB and S3

## Updating

```bash
# Update infrastructure
cd backend
sam build
sam deploy

# Update frontend
cd frontend
npm run build
# Deploy dist/ to your hosting provider
```

## Rollback

```bash
# View deployment history
aws cloudformation list-stacks

# Rollback to previous version
aws cloudformation rollback-stack --stack-name <stack-name>
```
