#!/bin/bash

# CloudFormation Template Validation Script
# Validates all templates using AWS CLI and cfn-lint

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="$SCRIPT_DIR/../templates"
VALIDATION_RESULTS=()

echo "🔍 Starting CloudFormation template validation..."
echo "Templates directory: $TEMPLATES_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to validate a single template
validate_template() {
    local template_file="$1"
    local template_name=$(basename "$template_file" .yaml)
    
    echo -e "\n📋 Validating: ${YELLOW}$template_name${NC}"
    
    # AWS CloudFormation syntax validation
    echo "  ├── AWS CloudFormation syntax validation..."
    if aws cloudformation validate-template --template-body "file://$template_file" > /dev/null 2>&1; then
        echo -e "  ├── ✅ ${GREEN}AWS validation passed${NC}"
        aws_validation="PASS"
    else
        echo -e "  ├── ❌ ${RED}AWS validation failed${NC}"
        aws cloudformation validate-template --template-body "file://$template_file" 2>&1 | sed 's/^/  │   /'
        aws_validation="FAIL"
    fi
    
    # cfn-lint validation (if available)
    echo "  ├── cfn-lint validation..."
    if command -v cfn-lint &> /dev/null; then
        if cfn-lint "$template_file" > /dev/null 2>&1; then
            echo -e "  ├── ✅ ${GREEN}cfn-lint validation passed${NC}"
            lint_validation="PASS"
        else
            echo -e "  ├── ⚠️  ${YELLOW}cfn-lint warnings/errors:${NC}"
            cfn-lint "$template_file" 2>&1 | sed 's/^/  │   /'
            lint_validation="WARN"
        fi
    else
        echo -e "  ├── ⚠️  ${YELLOW}cfn-lint not installed, skipping${NC}"
        lint_validation="SKIP"
    fi
    
    # Resource naming convention check
    echo "  └── Resource naming convention check..."
    if grep -q "ProjectName.*Environment" "$template_file"; then
        echo -e "      ✅ ${GREEN}Naming convention followed${NC}"
        naming_validation="PASS"
    else
        echo -e "      ⚠️  ${YELLOW}Consider using ProjectName and Environment in resource names${NC}"
        naming_validation="WARN"
    fi
    
    VALIDATION_RESULTS+=("$template_name|$aws_validation|$lint_validation|$naming_validation")
}

# Check if templates directory exists
if [ ! -d "$TEMPLATES_DIR" ]; then
    echo -e "❌ ${RED}Templates directory not found: $TEMPLATES_DIR${NC}"
    exit 1
fi

# Find and validate all YAML templates
template_files=($(find "$TEMPLATES_DIR" -name "*.yaml" -o -name "*.yml"))

if [ ${#template_files[@]} -eq 0 ]; then
    echo -e "⚠️  ${YELLOW}No CloudFormation templates found in $TEMPLATES_DIR${NC}"
    exit 1
fi

echo "Found ${#template_files[@]} template(s) to validate"

# Validate each template
for template_file in "${template_files[@]}"; do
    validate_template "$template_file"
done

# Print summary
echo -e "\n📊 ${YELLOW}Validation Summary${NC}"
echo "┌─────────────────────────────────┬─────────┬─────────┬─────────┐"
echo "│ Template                        │ AWS     │ cfn-lint│ Naming  │"
echo "├─────────────────────────────────┼─────────┼─────────┼─────────┤"

for result in "${VALIDATION_RESULTS[@]}"; do
    IFS='|' read -r template aws_val lint_val naming_val <<< "$result"
    printf "│ %-31s │ %-7s │ %-7s │ %-7s │\n" "$template" "$aws_val" "$lint_val" "$naming_val"
done

echo "└─────────────────────────────────┴─────────┴─────────┴─────────┘"

# Check for any failures
failed_count=0
for result in "${VALIDATION_RESULTS[@]}"; do
    if [[ "$result" == *"|FAIL|"* ]]; then
        ((failed_count++))
    fi
done

if [ $failed_count -eq 0 ]; then
    echo -e "\n🎉 ${GREEN}All templates passed validation!${NC}"
    exit 0
else
    echo -e "\n❌ ${RED}$failed_count template(s) failed validation${NC}"
    exit 1
fi