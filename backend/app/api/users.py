"""HTTP layer for /api/users. Thin: parses input, calls the service, returns output."""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.services.user_service import UserService

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=List[UserOut])
def list_users(
    search: Optional[str] = Query(None, description="Match against name, email, or phone"),
    role: Optional[str] = Query(None, description="'Admin', 'User', or 'All'"),
    status: Optional[str] = Query(None, description="'Active', 'Inactive', or 'All'"),
    db: Session = Depends(get_db),
):
    service = UserService(db)
    return service.list_users(search=search, role=role, status_filter=status)


@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    service = UserService(db)
    return service.get_user(user_id)


@router.post("", response_model=UserOut, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    service = UserService(db)
    return service.create_user(payload)


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db)):
    service = UserService(db)
    return service.update_user(user_id, payload)


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    service = UserService(db)
    service.delete_user(user_id)
    return None
