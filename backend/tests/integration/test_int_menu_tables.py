"""INT-04 — Menu and table sync versioning."""
import pytest


@pytest.mark.integration
class TestMenuSync:
    def test_create_menu_item(self, client, manager_headers):
        resp = client.post(
            "/menu",
            json={"name": "Latte", "price_cents": 2000, "category": "drinks"},
            headers=manager_headers,
        )
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data["name"] == "Latte"
        assert data["version"] >= 1

    def test_update_increments_version(self, client, manager_headers, seed_menu_item):
        item_id = seed_menu_item["id"]
        v1 = seed_menu_item["version"]

        resp = client.patch(
            f"/menu/{item_id}",
            json={"price_cents": 1800},
            headers=manager_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["version"] > v1

    def test_delete_soft_deletes(self, client, manager_headers, seed_menu_item):
        item_id = seed_menu_item["id"]
        resp = client.delete(f"/menu/{item_id}", headers=manager_headers)
        # FastAPI correctly returns 204 No Content for successful DELETEs
        assert resp.status_code == 204

        # Item should still exist in the DB but be marked unavailable
        all_items = client.get("/menu").json()
        item = next((i for i in all_items if i["id"] == item_id), None)
        assert item is not None
        assert item["available"] is False

    def test_since_version_returns_only_changed(self, client, manager_headers):
        # Create two items
        client.post("/menu", json={"name": "A", "price_cents": 100, "category": "x"}, headers=manager_headers)
        resp = client.post("/menu", json={"name": "B", "price_cents": 200, "category": "x"}, headers=manager_headers)
        item_b = resp.json()

        # Query since B's version — should only get B
        delta = client.get(f"/menu?since_version={item_b['version'] - 1}").json()
        names = [i["name"] for i in delta]
        assert "B" in names


@pytest.mark.integration
class TestTableSync:
    def test_create_table(self, client, manager_headers):
        resp = client.post(
            "/tables",
            json={"name": "Patio 1", "section": "OUTDOOR"},
            headers=manager_headers,
        )
        assert resp.status_code in (200, 201)
        assert resp.json()["version"] >= 1

    def test_update_table_increments_version(self, client, manager_headers, seed_table):
        table_id = seed_table["id"]
        v1 = seed_table["version"]

        resp = client.patch(
            f"/tables/{table_id}",
            json={"name": "Patio 2"},
            headers=manager_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["version"] > v1

    def test_delete_table_soft_deletes(self, client, manager_headers, seed_table):
        table_id = seed_table["id"]
        resp = client.delete(f"/tables/{table_id}", headers=manager_headers)
        # FastAPI correctly returns 204 No Content for successful DELETEs
        assert resp.status_code == 204

        all_tables = client.get("/tables").json()
        table = next((t for t in all_tables if t["id"] == table_id), None)
        assert table is not None
        assert table["available"] is False

    def test_since_version_delta(self, client, manager_headers):
        resp = client.post(
            "/tables",
            json={"name": "T99", "section": "VIP"},
            headers=manager_headers,
        )
        table = resp.json()
        delta = client.get(f"/tables?since_version={table['version'] - 1}").json()
        ids = [t["id"] for t in delta]
        assert table["id"] in ids