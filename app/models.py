"""Database models for Sanogich."""

from datetime import datetime, timezone

from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from .extensions import db, login_manager


def utcnow() -> datetime:
    """Timezone-aware UTC now, stored naive (UTC) in the database."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    username = db.Column(db.String(60), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    counters = db.relationship(
        "Counter",
        backref="user",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User {self.username}>"


class Counter(db.Model):
    __tablename__ = "counters"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = db.Column(db.String(60), nullable=False)
    color = db.Column(db.String(7), nullable=False, default="#6366f1")
    step = db.Column(db.Integer, nullable=False, default=1)
    target = db.Column(db.Integer, nullable=True)
    value = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    events = db.relationship(
        "CounterEvent",
        backref="counter",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "color": self.color,
            "step": self.step,
            "target": self.target,
            "value": self.value,
            "created_at": self.created_at.isoformat() + "Z",
            "updated_at": self.updated_at.isoformat() + "Z",
        }

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Counter {self.name}={self.value}>"


class CounterEvent(db.Model):
    """Every change to a counter's value, kept for history and statistics."""

    __tablename__ = "counter_events"

    id = db.Column(db.Integer, primary_key=True)
    counter_id = db.Column(
        db.Integer,
        db.ForeignKey("counters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    delta = db.Column(db.Integer, nullable=False)
    value_after = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow, index=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "counter_id": self.counter_id,
            "delta": self.delta,
            "value_after": self.value_after,
            "created_at": self.created_at.isoformat() + "Z",
        }


@login_manager.user_loader
def load_user(user_id: str) -> User | None:
    return db.session.get(User, int(user_id))
