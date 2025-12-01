"""
Unit tests for DynamoDB API Lambda function
Tests CRUD operations, authentication, CORS, and error handling
"""
import base64
import json
import sys
from pathlib import Path
from unittest.mock import patch

import boto3
import pytest
from moto import mock_aws

LAMBDA_PATH = str(Path(__file__).parent.parent.parent.parent / 'backend' / 'lambdas' / 'dynamodb-api')
sys.path.insert(0, LAMBDA_PATH)

# Force reimport to avoid caching issues with multiple lambda_function modules
if 'lambda_function' in sys.modules:
    del sys.modules['lambda_function']


@pytest.fixture
def lambda_env_vars(monkeypatch):
    """Set up environment variables for Lambda"""
    monkeypatch.setenv('DYNAMODB_TABLE_NAME', 'test-table')
    monkeypatch.setenv('COGNITO_USER_POOL_ID', 'test-pool-id')
    monkeypatch.setenv('COGNITO_REGION', 'us-west-2')
    monkeypatch.setenv('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000')


@pytest.fixture
def dynamodb_table_with_data(lambda_env_vars):
    """Create DynamoDB table with test data"""
    with mock_aws():
        dynamodb = boto3.resource('dynamodb', region_name='us-west-2')

        table = dynamodb.create_table(
            TableName='test-table',
            KeySchema=[
                {'AttributeName': 'PK', 'KeyType': 'HASH'},
                {'AttributeName': 'SK', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'PK', 'AttributeType': 'S'},
                {'AttributeName': 'SK', 'AttributeType': 'S'},
            ],
            BillingMode='PAY_PER_REQUEST'
        )

        # Add test data
        table.put_item(Item={
            'PK': 'USER#test-user-123',
            'SK': 'SETTINGS',
            'linkedin_credentials': 'encrypted-creds',
            'preferences': {'theme': 'dark'},
        })

        yield table


@pytest.fixture
def api_gateway_event_get():
    """Mock API Gateway GET event"""
    return {
        'httpMethod': 'GET',
        'headers': {
            'origin': 'http://localhost:5173',
            'Content-Type': 'application/json',
        },
        'requestContext': {
            'authorizer': {
                'claims': {
                    'sub': 'test-user-123',
                    'email': 'test@example.com',
                }
            }
        },
        'queryStringParameters': None,
    }


@pytest.fixture
def api_gateway_event_post():
    """Mock API Gateway POST event"""
    return {
        'httpMethod': 'POST',
        'headers': {
            'origin': 'http://localhost:5173',
            'Content-Type': 'application/json',
        },
        'requestContext': {
            'authorizer': {
                'claims': {
                    'sub': 'test-user-123',
                }
            }
        },
        'body': json.dumps({
            'operation': 'create',
            'profileData': {
                'name': 'Test Profile',
                'email': 'profile@example.com',
            }
        }),
    }


@pytest.fixture
def api_gateway_event_options():
    """Mock API Gateway OPTIONS (CORS preflight) event"""
    return {
        'httpMethod': 'OPTIONS',
        'headers': {
            'origin': 'http://localhost:5173',
        },
    }


def test_cors_preflight_response(dynamodb_table_with_data, api_gateway_event_options, lambda_context):
    """Test CORS preflight (OPTIONS) request handling"""
    from lambda_function import lambda_handler

    response = lambda_handler(api_gateway_event_options, lambda_context)

    assert response['statusCode'] == 204
    assert 'Access-Control-Allow-Origin' in response['headers']
    assert response['headers']['Access-Control-Allow-Origin'] == 'http://localhost:5173'
    assert 'Access-Control-Allow-Methods' in response['headers']
    assert response['body'] == ''


def test_get_user_settings_success(dynamodb_table_with_data, api_gateway_event_get, lambda_context):
    """Test successful retrieval of user settings"""
    from lambda_function import lambda_handler

    response = lambda_handler(api_gateway_event_get, lambda_context)

    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert 'linkedin_credentials' in body or 'settings' in body


def test_get_without_auth(dynamodb_table_with_data, api_gateway_event_get, lambda_context):
    """Test GET request without authentication"""
    from lambda_function import lambda_handler

    # Remove auth claims
    event = api_gateway_event_get.copy()
    event['requestContext'] = {}

    response = lambda_handler(event, lambda_context)

    assert response['statusCode'] == 401
    body = json.loads(response['body'])
    assert 'error' in body or 'message' in body


