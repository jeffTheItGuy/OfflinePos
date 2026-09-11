"""Shared FastAPI dependencies.

v1 pragmatic auth: manager-only endpoints check the X-Staff-Id header
against the staff table. Replace with proper tokens before multi-store.
"""
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.staff.model import Staff


def require_manager(
    x_staff_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Staff:
    if not x_staff_id:
        raise HTTPException(401, "Missing X-Staff-Id header")
    staff = db.get(Staff, x_staff_id)
    if staff is None or not staff.active or staff.role != "manager":
        raise HTTPException(403, "Manager role required")
    return staff
