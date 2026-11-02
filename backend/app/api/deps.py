"""FastAPI dependencies for authentication, authorization, and database sessions."""

from datetime import datetime, timezone
import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_session_token
from app.db.session import get_db
from app.models.user import Session as DbSession, User


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """Authenticates the user using the HTTP-only session cookie.

    Raises 401 if unauthenticated or session has expired.
    """
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    token_hash = hash_session_token(token)

    stmt = select(DbSession).where(DbSession.token_hash == token_hash)
    db_session = db.execute(stmt).scalar_one_or_none()

    if not db_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )

    # Check expiration
    now = datetime.now(timezone.utc)
    if db_session.expires_at <= now:
        db.delete(db_session)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please log in again.",
        )

    if not db_session.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with session not found",
        )

    return db_session.user


def get_current_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Enforces administrator authorization.

    Raises 403 if the user is not an administrator.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Administrator privileges required",
        )
    return current_user


def check_customer_access(current_user: User, customer_id: int) -> None:
    """Ensures a customer user can only access their own customer data.

    Administrators are permitted to access any customer data.
    """
    if current_user.is_admin:
        return
    if current_user.customer_id != customer_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot access another customer's data",
        )

