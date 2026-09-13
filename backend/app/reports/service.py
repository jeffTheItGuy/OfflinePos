from datetime import datetime, timedelta, timezone as tz
from zoneinfo import ZoneInfo

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from backend.app.menu.model import MenuItem
from backend.app.orders.model import Order, OrderItem
from backend.app.payments.model import Payment
from backend.app.settings.service import get_settings
from backend.app.staff.model import Staff
from backend.app.reports.schema import (
    ZReportOut, MethodBreakdown, CategoryBreakdown,
    StaffBreakdown, VoidEntry,
)


def business_day_bounds(day_str: str, tz_name: str, cutover_hour: int):
    """Return UTC start/end for a business day.

    A cutover_hour of 4 means business day '2026-02-15' runs from
    2026-02-15T04:00 local → 2026-02-16T04:00 local.
    """
    local_tz = ZoneInfo(tz_name)
    start_local = datetime.strptime(day_str, "%Y-%m-%d").replace(
        hour=cutover_hour, minute=0, second=0, microsecond=0,
        tzinfo=local_tz,
    )
    end_local = start_local + timedelta(days=1)
    return start_local.astimezone(tz.utc), end_local.astimezone(tz.utc)


def build_z_report(db: Session, day_str: str | None = None) -> ZReportOut:
    settings = get_settings(db)
    tz_name = settings.restaurant_timezone
    cutover = settings.business_day_cutover_hour

    if day_str is None:
        now_local = datetime.now(ZoneInfo(tz_name))
        if now_local.hour < cutover:
            now_local -= timedelta(days=1)
        day_str = now_local.strftime("%Y-%m-%d")

    start_utc, end_utc = business_day_bounds(day_str, tz_name, cutover)

    # ── Fetch all orders in the business-day window ──
    orders = db.execute(
        select(Order).where(
            Order.created_at >= start_utc,
            Order.created_at < end_utc,
        )
    ).scalars().all()

    paid_orders  = [o for o in orders if o.payment_status == "paid"]
    void_orders  = [o for o in orders if o.status == "void"]
    order_ids    = [o.id for o in paid_orders]

    # ── By payment method ──
    method_map: dict[str, dict] = {}
    if order_ids:
        payments = db.execute(
            select(Payment).where(Payment.order_id.in_(order_ids))
        ).scalars().all()
        for p in payments:
            m = method_map.setdefault(p.method, {"count": 0, "total_cents": 0})
            m["count"] += 1
            m["total_cents"] += p.amount_cents

    by_method = [
        MethodBreakdown(method=k, **v)
        for k, v in sorted(method_map.items())
    ]

    # ── By category (order_items → menu_items) ──
    cat_map: dict[str, dict] = {}
    if order_ids:
        rows = db.execute(
            select(
                func.coalesce(MenuItem.category, "general").label("category"),
                func.count(OrderItem.id).label("line_count"),
                func.sum(OrderItem.quantity * OrderItem.price_cents).label("subtotal"),
            )
            .join(OrderItem, OrderItem.menu_item_id == MenuItem.id, isouter=True)
            .where(OrderItem.order_id.in_(order_ids))
            .group_by(func.coalesce(MenuItem.category, "general"))
        ).all()
        for row in rows:
            cat_map[row.category] = {
                "line_count": row.line_count or 0,
                "subtotal_cents": row.subtotal or 0,
            }

    gross_subtotal = sum(o.subtotal_cents for o in paid_orders)
    gross_tax      = sum(o.tax_cents for o in paid_orders)

    by_category = []
    for cat, data in sorted(cat_map.items()):
        tax_share = 0
        if gross_subtotal > 0:
            tax_share = round(gross_tax * data["subtotal_cents"] / gross_subtotal)
        by_category.append(CategoryBreakdown(
            category=cat,
            line_count=data["line_count"],
            subtotal_cents=data["subtotal_cents"],
            tax_cents=tax_share,
            total_cents=data["subtotal_cents"] + tax_share,
        ))

    # ── By staff ──
    staff_map: dict[str, dict] = {}
    for o in paid_orders:
        sid = o.staff_id or "unknown"
        s = staff_map.setdefault(sid, {"count": 0, "total_cents": 0})
        s["count"] += 1
        s["total_cents"] += o.total_cents

    by_staff = []
    for sid, data in staff_map.items():
        name = "Unknown"
        if sid != "unknown":
            st = db.get(Staff, sid)
            if st:
                name = st.name
        by_staff.append(StaffBreakdown(
            staff_id=sid, staff_name=name,
            order_count=data["count"], total_cents=data["total_cents"],
        ))

    # ── Voids ──
    voids = []
    for o in void_orders:
        voided_name = None
        if o.voided_by:
            st = db.get(Staff, o.voided_by)
            if st:
                voided_name = st.name
        voids.append(VoidEntry(
            order_id=o.id, order_no=o.order_no,
            table_name=o.table_name, reason=o.void_reason,
            voided_by_name=voided_name, total_cents=o.total_cents,
            created_at=o.created_at.isoformat(),
        ))

    # ── Cash drawer ──
    cash_total = sum(
        v["total_cents"] for k, v in method_map.items() if k == "cash"
    )

    return ZReportOut(
        business_day=day_str,
        timezone=tz_name,
        cutover_hour=cutover,
        currency=settings.currency,
        gross_cents=sum(o.total_cents for o in paid_orders),
        subtotal_cents=gross_subtotal,
        tax_cents=gross_tax,
        paid_order_count=len(paid_orders),
        void_count=len(void_orders),
        void_total_cents=sum(o.total_cents for o in void_orders),
        by_payment_method=by_method,
        by_category=by_category,
        by_staff=by_staff,
        voids=voids,
        cash_expected_in_drawer_cents=cash_total,
    )