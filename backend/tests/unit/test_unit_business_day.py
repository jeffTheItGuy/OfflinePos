"""UNIT-B02: reports/service.py::business_day_bounds

Verifies the cutover-hour window math and the local -> UTC conversion,
including a timezone with DST. Returns aware UTC datetimes.
"""
from datetime import datetime, timedelta, timezone

from backend.app.reports.service import business_day_bounds


def test_window_is_exactly_24_hours():
    start, end = business_day_bounds("2026-02-15", "UTC", 0)
    assert end - start == timedelta(hours=24)


def test_cutover_zero_starts_at_midnight_utc():
    start, end = business_day_bounds("2026-02-15", "UTC", 0)
    assert start == datetime(2026, 2, 15, 0, 0, tzinfo=timezone.utc)
    assert end == datetime(2026, 2, 16, 0, 0, tzinfo=timezone.utc)


def test_cutover_four_shifts_window_forward():
    # With cutover=4, business day 2026-02-15 runs 04:00 -> next 04:00.
    start, end = business_day_bounds("2026-02-15", "UTC", 4)
    assert start == datetime(2026, 2, 15, 4, 0, tzinfo=timezone.utc)
    assert end == datetime(2026, 2, 16, 4, 0, tzinfo=timezone.utc)


def test_offset_timezone_converts_to_utc():
    # Africa/Harare is UTC+2 with no DST — a stable reference.
    # 04:00 local == 02:00 UTC.
    start, _ = business_day_bounds("2026-02-15", "Africa/Harare", 4)
    assert start == datetime(2026, 2, 15, 2, 0, tzinfo=timezone.utc)


def test_dst_day_uses_daylight_offset():
    # US spring-forward is 2026-03-08. 04:00 local that day is EDT (UTC-4),
    # so it must map to 08:00 UTC. (If DST were ignored and EST/UTC-5 used,
    # this would wrongly be 09:00 UTC.)
    start, _ = business_day_bounds("2026-03-08", "America/New_York", 4)
    assert start == datetime(2026, 3, 8, 8, 0, tzinfo=timezone.utc)