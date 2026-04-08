
import React, { useState } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import { replaceAppHash } from '../utils/appUtils.js';
import { getApiUrl } from '../utils/apiConfig.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

const loginPrimaryBtnClass =
  'w-full rounded-xl bg-gradient-to-b from-amber-200/95 via-amber-500 to-amber-800 py-3.5 text-[17px] font-semibold tracking-wide text-amber-950 shadow-[0_8px_28px_rgba(180,83,9,0.28)] ring-1 ring-inset ring-white/30 transition [text-shadow:0_1px_0_rgba(255,255,255,0.25)] hover:brightness-[1.04] hover:shadow-[0_10px_32px_rgba(180,83,9,0.34)] active:translate-y-px active:shadow-[0_5px_18px_rgba(180,83,9,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none';

// 카카오 공식 디자인 가이드: 배경 #FEE500, 텍스트 #000000/85%, radius 12px
const loginKakaoBtnClass =
  'w-full rounded-[12px] bg-[#FEE500] py-3.5 text-[15px] font-medium leading-tight text-black/85 transition hover:brightness-[1.03] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FEE500]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950';

// 구글 공식 브랜딩 가이드: 배경 #FFFFFF, 텍스트 #1F1F1F, 테두리 #747775 1px, Roboto Medium
const loginGoogleBtnClass =
  'w-full rounded-full bg-white py-3.5 text-[14px] font-medium leading-tight text-[#1F1F1F] ring-1 ring-inset ring-[#747775] transition hover:bg-[#F2F2F2] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950';

const loginRegisterBtnClass =
  'w-full rounded-xl border border-white/18 bg-white/[0.06] py-3.5 text-[16px] font-semibold tracking-wide text-stone-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-amber-400/35 hover:bg-white/[0.1] hover:text-amber-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950';

const Login: React.FC = () => {
  const { setCurrentUserAndRoute, handlers } = useAppContext();
  const { isNativeMobile } = useNativeMobileShell();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [banInfo, setBanInfo] = useState<{
    reason: string;
    expiresAt?: number;
    remainingMinutes?: number;
    history?: Array<{ id?: string; reason?: string; createdAt?: number; expiresAt?: number; releasedAt?: number }>;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setBanInfo(null);
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
            if (response.status === 403 && errorData?.banInfo) {
                setBanInfo(errorData.banInfo);
            }
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
    <div
      className={
        isNativeMobile
          ? 'mx-auto flex w-full min-w-0 max-w-[min(100%,500px)] justify-center px-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]'
          : 'mx-auto flex w-full min-w-0 max-w-[min(100%,440px)] justify-center sm:max-w-[min(100%,460px)] lg:max-w-[min(100%,520px)]'
      }
    >
      <div
        className={`relative w-full rounded-2xl border border-white/10 bg-zinc-950/80 p-6 pb-7 pt-7 shadow-[0_24px_56px_-18px_rgba(0,0,0,0.78)] backdrop-blur-md ring-1 ring-inset ring-white/[0.07] subpixel-antialiased [text-rendering:optimizeLegibility] sm:p-8 sm:pb-9 sm:pt-9 lg:p-8 lg:pt-9 ${isNativeMobile ? 'overflow-x-hidden' : 'overflow-hidden'}`}
      >
        {banInfo && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-950/35 p-3 text-sm text-red-100">
            <div className="font-semibold mb-1">접속 금지 상태입니다.</div>
            <div>사유: {banInfo.reason || '관리자 제재'}</div>
            {typeof banInfo.remainingMinutes === 'number' && <div>남은 기간: 약 {banInfo.remainingMinutes}분</div>}
            {banInfo.expiresAt && <div>해제 예정: {new Date(banInfo.expiresAt).toLocaleString()}</div>}
            {Array.isArray(banInfo.history) && banInfo.history.length > 0 && (
              <div className="mt-2">
                <div className="text-red-200 mb-1">제재 내역</div>
                <div className="max-h-24 overflow-y-auto space-y-1 text-xs">
                  {banInfo.history.map((h, idx) => (
                    <div key={h.id || `${idx}-${h.createdAt || 0}`} className="rounded bg-black/30 px-2 py-1">
                      {h.reason || '사유 없음'} / {h.createdAt ? new Date(h.createdAt).toLocaleString() : '-'}
                      {h.releasedAt ? ' / 해제됨' : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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
            className="w-full rounded-[12px] overflow-hidden transition hover:brightness-[1.03] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FEE500]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
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
            {/* 카카오 공식 로그인 버튼 이미지 */}
            <img src="/images/oauth/kakao_login.png" alt="카카오 로그인" className="w-full h-[48px] object-contain" />
          </button>
          <button
            type="button"
            className={`${loginGoogleBtnClass} mt-3 flex items-center justify-center gap-2`}
            style={{ fontFamily: "'Roboto', system-ui, sans-serif" }}
            onClick={async () => {
              try {
                const apiUrl = getApiUrl('/api/auth/google/url');
                const response = await fetch(apiUrl);

                const contentType = response.headers.get('content-type');
                const isJson = contentType && contentType.includes('application/json');

                if (!isJson) {
                  setError('구글 로그인 URL을 가져올 수 없습니다.');
                  return;
                }

                const data = await response.json();
                if (data.url) {
                  window.location.href = data.url;
                } else {
                  setError('구글 로그인 URL을 받을 수 없습니다.');
                }
              } catch (err: any) {
                console.error('[Login] Google login error:', err);
                setError('구글 로그인에 실패했습니다.');
              }
            }}
          >
            {/* 구글 공식 컬러 G 로고 (공식 에셋 기반) */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.6 10.2273C19.6 9.5182 19.5364 8.8364 19.4182 8.1818H10V12.05H15.3818C15.15 13.3 14.4455 14.3591 13.3864 15.0682V17.5773H16.6182C18.5091 15.8364 19.6 13.2727 19.6 10.2273Z" fill="#4285F4"/>
              <path d="M10 20C12.7 20 14.9636 19.1045 16.6181 17.5773L13.3863 15.0682C12.4909 15.6682 11.3454 16.0227 10 16.0227C7.3954 16.0227 5.1909 14.2636 4.4045 11.9H1.0636V14.4909C2.7091 17.7591 6.0909 20 10 20Z" fill="#34A853"/>
              <path d="M4.4045 11.9C4.2045 11.3 4.0909 10.6591 4.0909 10C4.0909 9.3409 4.2045 8.7 4.4045 8.1V5.5091H1.0636C0.3864 6.8591 0 8.3864 0 10C0 11.6136 0.3864 13.1409 1.0636 14.4909L4.4045 11.9Z" fill="#FBBC04"/>
              <path d="M10 3.9773C11.4681 3.9773 12.7863 4.4818 13.8227 5.4727L16.6909 2.6045C14.9591 0.9909 12.6954 0 10 0C6.0909 0 2.7091 2.2409 1.0636 5.5091L4.4045 8.1C5.1909 5.7364 7.3954 3.9773 10 3.9773Z" fill="#E94235"/>
            </svg>
            Google로 계속하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
