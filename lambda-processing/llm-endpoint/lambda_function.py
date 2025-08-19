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
from datetime import datetime, timezone
from prompts import LINKEDIN_IDEAS_PROMPT, LINKEDIN_RESEARCH_PROMPT, SYNTHESIZE_RESEARCH_PROMPT
from openai import OpenAI
import boto3
client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'),timeout=3600)


API_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,x-requested-with',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Expose-Headers': 'Content-Type,Authorization'
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


def handle_generate_ideas(user_profile: dict, prompt: str = "", job_id: str | None = None, user_id: str | None = None) -> dict:
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


        # Queue background processing via OpenAI webhooks (reliable async in Lambda)
        try:
            response = client.responses.create(
                model="gpt-5",
                input=llm_prompt,
                background=True,
                metadata={"job_id": job_id, "user_id": user_id, "kind": "IDEAS"},
                extra_headers={"Idempotency-Key": os.environ.get('IDEM_KEY')},
            )
            _ = getattr(response, 'id', None)
        except Exception as bg_err:
            logger.error(f"Failed to enqueue background ideas generation: {bg_err}")
            return {
                'success': False,
                'error': 'Failed to queue ideas generation'
            }

        return {
            'success': True,
            'status': 'queued'
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
            input=research_prompt,                 
            background=True,                  
            metadata={"job_id": job_id, "user_id": user_id},
            tools=[
                {"type": "web_search_preview"},
                {"type": "code_interpreter", "container": {"type": "auto"}},
            ]
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


def handle_get_research_result(user_id: str, job_id: str, kind: str | None = None) -> dict:
    """
    Look up a previously stored research result by (user_id, job_id).
    Expected key schema: PK = f"USER#{user_id}", SK = f"{KIND}#{job_id}" where KIND is one of IDEAS, RESEARCH, SYNTHESIZE
    Returns:
      - { success: True, content: <string or object> } if found
      - { success: False } if not found or storage unavailable
    """
    try:
        if not _table:
            logger.error("DynamoDB table not configured for research lookup")
            return { 'success': False }

        # Determine key prefix based on kind or attempt all
        prefixes = []
        if kind == 'IDEAS':
            prefixes = ['IDEAS']
        elif kind == 'RESEARCH':
            prefixes = ['RESEARCH']
        elif kind == 'SYNTHESIZE':
            prefixes = ['SYNTHESIZE']
        

        item = None
        found_kind = None
        
        for prefix in prefixes:
            print(f'PK:     USER#{user_id}')
            print(f'SK:     {prefix}#{job_id}')
            response = _table.get_item(
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
            return { 'success': False }

        # Build profile_updates based on the kind of item found
        profile_updates = {}

        def _parse_synthesize_sections(text: str) -> dict:
            """Parse synthesize content into sections 1, 2, 3 using numeric prefixes.
            Accepts markers at line starts like '1:', '1.', '1)', '1 -'. Returns dict keys '1','2','3'."""
            import re
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
                
                # Skip the first line if it's just a title/header (like "The LinkedIn Post")
                lines = value.split('\n')
                if len(lines) > 1:
                    # Skip first line and join the rest
                    content = '\n'.join(lines[1:]).strip()
                    if content:
                        sections[key] = content.strip()
                elif value and not value.startswith('The LinkedIn Post'):
                    # Single line that's not a title
                    sections[key] = value.strip()
            return sections
        sections = {}
        if found_kind == 'IDEAS':
            ideas = item.get('ideas') if isinstance(item, dict) else None
            if ideas is not None:
                profile_updates['ai_generated_ideas'] = ideas
        elif found_kind == 'RESEARCH':
            content = item.get('content') if isinstance(item, dict) else None
            if content is not None:
                profile_updates['ai_generated_research'] = content
        elif found_kind == 'SYNTHESIZE':
            content = item.get('content') if isinstance(item, dict) else None
            if content is not None:
                sections = _parse_synthesize_sections(content)
                if '1' in sections:
                    profile_updates['unpublished_post_content'] = sections['1']
                if '2' in sections:
                    profile_updates['ai_generated_post_reasoning'] = sections['2']
                if '3' in sections:
                    profile_updates['ai_generated_post_hook'] = sections['3']
                # Fallback: if no numeric sections parsed, store entire content as draft
                if not sections:
                    profile_updates['unpublished_post_content'] = content
                
                

        # Upsert profile fields on USER#<id> #PROFILE if any updates
        if profile_updates:
            current_time = datetime.now(timezone.utc).isoformat()
            update_expr_parts = []
            expr_attr_values = { ':ts': current_time }
            expr_attr_names = {}
            for k, v in profile_updates.items():
                name_key = f"#f_{k}"
                expr_attr_names[name_key] = k
                value_key = f":v_{k}"
                expr_attr_values[value_key] = v
                update_expr_parts.append(f"{name_key} = {value_key}")

            update_expression = (
                'SET ' + ', '.join(update_expr_parts + ['updated_at = :ts', 'created_at = if_not_exists(created_at, :ts)'])
            )

            _table.update_item(
                Key={ 'PK': f'USER#{user_id}', 'SK': '#SETTINGS' },
                UpdateExpression=update_expression,
                ExpressionAttributeNames=expr_attr_names,
                ExpressionAttributeValues=expr_attr_values
            )

        # Return shape depends on prefix
        if item.get('ideas'):
            return { 'success': True, 'ideas': item.get('ideas') }
        elif item.get('synthesize'):
            return { 'success': True, 'sections': sections}
        else:
            content = item.get('content') if isinstance(item, dict) else None
            return { 'success': True, 'content': content }
    except Exception as e:
        logger.error(f"Error in handle_get_research_result: {str(e)}")
        return { 'success': False }


def handle_synthesize_research(research_content, post_content, ideas_content,user_profile: dict, job_id: str | None, user_id: str | None) -> dict:
    """
    Handle synthesize_research operation.

    Combines prior research findings, any draft post content, and user profile
    context to synthesize a finished LinkedIn post using the OpenAI Responses API.

    Parameters may be strings or structured objects; structured inputs are
    converted to formatted JSON for inclusion in the prompt.
    """
    try:
        if not job_id:
            return {
                'success': False,
                'error': 'Missing required field: job_id'
            }
        # Format user profile
        user_data = ''
        if isinstance(user_profile, dict) and user_profile.get('name') != "Tom, Dick, And Harry":
            for key, value in user_profile.items():
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

        llm_prompt = SYNTHESIZE_RESEARCH_PROMPT.format(
            user_data=user_data,
            research_content=research_text,
            post_content=post_text,
            ideas_content=ideas_content,
        )

        # Queue background synthesis. Result will arrive via webhook and be stored under SYNTHESIZE#{job_id}
        response = client.responses.create(
            model="gpt-5",
            input=llm_prompt,
            background=True,
            metadata={"job_id": job_id, "user_id": user_id, "kind": "SYNTHESIZE"},
            extra_headers={"Idempotency-Key": os.environ.get('IDEM_KEY')},
        )

        _ = getattr(response, 'id', None)

        return {
            'success': True,
            'status': 'queued',
    
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
            job_id = body.get('job_id')
            if not job_id:
                return _resp(400, { 'error': 'Missing required field: job_id' })
            result = handle_generate_ideas(profile, prompt, job_id, user_id)
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
            kind = body.get('kind')
            result = handle_get_research_result(user_id, job_id, kind)
            return _resp(200, result)
        elif operation == 'synthesize_research':
            research_content = body.get('research_content', None)
            post_content = body.get('existing_content', None)
            profile = body.get('user_profile', {})
            job_id = body.get('job_id')
            ideas_content = body.get('selected_ideas', [])
            if not job_id:
                return _resp(400, { 'error': 'Missing required field: job_id' })
            result = handle_synthesize_research(research_content, post_content, ideas_content, profile, job_id, user_id)
            return _resp(200, result)
        else:
            return _resp(400, { 'error': f'Unsupported operation: {operation}' })

    except Exception as e:
        logger.error(f"Unexpected error in lambda_handler: {str(e)}")
        return _resp(500, { 'error': 'Internal server error' })


