from pydantic import BaseModel, ConfigDict, Field


class TableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    section: str
    available: bool
    version: int


class TableCreate(BaseModel):
    name: str
    section: str = "DINE-IN"


class TableUpdate(BaseModel):
    name: str | None = None
    section: str | None = None
    available: bool | None = None