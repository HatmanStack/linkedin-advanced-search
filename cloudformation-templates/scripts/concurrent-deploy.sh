#!/bin/bash

# Concurrent CloudFormation Template Deployment Script
# Validates all templates, then deploys them in parallel with no approval required

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="$SCRIPT_DIR/../templates"
DEPLOYMENT_RESULTS=()
PIDS=()

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default parameters
ENVIRONMENT="[ENVIRONMENT_VALUE]"
PROJECT_NAME="[PROJECT_NAME]"
DYNAMODB_TABLE_NAME="[TABLE_NAME]"
DYNAMODB_STREAM_ARN="arn:aws:dynamodb:[REGION]:[ACCOUNT_ID]:table/[TABLE_NAME]/stream/[TIMESTAMP]"
VALIDATE_ONLY=false
NOTIFICATION_EMAIL=""
SKIP_VALIDATION=false
SKIP_MONITORING=false
BUCKET_NAME="[BUCKET_NAME]"
COGNITO_USER_POOL_ID="[REGION]_[POOL_ID]"
COGNITO_USER_POOL_CLIENT_ID="[CLIENT_ID]"
COGNITO_USER_POOL_ARN="[COGNITO_ARN]"
LAMBDA_CODE_S3_BUCKET="[BUCKET_NAME]"
LAMBDA_CODE_S3_KEY="[S3_KEY_PATH]"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        --environment|-e)
            ENVIRONMENT="$2"
            shift
            shift
            ;;
        --project-name|-p)
            PROJECT_NAME="$2"
            shift
            shift
            ;;
        --table-name|-t)
            DYNAMODB_TABLE_NAME="$2"
            shift
            shift
            ;;
        --bucket-name|-b)
            BUCKET_NAME="$2"
            shift
            shift
            ;;
        --cognito-user-pool-id|-u)
            COGNITO_USER_POOL_ID="$2"
            shift
            shift
            ;;
        --cognito-user-pool-client-id|-c)
            COGNITO_USER_POOL_CLIENT_ID="$2"
            shift
            shift
            ;;
        --cognito-user-pool-arn|-a)
            COGNITO_USER_POOL_ARN="$2"
            shift
            shift
            ;;
        --lambda-code-s3-bucket|-l)
            LAMBDA_CODE_S3_BUCKET="$2"
            shift
            shift
            ;;
        --lambda-code-s3-key|-k)
            LAMBDA_CODE_S3_KEY="$2"
            shift
            shift
            ;;
        --validate-only|-v)
            VALIDATE_ONLY=true
            shift
            ;;
        --notification-email|-n)
            NOTIFICATION_EMAIL="$2"
            shift
            shift
            ;;
        --skip-validation|-s)
            SKIP_VALIDATION=true
            shift
            ;;
        --skip-monitoring|-m)
            SKIP_MONITORING=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --environment, -e       Environment name (dev, staging, prod) [default: dev]"
            echo "  --project-name, -p      Project name for resource naming [default: linkedin-advanced-search]"
            echo "  --table-name, -t        DynamoDB table name [default: linkedin-advanced-search]"
            echo "  --bucket-name, -b       S3 bucket name for screenshots"
            echo "  --cognito-user-pool-id, -u    Cognito User Pool ID"
            echo "  --cognito-user-pool-client-id, -c    Cognito User Pool Client ID"
            echo "  --cognito-user-pool-arn, -a    Cognito User Pool ARN"
            echo "  --lambda-code-s3-bucket, -l    S3 bucket for Lambda code"
            echo "  --lambda-code-s3-key, -k    S3 key for Lambda code"
            echo "  --notification-email, -n Email address for alarm notifications"
            echo "  --validate-only, -v     Only validate templates, don't deploy"
            echo "  --skip-validation, -s   Skip template validation step"
            echo "  --skip-monitoring, -m   Skip monitoring resources deployment"
            echo "  --help, -h              Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║            Concurrent CloudFormation Deployment            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo -e "${YELLOW}Environment:${NC} $ENVIRONMENT"
