'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, logoutUser, User } from '@/lib/api';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    async function loadAdmin() {
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

    loadAdmin();
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-sm">Verifying administrator permissions...</div>
      </div>
    );
  }

  if (accessDenied && user) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-amber-900">Empório da Música</span>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 cursor-pointer"
          >
            Sign Out
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-lg shadow-sm border border-red-200 max-w-md w-full text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
              !
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-sm text-gray-600 mb-6">
              You are signed in as <strong>{user.email}</strong>, which does not have administrator privileges.
            </p>
            <button
              onClick={() => router.push('/chat')}
              className="w-full py-2 px-4 rounded bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              Go to Customer Area
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-xl font-bold text-amber-900">Empório da Música</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold">
            Admin Panel
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-sm font-medium text-gray-800">{user.name}</div>
            <div className="text-xs text-gray-500">{user.email}</div>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 cursor-pointer transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-6">
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Administrator Console</h2>
          <p className="text-gray-600 text-sm mb-6">
            Welcome to the store administration portal. Full admin features (Support Inbox, Knowledge Base management, Orders, and Metrics) will be developed in Phase 8.
          </p>

          <div className="p-4 bg-purple-50 rounded-md border border-purple-200">
            <h3 className="text-sm font-semibold text-purple-900 mb-1">Administrative Session Verified</h3>
            <p className="text-xs text-purple-700">
              Authenticated as: {user.name} ({user.email}) &bull; Admin Status: Active
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

