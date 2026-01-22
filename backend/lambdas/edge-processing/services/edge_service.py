"""EdgeService - Business logic for edge management operations."""
import base64
import json
import logging
from datetime import UTC, datetime
from typing import Any

from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError

# Shared layer imports (from /opt/python via Lambda Layer)
from errors.exceptions import ExternalServiceError, ValidationError
from models.enums import classify_conversion_likelihood
from shared_services.base_service import BaseService

logger = logging.getLogger(__name__)

# Statuses that trigger RAGStack ingestion
INGESTION_TRIGGER_STATUSES = {'outgoing', 'ally', 'followed'}


class EdgeService(BaseService):
    """
    Service class for managing edges between users and profiles.

    Handles all business logic for edge operations, with AWS clients
    injected via constructor for testability.
    """

    def __init__(
        self,
        table,
        lambda_client=None,
        ragstack_function_name: str | None = None
    ):
        """
        Initialize EdgeService with injected dependencies.

        Args:
            table: DynamoDB Table resource
            lambda_client: Optional Lambda client for RAGStack invocation
            ragstack_function_name: Optional RAGStack proxy function name
        """
        super().__init__()
        self.table = table
        self.lambda_client = lambda_client
        self.ragstack_function_name = ragstack_function_name

    def health_check(self) -> dict[str, Any]:
        """Check service health by verifying table access."""
        try:
            # reload() fetches current table metadata from DynamoDB
            self.table.reload()
            status = self.table.table_status
            return {
                'healthy': status == 'ACTIVE',
                'details': {'table_status': status}
            }
        except Exception as e:
            return {
                'healthy': False,
                'details': {'error': str(e)}
            }

    def upsert_status(
        self,
        user_id: str,
        profile_id: str,
        status: str,
        added_at: str | None = None,
        messages: list | None = None
    ) -> dict[str, Any]:
        """
        Create or update edge status (idempotent upsert).

        Args:
            user_id: User ID from Cognito
            profile_id: LinkedIn profile URL/identifier
            status: Edge status (possible, outgoing, ally, etc.)
            added_at: Optional timestamp override
            messages: Optional initial messages list

        Returns:
            dict with success status and profile ID

        Raises:
            ExternalServiceError: On DynamoDB failures
        """
        try:
            profile_id_b64 = base64.urlsafe_b64encode(profile_id.encode()).decode()
            current_time = datetime.now(UTC).isoformat()

            # Create user-to-profile edge
            user_profile_edge = {
                'PK': f'USER#{user_id}',
                'SK': f'PROFILE#{profile_id_b64}',
                'status': status,
                'addedAt': added_at or current_time,
                'updatedAt': current_time,
                'messages': messages or [],
                'GSI1PK': f'USER#{user_id}',
                'GSI1SK': f'STATUS#{status}#PROFILE#{profile_id_b64}'
            }
            if status == 'processed':
                user_profile_edge['processedAt'] = current_time

            # Use transactional write for atomicity - both edges succeed or both fail
            # profile_user_edge uses Update to preserve/increment attempts counter
            table_name = self.table.table_name
            serializer = TypeSerializer()
            self.table.meta.client.transact_write_items(
                TransactItems=[
                    {'Put': {'TableName': table_name, 'Item': self._serialize_item(user_profile_edge)}},
                    {'Update': {
                        'TableName': table_name,
                        'Key': {
                            'PK': serializer.serialize(f'PROFILE#{profile_id_b64}'),
                            'SK': serializer.serialize(f'USER#{user_id}')
                        },
                        'UpdateExpression': 'SET addedAt = if_not_exists(addedAt, :added), #status = :status, lastAttempt = :lastAttempt, updatedAt = :updated ADD attempts :inc',
                        'ExpressionAttributeNames': {'#status': 'status'},
                        'ExpressionAttributeValues': {
                            ':added': serializer.serialize(added_at or current_time),
                            ':status': serializer.serialize(status),
                            ':lastAttempt': serializer.serialize(current_time),
                            ':updated': serializer.serialize(current_time),
                            ':inc': serializer.serialize(1)
                        }
                    }}
                ]
            )

            # Trigger RAGStack ingestion for established relationships
            ragstack_ingested = False
            ragstack_error = None

            if status in INGESTION_TRIGGER_STATUSES:
                ingestion_result = self._trigger_ragstack_ingestion(
                    profile_id_b64, user_id
                )
                if ingestion_result.get('success'):
                    ragstack_ingested = True
                    self._update_ingestion_flag(user_id, profile_id_b64, current_time)
                else:
                    ragstack_error = ingestion_result.get('error')

            return {
                'success': True,
                'message': 'Edge upserted successfully',
                'profileId': profile_id_b64,
                'status': status,
                'ragstack_ingested': ragstack_ingested,
                'ragstack_error': ragstack_error
            }

        except ClientError as e:
            logger.error(f"DynamoDB error in upsert_status: {e}")
            raise ExternalServiceError(
                message='Failed to upsert edge',
                service='DynamoDB',
                original_error=str(e)
            ) from e

    def add_message(
        self,
        user_id: str,
        profile_id_b64: str,
        message: str,
        message_type: str = 'outbound'
    ) -> dict[str, Any]:
        """
        Add a message to an existing edge.

        Args:
            user_id: User ID
            profile_id_b64: Base64-encoded profile ID
            message: Message content
            message_type: Message type (outbound/inbound)

        Returns:
            dict with success status

        Raises:
            ValidationError: If message is empty
            ExternalServiceError: On DynamoDB failures
        """
        if not message or not message.strip():
            raise ValidationError('Message is required', field='message')

        try:
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
                        'type': message_type
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

        except ClientError as e:
            logger.error(f"DynamoDB error in add_message: {e}")
            raise ExternalServiceError(
                message='Failed to add message',
                service='DynamoDB',
                original_error=str(e)
            ) from e

    def get_connections_by_status(
        self,
        user_id: str,
        status: str | None = None
    ) -> dict[str, Any]:
        """
        Get user connections, optionally filtered by status.

        Args:
            user_id: User ID
            status: Optional status filter

        Returns:
            dict with connections list and count
        """
        try:
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
            for edge_item in response.get('Items', []):
                profile_id = edge_item['SK'].replace('PROFILE#', '')
                if not profile_id:
                    continue

                profile_data = self._get_profile_metadata(profile_id)
                connection = self._format_connection_object(
                    profile_id, profile_data, edge_item
                )
                connections.append(connection)

            return {
                'success': True,
                'connections': connections,
                'count': len(connections)
            }

        except ClientError as e:
            logger.error(f"DynamoDB error in get_connections_by_status: {e}")
            raise ExternalServiceError(
                message='Failed to get connections',
                service='DynamoDB',
                original_error=str(e)
            ) from e

    def get_messages(
        self,
        user_id: str,
        profile_id_b64: str
    ) -> dict[str, Any]:
        """
        Get message history for an edge.

        Args:
            user_id: User ID
            profile_id_b64: Base64-encoded profile ID

        Returns:
            dict with formatted messages list
        """
        try:
            response = self.table.get_item(
                Key={
                    'PK': f'USER#{user_id}',
                    'SK': f'PROFILE#{profile_id_b64}'
                }
            )

            if 'Item' not in response:
                return {
                    'success': True,
                    'messages': [],
                    'count': 0
                }

            edge_item = response['Item']
            raw_messages = edge_item.get('messages', [])
            formatted_messages = self._format_messages(
                raw_messages, profile_id_b64, edge_item
            )

            return {
                'success': True,
                'messages': formatted_messages,
                'count': len(formatted_messages)
            }

        except ClientError as e:
            logger.error(f"DynamoDB error in get_messages: {e}")
            raise ExternalServiceError(
                message='Failed to get messages',
                service='DynamoDB',
                original_error=str(e)
            ) from e

    def check_exists(
        self,
        user_id: str,
        profile_id_b64: str
    ) -> dict[str, Any]:
        """
        Check if an edge exists between user and profile.

        Args:
            user_id: User ID
            profile_id_b64: Base64-encoded profile ID

        Returns:
            dict with exists flag and edge data if exists
        """
        try:
            response = self.table.get_item(
                Key={
                    'PK': f'USER#{user_id}',
                    'SK': f'PROFILE#{profile_id_b64}'
                }
            )

            edge_exists = 'Item' in response
            edge_data = response.get('Item', {}) if edge_exists else {}

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

        except ClientError as e:
            logger.error(f"DynamoDB error in check_exists: {e}")
            raise ExternalServiceError(
                message='Failed to check edge existence',
                service='DynamoDB',
                original_error=str(e)
            ) from e

    # =========================================================================
    # Private helper methods
    # =========================================================================

    def _serialize_item(self, item: dict) -> dict:
        """Serialize a Python dict to DynamoDB low-level format for transact_write_items."""
        serializer = TypeSerializer()
        return {k: serializer.serialize(v) for k, v in item.items()}

    def _get_profile_metadata(self, profile_id: str) -> dict:
        """Fetch profile metadata from DynamoDB."""
        try:
            response = self.table.get_item(
                Key={
                    'PK': f'PROFILE#{profile_id}',
                    'SK': '#METADATA'
                }
            )
            return response.get('Item', {})
        except Exception as e:
            logger.warning(f"Failed to fetch profile metadata: {e}")
            return {}

    def _format_connection_object(
        self,
        profile_id: str,
        profile_data: dict,
        edge_item: dict
    ) -> dict:
        """Format connection object for frontend consumption."""
        full_name = profile_data.get('name', '')
        name_parts = full_name.split(' ', 1) if full_name else ['', '']
        first_name = name_parts[0] if name_parts else ''
        last_name = name_parts[1] if len(name_parts) > 1 else ''

        messages = edge_item.get('messages', [])
        message_count = len(messages) if isinstance(messages, list) else 0

        # Use enum-based conversion likelihood
        conversion_likelihood = None
        if edge_item.get('status') == 'possible':
            conversion_likelihood = self._calculate_conversion_likelihood(
                profile_data, edge_item
            )

        return {
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

    def _calculate_conversion_likelihood(
        self,
        profile_data: dict,
        edge_item: dict
    ) -> str:
        """
        Calculate conversion likelihood using enum classification.

        Returns string enum value ('high', 'medium', 'low').
        """
        # Map edge_item fields to expected format
        edge_data = {
            'date_added': edge_item.get('addedAt'),
            'connection_attempts': edge_item.get('attempts', 0)
        }

        # Map profile_data fields
        profile = {
            'headline': profile_data.get('headline'),
            'summary': profile_data.get('summary')
        }

        result = classify_conversion_likelihood(profile, edge_data)
        return result.value

    def _format_messages(
        self,
        raw_messages: list,
        profile_id: str,
        edge_item: dict
    ) -> list[dict]:
        """Format raw messages for frontend consumption."""
        formatted = []

        for i, msg in enumerate(raw_messages):
            try:
                if isinstance(msg, str):
                    formatted_msg = {
                        'id': f'{profile_id}_{i}',
                        'content': msg,
                        'timestamp': edge_item.get('addedAt', ''),
                        'sender': 'user'
                    }
                elif isinstance(msg, dict):
                    sender = msg.get('sender', msg.get('type', 'user'))
                    if sender == 'outbound':
                        sender = 'user'
                    elif sender == 'inbound':
                        sender = 'connection'

                    formatted_msg = {
                        'id': msg.get('id', f'{profile_id}_{i}'),
                        'content': msg.get('content', str(msg)),
                        'timestamp': msg.get('timestamp', edge_item.get('addedAt', '')),
                        'sender': sender
                    }
                else:
                    formatted_msg = {
                        'id': f'{profile_id}_{i}',
                        'content': str(msg),
                        'timestamp': edge_item.get('addedAt', ''),
                        'sender': 'user'
                    }

                formatted.append(formatted_msg)

            except Exception as e:
                logger.warning(f"Error formatting message {i}: {e}")
                formatted.append({
                    'id': f'{profile_id}_{i}_error',
                    'content': '[Message formatting error]',
                    'timestamp': edge_item.get('addedAt', ''),
                    'sender': 'user'
                })

        return formatted

    def _trigger_ragstack_ingestion(
        self,
        profile_id_b64: str,
        user_id: str
    ) -> dict:
        """Trigger RAGStack ingestion for a profile."""
        if not self.ragstack_function_name or not self.lambda_client:
            logger.warning("RAGStack not configured, skipping ingestion")
            return {'success': False, 'error': 'RAGStack not configured'}

        try:
            profile_data = self._get_profile_metadata(profile_id_b64)
            if not profile_data:
                return {'success': False, 'error': 'Profile metadata not found'}

            profile_data['profile_id'] = profile_id_b64

            # Generate markdown (late import to avoid circular dependencies)
            try:
                from utils.profile_markdown import generate_profile_markdown
                markdown_content = generate_profile_markdown(profile_data)
            except ImportError as e:
                logger.error(f"Failed to import profile_markdown: {e}")
                return {'success': False, 'error': 'Markdown generator module not available'}
            except Exception as e:
                logger.error(f"Error generating markdown: {e}")
                return {'success': False, 'error': f'Markdown generation failed: {e}'}

            payload = {
                'body': json.dumps({
                    'operation': 'ingest',
                    'profileId': profile_id_b64,
                    'markdownContent': markdown_content,
                    'metadata': {
                        'user_id': user_id,
                        'source': 'edge_processing'
                    }
                }),
                'requestContext': {
                    'authorizer': {
                        'claims': {'sub': user_id}
                    }
                }
            }

            response = self.lambda_client.invoke(
                FunctionName=self.ragstack_function_name,
                InvocationType='Event',
                Payload=json.dumps(payload)
            )

            status_code = response.get('StatusCode', 0)
            if status_code in (200, 202):
                return {'success': True, 'status': 'triggered'}
            else:
                return {'success': False, 'error': f'Lambda invoke failed: {status_code}'}

        except Exception as e:
            logger.error(f"Error triggering RAGStack ingestion: {e}")
            return {'success': False, 'error': str(e)}

    def _update_ingestion_flag(
        self,
        user_id: str,
        profile_id_b64: str,
        timestamp: str
    ) -> None:
        """Update edge with RAGStack ingestion status."""
        try:
            self.table.update_item(
                Key={
                    'PK': f'USER#{user_id}',
                    'SK': f'PROFILE#{profile_id_b64}'
                },
                UpdateExpression='SET ragstack_ingested = :ingested, ragstack_ingested_at = :ingested_at',
                ExpressionAttributeValues={
                    ':ingested': True,
                    ':ingested_at': timestamp
                }
            )
        except Exception as e:
            logger.warning(f"Failed to update ingestion flag: {e}")