echo -e "${YELLOW}Project Name:${NC} $PROJECT_NAME"
echo -e "${YELLOW}DynamoDB Table:${NC} $DYNAMODB_TABLE_NAME"
echo -e "${YELLOW}Validate Only:${NC} $VALIDATE_ONLY"
echo -e "${YELLOW}Skip Validation:${NC} $SKIP_VALIDATION"
echo -e "${YELLOW}Skip Monitoring:${NC} $SKIP_MONITORING"
echo -e "${YELLOW}Templates Directory:${NC} $TEMPLATES_DIR"

# Check if templates directory exists
if [ ! -d "$TEMPLATES_DIR" ]; then
    echo -e "${RED}Templates directory not found: $TEMPLATES_DIR${NC}"
    exit 1
fi

# Find all YAML templates and convert to absolute paths
template_files=($(find "$TEMPLATES_DIR" -name "*.yaml" -o -name "*.yml" | while read file; do realpath "$file"; done))

if [ ${#template_files[@]} -eq 0 ]; then
    echo -e "${RED}No CloudFormation templates found in $TEMPLATES_DIR${NC}"
    exit 1
fi

# Filter out monitoring template if skip-monitoring is set
if [ "$SKIP_MONITORING" = true ]; then
    filtered_templates=()
    for template in "${template_files[@]}"; do
        if [[ ! "$template" =~ monitoring ]]; then
            filtered_templates+=("$template")
        fi
    done
    template_files=("${filtered_templates[@]}")
fi

echo -e "\n${BLUE}Found ${#template_files[@]} template(s) to process${NC}"

# Function to validate a template
validate_template() {
    local template_file="$1"
    local template_name=$(basename "$template_file" .yaml)
    
    echo -e "\n${YELLOW}Validating template: $template_name${NC}"
    
    if aws cloudformation validate-template --template-body "file://$template_file" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Template validation passed: $template_name${NC}"
        return 0
    else
        echo -e "${RED}✗ Template validation failed: $template_name${NC}"
        aws cloudformation validate-template --template-body "file://$template_file" 2>&1
        return 1
    fi
}

# Helper function to add parameter if value is not empty
add_parameter() {
    local param_name="$1"
    local param_value="$2"
    
    if [ ! -z "$param_value" ]; then
        echo " ParameterKey=$param_name,ParameterValue=$param_value"
    fi
}

# Helper function to add Cognito parameters
add_cognito_parameters() {
    local cognito_params=""
    
    if [ ! -z "$COGNITO_USER_POOL_ID" ]; then
        cognito_params="$cognito_params ParameterKey=CognitoUserPoolId,ParameterValue=$COGNITO_USER_POOL_ID"
    fi
    if [ ! -z "$COGNITO_USER_POOL_CLIENT_ID" ]; then
        cognito_params="$cognito_params ParameterKey=CognitoUserPoolClientId,ParameterValue=$COGNITO_USER_POOL_CLIENT_ID"
    fi
    if [ ! -z "$COGNITO_USER_POOL_ARN" ]; then
        cognito_params="$cognito_params ParameterKey=CognitoUserPoolArn,ParameterValue=$COGNITO_USER_POOL_ARN"
    fi
    
    echo "$cognito_params"
}

# Helper function to add Lambda code parameters
add_lambda_parameters() {
    local template_name="$1"
    local lambda_params=""
    
    if [[ "$template_name" == *"-template" ]]; then
        local lambda_zip_name="${template_name%%-template}.zip"
        local lambda_code_s3_key="lambda/$lambda_zip_name"
        
        if [ ! -z "$LAMBDA_CODE_S3_BUCKET" ]; then
            lambda_params="$lambda_params ParameterKey=LambdaCodeS3Bucket,ParameterValue=$LAMBDA_CODE_S3_BUCKET"
        fi
        if [ ! -z "$lambda_code_s3_key" ]; then
            lambda_params="$lambda_params ParameterKey=LambdaCodeS3Key,ParameterValue=$lambda_code_s3_key"
        fi
    fi
    
    echo "$lambda_params"
}

# Helper function to get DynamoDB Stream ARN
get_dynamodb_stream_arn() {
    local stream_arn="$DYNAMODB_STREAM_ARN"
    
    if [ -z "$stream_arn" ] || [ "$stream_arn" == "None" ]; then
        stream_arn=$(aws dynamodb describe-table --table-name "$DYNAMODB_TABLE_NAME" --query "Table.LatestStreamArn" --output text)
    fi
    
    if [ -z "$stream_arn" ] || [ "$stream_arn" == "None" ]; then
        echo -e "${RED}DynamoDB Stream not enabled for table: $DYNAMODB_TABLE_NAME${NC}"
        return 1
    fi
    
    echo "$stream_arn"
}

# Function to deploy a template
deploy_template() {
    local template_file="$1"
    local template_name=$(basename "$template_file" .yaml)
    local stack_name="${PROJECT_NAME}-${template_name%%-template}-${ENVIRONMENT}"

    echo -e "\n${YELLOW}Deploying stack: $stack_name${NC}"
    echo -e "${CYAN}DEBUG: Template file path: $template_file${NC}"
    echo -e "${CYAN}DEBUG: Template name: $template_name${NC}"
    echo -e "${CYAN}DEBUG: Stack name: $stack_name${NC}"
    
    # Check if template file exists and is readable
    if [ ! -f "$template_file" ]; then
        echo -e "${RED}ERROR: Template file does not exist: $template_file${NC}"
        return 1
    fi
    
    if [ ! -r "$template_file" ]; then
        echo -e "${RED}ERROR: Template file is not readable: $template_file${NC}"
        return 1
    fi
    
    echo -e "${CYAN}DEBUG: Template file exists and is readable${NC}"

    # Debug: Check if key variables are set
    echo -e "${CYAN}DEBUG: LAMBDA_CODE_S3_BUCKET='$LAMBDA_CODE_S3_BUCKET'${NC}"
    echo -e "${CYAN}DEBUG: LAMBDA_CODE_S3_KEY='$LAMBDA_CODE_S3_KEY'${NC}"
    echo -e "${CYAN}DEBUG: COGNITO_USER_POOL_ID='$COGNITO_USER_POOL_ID'${NC}"
    echo -e "${CYAN}DEBUG: COGNITO_USER_POOL_ARN='$COGNITO_USER_POOL_ARN'${NC}"

    # Build parameters as an array using simplified format
    local param_array=()
    
    # Base parameters - always required
    param_array+=("Environment=$ENVIRONMENT")
    param_array+=("ProjectName=$PROJECT_NAME")
    param_array+=("DynamoDBTableName=$DYNAMODB_TABLE_NAME")

    echo -e "${CYAN}DEBUG: Base parameters added: ${#param_array[@]} parameters${NC}"

    # Template-specific parameters
    case "$template_name" in
        "pinecone-indexer-template")
            echo -e "${CYAN}DEBUG: Adding pinecone-indexer parameters${NC}"
            # Lambda parameters
            if [[ "$template_name" == *"-template" ]]; then
                local lambda_zip_name="${template_name%%-template}.zip"
                local lambda_code_s3_key="lambda/$lambda_zip_name"
                param_array+=("LambdaCodeS3Bucket=$LAMBDA_CODE_S3_BUCKET")
                param_array+=("LambdaCodeS3Key=$lambda_code_s3_key")
            fi
            # Stream ARN
            local stream_arn=$(get_dynamodb_stream_arn)
            if [ $? -ne 0 ]; then
                return 1
            fi
            param_array+=("DynamoDBStreamArn=$stream_arn")
            ;;
        "profile-processing-template")
            echo -e "${CYAN}DEBUG: Adding profile-processing parameters${NC}"
            # Lambda parameters
            if [[ "$template_name" == *"-template" ]]; then
                local lambda_zip_name="${template_name%%-template}.zip"
                local lambda_code_s3_key="lambda/$lambda_zip_name"
                param_array+=("LambdaCodeS3Bucket=$LAMBDA_CODE_S3_BUCKET")
                param_array+=("LambdaCodeS3Key=$lambda_code_s3_key")
            fi
            # Bucket name
            if [ ! -z "$BUCKET_NAME" ]; then
                param_array+=("BucketName=$BUCKET_NAME")
            fi
            ;;
        "edge-processing-template"|"pinecone-search-template"|"dynamodb-api-template")
            echo -e "${CYAN}DEBUG: Adding parameters for $template_name${NC}"
            # Lambda parameters
            if [[ "$template_name" == *"-template" ]]; then
                local lambda_zip_name="${template_name%%-template}.zip"
                local lambda_code_s3_key="lambda/$lambda_zip_name"
                param_array+=("LambdaCodeS3Bucket=$LAMBDA_CODE_S3_BUCKET")
                param_array+=("LambdaCodeS3Key=$lambda_code_s3_key")
            fi
            # Cognito parameters
            if [ ! -z "$COGNITO_USER_POOL_ID" ]; then
                param_array+=("CognitoUserPoolId=$COGNITO_USER_POOL_ID")
            fi
            if [ ! -z "$COGNITO_USER_POOL_CLIENT_ID" ]; then
                param_array+=("CognitoUserPoolClientId=$COGNITO_USER_POOL_CLIENT_ID")
            fi
            if [ ! -z "$COGNITO_USER_POOL_ARN" ]; then
                param_array+=("CognitoUserPoolArn=$COGNITO_USER_POOL_ARN")
            fi
            ;;
        "monitoring-resources")
            echo -e "${CYAN}DEBUG: Adding monitoring parameters${NC}"
            # No Lambda parameters for monitoring
            if [ ! -z "$NOTIFICATION_EMAIL" ]; then
                param_array+=("NotificationEmail=$NOTIFICATION_EMAIL")
            fi
            ;;
        *)
            echo -e "${CYAN}DEBUG: No specific parameters for $template_name${NC}"
            ;;
    esac

    echo -e "${CYAN}DEBUG: Total parameters: ${#param_array[@]}${NC}"
    echo -e "${CYAN}DEBUG: Parameter array contents:${NC}"
    for i in "${!param_array[@]}"; do
        echo -e "${CYAN}  [$i]: ${param_array[$i]}${NC}"
    done

    # Deploy or validate the stack
    echo -e "${CYAN}DEBUG: About to execute AWS CLI command${NC}"

    # Test: Let's try a simple validation first to see what AWS sees
    echo -e "${CYAN}DEBUG: Testing AWS CloudFormation validate-template first${NC}"
    aws cloudformation validate-template --template-body "file://$template_file"
    local validate_result=$?
    echo -e "${CYAN}DEBUG: Template validation result: $validate_result${NC}"
    
    if [ $validate_result -ne 0 ]; then
        echo -e "${RED}ERROR: Template validation failed${NC}"
        return 1
    fi

    if [ "$VALIDATE_ONLY" = true ]; then
        echo "Performing dry run deployment (validate only)"
        echo -e "${CYAN}DEBUG: Running with --no-execute-changeset${NC}"
        echo -e "${CYAN}DEBUG: Command will be: aws cloudformation deploy --template-file '$template_file' --stack-name '$stack_name' --parameter-overrides [${#param_array[@]} parameters] --capabilities CAPABILITY_NAMED_IAM --no-execute-changeset${NC}"
        
        aws cloudformation deploy \
            --template-file "$template_file" \
            --stack-name "$stack_name" \
            --parameter-overrides "${param_array[@]}" \
            --capabilities CAPABILITY_NAMED_IAM \
            --no-execute-changeset
        local result=$?
        echo -e "${CYAN}DEBUG: Validation result: $result${NC}"
        return $result
    else
        echo "Deploying stack: $stack_name"
        echo -e "${CYAN}DEBUG: Running with --no-fail-on-empty-changeset${NC}"
        echo -e "${CYAN}DEBUG: Command will be: aws cloudformation deploy --template-file '$template_file' --stack-name '$stack_name' --parameter-overrides [${#param_array[@]} parameters] --capabilities CAPABILITY_NAMED_IAM --no-fail-on-empty-changeset${NC}"
        
        aws cloudformation deploy \
            --template-file "$template_file" \
            --stack-name "$stack_name" \
            --parameter-overrides "${param_array[@]}" \
            --capabilities CAPABILITY_NAMED_IAM \
            --no-fail-on-empty-changeset
        local result=$?
        echo -e "${CYAN}DEBUG: Deployment result: $result${NC}"
        return $result
    fi
}

