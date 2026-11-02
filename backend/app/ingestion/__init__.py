"""Data ingestion package for Emporio Platform."""

from app.ingestion.csv_ingestion import ingest_csv_data
from app.ingestion.document_ingestion import ingest_policy_documents

__all__ = ["ingest_csv_data", "ingest_policy_documents"]

