'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, logoutUser, User } from '@/lib/api';
import { ConversationSidebar, ConversationItem } from '@/components/chat/ConversationSidebar';
import { MessageList, MessageInput, ChatMessage } from '@/components/chat/ChatInterface';

// Mock conversations for UI visualization until Phase 7
const INITIAL_MOCK_CONVERSATIONS: ConversationItem[] = [
  {
    id: 'conv-1',
    title: 'Dúvidas sobre Violão Tagima',
    lastMessage: 'Temos sim em estoque na loja de Campo Grande!',
    timestamp: 'Hoje',
  },
  {
    id: 'conv-2',
    title: 'Status do Pedido #1002',
    lastMessage: 'Seu pedido foi despachado para entrega.',
    timestamp: 'Ontem',
  },
];

const INITIAL_MOCK_MESSAGES: Record<string, ChatMessage[]> = {
  'conv-1': [
    {
      id: 'm1',
      sender: 'user',
      content: 'Olá! Vocês tem o Violão Tagima Dallas em estoque?',
      timestamp: '14:20',
    },
    {
      id: 'm2',
      sender: 'assistant',
      content: 'Olá! Temos sim em estoque na nossa loja física em Campo Grande e para envio imediato. Gostaria de verificar as cores disponíveis ou formas de pagamento?',
      timestamp: '14:21',
    },
  ],
  'conv-2': [
    {
      id: 'm3',
      sender: 'user',
      content: 'Poderiam me informar sobre o status do pedido #1002?',
      timestamp: 'Ontem 10:15',
    },
    {
      id: 'm4',
      sender: 'assistant',
      content: 'Seu pedido #1002 foi despachado para entrega e tem previsão de chegada em até 2 dias úteis.',
      timestamp: 'Ontem 10:16',
    },
  ],
};

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Conversational UI state
  const [conversations, setConversations] = useState<ConversationItem[]>(INITIAL_MOCK_CONVERSATIONS);
  const [activeConversationId, setActiveConversationId] = useState<string>('conv-1');
  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>(INITIAL_MOCK_MESSAGES);
  const [isTyping, setIsTyping] = useState(false);

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

  const handleNewConversation = () => {
    const newId = `conv-${Date.now()}`;
    const newConv: ConversationItem = {
      id: newId,
      title: 'Nova Conversa',
      lastMessage: 'Inicie uma nova pergunta...',
      timestamp: 'Agora',
    };
    setConversations([newConv, ...conversations]);
    setActiveConversationId(newId);
    setMessagesMap((prev) => ({
      ...prev,
      [newId]: [
        {
          id: `m-${Date.now()}`,
          sender: 'assistant',
          content: 'Olá! Sou o assistente virtual do Empório da Música. Como posso ajudar você hoje?',
          timestamp: 'Agora',
        },
      ],
    }));
  };

  const handleSendMessage = (text: string) => {
    const userMsg: ChatMessage = {
      id: `m-u-${Date.now()}`,
      sender: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeConversationId]: [...(prev[activeConversationId] || []), userMsg],
    }));

    // Update conversation list preview
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? { ...c, lastMessage: text, timestamp: 'Agora' }
          : c
      )
    );

    // Mock response simulation for Phase 5 presentation
    setIsTyping(true);
    setTimeout(() => {
      const assistantMsg: ChatMessage = {
        id: `m-a-${Date.now()}`,
        sender: 'assistant',
        content: `Obrigado pela sua mensagem! O agente conversacional com RAG e LangGraph será integrado nas próximas etapas do projeto. Recebi: "${text}"`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessagesMap((prev) => ({
        ...prev,
        [activeConversationId]: [...(prev[activeConversationId] || []), assistantMsg],
      }));
      setIsTyping(false);
    }, 1000);
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

  const currentMessages = messagesMap[activeConversationId] || [];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Conversation Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelectConversation={(id) => setActiveConversationId(id)}
        onNewConversation={handleNewConversation}
        isOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
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
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E6A211]/20 text-amber-900 border border-[#E6A211]/30">
                  Campo Grande
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Tire dúvidas sobre instrumentos, estoque, pedidos e políticas da loja.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-slate-800">{user.name}</div>
              <div className="text-[11px] text-slate-500">{user.email}</div>
            </div>

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-300 transition-colors cursor-pointer"
            >
              Sair
            </button>
          </div>
        </header>

        {/* Message Content View */}
        <MessageList messages={currentMessages} isTyping={isTyping} />

        {/* Message Input Bottom */}
        <MessageInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
}
