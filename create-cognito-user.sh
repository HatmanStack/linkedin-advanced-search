#!/usr/bin/env bash
set -euo pipefail

EMAIL=${1:-}
PASSWORD=${2:-}

if [ -z "$EMAIL" ]; then
    echo "Usage: ./create-cognito-user.sh <email> [password]"
    echo ""
    echo "If password is not provided, a default will be used."
    echo ""
    echo "Example:"
    echo "  ./create-cognito-user.sh user@example.com MyPassword123"
    exit 1
fi

# Default password if not provided
if [ -z "$PASSWORD" ]; then
    PASSWORD="TempPass123!"
    echo "⚠️  No password provided, using temporary password: $PASSWORD"
    echo ""
fi

# Get User Pool ID from .env
USER_POOL_ID=$(grep "^VITE_COGNITO_USER_POOL_ID=" .env | cut -d'=' -f2)

if [ -z "$USER_POOL_ID" ]; then
    echo "❌ VITE_COGNITO_USER_POOL_ID not found in .env"
    echo ""
    echo "Run: cd RAG-CloudStack && ./get-env-vars.sh <stack-name> --update-env"
    exit 1
fi

echo "👤 Creating Cognito user..."
echo "   Email: $EMAIL"
echo "   User Pool: $USER_POOL_ID"
echo ""

# Check if user exists
if aws cognito-idp admin-get-user --user-pool-id "$USER_POOL_ID" --username "$EMAIL" &>/dev/null; then
    echo "⚠️  User already exists!"
    echo ""
    read -p "Reset password? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi

    # Set permanent password
    aws cognito-idp admin-set-user-password \
        --user-pool-id "$USER_POOL_ID" \
        --username "$EMAIL" \
        --password "$PASSWORD" \
        --permanent

    echo ""
    echo "✅ Password updated!"
    echo ""
    echo "🔐 Login credentials:"
    echo "   Email: $EMAIL"
    echo "   Password: $PASSWORD"
    exit 0
fi

# Create new user
aws cognito-idp admin-create-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
    --message-action SUPPRESS

echo "✅ User created!"
echo ""

# Set permanent password
echo "🔑 Setting permanent password..."
aws cognito-idp admin-set-user-password \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --password "$PASSWORD" \
    --permanent

echo ""
echo "✅ User ready to sign in!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 Login credentials:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Email: $EMAIL"
echo "   Password: $PASSWORD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Password requirements:"
echo "   • Minimum 8 characters"
echo "   • At least 1 uppercase letter"
echo "   • At least 1 lowercase letter"
echo "   • At least 1 number"
echo ""
