// 테스트 단계: 아이디/비밀번호만으로 간편 가입. 추후 이메일 인증, 카카오 로그인 예정
import React, { useState } from 'react';
import { containsProfanity } from '../profanity.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { replaceAppHash } from '../utils/appUtils.js';
import { getApiUrl } from '../utils/apiConfig.js';

const registerPrimaryBtnClass =
  'w-full rounded-xl bg-gradient-to-b from-amber-200/95 via-amber-500 to-amber-800 py-3.5 text-[17px] font-semibold tracking-wide text-amber-950 shadow-[0_8px_28px_rgba(180,83,9,0.28)] ring-1 ring-inset ring-white/30 transition [text-shadow:0_1px_0_rgba(255,255,255,0.25)] hover:brightness-[1.04] hover:shadow-[0_10px_32px_rgba(180,83,9,0.34)] active:translate-y-px active:shadow-[0_5px_18px_rgba(180,83,9,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none';

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
            replaceAppHash('#/set-nickname');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const inputClass =
        'w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-zinc-500 transition focus:border-amber-500/45 focus:outline-none focus:ring-2 focus:ring-amber-500/20 sm:px-5 sm:py-3.5 sm:text-lg';

    return (
        <div className="mx-auto flex w-full min-w-0 max-w-[min(100%,440px)] justify-center py-2 sm:max-w-[min(100%,460px)] lg:max-w-[min(100%,520px)]">
            <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 p-6 pb-7 pt-8 shadow-[0_24px_56px_-18px_rgba(0,0,0,0.78)] backdrop-blur-md ring-1 ring-inset ring-white/[0.07] sm:p-7 sm:pt-8 lg:p-8 lg:pt-9">
                <div
                    className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent"
                    aria-hidden
                />
                <div className="mb-5 border-b border-white/[0.06] pb-5 sm:mb-6 sm:pb-6">
                    <h2 className="text-lg font-semibold tracking-tight text-stone-100 sm:text-xl">회원가입</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-400 sm:mt-2">아이디와 비밀번호만으로 간단히 가입할 수 있습니다.</p>
                </div>
                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="username-register" className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                                아이디
                            </label>
                            <input
                                id="username-register"
                                name="username"
                                type="text"
                                required
                                autoComplete="username"
                                className={inputClass}
                                placeholder="2~20자"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                minLength={USERNAME_MIN_LENGTH}
                                maxLength={USERNAME_MAX_LENGTH}
                            />
                        </div>
                        <div>
                            <label htmlFor="password-register" className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                                비밀번호
                            </label>
                            <input
                                id="password-register"
                                name="password"
                                type="password"
                                required
                                autoComplete="new-password"
                                className={inputClass}
                                placeholder="4자 이상"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="password-confirm" className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                                비밀번호 확인
                            </label>
                            <input
                                id="password-confirm"
                                name="passwordConfirm"
                                type="password"
                                required
                                autoComplete="new-password"
                                className={inputClass}
                                placeholder="다시 입력"
                                value={passwordConfirm}
                                onChange={e => setPasswordConfirm(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && (
                        <p className="rounded-lg bg-red-950/35 px-3 py-2.5 text-center text-sm leading-snug text-red-200 ring-1 ring-red-500/25">
                            {error}
                        </p>
                    )}

                    <div className="w-full pt-1">
                        <button type="submit" disabled={isLoading} className={registerPrimaryBtnClass}>
                            {isLoading ? '가입하는 중...' : '가입하기'}
                        </button>
                    </div>
                </form>
                <div className="mt-6 text-center text-sm">
                    <a
                        href="#"
                        onClick={(e) => {
                            e.preventDefault();
                            window.location.hash = '';
                        }}
                        className="font-medium text-amber-200/85 transition hover:text-amber-100"
                    >
                        이미 계정이 있으신가요? <span className="text-amber-400/90">로그인</span>
                    </a>
                </div>
            </div>
        </div>
    );
};

export default Register;
