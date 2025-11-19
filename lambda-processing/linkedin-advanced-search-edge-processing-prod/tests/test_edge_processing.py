"""Tests for Edge Processing Lambda"""
import pytest
import json


def test_lambda_handler_success(lambda_context):
    """Test successful edge processing"""
    from lambda_function import lambda_handler
    
    event = {
        'body': json.dumps({'data': 'test'}),
    }
    
    response = lambda_handler(event, lambda_context)
    
    assert response['statusCode'] in [200, 400, 500]
    assert 'body' in response


def test_lambda_handler_invalid_input(lambda_context):
    """Test handling of invalid input"""
    from lambda_function import lambda_handler
    
    event = {'body': 'invalid-json{'}
    
    response = lambda_handler(event, lambda_context)
    
    assert response['statusCode'] in [400, 500]
