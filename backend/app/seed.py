"""
Seeds a handful of sample users on first run only.
If the users table already has any rows, this is a no-op, so restarting
the backend never duplicates data.
"""
from sqlalchemy.orm import Session

from app.models.user import User, RoleEnum, StatusEnum

SAMPLE_USERS = [
    dict(name="John Smith", email="john@test.com", phone="9876543210",
         role=RoleEnum.user, status=StatusEnum.active),
    dict(name="David Lee", email="david@test.com", phone="9876543211",
         role=RoleEnum.admin, status=StatusEnum.active),
    dict(name="Sarah Kim", email="sarah@test.com", phone="9876543212",
         role=RoleEnum.user, status=StatusEnum.active),
    dict(name="Michael Brown", email="michael@test.com", phone="9876543213",
         role=RoleEnum.user, status=StatusEnum.inactive),
    dict(name="Emily Davis", email="emily@test.com", phone="9876543214",
         role=RoleEnum.admin, status=StatusEnum.active),
]


def seed_if_empty(db: Session) -> None:
    if db.query(User).first() is not None:
        return
    for data in SAMPLE_USERS:
        db.add(User(**data))
    db.commit()
