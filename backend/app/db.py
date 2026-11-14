"""Database connection (SQLite file at backend/parking.db)."""

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent.parent

# The file lives next to the backend code, so it is found no matter which
# folder the server is started from.
DATABASE_URL = f"sqlite:///{BACKEND_DIR / 'parking.db'}"

# check_same_thread=False: FastAPI may use the connection from a worker thread.
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Parent class for all ORM models."""


def init_db(target_engine=engine) -> None:
    """Create all tables that do not exist yet."""
    from app import models  # noqa: F401  (import registers the models on Base)

    Base.metadata.create_all(target_engine)


def get_db():
    """FastAPI dependency: open a DB session for one request, then close it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
