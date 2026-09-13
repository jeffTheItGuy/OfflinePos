"""Typed accessors over the settings key/value table.

Missing keys fall back to SettingsOut defaults so the app never crashes
on a fresh database, and a partial PATCH only overwrites supplied keys.
"""
import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.settings.model import Setting
from backend.app.settings.schema import SettingsOut, SettingsUpdate


def _load_all(db: Session) -> dict[str, Any]:
    rows = db.execute(select(Setting)).scalars().all()
    out: dict[str, Any] = {}
    for row in rows:
        try:
            out[row.key] = json.loads(row.value)
        except json.JSONDecodeError:
            # Corrupt row: treat as absent so defaults win.
            continue
    return out


def get_settings(db: Session) -> SettingsOut:
    """Full effective settings, defaults merged in."""
    raw = _load_all(db)
    return SettingsOut(**{**SettingsOut().model_dump(), **raw})


def get_setting(db: Session, key: str, default: Any = None) -> Any:
    """Single value lookup with optional default."""
    return _load_all(db).get(key, default)


def set_setting(db: Session, key: str, value: Any) -> None:
    """Upsert one key. Caller controls the transaction boundary."""
    encoded = json.dumps(value)
    existing = db.get(Setting, key)
    if existing is None:
        db.add(Setting(key=key, value=encoded))
    else:
        existing.value = encoded


def update_settings(db: Session, payload: SettingsUpdate) -> SettingsOut:
    """Partial update. Only fields that are not None are written."""
    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is None:
            continue
        set_setting(db, key, value)
    db.commit()
    return get_settings(db)
