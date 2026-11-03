"""Embedding client for OpenRouter API.

Uses openai/text-embedding-3-small (1536 dimensions) to generate vector embeddings.
Strictly requires a valid OpenRouter API key. Never generates synthetic or fake embeddings.
"""

import logging
import time
from typing import Sequence

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

OPENROUTER_EMBEDDING_URL = "https://openrouter.ai/api/v1/embeddings"
DEFAULT_EMBEDDING_DIM = 1536


class EmbeddingError(Exception):
    """Raised when embedding generation fails."""
    pass


class MissingApiKeyError(EmbeddingError):
    """Raised when OpenRouter API key is missing, empty, or a placeholder."""
    pass


class OpenRouterEmbeddingClient:
    """Client for generating text embeddings using OpenRouter API."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        timeout: float = 30.0,
        max_retries: int = 3,
    ) -> None:
        self.api_key = api_key if api_key is not None else settings.openrouter_api_key
        self.model = model or settings.openrouter_embedding_model or "openai/text-embedding-3-small"
        self.timeout = timeout
        self.max_retries = max_retries

    @property
    def is_configured(self) -> bool:
        """Checks if the client has a potentially valid OpenRouter API key."""
        if not self.api_key:
            return False
        stripped = self.api_key.strip()
        if stripped.startswith("your_") or "replace" in stripped.lower():
            return False
        return len(stripped) > 10

    def get_embedding(self, text: str) -> list[float]:
        """Generates embedding for a single string.
        
        Raises:
            MissingApiKeyError: If API key is missing or placeholder.
            EmbeddingError: If API call fails.
        """
        results = self.get_embeddings([text])
        return results[0]

    def get_embeddings(self, texts: Sequence[str]) -> list[list[float]]:
        """Generates embeddings for a batch of strings via OpenRouter.

        Raises:
            MissingApiKeyError: If API key is not configured or is a placeholder.
            EmbeddingError: If API request fails after retries.
        """
        if not texts:
            return []

        if not self.is_configured:
            raise MissingApiKeyError(
                "OpenRouter API key is not configured or contains placeholder. "
                "Configure a valid OPENROUTER_API_KEY in .env before generating embeddings."
            )

        cleaned_texts = [t.strip().replace("\n", " ") for t in texts]

        headers = {
            "Authorization": f"Bearer {self.api_key.strip()}",
            "Content-Type": "application/json",
            "HTTP-Referer": settings.backend_url,
            "X-Title": "Emporio da Musica Support Platform",
        }

        payload = {
            "model": self.model,
            "input": cleaned_texts,
        }

        last_error: Exception | None = None

        for attempt in range(1, self.max_retries + 1):
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    response = client.post(
                        OPENROUTER_EMBEDDING_URL,
                        headers=headers,
                        json=payload,
                    )

                if response.status_code == 200:
                    data = response.json()
                    items = data.get("data", [])
                    sorted_items = sorted(items, key=lambda x: x.get("index", 0))
                    embeddings = [item["embedding"] for item in sorted_items]

                    # Verify expected dimensions
                    for idx, emb in enumerate(embeddings):
                        if len(emb) != DEFAULT_EMBEDDING_DIM:
                            raise EmbeddingError(
                                f"Unexpected embedding dimension: got {len(emb)}, expected {DEFAULT_EMBEDDING_DIM}"
                            )

                    return embeddings

                elif response.status_code == 429:
                    wait_time = 2.0 ** attempt
                    logger.warning(
                        "OpenRouter rate limit hit (429). Retrying in %.1f seconds...",
                        wait_time,
                    )
                    time.sleep(wait_time)
                    continue

                elif response.status_code in (401, 403):
                    err_body = response.text
                    logger.error(
                        "OpenRouter authentication failed (%d): %s",
                        response.status_code,
                        err_body,
                    )
                    raise EmbeddingError(
                        f"OpenRouter authentication failed ({response.status_code}): {err_body}"
                    )
                else:
                    err_body = response.text
                    logger.warning(
                        "OpenRouter embedding error (%d, attempt %d/%d): %s",
                        response.status_code,
                        attempt,
                        self.max_retries,
                        err_body,
                    )
                    time.sleep(1.0 * attempt)

            except httpx.RequestError as exc:
                last_error = exc
                logger.warning(
                    "Network error connecting to OpenRouter (attempt %d/%d): %s",
                    attempt,
                    self.max_retries,
                    exc,
                )
                time.sleep(1.0 * attempt)

        raise EmbeddingError(
            f"Failed to generate embeddings after {self.max_retries} attempts: {last_error}"
        )
