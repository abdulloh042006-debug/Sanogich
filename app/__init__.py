"""Sanogich application factory."""

import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

from flask import Flask, jsonify, render_template, request

from .config import get_config
from .extensions import db, login_manager
from .security import init_security


def create_app(config_name: str | None = None) -> Flask:
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(get_config(config_name))

    # Ensure the instance folder exists (SQLite database lives here).
    Path(app.instance_path).mkdir(parents=True, exist_ok=True)

    _configure_logging(app)
    _fail_fast_on_insecure_prod(app)

    db.init_app(app)
    login_manager.init_app(app)
    init_security(app)

    from .routes import api, auth, main

    app.register_blueprint(main.bp)
    app.register_blueprint(auth.bp, url_prefix="/auth")
    app.register_blueprint(api.bp, url_prefix="/api")

    _register_error_handlers(app)
    _register_cli(app)

    # Import models so create_all sees them, then create missing tables.
    from . import models  # noqa: F401

    with app.app_context():
        db.create_all()

    return app


def _configure_logging(app: Flask) -> None:
    level = logging.DEBUG if app.debug else logging.INFO
    app.logger.setLevel(level)

    if not app.debug and not app.testing:
        log_dir = Path(app.config["LOG_DIR"])
        log_dir.mkdir(parents=True, exist_ok=True)
        handler = RotatingFileHandler(
            log_dir / "sanogich.log", maxBytes=1_000_000, backupCount=5
        )
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
        )
        handler.setLevel(logging.INFO)
        app.logger.addHandler(handler)


def _fail_fast_on_insecure_prod(app: Flask) -> None:
    """Refuse to boot a production instance with the default secret key."""
    if not app.debug and not app.testing:
        if app.config["SECRET_KEY"] == "change-me-in-production":
            raise RuntimeError(
                "SECRET_KEY must be set to a strong random value in production. "
                'Generate one with: python -c "import secrets; print(secrets.token_hex(32))"'
            )


def _wants_json() -> bool:
    return request.path.startswith("/api/")


def _register_error_handlers(app: Flask) -> None:
    @app.errorhandler(404)
    def not_found(error):
        if _wants_json():
            return jsonify(error="Not found."), 404
        return render_template("errors/404.html"), 404

    @app.errorhandler(403)
    def forbidden(error):
        if _wants_json():
            return jsonify(error="Forbidden."), 403
        return render_template("errors/404.html"), 403

    @app.errorhandler(500)
    def server_error(error):
        app.logger.exception("Unhandled server error on %s", request.path)
        db.session.rollback()
        if _wants_json():
            return jsonify(error="Internal server error."), 500
        return render_template("errors/500.html"), 500


def _register_cli(app: Flask) -> None:
    @app.cli.command("init-db")
    def init_db() -> None:
        """Create all database tables."""
        db.create_all()
        print("Database initialized.")
