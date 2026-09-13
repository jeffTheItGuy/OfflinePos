from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.deps import require_manager
from backend.app.database import get_db
from backend.app.staff.model import Staff
from backend.app.tables.model import Table
from backend.app.tables.schema import TableCreate, TableOut, TableUpdate

router = APIRouter()


@router.get("", response_model=list[TableOut])
def list_tables(
    since_version: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """Devices poll this: only tables changed since their last known version."""
    stmt = (
        select(Table)
        .where(Table.version > since_version)
        .order_by(Table.section, Table.name)
    )
    return db.execute(stmt).scalars().all()


@router.post("", response_model=TableOut, status_code=status.HTTP_201_CREATED)
def create_table(
    payload: TableCreate,
    db: Session = Depends(get_db),
    _: Staff = Depends(require_manager),
):
    table = Table(**payload.model_dump())
    db.add(table)
    db.commit()
    db.refresh(table)
    return table


@router.patch("/{table_id}", response_model=TableOut)
def update_table(
    table_id: str,
    payload: TableUpdate,
    db: Session = Depends(get_db),
    _: Staff = Depends(require_manager),
):
    table = db.get(Table, table_id)
    if table is None:
        raise HTTPException(404, "Table not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(table, field, value)
    table.version += 1
    db.commit()
    db.refresh(table)
    return table


@router.delete("/{table_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_table(
    table_id: str,
    db: Session = Depends(get_db),
    _: Staff = Depends(require_manager),
):
    table = db.get(Table, table_id)
    if table is None:
        raise HTTPException(404, "Table not found")
    table.available = False  # soft delete
    table.version += 1
    db.commit()