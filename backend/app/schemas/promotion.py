"""Schemas for promotion API endpoints."""

from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class PromotionProductSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: int
    name: str
    price_brl: Decimal
    category_id: int


class PromotionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    promotion_id: int
    product_id: int
    discount_percent: Decimal
    description: str | None = None
    is_active: bool
    product: PromotionProductSummary
    original_price_brl: Decimal
    discounted_price_brl: Decimal


class PromotionListResponse(BaseModel):
    items: list[PromotionResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

