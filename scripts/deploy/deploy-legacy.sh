#!/usr/bin/env bash
set -euo pipefail

# RAG-CloudStack deployment helper (minimal)
# Requires: aws cli, bash

STACK_PREFIX=${STACK_PREFIX:-rag-cloudstack}
PROJECT_NAME=${PROJECT_NAME:-rag-cloudstack}
REGION=${AWS_REGION:-us-west-2}
ARTIFACTS_BUCKET=${ARTIFACTS_BUCKET:-"${STACK_PREFIX}-artifacts-$(date +%s)"}
TABLE_NAME=${TABLE_NAME:-"${STACK_PREFIX}-table"}
API_NAME=${API_NAME:-"${STACK_PREFIX}-api"}
STAGE_NAME=${STAGE_NAME:-prod}
PYTHON_KEY=${PYTHON_KEY:-lambdas/python-handler.zip}
NODE_KEY=${NODE_KEY:-lambdas/node-handler.zip}
PLACEHOLDER_SEARCH_KEY=${PLACEHOLDER_SEARCH_KEY:-lambdas/placeholder-search.zip}
EDGE_PROCESSING_KEY=${EDGE_PROCESSING_KEY:-lambdas/edge-processing.zip}
DYNAMODB_API_KEY=${DYNAMODB_API_KEY:-lambdas/dynamodb-api.zip}
PYTHON_ZIP_PATH=${PYTHON_ZIP_PATH:-"./lambda-src/python/lambda_function.zip"}
NODE_ZIP_PATH=${NODE_ZIP_PATH:-"./lambda-src/node/index.zip"}
PLACEHOLDER_SEARCH_ZIP_PATH=${PLACEHOLDER_SEARCH_ZIP_PATH:-"../lambda-processing/linkedin-advanced-search-placeholder-search-prod/placeholder-search.zip"}
EDGE_PROCESSING_ZIP_PATH=${EDGE_PROCESSING_ZIP_PATH:-"../lambda-processing/linkedin-advanced-search-edge-processing-prod/edge-processing.zip"}
DYNAMODB_API_ZIP_PATH=${DYNAMODB_API_ZIP_PATH:-"../lambda-processing/linkedin-advanced-search-dynamodb-api-prod/dynamodb-api.zip"}
COGNITO_DOMAIN=${COGNITO_DOMAIN:-"${STACK_PREFIX}-domain"}
CALLBACK_URLS=${CALLBACK_URLS:-"http://localhost:5173"}
LOGOUT_URLS=${LOGOUT_URLS:-"http://localhost:5173"}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-""}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-""}
PYTHON_ROUTE_PATH=${PYTHON_ROUTE_PATH:-"/process"}
NODE_ROUTE_PATH=${NODE_ROUTE_PATH:-"/search"}

ROOT_DIR=$(cd "$(dirname "$0")" && pwd)
TPL_DIR="$ROOT_DIR/templates"

echo "Region: $REGION"

echo "Deploy S3 artifacts stack"
aws cloudformation deploy \
  --stack-name "${STACK_PREFIX}-s3" \
  --template-file "$TPL_DIR/s3-artifacts.yaml" \
  --parameter-overrides ProjectName="$PROJECT_NAME" ArtifactsBucketName="$ARTIFACTS_BUCKET" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$REGION"

echo "Packaging sample lambdas (if present) and uploading"
if [ -f "$PYTHON_ZIP_PATH" ]; then
  aws s3 cp "$PYTHON_ZIP_PATH" "s3://$ARTIFACTS_BUCKET/$PYTHON_KEY" --region "$REGION"
fi
if [ -f "$NODE_ZIP_PATH" ]; then
  aws s3 cp "$NODE_ZIP_PATH" "s3://$ARTIFACTS_BUCKET/$NODE_KEY" --region "$REGION"
fi
if [ -f "$PLACEHOLDER_SEARCH_ZIP_PATH" ]; then
  echo "Uploading placeholder search Lambda..."
  aws s3 cp "$PLACEHOLDER_SEARCH_ZIP_PATH" "s3://$ARTIFACTS_BUCKET/$PLACEHOLDER_SEARCH_KEY" --region "$REGION"
fi
if [ -f "$EDGE_PROCESSING_ZIP_PATH" ]; then
  echo "Uploading edge processing Lambda..."
  aws s3 cp "$EDGE_PROCESSING_ZIP_PATH" "s3://$ARTIFACTS_BUCKET/$EDGE_PROCESSING_KEY" --region "$REGION"
fi
if [ -f "$DYNAMODB_API_ZIP_PATH" ]; then
  echo "Uploading DynamoDB API Lambda..."
  aws s3 cp "$DYNAMODB_API_ZIP_PATH" "s3://$ARTIFACTS_BUCKET/$DYNAMODB_API_KEY" --region "$REGION"
fi

echo "Deploy DynamoDB stack"
aws cloudformation deploy \
  --stack-name "${STACK_PREFIX}-ddb" \
  --template-file "$TPL_DIR/dynamodb.yaml" \
  --parameter-overrides ProjectName="$PROJECT_NAME" TableName="$TABLE_NAME" \
  --region "$REGION"

