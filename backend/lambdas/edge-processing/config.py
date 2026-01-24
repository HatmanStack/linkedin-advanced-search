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
    RAGSTACK_GRAPHQL_ENDPOINT = os.environ.get('RAGSTACK_GRAPHQL_ENDPOINT', '')
    RAGSTACK_API_KEY = os.environ.get('RAGSTACK_API_KEY', '')

    # Development Mode
    DEV_MODE = os.environ.get('DEV_MODE', 'false').lower() == 'true'

    # Logging
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')

    @classmethod
    def is_ragstack_configured(cls) -> bool:
        """Check if RAGStack is properly configured."""
        return bool(cls.RAGSTACK_GRAPHQL_ENDPOINT) and bool(cls.RAGSTACK_API_KEY)

    @classmethod
    def to_dict(cls) -> dict:
        """Return config as dictionary (for debugging/logging)."""
        return {
            'dynamodb_table': cls.DYNAMODB_TABLE_NAME,
            'ragstack_configured': cls.is_ragstack_configured(),
            'dev_mode': cls.DEV_MODE,
            'log_level': cls.LOG_LEVEL
        }
