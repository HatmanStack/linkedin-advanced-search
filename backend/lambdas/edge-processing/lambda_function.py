"""LinkedIn Edge Management Lambda - Routes edge and RAGStack operations."""
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
RAGSTACK_GRAPHQL_ENDPOINT = os.environ.get('RAGSTACK_GRAPHQL_ENDPOINT', '')
RAGSTACK_API_KEY = os.environ.get('RAGSTACK_API_KEY', '')

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


def _handle_ragstack(body, user_id):
    """Handle /ragstack route - search and ingest operations."""
    if not RAGSTACK_GRAPHQL_ENDPOINT or not RAGSTACK_API_KEY:
        return _resp(503, {'error': 'RAGStack not configured'})

    operation = body.get('operation')

    if operation == 'search':
        from shared_services.ragstack_client import RAGStackClient
        client = RAGStackClient(RAGSTACK_GRAPHQL_ENDPOINT, RAGSTACK_API_KEY)
        query = body.get('query', '')
        if not query:
            return _resp(400, {'error': 'query is required'})
        try:
            max_results = min(int(body.get('maxResults', 100)), 200)
        except (TypeError, ValueError):
            return _resp(400, {'error': 'maxResults must be a number'})
        results = client.search(query, max_results)
        return _resp(200, {'results': results, 'totalResults': len(results)})

    elif operation == 'ingest':
        from shared_services.ingestion_service import IngestionService
        from shared_services.ragstack_client import RAGStackClient
        client = RAGStackClient(RAGSTACK_GRAPHQL_ENDPOINT, RAGSTACK_API_KEY)
        svc = IngestionService(client)
        profile_id = body.get('profileId')
        markdown_content = body.get('markdownContent')
        metadata = body.get('metadata') or {}
        if not isinstance(metadata, dict):
            return _resp(400, {'error': 'metadata must be an object'})
        if not profile_id:
            return _resp(400, {'error': 'profileId is required'})
        if not markdown_content:
            return _resp(400, {'error': 'markdownContent is required'})
        metadata['user_id'] = user_id
        result = svc.ingest_profile(profile_id, markdown_content, metadata)
        return _resp(200, result)

    elif operation == 'status':
        from shared_services.ragstack_client import RAGStackClient
        client = RAGStackClient(RAGSTACK_GRAPHQL_ENDPOINT, RAGSTACK_API_KEY)
        document_id = body.get('documentId')
        if not document_id:
            return _resp(400, {'error': 'documentId is required'})
        status = client.get_document_status(document_id)
        return _resp(200, status)

    else:
        return _resp(400, {'error': f'Unsupported ragstack operation: {operation}'})


def lambda_handler(event, context):
    """Route edge operations to EdgeService."""
    from shared_services.observability import setup_correlation_context
    setup_correlation_context(event, context)

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

        # Determine route
        raw_path = event.get('rawPath', '') or event.get('path', '')
        if '/ragstack' in raw_path:
            return _handle_ragstack(body, user_id)

        op, pid, updates = body.get('operation'), body.get('profileId'), body.get('updates', {})
        svc = EdgeService(table=table, ragstack_endpoint=RAGSTACK_GRAPHQL_ENDPOINT, ragstack_api_key=RAGSTACK_API_KEY)

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
