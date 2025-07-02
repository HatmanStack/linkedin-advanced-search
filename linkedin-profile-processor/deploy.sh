#!/bin/bash

# Deploy MWAA Environment with Airflow 2.10.3 and Enhanced Permissions
# This script deploys the complete infrastructure with DynamoDB, Bedrock, and Textract access

set -e

# Configuration
STACK_NAME="linkedin-profile-processor-mwaa"
TEMPLATE_FILE="mwaa-complete-template-v2.yaml"
BUCKET_NAME="linkedin-profile-processor-631094035453-us-west-2"
ENVIRONMENT_NAME="linkedin-profile-processor"
REGION="us-west-2"

echo "🚀 Deploying MWAA Environment with Airflow 2.10.3"
echo "Stack: $STACK_NAME | Template: $TEMPLATE_FILE | Region: $REGION"

# Check if template file exists
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo "❌ Template file $TEMPLATE_FILE not found!"
    exit 1
fi

# Check if S3 bucket exists
if ! aws s3 ls "s3://$BUCKET_NAME" --region $REGION > /dev/null 2>&1; then
    echo "❌ S3 bucket $BUCKET_NAME not found!"
    exit 1
fi

# Upload requirements.txt and DAGs to S3
echo "📦 Uploading files to S3..."
aws s3 cp requirements.txt "s3://$BUCKET_NAME/requirements.txt" --region $REGION
aws s3 cp dags/ "s3://$BUCKET_NAME/dags/" --recursive --region $REGION
echo "✅ Files uploaded"

# Validate CloudFormation template
echo "🔍 Validating template..."
aws cloudformation validate-template --template-body file://$TEMPLATE_FILE --region $REGION > /dev/null
echo "✅ Template valid"

# Deploy the stack
echo "🚀 Deploying stack..."
aws cloudformation deploy \
    --template-file $TEMPLATE_FILE \
    --stack-name $STACK_NAME \
    --parameter-overrides \
        MWAAEnvironmentName=$ENVIRONMENT_NAME \
        MWAABucketName=$BUCKET_NAME \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGION \
    --no-fail-on-empty-changeset

if [ $? -eq 0 ]; then
    echo "✅ Deployment completed!"
    
    # Get webserver URL
    WEBSERVER_URL=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`MWAAWebserverUrl`].OutputValue' \
        --output text)
    
    echo "🌐 Airflow UI: $WEBSERVER_URL"
    echo "📝 Configure your Claude model ID in the DAG before use"
else
    echo "❌ Deployment failed!"
    exit 1
fi
