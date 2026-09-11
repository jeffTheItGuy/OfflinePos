"""Cash payments are idempotent just like orders (they sync from
devices offline). Stripe endpoints return 501 until keys are set."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.app.database import SessionLocal, get_db
from backend.app.idempotency.service import get_cached_response, store_response
from backend.app.orders.model import Order
from backend.app.payments.model import Payment
from backend.app.payments.schema import (
    PaymentCreate,
    PaymentOut,
    StripeIntentIn,
    StripeIntentOut,
)
from backend.app.payments.service import (
    StripeNotConfigured,
    create_intent,
    record_card_payment,
    verify_webhook,
)

router = APIRouter()


@router.post("", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def create_cash_payment(payload: PaymentCreate, db: Session = Depends(get_db)):
    cached = get_cached_response(db, payload.idempotency_key)
    if cached is not None:
        return JSONResponse(content=cached, status_code=status.HTTP_200_OK)

    order = db.get(Order, payload.order_id)
    if order is None:
        raise HTTPException(404, "Order not found")

    payment = Payment(
        id=payload.idempotency_key,
        idempotency_key=payload.idempotency_key,
        order_id=payload.order_id,
        staff_id=payload.staff_id,
        method="cash",
        amount_cents=payload.amount_cents,
        status="confirmed",
    )
    order.status = "paid"
    db.add(payment)
    db.commit()
    db.refresh(payment)

    body = PaymentOut.model_validate(payment).model_dump(mode="json")
    store_response(db, payload.idempotency_key, body)
    db.commit()
    return JSONResponse(content=body, status_code=status.HTTP_201_CREATED)


@router.post("/stripe/intent", response_model=StripeIntentOut)
def create_stripe_intent(payload: StripeIntentIn, db: Session = Depends(get_db)):
    order = db.get(Order, payload.order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    if order.status == "paid":
        raise HTTPException(409, "Order already paid")
    try:
        client_secret, amount_cents = create_intent(order)
    except StripeNotConfigured:
        raise HTTPException(501, "Stripe not configured yet")
    return StripeIntentOut(client_secret=client_secret, amount_cents=amount_cents)


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    """Stripe calls this when a payment succeeds. The webhook — not the
    app — is the source of truth for card payments."""
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    try:
        event = verify_webhook(payload, signature)
    except StripeNotConfigured:
        raise HTTPException(501, "Stripe webhook not configured yet")
    except Exception:
        raise HTTPException(400, "Invalid webhook signature")

    if event["type"] == "payment_intent.succeeded":
        db = SessionLocal()
        try:
            record_card_payment(db, event["data"]["object"])
        finally:
            db.close()

    return {"received": True}
