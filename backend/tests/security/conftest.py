"""
Security test fixtures.
Runs against real Postgres with the same TestClient approach as integration tests.
"""
import os
import uuid
import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from backend.app.core.security import hash_pin
from backend.app.staff.model import Staff

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5433/MobileToServer-POS_test",
)


@pytest.fixture(scope="session")
def engine():
    """Session-scoped engine — one connection pool for the entire test run."""
    eng = create_engine(DATABASE_URL)
    yield eng
    eng.dispose()


@pytest.fixture(scope="session")
def run_migrations(engine):
    """Run alembic migrations once per session against the test database."""
    from alembic.config import Config
    from alembic import command

    base_dir = os.path.dirname(os.path.abspath(__file__))
    alembic_dir = os.path.abspath(os.path.join(base_dir, "..", "..", "alembic"))

    alembic_cfg = Config()
    alembic_cfg.set_main_option("script_location", alembic_dir)
    alembic_cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
    command.upgrade(alembic_cfg, "head")
    yield


@pytest.fixture(scope="session")
def app(engine, run_migrations):
    """Create the FastAPI application bound to the test database."""
    from backend.app.main import app as fastapi_app
    from backend.app.database import get_db

    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    return fastapi_app


@pytest.fixture(scope="session")
def client(app) -> Generator[TestClient, None, None]:
    """Session-scoped test client."""
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def clean_and_seed_db(engine):
    """Truncate all tables BEFORE each test and re-seed the default manager."""
    with engine.connect() as conn:
        conn.execute(text("""
            DO $$ DECLARE
            r RECORD;
            BEGIN
                FOR r IN (
                    SELECT tablename FROM pg_tables
                    WHERE schemaname = 'public'
                    AND tablename != 'alembic_version'
                ) LOOP
                    EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
                END LOOP;
            END $$;
        """))
        conn.commit()

    TestSessionLocal = sessionmaker(bind=engine)
    db = TestSessionLocal()
    try:
        db.add(Staff(
            id=str(uuid.uuid4()),
            name="Security Admin",
            role="manager",
            active=True,
            pin_hash=hash_pin("1234"),
        ))
        db.commit()
    finally:
        db.close()
    yield


# ── Seed Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def seed_manager(client) -> dict:
    resp = client.post("/staff/login", json={"pin": "1234"})
    assert resp.status_code == 200
    return resp.json()


@pytest.fixture
def seed_waiter(client, seed_manager) -> dict:
    resp = client.post(
        "/staff",
        json={"name": "Security Waiter", "pin": "5678", "role": "waiter"},
        headers={"X-Staff-Id": seed_manager["id"]},
    )
    assert resp.status_code in (200, 201)
    return resp.json()


@pytest.fixture
def seed_device(client) -> dict:
    resp = client.post("/devices/register", json={
        "name": "Security Tablet",
        "order_no_prefix": "ST",
    })
    assert resp.status_code in (200, 201)
    return resp.json()


@pytest.fixture
def seed_menu_item(client, seed_manager) -> dict:
    resp = client.post(
        "/menu",
        json={"name": "Coffee", "price_cents": 1500, "category": "drinks"},
        headers={"X-Staff-Id": seed_manager["id"]},
    )
    assert resp.status_code in (200, 201)
    return resp.json()


@pytest.fixture
def seed_menu_items(client, seed_manager) -> list:
    items = [
        {"name": "Coffee", "price_cents": 1500, "category": "drinks"},
        {"name": "Tea", "price_cents": 1000, "category": "drinks"},
        {"name": "Burger", "price_cents": 2500, "category": "food"},
    ]
    created = []
    for item in items:
        resp = client.post(
            "/menu",
            json=item,
            headers={"X-Staff-Id": seed_manager["id"]},
        )
        assert resp.status_code in (200, 201)
        created.append(resp.json())
    return created


@pytest.fixture
def seed_settings(client, seed_manager) -> dict:
    resp = client.patch(
        "/settings",
        json={"tax_rates": {"vat": 0.15, "service": 0.10}},
        headers={"X-Staff-Id": seed_manager["id"]},
    )
    assert resp.status_code == 200
    return resp.json()


@pytest.fixture
def seed_order(client, seed_device, seed_waiter, seed_menu_items) -> dict:
    idempotency_key = str(uuid.uuid4())
    resp = client.post("/orders", json={
        "idempotency_key": idempotency_key,
        "device_id": seed_device["id"],
        "staff_id": seed_waiter["id"],
        "table_name": "Security Table",
        "items": [
            {
                "menu_item_id": seed_menu_items[0]["id"],
                "name": "Coffee",
                "quantity": 2,
                "price_cents": 1500,
                "notes": "",
            },
        ],
    })
    assert resp.status_code in (200, 201)
    return resp.json()


@pytest.fixture
def manager_headers(seed_manager) -> dict:
    return {"X-Staff-Id": seed_manager["id"]}


@pytest.fixture
def waiter_headers(seed_waiter) -> dict:
    return {"X-Staff-Id": seed_waiter["id"]}
