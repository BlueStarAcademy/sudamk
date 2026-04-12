import React, { useEffect, useState } from 'react';
import { LiveGameSession, User, ServerAction } from '../types.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import PreGameColorRoulette from './PreGameColorRoulette.js';

interface ColorStartConfirmationModalProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const ColorStartConfirmationModal: React.FC<ColorStartConfirmationModalProps> = ({ session, currentUser, onAction }) => {
    const { id: gameId, player1, player2, blackPlayerId, whitePlayerId, preGameConfirmations, revealEndTime } = session;
    const hasConfirmed = !!preGameConfirmations?.[currentUser.id];
    const [countdown, setCountdown] = useState(30);
    const [rouletteDone, setRouletteDone] = useState(false);

    useEffect(() => {
        const deadline = revealEndTime || (Date.now() + 30000);
        const timerId = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            setCountdown(remaining);
        }, 1000);
        return () => clearInterval(timerId);
    }, [revealEndTime]);

    useEffect(() => {
        const t = window.setTimeout(() => setRouletteDone(true), 3200);
        return () => window.clearTimeout(t);
    }, []);

    if (!blackPlayerId || !whitePlayerId) return null;

    const blackPlayer = player1.id === blackPlayerId ? player1 : player2;
    const whitePlayer = player1.id === whitePlayerId ? player1 : player2;

    return (
        <DraggableWindow title="흑·백 배정 확인" initialWidth={680} windowId="color-start-confirmation">
            <div className="text-white space-y-6">
                <PreGameColorRoulette
                    blackPlayer={blackPlayer}
                    whitePlayer={whitePlayer}
                    onComplete={() => setRouletteDone(true)}
                    suppressHeader
                />

                <p className="text-center text-sm text-gray-300">
                    아래 카드에 표시된 대로 흑·백이 정해졌습니다. 양쪽이 시작을 누르거나, 시간이 지나면 자동으로 대국이 시작됩니다.
                </p>

                <Button
                    onClick={() => onAction({ type: 'CONFIRM_COLOR_START', payload: { gameId } })}
                    disabled={!!hasConfirmed || !rouletteDone}
                    className="w-full py-3"
                >
                    {hasConfirmed ? '상대방 확인 대기 중...' : !rouletteDone ? '룰렛 결과 확인 중...' : `경기 시작 (${countdown})`}
                </Button>
            </div>
        </DraggableWindow>
    );
};

export default ColorStartConfirmationModal;
