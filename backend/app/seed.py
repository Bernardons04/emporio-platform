"""Data seeding and initial ingestion entrypoint for Empório da Música.

Can be run from command line:
    python -m app.seed
    python -m app.seed --csv-only
    python -m app.seed --docs-only
    python -m app.seed --force-docs
"""

import argparse
import logging
import sys

from app.db.session import SessionLocal
from app.ingestion.csv_ingestion import ingest_csv_data
from app.ingestion.document_ingestion import ingest_policy_documents

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("app.seed")


def run_seed(csv_only: bool = False, docs_only: bool = False, force_docs: bool = False) -> int:
    """Executes the seeding process."""
    db = SessionLocal()
    has_errors = False

    try:
        print("=" * 60)
        print("  EMPÓRIO DA MÚSICA — INITIAL DATA IMPORT (PHASE 3)")
        print("=" * 60)

        # 1. CSV Ingestion
        if not docs_only:
            print("\n[1/2] Ingesting CSV datasets...")
            csv_stats = ingest_csv_data(db)

            print(f"  Categories:  {csv_stats.categories_inserted} inserted, {csv_stats.categories_skipped} skipped")
            print(f"  Customers:   {csv_stats.customers_inserted} inserted, {csv_stats.customers_skipped} skipped")
            print(f"  Products:    {csv_stats.products_inserted} inserted, {csv_stats.products_skipped} skipped")
            print(f"  Promotions:  {csv_stats.promotions_inserted} inserted, {csv_stats.promotions_skipped} skipped")
            print(f"  Orders:      {csv_stats.orders_inserted} inserted, {csv_stats.orders_skipped} skipped")
            print(f"  Order Items: {csv_stats.order_items_inserted} inserted, {csv_stats.order_items_skipped} skipped")

            if csv_stats.warnings:
                print(f"\n  [!] {len(csv_stats.warnings)} Warnings:")
                for w in csv_stats.warnings:
                    print(f"    - {w}")

            if csv_stats.errors:
                has_errors = True
                print(f"\n  [X] {len(csv_stats.errors)} Errors during CSV ingestion:")
                for e in csv_stats.errors:
                    print(f"    - {e}")

        # 2. Document Ingestion
        if not csv_only:
            print("\n[2/2] Ingesting policy documents...")
            doc_stats = ingest_policy_documents(db, force=force_docs)

            print(f"  Documents processed: {doc_stats.documents_processed}")
            print(f"  Documents skipped:   {doc_stats.documents_skipped}")
            print(f"  Chunks created:      {doc_stats.chunks_created}")

            if doc_stats.errors:
                has_errors = True
                print(f"\n  [X] {len(doc_stats.errors)} Errors during document ingestion:")
                for e in doc_stats.errors:
                    print(f"    - {e}")

        print("\n" + "=" * 60)
        if has_errors:
            print("  IMPORT COMPLETED WITH ERRORS")
            print("=" * 60)
            return 1
        else:
            print("  IMPORT COMPLETED SUCCESSFULLY")
            print("=" * 60)
            return 0

    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Initial data import for Empório da Música.")
    parser.add_argument("--csv-only", action="store_true", help="Ingest only CSV datasets")
    parser.add_argument("--docs-only", action="store_true", help="Ingest only policy documents")
    parser.add_argument(
        "--force-docs", action="store_true", help="Force re-extraction of policy documents"
    )

    args = parser.parse_args()
    exit_code = run_seed(
        csv_only=args.csv_only,
        docs_only=args.docs_only,
        force_docs=args.force_docs,
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()

