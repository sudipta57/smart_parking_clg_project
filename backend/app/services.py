"""Business logic: entry, exit, slot assignment, receipts, history and stats.

Routers stay thin: they parse the request, call one function here, and
return the result. Errors are raised as ServiceError subclasses, which
main.py turns into JSON responses like {"detail": "..."}.
"""

import json
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import (
    CAP_WINDOW_HOURS,
    CAPACITY,
    FUTURE_TOLERANCE_MINUTES,
    GRACE_MINUTES,
    NIGHT_END,
    NIGHT_START,
    PAYMENT_METHODS,
    RATES,
    RECEIPT_PREFIX,
    RECEIPT_SEQ_DIGITS,
    SLOT_PREFIX,
    TIMEZONE,
    VEHICLE_LABELS,
)
from app.fee_engine import FeeBreakdown, InvalidTimeRange, calculate_fee
from app.models import STATUS_COMPLETED, STATUS_PARKED, ParkingSession
from app.schemas import ActiveSessionOut, FeeBreakdownOut, SessionOut
from app.timeutils import day_bounds, now_ist, to_ist_naive
from app.validators import is_valid_plate, normalize_plate


# --- Errors -------------------------------------------------------------------

class ServiceError(Exception):
    """Base class for errors that should reach the user as a message."""

    status_code = 400

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class NotFoundError(ServiceError):
    status_code = 404


class ConflictError(ServiceError):
    status_code = 409


class InvalidInputError(ServiceError):
    status_code = 422


# --- Config & quotes ------------------------------------------------------------

def get_public_config() -> dict:
    """Rates and rules for the UI rate card (read straight from config.py)."""
    return {
        "timezone": TIMEZONE,
        "grace_minutes": GRACE_MINUTES,
        "night_start": NIGHT_START.strftime("%H:%M"),
        "night_end": NIGHT_END.strftime("%H:%M"),
        "cap_window_hours": CAP_WINDOW_HOURS,
        "rates": RATES,
        "capacity": CAPACITY,
        "vehicle_labels": VEHICLE_LABELS,
        "payment_methods": list(PAYMENT_METHODS),
        "vehicle_types": [
            {
                "type": vtype,
                "label": VEHICLE_LABELS[vtype],
                "day_rate": rate["day"],
                "night_rate": rate["night"],
                "daily_cap": rate["cap"],
                "capacity": CAPACITY[vtype],
            }
            for vtype, rate in RATES.items()
        ],
    }


def quote_fee(vehicle_type: str, entry_time: datetime, exit_time: datetime) -> FeeBreakdown:
    """Calculate a fee without saving anything (used by the Fee Simulator)."""
    return _calculate(vehicle_type, to_ist_naive(entry_time), to_ist_naive(exit_time))


def breakdown_to_dict(breakdown: FeeBreakdown) -> dict:
    """Convert a FeeBreakdown into the JSON-ready dict the API sends."""
    return FeeBreakdownOut.model_validate(breakdown).model_dump(mode="json")


def _calculate(vehicle_type: str, entry: datetime, exit_: datetime) -> FeeBreakdown:
    """Call the fee engine and turn its time error into a user-facing 422."""
    try:
        return calculate_fee(vehicle_type, entry, exit_)
    except InvalidTimeRange:
        raise InvalidInputError("Exit time cannot be before entry time")


# --- Entry ----------------------------------------------------------------------

def create_entry(
    db: Session, vehicle_number: str, vehicle_type: str, entry_time: datetime | None = None
) -> ParkingSession:
    """Record a vehicle entering the lot and assign it the lowest free slot."""
    plate = normalize_plate(vehicle_number)
    if not is_valid_plate(plate):
        raise InvalidInputError("Invalid vehicle number format")
    if vehicle_type not in RATES:
        raise InvalidInputError("Unknown vehicle type")

    entry = _resolve_time(entry_time, now_ist(), "Entry")

    existing = _find_parked(db, plate)
    if existing:
        raise ConflictError(f"Vehicle {plate} is already parked in slot {existing.slot_code}")

    session = ParkingSession(
        vehicle_number=plate,
        vehicle_type=vehicle_type,
        slot_code=find_free_slot(db, vehicle_type),
        status=STATUS_PARKED,
        entry_time=entry,
    )
    db.add(session)
    try:
        db.commit()
    except IntegrityError:
        # Two requests raced for the same plate or slot; the DB index stopped one.
        db.rollback()
        raise ConflictError("That vehicle or slot was just taken. Please try again.")
    return session


