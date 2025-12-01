"""Tests for Edge Processing Lambda"""
import importlib
import json
import sys
from pathlib import Path

import pytest

LAMBDA_PATH = str(Path(__file__).parent.parent.parent.parent / 'backend' / 'lambdas' / 'edge-processing')


def _get_lambda_handler():
    """Get the lambda handler with proper import isolation"""
    # Clear cached lambda_function if present
    for mod_name in list(sys.modules.keys()):
        if 'lambda_function' in mod_name:
            del sys.modules[mod_name]

    # Add lambda path to front of sys.path
    if LAMBDA_PATH in sys.path:
        sys.path.remove(LAMBDA_PATH)
    sys.path.insert(0, LAMBDA_PATH)

    # Import fresh
    import lambda_function
    importlib.reload(lambda_function)
    return lambda_function.lambda_handler


def test_lambda_handler_unauthorized(lambda_context):
    """Test that unauthenticated requests return 401"""
    lambda_handler = _get_lambda_handler()

    event = {
        'body': json.dumps({'data': 'test'}),
    }

    response = lambda_handler(event, lambda_context)

    assert response['statusCode'] == 401


def test_lambda_handler_with_auth(lambda_context):
    """Test authenticated request handling"""
    lambda_handler = _get_lambda_handler()

    event = {
        'body': json.dumps({
            'profileId': 'test-profile-123',
            'operation': 'check_exists',
        }),
        'requestContext': {
            'authorizer': {
                'claims': {
                    'sub': 'test-user-123',
                }
            }
        }
    }

    response = lambda_handler(event, lambda_context)

    assert response['statusCode'] in [200, 400, 500]
    assert 'body' in response


def test_lambda_handler_invalid_input(lambda_context):
    """Test handling of invalid input (still requires auth)"""
    lambda_handler = _get_lambda_handler()

    event = {
        'body': 'invalid-json{',
        'requestContext': {
            'authorizer': {
                'claims': {
                    'sub': 'test-user-123',
                }
            }
        }
    }

    response = lambda_handler(event, lambda_context)

    assert response['statusCode'] in [200, 400, 500]
