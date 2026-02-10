"""Custom exceptions and error handling utilities."""
from .exceptions import (
    AuthorizationError,
    ConfigurationError,
    ExternalServiceError,
    NotFoundError,
    ServiceError,
    ValidationError,
)
from .handlers import build_error_response, handle_service_error

__all__ = [
    'ServiceError',
    'ValidationError',
    'NotFoundError',
    'AuthorizationError',
    'ExternalServiceError',
    'ConfigurationError',
    'build_error_response',
    'handle_service_error',
]
