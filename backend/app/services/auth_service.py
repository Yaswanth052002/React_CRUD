"""
Auth business-logic layer (AUTH-02). Kept separate from `UserService`
(ADR-1, docs/features/AUTH-02/PLAN.md) — owns login, the AC4 startup
provisioning migration, and the AC5 operator-provisioning helper. Calls
`UserRepository` directly, same as `UserService` does; no new repository
is introduced.
"""
import hashlib
import logging
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import HTTPException, status
from passlib.context import CryptContext
from passlib.exc import UnknownHashError
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginResponse

logger = logging.getLogger("auth_service")

# ADR-1 (AUTH-03): bcrypt via passlib, work factor 12 — replaces AUTH-02's
# stdlib pbkdf2_hmac placeholder in place.
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


class PasswordHashingError(Exception):
    """Raised when the underlying hashing library fails unexpectedly (AUTH-03 NFR-security)."""

# Single shared error message/status for every invalid-login outcome (FR-2/FR-3):
# unknown email, wrong password, and an unprovisioned (must_reset_password=true)
# account are all indistinguishable to the caller.
INVALID_CREDENTIALS_MESSAGE = "Invalid email or password."

# Rate limiting (ADR-2/FR-6): in-process sliding window, module-level so it
# persists across requests (and across AuthService instances) within a
# process lifetime. Never persisted to the database.
_RATE_LIMIT_MAX_ATTEMPTS = 3
_RATE_LIMIT_WINDOW_SECONDS = 60 * 60
_failed_attempts: dict[str, list[float]] = {}

# JWT (ADR-5): access-token TTL fixed at 60 minutes per AUTH-04's decision log.
_JWT_TTL_MINUTES = 60
_JWT_ALGORITHM = "HS256"

def _hash_email(email: str) -> str:
    """Opaque key for rate-limiting/logging — never log the plaintext email."""
    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()


