"""
Sustained-load p95 latency test for POST /api/auth/login (AUTH-02-TC-12).

`test_login_perf_smoke` is a reduced-load variant (3 requests / ~2s) that
always runs under the default `pytest` invocation, per `plan-authoring`'s
author-time-smoke convention — it exercises the harness itself without
adding real time to every CI run. The full 50 RPS / 60s assertion is
gated behind the `perf` marker (`pytest -m perf`) and is intentionally
excluded from `docs/config/project-commands.yaml`'s default `test`/
`test_unit` commands, matching the story's NFR ("performance test runs
only on PRs marked `perf`; not gating CI for every PR").
"""
import asyncio
import statistics
import time

import httpx
import pytest

from tests.conftest import client, TestingSessionLocal
from app.services.auth_service import AuthService


def _provision(email: str, password: str):
    client.post(
        "/api/users",
        json={
            "name": "Perf User",
            "email": email,
            "phone": "9876500002",
            "role": "User",
            "status": "Active",
        },
    )
    db = TestingSessionLocal()
    try:
        service = AuthService(db)
        user = service.repo.get_by_email(email)
        user.password_hash = service._hash_password(password)
        user.must_reset_password = False
        db.commit()
    finally:
        db.close()


async def _run_load(base_url: str, email: str, password: str, num_requests: int, concurrency: int) -> list[float]:
    latencies: list[float] = []

    async def _one_request(async_client: httpx.AsyncClient, use_valid: bool):
        payload = {"email": email, "password": password if use_valid else "wrong-password"}
        start = time.perf_counter()
        await async_client.post("/api/auth/login", json=payload)
        latencies.append(time.perf_counter() - start)

    async with httpx.AsyncClient(base_url=base_url, timeout=10.0) as async_client:
        for batch_start in range(0, num_requests, concurrency):
            batch_size = min(concurrency, num_requests - batch_start)
            await asyncio.gather(
                *[_one_request(async_client, use_valid=(i % 2 == 0)) for i in range(batch_size)]
            )
    return latencies


def _p95(latencies: list[float]) -> float:
    return statistics.quantiles(latencies, n=100)[94]


def test_login_perf_smoke(live_server):
    """Author-time smoke: exercises the harness itself, always runs in `pytest`."""
    _provision("perf.smoke@example.com", "smoke-password")
    latencies = asyncio.run(_run_load(live_server, "perf.smoke@example.com", "smoke-password", num_requests=3, concurrency=1))
    assert len(latencies) == 3


@pytest.mark.perf
def test_login_perf_sustained_load_p95_under_400ms(live_server):
    """Full harness: 50 RPS for 60s, p95 < 400ms. Runner: `pytest -m perf`."""
    _provision("perf.sustained@example.com", "sustained-password")

    rps = 50
    duration_seconds = 60
    total_requests = rps * duration_seconds

    latencies = asyncio.run(
        _run_load(live_server, "perf.sustained@example.com", "sustained-password", num_requests=total_requests, concurrency=rps)
    )

    assert len(latencies) == total_requests
    assert _p95(latencies) < 0.400
