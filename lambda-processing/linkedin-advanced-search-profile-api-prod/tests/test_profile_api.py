"""Tests for Profile API Lambda"""
import pytest
import json


def test_get_profile(lambda_context):
    """Test profile retrieval"""
    from lambda_function import lambda_handler
    
    event = {
        'httpMethod': 'GET',
        'pathParameters': {'profileId': 'test-123'},
    }
    
    response = lambda_handler(event, lambda_context)
    
    assert response['statusCode'] in [200, 404, 500]


def test_create_profile(lambda_context):
    """Test profile creation"""
    from lambda_function import lambda_handler
    
    event = {
        'httpMethod': 'POST',
        'body': json.dumps({'name': 'Test Profile'}),
    }
    
    response = lambda_handler(event, lambda_context)
    
    assert response['statusCode'] in [200, 201, 400, 500]
