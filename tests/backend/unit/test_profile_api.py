"""Tests for Profile API routes (merged into dynamodb-api Lambda)"""
import json

import boto3
import pytest
from moto import mock_aws

from conftest import load_lambda_module


@pytest.fixture
def lambda_env_vars(monkeypatch):
    """Set up environment variables for Lambda"""
    monkeypatch.setenv('DYNAMODB_TABLE_NAME', 'test-table')
    monkeypatch.setenv('COGNITO_USER_POOL_ID', 'test-pool-id')
    monkeypatch.setenv('COGNITO_REGION', 'us-west-2')
    monkeypatch.setenv('ALLOWED_ORIGINS', 'http://localhost:5173')


@pytest.fixture
def dynamodb_api_module():
    """Load the dynamodb-api Lambda module"""
    return load_lambda_module('dynamodb-api')


@pytest.fixture
def profiles_table(lambda_env_vars):
    """Create DynamoDB table for profile tests"""
    with mock_aws():
        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
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
        yield table


@pytest.fixture
def profiles_table_with_settings(profiles_table):
    """Table with data in #SETTINGS SK"""
    profiles_table.put_item(Item={
        'PK': 'USER#test-user-123',
        'SK': '#SETTINGS',
        'first_name': 'John',
        'last_name': 'Doe',
        'headline': 'Engineer',
        'linkedin_credentials': 'encrypted-data',
    })
    return profiles_table


@pytest.fixture
def profiles_table_with_legacy(profiles_table):
    """Table with data in legacy PROFILE SK only"""
    profiles_table.put_item(Item={
        'PK': 'USER#test-user-123',
        'SK': 'PROFILE',
        'firstName': 'Jane',
        'lastName': 'Legacy',
        'email': 'jane@example.com',
    })
    return profiles_table


def _make_profiles_event(method, body=None, user_id=None):
    """Helper to create /profiles route events"""
    event = {
        'httpMethod': method,
        'rawPath': '/prod/profiles',
        'requestContext': {
            'http': {'method': method, 'path': '/profiles'},
        },
        'headers': {'origin': 'http://localhost:5173'},
    }
    if user_id:
        event['requestContext']['authorizer'] = {
            'jwt': {'claims': {'sub': user_id}}
        }
    if body:
        event['body'] = json.dumps(body)
    return event


def test_get_profile_unauthorized(profiles_table, lambda_context, dynamodb_api_module):
    """Test profile retrieval without auth returns 401"""
    event = _make_profiles_event('GET')
    response = dynamodb_api_module.lambda_handler(event, lambda_context)
    assert response['statusCode'] == 401


def test_get_profile_default(profiles_table, lambda_context, dynamodb_api_module):
    """Test profile retrieval returns default profile when no data exists"""
    event = _make_profiles_event('GET', user_id='new-user')
    response = dynamodb_api_module.lambda_handler(event, lambda_context)
    assert response['statusCode'] == 200
    data = json.loads(response['body'])
    assert data['success'] is True
    assert data['data']['userId'] == 'new-user'
    assert data['data']['firstName'] == ''


def test_get_profile_reads_settings_sk(profiles_table_with_settings, lambda_context, dynamodb_api_module):
    """Test that GET /profiles reads from #SETTINGS SK"""
    event = _make_profiles_event('GET', user_id='test-user-123')
    response = dynamodb_api_module.lambda_handler(event, lambda_context)
    assert response['statusCode'] == 200
    data = json.loads(response['body'])
    assert data['data']['firstName'] == 'John'
    assert data['data']['lastName'] == 'Doe'
    assert data['data']['headline'] == 'Engineer'


def test_get_profile_falls_back_to_profile_sk(profiles_table_with_legacy, lambda_context, dynamodb_api_module):
    """Test that GET /profiles falls back to legacy PROFILE SK"""
    event = _make_profiles_event('GET', user_id='test-user-123')
    response = dynamodb_api_module.lambda_handler(event, lambda_context)
    assert response['statusCode'] == 200
    data = json.loads(response['body'])
    assert data['data']['firstName'] == 'Jane'
    assert data['data']['lastName'] == 'Legacy'


def test_update_profile_unauthorized(profiles_table, lambda_context, dynamodb_api_module):
    """Test profile update without auth returns 401"""
    event = _make_profiles_event('POST', body={'first_name': 'Test'})
    response = dynamodb_api_module.lambda_handler(event, lambda_context)
    assert response['statusCode'] == 401


def test_update_profile_writes_to_settings_sk(profiles_table, lambda_context, dynamodb_api_module):
    """Test that POST /profiles writes to #SETTINGS SK"""
    event = _make_profiles_event('POST', body={
        'operation': 'update_user_settings',
        'first_name': 'Updated',
        'headline': 'New Title'
    }, user_id='test-user-123')
    response = dynamodb_api_module.lambda_handler(event, lambda_context)
    assert response['statusCode'] == 200

    # Verify data written to #SETTINGS SK
    item = profiles_table.get_item(Key={'PK': 'USER#test-user-123', 'SK': '#SETTINGS'})
    assert item['Item']['first_name'] == 'Updated'
    assert item['Item']['headline'] == 'New Title'


def test_profile_method_not_allowed(profiles_table, lambda_context, dynamodb_api_module):
    """Test unsupported method returns 405"""
    event = _make_profiles_event('DELETE', user_id='test-user-123')
    response = dynamodb_api_module.lambda_handler(event, lambda_context)
    assert response['statusCode'] == 405
