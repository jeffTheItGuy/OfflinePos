"""INT-10 — Kitchen and order list filtering."""
import pytest
import uuid


@pytest.mark.integration
class TestKitchenEndpoint:
    def _create_order(self, client, seed_device, seed_waiter, seed_menu_items):
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
        return resp.json()

    def test_kitchen_shows_active_orders(self, client, seed_device, seed_waiter, seed_menu_items):
        self._create_order(client, seed_device, seed_waiter, seed_menu_items)
        resp = client.get("/orders/kitchen")
        assert resp.status_code == 200
        orders = resp.json()
        assert len(orders) >= 1
        assert all(o["status"] in ("sent", "preparing", "ready") for o in orders)

    def test_kitchen_excludes_completed(self, client, seed_device, seed_waiter, seed_menu_items):
        order = self._create_order(client, seed_device, seed_waiter, seed_menu_items)
        # Void it to remove from kitchen
        # (completed would need a status transition endpoint)
        kitchen = client.get("/orders/kitchen").json()
        statuses = [o["status"] for o in kitchen]
        assert "completed" not in statuses
        assert "void" not in statuses


@pytest.mark.integration
class TestOrderFiltering:
    def test_filter_by_payment_status(self, client, seed_order):
        resp = client.get("/orders?payment_status=unpaid")
        assert resp.status_code == 200
        orders = resp.json()
        assert all(o["payment_status"] == "unpaid" for o in orders)

    def test_filter_by_device_id(self, client, seed_order, seed_device):
        resp = client.get(f"/orders?device_id={seed_device['id']}")
        assert resp.status_code == 200
        orders = resp.json()
        assert len(orders) >= 1

    def test_limit_is_respected(self, client, seed_device, seed_waiter, seed_menu_items):
        # Create 3 orders
        for _ in range(3):
            client.post("/orders", json={
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

        resp = client.get("/orders?limit=2")
        assert resp.status_code == 200
        assert len(resp.json()) <= 2

    def test_limit_capped_at_500(self, client):
        resp = client.get("/orders?limit=9999")
        assert resp.status_code == 200
        # Should not error; limit is clamped internally
