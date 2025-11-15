#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Setting up local development environment for SAM..."

# Check Python version with proper numeric comparison
PYTHON_VERSION=$(python3 --version | grep -oP '\d+\.\d+')
echo "📍 Detected Python version: $PYTHON_VERSION"

# Parse major and minor version
MAJOR=$(echo "$PYTHON_VERSION" | cut -d'.' -f1)
MINOR=$(echo "$PYTHON_VERSION" | cut -d'.' -f2)

# Check if version >= 3.13
if [ "$MAJOR" -lt 3 ] || ([ "$MAJOR" -eq 3 ] && [ "$MINOR" -lt 13 ]); then
    echo "⚠️  Warning: AWS Lambda supports Python 3.13+. You have $PYTHON_VERSION"
    echo "   Consider using pyenv or python3.13 directly"
fi

# Create venv
if [ -d "venv" ]; then
    echo "📦 Virtual environment already exists"
    if [ -t 0 ]; then
        read -p "   Recreate it? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf venv
            python3 -m venv venv
        fi
    else
        echo "   Skipping recreation (non-interactive mode)"
    fi
else
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "📦 Upgrading pip..."
python -m pip install --upgrade pip

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

echo "✅ Development environment setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Activate the virtual environment: source venv/bin/activate"
echo "   2. Copy .env.example to .env and configure your AWS credentials"
echo "   3. Run 'sam build' to build the project"
echo "   4. Run 'sam local start-api' to test locally"
