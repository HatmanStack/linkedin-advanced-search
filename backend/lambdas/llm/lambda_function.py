"""
LLM Endpoint Lambda Function

Thin handler that delegates business logic to LLMService.
Handles AI-powered content generation via OpenAI and Bedrock.
"""

import json
import logging
import os
import sys
from pathlib import Path

import boto3
from openai import OpenAI

# Add paths for imports
LAMBDA_PATH = Path(__file__).parent
SHARED_PATH = LAMBDA_PATH.parent / 'shared' / 'python'
sys.path.insert(0, str(SHARED_PATH))
sys.path.insert(0, str(LAMBDA_PATH))

from services.llm_service import LLMService

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# API Headers
API_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,x-requested-with',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Expose-Headers': 'Content-Type,Authorization'
}

# Configuration
DYNAMODB_TABLE_NAME = os.environ.get('DYNAMODB_TABLE_NAME')
BEDROCK_MODEL_ID = os.environ.get('BEDROCK_MODEL_ID')

# Initialize clients
openai_client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'), timeout=60)
bedrock_client = boto3.client('bedrock-runtime')

# DynamoDB table (optional)
try:
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(DYNAMODB_TABLE_NAME) if DYNAMODB_TABLE_NAME else None
except Exception:
    table = None

# Valid operations
VALID_OPERATIONS = ['generate_ideas', 'research_selected_ideas', 'get_research_result', 'synthesize_research', 'post_style_change']


def _resp(status_code: int, body_dict: dict) -> dict:
    """Build HTTP response."""
    return {
        'statusCode': status_code,
        'headers': API_HEADERS,
        'body': json.dumps(body_dict)
    }


def _parse_body(event: dict) -> dict:
    """Parse request body from event."""
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
    """Extract user ID from JWT claims."""
    sub = (
        event.get('requestContext', {})
        .get('authorizer', {})
        .get('claims', {})
        .get('sub')
    )
    if sub:
        return sub

    # Development fallback
    auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization')
    if auth_header:
        return 'test-user-id'
    return None


def lambda_handler(event, _context):
    """
    AWS Lambda handler for LLM operations.

    Routes requests to LLMService and handles response formatting.
    """
    try:
        # Handle CORS preflight
        if event.get('httpMethod') == 'OPTIONS':
            return _resp(200, {'ok': True})

        body = _parse_body(event)
        user_id = _extract_user_id(event)

        if not user_id:
            return _resp(401, {'error': 'Unauthorized: Missing or invalid JWT token'})

        operation = body.get('operation')
        if not operation:
            return _resp(400, {'error': 'Missing required field: operation'})

        if operation not in VALID_OPERATIONS:
            logger.warning(f'Invalid operation: {operation}')
            return _resp(400, {'error': 'Invalid operation'})

        logger.info(f'Processing: operation={operation}, user_id={user_id}')

        # Create service with injected dependencies
        service = LLMService(
            openai_client=openai_client,
            bedrock_client=bedrock_client,
            table=table,
            bedrock_model_id=BEDROCK_MODEL_ID
        )

        # Route to appropriate operation
        if operation == 'generate_ideas':
            job_id = body.get('job_id')
            if not job_id:
                return _resp(400, {'error': 'Missing required field: job_id'})
            result = service.generate_ideas(
                user_profile=body.get('user_profile'),
                prompt=body.get('prompt', ''),
                job_id=job_id,
                user_id=user_id
            )
            return _resp(200, result)

        elif operation == 'research_selected_ideas':
            result = service.research_selected_ideas(
                user_data=body.get('user_profile', {}),
                selected_ideas=body.get('selected_ideas', []),
                user_id=user_id
            )
            return _resp(200, result)

        elif operation == 'get_research_result':
            job_id = body.get('job_id')
            if not job_id:
                return _resp(400, {'error': 'Missing required field: job_id'})
            result = service.get_research_result(
                user_id=user_id,
                job_id=job_id,
                kind=body.get('kind')
            )
            return _resp(200, result)

        elif operation == 'synthesize_research':
            job_id = body.get('job_id')
            if not job_id:
                return _resp(400, {'error': 'Missing required field: job_id'})
            result = service.synthesize_research(
                research_content=body.get('research_content'),
                post_content=body.get('existing_content'),
                ideas_content=body.get('selected_ideas', []),
                user_profile=body.get('user_profile', {}),
                job_id=job_id,
                user_id=user_id
            )
            return _resp(200, result)

        elif operation == 'post_style_change':
            result = service.apply_style(
                existing_content=body.get('existing_content', ''),
                style=body.get('style', '')
            )
            return _resp(200, result)

        else:
            return _resp(400, {'error': f'Unsupported operation: {operation}'})

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return _resp(500, {'error': 'Internal server error'})
