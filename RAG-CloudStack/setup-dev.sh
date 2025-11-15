#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Setting up local development environment for SAM..."

# Check Python version
PYTHON_VERSION=$(python3 --version | grep -oP '\d+\.\d+')
echo "📍 Detected Python version: $PYTHON_VERSION"

if [[ ! "$PYTHON_VERSION" =~ ^3\.1[3-9]$ ]]; then
    echo "⚠️  Warning: AWS Lambda supports Python 3.13+. You have $PYTHON_VERSION"
    echo "   Consider using pyenv or python3.13 directly"
fi

# Create venv
if [ -d "venv" ]; then
    echo "📦 Virtual environment already exists"
    read -p "   Recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf venv
        python3 -m venv venv
    fi
else
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate and install
echo "📥 Installing dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "✅ Development environment ready!"
echo ""
echo "To activate:"
echo "  source venv/bin/activate"
echo ""
echo "To build and deploy with SAM:"
echo "  sam build && sam deploy --guided"
echo ""
echo "To test locally:"
echo "  sam local invoke EdgeProcessingFunction -e events/edge-test.json"
echo "  sam local start-api  # Start local API on http://localhost:3000"
echo ""
