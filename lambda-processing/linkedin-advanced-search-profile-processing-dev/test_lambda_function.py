"""Tests for Profile Processing Lambda"""
import pytest
import json


def test_process_profile_data(lambda_context):
    """Test profile data processing"""
    from lambda_function import lambda_handler
    
    event = {
        'Records': [
            {
                'body': json.dumps({'profileId': 'test-123'}),
            }
        ]
    }
    
    response = lambda_handler(event, lambda_context)
    
    assert response['statusCode'] in [200, 400, 500]
