"""Unit tests for EdgeService class (TDD)."""
import base64
from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from conftest import load_service_class

# Load EdgeService using the helper to avoid import conflicts
_edge_service_module = load_service_class('edge-processing', 'edge_service')
EdgeService = _edge_service_module.EdgeService

# Also load shared error classes for assertions
from errors.exceptions import ExternalServiceError, ValidationError


class TestEdgeServiceInit:
    """Tests for EdgeService initialization."""

    def test_service_initializes_with_table(self):
        """Service should accept table via constructor injection."""
        mock_table = MagicMock()
        service = EdgeService(table=mock_table)
        assert service.table == mock_table

    def test_service_initializes_with_optional_lambda_client(self):
        """Service should accept optional lambda_client."""
        mock_table = MagicMock()
        mock_lambda = MagicMock()
        service = EdgeService(table=mock_table, lambda_client=mock_lambda)
        assert service.lambda_client == mock_lambda

    def test_service_initializes_without_lambda_client(self):
        """Service should work without lambda_client."""
        mock_table = MagicMock()
        service = EdgeService(table=mock_table)
        assert service.lambda_client is None


class TestEdgeServiceUpsertStatus:
    """Tests for upsert_status operation."""

    def test_upsert_status_creates_edges(self):
        """Should create user-to-profile and profile-to-user edges atomically."""
        mock_table = MagicMock()
        mock_table.table_name = 'test-table'
        service = EdgeService(table=mock_table)

        result = service.upsert_status(
            user_id='test-user-123',
            profile_id='https://linkedin.com/in/john-doe',
            status='possible'
        )

        assert result['success'] is True
        # Now uses transact_write_items for atomic writes
        mock_table.meta.client.transact_write_items.assert_called_once()
        call_args = mock_table.meta.client.transact_write_items.call_args
        assert len(call_args.kwargs['TransactItems']) == 2

    def test_upsert_status_returns_profile_id_b64(self):
        """Should return base64-encoded profile ID."""
        mock_table = MagicMock()
        mock_table.table_name = 'test-table'
        service = EdgeService(table=mock_table)

        result = service.upsert_status(
            user_id='test-user-123',
            profile_id='https://linkedin.com/in/john-doe',
            status='possible'
        )

        assert 'profileId' in result
        decoded = base64.urlsafe_b64decode(result['profileId']).decode()
        assert decoded == 'https://linkedin.com/in/john-doe'

    def test_upsert_status_triggers_ragstack_for_ally(self):
        """Should trigger RAGStack ingestion for 'ally' status."""
        mock_table = MagicMock()
        mock_table.table_name = 'test-table'
        mock_table.get_item.return_value = {'Item': {'name': 'John Doe'}}
        mock_lambda = MagicMock()
        mock_lambda.invoke.return_value = {'StatusCode': 202}

        service = EdgeService(
            table=mock_table,
            lambda_client=mock_lambda,
            ragstack_function_name='test-ragstack-fn'
        )

        # Mock the markdown generation
        with patch.object(service, '_trigger_ragstack_ingestion') as mock_ingest:
            mock_ingest.return_value = {'success': True, 'status': 'triggered'}

            result = service.upsert_status(
                user_id='test-user-123',
                profile_id='https://linkedin.com/in/john-doe',
                status='ally'
            )

            assert result['success'] is True
            mock_ingest.assert_called_once()

    def test_upsert_status_skips_ragstack_for_possible(self):
        """Should NOT trigger RAGStack for 'possible' status."""
        mock_table = MagicMock()
        mock_table.table_name = 'test-table'
        mock_lambda = MagicMock()

        service = EdgeService(
            table=mock_table,
            lambda_client=mock_lambda,
            ragstack_function_name='test-ragstack-fn'
        )

        result = service.upsert_status(
            user_id='test-user-123',
            profile_id='https://linkedin.com/in/john-doe',
            status='possible'
        )

        assert result['success'] is True
        mock_lambda.invoke.assert_not_called()


