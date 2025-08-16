import json
import os
import time
import hmac
import hashlib
import base64
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    """
    Minimal OpenAI webhook handler with signature verification
    """
    try:
        # Get environment variables
        webhook_secret = os.environ.get('OPENAI_WEBHOOK_SECRET')
        max_skew_seconds = int(os.environ.get('MAX_SKEW_SECONDS', '300'))
        
        if not webhook_secret:
            logger.error("OPENAI_WEBHOOK_SECRET not configured")
            return {
                'statusCode': 500,
                'body': ''
            }
        
        # Extract headers
        headers = event.get('headers', {})
        signature = headers.get('openai-signature')
        timestamp_header = headers.get('openai-timestamp')
        
        if not signature or not timestamp_header:
            logger.warning("Missing required headers")
            return {
                'statusCode': 401,
                'body': ''
            }
        
        # Get raw body
        body = event.get('body', '')
        if event.get('isBase64Encoded', False):
            body = base64.b64decode(body).decode('utf-8')
        
        # Verify timestamp (prevent replay attacks)
        try:
            timestamp = int(timestamp_header)
            current_time = int(time.time())
            if abs(current_time - timestamp) > max_skew_seconds:
                logger.warning(f"Timestamp too old: {timestamp} vs {current_time}")
                return {
                    'statusCode': 401,
                    'body': ''
                }
        except ValueError:
            logger.warning("Invalid timestamp format")
            return {
                'statusCode': 401,
                'body': ''
            }
        
        # Verify signature
        payload = f"{timestamp_header}.{body}"
        expected_signature = hmac.new(
            webhook_secret.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        # Extract signature from header (format: "sha256=<signature>")
        if not signature.startswith('sha256='):
            logger.warning("Invalid signature format")
            return {
                'statusCode': 401,
                'body': ''
            }
        
        received_signature = signature[7:]  # Remove "sha256=" prefix
        
        # Constant-time comparison
        if not hmac.compare_digest(expected_signature, received_signature):
            logger.warning("Signature verification failed")
            return {
                'statusCode': 401,
                'body': ''
            }
        
        # Log minimal fields for successful webhook
        logger.info(f"Valid webhook received - timestamp: {timestamp_header}, body_length: {len(body)}")
        
        # Return 200 immediately
        return {
            'statusCode': 200,
            'body': ''
        }
        
    except Exception as e:
        logger.error(f"Webhook processing error: {str(e)}")
        return {
            'statusCode': 500,
            'body': ''
        }
