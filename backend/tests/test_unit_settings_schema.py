"""UNIT-B04/B05: settings/schema.py::SettingsOut / SettingsUpdate

Covers the defaults a fresh database falls back to, and the pydantic
validation on partial updates. (The DB-backed get_settings path is
integration territory and intentionally not covered here.)
"""
import pytest
from pydantic import ValidationError

from backend.app.settings.schema import SettingsOut, SettingsUpdate


def test_defaults_apply_on_fresh_database():
    s = SettingsOut()
    assert s.restaurant_timezone == "UTC"
    assert s.business_day_cutover_hour == 0
    assert s.currency == "USD"
    assert s.tax_rates == {}


def test_cutover_out_of_range_rejected():
    with pytest.raises(ValidationError):
        SettingsUpdate(business_day_cutover_hour=24)
    with pytest.raises(ValidationError):
        SettingsUpdate(business_day_cutover_hour=-1)


def test_currency_must_be_three_chars():
    with pytest.raises(ValidationError):
        SettingsUpdate(currency="US")
    with pytest.raises(ValidationError):
        SettingsUpdate(currency="USDT")


def test_partial_patch_only_sets_supplied_keys():
    dumped = SettingsUpdate(currency="EUR").model_dump(exclude_unset=True)
    assert dumped == {"currency": "EUR"}


def test_valid_full_update_is_accepted():
    u = SettingsUpdate(
        restaurant_timezone="Africa/Harare",
        business_day_cutover_hour=4,
        currency="USD",
        tax_rates={"vat": 0.15},
    )
    assert u.business_day_cutover_hour == 4
    assert u.tax_rates == {"vat": 0.15}