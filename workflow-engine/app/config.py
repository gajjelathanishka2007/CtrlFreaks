"""Runtime configuration, read from environment variables.

No secrets are hard-coded. ``.env.example`` documents the variable names.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

try:  # python-dotenv is optional at import time
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover - dotenv is a soft dependency
    pass

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass
class Settings:
    """Engine settings. Every value can be overridden through the environment."""

    database_url: str = field(
        default_factory=lambda: os.getenv(
            "CTRLFREAKS_DATABASE_URL",
            f"sqlite:///{(DATA_DIR / 'engine.db').as_posix()}",
        )
    )

    # LLM is used ONLY to explain diagnostics. The engine never depends on it.
    llm_enabled: bool = field(default_factory=lambda: _env_bool("CTRLFREAKS_LLM_ENABLED", False))
    llm_base_url: str = field(
        default_factory=lambda: os.getenv("CTRLFREAKS_LLM_BASE_URL", "https://api.openai.com/v1")
    )
    llm_api_key: str = field(default_factory=lambda: os.getenv("CTRLFREAKS_LLM_API_KEY", ""))
    llm_model: str = field(default_factory=lambda: os.getenv("CTRLFREAKS_LLM_MODEL", "gpt-4o-mini"))

    # Retry safety cap enforced by the orchestrator regardless of node config.
    max_retry_attempts: int = field(
        default_factory=lambda: int(os.getenv("CTRLFREAKS_MAX_RETRY_ATTEMPTS", "5"))
    )

    # HTTP request node default timeout (seconds).
    http_timeout_seconds: int = field(
        default_factory=lambda: int(os.getenv("CTRLFREAKS_HTTP_TIMEOUT", "10"))
    )


settings = Settings()


def ensure_data_dir() -> None:
    """Create the SQLite directory if a file-based database is used."""
    if settings.database_url.startswith("sqlite"):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
