import React from 'react';
import { LiveGameSession, User, ServerAction } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import PreGameColorRoulette from './PreGameColorRoulette.js';
import { ColorAssignmentStickyFooter } from './ColorAssignmentStickyFooter.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { aiUserId } from '../constants/index.js';
import { getAdventureCodexMonsterById } from '../constants/adventureMonstersCodex.js';
import { getSessionPlayerDisplayName } from '../utils/gameDisplayNames.js';

interface ColorStartConfirmationModalProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const ColorStartConfirmationModal: React.FC<ColorStartConfirmationModalProps> = ({ session, currentUser, onAction }) => {
    const isHandheld = useIsHandheldDevice(1025);
    const { id: gameId, player1, player2, blackPlayerId, whitePlayerId, preGameConfirmations } = session;
    const hasConfirmed = !!preGameConfirmations?.[currentUser.id];

    if (!blackPlayerId || !whitePlayerId) return null;

    const blackPlayer = player1.id === blackPlayerId ? player1 : player2;
    const whitePlayer = player1.id === whitePlayerId ? player1 : player2;
    const monsterEntry =
        session.gameCategory === 'adventure' && session.adventureMonsterCodexId
            ? getAdventureCodexMonsterById(session.adventureMonsterCodexId)
            : undefined;
    const monsterName = monsterEntry?.name;
    const monsterPortraitUrl = monsterEntry?.imageWebp;
    const blackUiPlayer =
        blackPlayer.id === aiUserId && monsterName ? { ...blackPlayer, nickname: monsterName } : blackPlayer;
    const whiteUiPlayer =
        whitePlayer.id === aiUserId && monsterName ? { ...whitePlayer, nickname: monsterName } : whitePlayer;
    const p1Seat = { ...player1, nickname: getSessionPlayerDisplayName(session, player1) };
    const p2Seat = { ...player2, nickname: getSessionPlayerDisplayName(session, player2) };
    const avatarUrlOverrides =
        monsterPortraitUrl ? { [aiUserId]: monsterPortraitUrl } satisfies Partial<Record<string, string>> : undefined;

    const cards = (
        <PreGameColorRoulette
            key={`${gameId}-${blackPlayerId}-${whitePlayerId}`}
            layout="cardsOnly"
            participantsInDisplayOrder={[p1Seat, p2Seat]}
            blackPlayer={blackUiPlayer}
            whitePlayer={whiteUiPlayer}
            avatarUrlOverrides={avatarUrlOverrides}
        />
    );
    const footer = (
        <ColorAssignmentStickyFooter
            variant={isHandheld ? 'sticky' : 'inline'}
            hasConfirmed={hasConfirmed}
            onConfirm={() => onAction({ type: 'CONFIRM_COLOR_START', payload: { gameId } })}
        />
    );

    return (
        <DraggableWindow
            title="흑·백 확인"
            initialWidth={360}
            shrinkHeightToContent
            windowId="color-start-confirmation"
            transparentModalBackdrop
        >
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

export default ColorStartConfirmationModal;
