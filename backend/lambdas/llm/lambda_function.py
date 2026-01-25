"""LLM Endpoint Lambda - Routes AI operations to LLMService."""
import json
import logging
import os

import boto3
from openai import OpenAI

# Local service import
from services.llm_service import LLMService

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Clients
openai_client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'), timeout=60)
bedrock_client = boto3.client('bedrock-runtime')
table_name = os.environ.get('DYNAMODB_TABLE_NAME')
table = boto3.resource('dynamodb').Table(table_name) if table_name else None

HEADERS = {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*',
           'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Allow-Methods': 'POST,OPTIONS'}
OPS = {'generate_ideas', 'research_selected_ideas', 'get_research_result', 'synthesize_research'}


def _resp(code, body):
    return {'statusCode': code, 'headers': HEADERS, 'body': json.dumps(body)}


def _get_user_id(event):
    # HTTP API v2 JWT authorizer path
    sub = event.get('requestContext', {}).get('authorizer', {}).get('jwt', {}).get('claims', {}).get('sub')
    if sub:
        return sub
    # Fallback for REST API path
    sub = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub')
    if sub:
        return sub
    return None


def lambda_handler(event, _context):
    """Route LLM operations to LLMService."""
    try:
        from shared_services.observability import setup_correlation_context
        setup_correlation_context(event, _context)
        method = event.get('requestContext', {}).get('http', {}).get('method', '')
        if method == 'OPTIONS' or event.get('httpMethod') == 'OPTIONS':
            return _resp(200, {'ok': True})

        body = json.loads(event.get('body', '{}')) if isinstance(event.get('body'), str) else event.get('body') or {}
        user_id = _get_user_id(event)
        if not user_id:
            return _resp(401, {'error': 'Unauthorized'})

        op = body.get('operation')
        if not op or op not in OPS:
            return _resp(400, {'error': 'Invalid operation'})

        svc = LLMService(openai_client=openai_client, bedrock_client=bedrock_client, table=table)

        if op == 'generate_ideas':
            if not body.get('job_id'):
                return _resp(400, {'error': 'job_id required'})
            return _resp(200, svc.generate_ideas(body.get('user_profile'), body.get('prompt', ''), body['job_id'], user_id))

        if op == 'research_selected_ideas':
            return _resp(200, svc.research_selected_ideas(body.get('user_profile', {}), body.get('selected_ideas', []), user_id))

        if op == 'get_research_result':
            if not body.get('job_id'):
                return _resp(400, {'error': 'job_id required'})
            return _resp(200, svc.get_research_result(user_id, body['job_id'], body.get('kind')))

        if op == 'synthesize_research':
            if not body.get('job_id'):
                return _resp(400, {'error': 'job_id required'})
            return _resp(200, svc.synthesize_research(body.get('research_content'), body.get('existing_content'),
                                                       body.get('selected_ideas', []), body.get('user_profile', {}), body['job_id'], user_id))

        return _resp(400, {'error': f'Unsupported: {op}'})

    except Exception as e:
        logger.error(f"Error: {e}")
        return _resp(500, {'error': 'Internal server error'})