# Function to check stack status
check_stack_status() {
    local stack_name="$1"
    local status=$(aws cloudformation describe-stacks --stack-name "$stack_name" --query "Stacks[0].StackStatus" --output text 2>/dev/null || echo "STACK_NOT_FOUND")
    echo "$status"
}

# Function to wait for stack completion
wait_for_stack_completion() {
    local stack_name="$1"
    local timeout=1800  # 30 minutes
    local start_time=$(date +%s)
    local elapsed=0
    
    echo -e "${YELLOW}Waiting for stack $stack_name to complete...${NC}"
    
    while [ $elapsed -lt $timeout ]; do
        local status=$(check_stack_status "$stack_name")
        
        if [[ "$status" == "CREATE_COMPLETE" || "$status" == "UPDATE_COMPLETE" ]]; then
            echo -e "${GREEN}Stack $stack_name completed successfully${NC}"
            return 0
        elif [[ "$status" == "CREATE_FAILED" || "$status" == "ROLLBACK_COMPLETE" || "$status" == "ROLLBACK_FAILED" || "$status" == "UPDATE_ROLLBACK_COMPLETE" || "$status" == "UPDATE_ROLLBACK_FAILED" ]]; then
            echo -e "${RED}Stack $stack_name failed: $status${NC}"
            return 1
        elif [[ "$status" == "STACK_NOT_FOUND" ]]; then
            echo -e "${RED}Stack $stack_name not found${NC}"
            return 1
        fi
        
        sleep 10
        elapsed=$(($(date +%s) - start_time))
        echo -e "${CYAN}Stack $stack_name status: $status (elapsed: $elapsed seconds)${NC}"
    done
    
    echo -e "${RED}Timed out waiting for stack $stack_name to complete${NC}"
    return 1
}

