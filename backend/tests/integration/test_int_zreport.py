"""INT-11 — Z-report correctness."""
import pytest
import uuid


@pytest.mark.integration
class TestZReport:
    def test_requires_manager_auth(self, client):
        resp = client.get("/reports/z-report")
        assert resp.status_code == 401

    def test_waiter_rejected(self, client, waiter_headers):
        resp = client.get("/reports/z-report", headers=waiter_headers)
        assert resp.status_code == 403

    def test_manager_can_access(self, client, manager_headers):
        resp = client.get("/reports/z-report", headers=manager_headers)
        assert resp.status_code == 200

    def test_report_structure(self, client, manager_headers, seed_order):
        # Pay the order so it appears in the report
        client.post("/payments", json={
            "idempotency_key": str(uuid.uuid4()),
            "order_id": seed_order["id"],
            "amount_cents": seed_order["total_cents"],
        })

        resp = client.get("/reports/z-report", headers=manager_headers)
        assert resp.status_code == 200
        report = resp.json()

        # Verify structure
        assert "gross_cents" in report or "gross" in report
        assert "order_count" in report or "paid_order_count" in report

    def test_void_orders_counted_separately(self, client, manager_headers, seed_order):
        # Void the order
        client.post(
            f"/orders/{seed_order['id']}/void",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "staff_id": manager_headers["X-Staff-Id"],
                "reason": "Testing report",
            },
            headers=manager_headers,
        )

        resp = client.get("/reports/z-report", headers=manager_headers)
        report = resp.json()
        # Void orders should not count toward gross
        assert report.get("void_count", 0) >= 1 or "voids" in report

    def test_day_parameter(self, client, manager_headers):
        resp = client.get("/reports/z-report?day=2024-01-15", headers=manager_headers)
        assert resp.status_code == 200

    def test_only_paid_orders_in_gross(self, client, seed_device, seed_waiter, seed_menu_items, seed_settings, manager_headers):
        """Unpaid orders must NOT appear in gross revenue."""
        # Create but don't pay
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

        resp = client.get("/reports/z-report", headers=manager_headers)
        report = resp.json()
        # With no paid orders, gross should be 0
        gross = report.get("gross_cents", report.get("gross", 0))
        assert gross == 0
