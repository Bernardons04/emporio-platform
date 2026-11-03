'use client';

import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, Badge } from '@/components/ui/Card';

export default function AdminKnowledgeBasePage() {
  return (
    <AdminLayout
      title="Políticas e Documentos da Loja"
      subtitle="Regulamentos oficiais, diretrizes de atendimento e informações institucionais"
    >
      <div className="space-y-6">
        <Card
          title="Documentos Oficiais Disponíveis"
          subtitle="Documentação institucional cadastrada para suporte ao cliente"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Título do Documento</th>
                  <th className="py-3 px-4 font-semibold">Arquivo</th>
                  <th className="py-3 px-4 font-semibold">Seções Principais</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-slate-900">
                    Políticas Comerciais e Atendimento — Empório da Música
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">politicas_da_loja.pdf</td>
                  <td className="py-3.5 px-4 text-slate-600">
                    Trocas e Devoluções, Prazos de Envio, Garantia Legal e Horário de Atendimento
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <Badge variant="success">Disponível</Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Sobre a Documentação da Loja">
          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <p>
              As políticas oficiais estabelecem os padrões de atendimento da <strong>Empório da Música</strong> em Campo Grande - MS. O documento reúne as diretrizes oficiais que orientam tanto o atendimento ao cliente quanto as decisões operacionais da equipe.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="font-semibold text-slate-800 mb-1">Trocas e Devoluções</div>
                <p className="text-[11px] text-slate-500">
                  Regras para devoluções por arrependimento em até 7 dias e trocas por defeitos em até 30 dias, conforme as políticas da loja.
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="font-semibold text-slate-800 mb-1">Prazos e Entregas</div>
                <p className="text-[11px] text-slate-500">
                  Condições de envio para Campo Grande e região, incluindo política de frete e prazos dos Correios e transportadoras.
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="font-semibold text-slate-800 mb-1">Pagamentos e Condições</div>
                <p className="text-[11px] text-slate-500">
                  Formas de pagamento aceitas, regras para descontos à vista e condições de parcelamento no cartão de crédito.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
