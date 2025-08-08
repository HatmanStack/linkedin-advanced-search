import json
import boto3
import base64
from typing import Dict, Any, List, Optional
from botocore.exceptions import ClientError
import os
import logging
from datetime import datetime, timezone, timedelta

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')

# Environment variables
TABLE_NAME = os.environ['DYNAMODB_TABLE_NAME']
COGNITO_USER_POOL_ID = os.environ['COGNITO_USER_POOL_ID']
COGNITO_REGION = os.environ.get('COGNITO_REGION', 'us-west-2')

table = dynamodb.Table(TABLE_NAME)

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Main Lambda handler for DynamoDB API operations.
    Supports:
      - User settings (e.g., linkedin_credentials) via HTTP GET/PUT or operation-based calls
      - Existing profile operations (get_details, create) using operation-based calls
    """
    try:
        # Avoid logging the entire event to prevent accidental secret exposure
        logger.info("Received request")

        # Extract user ID from JWT token (same pattern as edge-processing)
        user_id = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub')
        if not user_id:
            logger.error("No user ID found in JWT token")
            return create_response(401, {'error': 'Unauthorized: Missing or invalid JWT token'})

        logger.info(f"Processing request for user: {user_id}")

        # Determine HTTP method if present (HTTP API v2 or REST API)
        http_method = (event.get('httpMethod')
                       or event.get('requestContext', {}).get('http', {}).get('method')
                       or '').upper()

        # Parse request body (if any)
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        operation = body.get('operation')

        # 1) HTTP-style routing for /profile
        if http_method in ('GET', 'PUT'):
            if http_method == 'GET':
                return get_user_profile(user_id)
            if http_method == 'PUT':
                # Accept full/partial profile + optional linkedin_credentials
                return update_user_profile(user_id, body)

        # 2) Operation-based routing (backward compatible)
        if not operation:
            return create_response(400, {'error': 'Missing operation field in request body'})

        # Operations that require a profileId
        if operation in ('get_details', 'create'):
            profile_id = body.get('profileId')
            if not profile_id:
                return create_response(400, {'error': 'profileId is required'})
            profile_id_b64 = base64.urlsafe_b64encode(profile_id.encode()).decode()
            body['profileId_b64'] = profile_id_b64

        if operation == 'get_details':
            return get_profile_details(user_id, body)
        elif operation == 'create':
            return create_bad_contact_profile(user_id, body)
        elif operation == 'get_user_settings':
            return get_user_settings(user_id)
        elif operation == 'update_user_settings':
            linkedin_credentials = body.get('linkedin_credentials')
            if linkedin_credentials is None:
                return create_response(400, {'error': 'Missing required field: linkedin_credentials'})
            return update_user_settings(user_id, linkedin_credentials)
        elif operation == 'get_user_profile':
            return get_user_profile(user_id)
        elif operation == 'update_user_profile':
            return update_user_profile(user_id, body)
        else:
            return create_response(400, {
                'error': f'Unsupported operation: {operation}',
                'supported_operations': [
                    'get_details', 'create',
                    'get_user_settings', 'update_user_settings',
                    'get_user_profile', 'update_user_profile'
                ]
            })

    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return create_response(500, {'error': 'Internal server error'})

def get_profile_details(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Get detailed profile information"""
    try:
        profile_id_b64 = body.get('profileId_b64')
        if not profile_id_b64:
            return create_response(400, {'error': 'profileId_b64 is required'})
        
        profile_data = get_profile_metadata(profile_id_b64)
        if not profile_data:
            return create_response(200, {'message': 'Profile not found', 'profile': None})
            
        return create_response(200, {'profile': profile_data})
        
    except ClientError as e:
        logger.error(f"DynamoDB error: {str(e)}")
        return create_response(500, {'error': 'Database error'})

