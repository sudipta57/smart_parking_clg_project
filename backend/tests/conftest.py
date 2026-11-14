"""Shared test fixtures: every API test gets its own fresh SQLite file."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import get_db, init_db
from app.main import app


@pytest.fixture
def client(tmp_path):
    """A TestClient wired to a temporary database (deleted after the test).

    The client is NOT used as a context manager, so the app's startup hook
    never touches the real backend/parking.db.
    """
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False}
    )
    init_db(engine)
    TestSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
    engine.dispose()
