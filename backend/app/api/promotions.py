"""Admin promotion management API endpoints (read-only)."""

import logging
import math
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_admin_user, get_db
from app.models.product import Product
from app.models.promotion import Promotion
from app.models.user import User
from app.schemas.promotion import (
    PromotionListResponse,
    PromotionProductSummary,
    PromotionResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/promotions", tags=["Admin — Promotions"])


@router.get(
    "",
    response_model=PromotionListResponse,
    summary="List promotions with search and status filter",
)
def list_promotions(
    search: str | None = Query(None, description="Search by promotion description or product name"),
    is_active: bool | None = Query(None, description="Filter by active status (true/false)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Returns a paginated list of promotions with calculated discounted prices."""
    stmt = (
        select(Promotion)
        .options(joinedload(Promotion.product))
        .join(Product, Product.product_id == Promotion.product_id)
        .order_by(Promotion.is_active.desc(), Promotion.promotion_id.asc())
    )

    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Promotion.description.ilike(term),
                Product.name.ilike(term),
            )
        )

    if is_active is not None:
        stmt = stmt.where(Promotion.is_active == is_active)

    # Count total matching records
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = db.execute(count_stmt).scalar_one()

    # Pagination
    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)
    promotions = db.execute(stmt).scalars().all()

    total_pages = math.ceil(total / page_size) if total > 0 else 1

    items: list[PromotionResponse] = []
    for promo in promotions:
        original = promo.product.price_brl
        discount_factor = Decimal("1") - (promo.discount_percent / Decimal("100"))
        discounted = (original * discount_factor).quantize(Decimal("0.01"))

        product_summary = PromotionProductSummary(
            product_id=promo.product.product_id,
            name=promo.product.name,
            price_brl=promo.product.price_brl,
            category_id=promo.product.category_id,
        )

        items.append(
            PromotionResponse(
                promotion_id=promo.promotion_id,
                product_id=promo.product_id,
                discount_percent=promo.discount_percent,
                description=promo.description,
                is_active=promo.is_active,
                product=product_summary,
                original_price_brl=original,
                discounted_price_brl=discounted,
            )
        )

    return PromotionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )

