"""
LinkedIn Profile Processing Lambda Function

Thin handler that delegates business logic to ProfileProcessingService.
Processes profile screenshots uploaded to S3 via SQS trigger.
"""

import json
import logging
import os
import sys
from pathlib import Path

import boto3

# Add paths for imports
LAMBDA_PATH = Path(__file__).parent
SHARED_PATH = LAMBDA_PATH.parent / 'shared' / 'python'
sys.path.insert(0, str(SHARED_PATH))
sys.path.insert(0, str(LAMBDA_PATH))

from errors.exceptions import (
    ExternalServiceError,
    NotFoundError,
    ServiceError,
    ValidationError,
)
from services.profile_processing_service import ProfileProcessingService

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Configuration
AWS_REGION = os.environ.get('AWS_REGION', 'us-west-2')
AI_MODEL_ID = os.environ.get('AI_MODEL_ID', 'us.meta.llama3-2-90b-instruct-v1:0')
DYNAMODB_TABLE_NAME = os.environ.get('DYNAMODB_TABLE_NAME', 'linkedin-advanced-search')

# Initialize AWS clients
s3_client = boto3.client('s3', region_name=AWS_REGION)
bedrock_client = boto3.client('bedrock-runtime', region_name=AWS_REGION)
dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
table = dynamodb.Table(DYNAMODB_TABLE_NAME)


def lambda_handler(event, context):
    """
    AWS Lambda handler for profile screenshot processing.

    Triggered by SQS with S3 event notifications.
    """
    try:
        logger.info(f"Processing event: {json.dumps(event)[:1000]}")

        # Create service with injected dependencies
        service = ProfileProcessingService(
            s3_client=s3_client,
            bedrock_client=bedrock_client,
            table=table,
            ai_model_id=AI_MODEL_ID
        )

        processed_count = 0

        # Process SQS records
        for record in event.get('Records', []):
            if record.get('eventSource') != 'aws:sqs':
                continue

            # Parse S3 event from SQS message
            message_body = json.loads(record.get('body', '{}'))

            # Handle S3 event notification format
            if 'Records' in message_body:
                for s3_record in message_body['Records']:
                    if s3_record.get('eventSource') != 'aws:s3':
                        continue

                    bucket = s3_record['s3']['bucket']['name']
                    key = s3_record['s3']['object']['key']

                    # Only process Profile images
                    filename = key.split('/')[-1]
                    if 'Profile' not in filename:
                        logger.info(f"Skipping non-Profile file: {key}")
                        continue
                    if not key.lower().endswith(('.png', '.jpg', '.jpeg')):
                        logger.info(f"Skipping non-image file: {key}")
                        continue

                    logger.info(f"Processing: s3://{bucket}/{key}")
                    result = service.process(bucket, key)
                    logger.info(f"Processed profile: {result['profile_id']}")
                    processed_count += 1

            # Handle legacy format
            elif 'bucket' in message_body and 'profile_directory' in message_body:
                bucket = message_body['bucket']
                profile_dir = message_body['profile_directory']

                # Find latest Profile file
                profile_key = _find_latest_profile(bucket, profile_dir)
                if profile_key:
                    result = service.process(bucket, profile_key)
                    logger.info(f"Processed profile: {result['profile_id']}")
                    processed_count += 1

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Profile processing completed',
                'processed_count': processed_count
            })
        }

    except ValidationError as e:
        logger.warning(f"Validation error: {e}")
        return {'statusCode': 400, 'body': json.dumps({'error': e.message})}

    except NotFoundError as e:
        logger.warning(f"Not found: {e}")
        return {'statusCode': 404, 'body': json.dumps({'error': e.message})}

    except ExternalServiceError as e:
        logger.error(f"External service error: {e}")
        return {'statusCode': 502, 'body': json.dumps({'error': e.message})}

    except ServiceError as e:
        logger.error(f"Service error: {e}")
        return {'statusCode': 500, 'body': json.dumps({'error': e.message})}

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return {'statusCode': 500, 'body': json.dumps({'error': 'Internal server error'})}


def _find_latest_profile(bucket: str, directory: str) -> str | None:
    """Find most recent Profile file in S3 directory."""
    try:
        if not directory.endswith('/'):
            directory += '/'

        response = s3_client.list_objects_v2(Bucket=bucket, Prefix=directory)

        if 'Contents' not in response:
            return None

        profile_files = []
        for obj in response['Contents']:
            key = obj['Key']
            filename = key.split('/')[-1]

            if key.endswith('/') or 'Profile' not in filename:
                continue
            if not key.lower().endswith(('.png', '.jpg', '.jpeg')):
                continue

            profile_files.append({
                'key': key,
                'last_modified': obj['LastModified']
            })

        if not profile_files:
            return None

        profile_files.sort(key=lambda x: x['last_modified'], reverse=True)
        return profile_files[0]['key']

    except Exception as e:
        logger.error(f"Error finding profile file: {e}")
        return None
