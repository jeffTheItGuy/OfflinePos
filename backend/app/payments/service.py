"""Stripe integration, extracted out of the router.

`stripe` is imported lazily inside each function so the package isn't a
hard dependency until card payments are actually switched on.
"""
from sqlalchemy.orm import Session

from app.config import settings
from app.orders.model import Order
from app.payments.model import Payment


class StripeNotConfigured(Exception):
    pass


def create_intent(order: Order) -> tuple[str, int]:
    if not settings.STRIPE_SECRET_KEY:
        raise StripeNotConfigured
    import stripe

    stripe.api_key = settings.STRIPE_SECRET_KEY
    intent = stripe.PaymentIntent.create(
        amount=order.total_cents,
        currency="usd",
        automatic_payment_methods={"enabled": True},
        metadata={"order_id": order.id},
    )
    return intent.client_secret, order.total_cents


def verify_webhook(payload: bytes, signature: str):
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise StripeNotConfigured
    import stripe

    return stripe.Webhook.construct_event(
        payload, signature, settings.STRIPE_WEBHOOK_SECRET
    )


def record_card_payment(db: Session, intent: dict) -> None:
    """Idempotent on the intent id, so a replayed webhook can never
    double-record. Stripe retries webhooks; assume it will."""
    order_id = (intent.get("metadata") or {}).get("order_id")
    if not order_id:
        return
    if db.get(Payment, intent["id"]) is not None:
        return
    order = db.get(Order, order_id)
    if order is None or order.status == "paid":
        return

    order.status = "paid"
    db.add(
        Payment(
            id=intent["id"],
            idempotency_key=intent["id"],
            order_id=order.id,
            method="stripe",
            amount_cents=intent["amount"],
            status="confirmed",
        )
    )
    db.commit()
