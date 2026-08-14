"""SQLAlchemy ORM model for the `users` table."""
import enum
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Enum, DateTime
from app.database import Base


class RoleEnum(str, enum.Enum):
    admin = "Admin"
    user = "User"


class StatusEnum(str, enum.Enum):
    active = "Active"
    inactive = "Inactive"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    phone = Column(String(30), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False, default=RoleEnum.user)
    status = Column(Enum(StatusEnum), nullable=False, default=StatusEnum.active)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)
