"""UNIT-B01: orders/router.py::_compute_totals

Pure money math. Items only need `.quantity` and `.price_cents`, so we use
SimpleNamespace stand-ins instead of real ORM rows — keeps the test DB-free.
All amounts are asserted in integer cents.
"""
from types import SimpleNamespace

from backend.app.orders.router import _compute_totals


def line(qty, price_cents):
    return SimpleNamespace(quantity=qty, price_cents=price_cents)


def test_subtotal_is_sum_of_line_totals():
    subtotal, tax, total = _compute_totals([line(2, 500), line(1, 350)], {})
    assert subtotal == 1350
    assert tax == 0
    assert total == 1350


def test_empty_tax_map_yields_zero_tax():
    _, tax, total = _compute_totals([line(3, 999)], {})
    assert tax == 0
    assert total == 2997


def test_single_rate_applied_to_subtotal():
    # 1000 * 0.15 = 150 exactly
    _, tax, total = _compute_totals([line(1, 1000)], {"vat": 0.15})
    assert tax == 150
    assert total == 1150


def test_multiple_rates_rounded_independently_then_summed():
    # Each rate rounds on its own before summing (mirrors the server loop).
    # 333 * 0.05 = 16.65 -> 17 ; 333 * 0.07 = 23.31 -> 23 ; total 40.
    _, tax, _ = _compute_totals([line(1, 333)], {"a": 0.05, "b": 0.07})
    assert tax == 40


def test_empty_order_totals_to_zero():
    subtotal, tax, total = _compute_totals([], {"vat": 0.15})
    assert subtotal == 0
    assert tax == 0
    assert total == 0