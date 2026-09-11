"""PIN hashing — stdlib pbkdf2, no extra dependencies.

Each PIN gets a random 16-byte salt; compare with hmac.compare_digest
to avoid timing attacks. Verify against ALL active staff (restaurant
scale: tens of staff, not millions), so we never index by PIN.
"""
import hashlib
import hmac
import os

_PBKDF2_ITERATIONS = 100_000


def hash_pin(pin: str) -> str:
    salt = os.urandom(16).hex()
    digest = hashlib.pbkdf2_hmac(
        "sha256", pin.encode(), bytes.fromhex(salt), _PBKDF2_ITERATIONS
    ).hex()
    return f"{salt}${digest}"


def verify_pin(pin: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$")
    except ValueError:
        return False
    candidate = hashlib.pbkdf2_hmac(
        "sha256", pin.encode(), bytes.fromhex(salt), _PBKDF2_ITERATIONS
    ).hex()
    return hmac.compare_digest(candidate, digest)
