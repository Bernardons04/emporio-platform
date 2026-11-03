"""LangGraph agent workflow and orchestration for Empório da Música.

Implements a deterministic state machine:
  START -> agent_node -> (tools_condition: has_tool_calls -> tools_node -> agent_node | END)

Maintains full event recording into PostgreSQL `message_events` table
and enforces context-bound session security.
"""

from collections.abc import Sequence
import json
import logging
from typing import Annotated, Any, TypedDict
import uuid

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from sqlalchemy.orm import Session

from app.agent.prompts import ASSISTANT_SYSTEM_PROMPT
from app.agent.tools import create_agent_tools
from app.core.config import settings
from app.models.conversation import Conversation, Message, MessageEvent
from app.models.user import User

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Agent State Definition
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    """The graph state representing conversation context and message trace."""
    messages: Annotated[Sequence[BaseMessage], add_messages]
    events: list[dict[str, Any]]


# ---------------------------------------------------------------------------
# Workflow Builder
# ---------------------------------------------------------------------------

def create_agent_graph(
    db: Session,
    current_user: User,
    conversation_id: uuid.UUID,
):
    """Builds a compiled LangGraph workflow instance bound to the active user context."""
    tools = create_agent_tools(db=db, current_user=current_user, conversation_id=conversation_id)
    tools_by_name = {tool.name: tool for tool in tools}

    # Initialize OpenRouter Chat model using OpenAI-compatible interface
    # Setting max_tokens ensures credit limit is respected
    llm = ChatOpenAI(
        model=settings.openrouter_model or "google/gemini-2.5-flash",
        api_key=settings.openrouter_api_key,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.2,
        max_tokens=1000,
        default_headers={
            "HTTP-Referer": settings.backend_url,
            "X-Title": "Emporio da Musica Support Platform",
        },
    )

    llm_with_tools = llm.bind_tools(tools)

    def agent_node(state: AgentState) -> dict[str, Any]:
        """Invokes the LLM with system prompt, history, and available tools."""
        messages = state["messages"]

        # Ensure system prompt is present as first message
        if not messages or not isinstance(messages[0], SystemMessage):
            full_messages = [SystemMessage(content=ASSISTANT_SYSTEM_PROMPT)] + list(messages)
        else:
            full_messages = list(messages)

        response = llm_with_tools.invoke(full_messages)
        return {"messages": [response]}

    def tools_node(state: AgentState) -> dict[str, Any]:
        """Executes tool calls requested by the model and records structured events."""
        messages = state["messages"]
        last_message = messages[-1]
        tool_messages = []
        new_events = list(state.get("events", []))

        if isinstance(last_message, AIMessage) and last_message.tool_calls:
            for call in last_message.tool_calls:
                tool_name = call["name"]
                tool_args = call["args"]
                call_id = call["id"]

                # Log tool invocation event
                new_events.append(
                    {
                        "event_type": "tool_start",
                        "tool_name": tool_name,
                        "tool_args": tool_args,
                        "tool_call_id": call_id,
                    }
                )

                if tool_name in tools_by_name:
                    selected_tool = tools_by_name[tool_name]
                    try:
                        raw_result = selected_tool.invoke(tool_args)
                        result_str = str(raw_result)
                    except Exception as e:
                        logger.exception("Error executing tool %s: %s", tool_name, e)
                        result_str = json.dumps({"error": f"Erro ao executar a ferramenta {tool_name}: {str(e)}"})

                    new_events.append(
                        {
                            "event_type": "tool_end",
                            "tool_name": tool_name,
                            "tool_output": result_str,
                            "tool_call_id": call_id,
                        }
                    )
                else:
                    result_str = json.dumps({"error": f"Ferramenta '{tool_name}' não existe."})

                tool_messages.append(
                    ToolMessage(
                        content=result_str,
                        name=tool_name,
                        tool_call_id=call_id,
                    )
                )

        return {"messages": tool_messages, "events": new_events}

    def should_continue(state: AgentState):
        """Routes to tools if the LLM emitted tool calls, or END if final answer."""
        last_message = state["messages"][-1]
        if isinstance(last_message, AIMessage) and last_message.tool_calls:
            return "tools"
        return END

    # Build Graph
    workflow = StateGraph(AgentState)
    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", tools_node)

    workflow.add_edge(START, "agent")
    workflow.add_conditional_edges("agent", should_continue, ["tools", END])
    workflow.add_edge("tools", "agent")

    return workflow.compile()


# ---------------------------------------------------------------------------
# Runner & Database Persistence Service
# ---------------------------------------------------------------------------

def run_agent_turn(
    db: Session,
    conversation_id: uuid.UUID,
    user_message_content: str,
    current_user: User,
) -> tuple[Message, list[MessageEvent]]:
    """Runs a single conversational turn with the LangGraph agent:

    1. Loads existing conversation history from PostgreSQL
    2. Persists the incoming User message to `messages`
    3. Runs LangGraph state machine with tools
    4. Persists the final Assistant message to `messages`
    5. Persists all tool execution events to `message_events`
    """
    # 1. Fetch conversation and verify ownership
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise ValueError(f"Conversation {conversation_id} not found.")

    if not current_user.is_admin and conv.user_id != current_user.id:
        raise PermissionError("Access denied: You do not own this conversation.")

    # 2. Persist user message
    user_msg_db = Message(
        id=uuid.uuid4(),
        conversation_id=conversation_id,
        role="user",
        content=user_message_content.strip(),
    )
    db.add(user_msg_db)
    db.flush()

    # 3. Reconstruct LangChain history from DB
    existing_messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )

    history: list[BaseMessage] = [SystemMessage(content=ASSISTANT_SYSTEM_PROMPT)]
    for m in existing_messages:
        if m.role == "user":
            history.append(HumanMessage(content=m.content))
        elif m.role == "assistant":
            history.append(AIMessage(content=m.content))

    # 4. Compile and execute graph
    graph = create_agent_graph(db=db, current_user=current_user, conversation_id=conversation_id)

    initial_state: AgentState = {
        "messages": history,
        "events": [],
    }

    final_state = graph.invoke(initial_state)

    # 5. Extract final assistant response
    final_messages = final_state["messages"]
    last_assistant_text = ""
    for msg in reversed(final_messages):
        if isinstance(msg, AIMessage) and msg.content:
            last_assistant_text = msg.content
            break

    if not last_assistant_text:
        last_assistant_text = "Desculpe, não consegui processar uma resposta no momento. Por favor, tente novamente."

    assistant_msg_db = Message(
        id=uuid.uuid4(),
        conversation_id=conversation_id,
        role="assistant",
        content=last_assistant_text,
    )
    db.add(assistant_msg_db)
    db.flush()

    # Update conversation title if first message
    if not conv.title or conv.title == "Nova Conversa":
        # Generate simple title from user message
        conv.title = user_message_content[:45].strip()

    # 6. Persist structured message events
    saved_events: list[MessageEvent] = []
    events_data = final_state.get("events", [])
    for seq, ev in enumerate(events_data, start=1):
        db_event = MessageEvent(
            id=uuid.uuid4(),
            message_id=assistant_msg_db.id,
            event_type=ev.get("event_type", "tool_event"),
            sequence=seq,
            payload=ev,
        )
        db.add(db_event)
        saved_events.append(db_event)

    db.commit()
    return assistant_msg_db, saved_events

