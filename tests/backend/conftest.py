"""
Pytest configuration and fixtures for Lambda function testing
"""
import importlib.util
import os
import sys
from pathlib import Path

import pytest
from moto import mock_aws

# Path to lambdas directory
BACKEND_LAMBDAS = Path(__file__).parent.parent.parent / 'backend' / 'lambdas'

# Path to shared python modules
SHARED_PYTHON = BACKEND_LAMBDAS / 'shared' / 'python'

# Add shared python path to sys.path for imports
sys.path.insert(0, str(SHARED_PYTHON))

# Set test environment variables before any Lambda imports
os.environ['DYNAMODB_TABLE_NAME'] = 'test-table'
os.environ['TABLE_NAME'] = 'test-table'
os.environ['BUCKET_NAME'] = 'test-bucket'
os.environ['LOG_LEVEL'] = 'DEBUG'
os.environ['COGNITO_USER_POOL_ID'] = 'test-pool-id'
os.environ['COGNITO_REGION'] = 'us-west-2'
os.environ['ALLOWED_ORIGINS'] = 'http://localhost:5173,http://localhost:3000'


def load_lambda_module(lambda_name: str):
    """
    Load a Lambda module with proper isolation to avoid caching conflicts.

    Args:
        lambda_name: Name of the Lambda directory (e.g., 'dynamodb-api', 'edge-processing')

    Returns:
        The loaded lambda_function module
    """
    lambda_path = BACKEND_LAMBDAS / lambda_name / 'lambda_function.py'

    if not lambda_path.exists():
        raise FileNotFoundError(f"Lambda function not found: {lambda_path}")

    # Create a unique module name to avoid caching conflicts
    module_name = f"lambda_{lambda_name.replace('-', '_')}"

    # Load the module spec
    spec = importlib.util.spec_from_file_location(module_name, lambda_path)
    module = importlib.util.module_from_spec(spec)

    # Add the Lambda's directory to sys.path temporarily for relative imports
    lambda_dir = str(BACKEND_LAMBDAS / lambda_name)
    sys.path.insert(0, lambda_dir)

    try:
        spec.loader.exec_module(module)
    finally:
        # Remove the Lambda's directory from sys.path
        if lambda_dir in sys.path:
            sys.path.remove(lambda_dir)

    return module


@pytest.fixture(scope='session', autouse=True)
def aws_credentials():
    """Set up fake AWS credentials for testing"""
    os.environ['AWS_ACCESS_KEY_ID'] = 'testing'
    os.environ['AWS_SECRET_ACCESS_KEY'] = 'testing'
    os.environ['AWS_SECURITY_TOKEN'] = 'testing'
    os.environ['AWS_SESSION_TOKEN'] = 'testing'
    os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'


@pytest.fixture
def mock_env_vars():
    """Set common environment variables for Lambda functions"""
    original_env = os.environ.copy()

    os.environ['TABLE_NAME'] = 'test-table'
    os.environ['BUCKET_NAME'] = 'test-bucket'
    os.environ['REGION'] = 'us-east-1'

    yield

    # Restore original environment
    os.environ.clear()
    os.environ.update(original_env)


@pytest.fixture
def dynamodb_table(aws_credentials):
    """Create a mock DynamoDB table for testing"""
    with mock_aws():
        import boto3

        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

        # Create test table
        table = dynamodb.create_table(
            TableName='test-table',
            KeySchema=[
                {'AttributeName': 'PK', 'KeyType': 'HASH'},
                {'AttributeName': 'SK', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'PK', 'AttributeType': 'S'},
                {'AttributeName': 'SK', 'AttributeType': 'S'},
                {'AttributeName': 'GSI1PK', 'AttributeType': 'S'},
                {'AttributeName': 'GSI1SK', 'AttributeType': 'S'},
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'GSI1',
                    'KeySchema': [
                        {'AttributeName': 'GSI1PK', 'KeyType': 'HASH'},
                        {'AttributeName': 'GSI1SK', 'KeyType': 'RANGE'},
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                    'ProvisionedThroughput': {
                        'ReadCapacityUnits': 5,
                        'WriteCapacityUnits': 5
                    }
                }
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )

        yield table


@pytest.fixture
def s3_bucket(aws_credentials):
    """Create a mock S3 bucket for testing"""
    with mock_aws():
        import boto3

        s3 = boto3.client('s3', region_name='us-east-1')
        s3.create_bucket(Bucket='test-bucket')

        yield s3


@pytest.fixture
def api_gateway_event():
    """Create a mock API Gateway event"""
    return {
        'httpMethod': 'GET',
        'path': '/test',
        'headers': {
            'Content-Type': 'application/json',
        },
        'queryStringParameters': None,
        'pathParameters': None,
        'body': None,
        'isBase64Encoded': False,
        'requestContext': {
            'requestId': 'test-request-id',
            'identity': {
                'sourceIp': '127.0.0.1',
            },
        },
    }


@pytest.fixture
def lambda_context():
    """Create a mock Lambda context"""
    class MockContext:
        def __init__(self):
            self.function_name = 'test-function'
            self.function_version = '1'
            self.invoked_function_arn = 'arn:aws:lambda:us-east-1:123456789012:function:test'
            self.memory_limit_in_mb = '128'
            self.aws_request_id = 'test-request-id'
            self.log_group_name = '/aws/lambda/test'
            self.log_stream_name = '2024/01/01/[$LATEST]test'

        def get_remaining_time_in_millis(self):
            return 3000

    return MockContext()
