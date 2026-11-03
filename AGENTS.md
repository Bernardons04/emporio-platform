 # AGENTS.md

# Emporio Platform — Project Guidelines

## 1. Project Overview

Emporio Platform is an AI-powered customer support platform developed as a technical challenge for an AI Engineer position at Artefact.

The application is designed for **Empório da Música**, a fictional musical instrument store located in Campo Grande, Brazil.

The platform provides a conversational AI assistant that helps customers with product inquiries, inventory, orders, store policies, and other supported topics. It also includes an administrative panel for managing the platform and handling human support requests.

The project aims to demonstrate practical skills in full-stack development, AI agents, LLM integration, RAG, structured data retrieval, and application architecture.

This is a technical challenge with a defined scope and deadline. Prioritize working functionality, clear architecture, and maintainable code over unnecessary complexity.

### Language Conventions

- Code, variable names, comments, and technical documentation must be written in English.
- The customer-facing assistant must communicate naturally in Brazilian Portuguese.
- All user-facing frontend text must be written in Brazilian Portuguese (pt-BR).
- README and project documentation must be written in English.

---

## 2. Technology Stack & Architecture

Use the following technologies:

**Frontend**
- Next.js
- TypeScript
- Tailwind CSS

**Backend**
- Python
- FastAPI
- SQLAlchemy
- Alembic

**AI**
- LangChain
- LangGraph
- OpenRouter for LLM and embedding model access.

**Database and Infrastructure**
- PostgreSQL
- pgvector
- Docker
- Docker Compose
- NeonDB as the planned managed PostgreSQL provider.

### Architecture Guidelines

Maintain a clear separation of responsibilities:

- Frontend: user interface and interaction with backend APIs.
- Backend: API endpoints, authentication, authorization, business logic, and database access.
- AI Agent: conversational orchestration, tool selection, retrieval, and response generation.
- Database: persistent storage and source of truth for structured application data and document retrieval.

PostgreSQL is the source of truth for application data. Use SQLAlchemy for database operations and Alembic for schema migrations.

Keep the architecture straightforward. Avoid unnecessary abstraction layers, premature optimization, and excessive modularization.

---

## 3. Core Technical Guidelines

### 3.1 Authentication and Security

The application has two user types: customers and administrators.

Use a boolean `is_admin` field to distinguish administrators from regular customers.

- Public registration must only create regular customer accounts.
- Administrator accounts must be provisioned through a controlled process.
- Passwords must be securely hashed using Argon2.
- Use HTTP-only session cookies for authentication.
- Enforce authentication and authorization in the backend, never relying exclusively on frontend protection.
- Customers must only access their own conversations and orders.
- Order retrieval must verify ownership using the authenticated user's identity.
- Never expose secrets, API keys, or sensitive customer information.

### 3.2 AI Agent

Use LangChain for LLM integration and tool definitions, and LangGraph for agent orchestration.

Keep the agent workflow simple and appropriate for the project.

The assistant must:

- Communicate in friendly, professional Brazilian Portuguese.
- Answer using only authorized store information and available application data.
- Use structured database tools for products, inventory, promotions, and orders.
- Use RAG for store policies and document-based information.
- Acknowledge insufficient evidence instead of fabricating answers.
- Politely decline unrelated requests.
- Escalate appropriate requests to human support.

Tool descriptions must clearly explain their purpose, parameters, restrictions, and expected behavior.

Implement deterministic business rules in Python rather than relying on LLM calculations whenever possible.

Examples include payment calculations, discounts, promotion validation, and return eligibility.

Never use RAG or embeddings for information that should be retrieved directly from structured database records, such as product prices, inventory, and order status.

### 3.3 RAG and Knowledge Base

Use a hybrid retrieval approach combining semantic search and keyword-based retrieval.

Use OpenRouter for embeddings with `openai/text-embedding-3-small`, subject to endpoint compatibility.

Store document chunks and embeddings in PostgreSQL using pgvector.

Preserve relevant document metadata, such as page numbers and sections, to support source references in assistant responses.

Document processing should initially be synchronous.

Avoid introducing unnecessary retrieval components or infrastructure.

### 3.4 Frontend Guidelines

Use a server-first approach with Next.js.

- Prefer React Server Components whenever possible.
- Use Client Components only when browser-side interactivity requires them.
- Prefer native browser capabilities and straightforward API integration.
- Use TypeScript consistently.
- Keep components reusable when appropriate, without creating unnecessary abstractions.

The application must include:

**Customer Chat**
- A sidebar containing the customer's conversations.
- Ability to start new conversations and reopen previous ones.
- Main conversational interface.

**Administrative Panel**
- Persistent navigation sidebar.
- Product management with CRUD operations.
- Promotion listing and filtering (read-only).
- Conversation history displayed in a table, with a modal for viewing complete conversations.
- Simple Support Inbox for viewing human intervention requests generated by the AI assistant.
- Informational Knowledge Base page describing the store's policy documents.

