"""AWS resource configuration for Lambda functions."""
import os


# Environment
ENVIRONMENT = os.environ.get('ENVIRONMENT', 'dev')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

# DynamoDB Tables
CONNECTIONS_TABLE = os.environ.get('CONNECTIONS_TABLE')
PROFILES_TABLE = os.environ.get('PROFILES_TABLE')
MESSAGES_TABLE = os.environ.get('MESSAGES_TABLE')

# S3 Buckets
PROFILE_TEXT_BUCKET = os.environ.get('PROFILE_TEXT_BUCKET')
SCREENSHOTS_BUCKET = os.environ.get('SCREENSHOTS_BUCKET')

# Validation (can be enabled/disabled as needed)
def validate_required_config():
    """Validate that required configuration is present."""
    missing = []

    if not CONNECTIONS_TABLE:
        missing.append('CONNECTIONS_TABLE')
    if not PROFILES_TABLE:
        missing.append('PROFILES_TABLE')

    if missing:
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
