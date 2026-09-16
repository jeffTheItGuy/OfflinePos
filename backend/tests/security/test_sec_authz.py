"""SEC-03: Manager-only surface is fully gated.
SEC-04: Void authorization cannot be bypassed.
"""
import pytest
import uuid


MANAGER_ENDPOINTS = [
    ("POST", "/menu", {"name": "X", "price_cents": 100, "category": "test"}),
    ("POST", "/tables", {"name": "T1", "section": "DINE-IN"}),
    ("POST", "/staff", {"name": "New", "pin": "1111", "role": "waiter"}),
    ("PATCH", "/settings", {"currency": "EUR"}),
    ("GET", "/reports/z-report", None),
]


@pytest.mark.security
class TestManagerOnlyEndpoints:
    """SEC-03 — Every privileged endpoint rejects unauthorized access."""

    def test_missing_header_returns_401(self, client):
        for method, path, body in MANAGER_ENDPOINTS:
            if method == "GET":
                resp = client.get(path)
            elif method == "POST":
                resp = client.post(path, json=body)
            elif method == "PATCH":
                resp = client.patch(path, json=body)
            assert resp.status_code == 401, (
                f"{method} {path} should be 401 without header, "
                f"got {resp.status_code}"
            )

    def test_waiter_header_returns_403(self, client, seed_waiter):
        headers = {"X-Staff-Id": seed_waiter["id"]}
        for method, path, body in MANAGER_ENDPOINTS:
            if method == "GET":
                resp = client.get(path, headers=headers)
            elif method == "POST":
                resp = client.post(path, json=body, headers=headers)
            elif method == "PATCH":
                resp = client.patch(path, json=body, headers=headers)
            assert resp.status_code == 403, (
                f"{method} {path} should be 403 for waiter, "
                f"got {resp.status_code}"
            )

    def test_nonexistent_staff_id_returns_403(self, client):
        headers = {"X-Staff-Id": "nonexistent-id-00000"}
        for method, path, body in MANAGER_ENDPOINTS:
            if method == "GET":
                resp = client.get(path, headers=headers)
            elif method == "POST":
                resp = client.post(path, json=body, headers=headers)
            elif method == "PATCH":
                resp = client.patch(path, json=body, headers=headers)
            assert resp.status_code == 403, (
                f"{method} {path} should be 403 for fake ID"
            )

    def test_active_manager_is_allowed(self, client, manager_headers):
        resp = client.get("/reports/z-report", headers=manager_headers)
        assert resp.status_code == 200

        resp = client.post(
            "/staff",
            json={"name": "Auth Test", "pin": "4444", "role": "waiter"},
            headers=manager_headers,
        )
        assert resp.status_code in (200, 201)

    def test_menu_crud_requires_manager(self, client, seed_manager, seed_waiter):
        # Create as manager — should work
        resp = client.post(
            "/menu",
            json={"name": "Sec Item", "price_cents": 500, "category": "test"},
            headers={"X-Staff-Id": seed_manager["id"]},
        )
        assert resp.status_code in (200, 201)
        item_id = resp.json()["id"]

        # Update as waiter — should fail
        resp = client.patch(
            f"/menu/{item_id}",
            json={"price_cents": 1},
            headers={"X-Staff-Id": seed_waiter["id"]},
        )
        assert resp.status_code == 403

        # Delete as waiter — should fail
        resp = client.delete(
            f"/menu/{item_id}",
            headers={"X-Staff-Id": seed_waiter["id"]},
        )
        assert resp.status_code == 403

    def test_table_crud_requires_manager(self, client, seed_manager, seed_waiter):
        resp = client.post(
            "/tables",
            json={"name": "Sec Table", "section": "VIP"},
            headers={"X-Staff-Id": seed_manager["id"]},
        )
        assert resp.status_code in (200, 201)
        table_id = resp.json()["id"]

        resp = client.patch(
            f"/tables/{table_id}",
            json={"name": "Hacked"},
            headers={"X-Staff-Id": seed_waiter["id"]},
        )
        assert resp.status_code == 403

        resp = client.delete(
            f"/tables/{table_id}",
            headers={"X-Staff-Id": seed_waiter["id"]},
        )
        assert resp.status_code == 403


@pytest.mark.security
class TestVoidAuthorization:
    """SEC-04 — Void cannot be bypassed with forged staff IDs."""

    def test_waiter_cannot_void(self, client, seed_order, waiter_headers):
        resp = client.post(
            f"/orders/{seed_order['id']}/void",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "staff_id": waiter_headers["X-Staff-Id"],
                "reason": "Trying to bypass",
            },
            headers=waiter_headers,
        )
        assert resp.status_code == 403

    def test_void_without_header_rejected(self, client, seed_order):
        resp = client.post(
            f"/orders/{seed_order['id']}/void",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "reason": "No auth header",
            },
        )
        assert resp.status_code == 401

    def test_void_with_fabricated_staff_id(self, client, seed_order):
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = client.post(
            f"/orders/{seed_order['id']}/void",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "staff_id": fake_id,
                "reason": "Forged ID",
            },
            headers={"X-Staff-Id": fake_id},
        )
        assert resp.status_code in (401, 403)

    def test_manager_void_succeeds(self, client, seed_order, manager_headers):
        resp = client.post(
            f"/orders/{seed_order['id']}/void",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "staff_id": manager_headers["X-Staff-Id"],
                "reason": "Authorized void",
            },
            headers=manager_headers,
        )
        assert resp.status_code == 200
        order = resp.json()
        assert order["status"] == "void"
        assert order["void_reason"] == "Authorized void"

    def test_void_with_waiter_body_but_manager_header(
        self, client, seed_order, seed_waiter, manager_headers
    ):
        """Body says waiter, header says manager — header wins."""
        resp = client.post(
            f"/orders/{seed_order['id']}/void",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "staff_id": seed_waiter["id"],
                "reason": "Mixed identity",
            },
            headers=manager_headers,
        )
        assert resp.status_code == 200
        order = resp.json()
        assert order["status"] == "void"
