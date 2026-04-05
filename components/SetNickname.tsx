import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Avatar from './Avatar.js';
import { containsProfanity } from '../profanity.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { getApiUrl } from '../utils/apiConfig.js';
import { replaceAppHash } from '../utils/appUtils.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { AVATAR_POOL } from '../constants';
import type { AvatarInfo, User, UserWithStatus } from '../types.js';

const NICKNAME_MIN_LENGTH = 2;
const NICKNAME_MAX_LENGTH = 6;

const CONFIRM_MODAL_MIN_H = 420;

const glassCard =
    'sudamr-panel-edge-host flex min-h-0 w-full max-w-[min(100%,520px)] max-h-full flex-col overflow-hidden rounded-[20px] border border-amber-300/35 bg-gradient-to-b from-zinc-900/95 via-zinc-950/96 to-zinc-950 shadow-[0_28px_80px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.1),0_0_60px_rgba(245,158,11,0.08)] ring-1 ring-amber-500/25 backdrop-blur-xl';

const modalShell =
    'sudamr-panel-edge-host flex flex-col overflow-hidden rounded-[26px] border border-amber-200/28 bg-gradient-to-b from-zinc-900/[0.97] via-zinc-950/[0.98] to-black/[0.94] shadow-[0_32px_100px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.14)] ring-2 ring-amber-400/20';

const primaryBtnClass =
    'w-full shrink-0 rounded-xl bg-gradient-to-b from-amber-50 via-amber-400 to-amber-700 py-2.5 text-[15px] font-bold tracking-wide text-amber-950 shadow-[0_6px_0_0_rgba(120,53,15,0.55),0_12px_28px_rgba(180,83,9,0.45),inset_0_2px_0_rgba(255,255,255,0.45)] ring-2 ring-amber-100/80 ring-inset transition hover:brightness-[1.05] active:translate-y-px active:shadow-[0_3px_0_0_rgba(120,53,15,0.5)] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 sm:py-3.5 sm:text-[16px]';

const secondaryModalBtn =
    'rounded-2xl border border-white/22 bg-gradient-to-b from-white/[0.09] to-white/[0.03] py-4 text-[16px] font-bold text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md transition hover:border-amber-400/40 hover:from-white/[0.14] active:translate-y-px';

const goldModalBtn =
    'rounded-2xl bg-gradient-to-b from-amber-100 via-amber-500 to-amber-900 py-4 text-[16px] font-bold text-amber-950 shadow-[0_12px_40px_rgba(180,83,9,0.45),inset_0_2px_0_rgba(255,255,255,0.4)] ring-2 ring-amber-300/45 ring-inset transition hover:brightness-[1.07] active:translate-y-px disabled:opacity-50';

function useUnlockedAvatars(user: UserWithStatus | null): AvatarInfo[] {
    return useMemo(() => {
        if (!user) return AVATAR_POOL.filter((a) => a.type === 'any');
        return AVATAR_POOL.filter(
            (avatar) =>
                avatar.type === 'any' ||
                (avatar.type === 'strategy' && user.strategyLevel >= avatar.requiredLevel) ||
                (avatar.type === 'playful' && user.playfulLevel >= avatar.requiredLevel),
        );
    }, [user]);
}