# Function to verify API endpoint
verify_api_endpoint() {
    local stack_name="$1"
    local api_endpoint=$(aws cloudformation describe-stacks --stack-name "$stack_name" --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)
    
    if [ -z "$api_endpoint" ]; then
        echo -e "${RED}No API endpoint found for stack $stack_name${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}Verifying API endpoint: $api_endpoint${NC}"
    
    # Send OPTIONS request to check CORS
    local options_response=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$api_endpoint")
    if [ "$options_response" == "200" ]; then
        echo -e "${GREEN}✓ API endpoint CORS check passed: $api_endpoint${NC}"
    else
        echo -e "${RED}✗ API endpoint CORS check failed: $api_endpoint (status: $options_response)${NC}"
    fi
    
    echo -e "${GREEN}API endpoint verification complete: $api_endpoint${NC}"
}

# Function to verify Lambda function
verify_lambda_function() {
    local stack_name="$1"
    local lambda_name=$(aws cloudformation describe-stacks --stack-name "$stack_name" --query "Stacks[0].Outputs[?OutputKey=='LambdaFunctionName'].OutputValue" --output text)
    
    if [ -z "$lambda_name" ]; then
        echo -e "${RED}No Lambda function found for stack $stack_name${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}Verifying Lambda function: $lambda_name${NC}"
    
    # Check Lambda configuration
    local lambda_config=$(aws lambda get-function-configuration --function-name "$lambda_name")
    local lambda_runtime=$(echo "$lambda_config" | jq -r '.Runtime')
    local lambda_memory=$(echo "$lambda_config" | jq -r '.MemorySize')
    local lambda_timeout=$(echo "$lambda_config" | jq -r '.Timeout')
    
    echo -e "${CYAN}Lambda function details:${NC}"
    echo -e "${CYAN}  Runtime: $lambda_runtime${NC}"
    echo -e "${CYAN}  Memory: $lambda_memory MB${NC}"
    echo -e "${CYAN}  Timeout: $lambda_timeout seconds${NC}"
    
    echo -e "${GREEN}Lambda function verification complete: $lambda_name${NC}"
}

