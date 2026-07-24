"""Input validation helpers.

Each validator returns a (cleaned_value, error_message) tuple; error_message is
None when the value is valid.
"""

import re

from email_validator import EmailNotValidError, validate_email

HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,30}$")

PASSWORD_MIN_LENGTH = 8
MAX_COUNTER_VALUE = 1_000_000_000
MAX_STEP = 10_000


def clean_email(raw: object) -> tuple[str | None, str | None]:
    if not isinstance(raw, str) or not raw.strip():
        return None, "Email is required."
    try:
        result = validate_email(raw.strip(), check_deliverability=False)
        return result.normalized.lower(), None
    except EmailNotValidError:
        return None, "Please enter a valid email address."


def clean_username(raw: object) -> tuple[str | None, str | None]:
    if not isinstance(raw, str) or not raw.strip():
        return None, "Username is required."
    username = raw.strip()
    if not USERNAME_RE.match(username):
        return None, "Username must be 3-30 characters: letters, digits, underscores."
    return username, None


def clean_password(raw: object) -> tuple[str | None, str | None]:
    if not isinstance(raw, str) or not raw:
        return None, "Password is required."
    if len(raw) < PASSWORD_MIN_LENGTH:
        return None, f"Password must be at least {PASSWORD_MIN_LENGTH} characters."
    if len(raw) > 128:
        return None, "Password must be at most 128 characters."
    return raw, None


def clean_counter_name(raw: object, max_length: int) -> tuple[str | None, str | None]:
    if not isinstance(raw, str) or not raw.strip():
        return None, "Name is required."
    name = raw.strip()
    if len(name) > max_length:
        return None, f"Name must be at most {max_length} characters."
    return name, None


def clean_color(raw: object) -> tuple[str | None, str | None]:
    if raw is None:
        return "#6366f1", None
    if not isinstance(raw, str) or not HEX_COLOR_RE.match(raw):
        return None, "Color must be a hex value like #6366f1."
    return raw.lower(), None


def clean_step(raw: object) -> tuple[int | None, str | None]:
    if raw is None:
        return 1, None
    if isinstance(raw, bool) or not isinstance(raw, int):
        return None, "Step must be a whole number."
    if not 1 <= raw <= MAX_STEP:
        return None, f"Step must be between 1 and {MAX_STEP}."
    return raw, None


def clean_target(raw: object) -> tuple[int | None, str | None]:
    if raw is None:
        return None, None
    if isinstance(raw, bool) or not isinstance(raw, int):
        return None, "Target must be a whole number or empty."
    if not 1 <= raw <= MAX_COUNTER_VALUE:
        return None, f"Target must be between 1 and {MAX_COUNTER_VALUE}."
    return raw, None


def clean_delta(raw: object) -> tuple[int | None, str | None]:
    if isinstance(raw, bool) or not isinstance(raw, int):
        return None, "Delta must be a whole number."
    if raw == 0:
        return None, "Delta must not be zero."
    if abs(raw) > MAX_STEP:
        return None, f"Delta must be between -{MAX_STEP} and {MAX_STEP}."
    return raw, None
