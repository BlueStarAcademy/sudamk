
import React, { useState } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import { replaceAppHash } from '../utils/appUtils.js';
import { getApiUrl } from '../utils/apiConfig.js';

const loginPrimaryBtnClass =
  'w-full rounded-xl bg-gradient-to-b from-amber-200/95 via-amber-500 to-amber-800 py-3.5 text-[17px] font-semibold tracking-wide text-amber-950 shadow-[0_8px_28px_rgba(180,83,9,0.28)] ring-1 ring-inset ring-white/30 transition [text-shadow:0_1px_0_rgba(255,255,255,0.25)] hover:brightness-[1.04] hover:shadow-[0_10px_32px_rgba(180,83,9,0.34)] active:translate-y-px active:shadow-[0_5px_18px_rgba(180,83,9,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none';

const loginKakaoBtnClass =
  'w-full rounded-xl bg-[#FEE500] py-3.5 text-[16px] font-bold leading-tight text-[#191919] shadow-[0_6px_22px_rgba(0,0,0,0.14)] ring-1 ring-inset ring-black/[0.07] transition hover:brightness-[1.03] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FEE500]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950';

const loginRegisterBtnClass =
  'w-full rounded-xl border border-white/18 bg-white/[0.06] py-3.5 text-[16px] font-semibold tracking-wide text-stone-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-amber-400/35 hover:bg-white/[0.1] hover:text-amber-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950';

const Login: React.FC = () => {
  const { setCurrentUserAndRoute, handlers } = useAppContext();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const apiUrl = getApiUrl('/api/auth/login');
      console.log('[Login] Attempting login to:', apiUrl);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'omit',
        mode: 'cors',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      // 응답 Content-Type 확인
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      
      console.log('[Login] Response status:', response.status);
      console.log('[Login] Response Content-Type:', contentType);
      console.log('[Login] Response OK:', response.ok);
      
      // HTML 응답인 경우 (백엔드 서버가 응답하지 않거나 잘못된 URL)
      if (!isJson) {
        const text = await response.text();
        console.error('[Login] Received non-JSON response:', text.substring(0, 200));
        
        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
          setError('백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
          return;
        }
        
        setError(`서버 응답 오류: 예상하지 못한 응답 형식을 받았습니다. (상태: ${response.status})`);
        return;
      }
      
      if (!response.ok) {
        if (response.status === 502) {
          setError('서버가 일시적으로 응답하지 않습니다 (502). 잠시 후 다시 시도하거나 Railway 대시보드에서 백엔드 로그를 확인해주세요.');
          return;
        }
        let errorMessage = `로그인 실패 (${response.statusText})`;
        try {
            const errorData = await response.json();
            if (errorData && errorData.message) {
                errorMessage = errorData.message;
            }
        } catch (e) {
            console.error("Login failed with a non-JSON response body.", e);
            setError(`서버 응답 오류: JSON 파싱 실패 (상태: ${response.status})`);
            return;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (!data || !data.user) {
        setError('서버 응답 오류: 사용자 정보를 받을 수 없습니다.');
        return;
      }
      
      setCurrentUserAndRoute(data.user, { activeGame: data.activeGame ?? undefined });
      if (data.mutualDisconnectMessage && typeof handlers.showMutualDisconnectMessage === 'function') {
        handlers.showMutualDisconnectMessage(data.mutualDisconnectMessage);
      }
      // 진행 중인 경기가 있으면 게임으로 이동, 없으면 닉네임/프로필
      if (data.activeGame) {
        replaceAppHash(`#/game/${data.activeGame.id}`);
      } else if (!data.user.nickname || data.user.nickname.startsWith('user_')) {
        replaceAppHash('#/set-nickname');
      } else {
        replaceAppHash('#/profile');
      }
    } catch (err: any) {
      console.error('[Login] Login error:', err);
      
      if (err?.name === 'AbortError') {
        setError('서버 응답이 30초 내에 없습니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      // 네트워크 에러 (Failed to fetch, CORS, 연결 거부 등)
      const msg = err?.message || '';
      const isNetworkError = err?.name === 'TypeError' && (msg.includes('fetch') || msg.includes('Failed to'));
      if (isNetworkError) {
        setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도하거나 SUDAM-API 서비스 상태를 확인해주세요.');
        return;
      }
      if (msg.includes('JSON')) {
        setError('서버 응답 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      setError(err?.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 text-lg text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-zinc-500 transition focus:border-amber-500/45 focus:outline-none focus:ring-2 focus:ring-amber-500/20 sm:px-5 sm:py-4 sm:text-xl';

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[min(100%,440px)] justify-center sm:max-w-[min(100%,460px)] lg:max-w-[min(100%,520px)]">
      <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 p-7 pb-8 pt-8 shadow-[0_24px_56px_-18px_rgba(0,0,0,0.78)] backdrop-blur-md ring-1 ring-inset ring-white/[0.07] sm:p-8 sm:pb-9 sm:pt-9 lg:p-8 lg:pt-9">
        <div
          className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent"
          aria-hidden
        />
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="username-login" className="mb-2 block text-base font-semibold tracking-wide text-stone-200 sm:text-lg">
                아이디
              </label>
              <input
                id="username-login"
                name="username"
                type="text"
                autoComplete="username"
                required
                className={inputClass}
                placeholder="아이디를 입력하세요"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password-login" className="mb-2 block text-base font-semibold tracking-wide text-stone-200 sm:text-lg">
                비밀번호
              </label>
              <input
                id="password-login"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={inputClass}
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-950/35 px-3 py-2.5 text-center text-sm leading-snug text-red-200 ring-1 ring-red-500/25">
              {error}
            </p>
          )}

          <div className="w-full space-y-3 pt-1">
            <button type="submit" disabled={isLoading} className={loginPrimaryBtnClass}>
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
            <button
              type="button"
              className={loginRegisterBtnClass}
              onClick={() => {
                window.location.hash = '#/register';
              }}
            >
              회원가입
            </button>
          </div>
        </form>

        <div className="relative mt-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="rounded-full bg-zinc-950/90 px-4 py-0.5 text-zinc-500 ring-1 ring-white/[0.06]">
              소셜 계정으로 계속하기
            </span>
          </div>
        </div>

        <div className="mt-5 sm:mt-6">
          <button
            type="button"
            className={loginKakaoBtnClass}
            onClick={async () => {
              try {
                const apiUrl = getApiUrl('/api/auth/kakao/url');
                console.log('[Login] Attempting Kakao login URL fetch:', apiUrl);

                const response = await fetch(apiUrl);

                const contentType = response.headers.get('content-type');
                const isJson = contentType && contentType.includes('application/json');

                if (!isJson) {
                  const text = await response.text();
                  console.error('[Login] Kakao URL: Received non-JSON response:', text.substring(0, 200));
                  if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
                    setError('백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
                  } else {
                    setError('카카오 로그인 URL을 가져올 수 없습니다.');
                  }
                  return;
                }

                const data = await response.json();
                if (data.url) {
                  window.location.href = data.url;
                } else {
                  setError('카카오 로그인 URL을 받을 수 없습니다.');
                }
              } catch (err: any) {
                console.error('[Login] Kakao login error:', err);
                const msg = err?.message || '';
                if (err?.name === 'TypeError' && (msg.includes('fetch') || msg.includes('Failed to'))) {
                  setError('서버에 연결할 수 없습니다. SUDAM-API가 실행 중인지 Railway 대시보드에서 확인해주세요.');
                } else {
                  setError('카카오 로그인에 실패했습니다.');
                }
              }
            }}
          >
            카카오로 계속하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
