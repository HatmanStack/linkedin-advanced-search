import base64
import json
import logging
import os
from datetime import UTC, datetime
from typing import Any

import boto3
from botocore.exceptions import ClientError

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients at module level (outside handler) for Lambda best practice:
# This allows connection reuse across warm invocations, reducing cold start latency.
# See: https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html
dynamodb = boto3.resource('dynamodb')

# Environment variables
TABLE_NAME = os.environ['DYNAMODB_TABLE_NAME']
COGNITO_USER_POOL_ID = os.environ['COGNITO_USER_POOL_ID']
COGNITO_REGION = os.environ.get('COGNITO_REGION', 'us-west-2')

table = dynamodb.Table(TABLE_NAME)

# CORS configuration
ALLOWED_ORIGINS_ENV = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:5173')
ALLOWED_ORIGINS = [o.strip() for o in ALLOWED_ORIGINS_ENV.split(',') if o.strip()]

def _get_origin_from_event(event: dict[str, Any]) -> str | None:
    headers = event.get('headers') or {}
    origin = headers.get('origin') or headers.get('Origin')
    return origin

def preflight_response(event: dict[str, Any]) -> dict[str, Any]:
    """Return a proper CORS preflight (OPTIONS) response without requiring auth."""
    origin = _get_origin_from_event(event)
    allow_origin = origin if origin in ALLOWED_ORIGINS else (ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else '*')
    return {
        'statusCode': 204,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': allow_origin,
            'Vary': 'Origin',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        'body': ''
    }

def _extract_user_id(event: dict[str, Any]) -> str | None:
    """Extract user ID from Cognito JWT claims. Handles both HTTP API v2 and REST API formats."""
    rc = event.get('requestContext') or {}
    auth = rc.get('authorizer') or {}
    # HTTP API v2 JWT authorizer: authorizer.jwt.claims.sub
    jwt_claims = (auth.get('jwt') or {}).get('claims') or {}
    if jwt_claims.get('sub'):
        return jwt_claims['sub']
    # REST API authorizer: authorizer.claims.sub
    rest_claims = auth.get('claims') or {}
    if rest_claims.get('sub'):
        return rest_claims['sub']
    return None


def lambda_handler(event: dict[str, Any], context) -> dict[str, Any]:
    """Main Lambda handler for DynamoDB API operations.
    Handles both /dynamodb and /profiles routes.
    Supports:
      - User settings (e.g., linkedin_credentials) via HTTP GET/PUT or operation-based calls
      - User profile CRUD via /profiles endpoint
      - Existing profile operations (get_details, create) using operation-based calls
    """
    try:
        # Avoid logging the entire event to prevent accidental secret exposure
        logger.info("Received request")

        # Determine HTTP method if present (HTTP API v2 or REST API)
        http_method = (event.get('httpMethod')
                       or event.get('requestContext', {}).get('http', {}).get('method')
                       or '').upper()

        # Handle CORS preflight without requiring auth
        if http_method == 'OPTIONS':
            return preflight_response(event)

        # Determine route path
        raw_path = event.get('rawPath', '') or event.get('path', '')
        is_profiles_route = '/profiles' in raw_path

        # Extract user ID from JWT
        user_id = _extract_user_id(event)

        # Route to profiles handler if /profiles path
        if is_profiles_route:
            return handle_profiles_route(event, http_method, user_id)

        # --- /dynamodb route handling ---
        if http_method == 'GET':
            # Extract optional profileId from query string, handling null queryStringParameters safely
            profile_id = (event.get('queryStringParameters') or {}).get('profileId')
            if profile_id:
                # Backend stores profile keys base64-encoded; encode incoming raw ID
                profile_id_b64 = base64.urlsafe_b64encode(profile_id.encode()).decode()
                item = get_profile_metadata(profile_id_b64)
                if not item:
                    return create_response(200, {'message': 'Profile not found', 'profile': None})
                return create_response(200, {'profile': item})

            # No profileId provided, return combined user profile for the authenticated user
            if not user_id:
                logger.error("No user ID found in JWT token for profile GET")
                return create_response(401, {'error': 'Unauthorized: Missing or invalid JWT token'}, _get_origin_from_event(event))

            return get_user_settings(user_id)

        # Parse request body (if any)
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        operation = body.get('operation')

        # Dispatch by operation
        if operation == 'create':
            return create_bad_contact_profile(user_id, body)
        elif operation == 'update_user_settings':
            return update_user_settings(user_id, body)
        else:
            return create_response(400, {
                'error': f'Unsupported operation: {operation}',
                'supported_operations': [
                    'create', 'get_details', 'get_user_settings', 'update_user_settings', 'update_user_profile'
                ]
            }, _get_origin_from_event(event))

    except Exception as e:
        # Intentionally catch broad Exception as top-level handler for Lambda.
        # Specific exceptions (ClientError, ValidationError) are caught in individual functions.
        # This ensures malformed requests don't crash the Lambda and always return valid HTTP.
        logger.error(f"Error processing request: {str(e)}")
        return create_response(500, {'error': 'Internal server error'})


