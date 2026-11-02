"""Authentication API endpoints: registration, login, logout, and current user profile."""

from datetime import datetime, timedelta, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user, get_current_user
from app.core.config import settings
from app.core.security import (
    generate_session_token,
    hash_password,
    hash_session_token,
    verify_password,
)
from app.db.session import get_db
from app.models.customer import Customer
from app.models.user import Session as DbSession, User
from app.schemas.auth import MessageResponse, UserLogin, UserRegister, UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def _set_session_cookie(response: Response, raw_token: str) -> None:
    """Sets the secure HTTP-only session cookie on the response."""
    max_age_seconds = settings.session_max_age_days * 86400
    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_token,
        max_age=max_age_seconds,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        path="/",
    )


def _create_user_session(db: Session, user: User, response: Response) -> DbSession:
    """Creates a new database-backed session and sets the HTTP-only cookie."""
    raw_token = generate_session_token()
    token_hash = hash_session_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.session_max_age_days)

    db_session = DbSession(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(db_session)
    db.commit()

    _set_session_cookie(response, raw_token)
    return db_session


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new customer account",
)
def register(
    data: UserRegister,
    response: Response,
    db: Session = Depends(get_db),
):
    """Registers a new customer. Always creates non-admin accounts.

    Associates with an existing customer record if an unlinked record with
    matching email exists, or creates a new customer profile.
    """
    normalized_email = data.email.strip().lower()

    # Reject duplicate user emails
    stmt = select(User).where(User.email == normalized_email)
    if db.execute(stmt).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    # Check for existing customer profile to associate
    cust_stmt = select(Customer).where(Customer.email.ilike(normalized_email))
    matching_customers = db.execute(cust_stmt).scalars().all()

    target_customer_id: int | None = None
    for cust in matching_customers:
        # Check if customer record is not already linked to another user
        linked_user_stmt = select(User).where(User.customer_id == cust.customer_id)
        if not db.execute(linked_user_stmt).scalar_one_or_none():
            target_customer_id = cust.customer_id
            break

    # If no existing unlinked customer record, create a new customer record
    if target_customer_id is None:
        # Determine next customer_id
        from sqlalchemy import func
        max_id = db.execute(select(func.coalesce(func.max(Customer.customer_id), 0))).scalar_one()
        new_customer = Customer(
            customer_id=max_id + 1,
            name=data.name.strip(),
            email=normalized_email,
        )
        db.add(new_customer)
        db.flush()
        target_customer_id = new_customer.customer_id

    # Create new customer user (ALWAYS is_admin=False for public registration)
    new_user = User(
        name=data.name.strip(),
        email=normalized_email,
        password_hash=hash_password(data.password),
        is_admin=False,
        customer_id=target_customer_id,
    )
    db.add(new_user)
    db.flush()

    # Create session and set cookie
    _create_user_session(db, new_user, response)

    logger.info("New user registered: %s (customer_id: %s)", new_user.email, new_user.customer_id)
    return new_user


@router.post(
    "/login",
    response_model=UserResponse,
    summary="Authenticate and establish session",
)
def login(
    data: UserLogin,
    response: Response,
    db: Session = Depends(get_db),
):
    """Authenticates with email and password, establishing an HTTP-only session."""
    normalized_email = data.email.strip().lower()

    stmt = select(User).where(User.email == normalized_email)
    user = db.execute(stmt).scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    _create_user_session(db, user, response)
    logger.info("User logged in: %s (is_admin: %s)", user.email, user.is_admin)
    return user


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Invalidate session and clear cookie",
)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Invalidates the database session and clears the session cookie."""
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        token_hash = hash_session_token(token)
        stmt = select(DbSession).where(DbSession.token_hash == token_hash)
        db_session = db.execute(stmt).scalar_one_or_none()
        if db_session:
            db.delete(db_session)
            db.commit()

    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
    )
    return MessageResponse(message="Logged out successfully.")


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile",
)
def get_me(
    current_user: User = Depends(get_current_user),
):
    """Returns profile information for the currently authenticated user."""
    return current_user


@router.get(
    "/admin-check",
    response_model=MessageResponse,
    summary="Admin-only authorization test",
)
def admin_check(
    admin_user: User = Depends(get_current_admin_user),
):
    """Protected endpoint requiring administrator privileges."""
    return MessageResponse(message=f"Welcome Admin {admin_user.name}!")
