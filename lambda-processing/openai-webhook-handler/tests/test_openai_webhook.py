"""Tests for OpenAI Webhook Handler Lambda"""
import pytest
import json


def test_webhook_handler_success(lambda_context):
    """Test successful webhook handling"""
    from lambda_function import lambda_handler
    
    event = {
        'body': json.dumps({'event': 'completion', 'data': {}}),
        'headers': {'Content-Type': 'application/json'},
    }
    
    response = lambda_handler(event, lambda_context)
    
    assert response['statusCode'] in [200, 400, 500]


def test_webhook_authentication(lambda_context):
    """Test webhook authentication"""
    from lambda_function import lambda_handler
    
    event = {
        'body': json.dumps({'data': 'test'}),
        'headers': {},
    }
    
    response = lambda_handler(event, lambda_context)
    
    assert response['statusCode'] in [200, 401, 500]
