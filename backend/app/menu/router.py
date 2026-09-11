from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.deps import require_manager
from backend.app.database import get_db
from backend.app.menu.model import MenuItem
from backend.app.menu.schema import MenuItemCreate, MenuItemOut, MenuItemUpdate
from backend.app.staff.model import Staff

router = APIRouter()


@router.get("", response_model=list[MenuItemOut])
def get_menu(
    since_version: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """Devices poll this: only items changed since their last known version."""
    stmt = (
        select(MenuItem)
        .where(MenuItem.version > since_version)
        .order_by(MenuItem.category, MenuItem.name)
    )
    return db.execute(stmt).scalars().all()


@router.post("", response_model=MenuItemOut, status_code=status.HTTP_201_CREATED)
def create_item(
    payload: MenuItemCreate,
    db: Session = Depends(get_db),
    _: Staff = Depends(require_manager),
):
    item = MenuItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=MenuItemOut)
def update_item(
    item_id: str,
    payload: MenuItemUpdate,
    db: Session = Depends(get_db),
    _: Staff = Depends(require_manager),
):
    item = db.get(MenuItem, item_id)
    if item is None:
        raise HTTPException(404, "Menu item not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    item.version += 1  # every edit bumps the version for offline devices
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: str,
    db: Session = Depends(get_db),
    _: Staff = Depends(require_manager),
):
    item = db.get(MenuItem, item_id)
    if item is None:
        raise HTTPException(404, "Menu item not found")
    item.available = False  # soft delete: order history keeps its snapshot
    item.version += 1
    db.commit()
