import logging
from typing import Optional


def setup_logging(level: int = logging.INFO) -> logging.Logger:
    """Setup and return root logger for the app."""
    logger = logging.getLogger("concordia")
    if not logger.handlers:
        handler = logging.StreamHandler()
        fmt = "%(asctime)s [%(levelname)s] %(name)s - %(message)s"
        handler.setFormatter(logging.Formatter(fmt))
        logger.addHandler(handler)
    logger.setLevel(level)
    return logger


def get_logger(name: Optional[str] = None) -> logging.Logger:
    base = logging.getLogger("concordia")
    return base if name is None else base.getChild(name)
