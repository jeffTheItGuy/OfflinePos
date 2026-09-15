"""
Concurrency test fixtures.

Uses httpx.AsyncClient with ASGITransport for true parallel requests
against the in-process FastAPI app. Each test gets a fresh database
via the same truncate-and-reseed pattern as integration tests.
"""
import os
import pathlib
import uuid

import httpx
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ── Database ───────────────────────────────────────────────────────────────
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5433/MobileToServer-POS_test",
)


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(DATABASE_URL)
    yield eng
    eng.dispose()


@pytest.fixture(scope="session")
def run_migrations(engine):
    from alembic import command
    from alembic.config import Config

    # Bulletproof search for the alembic directory
    current_dir = pathlib.Path(__file__).resolve().parent
    alembic_dir = None
    for parent in current_dir.parents:
        if (parent / "alembic.ini").exists():
            alembic_dir = str(parent / "alembic")
            break
        if (parent / "alembic").is_dir() and (parent / "alembic" / "env.py").exists():
            alembic_dir = str(parent / "alembic")
            break
            
    if alembic_dir is None:
        raise RuntimeError("Could not find the 'alembic' directory in any parent folder.")

    cfg = Config()
    cfg.set_main_option("script_location", alembic_dir)
    cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
    command.upgrade(cfg, "head")
    yield


@pytest.fixture(scope="session")
def app(engine, run_migrations):
    from backend.app.database import get_db
    from backend.app.main import app as fastapi_app

    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    return fastapi_app


@pytest.fixture()
def async_client(app):
    """
    Async HTTP client hitting the real ASGI app in-process.
    Supports true concurrent requests via asyncio.gather.
    """
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://testserver")


@pytest.fixture(autouse=True)
def clean_and_seed_db(engine):
    """Truncate + reseed manager before every test."""
    from backend.app.core.security import hash_pin
    from backend.app.staff.model import Staff

    with engine.connect() as conn:
        conn.execute(
            text(
                """
                DO $$ DECLARE r RECORD;
                BEGIN
                    FOR r IN (
                        SELECT tablename FROM pg_tables
                        WHERE schemaname='public'
                          AND tablename != 'alembic_version'
                    ) LOOP
                        EXECUTE 'TRUNCATE public.'
                             || quote_ident(r.tablename) || ' CASCADE';
                    END LOOP;
                END $$;
                """
            )
        )
        conn.commit()

    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        db.add(
            Staff(
                id=str(uuid.uuid4()),
                name="Concurrency Admin",
                role="manager",
                active=True,
                pin_hash=hash_pin("1234"),
            )
        )
        db.commit()
    finally:
        db.close()
    yield


# ── Seed helpers ───────────────────────────────────────────────────────────
@pytest.fixture()
async def seed_device(async_client):
    r = await async_client.post(
        "/devices/register",
        json={"name": "Conc Tablet", "order_no_prefix": "CT"},
    )
    assert r.status_code in (200, 201), f"Failed to seed device: {r.text}"
    return r.json()


@pytest.fixture()
async def seed_manager(async_client):
    r = await async_client.post("/staff/login", json={"pin": "1234"})
    assert r.status_code == 200, f"Failed to seed manager: {r.text}"
    return r.json()


@pytest.fixture()
async def seed_waiter(async_client, seed_manager):
    r = await async_client.post(
        "/staff",
        json={"name": "Conc Waiter", "pin": "5678", "role": "waiter"},
        headers={"X-Staff-Id": seed_manager["id"]},
    )
    assert r.status_code in (200, 201), f"Failed to seed waiter: {r.text}"
    return r.json()


@pytest.fixture()
async def seed_menu_items(async_client, seed_manager):
    items = [
        {"name": "Coffee", "price_cents": 1500, "category": "drinks"},
        {"name": "Tea", "price_cents": 1000, "category": "drinks"},
        {"name": "Burger", "price_cents": 2500, "category": "food"},
    ]
    created = []
    for item in items:
        r = await async_client.post(
            "/menu", json=item, headers={"X-Staff-Id": seed_manager["id"]}
        )
        assert r.status_code in (200, 201), f"Failed to seed menu item: {r.text}"
        created.append(r.json())
    return created


@pytest.fixture()
async def seed_order(async_client, seed_device, seed_waiter, seed_menu_items):
    r = await async_client.post(
        "/orders",
        json={
            "idempotency_key": str(uuid.uuid4()),
            "device_id": seed_device["id"],
            "staff_id": seed_waiter["id"],
            "table_name": "Conc Table",
            "items": [
                {
                    "menu_item_id": seed_menu_items[0]["id"],
                    "name": "Coffee",
                    "quantity": 2,
                    "price_cents": 1500,
                    "notes": "",
                }
            ],
        },
    )
    assert r.status_code in (200, 201), f"Failed to seed order: {r.text}"
    return r.json()