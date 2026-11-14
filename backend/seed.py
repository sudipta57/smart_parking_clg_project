"""Demo data: wipes the database and refills it relative to the current time.

Run from the backend folder:  python seed.py

Every record goes through the same service functions the API uses
(create_entry / complete_exit), so slots, receipt numbers and amounts are
produced by the real rules -- no amount is hardcoded here.
"""

import sys
from dataclasses import dataclass
from datetime import datetime, timedelta

from app import services
from app.db import Base, SessionLocal, engine, init_db
from app.timeutils import now_ist

# Parked right now: (plate, type, minutes since entry).
PARKED = [
    ("WB06K4521", "BIKE", 20),
    ("WB02AB1234", "CAR", 70),
    ("WB12C7788", "BIKE", 165),
    ("WB24AF0099", "SUV", 240),
    ("WB20BK3310", "CAR", 390),
    ("WB74AD5566", "CAR", 26 * 60),   # over 24h -> shows the daily cap
]

# Completed today: (plate, type, stay in minutes, payment method).
# The first one is the overnight stay that left this morning.
COMPLETED_TODAY = [
    ("WB08F2210", "CAR", 540, "UPI"),
    ("WB10Z0451", "BIKE", 10, "CASH"),     # inside the grace period -> free
    ("WB04M8873", "CAR", 45, "CASH"),
    ("WB26AC1902", "SUV", 160, "UPI"),
    ("WB16N6604", "CAR", 75, "UPI"),
    ("WB52S3127", "BIKE", 30, "CASH"),
    ("WB02AK7340", "CAR", 200, "UPI"),
    ("WB40G1185", "BIKE", 95, "CASH"),
    ("WB06AM5012", "CAR", 12, "CASH"),     # inside the grace period -> free
    ("WB34T4499", "SUV", 130, "CASH"),
    ("WB18H9921", "BIKE", 60, "UPI"),
    ("WB20AN2468", "CAR", 250, "CASH"),
    ("WB02BC0786", "CAR", 90, "UPI"),
    ("WB44AB3001", "SUV", 300, "UPI"),
    ("WB12D5050", "BIKE", 40, "CASH"),
]

COMPLETED_YESTERDAY = [
    ("WB02AC4411", "CAR", 120, "CASH"),
    ("WB06P7720", "BIKE", 45, "UPI"),
    ("WB24AE6150", "SUV", 180, "UPI"),
    ("WB14R3398", "CAR", 90, "CASH"),
    ("WB02AD9001", "CAR", 300, "UPI"),
    ("WB38K1275", "BIKE", 60, "CASH"),
    ("WB10AF8832", "CAR", 25, "CASH"),
    ("WB22Q6064", "SUV", 150, "UPI"),
    ("WB02AE2530", "CAR", 240, "UPI"),
    ("WB54B7719", "BIKE", 75, "CASH"),
]


@dataclass
class Visit:
    """One planned visit; `exit` and `method` are None if still parked."""

    plate: str
    vehicle_type: str
    entry: datetime
    exit: datetime | None = None
    method: str | None = None
    session_id: int | None = None
    amount: int = 0


def spread(start: datetime, end: datetime, count: int) -> list[datetime]:
    """Return `count` evenly spaced times between start and end (whole minutes)."""
    step = (end - start) / (count + 1)
    return [(start + step * (i + 1)).replace(second=0, microsecond=0) for i in range(count)]


def plan_visits(now: datetime) -> tuple[list[Visit], list[Visit], list[Visit]]:
    """Turn the tables above into concrete entry/exit times around `now`."""
    today = datetime(now.year, now.month, now.day)
    yesterday = today - timedelta(days=1)

    parked = [Visit(p, t, now - timedelta(minutes=m)) for p, t, m in PARKED]

    # Today's exits fall between 06:00 and 10 minutes ago. If the seed is run
    # very early in the morning, use the whole of today so far instead.
    window_start = today + timedelta(hours=6)
    window_end = now - timedelta(minutes=10)
    if window_end <= window_start:
        window_start, window_end = today, now
    today_exits = spread(window_start, window_end, len(COMPLETED_TODAY))

    # Yesterday's exits fall between 08:00 and 21:30.
    yesterday_exits = spread(
        yesterday + timedelta(hours=8),
        yesterday + timedelta(hours=21, minutes=30),
        len(COMPLETED_YESTERDAY),
    )

    def completed(rows, exits):
        return [
            Visit(p, t, out - timedelta(minutes=m), out, method)
            for (p, t, m, method), out in zip(rows, exits)
        ]

    return parked, completed(COMPLETED_TODAY, today_exits), completed(
        COMPLETED_YESTERDAY, yesterday_exits
    )


def replay(db, visits: list[Visit]) -> None:
    """Apply every entry and exit in time order, like a real day at the lot.

    Replaying in order means slots are reused naturally and receipt numbers
    run 0001, 0002, ... in the order cars actually left.
    """
    events = []
    for v in visits:
        events.append((v.entry, 1, "entry", v))
        if v.exit is not None:
            events.append((v.exit, 0, "exit", v))   # 0: exits before entries at a tie
    events.sort(key=lambda e: (e[0], e[1]))

    for when, _order, kind, v in events:
        if kind == "entry":
            v.session_id = services.create_entry(db, v.plate, v.vehicle_type, when).id
        else:
            v.amount = services.complete_exit(db, v.session_id, v.method, when).amount


def format_inr(amount: int) -> str:
    """Indian digit grouping: 1185 -> "₹1,185", 123456 -> "₹1,23,456"."""
    digits = str(amount)
    head, tail = digits[:-3], digits[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return "₹" + ",".join(groups + [tail])


def main() -> None:
    """Wipe the database, insert the demo data and print a summary."""
    Base.metadata.drop_all(engine)
    init_db()

    parked, today, yesterday = plan_visits(now_ist())
    with SessionLocal() as db:
        replay(db, parked + today + yesterday)

    earned_today = sum(v.amount for v in today)
    # Avoid a crash on consoles that cannot print the ₹ sign (some Windows setups).
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")
    print(
        f"Seeded: {len(parked)} parked, {len(today)} completed today "
        f"({format_inr(earned_today)}), {len(yesterday)} completed yesterday."
    )


if __name__ == "__main__":
    main()