const SetNickname: React.FC = () => {
    const { currentUser, setCurrentUserAndRoute } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const unlockedAvatars = useUnlockedAvatars(currentUser);
    const avatarScrollRef = useRef<HTMLDivElement>(null);

    const [nickname, setNickname] = useState('');
    const [selectedAvatarId, setSelectedAvatarId] = useState<string>('profile_1');
    const [error, setError] = useState<string | null>(null);
    const [validationMessage, setValidationMessage] = useState<string | null>(null);
    const [isNicknameChecking, setIsNicknameChecking] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showStartConfirm, setShowStartConfirm] = useState(false);

    useEffect(() => {
        if (currentUser && currentUser.nickname && !currentUser.nickname.startsWith('user_')) {
            replaceAppHash('#/profile');
        }
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser?.avatarId) return;
        if (unlockedAvatars.some((a) => a.id === currentUser.avatarId)) {
            setSelectedAvatarId(currentUser.avatarId);
        }
    }, [currentUser?.avatarId, unlockedAvatars]);

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

    useEffect(() => {
        setError(null);
    }, [nickname]);

    useEffect(() => {
        const el = avatarScrollRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (el.scrollWidth <= el.clientWidth + 1) return;
            e.preventDefault();
            el.scrollLeft += e.deltaY;
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [unlockedAvatars.length]);

    const trimmedNickname = nickname.trim();

    const nicknameStatusLine = useMemo(() => {
        if (error) return { kind: 'error' as const, text: error };
        if (!trimmedNickname.length) {
            return { kind: 'muted' as const, text: '닉네임을 입력하면 중복·비속어 검사를 진행합니다.' };
        }
        if (isNicknameChecking) return { kind: 'loading' as const, text: '중복 여부를 확인하고 있습니다…' };
        if (validationMessage) return { kind: 'error' as const, text: validationMessage };
        return { kind: 'ok' as const, text: '사용할 수 있는 닉네임입니다.' };
    }, [error, trimmedNickname.length, isNicknameChecking, validationMessage]);
    const selectedAvatarUrl = useMemo(
        () => unlockedAvatars.find((a) => a.id === selectedAvatarId)?.url ?? AVATAR_POOL[0]?.url,
        [unlockedAvatars, selectedAvatarId],
    );

    const submitNicknameToServer = useCallback(async () => {
        if (!currentUser) {
            setError('로그인이 필요합니다.');
            return;
        }
        const snapshotUser = currentUser;
        const t = nickname.trim();
        setError(null);
        setIsLoading(true);
        try {
            const response = await fetch(getApiUrl('/api/auth/set-nickname'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nickname: t,
                    userId: snapshotUser.id,
                    avatarId: selectedAvatarId,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || '닉네임 설정에 실패했습니다.');
            }

            const data = (await response.json()) as { user?: Partial<User> };
            const serverPatch = data.user ?? {};
            // 서버 응답이 일부 필드만 오거나 직렬화 과정에서 닉네임이 빠지는 경우에도
            // 라우터 조건(!nickname || user_*)을 확실히 통과하도록 제출값을 병합한다.
            const merged: User = {
                ...snapshotUser,
                ...serverPatch,
                nickname: t,
                avatarId: selectedAvatarId,
            };
            setCurrentUserAndRoute(merged);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '닉네임 설정에 실패했습니다.';
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, nickname, selectedAvatarId, setCurrentUserAndRoute]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!nickname.trim()) {
            setError('닉네임을 입력해주세요.');
            return;
        }

        if (trimmedNickname.length < NICKNAME_MIN_LENGTH || trimmedNickname.length > NICKNAME_MAX_LENGTH) {
            setError(`닉네임은 ${NICKNAME_MIN_LENGTH}자 이상 ${NICKNAME_MAX_LENGTH}자 이하로 입력해주세요.`);
            return;
        }

        if (containsProfanity(trimmedNickname)) {
            setError('닉네임에 부적절한 단어가 포함되어 있습니다.');
            return;
        }

        if (validationMessage) {
            setError(validationMessage);
            return;
        }

        if (!currentUser) {
            setError('로그인이 필요합니다.');
            return;
        }

        if (isNicknameChecking) {
            setError('닉네임 확인이 끝날 때까지 잠시만 기다려주세요.');
            return;
        }

        if (!unlockedAvatars.some((a) => a.id === selectedAvatarId)) {
            setError('선택한 아바타를 사용할 수 없습니다.');
            return;
        }

        setShowStartConfirm(true);
    };

    const handleConfirmStart = async () => {
        setShowStartConfirm(false);
        await submitNicknameToServer();
    };

    const inputClass =
        'w-full rounded-lg border border-white/14 bg-black/50 px-3 py-2 text-sm text-stone-100 shadow-[inset_0_2px_8px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.04)] placeholder:text-zinc-500 transition focus:border-amber-400/50 focus:outline-none focus:ring-2 focus:ring-amber-400/30 sm:rounded-xl sm:px-4 sm:py-3 sm:text-base';

    const desktopInputClass =
        'appearance-none relative block w-full rounded-xl border border-gray-600 bg-gray-900/90 px-4 py-3 text-base text-white placeholder-gray-500 focus:z-10 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/25';

    if (!currentUser) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <p className="mb-4 text-gray-400">로그인이 필요합니다.</p>
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
        <div
            className={
                isNativeMobile
                    ? 'sudamr-native-route-root relative z-[1] h-full min-h-0 w-full overflow-hidden'
                    : 'flex h-full min-h-0 w-full flex-1 items-center justify-center overflow-hidden py-4'
            }
        >
            <div
                className={
                    isNativeMobile
                        ? 'flex h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden px-2 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] pt-[max(0.125rem,env(safe-area-inset-top,0px))]'
                        : 'flex min-h-0 w-full items-center justify-center overflow-hidden px-3'
                }
            >
                <div
                    className={
                        isNativeMobile
                            ? `${glassCard} relative z-[1] px-3 py-2.5`
                            : `${glassCard} max-w-xl space-y-5 p-7 sm:p-8`
                    }
                >
                    <div className="shrink-0 text-center">
                        <h2 className="bg-gradient-to-br from-amber-50 via-amber-200 to-amber-600 bg-clip-text text-xl font-extrabold tracking-tight text-transparent sm:text-3xl">
                            닉네임 설정
                        </h2>
                    </div>

                    <div className="mt-2 flex shrink-0 flex-col items-center gap-1 sm:mt-3 sm:gap-1.5">
                        <div
                            className="relative rounded-full p-0.5 shadow-[0_0_24px_rgba(245,158,11,0.22)] ring-2 ring-amber-400/40 ring-offset-1 ring-offset-zinc-950/90 sm:ring-offset-2"
                            aria-hidden
                        >
                            <Avatar
                                userId={currentUser.id}
                                userName={trimmedNickname || 'Player'}
                                avatarUrl={selectedAvatarUrl}
                                size={isNativeMobile ? 96 : 104}
                            />
                        </div>
                        <p className="text-[10px] font-medium text-zinc-500 sm:text-xs">선택 아바타 미리보기</p>
                    </div>

                    <div className="mt-1.5 shrink-0 rounded-lg border border-white/10 bg-black/30 px-1.5 py-1 shadow-inner ring-1 ring-white/[0.06] sm:mt-2 sm:rounded-xl sm:p-2">
                        <div
                            ref={avatarScrollRef}
                            tabIndex={0}
                            role="listbox"
                            aria-label="아바타 목록. 마우스 휠로 좌우 스크롤할 수 있습니다."
                            className="flex h-[52px] w-full cursor-default items-center gap-1.5 overflow-x-auto overflow-y-hidden outline-none [scrollbar-width:thin] focus-visible:ring-2 focus-visible:ring-amber-400/40 sm:h-[58px] sm:gap-2"
                            onClick={(e) => {
                                if (e.target === avatarScrollRef.current) {
                                    avatarScrollRef.current?.focus();
                                }
                            }}
                        >
                            {unlockedAvatars.map((avatar) => {
                                const sel = selectedAvatarId === avatar.id;
                                return (
                                    <button
                                        key={avatar.id}
                                        type="button"
                                        role="option"
                                        aria-selected={sel}
                                        onClick={() => {
                                            setSelectedAvatarId(avatar.id);
                                            avatarScrollRef.current?.focus();
                                        }}
                                        title={avatar.name}
                                        className={`relative shrink-0 rounded-lg p-0.5 transition sm:rounded-xl sm:p-1 ${
                                            sel
                                                ? 'bg-amber-500/20 ring-2 ring-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                                                : 'bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.08] hover:ring-amber-400/25'
                                        }`}
                                    >
                                        <Avatar userId="pick" userName={avatar.name} avatarUrl={avatar.url} size={isNativeMobile ? 44 : 52} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <form className="mt-2 flex min-h-0 flex-1 flex-col justify-center gap-2 sm:mt-3 sm:gap-3" onSubmit={handleSubmit}>
                        <div className="shrink-0">
                            <label htmlFor="nickname-set" className="mb-0.5 block text-center text-xs font-semibold text-stone-200 sm:mb-1 sm:text-base">
                                닉네임
                            </label>
                            <input
                                id="nickname-set"
                                name="nickname"
                                type="text"
                                required
                                autoFocus
                                className={isNativeMobile ? inputClass : desktopInputClass}
                                placeholder="닉네임 (2-6자)"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                minLength={NICKNAME_MIN_LENGTH}
                                maxLength={NICKNAME_MAX_LENGTH}
                            />
                            <p className="mt-0.5 h-3.5 text-center text-[10px] leading-none text-zinc-500 sm:h-4 sm:text-xs">
                                {nickname.length > 0 ? (
                                    <span
                                        className={
                                            nickname.length >= NICKNAME_MIN_LENGTH && nickname.length <= NICKNAME_MAX_LENGTH
                                                ? 'font-medium text-emerald-400/95'
                                                : 'font-medium text-red-400/95'
                                        }
                                    >
                                        {nickname.length} / {NICKNAME_MIN_LENGTH}-{NICKNAME_MAX_LENGTH}자
                                    </span>
                                ) : (
                                    '\u00a0'
                                )}
                            </p>
                        </div>

                        <div
                            className="flex h-9 w-full shrink-0 items-stretch overflow-hidden rounded-lg border border-amber-500/20 bg-black/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/[0.05] sm:h-10"
                            role="status"
                            aria-live="polite"
                            title={nicknameStatusLine.text}
                        >
                        <div className="flex w-[4.25rem] shrink-0 items-center justify-center border-r border-white/10 bg-white/[0.05] px-1 text-center text-[10px] font-semibold leading-none text-amber-200/85 sm:w-[4.75rem] sm:text-[11px]">
                            닉네임 확인
                        </div>
                        <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1 sm:px-3">
                            {nicknameStatusLine.kind === 'loading' && (
                                <span
                                    className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400"
                                    aria-hidden
                                />
                            )}
                            <p
                                className={`min-w-0 flex-1 truncate text-xs leading-tight sm:text-sm ${
                                    nicknameStatusLine.kind === 'error'
                                        ? 'text-red-300'
                                        : nicknameStatusLine.kind === 'ok'
                                          ? 'font-medium text-emerald-400/95'
                                          : 'text-zinc-400'
                                }`}
                            >
                                {nicknameStatusLine.text}
                            </p>
                        </div>
                    </div>

                    <div
                        className={
                            isNativeMobile
                                ? 'mt-1.5 -mx-3 shrink-0 border-t border-amber-400/40 bg-gradient-to-b from-zinc-950/98 to-black px-3 pt-2.5 pb-2.5 shadow-[0_-10px_36px_rgba(0,0,0,0.75)]'
                                : 'mt-2 -mx-7 shrink-0 border-t border-amber-400/40 bg-gradient-to-b from-zinc-950/98 to-black px-7 pt-3 pb-3 shadow-[0_-12px_40px_rgba(0,0,0,0.8)] sm:-mx-8 sm:px-8 sm:pb-3.5'
                        }
                    >
                        <button
                            type="submit"
                            disabled={
                                isLoading ||
                                isNicknameChecking ||
                                !!validationMessage ||
                                !nickname.trim() ||
                                nickname.trim().length < NICKNAME_MIN_LENGTH ||
                                nickname.trim().length > NICKNAME_MAX_LENGTH
                            }
                            className={primaryBtnClass}
                        >
                            {isLoading ? '설정 중...' : '닉네임 설정'}
                        </button>
                    </div>
                </form>
                </div>
            </div>

            {showStartConfirm && (
                <div
                    className="sudamr-modal-overlay z-[200] px-4 py-6"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="nickname-start-confirm-title"
                >
                    <div className={`${modalShell} w-[min(96vw,520px)]`} style={{ minHeight: CONFIRM_MODAL_MIN_H }}>
                        <div className="border-b border-amber-500/15 bg-gradient-to-r from-amber-950/40 via-transparent to-amber-950/40 px-6 py-5">
                            <h3
                                id="nickname-start-confirm-title"
                                className="text-center text-xl font-bold tracking-tight text-amber-100 drop-shadow-sm"
                            >
                                시작하기
                            </h3>
                            <p className="mt-1 text-center text-sm text-amber-200/50">최종 확인</p>
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col px-7 py-8">
                            <p className="text-center text-[1.35rem] font-medium leading-relaxed text-zinc-100">
                                SUDAM을 시작합니다.
                                <br />
                                <span className="text-zinc-300">즐거운 시간 보내세요.</span>
                            </p>
                            <div className="mt-auto border-t border-white/10 pt-8">
                                <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">선택한 프로필</p>
                                <div className="mt-4 flex flex-col items-center gap-3">
                                    <div className="rounded-full p-0.5 ring-2 ring-amber-400/40">
                                        <Avatar
                                            userId={currentUser.id}
                                            userName={trimmedNickname}
                                            avatarUrl={selectedAvatarUrl}
                                            size={88}
                                        />
                                    </div>
                                    <p className="text-2xl font-bold tracking-tight text-amber-100">{trimmedNickname}</p>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 border-t border-white/10 bg-black/35 px-6 py-5">
                            <button type="button" className={secondaryModalBtn} onClick={() => setShowStartConfirm(false)}>
                                취소
                            </button>
                            <button type="button" disabled={isLoading} className={goldModalBtn} onClick={() => void handleConfirmStart()}>
                                {isLoading ? '처리 중…' : '생성'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SetNickname;
