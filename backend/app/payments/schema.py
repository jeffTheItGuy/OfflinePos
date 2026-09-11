from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PaymentCreate(BaseModel):
    """Cash payment recorded on a device, syncing later."""
    idempotency_key: str
    order_id: str
    staff_id: str | None = None
    amount_cents: int = Field(ge=0)


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_id: str
    method: str
    amount_cents: int
    status: str
    created_at: datetime


class StripeIntentIn(BaseModel):
    order_id: str


class StripeIntentOut(BaseModel):
    client_secret: str
    amount_cents: int
