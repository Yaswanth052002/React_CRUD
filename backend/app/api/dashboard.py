"""HTTP layer for /api/dashboard."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.user import DashboardStats
from app.services.user_service import UserService

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(db: Session = Depends(get_db)):
    service = UserService(db)
    return service.dashboard_stats()
