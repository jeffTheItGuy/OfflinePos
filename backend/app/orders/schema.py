"""JSON contract for orders — this is exactly what the Expo sync engine sends."""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class OrderItemIn(BaseModel):
    menu_item_id: str | None = None
    name: str
    quantity: int = Field(ge=1)
    price_cents: int = Field(ge=0)
    notes: str = ""


class OrderCreate(BaseModel):
    idempotency_key: str
    device_id: str
    staff_id: str | None = None
    table_name: str
    items: list[OrderItemIn] = Field(min_length=1)


class OrderAddItemsIn(BaseModel):
    idempotency_key: str
    items: list[OrderItemIn] = Field(min_length=1)


class OrderVoidIn(BaseModel):
    idempotency_key: str
    staff_id: str
    reason: str = Field(min_length=1, max_length=500)


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    menu_item_id: str | None
    name: str
    quantity: int
    price_cents: int
    notes: str


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_no: str
    table_name: str
    status: str
    payment_status: str
    subtotal_cents: int       # NEW
    tax_cents: int            # NEW
    total_cents: int
    created_at: datetime
    items: list[OrderItemOut]
    void_reason: str | None = None
    voided_by: str | None = None


class OrderStatusUpdate(BaseModel):
    status: Literal[
        "sent",
        "preparing",
        "ready",
        "completed",
        "void",
    ]