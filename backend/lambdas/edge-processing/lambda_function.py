"""LinkedIn Edge Management Lambda - Routes operations to EdgeService."""
import json
import logging
import os

import boto3
from errors.exceptions import AuthorizationError, ExternalServiceError, NotFoundError, ServiceError, ValidationError
from services.edge_service import EdgeService

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Configuration and clients
table = boto3.resource('dynamodb').Table(os.environ.get('DYNAMODB_TABLE_NAME', 'linkedin-advanced-search'))
lambda_client = boto3.client('lambda')
RAGSTACK_FUNCTION = os.environ.get('RAGSTACK_PROXY_FUNCTION', '') or None

HEADERS = {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*',
           'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Allow-Methods': 'POST,OPTIONS'}


def _sanitize_request_context(request_context):
    """Remove sensitive fields from requestContext before logging."""
    if not request_context:
        return {}
    sanitized = {}
    sensitive_keys = {'authorizer', 'authorization'}
    for key, value in request_context.items():
        if key.lower() in sensitive_keys:
            sanitized[key] = '[REDACTED]'
        elif isinstance(value, dict):
            sanitized[key] = {
                k: '[REDACTED]' if any(s in k.lower() for s in ('token', 'authorization', 'claim', 'secret', 'credential')) else v
                for k, v in value.items()
            }
        else:
            sanitized[key] = value
    return sanitized


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
    if os.environ.get('DEV_MODE', '').lower() == 'true':
        return 'test-user-development'
    return None


def lambda_handler(event, context):
    """Route edge operations to EdgeService."""
    # Debug logging
    logger.info(f"Event keys: {list(event.keys())}")
    logger.info(f"Request context: {json.dumps(_sanitize_request_context(event.get('requestContext', {})), default=str)}")

    # Handle CORS preflight
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return _resp(200, {'message': 'OK'})

    try:
        body = json.loads(event.get('body', '{}')) if isinstance(event.get('body'), str) else event.get('body') or event or {}
        user_id = _get_user_id(event)
        logger.info(f"Extracted user_id: {user_id}")
        if not user_id:
            return _resp(401, {'error': 'Unauthorized'})

        op, pid, updates = body.get('operation'), body.get('profileId'), body.get('updates', {})
        svc = EdgeService(table=table, lambda_client=lambda_client, ragstack_function_name=RAGSTACK_FUNCTION)

        if op == 'get_connections_by_status':
            r = svc.get_connections_by_status(user_id, updates.get('status'))
            return _resp(200, {'connections': r.get('connections', []), 'count': r.get('count', 0)})
        if op == 'upsert_status':
            if not pid:
                return _resp(400, {'error': 'profileId required'})
            return _resp(200, {'result': svc.upsert_status(user_id, pid, updates.get('status', 'pending'), updates.get('addedAt'), updates.get('messages'))})
        if op == 'add_message':
            if not pid:
                return _resp(400, {'error': 'profileId required'})
            return _resp(200, {'result': svc.add_message(user_id, pid, updates.get('message', ''), updates.get('messageType', 'outbound'))})
        if op == 'get_messages':
            if not pid:
                return _resp(400, {'error': 'profileId required'})
            r = svc.get_messages(user_id, pid)
            return _resp(200, {'messages': r.get('messages', []), 'count': r.get('count', 0)})
        if op == 'check_exists':
            if not pid:
                return _resp(400, {'error': 'profileId required'})
            return _resp(200, svc.check_exists(user_id, pid))
        return _resp(400, {'error': f'Unsupported operation: {op}'})

    except ValidationError as e:
        return _resp(400, {'error': e.message})
    except NotFoundError as e:
        return _resp(404, {'error': e.message})
    except AuthorizationError as e:
        return _resp(403, {'error': e.message})
    except ExternalServiceError as e:
        return _resp(502, {'error': e.message})
    except ServiceError as e:
        return _resp(500, {'error': e.message})
    except Exception as e:
        logger.error(f"Error: {e}")
        return _resp(500, {'error': 'Internal server error'})
