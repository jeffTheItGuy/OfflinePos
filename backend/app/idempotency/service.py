"""Server-side idempotency: check the key before processing,
store the response after. Retry = replay, never duplicate.

Lives in its own module because orders AND payments both depend on it —
putting it under either one would make the other import sideways.
"""
import json

from sqlalchemy.orm import Session

from app.idempotency.model import IdempotencyKey


def get_cached_response(db: Session, key: str) -> dict | None:
    row = db.get(IdempotencyKey, key)
    return json.loads(row.response) if row else None


def store_response(db: Session, key: str, response: dict) -> None:
    db.add(IdempotencyKey(key=key, response=json.dumps(response)))
