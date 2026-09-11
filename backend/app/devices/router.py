from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.devices.model import Device
from app.devices.schema import DeviceOut, DeviceRegister

router = APIRouter()


@router.post("/register", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
def register(payload: DeviceRegister, db: Session = Depends(get_db)):
    """First-time tablet setup. The app calls this once, then stores
    the returned device id on the device forever."""
    taken = db.execute(
        select(Device).where(Device.order_no_prefix == payload.order_no_prefix)
    ).scalar_one_or_none()
    if taken is not None:
        raise HTTPException(409, "Order-number prefix already taken")
    device = Device(**payload.model_dump())
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


@router.get("", response_model=list[DeviceOut])
def list_devices(db: Session = Depends(get_db)):
    return db.execute(select(Device)).scalars().all()
