'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import RegisterForm from '@/components/auth/RegisterForm';
import { getCurrentUser } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    async function checkExistingAuth() {
      try {
        const user = await getCurrentUser();
        if (user) {
          if (user.is_admin) {
            router.replace('/admin');
          } else {
            router.replace('/chat');
          }
          return;
        }
      } catch {
        // Not authenticated
      } finally {
        setCheckingAuth(false);
      }
    }

    checkExistingAuth();
  }, [router]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#2B5276] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-slate-600">Verificando sessão...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand logo mark */}
        <div className="mx-auto w-14 h-14 rounded-xl bg-[#2B5276] text-white flex items-center justify-center shadow-md mb-4">
          <svg className="w-8 h-8 text-[#E6A211]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold text-[#2B5276] tracking-tight">
          Empório da Música
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Plataforma de atendimento ao cliente e loja de instrumentos musicais
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md rounded-xl sm:px-10 border border-slate-200">
          {/* Navigation tabs */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 pb-3 text-center text-sm font-medium border-b-2 transition-all cursor-pointer ${
                mode === 'login'
                  ? 'border-[#2B5276] text-[#2B5276] font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 pb-3 text-center text-sm font-medium border-b-2 transition-all cursor-pointer ${
                mode === 'register'
                  ? 'border-[#2B5276] text-[#2B5276] font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Cadastrar
            </button>
          </div>

          {mode === 'login' ? <LoginForm /> : <RegisterForm />}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Campo Grande, MS &bull; Portal Oficial Empório da Música
        </p>
      </div>
    </div>
  );
}
