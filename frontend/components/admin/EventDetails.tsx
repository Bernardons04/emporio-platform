'use client';

import React, { useState } from 'react';
import { AdminMessageEvent } from '@/lib/api';

interface PairedToolActivity {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  rawOutput?: string;
  startSequence: number;
  endSequence?: number;
}

function formatExcerpt(raw: string): string {
  if (!raw) return '';
  return raw
    // Collapse 2 or more consecutive newlines to a single line break
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function parseJsonSafe(val: unknown): Record<string, unknown> | null {
  if (!val) return null;
  if (typeof val === 'object') return val as Record<string, unknown>;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function groupEventsIntoActivities(events: AdminMessageEvent[]): PairedToolActivity[] {
  const activities: PairedToolActivity[] = [];
  const startMap = new Map<string, PairedToolActivity>();

  // Sort events by sequence asc
  const sorted = [...events].sort((a, b) => a.sequence - b.sequence);

  for (const ev of sorted) {
    const payload = ev.payload || {};
    const toolCallId = (payload.tool_call_id as string) || '';
    const toolName = (payload.tool_name as string) || ev.event_type;

    if (ev.event_type === 'tool_start') {
      const activity: PairedToolActivity = {
        id: ev.id,
        toolName,
        args: (payload.tool_args as Record<string, unknown>) || {},
        startSequence: ev.sequence,
      };
      activities.push(activity);
      if (toolCallId) {
        startMap.set(toolCallId, activity);
      }
    } else if (ev.event_type === 'tool_end') {
      const rawOutput = typeof payload.tool_output === 'string' ? payload.tool_output : JSON.stringify(payload.tool_output);
      const parsedOutput = parseJsonSafe(payload.tool_output);

      let matchedActivity: PairedToolActivity | undefined;
      if (toolCallId && startMap.has(toolCallId)) {
        matchedActivity = startMap.get(toolCallId);
      } else {
        // Match with last activity with same tool name and no output yet
        matchedActivity = activities.slice().reverse().find((a) => a.toolName === toolName && !a.output && !a.rawOutput);
      }

      if (matchedActivity) {
        matchedActivity.output = parsedOutput;
        matchedActivity.rawOutput = rawOutput;
        matchedActivity.endSequence = ev.sequence;
      } else {
        // Standalone tool_end
        activities.push({
          id: ev.id,
          toolName,
          args: {},
          output: parsedOutput,
          rawOutput,
          startSequence: ev.sequence,
          endSequence: ev.sequence,
        });
      }
    }
  }

  return activities;
}

function KnowledgeBaseActivityView({ act }: { act: PairedToolActivity }) {
  const [expanded, setExpanded] = useState(false);
  const query = (act.args.query as string) || '';
  const chunks = (act.output?.chunks as Array<Record<string, unknown>>) || [];
  const totalFound = typeof act.output?.total_results === 'number' ? act.output.total_results : chunks.length;

  return (
    <div className="border border-sky-100 bg-sky-50/40 rounded-lg p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
            <span>Consultou a base de conhecimento</span>
          </div>
          {query && (
            <div className="text-slate-600 pl-3.5">
              <span className="text-slate-400">Pesquisa realizada:</span>{' '}
              <span className="font-medium text-slate-700">“{query}”</span>
            </div>
          )}
          <div className="text-slate-600 pl-3.5">
            <span className="text-slate-400">Resultados encontrados:</span>{' '}
            <span className="font-medium text-slate-800">
              {totalFound === 1 ? '1 trecho' : `${totalFound} trechos`}
            </span>
          </div>
        </div>

        {chunks.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] font-medium text-sky-700 hover:text-sky-900 bg-white border border-sky-200 px-2 py-1 rounded cursor-pointer shrink-0"
          >
            {expanded ? 'Ocultar trechos' : 'Ver trechos encontrados'}
          </button>
        )}
      </div>

      {expanded && chunks.length > 0 && (
        <div className="mt-3 pt-3 border-t border-sky-100 space-y-2.5">
          <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
            Trechos encontrados ({chunks.length}):
          </div>
          {chunks.map((chk, idx) => {
            const docName = (chk.document_name as string) || (chk.file_name as string) || 'Documento';
            const page = chk.page as number | undefined;
            const excerpt = (chk.excerpt as string) || (chk.content as string) || '';
            const score = typeof chk.score === 'number' ? chk.score : null;

            return (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded p-2.5 space-y-1.5 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                    <span className="text-sky-600 font-bold">#{idx + 1}</span>
                    <span>{docName}</span>
                    {page && (
                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                        pág. {page}
                      </span>
                    )}
                  </div>
                  {score !== null && (
                    <span className="text-[10px] text-slate-400">
                      Relevância: {score.toFixed(3)}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-700 leading-normal font-sans bg-slate-50/70 p-2.5 rounded border border-slate-100 whitespace-pre-line">
                  {formatExcerpt(excerpt)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProductsActivityView({ act }: { act: PairedToolActivity }) {
  const [expanded, setExpanded] = useState(false);
  const query = (act.args.query as string) || '';
  const category = (act.args.category_name as string) || '';
  const products = (act.output?.products as Array<Record<string, unknown>>) || [];
  const totalFound = typeof act.output?.total_found === 'number' ? act.output.total_found : products.length;

  return (
    <div className="border border-emerald-100 bg-emerald-50/40 rounded-lg p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>Consultou o catálogo de produtos</span>
          </div>
          {(query || category) && (
            <div className="text-slate-600 pl-3.5">
              <span className="text-slate-400">Filtro aplicado:</span>{' '}
              <span className="font-medium text-slate-700">
                {query ? `“${query}”` : ''}
                {query && category ? ' na categoria ' : ''}
                {category && !query ? `Categoria: ${category}` : category}
              </span>
            </div>
          )}
          <div className="text-slate-600 pl-3.5">
            <span className="text-slate-400">Produtos encontrados:</span>{' '}
            <span className="font-medium text-slate-800">
              {totalFound === 1 ? '1 produto' : `${totalFound} produtos`}
            </span>
          </div>
        </div>

        {products.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] font-medium text-emerald-800 hover:text-emerald-950 bg-white border border-emerald-200 px-2 py-1 rounded cursor-pointer shrink-0"
          >
            {expanded ? 'Ocultar lista' : 'Ver produtos'}
          </button>
        )}
      </div>

      {expanded && products.length > 0 && (
        <div className="mt-3 pt-3 border-t border-emerald-100 space-y-2">
          {products.map((p, idx) => {
            const name = (p.name as string) || 'Produto';
            const cat = (p.category as string) || '';
            const price = typeof p.price_brl === 'number' ? p.price_brl : null;
            const inStock = p.in_stock === true || (typeof p.stock_quantity === 'number' && p.stock_quantity > 0);

            return (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded p-2 text-[11px] flex items-center justify-between gap-3 shadow-2xs"
              >
                <div>
                  <div className="font-medium text-slate-800">{name}</div>
                  {cat && <div className="text-[10px] text-slate-400">{cat}</div>}
                </div>
                <div className="text-right shrink-0">
                  {price !== null && (
                    <div className="font-semibold text-slate-800">
                      R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                  <div className={`text-[10px] ${inStock ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                    {inStock ? 'Em estoque' : 'Indisponível'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PromotionsActivityView({ act }: { act: PairedToolActivity }) {
  const [expanded, setExpanded] = useState(false);
  const category = (act.args.category_name as string) || '';
  const promos = (act.output?.promotions as Array<Record<string, unknown>>) || [];
  const totalFound = typeof act.output?.total_active_promotions === 'number' ? act.output.total_active_promotions : promos.length;

  return (
    <div className="border border-purple-100 bg-purple-50/40 rounded-lg p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
            <span>Consultou promoções ativas</span>
          </div>
          {category && (
            <div className="text-slate-600 pl-3.5">
              <span className="text-slate-400">Categoria:</span>{' '}
              <span className="font-medium text-slate-700">{category}</span>
            </div>
          )}
          <div className="text-slate-600 pl-3.5">
            <span className="text-slate-400">Promoções encontradas:</span>{' '}
            <span className="font-medium text-slate-800">
              {totalFound === 1 ? '1 promoção' : `${totalFound} promoções`}
            </span>
          </div>
        </div>

        {promos.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] font-medium text-purple-800 hover:text-purple-950 bg-white border border-purple-200 px-2 py-1 rounded cursor-pointer shrink-0"
          >
            {expanded ? 'Ocultar promoções' : 'Ver promoções'}
          </button>
        )}
      </div>

      {expanded && promos.length > 0 && (
        <div className="mt-3 pt-3 border-t border-purple-100 space-y-2">
          {promos.map((pr, idx) => {
            const prodName = (pr.product_name as string) || 'Produto em promoção';
            const discount = typeof pr.discount_percent === 'number' ? pr.discount_percent : null;
            const promoPrice = typeof pr.promotional_price_brl === 'number' ? pr.promotional_price_brl : null;
            const desc = (pr.description as string) || '';

            return (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded p-2 text-[11px] flex items-center justify-between gap-3 shadow-2xs"
              >
                <div>
                  <div className="font-medium text-slate-800">{prodName}</div>
                  {desc && <div className="text-[10px] text-slate-500">{desc}</div>}
                </div>
                <div className="text-right shrink-0">
                  {discount !== null && (
                    <span className="inline-block bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded text-[10px]">
                      -{discount}% OFF
                    </span>
                  )}
                  {promoPrice !== null && (
                    <div className="font-semibold text-slate-800 mt-0.5">
                      R$ {promoPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CustomerOrdersActivityView({ act }: { act: PairedToolActivity }) {
  const [expanded, setExpanded] = useState(false);
  const orderId = act.args.order_id as number | undefined;
  const orders = (act.output?.orders as Array<Record<string, unknown>>) || [];
  const errorMsg = act.output?.error as string | undefined;

  return (
    <div className="border border-amber-100 bg-amber-50/40 rounded-lg p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            <span>Consultou pedidos do cliente</span>
          </div>
          {orderId && (
            <div className="text-slate-600 pl-3.5">
              <span className="text-slate-400">Pedido específico:</span>{' '}
              <span className="font-medium text-slate-700">#{orderId}</span>
            </div>
          )}
          <div className="text-slate-600 pl-3.5">
            <span className="text-slate-400">Status da busca:</span>{' '}
            <span className="font-medium text-slate-800">
              {errorMsg
                ? errorMsg
                : orders.length === 0
                ? 'Nenhum pedido encontrado'
                : orders.length === 1
                ? '1 pedido recuperado'
                : `${orders.length} pedidos recuperados`}
            </span>
          </div>
        </div>

        {orders.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] font-medium text-amber-900 hover:text-amber-950 bg-white border border-amber-200 px-2 py-1 rounded cursor-pointer shrink-0"
          >
            {expanded ? 'Ocultar pedidos' : 'Ver pedidos'}
          </button>
        )}
      </div>

      {expanded && orders.length > 0 && (
        <div className="mt-3 pt-3 border-t border-amber-100 space-y-2">
          {orders.map((ord, idx) => {
            const oId = String(ord.order_id || '');
            const status = (ord.status as string) || 'Em processamento';
            const total = typeof ord.total_brl === 'number' ? ord.total_brl : null;
            const tracking = ord.tracking_code as string | undefined;
            const items = (ord.items as Array<Record<string, unknown>>) || [];

            return (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded p-2.5 text-[11px] space-y-1.5 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Pedido #{oId}</span>
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-medium capitalize">
                    {status}
                  </span>
                </div>
                {total !== null && (
                  <div className="text-slate-600">
                    <span className="text-slate-400">Valor total:</span> R${' '}
                    {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
                {tracking && (
                  <div className="text-slate-600">
                    <span className="text-slate-400">Rastreio:</span>{' '}
                    <span className="font-mono text-[10px]">{tracking}</span>
                  </div>
                )}
                {items.length > 0 && (
                  <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                    Itens: {items.map((it) => `${it.quantity}x ${it.product_name}`).join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EscalateActivityView({ act }: { act: PairedToolActivity }) {
  const reason = (act.args.reason as string) || (act.output?.reason as string) || '';
  const protocol = (act.output?.protocol as string) || '';
  const ticketId = (act.output?.ticket_id as string) || '';

  return (
    <div className="border border-rose-200 bg-rose-50/60 rounded-lg p-3 text-xs space-y-1.5">
      <div className="flex items-center gap-1.5 font-semibold text-rose-900">
        <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
        <span>Encaminhou para suporte humano</span>
      </div>
      {protocol && (
        <div className="pl-3.5 text-slate-700">
          <span className="text-slate-500">Protocolo gerado:</span>{' '}
          <span className="font-mono font-bold text-rose-700">{protocol}</span>
        </div>
      )}
      {reason && (
        <div className="pl-3.5 text-slate-700">
          <span className="text-slate-500">Motivo:</span>{' '}
          <span className="italic text-slate-800">“{reason}”</span>
        </div>
      )}
      {ticketId && (
        <div className="pl-3.5 text-[10px] text-slate-400 font-mono">
          Ticket ID: {ticketId}
        </div>
      )}
    </div>
  );
}

function GenericActivityView({ act }: { act: PairedToolActivity }) {
  return (
    <div className="border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-xs space-y-1">
      <div className="font-semibold text-slate-700">
        Atividade: <span className="text-[#2B5276]">{act.toolName}</span>
      </div>
      {Object.keys(act.args).length > 0 && (
        <div className="text-[11px] text-slate-600">
          Parâmetros: {JSON.stringify(act.args)}
        </div>
      )}
      {act.rawOutput && (
        <div className="text-[11px] text-slate-500 truncate">
          Retorno: {act.rawOutput}
        </div>
      )}
    </div>
  );
}

export function EventDetails({ events }: { events: AdminMessageEvent[] }) {
  const [open, setOpen] = useState(false);

  if (!events || events.length === 0) return null;

  const activities = groupEventsIntoActivities(events);

  return (
    <div className="mt-2.5 pt-2 border-t border-slate-200/60">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer select-none"
      >
        <span className="text-[9px] text-[#2B5276]">{open ? '▼' : '▶'}</span>
        <span>Atividades e ferramentas da IA</span>
        <span className="bg-slate-200 text-slate-700 rounded-full px-1.5 py-0.2 text-[10px]">
          {activities.length}
        </span>
      </button>

      {open && (
        <div className="space-y-2 mt-2.5">
          {activities.map((act) => {
            switch (act.toolName) {
              case 'search_store_policies':
                return <KnowledgeBaseActivityView key={act.id} act={act} />;
              case 'search_products':
                return <ProductsActivityView key={act.id} act={act} />;
              case 'search_promotions':
                return <PromotionsActivityView key={act.id} act={act} />;
              case 'get_customer_orders':
                return <CustomerOrdersActivityView key={act.id} act={act} />;
              case 'escalate_to_human_support':
                return <EscalateActivityView key={act.id} act={act} />;
              default:
                return <GenericActivityView key={act.id} act={act} />;
            }
          })}
        </div>
      )}
    </div>
  );
}
