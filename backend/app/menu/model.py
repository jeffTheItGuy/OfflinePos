"""RECONSTRUCTED from usage — diff against your original before trusting."""
import uuid

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


class MenuItem(Base):
    __tablename__ = "menu_items"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(String(60), nullable=False, default="general")
    available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Bumped on every edit so offline devices can sync incrementally.
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
