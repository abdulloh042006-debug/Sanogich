"""CSRF protection and security headers.

Uses the synchronizer-token pattern: a per-session random token is embedded in
pages (meta tag / hidden form field) and must accompany every state-changing
request, either as an `X-CSRF-Token` header (JSON API) or a `csrf_token` form
field (HTML forms). Combined with SameSite=Lax cookies this blocks CSRF.
"""

import hmac
import secrets

from flask import Flask, Request, jsonify, request, session

CSRF_SESSION_KEY = "_csrf_token"
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})


def generate_csrf_token() -> str:
    """Return the session's CSRF token, creating it on first use."""
    token = session.get(CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_urlsafe(32)
        session[CSRF_SESSION_KEY] = token
    return token


def _extract_token(req: Request) -> str | None:
    return req.headers.get("X-CSRF-Token") or req.form.get("csrf_token")


def init_security(app: Flask) -> None:
    """Register CSRF enforcement and standard security headers."""

    @app.before_request
    def csrf_protect():
        if app.config.get("TESTING"):
            return None
        if request.method in SAFE_METHODS:
            return None
        expected = session.get(CSRF_SESSION_KEY)
        provided = _extract_token(request)
        if not expected or not provided or not hmac.compare_digest(expected, provided):
            app.logger.warning("CSRF validation failed for %s %s", request.method, request.path)
            if request.path.startswith("/api/"):
                return jsonify(error="Invalid or missing CSRF token."), 400
            return "Invalid or missing CSRF token.", 400
        return None

    @app.after_request
    def security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "same-origin")
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'",
        )
        return response

    # Make {{ csrf_token() }} available in every template.
    app.jinja_env.globals["csrf_token"] = generate_csrf_token
