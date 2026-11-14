"""Fee quotes: calculate a fee without saving anything (Fee Simulator)."""

from fastapi import APIRouter

from app import services
from app.schemas import FeeBreakdownOut, QuoteRequest

router = APIRouter(tags=["quote"])


@router.post("/quote", response_model=FeeBreakdownOut)
def quote(body: QuoteRequest) -> FeeBreakdownOut:
    """Return the full fee breakdown for a type, entry time and exit time."""
    breakdown = services.quote_fee(body.vehicle_type, body.entry_time, body.exit_time)
    return FeeBreakdownOut.model_validate(breakdown)
