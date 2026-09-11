"""RECONSTRUCTED from usage — diff against your original before trusting."""
import uuid

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Staff(Base):
    __tablename__ = "staff"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="waiter")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Format: "<hex_salt>$<hex_digest>" — see app/core/security.py
    pin_hash: Mapped[str] = mapped_column(String(200), nullable=False)
