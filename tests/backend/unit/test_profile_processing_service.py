"""Unit tests for ProfileProcessingService class (TDD)."""
import base64
from unittest.mock import MagicMock, patch

import pytest

# Test fixtures and helpers
@pytest.fixture
def mock_s3_client():
    """Create mock S3 client."""
    client = MagicMock()
    # Default: return image bytes
    client.get_object.return_value = {
        'Body': MagicMock(read=MagicMock(return_value=b'fake_image_bytes' * 100))
    }
    client.head_object.return_value = {
        'LastModified': MagicMock(strftime=MagicMock(return_value='2024-01-15'))
    }
    return client


@pytest.fixture
def mock_bedrock_client():
    """Create mock Bedrock client."""
    client = MagicMock()
    # Default: return valid parsed profile JSON
    client.converse.return_value = {
        'output': {
            'message': {
                'content': [{'text': '''{
                    "name": "John Doe",
                    "headline": "Software Engineer",
                    "summary": "Experienced developer",
                    "currentCompany": "Tech Corp",
                    "currentTitle": "Senior Engineer",
                    "currentLocation": "San Francisco",
                    "employmentType": "Full-time",
                    "workExperience": [],
                    "education": [],
                    "skills": ["Python", "AWS"]
                }'''}]
            }
        }
    }
    return client


@pytest.fixture
def mock_dynamodb_table():
    """Create mock DynamoDB table."""
    table = MagicMock()
    table.get_item.return_value = {}  # No existing profile
    return table


@pytest.fixture
def service(mock_s3_client, mock_bedrock_client, mock_dynamodb_table):
    """Create ProfileProcessingService with mocked dependencies."""
    from conftest import load_service_class
    module = load_service_class('profile-processing', 'profile_processing_service')
    return module.ProfileProcessingService(
        s3_client=mock_s3_client,
        bedrock_client=mock_bedrock_client,
        table=mock_dynamodb_table
    )


class TestProfileProcessingServiceInit:
    """Tests for service initialization."""

    def test_service_initializes_with_clients(self, mock_s3_client, mock_bedrock_client, mock_dynamodb_table):
        """Service should accept clients via constructor injection."""
        from conftest import load_service_class
        module = load_service_class('profile-processing', 'profile_processing_service')
        service = module.ProfileProcessingService(
            s3_client=mock_s3_client,
            bedrock_client=mock_bedrock_client,
            table=mock_dynamodb_table
        )
        assert service.s3_client == mock_s3_client
        assert service.bedrock_client == mock_bedrock_client
        assert service.table == mock_dynamodb_table


class TestDownloadImage:
    """Tests for download_image operation."""

    def test_download_image_success(self, service, mock_s3_client):
        """Should download image bytes from S3."""
        result = service.download_image('test-bucket', 'profiles/test.png')

        assert result is not None
        assert len(result) > 0
        mock_s3_client.get_object.assert_called_once_with(
            Bucket='test-bucket',
            Key='profiles/test.png'
        )

    def test_download_image_not_found(self, service, mock_s3_client):
        """Should raise NotFoundError when image doesn't exist."""
        from botocore.exceptions import ClientError
        mock_s3_client.get_object.side_effect = ClientError(
            {'Error': {'Code': 'NoSuchKey', 'Message': 'Not found'}},
            'GetObject'
        )

        from errors.exceptions import NotFoundError
        with pytest.raises(NotFoundError):
            service.download_image('test-bucket', 'nonexistent.png')


class TestExtractText:
    """Tests for extract_text operation (AI vision)."""

    def test_extract_text_success(self, service, mock_bedrock_client):
        """Should extract text from image using AI vision."""
        mock_bedrock_client.converse.return_value = {
            'output': {
                'message': {
                    'content': [{'text': 'John Doe\nSoftware Engineer\nTech Corp'}]
                }
            }
        }

        # Image must be > 100 bytes
        result = service.extract_text(b'fake_image_bytes' * 10, 'image/png')

        assert 'Blocks' in result
        assert len(result['Blocks']) > 0
        mock_bedrock_client.converse.assert_called_once()

    def test_extract_text_empty_image(self, service):
        """Should raise ValidationError for empty image."""
        from errors.exceptions import ValidationError
        with pytest.raises(ValidationError):
            service.extract_text(b'', 'image/png')


