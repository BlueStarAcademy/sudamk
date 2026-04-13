import React, { useEffect, useState } from 'react';
import { LiveGameSession, User, ServerAction } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import PreGameColorRoulette from './PreGameColorRoulette.js';
import { ColorAssignmentStickyFooter } from './ColorAssignmentStickyFooter.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';

interface NigiriModalProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const NigiriModal: React.FC<NigiriModalProps> = ({ session, currentUser, onAction }) => {
    const isHandheld = useIsHandheldDevice(1025);
    const { id: gameId, player1, player2, blackPlayerId, whitePlayerId, preGameConfirmations, revealEndTime } = session;
    const hasConfirmed = !!preGameConfirmations?.[currentUser.id];
    const [countdown, setCountdown] = useState(30);

    useEffect(() => {
        const deadline = revealEndTime || Date.now() + 30 * 1000;
        const timerId = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            setCountdown(remaining);
        }, 1000);
        return () => clearInterval(timerId);
    }, [revealEndTime]);

    if (!blackPlayerId || !whitePlayerId) return null;

    const blackPlayer = player1.id === blackPlayerId ? player1 : player2;
    const whitePlayer = player1.id === whitePlayerId ? player1 : player2;

    const cards = <PreGameColorRoulette layout="cardsOnly" blackPlayer={blackPlayer} whitePlayer={whitePlayer} />;
    const footer = (
        <ColorAssignmentStickyFooter
            variant={isHandheld ? 'sticky' : 'inline'}
            hasConfirmed={hasConfirmed}
            countdown={countdown}
            onConfirm={() => onAction({ type: 'CONFIRM_COLOR_START', payload: { gameId } })}
        />
    );

    return (
        <DraggableWindow title="흑·백 확인" initialWidth={420} shrinkHeightToContent windowId="nigiri">
            {isHandheld ? (
                <>
                    <div className="flex min-h-[168px] flex-col justify-center text-white sm:min-h-[180px]">{cards}</div>
                    {footer}
                </>
            ) : (
                <div className="flex min-h-[220px] flex-col text-white">
                    <div className="flex flex-1 flex-col justify-center py-3 sm:py-4">{cards}</div>
                    {footer}
                </div>
            )}
        </DraggableWindow>
    );
};

export default NigiriModal;
