"""order void audit columns

Revision ID: 0002_order_voids
Revises: 0001_initial
Create Date: 2026-01-15 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_order_voids"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable: every order created before this migration has no void data.
    op.add_column(
        "orders",
        sa.Column("void_reason", sa.Text(), nullable=True),
    )
    op.add_column(
        "orders",
        sa.Column("voided_by", sa.String(36), nullable=True),
    )
    op.create_foreign_key(
        "fk_orders_voided_by_staff",
        "orders",
        "staff",
        ["voided_by"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_orders_voided_by_staff", "orders", type_="foreignkey")
    op.drop_column("orders", "voided_by")
    op.drop_column("orders", "void_reason")