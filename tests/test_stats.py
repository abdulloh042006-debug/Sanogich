from datetime import date, timedelta

from app.services.stats import best_streak, current_streak


def days_ago(n: int) -> date:
    return date.today() - timedelta(days=n)


def test_current_streak_counts_consecutive_days():
    days = {days_ago(0), days_ago(1), days_ago(2)}
    assert current_streak(days) == 3


def test_current_streak_allows_yesterday_anchor():
    # No activity yet today should not break the streak.
    days = {days_ago(1), days_ago(2)}
    assert current_streak(days) == 2


def test_current_streak_broken_by_gap():
    days = {days_ago(2), days_ago(3)}
    assert current_streak(days) == 0


def test_current_streak_empty():
    assert current_streak(set()) == 0


def test_best_streak_finds_longest_run():
    days = {
        days_ago(0),
        days_ago(1),
        # gap
        days_ago(5),
        days_ago(6),
        days_ago(7),
        days_ago(8),
    }
    assert best_streak(days) == 4


def test_best_streak_empty():
    assert best_streak(set()) == 0
