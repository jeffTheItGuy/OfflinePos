"""INT-03 — Settings and tax rate validation."""
import pytest


@pytest.mark.integration
class TestSettings:
    def test_defaults_on_fresh_database(self, client):
        resp = client.get("/settings")
        assert resp.status_code == 200
        data = resp.json()
        assert data["restaurant_timezone"] == "UTC"
        assert data["business_day_cutover_hour"] == 0
        assert data["currency"] == "USD"
        assert data["tax_rates"] == {}

    def test_patch_persists(self, client, manager_headers):
        resp = client.patch(
            "/settings",
            json={
                "restaurant_timezone": "Africa/Harare",
                "business_day_cutover_hour": 4,
                "currency": "ZWL",
                "tax_rates": {"vat": 0.15},
            },
            headers=manager_headers,
        )
        assert resp.status_code == 200

        # Verify persistence
        resp2 = client.get("/settings")
        data = resp2.json()
        assert data["restaurant_timezone"] == "Africa/Harare"
        assert data["business_day_cutover_hour"] == 4
        assert data["currency"] == "ZWL"
        assert data["tax_rates"]["vat"] == 0.15

    def test_partial_patch_only_sets_supplied_keys(self, client, manager_headers):
        # Set initial state
        client.patch("/settings", json={"currency": "EUR"}, headers=manager_headers)
        # Partial update
        client.patch("/settings", json={"business_day_cutover_hour": 6}, headers=manager_headers)

        resp = client.get("/settings")
        data = resp.json()
        assert data["currency"] == "EUR"  # unchanged
        assert data["business_day_cutover_hour"] == 6

    def test_cutover_below_zero_rejected(self, client, manager_headers):
        resp = client.patch(
            "/settings",
            json={"business_day_cutover_hour": -1},
            headers=manager_headers,
        )
        assert resp.status_code == 422

    def test_cutover_above_23_rejected(self, client, manager_headers):
        resp = client.patch(
            "/settings",
            json={"business_day_cutover_hour": 24},
            headers=manager_headers,
        )
        assert resp.status_code == 422

    def test_currency_wrong_length_rejected(self, client, manager_headers):
        resp = client.patch(
            "/settings",
            json={"currency": "US"},
            headers=manager_headers,
        )
        assert resp.status_code == 422

    def test_negative_tax_rate_rejected(self, client, manager_headers):
        resp = client.patch(
            "/settings",
            json={"tax_rates": {"vat": -0.05}},
            headers=manager_headers,
        )
        assert resp.status_code == 422
