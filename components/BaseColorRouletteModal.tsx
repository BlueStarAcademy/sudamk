import React from 'react';
import { LiveGameSession } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import PreGameColorRoulette from './PreGameColorRoulette.js';
import { getSessionPlayerDisplayName } from '../utils/gameDisplayNames.js';

interface BaseColorRouletteModalProps {
    session: LiveGameSession;
}

/** 바둑판 하단 푸터용(창 없음) */
export const BaseColorRouletteContent: React.FC<BaseColorRouletteModalProps> = ({ session }) => {
    const { blackPlayerId, whitePlayerId, player1, player2 } = session;

    if (!blackPlayerId || !whitePlayerId) return null;

    const blackPlayer = player1.id === blackPlayerId ? player1 : player2;
    const whitePlayer = player1.id === whitePlayerId ? player1 : player2;
    const blackUi = { ...blackPlayer, nickname: getSessionPlayerDisplayName(session, blackPlayer) };
    const whiteUi = { ...whitePlayer, nickname: getSessionPlayerDisplayName(session, whitePlayer) };
    const p1Seat = { ...player1, nickname: getSessionPlayerDisplayName(session, player1) };
    const p2Seat = { ...player2, nickname: getSessionPlayerDisplayName(session, player2) };

    return (
        <div className="text-white">
            <PreGameColorRoulette
                participantsInDisplayOrder={[p1Seat, p2Seat]}
                blackPlayer={blackUi}
                whitePlayer={whiteUi}
                durationMs={4200}
                title="무작위로 선공(흑)을 정합니다"
                subtitle="2차 덤 설정까지 동일하여, 룰렛으로 흑·백이 배정됩니다."
                suppressHeader
            />
            <p className="mt-3 text-center text-xs leading-relaxed text-stone-300">잠시 후 흑·백·덤 안내 화면으로 넘어갑니다.</p>
        </div>
    );
};

/** 베이스 바둑: 2차 덤까지 동일할 때 서버가 무작위로 흑·백을 정한 뒤 연출용 단계 */
const BaseColorRouletteModal: React.FC<BaseColorRouletteModalProps> = (props) => (
    <DraggableWindow
        title="흑 · 백 룰렛"
        windowId="base-color-roulette"
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
        <BaseColorRouletteContent {...props} />
    </DraggableWindow>
);

export default BaseColorRouletteModal;
