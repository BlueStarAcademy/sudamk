import React, { useState, useEffect } from 'react';
import { LiveGameSession, User } from '../types.js';

interface DisconnectionModalProps {
    session: LiveGameSession;
    currentUser: User;
}

const DisconnectionModal: React.FC<DisconnectionModalProps> = ({ session, currentUser }) => {
    const { disconnectionState, player1, player2, disconnectionCounts, gameStatus } = session;
    const [timeLeft, setTimeLeft] = useState(90);

    useEffect(() => {
        if (!disconnectionState) return;

        const updateTimer = () => {
            const elapsed = (Date.now() - disconnectionState.timerStartedAt) / 1000;
            const remaining = Math.max(0, 90 - Math.floor(elapsed));
            setTimeLeft(remaining);
        };

        const timerId = setInterval(updateTimer, 100);
        updateTimer(); // Initial call

        return () => clearInterval(timerId);
    }, [disconnectionState]);

    // 게임이 종료되었거나 disconnectionState가 없으면 모달 표시하지 않음
    if (!disconnectionState || gameStatus === 'ended' || gameStatus === 'no_contest') return null;

    const disconnectedPlayer = disconnectionState.disconnectedPlayerId === player1.id ? player1 : player2;
    const isDisconnectedMe = disconnectedPlayer.id === currentUser.id;
    const count = disconnectionCounts?.[disconnectedPlayer.id] || 1;
    
    // 원형 프로그레스 계산
    const totalTime = 90;
    const progress = ((totalTime - timeLeft) / totalTime) * 100;
    const circumference = 2 * Math.PI * 45; // 반지름 45
    const strokeDashoffset = circumference - (progress / 100) * circumference;
    
    return (
        <div className="sudamr-modal-overlay z-50 !block overflow-y-auto overscroll-y-contain">
            <div className="flex min-h-[100dvh] w-full items-center justify-center px-3 py-4 sm:px-4 sm:py-6">
                <div
                    className="sudamr-modal-panel mx-auto w-full max-w-[min(28rem,calc(100vw-1.5rem))] max-h-[min(92dvh,calc(100dvh-2rem))] overflow-y-auto overscroll-contain p-4 text-center sm:p-6 md:p-8"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="disconnection-modal-title"
                >
                    <h2
                        id="disconnection-modal-title"
                        className="mb-3 break-words text-lg font-bold leading-tight tracking-tight text-highlight sm:mb-4 sm:text-xl md:text-2xl"
                    >
                        플레이어 접속 끊김 ({count}/3회)
                    </h2>
                    <div className="my-4 flex items-center justify-center sm:my-6">
                        <div className="relative h-[7.25rem] w-[7.25rem] shrink-0 sm:h-32 sm:w-32">
                            {/* 원형 프로그레스 바 — viewBox로 컨테이너 크기에 맞게 스케일 */}
                            <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128" aria-hidden>
                                {/* 배경 원 */}
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="45"
                                    stroke="rgba(107, 114, 128, 0.3)"
                                    strokeWidth="8"
                                    fill="none"
                                />
                                {/* 프로그레스 원 */}
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="45"
                                    stroke={timeLeft > 30 ? '#fbbf24' : timeLeft > 10 ? '#f59e0b' : '#ef4444'}
                                    strokeWidth="8"
                                    fill="none"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="round"
                                    className="transition-all duration-100 ease-linear"
                                />
                            </svg>
                            {/* 중앙 타이머 텍스트 */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-center">
                                    <p className="text-2xl font-mono font-bold text-primary sm:text-3xl">{timeLeft}</p>
                                    <p className="mt-1 text-xs text-tertiary">초</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <p className="mb-2 break-words text-base text-primary sm:text-lg">
                        <span className="font-bold">{disconnectedPlayer.nickname}</span> 님의 연결이 끊겼습니다.
                    </p>
                    <p className="text-sm text-secondary sm:text-base">재접속을 기다리는 중입니다...</p>
                    {isDisconnectedMe && (
                        <p className="mt-4 break-words rounded-md bg-red-900/50 p-2 text-xs text-red-400 sm:text-sm">
                            페이지를 새로고침하여 재접속하세요.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DisconnectionModal;