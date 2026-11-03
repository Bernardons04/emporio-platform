"""Schemas for product and category API endpoints."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# ── Category schemas ─────────────────────────────────────────────────────────


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category_id: int
    name: str
    description: str | None = None


# ── Product schemas ───────────────────────────────────────────────────────────


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category_id: int
    description: str | None = None
    price_brl: Decimal = Field(..., gt=0, decimal_places=2)
    stock_quantity: int = Field(..., ge=0)
    status: str = Field("active", pattern=r"^(active|inactive|discontinued)$")
    specs: dict | None = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    """All fields optional for partial updates.

    Required database fields can be omitted (default=None), but cannot explicitly receive null.
    Nullable database fields (description, specs) can explicitly receive null.
    """

    name: str = Field(default=None, min_length=1, max_length=255)
    category_id: int = Field(default=None)
    description: str | None = Field(default=None)
    price_brl: Decimal = Field(default=None, gt=0, decimal_places=2)
    stock_quantity: int = Field(default=None, ge=0)
    status: str = Field(default=None, pattern=r"^(active|inactive|discontinued)$")
    specs: dict | None = Field(default=None)


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_id: int
    name: str
    category_id: int
    category: CategoryResponse
    description: str | None = None
    price_brl: Decimal
    stock_quantity: int
    status: str
    specs: dict | None = None
    created_at: date | None = None


class ProductListResponse(BaseModel):
    items: list[ProductResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

