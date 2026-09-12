"""RECONSTRUCTED from usage — diff against your original before trusting."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Order(Base):
    __tablename__ = "orders"

    # The device UUID doubles as the primary key AND the idempotency key.
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)

    idempotency_key: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )

    order_no: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    device_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("devices.id"), nullable=False, index=True
    )

    staff_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("staff.id"), nullable=True
    )

    table_name: Mapped[str] = mapped_column(String(50), nullable=False)

    # Kitchen / fulfillment status.
    # Examples: sent, preparing, ready, completed, void.
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="sent", index=True
    )

    # Payment status.
    # Examples: unpaid, paid, refunded.
    payment_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="unpaid", index=True
    )

    total_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )

    # selectin: the router commits, refreshes, then serializes OrderOut.
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", lazy="selectin"
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)

    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("orders.id"), nullable=False, index=True
    )

    menu_item_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    # Snapshot fields: order history survives menu edits and soft deletes.
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")

    order: Mapped["Order"] = relationship(back_populates="items")