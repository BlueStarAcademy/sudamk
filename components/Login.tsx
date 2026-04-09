
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import { replaceAppHash } from '../utils/appUtils.js';
import { getApiUrl } from '../utils/apiConfig.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

const MOBILE_LOGIN_PREFS_KEY = 'sudamr_mobile_login_prefs';
const MOBILE_AUTO_LOGIN_TRIED_KEY = 'sudamr_autologin_tried_v1';

type MobileLoginPrefs = {
  rememberUsername: boolean;
  autoLogin: boolean;
  username?: string;
  password?: string;
};

function readMobileLoginPrefs(): MobileLoginPrefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(MOBILE_LOGIN_PREFS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as MobileLoginPrefs;
    if (!p || typeof p !== 'object') return null;
    return p;
  } catch {
    return null;
  }
}

function writeMobileLoginPrefs(prefs: MobileLoginPrefs | null) {
  if (typeof window === 'undefined') return;
  try {
    if (!prefs || (!prefs.rememberUsername && !prefs.autoLogin)) {
      localStorage.removeItem(MOBILE_LOGIN_PREFS_KEY);
      return;
    }
    const toSave: MobileLoginPrefs = {
      rememberUsername: prefs.rememberUsername,
      autoLogin: prefs.autoLogin,
    };
    if (prefs.rememberUsername || prefs.autoLogin) {
      toSave.username = prefs.username?.trim() || '';
    }
    if (prefs.autoLogin && prefs.password) {
      toSave.password = prefs.password;
    }
    localStorage.setItem(MOBILE_LOGIN_PREFS_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error('[Login] Failed to save mobile login prefs', e);
  }
}

const loginPrimaryBtnClass =
  'w-full rounded-xl bg-gradient-to-b from-amber-200/95 via-amber-500 to-amber-800 py-3.5 text-[17px] font-semibold tracking-wide text-amber-950 shadow-[0_8px_28px_rgba(180,83,9,0.28)] ring-1 ring-inset ring-white/30 transition [text-shadow:0_1px_0_rgba(255,255,255,0.25)] hover:brightness-[1.04] hover:shadow-[0_10px_32px_rgba(180,83,9,0.34)] active:translate-y-px active:shadow-[0_5px_18px_rgba(180,83,9,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none';

const loginKakaoBtnClass =
  'w-full rounded-xl bg-[#FEE500] py-3.5 text-[16px] font-semibold tracking-wide text-black/85 shadow-[0_6px_22px_rgba(0,0,0,0.14)] ring-1 ring-inset ring-black/[0.07] transition hover:brightness-[1.03] hover:shadow-[0_8px_26px_rgba(0,0,0,0.18)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FEE500]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950';

const loginGoogleBtnClass =
  'w-full rounded-xl bg-white py-3.5 text-[16px] font-semibold tracking-wide text-zinc-700 shadow-[0_6px_22px_rgba(0,0,0,0.14)] ring-1 ring-inset ring-black/[0.07] transition hover:bg-gray-50 hover:shadow-[0_8px_26px_rgba(0,0,0,0.18)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950';

const loginRegisterBtnClass =
  'w-full rounded-xl border border-white/18 bg-white/[0.06] py-3.5 text-[16px] font-semibold tracking-wide text-stone-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-amber-400/35 hover:bg-white/[0.1] hover:text-amber-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950';

const Login: React.FC = () => {
  const { setCurrentUserAndRoute, handlers } = useAppContext();
  const { isNativeMobile } = useNativeMobileShell();

  const initialPrefs = typeof window !== 'undefined' ? readMobileLoginPrefs() : null;
  const [rememberUsername, setRememberUsername] = useState(
    () => !!(initialPrefs?.rememberUsername || initialPrefs?.autoLogin),
  );
  const [autoLogin, setAutoLogin] = useState(() => !!initialPrefs?.autoLogin);
  const [username, setUsername] = useState(() => initialPrefs?.username?.trim() || '');
  const [password, setPassword] = useState(() =>
    initialPrefs?.autoLogin && initialPrefs?.password ? initialPrefs.password : '',
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window === 'undefined') return false;
    const p = readMobileLoginPrefs();
    return !!(p?.autoLogin && p.username?.trim() && p.password);
  });
  const [banInfo, setBanInfo] = useState<{
    reason: string;
    expiresAt?: number;
    remainingMinutes?: number;
    history?: Array<{ id?: string; reason?: string; createdAt?: number; expiresAt?: number; releasedAt?: number }>;
  } | null>(null);

  const loginWithCredentials = useCallback(
    async (user: string, pass: string, opts?: { persistPrefs?: boolean }) => {
      const u = user.trim();
      const p = pass.trim();
      if (!u || !p) {
        setError('아이디와 비밀번호를 모두 입력해주세요.');
        return false;
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
          body: JSON.stringify({ username: u, password: p }),
          credentials: 'omit',
          mode: 'cors',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type');
        const isJson = contentType && contentType.includes('application/json');

        console.log('[Login] Response status:', response.status);
        console.log('[Login] Response Content-Type:', contentType);
        console.log('[Login] Response OK:', response.ok);

        if (!isJson) {
          const text = await response.text();
          console.error('[Login] Received non-JSON response:', text.substring(0, 200));

          if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
            setError('백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
            return false;
          }

          setError(`서버 응답 오류: 예상하지 못한 응답 형식을 받았습니다. (상태: ${response.status})`);
          return false;
        }

        if (!response.ok) {
          if (response.status === 502) {
            setError(
              '서버가 일시적으로 응답하지 않습니다 (502). 잠시 후 다시 시도하거나 Railway 대시보드에서 백엔드 로그를 확인해주세요.',
            );
            return false;
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
            console.error('Login failed with a non-JSON response body.', e);
            setError(`서버 응답 오류: JSON 파싱 실패 (상태: ${response.status})`);
            return false;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();

        if (!data || !data.user) {
          setError('서버 응답 오류: 사용자 정보를 받을 수 없습니다.');
          return false;
        }

        setCurrentUserAndRoute(data.user, { activeGame: data.activeGame ?? undefined });
        if (data.mutualDisconnectMessage && typeof handlers.showMutualDisconnectMessage === 'function') {
          handlers.showMutualDisconnectMessage(data.mutualDisconnectMessage);
        }

        const persist = opts?.persistPrefs !== false;
        if (persist) {
          if (!rememberUsername && !autoLogin) {
            writeMobileLoginPrefs(null);
          } else {
            writeMobileLoginPrefs({
              rememberUsername: rememberUsername || autoLogin,
              autoLogin,
              username: u,
              password: autoLogin ? p : undefined,
            });
          }
        }

        if (data.activeGame) {
          replaceAppHash(`#/game/${data.activeGame.id}`);
        } else if (!data.user.nickname || data.user.nickname.startsWith('user_')) {
          replaceAppHash('#/set-nickname');
        } else {
          replaceAppHash('#/profile');
        }
        return true;
      } catch (err: any) {
        console.error('[Login] Login error:', err);

        if (err?.name === 'AbortError') {
          setError('서버 응답이 30초 내에 없습니다. 잠시 후 다시 시도해주세요.');
          return false;
        }
        const msg = err?.message || '';
        const isNetworkError = err?.name === 'TypeError' && (msg.includes('fetch') || msg.includes('Failed to'));
        if (isNetworkError) {
          setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도하거나 SUDAM-API 서비스 상태를 확인해주세요.');
          return false;
        }
        if (msg.includes('JSON')) {
          setError('서버 응답 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
          return false;
        }
        setError(err?.message || '로그인 중 오류가 발생했습니다.');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [autoLogin, handlers, rememberUsername, setCurrentUserAndRoute],
  );

  const loginWithCredentialsRef = useRef(loginWithCredentials);
  loginWithCredentialsRef.current = loginWithCredentials;

  useEffect(() => {
    let prefs: MobileLoginPrefs | null = null;
    try {
      const raw = localStorage.getItem(MOBILE_LOGIN_PREFS_KEY);
      prefs = raw ? (JSON.parse(raw) as MobileLoginPrefs) : null;
    } catch {
      return;
    }
    if (!prefs?.autoLogin || !prefs.username?.trim() || !prefs.password) return;
    if (sessionStorage.getItem(MOBILE_AUTO_LOGIN_TRIED_KEY)) return;
    sessionStorage.setItem(MOBILE_AUTO_LOGIN_TRIED_KEY, '1');
    const u = prefs.username!.trim();
    const p = prefs.password;
    void (async () => {
      const ok = await loginWithCredentialsRef.current(u, p, { persistPrefs: false });
      if (!ok) {
        sessionStorage.removeItem(MOBILE_AUTO_LOGIN_TRIED_KEY);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginWithCredentials(username, password, { persistPrefs: true });
  };

  const inputClass = isNativeMobile
    ? 'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[14px] text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-zinc-500 transition focus:border-amber-500/45 focus:outline-none focus:ring-2 focus:ring-amber-500/20'
    : 'w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 text-lg text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-zinc-500 transition focus:border-amber-500/45 focus:outline-none focus:ring-2 focus:ring-amber-500/20 sm:px-5 sm:py-4 sm:text-xl';

  const mobileCheckboxClass =
    'h-4 w-4 shrink-0 rounded border-white/25 bg-black/50 text-amber-500 shadow-sm focus:ring-2 focus:ring-amber-500/35 focus:ring-offset-0 focus:ring-offset-zinc-950';

  const desktopCheckboxClass =
    'h-[17px] w-[17px] shrink-0 rounded border-white/25 bg-black/50 text-amber-500 shadow-sm focus:ring-2 focus:ring-amber-500/40 focus:ring-offset-2 focus:ring-offset-zinc-950';

  const mobilePrimaryBtnClass = `${loginPrimaryBtnClass} !py-2.5 !text-[15px] !rounded-lg`;
  const mobileRegisterBtnClass = `${loginRegisterBtnClass} !py-2.5 !text-[14px] !rounded-lg`;
  const mobileKakaoBtnClass = `${loginKakaoBtnClass} !py-2.5 !text-[14px] !rounded-lg`;
  const mobileGoogleBtnClass = `${loginGoogleBtnClass} !py-2.5 !text-[14px] !rounded-lg`;

  return (
    <div
      className={
        isNativeMobile
          ? 'mx-auto flex w-full min-w-0 max-w-[min(100%,300px)] justify-center px-2 pb-[max(0.35rem,env(safe-area-inset-bottom,0px))]'
          : 'mx-auto flex w-full min-w-0 max-w-[min(100%,360px)] justify-center sm:max-w-[min(100%,380px)] lg:max-w-[min(100%,400px)]'
      }
    >
      <div
        className={`relative w-full border border-white/10 bg-zinc-950/80 shadow-[0_16px_40px_-14px_rgba(0,0,0,0.72)] backdrop-blur-md ring-1 ring-inset ring-white/[0.07] subpixel-antialiased [text-rendering:optimizeLegibility] ${
          isNativeMobile
            ? 'overflow-x-hidden rounded-xl p-3 pb-3.5 pt-3.5'
            : 'overflow-hidden rounded-xl p-5 pb-6 pt-6 sm:rounded-2xl sm:p-7 sm:pb-8 sm:pt-8 lg:p-7 lg:pt-8'
        }`}
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
        <form className={isNativeMobile ? 'space-y-3' : 'space-y-4'} onSubmit={handleSubmit}>
          <div className={isNativeMobile ? 'space-y-2.5' : 'space-y-3.5'}>
            <div>
              <label
                htmlFor="username-login"
                className={
                  isNativeMobile
                    ? 'mb-1 block text-xs font-semibold tracking-wide text-stone-200'
                    : 'mb-2 block text-base font-semibold tracking-wide text-stone-200 sm:text-lg'
                }
              >
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
              <label
                htmlFor="password-login"
                className={
                  isNativeMobile
                    ? 'mb-1 block text-xs font-semibold tracking-wide text-stone-200'
                    : 'mb-2 block text-base font-semibold tracking-wide text-stone-200 sm:text-lg'
                }
              >
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
            <div
              className={`flex w-full items-center justify-center pt-0.5 ${
                isNativeMobile ? 'gap-x-3 gap-y-1' : 'gap-x-5 gap-y-1.5'
              }`}
            >
              <label
                className={`flex cursor-pointer select-none items-center justify-center gap-1.5 leading-tight text-stone-300 active:opacity-90 ${
                  isNativeMobile ? 'text-[11px]' : 'text-xs sm:text-[13px]'
                }`}
              >
                <input
                  type="checkbox"
                  className={isNativeMobile ? mobileCheckboxClass : desktopCheckboxClass}
                  checked={rememberUsername}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setRememberUsername(v);
                    if (!v) setAutoLogin(false);
                  }}
                />
                <span className="truncate">아이디 저장</span>
              </label>
              <label
                className={`flex cursor-pointer select-none items-center justify-center gap-1.5 leading-tight text-stone-300 active:opacity-90 ${
                  isNativeMobile ? 'text-[11px]' : 'text-xs sm:text-[13px]'
                }`}
              >
                <input
                  type="checkbox"
                  className={isNativeMobile ? mobileCheckboxClass : desktopCheckboxClass}
                  checked={autoLogin}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setAutoLogin(v);
                    if (v) setRememberUsername(true);
                  }}
                />
                <span>자동 로그인</span>
              </label>
            </div>
          </div>

          {error && (
            <p
              className={
                isNativeMobile
                  ? 'rounded-md bg-red-950/35 px-2 py-2 text-center text-[11px] leading-snug text-red-200 ring-1 ring-red-500/25'
                  : 'rounded-lg bg-red-950/35 px-3 py-2.5 text-center text-sm leading-snug text-red-200 ring-1 ring-red-500/25'
              }
            >
              {error}
            </p>
          )}

          <div className={`w-full pt-0.5 ${isNativeMobile ? 'space-y-2' : 'space-y-3 pt-1'}`}>
            <button
              type="submit"
              disabled={isLoading}
              className={isNativeMobile ? mobilePrimaryBtnClass : loginPrimaryBtnClass}
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
            <button
              type="button"
              className={isNativeMobile ? mobileRegisterBtnClass : loginRegisterBtnClass}
              onClick={() => {
                window.location.hash = '#/register';
              }}
            >
              회원가입
            </button>
          </div>
        </form>

        <div className={isNativeMobile ? 'relative mt-4' : 'relative mt-6'}>
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className={`relative flex justify-center ${isNativeMobile ? 'text-[11px]' : 'text-sm'}`}>
            <span
              className={
                isNativeMobile
                  ? 'rounded-full bg-zinc-950/90 px-2.5 py-px text-zinc-500 ring-1 ring-white/[0.06]'
                  : 'rounded-full bg-zinc-950/90 px-4 py-0.5 text-zinc-500 ring-1 ring-white/[0.06]'
              }
            >
              소셜 계정으로 계속하기
            </span>
          </div>
        </div>

        <div className={isNativeMobile ? 'mt-3' : 'mt-5 sm:mt-6'}>
          <button
            type="button"
            className={`${isNativeMobile ? mobileKakaoBtnClass : loginKakaoBtnClass} flex items-center justify-center gap-2`}
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
            {/* 카카오 공식 말풍선 심볼 */}
            <svg
              width={isNativeMobile ? 16 : 18}
              height={isNativeMobile ? 16 : 18}
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path fillRule="evenodd" clipRule="evenodd" d="M9 0.6C4.02944 0.6 0 3.71267 0 7.55283C0 9.94002 1.55836 12.0451 3.93132 13.2971L2.93331 16.7981C2.84473 17.1082 3.20572 17.3567 3.47572 17.1705L7.5727 14.3437C8.03958 14.4122 8.51584 14.4486 9 14.4486C13.9706 14.4486 18 11.3889 18 7.55283C18 3.71267 13.9706 0.6 9 0.6Z" fill="black"/>
            </svg>
            카카오
          </button>
          <button
            type="button"
            className={`${isNativeMobile ? mobileGoogleBtnClass : loginGoogleBtnClass} ${isNativeMobile ? 'mt-2' : 'mt-3'} flex items-center justify-center gap-2`}
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
            <svg
              width={isNativeMobile ? 17 : 20}
              height={isNativeMobile ? 17 : 20}
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M19.6 10.2273C19.6 9.5182 19.5364 8.8364 19.4182 8.1818H10V12.05H15.3818C15.15 13.3 14.4455 14.3591 13.3864 15.0682V17.5773H16.6182C18.5091 15.8364 19.6 13.2727 19.6 10.2273Z" fill="#4285F4"/>
              <path d="M10 20C12.7 20 14.9636 19.1045 16.6181 17.5773L13.3863 15.0682C12.4909 15.6682 11.3454 16.0227 10 16.0227C7.3954 16.0227 5.1909 14.2636 4.4045 11.9H1.0636V14.4909C2.7091 17.7591 6.0909 20 10 20Z" fill="#34A853"/>
              <path d="M4.4045 11.9C4.2045 11.3 4.0909 10.6591 4.0909 10C4.0909 9.3409 4.2045 8.7 4.4045 8.1V5.5091H1.0636C0.3864 6.8591 0 8.3864 0 10C0 11.6136 0.3864 13.1409 1.0636 14.4909L4.4045 11.9Z" fill="#FBBC04"/>
              <path d="M10 3.9773C11.4681 3.9773 12.7863 4.4818 13.8227 5.4727L16.6909 2.6045C14.9591 0.9909 12.6954 0 10 0C6.0909 0 2.7091 2.2409 1.0636 5.5091L4.4045 8.1C5.1909 5.7364 7.3954 3.9773 10 3.9773Z" fill="#E94235"/>
            </svg>
            구글
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
