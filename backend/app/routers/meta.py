"""Health check and public configuration (rate card)."""

from fastapi import APIRouter

from app import services

router = APIRouter(tags=["meta"])


@router.get("/health")
def health() -> dict:
    """Simple liveness check."""
    return {"status": "ok"}


@router.get("/config")
def get_config() -> dict:
    """Rates, grace period, night window, capacity and labels for the UI."""
    return services.get_public_config()
