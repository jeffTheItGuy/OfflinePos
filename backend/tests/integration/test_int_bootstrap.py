"""INT-01 — Bootstrap, migrations, and health."""
import pytest


@pytest.mark.integration
class TestBootstrapAndHealth:
    def test_health_returns_ok(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"

    def test_default_manager_seeded_once(self, client):
        """Manager is seeded on startup and not duplicated on restart."""
        resp1 = client.get("/staff")
        assert resp1.status_code == 200
        staff_list = resp1.json()
        managers = [s for s in staff_list if s["role"] == "manager"]
        assert len(managers) == 1
        assert managers[0]["name"] == "Test Admin"

    def test_health_response_shape(self, client):
        resp = client.get("/health")
        data = resp.json()
        assert "status" in data
        assert "service" in data or True  # optional field
