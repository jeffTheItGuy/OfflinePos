"""Order endpoints. POST /orders is the endpoint the mobile sync
engine calls — idempotency is the whole point."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.idempotency.service import get_cached_response, store_response
from app.orders.model import Order, OrderItem
from app.orders.schema import OrderCreate, OrderOut
from app.orders.service import UnknownDeviceError, allocate_order_no

router = APIRouter()


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
        status="sent",  # an order that reached the server has been sent
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


@router.get("", response_model=list[OrderOut])
def list_orders(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
):
    stmt = select(Order).order_by(Order.created_at.desc()).limit(limit)
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    return db.execute(stmt).scalars().all()


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: str, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(404, "Order not found")
    return order
