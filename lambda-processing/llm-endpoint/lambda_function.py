"""
LLM Endpoint Lambda Function (Python 3.12)

Scaffolded to mirror JWT/authorizer extraction from `edge-endpoint`.

REQUIRED ENVIRONMENT VARIABLES:
- OPENAI_API_KEY: Your OpenAI API key for GPT-4o integration
- DYNAMODB_TABLE_NAME (optional for research result lookup)

FEATURES:
- AI-powered LinkedIn content idea generation using GPT-4o
- Fallback to default ideas if OpenAI API is unavailable
- Comprehensive error handling and logging
- User profile and prompt-based content customization
- Research job lookup by (user_id, job_id) in DynamoDB
"""

import json
import logging
import os
from prompts import LINKEDIN_IDEAS_PROMPT, LINKEDIN_RESEARCH_PROMPT, SYNTHESIZE_RESEARCH_PROMPT
from openai import OpenAI
import boto3
client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'),timeout=3600)


API_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
}


# Optional DynamoDB setup for research result lookup
try:
    _dynamodb = boto3.resource('dynamodb')
    _TABLE_NAME = os.environ.get('DYNAMODB_TABLE_NAME')
    _table = _dynamodb.Table(_TABLE_NAME) if _TABLE_NAME else None
except Exception as _e:  # pragma: no cover
    _table = None


def _resp(status_code: int, body_dict: dict) -> dict:
    return {
        'statusCode': status_code,
        'headers': API_HEADERS,
        'body': json.dumps(body_dict)
    }


def _parse_body(event: dict) -> dict:
    if not event:
        return {}
    body_raw = event.get('body')
    if not body_raw:
        return {}
    if isinstance(body_raw, str):
        try:
            return json.loads(body_raw)
        except Exception:
            return {}
    return body_raw or {}


def _extract_user_id(event: dict) -> str | None:
    sub = (
        event.get('requestContext', {})
        .get('authorizer', {})
        .get('claims', {})
        .get('sub')
    )
    if sub:
        return sub
    auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization')
    if auth_header:
        return 'test-user-id'
    return None


logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handle_generate_ideas(user_profile: dict, prompt: str = "") -> dict:
    """
    Handle generate_ideas operation
    """
    try:
        raw_ideas = ''
        user_data = ''
        
        if prompt:
            raw_ideas = prompt
        if user_profile and user_profile.get('name') != "Tom, Dick, And Harry":
            for key, value in user_profile.items():
                user_data += f"{key}: {value}\n"
        print(f'RAW_IDEAS: {raw_ideas}')
        print(f'USER_PROFILE: {user_profile}')
        llm_prompt = LINKEDIN_IDEAS_PROMPT.format(
            user_data=user_data,
            raw_ideas=raw_ideas
        )


        # Call AI model for content ideas
        response = client.responses.create(
                model="gpt-5",
                input=llm_prompt
            )
            
        generated_ideas = response.output_text
        print(f"Generated ideas: {generated_ideas}")

        ideas = []
        if "Idea:" in generated_ideas:
            # Split by "**Idea:**" and clean up
            idea_parts = generated_ideas.split("Idea:")
            for part in idea_parts[1:]:  # Skip the first empty part
                idea = part.strip()
                if idea:
                    ideas.append(idea)
        else:
            # Fallback: split by double newlines or treat as single idea
            ideas = [generated_ideas] if generated_ideas else []
            
            # Ensure we have at least some ideas
            if not ideas:
                ideas = [
                    "Share a recent professional achievement or milestone",
                    "Reflect on a challenging project and what you learned",
                    "Ask your network for advice on career development",
                    "Share insights from a recent industry event or conference"
                ]
            
        print(f"Successfully generated {len(ideas)} AI-powered content ideas")
            
        return {
            'success': True,
            'ideas': ideas,
            'prompt_used': prompt or "No specific prompt provided",
            'ai_generated': True,
            'raw_ai_response': generated_ideas
        }
            
    except Exception as e:
        logger.error(f"Error in handle_generate_ideas: {str(e)}")
        return {
            'success': False,
            'error': 'Failed to generate ideas'
        }


def handle_research_selected_ideas(user_data: dict, selected_ideas: list, user_id: str) -> dict:
    """
    Handle research_selected_ideas operation
    """
    try:
        if not selected_ideas:
            return {
                'success': False,
                'error': 'No ideas selected for research'
            }
        
        # Generate a unique job ID for this research request
        import uuid
        job_id = str(uuid.uuid4())
        
        # Format user data for the prompt
        formatted_user_data = ''
        if user_data and user_data.get('name') != "Tom, Dick, And Harry":
            for key, value in user_data.items():
                if key != "linkedin_credentials":
                    formatted_user_data += f"{key}: {value}\n"
        
        # Format selected ideas for the prompt
        formatted_topics = '\n'.join([f"- {idea}" for idea in selected_ideas])
        
        # Create the research prompt using the template
        research_prompt = LINKEDIN_RESEARCH_PROMPT.format(
            topics=formatted_topics,
            user_data=formatted_user_data
        )
        
        print(f"Research prompt created for job {job_id}")
        print(f"Selected ideas: {selected_ideas}")
        
        response = client.responses.create(
            model="o4-mini-deep-research",
            input=input_text,                 # keep it concise; reference large docs by URL/file ID
            background=True,                  # run asynchronously
            metadata={"job_id": job_id, "user_id": user_id},
            webhook={"url": os.environ.get('OPENAI_WEBHOOK_URL'), "secret": os.environ.get('OPENAI_WEBHOOK_SECRET')},  # per-request webhook (if supported)
            tools=[
                {"type": "web_search_preview"},
                {"type": "code_interpreter", "container": {"type": "auto"}},
            ],
            extra_headers={"Idempotency-Key": os.environ.get('IDEM_KEY')},
        )

        return {
            'success': True,
            'job_id': job_id,
            'ideas_researched': selected_ideas,
            'research_summary': f"Researched {len(selected_ideas)} selected topics"
        }
        
    except Exception as e:
        logger.error(f"Error in handle_research_selected_ideas: {str(e)}")
        return {
            'success': False,
            'error': 'Failed to research selected ideas'
        }


