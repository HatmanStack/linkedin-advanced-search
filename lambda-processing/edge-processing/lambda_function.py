"""
LinkedIn Edge Management Lambda Function

This Lambda function manages edges between users and profiles in DynamoDB:
1. Triggered by API Gateway with linkedinurl parameter and operation type
2. Supports multiple operations: create, update_status, add_message, update_metadata
3. Handles both User-to-Profile and Profile-to-User edges
4. Uses conditional updates and atomic operations

DynamoDB Schema:
- User-to-Profile edge: PK: USER#<user_id>, SK: PROFILE#<profile_id_b64>
- Profile-to-User edge: PK: PROFILE#<profile_id_b64>, SK: USER#<user_id>
"""

import json
import boto3
import logging
import base64
import time
from datetime import datetime, timezone
from botocore.exceptions import ClientError

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Configuration
AWS_REGION = "us-west-2"
DYNAMODB_TABLE_NAME = "linkedin-advanced-search"

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
table = dynamodb.Table(DYNAMODB_TABLE_NAME)


class EdgeManager:
    """Handles flexible edge management operations between users and profiles"""
    
    def __init__(self):
        self.table = table
    
    def manage_edges(self, user_id, linkedin_url, operation, updates=None):
        """
        Manage edges between user and profile based on operation type
        
        Args:
            user_id (str): The user ID from Cognito
            linkedin_url (str): The LinkedIn profile URL/identifier
            operation (str): Operation type (create, update_status, add_message, update_metadata)
            updates (dict): Updates to apply based on operation type
            
        Returns:
            dict: Operation result with success status and details
        """
        try:
            # Generate profile ID from LinkedIn URL
            profile_id_b64 = base64.b64encode(linkedin_url.encode()).decode()
            profile_id = f"PROFILE#{profile_id_b64}"

            logger.info(f"Managing edges for user {user_id} and profile {profile_id}, operation: {operation}")

            # Route to appropriate operation handler
            if operation == "create":
                return self._create_edges(user_id, profile_id_b64, updates or {})
            elif operation == "update_status":
                return self._update_status(user_id, profile_id_b64, updates or {})
            elif operation == "add_message":
                return self._add_message(user_id, profile_id_b64, updates or {})
            elif operation == "update_metadata":
                return self._update_metadata(user_id, profile_id_b64, updates or {})
            else:
                return {
                    'success': False,
                    'error': f'Unsupported operation: {operation}',
                    'supported_operations': ['create', 'update_status', 'add_message', 'update_metadata']
                }

        except Exception as error:
            logger.error(f"Error in manage_edges: {str(error)}")
            return {
                'success': False,
                'error': str(error)
            }

    def _create_edges(self, user_id, profile_id_b64, updates):
        """Create initial edges between user and profile"""
        try:

            profile_id = f"PROFILE#{profile_id_b64}"

            # Check if profile exists
            profile_response = self.table.get_item(
                Key={
                    'PK': profile_id,
                    'SK': '#METADATA'
                }
            )

            if 'Item' not in profile_response:
                logger.warning(f"Profile {profile_id} not found after 30 seconds")
                return {
                    'success': False,
                    'error': 'Profile not found',
                    'profile_id': profile_id
                }

            # Check for existing edges
            user_to_profile_response = self.table.get_item(
                Key={
                    'PK': f"USER#{user_id}",
                    'SK': f"PROFILE#{profile_id_b64}"
                }
            )
            
            profile_to_user_response = self.table.get_item(
                Key={
                    'PK': f"PROFILE#{profile_id_b64}",
                    'SK': f"USER#{user_id}"
                }
            )

            # If either edge doesn't exist, create both
            if 'Item' not in user_to_profile_response or 'Item' not in profile_to_user_response:
                timestamp = datetime.now(timezone.utc).isoformat()
                
                # Default values with override from updates
                user_edge_data = {
                    'PK': f"USER#{user_id}",
                    'SK': f"PROFILE#{profile_id_b64}",
                    'GSI1PK': f"USER#{user_id}",
                    'GSI1SK': f"STATUS#{updates.get('status', 'possible')}#PROFILE#{profile_id_b64}",
                    'status': updates.get('status', 'possible'),
                    'addedAt': timestamp,
                    'messages': updates.get('messages', [])
                }
                
                profile_edge_data = {
                    'PK': f"PROFILE#{profile_id_b64}",
                    'SK': f"USER#{user_id}",
                    'status': updates.get('status', 'possible'),
                    'addedAt': timestamp,
                    'attempts': updates.get('attempts', 0),
                    'lastFailedAttempt': updates.get('lastFailedAttempt', None)
                }

                # Add any additional updates
                for key, value in updates.items():
                    if key not in ['status', 'messages', 'attempts', 'lastFailedAttempt']:
                        user_edge_data[key] = value
                        profile_edge_data[key] = value

                # Create User-to-Profile edge
                self.table.put_item(Item=user_edge_data)

                # Create Profile-to-User edge
                self.table.put_item(Item=profile_edge_data)

                logger.info(f"Created edges for user {user_id} and profile {profile_id}")
                return {
                    'success': True,
                    'operation': 'create',
                    'user_id': user_id,
                    'profile_id': profile_id,
                    'edges_created': 2
                }

            logger.info(f"Edges already exist for user {user_id} and profile {profile_id}")
            return {
                'success': True,
                'operation': 'create',
                'user_id': user_id,
                'profile_id': profile_id,
                'edges_created': 0,
                'message': 'Edges already exist'
            }

        except Exception as error:
            logger.error(f"Error in _create_edges: {str(error)}")
            return {
                'success': False,
                'error': str(error)
            }

    def _update_status(self, user_id, profile_id_b64, updates):
        """Update status of existing edges"""
        try:
            new_status = updates.get('status')
            if not new_status:
                return {
                    'success': False,
                    'error': 'Status is required for update_status operation'
                }

            timestamp = datetime.now(timezone.utc).isoformat()
            
            # Update User-to-Profile edge
            user_update_expression = "SET #status = :status, #updatedAt = :timestamp, GSI1SK = :gsi1sk"
            user_expression_values = {
                ':status': new_status,
                ':timestamp': timestamp,
                ':gsi1sk': f"STATUS#{new_status}#PROFILE#{profile_id_b64}"
            }
            user_expression_names = {
                '#status': 'status',
                '#updatedAt': 'updatedAt'
            }

            # Add any additional updates
            for key, value in updates.items():
                if key != 'status':
                    user_update_expression += f", #{key} = :{key}"
                    user_expression_values[f":{key}"] = value
                    user_expression_names[f"#{key}"] = key

            self.table.update_item(
                Key={
                    'PK': f"USER#{user_id}",
                    'SK': f"PROFILE#{profile_id_b64}"
                },
                UpdateExpression=user_update_expression,
                ExpressionAttributeValues=user_expression_values,
                ExpressionAttributeNames=user_expression_names
            )

            # Update Profile-to-User edge
            profile_update_expression = "SET #status = :status, #updatedAt = :timestamp"
            profile_expression_values = {
                ':status': new_status,
                ':timestamp': timestamp
            }
            profile_expression_names = {
                '#status': 'status',
                '#updatedAt': 'updatedAt'
            }

            # Add any additional updates
            for key, value in updates.items():
                if key != 'status':
                    profile_update_expression += f", #{key} = :{key}"
                    profile_expression_values[f":{key}"] = value
                    profile_expression_names[f"#{key}"] = key

            self.table.update_item(
                Key={
                    'PK': f"PROFILE#{profile_id_b64}",
                    'SK': f"USER#{user_id}"
                },
                UpdateExpression=profile_update_expression,
                ExpressionAttributeValues=profile_expression_values,
                ExpressionAttributeNames=profile_expression_names
            )

            logger.info(f"Updated status to {new_status} for user {user_id} and profile {profile_id_b64}")
            return {
                'success': True,
                'operation': 'update_status',
                'user_id': user_id,
                'profile_id': f"PROFILE#{profile_id_b64}",
                'new_status': new_status,
                'updates_applied': len(updates)
            }

        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                return {
                    'success': False,
                    'error': 'Edge not found or condition not met'
                }
            else:
                logger.error(f"Error in _update_status: {str(e)}")
                return {
                    'success': False,
                    'error': str(e)
                }

    def _add_message(self, user_id, profile_id_b64, updates):
        """Add message to the messages array in User-to-Profile edge"""
        try:
            message = updates.get('message')
            if not message:
                return {
                    'success': False,
                    'error': 'Message is required for add_message operation'
                }

            # Ensure message has timestamp if not provided
            if 'timestamp' not in message:
                message['timestamp'] = datetime.now(timezone.utc).isoformat()

            timestamp = datetime.now(timezone.utc).isoformat()

            # Update User-to-Profile edge - append message to messages array
            self.table.update_item(
                Key={
                    'PK': f"USER#{user_id}",
                    'SK': f"PROFILE#{profile_id_b64}"
                },
                UpdateExpression="SET messages = list_append(if_not_exists(messages, :empty_list), :message), #updatedAt = :timestamp",
                ExpressionAttributeValues={
                    ':message': [message],
                    ':empty_list': [],
                    ':timestamp': timestamp
                },
                ExpressionAttributeNames={
                    '#updatedAt': 'updatedAt'
                }
            )

            logger.info(f"Added message for user {user_id} and profile {profile_id_b64}")
            return {
                'success': True,
                'operation': 'add_message',
                'user_id': user_id,
                'profile_id': f"PROFILE#{profile_id_b64}",
                'message_added': message
            }

        except ClientError as e:
            logger.error(f"Error in _add_message: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def _update_metadata(self, user_id, profile_id_b64, updates):
        """Update metadata fields on edges"""
        try:
            if not updates:
                return {
                    'success': False,
                    'error': 'Updates are required for update_metadata operation'
                }

            timestamp = datetime.now(timezone.utc).isoformat()
            
            # Build update expression dynamically
            update_expression_parts = ["#updatedAt = :timestamp"]
            expression_values = {':timestamp': timestamp}
            expression_names = {'#updatedAt': 'updatedAt'}

            # Handle special operations
            for key, value in updates.items():
                if key == 'increment_attempts':
                    # Increment attempts counter
                    update_expression_parts.append("attempts = if_not_exists(attempts, :zero) + :increment")
                    expression_values[':zero'] = 0
                    expression_values[':increment'] = value
                elif key == 'append_to_array':
                    # Append to an array field
                    field_name = value.get('field')
                    items = value.get('items', [])
                    if field_name and items:
                        update_expression_parts.append(f"{field_name} = list_append(if_not_exists({field_name}, :empty_list), :items)")
                        expression_values[':empty_list'] = []
                        expression_values[':items'] = items
                else:
                    # Regular field update
                    update_expression_parts.append(f"#{key} = :{key}")
                    expression_values[f":{key}"] = value
                    expression_names[f"#{key}"] = key

            update_expression = "SET " + ", ".join(update_expression_parts)

            # Update both edges
            for pk, sk in [(f"USER#{user_id}", f"PROFILE#{profile_id_b64}"), 
                          (f"PROFILE#{profile_id_b64}", f"USER#{user_id}")]:
                self.table.update_item(
                    Key={'PK': pk, 'SK': sk},
                    UpdateExpression=update_expression,
                    ExpressionAttributeValues=expression_values,
                    ExpressionAttributeNames=expression_names
                )

            logger.info(f"Updated metadata for user {user_id} and profile {profile_id_b64}")
            return {
                'success': True,
                'operation': 'update_metadata',
                'user_id': user_id,
                'profile_id': f"PROFILE#{profile_id_b64}",
                'updates_applied': len(updates)
            }

        except ClientError as e:
            logger.error(f"Error in _update_metadata: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }


def lambda_handler(event, context):
    """
    AWS Lambda handler for flexible edge management
    
    Args:
        event: API Gateway event containing the request
        context: Lambda context object
        
    Returns:
        dict: API Gateway response
    """
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # Parse the request body
        if 'body' in event:
            if isinstance(event['body'], str):
                body = json.loads(event['body'])
            else:
                body = event['body']
        else:
            body = event
        
        # Extract required parameters
        linkedin_url = body.get('linkedinurl')
        operation = body.get('operation', 'create')  # Default to create for backward compatibility
        updates = body.get('updates', {})
        
        if not linkedin_url:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'POST,OPTIONS'
                },
                'body': json.dumps({
                    'error': 'Missing required parameter: linkedinurl'
                })
            }
        
        # Extract user ID from JWT token
        user_id = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub')
        if not user_id:
            # Fallback for testing
            auth_header = event.get('headers', {}).get('Authorization', '')
            if auth_header:
                user_id = "test-user-id"
            else:
                return {
                    'statusCode': 401,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                        'Access-Control-Allow-Methods': 'POST,OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'Unauthorized: Missing or invalid JWT token'
                    })
                }
        
        # Process the edge management operation
        edge_manager = EdgeManager()
        result = edge_manager.manage_edges(user_id, linkedin_url, operation, updates)
        
        if result['success']:
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'POST,OPTIONS'
                },
                'body': json.dumps({
                    'message': f'Edge {operation} operation completed successfully',
                    'result': result
                })
            }
        else:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'POST,OPTIONS'
                },
                'body': json.dumps({
                    'error': f'Edge {operation} operation failed',
                    'details': result
                })
            }
    
    except Exception as e:
        logger.error(f"Unexpected error in lambda_handler: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'POST,OPTIONS'
            },
            'body': json.dumps({
                'error': 'Internal server error'
            })
        }
