"""
Live-uvicorn-instance fixture for the login endpoint's sustained-load
perf harness (AUTH-02-TC-12). Boots `uvicorn.Server` in a background
thread on an ephemeral port against the same isolated test database used
by the rest of the suite (see `tests/conftest.py`), so `AsyncClient`
requests exercise the real ASGI stack (middleware, exception handlers)
rather than an in-process `TestClient` shortcut.
"""
import socket
import threading
import time

import pytest
import uvicorn

from tests.conftest import app  # noqa: F401  (ensures the shared get_db override is applied first)


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="module")
def live_server():
    port = _free_port()
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)

    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    deadline = time.time() + 10
    while not server.started and time.time() < deadline:
        time.sleep(0.05)

    base_url = f"http://127.0.0.1:{port}"
    try:
        yield base_url
    finally:
        server.should_exit = True
        thread.join(timeout=10)
