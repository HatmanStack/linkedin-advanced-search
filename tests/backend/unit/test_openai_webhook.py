"""Tests for OpenAI Webhook Handler Lambda

NOTE: These tests require openai>=1.50.0 which includes InvalidWebhookSignatureError.
Tests are skipped if the required version is not installed.
"""
import json

import pytest

try:
    from openai import InvalidWebhookSignatureError
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

from conftest import load_lambda_module


pytestmark = pytest.mark.skipif(
    not OPENAI_AVAILABLE,
    reason="openai>=1.50.0 required for webhook tests (InvalidWebhookSignatureError)"
)


@pytest.fixture
def webhook_module(monkeypatch):
    """Load the webhook-handler Lambda module with required env vars"""
    monkeypatch.setenv('OPENAI_WEBHOOK_SECRET', 'test-secret')
    monkeypatch.setenv('OPENAI_API_KEY', 'test-api-key')
    return load_lambda_module('webhook-handler')


def test_webhook_handler_missing_headers(lambda_context, webhook_module):
    """Test webhook handler with missing required headers"""
    event = {
        'body': json.dumps({'event': 'completion', 'data': {}}),
        'headers': {'Content-Type': 'application/json'},
    }

    response = webhook_module.lambda_handler(event, lambda_context)

    # Should return 401 for missing webhook headers
    assert response['statusCode'] == 401


def test_webhook_handler_missing_secret(lambda_context, monkeypatch):
    """Test webhook handler when OPENAI_WEBHOOK_SECRET is not configured"""
    monkeypatch.delenv('OPENAI_WEBHOOK_SECRET', raising=False)

    module = load_lambda_module('webhook-handler')

    event = {
        'body': json.dumps({'data': 'test'}),
        'headers': {
            'webhook-id': 'test-id',
            'webhook-timestamp': '123456',
            'webhook-signature': 'test-sig',
        },
    }

    response = module.lambda_handler(event, lambda_context)

    # Should return 500 when secret not configured
    assert response['statusCode'] == 500
