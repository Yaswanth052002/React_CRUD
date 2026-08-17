"""
AC5 operator provisioning script.

Usage:
    python -m app.scripts.set_initial_password <email>

Deliberately takes only the email as a CLI argument — the password is
always read via an interactive, non-echoing `getpass()` stdin prompt
(ADR-3), never as a CLI argument or environment variable, to avoid shell
history / `ps` exposure. This script is never reachable via HTTP; it
requires direct server/deployment access.

The plaintext password is discarded immediately after hashing — it is
never logged, persisted, or echoed anywhere beyond the operator's own
terminal input.
"""
import getpass
import sys

from app.database import SessionLocal
from app.services.auth_service import AuthService


def _sanitize_email_for_output(email: str) -> str:
    """Strip control characters so the confirmation line can't be used for log injection."""
    return "".join(ch for ch in email if ch.isprintable())


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python -m app.scripts.set_initial_password <email>", file=sys.stderr)
        return 1

    email = sys.argv[1]
    password = getpass.getpass("New password: ")

    db = SessionLocal()
    try:
        AuthService(db).set_user_initial_password(email, password)
    except Exception:
        # Never surface the underlying exception text — it could echo
        # database internals; a generic message is sufficient for an
        # operator with direct deployment access.
        print("Error: could not set a password for that user.", file=sys.stderr)
        return 1
    finally:
        db.close()

    print(f"Password set for user {_sanitize_email_for_output(email)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
