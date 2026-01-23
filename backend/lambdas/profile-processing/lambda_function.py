"""LinkedIn Profile Processing Lambda - Processes profile screenshots from S3."""
import json
import logging
import os

import boto3
from errors.exceptions import ExternalServiceError, NotFoundError, ServiceError, ValidationError
from services.profile_processing_service import ProfileProcessingService

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Clients
region = os.environ.get('AWS_REGION', 'us-west-2')
s3 = boto3.client('s3', region_name=region)
bedrock = boto3.client('bedrock-runtime', region_name=region)
table = boto3.resource('dynamodb', region_name=region).Table(os.environ.get('DYNAMODB_TABLE_NAME', 'linkedin-advanced-search'))


def lambda_handler(event, context):
    """Process profile screenshots from S3 via SQS trigger."""
    try:
        svc = ProfileProcessingService(s3_client=s3, bedrock_client=bedrock, table=table)
        processed = 0

        for record in event.get('Records', []):
            if record.get('eventSource') != 'aws:sqs':
                continue
            msg = json.loads(record.get('body', '{}'))

            for s3_rec in msg.get('Records', []):
                if s3_rec.get('eventSource') != 'aws:s3':
                    continue
                bucket, key = s3_rec['s3']['bucket']['name'], s3_rec['s3']['object']['key']
                if 'Profile' not in key.split('/')[-1] or not key.lower().endswith(('.png', '.jpg', '.jpeg')):
                    continue
                svc.process(bucket, key)
                processed += 1

            if 'bucket' in msg and 'profile_directory' in msg:
                key = _find_profile(msg['bucket'], msg['profile_directory'])
                if key:
                    svc.process(msg['bucket'], key)
                    processed += 1

        return {'statusCode': 200, 'body': json.dumps({'processed': processed})}

    except ValidationError as e:
        return {'statusCode': 400, 'body': json.dumps({'error': e.message})}
    except NotFoundError as e:
        return {'statusCode': 404, 'body': json.dumps({'error': e.message})}
    except ExternalServiceError as e:
        return {'statusCode': 502, 'body': json.dumps({'error': e.message})}
    except ServiceError as e:
        return {'statusCode': 500, 'body': json.dumps({'error': e.message})}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {'statusCode': 500, 'body': json.dumps({'error': 'Internal server error'})}


def _find_profile(bucket, directory):
    """Find most recent Profile file in S3 directory."""
    try:
        prefix = directory if directory.endswith('/') else directory + '/'
        resp = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
        files = [{'key': o['Key'], 'ts': o['LastModified']} for o in resp.get('Contents', [])
                 if 'Profile' in o['Key'].split('/')[-1] and o['Key'].lower().endswith(('.png', '.jpg', '.jpeg'))]
        return max(files, key=lambda x: x['ts'])['key'] if files else None
    except Exception:
        return None
