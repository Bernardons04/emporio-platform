"""Authentication and user schemas."""

from datetime import datetime
import uuid
from pydantic import BaseModel, ConfigDict, Field


class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Full name")
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", description="Valid email address")
    password: str = Field(..., min_length=6, max_length=128, description="Password (at least 6 characters)")


class UserLogin(BaseModel):
    email: str = Field(..., description="Registered email address")
    password: str = Field(..., description="Password")


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    is_admin: bool
    customer_id: int | None = None
    created_at: datetime


class MessageResponse(BaseModel):
    message: str
