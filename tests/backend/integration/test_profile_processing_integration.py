"""Integration tests for ProfileProcessingService with mocked AWS services."""
import pytest
from moto import mock_aws
from unittest.mock import MagicMock, patch

from conftest import load_service_class


@pytest.fixture
def profile_service_module():
    """Load ProfileProcessingService module."""
    return load_service_class('profile-processing', 'profile_processing_service')


class TestProfileProcessingServiceIntegration:
    """Integration tests for ProfileProcessingService with moto-mocked S3/DynamoDB."""

    @mock_aws
    def test_full_processing_flow(self, profile_service_module):
        """Test complete profile processing with mocked AWS."""
        import boto3

        # Setup mocked S3
        s3 = boto3.client('s3', region_name='us-east-1')
        s3.create_bucket(Bucket='test-bucket')
        s3.put_object(
            Bucket='test-bucket',
            Key='profiles/test-user/Profile-2024.png',
            Body=b'fake_image_bytes' * 100  # Must be > 100 bytes
        )

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

        # Mock Bedrock client responses
        mock_bedrock = MagicMock()
        mock_bedrock.converse.return_value = {
            'output': {
                'message': {
                    'content': [{'text': '{"name": "John Doe", "headline": "Engineer", "summary": "Test"}'}]
                }
            }
        }

        # Create service with mocked clients
        service = profile_service_module.ProfileProcessingService(
            s3_client=s3,
            bedrock_client=mock_bedrock,
            table=table
        )

        # Test full processing
        result = service.process('test-bucket', 'profiles/test-user/Profile-2024.png')

        assert result['success'] is True
        assert 'profile_id' in result

    @mock_aws
    def test_download_image_success(self, profile_service_module):
        """Test image download from S3."""
        import boto3

        s3 = boto3.client('s3', region_name='us-east-1')
        s3.create_bucket(Bucket='test-bucket')
        s3.put_object(Bucket='test-bucket', Key='test.png', Body=b'image_data')

        service = profile_service_module.ProfileProcessingService(
            s3_client=s3,
            bedrock_client=MagicMock(),
            table=MagicMock()
        )

        result = service.download_image('test-bucket', 'test.png')

        assert result == b'image_data'

    @mock_aws
    def test_download_image_not_found(self, profile_service_module):
        """Test handling of missing image."""
        import boto3
        from errors.exceptions import NotFoundError

        s3 = boto3.client('s3', region_name='us-east-1')
        s3.create_bucket(Bucket='test-bucket')

        service = profile_service_module.ProfileProcessingService(
            s3_client=s3,
            bedrock_client=MagicMock(),
            table=MagicMock()
        )

        with pytest.raises(NotFoundError):
            service.download_image('test-bucket', 'nonexistent.png')

    @mock_aws
    def test_store_profile_creates_item(self, profile_service_module):
        """Test profile storage in DynamoDB."""
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

        service = profile_service_module.ProfileProcessingService(
            s3_client=MagicMock(),
            bedrock_client=MagicMock(),
            table=table
        )

        profile_data = {
            'name': 'John Doe',
            'headline': 'Software Engineer',
            'summary': 'Experienced developer',
            'skills': ['Python', 'AWS']
        }

        result = service.store_profile(profile_data, {'linkedin_url': 'johndoe'})

        assert 'PROFILE#' in result

        # Verify item exists in DynamoDB
        response = table.get_item(Key={'PK': result, 'SK': '#METADATA'})
        assert 'Item' in response
        assert response['Item']['name'] == 'John Doe'
