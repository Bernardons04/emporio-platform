from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.rag import router as rag_router
from app.api.chat import router as chat_router
from app.api.products import router as products_router
from app.api.promotions import router as promotions_router
from app.api.admin_chat import router as admin_chat_router

app = FastAPI(
    title="Empório da Música API",
    description="AI-powered customer support platform for Empório da Música.",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(rag_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(products_router)
app.include_router(promotions_router)
app.include_router(admin_chat_router)
