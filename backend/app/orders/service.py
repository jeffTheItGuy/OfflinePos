"""Order-number allocation.

`SELECT ... FOR UPDATE` locks the device row, so two concurrent
requests on the same device can never receive the same number.

NOTE: this touches Device state, so `devices/service.py` would be a more
cohesive home. Kept here to match your original layout — moving it is a
one-line import change in the router if you'd rather.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.devices.model import Device


class UnknownDeviceError(Exception):
    def __init__(self, device_id: str):
        self.device_id = device_id


def allocate_order_no(db: Session, device_id: str) -> str:
    device = db.execute(
        select(Device).where(Device.id == device_id).with_for_update()
    ).scalar_one_or_none()
    if device is None:
        raise UnknownDeviceError(device_id)
    device.order_no_seq += 1
    return f"{device.order_no_prefix}-{device.order_no_seq}"
