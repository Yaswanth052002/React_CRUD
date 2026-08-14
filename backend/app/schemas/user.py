"""Pydantic schemas: request/response contracts for the users API."""
import re
from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, EmailStr, field_validator, ConfigDict

PHONE_REGEX = re.compile(r"^[0-9+\-() ]{7,20}$")


class RoleEnum(str, Enum):
    admin = "Admin"
    user = "User"


class StatusEnum(str, Enum):
    active = "Active"
    inactive = "Inactive"


class UserBase(BaseModel):
    name: str
    email: EmailStr
    phone: str
    role: RoleEnum
    status: StatusEnum

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name must be at least 2 characters long")
        return v

    @field_validator("phone")
    @classmethod
    def phone_format(cls, v: str) -> str:
        v = v.strip()
        if not PHONE_REGEX.match(v):
            raise ValueError("Phone number format is invalid")
        return v


class UserCreate(UserBase):
    pass


class UserUpdate(UserBase):
    pass


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class UserListResponse(BaseModel):
    items: List[UserOut]
    total: int
    page: int
    page_size: int


class DashboardStats(BaseModel):
    total_users: int
    active_users: int
    admin_users: int
    regular_users: int


class ErrorResponse(BaseModel):
    detail: str
