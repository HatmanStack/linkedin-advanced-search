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
    """Main Lambda handler for DynamoDB API operations - Profile processing only"""
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # Extract user ID from JWT token (same pattern as edge-processing)
        user_id = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub')
        if not user_id:
            logger.error("No user ID found in JWT token")
            return create_response(401, {'error': 'Unauthorized: Missing or invalid JWT token'})
        
        logger.info(f"Processing request for user: {user_id}")
        
        # Parse request body
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        operation = body.get('operation')
        
        if not operation:
            return create_response(400, {'error': 'Missing operation field in request body'})
        
        # Parse and encode profileId once here
        profile_id = body.get('profileId')
        if not profile_id:
            return create_response(400, {'error': 'profileId is required'})
        profile_id_b64 = base64.urlsafe_b64encode(profile_id.encode()).decode()
        body['profileId_b64'] = profile_id_b64  # Pass encoded profileId to downstream functions
        
        # Route to appropriate operation handler - PROFILE OPERATIONS ONLY
        if operation == 'get_details':
            return get_profile_details(user_id, body)
        elif operation == 'create':
            return create_bad_contact_profile(user_id, body)
        else:
            return create_response(400, {
                'error': f'Unsupported operation: {operation}',
                'supported_operations': ['get_details', 'create']
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