import os
import json
import base64
import logging
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

from openai import OpenAI, InvalidWebhookSignatureError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Create a single client at import time (reused across invocations)
client = OpenAI()  # Requires OPENAI_API_KEY to be set in the Lambda environment

# Optional DynamoDB client (enabled when DYNAMODB_TABLE_NAME is set)
_TABLE_NAME = os.environ.get("DYNAMODB_TABLE_NAME")
_dynamodb = None
_table = None
try:
    if _TABLE_NAME:
        _dynamodb = boto3.resource("dynamodb")
        _table = _dynamodb.Table(_TABLE_NAME)
except Exception as _e:  # pragma: no cover
    _table = None

def _normalize_headers(h):
    """Return a case-insensitive header dict (all-lowercase keys)."""
    return { (k.lower() if isinstance(k, str) else k): v for k, v in (h or {}).items() }

def lambda_handler(event, context):
    """
    OpenAI webhook handler for AWS Lambda + API Gateway (REST/HTTP).
    Verifies signatures per the OpenAI Webhooks guide using the SDK helper.
    """
    try:
        webhook_secret = os.environ.get("OPENAI_WEBHOOK_SECRET")
        if not webhook_secret:
            logger.error("OPENAI_WEBHOOK_SECRET not configured")
            return {"statusCode": 500, "body": ""}

        # Headers: normalize to lowercase keys; unwrap will treat header names case-insensitively
        headers_in = _normalize_headers(event.get("headers", {}))

        # Require standard webhook headers
        missing = [h for h in ("webhook-id", "webhook-timestamp", "webhook-signature") if h not in headers_in]
        if missing:
            logger.warning(f"Missing required webhook headers: {missing}")
            return {"statusCode": 401, "body": ""}

        # Get the raw request body as text (unwrap expects the exact raw payload)
        body = event.get("body", "")
        if event.get("isBase64Encoded", False):
            # API Gateway can base64-encode the raw bytes; decode to text
            try:
                body_bytes = base64.b64decode(body)
                body = body_bytes.decode("utf-8")
            except Exception as e:
                logger.warning(f"Failed to decode base64 body: {e}")
                return {"statusCode": 400, "body": ""}

        # Verify signature and parse the event with the SDK helper
        try:
            # Pass the normalized headers; unwrap verifies signature (v1,<base64>) and timestamp
            evt = client.webhooks.unwrap(body, headers_in, secret=webhook_secret)
        except InvalidWebhookSignatureError as e:
            logger.warning(f"Invalid webhook signature: {e}")
            return {"statusCode": 400, "body": ""}

        # At this point, the event is verified. Minimal logging and quick 200 response.
        logger.info(f"Webhook verified: type={getattr(evt, 'type', None)} id={getattr(evt, 'id', None)}")

        # Optional: handle specific events (e.g., response.completed) without blocking the 200.
        # For very fast lookups you can do it inline; otherwise, enqueue to a worker and return immediately.
        if getattr(evt, "type", None) == "response.completed":
            try:
                response_id = evt.data.id  # The Response ID
                resp = client.responses.retrieve(response_id)

                # Extract any metadata you attached during create (e.g., job_id, user_id)
                meta = getattr(resp, "metadata", {}) or {}
                logger.info(
                    "response.completed retrieved: id=%s status=%s job_id=%s user_id=%s",
                    response_id,
                    getattr(resp, "status", None),
                    meta.get("job_id"),
                    meta.get("user_id"),
                )

                # Store result in DynamoDB for later retrieval by (user_id, job_id)
                # If metadata.kind == "IDEAS" store under IDEAS#{job_id} with 'ideas' list
                # If metadata.kind == "SYNTHESIZE" store under SYNTHESIZE#{job_id} with 'content'
                # Else default to RESEARCH#{job_id} with 'content'
                try:
                    if _table and meta.get("user_id") and meta.get("job_id"):
                        now_iso = datetime.now(timezone.utc).isoformat()
                        content_text = getattr(resp, "output_text", None)
                        kind = (meta.get("kind") or "RESEARCH").upper()

                        if kind == "IDEAS":
                            ideas = []
                            if isinstance(content_text, str) and content_text:
                                if "Idea:" in content_text:
                                    parts = content_text.split("Idea:")
                                    for part in parts[1:]:
                                        val = part.strip()
                                        if val:
                                            ideas.append(val)
                                else:
                                    ideas = [content_text]

                            item = {
                                "PK": f"USER#{meta['user_id']}",
                                "SK": f"IDEAS#{meta['job_id']}",
                                "response_id": response_id,
                                "status": getattr(resp, "status", None),
                                "ideas": ideas if ideas else None,
                                "createdAt": now_iso,
                                "updatedAt": now_iso,
                            }
                            item = {k: v for k, v in item.items() if v is not None}
                            _table.put_item(Item=item)
                            logger.info("Stored IDEAS in DynamoDB for user_id=%s job_id=%s", meta.get("user_id"), meta.get("job_id"))
                        elif kind == "SYNTHESIZE":
                            item = {
                                "PK": f"USER#{meta['user_id']}",
                                "SK": f"SYNTHESIZE#{meta['job_id']}",
                                "response_id": response_id,
                                "status": getattr(resp, "status", None),
                                "content": content_text if isinstance(content_text, str) else json.dumps(content_text) if content_text is not None else None,
                                "createdAt": now_iso,
                                "updatedAt": now_iso,
                            }
                            item = {k: v for k, v in item.items() if v is not None}
                            _table.put_item(Item=item)
                            logger.info("Stored SYNTHESIZE result in DynamoDB for user_id=%s job_id=%s", meta.get("user_id"), meta.get("job_id"))
                        else:
                            item = {
                                "PK": f"USER#{meta['user_id']}",
                                "SK": f"RESEARCH#{meta['job_id']}",
                                "response_id": response_id,
                                "status": getattr(resp, "status", None),
                                "content": content_text if isinstance(content_text, str) else json.dumps(content_text) if content_text is not None else None,
                                "createdAt": now_iso,
                                "updatedAt": now_iso,
                            }
                            # Remove None attributes to keep item compact
                            item = {k: v for k, v in item.items() if v is not None}
                            _table.put_item(Item=item)
                            logger.info("Stored research result in DynamoDB for user_id=%s job_id=%s", meta.get("user_id"), meta.get("job_id"))
                    else:
                        if not _table:
                            logger.debug("DynamoDB table not configured; skipping store")
                except ClientError as ddb_err:
                    logger.warning("Failed to store research result in DynamoDB: %s", ddb_err)
            except Exception as e:
                # Do not fail the webhook delivery; just log and still return 200
                logger.exception(f"Post-verify handling failed for response.completed: {e}")

        # Always acknowledge quickly
        return {"statusCode": 200, "body": ""}

    except Exception as e:
        logger.exception(f"Webhook processing error: {e}")
        return {"statusCode": 500, "body": ""}