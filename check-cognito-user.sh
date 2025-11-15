#!/usr/bin/env bash
set -euo pipefail

EMAIL=${1:-}

if [ -z "$EMAIL" ]; then
    echo "Usage: ./check-cognito-user.sh <email>"
    exit 1
fi

# Get User Pool ID from .env
USER_POOL_ID=$(grep "^VITE_COGNITO_USER_POOL_ID=" .env | cut -d'=' -f2)

if [ -z "$USER_POOL_ID" ]; then
    echo "❌ VITE_COGNITO_USER_POOL_ID not found in .env"
    exit 1
fi

echo "🔍 Checking user: $EMAIL"
echo "📋 User Pool: $USER_POOL_ID"
echo ""

# Check user status
aws cognito-idp admin-get-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    2>&1 || {
        echo ""
        echo "❌ User not found or error occurred"
        echo ""
        echo "💡 To create user:"
        echo "   ./create-cognito-user.sh $EMAIL"
        exit 1
    }
