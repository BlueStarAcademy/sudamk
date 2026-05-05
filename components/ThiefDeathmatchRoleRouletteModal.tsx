import React from 'react';
import { LiveGameSession } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import PreGameColorRoulette from './PreGameColorRoulette.js';
import { getSessionPlayerDisplayName } from '../utils/gameDisplayNames.js';

interface ThiefDeathmatchRoleRouletteModalProps {
    session: LiveGameSession;
}

/** 2라운드 동점 후 데스매치: 서버가 이미 도둑(흑)·경찰(백)을 정한 뒤 룰렛만 보여 주고 곧바로 굴림 단계로 넘어감 */
const ThiefDeathmatchRoleRouletteModal: React.FC<ThiefDeathmatchRoleRouletteModalProps> = ({ session }) => {
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
            title="데스매치 역할"
            windowId="thief-deathmatch-role-roulette"
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
                    title="데스매치 역할 룰렛"
                    subtitle="무작위로 도둑(흑)과 경찰(백)이 배정됩니다. 곧바로 굴림이 시작됩니다."
                    blackRoleLabel="도둑 · 흑"
                    whiteRoleLabel="경찰 · 백"
                />
                <p className="mt-3 text-center text-xs leading-relaxed text-stone-300">연출 종료 후 자동으로 진행됩니다.</p>
            </div>
        </DraggableWindow>
    );
};

export default ThiefDeathmatchRoleRouletteModal;
