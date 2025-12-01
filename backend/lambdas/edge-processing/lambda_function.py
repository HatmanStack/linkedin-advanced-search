
import base64
import json
import logging
import os
from datetime import UTC, datetime

import boto3

API_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
}


def _resp(status_code, body_dict):
    return {
        'statusCode': status_code,
        'headers': API_HEADERS,
        'body': json.dumps(body_dict)
    }


def _parse_body(event):
    if 'body' in event:
        body_raw = event['body']
        if isinstance(body_raw, str):
            try:
                return json.loads(body_raw)
            except Exception:
                return {}
        return body_raw or {}
    return event or {}


def _extract_user_id(event):
    import os

    sub = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub')
    if sub:
        return sub

    dev_mode = os.environ.get('DEV_MODE', 'false').lower() == 'true'

    if dev_mode:
        auth_header = event.get('headers', {}).get('Authorization', '') or event.get('headers', {}).get('authorization', '')
        if auth_header:
            logger.warning("DEV_MODE: Authorization header present but no Cognito claims, using development user ID")
            return 'test-user-development'
        logger.warning("DEV_MODE: No authentication found, using default test user")
        return 'test-user-development'

    logger.error("No authentication found and DEV_MODE is not enabled")
    return None

logger = logging.getLogger()
logger.setLevel(logging.INFO)

DYNAMODB_TABLE_NAME = os.environ.get('DYNAMODB_TABLE_NAME', 'linkedin-advanced-search')
logger.info(f"Using DynamoDB table: {DYNAMODB_TABLE_NAME}")

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(DYNAMODB_TABLE_NAME)


