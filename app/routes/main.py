"""Public pages and the authenticated dashboard shell."""

from flask import Blueprint, redirect, render_template, url_for
from flask_login import current_user, login_required

bp = Blueprint("main", __name__)


@bp.route("/")
def index():
    if current_user.is_authenticated:
        return redirect(url_for("main.dashboard"))
    return render_template("landing.html")


@bp.route("/dashboard")
@login_required
def dashboard():
    return render_template("dashboard.html")


@bp.route("/healthz")
def healthz():
    """Liveness probe for load balancers and container orchestrators."""
    return {"status": "ok"}