def find_free_slot(db: Session, vehicle_type: str) -> str:
    """Return the lowest free slot code for a type, e.g. "C-01".

    A slot is free if no PARKED session is using it.
    """
    taken = set(
        db.scalars(
            select(ParkingSession.slot_code).where(
                ParkingSession.status == STATUS_PARKED,
                ParkingSession.vehicle_type == vehicle_type,
            )
        )
    )
    capacity = CAPACITY[vehicle_type]
    for number in range(1, capacity + 1):
        code = f"{SLOT_PREFIX[vehicle_type]}-{number:02d}"
        if code not in taken:
            return code
    label = VEHICLE_LABELS[vehicle_type]
    raise ConflictError(f"No free slots for {label} ({len(taken)}/{capacity} occupied)")


def _find_parked(db: Session, plate: str) -> ParkingSession | None:
    """Return the PARKED session for a plate, if there is one."""
    return db.scalar(
        select(ParkingSession).where(
            ParkingSession.vehicle_number == plate,
            ParkingSession.status == STATUS_PARKED,
        )
    )


def _resolve_time(requested: datetime | None, now: datetime, label: str) -> datetime:
    """Pick the time for an entry/exit: the demo override if given, else now.

    An override may not be in the future (beyond a small clock tolerance).
    If it is slightly ahead, it is pulled back to `now` so that durations
    are never negative.
    """
    if requested is None:
        return now
    value = to_ist_naive(requested).replace(microsecond=0)
    if value > now + timedelta(minutes=FUTURE_TOLERANCE_MINUTES):
        raise InvalidInputError(f"{label} time cannot be in the future")
    return min(value, now)


# --- Reading sessions -------------------------------------------------------------

def get_session(db: Session, session_id: int) -> ParkingSession:
    """Return one session (any status) or raise a 404."""
    session = db.get(ParkingSession, session_id)
    if session is None:
        raise NotFoundError(f"Session {session_id} not found")
    return session


def list_active(db: Session) -> list[ActiveSessionOut]:
    """All parked vehicles, oldest entry first, with elapsed time and fee so far."""
    now = now_ist()
    sessions = db.scalars(
        select(ParkingSession)
        .where(ParkingSession.status == STATUS_PARKED)
        .order_by(ParkingSession.entry_time, ParkingSession.id)
    ).all()
    return [_with_fee_so_far(s, now) for s in sessions]


def _with_fee_so_far(session: ParkingSession, now: datetime) -> ActiveSessionOut:
    """Attach elapsed time and the current fee to a parked session."""
    fee = calculate_fee(session.vehicle_type, session.entry_time, max(now, session.entry_time))
    return ActiveSessionOut(
        **dict(SessionOut.model_validate(session)),
        elapsed_minutes=fee.duration_minutes,
        elapsed_text=fee.duration_text,
        current_fee=fee.total,
    )


def list_history(
    db: Session, day: date | None = None, q: str | None = None, limit: int | None = None
) -> list[ParkingSession]:
    """Completed sessions, newest exit first.

    `day` filters by EXIT date, `q` matches any part of the plate.
    """
    stmt = select(ParkingSession).where(ParkingSession.status == STATUS_COMPLETED)
    if day is not None:
        start, end = day_bounds(day)
        stmt = stmt.where(ParkingSession.exit_time >= start, ParkingSession.exit_time < end)
    term = normalize_plate(q or "")
    if term:
        stmt = stmt.where(ParkingSession.vehicle_number.contains(term, autoescape=True))
    stmt = stmt.order_by(ParkingSession.exit_time.desc(), ParkingSession.id.desc())
    if limit:
        stmt = stmt.limit(limit)
    return list(db.scalars(stmt))


