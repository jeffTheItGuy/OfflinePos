"""RECONSTRUCTED from usage — diff against your original before trusting."""
import uuid

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.database import Base


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    order_no_prefix: Mapped[str] = mapped_column(
        String(6), unique=True, nullable=False
    )
    # Monotonic counter; allocated under SELECT ... FOR UPDATE.
    order_no_seq: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