# Validate all templates first
if [ "$SKIP_VALIDATION" = false ]; then
    echo -e "\n${BLUE}Step 1: Validating all templates${NC}"
    validation_failed=false
    
    for template_file in "${template_files[@]}"; do
        if ! validate_template "$template_file"; then
            validation_failed=true
        fi
    done
    
    if [ "$validation_failed" = true ]; then
        echo -e "\n${RED}Template validation failed. Aborting deployment.${NC}"
        exit 1
    fi
    
    echo -e "\n${GREEN}All templates validated successfully!${NC}"
else
    echo -e "\n${YELLOW}Skipping template validation step${NC}"
fi

# Exit if validate-only flag is set
if [ "$VALIDATE_ONLY" = true ]; then
    echo -e "\n${GREEN}Validation completed successfully. Exiting without deployment.${NC}"
    exit 0
fi

# Deploy templates in parallel
echo -e "\n${BLUE}Step 2: Deploying templates in parallel${NC}"

for template_file in "${template_files[@]}"; do
    template_name=$(basename "$template_file" .yaml)
    stack_name="${PROJECT_NAME}-${template_name%%-template}-${ENVIRONMENT}"
    
    echo -e "${YELLOW}Starting deployment for: $template_name${NC}"
    
    # Deploy template in background
    deploy_template "$template_file" &
    PIDS+=($!)
    DEPLOYMENT_RESULTS+=("$stack_name")
