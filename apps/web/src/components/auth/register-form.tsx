/**
 * Register form component
 */

'use client';

import { useState } from 'react';
import { useAuthStore } from '../../stores/auth-store';
import { trpc } from '../../lib/trpc/utils';

export function RegisterForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const login = useAuthStore((state) => state.login);
  const registerMutation = trpc.user.register.useMutation({
    onSuccess: (data) => {
      login(data.user, data.token);
      setError(null);
    },
    onError: (err) => {
      setError(err.message || 'Registration failed');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    registerMutation.mutate({
      username,
      password,
      nickname,
      email: email || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="username" className="block text-sm font-medium">
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          required
          minLength={3}
          maxLength={20}
        />
      </div>
      
      <div>
        <label htmlFor="nickname" className="block text-sm font-medium">
          Nickname
        </label>
        <input
          id="nickname"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          required
          minLength={2}
          maxLength={20}
        />
      </div>
      
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email (Optional)
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          required
          minLength={6}
        />
      </div>
      
      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}
      
      <button
        type="submit"
        disabled={registerMutation.isPending}
        className="w-full rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
      >
        {registerMutation.isPending ? 'Registering...' : 'Register'}
      </button>
    </form>
  );
}

