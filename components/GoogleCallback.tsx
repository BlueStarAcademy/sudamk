import React, { useEffect, useState } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import { getApiUrl } from '../utils/apiConfig.js';
import { replaceAppHash } from '../utils/appUtils.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

const GoogleCallback: React.FC = () => {
    const { setCurrentUserAndRoute } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // URL에서 인증 코드 추출
                // 해시 라우팅 사용 시 ?code=xxx가 해시 안에 포함됨 (/#/auth/google/callback?code=xxx)
                const hashQuery = window.location.hash.split('?')[1] || '';
                const urlParams = new URLSearchParams(hashQuery || window.location.search);
                const code = urlParams.get('code');

                if (!code) {
                    setError('인증 코드를 받을 수 없습니다.');
                    setIsLoading(false);
                    return;
                }

                // 서버에 구글 로그인 요청
                const response = await fetch(getApiUrl('/api/auth/google/callback'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || '구글 로그인에 실패했습니다.');
                }

                const data = await response.json();

                // 로그인 성공
                setCurrentUserAndRoute(data.user);

                // 닉네임이 없거나 임시 닉네임이면 닉네임 설정 화면으로, 아니면 프로필로
                if (!data.user.nickname || data.user.nickname.startsWith('user_')) {
                    replaceAppHash('#/set-nickname');
                } else {
                    replaceAppHash('#/profile');
                }
            } catch (err: any) {
                console.error('Google callback error:', err);
                setError(err.message || '구글 로그인 처리 중 오류가 발생했습니다.');
                setIsLoading(false);
            }
        };

        handleCallback();
    }, [setCurrentUserAndRoute]);

    if (isLoading) {
        return (
            <div className={`flex w-full min-w-0 min-h-[280px] flex-col items-center justify-center py-8 ${isNativeMobile ? 'px-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]' : ''}`}>
                <div className="flex flex-col items-center text-center">
                    <div className="mb-4 h-14 w-14 animate-spin rounded-full border-b-2 border-blue-500" />
                    <p className="text-lg text-gray-400">구글 로그인 처리 중...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`flex w-full min-w-0 min-h-[280px] flex-col items-center justify-center py-8 ${isNativeMobile ? 'px-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]' : 'px-4'}`}>
                <div className="max-w-lg text-center">
                    <p className="text-red-400 text-lg mb-4 leading-snug">{error}</p>
                    <a
                        href="#/"
                        className="text-blue-400 hover:text-blue-300"
                        onClick={(e) => {
                            e.preventDefault();
                            window.location.hash = '#/';
                        }}
                    >
                        로그인 페이지로 돌아가기
                    </a>
                </div>
            </div>
        );
    }

    return null;
};

export default GoogleCallback;
