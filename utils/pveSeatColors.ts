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

/** 서버 `scanInventoryKeyForPlayer`와 동일 — PVE 세션 잔여 스캔 키 */
export function pveScanKeyForPlayer(player: Player): 'scans_p1' | 'scans_p2' {
    return player === Player.White ? 'scans_p2' : 'scans_p1';
}

export function pveHiddenKeyForPlayer(player: Player): 'hidden_stones_p1' | 'hidden_stones_p2' {
    return player === Player.White ? 'hidden_stones_p2' : 'hidden_stones_p1';
}

export function pveMissileKeyForPlayer(player: Player): 'missiles_p1' | 'missiles_p2' {
    return player === Player.White ? 'missiles_p2' : 'missiles_p1';
}

type PveItemInventorySession = PveSeatSession & {
    scans_p1?: number;
    scans_p2?: number;
    hidden_stones_p1?: number;
    hidden_stones_p2?: number;
    missiles_p1?: number;
    missiles_p2?: number;
};

/** PVE(싱글/탑) 경기 중 아이템 배지: 본인 좌석(p1=흑, p2=백) 기준 잔여 수 */
export function resolvePveItemCountFromSession(
    session: PveItemInventorySession,
    viewerUserId: string | null | undefined,
    kind: 'scan' | 'hidden' | 'missile',
    fallback: number,
): number {
    const { myPlayerEnum } = resolvePveSeatColors(session, viewerUserId);
    const key =
        myPlayerEnum === Player.White
            ? kind === 'scan'
                ? 'scans_p2'
                : kind === 'hidden'
                  ? 'hidden_stones_p2'
                  : 'missiles_p2'
            : kind === 'scan'
              ? 'scans_p1'
              : kind === 'hidden'
                ? 'hidden_stones_p1'
                : 'missiles_p1';
    const n = Number((session as Record<string, unknown>)[key]);
    if (Number.isFinite(n)) return Math.max(0, n);
    return Math.max(0, fallback);
}

