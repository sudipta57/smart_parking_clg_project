"""The fee engine: turns (vehicle type, entry time, exit time) into a fee.

This is a *pure* module:
    * no database access,
    * no reading the clock (no datetime.now()),
    * no files, network or printing.
It takes inputs and returns a result, which makes every rule easy to test.

Rules (see docs/FEE_RULES.md):
    1. Stays of GRACE_MINUTES or less are free.
    2. After that, every started hour is billed in full (rounded up).
    3. Each hour block is charged at the rate in effect when the block STARTS.
    4. Blocks are grouped into 24-hour windows from entry; each window is capped.
    5. Total = sum of the capped windows.
"""

from dataclasses import dataclass
from datetime import datetime, time, timedelta
from math import ceil

from app.config import CAP_WINDOW_HOURS, GRACE_MINUTES, NIGHT_END, NIGHT_START, RATES

# Unit conversions (not business rules, so they live here, not in config.py).
MINUTES_PER_HOUR = 60
MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR

DAY = "DAY"
NIGHT = "NIGHT"


class InvalidTimeRange(ValueError):
    """Raised when the exit time is earlier than the entry time."""


@dataclass
class Block:
    """One billed hour. `start` is when this hour begins."""

    index: int        # 1-based position of the hour in the stay
    start: datetime
    kind: str         # "DAY" or "NIGHT"
    amount: int       # rupees charged for this hour (before the cap)


@dataclass
class Window:
    """A group of up to CAP_WINDOW_HOURS blocks that shares one daily cap."""

    index: int        # 1-based: window 1 = first 24 hours, window 2 = next 24, ...
    hours: int        # number of blocks in this window
    raw_amount: int   # sum of the block amounts before the cap
    cap: int          # the daily cap for this vehicle type
    charged: int      # min(raw_amount, cap)
    capped: bool      # True if the cap reduced the amount


@dataclass
class FeeBreakdown:
    """The full, explainable result of a fee calculation."""

    vehicle_type: str
    duration_minutes: int
    grace_applied: bool
    billable_hours: int
    day_hours: int
    night_hours: int
    day_rate: int
    night_rate: int
    daily_cap: int
    blocks: list[Block]
    windows: list[Window]
    total: int

    @property
    def duration_text(self) -> str:
        """Human-readable duration, e.g. "2h 40m"."""
        return format_duration(self.duration_minutes)


def is_night(t: time) -> bool:
    """Return True if a time of day falls in the night window [22:00, 06:00).

    The window wraps past midnight, so it is "after the start OR before the end".
    22:00 itself is night (inclusive start); 06:00 itself is day (exclusive end).
    """
    return t >= NIGHT_START or t < NIGHT_END


def format_duration(minutes: int) -> str:
    """Format whole minutes as text: 10 -> "10m", 160 -> "2h 40m", 1470 -> "1d 0h 30m"."""
    days, rest = divmod(minutes, MINUTES_PER_DAY)
    hours, mins = divmod(rest, MINUTES_PER_HOUR)
    if days:
        return f"{days}d {hours}h {mins}m"
    if hours:
        return f"{hours}h {mins}m"
    return f"{mins}m"


def calculate_fee(vehicle_type: str, entry_time: datetime, exit_time: datetime) -> FeeBreakdown:
    """Calculate the parking fee for one stay and explain how it was reached.

    Both times must be in the same timezone (the app always passes naive IST).
    Raises ValueError for an unknown vehicle type and InvalidTimeRange if the
    exit is before the entry.
    """
    if vehicle_type not in RATES:
        raise ValueError("Unknown vehicle type")
    if exit_time < entry_time:
        raise InvalidTimeRange("Exit time is before entry time")

    # Floor division of two timedeltas gives whole minutes; seconds are dropped.
    duration_minutes = (exit_time - entry_time) // timedelta(minutes=1)
    rate = RATES[vehicle_type]

    # Rule 1: short stays are free. We stop here, so no blocks are created.
    if duration_minutes <= GRACE_MINUTES:
        return _free_breakdown(vehicle_type, duration_minutes, rate)

    # Rule 2: every started hour counts as a full hour (16 min -> 1, 61 min -> 2).
    # The grace minutes are NOT subtracted first.
    billable_hours = ceil(duration_minutes / MINUTES_PER_HOUR)

    blocks = _build_blocks(entry_time, billable_hours, rate)
    windows = _build_windows(blocks, rate["cap"])

    return FeeBreakdown(
        vehicle_type=vehicle_type,
        duration_minutes=duration_minutes,
        grace_applied=False,
        billable_hours=billable_hours,
        day_hours=sum(1 for b in blocks if b.kind == DAY),
        night_hours=sum(1 for b in blocks if b.kind == NIGHT),
        day_rate=rate["day"],
        night_rate=rate["night"],
        daily_cap=rate["cap"],
        blocks=blocks,
        windows=windows,
        # Rule 5: the total is the sum of the (already capped) windows.
        total=sum(w.charged for w in windows),
    )


def _free_breakdown(vehicle_type: str, duration_minutes: int, rate: dict) -> FeeBreakdown:
    """Build the result for a stay inside the grace period (fee = 0)."""
    return FeeBreakdown(
        vehicle_type=vehicle_type,
        duration_minutes=duration_minutes,
        grace_applied=True,
        billable_hours=0,
        day_hours=0,
        night_hours=0,
        day_rate=rate["day"],
        night_rate=rate["night"],
        daily_cap=rate["cap"],
        blocks=[],
        windows=[],
        total=0,
    )


def _build_blocks(entry_time: datetime, billable_hours: int, rate: dict) -> list[Block]:
    """Rule 3: create one block per billed hour, priced by its START time.

    Block i starts exactly i hours after entry. A block that starts at 21:59
    is a day block even though most of it falls after 22:00 -- the rate is
    decided once, at the start, which keeps the rule simple to explain.
    """
    blocks = []
    for i in range(billable_hours):
        block_start = entry_time + timedelta(hours=i)
        night = is_night(block_start.time())
        blocks.append(
            Block(
                index=i + 1,
                start=block_start,
                kind=NIGHT if night else DAY,
                amount=rate["night"] if night else rate["day"],
            )
        )
    return blocks


def _build_windows(blocks: list[Block], cap: int) -> list[Window]:
    """Rule 4: group blocks into 24-hour windows and cap each window.

    Windows are counted from the entry time (blocks 1-24, 25-48, ...), not from
    midnight, so a vehicle never gets two caps just because it crossed 00:00.
    """
    windows = []
    for start in range(0, len(blocks), CAP_WINDOW_HOURS):
        chunk = blocks[start:start + CAP_WINDOW_HOURS]
        raw = sum(b.amount for b in chunk)
        windows.append(
            Window(
                index=len(windows) + 1,
                hours=len(chunk),
                raw_amount=raw,
                cap=cap,
                charged=min(raw, cap),
                capped=raw > cap,
            )
        )
    return windows
