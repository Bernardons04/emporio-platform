"""Schemas for Admin Conversations and Support Tickets management."""

from datetime import datetime
from typing import Any
import uuid
from pydantic import BaseModel, ConfigDict, Field


# ── Common user/customer summary ──────────────────────────────────────────────


class AdminUserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    is_admin: bool
    customer_id: int | None = None


# ── Admin Conversations schemas ───────────────────────────────────────────────


class AdminMessageEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_type: str
    sequence: int
    payload: dict[str, Any]
    created_at: datetime


class AdminMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: str
    content: str
    created_at: datetime
    events: list[AdminMessageEventResponse] = []


class AdminConversationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    user: AdminUserSummary
    title: str | None = None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    last_message: str | None = None
    has_support_ticket: bool = False


class AdminConversationDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    user: AdminUserSummary
    title: str | None = None
    created_at: datetime
    updated_at: datetime
    messages: list[AdminMessageResponse] = []


class AdminConversationListResponse(BaseModel):
    items: list[AdminConversationSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


# ── Admin Support Tickets schemas ─────────────────────────────────────────────


class SupportTicketStatusUpdate(BaseModel):
    status: str = Field(..., pattern=r"^(pending|in_progress|resolved|closed)$")


class AdminSupportTicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    protocol: str
    user_id: uuid.UUID
    user: AdminUserSummary
    conversation_id: uuid.UUID
    reason: str
    status: str
    created_at: datetime
    updated_at: datetime


class AdminSupportTicketDetail(AdminSupportTicketResponse):
    conversation: AdminConversationDetail | None = None


class AdminSupportTicketListResponse(BaseModel):
    items: list[AdminSupportTicketResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

