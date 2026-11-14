"""Time helpers. Every datetime in the app passes through these functions.

Convention used everywhere in the backend:
    * Inside the app and in SQLite, datetimes are *naive* and represent IST.
    * Datetimes arriving from the API are converted to naive IST on the way in.
    * Datetimes leaving through the API get a "+05:30" offset on the way out.
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.config import TIMEZONE

IST = ZoneInfo(TIMEZONE)


def now_ist() -> datetime:
    """Return the current IST time as a naive datetime (microseconds dropped).

    This is the only place in the backend that reads the system clock.
    """
    return datetime.now(IST).replace(tzinfo=None, microsecond=0)


def to_ist_naive(value: datetime | None) -> datetime | None:
    """Convert any datetime to a naive datetime in IST.

    An aware datetime (e.g. "...Z" or "...+05:30") is converted to IST first.
    A naive datetime is assumed to already be IST and is returned unchanged.
    """
    if value is None:
        return None
    if value.tzinfo is not None:
        value = value.astimezone(IST).replace(tzinfo=None)
    return value


def to_iso_ist(value: datetime | None) -> str | None:
    """Serialize a naive-IST datetime as ISO 8601 with a "+05:30" offset."""
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=IST)
    else:
        value = value.astimezone(IST)
    return value.isoformat()


def day_bounds(day) -> tuple[datetime, datetime]:
    """Return (start, end) of an IST calendar day as naive datetimes.

    The range is half-open: start <= t < end.
    """
    start = datetime(day.year, day.month, day.day)
    return start, start + timedelta(days=1)
