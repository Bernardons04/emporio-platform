'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ProductForm } from '@/components/admin/ProductForm';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Category,
  Product,
  ProductListResponse,
  deleteProduct,
  listCategories,
  listProducts,
} from '@/lib/api';

type ModalMode = 'create' | 'edit' | null;

const STATUS_BADGE: Record<string, 'success' | 'warning' | 'default'> = {
  active: 'success',
  inactive: 'warning',
  discontinued: 'default',
};

function formatBRL(value: string) {
  const n = parseFloat(value);
  return isNaN(n)
    ? value
    : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function AdminProductsPage() {
  // ── Data state ────────────────────────────────────────────────────────────
  const [data, setData] = useState<ProductListResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive' | 'discontinued'>('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // ── Modal ─────────────────────────────────────────────────────────────────
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // ── Delete confirmation ───────────────────────────────────────────────────
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Debounced search ──────────────────────────────────────────────────────
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 350);
  };

  // ── Fetch products ────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listProducts({
        search: search || undefined,
        category_id: categoryFilter ? parseInt(categoryFilter, 10) : undefined,
        status: statusFilter || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, statusFilter, page]);

  // Load categories once on mount
  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // Re-fetch on filter / page changes
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [categoryFilter, statusFilter]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingProduct(null);
    setModalMode('create');
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingProduct(null);
  };

  const handleSaved = () => {
    closeModal();
    fetchProducts();
  };

  const confirmDelete = async () => {
    if (!deletingProduct) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteProduct(deletingProduct.product_id);
      setDeletingProduct(null);

      // If this was the last item on the current page and we're past page 1, navigate back
      if (data && data.items.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        fetchProducts();
      }
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete product.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AdminLayout
      title="Product Catalog"
      subtitle="Manage musical instruments — prices, inventory, categories, and availability"
      actions={
        <Button variant="primary" size="sm" onClick={openCreate}>
          + New Product
        </Button>
      }
    >
      <div className="space-y-6">

        {/* Filters */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search by name or description..."
                value={searchInput}
                onChange={(e) => handleSearchInput(e.target.value)}
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="app-input sm:w-52"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.category_id} value={cat.category_id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as '' | 'active' | 'inactive' | 'discontinued')}
              className="app-input sm:w-44"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="discontinued">Discontinued</option>
            </select>
          </div>
        </Card>

        {/* Results */}
        <Card
          title="Products"
          subtitle={data ? `${data.total} product${data.total !== 1 ? 's' : ''} found` : undefined}
        >
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
              <div className="w-5 h-5 border-2 border-[#2B5276] border-t-transparent rounded-full animate-spin" />
              Loading products...
            </div>
          ) : error ? (
            <div className="py-12 text-center text-red-600 text-sm font-medium">{error}</div>
          ) : !data || data.items.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No products found.{' '}
              {(search || categoryFilter || statusFilter) && (
                <button
                  onClick={() => {
                    setSearchInput('');
                    setSearch('');
                    setCategoryFilter('');
                    setStatusFilter('');
                  }}
                  className="text-[#4986C1] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 font-semibold">ID</th>
                      <th className="py-3 px-4 font-semibold">Product Name</th>
                      <th className="py-3 px-4 font-semibold">Category</th>
                      <th className="py-3 px-4 font-semibold text-right">Unit Price</th>
                      <th className="py-3 px-4 font-semibold text-right">Stock</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {data.items.map((product) => (
                      <tr key={product.product_id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-400">#{product.product_id}</td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 max-w-xs truncate">{product.name}</div>
                          {product.description && (
                            <div className="text-slate-400 text-[11px] truncate max-w-xs mt-0.5">
                              {product.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{product.category.name}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                          {formatBRL(product.price_brl)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          <span className={product.stock_quantity === 0 ? 'text-red-500 font-semibold' : product.stock_quantity < 5 ? 'text-amber-600 font-semibold' : 'text-slate-700'}>
                            {product.stock_quantity}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={STATUS_BADGE[product.status] ?? 'default'}>
                            {product.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(product)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => {
                                setDeleteError(null);
                                setDeletingProduct(product);
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data.total_pages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    Page {data.page} of {data.total_pages} — {data.total} products
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      ← Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= data.total_pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Create / Edit Modal */}
      {modalMode !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">
                {modalMode === 'create' ? 'New Product' : 'Edit Product'}
              </h2>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 rounded p-1 cursor-pointer"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <ProductForm
                product={editingProduct}
                categories={categories}
                onSuccess={handleSaved}
                onCancel={closeModal}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Delete product?</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    <strong>{deletingProduct.name}</strong> will be permanently removed. This cannot be undone.
                    Products referenced by orders or promotions cannot be deleted.
                  </p>
                </div>
              </div>

              {deleteError && (
                <p className="text-xs text-red-600 font-medium mt-4">{deleteError}</p>
              )}

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setDeletingProduct(null);
                    setDeleteError(null);
                  }}
                  disabled={deleteLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  isLoading={deleteLoading}
                  onClick={confirmDelete}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
