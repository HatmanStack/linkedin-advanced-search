"""Unit tests for LLMService class (TDD)."""
from unittest.mock import MagicMock

import pytest


@pytest.fixture
def mock_openai_client():
    """Create mock OpenAI client."""
    client = MagicMock()
    # Default: mock responses.create with output_text
    mock_response = MagicMock()
    mock_response.id = 'resp_123'
    mock_response.output_text = 'Idea: Test idea 1\n\nIdea: Test idea 2'
    client.responses.create.return_value = mock_response
    return client


@pytest.fixture
def mock_bedrock_client():
    """Create mock Bedrock client."""
    client = MagicMock()
    client.invoke_model.return_value = {
        'body': MagicMock(read=MagicMock(return_value=b'{"content": [{"text": "Styled content"}]}'))
    }
    return client


@pytest.fixture
def mock_dynamodb_table():
    """Create mock DynamoDB table."""
    table = MagicMock()
    table.get_item.return_value = {}
    return table


@pytest.fixture
def service(mock_openai_client, mock_bedrock_client, mock_dynamodb_table):
    """Create LLMService with mocked dependencies."""
    from conftest import load_service_class
    module = load_service_class('llm', 'llm_service')
    return module.LLMService(
        openai_client=mock_openai_client,
        bedrock_client=mock_bedrock_client,
        table=mock_dynamodb_table
    )


class TestLLMServiceInit:
    """Tests for service initialization."""

    def test_service_initializes_with_clients(self, mock_openai_client, mock_bedrock_client, mock_dynamodb_table):
        """Service should accept clients via constructor injection."""
        from conftest import load_service_class
        module = load_service_class('llm', 'llm_service')
        service = module.LLMService(
            openai_client=mock_openai_client,
            bedrock_client=mock_bedrock_client,
            table=mock_dynamodb_table
        )
        assert service.openai_client == mock_openai_client
        assert service.bedrock_client == mock_bedrock_client
        assert service.table == mock_dynamodb_table


class TestGenerateIdeas:
    """Tests for generate_ideas operation."""

    def test_generate_ideas_returns_ideas(self, service, mock_openai_client):
        """Should return parsed ideas synchronously."""
        result = service.generate_ideas(
            user_profile={'name': 'John Doe'},
            prompt='AI trends',
            job_id='job-123',
            user_id='user-456'
        )

        assert result['success'] is True
        assert 'ideas' in result
        assert len(result['ideas']) == 2
        mock_openai_client.responses.create.assert_called_once()

    def test_generate_ideas_includes_user_profile(self, service, mock_openai_client):
        """Should include user profile in prompt."""
        service.generate_ideas(
            user_profile={'name': 'Jane Doe', 'title': 'Engineer'},
            prompt='Tech topics',
            job_id='job-123',
            user_id='user-456'
        )

        call_args = mock_openai_client.responses.create.call_args
        assert 'input' in call_args[1]

    def test_generate_ideas_handles_api_error(self, service, mock_openai_client):
        """Should handle OpenAI API errors gracefully."""
        mock_openai_client.responses.create.side_effect = Exception('API error')

        result = service.generate_ideas(
            user_profile={},
            prompt='test',
            job_id='job-123',
            user_id='user-456'
        )

        assert result['success'] is False
        assert 'error' in result


class TestResearchSelectedIdeas:
    """Tests for research_selected_ideas operation."""

    def test_research_ideas_returns_job_id(self, service, mock_openai_client):
        """Should return job ID for background research."""
        result = service.research_selected_ideas(
            user_data={'name': 'Test User'},
            selected_ideas=['AI in healthcare', 'Cloud computing'],
            user_id='user-123'
        )

        assert result['success'] is True
        assert 'job_id' in result
        assert len(result['job_id']) > 0

    def test_research_ideas_empty_list_fails(self, service):
        """Should fail with empty ideas list."""
        result = service.research_selected_ideas(
            user_data={},
            selected_ideas=[],
            user_id='user-123'
        )

        assert result['success'] is False
        assert 'error' in result

    def test_research_ideas_calls_openai_with_web_search(self, service, mock_openai_client):
        """Should use OpenAI with web search tool."""
        service.research_selected_ideas(
            user_data={},
            selected_ideas=['Topic 1'],
            user_id='user-123'
        )

        call_args = mock_openai_client.responses.create.call_args
        assert call_args[1].get('tools') is not None


class TestGetResearchResult:
    """Tests for get_research_result operation."""

    def test_get_result_returns_ideas_when_found(self, service, mock_dynamodb_table):
        """Should return ideas when found in DynamoDB."""
        mock_dynamodb_table.get_item.return_value = {
            'Item': {
                'PK': 'USER#user-123',
                'SK': 'IDEAS#job-456',
                'ideas': ['Idea 1', 'Idea 2']
            }
        }

        result = service.get_research_result(
            user_id='user-123',
            job_id='job-456',
            kind='IDEAS'
        )

        assert result['success'] is True
        assert result['ideas'] == ['Idea 1', 'Idea 2']

    def test_get_result_returns_false_when_not_found(self, service, mock_dynamodb_table):
        """Should return success=False when result not found."""
        mock_dynamodb_table.get_item.return_value = {}

        result = service.get_research_result(
            user_id='user-123',
            job_id='job-456',
            kind='RESEARCH'
        )

        assert result['success'] is False


class TestSynthesizeResearch:
    """Tests for synthesize_research operation."""

    def test_synthesize_returns_content(self, service, mock_openai_client):
        """Should return synthesized content synchronously."""
        mock_openai_client.responses.create.return_value.output_text = 'Synthesized post content'
        result = service.synthesize_research(
            research_content='Research findings...',
            post_content='Draft post...',
            ideas_content=['idea 1'],
            user_profile={'name': 'Test'},
            job_id='job-123',
            user_id='user-456'
        )

        assert result['success'] is True
        assert result['content'] == 'Synthesized post content'

    def test_synthesize_requires_job_id(self, service):
        """Should require job_id."""
        result = service.synthesize_research(
            research_content='test',
            post_content='test',
            ideas_content=[],
            user_profile={},
            job_id=None,
            user_id='user-123'
        )

        assert result['success'] is False
        assert 'job_id' in result.get('error', '').lower()


class TestHealthCheck:
    """Tests for health check."""

    def test_health_check_returns_status(self, service):
        """Should return health status."""
        result = service.health_check()

        assert 'healthy' in result
