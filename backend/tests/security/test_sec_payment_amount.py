"""SEC-05: Payment amount cannot be understated.
BLOCKER TEST: Server must reject payments that don't match order total.
"""
import pytest
import uuid


@pytest.mark.security
class TestPaymentAmountEnforcement:
    """SEC-05 — amount_cents must equal order.total_cents."""

    def test_zero_amount_rejected(self, client, seed_order):
        resp = client.post("/payments", json={
            "idempotency_key": str(uuid.uuid4()),
            "order_id": seed_order["id"],
            "amount_cents": 0,
        })
        assert resp.status_code in (409, 422), (
            f"Zero-amount payment should be rejected, got {resp.status_code}"
        )

    def test_underpayment_rejected(self, client, seed_order):
        wrong_amount = seed_order["total_cents"] - 1
        resp = client.post("/payments", json={
            "idempotency_key": str(uuid.uuid4()),
            "order_id": seed_order["id"],
            "amount_cents": wrong_amount,
        })
        assert resp.status_code in (409, 422), (
            f"BLOCKER: Underpayment accepted! "
            f"Paid {wrong_amount}, expected {seed_order['total_cents']}"
        )

    def test_overpayment_rejected(self, client, seed_order):
        wrong_amount = seed_order["total_cents"] + 100
        resp = client.post("/payments", json={
            "idempotency_key": str(uuid.uuid4()),
            "order_id": seed_order["id"],
            "amount_cents": wrong_amount,
        })
        assert resp.status_code in (409, 422), (
            f"Overpayment should be rejected, got {resp.status_code}"
        )

    def test_one_cent_under_rejected(self, client, seed_order):
        wrong_amount = seed_order["total_cents"] - 1
        resp = client.post("/payments", json={
            "idempotency_key": str(uuid.uuid4()),
            "order_id": seed_order["id"],
            "amount_cents": wrong_amount,
        })
        assert resp.status_code in (409, 422)

    def test_exact_amount_succeeds(self, client, seed_order):
        resp = client.post("/payments", json={
            "idempotency_key": str(uuid.uuid4()),
            "order_id": seed_order["id"],
            "amount_cents": seed_order["total_cents"],
        })
        assert resp.status_code in (200, 201)
        assert resp.json()["amount_cents"] == seed_order["total_cents"]

    def test_order_not_marked_paid_after_rejection(self, client, seed_order):
        # Attempt underpayment
        client.post("/payments", json={
            "idempotency_key": str(uuid.uuid4()),
            "order_id": seed_order["id"],
            "amount_cents": 1,
        })
        # Verify order is still unpaid
        resp = client.get(f"/orders/{seed_order['id']}")
        assert resp.json()["payment_status"] == "unpaid"

    def test_negative_amount_rejected(self, client, seed_order):
        resp = client.post("/payments", json={
            "idempotency_key": str(uuid.uuid4()),
            "order_id": seed_order["id"],
            "amount_cents": -100,
        })
        assert resp.status_code == 422
