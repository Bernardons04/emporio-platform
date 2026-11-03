'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, User } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await apiRequest<User>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
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
        setError('Falha ao criar conta. Por favor, tente novamente.');
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
        label="Nome Completo"
        type="text"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Maria Silva"
        autoComplete="name"
      />

      <Input
        label="E-mail"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="maria.silva@exemplo.com"
        autoComplete="email"
      />

      <Input
        label="Senha"
        type="password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Mínimo de 8 caracteres"
        helperText="Deve conter pelo menos 8 caracteres"
        autoComplete="new-password"
      />

      <Button
        type="submit"
        variant="primary"
        size="md"
        isLoading={loading}
        className="w-full mt-2"
      >
        Criar Conta
      </Button>
    </form>
  );
}
