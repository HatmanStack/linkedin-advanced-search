"""Common response building utilities for Lambda functions."""
import json
from typing import Any, Dict, Optional


def build_success_response(
    data: Any,
    status_code: int = 200,
    headers: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Build a standardized success response.

    Args:
        data: The response data to return
        status_code: HTTP status code (default: 200)
        headers: Optional additional headers

    Returns:
        Dict containing statusCode, headers, and body
    """
    default_headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    }

    if headers:
        default_headers.update(headers)

    return {
        'statusCode': status_code,
        'headers': default_headers,
        'body': json.dumps({
            'success': True,
            'data': data
        })
    }


def build_error_response(
    error_message: str,
    status_code: int = 500,
    error_code: Optional[str] = None,
    headers: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Build a standardized error response.

    Args:
        error_message: The error message to return
        status_code: HTTP status code (default: 500)
        error_code: Optional error code for client handling
        headers: Optional additional headers

    Returns:
        Dict containing statusCode, headers, and body
    """
    default_headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    }

    if headers:
        default_headers.update(headers)

    error_body = {
        'success': False,
        'error': error_message
    }

    if error_code:
        error_body['errorCode'] = error_code

    return {
        'statusCode': status_code,
        'headers': default_headers,
        'body': json.dumps(error_body)
    }
