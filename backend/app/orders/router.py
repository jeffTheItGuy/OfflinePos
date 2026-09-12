"""Order endpoints. POST /orders is the endpoint the mobile sync
engine calls — idempotency is the whole point."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.idempotency.service import get_cached_response, store_response
from backend.app.orders.model import Order, OrderItem
from backend.app.orders.schema import OrderCreate, OrderOut, OrderStatusUpdate
from backend.app.orders.service import UnknownDeviceError, allocate_order_no

router = APIRouter()


def _split_multi(value: str | None) -> list[str]:
    """Support comma-separated query filters.

    Example:
        /orders?status=sent,preparing,ready
    """
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    # --- Idempotency: replayed key returns the original response ---
    cached = get_cached_response(db, payload.idempotency_key)
    if cached is not None:
        return JSONResponse(content=cached, status_code=status.HTTP_200_OK)

    # Server computes the total — never trust the client's math.
    total = sum(i.quantity * i.price_cents for i in payload.items)

    try:
        order_no = allocate_order_no(db, payload.device_id)
    except UnknownDeviceError as exc:
        raise HTTPException(422, f"Unknown device: {exc.device_id}")

    order = Order(
        id=payload.idempotency_key,  # device UUID doubles as the order id
        idempotency_key=payload.idempotency_key,
        order_no=order_no,
        device_id=payload.device_id,
        staff_id=payload.staff_id,
        table_name=payload.table_name,
        status="sent",
        payment_status="unpaid",
        total_cents=total,
        items=[OrderItem(**i.model_dump()) for i in payload.items],
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    body = OrderOut.model_validate(order).model_dump(mode="json")
    store_response(db, payload.idempotency_key, body)
    db.commit()  # storing the key is what makes the NEXT retry safe

    return JSONResponse(content=body, status_code=status.HTTP_201_CREATED)


@router.get("/kitchen", response_model=list[OrderOut])
def kitchen_orders(
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
):
    """Dedicated kitchen endpoint.

    Returns orders that still need kitchen attention.
    Payment status does NOT hide the order from the kitchen.
    """
    stmt = (
        select(Order)
        .where(Order.status.in_(["sent", "preparing", "ready"]))
        .order_by(Order.created_at.desc())
        .limit(limit)
    )
    return db.execute(stmt).scalars().all()


@router.get("", response_model=list[OrderOut])
def list_orders(
    status_filter: str | None = Query(default=None, alias="status"),
    payment_status_filter: str | None = Query(default=None, alias="payment_status"),
    device_id: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
):
    """List orders.

    Supports comma-separated filters:
        /orders?status=sent,preparing,ready
        /orders?payment_status=unpaid,paid

    Optionally restrict to a single tablet:
        /orders?device_id=<uuid>
    """
    stmt = select(Order).order_by(Order.created_at.desc()).limit(limit)

    statuses = _split_multi(status_filter)
    if statuses:
        stmt = stmt.where(Order.status.in_(statuses))

    payment_statuses = _split_multi(payment_status_filter)
    if payment_statuses:
        stmt = stmt.where(Order.payment_status.in_(payment_statuses))

    if device_id:
        stmt = stmt.where(Order.device_id == device_id)

    return db.execute(stmt).scalars().all()


@router.patch("/{order_id}/status", response_model=OrderOut)
def update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    db: Session = Depends(get_db),
):
    """Update kitchen / fulfillment status.

    This is intended for the kitchen screen or waiter screen to move orders
    through the fulfillment workflow:
        sent -> preparing -> ready -> completed
    """
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(404, "Order not found")

    order.status = payload.status
    db.commit()
    db.refresh(order)
    return order


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: str, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    return order