"""Pydantic schemas: request/response contracts for the auth API."""
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    """Login credentials submitted to POST /api/auth/login."""

    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    """Successful login response — `token` is a signed JWT (see AuthService)."""

    token: str


class CurrentUserResponse(BaseModel):
    """Response for GET /api/auth/me — never includes id, role, or any other field."""

    name: str
    email: str
