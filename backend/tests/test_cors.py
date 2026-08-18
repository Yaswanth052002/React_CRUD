"""
CORS regression test (AUTH-08 TC-09): confirms the backend's existing
`allow_headers=["*"]` CORS configuration already permits an `Authorization`
header cross-origin, so AUTH-04's bearer-token frontend flow is not
blocked by a CORS preflight rejection. No code change accompanies this
test — it regression-confirms condition C-4.
"""
from tests.conftest import client


def test_cors_preflight_allows_authorization_header():
    response = client.options(
        "/api/users",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization",
        },
    )
    assert response.status_code == 200
    allow_headers = response.headers.get("access-control-allow-headers", "")
    assert "Authorization" in allow_headers or allow_headers == "*"
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
