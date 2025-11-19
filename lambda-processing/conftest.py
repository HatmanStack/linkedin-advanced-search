"""
Pytest configuration and fixtures for Lambda function testing
"""
import os

import pytest
from moto import mock_aws


# Set fake AWS credentials for all tests
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
