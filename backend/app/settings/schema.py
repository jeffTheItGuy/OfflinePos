from typing import Any

from pydantic import BaseModel, Field, field_validator


class SettingsOut(BaseModel):
    """The full, effective settings object the frontend consumes.

    Every field has a default; missing rows in the DB fall back to these.
    """

    restaurant_timezone: str = Field(
        default="UTC",
        description="IANA tz name, e.g. 'Africa/Harare' or 'America/New_York'.",
    )
    business_day_cutover_hour: int = Field(
        default=0,
        ge=0,
        le=23,
        description=(
            "Local hour at which a new business day starts. "
            "Set to 4 for restaurants that close after midnight."
        ),
    )
    currency: str = Field(default="USD", min_length=3, max_length=3)
    tax_rates: dict[str, float] = Field(
        default_factory=dict,
        description="Named rates, e.g. {'vat': 0.15, 'service': 0.10}.",
    )

    @field_validator("tax_rates")
    @classmethod
    def validate_tax_rates_out(cls, v: dict[str, float]) -> dict[str, float]:
        for name, rate in v.items():
            if rate < 0:
                raise ValueError(f"Tax rate '{name}' cannot be negative")
        return v


class SettingsUpdate(BaseModel):
    """Partial update. Only supplied keys are written."""

    restaurant_timezone: str | None = None
    business_day_cutover_hour: int | None = Field(default=None, ge=0, le=23)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    tax_rates: dict[str, float] | None = None

    @field_validator("tax_rates")
    @classmethod
    def validate_tax_rates_update(cls, v: dict[str, float] | None) -> dict[str, float] | None:
        if v is not None:
            for name, rate in v.items():
                if rate < 0:
                    raise ValueError(f"Tax rate '{name}' cannot be negative")
        return v


class SettingRow(BaseModel):
    key: str
    value: Any