echo "Deploy Lambdas stack"
aws cloudformation deploy \
  --stack-name "${STACK_PREFIX}-lambdas" \
  --template-file "$TPL_DIR/lambdas.yaml" \
  --parameter-overrides \
    ProjectName="$PROJECT_NAME" \
    ArtifactsBucketName="$ARTIFACTS_BUCKET" \
    PythonLambdaKey="$PYTHON_KEY" \
    NodeLambdaKey="$NODE_KEY" \
    PlaceholderSearchLambdaKey="$PLACEHOLDER_SEARCH_KEY" \
    EdgeProcessingLambdaKey="$EDGE_PROCESSING_KEY" \
    DynamoDBApiLambdaKey="$DYNAMODB_API_KEY" \
    DynamoTableName="$TABLE_NAME" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$REGION"

PY_ARN=$(aws cloudformation describe-stacks --stack-name "${STACK_PREFIX}-lambdas" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='PythonLambdaArn'].OutputValue" --output text)
NODE_ARN=$(aws cloudformation describe-stacks --stack-name "${STACK_PREFIX}-lambdas" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='NodeLambdaArn'].OutputValue" --output text)
PLACEHOLDER_SEARCH_ARN=$(aws cloudformation describe-stacks --stack-name "${STACK_PREFIX}-lambdas" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='PlaceholderSearchLambdaArn'].OutputValue" --output text)
EDGE_PROCESSING_ARN=$(aws cloudformation describe-stacks --stack-name "${STACK_PREFIX}-lambdas" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='EdgeProcessingLambdaArn'].OutputValue" --output text)
DYNAMODB_API_ARN=$(aws cloudformation describe-stacks --stack-name "${STACK_PREFIX}-lambdas" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='DynamoDBApiLambdaArn'].OutputValue" --output text)

echo "Deploy Cognito stack"
aws cloudformation deploy \
  --stack-name "${STACK_PREFIX}-cognito" \
  --template-file "$TPL_DIR/cognito.yaml" \
  --parameter-overrides \
    ProjectName="$PROJECT_NAME" \
    CognitoDomainPrefix="$COGNITO_DOMAIN" \
    GoogleClientId="$GOOGLE_CLIENT_ID" \
    GoogleClientSecret="$GOOGLE_CLIENT_SECRET" \
    CallbackUrls="$CALLBACK_URLS" \
    LogoutUrls="$LOGOUT_URLS" \
  --region "$REGION"

USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name "${STACK_PREFIX}-cognito" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name "${STACK_PREFIX}-cognito" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text)

echo "Deploy API Gateway HTTP stack"
aws cloudformation deploy \
  --stack-name "${STACK_PREFIX}-api" \
  --template-file "$TPL_DIR/apigw-http.yaml" \
  --parameter-overrides \
    ProjectName="$PROJECT_NAME" \
    ApiName="$API_NAME" \
    StageName="$STAGE_NAME" \
    PythonLambdaArn="$PY_ARN" \
    NodeLambdaArn="$NODE_ARN" \
    PlaceholderSearchLambdaArn="$PLACEHOLDER_SEARCH_ARN" \
    EdgeProcessingLambdaArn="$EDGE_PROCESSING_ARN" \
    DynamoDBApiLambdaArn="$DYNAMODB_API_ARN" \
    PythonRoutePath="$PYTHON_ROUTE_PATH" \
    NodeRoutePath="$NODE_ROUTE_PATH" \
    PlaceholderSearchRoutePath="/search" \
    EdgeRoutePath="/edge" \
    DynamoDBApiRoutePath="/dynamodb" \
    UserPoolId="$USER_POOL_ID" \
    UserPoolClientId="$USER_POOL_CLIENT_ID" \
  --region "$REGION"

API_BASE=$(aws cloudformation describe-stacks --stack-name "${STACK_PREFIX}-api" --region "$REGION" --query "Stacks[0].Outputs[?OutputKey=='BaseUrl'].OutputValue" --output text)

echo "\nDeployment complete.\n"
echo "Artifacts bucket:        s3://$ARTIFACTS_BUCKET"
echo "DynamoDB table:          $TABLE_NAME"
echo "Python Lambda:           $PY_ARN"
echo "Node Lambda:             $NODE_ARN"
echo "Placeholder Search:      $PLACEHOLDER_SEARCH_ARN"
echo "Edge Processing:         $EDGE_PROCESSING_ARN"
echo "DynamoDB API:            $DYNAMODB_API_ARN"
echo "API Base URL:            $API_BASE"
echo "Endpoints:"
echo "  - Search:              $API_BASE/search"
echo "  - Edge Processing:     $API_BASE/edge"
echo "  - DynamoDB API:        $API_BASE/dynamodb"
echo "Cognito UserPool:        $USER_POOL_ID"
echo "UserPool Client:         $USER_POOL_CLIENT_ID"


