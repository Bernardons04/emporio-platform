'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Badge, Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { renderAssistantMarkdown } from '@/lib/markdown';
import { EventDetails } from '@/components/admin/EventDetails';
import {
  AdminConversationDetail,
  AdminConversationSummary,
  AdminMessage,
  AdminMessageEvent,
  getAdminConversation,
  listAdminConversations,
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

export default function AdminConversationsPage() {
  const [conversations, setConversations] = useState<AdminConversationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search input with debounce
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal detail
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<AdminConversationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 350);
  };

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAdminConversations({
        search: search || undefined,
        page,
        page_size: 20,
      });
      setConversations(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar as conversas.');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleOpenConversation = async (conversationId: string) => {
    setModalOpen(true);
    setSelectedConversation(null);
    setLoadingDetail(true);
    setErrorDetail(null);
    try {
      const detail = await getAdminConversation(conversationId);
      setSelectedConversation(detail);
    } catch (err: unknown) {
      setErrorDetail(err instanceof Error ? err.message : 'Falha ao carregar o histórico da conversa.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedConversation(null);
  };

  return (
    <AdminLayout
      title="Histórico de Conversas"
      subtitle="Consulta e auditoria das mensagens trocadas entre clientes e o assistente virtual"
    >
      <div className="space-y-6">
        {/* Filtros de Busca */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Buscar por e-mail, nome do cliente ou assunto..."
                value={searchInput}
                onChange={(e) => handleSearchInput(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Tabela de Conversas */}
        <Card
          title="Atendimentos Registrados"
          subtitle={total > 0 ? `${total} conversa(s) encontrada(s)` : undefined}
        >
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
              <div className="w-5 h-5 border-2 border-[#2B5276] border-t-transparent rounded-full animate-spin" />
              Carregando conversas...
            </div>
          ) : error ? (
            <div className="py-12 text-center text-red-600 text-sm font-medium">{error}</div>
          ) : conversations.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Nenhuma conversa encontrada.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Cliente</th>
                      <th className="py-3 px-4 font-semibold">Assunto / Primeira Mensagem</th>
                      <th className="py-3 px-4 font-semibold text-center">Mensagens</th>
                      <th className="py-3 px-4 font-semibold">Última Interação</th>
                      <th className="py-3 px-4 font-semibold text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {conversations.map((conv) => (
                      <tr key={conv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{conv.user.email}</div>
                          <div className="text-[11px] text-slate-500">{conv.user.name}</div>
                        </td>
                        <td className="py-3.5 px-4 max-w-md">
                          <div className="font-medium text-slate-900 truncate">
                            {conv.title || 'Atendimento Geral'}
                          </div>
                          {conv.has_support_ticket && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                              Chamado aberto
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-medium">
                          {conv.message_count}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                          {formatDate(conv.updated_at)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenConversation(conv.id)}
                          >
                            Ver conversa
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    Página {page} de {totalPages} — {total} conversas
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

      {/* Modal: Histórico Completo da Conversa */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {selectedConversation?.title || 'Histórico da Conversa'}
                </h3>
                {selectedConversation && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cliente: <strong>{selectedConversation.user.name}</strong> ({selectedConversation.user.email})
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

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-16 gap-2 text-xs text-slate-500">
                  <div className="w-4 h-4 border-2 border-[#2B5276] border-t-transparent rounded-full animate-spin" />
                  Carregando mensagens...
                </div>
              ) : errorDetail ? (
                <div className="py-12 text-center text-red-600 text-xs font-medium">
                  {errorDetail}
                </div>
              ) : !selectedConversation || selectedConversation.messages.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Nenhuma mensagem registrada nesta conversa.
                </div>
              ) : (
                selectedConversation.messages.map((m: AdminMessage) => {
                  const isUser = m.role === 'user';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[11px] font-semibold text-slate-700">
                          {isUser ? selectedConversation.user.name : 'Assistente Virtual (IA)'}
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
                        {!isUser && m.events && m.events.length > 0 && (
                          <EventDetails events={m.events} />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
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
