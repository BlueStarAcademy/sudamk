import React, { useEffect, useRef, useState } from 'react';
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

    const slotSizeClass = 'w-[5.5rem] h-[5.5rem] sm:w-24 sm:h-24';

    return (
        <div className="space-y-4">
            <div className="text-center">
                <p className="text-lg font-bold text-white">{title}</p>
                <p className="text-sm text-gray-300 mt-1">{subtitle}</p>
            </div>

            <div className="rounded-2xl border border-amber-400/30 bg-gray-950/70 px-4 py-5">
                <div className="flex flex-col items-center gap-3">
                    <div
                        className={`relative flex shrink-0 items-center justify-center rounded-xl border-2 border-amber-400/50 bg-gray-900/80 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.15)] ${slotSizeClass}`}
                    >
                        {isFinished ? (
                            <span className="text-center text-base sm:text-lg font-bold text-green-300 px-1">배정 완료</span>
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
                        {isFinished ? '아래에서 흑·백 배정을 확인하세요.' : '흑과 백이 번갈아 표시됩니다...'}
                    </p>
                </div>
            </div>

            <div className="flex gap-4">
                {renderPlayerCard(blackPlayer, Player.Black, isFinished || activeColor === Player.Black)}
                {renderPlayerCard(whitePlayer, Player.White, isFinished || activeColor === Player.White)}
            </div>
        </div>
    );
};

export default PreGameColorRoulette;
