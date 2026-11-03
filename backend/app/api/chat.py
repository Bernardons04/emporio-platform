"""Chat and conversation endpoints for the Empório da Música customer support platform."""

import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.agent.graph import run_agent_turn
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.conversation import Conversation, Message
from app.models.user import User
from app.schemas.chat import (
    ConversationCreate,
    ConversationResponse,
    MessageEventResponse,
    MessageResponse,
    SendMessageRequest,
    SendMessageResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["Conversations & AI Chat"])


@router.get(
    "/conversations",
    response_model=list[ConversationResponse],
    summary="List user conversations",
)
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists conversations belonging to the authenticated customer (or all if admin)."""
    query = db.query(Conversation)
    if not current_user.is_admin:
        query = query.filter(Conversation.user_id == current_user.id)

    conversations = query.order_by(Conversation.updated_at.desc()).all()

    results = []
    for conv in conversations:
        last_msg = (
            db.query(Message)
            .filter(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc())
            .first()
        )
        msg_count = db.query(Message).filter(Message.conversation_id == conv.id).count()

        results.append(
            ConversationResponse(
                id=conv.id,
                title=conv.title or "Nova Conversa",
                created_at=conv.created_at,
                updated_at=conv.updated_at,
                message_count=msg_count,
                last_message=last_msg.content[:80] if last_msg else None,
            )
        )

    return results


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new conversation",
)
def create_conversation(
    payload: ConversationCreate | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Initializes a new customer support conversation."""
    title = payload.title if payload and payload.title else "Nova Conversa"
    conv = Conversation(
        id=uuid.uuid4(),
        user_id=current_user.id,
        title=title,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)

    return ConversationResponse(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=0,
        last_message=None,
    )


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[MessageResponse],
    summary="Get conversation message history",
)
def get_conversation_messages(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieves full message history with execution events for a conversation."""
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    if not current_user.is_admin and conv.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have access to this conversation",
        )

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )

    return messages


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=SendMessageResponse,
    summary="Send message to AI assistant",
)
def send_message_to_assistant(
    conversation_id: uuid.UUID,
    payload: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sends a user query to the LangGraph AI Assistant.

    Runs tools (product search, RAG policies, customer orders, promotions, escalation),
    persists messages and tool events, and returns the response.
    """
    try:
        assistant_msg, events = run_agent_turn(
            db=db,
            conversation_id=conversation_id,
            user_message_content=payload.content,
            current_user=current_user,
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have access to this conversation",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("Error executing agent turn: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao processar atendimento com o assistente: {str(e)}",
        )

    # Retrieve newly added user message (penultimate message)
    user_msg = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id, Message.role == "user")
        .order_by(Message.created_at.desc())
        .first()
    )

    return SendMessageResponse(
        user_message=MessageResponse.model_validate(user_msg),
        assistant_message=MessageResponse.model_validate(assistant_msg),
        events=[MessageEventResponse.model_validate(ev) for ev in events],
    )
