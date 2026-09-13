from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.core.deps import require_manager
from backend.app.database import get_db
from backend.app.reports.schema import ZReportOut
from backend.app.reports.service import build_z_report
from backend.app.staff.model import Staff

router = APIRouter()


@router.get("/z-report", response_model=ZReportOut)
def z_report(
    day: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    db: Session = Depends(get_db),
    _: Staff = Depends(require_manager),
):
    """End-of-day Z-report. `day` is YYYY-MM-DD in the restaurant's
    local timezone. Defaults to the current business day."""
    return build_z_report(db, day)