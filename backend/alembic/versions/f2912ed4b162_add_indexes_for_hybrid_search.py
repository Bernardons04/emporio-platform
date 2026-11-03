"""add_indexes_for_hybrid_search

Revision ID: f2912ed4b162
Revises: 54774f078c30
Create Date: 2026-11-03 00:45:48.394152

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2912ed4b162'
down_revision: Union[str, None] = '54774f078c30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Full-text search GIN index on document_chunks (portuguese text search configuration)
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_document_chunks_content_fts
        ON document_chunks
        USING gin(to_tsvector('portuguese', content));
        """
    )

    # 2. HNSW index for pgvector cosine distance on embedding column
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_document_chunks_embedding_hnsw
        ON document_chunks
        USING hnsw (embedding vector_cosine_ops);
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_document_chunks_embedding_hnsw;")
    op.execute("DROP INDEX IF EXISTS ix_document_chunks_content_fts;")
