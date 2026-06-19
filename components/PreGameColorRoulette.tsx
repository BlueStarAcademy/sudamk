import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../shared/i18n/config.js';
import { Player, User } from '../types.js';
import Avatar from './Avatar.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants';

interface PreGameColorRouletteProps {
    blackPlayer: User;
    whitePlayer: User;
    /**
     * 좌·우 칸을 항상 이 순서(보통 player1 / player2)로 고정하고,
     * 연출 중에는 각 칸의 흑·백(선공·후공) 배지만 바뀌다가 `blackPlayer` 기준으로 확정된다.
     * 미지정 시 기존처럼 왼쪽=흑 담당, 오른쪽=백 담당 고정(하이라이트만 번갈아 표시).
     */
    participantsInDisplayOrder?: [User, User];
    /** 플레이어 id → 프로필 이미지 URL (모험 몬스터 초상 등) */
    avatarUrlOverrides?: Partial<Record<string, string>>;
    durationMs?: number;
    title?: string;
    subtitle?: string;
    onComplete?: () => void;
    /** true면 상단 제목/부제를 숨김 (부모 DraggableWindow 제목과 중복 방지) */
    suppressHeader?: boolean;
    /** 흑·백 카드만 표시 (룰렛 박스·안내 문구 없음) */
    layout?: 'full' | 'cardsOnly';
    /** false면 룰렛 애니메이션 없이 최종 배치만 표시 */
    animate?: boolean;
    /** 흑(Black) 카드 하단 라벨 (기본: 선공 · 흑) */
    blackRoleLabel?: string;
    /** 백(White) 카드 하단 라벨 (기본: 후공 · 백) */
    whiteRoleLabel?: string;
}

const ROULETTE_TICK_MS = 110;

