'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Category,
  Product,
  ProductCreate,
  ProductUpdate,
  createProduct,
  updateProduct,
} from '@/lib/api';

interface ProductFormProps {
  product?: Product | null;
  categories: Category[];
  onSuccess: (product: Product) => void;
  onCancel: () => void;
}

export function ProductForm({ product, categories, onSuccess, onCancel }: ProductFormProps) {
  const isEditing = !!product;

  const [name, setName] = useState(product?.name ?? '');
  const [categoryId, setCategoryId] = useState<string>(
    product ? String(product.category_id) : categories[0] ? String(categories[0].category_id) : ''
  );
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product?.price_brl ?? '');
  const [stock, setStock] = useState(product ? String(product.stock_quantity) : '0');
  const [productStatus, setProductStatus] = useState<'active' | 'inactive' | 'discontinued'>(
    product?.status ?? 'active'
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If in create mode and categories arrive after initial mount, set default category if empty
  useEffect(() => {
    if (!product && !categoryId && categories.length > 0) {
      setCategoryId(String(categories[0].category_id));
    }
  }, [categories, product, categoryId]);

  // Keep form in sync when the selected product changes (e.g. switching between products or new/edit)
  useEffect(() => {
    setName(product?.name ?? '');
    setCategoryId(product ? String(product.category_id) : categories[0] ? String(categories[0].category_id) : '');
    setDescription(product?.description ?? '');
    setPrice(product?.price_brl ?? '');
    setStock(product ? String(product.stock_quantity) : '0');
    setProductStatus(product?.status ?? 'active');
    setError(null);
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError('Product name is required.'); return; }
    if (!categoryId) { setError('Category is required.'); return; }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) { setError('Price must be a positive number.'); return; }
    const parsedStock = parseInt(stock, 10);
    if (isNaN(parsedStock) || parsedStock < 0) { setError('Stock must be a non-negative integer.'); return; }

    setLoading(true);
    try {
      let saved: Product;
      if (isEditing && product) {
        const payload: ProductUpdate = {
          name: name.trim(),
          category_id: parseInt(categoryId, 10),
          description: description.trim() || null,
          price_brl: parsedPrice.toFixed(2),
          stock_quantity: parsedStock,
          status: productStatus,
        };
        saved = await updateProduct(product.product_id, payload);
      } else {
        const payload: ProductCreate = {
          name: name.trim(),
          category_id: parseInt(categoryId, 10),
          description: description.trim() || null,
          price_brl: parsedPrice.toFixed(2),
          stock_quantity: parsedStock,
          status: productStatus,
        };
        saved = await createProduct(payload);
      }
      onSuccess(saved);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save product.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Product Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Violão Yamaha C40"
        required
      />

      <div className="w-full space-y-1.5">
        <label className="block text-sm font-medium text-slate-800">Category</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="app-input"
          required
        >
          {categories.map((cat) => (
            <option key={cat.category_id} value={cat.category_id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div className="w-full space-y-1.5">
        <label className="block text-sm font-medium text-slate-800">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Optional product description..."
          className="app-input resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Price (BRL)"
          type="number"
          step="0.01"
          min="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0.00"
          required
        />
        <Input
          label="Stock Quantity"
          type="number"
          min="0"
          step="1"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          required
        />
      </div>

      <div className="w-full space-y-1.5">
        <label className="block text-sm font-medium text-slate-800">Status</label>
        <select
          value={productStatus}
          onChange={(e) => setProductStatus(e.target.value as 'active' | 'inactive' | 'discontinued')}
          className="app-input"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="discontinued">Discontinued</option>
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-600 font-medium">{error}</p>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" isLoading={loading}>
          {isEditing ? 'Save Changes' : 'Create Product'}
        </Button>
      </div>
    </form>
  );
}