class TestParseProfile:
    """Tests for parse_profile operation (AI parsing)."""

    def test_parse_profile_success(self, service, mock_bedrock_client):
        """Should parse OCR text into structured profile data."""
        ocr_text = "John Doe\nSoftware Engineer at Tech Corp\n5 years experience"

        result = service.parse_profile(ocr_text, {'linkedin_url': 'johndoe'})

        assert result is not None
        assert 'name' in result
        assert result['name'] == 'John Doe'

    def test_parse_profile_handles_missing_fields(self, service, mock_bedrock_client):
        """Should handle missing profile fields gracefully."""
        mock_bedrock_client.converse.return_value = {
            'output': {
                'message': {
                    'content': [{'text': '{"name": "Jane Doe"}'}]
                }
            }
        }

        result = service.parse_profile("Jane Doe", {})

        assert result['name'] == 'Jane Doe'


class TestStoreProfile:
    """Tests for store_profile operation."""

    def test_store_profile_creates_item(self, service, mock_dynamodb_table):
        """Should create profile metadata item in DynamoDB."""
        profile_data = {
            'name': 'John Doe',
            'headline': 'Engineer',
            'summary': 'Test',
            'currentCompany': 'Tech',
            'currentTitle': 'Senior',
            'currentLocation': 'SF',
            'skills': ['Python']
        }
        s3_metadata = {'linkedin_url': 'johndoe', 'date_added': '2024-01-15'}

        result = service.store_profile(profile_data, s3_metadata)

        assert result is not None
        mock_dynamodb_table.put_item.assert_called_once()

    def test_store_profile_returns_profile_id(self, service, mock_dynamodb_table):
        """Should return base64-encoded profile ID."""
        profile_data = {'name': 'Test'}
        s3_metadata = {'linkedin_url': 'testuser'}

        result = service.store_profile(profile_data, s3_metadata)

        assert 'PROFILE#' in result
        # Verify it contains base64-encoded URL
        profile_id_b64 = result.replace('PROFILE#', '')
        decoded = base64.b64decode(profile_id_b64).decode()
        assert decoded == 'testuser'


class TestProcessEndToEnd:
    """Tests for full process workflow."""

    def test_process_success(self, service, mock_s3_client, mock_bedrock_client, mock_dynamodb_table):
        """Should process profile from S3 event end-to-end."""
        result = service.process('test-bucket', 'profiles/test/Profile-2024.png')

        assert result['success'] is True
        assert 'profile_id' in result

    def test_process_handles_s3_error(self, service, mock_s3_client):
        """Should handle S3 download failures gracefully."""
        from botocore.exceptions import ClientError
        mock_s3_client.get_object.side_effect = ClientError(
            {'Error': {'Code': 'AccessDenied', 'Message': 'Access denied'}},
            'GetObject'
        )

        from errors.exceptions import ExternalServiceError
        with pytest.raises(ExternalServiceError):
            service.process('test-bucket', 'profiles/test.png')


class TestGenerateMarkdown:
    """Tests for markdown generation."""

    def test_generate_markdown_includes_profile_data(self, service):
        """Should generate markdown with profile information."""
        profile_data = {
            'name': 'John Doe',
            'headline': 'Software Engineer',
            'currentCompany': 'Tech Corp',
            'summary': 'Experienced developer'
        }
        ocr_response = {'Blocks': [{'BlockType': 'LINE', 'Text': 'Test'}]}

        result = service.generate_markdown(profile_data, ocr_response)

        assert '# John Doe' in result
        assert 'Software Engineer' in result


class TestHealthCheck:
    """Tests for health check."""

    def test_health_check_returns_healthy(self, service, mock_s3_client):
        """Should return healthy status when S3 is accessible."""
        mock_s3_client.head_bucket.return_value = {}

        result = service.health_check()

        assert result['healthy'] is True
