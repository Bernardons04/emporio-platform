import React from 'react';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface MessageListProps {
  messages: ChatMessage[];
  isTyping?: boolean;
}

export function MessageList({ messages, isTyping = false }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
      {messages.map((msg) => {
        const isUser = msg.sender === 'user';
        return (
          <div
            key={msg.id}
            className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[75%]">
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-[#2B5276] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                  EM
                </div>
              )}

              <div
                className={`p-3.5 rounded-2xl shadow-xs text-sm leading-relaxed ${
                  isUser
                    ? 'bg-[#4986C1] text-white rounded-br-xs'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                <div
                  className={`text-[10px] mt-1 text-right ${
                    isUser ? 'text-white/80' : 'text-slate-400'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {isTyping && (
        <div className="flex items-center gap-2 text-slate-500 text-xs py-1">
          <div className="w-8 h-8 rounded-full bg-[#2B5276] text-white flex items-center justify-center text-xs font-bold shrink-0">
            EM
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2 flex items-center gap-1.5 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#4986C1] animate-bounce"></span>
            <span
              className="w-2 h-2 rounded-full bg-[#4986C1] animate-bounce"
              style={{ animationDelay: '0.2s' }}
            ></span>
            <span
              className="w-2 h-2 rounded-full bg-[#4986C1] animate-bounce"
              style={{ animationDelay: '0.4s' }}
            ></span>
          </div>
        </div>
      )}
    </div>
  );
}

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSendMessage, disabled = false }: MessageInputProps) {
  const [text, setText] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSendMessage(text.trim());
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Digite sua dúvida sobre instrumentos, pedidos ou políticas..."
            rows={1}
            className="app-input resize-none py-2.5 max-h-32 min-h-[44px]"
            style={{ overflowY: 'auto' }}
          />
        </div>

        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="h-11 px-4 rounded-lg bg-[#2B5276] hover:bg-[#22425f] text-white font-medium text-sm flex items-center justify-center transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
          aria-label="Send message"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
      <div className="text-center mt-2 text-[11px] text-slate-400">
        Empório da Música &bull; Atendimento virtual em Português do Brasil
      </div>
    </div>
  );
}

