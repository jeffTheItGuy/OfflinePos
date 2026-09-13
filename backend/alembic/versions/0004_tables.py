"""configurable tables
Revision ID: 0004_tables
Revises: 0003_tax_columns
Create Date: 2026-02-01 00:01:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0004_tables"
down_revision: Union[str, None] = "0003_tax_columns"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tables",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("section", sa.String(60), nullable=False, server_default="DINE-IN"),
        sa.Column("available", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )


def downgrade() -> None:
    op.drop_table("tables")