class AuthService:
    def __init__(self, db: Session):
        self.repo = UserRepository(db)

    # -- Public API ------------------------------------------------------

    def login(self, email: str, password: str) -> LoginResponse:
        email_key = _hash_email(email)
        self._check_rate_limit(email_key)

        user = self.repo.get_by_email(email)
        if not self._verify_credentials(user, password):
            self._record_failed_attempt(email_key)
            logger.info("Failed login attempt", extra={"email_hash": email_key})
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS_MESSAGE)

        logger.info("Successful login", extra={"user_id": user.id})
        token = self._issue_token(user.email)
        return LoginResponse(token=token)

    def provision_existing_users_with_random_password(self) -> int:
        """
        One-time, idempotent startup migration (AC4/FR-4): every row with no
        `password_hash` gets a cryptographically random, unusable hash and
        `must_reset_password=True`. Re-running is a no-op for already-hashed
        rows, because it only ever touches `WHERE password_hash IS NULL`.
        """
        rows = self.repo.get_without_credential()
        for user in rows:
            self.repo.update(
                user,
                {"password_hash": self._generate_unusable_hash(), "must_reset_password": True},
            )
        return len(rows)

    def set_user_initial_password(self, email: str, plaintext_password: str) -> None:
        """
        AC5: operator-invoked provisioning — sets a real password for one
        user and clears `must_reset_password`. Never logs or persists the
        plaintext password beyond its use as hash input.
        """
        user = self.repo.get_by_email(email)
        if not user:
            raise ValueError("No matching user was found for that email.")

        self.repo.update(
            user,
            {"password_hash": self._hash_password(plaintext_password), "must_reset_password": False},
        )

    # -- Password hashing (ADR-1, AUTH-03): bcrypt via passlib, work factor 12,
    # -- replacing AUTH-02's stdlib pbkdf2_hmac placeholder in place. ---------

    def hash_password(self, plaintext: str) -> str:
        """
        Hash a plaintext password with bcrypt (work factor 12). Never logs or
        echoes the plaintext. Raises `PasswordHashingError` (never a raw
        library exception) if the underlying hashing library fails.
        """
        try:
            return _pwd_context.hash(plaintext)
        except Exception:
            logger.warning("Password hashing failed due to a library error")
            raise PasswordHashingError("Could not process the password. Please try again later.")

    def verify_credentials(self, email: str, plaintext: str) -> bool:
        """
        Constant-time bcrypt verify of `plaintext` against the stored hash for
        `email`. Returns a plain boolean; never raises, and never distinguishes
        "no such user" from "wrong password" or a foreign/malformed hash
        format (e.g. AUTH-02's placeholder `salt$hex_digest` rows — ADR-1).
        """
        user = self.repo.get_by_email(email)
        if not user or not user.password_hash:
            return False
        try:
            return _pwd_context.verify(plaintext, user.password_hash)
        except UnknownHashError:
            # Foreign/placeholder hash format (e.g. AUTH-02's pbkdf2_hmac
            # rows) — expected incompatibility per ADR-1, not a failure to log.
            return False
        except Exception:
            logger.warning("Password verification failed due to a library error", extra={"user_id": user.id})
            return False

    def _hash_password(self, plaintext: str) -> str:
        """Internal alias kept for AC4/AC5 provisioning call sites (ADR-1: delegates to `hash_password`)."""
        return self.hash_password(plaintext)

    def _generate_unusable_hash(self) -> str:
        """A hash of a random, never-provisioned-to-anyone password — never verifies."""
        return self._hash_password(secrets.token_urlsafe(32))

    def _verify_credentials(self, user: Optional[User], plaintext: str) -> bool:
        if user is None:
            return False
        if user.must_reset_password:
            return False
        return self.verify_credentials(user.email, plaintext)

    # -- Rate limiting (ADR-2) --------------------------------------------

    def _check_rate_limit(self, email_key: str) -> None:
        now = time.time()
        attempts = self._prune_attempts(email_key, now)
        if len(attempts) >= _RATE_LIMIT_MAX_ATTEMPTS:
            retry_after = int(_RATE_LIMIT_WINDOW_SECONDS - (now - attempts[0])) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts. Please try again later.",
                headers={"Retry-After": str(max(retry_after, 1))},
            )

    def _record_failed_attempt(self, email_key: str) -> None:
        now = time.time()
        attempts = self._prune_attempts(email_key, now)
        attempts.append(now)
        _failed_attempts[email_key] = attempts

    def _prune_attempts(self, email_key: str, now: float) -> list[float]:
        attempts = _failed_attempts.get(email_key, [])
        attempts = [t for t in attempts if now - t < _RATE_LIMIT_WINDOW_SECONDS]
        _failed_attempts[email_key] = attempts
        return attempts

    # -- JWT issuing (ADR-5, amendment) ------------------------------------

    def _issue_token(self, email: str) -> str:
        secret = os.getenv("JWT_SECRET_KEY")
        if not secret:
            # Defense in depth — AUTH-08's startup check should already have
            # prevented this. Never leak the underlying reason to the caller.
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not process login. Please try again later.",
            )
        try:
            payload = {
                "sub": email,
                "exp": datetime.now(timezone.utc) + timedelta(minutes=_JWT_TTL_MINUTES),
            }
            return jwt.encode(payload, secret, algorithm=_JWT_ALGORITHM)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not process login. Please try again later.",
            )

    # -- Current-user resolution (GET /api/auth/me) ------------------------

    def get_current_user_from_token(self, token: str) -> User:
        """
        Decodes and verifies a bearer JWT, then loads the user it identifies.
        Any failure (missing/invalid/expired token, unknown user) raises a
        single generic 401 — never distinguishes the reason to the caller.
        """
        secret = os.getenv("JWT_SECRET_KEY")
        unauthorized = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
        )
        if not secret:
            raise unauthorized
        try:
            payload = jwt.decode(token, secret, algorithms=[_JWT_ALGORITHM])
        except jwt.PyJWTError:
            raise unauthorized
        email = payload.get("sub")
        if not email:
            raise unauthorized
        user = self.repo.get_by_email(email)
        if not user:
            raise unauthorized
        return user
