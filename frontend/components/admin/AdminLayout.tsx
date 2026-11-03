'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, logoutUser, User } from '@/lib/api';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function AdminLayout({
  children,
  title,
  subtitle,
  actions,
}: AdminLayoutProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    async function loadAdminUser() {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
          router.replace('/');
          return;
        }

        if (!currentUser.is_admin) {
          setAccessDenied(true);
          setUser(currentUser);
          return;
        }

        setUser(currentUser);
      } catch {
        router.replace('/');
      } finally {
        setLoading(false);
      }
    }

    loadAdminUser();
  }, [router]);

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      router.replace('/');
      router.refresh();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#2B5276] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-slate-600">Verifying administrator permissions...</span>
        </div>
      </div>
    );
  }

  if (accessDenied && user) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <header className="bg-[#2B5276] text-white px-6 py-4 flex items-center justify-between shadow-xs">
          <div className="font-bold text-base">Empório da Música</div>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 rounded border border-white/20 cursor-pointer"
          >
            Sign Out
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-xl shadow-md border border-red-200 max-w-md w-full text-center">
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-2xl border border-red-200">
              !
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-sm text-slate-600 mb-6">
              You are signed in as <strong>{user.email}</strong>, which does not have administrator privileges.
            </p>
            <button
              onClick={() => router.push('/chat')}
              className="w-full py-2.5 px-4 rounded-lg bg-[#2B5276] hover:bg-[#22425f] text-white text-sm font-medium transition-colors cursor-pointer"
            >
              Go to Customer Area
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Persistent admin sidebar */}
      <AdminSidebar
        isOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        userName={user.name}
        userEmail={user.email}
        onLogout={handleLogout}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              aria-label="Open sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div>
              {title ? (
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                  {title}
                </h1>
              ) : null}
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {actions}
            <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-slate-200">
              <span className="w-8 h-8 rounded-full bg-[#2B5276] text-white flex items-center justify-center text-xs font-bold">
                {user.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="text-left text-xs">
                <span className="font-semibold text-slate-800 block leading-tight">{user.name}</span>
                <span className="text-slate-500 text-[11px]">Administrator</span>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

