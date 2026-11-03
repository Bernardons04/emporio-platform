'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Badge, Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { renderAssistantMarkdown } from '@/lib/markdown';
import {
  AdminMessage,
  AdminSupportTicket,
  AdminSupportTicketDetail,
  getAdminSupportTicket,
  listAdminSupportTickets,
  updateAdminSupportTicketStatus,
} from '@/lib/api';

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function AdminAssistantMessage({ content }: { content: string }) {
  const sanitizedHtml = useMemo(() => renderAssistantMarkdown(content), [content]);

  return (
    <div
      className="chat-markdown text-xs"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}

export default function AdminSupportInboxPage() {
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal / Detail state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<AdminSupportTicketDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 350);
  };

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAdminSupportTickets({
        status: statusFilter || undefined,
        search: search || undefined,
        page,
        page_size: 20,
      });
      setTickets(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar as solicitações.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const handleOpenTicket = async (ticketId: string) => {
    setModalOpen(true);
    setSelectedTicket(null);
    setLoadingDetail(true);
    setErrorDetail(null);
    try {
      const detail = await getAdminSupportTicket(ticketId);
      setSelectedTicket(detail);
    } catch (err: unknown) {
      setErrorDetail(err instanceof Error ? err.message : 'Falha ao carregar detalhes da solicitação.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedTicket(null);
  };

  const handleStatusChange = async (ticketId: string, newStatus: 'pending' | 'resolved') => {
    setUpdatingStatus(true);
    try {
      const updated = await updateAdminSupportTicketStatus(ticketId, newStatus);
      // Atualizar lista
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: updated.status } : t))
      );
      // Atualizar modal se aberto
      setSelectedTicket((prev) => (prev ? { ...prev, status: updated.status } : null));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Falha ao atualizar status da solicitação.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <AdminLayout
      title="Atendimento Humano"
      subtitle="Solicitações de clientes identificadas pela IA com necessidade de intervenção humana"
    >
      <div className="space-y-6">
        {/* Filtros */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Buscar por protocolo, motivo ou cliente..."
                value={searchInput}
                onChange={(e) => handleSearchInput(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="app-input sm:w-48"
            >
              <option value="">Todos os Status</option>
              <option value="pending">Pendente</option>
              <option value="resolved">Atendida</option>
            </select>
          </div>
        </Card>

        {/* Tabela de Solicitações */}
        <Card
          title="Solicitações de Intervenção"
          subtitle={total > 0 ? `${total} solicitação(ões) encontrada(s)` : undefined}
        >
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
              <div className="w-5 h-5 border-2 border-[#2B5276] border-t-transparent rounded-full animate-spin" />
              Carregando solicitações...
            </div>
          ) : error ? (
            <div className="py-12 text-center text-red-600 text-sm font-medium">{error}</div>
          ) : tickets.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Nenhuma solicitação encontrada.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Protocolo</th>
                      <th className="py-3 px-4 font-semibold">Cliente</th>
                      <th className="py-3 px-4 font-semibold">Motivo</th>
                      <th className="py-3 px-4 font-semibold">Data</th>
                      <th className="py-3 px-4 font-semibold text-center">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {tickets.map((t) => {
                      const isResolved = t.status === 'resolved';
                      return (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-[#2B5276]">
                            {t.id}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">{t.user.name}</div>
                            <div className="text-[11px] text-slate-500">{t.user.email}</div>
                          </td>
                          <td className="py-3.5 px-4 max-w-sm">
                            <p className="line-clamp-2 leading-relaxed text-slate-800">
                              {t.reason}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                            {formatDate(t.created_at)}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <Badge variant={isResolved ? 'success' : 'warning'}>
                              {isResolved ? 'Atendida' : 'Pendente'}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenTicket(t.id)}
                              >
                                Ver contexto
                              </Button>
                              {isResolved ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStatusChange(t.id, 'pending')}
                                >
                                  Reabrir
                                </Button>
                              ) : (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleStatusChange(t.id, 'resolved')}
                                >
                                  Marcar atendida
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    Página {page} de {totalPages} — {total} solicitações
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
                      disabled={page >= totalPages}
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

      {/* Modal: Contexto do Chamado e Conversa */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900">
                    Solicitação #{selectedTicket?.id}
                  </h3>
                  {selectedTicket && (
                    <Badge variant={selectedTicket.status === 'resolved' ? 'success' : 'warning'}>
                      {selectedTicket.status === 'resolved' ? 'Atendida' : 'Pendente'}
                    </Badge>
                  )}
                </div>
                {selectedTicket && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cliente: <strong>{selectedTicket.user.name}</strong> ({selectedTicket.user.email})
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 rounded p-1 cursor-pointer"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            {/* Motivo do Chamado */}
            {selectedTicket && (
              <div className="p-4 bg-amber-50/60 border-b border-amber-200/60 text-xs">
                <span className="font-semibold text-amber-950 block mb-0.5">
                  Motivo identificado pela IA:
                </span>
                <p className="text-slate-800 leading-relaxed">{selectedTicket.reason}</p>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Registrado em: {formatDate(selectedTicket.created_at)}
                </span>
              </div>
            )}

            {/* Histórico da Conversa */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">
                Contexto da Conversa com o Assistente
              </div>

              {loadingDetail ? (
                <div className="flex items-center justify-center py-16 gap-2 text-xs text-slate-500">
                  <div className="w-4 h-4 border-2 border-[#2B5276] border-t-transparent rounded-full animate-spin" />
                  Carregando mensagens da conversa...
                </div>
              ) : errorDetail ? (
                <div className="py-12 text-center text-red-600 text-xs font-medium">
                  {errorDetail}
                </div>
              ) : !selectedTicket?.conversation || selectedTicket.conversation.messages.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Nenhum histórico de mensagens associado a esta solicitação.
                </div>
              ) : (
                selectedTicket.conversation.messages.map((m: AdminMessage) => {
                  const isUser = m.role === 'user';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[11px] font-semibold text-slate-700">
                          {isUser ? selectedTicket.user.name : 'Assistente Virtual (IA)'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatDate(m.created_at)}
                        </span>
                      </div>

                      <div
                        className={`p-3.5 rounded-xl text-xs max-w-[85%] leading-relaxed ${
                          isUser
                            ? 'bg-[#2B5276] text-white shadow-xs'
                            : 'bg-slate-100 text-slate-900 border border-slate-200'
                        }`}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        ) : (
                          <AdminAssistantMessage content={m.content} />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer com ações */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div>
                {selectedTicket && (
                  selectedTicket.status === 'resolved' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      isLoading={updatingStatus}
                      onClick={() => handleStatusChange(selectedTicket.id, 'pending')}
                    >
                      Reabrir Solicitação
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={updatingStatus}
                      onClick={() => handleStatusChange(selectedTicket.id, 'resolved')}
                    >
                      Marcar como Atendida
                    </Button>
                  )
                )}
              </div>

              <Button variant="outline" size="sm" onClick={handleCloseModal}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
