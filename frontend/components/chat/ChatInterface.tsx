import React, { useMemo } from 'react';
import { renderAssistantMarkdown } from '@/lib/markdown';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface MessageListProps {
  messages: ChatMessage[];
  isTyping?: boolean;
  loadingHistory?: boolean;
}

function AssistantMessageContent({ content }: { content: string }) {
  const sanitizedHtml = useMemo(() => renderAssistantMarkdown(content), [content]);

  return (
    <div
      className="chat-markdown text-sm"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}

export function MessageList({ messages, isTyping = false, loadingHistory = false }: MessageListProps) {
  if (loadingHistory) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-slate-500">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-[#2B5276] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-medium">Carregando mensagens da conversa...</span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-slate-400">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-[#2B5276] flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-600">Nenhuma mensagem nesta conversa</p>
          <p className="text-xs text-slate-400 mt-1">
            Envie sua dúvida abaixo para iniciar o atendimento com o assistente do Empório da Música.
          </p>
        </div>
      </div>
    );
  }

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
                {isUser ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <AssistantMessageContent content={msg.content} />
                )}
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
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea up to 5 lines (~128px)
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      // Line height ~20px + padding 16px. 5 lines ~ 124px
      const newHeight = Math.min(textarea.scrollHeight, 128);
      textarea.style.height = `${newHeight}px`;
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() || disabled) return;
    onSendMessage(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-center gap-2">
        <div className="flex-1 relative flex items-center">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Digite sua dúvida sobre instrumentos, pedidos ou políticas..."
            rows={1}
            className="app-input resize-none py-2.5 max-h-32 min-h-[44px] block"
            style={{ overflowY: 'auto' }}
          />
        </div>

        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="h-11 px-4 rounded-lg bg-[#2B5276] hover:bg-[#22425f] text-white font-medium text-sm flex items-center justify-center transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
          aria-label="Enviar mensagem"
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