def handle_profiles_route(event: dict[str, Any], http_method: str, user_id: str | None) -> dict[str, Any]:
    """Handle /profiles route - user profile CRUD.
    Reads from #SETTINGS with fallback to legacy PROFILE SK for backwards compatibility.
    Writes always go to #SETTINGS (natural migration).
    """
    if not user_id:
        return create_response(401, {'error': 'Authentication required'})

    if http_method == 'GET':
        return get_user_profile(user_id)
    elif http_method == 'POST':
        return update_user_profile(event, user_id)
    else:
        return create_response(405, {'error': f'Method {http_method} not allowed'})


def get_user_profile(user_id: str) -> dict[str, Any]:
    """GET /profiles - Fetch user profile.
    Reads from #SETTINGS first, falls back to legacy PROFILE SK.
    Returns profile-api compatible response format.
    """
    try:
        # Read from the canonical SETTINGS sort key first
        response = table.get_item(
            Key={'PK': f'USER#{user_id}', 'SK': '#SETTINGS'}
        )
        item = response.get('Item')

        # Fallback to legacy PROFILE SK if #SETTINGS doesn't exist
        if not item:
            response = table.get_item(
                Key={'PK': f'USER#{user_id}', 'SK': 'PROFILE'}
            )
            item = response.get('Item')

        if not item:
            # Return default profile structure
            now = datetime.now(UTC).isoformat()
            return create_response(200, {'success': True, 'data': {
                'userId': user_id,
                'email': '',
                'firstName': '',
                'lastName': '',
                'linkedin_credentials': None,
                'createdAt': now,
                'updatedAt': now
            }})

        # Build profile response (support both camelCase and snake_case field names)
        profile = {
            'userId': user_id,
            'email': item.get('email', ''),
            'firstName': item.get('firstName', item.get('first_name', '')),
            'lastName': item.get('lastName', item.get('last_name', '')),
            'headline': item.get('headline', ''),
            'location': item.get('location', ''),
            'company': item.get('company', ''),
            'current_position': item.get('current_position', ''),
            'summary': item.get('summary', ''),
            'interests': item.get('interests', ''),
            'linkedin_credentials': item.get('linkedin_credentials'),
            'unpublished_post_content': item.get('unpublished_post_content', ''),
            'ai_generated_ideas': item.get('ai_generated_ideas'),
            'ai_generated_research': item.get('ai_generated_research'),
            'ai_generated_post_hook': item.get('ai_generated_post_hook', ''),
            'ai_generated_post_reasoning': item.get('ai_generated_post_reasoning', ''),
            'createdAt': item.get('createdAt', item.get('created_at', '')),
            'updatedAt': item.get('updatedAt', item.get('updated_at', ''))
        }

        return create_response(200, {'success': True, 'data': profile})

    except ClientError:
        logger.exception("DynamoDB error in get_user_profile")
        return create_response(500, {'error': 'Database error'})


def update_user_profile(event: dict[str, Any], user_id: str) -> dict[str, Any]:
    """POST /profiles - Update user profile.
    Supports operation: update_user_settings (default).
    Writes to #SETTINGS SK (consolidated location).
    """
    try:
        raw_body = event.get('body', '{}')
        if isinstance(raw_body, str):
            body = json.loads(raw_body or '{}')
        elif raw_body is None:
            body = {}
        else:
            body = raw_body

        operation = body.get('operation', 'update_user_settings')
        if operation != 'update_user_settings':
            return create_response(400, {'error': f'Unsupported operation: {operation}'})

        # Delegate to existing update_user_settings which writes to #SETTINGS
        return update_user_settings(user_id, body)

    except json.JSONDecodeError:
        return create_response(400, {'error': 'Invalid JSON in request body'})


