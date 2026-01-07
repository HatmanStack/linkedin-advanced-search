"""
RAGStack Proxy Lambda

Secure proxy for RAGStack GraphQL API.
Handles search and ingestion requests while keeping API key secure on backend.
"""

import json
import logging
import os

from ingestion_service import IngestionService
from ragstack_client import RAGStackClient, RAGStackError

# Configure logging
logger = logging.getLogger()
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO"))

# Allowed CORS origins from environment
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")


def _get_cors_origin(event: dict) -> str:
    """Get CORS origin based on request Origin header"""
    request_origin = (
        event.get("headers", {}).get("origin")
        or event.get("headers", {}).get("Origin")
    )
    if request_origin and request_origin in ALLOWED_ORIGINS:
        return request_origin
    return ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*"


def _get_api_headers(event: dict = None) -> dict:
    """Get API response headers with dynamic CORS origin"""
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": _get_cors_origin(event) if event else "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
    }


def _resp(status_code: int, body_dict: dict, event: dict = None) -> dict:
    """Build API Gateway response"""
    return {
        "statusCode": status_code,
        "headers": _get_api_headers(event),
        "body": json.dumps(body_dict),
    }


def _parse_body(event: dict) -> dict:
    """Parse request body from event"""
    if "body" in event:
        body_raw = event.get("body")
        if isinstance(body_raw, str):
            try:
                return json.loads(body_raw)
            except json.JSONDecodeError:
                return {}
        return body_raw or {}
    return event or {}


def _extract_user_id(event: dict) -> str | None:
    """Extract user ID from Cognito JWT claims"""
    sub = event.get("requestContext", {}).get("authorizer", {}).get("claims", {}).get("sub")
    if sub:
        return sub

    # Check for dev mode fallback (blocked in production)
    dev_mode = os.environ.get("DEV_MODE", "false").lower() == "true"
    if dev_mode:
        stage = os.environ.get("STAGE", "prod").lower()
        is_local = os.environ.get("AWS_SAM_LOCAL", "false").lower() == "true"

        if stage == "prod" and not is_local:
            logger.error("DEV_MODE is enabled but blocked in production environment")
            return None

        logger.warning("DEV_MODE: Using development user ID (stage=%s, local=%s)", stage, is_local)
        return "test-user-development"

    logger.error("No authentication found")
    return None


def _get_ragstack_client() -> RAGStackClient:
    """Create RAGStack client from environment variables"""
    endpoint = os.environ.get("RAGSTACK_GRAPHQL_ENDPOINT")
    api_key = os.environ.get("RAGSTACK_API_KEY")

    if not endpoint or not api_key:
        raise ValueError("RAGSTACK_GRAPHQL_ENDPOINT and RAGSTACK_API_KEY must be set")

    return RAGStackClient(endpoint=endpoint, api_key=api_key)


def handle_search(event: dict, body: dict, user_id: str) -> dict:
    """
    Handle search operation.

    Request body:
    {
        "query": "software engineer with Python experience",
        "maxResults": 50
    }
    """
    query = body.get("query")
    if not query:
        return _resp(400, {"error": "query is required"}, event)

    max_results = body.get("maxResults", 100)

    try:
        client = _get_ragstack_client()
        results = client.search(query=query, max_results=max_results)

        logger.info(f"Search completed: {len(results)} results for user {user_id}")

        return _resp(
            200,
            {
                "results": results,
                "totalResults": len(results),
                "query": query,
            },
            event,
        )

    except RAGStackError as e:
        logger.error(f"RAGStack search error: {e}")
        return _resp(502, {"error": "Search service unavailable"}, event)
    except Exception as e:
        logger.error(f"Unexpected search error: {e}")
        return _resp(500, {"error": "Internal server error"}, event)


def handle_ingest(event: dict, body: dict, user_id: str) -> dict:
    """
    Handle ingestion operation.

    Request body:
    {
        "profileId": "base64-encoded-profile-id",
        "markdownContent": "# Profile Name\n...",
        "metadata": {"customField": "value"}
    }
    """
    profile_id = body.get("profileId")
    markdown_content = body.get("markdownContent")

    if not profile_id:
        return _resp(400, {"error": "profileId is required"}, event)
    if not markdown_content:
        return _resp(400, {"error": "markdownContent is required"}, event)

    # Build metadata with user context
    metadata = body.get("metadata", {})
    metadata["user_id"] = user_id

    try:
        client = _get_ragstack_client()
        service = IngestionService(ragstack_client=client)

        result = service.ingest_profile(
            profile_id=profile_id,
            markdown_content=markdown_content,
            metadata=metadata,
            wait_for_indexing=body.get("waitForIndexing", False),
        )

        logger.info(f"Ingestion completed: profile {profile_id}, status {result.get('status', 'unknown')}")

        return _resp(200, result, event)

    except RAGStackError as e:
        logger.error(f"RAGStack ingestion error: {e}")
        return _resp(502, {"error": "Ingestion service unavailable"}, event)
    except Exception as e:
        logger.error(f"Unexpected ingestion error: {e}")
        return _resp(500, {"error": "Internal server error"}, event)


def handle_status(event: dict, body: dict, user_id: str) -> dict:
    """
    Handle status check operation.

    Request body:
    {
        "documentId": "doc123"
    }
    """
    document_id = body.get("documentId")
    if not document_id:
        return _resp(400, {"error": "documentId is required"}, event)

    try:
        client = _get_ragstack_client()
        result = client.get_document_status(document_id)

        logger.info(f"Status check: document {document_id}, status {result.get('status', 'unknown')}")

        return _resp(200, result, event)

    except RAGStackError as e:
        logger.error(f"RAGStack status error: {e}")
        return _resp(502, {"error": "Status service unavailable"}, event)
    except Exception as e:
        logger.error(f"Unexpected status error: {e}")
        return _resp(500, {"error": "Internal server error"}, event)


def lambda_handler(event: dict, context) -> dict:
    """
    AWS Lambda handler for RAGStack proxy operations.

    Expected request body:
    {
        "operation": "search" | "ingest" | "status",
        ... operation-specific fields
    }
    """
    try:
        # Log event without sensitive headers
        safe_event = {k: v for k, v in event.items() if k != "headers"}
        safe_event["headers"] = {
            k: "***" if k.lower() == "authorization" else v
            for k, v in event.get("headers", {}).items()
        }
        logger.info(f"Received event: {json.dumps(safe_event)[:2000]}")

        # Handle OPTIONS for CORS
        if event.get("httpMethod") == "OPTIONS" or event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
            return _resp(200, {}, event)

        # Parse request body
        body = _parse_body(event)
        operation = body.get("operation")

        # Extract user ID from JWT
        user_id = _extract_user_id(event)
        if not user_id:
            return _resp(401, {"error": "Unauthorized: Missing or invalid JWT token"}, event)

        # Route to appropriate handler
        if operation == "search":
            return handle_search(event, body, user_id)
        elif operation == "ingest":
            return handle_ingest(event, body, user_id)
        elif operation == "status":
            return handle_status(event, body, user_id)
        else:
            return _resp(
                400,
                {
                    "error": f"Unknown operation: {operation}",
                    "supportedOperations": ["search", "ingest", "status"],
                },
                event,
            )

    except Exception as e:
        logger.error(f"Unexpected error in lambda_handler: {e}")
        return _resp(500, {"error": "Internal server error"}, event)