# --- Exit -------------------------------------------------------------------------

def preview_exit(
    db: Session, session_id: int, exit_time: datetime | None = None
) -> tuple[ParkingSession, datetime, FeeBreakdown]:
    """Work out the fee if the vehicle left now (or at `exit_time`). Saves nothing."""
    session = get_session(db, session_id)
    if session.status == STATUS_COMPLETED:
        raise ConflictError("Session already completed")

    now = now_ist()
    if exit_time is None:
        # max(): a vehicle entered "just now" can never have a negative stay.
        exit_ = max(now, session.entry_time)
    else:
        exit_ = _resolve_time(exit_time, now, "Exit")
    return session, exit_, _calculate(session.vehicle_type, session.entry_time, exit_)


def complete_exit(
    db: Session, session_id: int, payment_method: str, exit_time: datetime | None = None
) -> ParkingSession:
    """Confirm the exit: save the fee, payment and receipt number, free the slot."""
    if payment_method not in PAYMENT_METHODS:
        raise InvalidInputError("Payment method must be CASH or UPI")

    session, exit_, breakdown = preview_exit(db, session_id, exit_time)

    session.exit_time = exit_
    session.duration_minutes = breakdown.duration_minutes
    session.billable_hours = breakdown.billable_hours
    session.amount = breakdown.total
    session.payment_method = payment_method
    session.receipt_no = next_receipt_no(db, exit_.date())
    # Snapshot the full breakdown so the receipt never changes, even if
    # the rates in config.py are edited later.
    session.fee_breakdown = json.dumps(breakdown_to_dict(breakdown))
    session.status = STATUS_COMPLETED  # the slot is free from this moment
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ConflictError("Another exit was saved at the same moment. Please try again.")
    return session


def next_receipt_no(db: Session, exit_date: date) -> str:
    """Receipt number PK-YYYYMMDD-NNNN, where NNNN = exits on that date + 1."""
    start, end = day_bounds(exit_date)
    completed = db.scalar(
        select(func.count()).select_from(ParkingSession).where(
            ParkingSession.status == STATUS_COMPLETED,
            ParkingSession.exit_time >= start,
            ParkingSession.exit_time < end,
        )
    )
    return f"{RECEIPT_PREFIX}-{exit_date:%Y%m%d}-{completed + 1:0{RECEIPT_SEQ_DIGITS}d}"


# --- Dashboard stats ------------------------------------------------------------------

def stats_today(db: Session) -> dict:
    """Numbers for the dashboard. Earnings use EXIT date; vehicles in use ENTRY date."""
    today = now_ist().date()
    start, end = day_bounds(today)
    exited_today = (
        ParkingSession.status == STATUS_COMPLETED,
        ParkingSession.exit_time >= start,
        ParkingSession.exit_time < end,
    )

    by_method = dict(
        db.execute(
            select(ParkingSession.payment_method, func.sum(ParkingSession.amount))
            .where(*exited_today)
            .group_by(ParkingSession.payment_method)
        ).all()
    )
    earnings_by_method = {m: int(by_method.get(m) or 0) for m in PAYMENT_METHODS}

    parked_by_type = dict(
        db.execute(
            select(ParkingSession.vehicle_type, func.count())
            .where(ParkingSession.status == STATUS_PARKED)
            .group_by(ParkingSession.vehicle_type)
        ).all()
    )

    return {
        "date": today,
        "earnings_today": sum(earnings_by_method.values()),
        "earnings_by_method": earnings_by_method,
        "vehicles_in_today": _count(
            db, ParkingSession.entry_time >= start, ParkingSession.entry_time < end
        ),
        "vehicles_out_today": _count(db, *exited_today),
        "currently_parked": sum(parked_by_type.values()),
        "occupancy": {
            vtype: {"parked": parked_by_type.get(vtype, 0), "capacity": capacity}
            for vtype, capacity in CAPACITY.items()
        },
    }


def _count(db: Session, *conditions) -> int:
    """Count sessions matching all the given conditions."""
    return db.scalar(select(func.count()).select_from(ParkingSession).where(*conditions))
