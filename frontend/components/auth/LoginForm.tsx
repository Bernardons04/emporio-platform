'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, User } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await apiRequest<User>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (user.is_admin) {
        router.push('/admin');
      } else {
        router.push('/chat');
      }
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Falha ao entrar. Por favor, verifique suas credenciais.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm rounded-md bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <Input
        label="E-mail"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="nome@exemplo.com"
        autoComplete="email"
      />

      <Input
        label="Senha"
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        autoComplete="current-password"
      />

      <Button
        type="submit"
        variant="primary"
        size="md"
        isLoading={loading}
        className="w-full mt-2"
      >
        Entrar
      </Button>
    </form>
  );
}