def create_bad_contact_profile(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Create a bad contact profile with processed status AND create edges"""
    try:
        profile_id_b64 = body.get('profileId_b64')
        if not profile_id_b64:
            return create_response(400, {'error': 'profileId_b64 is required'})
        
        updates = body.get('updates', {})
        current_time = datetime.now(timezone.utc).isoformat()
        
        print(f'THIS IS THE BAD CONTACT:   PROFILE#{profile_id_b64}')
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
            'status': 'processed'  # Bad contact status
        }
        
        table.put_item(Item=profile_metadata)
        
        # Create edges for bad contact (status: processed)
        status = 'processed'
        
        # Create user-to-profile edge
        user_profile_edge = {
            'PK': f'USER#{user_id}',
            'SK': f'PROFILE#{profile_id_b64}',
            'status': status,
            'addedAt': updates.get('addedAt', current_time),
            'processedAt': updates.get('processedAt', current_time),
            'updatedAt': current_time,
            'messages': updates.get('messages', []),
            'GSI1PK': f'USER#{user_id}',
            'GSI1SK': f'STATUS#{status}#PROFILE#{profile_id_b64}'
        }
        
        # Add any additional edge data from updates
        for key, value in updates.items():
            if key not in ['addedAt', 'processedAt', 'messages', 'name', 'headline', 'summary', 
                          'profilePictureUrl', 'currentCompany', 'currentTitle', 'currentLocation',
                          'employmentType', 'workExperience', 'education', 'skills', 'fulltext']:
                user_profile_edge[key] = value
        
        table.put_item(Item=user_profile_edge)
        
        # Create profile-to-user edge
        profile_user_edge = {
            'PK': f'PROFILE#{profile_id_b64}',
            'SK': f'USER#{user_id}',
            'addedAt': updates.get('addedAt', current_time),
            'status': status,
            'attempts': 1,
            'lastAttempt': current_time,
            'updatedAt': current_time
        }
        
        table.put_item(Item=profile_user_edge)
        
        logger.info(f"Created bad contact profile and edges: {profile_id_b64} for user: {user_id}")
        
        return create_response(201, {
            'message': 'Bad contact profile and edges created successfully',
            'profileId': profile_id_b64,
            'status': 'processed',
            'edges_created': {
                'user_to_profile': f'USER#{user_id} -> PROFILE#{profile_id_b64}',
                'profile_to_user': f'PROFILE#{profile_id_b64} -> USER#{user_id}'
            }
        })
        
    except ClientError as e:
        logger.error(f"DynamoDB error: {str(e)}")
        return create_response(500, {'error': 'Database error'})

def get_user_settings(user_id: str) -> Dict[str, Any]:
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
        item = response.get('Item') or {}
        # Return only the fields needed by the client
        result = {}
        if 'linkedin_credentials' in item:
            # Return the stored encrypted value or ciphertext tag; do not modify
            result['linkedin_credentials'] = item.get('linkedin_credentials')
        return create_response(200, result)
    except ClientError as e:
        logger.error(f"DynamoDB error (get_user_settings): {str(e)}")
        return create_response(500, {'error': 'Database error'})

def update_user_settings(user_id: str, linkedin_credentials: str) -> Dict[str, Any]:
    """Upsert user settings with provided linkedin_credentials string.
    The value may already be client-side encrypted (e.g., rsa_oaep_sha256:b64:...),
    or may be a JSON string for server-side encryption with KMS (to be added separately).
    """
    try:
        current_time = datetime.now(timezone.utc).isoformat()
        # Minimal update; KMS envelope encryption can be added here if required
        table.update_item(
            Key={
                'PK': f'USER#{user_id}',
                'SK': '#SETTINGS'
            },
            UpdateExpression='SET linkedin_credentials = :cred, updatedAt = :ts',
            ExpressionAttributeValues={
                ':cred': linkedin_credentials,
                ':ts': current_time
            }
        )
        return create_response(200, {'success': True})
    except ClientError as e:
        logger.error(f"DynamoDB error (update_user_settings): {str(e)}")
        return create_response(500, {'error': 'Database error'})

def get_user_profile(user_id: str) -> Dict[str, Any]:
    """Return combined user profile data including non-sensitive profile info
    and presence/value of linkedin_credentials.
    Profile item: PK=USER#<sub>, SK=#PROFILE
    Settings item: PK=USER#<sub>, SK=#SETTINGS
    """
    try:
        # Fetch profile item
        profile_resp = table.get_item(
            Key={
                'PK': f'USER#{user_id}',
                'SK': '#PROFILE'
            }
        )
        profile_item = profile_resp.get('Item') or {}

        # Fetch settings item
        settings_resp = table.get_item(
            Key={
                'PK': f'USER#{user_id}',
                'SK': '#SETTINGS'
            }
        )
        settings_item = settings_resp.get('Item') or {}

        # Map profile fields back to API model
        result = {
            'user_id': user_id,
            'first_name': profile_item.get('first_name', ''),
            'last_name': profile_item.get('last_name', ''),
            'headline': profile_item.get('headline', ''),
            'profile_url': profile_item.get('profile_url', ''),
            'profile_picture_url': profile_item.get('profile_picture_url', ''),
            'location': profile_item.get('location', ''),
            'summary': profile_item.get('summary', ''),
            'industry': profile_item.get('industry', ''),
            'current_position': profile_item.get('current_position', ''),
            'company': profile_item.get('company', ''),
            'interests': profile_item.get('interests', []),
            'created_at': profile_item.get('created_at', ''),
            'updated_at': profile_item.get('updated_at', ''),
        }

        if 'linkedin_credentials' in settings_item:
            result['linkedin_credentials'] = settings_item.get('linkedin_credentials')

        return create_response(200, result)
    except ClientError as e:
        logger.error(f"DynamoDB error (get_user_profile): {str(e)}")
        return create_response(500, {'error': 'Database error'})

def update_user_profile(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Update user profile info and optionally linkedin_credentials.
    Accepts partial updates; upserts profile fields on #PROFILE key and delegates
    credential updates to update_user_settings if provided.
    """
    try:
        current_time = datetime.now(timezone.utc).isoformat()

        # Extract profile fields
        profile_updates = {}
        allowed_fields = [
            'first_name', 'last_name', 'headline', 'profile_url', 'profile_picture_url',
            'location', 'summary', 'industry', 'current_position', 'company', 'interests'
        ]
        for field in allowed_fields:
            if field in body and body[field] is not None:
                profile_updates[field] = body[field]

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
                Key={ 'PK': f'USER#{user_id}', 'SK': '#PROFILE' },
                UpdateExpression=update_expression,
                ExpressionAttributeNames=expr_attr_names,
                ExpressionAttributeValues=expr_attr_values
            )

        # Handle linkedin_credentials if provided
        if 'linkedin_credentials' in body and body['linkedin_credentials'] is not None:
            return update_user_settings(user_id, body['linkedin_credentials'])

        return create_response(200, {'success': True})
    except ClientError as e:
        logger.error(f"DynamoDB error (update_user_profile): {str(e)}")
        return create_response(500, {'error': 'Database error'})

def get_profile_metadata(profile_id_b64: str) -> Optional[Dict[str, Any]]:
    """Helper function to get profile metadata"""
    try:
        print(f'THIS IS THE PROFILE BEING CHECKED:  PROFILE#{profile_id_b64}')
        response = table.get_item(
            Key={
                'PK': f'PROFILE#{profile_id_b64}',
                'SK': '#METADATA'
            }
        )
        return response.get('Item')
    except ClientError as e:
        logger.error(f"Error getting profile metadata: {str(e)}")
        return None

def create_response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    """Create standardized API response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        'body': json.dumps(body, default=str)
    }