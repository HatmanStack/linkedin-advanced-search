"""
Profile API Lambda Function

Handles user profile management including encrypted LinkedIn credentials storage.
Operations:
- GET /profiles - Fetch user profile
- POST /profiles - Update user profile (operation: update_user_settings)
"""

import json
import logging
import os
from datetime import datetime
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# DynamoDB client
dynamodb = boto3.resource('dynamodb')
table_name = os.environ.get('DYNAMODB_TABLE_NAME', 'linkedin-advanced-search')
table = dynamodb.Table(table_name)

logger.info(f"Using DynamoDB table: {table_name}")


class DecimalEncoder(json.JSONEncoder):
    """Helper class to convert Decimal to int/float for JSON serialization"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)


def _extract_user_id(event):
    """Extract user ID from Cognito JWT claims - requires authentication"""
    import os
    
    # Try Cognito authorizer claims first
    sub = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub')
    if sub:
        return sub

    # Check if DEV_MODE environment variable is explicitly set
    dev_mode = os.environ.get('DEV_MODE', 'false').lower() == 'true'
    
    if dev_mode:
        # Only in development mode: allow fallback for testing
        auth_header = event.get('headers', {}).get('Authorization', '') or event.get('headers', {}).get('authorization', '')
        if auth_header:
            logger.warning("DEV_MODE: Authorization header present but no Cognito claims, using development user ID")
            return 'test-user-development'
        logger.warning("DEV_MODE: No authentication found, using default test user")
        return 'test-user-development'
    
    # Production: No authentication means unauthorized
    logger.error("No authentication found and DEV_MODE is not enabled")
    return None

def lambda_handler(event, context):
    """Main Lambda handler for profile API operations"""
    # HTTP API v2 uses requestContext.http.method instead of httpMethod
    http_method = event.get('httpMethod') or event.get('requestContext', {}).get('http', {}).get('method', '')

    logger.info(f"Profile API request: {http_method} /profiles")

    # Extract user ID from JWT
    user_id = _extract_user_id(event)
    
    # Check if authentication succeeded
    if user_id is None:
        return build_error_response(401, "Authentication required")
    
    logger.info(f"User ID: {user_id}")

    # Route based on HTTP method

    try:
        if http_method == 'GET':
            return handle_get_profile(user_id)
        elif http_method == 'POST':
            return handle_update_profile(event, user_id)
        else:
            return build_error_response(405, f"Method {http_method} not allowed")

    except Exception as e:
        logger.error(f"Error processing request: {e}", exc_info=True)
        return build_error_response(500, "Internal server error")


def handle_get_profile(user_id):
    """Handle GET /profiles - Fetch user profile"""
    try:
        # Query DynamoDB for user profile
        response = table.get_item(
            Key={
                'PK': f'USER#{user_id}',
                'SK': 'PROFILE'
            }
        )

        if 'Item' not in response:
            logger.info(f"Profile not found for user {user_id}, returning default")
            # Return default profile structure
            default_profile = {
                'userId': user_id,
                'email': '',
                'firstName': '',
                'lastName': '',
                'linkedin_credentials': None,
                'createdAt': datetime.utcnow().isoformat(),
                'updatedAt': datetime.utcnow().isoformat()
            }
            return build_success_response(default_profile)

        # Extract profile data
        item = response['Item']
        profile = {
            'userId': user_id,
            'email': item.get('email', ''),
            'firstName': item.get('firstName', ''),
            'lastName': item.get('lastName', ''),
            'linkedin_credentials': item.get('linkedin_credentials'),
            'createdAt': item.get('createdAt', ''),
            'updatedAt': item.get('updatedAt', '')
        }

        logger.info(f"Profile retrieved successfully for user {user_id}")
        return build_success_response(profile)

    except ClientError as e:
        logger.error(f"DynamoDB error: {e}")
        return build_error_response(500, "Database error")


def handle_update_profile(event, user_id):
    """Handle POST /profiles - Update user profile"""
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))

        # Extract operation
        operation = body.get('operation', 'update_user_settings')

        if operation != 'update_user_settings':
            return build_error_response(400, f"Unsupported operation: {operation}")

        # Build update expression
        update_fields = {}
        expression_attribute_names = {}
        expression_attribute_values = {}

        # Fields that can be updated (support both camelCase and snake_case)
        allowed_fields = {
            'email': 'email',
            'firstName': 'firstName',
            'lastName': 'lastName',
            'first_name': 'firstName',  # Snake case alias
            'last_name': 'lastName',    # Snake case alias
            'headline': 'headline',
            'current_position': 'current_position',
            'company': 'company',
            'location': 'location',
            'summary': 'summary',
            'linkedin_credentials': 'linkedin_credentials'
        }

        for field, dynamo_field in allowed_fields.items():
            if field in body and body[field] is not None:
                update_fields[dynamo_field] = body[field]

        if not update_fields:
            return build_error_response(400, "No valid fields to update")

        # Always update the updatedAt timestamp
        update_fields['updatedAt'] = datetime.utcnow().isoformat()

        # Build update expression
        update_expr_parts = []
        for field, value in update_fields.items():
            attr_name = f"#{field}"
            attr_value = f":{field}"
            expression_attribute_names[attr_name] = field
            expression_attribute_values[attr_value] = value
            update_expr_parts.append(f"{attr_name} = {attr_value}")

        # If profile doesn't exist, set createdAt
        expression_attribute_names['#createdAt'] = 'createdAt'
        expression_attribute_values[':createdAt'] = datetime.utcnow().isoformat()
        update_expr_parts.append("#createdAt = if_not_exists(#createdAt, :createdAt)")

        update_expression = "SET " + ", ".join(update_expr_parts)

        logger.info(f"Updating profile for user {user_id} with fields: {list(update_fields.keys())}")

        # Update DynamoDB
        response = table.update_item(
            Key={
                'PK': f'USER#{user_id}',
                'SK': 'PROFILE'
            },
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attribute_names,
            ExpressionAttributeValues=expression_attribute_values,
            ReturnValues='ALL_NEW'
        )

        # Extract updated profile
        item = response['Attributes']
        profile = {
            'userId': user_id,
            'email': item.get('email', ''),
            'firstName': item.get('firstName', ''),
            'lastName': item.get('lastName', ''),
            'linkedin_credentials': item.get('linkedin_credentials'),
            'createdAt': item.get('createdAt', ''),
            'updatedAt': item.get('updatedAt', '')
        }

        logger.info(f"Profile updated successfully for user {user_id}")
        return build_success_response(profile)

    except json.JSONDecodeError:
        return build_error_response(400, "Invalid JSON in request body")
    except ClientError as e:
        logger.error(f"DynamoDB error: {e}")
        return build_error_response(500, "Database error")


def build_success_response(data):
    """Build successful response"""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
        },
        'body': json.dumps({
            'success': True,
            'data': data
        }, cls=DecimalEncoder)
    }


def build_error_response(status_code, message):
    """Build error response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
        },
        'body': json.dumps({
            'success': False,
            'error': message,
            'timestamp': datetime.utcnow().isoformat()
        })
    }
