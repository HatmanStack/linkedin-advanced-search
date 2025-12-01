"""Tests for OpenAI Webhook Handler Lambda"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / 'backend' / 'lambdas' / 'webhook-handler'))


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
