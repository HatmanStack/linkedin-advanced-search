"""
LinkedIn Edge Management Lambda Function

Thin handler that delegates business logic to EdgeService.
Routes operations and handles HTTP response formatting.
"""

import json
import logging
import os
import sys
from pathlib import Path

import boto3

# Add paths for imports
LAMBDA_PATH = Path(__file__).parent
SHARED_PATH = LAMBDA_PATH.parent / 'shared' / 'python'
sys.path.insert(0, str(SHARED_PATH))
sys.path.insert(0, str(LAMBDA_PATH))

from errors.exceptions import (
    AuthorizationError,
    ExternalServiceError,
    NotFoundError,
    ServiceError,
    ValidationError,
)
from services.edge_service import EdgeService

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Common API response headers
API_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
}

# Configuration
DYNAMODB_TABLE_NAME = os.environ.get('DYNAMODB_TABLE_NAME', 'linkedin-advanced-search')
RAGSTACK_PROXY_FUNCTION = os.environ.get('RAGSTACK_PROXY_FUNCTION', '')

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(DYNAMODB_TABLE_NAME)
lambda_client = boto3.client('lambda')


def _resp(status_code: int, body_dict: dict) -> dict:
    """Build HTTP response."""
    return {
        'statusCode': status_code,
        'headers': API_HEADERS,
        'body': json.dumps(body_dict)
    }


def _parse_body(event: dict) -> dict:
    """Parse request body from event."""
    if 'body' in event:
        body_raw = event['body']
        if isinstance(body_raw, str):
            try:
                return json.loads(body_raw)
            except Exception:
                return {}
        return body_raw or {}
    return event or {}


def _extract_user_id(event: dict) -> str | None:
    """Extract user ID from Cognito JWT claims."""
    sub = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub')
    if sub:
        return sub

    # Development mode fallback
    dev_mode = os.environ.get('DEV_MODE', 'false').lower() == 'true'
    if dev_mode:
        auth_header = event.get('headers', {}).get('Authorization', '') or event.get('headers', {}).get('authorization', '')
        if auth_header:
            logger.warning("DEV_MODE: Authorization header present but no Cognito claims")
            return 'test-user-development'
        logger.warning("DEV_MODE: No authentication found, using default test user")
        return 'test-user-development'

    logger.error("No authentication found and DEV_MODE is not enabled")
    return None


def lambda_handler(event, context):
    """
    AWS Lambda handler for edge management operations.

    Routes requests to EdgeService and handles response formatting.
    """
    try:
        logger.info(f"Received event: {json.dumps(event)[:2000]}")

        body = _parse_body(event)
        profile_id = body.get('profileId')
        operation = body.get('operation')
        updates = body.get('updates', {})

        # Extract user ID from JWT token
        user_id = _extract_user_id(event)
        if not user_id:
            return _resp(401, {'error': 'Unauthorized: Missing or invalid JWT token'})

        # Create service instance with injected dependencies
        service = EdgeService(
            table=table,
            lambda_client=lambda_client,
            ragstack_function_name=RAGSTACK_PROXY_FUNCTION or None
        )

        # Route to appropriate operation
        if operation == 'get_connections_by_status':
            result = service.get_connections_by_status(user_id, updates.get('status'))
            return _resp(200, {
                'message': 'Connections fetched successfully',
                'connections': result.get('connections', []),
                'count': result.get('count', 0)
            })

        elif operation == 'upsert_status':
            if not profile_id:
                return _resp(400, {'error': 'profileId is required'})
            result = service.upsert_status(
                user_id=user_id,
                profile_id=profile_id,
                status=updates.get('status', 'pending'),
                added_at=updates.get('addedAt'),
                messages=updates.get('messages')
            )
            return _resp(200, {
                'message': 'Edge upserted successfully',
                'result': result
            })

        elif operation == 'add_message':
            if not profile_id:
                return _resp(400, {'error': 'profileId is required'})
            result = service.add_message(
                user_id=user_id,
                profile_id_b64=profile_id,
                message=updates.get('message', ''),
                message_type=updates.get('messageType', 'outbound')
            )
            return _resp(200, {
                'message': 'Message added successfully',
                'result': result
            })

        elif operation == 'get_messages':
            if not profile_id:
                return _resp(400, {'error': 'profileId is required'})
            result = service.get_messages(user_id, profile_id)
            return _resp(200, {
                'messages': result.get('messages', []),
                'count': result.get('count', 0)
            })

        elif operation == 'check_exists':
            if not profile_id:
                return _resp(400, {'error': 'profileId is required'})
            result = service.check_exists(user_id, profile_id)
            return _resp(200, result)

        else:
            return _resp(400, {
                'error': f'Unsupported operation: {operation}',
                'supported_operations': [
                    'upsert_status', 'add_message', 'check_exists',
                    'get_connections_by_status', 'get_messages'
                ]
            })

    except ValidationError as e:
        logger.warning(f"Validation error: {e}")
        return _resp(400, {'error': e.message, 'code': e.code})

    except NotFoundError as e:
        logger.warning(f"Not found: {e}")
        return _resp(404, {'error': e.message, 'code': e.code})

    except AuthorizationError as e:
        logger.warning(f"Authorization error: {e}")
        return _resp(403, {'error': e.message, 'code': e.code})

    except ExternalServiceError as e:
        logger.error(f"External service error: {e}")
        return _resp(502, {'error': e.message, 'code': e.code})

    except ServiceError as e:
        logger.error(f"Service error: {e}")
        return _resp(500, {'error': e.message, 'code': e.code})

    except Exception as e:
        logger.error(f"Unexpected error in lambda_handler: {str(e)}")
        return _resp(500, {'error': 'Internal server error'})
