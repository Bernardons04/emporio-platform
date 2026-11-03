'use client';

import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function AdminKnowledgeBasePage() {
  return (
    <AdminLayout
      title="Knowledge Base Management"
      subtitle="Store policies documents, chunking status, and hybrid vector retrieval index"
      actions={
        <Button variant="primary" size="sm" disabled>
          Upload Document
        </Button>
      }
    >
      <div className="space-y-6">
        <Card
          title="Indexed Store Documents"
          subtitle="Official policies and operational guides for RAG assistance"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Title</th>
                  <th className="py-3 px-4 font-semibold">File</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Chunks</th>
                  <th className="py-3 px-4 font-semibold">Ingestion Phase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="py-3.5 px-4 font-medium text-slate-900">
                    Políticas da Loja Empório da Música
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">politicas_da_loja.pdf</td>
                  <td className="py-3.5 px-4">
                    <Badge variant="success">Completed</Badge>
                  </td>
                  <td className="py-3.5 px-4 font-semibold">8 chunks</td>
                  <td className="py-3.5 px-4">
                    <span className="text-[11px] text-slate-500">Phase 3 Seeded / Phase 6 Vectorized</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Knowledge Base Notice">
          <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg text-sky-900 text-xs leading-relaxed">
            <strong>Phase 6 & 8 Roadmap:</strong> Embedding vector generation with OpenRouter and hybrid retrieval search will be activated in Phase 6. Real-time document upload, reprocessing, and manual chunk preview will be integrated into this panel during Phase 8.
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}