class EdgeManager:

    def __init__(self):
        self.table = table

    def manage_edges(self, user_id, profile_id, operation, updates=None):
        if updates is None:
            updates = {}

        try:

            if operation == "get_connections_by_status":
                return self._get_connections_by_status(user_id, updates.get('status'))

            profile_id_b64 = base64.urlsafe_b64encode(profile_id.encode()).decode()

            logger.info(f"Managing edges for user {user_id}, profile {profile_id_b64}, operation: {operation}")

            if operation in ("upsert_status"):
                return self._upsert_status(user_id, profile_id_b64, updates)
            elif operation == "get_messages":
                return self._get_messages(user_id, profile_id_b64, updates)
            elif operation == "add_message":
                return self._add_message(user_id, profile_id_b64, updates)
            elif operation == "check_exists":
                return self._check_edge_exists(user_id, profile_id_b64)
            else:
                return {
                    'success': False,
                    'error': f'Unsupported operation: {operation}',
                    'supported_operations': ['upsert_status', 'add_message', 'check_exists', 'get_connections_by_status', 'get_messages']
                }

        except Exception as e:
            logger.error(f"Error in manage_edges: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }


    def _upsert_status(self, user_id, profile_id_b64, updates):
        try:

            status = updates.get('status', 'pending')

            current_time = datetime.now(UTC).isoformat()


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
            if status == 'processed':
                user_profile_edge['processedAt'] = updates.get('processedAt', current_time)
            self.table.put_item(Item=user_profile_edge)

            profile_user_edge = {
                'PK': f'PROFILE#{profile_id_b64}',
                'SK': f'USER#{user_id}',
                'addedAt': updates.get('addedAt', current_time),
                'status': status,
                'attempts': 1,
                'lastAttempt': current_time,
                'updatedAt': current_time
            }
            self.table.put_item(Item=profile_user_edge)

            return {
                'success': True,
                'message': 'Edge upserted successfully',
                'profileId': profile_id_b64,
                'status': status
            }
        except Exception as e:
            logger.error(f"Error upserting edges: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }


    def _add_message(self, user_id, profile_id_b64, updates):
        try:
            message = updates.get('message')
            if not message:
                return {
                    'success': False,
                    'error': 'Message is required for add_message operation'
                }

            current_time = datetime.now(UTC).isoformat()

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


    def _get_connections_by_status(self, user_id, status=None):
        try:
            logger.info(f"Fetching connections for user {user_id}, status filter: {status}")

            if status:
                response = self.table.query(
                    IndexName='GSI1',
                    KeyConditionExpression='GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
                    ExpressionAttributeValues={
                        ':pk': f'USER#{user_id}',
                        ':sk': f'STATUS#{status}#'
                    }
                )
            else:
                response = self.table.query(
                    KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
                    ExpressionAttributeValues={
                        ':pk': f'USER#{user_id}',
                        ':sk': 'PROFILE#'
                    }
                )

            connections = []
            for edge_item in response['Items']:
                try:
                    profile_id = edge_item['SK'].replace('PROFILE#', '')

                    if not profile_id:
                        logger.warning(f"Invalid profile ID in edge item: {edge_item}")
                        continue

                    try:
                        profile_response = self.table.get_item(
                            Key={
                                'PK': f'PROFILE#{profile_id}',
                                'SK': '#METADATA'
                            }
                        )
                        profile_data = profile_response.get('Item', {})
                    except Exception as e:
                        logger.warning(f"Failed to fetch profile metadata for {profile_id}: {str(e)}")
                        profile_data = {}

                    connection = self._format_connection_object(profile_id, profile_data, edge_item)
                    connections.append(connection)

                except Exception as e:
                    logger.error(f"Error processing edge item {edge_item}: {str(e)}")
                    continue

            logger.info(f"Successfully fetched {len(connections)} connections for user {user_id}")

            return {
                'success': True,
                'connections': connections,
                'count': len(connections)
            }

        except Exception as e:
            logger.error(f"Error fetching connections by status: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def _format_connection_object(self, profile_id, profile_data, edge_item):
        full_name = profile_data.get('name', '')
        name_parts = full_name.split(' ', 1) if full_name else ['', '']
        first_name = name_parts[0] if len(name_parts) > 0 else ''
        last_name = name_parts[1] if len(name_parts) > 1 else ''

        messages = edge_item.get('messages', [])
        message_count = len(messages) if isinstance(messages, list) else 0

        conversion_likelihood = None
        if edge_item.get('status') == 'possible':
            conversion_likelihood = self._calculate_conversion_likelihood(profile_data, edge_item)

        connection = {
            'id': profile_id,
            'first_name': first_name,
            'last_name': last_name,
            'position': profile_data.get('currentTitle', ''),
            'company': profile_data.get('currentCompany', ''),
            'location': profile_data.get('currentLocation', ''),
            'headline': profile_data.get('headline', ''),
            'recent_activity': profile_data.get('summary', ''),
            'common_interests': profile_data.get('skills', []) if isinstance(profile_data.get('skills'), list) else [],
            'messages': message_count,
            'date_added': edge_item.get('addedAt', ''),
            'linkedin_url': profile_data.get('originalUrl', ''),
            'tags': profile_data.get('skills', []) if isinstance(profile_data.get('skills'), list) else [],
            'last_action_summary': edge_item.get('lastActionSummary', ''),
            'status': edge_item.get('status', ''),
            'conversion_likelihood': conversion_likelihood,
            'message_history': messages if isinstance(messages, list) else []
        }

        return connection

    def _calculate_conversion_likelihood(self, profile_data, edge_item):
        try:
            score = 0

            if profile_data.get('headline'):
                score += 10
            if profile_data.get('summary'):
                score += 10
            if profile_data.get('currentCompany'):
                score += 10
            if profile_data.get('skills') and len(profile_data.get('skills', [])) > 3:
                score += 10

            if profile_data.get('summary') and len(profile_data.get('summary', '')) > 100:
                score += 15

            if edge_item.get('addedAt'):
                try:
                    added_time = datetime.fromisoformat(edge_item['addedAt'].replace('Z', '+00:00'))
                    days_since_added = (datetime.now(UTC) - added_time).days

                    if days_since_added < 7:
                        score += 15
                    elif days_since_added < 30:
                        score += 10
                    else:
                        score += 5
                except Exception as e:
                    logger.warning(f"Error parsing addedAt timestamp: {str(e)}")
                    score += 5  # Default score

            attempts = edge_item.get('attempts', 0)
            if attempts == 0:
                score += 15  # Fresh connection
            elif attempts == 1:
                score += 10
            else:
                score += 5  # Multiple attempts lower likelihood

            return min(score, 100)  # Cap at 100%

        except Exception as e:
            logger.warning(f"Error calculating conversion likelihood: {str(e)}")
            return 50  # Default fallback score

    def _get_messages(self, user_id, profile_id):
        try:
            if not profile_id:
                return {
                    'success': False,
                    'error': 'profileId is required for get_messages operation'
                }

            logger.info(f"Fetching messages for user {user_id}, profile {profile_id}")

            response = self.table.get_item(
                Key={
                    'PK': f'USER#{user_id}',
                    'SK': f'PROFILE#{profile_id}'
                }
            )

            if 'Item' not in response:
                logger.warning(f"No edge found for user {user_id}, profile {profile_id}")
                return {
                    'success': True,
                    'messages': [],
                    'count': 0
                }

            edge_item = response['Item']
            raw_messages = edge_item.get('messages', [])

            formatted_messages = []
            for i, msg in enumerate(raw_messages):
                try:
                    if isinstance(msg, str):
                        formatted_message = {
                            'id': f'{profile_id}_{i}',
                            'content': msg,
                            'timestamp': edge_item.get('addedAt', ''),
                            'sender': 'user'  # Default assumption for string messages
                        }
                    elif isinstance(msg, dict):
                        formatted_message = {
                            'id': msg.get('id', f'{profile_id}_{i}'),
                            'content': msg.get('content', str(msg)),
                            'timestamp': msg.get('timestamp', edge_item.get('addedAt', '')),
                            'sender': msg.get('sender', msg.get('type', 'user'))  # Handle both 'sender' and 'type' fields
                        }

                        if formatted_message['sender'] == 'outbound':
                            formatted_message['sender'] = 'user'
                        elif formatted_message['sender'] == 'inbound':
                            formatted_message['sender'] = 'connection'
                    else:
                        formatted_message = {
                            'id': f'{profile_id}_{i}',
                            'content': str(msg),
                            'timestamp': edge_item.get('addedAt', ''),
                            'sender': 'user'
                        }

                    formatted_messages.append(formatted_message)

                except Exception as e:
                    logger.warning(f"Error formatting message {i} for profile {profile_id}: {str(e)}")
                    formatted_messages.append({
                        'id': f'{profile_id}_{i}_error',
                        'content': f'[Message formatting error: {str(msg)[:100]}]',
                        'timestamp': edge_item.get('addedAt', ''),
                        'sender': 'user'
                    })
                    continue

            logger.info(f"Successfully fetched {len(formatted_messages)} messages for user {user_id}, profile {profile_id}")

            return {
                'success': True,
                'messages': formatted_messages,
                'count': len(formatted_messages)
            }

        except Exception as e:
            logger.error(f"Error fetching messages: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def _check_edge_exists(self, user_id, profile_id_b64):
        try:
            logger.info(f"Checking edge existence for user {user_id}, profile {profile_id_b64}")

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
    try:
        logger.info(f"Received event: {json.dumps(event)[:2000]}")

        body = _parse_body(event)
        profileId = body.get('profileId')  # noqa: N806 - matches API contract
        operation = body.get('operation')
        updates = body.get('updates', {})

        user_id = _extract_user_id(event)
        if not user_id:
            return _resp(401, { 'error': 'Unauthorized: Missing or invalid JWT token' })

        edge_manager = EdgeManager()
        if operation == "get_connections_by_status":
            result = edge_manager.manage_edges(user_id, None ,operation, updates)
        else:
            result = edge_manager.manage_edges(user_id, profileId, operation, updates)

        if result['success'] and operation == "get_connections_by_status":
            return _resp(200, { 'message': 'Connections fetched successfully', 'connections': result['connections'], 'count': result['count'] })
        else:
            return _resp(200, { 'error': f'Edge {operation} operation failed','details': result , 'result': result, 'message': f'Edge {operation} operation completed successfully'})


    except Exception as e:
        logger.error(f"Unexpected error in lambda_handler: {str(e)}")
        return _resp(500, { 'error': 'Internal server error' })
