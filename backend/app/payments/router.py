"""Cash payments are idempotent just like orders (they sync from
devices offline)."""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.idempotency.service import get_cached_response, store_response
from backend.app.orders.model import Order
from backend.app.payments.model import Payment
from backend.app.payments.schema import PaymentCreate, PaymentOut

router = APIRouter()


@router.post("", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def create_cash_payment(payload: PaymentCreate, db: Session = Depends(get_db)):
    cached = get_cached_response(db, payload.idempotency_key)
    if cached is not None:
        return JSONResponse(content=cached, status_code=status.HTTP_200_OK)

    # Lock the order row to prevent race conditions with voids or add-items
    order = db.execute(
        select(Order).where(Order.id == payload.order_id).with_for_update()
    ).scalar_one_or_none()
    
    if order is None:
        raise HTTPException(404, "Order not found")

    # A voided order can never be charged. (Guard comes BEFORE the paid
    # check so the more specific error wins for voided orders.)
    if order.status == "void":
        raise HTTPException(409, "Order is voided — cannot take payment")

    if payload.amount_cents != order.total_cents:
        raise HTTPException(422, "Payment amount must match order total exactly")

    if order.payment_status == "paid":
        raise HTTPException(409, "Order already paid")

    payment = Payment(
        id=payload.idempotency_key,
        idempotency_key=payload.idempotency_key,
        order_id=payload.order_id,
        staff_id=payload.staff_id,
        method="cash",
        amount_cents=payload.amount_cents,
        status="confirmed",
    )

    # Important:
    # Payment state is stored separately from kitchen status.
    # Do NOT set order.status = "paid" here.
    order.payment_status = "paid"
    db.add(payment)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # A previous attempt already inserted this payment but died before
        # the idempotency key was stored. Treat the retry as a replay.
        existing = db.get(Payment, payload.idempotency_key)
        if existing is None:
            raise HTTPException(500, "Payment conflict")

        # Keep order/payment state consistent with the replay.
        order = db.execute(
            select(Order).where(Order.id == payload.order_id).with_for_update()
        ).scalar_one_or_none()
        if order:
            order.payment_status = "paid"
            db.commit()

        body = PaymentOut.model_validate(existing).model_dump(mode="json")
        store_response(db, payload.idempotency_key, body)
        db.commit()  # next retry now hits the idempotency cache instead
        return JSONResponse(content=body, status_code=status.HTTP_200_OK)

    db.refresh(payment)
    body = PaymentOut.model_validate(payment).model_dump(mode="json")
    store_response(db, payload.idempotency_key, body)
    db.commit()
    return JSONResponse(content=body, status_code=status.HTTP_201_CREATED)