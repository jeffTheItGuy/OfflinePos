"""INT-08 — Void rules and audit trail."""
import pytest
import uuid


@pytest.mark.integration
class TestVoidRules:
    def test_manager_can_void(self, client, seed_order, manager_headers):
        resp = client.post(
            f"/orders/{seed_order['id']}/void",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "staff_id": manager_headers["X-Staff-Id"],
                "reason": "Customer left",
            },
            headers=manager_headers,
        )
        assert resp.status_code == 200
        order = resp.json()
        assert order["status"] == "void"
        assert order["void_reason"] == "Customer left"
        assert "voided_by" in order or order.get("voided_by") is not None

    def test_waiter_cannot_void(self, client, seed_order, waiter_headers):
        resp = client.post(
            f"/orders/{seed_order['id']}/void",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "staff_id": waiter_headers["X-Staff-Id"],
                "reason": "Trying",
            },
            headers=waiter_headers,
        )
        assert resp.status_code == 403

    def test_empty_reason_rejected(self, client, seed_order, manager_headers):
        resp = client.post(
            f"/orders/{seed_order['id']}/void",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "staff_id": manager_headers["X-Staff-Id"],
                "reason": "",
            },
            headers=manager_headers,
        )
        assert resp.status_code == 422

    def test_paid_order_cannot_be_voided(self, client, seed_order, manager_headers):
        # Pay first
        client.post("/payments", json={
            "idempotency_key": str(uuid.uuid4()),
            "order_id": seed_order["id"],
            "amount_cents": seed_order["total_cents"],
        })

        resp = client.post(
            f"/orders/{seed_order['id']}/void",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "staff_id": manager_headers["X-Staff-Id"],
                "reason": "Too late",
            },
            headers=manager_headers,
        )
        assert resp.status_code == 409

    def test_double_void_returns_same_result(self, client, seed_order, manager_headers):
        idem_key = str(uuid.uuid4())
        payload = {
            "idempotency_key": idem_key,
            "staff_id": manager_headers["X-Staff-Id"],
            "reason": "Once is enough",
        }

        resp1 = client.post(f"/orders/{seed_order['id']}/void", json=payload, headers=manager_headers)
        assert resp1.status_code == 200

        resp2 = client.post(f"/orders/{seed_order['id']}/void", json=payload, headers=manager_headers)
        assert resp2.status_code in (200, 409)

    def test_void_without_header_rejected(self, client, seed_order):
        resp = client.post(
            f"/orders/{seed_order['id']}/void",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "reason": "No auth",
            },
        )
        assert resp.status_code == 401
