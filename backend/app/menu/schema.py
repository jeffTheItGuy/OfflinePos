from pydantic import BaseModel, ConfigDict, Field


class MenuItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    price_cents: int
    category: str
    available: bool
    version: int


class MenuItemCreate(BaseModel):
    name: str
    price_cents: int = Field(ge=0)
    category: str = "general"


class MenuItemUpdate(BaseModel):
    name: str | None = None
    price_cents: int | None = Field(default=None, ge=0)
    category: str | None = None
    available: bool | None = None
