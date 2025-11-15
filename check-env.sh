#!/usr/bin/env bash

echo "🔍 Checking .env configuration..."
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "   Create it: cp .env.example .env"
    exit 1
fi

echo "✅ .env file exists"
echo ""

# Check required variables
echo "📋 Required Cognito Variables:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_var() {
    local var_name=$1
    local var_value=$(grep "^${var_name}=" .env | cut -d'=' -f2-)

    if [ -z "$var_value" ]; then
        echo "❌ $var_name - NOT SET"
        return 1
    else
        # Show first 20 chars
        local display_value="${var_value:0:40}"
        if [ ${#var_value} -gt 40 ]; then
            display_value="${display_value}..."
        fi
        echo "✅ $var_name = $display_value"
        return 0
    fi
}

errors=0

check_var "VITE_COGNITO_USER_POOL_ID" || ((errors++))
check_var "VITE_COGNITO_USER_POOL_WEB_CLIENT_ID" || ((errors++))
check_var "VITE_AWS_REGION" || ((errors++))
check_var "VITE_API_GATEWAY_URL" || ((errors++))

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $errors -gt 0 ]; then
    echo "❌ Found $errors missing variable(s)"
    echo ""
    echo "🔧 To fix automatically:"
    echo "   cd RAG-CloudStack"
    echo "   ./get-env-vars.sh linkedin-advanced-search --update-env"
    echo "   cd .. && npm run dev"
    echo ""
    echo "📋 Or manually:"
    echo "   1. cd RAG-CloudStack"
    echo "   2. ./get-env-vars.sh linkedin-advanced-search"
    echo "   3. Copy the output values to .env"
    echo "   4. Restart dev server: npm run dev"
    exit 1
else
    echo "✅ All required variables are set!"
    echo ""
    echo "💡 If you still see errors:"
    echo "   1. Stop dev server (Ctrl+C)"
    echo "   2. Restart: npm run dev"
    echo "   3. Vite only reads .env on startup!"
fi
