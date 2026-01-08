"""
Configuration module for edge-processing Lambda.

Centralizes environment variables and feature flags for the service layer.
"""
import os


class Config:
    """Lambda configuration from environment variables."""

    # DynamoDB
    DYNAMODB_TABLE_NAME = os.environ.get('DYNAMODB_TABLE_NAME', 'linkedin-advanced-search')

    # RAGStack Integration
    RAGSTACK_PROXY_FUNCTION = os.environ.get('RAGSTACK_PROXY_FUNCTION', '')
    RAGSTACK_ENABLED = os.environ.get('RAGSTACK_ENABLED', 'true').lower() == 'true'

    # Development Mode
    DEV_MODE = os.environ.get('DEV_MODE', 'false').lower() == 'true'

    # Logging
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')

    @classmethod
    def is_ragstack_configured(cls) -> bool:
        """Check if RAGStack is properly configured and enabled."""
        return bool(cls.RAGSTACK_PROXY_FUNCTION) and cls.RAGSTACK_ENABLED

    @classmethod
    def to_dict(cls) -> dict:
        """Return config as dictionary (for debugging/logging)."""
        return {
            'dynamodb_table': cls.DYNAMODB_TABLE_NAME,
            'ragstack_function': cls.RAGSTACK_PROXY_FUNCTION or '(not set)',
            'ragstack_enabled': cls.RAGSTACK_ENABLED,
            'dev_mode': cls.DEV_MODE,
            'log_level': cls.LOG_LEVEL
        }