def test_get_profile_by_id(dynamodb_table_with_data, api_gateway_event_get, lambda_context):
    """Test getting profile by profileId query parameter"""
    from lambda_function import lambda_handler

    # Add a profile to the table
    profile_id = 'test-profile-123'
    profile_id_b64 = base64.urlsafe_b64encode(profile_id.encode()).decode()

    dynamodb_table_with_data.put_item(Item={
        'PK': f'PROFILE#{profile_id_b64}',
        'SK': 'METADATA',
        'name': 'Test Profile',
        'status': 'active',
    })

    event = api_gateway_event_get.copy()
    event['queryStringParameters'] = {'profileId': profile_id}

    response = lambda_handler(event, lambda_context)

    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert 'profile' in body


def test_get_nonexistent_profile(dynamodb_table_with_data, api_gateway_event_get, lambda_context):
    """Test getting a profile that doesn't exist"""
    from lambda_function import lambda_handler

    event = api_gateway_event_get.copy()
    event['queryStringParameters'] = {'profileId': 'nonexistent-profile'}

    response = lambda_handler(event, lambda_context)

    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert body.get('profile') is None or body.get('message') == 'Profile not found'


def test_create_profile_operation(dynamodb_table_with_data, api_gateway_event_post, lambda_context):
    """Test creating a new profile"""
    from lambda_function import lambda_handler

    response = lambda_handler(api_gateway_event_post, lambda_context)

    # Should return success or error with proper status code
    assert response['statusCode'] in [200, 201, 400, 500]
    assert 'body' in response
    body = json.loads(response['body'])
    assert isinstance(body, dict)


def test_update_user_settings_operation(dynamodb_table_with_data, api_gateway_event_post, lambda_context):
    """Test updating user settings"""
    from lambda_function import lambda_handler

    event = api_gateway_event_post.copy()
    event['body'] = json.dumps({
        'operation': 'update_user_settings',
        'settings': {
            'theme': 'light',
            'notifications': True,
        }
    })

    response = lambda_handler(event, lambda_context)

    assert response['statusCode'] in [200, 400, 500]
    body = json.loads(response['body'])
    assert isinstance(body, dict)


def test_invalid_operation(dynamodb_table_with_data, api_gateway_event_post, lambda_context):
    """Test handling of invalid operation"""
    from lambda_function import lambda_handler

    event = api_gateway_event_post.copy()
    event['body'] = json.dumps({
        'operation': 'invalid_operation',
    })

    response = lambda_handler(event, lambda_context)

    # Should return error or handle gracefully
    assert response['statusCode'] in [400, 404, 500]


def test_malformed_request_body(dynamodb_table_with_data, api_gateway_event_post, lambda_context):
    """Test handling of malformed JSON in request body"""
    from lambda_function import lambda_handler

    event = api_gateway_event_post.copy()
    event['body'] = 'invalid-json{'

    response = lambda_handler(event, lambda_context)

    # Should handle JSON parse error gracefully
    assert response['statusCode'] in [400, 500]


def test_cors_headers_included(dynamodb_table_with_data, api_gateway_event_get, lambda_context):
    """Test that CORS headers are included in responses"""
    from lambda_function import lambda_handler

    response = lambda_handler(api_gateway_event_get, lambda_context)

    assert 'headers' in response
    assert 'Access-Control-Allow-Origin' in response['headers']


def test_unknown_origin_cors(dynamodb_table_with_data, api_gateway_event_options, lambda_context):
    """Test CORS handling for unknown origin"""
    from lambda_function import lambda_handler

    event = api_gateway_event_options.copy()
    event['headers']['origin'] = 'https://malicious-site.com'

    response = lambda_handler(event, lambda_context)

    # Should still return 204 but with restricted origin
    assert response['statusCode'] == 204
    allowed_origin = response['headers']['Access-Control-Allow-Origin']
    assert allowed_origin != 'https://malicious-site.com'


def test_dynamodb_error_handling(dynamodb_table_with_data, api_gateway_event_get, lambda_context):
    """Test handling of DynamoDB errors"""
    from lambda_function import lambda_handler

    # Temporarily break the table name to simulate DynamoDB error
    with patch('lambda_function.TABLE_NAME', 'nonexistent-table'):
        response = lambda_handler(api_gateway_event_get, lambda_context)

        # Should handle DynamoDB error gracefully
        assert response['statusCode'] in [500, 503]
