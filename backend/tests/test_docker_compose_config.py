"""
Structural config tests (AUTH-08): confirm docker-compose.yml's backend
service passes through JWT_SECRET_KEY and CORS_ORIGINS via `environment:`.

Plain-text assertions only (no YAML-parsing dependency added — see
PLAN.md § 7). TC-04's actual `docker-compose up` runtime check is
deferred to manual verification (no Docker daemon in this test
environment); this file's TC-03 assertion verifies the exact content
that a `docker-compose up` run depends on.
"""
from pathlib import Path

COMPOSE_PATH = Path(__file__).resolve().parents[2] / "docker-compose.yml"


def _backend_service_block() -> str:
    text = COMPOSE_PATH.read_text()
    # Backend service block runs from "backend:" up to the next top-level
    # (2-space-indented) service key, i.e. "frontend:".
    start = text.index("backend:")
    end = text.index("frontend:", start)
    return text[start:end]


def test_backend_service_passes_jwt_secret_key_via_environment():
    block = _backend_service_block()
    assert "environment:" in block
    assert "JWT_SECRET_KEY=${JWT_SECRET_KEY}" in block


def test_backend_service_passes_cors_origins_via_environment():
    block = _backend_service_block()
    assert "CORS_ORIGINS=" in block
    assert "${CORS_ORIGINS" in block
