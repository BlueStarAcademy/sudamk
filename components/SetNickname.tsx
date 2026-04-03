import React, { useState, useEffect } from 'react';
import Button from './Button.js';
import { containsProfanity } from '../profanity.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { getApiUrl } from '../utils/apiConfig.js';
import { replaceAppHash } from '../utils/appUtils.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

const NICKNAME_MIN_LENGTH = 2;
const NICKNAME_MAX_LENGTH = 6;

const SetNickname: React.FC = () => {
    const { currentUser, setCurrentUserAndRoute } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const [nickname, setNickname] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [validationMessage, setValidationMessage] = useState<string | null>(null);
    const [isNicknameChecking, setIsNicknameChecking] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // 이미 닉네임이 설정되어 있으면 프로필로 이동
        if (currentUser && currentUser.nickname && !currentUser.nickname.startsWith('user_')) {
            replaceAppHash('#/profile');
        }
    }, [currentUser]);

    useEffect(() => {
        let cancelled = false;
        const trimmed = nickname.trim();

        if (!trimmed) {
            setValidationMessage(null);
            setIsNicknameChecking(false);
            return;
        }

        if (trimmed.length < NICKNAME_MIN_LENGTH || trimmed.length > NICKNAME_MAX_LENGTH) {
            setValidationMessage(`닉네임은 ${NICKNAME_MIN_LENGTH}자 이상 ${NICKNAME_MAX_LENGTH}자 이하로 입력해주세요.`);
            setIsNicknameChecking(false);
            return;
        }

        if (containsProfanity(trimmed)) {
            setValidationMessage('닉네임에 부적절한 단어가 포함되어 있습니다.');
            setIsNicknameChecking(false);
            return;
        }

        setValidationMessage(null);
        setIsNicknameChecking(true);
        const timer = setTimeout(async () => {
            try {
                const query = new URLSearchParams({
                    nickname: trimmed,
                    userId: currentUser?.id ?? '',
                });
                const response = await fetch(getApiUrl(`/api/auth/check-nickname?${query.toString()}`));
                const data = await response.json();

                if (cancelled) return;

                if (!response.ok || !data.available) {
                    setValidationMessage(data.message || '이미 사용 중인 닉네임입니다.');
                    return;
                }
                setValidationMessage(null);
            } catch (_e) {
                if (!cancelled) {
                    setValidationMessage('닉네임 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
                }
            } finally {
                if (!cancelled) {
                    setIsNicknameChecking(false);
                }
            }
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [nickname, currentUser?.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!nickname.trim()) {
            setError("닉네임을 입력해주세요.");
            return;
        }

        const trimmedNickname = nickname.trim();
        if (trimmedNickname.length < NICKNAME_MIN_LENGTH || trimmedNickname.length > NICKNAME_MAX_LENGTH) {
            setError(`닉네임은 ${NICKNAME_MIN_LENGTH}자 이상 ${NICKNAME_MAX_LENGTH}자 이하로 입력해주세요.`);
            return;
        }

        if (containsProfanity(trimmedNickname)) {
            setError("닉네임에 부적절한 단어가 포함되어 있습니다.");
            return;
        }

        if (validationMessage) {
            setError(validationMessage);
            return;
        }

        if (!currentUser) {
            setError("로그인이 필요합니다.");
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(getApiUrl('/api/auth/set-nickname'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname: trimmedNickname, userId: currentUser.id }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '닉네임 설정에 실패했습니다.');
            }

            const data = await response.json();
            setCurrentUserAndRoute(data.user);
            replaceAppHash('#/profile');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!currentUser) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <p className="text-gray-400 mb-4">로그인이 필요합니다.</p>
                    <a 
                        href="#/" 
                        className="text-blue-400 hover:text-blue-300"
                        onClick={(e) => {
                            e.preventDefault();
                            window.location.hash = '#/';
                        }}
                    >
                        로그인 페이지로 이동
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex items-center justify-center py-8 ${isNativeMobile ? 'min-h-[85dvh] px-3' : 'min-h-screen py-12'}`}>
            <div className={`w-full space-y-6 bg-gray-800 rounded-lg shadow-2xl border border-color ${isNativeMobile ? 'max-w-full p-5' : 'max-w-md p-8'}`}>
                <div>
                    <h2 className="text-3xl font-bold text-center text-white">닉네임 설정</h2>
                    <p className="mt-2 text-center text-gray-400">게임에서 사용할 닉네임을 설정해주세요. (2~6자, 비속어 불가, 중복 불가)</p>
                    <p className="mt-1 text-xs text-center text-gray-500">닉네임을 설정해야 홈화면에 입장할 수 있습니다.</p>
                </div>
                <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="nickname-set" className="sr-only">Nickname</label>
                        <input
                            id="nickname-set"
                            name="nickname"
                            type="text"
                            required
                            autoFocus
                            className="appearance-none rounded-md relative block w-full px-4 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                            placeholder="닉네임 (2-6자)"
                            value={nickname}
                            onChange={e => setNickname(e.target.value)}
                            minLength={NICKNAME_MIN_LENGTH}
                            maxLength={NICKNAME_MAX_LENGTH}
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            {nickname.length > 0 && (
                                <span className={nickname.length >= NICKNAME_MIN_LENGTH && nickname.length <= NICKNAME_MAX_LENGTH ? 'text-green-400' : 'text-red-400'}>
                                    {nickname.length} / {NICKNAME_MIN_LENGTH}-{NICKNAME_MAX_LENGTH}자
                                </span>
                            )}
                        </p>
                    </div>

                    {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                    {!error && validationMessage && <p className="text-sm text-red-400 text-center">{validationMessage}</p>}
                    {!error && !validationMessage && isNicknameChecking && (
                        <p className="text-xs text-gray-400 text-center">닉네임 확인 중...</p>
                    )}

                    <div className="w-full flex justify-center">
                        <Button 
                            type="submit"
                            disabled={
                                isLoading ||
                                isNicknameChecking ||
                                !!validationMessage ||
                                !nickname.trim() ||
                                nickname.trim().length < NICKNAME_MIN_LENGTH ||
                                nickname.trim().length > NICKNAME_MAX_LENGTH
                            }
                            className="w-full py-3 text-lg"
                        >
                            {isLoading ? '설정 중...' : '닉네임 설정'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SetNickname;

