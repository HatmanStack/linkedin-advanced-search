#!/bin/bash

# This script deploys the MWAA environment and related resources

STACK_NAME="linkedin-profile-processor"
REGION=$(aws configure get region)

if [ -z "$REGION" ]; then
    REGION="us-west-2"  # Default to us-west-2 if no region is configured
fi

echo "Deploying to region: $REGION"

# Deploy CloudFormation stack
echo "Deploying CloudFormation stack..."
aws cloudformation deploy \
    --template-file mwaa-template.yaml \
    --stack-name $STACK_NAME \
    --capabilities CAPABILITY_IAM \
    --region $REGION

# Check if deployment was successful
if [ $? -ne 0 ]; then
    echo "Error: CloudFormation deployment failed"
    exit 1
fi

echo "CloudFormation stack deployed successfully!"

# Upload DAG and requirements to S3
echo "Uploading DAG and requirements to S3..."
./upload_to_mwaa.sh

echo "Deployment complete!"
echo "Note: It may take 20-30 minutes for the MWAA environment to be fully created and ready to use."
echo "You can check the status in the AWS Management Console."
