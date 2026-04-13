import React from 'react';
import { LiveGameSession, User, ServerAction } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import PreGameColorRoulette from './PreGameColorRoulette.js';
import { ColorAssignmentStickyFooter } from './ColorAssignmentStickyFooter.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { aiUserId } from '../constants/index.js';
import { getAdventureCodexMonsterById } from '../constants/adventureMonstersCodex.js';

interface NigiriModalProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const NigiriModal: React.FC<NigiriModalProps> = ({ session, currentUser, onAction }) => {
    const isHandheld = useIsHandheldDevice(1025);
    const { id: gameId, player1, player2, blackPlayerId, whitePlayerId, preGameConfirmations } = session;
    const hasConfirmed = !!preGameConfirmations?.[currentUser.id];

    if (!blackPlayerId || !whitePlayerId) return null;

    const blackPlayer = player1.id === blackPlayerId ? player1 : player2;
    const whitePlayer = player1.id === whitePlayerId ? player1 : player2;
    const monsterName = session.gameCategory === 'adventure' ? getAdventureCodexMonsterById(session.adventureMonsterCodexId)?.name : undefined;
    const blackUiPlayer = blackPlayer.id === aiUserId && monsterName ? { ...blackPlayer, nickname: monsterName } : blackPlayer;
    const whiteUiPlayer = whitePlayer.id === aiUserId && monsterName ? { ...whitePlayer, nickname: monsterName } : whitePlayer;

    const cards = <PreGameColorRoulette layout="cardsOnly" blackPlayer={blackUiPlayer} whitePlayer={whiteUiPlayer} />;
    const footer = (
        <ColorAssignmentStickyFooter
            variant={isHandheld ? 'sticky' : 'inline'}
            hasConfirmed={hasConfirmed}
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
