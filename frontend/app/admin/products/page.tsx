'use client';

import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const SAMPLE_PRODUCTS = [
  { id: 1, name: 'Violão Tagima Dallas Elétrico', category: 'Cordas', price: 'R$ 1.199,00', stock: 12 },
  { id: 2, name: 'Teclado Yamaha PSR-E373', category: 'Teclas', price: 'R$ 1.850,00', stock: 5 },
  { id: 3, name: 'Bateria Eletrônica Roland TD-02K', category: 'Percussão', price: 'R$ 3.890,00', stock: 3 },
  { id: 4, name: 'Microfone Shure SM58', category: 'Áudio & Microfones', price: 'R$ 950,00', stock: 20 },
];

export default function AdminProductsPage() {
  return (
    <AdminLayout
      title="Product Catalog"
      subtitle="Structured inventory, prices, and musical instrument records in PostgreSQL"
      actions={
        <Button variant="primary" size="sm" disabled>
          New Product
        </Button>
      }
    >
      <div className="space-y-6">
        <Card
          title="Musical Instruments Inventory"
          subtitle="Showing preview of structured product records from database"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">ID</th>
                  <th className="py-3 px-4 font-semibold">Product Name</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Unit Price</th>
                  <th className="py-3 px-4 font-semibold">Stock</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {SAMPLE_PRODUCTS.map((prod) => (
                  <tr key={prod.id}>
                    <td className="py-3.5 px-4 font-mono text-slate-400">#{prod.id}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-900">{prod.name}</td>
                    <td className="py-3.5 px-4 text-slate-600">{prod.category}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{prod.price}</td>
                    <td className="py-3.5 px-4 font-mono">{prod.stock} un</td>
                    <td className="py-3.5 px-4">
                      <Badge variant={prod.stock > 5 ? 'success' : 'warning'}>
                        {prod.stock > 5 ? 'In Stock' : 'Low Stock'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <p className="text-xs text-slate-500">
          * Full product management CRUD operations, stock updates, and search filters will be implemented in Phase 8.
        </p>
      </div>
    </AdminLayout>
  );
}

