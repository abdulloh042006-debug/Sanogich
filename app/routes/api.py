"""JSON API consumed by the dashboard frontend.

All endpoints require an authenticated session and return JSON. Mutating
endpoints additionally require the X-CSRF-Token header (see app/security.py).
"""

from flask import Blueprint, current_app, jsonify, request
from flask_login import current_user, login_required

from ..extensions import db
from ..models import Counter, CounterEvent
from ..services import stats
from ..validators import (
    clean_color,
    clean_counter_name,
    clean_delta,
    clean_step,
    clean_target,
)

bp = Blueprint("api", __name__)

MAX_HISTORY_ITEMS = 100


def _get_counter_or_404(counter_id: int) -> Counter | None:
    """Fetch a counter that belongs to the current user, else None."""
    return (
        db.session.query(Counter)
        .filter(Counter.id == counter_id, Counter.user_id == current_user.id)
        .first()
    )


def _json_body() -> dict:
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


@bp.route("/counters", methods=["GET"])
@login_required
def list_counters():
    counters = (
        db.session.query(Counter)
        .filter(Counter.user_id == current_user.id)
        .order_by(Counter.created_at.asc())
        .all()
    )
    return jsonify(counters=[c.to_dict() for c in counters])


@bp.route("/counters", methods=["POST"])
@login_required
def create_counter():
    count = (
        db.session.query(Counter).filter(Counter.user_id == current_user.id).count()
    )
    limit = current_app.config["MAX_COUNTERS_PER_USER"]
    if count >= limit:
        return jsonify(error=f"Limit reached: at most {limit} counters per account."), 400

    data = _json_body()
    name, name_err = clean_counter_name(data.get("name"), current_app.config["MAX_NAME_LENGTH"])
    color, color_err = clean_color(data.get("color"))
    step, step_err = clean_step(data.get("step"))
    target, target_err = clean_target(data.get("target"))

    errors = [e for e in (name_err, color_err, step_err, target_err) if e]
    if errors:
        return jsonify(error=errors[0], errors=errors), 400

    counter = Counter(
        user_id=current_user.id, name=name, color=color, step=step, target=target
    )
    db.session.add(counter)
    db.session.commit()
    current_app.logger.info("Counter created id=%s user=%s", counter.id, current_user.id)
    return jsonify(counter=counter.to_dict()), 201


@bp.route("/counters/<int:counter_id>", methods=["PATCH"])
@login_required
def update_counter(counter_id: int):
    counter = _get_counter_or_404(counter_id)
    if counter is None:
        return jsonify(error="Counter not found."), 404

    data = _json_body()
    errors: list[str] = []

    if "name" in data:
        name, err = clean_counter_name(data.get("name"), current_app.config["MAX_NAME_LENGTH"])
        if err:
            errors.append(err)
        else:
            counter.name = name
    if "color" in data:
        color, err = clean_color(data.get("color"))
        if err:
            errors.append(err)
        else:
            counter.color = color
    if "step" in data:
        step, err = clean_step(data.get("step"))
        if err:
            errors.append(err)
        else:
            counter.step = step
    if "target" in data:
        target, err = clean_target(data.get("target"))
        if err:
            errors.append(err)
        else:
            counter.target = target

    if errors:
        db.session.rollback()
        return jsonify(error=errors[0], errors=errors), 400

    db.session.commit()
    return jsonify(counter=counter.to_dict())


@bp.route("/counters/<int:counter_id>", methods=["DELETE"])
@login_required
def delete_counter(counter_id: int):
    counter = _get_counter_or_404(counter_id)
    if counter is None:
        return jsonify(error="Counter not found."), 404
    db.session.delete(counter)
    db.session.commit()
    current_app.logger.info("Counter deleted id=%s user=%s", counter_id, current_user.id)
    return jsonify(ok=True)


@bp.route("/counters/<int:counter_id>/increment", methods=["POST"])
@login_required
def increment_counter(counter_id: int):
    counter = _get_counter_or_404(counter_id)
    if counter is None:
        return jsonify(error="Counter not found."), 404

    data = _json_body()
    raw_delta = data.get("delta", counter.step)
    delta, err = clean_delta(raw_delta)
    if err:
        return jsonify(error=err), 400

    # Counters never go below zero; log the applied (clamped) delta.
    new_value = max(0, counter.value + delta)
    applied_delta = new_value - counter.value
    if applied_delta == 0:
        return jsonify(counter=counter.to_dict(), applied_delta=0)

    counter.value = new_value
    event = CounterEvent(counter_id=counter.id, delta=applied_delta, value_after=new_value)
    db.session.add(event)
    db.session.commit()
    return jsonify(counter=counter.to_dict(), applied_delta=applied_delta)


@bp.route("/counters/<int:counter_id>/reset", methods=["POST"])
@login_required
def reset_counter(counter_id: int):
    counter = _get_counter_or_404(counter_id)
    if counter is None:
        return jsonify(error="Counter not found."), 404

    if counter.value != 0:
        event = CounterEvent(counter_id=counter.id, delta=-counter.value, value_after=0)
        counter.value = 0
        db.session.add(event)
        db.session.commit()
    return jsonify(counter=counter.to_dict())


@bp.route("/counters/<int:counter_id>/history", methods=["GET"])
@login_required
def counter_history(counter_id: int):
    counter = _get_counter_or_404(counter_id)
    if counter is None:
        return jsonify(error="Counter not found."), 404

    events = (
        db.session.query(CounterEvent)
        .filter(CounterEvent.counter_id == counter.id)
        .order_by(CounterEvent.created_at.desc())
        .limit(MAX_HISTORY_ITEMS)
        .all()
    )
    days = stats.active_days(current_user.id, counter_id=counter.id)
    return jsonify(
        counter=counter.to_dict(),
        events=[e.to_dict() for e in events],
        current_streak=stats.current_streak(days),
        best_streak=stats.best_streak(days),
    )


@bp.route("/stats/overview", methods=["GET"])
@login_required
def stats_overview():
    return jsonify(stats.overview(current_user.id))
