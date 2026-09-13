from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.core.deps import require_manager
from backend.app.database import get_db
from backend.app.settings.schema import SettingsOut, SettingsUpdate
from backend.app.settings.service import get_settings, update_settings
from backend.app.staff.model import Staff

router = APIRouter()


@router.get("", response_model=SettingsOut)
def read_settings(db: Session = Depends(get_db)):
    """Public read — the kitchen screen and sales report both need the
    timezone and business-day cutover, and neither requires manager auth."""
    return get_settings(db)


@router.patch("", response_model=SettingsOut)
def patch_settings(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    _: Staff = Depends(require_manager),
):
    """Manager-only write. Any subset of keys may be sent."""
    return update_settings(db, payload)
