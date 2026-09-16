import hashlib
import hmac
import os

_PBKDF2_ITERATIONS = 100_000


def hash_pin(pin: str) -> str:
    """Hash a PIN with a random salt. Returns '<hex_salt>$<hex_digest>'."""
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", pin.encode(), salt, _PBKDF2_ITERATIONS
    )
    return salt.hex() + "$" + digest.hex()


def verify_pin(pin: str, stored: str) -> bool:
    """Verify a PIN against a stored hash. Returns False on any mismatch or malformed input."""
    try:
        salt, digest = stored.split("$", 1)
        candidate = hashlib.pbkdf2_hmac(
            "sha256", pin.encode(), bytes.fromhex(salt), _PBKDF2_ITERATIONS
        ).hex()
        return hmac.compare_digest(candidate, digest)
    except (ValueError, AttributeError, TypeError):
        # Malformed stored hash (bad hex, missing separator, wrong length, etc.)
        return False