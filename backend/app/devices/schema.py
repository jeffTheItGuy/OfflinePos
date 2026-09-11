from pydantic import BaseModel, ConfigDict, Field


class DeviceRegister(BaseModel):
    name: str
    order_no_prefix: str = Field(min_length=1, max_length=6)  # e.g. "T1"


class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    order_no_prefix: str
