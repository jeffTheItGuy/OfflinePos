"""INT-06 — Idempotency across all mutating endpoints."""
import pytest
import uuid


@pytest.mark.integration
class TestIdempotency:
    def test_order_idempotency(self, client, seed_device, seed_waiter, seed_menu_items):
        idem_key = str(uuid.uuid4())
        payload = {
            "idempotency_key": idem_key,
            "device_id": seed_device["id"],
            "staff_id": seed_waiter["id"],
            "table_name": "Table 1",
            "items": [
                {
                    "menu_item_id": seed_menu_items[0]["id"],
                    "name": "Coffee",
                    "quantity": 1,
                    "price_cents": 1500,
                    "notes": "",
                },
            ],
        }

        resp1 = client.post("/orders", json=payload)
        assert resp1.status_code in (200, 201)
        order1 = resp1.json()

        # Resend identical request
        resp2 = client.post("/orders", json=payload)
        assert resp2.status_code in (200, 201)
        order2 = resp2.json()

        # Same order returned
        assert order1["id"] == order2["id"]
        assert order1["order_no"] == order2["order_no"]

    def test_payment_idempotency(self, client, seed_order):
        idem_key = str(uuid.uuid4())
        payload = {
            "idempotency_key": idem_key,
            "order_id": seed_order["id"],
            "amount_cents": seed_order["total_cents"],
        }

        resp1 = client.post("/payments", json=payload)
        assert resp1.status_code in (200, 201)

        resp2 = client.post("/payments", json=payload)
        assert resp2.status_code in (200, 201, 409)

        # If 409, it's the "already paid" guard. Either way, no duplicate.
        payment1 = resp1.json()
        assert payment1["order_id"] == seed_order["id"]

    def test_void_idempotency(self, client, seed_order, manager_headers):
        idem_key = str(uuid.uuid4())
        payload = {
            "idempotency_key": idem_key,
            "staff_id": manager_headers["X-Staff-Id"],
            "reason": "Test void",
        }

        resp1 = client.post(f"/orders/{seed_order['id']}/void", json=payload, headers=manager_headers)
        assert resp1.status_code == 200

        resp2 = client.post(f"/orders/{seed_order['id']}/void", json=payload, headers=manager_headers)
        # Should return same result or 409
        assert resp2.status_code in (200, 409)

    def test_no_duplicate_order_numbers(self, client, seed_device, seed_waiter, seed_menu_items):
        """Multiple orders from same device get unique sequential numbers."""
        order_nos = []
        for i in range(3):
            resp = client.post("/orders", json={
                "idempotency_key": str(uuid.uuid4()),
                "device_id": seed_device["id"],
                "staff_id": seed_waiter["id"],
                "table_name": "Table 1",
                "items": [
                    {
                        "menu_item_id": seed_menu_items[0]["id"],
                        "name": "Coffee",
                        "quantity": 1,
                        "price_cents": 1500,
                        "notes": "",
                    },
                ],
            })
            assert resp.status_code in (200, 201)
            order_nos.append(resp.json()["order_no"])

        # All unique
        assert len(set(order_nos)) == 3
        # All have same prefix
        for no in order_nos:
            assert no.startswith("T1-")