def handle_get_research_result(user_id: str, job_id: str) -> dict:
    """
    Look up a previously stored research result by (user_id, job_id).
    Expected key schema: PK = f"USER#{user_id}", SK = f"RESEARCH#{job_id}"
    Returns:
      - { success: True, content: <string or object> } if found
      - { success: False } if not found or storage unavailable
    """
    try:
        if not _table:
            logger.error("DynamoDB table not configured for research lookup")
            return { 'success': False }

        response = _table.get_item(
            Key={
                'PK': f'USER#{user_id}',
                'SK': f'RESEARCH#{job_id}'
            }
        )
        item = response.get('Item')
        if not item:
            return { 'success': False }

        content = item.get('content') if isinstance(item, dict) else None
        return { 'success': True, 'content': content }
    except Exception as e:
        logger.error(f"Error in handle_get_research_result: {str(e)}")
        return { 'success': False }


def handle_synthesize_research(research_content, post_content, user_profile: dict) -> dict:
    """
    Handle synthesize_research operation.

    Combines prior research findings, any draft post content, and user profile
    context to synthesize a finished LinkedIn post using the OpenAI Responses API.

    Parameters may be strings or structured objects; structured inputs are
    converted to formatted JSON for inclusion in the prompt.
    """
    try:
        # Lazy import to avoid hard dependency until the prompt is created.
        try:
            # Expect the user to add this constant to prompts.py
            from prompts import SYNTHESIZE_RESEARCH_PROMPT as _SYNTH_PROMPT  # type: ignore
        except Exception:
            _SYNTH_PROMPT = (
                """
                You are an expert LinkedIn content strategist. Using the inputs below, synthesize a
                polished LinkedIn post that is specific, credible, and engaging for a professional audience.

                Inputs:
                - User Profile (structured):\n{user_data}\n
                - Research Content (notes, bullets, citations or structured findings):\n{research_content}\n
                - Draft Post Content (optional starting copy or outline):\n{post_content}\n
                Requirements:
                - Produce a single LinkedIn post in the user's voice.
                - Be concrete. Use specific insights/data from the research when available.
                - Keep it under 1800 characters. Use short paragraphs and whitespace for readability.
                - Include 1-3 thoughtful hashtags at the end only if they add value.
                - Do not include any preamble or commentary—output only the final post text.
                """
            )

        # Format user profile
        user_data = ''
        if isinstance(user_profile, dict) and user_profile.get('name') != "Tom, Dick, And Harry":
            for key, value in user_profile.items():
                if key != "linkedin_credentials":
                    user_data += f"{key}: {value}\n"

        # Normalize research and post content to strings
        def _normalize_content(value) -> str:
            if value is None:
                return ''
            if isinstance(value, (dict, list)):
                try:
                    return json.dumps(value, indent=2, ensure_ascii=False)
                except Exception:
                    return str(value)
            return str(value)

        research_text = _normalize_content(research_content)
        post_text = _normalize_content(post_content)

        llm_prompt = _SYNTH_PROMPT.format(
            user_data=user_data,
            research_content=research_text,
            post_content=post_text,
        )

        response = client.responses.create(
            model="gpt-5",
            input=llm_prompt,
        )

        generated_post = getattr(response, 'output_text', None) or ''

        if not generated_post:
            return {
                'success': False,
                'error': 'LLM returned empty content',
            }

        return {
            'success': True,
            'post': generated_post,
        }
    except Exception as e:
        logger.error(f"Error in handle_synthesize_research: {str(e)}")
        return {
            'success': False,
            'error': 'Failed to synthesize research into post',
        }


def lambda_handler(event, _context):
    try:
        if event.get('httpMethod') == 'OPTIONS':
            return _resp(200, { 'ok': True })

        body = _parse_body(event)
        user_id = _extract_user_id(event)
        print(f'BODY: {body}')
        if not user_id:
            return _resp(401, { 'error': 'Unauthorized: Missing or invalid JWT token' })

        # Extract operation from request body
        operation = body.get('operation')
        print(f'OPERATION: {operation}')
        if not operation:
            return _resp(400, { 'error': 'Missing required field: operation' })

        # Route to appropriate handler based on operation
        if operation == 'generate_ideas':
            prompt = body.get('prompt', None)
            profile = body.get('user_profile', None)
            result = handle_generate_ideas(profile, prompt)
            return _resp(200, result)
        elif operation == 'research_selected_ideas':
            selected_ideas = body.get('selected_ideas', [])
            profile = body.get('user_profile', None)
            result = handle_research_selected_ideas(profile, selected_ideas, user_id)
            return _resp(200, result)
        elif operation == 'get_research_result':
            job_id = body.get('job_id')
            if not job_id:
                return _resp(400, { 'error': 'Missing required field: job_id' })
            result = handle_get_research_result(user_id, job_id)
            return _resp(200, result)
        elif operation == 'synthesize_research':
            research_content = body.get('research_content', None)
            post_content = body.get('post_content', None)
            profile = body.get('user_profile', {})
            result = handle_synthesize_research(research_content, post_content, profile)
            return _resp(200, result)
        else:
            return _resp(400, { 'error': f'Unsupported operation: {operation}' })

    except Exception as e:
        logger.error(f"Unexpected error in lambda_handler: {str(e)}")
        return _resp(500, { 'error': 'Internal server error' })


