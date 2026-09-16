"""SEC-01: PIN hashes never leave the server.
SEC-02: Stored hashes are salted and non-reversible.
"""
import pytest
from backend.app.core.security import hash_pin, verify_pin


@pytest.mark.security
class TestPinHashExposure:
    """SEC-01 — pin_hash must never appear in any API response."""

    def test_login_response_has_no_pin_hash(self, client):
        resp = client.post("/staff/login", json={"pin": "1234"})
        assert resp.status_code == 200
        data = resp.json()
        assert "pin_hash" not in data
        assert "pin_hash" not in resp.text

    def test_staff_list_has_no_pin_hash(self, client, seed_manager, seed_waiter):
        resp = client.get("/staff")
        assert resp.status_code == 200
        for staff in resp.json():
            assert "pin_hash" not in staff
        assert "pin_hash" not in resp.text

    def test_create_staff_response_has_no_pin_hash(self, client, seed_manager):
        resp = client.post(
            "/staff",
            json={"name": "New Person", "pin": "9999", "role": "waiter"},
            headers={"X-Staff-Id": seed_manager["id"]},
        )
        assert resp.status_code in (200, 201)
        assert "pin_hash" not in resp.text

    def test_login_returns_expected_fields_only(self, client):
        resp = client.post("/staff/login", json={"pin": "1234"})
        data = resp.json()
        assert "id" in data
        assert "name" in data
        assert "role" in data
        assert set(data.keys()) == {"id", "name", "role"}


@pytest.mark.security
class TestPinHashStorage:
    """SEC-02 — Hashes are salted, unique per user, and fail-safe."""

    def test_same_pin_produces_different_hashes(self):
        h1 = hash_pin("1234")
        h2 = hash_pin("1234")
        assert h1 != h2, "Salt must make identical PINs produce different hashes"

    def test_round_trip_verification(self):
        stored = hash_pin("1234")
        assert verify_pin("1234", stored) is True
        assert verify_pin("9999", stored) is False

    def test_malformed_stored_hash_returns_false(self):
        assert verify_pin("1234", "garbage") is False
        assert verify_pin("1234", "") is False
        assert verify_pin("1234", "abc$def") is False

    def test_hash_format_contains_salt_separator(self):
        stored = hash_pin("1234")
        assert "$" in stored, "Expected format: <hex_salt>$<hex_digest>"
        parts = stored.split("$")
        assert len(parts) == 2
        assert len(parts[0]) == 32   # 16 bytes hex = 32 chars
        assert len(parts[1]) == 64   # 32 bytes hex = 64 chars

    def test_wrong_pin_never_matches(self):
        stored = hash_pin("1234")
        for wrong in ["0000", "1235", "4321", "12345", "123"]:
            assert verify_pin(wrong, stored) is False
