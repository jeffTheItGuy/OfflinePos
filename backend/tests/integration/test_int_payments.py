"""INT-09 — Cash payment rules and amount enforcement."""
import pytest
import uuid


@pytest.mark.integration
class TestCashPayments:
    def test_pay_exact_amount(self, client, seed_order):
        resp = client.post("/payments", json={
            "idempotency_key": str(uuid.uuid4()),
            "order_id": seed_order["id"],
            "amount_cents": seed_order["total_cents"],
        })
        assert resp.status_code in (200, 201)
        payment = resp.json()
        assert payment["order_id"] == seed_order["id"]
        assert payment["method"] == "cash"
        assert payment["amount_cents"] == seed_order["total_cents"]

    def test_order_payment_status_updates(self, client, seed_order):
        client.post("/payments", json={
            "idempotency_key": str(uuid.uuid4()),
            "order_id": seed_order["id"],
            "amount_cents": seed_order["total_cents"],
        })

        # Check order status
        orders = client.get("/orders").json()
        order = next(o for o in orders if o["id"] == seed_order["id"])
        assert order["payment_status"] == "paid"

    def test_second_payment_rejected(self, client, seed_order):
        client.post("/payments", json={
            "idempotency_key": str(uuid.uuid4()),
            "order_id": seed_order["id"],
            "amount_cents": seed_order["total_cents"],
        })

        resp = client.post("/payments", json={
            "idempotency_key": str(uuid.uuid4()),
            "order_id": seed_order["id"],
            "amount_cents": seed_order["total_cents"],
        })
        assert resp.status_code == 409

    def test_pay_void_order_rejected(self, client, seed_order, manager_headers):
        # Void first
        client.post(
            f"/orders/{seed_order['id']}/void",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "staff_id": manager_headers["X-Staff-Id"],
                "reason": "Voiding",
            },
            headers=manager_headers,
        )

        resp = client.post("/payments", json={
            "idempotency_key": str(uuid.uuid4()),
            "order_id": seed_order["id"],
            "amount_cents": seed_order["total_cents"],
        })
        assert resp.status_code == 409

    def test_zero_amount_rejected(self, client, seed_order):
        resp = client.post("/payments", json={
            "idempotency_key": str(uuid.uuid4()),
            "order_id": seed_order["id"],
            "amount_cents": 0,
        })
        assert resp.status_code in (422, 409)

    def test_wrong_amount_rejected(self, client, seed_order):
        """
        BLOCKER TEST: Payment amount must match order total.
        This test is expected to FAIL until the guard is implemented.
        """
        wrong_amount = seed_order["total_cents"] - 1
        resp = client.post("/payments", json={
            "idempotency_key": str(uuid.uuid4()),
            "order_id": seed_order["id"],
            "amount_cents": wrong_amount,
        })
        # Should be rejected — if this passes with 200/201, the blocker exists
        assert resp.status_code in (422, 409), (
            f"BLOCKER: Payment accepted with wrong amount "
            f"({wrong_amount} != {seed_order['total_cents']})"
        )

    def test_kitchen_status_unchanged_after_payment(self, client, seed_order):
        original_status = seed_order["status"]

        client.post("/payments", json={
            "idempotency_key": str(uuid.uuid4()),
            "order_id": seed_order["id"],
            "amount_cents": seed_order["total_cents"],
        })

        orders = client.get("/orders").json()
        order = next(o for o in orders if o["id"] == seed_order["id"])
        assert order["status"] == original_status  # kitchen status unchanged
        assert order["payment_status"] == "paid"
