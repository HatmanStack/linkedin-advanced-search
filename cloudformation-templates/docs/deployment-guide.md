# Lambda CloudFormation Templates Deployment Guide

This guide provides step-by-step instructions for deploying the Lambda CloudFormation templates for the LinkedIn Advanced Search application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Template Overview](#template-overview)
3. [Deployment Order](#deployment-order)
4. [Deployment Methods](#deployment-methods)
   - [Using the Deployment Script](#using-the-deployment-script)
   - [Manual Deployment](#manual-deployment)
5. [Environment-Specific Configurations](#environment-specific-configurations)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Troubleshooting](#troubleshooting)
8. [Cleanup](#cleanup)

## Prerequisites

Before deploying the templates, ensure you have:

1. **AWS CLI** installed and configured with appropriate credentials
2. **DynamoDB Table** created with the name `linkedin-advanced-search` (or your custom name)
3. **DynamoDB Streams** enabled on the table (required for pinecone-indexer)
4. **Pinecone API Key** for vector search functionality
5. **OpenAI API Key** for AI processing (profile-processing and pinecone-indexer)
6. **Cognito User Pool** (optional) for API authentication

## Template Overview

The solution consists of the following CloudFormation templates:

1. **edge-processing-template.yaml**
   - Lambda function for managing edges between users and profiles
   - API Gateway REST API with proxy integration
   - IAM roles and permissions

2. **pinecone-indexer-template.yaml**
   - Lambda function for processing DynamoDB Stream events
   - Event source mapping with filter criteria
   - Dead letter queue for failed processing

3. **pinecone-search-template.yaml**
   - Lambda function for semantic search across profiles
   - API Gateway with CORS support
   - Optional Cognito integration

4. **profile-processing-template.yaml**
   - S3 bucket for profile screenshots
   - SQS queue for event notifications
   - Lambda function for processing profile data

5. **monitoring-resources.yaml**
   - CloudWatch dashboard
   - SNS topic for notifications
   - Composite alarms

## Deployment Order

The templates should be deployed in the following order to ensure proper dependency resolution:

1. **profile-processing-template.yaml** (creates S3 bucket and SQS queue)
2. **edge-processing-template.yaml** (creates API Gateway and Lambda)
3. **pinecone-indexer-template.yaml** (requires DynamoDB Stream ARN)
4. **pinecone-search-template.yaml** (creates search API)
5. **monitoring-resources.yaml** (references all other resources)

## Deployment Methods

### Using the Deployment Script

The provided deployment script automates the validation and deployment process:

```bash
# Navigate to the scripts directory
cd cloudformation-templates/scripts

# Make the script executable (if not already)
chmod +x deploy-templates.sh

# Deploy all templates with default parameters
./deploy-templates.sh

# Deploy with custom parameters
./deploy-templates.sh \
  --environment prod \
  --project-name my-linkedin-app \
  --table-name my-dynamodb-table

# Validate templates without deploying
./deploy-templates.sh --validate-only

# Deploy templates sequentially instead of in parallel
./deploy-templates.sh --sequential
```

### Manual Deployment

You can also deploy each template manually using the AWS CLI or AWS Management Console:

#### Using AWS CLI

```bash
# Deploy edge-processing template
aws cloudformation deploy \
  --template-file templates/edge-processing-template.yaml \
  --stack-name linkedin-advanced-search-edge-processing-dev \
  --parameter-overrides \
    Environment=dev \
    ProjectName=linkedin-advanced-search \
    DynamoDBTableName=linkedin-advanced-search \
  --capabilities CAPABILITY_NAMED_IAM

# Deploy pinecone-indexer template (requires DynamoDB Stream ARN)
STREAM_ARN=$(aws dynamodb describe-table --table-name linkedin-advanced-search --query "Table.LatestStreamArn" --output text)

aws cloudformation deploy \
  --template-file templates/pinecone-indexer-template.yaml \
  --stack-name linkedin-advanced-search-pinecone-indexer-dev \
  --parameter-overrides \
    Environment=dev \
    ProjectName=linkedin-advanced-search \
    DynamoDBTableName=linkedin-advanced-search \
    DynamoDBStreamArn=$STREAM_ARN \
  --capabilities CAPABILITY_NAMED_IAM

# Deploy pinecone-search template
aws cloudformation deploy \
  --template-file templates/pinecone-search-template.yaml \
  --stack-name linkedin-advanced-search-pinecone-search-dev \
  --parameter-overrides \
    Environment=dev \
    ProjectName=linkedin-advanced-search \
    DynamoDBTableName=linkedin-advanced-search \
  --capabilities CAPABILITY_NAMED_IAM

# Deploy profile-processing template
aws cloudformation deploy \
  --template-file templates/profile-processing-template.yaml \
  --stack-name linkedin-advanced-search-profile-processing-dev \
  --parameter-overrides \
    Environment=dev \
    ProjectName=linkedin-advanced-search \
    DynamoDBTableName=linkedin-advanced-search \
  --capabilities CAPABILITY_NAMED_IAM

# Deploy monitoring resources
aws cloudformation deploy \
  --template-file templates/monitoring-resources.yaml \
  --stack-name linkedin-advanced-search-monitoring-dev \
  --parameter-overrides \
    Environment=dev \
    ProjectName=linkedin-advanced-search \
    NotificationEmail=alerts@example.com \
  --capabilities CAPABILITY_NAMED_IAM
```

#### Using AWS Management Console

1. Open the AWS CloudFormation console
2. Click "Create stack" > "With new resources (standard)"
3. Upload the template file or specify an Amazon S3 URL
4. Enter stack name and parameter values
5. Configure stack options (tags, permissions, etc.)
6. Review and create the stack

## Environment-Specific Configurations

The templates support different environments through the `Environment` parameter:

### Development (dev)

```
Environment: dev
LambdaMemorySize: 256-512 MB
LambdaTimeout: 30 seconds
ApiThrottleBurstLimit: 100
ApiThrottleRateLimit: 50
```

### Staging

```
Environment: staging
LambdaMemorySize: 512 MB
LambdaTimeout: 30-60 seconds
ApiThrottleBurstLimit: 200
ApiThrottleRateLimit: 100
```

### Production (prod)

```
Environment: prod
LambdaMemorySize: 1024-2048 MB
LambdaTimeout: 30-120 seconds
ApiThrottleBurstLimit: 500
ApiThrottleRateLimit: 250
```

## Post-Deployment Verification

After deploying the templates, verify the deployment by:

1. **Checking Stack Outputs**
   ```bash
   aws cloudformation describe-stacks --stack-name linkedin-advanced-search-edge-processing-dev --query "Stacks[0].Outputs" --output table
   ```

2. **Testing API Endpoints**
   ```bash
   # Get API endpoint from stack outputs
   API_ENDPOINT=$(aws cloudformation describe-stacks --stack-name linkedin-advanced-search-edge-processing-dev --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)
   
   # Test the API
   curl -X POST \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{"linkedinurl": "https://www.linkedin.com/in/example", "operation": "create"}' \
     $API_ENDPOINT
   ```

3. **Checking CloudWatch Logs**
   ```bash
   # Get Lambda function name from stack outputs
   LAMBDA_NAME=$(aws cloudformation describe-stacks --stack-name linkedin-advanced-search-edge-processing-dev --query "Stacks[0].Outputs[?OutputKey=='LambdaFunctionName'].OutputValue" --output text)
   
   # Get the latest log events
   aws logs get-log-events --log-group-name /aws/lambda/$LAMBDA_NAME --log-stream-name $(aws logs describe-log-streams --log-group-name /aws/lambda/$LAMBDA_NAME --order-by LastEventTime --descending --limit 1 --query "logStreams[0].logStreamName" --output text)
   ```

4. **Viewing CloudWatch Dashboard**
   ```bash
   # Get dashboard URL from stack outputs
   aws cloudformation describe-stacks --stack-name linkedin-advanced-search-monitoring-dev --query "Stacks[0].Outputs[?OutputKey=='DashboardURL'].OutputValue" --output text
   ```

## Required Lambda Environment Variables

After deployment, ensure the following environment variables are set for each Lambda function via the AWS Management Console:

### Profile Processing Lambda
- `DYNAMODB_TABLE_NAME`
- `AI_MODEL_ID`

### Edge Processing Lambda
- `DYNAMODB_TABLE_NAME`

### Pinecone Indexer Lambda
- `DYNAMODB_TABLE_NAME`
- `DYNAMODB_STREAM_ARN`
- `PINECONE_API_KEY`
- `PINECONE_INDEX_NAME`
- `OPENAI_API_KEY`

### Pinecone Search Lambda
- `DYNAMODB_TABLE`
- `PINECONE_INDEX_NAME`
- `PINECONE_HOST`
- `PINECONE_API_KEY`

**Set these variables in the Lambda configuration after deployment to ensure correct operation.**


## Troubleshooting

### Common Issues

1. **Stack Creation Failure**
   - Check CloudFormation events for error details
   - Verify IAM permissions for CloudFormation service role
   - Ensure resource names don't conflict with existing resources

2. **Lambda Function Errors**
   - Check CloudWatch Logs for error messages
   - Verify environment variables are set correctly
   - Check IAM permissions for Lambda execution role

3. **API Gateway Issues**
   - Verify CORS configuration if accessing from browser
   - Check API Gateway CloudWatch Logs for request/response details
   - Test API with proper authentication headers

4. **DynamoDB Stream Issues**
   - Ensure DynamoDB Streams are enabled on the table
   - Verify the Stream ARN is correct in the pinecone-indexer template
   - Check Lambda event source mapping status

### Resolving Issues

1. **Update Stack with Corrected Parameters**
   ```bash
   aws cloudformation update-stack \
     --stack-name linkedin-advanced-search-edge-processing-dev \
     --template-body file://templates/edge-processing-template.yaml \
     --parameters ParameterKey=Environment,ParameterValue=dev \
                 ParameterKey=ProjectName,ParameterValue=linkedin-advanced-search \
                 ParameterKey=DynamoDBTableName,ParameterValue=linkedin-advanced-search \
     --capabilities CAPABILITY_NAMED_IAM
   ```

2. **Delete and Recreate Stack**
   ```bash
   # Delete stack
   aws cloudformation delete-stack --stack-name linkedin-advanced-search-edge-processing-dev
   
   # Wait for deletion to complete
   aws cloudformation wait stack-delete-complete --stack-name linkedin-advanced-search-edge-processing-dev
   
   # Recreate stack
   aws cloudformation deploy \
     --template-file templates/edge-processing-template.yaml \
     --stack-name linkedin-advanced-search-edge-processing-dev \
     --parameter-overrides \
       Environment=dev \
       ProjectName=linkedin-advanced-search \
       DynamoDBTableName=linkedin-advanced-search \
     --capabilities CAPABILITY_NAMED_IAM
   ```

## Cleanup

To remove all deployed resources:

```bash
# Delete stacks in reverse order of creation
aws cloudformation delete-stack --stack-name linkedin-advanced-search-monitoring-dev
aws cloudformation delete-stack --stack-name linkedin-advanced-search-pinecone-search-dev
aws cloudformation delete-stack --stack-name linkedin-advanced-search-pinecone-indexer-dev
aws cloudformation delete-stack --stack-name linkedin-advanced-search-edge-processing-dev
aws cloudformation delete-stack --stack-name linkedin-advanced-search-profile-processing-dev

# Wait for all stacks to be deleted
aws cloudformation list-stacks --stack-status-filter DELETE_COMPLETE
```

Note: S3 buckets with objects will not be deleted automatically. You need to empty the bucket first:

```bash
# Get bucket name from stack outputs
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name linkedin-advanced-search-profile-processing-dev --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)

# Empty bucket
aws s3 rm s3://$BUCKET_NAME --recursive

# Now delete the stack
aws cloudformation delete-stack --stack-name linkedin-advanced-search-profile-processing-dev
```