"""Admin product management API endpoints."""

import logging
import math

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_admin_user, get_db
from app.models.product import Category, Product
from app.models.user import User
from app.schemas.product import (
    CategoryResponse,
    ProductCreate,
    ProductListResponse,
    ProductResponse,
    ProductUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/products", tags=["Admin — Products"])


# ── Categories ────────────────────────────────────────────────────────────────


@router.get(
    "/categories",
    response_model=list[CategoryResponse],
    summary="List all product categories",
)
def list_categories(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Returns all categories ordered by name. Required for product forms."""
    stmt = select(Category).order_by(Category.name)
    categories = db.execute(stmt).scalars().all()
    return categories


# ── Products ──────────────────────────────────────────────────────────────────


@router.get(
    "",
    response_model=ProductListResponse,
    summary="List products with search and filters",
)
def list_products(
    search: str | None = Query(None, description="Search by name or description"),
    category_id: int | None = Query(None, description="Filter by category"),
    status: str | None = Query(None, pattern=r"^(active|inactive|discontinued)$", description="Filter by status (active/inactive/discontinued)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Returns a paginated list of products with optional search and filters."""
    stmt = (
        select(Product)
        .options(joinedload(Product.category))
        .order_by(Product.name)
    )

    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(Product.name.ilike(term), Product.description.ilike(term))
        )

    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)

    if status:
        stmt = stmt.where(Product.status == status)

    # Count total matching records
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = db.execute(count_stmt).scalar_one()

    # Apply pagination
    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)
    products = db.execute(stmt).scalars().all()

    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return ProductListResponse(
        items=list(products),
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Get a single product by ID",
)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Returns a single product with its category details."""
    stmt = (
        select(Product)
        .options(joinedload(Product.category))
        .where(Product.product_id == product_id)
    )
    product = db.execute(stmt).scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {product_id} not found.",
        )
    return product


@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new product",
)
def create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Creates a new product. Validates that the category exists."""
    # Validate category exists
    category = db.get(Category, data.category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Category {data.category_id} does not exist.",
        )

    product = Product(**data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)

    # Reload with category relationship
    stmt = (
        select(Product)
        .options(joinedload(Product.category))
        .where(Product.product_id == product.product_id)
    )
    product = db.execute(stmt).scalar_one()

    logger.info("Admin %s created product %s (%s)", admin.email, product.product_id, product.name)
    return product


@router.patch(
    "/{product_id}",
    response_model=ProductResponse,
    summary="Update a product (partial update)",
)
def update_product(
    product_id: int,
    data: ProductUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Partially updates a product. Only provided fields are changed."""
    stmt = (
        select(Product)
        .options(joinedload(Product.category))
        .where(Product.product_id == product_id)
    )
    product = db.execute(stmt).scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {product_id} not found.",
        )

    updates = data.model_dump(exclude_unset=True)

    if "category_id" in updates:
        category = db.get(Category, updates["category_id"])
        if not category:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Category {updates['category_id']} does not exist.",
            )

    for field, value in updates.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)

    # Reload with category relationship
    stmt = (
        select(Product)
        .options(joinedload(Product.category))
        .where(Product.product_id == product_id)
    )
    product = db.execute(stmt).scalar_one()

    logger.info(
        "Admin %s updated product %s: %s",
        admin.email,
        product_id,
        list(updates.keys()),
    )
    return product


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a product",
)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Deletes a product. Fails if the product has existing orders (RESTRICT FK)."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product {product_id} not found.",
        )

    try:
        db.delete(product)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning("Failed to delete product %s: %s", product_id, exc)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete this product because it is referenced by existing orders or promotions.",
        ) from exc

    logger.info("Admin %s deleted product %s", admin.email, product_id)

