from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyUrl


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    secret_key: str
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"

    # Database
    database_url: str

    # OpenRouter
    openrouter_api_key: str = ""
    openrouter_model: str = ""
    openrouter_embedding_model: str = "openai/text-embedding-3-small"

    # Authentication
    session_cookie_name: str = "emporio_session"
    session_cookie_secure: bool = False
    session_cookie_samesite: str = "lax"
    session_max_age_days: int = 7

    # Document Processing
    max_upload_size_mb: int = 10


settings = Settings()
