"""
Shared pytest fixtures for the backend test suite: a single isolated
in-memory SQLite database and a single `TestClient` with `get_db`
overridden. `app.dependency_overrides` lives on the shared `app` object,
so every test module must reuse this one override (and this one engine)
rather than defining its own — otherwise whichever test module is
imported last would silently redirect every other module's requests to
its own database.
"""
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# AUTH-02: tests exercise real JWT signing (ADR-5) — a fixed test-only
# secret, set before `app.main` is imported so `AuthService._issue_token`
# always finds it via `os.getenv`.
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-do-not-use-in-production")

from app.main import app  # noqa: E402  (must follow the env var setdefault above)
from app.database import get_db, Base  # noqa: E402
from app.models import user  # noqa: E402,F401  (ensure model is registered on Base)

TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def _reset_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
