'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Promotion,
  PromotionListResponse,
  listPromotions,
} from '@/lib/api';

function formatBRL(value: string | number) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(n)
    ? String(value)
    : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function AdminPromotionsPage() {
  const [data, setData] = useState<PromotionListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Debounced search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 350);
  };

  const fetchPromotions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const isActiveParam = statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined;
      const res = await listPromotions({
        search: search || undefined,
        is_active: isActiveParam,
        page,
        page_size: PAGE_SIZE,
      });
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar as promoções.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  return (
    <AdminLayout
      title="Promoções e Ofertas"
      subtitle="Campanhas promocionais, descontos aplicados e produtos vinculados"
    >
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Buscar por descrição ou nome do produto..."
                value={searchInput}
                onChange={(e) => handleSearchInput(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as '' | 'active' | 'inactive')}
              className="app-input sm:w-48"
            >
              <option value="">Todos os Status</option>
              <option value="active">Ativas</option>
              <option value="inactive">Inativas</option>
            </select>
          </div>
        </Card>

        {/* Results Card */}
        <Card
          title="Regras Promocionais"
          subtitle={data ? `${data.total} promoção(ões) encontrada(s)` : undefined}
        >
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
              <div className="w-5 h-5 border-2 border-[#2B5276] border-t-transparent rounded-full animate-spin" />
              Carregando promoções...
            </div>
          ) : error ? (
            <div className="py-12 text-center text-red-600 text-sm font-medium">{error}</div>
          ) : !data || data.items.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Nenhuma promoção encontrada.{' '}
              {(search || statusFilter) && (
                <button
                  onClick={() => {
                    setSearchInput('');
                    setSearch('');
                    setStatusFilter('');
                  }}
                  className="text-[#4986C1] hover:underline cursor-pointer"
                >
                  Limpar filtros
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
                      <th className="py-3 px-4 font-semibold">Descrição da Promoção</th>
                      <th className="py-3 px-4 font-semibold">Produto Vinculado</th>
                      <th className="py-3 px-4 font-semibold text-center">Desconto</th>
                      <th className="py-3 px-4 font-semibold text-right">Preço Original</th>
                      <th className="py-3 px-4 font-semibold text-right">Preço Promocional</th>
                      <th className="py-3 px-4 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {data.items.map((promo: Promotion) => {
                      const discountNum = parseFloat(promo.discount_percent);
                      return (
                        <tr key={promo.promotion_id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-slate-400">#{promo.promotion_id}</td>
                          <td className="py-3.5 px-4 font-medium text-slate-900">
                            {promo.description || 'Desconto Promocional'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-medium text-slate-800">{promo.product.name}</span>
                            <span className="text-slate-400 text-[11px] block font-mono">
                              Cód. #{promo.product.product_id}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-[#E6A211] whitespace-nowrap">
                            {isNaN(discountNum) ? promo.discount_percent : `${discountNum.toFixed(0)}% OFF`}
                          </td>
                          <td className="py-3.5 px-4 text-right line-through text-slate-400 whitespace-nowrap">
                            {formatBRL(promo.original_price_brl)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-emerald-700 whitespace-nowrap">
                            {formatBRL(promo.discounted_price_brl)}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <Badge variant={promo.is_active ? 'success' : 'default'}>
                              {promo.is_active ? 'Ativa' : 'Inativa'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data.total_pages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    Página {data.page} de {data.total_pages} — {data.total} promoções
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      ← Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= data.total_pages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Próxima →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
