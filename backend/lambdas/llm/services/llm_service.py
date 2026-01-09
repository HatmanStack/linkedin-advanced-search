"""LLMService - Business logic for LLM operations."""
import importlib.util
import json
import logging
import os
import re
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

# Set up shared path for imports
_shared_path = Path(__file__).parent.parent.parent / 'shared' / 'python'
if str(_shared_path) not in sys.path:
    sys.path.insert(0, str(_shared_path))


# Import BaseService directly from file to avoid package collision
def _load_base_service():
    """Load BaseService from shared path directly."""
    base_service_path = _shared_path / 'services' / 'base_service.py'
    spec = importlib.util.spec_from_file_location('shared_base_service', base_service_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.BaseService


BaseService = _load_base_service()

# Import prompts - will be loaded from parent directory
PROMPTS_PATH = Path(__file__).parent.parent / 'prompts.py'
if PROMPTS_PATH.exists():
    spec = importlib.util.spec_from_file_location('prompts', PROMPTS_PATH)
    prompts_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(prompts_module)
    LINKEDIN_IDEAS_PROMPT = getattr(prompts_module, 'LINKEDIN_IDEAS_PROMPT', '{user_data}\n{raw_ideas}')
    LINKEDIN_RESEARCH_PROMPT = getattr(prompts_module, 'LINKEDIN_RESEARCH_PROMPT', '{topics}\n{user_data}')
    SYNTHESIZE_RESEARCH_PROMPT = getattr(prompts_module, 'SYNTHESIZE_RESEARCH_PROMPT', '{user_data}\n{research_content}\n{post_content}\n{ideas_content}')
    APPLY_POST_STYLE_PROMPT = getattr(prompts_module, 'APPLY_POST_STYLE_PROMPT', '{existing_content}\n{style}')
else:
    LINKEDIN_IDEAS_PROMPT = '{user_data}\n{raw_ideas}'
    LINKEDIN_RESEARCH_PROMPT = '{topics}\n{user_data}'
    SYNTHESIZE_RESEARCH_PROMPT = '{user_data}\n{research_content}\n{post_content}\n{ideas_content}'
    APPLY_POST_STYLE_PROMPT = '{existing_content}\n{style}'

logger = logging.getLogger(__name__)

# Placeholder name used for demo/test profiles that should be skipped
PROFILE_PLACEHOLDER_NAME = "Tom, Dick, And Harry"


class LLMService(BaseService):
    """
    Service class for LLM-powered content generation operations.

    Handles idea generation, research, synthesis, and style transformations
    using OpenAI and AWS Bedrock with injected clients for testability.
    """

    def __init__(
        self,
        openai_client,
        bedrock_client=None,
        table=None,
        bedrock_model_id: str | None = None
    ):
        """
        Initialize LLMService with injected dependencies.

        Args:
            openai_client: OpenAI client for GPT operations
            bedrock_client: Bedrock client for Claude operations (optional)
            table: DynamoDB Table resource for result storage (optional)
            bedrock_model_id: Bedrock model ID for style operations
        """
        super().__init__()
        self.openai_client = openai_client
        self.bedrock_client = bedrock_client
        self.table = table
        self.bedrock_model_id = bedrock_model_id or os.environ.get('BEDROCK_MODEL_ID', 'anthropic.claude-3-sonnet-20240229-v1:0')

    def health_check(self) -> dict[str, Any]:
        """Check service health by verifying clients are configured."""
        clients_configured = (
            (self.openai_client is not None or self.bedrock_client is not None) and
            self.table is not None
        )
        return {
            'healthy': clients_configured,
            'details': {
                'openai_configured': self.openai_client is not None,
                'bedrock_configured': self.bedrock_client is not None,
                'dynamodb_configured': self.table is not None
            }
        }

    def generate_ideas(
        self,
        user_profile: dict,
        prompt: str,
        job_id: str,
        user_id: str
    ) -> dict[str, Any]:
        """
        Generate LinkedIn content ideas using AI.

        Args:
            user_profile: User profile data for context
            prompt: User's prompt/topic ideas
            job_id: Job ID for tracking
            user_id: User ID for metadata

        Returns:
            dict with success status and queued status
        """
        try:
            user_data = ''
            if user_profile and user_profile.get('name') != PROFILE_PLACEHOLDER_NAME:
                for key, value in user_profile.items():
                    user_data += f"{key}: {value}\n"

            llm_prompt = LINKEDIN_IDEAS_PROMPT.format(
                user_data=user_data,
                raw_ideas=prompt or ''
            )

            # Use IDEM_KEY from env, or fall back to job_id for idempotency
            # Explicitly check for empty string to ensure proper fallback
            env_idem_key = os.environ.get('IDEM_KEY')
            idempotency_key = (env_idem_key if env_idem_key else None) or job_id or str(uuid.uuid4())

            self.openai_client.responses.create(
                model="gpt-5.2",
                input=llm_prompt,
                background=True,
                metadata={"job_id": job_id, "user_id": user_id, "kind": "IDEAS"},
                extra_headers={"Idempotency-Key": idempotency_key},
            )

            return {'success': True, 'status': 'queued'}

        except Exception as e:
            logger.error(f"Error in generate_ideas: {e}")
            return {'success': False, 'error': 'Failed to generate ideas'}

    def research_selected_ideas(
        self,
        user_data: dict,
        selected_ideas: list,
        user_id: str
    ) -> dict[str, Any]:
        """
        Research selected ideas using AI with web search.

        Args:
            user_data: User profile data
            selected_ideas: List of ideas to research
            user_id: User ID

        Returns:
            dict with success status and job_id
        """
        try:
            if not selected_ideas:
                return {'success': False, 'error': 'No ideas selected for research'}

            job_id = str(uuid.uuid4())

            formatted_user_data = ''
            if user_data and user_data.get('name') != PROFILE_PLACEHOLDER_NAME:
                for key, value in user_data.items():
                    if key != "linkedin_credentials":
                        formatted_user_data += f"{key}: {value}\n"

            formatted_topics = '\n'.join([f"- {idea}" for idea in selected_ideas])

            research_prompt = LINKEDIN_RESEARCH_PROMPT.format(
                topics=formatted_topics,
                user_data=formatted_user_data
            )

            # Use IDEM_KEY from env, or fall back to job_id for idempotency
            env_idem_key = os.environ.get('IDEM_KEY')
            idempotency_key = (env_idem_key if env_idem_key else None) or job_id or str(uuid.uuid4())

            self.openai_client.responses.create(
                model="o4-mini-deep-research",
                input=research_prompt,
                background=True,
                metadata={"job_id": job_id, "user_id": user_id, "kind": "RESEARCH"},
                tools=[
                    {"type": "web_search_preview"},
                    {"type": "code_interpreter", "container": {"type": "auto"}},
                ],
                extra_headers={"Idempotency-Key": idempotency_key},
            )

            return {
                'success': True,
                'job_id': job_id,
                'ideas_researched': selected_ideas,
                'research_summary': f"Researched {len(selected_ideas)} selected topics"
            }

        except Exception as e:
            logger.error(f"Error in research_selected_ideas: {e}")
            return {'success': False, 'error': 'Failed to research selected ideas'}

    def get_research_result(
        self,
        user_id: str,
        job_id: str,
        kind: str | None = None
    ) -> dict[str, Any]:
        """
        Get research result from DynamoDB.

        Args:
            user_id: User ID
            job_id: Job ID to look up
            kind: Result kind (IDEAS, RESEARCH, SYNTHESIZE)

        Returns:
            dict with success status and content if found
        """
        try:
            if not self.table:
                logger.error("DynamoDB table not configured")
                return {'success': False}

            prefixes = []
            if kind == 'IDEAS':
                prefixes = ['IDEAS']
            elif kind == 'RESEARCH':
                prefixes = ['RESEARCH']
            elif kind == 'SYNTHESIZE':
                prefixes = ['SYNTHESIZE']
            else:
                prefixes = ['IDEAS', 'RESEARCH', 'SYNTHESIZE']

            item = None
            found_kind = None

            for prefix in prefixes:
                response = self.table.get_item(
                    Key={
                        'PK': f'USER#{user_id}',
                        'SK': f'{prefix}#{job_id}'
                    }
                )
                item = response.get('Item')
                if item:
                    found_kind = prefix
                    break

            if not item:
                return {'success': False}

            # Update user profile with results
            profile_updates = self._build_profile_updates(item, found_kind)
            if profile_updates:
                self._update_user_profile(user_id, profile_updates)

            # Return appropriate response
            if item.get('ideas'):
                return {'success': True, 'ideas': item.get('ideas')}
            elif found_kind == 'SYNTHESIZE':
                content = item.get('content', '')
                sections = self._parse_synthesize_sections(content)
                if sections:
                    return {'success': True, 'sections': sections}
            return {'success': True, 'content': item.get('content', '')}

        except Exception as e:
            logger.error(f"Error in get_research_result: {e}")
            return {'success': False}

    def synthesize_research(
        self,
        research_content,
        post_content,
        ideas_content,
        user_profile: dict,
        job_id: str | None,
        user_id: str | None
    ) -> dict[str, Any]:
        """
        Synthesize research into a LinkedIn post.

        Args:
            research_content: Research findings
            post_content: Existing draft content
            ideas_content: Selected ideas
            user_profile: User profile
            job_id: Job ID for tracking
            user_id: User ID

        Returns:
            dict with success status
        """
        try:
            if not job_id:
                return {'success': False, 'error': 'Missing required field: job_id'}

            user_data = ''
            if isinstance(user_profile, dict) and user_profile.get('name') != PROFILE_PLACEHOLDER_NAME:
                for key, value in user_profile.items():
                    user_data += f"{key}: {value}\n"

            research_text = self._normalize_content(research_content)
            post_text = self._normalize_content(post_content)

            llm_prompt = SYNTHESIZE_RESEARCH_PROMPT.format(
                user_data=user_data,
                research_content=research_text,
                post_content=post_text,
                ideas_content=ideas_content,
            )

            # Use IDEM_KEY from env, or fall back to job_id for idempotency
            # Explicitly check for empty string to ensure proper fallback
            env_idem_key = os.environ.get('IDEM_KEY')
            idempotency_key = (env_idem_key if env_idem_key else None) or job_id or str(uuid.uuid4())

            self.openai_client.responses.create(
                model="gpt-5.2",
                input=llm_prompt,
                background=True,
                metadata={"job_id": job_id, "user_id": user_id, "kind": "SYNTHESIZE"},
                extra_headers={"Idempotency-Key": idempotency_key},
            )

            return {'success': True, 'status': 'queued'}

        except Exception as e:
            logger.error(f"Error in synthesize_research: {e}")
            return {'success': False, 'error': 'Failed to synthesize research into post'}

    def apply_style(
        self,
        existing_content: str,
        style: str
    ) -> dict[str, Any]:
        """
        Apply style transformation to content using Bedrock.

        Args:
            existing_content: Content to transform
            style: Style to apply

        Returns:
            dict with success status and transformed content
        """
        try:
            if self.bedrock_client is None:
                logger.error(f"Bedrock client not configured; cannot apply style with model {self.bedrock_model_id}")
                return {'success': False, 'error': 'Bedrock client not configured'}

            llm_prompt = APPLY_POST_STYLE_PROMPT.format(
                existing_content=existing_content,
                style=style
            )

            body = json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "temperature": 0.7,
                "max_tokens": 5000,
                "messages": [{"role": "user", "content": llm_prompt}]
            })

            response = self.bedrock_client.invoke_model(
                modelId=self.bedrock_model_id,
                body=body,
                contentType='application/json'
            )

            response_body = json.loads(response['body'].read())
            content = response_body["content"][0]["text"]

            return {'success': True, 'content': content}

        except Exception as e:
            logger.error(f"Error in apply_style: {e}")
            return {'success': False, 'error': 'Failed to apply post style'}

    # Private helpers

    def _normalize_content(self, value) -> str:
        """Normalize content to string."""
        if value is None:
            return ''
        if isinstance(value, (dict, list)):
            try:
                return json.dumps(value, indent=2, ensure_ascii=False)
            except Exception:
                return str(value)
        return str(value)

    def _parse_synthesize_sections(self, text: str) -> dict:
        """Parse synthesize content into sections."""
        sections = {}
        if not isinstance(text, str) or not text.strip():
            return sections

        pattern = re.compile(r"(?m)^(?:\s*)([123])\s*[:\.\)\-]", re.UNICODE)
        matches = list(pattern.finditer(text))

        if not matches:
            return sections

        for idx, m in enumerate(matches):
            key = m.group(1)
            start = m.end()
            end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
            value = text[start:end].strip()

            lines = value.split('\n')
            if len(lines) > 1:
                content = '\n'.join(lines[1:]).strip()
                if content:
                    sections[key] = content.strip()
            elif value and not value.startswith('The LinkedIn Post'):
                sections[key] = value.strip()

        return sections

    def _build_profile_updates(self, item: dict, found_kind: str) -> dict:
        """Build profile updates from research result."""
        profile_updates = {}

        if found_kind == 'IDEAS':
            ideas = item.get('ideas')
            if ideas is not None:
                profile_updates['ai_generated_ideas'] = ideas
        elif found_kind == 'RESEARCH':
            content = item.get('content')
            if content is not None:
                profile_updates['ai_generated_research'] = content
        elif found_kind == 'SYNTHESIZE':
            content = item.get('content')
            if content is not None:
                sections = self._parse_synthesize_sections(content)
                if '1' in sections:
                    profile_updates['unpublished_post_content'] = sections['1']
                if '2' in sections:
                    profile_updates['ai_generated_post_reasoning'] = sections['2']
                if '3' in sections:
                    profile_updates['ai_generated_post_hook'] = sections['3']
                if not sections:
                    profile_updates['unpublished_post_content'] = content

        return profile_updates

    def _update_user_profile(self, user_id: str, updates: dict) -> None:
        """Update user profile in DynamoDB."""
        if not updates or not self.table:
            return

        current_time = datetime.now(UTC).isoformat()
        update_expr_parts = []
        expr_attr_values = {':ts': current_time}
        expr_attr_names = {}

        for k, v in updates.items():
            name_key = f"#f_{k}"
            expr_attr_names[name_key] = k
            value_key = f":v_{k}"
            expr_attr_values[value_key] = v
            update_expr_parts.append(f"{name_key} = {value_key}")

        update_expression = (
            'SET ' + ', '.join(update_expr_parts + ['updated_at = :ts', 'created_at = if_not_exists(created_at, :ts)'])
        )

        self.table.update_item(
            Key={'PK': f'USER#{user_id}', 'SK': '#SETTINGS'},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expr_attr_names,
            ExpressionAttributeValues=expr_attr_values
        )
