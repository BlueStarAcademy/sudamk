import { aiUserId } from '../../shared/constants/auth.js';
import { Player } from '../../shared/types/enums.js';
import type { LiveGameSession } from '../../shared/types/entities.js';
import type { VolatileState } from '../../types/index.js';
import { UserStatus } from '../../types/index.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';
import * as db from '../db.js';
import { removeGameFromCache } from '../gameCache.js';

export type PveAbandonReason = 'logout' | 'disconnect' | 'session_expired' | 'connection_timeout';

const TERMINAL_GAME_STATUSES = new Set(['ended', 'no_contest', 'scoring']);

/** 로그아웃·세션 만료·접속 타임아웃 등 강제 이탈 — 정산 시 보상·EXP 없이 기권 패배 처리 */
export function markPveAbandonForfeit(game: LiveGameSession): void {
    (game as LiveGameSession & { pveAbandonForfeit?: boolean }).pveAbandonForfeit = true;
}

export function isPveAbandonForfeitGame(game: LiveGameSession | null | undefined): boolean {
    return Boolean((game as LiveGameSession & { pveAbandonForfeit?: boolean } | null | undefined)?.pveAbandonForfeit);
}

/** 로그아웃·세션 만료·접속 끊김 시 패배 처리 후 방을 제거해야 하는 PVE 세션 */
export function isPveSessionAbandonOnLeave(game: LiveGameSession | null | undefined): boolean {
    if (!game) return false;
    return resolveArenaSessionPolicy(game).matchAxis === 'pve';
}

export function resolvePveAbandonAiWinner(game: LiveGameSession, humanUserId: string): Player {
    if (game.blackPlayerId === humanUserId) return Player.White;
    if (game.whitePlayerId === humanUserId) return Player.Black;
    return game.blackPlayerId === aiUserId ? Player.Black : Player.White;
}

function clearInGameUserStatus(volatileState: VolatileState, userId: string): void {
    const status = volatileState.userStatuses[userId];
    if (!status) return;
    delete status.gameId;
    delete status.mode;
    delete status.arenaChannel;
    status.status = UserStatus.Online;
}

/**
 * PVE 인게임 유저가 로그아웃·세션 만료·마지막 WebSocket 끊김 등으로 이탈할 때:
 * AI 승리(패배) 정산 → LiveGame 삭제 → GAME_DELETED.
 * 행동력은 입장 시 이미 차감된 상태를 유지한다(환불 없음).
 */
export async function applyPveAbandonOnPlayerLeave(
    volatileState: VolatileState,
    userId: string,
    game: LiveGameSession,
    reason: PveAbandonReason = 'disconnect',
): Promise<boolean> {
    if (!isPveSessionAbandonOnLeave(game)) return false;
    if (TERMINAL_GAME_STATUSES.has(String(game.gameStatus))) return false;

    const isParticipant = game.player1?.id === userId || game.player2?.id === userId;
    if (!isParticipant) return false;

    console.log(
        `[PVE Abandon] ${reason}: user=${userId} game=${game.id} category=${game.gameCategory ?? 'unknown'}`,
    );

    clearInGameUserStatus(volatileState, userId);

    markPveAbandonForfeit(game);
    const aiWinner = resolvePveAbandonAiWinner(game, userId);
    const { endGame } = await import('../summaryService.js');
    await endGame(game, aiWinner, 'resign');

    await db.deleteGame(game.id);
    removeGameFromCache(game.id);
    if (volatileState.gameChats) delete volatileState.gameChats[game.id];

    const { broadcast } = await import('../socket.js');
    broadcast({ type: 'GAME_DELETED', payload: { gameId: game.id, reason: 'pve_abandon' } });

    return true;
}

/**
 * userStatuses의 in-game gameId 기준 PVE abandon.
 * PVP용 applyPvpInGameDisconnect와 대칭 — WS 유예 후·로그아웃 등에서 호출.
 */
export async function applyPveInGameDisconnect(
    volatileState: VolatileState,
    disconnectedUserId: string,
    reason: PveAbandonReason = 'disconnect',
): Promise<boolean> {
    const userStatus = volatileState.userStatuses[disconnectedUserId];
    const activeGameId = userStatus?.gameId;
    if (userStatus?.status !== UserStatus.InGame || !activeGameId) return false;

    const game = await db.getLiveGame(activeGameId);
    if (!game) return false;

    return applyPveAbandonOnPlayerLeave(volatileState, disconnectedUserId, game, reason);
}
