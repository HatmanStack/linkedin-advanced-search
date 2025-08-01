"""
LinkedIn Edge Management Lambda Function

This Lambda function manages edges between users and profiles in DynamoDB:
1. Triggered by API Gateway with linkedinurl parameter and operation type
2. Supports multiple operations: create, update_status, add_message, update_metadata, create_edges
3. Handles both User-to-Profile and Profile-to-User edges
4. Uses conditional updates and atomic operations
5. NEW: Supports creating edges for bad contacts (processed) and good contacts (possible)

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
DYNAMODB_TABLE_NAME = "linkedin-advanced-search"

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
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
            operation (str): Operation type (create, update_status, add_message, update_metadata, check_exists)
            updates (dict): Updates to apply based on operation type
            
        Returns:
            dict: Operation result with success status and details
        """
        if updates is None:
            updates = {}
            
        try:
            # Encode the LinkedIn URL for use as profile ID
            profile_id_b64 = base64.urlsafe_b64encode(linkedin_url.encode()).decode().rstrip('=')
            
            logger.info(f"Managing edges for user {user_id}, profile {profile_id_b64}, operation: {operation}")
            
            if operation == "create":
                return self._create_edges(user_id, profile_id_b64, linkedin_url, updates)
            elif operation == "update_status":
                return self._update_status(user_id, profile_id_b64, updates)
            elif operation == "add_message":
                return self._add_message(user_id, profile_id_b64, updates)
            elif operation == "update_metadata":
                return self._update_metadata(user_id, profile_id_b64, updates)
            elif operation == "check_exists":
                return self._check_edge_exists(user_id, profile_id_b64)
            else:
                return {
                    'success': False,
                    'error': f'Unsupported operation: {operation}',
                    'supported_operations': ['create', 'update_status', 'add_message', 'update_metadata', 'check_exists']
                }
                
        except Exception as e:
            logger.error(f"Error in manage_edges: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def create_contact_edges(self, user_id, profile_id, status, edges_data=None):
        """
        Create edges for contacts with specified status (processed for bad, possible for good)
        
        Args:
            user_id (str): The user ID from Cognito
            profile_id (str): The profile ID (can be URL or encoded ID)
            status (str): Edge status ('processed' for bad contacts, 'possible' for good contacts)
            edges_data (dict): Additional edge data
            
        Returns:
            dict: Operation result with success status and details
        """
        if edges_data is None:
            edges_data = {}
            
        try:
            # Handle both URL and encoded profile IDs
            if profile_id.startswith('http'):
                linkedin_url = profile_id
                profile_id_b64 = base64.urlsafe_b64encode(profile_id.encode()).decode().rstrip('=')
            else:
                profile_id_b64 = profile_id
                # Try to decode to get original URL
                try:
                    linkedin_url = base64.urlsafe_b64decode(profile_id + '==').decode()
                except:
                    linkedin_url = profile_id  # Fallback
            
            logger.info(f"Creating {status} contact edges for user {user_id}, profile {profile_id_b64}")
            
            current_time = datetime.now(timezone.utc).isoformat()
            
            # Create user-to-profile edge
            user_profile_edge = {
                'PK': f'USER#{user_id}',
                'SK': f'PROFILE#{profile_id_b64}',
                'status': status,
                'addedAt': edges_data.get('addedAt', current_time),
                'updatedAt': current_time,
                'messages': edges_data.get('messages', []),
                'GSI1PK': f'USER#{user_id}',
                'GSI1SK': f'STATUS#{status}#PROFILE#{profile_id_b64}'
            }
            
            # Add processed timestamp for bad contacts
            if status == 'processed':
                user_profile_edge['processedAt'] = edges_data.get('processedAt', current_time)
            
            # Add any additional edge data
            for key, value in edges_data.items():
                if key not in ['addedAt', 'processedAt', 'messages']:
                    user_profile_edge[key] = value
            
            self.table.put_item(Item=user_profile_edge)
            
            # Create profile-to-user edge
            profile_user_edge = {
                'PK': f'PROFILE#{profile_id_b64}',
                'SK': f'USER#{user_id}',
                'addedAt': edges_data.get('addedAt', current_time),
                'status': status,
                'attempts': 1,
                'lastAttempt': current_time,
                'updatedAt': current_time
            }
            
            self.table.put_item(Item=profile_user_edge)
            
            logger.info(f"Successfully created {status} contact edges for profile {profile_id_b64}")
            
            return {
                'success': True,
                'message': f'{status.capitalize()} contact edges created successfully',
                'profileId': profile_id_b64,
                'status': status,
                'edges_created': {
                    'user_to_profile': f'USER#{user_id} -> PROFILE#{profile_id_b64}',
                    'profile_to_user': f'PROFILE#{profile_id_b64} -> USER#{user_id}'
                }
            }
            
        except Exception as e:
            logger.error(f"Error creating contact edges: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _create_edges(self, user_id, profile_id_b64, linkedin_url, updates):
        """Create initial edges between user and profile"""
        try:
            current_time = datetime.now(timezone.utc).isoformat()
            status = updates.get('status', 'pending')
            
            # Create user-to-profile edge
            user_profile_edge = {
                'PK': f'USER#{user_id}',
                'SK': f'PROFILE#{profile_id_b64}',
                'status': status,
                'addedAt': updates.get('addedAt', current_time),
                'updatedAt': current_time,
                'messages': updates.get('messages', []),
                'GSI1PK': f'USER#{user_id}',
                'GSI1SK': f'STATUS#{status}#PROFILE#{profile_id_b64}'
            }
            
            # Add processed timestamp if status is processed
            if status == 'processed':
                user_profile_edge['processedAt'] = updates.get('processedAt', current_time)
            
            self.table.put_item(Item=user_profile_edge)
            
            # Create profile-to-user edge
            profile_user_edge = {
                'PK': f'PROFILE#{profile_id_b64}',
                'SK': f'USER#{user_id}',
                'addedAt': updates.get('addedAt', current_time),
                'status': status,
                'attempts': 1,
                'lastAttempt': current_time
            }
            
            self.table.put_item(Item=profile_user_edge)
            
            return {
                'success': True,
                'message': 'Edges created successfully',
                'profileId': profile_id_b64,
                'status': status
            }
            
        except Exception as e:
            logger.error(f"Error creating edges: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _update_status(self, user_id, profile_id_b64, updates):
        """Update the status of existing edges"""
        try:
            new_status = updates.get('status')
            if not new_status:
                return {
                    'success': False,
                    'error': 'Status is required for update_status operation'
                }
            
            current_time = datetime.now(timezone.utc).isoformat()
            
            # Update user-to-profile edge
            self.table.update_item(
                Key={
                    'PK': f'USER#{user_id}',
                    'SK': f'PROFILE#{profile_id_b64}'
                },
                UpdateExpression='SET #status = :status, GSI1SK = :gsi1sk, updatedAt = :updated_at',
                ExpressionAttributeNames={
                    '#status': 'status'
                },
                ExpressionAttributeValues={
                    ':status': new_status,
                    ':gsi1sk': f'STATUS#{new_status}#PROFILE#{profile_id_b64}',
                    ':updated_at': current_time
                }
            )
            
            # Update profile-to-user edge
            self.table.update_item(
                Key={
                    'PK': f'PROFILE#{profile_id_b64}',
                    'SK': f'USER#{user_id}'
                },
                UpdateExpression='SET #status = :status, updatedAt = :updated_at',
                ExpressionAttributeNames={
                    '#status': 'status'
                },
                ExpressionAttributeValues={
                    ':status': new_status,
                    ':updated_at': current_time
                }
            )
            
            return {
                'success': True,
                'message': 'Status updated successfully',
                'profileId': profile_id_b64,
                'status': new_status
            }
            
        except Exception as e:
            logger.error(f"Error updating status: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _add_message(self, user_id, profile_id_b64, updates):
        """Add a message to the edge"""
        try:
            message = updates.get('message')
            if not message:
                return {
                    'success': False,
                    'error': 'Message is required for add_message operation'
                }
            
            current_time = datetime.now(timezone.utc).isoformat()
            
            # Add message to user-to-profile edge
            self.table.update_item(
                Key={
                    'PK': f'USER#{user_id}',
                    'SK': f'PROFILE#{profile_id_b64}'
                },
                UpdateExpression='SET messages = list_append(if_not_exists(messages, :empty_list), :message), updatedAt = :updated_at',
                ExpressionAttributeValues={
                    ':message': [{
                        'content': message,
                        'timestamp': current_time,
                        'type': updates.get('messageType', 'outbound')
                    }],
                    ':empty_list': [],
                    ':updated_at': current_time
                }
            )
            
            return {
                'success': True,
                'message': 'Message added successfully',
                'profileId': profile_id_b64
            }
            
        except Exception as e:
            logger.error(f"Error adding message: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _update_metadata(self, user_id, profile_id_b64, updates):
        """Update metadata fields on the edge"""
        try:
            if not updates:
                return {
                    'success': False,
                    'error': 'Updates are required for update_metadata operation'
                }
            
            current_time = datetime.now(timezone.utc).isoformat()
            
            # Build update expression
            update_expression_parts = ['SET updatedAt = :updated_at']
            expression_attribute_values = {':updated_at': current_time}
            expression_attribute_names = {}
            
            for key, value in updates.items():
                if key not in ['updatedAt']:  # Skip reserved fields
                    attr_name = f'#{key}'
                    attr_value = f':{key}'
                    update_expression_parts.append(f'{attr_name} = {attr_value}')
                    expression_attribute_names[attr_name] = key
                    expression_attribute_values[attr_value] = value
            
            update_expression = ', '.join(update_expression_parts)
            
            # Update user-to-profile edge
            update_params = {
                'Key': {
                    'PK': f'USER#{user_id}',
                    'SK': f'PROFILE#{profile_id_b64}'
                },
                'UpdateExpression': update_expression,
                'ExpressionAttributeValues': expression_attribute_values
            }
            
            if expression_attribute_names:
                update_params['ExpressionAttributeNames'] = expression_attribute_names
            
            self.table.update_item(**update_params)
            
            return {
                'success': True,
                'message': 'Metadata updated successfully',
                'profileId': profile_id_b64,
                'updated_fields': list(updates.keys())
            }
            
        except Exception as e:
            logger.error(f"Error updating metadata: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _check_edge_exists(self, user_id, profile_id_b64):
        """Check if an edge exists between user and profile"""
        try:
            logger.info(f"Checking edge existence for user {user_id}, profile {profile_id_b64}")
            
            # Check if user-to-profile edge exists
            response = self.table.get_item(
                Key={
                    'PK': f'USER#{user_id}',
                    'SK': f'PROFILE#{profile_id_b64}'
                }
            )
            
            edge_exists = 'Item' in response
            edge_data = response.get('Item', {}) if edge_exists else {}
            
            logger.info(f"Edge exists: {edge_exists} for user {user_id}, profile {profile_id_b64}")
            
            return {
                'success': True,
                'exists': edge_exists,
                'profileId': profile_id_b64,
                'edge_data': {
                    'status': edge_data.get('status'),
                    'addedAt': edge_data.get('addedAt'),
                    'updatedAt': edge_data.get('updatedAt'),
                    'processedAt': edge_data.get('processedAt')
                } if edge_exists else None
            }
            
        except Exception as e:
            logger.error(f"Error checking edge existence: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }


def lambda_handler(event, context):
    """
    AWS Lambda handler for edge management operations
    
    Expected event structure:
    {
        "linkedinurl": "https://linkedin.com/in/profile",
        "operation": "create|update_status|add_message|update_metadata|create_edges",
        "updates": {
            // Operation-specific data
        },
        // For create_edges operation:
        "profileId": "profile_id_or_url",
        "status": "processed|possible",
        "edgesData": {
            // Additional edge data
        }
    }
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
        
        # Extract operation type
        operation = body.get('operation', 'create')  # Default to create for backward compatibility
        
        # Handle the new create_edges operation
        if operation == 'create_edges':
            profile_id = body.get('profileId')
            status = body.get('status')
            edges_data = body.get('edgesData', {})
            
            if not profile_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                        'Access-Control-Allow-Methods': 'POST,OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'Missing required parameter: profileId'
                    })
                }
            
            if not status:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                        'Access-Control-Allow-Methods': 'POST,OPTIONS'
                    },
                    'body': json.dumps({
                        'error': 'Missing required parameter: status'
                    })
                }
            
            # Process the create_edges operation
            edge_manager = EdgeManager()
            result = edge_manager.create_contact_edges(user_id, profile_id, status, edges_data)
            
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
                        'message': 'Contact edges created successfully',
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
                        'error': 'Contact edges creation failed',
                        'details': result
                    })
                }
        
        # Handle existing operations (require linkedinurl)
        linkedin_url = body.get('linkedinurl')
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