def create_bad_contact_profile(user_id: str, body: dict[str, Any]) -> dict[str, Any]:
    """Create a bad contact profile with processed status AND create edges"""
    try:
        profile_id = body.get('profileId')
        if not profile_id:
            return create_response(400, {'error': 'profileId is required'})
        profile_id_b64 = base64.urlsafe_b64encode(profile_id.encode()).decode()

        updates = body.get('updates', {})
        current_time = datetime.now(UTC).isoformat()

        # Create or update profile metadata
        profile_metadata = {
            'PK': f'PROFILE#{profile_id_b64}',
            'SK': '#METADATA',
            'originalUrl': body.get('profileId', ''),
            'createdAt': updates.get('addedAt', current_time),
            'updatedAt': current_time,
            'name': updates.get('name', ''),
            'headline': updates.get('headline', ''),
            'summary': updates.get('summary', ''),
            'profilePictureUrl': updates.get('profilePictureUrl', ''),
            'currentCompany': updates.get('currentCompany', ''),
            'currentTitle': updates.get('currentTitle', ''),
            'currentLocation': updates.get('currentLocation', ''),
            'employmentType': updates.get('employmentType', ''),
            'workExperience': updates.get('workExperience', []),
            'education': updates.get('education', []),
            'skills': updates.get('skills', []),
            'fulltext': updates.get('fulltext', ''),
            # Use evaluated flag (boolean) instead of status string for profile-level metadata
            'evaluated': True
        }

        table.put_item(Item=profile_metadata)

        # Do NOT create edges here anymore; puppeteer-backend owns edge creation

        logger.info(f"Created/updated bad contact profile metadata (evaluated=True): {profile_id_b64} for user: {user_id}")

        return create_response(201, {
            'message': 'Bad contact profile metadata updated successfully',
            'profileId': profile_id_b64,
            'evaluated': True
        })

    except ClientError as e:
        logger.error(f"DynamoDB error: {str(e)}")
        return create_response(500, {'error': 'Database error'})

def get_user_settings(user_id: str) -> dict[str, Any]:
    """Get user settings item (e.g., encrypted linkedin_credentials).
    Does not return plaintext and does not log secrets.
    Key: PK=USER#<sub>, SK=#SETTINGS
    """
    try:
        response = table.get_item(
            Key={
                'PK': f'USER#{user_id}',
                'SK': '#SETTINGS'
            }
        )
        return create_response(200, response.get('Item'))
    except ClientError as e:
        logger.error(f"DynamoDB error (get_user_settings): {str(e)}")
        return create_response(500, {'error': 'Database error'})

def validate_profile_field(field: str, value: Any) -> bool:
    """Validate profile field values for type and length constraints."""
    validators = {
        'first_name': lambda v: isinstance(v, str) and 1 <= len(v) <= 100,
        'last_name': lambda v: isinstance(v, str) and 1 <= len(v) <= 100,
        'headline': lambda v: isinstance(v, str) and len(v) <= 220,  # LinkedIn max
        'profile_url': lambda v: isinstance(v, str) and len(v) <= 500 and v.startswith('http'),
        'profile_picture_url': lambda v: isinstance(v, str) and len(v) <= 500 and v.startswith('http'),
        'location': lambda v: isinstance(v, str) and len(v) <= 100,
        'summary': lambda v: isinstance(v, str) and len(v) <= 2600,  # LinkedIn max
        'industry': lambda v: isinstance(v, str) and len(v) <= 100,
        'current_position': lambda v: isinstance(v, str) and len(v) <= 100,
        'company': lambda v: isinstance(v, str) and len(v) <= 100,
        'interests': lambda v: isinstance(v, (str, list)) and len(str(v)) <= 1000,
        'unpublished_post_content': lambda v: isinstance(v, str) and len(v) <= 3000,
        # linkedin_credentials accepts string (encrypted ciphertext) or dict (structured).
        # Credentials are always encrypted client-side before storage; we never store plaintext.
        'linkedin_credentials': lambda v: isinstance(v, (str, dict)),
        'ai_generated_ideas': lambda v: isinstance(v, (str, list, dict)),
        'ai_generated_research': lambda v: isinstance(v, (str, list, dict)),
        'ai_generated_post_hook': lambda v: isinstance(v, str) and len(v) <= 500,
        'ai_generated_post_reasoning': lambda v: isinstance(v, str) and len(v) <= 2000,
    }
    validator = validators.get(field)
    if not validator:
        logger.warning(f'Rejected unknown profile field: {field}')
        return False  # Reject unknown fields for security
    return validator(value)

