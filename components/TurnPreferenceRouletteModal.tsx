import React from 'react';
import { LiveGameSession } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import PreGameColorRoulette from './PreGameColorRoulette.js';
import { getSessionPlayerDisplayName } from '../utils/gameDisplayNames.js';

interface TurnPreferenceRouletteModalProps {
    session: LiveGameSession;
}

/** 선후공 선택이 동일할 때: 서버가 이미 흑·백을 정한 뒤 룰렛만 보여 주고 다음 단계로 넘어감 */
const TurnPreferenceRouletteModal: React.FC<TurnPreferenceRouletteModalProps> = ({ session }) => {
    const { blackPlayerId, whitePlayerId, player1, player2 } = session;

    if (!blackPlayerId || !whitePlayerId) return null;

    const blackPlayer = player1.id === blackPlayerId ? player1 : player2;
    const whitePlayer = player1.id === whitePlayerId ? player1 : player2;
    const blackUi = { ...blackPlayer, nickname: getSessionPlayerDisplayName(session, blackPlayer) };
    const whiteUi = { ...whitePlayer, nickname: getSessionPlayerDisplayName(session, whitePlayer) };
    const p1Seat = { ...player1, nickname: getSessionPlayerDisplayName(session, player1) };
    const p2Seat = { ...player2, nickname: getSessionPlayerDisplayName(session, player2) };

    return (
        <DraggableWindow
            title="선공 · 후공"
            windowId="turn-preference-roulette"
            initialWidth={400}
            shrinkHeightToContent
            modal={false}
            hideFooter
            headerShowTitle
            defaultPosition={{ x: 12, y: 88 }}
            bodyPaddingClassName="p-3 sm:p-4"
            bodyNoScroll
            containerExtraClassName="!max-w-[min(100vw,440px)]"
        >
            <div className="text-white">
                <PreGameColorRoulette
                    participantsInDisplayOrder={[p1Seat, p2Seat]}
                    blackPlayer={blackUi}
                    whitePlayer={whiteUi}
                    durationMs={4200}
                    title="선공 · 후공 룰렛"
                    subtitle="선택이 같아 무작위로 선공(흑)과 후공(백)을 정합니다."
                />
                <p className="mt-3 text-center text-xs leading-relaxed text-stone-300">연출 종료 후 자동으로 진행됩니다.</p>
            </div>
        </DraggableWindow>
    );
};

export default TurnPreferenceRouletteModal;
