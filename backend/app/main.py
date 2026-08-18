"""
FastAPI application entry point.

Wires together: DB table creation, seed data, CORS, routers, and
centralized error handling so unhandled exceptions never leak a
Python stack trace to the browser.
"""
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.database import Base, engine, SessionLocal
from app.seed import seed_if_empty
from app.services.auth_service import AuthService
from app.api import users, dashboard, auth

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("user_management_api")

app = FastAPI(
    title="User Management CRUD API",
    description="Backend for the User Management CRUD Dashboard.",
    version="1.0.0",
)

# --- CORS -------------------------------------------------------------
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Startup: create tables + seed sample data -------------------------
Base.metadata.create_all(bind=engine)


@app.on_event("startup")
def on_startup():
    if not os.getenv("JWT_SECRET_KEY", "").strip():
        logger.error("JWT_SECRET_KEY environment variable is required")
        raise RuntimeError("JWT_SECRET_KEY environment variable is required")

    db = SessionLocal()
    try:
        seed_if_empty(db)
        AuthService(db).provision_existing_users_with_random_password()
    finally:
        db.close()


# --- Centralized error handling ----------------------------------------
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Flatten pydantic errors into a single readable message instead of
    # exposing internal schema paths.
    messages = []
    for err in exc.errors():
        field = ".".join(str(p) for p in err.get("loc", []) if p != "body")
        messages.append(f"{field}: {err.get('msg')}" if field else err.get("msg"))
    return JSONResponse(status_code=422, content={"detail": "; ".join(messages)})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server error")
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred. Please try again."},
    )


# --- Routers -------------------------------------------------------------
app.include_router(users.router)
app.include_router(dashboard.router)
app.include_router(auth.router)


@app.get("/api/health", tags=["health"])
def health_check():
    return {"status": "ok"}
