#!/bin/bash

# CloudFormation Template Deployment Script
# Validates and deploys all templates concurrently

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
NC='\033[0m' # No Color

# Default parameters
ENVIRONMENT="prod"
PROJECT_NAME="linkedin-advanced-search"
DYNAMODB_TABLE_NAME="linkedin-advanced-search"
VALIDATE_ONLY=false
PARALLEL=true

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
        --validate-only|-v)
            VALIDATE_ONLY=true
            shift
            ;;
        --sequential|-s)
            PARALLEL=false
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --environment, -e    Environment name (dev, staging, prod) [default: dev]"
            echo "  --project-name, -p   Project name for resource naming [default: linkedin-advanced-search]"
            echo "  --table-name, -t     DynamoDB table name [default: linkedin-advanced-search]"
            echo "  --validate-only, -v  Only validate templates, don't deploy"
            echo "  --sequential, -s     Deploy templates sequentially instead of in parallel"
            echo "  --help, -h           Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                CloudFormation Deployment                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo -e "${YELLOW}Environment:${NC} $ENVIRONMENT"
echo -e "${YELLOW}Project Name:${NC} $PROJECT_NAME"
echo -e "${YELLOW}DynamoDB Table:${NC} $DYNAMODB_TABLE_NAME"
echo -e "${YELLOW}Validate Only:${NC} $VALIDATE_ONLY"
echo -e "${YELLOW}Parallel Deployment:${NC} $PARALLEL"
echo -e "${YELLOW}Templates Directory:${NC} $TEMPLATES_DIR"

# Check if templates directory exists
if [ ! -d "$TEMPLATES_DIR" ]; then
    echo -e "${RED}Templates directory not found: $TEMPLATES_DIR${NC}"
    exit 1
fi

# Find all YAML templates
template_files=($(find "$TEMPLATES_DIR" -name "*.yaml" -o -name "*.yml"))

if [ ${#template_files[@]} -eq 0 ]; then
    echo -e "${RED}No CloudFormation templates found in $TEMPLATES_DIR${NC}"
    exit 1
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

# Function to deploy a template
deploy_template() {
    local template_file="$1"
    local template_name=$(basename "$template_file" .yaml)
    local stack_name="${PROJECT_NAME}-${template_name%%-template}-${ENVIRONMENT}"
    
    echo -e "\n${YELLOW}Deploying stack: $stack_name${NC}"
    
    # Determine parameters based on template
    local parameters="ParameterKey=Environment,ParameterValue=$ENVIRONMENT ParameterKey=ProjectName,ParameterValue=$PROJECT_NAME ParameterKey=DynamoDBTableName,ParameterValue=$DYNAMODB_TABLE_NAME"
    
    # Add template-specific parameters
    if [[ "$template_name" == "pinecone-indexer-template" ]]; then
        # Get DynamoDB Stream ARN
        local stream_arn=$(aws dynamodb describe-table --table-name "$DYNAMODB_TABLE_NAME" --query "Table.LatestStreamArn" --output text)
        if [ -z "$stream_arn" ] || [ "$stream_arn" == "None" ]; then
            echo -e "${RED}DynamoDB Stream not enabled for table: $DYNAMODB_TABLE_NAME${NC}"
            return 1
        fi
        parameters="$parameters ParameterKey=DynamoDBStreamArn,ParameterValue=$stream_arn"
    fi
    
    # Deploy or validate the stack
    if [ "$VALIDATE_ONLY" = true ]; then
        echo "Performing dry run deployment (validate only)"
        aws cloudformation deploy \
            --template-file "$template_file" \
            --stack-name "$stack_name" \
            --parameter-overrides $parameters \
            --capabilities CAPABILITY_NAMED_IAM \
            --no-execute-changeset
        
        local result=$?
        if [ $result -eq 0 ]; then
            echo -e "${GREEN}✓ Dry run deployment successful: $stack_name${NC}"
        else
            echo -e "${RED}✗ Dry run deployment failed: $stack_name${NC}"
        fi
        return $result
    else
        echo "Deploying stack: $stack_name"
        aws cloudformation deploy \
            --template-file "$template_file" \
            --stack-name "$stack_name" \
            --parameter-overrides $parameters \
            --capabilities CAPABILITY_NAMED_IAM \
            --no-fail-on-empty-changeset
        
        local result=$?
        if [ $result -eq 0 ]; then
            echo -e "${GREEN}✓ Deployment successful: $stack_name${NC}"
            
            # Get stack outputs
            echo "Stack outputs:"
            aws cloudformation describe-stacks \
                --stack-name "$stack_name" \
                --query "Stacks[0].Outputs" \
                --output table
        else
            echo -e "${RED}✗ Deployment failed: $stack_name${NC}"
        fi
        return $result
    fi
}

# Process each template
process_template() {
    local template_file="$1"
    local template_name=$(basename "$template_file" .yaml)
    
    # First validate the template
    if ! validate_template "$template_file"; then
        echo -e "${RED}Skipping deployment of invalid template: $template_name${NC}"
        DEPLOYMENT_RESULTS+=("$template_name|VALIDATION_FAILED")
        return 1
    fi
    
    # Then deploy it
    if deploy_template "$template_file"; then
        DEPLOYMENT_RESULTS+=("$template_name|SUCCESS")
        return 0
    else
        DEPLOYMENT_RESULTS+=("$template_name|DEPLOYMENT_FAILED")
        return 1
    fi
}

# Process templates in parallel or sequentially
if [ "$PARALLEL" = true ]; then
    echo -e "\n${BLUE}Processing templates in parallel${NC}"
    
    for template_file in "${template_files[@]}"; do
        template_name=$(basename "$template_file" .yaml)
        echo -e "${YELLOW}Starting process for: $template_name${NC}"
        
        # Process template in background
        process_template "$template_file" &
        PIDS+=($!)
    done
    
    # Wait for all background processes to complete
    echo -e "\n${BLUE}Waiting for all deployments to complete...${NC}"
    for pid in "${PIDS[@]}"; do
        wait $pid
    done
else
    echo -e "\n${BLUE}Processing templates sequentially${NC}"
    
    for template_file in "${template_files[@]}"; do
        process_template "$template_file"
    done
fi

# Print summary
echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                   Deployment Summary                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo -e "${YELLOW}Template                        Status${NC}"
echo -e "${YELLOW}------------------------------  -------------------------${NC}"

success_count=0
failure_count=0

for result in "${DEPLOYMENT_RESULTS[@]}"; do
    IFS='|' read -r template status <<< "$result"
    
    if [ "$status" = "SUCCESS" ]; then
        echo -e "${template}  ${GREEN}✓ SUCCESS${NC}"
        ((success_count++))
    else
        echo -e "${template}  ${RED}✗ $status${NC}"
        ((failure_count++))
    fi
done

echo -e "\n${YELLOW}Total:${NC} ${#DEPLOYMENT_RESULTS[@]} templates processed"
echo -e "${GREEN}Success:${NC} $success_count templates"
echo -e "${RED}Failure:${NC} $failure_count templates"

if [ $failure_count -gt 0 ]; then
    echo -e "\n${RED}Some deployments failed. Check the logs above for details.${NC}"
    exit 1
else
    echo -e "\n${GREEN}All deployments completed successfully!${NC}"
    exit 0
fi