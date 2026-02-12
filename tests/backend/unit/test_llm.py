"""Handler-level tests for LLM Lambda function."""
import json

import pytest

from conftest import load_lambda_module


@pytest.fixture
def llm_module():
    """Load the LLM Lambda module."""
    return load_lambda_module('llm')


def test_unauthorized_returns_401(lambda_context, llm_module):
    """Unauthenticated requests return 401."""
    event = {
        'body': json.dumps({'operation': 'generate_ideas'}),
    }
    response = llm_module.lambda_handler(event, lambda_context)
    assert response['statusCode'] == 401
    body = json.loads(response['body'])
    assert body['error'] == 'Unauthorized'


def test_invalid_operation_returns_400(lambda_context, llm_module):
    """Invalid operation returns 400."""
    event = {
        'body': json.dumps({'operation': 'nonexistent'}),
        'requestContext': {
            'authorizer': {'claims': {'sub': 'test-user'}}
        },
    }
    response = llm_module.lambda_handler(event, lambda_context)
    assert response['statusCode'] == 400
    body = json.loads(response['body'])
    assert body['error'] == 'Invalid operation'


def test_options_preflight_returns_200(lambda_context, llm_module):
    """OPTIONS preflight returns 200."""
    event = {
        'requestContext': {
            'http': {'method': 'OPTIONS'},
        },
    }
    response = llm_module.lambda_handler(event, lambda_context)
    assert response['statusCode'] == 200


def test_missing_job_id_returns_400(lambda_context, llm_module):
    """generate_ideas without job_id returns 400."""
    event = {
        'body': json.dumps({'operation': 'generate_ideas'}),
        'requestContext': {
            'authorizer': {'claims': {'sub': 'test-user'}}
        },
    }
    response = llm_module.lambda_handler(event, lambda_context)
    assert response['statusCode'] == 400
    body = json.loads(response['body'])
    assert 'job_id' in body['error']


def test_generate_message_missing_topic_returns_400(lambda_context, llm_module):
    """generate_message without conversationTopic returns 400."""
    event = {
        'body': json.dumps({
            'operation': 'generate_message',
            'connectionProfile': {'firstName': 'A', 'lastName': 'B', 'position': 'X', 'company': 'Y'},
        }),
        'requestContext': {
            'authorizer': {'claims': {'sub': 'test-user'}}
        },
    }
    response = llm_module.lambda_handler(event, lambda_context)
    assert response['statusCode'] == 400
    body = json.loads(response['body'])
    assert 'conversationTopic' in body['error']


def test_generate_message_missing_profile_returns_400(lambda_context, llm_module):
    """generate_message without connectionProfile returns 400."""
    event = {
        'body': json.dumps({
            'operation': 'generate_message',
            'conversationTopic': 'AI trends',
        }),
        'requestContext': {
            'authorizer': {'claims': {'sub': 'test-user'}}
        },
    }
    response = llm_module.lambda_handler(event, lambda_context)
    assert response['statusCode'] == 400
    body = json.loads(response['body'])
    assert 'connectionProfile' in body['error']
