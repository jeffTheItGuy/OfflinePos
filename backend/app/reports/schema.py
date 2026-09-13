from pydantic import BaseModel


class MethodBreakdown(BaseModel):
    method: str              # "cash" | "stripe"
    count: int
    total_cents: int


class CategoryBreakdown(BaseModel):
    category: str
    line_count: int
    subtotal_cents: int
    tax_cents: int
    total_cents: int


class StaffBreakdown(BaseModel):
    staff_id: str
    staff_name: str
    order_count: int
    total_cents: int


class VoidEntry(BaseModel):
    order_id: str
    order_no: str
    table_name: str
    reason: str | None
    voided_by_name: str | None
    total_cents: int
    created_at: str


class ZReportOut(BaseModel):
    business_day: str
    timezone: str
    cutover_hour: int
    currency: str
    # Totals
    gross_cents: int
    subtotal_cents: int
    tax_cents: int
    paid_order_count: int
    void_count: int
    void_total_cents: int
    # Breakdowns
    by_payment_method: list[MethodBreakdown]
    by_category: list[CategoryBreakdown]
    by_staff: list[StaffBreakdown]
    voids: list[VoidEntry]
    # Cash drawer
    cash_expected_in_drawer_cents: int