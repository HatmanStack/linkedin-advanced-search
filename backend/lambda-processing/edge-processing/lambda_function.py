import json
import os
import boto3
import logging
from datetime import datetime
from base64 import b64encode

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['DYNAMODB_TABLE_NAME'])

def create_edges(user_id, linkedin_url):
    """Create User-to-Profile and Profile-to-User edges"""
    try:
        profile_id_b64 = b64encode(linkedin_url.encode()).decode()
        profile_id = f"PROFILE#{profile_id_b64}"
        
        # Check if profile exists
        profile_response = table.get_item(
            Key={
                'PK': profile_id,
                'SK': '#METADATA'
            }
        )
        
        if 'Item' not in profile_response:
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'Profile not found'})
            }

        timestamp = datetime.utcnow().isoformat()

        # Create both edges in a transaction
        dynamodb.client.transact_write_items(
            TransactItems=[
                {
                    'Put': {
                        'TableName': os.environ['DYNAMODB_TABLE_NAME'],
                        'Item': {
                            'PK': f"USER#{user_id}",
                            'SK': f"PROFILE#{profile_id_b64}",
                            'GSI1PK': f"USER#{user_id}",
                            'GSI1SK': f"STATUS#possible#PROFILE#{profile_id_b64}",
                            'status': 'possible',
                            'addedAt': timestamp,
                            'messages': []
                        }
                    }
                },
                {
                    'Put': {
                        'TableName': os.environ['DYNAMODB_TABLE_NAME'],
                        'Item': {
                            'PK': f"PROFILE#{profile_id_b64}",
                            'SK': f"USER#{user_id}",
                            'status': 'possible',
                            'addedAt': timestamp,
                            'attempts': 0,
                            'lastFailedAttempt': None
                        }
                    }
                }
            ]
        )

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Edges created successfully',
                'userId': user_id,
                'profileId': profile_id
            })
        }

    except Exception as e:
        logger.error(f"Error creating edges: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def update_edge_status(user_id, linkedin_url, new_status):
    """Update the status of both edges"""
    try:
        profile_id_b64 = b64encode(linkedin_url.encode()).decode()
        timestamp = datetime.utcnow().isoformat()

        # Update both edges in a transaction
        dynamodb.client.transact_write_items(
            TransactItems=[
                {
                    'Update': {
                        'TableName': os.environ['DYNAMODB_TABLE_NAME'],
                        'Key': {
                            'PK': f"USER#{user_id}",
                            'SK': f"PROFILE#{profile_id_b64}"
                        },
                        'UpdateExpression': 'SET #status = :status, GSI1SK = :gsi1sk',
                        'ExpressionAttributeNames': {
                            '#status': 'status'
                        },
                        'ExpressionAttributeValues': {
                            ':status': new_status,
                            ':gsi1sk': f"STATUS#{new_status}#PROFILE#{profile_id_b64}"
                        }
                    }
                },
                {
                    'Update': {
                        'TableName': os.environ['DYNAMODB_TABLE_NAME'],
                        'Key': {
                            'PK': f"PROFILE#{profile_id_b64}",
                            'SK': f"USER#{user_id}"
                        },
                        'UpdateExpression': 'SET #status = :status',
                        'ExpressionAttributeNames': {
                            '#status': 'status'
                        },
                        'ExpressionAttributeValues': {
                            ':status': new_status
                        }
                    }
                }
            ]
        )

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Edge status updated successfully',
                'userId': user_id,
                'profileId': f"PROFILE#{profile_id_b64}",
                'newStatus': new_status
            })
        }

    except Exception as e:
        logger.error(f"Error updating edge status: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def lambda_handler(event, context):
    """Main Lambda handler"""
    try:
        # Extract user ID from Cognito authorizer
        user_id = event['requestContext']['authorizer']['claims']['sub']
        
        # Parse request body
        body = json.loads(event['body'])
        
        # Route based on action
        action = body.get('action')
        
        if action == 'create':
            return create_edges(user_id, body['linkedinUrl'])
        elif action == 'updateStatus':
            return update_edge_status(user_id, body['linkedinUrl'], body['newStatus'])
        else:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Invalid action'})
            }

    except Exception as e:
        logger.error(f"Lambda handler error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
