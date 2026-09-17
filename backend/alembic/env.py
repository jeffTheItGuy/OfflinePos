"""Alembic environment.
Runs migrations against the same DATABASE_URL the app uses. We import
every model module so Base.metadata is complete before autogenerate.
"""
from logging.config import fileConfig
from alembic import context
from sqlalchemy import engine_from_config, pool

# Make `backend.*` importable regardless of CWD.
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.app.config import settings
from backend.app.database import Base

# Import every model module so its table is registered on Base.metadata.
from backend.app.devices.model import Device              # noqa: F401
from backend.app.menu.model import MenuItem               # noqa: F401
from backend.app.orders.model import Order, OrderItem     # noqa: F401
from backend.app.payments.model import Payment            # noqa: F401
from backend.app.staff.model import Staff                 # noqa: F401
from backend.app.idempotency.model import IdempotencyKey  # noqa: F401
from backend.app.settings.model import Setting            # noqa: F401
from backend.app.tables.model import Table                # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    context.configure(
        url=settings.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    # FIX: Bypass config.set_main_option() because configparser crashes
    # if the URL contains '%' (e.g. URL-encoded passwords like %25, %40).
    # Instead, we inject the URL directly into the configuration dictionary.
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.DATABASE_URL

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()