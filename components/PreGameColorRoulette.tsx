import React, { useEffect, useRef, useState } from 'react';
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
}

const ROULETTE_TICK_MS = 110;

const PreGameColorRoulette: React.FC<PreGameColorRouletteProps> = ({
    blackPlayer,
    whitePlayer,
    participantsInDisplayOrder,
    avatarUrlOverrides,
    durationMs = 2600,
    title = '룰렛으로 흑/백을 결정하는 중...',
    subtitle = '자동으로 선공과 후공이 배정됩니다.',
    onComplete,
    suppressHeader = false,
    layout = 'full',
    animate = true,
}) => {
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
            ? `flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-800/90 ring-1 ring-white/12 ${
                  compact ? 'h-[3.25rem] w-[3.25rem] sm:h-14 sm:w-14' : 'h-[3.75rem] w-[3.75rem] sm:h-16 sm:w-16'
              }`
            : '';

        return (
            <div
                className={`flex-1 rounded-xl border transition-all duration-200 ${
                    compact ? 'p-2.5 sm:p-3' : 'p-4'
                } ${
                    isActive
                        ? isBlack
                            ? 'border-yellow-300 bg-yellow-500/15 shadow-[0_0_20px_rgba(250,204,21,0.25)] scale-[1.02]'
                            : 'border-sky-300 bg-sky-500/15 shadow-[0_0_20px_rgba(125,211,252,0.25)] scale-[1.02]'
                        : 'border-gray-700 bg-gray-900/50 opacity-80'
                }`}
            >
                <div className={`flex flex-col items-center text-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
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
                            size={compact ? 48 : 60}
                            avatarUrl={avatarUrl}
                            borderUrl={borderUrl}
                        />
                    )}
                    <p className={`font-bold ${compact ? 'max-w-full truncate text-xs sm:text-[0.8125rem]' : ''}`}>
                        {player.nickname}
                    </p>
                    <div
                        className={`rounded-full border-4 ${isBlack ? 'bg-black border-gray-300' : 'bg-white border-gray-700'} ${
                            compact ? 'h-12 w-12 sm:h-14 sm:w-14' : 'h-16 w-16'
                        }`}
                    />
                    <p className={`font-semibold ${compact ? 'text-[0.7rem] sm:text-xs' : ''}`}>
                        {isBlack ? '흑 (선공)' : '백 (후공)'}
                    </p>
                </div>
            </div>
        );
    };

    const slotSizeClass = 'w-[5.5rem] h-[5.5rem] sm:w-24 sm:h-24';

    if (layout === 'cardsOnly') {
        if (flipMode) {
            return (
                <div className="flex gap-2.5 sm:gap-3">
                    {renderPlayerCard(leftSeat, leftIsBlack, isFinished ? true : leftIsBlack)}
                    {renderPlayerCard(rightSeat, !leftIsBlack, isFinished ? true : !leftIsBlack)}
                </div>
            );
        }
        return (
            <div className="flex gap-2.5 sm:gap-3">
                {renderPlayerCard(blackPlayer, true, isFinished ? true : activeColor === Player.Black)}
                {renderPlayerCard(whitePlayer, false, isFinished ? true : activeColor === Player.White)}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {!suppressHeader && (
                <div className="text-center">
                    <p className="text-lg font-bold text-white">{title}</p>
                    <p className="text-sm text-gray-300 mt-1">{subtitle}</p>
                </div>
            )}

            <div className="rounded-2xl border border-amber-400/30 bg-gray-950/70 px-4 py-5">
                <div className="flex flex-col items-center gap-3">
                    <div
                        className={`relative flex shrink-0 items-center justify-center rounded-xl border-2 border-amber-400/50 bg-gray-900/80 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.15)] ${slotSizeClass}`}
                    >
                        {isFinished ? (
                            <span className="text-center text-base sm:text-lg font-bold text-green-300 px-1">배정 완료</span>
                        ) : flipMode ? (
                            <div
                                key={leftIsBlack ? 'L' : 'R'}
                                className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-[10px] border border-amber-500/35 bg-gray-950/95 px-1 py-0.5"
                            >
                                <span className="text-[0.65rem] sm:text-xs font-semibold tracking-wide text-amber-200/95">
                                    지금 선공(흑) 후보
                                </span>
                                <span className="max-w-[95%] truncate text-center text-xs sm:text-sm font-bold text-white">
                                    {leftIsBlack ? leftSeat.nickname : rightSeat.nickname}
                                </span>
                                <span className="text-2xl sm:text-4xl font-black text-yellow-300">흑</span>
                            </div>
                        ) : (
                            <div
                                key={activeColor}
                                className={`flex h-full w-full items-center justify-center rounded-[10px] text-3xl sm:text-4xl font-black transition-colors duration-100 ${
                                    activeColor === Player.Black
                                        ? 'bg-black text-white border border-gray-500'
                                        : 'bg-white text-gray-900 border border-gray-400'
                                }`}
                            >
                                {activeColor === Player.Black ? '흑' : '백'}
                            </div>
                        )}
                    </div>
                    <p className={`text-center text-sm font-semibold ${isFinished ? 'text-green-300' : 'text-yellow-300 animate-pulse'}`}>
                        {isFinished
                            ? '아래에서 흑·백 배정을 확인하세요.'
                            : flipMode
                              ? '두 칸의 흑·백이 바뀌다가 최종 배치로 고정됩니다…'
                              : '흑과 백이 번갈아 표시됩니다...'}
                    </p>
                </div>
            </div>

            <div className="flex gap-4">
                {flipMode ? (
                    <>
                        {renderPlayerCard(leftSeat, leftIsBlack, isFinished ? true : leftIsBlack)}
                        {renderPlayerCard(rightSeat, !leftIsBlack, isFinished ? true : !leftIsBlack)}
                    </>
                ) : (
                    <>
                        {renderPlayerCard(blackPlayer, true, isFinished ? true : activeColor === Player.Black)}
                        {renderPlayerCard(whitePlayer, false, isFinished ? true : activeColor === Player.White)}
                    </>
                )}
            </div>
        </div>
    );
};

export default PreGameColorRoulette;
