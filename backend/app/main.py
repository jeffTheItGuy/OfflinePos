"""FastAPI entry point for Harbor POS."""
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from backend.app.config import settings
from backend.app.core.security import hash_pin
from backend.app.database import SessionLocal
from backend.app.staff.model import Staff

from backend.app.devices.router import router as devices_router
from backend.app.health.router import router as health_router
from backend.app.menu.router import router as menu_router
from backend.app.orders.router import router as orders_router
from backend.app.payments.router import router as payments_router
from backend.app.settings.router import router as settings_router
from backend.app.staff.router import router as staff_router
from backend.app.tables.router import router as tables_router  # NEW


def seed_default_manager() -> None:
    if not settings.DEFAULT_MANAGER_PIN:
        return
    db = SessionLocal()
    try:
        stmt = select(Staff).where(Staff.role == "manager", Staff.active.is_(True))
        if db.execute(stmt).scalar_one_or_none() is not None:
            return
        db.add(Staff(
            id=str(uuid.uuid4()),
            name=settings.DEFAULT_MANAGER_NAME,
            role="manager",
            active=True,
            pin_hash=hash_pin(settings.DEFAULT_MANAGER_PIN),
        ))
        db.commit()
        print(f"[startup] Seeded default manager '{settings.DEFAULT_MANAGER_NAME}'")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_default_manager()
    yield


app = FastAPI(title="Harbor POS", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(orders_router, prefix="/orders", tags=["orders"])
app.include_router(menu_router, prefix="/menu", tags=["menu"])
app.include_router(staff_router, prefix="/staff", tags=["staff"])
app.include_router(devices_router, prefix="/devices", tags=["devices"])
app.include_router(payments_router, prefix="/payments", tags=["payments"])
app.include_router(settings_router, prefix="/settings", tags=["settings"])
app.include_router(tables_router, prefix="/tables", tags=["tables"])  # NEW