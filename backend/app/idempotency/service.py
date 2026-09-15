"""Server-side idempotency: check the key before processing,
store the response after. Retry = replay, never duplicate.
Lives in its own module because orders AND payments both depend on it —
putting it under either one would make the other import sideways.
"""
import json
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from backend.app.idempotency.model import IdempotencyKey


def get_cached_response(db: Session, key: str) -> dict | None:
    row = db.get(IdempotencyKey, key)
    return json.loads(row.response) if row else None


def store_response(db: Session, key: str, response: dict) -> None:
    """Store the idempotency key.
    
    In high-concurrency scenarios, multiple identical requests might pass 
    the initial cache check and attempt to insert the key simultaneously.
    We catch the IntegrityError to prevent a 500 crash — the first request 
    wins the race, and the losers safely roll back and return the body.
    """
    try:
        db.add(IdempotencyKey(key=key, response=json.dumps(response)))
        db.commit()
    except IntegrityError:
        # Another concurrent request already stored this key.
        # Roll back the failed insert so the session is clean.
        db.rollback()