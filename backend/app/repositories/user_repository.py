"""
Data-access layer. Only this module talks to SQLAlchemy directly.
Services depend on this repository instead of the ORM, so the
persistence layer can be swapped or mocked without touching business logic.
"""
from typing import Optional, Sequence

from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.models.user import User, RoleEnum, StatusEnum


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def _filtered_query(
        self,
        search: Optional[str] = None,
        role: Optional[str] = None,
        status: Optional[str] = None,
    ):
        query = self.db.query(User)

        if search:
            like = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    User.name.ilike(like),
                    User.email.ilike(like),
                    User.phone.ilike(like),
                )
            )

        if role and role.lower() != "all":
            query = query.filter(User.role == role)

        if status and status.lower() != "all":
            query = query.filter(User.status == status)

        return query

    def get_all(
        self,
        search: Optional[str] = None,
        role: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[User]:
        return (
            self._filtered_query(search, role, status)
            .order_by(User.id.asc())
            .limit(limit)
            .offset(offset)
            .all()
        )

    def count_filtered(
        self,
        search: Optional[str] = None,
        role: Optional[str] = None,
        status: Optional[str] = None,
    ) -> int:
        return self._filtered_query(search, role, status).with_entities(func.count(User.id)).scalar() or 0

    def get_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(func.lower(User.email) == email.lower()).first()

    def create(self, data: dict) -> User:
        user = User(**data)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update(self, user: User, data: dict) -> User:
        for field, value in data.items():
            setattr(user, field, value)
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete(self, user: User) -> None:
        self.db.delete(user)
        self.db.commit()

    def stats(self) -> dict:
        total = self.db.query(func.count(User.id)).scalar() or 0
        active = (
            self.db.query(func.count(User.id))
            .filter(User.status == StatusEnum.active)
            .scalar()
            or 0
        )
        admins = (
            self.db.query(func.count(User.id))
            .filter(User.role == RoleEnum.admin)
            .scalar()
            or 0
        )
        regular = (
            self.db.query(func.count(User.id))
            .filter(User.role == RoleEnum.user)
            .scalar()
            or 0
        )
        return {
            "total_users": total,
            "active_users": active,
            "admin_users": admins,
            "regular_users": regular,
        }

    def count(self) -> int:
        return self.db.query(func.count(User.id)).scalar() or 0
