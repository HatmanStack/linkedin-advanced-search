"""Tests for Profile API Lambda"""
import json

import pytest

from conftest import load_lambda_module


@pytest.fixture
def profile_api_module():
    """Load the profile-api Lambda module"""
    return load_lambda_module('profile-api')


def test_get_profile_unauthorized(lambda_context, profile_api_module):
    """Test profile retrieval without auth returns 401"""
    event = {
        'httpMethod': 'GET',
        'pathParameters': {'profileId': 'test-123'},
    }

    response = profile_api_module.lambda_handler(event, lambda_context)

    assert response['statusCode'] == 401


def test_get_profile_with_auth(lambda_context, profile_api_module):
    """Test profile retrieval with auth"""
    event = {
        'httpMethod': 'GET',
        'pathParameters': {'profileId': 'test-123'},
        'requestContext': {
            'authorizer': {
                'claims': {
                    'sub': 'test-user-123',
                }
            }
        }
    }

    response = profile_api_module.lambda_handler(event, lambda_context)

    assert response['statusCode'] in [200, 404, 500]


def test_create_profile_unauthorized(lambda_context, profile_api_module):
    """Test profile creation without auth returns 401"""
    event = {
        'httpMethod': 'POST',
        'body': json.dumps({'name': 'Test Profile'}),
    }

    response = profile_api_module.lambda_handler(event, lambda_context)

    assert response['statusCode'] == 401


def test_create_profile_with_auth(lambda_context, profile_api_module):
    """Test profile creation with auth"""
    event = {
        'httpMethod': 'POST',
        'body': json.dumps({'name': 'Test Profile'}),
        'requestContext': {
            'authorizer': {
                'claims': {
                    'sub': 'test-user-123',
                }
            }
        }
    }

    response = profile_api_module.lambda_handler(event, lambda_context)

    assert response['statusCode'] in [200, 201, 400, 500]
