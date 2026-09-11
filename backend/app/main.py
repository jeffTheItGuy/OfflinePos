"""FastAPI entry point for Harbor POS."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.database import Base, engine

# Routers are imported from their modules directly (not re-exported from the
# package __init__) — that keeps `core.deps -> staff.model` from cycling back
# through `staff/__init__ -> staff.router -> core.deps`.
# Importing each router also imports its models, registering the tables.
from backend.app.devices.router import router as devices_router
from backend.app.health.router import router as health_router
from backend.app.menu.router import router as menu_router
from backend.app.orders.router import router as orders_router
from backend.app.payments.router import router as payments_router
from backend.app.staff.router import router as staff_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Phase 1 shortcut: create tables on startup.
    # TODO before production: switch to Alembic migrations.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Harbor POS", version="0.1.0", lifespan=lifespan)

# Needed only while developing (Expo on your phone hitting the server by IP).
# Same-origin in production through Caddy, so this is harmless to keep.
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
