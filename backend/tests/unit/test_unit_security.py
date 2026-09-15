"""UNIT-B03: core/security.py::hash_pin / verify_pin

PIN hashing is stdlib pbkdf2 with a random salt. Malformed stored values
must return False (not raise) so a bad row can't crash login.
"""
from backend.app.core.security import hash_pin, verify_pin


def test_round_trip_succeeds():
    assert verify_pin("1234", hash_pin("1234"))


def test_wrong_pin_fails():
    assert not verify_pin("9999", hash_pin("1234"))


def test_same_pin_produces_different_hashes_due_to_salt():
    assert hash_pin("1234") != hash_pin("1234")


def test_malformed_stored_value_returns_false_not_raise():
    # No '$' separator -> unpacking fails -> False, not an exception.
    assert verify_pin("1234", "not-a-valid-hash") is False
    assert verify_pin("1234", "") is False