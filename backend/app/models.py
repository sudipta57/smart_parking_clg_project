"""ORM model for the parking_sessions table."""

from datetime import datetime

from sqlalchemy import Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.timeutils import now_ist

STATUS_PARKED = "PARKED"
STATUS_COMPLETED = "COMPLETED"


class ParkingSession(Base):
    """One visit of one vehicle: created on entry, completed on exit."""

    __tablename__ = "parking_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vehicle_number: Mapped[str] = mapped_column(String, index=True)
    vehicle_type: Mapped[str] = mapped_column(String)
    slot_code: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, index=True, default=STATUS_PARKED)
    entry_time: Mapped[datetime] = mapped_column(index=True)            # naive IST
    exit_time: Mapped[datetime | None] = mapped_column(index=True)      # naive IST
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    billable_hours: Mapped[int | None] = mapped_column(Integer)
    amount: Mapped[int | None] = mapped_column(Integer)                 # rupees
    payment_method: Mapped[str | None] = mapped_column(String)
    receipt_no: Mapped[str | None] = mapped_column(String, unique=True)
    fee_breakdown: Mapped[str | None] = mapped_column(Text)             # JSON snapshot
    created_at: Mapped[datetime] = mapped_column(default=now_ist)

    # Safety net in the database itself: while a session is PARKED, no other
    # PARKED session may have the same plate or the same slot. The service
    # layer checks this first to give a friendly message; these indexes stop
    # duplicates even if two requests arrive at the same moment.
    __table_args__ = (
        Index(
            "uq_parked_vehicle", "vehicle_number", unique=True,
            sqlite_where=text("status = 'PARKED'"),
        ),
        Index(
            "uq_parked_slot", "slot_code", unique=True,
            sqlite_where=text("status = 'PARKED'"),
        ),
    )
