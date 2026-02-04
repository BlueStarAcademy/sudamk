'use client';

import { useMemo, useState } from 'react';
import { trpc } from '../../lib/trpc/utils';
import { useAuthStore } from '../../stores/auth-store';
import { validateNickname } from '@sudam/shared';

export function NicknameSetupModal({ open }: { open: boolean }) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);
  const utils = trpc.useUtils();

  const validationMessage = useMemo(() => {
    if (!nickname.trim()) return null;
    const result = validateNickname(nickname);
    if (result.ok) return null;
    if (result.reason === 'format') return '닉네임은 한글 1~6글자만 가능합니다.';
    if (result.reason === 'reserved') return '사용할 수 없는 닉네임입니다.';
    if (result.reason === 'profanity') return '사용할 수 없는 닉네임입니다.';
    return '사용할 수 없는 닉네임입니다.';
  }, [nickname]);

  const mutation = trpc.user.setNickname.useMutation({
    onSuccess: async (data) => {
      if (user) {
        setUser({ ...user, nickname: data.nickname });
      }
      await utils.user.me.invalidate();
      setError(null);
      setNickname('');
    },
    onError: (err) => {
      setError(err.message || '닉네임 설정에 실패했습니다.');
    },
  });

  if (!open) return null;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = validateNickname(nickname);
    if (!result.ok) {
      setError(
        result.reason === 'format'
          ? '닉네임은 한글 1~6글자만 가능합니다.'
          : '사용할 수 없는 닉네임입니다.'
      );
      return;
    }

    mutation.mutate({ nickname: nickname.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-xl font-bold">닉네임 설정</h2>
        <p className="mt-2 text-sm text-gray-600">
          게임을 이용하려면 닉네임을 <b>최초 1회</b> 설정해야 합니다.
        </p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium" htmlFor="nickname">
              닉네임 (한글 1~6)
            </label>
            <input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="예) 수담"
              maxLength={6}
              autoFocus
            />
            {validationMessage && (
              <p className="mt-1 text-xs text-red-600">{validationMessage}</p>
            )}
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? '설정 중...' : '닉네임 설정 완료'}
          </button>
        </form>
      </div>
    </div>
  );
}

