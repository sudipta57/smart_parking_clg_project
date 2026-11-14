"""Dashboard numbers."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import services
from app.db import get_db
from app.schemas import StatsOut

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/today", response_model=StatsOut)
def today(db: Session = Depends(get_db)) -> dict:
    """Today's earnings, vehicle counts and occupancy."""
    return services.stats_today(db)
