"""Application configuration, driven by environment variables."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


class Config:
    """Base configuration shared by all environments."""

    SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production")

    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL") or (
        "sqlite:///" + str(BASE_DIR / "instance" / "sanogich.db")
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Session cookie hardening. SameSite=Lax plus the explicit CSRF token
    # (see app/security.py) gives defense in depth against CSRF.
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = False  # overridden in production

    # Application limits (server-side validation uses these too).
    MAX_COUNTERS_PER_USER = 50
    MAX_NAME_LENGTH = 60

    LOG_DIR = os.environ.get("LOG_DIR", "logs")


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False
    SESSION_COOKIE_SECURE = True  # requires HTTPS, which production must use
    PREFERRED_URL_SCHEME = "https"


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite://"  # in-memory database
    WTF_CSRF_ENABLED = False
    SECRET_KEY = "test-secret-key"


CONFIG_MAP = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}


def get_config(name: str | None = None) -> type[Config]:
    """Resolve a config class from a name or the FLASK_ENV variable."""
    name = name or os.environ.get("FLASK_ENV", "development")
    return CONFIG_MAP.get(name, DevelopmentConfig)
