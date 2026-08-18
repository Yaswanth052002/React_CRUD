"""
Business-logic layer. Translates API-level requests into repository
calls and enforces rules that aren't pure data validation (e.g.
"email must be unique", "user must exist").
"""
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate, UserListResponse, UserUpdate
from app.services.auth_service import AuthService, PasswordHashingError


class UserService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = UserRepository(db)

    def list_users(
        self,
        search: Optional[str] = None,
        role: Optional[str] = None,
        status_filter: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> UserListResponse:
        offset = (page - 1) * page_size
        items = self.repo.get_all(
            search=search, role=role, status=status_filter, limit=page_size, offset=offset
        )
        total = self.repo.count_filtered(search=search, role=role, status=status_filter)
        return UserListResponse(items=items, total=total, page=page, page_size=page_size)

    def get_user(self, user_id: int) -> User:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {user_id} was not found",
            )
        return user

    def create_user(self, payload: UserCreate) -> User:
        existing = self.repo.get_by_email(payload.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A user with email '{payload.email}' already exists",
            )

        data = payload.model_dump()
        plaintext_password = data.pop("password")
        try:
            data["password_hash"] = AuthService(self.db).hash_password(plaintext_password)
        except PasswordHashingError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not process the request. Please try again later.",
            )

        return self.repo.create(data)

    def update_user(self, user_id: int, payload: UserUpdate) -> User:
        user = self.get_user(user_id)

        existing = self.repo.get_by_email(payload.email)
        if existing and existing.id != user_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A user with email '{payload.email}' already exists",
            )

        return self.repo.update(user, payload.model_dump())

    def delete_user(self, user_id: int) -> None:
        user = self.get_user(user_id)
        self.repo.delete(user)

    def dashboard_stats(self) -> dict:
        return self.repo.stats()
