import React, { useState } from 'react';
import { containsProfanity } from '../profanity.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { replaceAppHash } from '../utils/appUtils.js';
import { getApiUrl } from '../utils/apiConfig.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

const registerPrimaryBtnClass =
  'w-full rounded-xl bg-gradient-to-b from-amber-200/95 via-amber-500 to-amber-800 py-3.5 text-[17px] font-semibold tracking-wide text-amber-950 shadow-[0_8px_28px_rgba(180,83,9,0.28)] ring-1 ring-inset ring-white/30 transition [text-shadow:0_1px_0_rgba(255,255,255,0.25)] hover:brightness-[1.04] hover:shadow-[0_10px_32px_rgba(180,83,9,0.34)] active:translate-y-px active:shadow-[0_5px_18px_rgba(180,83,9,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none';

const registerPrimaryBtnMobileClass = `${registerPrimaryBtnClass} !py-2.5 !text-[15px] !rounded-lg`;

const USERNAME_MIN_LENGTH = 2;
const USERNAME_MAX_LENGTH = 20;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Register: React.FC = () => {
    const { setCurrentUserAndRoute } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const trimmedUsername = username.trim();
        const trimmedPassword = password.trim();

        const trimmedEmail = email.trim();
        if (!trimmedUsername || !trimmedPassword || !trimmedEmail) {
            setError("아이디, 이메일, 비밀번호를 입력해주세요.");
            return;
        }
        if (!EMAIL_REGEX.test(trimmedEmail)) {
            setError("올바른 이메일 주소를 입력해주세요.");
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
            const requestBody = {
                username: trimmedUsername,
                password: trimmedPassword,
                email: trimmedEmail,
            };
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

    const inputClass = isNativeMobile
        ? 'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[14px] text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-zinc-500 transition focus:border-amber-500/45 focus:outline-none focus:ring-2 focus:ring-amber-500/20'
        : 'w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 text-lg text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-zinc-500 transition focus:border-amber-500/45 focus:outline-none focus:ring-2 focus:ring-amber-500/20 sm:px-5 sm:py-4 sm:text-xl';

    const labelClass = isNativeMobile
        ? 'mb-1 block text-xs font-semibold tracking-wide text-stone-200'
        : 'mb-2 block text-base font-semibold tracking-wide text-stone-200 sm:text-lg';

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
                <div
                    className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent"
                    aria-hidden
                />
                <div
                    className={`border-b border-white/[0.06] ${isNativeMobile ? 'mb-3 pb-3' : 'mb-4 pb-4 sm:mb-5 sm:pb-5'}`}
                >
                    <h2
                        className={
                            isNativeMobile
                                ? 'text-base font-semibold tracking-tight text-stone-100'
                                : 'text-lg font-semibold tracking-tight text-stone-100 sm:text-xl'
                        }
                    >
                        회원가입
                    </h2>
                </div>
                <form className={isNativeMobile ? 'space-y-3' : 'space-y-4'} onSubmit={handleSubmit}>
                    <div className={isNativeMobile ? 'space-y-2.5' : 'space-y-3.5'}>
                        <div>
                            <label htmlFor="username-register" className={labelClass}>
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
                            <label htmlFor="email-register" className={labelClass}>
                                이메일
                            </label>
                            <input
                                id="email-register"
                                name="email"
                                type="email"
                                required
                                autoComplete="email"
                                className={inputClass}
                                placeholder="example@email.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="password-register" className={labelClass}>
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
                            <label htmlFor="password-confirm" className={labelClass}>
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

                    <div className={`w-full ${isNativeMobile ? 'pt-0.5' : 'pt-1'}`}>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={isNativeMobile ? registerPrimaryBtnMobileClass : registerPrimaryBtnClass}
                        >
                            {isLoading ? '가입하는 중...' : '가입하기'}
                        </button>
                    </div>
                </form>
                <div className={`text-center ${isNativeMobile ? 'mt-4 text-[11px] leading-snug' : 'mt-6 text-sm'}`}>
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
