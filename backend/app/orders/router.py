"""Order endpoints.

POST /orders is the endpoint the mobile sync engine calls.
Two safety nets protect against duplicate rows:
1. The idempotency_keys table: a replayed key returns the cached response.
2. The unique constraint on orders.idempotency_key, caught here as
   IntegrityError.

POST /orders/{order_id}/items and /orders/{order_id}/void follow the same
idempotency-cache pattern.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.core.deps import require_manager
from backend.app.database import get_db
from backend.app.idempotency.service import get_cached_response, store_response
from backend.app.orders.model import Order, OrderItem
from backend.app.orders.schema import (
    OrderAddItemsIn,
    OrderCreate,
    OrderOut,
    OrderStatusUpdate,
    OrderVoidIn,
)
from backend.app.orders.service import UnknownDeviceError, allocate_order_no
from backend.app.settings.service import get_settings
from backend.app.staff.model import Staff

router = APIRouter()


def _split_multi(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _compute_totals(items, tax_rates: dict[str, float]) -> tuple[int, int, int]:
    """Compute subtotal, tax, and total from line items + configured tax rates.
    All tax rates are applied to the subtotal and summed."""
    subtotal = sum(i.quantity * i.price_cents for i in items)
    tax = 0
    for rate in tax_rates.values():
        tax += round(subtotal * rate)
    total = subtotal + tax
    return subtotal, tax, total


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    cached = get_cached_response(db, payload.idempotency_key)
    if cached is not None:
        return JSONResponse(content=cached, status_code=status.HTTP_200_OK)

    # Server computes the total — never trust the client's math.
    settings = get_settings(db)
    subtotal, tax, total = _compute_totals(payload.items, settings.tax_rates)

    try:
        order_no = allocate_order_no(db, payload.device_id)
    except UnknownDeviceError as exc:
        raise HTTPException(422, f"Unknown device: {exc.device_id}")

    order = Order(
        id=payload.idempotency_key,
        idempotency_key=payload.idempotency_key,
        order_no=order_no,
        device_id=payload.device_id,
        staff_id=payload.staff_id,
        table_name=payload.table_name,
        status="sent",
        payment_status="unpaid",
        subtotal_cents=subtotal,
        tax_cents=tax,
        total_cents=total,
        items=[OrderItem(**i.model_dump()) for i in payload.items],
    )
    db.add(order)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.get(Order, payload.idempotency_key)
        if existing is None:
            raise HTTPException(500, "Order conflict")
        body = OrderOut.model_validate(existing).model_dump(mode="json")
        store_response(db, payload.idempotency_key, body)
        db.commit()
        return JSONResponse(content=body, status_code=status.HTTP_200_OK)

    db.refresh(order)
    body = OrderOut.model_validate(order).model_dump(mode="json")
    store_response(db, payload.idempotency_key, body)
    db.commit()
    return JSONResponse(content=body, status_code=status.HTTP_201_CREATED)


MODIFIABLE_STATUSES = ("sent", "preparing", "ready")


@router.post("/{order_id}/items", response_model=OrderOut)
def add_order_items(
    order_id: str,
    payload: OrderAddItemsIn,
    db: Session = Depends(get_db),
):
    """Add items to an already-sent order (the forgotten coffee).
    Idempotent per idempotency_key."""
    cached = get_cached_response(db, payload.idempotency_key)
    if cached is not None:
        return JSONResponse(content=cached, status_code=status.HTTP_200_OK)

    # Lock the row to prevent race conditions with payments or voids
    order = db.execute(
        select(Order).where(Order.id == order_id).with_for_update()
    ).scalar_one_or_none()
    
    if order is None:
        raise HTTPException(404, "Order not found")
    if order.status == "void":
        raise HTTPException(409, "Order is voided")
    if order.payment_status == "paid":
        raise HTTPException(409, "Order already paid — open a new order instead")
    if order.status not in MODIFIABLE_STATUSES:
        raise HTTPException(
            409, f"Order not modifiable in status '{order.status}'"
        )

    for item in payload.items:
        order.items.append(OrderItem(**item.model_dump()))

    # Recompute totals server-side over ALL items.
    settings = get_settings(db)
    subtotal, tax, total = _compute_totals(order.items, settings.tax_rates)
    order.subtotal_cents = subtotal
    order.tax_cents = tax
    order.total_cents = total

    db.commit()
    db.refresh(order)
    body = OrderOut.model_validate(order).model_dump(mode="json")
    store_response(db, payload.idempotency_key, body)
    db.commit()
    return JSONResponse(content=body, status_code=status.HTTP_200_OK)


@router.post("/{order_id}/void", response_model=OrderOut)
def void_order(
    order_id: str,
    payload: OrderVoidIn,
    db: Session = Depends(get_db),
    manager: Staff = Depends(require_manager),  # Enforces 401 if header missing/invalid
):
    """Void an order. Requires a manager."""
    cached = get_cached_response(db, payload.idempotency_key)
    if cached is not None:
        return JSONResponse(content=cached, status_code=status.HTTP_200_OK)

    # Lock the row to prevent race conditions with payments or add-items
    order = db.execute(
        select(Order).where(Order.id == order_id).with_for_update()
    ).scalar_one_or_none()
    
    if order is None:
        raise HTTPException(404, "Order not found")
    if order.payment_status == "paid":
        raise HTTPException(
            409, "Paid orders cannot be voided — issue a refund instead"
        )

    # Use the authenticated manager from the header, not the body payload
    order.status = "void"
    order.void_reason = payload.reason
    order.voided_by = manager.id

    db.commit()
    db.refresh(order)
    body = OrderOut.model_validate(order).model_dump(mode="json")
    store_response(db, payload.idempotency_key, body)
    db.commit()
    return JSONResponse(content=body, status_code=status.HTTP_200_OK)


@router.get("/kitchen", response_model=list[OrderOut])
def kitchen_orders(
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
):
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
    limit: int = Query(default=100),
    db: Session = Depends(get_db),
):
    # Clamp the limit manually so 9999 becomes 500 without throwing a 422
    limit = min(limit, 500)
    
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