The Support Inbox must remain lightweight. It is not intended to be a full help desk or ticket management platform.

Maintain a consistent visual identity for Empório da Música.

### 3.5 Code Quality

Prioritize:

- Readability and maintainability.
- Clear naming conventions.
- Separation of responsibilities.
- Appropriate error handling.
- Secure defaults.
- Simple and practical solutions.

Avoid:

- Overengineering.
- Premature abstractions.
- Unnecessary dependencies.
- Excessive file fragmentation.
- Duplicated business logic.
- Hardcoded secrets or credentials.

Do not introduce new major dependencies or change established architectural decisions without approval.

---

## 4. Development Roadmap

Development must follow the agreed phases.

Only work on the phase and tasks explicitly requested by the user. Do not start future phases or implement unrelated features without approval.

### Phase 1 — Project Preparation

- Establish project instructions.
- Configure `.gitignore`.
- Create `.env.example`.
- Prepare the README structure.
- Establish project conventions and initial folder organization.

### Phase 2 — Infrastructure and Database

- Configure Docker and Docker Compose.
- Set up the FastAPI application.
- Configure PostgreSQL and pgvector.
- Configure SQLAlchemy and Alembic.
- Create the initial database models and migrations.
- Establish environment configuration.

### Phase 3 — Initial Data Import

- Implement CSV ingestion.
- Validate and import the supplied datasets.
- Ensure idempotent imports.
- Prepare the initial policy document ingestion.
- Track document processing and indexing status.

### Phase 4 — Authentication and Authorization

- Implement customer registration.
- Implement login and logout.
- Configure secure HTTP-only sessions.
- Implement password hashing.
- Protect backend endpoints.
- Enforce customer and administrator permissions.

### Phase 5 — Frontend and Layouts

- Implement the authentication interface.
- Create the customer chat layout and conversation sidebar.
- Create the administrative layout and navigation sidebar.
- Implement shared UI components.
- Ensure responsive behavior.

### Phase 6 — Knowledge Base and RAG

- Extract text from PDF documents.
- Implement document chunking.
- Generate embeddings through OpenRouter.
- Store document chunks and vectors in PostgreSQL.
- Implement hybrid retrieval.
- Return relevant source references.

### Phase 7 — AI Agent

- Implement the LangGraph workflow.
- Configure the assistant's system instructions and persona.
- Implement structured database tools.
- Implement policy retrieval tools.
- Implement deterministic business rules.
- Implement human escalation.
- Handle insufficient evidence and out-of-scope questions.

### Phase 8 — Administrative Features

- Implement product CRUD operations.
- Implement read-only promotion listing and filtering.
- Implement conversation history.
- Implement a lightweight Support Inbox for human intervention requests.
- Provide an informational Knowledge Base page about the store's policy documents.

### Phase 9 — Integration and Manual Validation

- Run and verify the complete application.
- Validate the main customer and administrative workflows.
- Verify authentication, authorization, and customer data isolation.
- Validate agent responses, tool usage, policy retrieval, and human escalation.
- Identify and fix issues discovered during manual validation.

Do not create automated test suites as part of this phase.

### Phase 10 — Documentation and Delivery

- Complete the README in English.
- Document setup and execution instructions.
- Explain architecture and technical decisions.
- Document known limitations and data inconsistencies.
- Include three to five representative conversation examples.
- Explain the AI tools used during development.
- Prepare deployment if time permits.
- Review the repository before final submission.


## 5. Development Workflow

### Incremental Implementation

- Implement only what is explicitly requested.
- Inspect the existing project structure before making changes.
- Avoid unnecessary modifications to existing code.
- Do not implement the entire application in a single operation.
- Prefer small, focused implementation steps.

### Dependencies and Architecture

- Reuse existing dependencies whenever possible.
- Do not introduce new dependencies without a clear technical reason.
- Do not change the agreed technology stack or architectural decisions without explaining the reason and requesting approval.
- If a technical obstacle requires changing an established decision, present the problem and proposed alternative before proceeding.

### Validation

Automated tests are not part of the development workflow.

Prioritize manual validation of implemented functionality. Do not create automated test suites or introduce testing infrastructure unless explicitly requested.

Never claim that functionality was tested if it was not actually executed and validated.

### Task Reporting

At the end of each requested task:

1. Summarize what was implemented.
2. List relevant files created or modified.
3. Explain important technical decisions.
4. Mention known limitations or unresolved issues.
5. Report manual validation performed, if any.
6. Identify the next logical task without starting it automatically.

### User Approval

The user makes the final product and architectural decisions.

Do not interpret suggestions or identified improvements as authorization to implement them.

Always wait for explicit instructions before moving to another task or development phase.