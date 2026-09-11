from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import require_manager
from app.core.security import hash_pin, verify_pin
from app.database import get_db
from app.staff.model import Staff
from app.staff.schema import StaffCreate, StaffLogin, StaffOut

router = APIRouter()


@router.post("/login", response_model=StaffOut)
def login(payload: StaffLogin, db: Session = Depends(get_db)):
    """PIN login. Works offline on the device too — against the cached
    staff list — but the server is the authority when reachable."""
    staff = db.execute(select(Staff).where(Staff.active.is_(True))).scalars().all()
    match = next((s for s in staff if verify_pin(payload.pin, s.pin_hash)), None)
    if match is None:
        raise HTTPException(401, "Invalid PIN")
    return match


@router.get("", response_model=list[StaffOut])
def list_staff(db: Session = Depends(get_db)):
    """What the device caches locally. StaffOut excludes pin_hash."""
    return db.execute(select(Staff).where(Staff.active.is_(True))).scalars().all()


@router.post("", response_model=StaffOut, status_code=status.HTTP_201_CREATED)
def create_staff(
    payload: StaffCreate,
    db: Session = Depends(get_db),
    _: Staff = Depends(require_manager),
):
    staff = Staff(
        name=payload.name,
        role=payload.role,
        pin_hash=hash_pin(payload.pin),
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff
