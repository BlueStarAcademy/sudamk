import React, { useState, useEffect } from 'react';
import { LiveGameSession, User, ServerAction, Player } from '../types.js';
import Avatar from './Avatar.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import PreGameColorRoulette from './PreGameColorRoulette.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants';

interface AlkkagiStartConfirmationModalProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const AlkkagiStartConfirmationModal: React.FC<AlkkagiStartConfirmationModalProps> = ({ session, currentUser, onAction }) => {
    const { id: gameId, player1, player2, blackPlayerId, whitePlayerId, preGameConfirmations, revealEndTime } = session;
    const hasConfirmed = preGameConfirmations?.[currentUser.id];
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

    if (!blackPlayerId || !whitePlayerId) return null;
    
    const blackPlayer = player1.id === blackPlayerId ? player1 : player2;
    const whitePlayer = player1.id === whitePlayerId ? player1 : player2;
    
    const blackAvatarUrl = AVATAR_POOL.find(a => a.id === blackPlayer.avatarId)?.url;
    const blackBorderUrl = BORDER_POOL.find(b => b.id === blackPlayer.borderId)?.url;
    const whiteAvatarUrl = AVATAR_POOL.find(a => a.id === whitePlayer.avatarId)?.url;
    const whiteBorderUrl = BORDER_POOL.find(b => b.id === whitePlayer.borderId)?.url;

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
                <p className="text-center text-gray-400 mb-4 text-sm">아래 시작 버튼을 누르거나 30초 후 대국이 자동으로 시작됩니다.</p>

                <div className="flex gap-4 mt-4">
                    <div className="w-1/2 flex flex-col items-center p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                        <Avatar userId={blackPlayer.id} userName={blackPlayer.nickname} size={64} avatarUrl={blackAvatarUrl} borderUrl={blackBorderUrl} />
                        <p className="mt-2 font-bold">{blackPlayer.nickname}</p>
                        <p className="font-semibold">선공 (흑)</p>
                    </div>
                    <div className="w-1/2 flex flex-col items-center p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                        <Avatar userId={whitePlayer.id} userName={whitePlayer.nickname} size={64} avatarUrl={whiteAvatarUrl} borderUrl={whiteBorderUrl} />
                        <p className="mt-2 font-bold">{whitePlayer.nickname}</p>
                        <p className="font-semibold">후공 (백)</p>
                    </div>
                </div>

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