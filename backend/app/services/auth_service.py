"""
Auth business-logic layer (AUTH-02). Kept separate from `UserService`
(ADR-1, docs/features/AUTH-02/PLAN.md) — owns login, the AC4 startup
provisioning migration, and the AC5 operator-provisioning helper. Calls
`UserRepository` directly, same as `UserService` does; no new repository
is introduced.
"""
import hashlib
import hmac
import logging
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginResponse

logger = logging.getLogger("auth_service")

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

_PBKDF2_ITERATIONS = 260_000


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

    # -- Password hashing (ADR-4: stdlib placeholder — AUTH-03 supplies the ----
    # -- real argon2id/bcrypt scheme against these same columns) --------------

    def _hash_password(self, plaintext: str) -> str:
        salt = secrets.token_hex(16)
        digest = hashlib.pbkdf2_hmac("sha256", plaintext.encode("utf-8"), salt.encode("utf-8"), _PBKDF2_ITERATIONS)
        return f"{salt}${digest.hex()}"

    def _verify_password(self, stored_hash: str, plaintext: str) -> bool:
        try:
            salt, expected_hex = stored_hash.split("$", 1)
        except ValueError:
            return False
        digest = hashlib.pbkdf2_hmac("sha256", plaintext.encode("utf-8"), salt.encode("utf-8"), _PBKDF2_ITERATIONS)
        return hmac.compare_digest(digest.hex(), expected_hex)

    def _generate_unusable_hash(self) -> str:
        """A hash of a random, never-provisioned-to-anyone password — never verifies."""
        return self._hash_password(secrets.token_urlsafe(32))

    # A fixed-format dummy hash used to keep `_verify_credentials`'s work
    # equivalent whether or not a matching user exists (FR-2 timing safety).
    _DUMMY_HASH = "0" * 32 + "$" + "0" * 64

    def _verify_credentials(self, user: Optional[User], plaintext: str) -> bool:
        stored_hash = user.password_hash if (user and user.password_hash) else self._DUMMY_HASH
        matches = self._verify_password(stored_hash, plaintext)

        if user is None:
            return False
        if user.must_reset_password:
            return False
        return matches

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
