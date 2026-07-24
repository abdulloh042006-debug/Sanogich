"""Registration, login and logout (server-rendered forms)."""

from flask import Blueprint, current_app, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required, login_user, logout_user

from ..extensions import db
from ..models import User
from ..validators import clean_email, clean_password, clean_username

bp = Blueprint("auth", __name__)


@bp.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("main.dashboard"))

    if request.method == "POST":
        email, email_err = clean_email(request.form.get("email"))
        username, user_err = clean_username(request.form.get("username"))
        password, pass_err = clean_password(request.form.get("password"))

        errors = [e for e in (email_err, user_err, pass_err) if e]
        if not errors:
            if db.session.query(User.id).filter(User.email == email).first():
                errors.append("An account with that email already exists.")
            if db.session.query(User.id).filter(User.username == username).first():
                errors.append("That username is taken.")

        if errors:
            for error in errors:
                flash(error, "error")
            return render_template("auth/register.html"), 400

        user = User(email=email, username=username)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        login_user(user)
        current_app.logger.info("New user registered: %s", username)
        return redirect(url_for("main.dashboard"))

    return render_template("auth/register.html")


@bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("main.dashboard"))

    if request.method == "POST":
        identity = (request.form.get("identity") or "").strip().lower()
        password = request.form.get("password") or ""

        user = (
            db.session.query(User)
            .filter((User.email == identity) | (User.username == identity))
            .first()
        )
        if user is None or not user.check_password(password):
            # Deliberately vague: do not reveal whether the account exists.
            flash("Incorrect email/username or password.", "error")
            return render_template("auth/login.html"), 401

        login_user(user, remember=request.form.get("remember") == "on")
        next_page = request.args.get("next")
        # Only allow relative redirect targets to prevent open redirects.
        if not next_page or not next_page.startswith("/") or next_page.startswith("//"):
            next_page = url_for("main.dashboard")
        return redirect(next_page)

    return render_template("auth/login.html")


@bp.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    flash("You have been signed out.", "success")
    return redirect(url_for("main.index"))
