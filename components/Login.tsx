
import React, { useState } from 'react';
import Button from './Button.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { getApiUrl } from '../utils/apiConfig.js';

const Login: React.FC = () => {
  const { setCurrentUserAndRoute, handlers } = useAppContext();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ ok: boolean; message: string; url: string } | null>(null);

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
      
      setCurrentUserAndRoute(data.user);
      if (data.mutualDisconnectMessage && typeof handlers.showMutualDisconnectMessage === 'function') {
        handlers.showMutualDisconnectMessage(data.mutualDisconnectMessage);
      }
      // 닉네임이 없거나 임시 닉네임이면 닉네임 설정 화면으로, 아니면 프로필로
      if (!data.user.nickname || data.user.nickname.startsWith('user_')) {
        window.location.hash = '#/set-nickname';
      } else {
        window.location.hash = '#/profile';
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
        setError('서버에 연결할 수 없습니다. 아래 "연결 확인"으로 API 주소와 상태를 확인한 뒤, Railway 대시보드에서 SUDAM-API 서비스를 확인·재배포해주세요.');
        setConnectionStatus(null);
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

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-sm p-6 space-y-6 bg-gray-800 rounded-lg shadow-2xl border border-color">
        <div>
          <p className="mt-2 text-center text-gray-400">아이디와 비밀번호를 입력하여 로그인하세요.</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="username-login" className="sr-only">Username</label>
              <input
                id="username-login"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="appearance-none rounded-md relative block w-full px-4 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="아이디"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
             <div>
              <label htmlFor="password-login" className="sr-only">Password</label>
              <input
                id="password-login"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-md relative block w-full px-4 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={async () => {
                const url = getApiUrl('/api/health');
                setConnectionStatus({ ok: false, message: '확인 중...', url });
                try {
                  const res = await fetch(url, { method: 'GET', credentials: 'omit', signal: AbortSignal.timeout(8000) });
                  const ok = res.ok;
                  const text = await res.text();
                  let msg = ok ? '연결됨' : `HTTP ${res.status}`;
                  try {
                    const json = JSON.parse(text);
                    if (json.status === 'ok') msg = '연결됨 (서버 정상)';
                  } catch {
                    if (text.length < 80) msg += ` - ${text}`;
                  }
                  setConnectionStatus({ ok, message: msg, url });
                } catch (e: any) {
                  setConnectionStatus({
                    ok: false,
                    message: e?.name === 'TimeoutError' ? '타임아웃 (8초)' : (e?.message || '연결 실패'),
                    url,
                  });
                }
              }}
              className="text-xs text-gray-500 hover:text-gray-300 underline"
            >
              연결 확인
            </button>
            {connectionStatus && (
              <p className="text-xs text-center break-all">
                <span className={connectionStatus.ok ? 'text-green-400' : 'text-amber-400'}>
                  {connectionStatus.message}
                </span>
                <br />
                <span className="text-gray-500">{connectionStatus.url}</span>
              </p>
            )}
          </div>

          <div className="w-full flex justify-center">
             <Button 
                type="submit"
                disabled={isLoading}
                className="w-full py-3 text-lg"
             >
                {isLoading ? '로그인 중...' : '로그인'}
             </Button>
          </div>
        </form>
         <div className="text-sm text-center">
            <a href="#/register" onClick={(e) => { e.preventDefault(); window.location.hash = '#/register'; }} className="font-medium text-blue-400 hover:text-blue-300">
              계정이 없으신가요? 회원가입
            </a>
          </div>

        <div className="relative">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-800 text-gray-400">또는 소셜 계정으로 로그인</span>
            </div>
        </div>

        <div className="flex justify-center gap-3">
             <Button 
                colorScheme="yellow" 
                className="w-full"
                onClick={async () => {
                    try {
                        const apiUrl = getApiUrl('/api/auth/kakao/url');
                        console.log('[Login] Attempting Kakao login URL fetch:', apiUrl);
                        
                        const response = await fetch(apiUrl);
                        
                        // 응답 Content-Type 확인
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
                카카오 로그인
             </Button>
        </div>
      </div>
    </div>
  );
};

export default Login;
