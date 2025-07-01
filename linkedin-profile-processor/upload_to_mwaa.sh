#!/bin/bash

# This script uploads the DAG and requirements to the MWAA S3 bucket

# Get the MWAA bucket name from CloudFormation stack output
STACK_NAME="linkedin-profile-processor"
MWAA_BUCKET=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='MWAABucketName'].OutputValue" --output text)

if [ -z "$MWAA_BUCKET" ]; then
    echo "Error: Could not retrieve MWAA bucket name from CloudFormation stack"
    exit 1
fi

echo "MWAA bucket name: $MWAA_BUCKET"

# Create directories
mkdir -p dags

# Copy DAG file to dags directory
cp linkedin_profile_processing_dag.py dags/

# Upload DAG to S3
echo "Uploading DAG to S3..."
aws s3 cp dags/linkedin_profile_processing_dag.py s3://$MWAA_BUCKET/dags/

# Upload requirements.txt to S3
echo "Uploading requirements.txt to S3..."
aws s3 cp requirements.txt s3://$MWAA_BUCKET/

echo "Upload complete!"
