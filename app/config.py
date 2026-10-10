"""Application settings read from environment variables.

Why this file exists:
  We never want to hard-code things like database paths or allowed frontend
  URLs. Those values come from environment variables (optionally stored in a
  .env file), so the same code works on your laptop, your teammate's laptop
  and a server.

If a variable is missing, the default values below are used, so the app runs
with zero configuration.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed application settings (values come from env vars / .env)."""

    app_name: str = "CtrlFreaks Backend"
    environment: str = "development"
    database_url: str = "sqlite:///./ctrlfreaks.db"

    # Comma separated list of frontend origins allowed to call this API,
    # for example: http://localhost:5173,http://localhost:3000
    cors_allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    # pydantic-settings reads .env automatically; "extra=ignore" means
    # unrelated lines in .env do not crash the app.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        """Turn the comma separated string into a clean list of origins."""
        return [
            origin.strip()
            for origin in self.cors_allowed_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    """Return one shared Settings object (cached so we read .env only once)."""
    return Settings()
