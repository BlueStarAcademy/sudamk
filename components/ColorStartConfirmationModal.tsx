import React, { useEffect, useState } from 'react';
import { LiveGameSession, User, ServerAction } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import PreGameColorRoulette from './PreGameColorRoulette.js';
import { ColorAssignmentStickyFooter } from './ColorAssignmentStickyFooter.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { aiUserId } from '../constants/index.js';
import { getAdventureCodexMonsterById } from '../constants/adventureMonstersCodex.js';
import { getSessionPlayerDisplayName } from '../utils/gameDisplayNames.js';
import { resolveArenaSessionPolicy } from '../shared/utils/liveSessionArenaKind.js';
import { PRE_GAME_PVP_COUNTDOWN_SECONDS } from '../shared/constants/preGameCountdown.js';

interface ColorStartConfirmationModalProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const ColorStartConfirmationModal: React.FC<ColorStartConfirmationModalProps> = ({ session, currentUser, onAction }) => {
    const isHandheld = useIsHandheldDevice(1025);
    const { id: gameId, player1, player2, blackPlayerId, whitePlayerId, preGameConfirmations } = session;
    const hasConfirmed = !!preGameConfirmations?.[currentUser.id];
    const [colorRouletteDone, setColorRouletteDone] = useState(false);
    useEffect(() => {
        setColorRouletteDone(false);
    }, [gameId, blackPlayerId, whitePlayerId]);

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
            onComplete={() => setColorRouletteDone(true)}
        />
    );
    const footer = (
        <ColorAssignmentStickyFooter
            variant="sticky"
            hasConfirmed={hasConfirmed}
            rouletteBlockingStart={!colorRouletteDone}
            showCountdown={resolveArenaSessionPolicy(session).matchAxis === 'pvp'}
            countdownDeadline={session.revealEndTime}
            countdownSeconds={PRE_GAME_PVP_COUNTDOWN_SECONDS}
            onConfirm={() => onAction({ type: 'CONFIRM_COLOR_START', payload: { gameId } })}
        />
    );

    const scrollMainClass = isHandheld
        ? 'flex min-h-0 flex-1 flex-col justify-center overflow-y-auto overflow-x-hidden overscroll-y-contain text-white'
        : 'flex min-h-0 flex-1 flex-col justify-center overflow-y-auto overflow-x-hidden overscroll-y-contain py-3 text-white sm:py-4';

    return (
        <DraggableWindow
            title="흑·백 확인"
            initialWidth={360}
            shrinkHeightToContent
            windowId="color-start-confirmation"
            transparentModalBackdrop
            skipSavedPosition
            hideFooter
            headerShowTitle
            mobileViewportFit
            mobileViewportMaxHeightCss="calc(100dvh - 8px)"
            mobileViewportDvhBottomGapPx={8}
            bodyPaddingClassName="p-0"
            bodyNoScroll
            containerExtraClassName="!max-w-[min(94vw,22.5rem)]"
        >
            <>
                <div className={scrollMainClass}>{cards}</div>
                {footer}
            </>
        </DraggableWindow>
    );
};

export default ColorStartConfirmationModal;