class TestEdgeServiceAddMessage:
    """Tests for add_message operation."""

    def test_add_message_success(self):
        """Should add message to edge."""
        mock_table = MagicMock()
        service = EdgeService(table=mock_table)

        result = service.add_message(
            user_id='test-user-123',
            profile_id_b64='dGVzdC1wcm9maWxl',
            message='Hello!',
            message_type='outbound'
        )

        assert result['success'] is True
        mock_table.update_item.assert_called_once()

    def test_add_message_missing_message_raises_error(self):
        """Should raise ValidationError when message is missing."""
        mock_table = MagicMock()
        service = EdgeService(table=mock_table)

        with pytest.raises(ValidationError):
            service.add_message(
                user_id='test-user-123',
                profile_id_b64='dGVzdC1wcm9maWxl',
                message='',
                message_type='outbound'
            )


class TestEdgeServiceGetConnections:
    """Tests for get_connections_by_status operation."""

    def test_get_connections_returns_formatted_list(self):
        """Should return properly formatted connection objects."""
        mock_table = MagicMock()
        mock_table.query.return_value = {
            'Items': [
                {
                    'PK': 'USER#test-user',
                    'SK': 'PROFILE#dGVzdC1wcm9maWxl',
                    'status': 'ally',
                    'addedAt': '2024-01-01T00:00:00+00:00',
                    'messages': []
                }
            ]
        }
        mock_table.get_item.return_value = {
            'Item': {
                'name': 'John Doe',
                'headline': 'Software Engineer',
                'currentCompany': 'Tech Corp'
            }
        }

        service = EdgeService(table=mock_table)

        result = service.get_connections_by_status(
            user_id='test-user',
            status='ally'
        )

        assert result['success'] is True
        assert len(result['connections']) == 1
        conn = result['connections'][0]
        assert 'id' in conn
        assert 'first_name' in conn
        assert 'status' in conn

    def test_get_connections_without_status_returns_all(self):
        """Should return all connections when status is None."""
        mock_table = MagicMock()
        mock_table.query.return_value = {'Items': []}
        service = EdgeService(table=mock_table)

        result = service.get_connections_by_status(
            user_id='test-user',
            status=None
        )

        assert result['success'] is True
        call_kwargs = mock_table.query.call_args[1]
        assert 'IndexName' not in call_kwargs


class TestEdgeServiceGetMessages:
    """Tests for get_messages operation."""

    def test_get_messages_success(self):
        """Should return formatted message list."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            'Item': {
                'messages': [
                    {'content': 'Hello', 'timestamp': '2024-01-01T00:00:00', 'type': 'outbound'},
                    {'content': 'Hi there', 'timestamp': '2024-01-01T00:01:00', 'type': 'inbound'}
                ],
                'addedAt': '2024-01-01T00:00:00'
            }
        }

        service = EdgeService(table=mock_table)

        result = service.get_messages(
            user_id='test-user',
            profile_id_b64='dGVzdC1wcm9maWxl'
        )

        assert result['success'] is True
        assert len(result['messages']) == 2
        assert result['messages'][0]['sender'] == 'user'
        assert result['messages'][1]['sender'] == 'connection'

    def test_get_messages_empty_when_no_edge(self):
        """Should return empty list when edge doesn't exist."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}

        service = EdgeService(table=mock_table)

        result = service.get_messages(
            user_id='test-user',
            profile_id_b64='dGVzdC1wcm9maWxl'
        )

        assert result['success'] is True
        assert result['messages'] == []
        assert result['count'] == 0


class TestEdgeServiceCheckExists:
    """Tests for check_exists operation."""

    def test_check_exists_returns_true_when_exists(self):
        """Should return exists=True when edge exists."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            'Item': {
                'status': 'ally',
                'addedAt': '2024-01-01T00:00:00'
            }
        }

        service = EdgeService(table=mock_table)

        result = service.check_exists(
            user_id='test-user',
            profile_id_b64='dGVzdC1wcm9maWxl'
        )

        assert result['success'] is True
        assert result['exists'] is True
        assert result['edge_data']['status'] == 'ally'

    def test_check_exists_returns_false_when_not_exists(self):
        """Should return exists=False when edge doesn't exist."""
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}

        service = EdgeService(table=mock_table)

        result = service.check_exists(
            user_id='test-user',
            profile_id_b64='dGVzdC1wcm9maWxl'
        )

        assert result['success'] is True
        assert result['exists'] is False
        assert result['edge_data'] is None


