"""Admin endpoints for Conversations review and Support Tickets inbox."""

import logging
import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import get_current_admin_user, get_db
from app.models.conversation import Conversation, Message
from app.models.support import SupportTicket
from app.models.user import User
from app.schemas.admin_chat import (
    AdminConversationDetail,
    AdminConversationListResponse,
    AdminConversationSummary,
    AdminSupportTicketDetail,
    AdminSupportTicketListResponse,
    AdminSupportTicketResponse,
    AdminUserSummary,
    SupportTicketStatusUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["Admin — Conversations & Support"])


def _format_protocol(ticket_id: uuid.UUID) -> str:
    return f"TICK-{str(ticket_id)[:8].upper()}"


# ── Conversations ─────────────────────────────────────────────────────────────


@router.get(
    "/conversations",
    response_model=AdminConversationListResponse,
    summary="List customer conversations (Admin)",
)
def list_conversations(
    search: str | None = Query(None, description="Search by title, customer name or email"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Lists conversations with user profile, message count, and last interaction."""
    stmt = (
        select(Conversation)
        .options(
            joinedload(Conversation.user),
            selectinload(Conversation.messages),
            selectinload(Conversation.support_tickets),
        )
        .order_by(Conversation.updated_at.desc())
    )

    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.join(User, User.id == Conversation.user_id).where(
            or_(
                Conversation.title.ilike(term),
                User.name.ilike(term),
                User.email.ilike(term),
            )
        )

    # Total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = db.execute(count_stmt).scalar_one()

    # Pagination
    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)
    conversations = db.execute(stmt).scalars().all()

    total_pages = math.ceil(total / page_size) if total > 0 else 1

    items: list[AdminConversationSummary] = []
    for c in conversations:
        msgs = sorted(c.messages, key=lambda m: m.created_at)
        last_msg = msgs[-1].content if msgs else None

        # Derive title from existing title or first user message
        derived_title = c.title
        if not derived_title:
            first_user_msg = next((m.content for m in msgs if m.role == "user"), None)
            if first_user_msg:
                derived_title = first_user_msg[:80] + ("..." if len(first_user_msg) > 80 else "")
            else:
                derived_title = "Conversa sem mensagens"

        items.append(
            AdminConversationSummary(
                id=c.id,
                user_id=c.user_id,
                user=AdminUserSummary.model_validate(c.user),
                title=derived_title,
                created_at=c.created_at,
                updated_at=c.updated_at,
                message_count=len(msgs),
                last_message=last_msg,
                has_support_ticket=len(c.support_tickets) > 0,
            )
        )

    return AdminConversationListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/conversations/{conversation_id}",
    response_model=AdminConversationDetail,
    summary="Get conversation detail with messages and events (Admin)",
)
def get_conversation_detail(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Returns conversation details with full message history and tool events."""
    stmt = (
        select(Conversation)
        .options(
            joinedload(Conversation.user),
            selectinload(Conversation.messages).selectinload(Message.events),
        )
        .where(Conversation.id == conversation_id)
    )
    conv = db.execute(stmt).scalar_one_or_none()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation {conversation_id} not found.",
        )

    # Ensure chronological message ordering
    conv.messages = sorted(conv.messages, key=lambda m: m.created_at)
    for m in conv.messages:
        m.events = sorted(m.events, key=lambda e: e.sequence)

    return conv


# ── Support Tickets ───────────────────────────────────────────────────────────


@router.get(
    "/support-tickets",
    response_model=AdminSupportTicketListResponse,
    summary="List support tickets (Admin Inbox)",
)
def list_support_tickets(
    status_filter: str | None = Query(None, pattern=r"^(pending|in_progress|resolved|closed)$", description="Filter by status"),
    search: str | None = Query(None, description="Search by reason, customer name or email"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Lists support tickets for the administrative Support Inbox."""
    stmt = (
        select(SupportTicket)
        .options(joinedload(SupportTicket.user))
        .order_by(SupportTicket.created_at.desc())
    )

    if status_filter:
        stmt = stmt.where(SupportTicket.status == status_filter)

    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.join(User, User.id == SupportTicket.user_id).where(
            or_(
                SupportTicket.reason.ilike(term),
                User.name.ilike(term),
                User.email.ilike(term),
            )
        )

    # Total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = db.execute(count_stmt).scalar_one()

    # Pagination
    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)
    tickets = db.execute(stmt).scalars().all()

    total_pages = math.ceil(total / page_size) if total > 0 else 1

    items: list[AdminSupportTicketResponse] = []
    for t in tickets:
        items.append(
            AdminSupportTicketResponse(
                id=t.id,
                protocol=_format_protocol(t.id),
                user_id=t.user_id,
                user=AdminUserSummary.model_validate(t.user),
                conversation_id=t.conversation_id,
                reason=t.reason,
                status=t.status,
                created_at=t.created_at,
                updated_at=t.updated_at,
            )
        )

    return AdminSupportTicketListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/support-tickets/{ticket_id}",
    response_model=AdminSupportTicketDetail,
    summary="Get support ticket details with conversation history (Admin)",
)
def get_support_ticket_detail(
    ticket_id: uuid.UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Returns ticket details and associated conversation context."""
    stmt = (
        select(SupportTicket)
        .options(
            joinedload(SupportTicket.user),
            selectinload(SupportTicket.conversation)
            .joinedload(Conversation.user),
            selectinload(SupportTicket.conversation)
            .selectinload(Conversation.messages)
            .selectinload(Message.events),
        )
        .where(SupportTicket.id == ticket_id)
    )
    ticket = db.execute(stmt).scalar_one_or_none()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Support ticket {ticket_id} not found.",
        )

    conv_detail = None
    if ticket.conversation:
        c = ticket.conversation
        c.messages = sorted(c.messages, key=lambda m: m.created_at)
        for m in c.messages:
            m.events = sorted(m.events, key=lambda e: e.sequence)

        conv_detail = AdminConversationDetail(
            id=c.id,
            user_id=c.user_id,
            user=AdminUserSummary.model_validate(c.user),
            title=c.title,
            created_at=c.created_at,
            updated_at=c.updated_at,
            messages=c.messages,
        )

    return AdminSupportTicketDetail(
        id=ticket.id,
        protocol=_format_protocol(ticket.id),
        user_id=ticket.user_id,
        user=AdminUserSummary.model_validate(ticket.user),
        conversation_id=ticket.conversation_id,
        reason=ticket.reason,
        status=ticket.status,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        conversation=conv_detail,
    )


@router.patch(
    "/support-tickets/{ticket_id}/status",
    response_model=AdminSupportTicketResponse,
    summary="Update support ticket status (Admin)",
)
def update_support_ticket_status(
    ticket_id: uuid.UUID,
    data: SupportTicketStatusUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Updates ticket status (e.g. pending -> in_progress -> resolved -> closed, or reopening)."""
    ticket = db.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Support ticket {ticket_id} not found.",
        )

    old_status = ticket.status
    ticket.status = data.status
    db.commit()
    db.refresh(ticket)

    logger.info(
        "Admin %s updated ticket %s status: %s -> %s",
        admin.email,
        ticket_id,
        old_status,
        data.status,
    )

    return AdminSupportTicketResponse(
        id=ticket.id,
        protocol=_format_protocol(ticket.id),
        user_id=ticket.user_id,
        user=AdminUserSummary.model_validate(ticket.user),
        conversation_id=ticket.conversation_id,
        reason=ticket.reason,
        status=ticket.status,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )
