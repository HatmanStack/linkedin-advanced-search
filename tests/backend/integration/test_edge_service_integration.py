"""Integration tests for EdgeService with mocked AWS services."""
import base64

import pytest
from moto import mock_aws

from conftest import load_service_class


@pytest.fixture
def edge_service_module():
    """Load EdgeService module."""
    return load_service_class('edge-processing', 'edge_service')


class TestEdgeServiceIntegration:
    """Integration tests for EdgeService with moto-mocked DynamoDB."""

    @pytest.mark.skip(reason="moto 5.x has issues with transact_write_items using TypeSerializer serialized items")
    @mock_aws
    def test_full_upsert_flow(self, edge_service_module):
        """Test complete upsert flow with mocked DynamoDB."""
        import boto3

        # Setup mocked DynamoDB
        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        table = dynamodb.create_table(
            TableName='test-table',
            KeySchema=[
                {'AttributeName': 'PK', 'KeyType': 'HASH'},
                {'AttributeName': 'SK', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'PK', 'AttributeType': 'S'},
                {'AttributeName': 'SK', 'AttributeType': 'S'},
            ],
            BillingMode='PAY_PER_REQUEST'
        )

        # Create service with mocked table (no RAGStack for this test)
        service = edge_service_module.EdgeService(table=table)

        # Test upsert - profile_id will be base64-encoded by service
        result = service.upsert_status(
            user_id='test-user',
            profile_id='test-profile',  # raw profile id
            status='ally',
            added_at='2024-01-15T12:00:00Z'
        )

        assert result['success'] is True
        # Service returns base64-encoded profile ID
        assert 'profileId' in result

        # Get the encoded ID for verification
        profile_id_b64 = result['profileId']

        # Verify item in DynamoDB
        response = table.get_item(
            Key={
                'PK': 'USER#test-user',
                'SK': f'PROFILE#{profile_id_b64}'
            }
        )
        assert 'Item' in response
        assert response['Item']['status'] == 'ally'

    @pytest.mark.skip(reason="moto 5.x has issues with transact_write_items using TypeSerializer serialized items")
    @mock_aws
    def test_get_connections_by_status(self, edge_service_module):
        """Test retrieving connections by status."""
        import boto3

        # Setup mocked DynamoDB with GSI
        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        table = dynamodb.create_table(
            TableName='test-table',
            KeySchema=[
                {'AttributeName': 'PK', 'KeyType': 'HASH'},
                {'AttributeName': 'SK', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'PK', 'AttributeType': 'S'},
                {'AttributeName': 'SK', 'AttributeType': 'S'},
                {'AttributeName': 'GSI1PK', 'AttributeType': 'S'},
                {'AttributeName': 'GSI1SK', 'AttributeType': 'S'},
            ],
            GlobalSecondaryIndexes=[
                {
                    'IndexName': 'GSI1',
                    'KeySchema': [
                        {'AttributeName': 'GSI1PK', 'KeyType': 'HASH'},
                        {'AttributeName': 'GSI1SK', 'KeyType': 'RANGE'},
                    ],
                    'Projection': {'ProjectionType': 'ALL'},
                }
            ],
            BillingMode='PAY_PER_REQUEST'
        )

        service = edge_service_module.EdgeService(table=table)

        # Create test edges with UNIQUE profile IDs
        service.upsert_status(user_id='test-user', profile_id='ally-profile-1', status='ally')
        service.upsert_status(user_id='test-user', profile_id='ally-profile-2', status='ally')
        service.upsert_status(user_id='test-user', profile_id='possible-profile', status='possible')

        # Query by status
        result = service.get_connections_by_status('test-user', 'ally')

        assert 'connections' in result
        assert result['count'] == 2

    @pytest.mark.skip(reason="moto 5.x has issues with transact_write_items using TypeSerializer serialized items")
    @mock_aws
    def test_add_message_to_edge(self, edge_service_module):
        """Test adding message to existing edge."""
        import boto3

        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        table = dynamodb.create_table(
            TableName='test-table',
            KeySchema=[
                {'AttributeName': 'PK', 'KeyType': 'HASH'},
                {'AttributeName': 'SK', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'PK', 'AttributeType': 'S'},
                {'AttributeName': 'SK', 'AttributeType': 'S'},
            ],
            BillingMode='PAY_PER_REQUEST'
        )

        service = edge_service_module.EdgeService(table=table)

        # First create the edge and capture the encoded profile_id
        upsert_result = service.upsert_status(
            user_id='test-user',
            profile_id='test-profile',
            status='ally'
        )
        profile_id_b64 = upsert_result['profileId']

        # Add a message using the encoded profile_id
        result = service.add_message(
            user_id='test-user',
            profile_id_b64=profile_id_b64,
            message='Hello, this is a test message',
            message_type='outbound'
        )

        assert result['success'] is True

        # Retrieve messages using the encoded profile_id
        messages_result = service.get_messages('test-user', profile_id_b64)
        assert len(messages_result['messages']) == 1
        assert messages_result['messages'][0]['content'] == 'Hello, this is a test message'

    @pytest.mark.skip(reason="moto 5.x has issues with transact_write_items using TypeSerializer serialized items")
    @mock_aws
    def test_check_exists(self, edge_service_module):
        """Test checking if edge exists."""
        import boto3

        dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        table = dynamodb.create_table(
            TableName='test-table',
            KeySchema=[
                {'AttributeName': 'PK', 'KeyType': 'HASH'},
                {'AttributeName': 'SK', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'PK', 'AttributeType': 'S'},
                {'AttributeName': 'SK', 'AttributeType': 'S'},
            ],
            BillingMode='PAY_PER_REQUEST'
        )

        service = edge_service_module.EdgeService(table=table)

        # Check non-existent (encode to base64 as check_exists expects)
        nonexistent_b64 = base64.urlsafe_b64encode(b'nonexistent').decode()
        result = service.check_exists('test-user', nonexistent_b64)
        assert result['exists'] is False

        # Create edge and capture the returned profile_id
        upsert_result = service.upsert_status('test-user', 'exists-profile', 'ally')
        profile_id_b64 = upsert_result['profileId']

        # Check existing using the encoded profile ID
        result = service.check_exists('test-user', profile_id_b64)
        assert result['exists'] is True
