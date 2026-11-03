"""Pydantic schemas for Conversation and Message management."""

from datetime import datetime
from typing import Any
import uuid
from pydantic import BaseModel, Field


class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, max_length=500, description="Optional title for the conversation")


class ConversationResponse(BaseModel):
    id: uuid.UUID
    title: str | None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    last_message: str | None = None

    class Config:
        from_attributes = True


class MessageEventResponse(BaseModel):
    id: uuid.UUID
    event_type: str
    sequence: int
    payload: dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: datetime
    events: list[MessageEventResponse] = []

    class Config:
        from_attributes = True


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000, description="User question or prompt to the assistant")


class SendMessageResponse(BaseModel):
    user_message: MessageResponse
    assistant_message: MessageResponse
    events: list[MessageEventResponse] = []

