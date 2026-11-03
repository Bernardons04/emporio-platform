'use client';

import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const SAMPLE_PROMOTIONS = [
  {
    id: 1,
    name: 'Desconto à Vista no PIX',
    discount: '10% OFF',
    condition: 'Pagamento à vista via PIX',
    validity: 'Permanente',
    active: true,
  },
  {
    id: 2,
    name: 'Semana das Cordas',
    discount: '15% OFF',
    condition: 'Instrumentos da categoria Cordas',
    validity: 'Até 30/11/2026',
    active: true,
  },
  {
    id: 3,
    name: 'Frete Grátis Campo Grande',
    discount: 'Frete 100% Grátis',
    condition: 'Compras acima de R$ 300 para o município de Campo Grande/MS',
    validity: 'Permanente',
    active: true,
  },
];

export default function AdminPromotionsPage() {
  return (
    <AdminLayout
      title="Promotions & Campaigns"
      subtitle="Deterministic business rules for discounts, coupons, and seasonal offers"
      actions={
        <Button variant="primary" size="sm" disabled>
          New Promotion
        </Button>
      }
    >
      <div className="space-y-6">
        <Card
          title="Active Promotional Rules"
          subtitle="Preview of store discount rules imported from database"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Promotion Name</th>
                  <th className="py-3 px-4 font-semibold">Benefit</th>
                  <th className="py-3 px-4 font-semibold">Condition</th>
                  <th className="py-3 px-4 font-semibold">Validity</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {SAMPLE_PROMOTIONS.map((promo) => (
                  <tr key={promo.id}>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{promo.name}</td>
                    <td className="py-3.5 px-4 font-bold text-[#E6A211]">{promo.discount}</td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs">{promo.condition}</td>
                    <td className="py-3.5 px-4 text-slate-500">{promo.validity}</td>
                    <td className="py-3.5 px-4">
                      <Badge variant="accent">Active</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <p className="text-xs text-slate-500">
          * Promotion validation rules will be executed deterministically by Python in Phase 7 and manageable via CRUD in Phase 8.
        </p>
      </div>
    </AdminLayout>
  );
}

