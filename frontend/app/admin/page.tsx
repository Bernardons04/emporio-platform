'use client';

import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, Badge } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export default function AdminHomePage() {
  return (
    <AdminLayout
      title="Administrative Overview"
      subtitle="Empório da Música store operations & customer management portal"
    >
      <div className="space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-[#2B5276] to-[#4986C1] rounded-xl p-6 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E6A211] text-slate-950 mb-3">
              Phase 5 Frontend & Layouts
            </div>
            <h2 className="text-xl font-bold">Admin Console Ready</h2>
            <p className="text-slate-100 text-sm mt-1 max-w-xl">
              Visual structure and responsive navigation configured with the official brand colors.
              Data management and live support tools will be integrated in Phase 8.
            </p>
          </div>
          <Link href="/admin/conversations">
            <Button variant="accent" size="md">
              View Conversations
            </Button>
          </Link>
        </div>

        {/* Feature status grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:border-[#4986C1] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Support
              </span>
              <Badge variant="accent">Phase 8</Badge>
            </div>
            <h4 className="text-lg font-bold text-slate-900">Conversations</h4>
            <p className="text-xs text-slate-500 mt-1">
              Customer support inbox with split-view layout and human escalation.
            </p>
          </Card>

          <Card className="hover:border-[#4986C1] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                RAG Docs
              </span>
              <Badge variant="secondary">Phase 6</Badge>
            </div>
            <h4 className="text-lg font-bold text-slate-900">Knowledge Base</h4>
            <p className="text-xs text-slate-500 mt-1">
              Store policies document indexing, chunks preview, and vector search.
            </p>
          </Card>

          <Card className="hover:border-[#4986C1] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Catalog
              </span>
              <Badge variant="default">Phase 8</Badge>
            </div>
            <h4 className="text-lg font-bold text-slate-900">Products</h4>
            <p className="text-xs text-slate-500 mt-1">
              Musical instruments, brand management, inventory counts, and prices.
            </p>
          </Card>

          <Card className="hover:border-[#4986C1] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Marketing
              </span>
              <Badge variant="default">Phase 8</Badge>
            </div>
            <h4 className="text-lg font-bold text-slate-900">Promotions</h4>
            <p className="text-xs text-slate-500 mt-1">
              Active discounts, coupons, category offers, and campaign validation.
            </p>
          </Card>
        </div>

        {/* Quick Links section */}
        <Card title="Quick Navigation">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/admin/conversations"
              className="p-4 rounded-lg border border-slate-200 hover:border-[#4986C1] hover:bg-slate-50 transition-all flex items-center justify-between group"
            >
              <div>
                <h5 className="font-semibold text-sm text-slate-800 group-hover:text-[#2B5276]">
                  Support Inbox Layout
                </h5>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inspect the split-view layout for handling customer tickets
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
                  Switch to Customer Chat
                </h5>
                <p className="text-xs text-slate-500 mt-0.5">
                  View the store customer interaction interface
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