const PreGameColorRoulette: React.FC<PreGameColorRouletteProps> = ({
    blackPlayer,
    whitePlayer,
    participantsInDisplayOrder,
    avatarUrlOverrides,
    durationMs = 2600,
    title = i18n.t('game:preGameColor.title'),
    subtitle = i18n.t('game:preGameColor.subtitle'),
    onComplete,
    suppressHeader = false,
    layout = 'full',
    animate = true,
    blackRoleLabel = i18n.t('game:preGameColor.blackRole'),
    whiteRoleLabel = i18n.t('game:preGameColor.whiteRole'),
}) => {
    const { t } = useTranslation('game');
    const flipMode = Boolean(participantsInDisplayOrder?.[0] && participantsInDisplayOrder?.[1]);
    const leftSeat = flipMode ? participantsInDisplayOrder![0] : blackPlayer;
    const rightSeat = flipMode ? participantsInDisplayOrder![1] : whitePlayer;
    const finalLeftIsBlack = flipMode ? blackPlayer.id === leftSeat.id : true;

    const [activeColor, setActiveColor] = useState<Player>(Player.Black);
    /** flipMode: 왼쪽 칸이 현재 연출상 흑(선공) 역할인지 — 종료 시 서버 배치로 고정 */
    const [leftIsBlack, setLeftIsBlack] = useState(() => (flipMode ? !finalLeftIsBlack : true));
    const [isFinished, setIsFinished] = useState(false);
    const completedRef = useRef(false);
    const onCompleteRef = useRef(onComplete);

    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    useEffect(() => {
        if (!animate) {
            completedRef.current = true;
            setIsFinished(true);
            setActiveColor(Player.Black);
            setLeftIsBlack(finalLeftIsBlack);
            return;
        }
        if (flipMode) return;

        completedRef.current = false;
        setIsFinished(false);
        setActiveColor(Player.Black);

        const colors: Player[] = [Player.Black, Player.White];
        let tick = 0;
        const timerId = window.setInterval(() => {
            tick += 1;
            setActiveColor(colors[tick % colors.length]);
        }, ROULETTE_TICK_MS);

        const finishId = window.setTimeout(() => {
            window.clearInterval(timerId);
            setIsFinished(true);
            if (!completedRef.current) {
                completedRef.current = true;
                onCompleteRef.current?.();
            }
        }, durationMs);

        return () => {
            window.clearInterval(timerId);
            window.clearTimeout(finishId);
        };
    }, [animate, flipMode, durationMs, blackPlayer.id, whitePlayer.id, finalLeftIsBlack]);

    useEffect(() => {
        if (!animate) return;
        if (!flipMode) return;

        completedRef.current = false;
        setIsFinished(false);
        setLeftIsBlack(!finalLeftIsBlack);

        const timerId = window.setInterval(() => {
            setLeftIsBlack(prev => !prev);
        }, ROULETTE_TICK_MS);

        const finishId = window.setTimeout(() => {
            window.clearInterval(timerId);
            setLeftIsBlack(finalLeftIsBlack);
            setIsFinished(true);
            if (!completedRef.current) {
                completedRef.current = true;
                onCompleteRef.current?.();
            }
        }, durationMs);

        return () => {
            window.clearInterval(timerId);
            window.clearTimeout(finishId);
        };
    }, [animate, flipMode, durationMs, finalLeftIsBlack, leftSeat.id, rightSeat.id, blackPlayer.id]);

    const renderPlayerCard = (player: User, isBlackRole: boolean, isActive: boolean) => {
        const overrideUrl = avatarUrlOverrides?.[player.id];
        const avatarUrl = overrideUrl ?? AVATAR_POOL.find(a => a.id === player.avatarId)?.url;
        const borderUrl = overrideUrl ? undefined : BORDER_POOL.find(b => b.id === player.borderId)?.url;
        const isBlack = isBlackRole;
        const compact = layout === 'cardsOnly';

        const portraitFrameClass = overrideUrl
            ? `flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-800/90 ring-1 ring-white/12 ${
                  compact ? 'h-11 w-11 sm:h-12 sm:w-12' : 'h-[3.75rem] w-[3.75rem] sm:h-16 sm:w-16'
              }`
            : '';

        return (
            <div
                className={`min-w-0 flex-1 rounded-xl border transition-all duration-200 ${
                    compact ? 'p-2' : 'p-3.5 sm:p-4'
                } ${
                    isActive
                        ? isBlack
                            ? 'border-amber-300/90 bg-gradient-to-b from-amber-500/20 to-zinc-950/80 shadow-[0_0_24px_rgba(245,158,11,0.22)]'
                            : 'border-sky-300/85 bg-gradient-to-b from-sky-500/18 to-zinc-950/80 shadow-[0_0_24px_rgba(56,189,248,0.18)]'
                        : 'border-white/[0.08] bg-zinc-950/55 opacity-85'
                }`}
            >
                <div className={`flex flex-col items-center text-center ${compact ? 'gap-1' : 'gap-2.5'}`}>
                    {overrideUrl ? (
                        <div className={portraitFrameClass}>
                            <img
                                src={overrideUrl}
                                alt={player.nickname}
                                className="max-h-full max-w-full object-contain object-center"
                                loading="lazy"
                            />
                        </div>
                    ) : (
                        <Avatar
                            userId={player.id}
                            userName={player.nickname}
                            size={compact ? 40 : 60}
                            avatarUrl={avatarUrl}
                            borderUrl={borderUrl}
                        />
                    )}
                    <p className={`font-bold ${compact ? 'max-w-full truncate text-[11px] sm:text-xs' : ''}`}>
                        {player.nickname}
                    </p>
                    <div
                        className={`rounded-full border-[2.5px] shadow-inner ${
                            isBlack ? 'border-stone-500 bg-black' : 'border-stone-400 bg-white'
                        } ${compact ? 'h-9 w-9 sm:h-10 sm:w-10' : 'h-[3.25rem] w-[3.25rem] sm:h-14 sm:w-14'}`}
                    />
                    <p className={`font-bold tracking-tight text-stone-100 ${compact ? 'text-[0.65rem] sm:text-[11px]' : 'text-sm sm:text-base'}`}>
                        {isBlack ? blackRoleLabel : whiteRoleLabel}
                    </p>
                </div>
            </div>
        );
    };

    const slotSizeClass = 'h-[4.75rem] w-[4.75rem] sm:h-[5.25rem] sm:w-[5.25rem]';

    const vsDivider = (
        <div
            className="flex w-8 shrink-0 flex-col items-center justify-center self-stretch sm:w-10"
            aria-hidden
        >
            <span className="select-none rounded-md border border-amber-500/20 bg-black/40 px-1.5 py-1 text-[0.6rem] font-black tracking-[0.22em] text-amber-200/75 sm:text-[0.65rem]">
                VS
            </span>
        </div>
    );

    if (layout === 'cardsOnly') {
        const cardsRowClass = 'mx-auto flex w-full max-w-[16.5rem] gap-2 sm:max-w-[17.5rem] sm:gap-2.5';
        if (flipMode) {
            return (
                <div className={cardsRowClass}>
                    {renderPlayerCard(leftSeat, leftIsBlack, isFinished ? true : leftIsBlack)}
                    {renderPlayerCard(rightSeat, !leftIsBlack, isFinished ? true : !leftIsBlack)}
                </div>
            );
        }
        return (
            <div className={cardsRowClass}>
                {renderPlayerCard(blackPlayer, true, isFinished ? true : activeColor === Player.Black)}
                {renderPlayerCard(whitePlayer, false, isFinished ? true : activeColor === Player.White)}
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-amber-400/25 bg-gradient-to-b from-zinc-900/[0.97] via-zinc-950/[0.99] to-black/[0.92] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_48px_-20px_rgba(0,0,0,0.75)] sm:p-5">
            {!suppressHeader ? (
                <div className="mb-4 border-b border-amber-500/10 pb-4 text-center sm:mb-5 sm:pb-5">
                    <p className="text-base font-bold tracking-tight text-amber-50/95 sm:text-lg">{title}</p>
                    <p className="mt-2 text-xs leading-relaxed text-stone-400 sm:text-sm">{subtitle}</p>
                </div>
            ) : null}

            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-5">
                <div
                    className={`relative flex shrink-0 items-center justify-center rounded-xl border-2 border-amber-400/45 bg-gradient-to-b from-zinc-900/95 to-black/90 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.12)] ${slotSizeClass}`}
                >
                    {isFinished ? (
                        <div className="flex flex-col items-center gap-0.5 px-1 text-center">
                            <span className="rounded border border-emerald-500/35 bg-emerald-950/60 px-2 py-0.5 text-[0.65rem] font-bold tracking-wide text-emerald-200 sm:text-xs">
                                배정 완료
                            </span>
                            <span className="text-[0.7rem] font-semibold text-stone-400 sm:text-xs">{t('preGameColor.rouletteEnd')}</span>
                        </div>
                    ) : flipMode ? (
                        <div
                            key={leftIsBlack ? 'L' : 'R'}
                            className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-[10px] border border-amber-500/30 bg-black/50 px-1 py-1"
                        >
                            <span className="text-[0.6rem] font-semibold tracking-wide text-amber-200/90 sm:text-[0.65rem]">
                                선공(흑) 후보
                            </span>
                            <span className="max-w-[95%] truncate text-center text-[0.7rem] font-bold text-white sm:text-xs">
                                {leftIsBlack ? leftSeat.nickname : rightSeat.nickname}
                            </span>
                            <span className="text-xl font-black text-amber-300 sm:text-2xl">{t('preGameColor.blackShort')}</span>
                        </div>
                    ) : (
                        <div
                            key={activeColor}
                            className={`flex h-full w-full items-center justify-center rounded-[10px] text-2xl font-black transition-colors duration-100 sm:text-3xl ${
                                activeColor === Player.Black
                                    ? 'border border-stone-500 bg-black text-white'
                                    : 'border border-stone-300 bg-white text-zinc-900'
                            }`}
                        >
                            {activeColor === Player.Black ? t('preGameColor.blackShort') : t('preGameColor.whiteShort')}
                        </div>
                    )}
                </div>
                <p
                    className={`max-w-md text-center text-xs font-semibold leading-snug sm:flex-1 sm:text-left sm:text-sm ${
                        isFinished ? 'text-emerald-200/90' : 'animate-pulse text-amber-200/90'
                    }`}
                >
                    {isFinished
                        ? t('preGameColor.finalCardAlt')
                        : flipMode
                          ? t('preGameColor.fastFlashAlt')
                          : t('preGameColor.smoothEndAlt')}
                </p>
            </div>

            <div className="mt-5 flex items-stretch gap-1.5 sm:gap-2">
                {flipMode ? (
                    <>
                        {renderPlayerCard(leftSeat, leftIsBlack, isFinished ? true : leftIsBlack)}
                        {vsDivider}
                        {renderPlayerCard(rightSeat, !leftIsBlack, isFinished ? true : !leftIsBlack)}
                    </>
                ) : (
                    <>
                        {renderPlayerCard(blackPlayer, true, isFinished ? true : activeColor === Player.Black)}
                        {vsDivider}
                        {renderPlayerCard(whitePlayer, false, isFinished ? true : activeColor === Player.White)}
                    </>
                )}
            </div>
        </div>
    );
};

export default PreGameColorRoulette;
