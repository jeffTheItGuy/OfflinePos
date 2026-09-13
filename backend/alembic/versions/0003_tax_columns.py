"""tax breakdown columns on orders
Revision ID: 0003_tax_columns
Revises: 0002_order_voids
Create Date: 2026-02-01 00:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0003_tax_columns"
down_revision: Union[str, None] = "0002_order_voids"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("subtotal_cents", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("orders", sa.Column("tax_cents", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("orders", "tax_cents")
    op.drop_column("orders", "subtotal_cents")