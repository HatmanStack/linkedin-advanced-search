import json
import boto3
import base64
from typing import Dict, Any, List, Optional
from botocore.exceptions import ClientError
import jwt
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError
import os
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
cognito_client = boto3.client('cognito-idp')

# Environment variables
TABLE_NAME = os.environ['DYNAMODB_TABLE_NAME']
COGNITO_USER_POOL_ID = os.environ['COGNITO_USER_POOL_ID']
COGNITO_REGION = os.environ.get('COGNITO_REGION', 'us-west-2')

table = dynamodb.Table(TABLE_NAME)

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Main Lambda handler for DynamoDB API operations"""
    try:
        # Extract user ID from JWT token
        user_id = extract_user_id_from_token(event)
        if not user_id:
            return create_response(401, {'error': 'Unauthorized'})
        
        # Parse request
        http_method = event['httpMethod']
        path = event['path']
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        query_params = event.get('queryStringParameters') or {}
        
        # Route to appropriate handler
        if path == '/profiles' and http_method == 'GET':
            return get_user_profiles(user_id, query_params)
        elif path == '/profiles' and http_method == 'POST':
            return add_profile(user_id, body)
        elif path.startswith('/profiles/') and http_method == 'GET':
            profile_id = path.split('/')[-1]
            return get_profile_details(profile_id)
        elif path.startswith('/profiles/') and http_method == 'PUT':
            profile_id = path.split('/')[-1]
            return update_profile_status(user_id, profile_id, body)
        elif path.startswith('/profiles/') and http_method == 'DELETE':
            profile_id = path.split('/')[-1]
            return remove_profile(user_id, profile_id)
        else:
            return create_response(404, {'error': 'Not found'})
            
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return create_response(500, {'error': 'Internal server error'})

def extract_user_id_from_token(event: Dict[str, Any]) -> Optional[str]:
    """Extract user ID from Cognito JWT token"""
    try:
        auth_header = event.get('headers', {}).get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return None
            
        token = auth_header.replace('Bearer ', '')
        
        # Decode token without verification for now (API Gateway should handle verification)
        decoded = jwt.decode(token, options={"verify_signature": False})
        return decoded.get('sub')
        
    except Exception as e:
        logger.error(f"Error extracting user ID: {str(e)}")
        return None

def get_user_profiles(user_id: str, query_params: Dict[str, str]) -> Dict[str, Any]:
    """Get all profiles for a user with optional status filtering"""
    try:
        status_filter = query_params.get('status')
        
        if status_filter:
            # Use GSI1 for status-based queries
            response = table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': f'STATUS#{status_filter}#'
                }
            )
        else:
            # Query all profiles for user
            response = table.query(
                KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues={
                    ':pk': f'USER#{user_id}',
                    ':sk': 'PROFILE#'
                }
            )
        
        profiles = []
        for item in response['Items']:
            profile_id = item['SK'].replace('PROFILE#', '')
            
            # Get profile metadata
            profile_data = get_profile_metadata(profile_id)
            if profile_data:
                profile_data.update({
                    'status': item.get('status'),
                    'addedAt': item.get('addedAt'),
                    'messages': item.get('messages', [])
                })
                profiles.append(profile_data)
        
        return create_response(200, {'profiles': profiles})
        
    except ClientError as e:
        logger.error(f"DynamoDB error: {str(e)}")
        return create_response(500, {'error': 'Database error'})

def get_profile_details(profile_id: str) -> Dict[str, Any]:
    """Get detailed profile information"""
    try:
        profile_data = get_profile_metadata(profile_id)
        if not profile_data:
            return create_response(404, {'error': 'Profile not found'})
            
        return create_response(200, profile_data)
        
    except ClientError as e:
        logger.error(f"DynamoDB error: {str(e)}")
        return create_response(500, {'error': 'Database error'})

def get_profile_metadata(profile_id: str) -> Optional[Dict[str, Any]]:
    """Helper function to get profile metadata"""
    try:
        response = table.get_item(
            Key={
                'PK': f'PROFILE#{profile_id}',
                'SK': '#METADATA'
            }
        )
        return response.get('Item')
    except ClientError:
        return None

def add_profile(user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Add a new profile for a user"""
    try:
        linkedin_url = body.get('linkedin_url')
        if not linkedin_url:
            return create_response(400, {'error': 'linkedin_url is required'})
        
        # Encode URL for use as profile ID
        profile_id = base64.urlsafe_b64encode(linkedin_url.encode()).decode().rstrip('=')
        
        # Check if profile metadata already exists
        existing_profile = get_profile_metadata(profile_id)
        if not existing_profile:
            # Create profile metadata if it doesn't exist
            profile_metadata = {
                'PK': f'PROFILE#{profile_id}',
                'SK': '#METADATA',
                'originalUrl': linkedin_url,
                'createdAt': body.get('createdAt'),
                'updatedAt': body.get('updatedAt'),
                'name': body.get('name', ''),
                'headline': body.get('headline', ''),
                'summary': body.get('summary', ''),
                'profilePictureUrl': body.get('profilePictureUrl', ''),
                'currentCompany': body.get('currentCompany', ''),
                'currentTitle': body.get('currentTitle', ''),
                'currentLocation': body.get('currentLocation', ''),
                'employmentType': body.get('employmentType', ''),
                'workExperience': body.get('workExperience', []),
                'education': body.get('education', []),
                'skills': body.get('skills', []),
                'fulltext': body.get('fulltext', ''),
                'linkedin_url': linkedin_url
            }
            table.put_item(Item=profile_metadata)
        
        # Create user-to-profile link
        user_profile_link = {
            'PK': f'USER#{user_id}',
            'SK': f'PROFILE#{profile_id}',
            'status': body.get('status', 'pending'),
            'addedAt': body.get('addedAt'),
            'messages': body.get('messages', []),
            'GSI1PK': f'USER#{user_id}',
            'GSI1SK': f'STATUS#{body.get("status", "pending")}#PROFILE#{profile_id}'
        }
        table.put_item(Item=user_profile_link)
        
        # Create profile-to-user link
        profile_user_link = {
            'PK': f'PROFILE#{profile_id}',
            'SK': f'USER#{user_id}',
            'addedAt': body.get('addedAt'),
            'attempts': 1,
            'lastFailedAttempt': body.get('lastFailedAttempt')
        }
        table.put_item(Item=profile_user_link)
        
        return create_response(201, {'message': 'Profile added successfully', 'profileId': profile_id})
        
    except ClientError as e:
        logger.error(f"DynamoDB error: {str(e)}")
        return create_response(500, {'error': 'Database error'})

