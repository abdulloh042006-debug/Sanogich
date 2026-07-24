"""Statistics: daily activity aggregation and streak calculation.

All dates are UTC calendar days, matching the naive-UTC timestamps stored on
CounterEvent rows.
"""

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func

from ..extensions import db
from ..models import Counter, CounterEvent


def _today_utc() -> date:
    return datetime.now(timezone.utc).date()


def _as_date(value: object) -> date:
    """func.date() returns a string on SQLite and a date on PostgreSQL."""
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


def daily_totals(user_id: int, days: int = 14) -> list[dict]:
    """Sum of positive deltas per UTC day for the last `days` days (inclusive)."""
    today = _today_utc()
    start = datetime.combine(today - timedelta(days=days - 1), datetime.min.time())

    rows = (
        db.session.query(
            func.date(CounterEvent.created_at).label("day"),
            func.sum(CounterEvent.delta).label("total"),
        )
        .join(Counter, Counter.id == CounterEvent.counter_id)
        .filter(
            Counter.user_id == user_id,
            CounterEvent.created_at >= start,
            CounterEvent.delta > 0,
        )
        .group_by("day")
        .all()
    )
    totals = {_as_date(row.day): int(row.total) for row in rows}

    return [
        {
            "date": (today - timedelta(days=offset)).isoformat(),
            "total": totals.get(today - timedelta(days=offset), 0),
        }
        for offset in range(days - 1, -1, -1)
    ]


def active_days(user_id: int, counter_id: int | None = None) -> set[date]:
    """UTC days on which the user (or one counter) recorded a positive delta."""
    query = (
        db.session.query(func.date(CounterEvent.created_at))
        .join(Counter, Counter.id == CounterEvent.counter_id)
        .filter(Counter.user_id == user_id, CounterEvent.delta > 0)
    )
    if counter_id is not None:
        query = query.filter(CounterEvent.counter_id == counter_id)
    return {_as_date(row[0]) for row in query.distinct().all()}


def current_streak(days: set[date]) -> int:
    """Consecutive active days ending today or yesterday (grace for "not yet today")."""
    if not days:
        return 0
    today = _today_utc()
    anchor = today if today in days else today - timedelta(days=1)
    if anchor not in days:
        return 0
    streak = 0
    cursor = anchor
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def best_streak(days: set[date]) -> int:
    """Longest run of consecutive active days ever recorded."""
    best = 0
    for day in days:
        if day - timedelta(days=1) not in days:  # start of a run
            length = 1
            cursor = day + timedelta(days=1)
            while cursor in days:
                length += 1
                cursor += timedelta(days=1)
            best = max(best, length)
    return best


def overview(user_id: int) -> dict:
    """Dashboard summary for a user."""
    today = _today_utc()
    start_of_today = datetime.combine(today, datetime.min.time())

    today_total = (
        db.session.query(func.coalesce(func.sum(CounterEvent.delta), 0))
        .join(Counter, Counter.id == CounterEvent.counter_id)
        .filter(
            Counter.user_id == user_id,
            CounterEvent.created_at >= start_of_today,
            CounterEvent.delta > 0,
        )
        .scalar()
    )
    counter_count = (
        db.session.query(func.count(Counter.id)).filter(Counter.user_id == user_id).scalar()
    )
    days = active_days(user_id)

    return {
        "counters": int(counter_count),
        "today_total": int(today_total),
        "current_streak": current_streak(days),
        "best_streak": best_streak(days),
        "daily": daily_totals(user_id, days=14),
    }
