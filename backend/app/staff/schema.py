from pydantic import BaseModel, ConfigDict, Field


class StaffOut(BaseModel):
    """What leaves the server: NO pin_hash, ever."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    role: str


class StaffLogin(BaseModel):
    pin: str = Field(min_length=4, max_length=12)


class StaffCreate(BaseModel):
    name: str
    pin: str = Field(min_length=4, max_length=12)
    role: str = "waiter"  # waiter | manager
