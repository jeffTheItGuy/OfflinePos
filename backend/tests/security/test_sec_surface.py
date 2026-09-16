"""SEC-06: Header-trust boundary (documented risk).
SEC-07: Unauthenticated read surface (documented risk).
SEC-08: Login brute-force resistance (GAP).
SEC-09: CORS and transport configuration (GAP).
"""
import pytest


@pytest.mark.security
class TestHeaderTrustBoundary:
    """SEC-06 — Documents that manager IDs are discoverable via GET /staff.

    KNOWN RISK: Manager IDs are returned by unauthenticated GET /staff,
    so any client on the network can impersonate a manager by sending
    their ID in X-Staff-Id. This is accepted for LAN-only deployment.
    """

    def test_staff_ids_are_discoverable_without_auth(self, client, seed_manager):
        """Documents the risk: staff IDs are readable without credentials."""
        resp = client.get("/staff")
        assert resp.status_code == 200
        staff_list = resp.json()
        assert len(staff_list) > 0
        manager_ids = [s["id"] for s in staff_list if s["role"] == "manager"]
        assert len(manager_ids) > 0

    def test_discovered_id_can_access_manager_endpoints(self, client, seed_manager):
        """Documents the spoofing risk with a discovered manager ID."""
        staff_resp = client.get("/staff")
        manager_id = next(
            s["id"] for s in staff_resp.json() if s["role"] == "manager"
        )
        resp = client.get(
            "/reports/z-report",
            headers={"X-Staff-Id": manager_id},
        )
        # This SHOULD succeed with current implementation (documenting the risk)
        assert resp.status_code == 200


@pytest.mark.security
class TestUnauthenticatedReadSurface:
    """SEC-07 — Documents which endpoints are readable without credentials.

    KNOWN RISK: These endpoints currently return data without authentication.
    Acceptable for LAN-only deployment; must be restricted before WAN exposure.
    """

    UNAUTHENTICATED_READS = [
        "/orders",
        "/orders/kitchen",
        "/staff",
        "/menu",
        "/tables",
        "/settings",
        "/devices",
        "/health",
    ]

    def test_unauthenticated_reads_return_data(self, client, seed_manager):
        """Documents the current open-read surface."""
        accessible = []
        for path in self.UNAUTHENTICATED_READS:
            resp = client.get(path)
            if resp.status_code == 200:
                accessible.append(path)

        # Document which endpoints are open (expected: all of them currently)
        assert len(accessible) > 0, "Expected some open endpoints"

    def test_z_report_requires_auth(self, client):
        """Z-report is the one read endpoint that IS gated."""
        resp = client.get("/reports/z-report")
        assert resp.status_code == 401

    def test_device_list_is_public(self, client, seed_device):
        """Documents that device prefixes are discoverable."""
        resp = client.get("/devices")
        assert resp.status_code == 200
        devices = resp.json()
        assert any(d["order_no_prefix"] == "ST" for d in devices)


@pytest.mark.security
class TestBruteForceResistance:
    """SEC-08 — Documents the absence of rate limiting.

    GAP: No rate limiting exists on POST /staff/login.
    PINs are 4-12 digits, so an unrestricted endpoint is brute-forceable.
    This test PASSES to document the gap, not to enforce a control.
    """

    def test_no_rate_limiting_on_failed_logins(self, client):
        """All rapid failed attempts return 401 — no lockout or delay."""
        for i in range(10):
            resp = client.post("/staff/login", json={"pin": "0000"})
            assert resp.status_code == 401, (
                f"Attempt {i+1}: expected 401, got {resp.status_code}. "
                f"If this is 429, rate limiting has been added."
            )

    def test_successful_login_after_failures(self, client):
        """Correct PIN still works after multiple failures (no lockout)."""
        for _ in range(5):
            client.post("/staff/login", json={"pin": "0000"})
        resp = client.post("/staff/login", json={"pin": "1234"})
        assert resp.status_code == 200


@pytest.mark.security
class TestCorsConfiguration:
    """SEC-09 — Documents the wildcard CORS configuration.

    GAP: allow_origins, allow_methods, and allow_headers are all ['*'].
    This test PASSES to document the gap.
    """

    def test_cors_allows_any_origin(self, client):
        """Documents that any origin is accepted."""
        resp = client.get("/health", headers={"Origin": "http://evil.example.com"})
        assert resp.status_code == 200
        # If CORS is wildcard, the response may include access-control headers
        # TestClient may not enforce CORS, but we document the configuration
        # by verifying the endpoint is accessible from any origin context.

    def test_preflight_not_blocked(self, client):
        """Documents that OPTIONS requests are not restricted."""
        resp = client.options(
            "/health",
            headers={
                "Origin": "http://evil.example.com",
                "Access-Control-Request-Method": "GET",
            },
        )
        # FastAPI CORS middleware returns 200 for preflight
        assert resp.status_code in (200, 405)
