"""INT-02 — Staff login and manager authorization."""
import pytest


@pytest.mark.integration
class TestStaffLogin:
    def test_login_with_correct_pin(self, client):
        resp = client.post("/staff/login", json={"pin": "1234"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "manager"
        assert "pin_hash" not in data

    def test_login_with_wrong_pin(self, client):
        resp = client.post("/staff/login", json={"pin": "9999"})
        assert resp.status_code == 401

    def test_pin_hash_never_in_response(self, client):
        resp = client.post("/staff/login", json={"pin": "1234"})
        assert "pin_hash" not in resp.text


@pytest.mark.integration
class TestManagerAuthorization:
    """Every manager-only endpoint must reject unauthorized access."""

    MANAGER_ENDPOINTS = [
        ("POST", "/menu", {"name": "X", "price_cents": 100, "category": "test"}),
        ("POST", "/tables", {"name": "T1", "section": "DINE-IN"}),
        ("POST", "/staff", {"name": "New", "pin": "1111", "role": "waiter"}),
        ("PATCH", "/settings", {"currency": "EUR"}),
        ("GET", "/reports/z-report", None),
    ]

    def test_missing_header_returns_401(self, client):
        for method, path, body in self.MANAGER_ENDPOINTS:
            if method == "GET":
                resp = client.get(path)
            elif method == "POST":
                resp = client.post(path, json=body)
            elif method == "PATCH":
                resp = client.patch(path, json=body)
            assert resp.status_code == 401, f"{method} {path} should be 401"

    def test_waiter_header_returns_403(self, client, seed_waiter):
        headers = {"X-Staff-Id": seed_waiter["id"]}
        for method, path, body in self.MANAGER_ENDPOINTS:
            if method == "GET":
                resp = client.get(path, headers=headers)
            elif method == "POST":
                resp = client.post(path, json=body, headers=headers)
            elif method == "PATCH":
                resp = client.patch(path, json=body, headers=headers)
            assert resp.status_code == 403, f"{method} {path} should be 403"

    def test_active_manager_allowed(self, client, seed_manager):
        headers = {"X-Staff-Id": seed_manager["id"]}
        resp = client.get("/reports/z-report", headers=headers)
        assert resp.status_code == 200

    def test_staff_list_never_contains_pin_hash(self, client):
        resp = client.get("/staff")
        assert resp.status_code == 200
        for staff in resp.json():
            assert "pin_hash" not in staff
