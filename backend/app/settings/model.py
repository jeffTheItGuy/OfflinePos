from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Setting(Base):
    """Key/value store for restaurant-wide configuration.

    Values are JSON-encoded Text so a single table can hold strings,
    integers, and small nested objects without migrations.
    """

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )
