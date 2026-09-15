"""INT-05 — Order creation and server-side totals."""
import pytest
import uuid


@pytest.mark.integration
class TestOrderCreation:
    def test_server_computes_totals(self, client, seed_device, seed_waiter, seed_menu_items, seed_settings):
        """Client-supplied totals are ignored; server computes them."""
        idem_key = str(uuid.uuid4())
        resp = client.post("/orders", json={
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
                {
                    "menu_item_id": seed_menu_items[1]["id"],
                    "name": "Tea",
                    "quantity": 1,
                    "price_cents": 1000,
                    "notes": "",
                },
            ],
        })
        assert resp.status_code in (200, 201)
        order = resp.json()

        # subtotal = 1500 + 1000 = 2500
        assert order["subtotal_cents"] == 2500
        # tax = round(2500*0.15) + round(2500*0.10) = 375 + 250 = 625
        assert order["tax_cents"] == 625
        # total = 2500 + 625 = 3125
        assert order["total_cents"] == 3125

    def test_order_number_uses_device_prefix(self, client, seed_device, seed_waiter, seed_menu_items):
        idem_key = str(uuid.uuid4())
        resp = client.post("/orders", json={
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
        })
        order = resp.json()
        assert order["order_no"].startswith("T1-")

    def test_unknown_device_rejected(self, client, seed_menu_items):
        resp = client.post("/orders", json={
            "idempotency_key": str(uuid.uuid4()),
            "device_id": "nonexistent-device-id",
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
        assert resp.status_code == 422

    def test_empty_items_rejected(self, client, seed_device, seed_waiter):
        resp = client.post("/orders", json={
            "idempotency_key": str(uuid.uuid4()),
            "device_id": seed_device["id"],
            "staff_id": seed_waiter["id"],
            "table_name": "Table 1",
            "items": [],
        })
        assert resp.status_code == 422

    def test_items_are_snapshotted(self, client, seed_device, seed_waiter, seed_menu_items):
        idem_key = str(uuid.uuid4())
        resp = client.post("/orders", json={
            "idempotency_key": idem_key,
            "device_id": seed_device["id"],
            "staff_id": seed_waiter["id"],
            "table_name": "Table 1",
            "items": [
                {
                    "menu_item_id": seed_menu_items[0]["id"],
                    "name": "Coffee",
                    "quantity": 2,
                    "price_cents": 1500,
                    "notes": "extra hot",
                },
            ],
        })
        order = resp.json()
        assert len(order["items"]) == 1
        assert order["items"][0]["name"] == "Coffee"
        assert order["items"][0]["quantity"] == 2
        assert order["items"][0]["notes"] == "extra hot"
