#!/bin/bash

# Q Prompt Logger Script
# Usage: ./log-q-prompt.sh "Your prompt text here"

BUCKET_NAME="q-prompts-logging-bucket"
REGION="us-west-2"

if [ $# -eq 0 ]; then
    echo "Usage: $0 \"Your prompt text\""
    exit 1
fi

PROMPT="$1"
TIMESTAMP=$(date -u +"%Y-%m-%d_%H-%M-%S")
FILENAME="q-prompt-${TIMESTAMP}.txt"

# Create temporary file with prompt and metadata
TEMP_FILE=$(mktemp)
cat > "$TEMP_FILE" << EOF
Timestamp: $(date -u)
User: $(whoami)
Directory: $(pwd)
Prompt:
$PROMPT
EOF

# Upload to S3
aws s3 cp "$TEMP_FILE" "s3://${BUCKET_NAME}/prompts/${FILENAME}" --region "$REGION"

if [ $? -eq 0 ]; then
    echo "✅ Prompt logged successfully to s3://${BUCKET_NAME}/prompts/${FILENAME}"
else
    echo "❌ Failed to log prompt"
fi

# Clean up
rm "$TEMP_FILE"
