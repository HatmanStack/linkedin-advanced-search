"""Base service class with dependency injection pattern."""
import logging
from abc import ABC, abstractmethod
from typing import Any


class BaseService(ABC):
    """
    Base class for all service layer classes.

    Provides:
    - Dependency injection for AWS clients
    - Logging setup
    - Health check interface

    Usage:
        class EdgeService(BaseService):
            def __init__(self, table, lambda_client=None):
                super().__init__()
                self.table = table
                self.lambda_client = lambda_client
    """

    def __init__(self, logger_name: str | None = None):
        """
        Initialize base service with logging.

        Args:
            logger_name: Optional logger name. Defaults to class name.
        """
        self.logger = logging.getLogger(logger_name or self.__class__.__name__)

    @abstractmethod
    def health_check(self) -> dict[str, Any]:
        """
        Check service health and dependencies.

        Returns:
            Dict with 'healthy' bool and optional 'details' dict.
        """
        pass

    def _log_operation(self, operation: str, **kwargs: Any) -> None:
        """Log an operation with context."""
        self.logger.info(f"{operation}", extra=kwargs)

    def _log_error(self, operation: str, error: Exception, **kwargs: Any) -> None:
        """Log an error with context."""
        self.logger.error(f"{operation} failed: {error}", extra=kwargs, exc_info=True)
