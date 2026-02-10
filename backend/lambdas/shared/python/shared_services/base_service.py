"""Base service class with dependency injection pattern."""

import logging
from abc import ABC, abstractmethod
from typing import Any


class BaseService(ABC):
    """Base class for all service layer classes."""

    def __init__(self, logger_name: str | None = None):
        self.logger = logging.getLogger(logger_name or self.__class__.__name__)

    @abstractmethod
    def health_check(self) -> dict[str, Any]:
        """Check service health and dependencies."""
        pass