def update_user_settings(user_id: str, body: dict[str, Any]) -> dict[str, Any]:
    """Update user profile info and/or linkedin_credentials.
    - Profile fields are stored under PK=USER#{sub}, SK=#PROFILE
    - linkedin_credentials is stored under PK=USER#{sub}, SK=#SETTINGS
    """
    try:
        current_time = datetime.now(UTC).isoformat()

        # Extract profile fields (exclude linkedin_credentials which belongs to SETTINGS)
        profile_updates = {}
        allowed_profile_fields = [
            'first_name', 'last_name', 'headline', 'profile_url', 'profile_picture_url',
            'location', 'summary', 'industry', 'current_position', 'company', 'interests',
            'unpublished_post_content', 'linkedin_credentials',
            'ai_generated_ideas',
            'ai_generated_research',
            'ai_generated_post_hook',
            'ai_generated_post_reasoning',
        ]
        for field in allowed_profile_fields:
            if field in body and body[field] is not None:
                if not validate_profile_field(field, body[field]):
                    logger.warning(f'Invalid value for field: {field}')
                    return create_response(400, {'error': f'Invalid value for field: {field}'})
                profile_updates[field] = body[field]

        logger.info('Profile updates validated', {'user_id': user_id, 'fields': list(profile_updates.keys())})

        # If any profile fields provided, upsert profile item
        if profile_updates:
            update_expr_parts = []
            expr_attr_values = { ':ts': current_time }
            expr_attr_names = {}
            # ensure created_at remains on first insert
            # Use SET for dynamic fields
            for k, v in profile_updates.items():
                # escape reserved words via ExpressionAttributeNames when needed
                name_key = f"#f_{k}"
                expr_attr_names[name_key] = k
                value_key = f":v_{k}"
                expr_attr_values[value_key] = v
                update_expr_parts.append(f"{name_key} = {value_key}")

            update_expression = 'SET ' + ', '.join(update_expr_parts + ['updated_at = :ts'])

            # Add created_at if absent
            update_expression += ' ADD ' if ' ADD ' not in update_expression else ''

            # Use a separate UpdateExpression to set created_at if_not_exists within SET
            # Note: DynamoDB supports if_not_exists in SET
            update_expression = (
                'SET ' + ', '.join(update_expr_parts + ['updated_at = :ts', 'created_at = if_not_exists(created_at, :ts)'])
            )

            table.update_item(
                Key={ 'PK': f'USER#{user_id}', 'SK': '#SETTINGS' },
                UpdateExpression=update_expression,
                ExpressionAttributeNames=expr_attr_names,
                ExpressionAttributeValues=expr_attr_values
            )
        else:
            logger.debug('No profile fields provided for update')


        return create_response(200, {'success': True})
    except ClientError as e:
        logger.error(f"DynamoDB error (update_user_settings): {str(e)}")
        return create_response(500, {'error': 'Database error'})

def get_profile_metadata(profile_id_b64: str) -> dict[str, Any] | None:
    """Helper function to get profile metadata"""
    try:
        response = table.get_item(
            Key={
                'PK': f'PROFILE#{profile_id_b64}',
                'SK': '#METADATA'
            }
        )
        return create_response(200, response.get('Item'))
    except ClientError as e:
        logger.error(f"Error getting profile metadata: {str(e)}")
        return None

def create_response(status_code: int, body: dict[str, Any], origin: str | None = None) -> dict[str, Any]:
    """Create standardized API response"""
    allow_origin = origin if origin in ALLOWED_ORIGINS else (ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else '*')
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': allow_origin,
            'Vary': 'Origin',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        'body': json.dumps(body, default=str)
    }
