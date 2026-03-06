import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Player, User } from '../types.js';
import Avatar from './Avatar.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants';

interface PreGameColorRouletteProps {
    blackPlayer: User;
    whitePlayer: User;
    durationMs?: number;
    title?: string;
    subtitle?: string;
    onComplete?: () => void;
}

const ROULETTE_TICK_MS = 110;

const PreGameColorRoulette: React.FC<PreGameColorRouletteProps> = ({
    blackPlayer,
    whitePlayer,
    durationMs = 2600,
    title = '룰렛으로 흑/백을 결정하는 중...',
    subtitle = '자동으로 선공과 후공이 배정됩니다.',
    onComplete,
}) => {
    const [activeColor, setActiveColor] = useState<Player>(Player.Black);
    const [isFinished, setIsFinished] = useState(false);
    const completedRef = useRef(false);
    const onCompleteRef = useRef(onComplete);
    const finalColor = Player.Black;

    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    useEffect(() => {
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
            setActiveColor(finalColor);
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
    }, [durationMs]);

    const rouletteSlots = useMemo(
        () => {
            const oppositeColor = activeColor === Player.Black ? Player.White : Player.Black;
            return [oppositeColor, activeColor, activeColor, oppositeColor, activeColor];
        },
        [activeColor]
    );

    const renderPlayerCard = (player: User, color: Player, isActive: boolean) => {
        const avatarUrl = AVATAR_POOL.find(a => a.id === player.avatarId)?.url;
        const borderUrl = BORDER_POOL.find(b => b.id === player.borderId)?.url;
        const isBlack = color === Player.Black;

        return (
            <div
                className={`flex-1 rounded-xl border p-4 transition-all duration-200 ${
                    isActive
                        ? isBlack
                            ? 'border-yellow-300 bg-yellow-500/15 shadow-[0_0_20px_rgba(250,204,21,0.25)] scale-[1.02]'
                            : 'border-sky-300 bg-sky-500/15 shadow-[0_0_20px_rgba(125,211,252,0.25)] scale-[1.02]'
                        : 'border-gray-700 bg-gray-900/50 opacity-80'
                }`}
            >
                <div className="flex flex-col items-center text-center gap-2">
                    <Avatar userId={player.id} userName={player.nickname} size={60} avatarUrl={avatarUrl} borderUrl={borderUrl} />
                    <p className="font-bold">{player.nickname}</p>
                    <div className={`w-16 h-16 rounded-full border-4 ${isBlack ? 'bg-black border-gray-300' : 'bg-white border-gray-700'}`} />
                    <p className="font-semibold">{isBlack ? '흑 (선공)' : '백 (후공)'}</p>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="text-center">
                <p className="text-lg font-bold text-white">{title}</p>
                <p className="text-sm text-gray-300 mt-1">{subtitle}</p>
            </div>

            <div className="rounded-2xl border border-amber-400/30 bg-gray-950/70 px-4 py-5">
                <div className="flex justify-center mb-3">
                    <div className="text-xs font-semibold tracking-[0.3em] text-amber-300 bg-amber-500/10 border border-amber-400/40 rounded-full px-3 py-1">
                        ROULETTE
                    </div>
                </div>
                <div className="relative overflow-hidden rounded-xl border border-gray-700 bg-black/40 px-10 py-4">
                    <div className="pointer-events-none absolute inset-y-2 left-1/2 -translate-x-1/2 w-16 rounded-lg border-2 border-yellow-300/80 bg-yellow-400/10 shadow-[0_0_18px_rgba(250,204,21,0.2)]" />
                    <div className="flex items-center justify-center gap-3">
                        {rouletteSlots.map((slotColor, index) => {
                            const isCenter = index === 2;
                            const isBlack = slotColor === Player.Black;
                            return (
                                <div
                                    key={`${slotColor}-${index}-${activeColor}`}
                                    className={`flex h-16 w-16 items-center justify-center rounded-full border-4 text-lg font-bold transition-all duration-150 ${
                                        isBlack
                                            ? 'bg-black text-white border-gray-300'
                                            : 'bg-white text-gray-900 border-gray-700'
                                    } ${isCenter ? 'scale-110 shadow-lg' : 'scale-90 opacity-60'}`}
                                >
                                    {isBlack ? '흑' : '백'}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <p className={`mt-3 text-center text-sm font-semibold ${isFinished ? 'text-green-300' : 'text-yellow-300 animate-pulse'}`}>
                    {isFinished ? '배정 완료! 아래에서 결과를 확인하세요.' : '룰렛이 색상을 고르는 중입니다...'}
                </p>
            </div>

            <div className="flex gap-4">
                {renderPlayerCard(blackPlayer, Player.Black, isFinished || activeColor === Player.Black)}
                {renderPlayerCard(whitePlayer, Player.White, isFinished || activeColor === Player.White)}
            </div>
        </div>
    );
};

export default PreGameColorRoulette;
