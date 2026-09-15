import uuid
from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.database import Base


class Table(Base):
    """A physical table/seat in the restaurant. Synced to tablets
    exactly like menu items (version-bump pattern)."""

    __tablename__ = "tables"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # Section groups tables for display: "DINE-IN", "TAKEOUT & TABS", etc.
    section: Mapped[str] = mapped_column(String(60), nullable=False, default="DINE-IN")
    available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Bumped on every edit so offline devices can sync incrementally.
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)