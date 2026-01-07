"""Tests for RAGStack Proxy Lambda"""
import json
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add ragstack-proxy to path
RAGSTACK_PROXY_PATH = Path(__file__).parent.parent.parent.parent / 'backend' / 'lambdas' / 'ragstack-proxy'
sys.path.insert(0, str(RAGSTACK_PROXY_PATH))

# Set environment variables before importing
os.environ['RAGSTACK_GRAPHQL_ENDPOINT'] = 'https://api.example.com/graphql'
os.environ['RAGSTACK_API_KEY'] = 'test-api-key'

from index import handle_ingest, handle_search, handle_status, lambda_handler


@pytest.fixture
def lambda_context():
    """Create a mock Lambda context"""
    class MockContext:
        def __init__(self):
            self.function_name = 'test-function'
            self.aws_request_id = 'test-request-id'
    return MockContext()


@pytest.fixture
def authenticated_event():
    """Create a mock authenticated API Gateway event"""
    return {
        'httpMethod': 'POST',
        'requestContext': {
            'authorizer': {
                'claims': {
                    'sub': 'test-user-123',
                }
            }
        },
        'body': '{}',
    }


class TestLambdaHandler:
    """Tests for main Lambda handler"""

    def test_handler_unauthorized_without_jwt(self, lambda_context):
        """Test that unauthenticated requests return 401"""
        event = {
            'body': json.dumps({'operation': 'search', 'query': 'test'}),
        }

        response = lambda_handler(event, lambda_context)

        assert response['statusCode'] == 401
        assert 'Unauthorized' in json.loads(response['body'])['error']

    def test_handler_options_request(self, lambda_context):
        """Test CORS OPTIONS handling"""
        event = {
            'httpMethod': 'OPTIONS',
        }

        response = lambda_handler(event, lambda_context)

        assert response['statusCode'] == 200

    def test_handler_unknown_operation(self, authenticated_event, lambda_context):
        """Test handling of unknown operation"""
        authenticated_event['body'] = json.dumps({'operation': 'unknown'})

        response = lambda_handler(authenticated_event, lambda_context)

        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert 'unknown' in body['error']
        assert 'supportedOperations' in body


class TestSearchOperation:
    """Tests for search operation"""

    @patch('index._get_ragstack_client')
    def test_search_success(self, mock_get_client, authenticated_event, lambda_context):
        """Test successful search"""
        mock_client = MagicMock()
        mock_client.search.return_value = [
            {'content': 'Profile content', 'source': 'profile_abc', 'score': 0.95}
        ]
        mock_get_client.return_value = mock_client

        authenticated_event['body'] = json.dumps({
            'operation': 'search',
            'query': 'software engineer',
        })

        response = lambda_handler(authenticated_event, lambda_context)

        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['totalResults'] == 1
        assert body['results'][0]['source'] == 'profile_abc'

    @patch('index._get_ragstack_client')
    def test_search_with_max_results(self, mock_get_client, authenticated_event, lambda_context):
        """Test search with custom maxResults"""
        mock_client = MagicMock()
        mock_client.search.return_value = []
        mock_get_client.return_value = mock_client

        authenticated_event['body'] = json.dumps({
            'operation': 'search',
            'query': 'test',
            'maxResults': 50,
        })

        response = lambda_handler(authenticated_event, lambda_context)

        assert response['statusCode'] == 200
        mock_client.search.assert_called_once_with(query='test', max_results=50)

    def test_search_without_query(self, authenticated_event, lambda_context):
        """Test search without query returns 400"""
        authenticated_event['body'] = json.dumps({
            'operation': 'search',
        })

        response = lambda_handler(authenticated_event, lambda_context)

        assert response['statusCode'] == 400
        assert 'query is required' in json.loads(response['body'])['error']

    @patch('index._get_ragstack_client')
    def test_search_ragstack_error(self, mock_get_client, authenticated_event, lambda_context):
        """Test search handles RAGStack error"""
        from ragstack_client import RAGStackError
        mock_client = MagicMock()
        mock_client.search.side_effect = RAGStackError('API error')
        mock_get_client.return_value = mock_client

        authenticated_event['body'] = json.dumps({
            'operation': 'search',
            'query': 'test',
        })

        response = lambda_handler(authenticated_event, lambda_context)

        assert response['statusCode'] == 502
        assert 'unavailable' in json.loads(response['body'])['error']


class TestIngestOperation:
    """Tests for ingest operation"""

    @patch('index._get_ragstack_client')
    @patch('index.IngestionService')
    def test_ingest_success(self, mock_service_class, mock_get_client, authenticated_event, lambda_context):
        """Test successful ingestion"""
        mock_service = MagicMock()
        mock_service.ingest_profile.return_value = {
            'status': 'uploaded',
            'documentId': 'doc123',
            'profileId': 'profile_abc',
            'error': None,
        }
        mock_service_class.return_value = mock_service

        authenticated_event['body'] = json.dumps({
            'operation': 'ingest',
            'profileId': 'profile_abc',
            'markdownContent': '# Test Profile',
        })

        response = lambda_handler(authenticated_event, lambda_context)

        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['status'] == 'uploaded'
        assert body['documentId'] == 'doc123'

    @patch('index._get_ragstack_client')
    @patch('index.IngestionService')
    def test_ingest_includes_user_id_in_metadata(self, mock_service_class, mock_get_client, authenticated_event, lambda_context):
        """Test that user_id is added to metadata"""
        mock_service = MagicMock()
        mock_service.ingest_profile.return_value = {'status': 'uploaded', 'documentId': 'doc123', 'profileId': 'abc', 'error': None}
        mock_service_class.return_value = mock_service

        authenticated_event['body'] = json.dumps({
            'operation': 'ingest',
            'profileId': 'profile_abc',
            'markdownContent': '# Test',
            'metadata': {'custom': 'value'},
        })

        lambda_handler(authenticated_event, lambda_context)

        # Verify metadata includes user_id
        call_args = mock_service.ingest_profile.call_args
        assert call_args.kwargs['metadata']['user_id'] == 'test-user-123'
        assert call_args.kwargs['metadata']['custom'] == 'value'

    def test_ingest_without_profile_id(self, authenticated_event, lambda_context):
        """Test ingest without profileId returns 400"""
        authenticated_event['body'] = json.dumps({
            'operation': 'ingest',
            'markdownContent': '# Test',
        })

        response = lambda_handler(authenticated_event, lambda_context)

        assert response['statusCode'] == 400
        assert 'profileId is required' in json.loads(response['body'])['error']

    def test_ingest_without_content(self, authenticated_event, lambda_context):
        """Test ingest without markdownContent returns 400"""
        authenticated_event['body'] = json.dumps({
            'operation': 'ingest',
            'profileId': 'profile_abc',
        })

        response = lambda_handler(authenticated_event, lambda_context)

        assert response['statusCode'] == 400
        assert 'markdownContent is required' in json.loads(response['body'])['error']


class TestStatusOperation:
    """Tests for status operation"""

    @patch('index._get_ragstack_client')
    def test_status_success(self, mock_get_client, authenticated_event, lambda_context):
        """Test successful status check"""
        mock_client = MagicMock()
        mock_client.get_document_status.return_value = {
            'status': 'indexed',
            'documentId': 'doc123',
            'error': None,
        }
        mock_get_client.return_value = mock_client

        authenticated_event['body'] = json.dumps({
            'operation': 'status',
            'documentId': 'doc123',
        })

        response = lambda_handler(authenticated_event, lambda_context)

        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['status'] == 'indexed'

    def test_status_without_document_id(self, authenticated_event, lambda_context):
        """Test status without documentId returns 400"""
        authenticated_event['body'] = json.dumps({
            'operation': 'status',
        })

        response = lambda_handler(authenticated_event, lambda_context)

        assert response['statusCode'] == 400
        assert 'documentId is required' in json.loads(response['body'])['error']


class TestDevMode:
    """Tests for development mode"""

    @patch.dict(os.environ, {'DEV_MODE': 'true'})
    @patch('index._get_ragstack_client')
    def test_dev_mode_allows_unauthenticated(self, mock_get_client, lambda_context):
        """Test DEV_MODE allows unauthenticated requests"""
        mock_client = MagicMock()
        mock_client.search.return_value = []
        mock_get_client.return_value = mock_client

        event = {
            'body': json.dumps({
                'operation': 'search',
                'query': 'test',
            }),
        }

        response = lambda_handler(event, lambda_context)

        # Should succeed, not 401
        assert response['statusCode'] == 200
