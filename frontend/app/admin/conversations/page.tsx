'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface MockTicket {
  id: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  status: 'open' | 'pending' | 'resolved';
  lastMessage: string;
  time: string;
  messages: Array<{ sender: 'customer' | 'support' | 'ai'; text: string; time: string }>;
}

const MOCK_TICKETS: MockTicket[] = [
  {
    id: 'TICK-101',
    customerName: 'Lucas Oliveira',
    customerEmail: 'lucas.oliveira@email.com',
    subject: 'Solicitação de troca do Violão Tagima',
    status: 'open',
    lastMessage: 'Gostaria de saber o prazo para solicitar a troca.',
    time: '10 min atrás',
    messages: [
      {
        sender: 'customer',
        text: 'Olá, recebi o instrumento ontem mas gostaria de trocar pelo modelo elétrico.',
        time: '14:10',
      },
      {
        sender: 'ai',
        text: 'Conforme a política da loja, você tem até 7 dias corridos após o recebimento para arrependimento ou troca de itens não violados.',
        time: '14:11',
      },
      {
        sender: 'customer',
        text: 'Perfeito! Qual é o procedimento com o suporte humano?',
        time: '14:15',
      },
    ],
  },
  {
    id: 'TICK-102',
    customerName: 'Fernanda Souza',
    customerEmail: 'fernanda.souza@email.com',
    subject: 'Dúvida sobre entrega em Campo Grande',
    status: 'pending',
    lastMessage: 'A entrega expressa funciona aos sábados?',
    time: '1 hora atrás',
    messages: [
      {
        sender: 'customer',
        text: 'Olá, a entrega no centro de Campo Grande pode ser feita no sábado pela manhã?',
        time: '13:00',
      },
    ],
  },
];

export default function AdminConversationsPage() {
  const [selectedTicketId, setSelectedTicketId] = useState<string>('TICK-101');
  const selectedTicket = MOCK_TICKETS.find((t) => t.id === selectedTicketId) || MOCK_TICKETS[0];

  return (
    <AdminLayout
      title="Support Inbox"
      subtitle="Split-view customer conversation management & human support escalation"
    >
      {/* Split-view container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row h-[calc(100vh-210px)] min-h-[500px]">
        {/* Left Column: Tickets list */}
        <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col h-full bg-slate-50/50">
          <div className="p-3.5 border-b border-slate-200 bg-white flex items-center justify-between">
            <span className="font-semibold text-xs text-slate-700 uppercase tracking-wider">
              Tickets ({MOCK_TICKETS.length})
            </span>
            <Badge variant="accent">Inbox</Badge>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {MOCK_TICKETS.map((ticket) => {
              const isSelected = ticket.id === selectedTicket.id;
              return (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={`w-full text-left p-4 transition-colors cursor-pointer flex flex-col gap-1.5 ${
                    isSelected ? 'bg-white border-l-4 border-l-[#2B5276] shadow-xs' : 'hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-800 truncate max-w-[170px]">
                      {ticket.customerName}
                    </span>
                    <span className="text-[10px] text-slate-400">{ticket.time}</span>
                  </div>
                  <div className="text-xs font-medium text-slate-900 truncate">
                    {ticket.subject}
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1">{ticket.lastMessage}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Ticket details & conversation */}
        <div className="flex-1 flex flex-col h-full bg-white">
          {/* Header of selected ticket */}
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/30">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900">{selectedTicket.subject}</h3>
                <Badge variant={selectedTicket.status === 'open' ? 'warning' : 'default'}>
                  {selectedTicket.status.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Customer: <strong>{selectedTicket.customerName}</strong> ({selectedTicket.customerEmail})
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                Escalate
              </Button>
              <Button variant="primary" size="sm">
                Mark as Resolved
              </Button>
            </div>
          </div>

          {/* Conversation history */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {selectedTicket.messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${
                  m.sender === 'customer'
                    ? 'items-start'
                    : m.sender === 'support'
                    ? 'items-end'
                    : 'items-start'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-semibold text-slate-700">
                    {m.sender === 'customer'
                      ? selectedTicket.customerName
                      : m.sender === 'ai'
                      ? 'AI Assistant'
                      : 'Support Agent'}
                  </span>
                  <span className="text-[10px] text-slate-400">{m.time}</span>
                </div>
                <div
                  className={`p-3.5 rounded-xl text-xs max-w-[85%] leading-relaxed ${
                    m.sender === 'customer'
                      ? 'bg-slate-100 text-slate-800'
                      : m.sender === 'ai'
                      ? 'bg-[#2B5276]/10 text-slate-800 border border-[#2B5276]/20'
                      : 'bg-[#4986C1] text-white'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* Reply input for human operator */}
          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type your response to the customer..."
                className="app-input text-xs"
                disabled
              />
              <Button variant="secondary" size="sm" disabled>
                Send
              </Button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              * Support Inbox response integration will be wired in Phase 8.
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