class TestEdgeServiceConversionLikelihood:
    """Tests for conversion likelihood using enum."""

    def test_conversion_likelihood_uses_enum(self):
        """Should use ConversionLikelihood enum instead of percentage."""
        mock_table = MagicMock()
        mock_table.query.return_value = {
            'Items': [
                {
                    'PK': 'USER#test-user',
                    'SK': 'PROFILE#dGVzdC1wcm9maWxl',
                    'status': 'possible',
                    'addedAt': datetime.now(UTC).isoformat(),
                    'attempts': 0,
                    'messages': []
                }
            ]
        }
        mock_table.get_item.return_value = {
            'Item': {
                'name': 'John Doe',
                'headline': 'Software Engineer',
                'summary': 'Experienced developer'
            }
        }

        service = EdgeService(table=mock_table)

        result = service.get_connections_by_status(
            user_id='test-user',
            status='possible'
        )

        assert result['success'] is True
        conn = result['connections'][0]
        assert conn['conversion_likelihood'] in ('high', 'medium', 'low')

    def test_conversion_likelihood_high_for_complete_recent_profile(self):
        """HIGH: Complete profile + recent + no attempts."""
        mock_table = MagicMock()
        recent_date = datetime.now(UTC).isoformat()
        mock_table.query.return_value = {
            'Items': [
                {
                    'PK': 'USER#test-user',
                    'SK': 'PROFILE#dGVzdC1wcm9maWxl',
                    'status': 'possible',
                    'addedAt': recent_date,
                    'attempts': 0,
                    'messages': []
                }
            ]
        }
        mock_table.get_item.return_value = {
            'Item': {
                'name': 'John Doe',
                'headline': 'Software Engineer at Google',
                'summary': 'Passionate developer with 10+ years experience'
            }
        }

        service = EdgeService(table=mock_table)

        result = service.get_connections_by_status(
            user_id='test-user',
            status='possible'
        )

        assert result['connections'][0]['conversion_likelihood'] == 'high'

    def test_conversion_likelihood_low_for_incomplete_profile(self):
        """LOW: Missing headline."""
        mock_table = MagicMock()
        mock_table.query.return_value = {
            'Items': [
                {
                    'PK': 'USER#test-user',
                    'SK': 'PROFILE#dGVzdC1wcm9maWxl',
                    'status': 'possible',
                    'addedAt': datetime.now(UTC).isoformat(),
                    'attempts': 0,
                    'messages': []
                }
            ]
        }
        mock_table.get_item.return_value = {
            'Item': {
                'name': 'John Doe',
            }
        }

        service = EdgeService(table=mock_table)

        result = service.get_connections_by_status(
            user_id='test-user',
            status='possible'
        )

        assert result['connections'][0]['conversion_likelihood'] == 'low'


class TestEdgeServiceErrorHandling:
    """Tests for error handling."""

    def test_dynamo_error_raises_external_service_error(self):
        """Should raise ExternalServiceError on DynamoDB failures."""
        mock_table = MagicMock()
        mock_table.table_name = 'test-table'
        mock_table.meta.client.transact_write_items.side_effect = ClientError(
            {'Error': {'Code': 'InternalServerError', 'Message': 'Test error'}},
            'TransactWriteItems'
        )

        service = EdgeService(table=mock_table)

        with pytest.raises(ExternalServiceError):
            service.upsert_status(
                user_id='test-user',
                profile_id='https://linkedin.com/in/john-doe',
                status='ally'
            )


class TestEdgeServiceHealthCheck:
    """Tests for health check."""

    def test_health_check_returns_healthy(self):
        """Should return healthy status when table is accessible."""
        mock_table = MagicMock()
        mock_table.table_status = 'ACTIVE'

        service = EdgeService(table=mock_table)

        result = service.health_check()

        assert result['healthy'] is True
