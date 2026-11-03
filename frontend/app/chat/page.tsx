'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  createCustomerConversation,
  CustomerConversation,
  CustomerMessage,
  getCurrentUser,
  getCustomerConversationMessages,
  listCustomerConversations,
  logoutUser,
  sendCustomerMessage,
  User,
} from '@/lib/api';
import { ConversationSidebar, ConversationItem } from '@/components/chat/ConversationSidebar';
import { MessageList, MessageInput, ChatMessage } from '@/components/chat/ChatInterface';

function formatTimestamp(dateStr?: string): string {
  if (!dateStr) return 'Agora';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return 'Agora';
  }
}

function mapConversationItem(c: CustomerConversation): ConversationItem {
  return {
    id: c.id,
    title: c.title || 'Nova Conversa',
    lastMessage: c.last_message || 'Inicie uma nova pergunta...',
    timestamp: formatTimestamp(c.updated_at),
  };
}

function mapChatMessage(m: CustomerMessage): ChatMessage {
  return {
    id: m.id,
    sender: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
    timestamp: formatTimestamp(m.created_at),
  };
}

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Conversations & messages state
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  // Verify auth session
  useEffect(() => {
    async function loadUser() {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          router.replace('/');
          return;
        }
        setUser(currentUser);
      } catch {
        router.replace('/');
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [router]);

  // Load message history when active conversation changes
  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    setErrorMessage(null);
    try {
      const history = await getCustomerConversationMessages(conversationId);
      setMessages(history.map(mapChatMessage));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar o histórico de mensagens.';
      setErrorMessage(msg);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Fetch conversations from backend
  const loadConversations = useCallback(
    async (preferredActiveId?: string) => {
      setLoadingConversations(true);
      try {
        const convList = await listCustomerConversations();
        const mapped = convList.map(mapConversationItem);
        setConversations(mapped);

        // Select conversation
        const targetId = preferredActiveId || (mapped.length > 0 ? mapped[0].id : null);
        if (targetId) {
          setActiveConversationId(targetId);
          await loadMessages(targetId);
        } else {
          setActiveConversationId(null);
          setMessages([]);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha ao carregar conversas.';
        setErrorMessage(msg);
      } finally {
        setLoadingConversations(false);
      }
    },
    [loadMessages]
  );

  // Initial load once user is verified
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      router.replace('/');
      router.refresh();
    }
  };

  const handleSelectConversation = (id: string) => {
    if (id === activeConversationId || isTyping) return;
    setActiveConversationId(id);
    loadMessages(id);
  };

  const handleNewConversation = async () => {
    if (isTyping) return;
    setErrorMessage(null);
    try {
      const newConv = await createCustomerConversation();
      const mapped = mapConversationItem(newConv);
      setConversations((prev) => [mapped, ...prev]);
      setActiveConversationId(newConv.id);
      setMessages([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao criar nova conversa.';
      setErrorMessage(msg);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    setErrorMessage(null);
    let targetConversationId = activeConversationId;

    // If there is no active conversation yet, create one first
    if (!targetConversationId) {
      try {
        const newConv = await createCustomerConversation();
        targetConversationId = newConv.id;
        const mapped = mapConversationItem(newConv);
        setConversations((prev) => [mapped, ...prev]);
        setActiveConversationId(targetConversationId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha ao iniciar conversa.';
        setErrorMessage(msg);
        return;
      }
    }

    // Optimistic user message in UI
    const tempUserId = `temp-${Date.now()}`;
    const optimisticUserMsg: ChatMessage = {
      id: tempUserId,
      sender: 'user',
      content: text,
      timestamp: formatTimestamp(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg]);
    setIsTyping(true);

    // Update conversation sidebar preview
    setConversations((prev) =>
      prev.map((c) =>
        c.id === targetConversationId
          ? { ...c, lastMessage: text, timestamp: 'Agora' }
          : c
      )
    );

    try {
      const res = await sendCustomerMessage(targetConversationId, text);

      // Replace optimistic message and append real assistant response
      const serverUserMsg = mapChatMessage(res.user_message);
      const serverAssistantMsg = mapChatMessage(res.assistant_message);

      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempUserId);
        return [...filtered, serverUserMsg, serverAssistantMsg];
      });

      // Update sidebar preview with assistant's response
      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetConversationId
            ? { ...c, lastMessage: res.assistant_message.content.slice(0, 80), timestamp: 'Agora' }
            : c
        )
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Falha ao enviar mensagem para o assistente virtual.';
      setErrorMessage(msg);
      // Rollback optimistic message if failed
      setMessages((prev) => prev.filter((m) => m.id !== tempUserId));
    } finally {
      setIsTyping(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#2B5276] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-slate-600">Carregando atendimento...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Conversation Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        isOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        loading={loadingConversations}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              aria-label="Abrir conversas"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-900 text-sm sm:text-base">
                  Atendimento Empório da Música
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E6A211]/20 text-amber-900 border border-[#E6A211]/30">
                  Campo Grande
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Tire dúvidas sobre instrumentos, estoque, pedidos e políticas da loja.
              </p>
            </div>
          </div>

          {/* User Menu Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-slate-700 hover:text-slate-900 shadow-2xs cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#2B5276]/20"
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
              aria-label="Menu do usuário"
            >
              <span className="w-7 h-7 rounded-full bg-[#2B5276] text-white flex items-center justify-center text-xs font-bold shrink-0">
                {user.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="hidden sm:inline-block text-xs font-semibold text-slate-800 max-w-[120px] sm:max-w-[180px] truncate text-left">
                {user.name}
              </span>
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${
                  userMenuOpen ? 'rotate-180 text-slate-600' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-50 text-xs animate-in fade-in-50 zoom-in-95 duration-100">
                {/* User info header */}
                <div className="px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/60">
                  <p className="font-semibold text-slate-900 truncate">{user.name}</p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{user.email}</p>
                  {user.is_admin && (
                    <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-semibold rounded bg-[#2B5276]/10 text-[#2B5276] border border-[#2B5276]/20">
                      Administrador
                    </span>
                  )}
                </div>

                {/* Admin panel option (only for admins) */}
                {user.is_admin && (
                  <div className="py-1 border-b border-slate-100">
                    <Link
                      href="/admin"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-slate-700 hover:text-[#2B5276] hover:bg-slate-50 font-medium transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Painel administrativo
                    </Link>
                  </div>
                )}

                {/* Logout option */}
                <div className="pt-1">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-red-600 hover:text-red-700 hover:bg-red-50/70 font-medium transition-colors text-left cursor-pointer"
                  >
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Error notification banner if any */}
        {errorMessage && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center justify-between text-xs text-red-700 shrink-0">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-700 font-bold ml-2 cursor-pointer"
              aria-label="Fechar erro"
            >
              ✕
            </button>
          </div>
        )}

        {/* Message Content View */}
        <MessageList
          messages={messages}
          isTyping={isTyping}
          loadingHistory={loadingMessages}
        />

        {/* Message Input Bottom */}
        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={isTyping || loadingMessages}
        />
      </div>
    </div>
  );
}
