import { LiveGameSession, Player } from '../types.js';

type PveSeatSession = Pick<LiveGameSession, 'blackPlayerId' | 'whitePlayerId' | 'player1'> & {
    playingLockedBlackPlayerId?: string | null;
    playingLockedWhitePlayerId?: string | null;
};

/**
 * PVE(싱글/도전의 탑)에서 현재 유저의 본대국 색과 상대 색을 계산한다.
 * 베이스 사전 단계처럼 본대국 좌석이 아직 잠기지 않은 경우 player1=흑 폴백을 사용한다.
 */
export function resolvePveSeatColors(
    session: PveSeatSession,
    viewerUserId: string | null | undefined,
): { myPlayerEnum: Player; opponentPlayerEnum: Player } {
    let myPlayerEnum = Player.None;
    if (viewerUserId && session.blackPlayerId === viewerUserId) {
        myPlayerEnum = Player.Black;
    } else if (viewerUserId && session.whitePlayerId === viewerUserId) {
        myPlayerEnum = Player.White;
    } else if (viewerUserId && session.playingLockedBlackPlayerId === viewerUserId) {
        myPlayerEnum = Player.Black;
    } else if (viewerUserId && session.playingLockedWhitePlayerId === viewerUserId) {
        myPlayerEnum = Player.White;
    } else if (viewerUserId && session.player1?.id === viewerUserId) {
        myPlayerEnum = Player.Black;
    }

    const opponentPlayerEnum = myPlayerEnum === Player.White ? Player.Black : Player.White;
    return { myPlayerEnum, opponentPlayerEnum };
}

