import React, { useState, useEffect } from 'react';
import { LiveGameSession, User, ServerAction } from '../types.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import PreGameColorRoulette from './PreGameColorRoulette.js';
import RoundCountdownIndicator from './RoundCountdownIndicator.js';
import { PRE_GAME_PVP_COUNTDOWN_SECONDS } from '../shared/constants/preGameCountdown.js';

interface AlkkagiStartConfirmationModalProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const AlkkagiStartConfirmationModal: React.FC<AlkkagiStartConfirmationModalProps> = ({ session, currentUser, onAction }) => {
    const { id: gameId, player1, player2, blackPlayerId, whitePlayerId, preGameConfirmations, revealEndTime } = session;
    const hasConfirmed = preGameConfirmations?.[currentUser.id];
    const [countdown, setCountdown] = useState(PRE_GAME_PVP_COUNTDOWN_SECONDS);
    const [rouletteDone, setRouletteDone] = useState(false);

    useEffect(() => {
        const deadline = revealEndTime || (Date.now() + PRE_GAME_PVP_COUNTDOWN_SECONDS * 1000);
        const timerId = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            setCountdown(remaining);
        }, 1000);

        return () => clearInterval(timerId);
    }, [revealEndTime]);

    if (!blackPlayerId || !whitePlayerId) return null;
    
    const blackPlayer = player1.id === blackPlayerId ? player1 : player2;
    const whitePlayer = player1.id === whitePlayerId ? player1 : player2;

    return (
        <DraggableWindow
            title="대국 시작 확인"
            initialWidth={460}
            shrinkHeightToContent
            windowId="alkkagi-start-confirm"
            transparentModalBackdrop
            skipSavedPosition
        >
            <div className="text-white">
                <PreGameColorRoulette
                    participantsInDisplayOrder={[player1, player2]}
                    blackPlayer={blackPlayer}
                    whitePlayer={whitePlayer}
                    onComplete={() => setRouletteDone(true)}
                    title="룰렛으로 선공/후공이 결정되었습니다"
                    subtitle="가위바위보 대신 자동 룰렛으로 흑과 백이 배정됩니다."
                />
                <p className="mt-5 text-center text-sm leading-relaxed text-stone-400">
                    대국 시작을 누르거나, 30초가 지나면 자동으로 시작됩니다.
                </p>
                <RoundCountdownIndicator
                    deadline={revealEndTime}
                    durationSeconds={PRE_GAME_PVP_COUNTDOWN_SECONDS}
                    label="자동 진행까지"
                    labelShort="자동 진행"
                />

                <Button
                    onClick={() => onAction({ type: 'CONFIRM_ALKKAGI_START', payload: { gameId }})} 
                    disabled={!!hasConfirmed || !rouletteDone}
                    className="w-full py-3 mt-6"
                >
                    {hasConfirmed ? '상대방 확인 대기 중...' : !rouletteDone ? '룰렛 결과 확인 중...' : `대국 시작 (${countdown})`}
                </Button>
            </div>
        </DraggableWindow>
    );
};

export default AlkkagiStartConfirmationModal;