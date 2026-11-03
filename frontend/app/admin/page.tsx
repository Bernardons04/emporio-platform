'use client';

import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export default function AdminHomePage() {
  return (
    <AdminLayout
      title="Painel de Administração"
      subtitle="Gestão operacional, catálogo de instrumentos e atendimento da Empório da Música"
    >
      <div className="space-y-6">
        {/* Banner de Boas-vindas */}
        <div className="bg-gradient-to-r from-[#2B5276] to-[#4986C1] rounded-xl p-6 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E6A211] text-slate-950 mb-3">
              Empório da Música — Campo Grande / MS
            </div>
            <h2 className="text-xl font-bold">Central de Gestão e Atendimento</h2>
            <p className="text-slate-100 text-sm mt-1 max-w-xl">
              Acompanhe o catálogo de instrumentos musicais, campanhas promocionais ativas, políticas comerciais e os atendimentos aos clientes em um único ambiente.
            </p>
          </div>
          <Link href="/admin/conversations">
            <Button variant="accent" size="md">
              Atendimentos
            </Button>
          </Link>
        </div>

        {/* Módulos do Sistema */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/admin/conversations" className="block group">
            <Card className="h-full hover:border-[#4986C1] transition-all group-hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Suporte
                </span>
                <Badge variant="primary">Atendimento</Badge>
              </div>
              <h4 className="text-lg font-bold text-slate-900 group-hover:text-[#2B5276]">
                Conversas e Chamados
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Acompanhamento do histórico de conversas e solicitações de suporte de clientes.
              </p>
            </Card>
          </Link>

          <Link href="/admin/knowledge-base" className="block group">
            <Card className="h-full hover:border-[#4986C1] transition-all group-hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Políticas
                </span>
                <Badge variant="secondary">Institucional</Badge>
              </div>
              <h4 className="text-lg font-bold text-slate-900 group-hover:text-[#2B5276]">
                Políticas da Loja
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Consulta às diretrizes de trocas, devoluções, garantias, prazos e condições comerciais.
              </p>
            </Card>
          </Link>

          <Link href="/admin/products" className="block group">
            <Card className="h-full hover:border-[#4986C1] transition-all group-hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Catálogo
                </span>
                <Badge variant="default">Estoque</Badge>
              </div>
              <h4 className="text-lg font-bold text-slate-900 group-hover:text-[#2B5276]">
                Produtos
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Gestão de instrumentos musicais, controle de estoque, categorias e precificação.
              </p>
            </Card>
          </Link>

          <Link href="/admin/promotions" className="block group">
            <Card className="h-full hover:border-[#4986C1] transition-all group-hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Comercial
                </span>
                <Badge variant="accent">Descontos</Badge>
              </div>
              <h4 className="text-lg font-bold text-slate-900 group-hover:text-[#2B5276]">
                Promoções
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Visualização de ofertas ativas, percentuais de desconto e produtos participantes.
              </p>
            </Card>
          </Link>
        </div>

        {/* Atalhos Rápidos */}
        <Card title="Acesso Rápido">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/admin/products"
              className="p-4 rounded-lg border border-slate-200 hover:border-[#4986C1] hover:bg-slate-50 transition-all flex items-center justify-between group"
            >
              <div>
                <h5 className="font-semibold text-sm text-slate-800 group-hover:text-[#2B5276]">
                  Gerenciar Catálogo de Produtos
                </h5>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consulte estoque, altere preços e cadastre novos instrumentos
                </p>
              </div>
              <span className="text-slate-400 group-hover:text-[#2B5276]">&rarr;</span>
            </Link>

            <Link
              href="/chat"
              className="p-4 rounded-lg border border-slate-200 hover:border-[#4986C1] hover:bg-slate-50 transition-all flex items-center justify-between group"
            >
              <div>
                <h5 className="font-semibold text-sm text-slate-800 group-hover:text-[#2B5276]">
                  Acessar Área do Cliente
                </h5>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verificar a experiência conversacional de atendimento da loja
                </p>
              </div>
              <span className="text-slate-400 group-hover:text-[#2B5276]">&rarr;</span>
            </Link>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
