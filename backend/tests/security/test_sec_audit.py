"""SEC-11: Void and payment audit integrity."""
import pytest
import uuid


@pytest.mark.security
class TestVoidAuditIntegrity:
    """SEC-11 — Every void is attributable and appears in reports."""

    def test_void_records_correct_manager(
        self, client, seed_order, seed_manager, manager_headers
    ):
        resp = client.post(
            f"/orders/{seed_order['id']}/void",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "staff_id": manager_headers["X-Staff-Id"],
                "reason": "Audit test",
            },
            headers=manager_headers,
        )
        assert resp.status_code == 200
        order = resp.json()
        assert order["status"] == "void"
        assert order["void_reason"] == "Audit test"
        assert order["voided_by"] == seed_manager["id"]

    def test_void_appears_in_z_report(self, client, seed_order, manager_headers):
        # Void the order
        client.post(
            f"/orders/{seed_order['id']}/void",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "staff_id": manager_headers["X-Staff-Id"],
                "reason": "Z-report audit",
            },
            headers=manager_headers,
        )
        # Check Z-report
        resp = client.get("/reports/z-report", headers=manager_headers)
        assert resp.status_code == 200
        report = resp.json()
        assert report["void_count"] >= 1
        void_entries = report.get("voids", [])
        assert any(
            v["order_id"] == seed_order["id"] and v["reason"] == "Z-report audit"
            for v in void_entries
        )

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
        # Attempt void
        resp = client.post(
            f"/orders/{seed_order['id']}/void",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "staff_id": manager_headers["X-Staff-Id"],
                "reason": "Should fail",
            },
            headers=manager_headers,
        )
        assert resp.status_code == 409

    def test_two_managers_void_separately(
        self, client, seed_device, seed_waiter, seed_menu_items,
        seed_manager, manager_headers
    ):
        """Two different managers void different orders — both attributed."""
        # Create a second manager
        resp = client.post(
            "/staff",
            json={"name": "Second Manager", "pin": "7777", "role": "manager"},
            headers=manager_headers,
        )
        assert resp.status_code in (200, 201)
        second_manager = resp.json()

        # Create two orders
        orders = []
        for i in range(2):
            r = client.post("/orders", json={
                "idempotency_key": str(uuid.uuid4()),
                "device_id": seed_device["id"],
                "staff_id": seed_waiter["id"],
                "table_name": f"Table {i}",
                "items": [{
                    "menu_item_id": seed_menu_items[0]["id"],
                    "name": "Coffee",
                    "quantity": 1,
                    "price_cents": 1500,
                    "notes": "",
                }],
            })
            assert r.status_code in (200, 201)
            orders.append(r.json())

        # Manager 1 voids order 1
        r1 = client.post(
            f"/orders/{orders[0]['id']}/void",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "staff_id": seed_manager["id"],
                "reason": "Manager 1 void",
            },
            headers=manager_headers,
        )
        assert r1.status_code == 200
        assert r1.json()["voided_by"] == seed_manager["id"]

        # Manager 2 voids order 2
        r2 = client.post(
            f"/orders/{orders[1]['id']}/void",
            json={
                "idempotency_key": str(uuid.uuid4()),
                "staff_id": second_manager["id"],
                "reason": "Manager 2 void",
            },
            headers={"X-Staff-Id": second_manager["id"]},
        )
        assert r2.status_code == 200
        assert r2.json()["voided_by"] == second_manager["id"]

        # Z-report shows both voids
        report_resp = client.get("/reports/z-report", headers=manager_headers)
        report = report_resp.json()
        assert report["void_count"] >= 2