def update_profile_status(user_id: str, profile_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Update profile status for a user"""
    try:
        new_status = body.get('status')
        if not new_status:
            return create_response(400, {'error': 'status is required'})
        
        # Update user-to-profile link
        table.update_item(
            Key={
                'PK': f'USER#{user_id}',
                'SK': f'PROFILE#{profile_id}'
            },
            UpdateExpression='SET #status = :status, GSI1SK = :gsi1sk',
            ExpressionAttributeNames={
                '#status': 'status'
            },
            ExpressionAttributeValues={
                ':status': new_status,
                ':gsi1sk': f'STATUS#{new_status}#PROFILE#{profile_id}'
            }
        )
        
        return create_response(200, {'message': 'Profile status updated successfully'})
        
    except ClientError as e:
        logger.error(f"DynamoDB error: {str(e)}")
        return create_response(500, {'error': 'Database error'})

def remove_profile(user_id: str, profile_id: str) -> Dict[str, Any]:
    """Remove profile association for a user"""
    try:
        # Delete user-to-profile link
        table.delete_item(
            Key={
                'PK': f'USER#{user_id}',
                'SK': f'PROFILE#{profile_id}'
            }
        )
        
        # Delete profile-to-user link
        table.delete_item(
            Key={
                'PK': f'PROFILE#{profile_id}',
                'SK': f'USER#{user_id}'
            }
        )
        
        return create_response(200, {'message': 'Profile removed successfully'})
        
    except ClientError as e:
        logger.error(f"DynamoDB error: {str(e)}")
        return create_response(500, {'error': 'Database error'})

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
        'body': json.dumps(body)
    }