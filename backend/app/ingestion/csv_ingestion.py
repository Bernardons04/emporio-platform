"""CSV Ingestion module for Empório da Música datasets.

Reads CSV files from backend/data/csv/ and imports categories, customers,
products, promotions, orders, and order_items into PostgreSQL using SQLAlchemy.
Ensures idempotency, type conversions, and foreign key integrity.
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import json
import logging
from pathlib import Path
from typing import Any
import csv

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.order import Order, OrderItem
from app.models.product import Category, Product
from app.models.promotion import Promotion

logger = logging.getLogger(__name__)

# Base path resolution
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_CSV_DIR = BACKEND_DIR / "data" / "csv"


@dataclass
class IngestionStats:
    categories_inserted: int = 0
    categories_skipped: int = 0
    customers_inserted: int = 0
    customers_skipped: int = 0
    products_inserted: int = 0
    products_skipped: int = 0
    promotions_inserted: int = 0
    promotions_skipped: int = 0
    orders_inserted: int = 0
    orders_skipped: int = 0
    order_items_inserted: int = 0
    order_items_skipped: int = 0
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def _open_csv_reader(file_path: Path) -> tuple[csv.DictReader, Any]:
    """Opens a CSV file, preferring UTF-8 and falling back to CP1252."""
    if not file_path.exists():
        raise FileNotFoundError(f"CSV file not found: {file_path}")

    import io

    raw_content = file_path.read_bytes()

    try:
        content = raw_content.decode("utf-8-sig")
    except UnicodeDecodeError:
        content = raw_content.decode("cp1252")

    file_obj = io.StringIO(content)
    reader = csv.DictReader(file_obj)
    return reader, file_obj


def _clean_str(value: Any) -> str | None:
    """Returns stripped string or None if empty."""
    if value is None:
        return None
    val = str(value).strip()
    return val if val else None


def _parse_date(value: Any) -> date | None:
    """Parses YYYY-MM-DD date or returns None."""
    clean = _clean_str(value)
    if not clean:
        return None
    try:
        return datetime.strptime(clean, "%Y-%m-%d").date()
    except ValueError as e:
        raise ValueError(f"Invalid date format '{clean}', expected YYYY-MM-DD: {e}")


def _parse_decimal(value: Any, field_name: str) -> Decimal:
    """Parses decimal string or raises ValueError."""
    clean = _clean_str(value)
    if clean is None:
        raise ValueError(f"Field '{field_name}' cannot be empty")
    try:
        return Decimal(clean)
    except InvalidOperation as e:
        raise ValueError(f"Invalid decimal value '{clean}' for '{field_name}': {e}")


def _parse_bool(value: Any) -> bool:
    """Parses boolean representation (1/0, true/false)."""
    clean = _clean_str(value)
    if clean is None:
        return False
    return clean.lower() in ("1", "true", "t", "yes", "sim")


def _parse_json(value: Any) -> dict | None:
    """Parses JSON string or returns None."""
    clean = _clean_str(value)
    if not clean:
        return None
    try:
        return json.loads(clean)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON string '{clean}': {e}")


def ingest_categories(db: Session, csv_dir: Path, stats: IngestionStats) -> None:
    """Imports categories from CSV."""
    file_path = csv_dir / "desafio_tecnico_ai_eng - categories.csv"
    reader, file_obj = _open_csv_reader(file_path)

    try:
        for row in reader:
            try:
                cat_id = int(row["category_id"])
                name = _clean_str(row.get("name"))
                if not name:
                    stats.errors.append(f"Category row missing name: {row}")
                    continue

                description = _clean_str(row.get("description"))

                # Idempotency check
                existing = db.get(Category, cat_id)
                if existing:
                    stats.categories_skipped += 1
                    continue

                cat = Category(
                    category_id=cat_id,
                    name=name,
                    description=description,
                )
                db.add(cat)
                stats.categories_inserted += 1
            except Exception as e:
                stats.errors.append(f"Error parsing category row {row}: {e}")
        db.flush()
    finally:
        file_obj.close()


def ingest_customers(db: Session, csv_dir: Path, stats: IngestionStats) -> None:
    """Imports customers from CSV."""
    file_path = csv_dir / "desafio_tecnico_ai_eng - customers.csv"
    reader, file_obj = _open_csv_reader(file_path)

    seen_emails: set[str] = set()
    try:
        for row in reader:
            try:
                cust_id = int(row["customer_id"])
                name = _clean_str(row.get("name"))
                if not name:
                    stats.errors.append(f"Customer row missing name: {row}")
                    continue

                phone = _clean_str(row.get("phone"))
                email = _clean_str(row.get("email"))
                city = _clean_str(row.get("city"))

                if email:
                    if email in seen_emails:
                        stats.warnings.append(
                            f"Duplicate customer email detected in CSV: '{email}' for customer_id {cust_id}"
                        )
                    seen_emails.add(email)

                # Idempotency check
                existing = db.get(Customer, cust_id)
                if existing:
                    stats.customers_skipped += 1
                    continue

                customer = Customer(
                    customer_id=cust_id,
                    name=name,
                    phone=phone,
                    email=email,
                    city=city,
                )
                db.add(customer)
                stats.customers_inserted += 1
            except Exception as e:
                stats.errors.append(f"Error parsing customer row {row}: {e}")
        db.flush()
    finally:
        file_obj.close()


def ingest_products(db: Session, csv_dir: Path, stats: IngestionStats) -> None:
    """Imports products from CSV."""
    file_path = csv_dir / "desafio_tecnico_ai_eng - products.csv"
    reader, file_obj = _open_csv_reader(file_path)

    try:
        for row in reader:
            try:
                prod_id = int(row["product_id"])
                name = _clean_str(row.get("name"))
                if not name:
                    stats.errors.append(f"Product row missing name: {row}")
                    continue

                cat_id = int(row["category_id"])
                # Validate foreign key
                if not db.get(Category, cat_id):
                    stats.errors.append(
                        f"Product {prod_id} references non-existent category_id {cat_id}"
                    )
                    continue

                price_brl = _parse_decimal(row.get("price_brl"), "price_brl")
                stock = int(row.get("stock_quantity", 0))
                status = _clean_str(row.get("status")) or "active"
                specs = _parse_json(row.get("specs"))
                created_at = _parse_date(row.get("created_at"))
                description = _clean_str(row.get("description"))

                # Idempotency check
                existing = db.get(Product, prod_id)
                if existing:
                    stats.products_skipped += 1
                    continue

                product = Product(
                    product_id=prod_id,
                    name=name,
                    category_id=cat_id,
                    description=description,
                    price_brl=price_brl,
                    stock_quantity=stock,
                    status=status,
                    specs=specs,
                    created_at=created_at,
                )
                db.add(product)
                stats.products_inserted += 1
            except Exception as e:
                stats.errors.append(f"Error parsing product row {row}: {e}")
        db.flush()
    finally:
        file_obj.close()


def ingest_promotions(db: Session, csv_dir: Path, stats: IngestionStats) -> None:
    """Imports promotions from CSV."""
    file_path = csv_dir / "desafio_tecnico_ai_eng - promotions.csv"
    reader, file_obj = _open_csv_reader(file_path)

    try:
        for row in reader:
            try:
                promo_id = int(row["promotion_id"])
                prod_id = int(row["product_id"])

                # Validate foreign key
                if not db.get(Product, prod_id):
                    stats.errors.append(
                        f"Promotion {promo_id} references non-existent product_id {prod_id}"
                    )
                    continue

                discount = _parse_decimal(row.get("discount_percent"), "discount_percent")
                description = _clean_str(row.get("description"))
                is_active = _parse_bool(row.get("is_active"))

                # Idempotency check
                existing = db.get(Promotion, promo_id)
                if existing:
                    stats.promotions_skipped += 1
                    continue

                promo = Promotion(
                    promotion_id=promo_id,
                    product_id=prod_id,
                    discount_percent=discount,
                    description=description,
                    is_active=is_active,
                )
                db.add(promo)
                stats.promotions_inserted += 1
            except Exception as e:
                stats.errors.append(f"Error parsing promotion row {row}: {e}")
        db.flush()
    finally:
        file_obj.close()


def ingest_orders(db: Session, csv_dir: Path, stats: IngestionStats) -> None:
    """Imports orders from CSV."""
    file_path = csv_dir / "desafio_tecnico_ai_eng - orders.csv"
    reader, file_obj = _open_csv_reader(file_path)

    try:
        for row in reader:
            try:
                order_id = int(row["order_id"])
                cust_id = int(row["customer_id"])

                # Validate foreign key
                if not db.get(Customer, cust_id):
                    stats.errors.append(
                        f"Order {order_id} references non-existent customer_id {cust_id}"
                    )
                    continue

                order_date = _parse_date(row.get("order_date"))
                status = _clean_str(row.get("status")) or "pending"
                total_brl = _parse_decimal(row.get("total_brl"), "total_brl")
                payment_method = _clean_str(row.get("payment_method"))
                tracking_code = _clean_str(row.get("tracking_code"))
                estimated_delivery = _parse_date(row.get("estimated_delivery"))
                notes = _clean_str(row.get("notes"))

                # Idempotency check
                existing = db.get(Order, order_id)
                if existing:
                    stats.orders_skipped += 1
                    continue

                order = Order(
                    order_id=order_id,
                    customer_id=cust_id,
                    order_date=order_date,
                    status=status,
                    total_brl=total_brl,
                    payment_method=payment_method,
                    tracking_code=tracking_code,
                    estimated_delivery=estimated_delivery,
                    notes=notes,
                )
                db.add(order)
                stats.orders_inserted += 1
            except Exception as e:
                stats.errors.append(f"Error parsing order row {row}: {e}")
        db.flush()
    finally:
        file_obj.close()


def ingest_order_items(db: Session, csv_dir: Path, stats: IngestionStats) -> None:
    """Imports order items from CSV."""
    file_path = csv_dir / "desafio_tecnico_ai_eng - order_items.csv"
    reader, file_obj = _open_csv_reader(file_path)

    try:
        for row in reader:
            try:
                order_id = int(row["order_id"])
                prod_id = int(row["product_id"])
                qty = int(row.get("quantity", 1))

                # Validate foreign keys
                order = db.get(Order, order_id)
                if not order:
                    stats.errors.append(
                        f"OrderItem references non-existent order_id {order_id}"
                    )
                    continue

                product = db.get(Product, prod_id)
                if not product:
                    stats.errors.append(
                        f"OrderItem references non-existent product_id {prod_id}"
                    )
                    continue

                # Idempotency check: check if (order_id, product_id) already exists
                stmt = select(OrderItem).where(
                    OrderItem.order_id == order_id,
                    OrderItem.product_id == prod_id,
                )
                existing = db.execute(stmt).scalar_one_or_none()
                if existing:
                    stats.order_items_skipped += 1
                    continue

                # Snapshot catalog unit price at import time
                unit_price = product.price_brl

                item = OrderItem(
                    order_id=order_id,
                    product_id=prod_id,
                    quantity=qty,
                    unit_price_brl=unit_price,
                )
                db.add(item)
                stats.order_items_inserted += 1
            except Exception as e:
                stats.errors.append(f"Error parsing order_item row {row}: {e}")
        db.flush()
    finally:
        file_obj.close()


def ingest_csv_data(db: Session, csv_dir: Path | None = None) -> IngestionStats:
    """Coordinates full CSV ingestion in the correct foreign key order."""
    target_dir = csv_dir or DEFAULT_CSV_DIR
    stats = IngestionStats()

    logger.info("Starting CSV data ingestion from %s", target_dir)

    try:
        # Ingestion in dependency order
        ingest_categories(db, target_dir, stats)
        ingest_customers(db, target_dir, stats)
        ingest_products(db, target_dir, stats)
        ingest_promotions(db, target_dir, stats)
        ingest_orders(db, target_dir, stats)
        ingest_order_items(db, target_dir, stats)

        if stats.errors:
            logger.warning(
                "Ingestion completed with %d errors. Rolling back.", len(stats.errors)
            )
            db.rollback()
        else:
            db.commit()
            logger.info("CSV data ingestion committed successfully.")
    except Exception as e:
        db.rollback()
        stats.errors.append(f"Unexpected fatal ingestion error: {e}")
        logger.exception("CSV ingestion failed with fatal error.")

    return stats
