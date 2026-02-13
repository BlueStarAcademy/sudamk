// 테스트 단계: 아이디/비밀번호만으로 간편 가입. 추후 이메일 인증, 카카오 로그인 예정
import React, { useState } from 'react';
import Button from './Button.js';
import { containsProfanity } from '../profanity.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { getApiUrl } from '../utils/apiConfig.js';

const USERNAME_MIN_LENGTH = 2;
const USERNAME_MAX_LENGTH = 20;

const Register: React.FC = () => {
    const { setCurrentUserAndRoute } = useAppContext();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const trimmedUsername = username.trim();
        const trimmedPassword = password.trim();

        if (!trimmedUsername || !trimmedPassword) {
            setError("아이디와 비밀번호를 입력해주세요.");
            return;
        }
        if (trimmedUsername.length < USERNAME_MIN_LENGTH || trimmedUsername.length > USERNAME_MAX_LENGTH) {
            setError(`아이디는 ${USERNAME_MIN_LENGTH}자 이상 ${USERNAME_MAX_LENGTH}자 이하로 입력해주세요.`);
            return;
        }
        if (trimmedPassword.length < 4) {
            setError("비밀번호는 4자 이상이어야 합니다.");
            return;
        }
        if (trimmedPassword !== passwordConfirm.trim()) {
            setError("비밀번호가 일치하지 않습니다.");
            return;
        }
        if (containsProfanity(trimmedUsername)) {
            setError("아이디에 부적절한 단어가 포함되어 있습니다.");
            return;
        }

        setIsLoading(true);
        try {
            const requestBody = { username: trimmedUsername, password: trimmedPassword };
            const response = await fetch(getApiUrl('/api/auth/register'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                let errorText = `회원가입 실패 (${response.statusText})`;
                try {
                    const errorData = await response.json();
                    errorText = errorData.message || errorText;
                } catch {
                    const text = await response.text();
                    if (text) errorText = text;
                }
                throw new Error(errorText);
            }

            const data = await response.json();
            setCurrentUserAndRoute(data.user);
            // 가입 후 최초 로그인 시 닉네임 설정 화면으로 이동 (임시 닉네임 user_xxx 사용)
            window.location.hash = '#/set-nickname';
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center py-12">
            <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-2xl border border-color">
                <div>
                    <h2 className="text-3xl font-bold text-center text-white">회원가입</h2>
                    <p className="mt-2 text-center text-gray-400">아이디와 비밀번호만 입력하면 됩니다.</p>
                </div>
                <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm space-y-4">
                        <div>
                            <label htmlFor="username-register" className="sr-only">Username</label>
                            <input
                                id="username-register"
                                name="username"
                                type="text"
                                required
                                autoComplete="username"
                                className="appearance-none rounded-md relative block w-full px-4 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="아이디"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                minLength={USERNAME_MIN_LENGTH}
                                maxLength={USERNAME_MAX_LENGTH}
                            />
                        </div>
                        <div>
                            <label htmlFor="password-register" className="sr-only">Password</label>
                            <input
                                id="password-register"
                                name="password"
                                type="password"
                                required
                                autoComplete="new-password"
                                className="appearance-none rounded-md relative block w-full px-4 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="비밀번호"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="password-confirm" className="sr-only">Confirm Password</label>
                            <input
                                id="password-confirm"
                                name="passwordConfirm"
                                type="password"
                                required
                                autoComplete="new-password"
                                className="appearance-none rounded-md relative block w-full px-4 py-3 border border-gray-700 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="비밀번호 확인"
                                value={passwordConfirm}
                                onChange={e => setPasswordConfirm(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-400 text-center">{error}</p>}

                    <div className="w-full flex justify-center">
                        <Button type="submit" disabled={isLoading} className="w-full py-3 text-lg">
                            {isLoading ? '가입하는 중...' : '가입하기'}
                        </Button>
                    </div>
                </form>
                <div className="text-sm text-center">
                    <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = ''; }} className="font-medium text-blue-400 hover:text-blue-300">
                        이미 계정이 있으신가요? 로그인
                    </a>
                </div>
            </div>
        </div>
    );
};

export default Register;
