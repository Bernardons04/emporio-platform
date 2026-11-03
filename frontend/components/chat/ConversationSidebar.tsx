import React from 'react';

export interface ConversationItem {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  unreadCount?: number;
}

interface ConversationSidebarProps {
  conversations: ConversationItem[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelectConversation,
  onNewConversation,
  isOpen,
  onCloseMobile,
}: ConversationSidebarProps) {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-30 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-80 bg-[#2B5276] text-white flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar header */}
        <div className="p-4 border-b border-[#22425f] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#E6A211]">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </span>
            <div>
              <h2 className="font-bold text-sm tracking-wide">Conversations</h2>
              <span className="text-xs text-slate-300">Empório Assistant</span>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="lg:hidden text-slate-300 hover:text-white p-1 rounded-md"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New Conversation Button */}
        <div className="p-3">
          <button
            onClick={() => {
              onNewConversation();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#E6A211] hover:bg-[#cf900d] text-slate-950 font-semibold text-sm transition-colors shadow-sm cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            Nova Conversa
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-300 px-4">
              Nenhuma conversa anterior encontrada. Clique em &quot;Nova Conversa&quot; para começar.
            </div>
          ) : (
            conversations.map((item) => {
              const isActive = item.id === activeId;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectConversation(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full text-left p-3 rounded-lg transition-colors cursor-pointer flex flex-col gap-1 border ${
                    isActive
                      ? 'bg-white/15 border-white/20 text-white'
                      : 'border-transparent text-slate-200 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs truncate max-w-[170px]">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-slate-300">{item.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 truncate">{item.lastMessage}</p>
                </button>
              );
            })
          )}
        </div>

        {/* Sidebar Footer info */}
        <div className="p-3 border-t border-[#22425f] text-[11px] text-slate-300 flex items-center justify-between">
          <span>Empório da Música</span>
          <span className="inline-block w-2 h-2 rounded-full bg-[#E6A211]"></span>
        </div>
      </aside>
    </>
  );
}

