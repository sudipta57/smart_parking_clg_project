"""Parking sessions: entry, parked list, exit preview, exit and history.

Note: the fixed paths (/active, /history) are declared before /{session_id}
so that FastAPI does not try to read "active" as a session id.
"""

from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import services
from app.db import get_db
from app.schemas import (
    ActiveSessionOut,
    EntryRequest,
    ExitPreviewOut,
    ExitRequest,
    FeeBreakdownOut,
    SessionOut,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])

HISTORY_MAX_LIMIT = 500  # upper bound for the optional ?limit= parameter


@router.post("", status_code=201, response_model=SessionOut)
def create_session(body: EntryRequest, db: Session = Depends(get_db)):
    """Vehicle entry: validate the plate, assign a slot, start the clock."""
    return services.create_entry(db, body.vehicle_number, body.vehicle_type, body.entry_time)


@router.get("/active", response_model=list[ActiveSessionOut])
def active_sessions(db: Session = Depends(get_db)):
    """All parked vehicles with elapsed time and fee so far."""
    return services.list_active(db)


@router.get("/history", response_model=list[SessionOut])
def history(
    day: date | None = Query(None, alias="date", description="Filter by exit date"),
    q: str | None = Query(None, description="Part of a plate number"),
    limit: int | None = Query(None, ge=1, le=HISTORY_MAX_LIMIT),
    db: Session = Depends(get_db),
):
    """Completed sessions, newest exit first."""
    return services.list_history(db, day=day, q=q, limit=limit)


@router.get("/{session_id}", response_model=SessionOut)
def get_session(session_id: int, db: Session = Depends(get_db)):
    """One session, parked or completed."""
    return services.get_session(db, session_id)


@router.get("/{session_id}/exit-preview", response_model=ExitPreviewOut)
def exit_preview(
    session_id: int,
    exit_time: datetime | None = None,
    db: Session = Depends(get_db),
) -> ExitPreviewOut:
    """The fee if the vehicle left now (or at exit_time). Nothing is saved."""
    session, exit_, breakdown = services.preview_exit(db, session_id, exit_time)
    return ExitPreviewOut(
        session=SessionOut.model_validate(session),
        exit_time=exit_,
        breakdown=FeeBreakdownOut.model_validate(breakdown),
    )


@router.post("/{session_id}/exit", response_model=SessionOut)
def exit_session(session_id: int, body: ExitRequest, db: Session = Depends(get_db)):
    """Confirm exit and payment: completes the session and issues a receipt."""
    return services.complete_exit(db, session_id, body.payment_method, body.exit_time)
