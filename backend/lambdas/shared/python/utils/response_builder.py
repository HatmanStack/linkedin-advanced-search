import json
from typing import Any


def build_success_response(
    data: Any,
    status_code: int = 200,
    headers: dict[str, str] | None = None
) -> dict[str, Any]:
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
    error_code: str | None = None,
    headers: dict[str, str] | None = None
) -> dict[str, Any]:
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
