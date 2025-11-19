"""
Sanity test to verify Python test infrastructure is working
"""
import os

import boto3
from moto import mock_aws


def test_basic_assertion():
    """Basic test to verify pytest is working"""
    assert 1 + 1 == 2


def test_environment_variables(aws_credentials):
    """Test that AWS credentials are set up correctly"""
    assert os.environ['AWS_ACCESS_KEY_ID'] == 'testing'
    assert os.environ['AWS_SECRET_ACCESS_KEY'] == 'testing'
    assert os.environ['AWS_DEFAULT_REGION'] == 'us-east-1'


@mock_aws
def test_dynamodb_mock(aws_credentials):
    """Test that DynamoDB mocking works"""
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

    # Create table
    table = dynamodb.create_table(
        TableName='test-table',
        KeySchema=[
            {'AttributeName': 'id', 'KeyType': 'HASH'}
        ],
        AttributeDefinitions=[
            {'AttributeName': 'id', 'AttributeType': 'S'}
        ],
        BillingMode='PAY_PER_REQUEST'
    )

    # Put item
    table.put_item(Item={'id': 'test', 'data': 'value'})

    # Get item
    response = table.get_item(Key={'id': 'test'})

    assert response['Item']['id'] == 'test'
    assert response['Item']['data'] == 'value'


@mock_aws
def test_s3_mock(aws_credentials):
    """Test that S3 mocking works"""
    s3 = boto3.client('s3', region_name='us-east-1')

    # Create bucket
    s3.create_bucket(Bucket='test-bucket')

    # Put object
    s3.put_object(Bucket='test-bucket', Key='test-key', Body=b'test content')

    # Get object
    response = s3.get_object(Bucket='test-bucket', Key='test-key')
    content = response['Body'].read()

    assert content == b'test content'


def test_fixtures_available(dynamodb_table, s3_bucket):
    """Test that pytest fixtures are available"""
    assert dynamodb_table is not None
    assert s3_bucket is not None


def test_lambda_fixtures(api_gateway_event, lambda_context):
    """Test that Lambda-specific fixtures work"""
    assert api_gateway_event['httpMethod'] == 'GET'
    assert lambda_context.function_name == 'test-function'
    assert lambda_context.get_remaining_time_in_millis() == 3000