done

# Wait for all background processes to complete
echo -e "\n${BLUE}Waiting for all deployments to complete...${NC}"
for pid in "${PIDS[@]}"; do
    wait $pid
done

# Verify deployments
echo -e "\n${BLUE}Step 3: Verifying deployments${NC}"

for stack_name in "${DEPLOYMENT_RESULTS[@]}"; do
    echo -e "\n${YELLOW}Verifying stack: $stack_name${NC}"
    
    # Check stack status
    status=$(check_stack_status "$stack_name")
    if [[ "$status" == "CREATE_COMPLETE" || "$status" == "UPDATE_COMPLETE" ]]; then
        echo -e "${GREEN}✓ Stack $stack_name deployed successfully${NC}"
        
        # Verify API endpoint if it's an API stack
        if [[ "$stack_name" == *"-edge-processing-"* || "$stack_name" == *"-pinecone-search-"* ]]; then
            verify_api_endpoint "$stack_name"
        fi
        
        # Verify Lambda function
        if [[ "$stack_name" != *"-monitoring-"* ]]; then
            verify_lambda_function "$stack_name"
        fi
    else
        echo -e "${RED}✗ Stack $stack_name deployment failed or incomplete: $status${NC}"
    fi
done

# Print summary
echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                   Deployment Summary                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"

success_count=0
failure_count=0

for stack_name in "${DEPLOYMENT_RESULTS[@]}"; do
    status=$(check_stack_status "$stack_name")
    
    if [[ "$status" == "CREATE_COMPLETE" || "$status" == "UPDATE_COMPLETE" ]]; then
        echo -e "${stack_name}  ${GREEN}✓ $status${NC}"
        ((success_count++))
    else
        echo -e "${stack_name}  ${RED}✗ $status${NC}"
        ((failure_count++))
    fi
done

echo -e "\n${YELLOW}Total:${NC} ${#DEPLOYMENT_RESULTS[@]} stacks processed"
echo -e "${GREEN}Success:${NC} $success_count stacks"
echo -e "${RED}Failure:${NC} $failure_count stacks"

if [ $failure_count -gt 0 ]; then
    echo -e "\n${RED}Some deployments failed. Check the logs above for details.${NC}"
    exit 1
else
    echo -e "\n${GREEN}All deployments completed successfully!${NC}"
    
    # Print API endpoints
    echo -e "\n${BLUE}API Endpoints:${NC}"
    
    edge_api=$(aws cloudformation describe-stacks --stack-name "${PROJECT_NAME}-edge-processing-${ENVIRONMENT}" --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)
    search_api=$(aws cloudformation describe-stacks --stack-name "${PROJECT_NAME}-pinecone-search-${ENVIRONMENT}" --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)
    
    echo -e "${YELLOW}Edge Processing API:${NC} $edge_api"
    echo -e "${YELLOW}Pinecone Search API:${NC} $search_api"
    
    # Print dashboard URL if monitoring was deployed
    if [ "$SKIP_MONITORING" = false ]; then
        dashboard_url=$(aws cloudformation describe-stacks --stack-name "${PROJECT_NAME}-monitoring-${ENVIRONMENT}" --query "Stacks[0].Outputs[?OutputKey=='DashboardURL'].OutputValue" --output text)
        echo -e "\n${BLUE}CloudWatch Dashboard:${NC} $dashboard_url"
    fi
    
    exit 0
fi