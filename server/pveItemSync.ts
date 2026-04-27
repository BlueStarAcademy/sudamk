import type { LiveGameSession, PveItemActionClientSync } from '../shared/types/index.js';
import { Player } from '../types/index.js';

const DEFAULT_AI_USER_ID = 'ai-player-01';

function isAiControlledPlayer(game: LiveGameSession, player: Player): boolean {
    const playerId = player === Player.Black ? game.blackPlayerId : player === Player.White ? game.whitePlayerId : undefined;
    return playerId === DEFAULT_AI_USER_ID || String(playerId ?? '').startsWith('dungeon-bot-');
}

function isPlayablePoint(move: { x?: number; y?: number } | undefined): move is { x: number; y: number } {
    return !!move && Number.isInteger(move.x) && Number.isInteger(move.y) && move.x >= 0 && move.y >= 0;
}

function keepServerAiMoveHistoryStable(
    game: LiveGameSession,
    syncedMoveHistory: LiveGameSession['moveHistory'],
    syncedBoardState: LiveGameSession['boardState']
): void {
    const serverMoveHistory = game.moveHistory;
    const serverBoardState = game.boardState;
    if (!Array.isArray(serverMoveHistory) || serverMoveHistory.length === 0 || !Array.isArray(syncedMoveHistory)) return;

    const syncDoesNotAdvanceServer = syncedMoveHistory.length <= serverMoveHistory.length;

    for (let i = 0; i < Math.min(serverMoveHistory.length, syncedMoveHistory.length); i++) {
        const serverMove = serverMoveHistory[i];
        if (!serverMove || !isAiControlledPlayer(game, serverMove.player) || !isPlayablePoint(serverMove)) continue;

        const syncedMove = syncedMoveHistory[i];
        const syncedChangedAiMove =
            !syncedMove ||
            syncedMove.player !== serverMove.player ||
            syncedMove.x !== serverMove.x ||
            syncedMove.y !== serverMove.y;

        if (syncedChangedAiMove) {
            if (
                syncDoesNotAdvanceServer &&
                isPlayablePoint(syncedMove) &&
                Array.isArray(serverBoardState) &&
                Array.isArray(syncedBoardState) &&
                syncedBoardState[syncedMove.y]?.[syncedMove.x] === serverMove.player &&
                serverBoardState[syncedMove.y]?.[syncedMove.x] !== serverMove.player &&
                !serverMoveHistory.some(
                    (move) =>
                        move &&
                        move.player === serverMove.player &&
                        move.x === syncedMove.x &&
                        move.y === syncedMove.y
                )
            ) {
                syncedBoardState[syncedMove.y][syncedMove.x] =
                    serverBoardState[syncedMove.y]?.[syncedMove.x] ?? Player.None;
            }
            syncedMoveHistory[i] = { ...serverMove };
        }

        // Stale same-length client snapshots must not erase an already confirmed AI stone.
        // Longer snapshots may include a new user move that legitimately captured it.
        if (
            syncDoesNotAdvanceServer &&
            Array.isArray(serverBoardState) &&
            Array.isArray(syncedBoardState) &&
            serverBoardState[serverMove.y]?.[serverMove.x] === serverMove.player &&
            syncedBoardState[serverMove.y]?.[serverMove.x] !== serverMove.player
        ) {
            syncedBoardState[serverMove.y][serverMove.x] = serverMove.player;
        }
    }
}

/**
 * 미사일 이동 후 클라가 boardState만 맞고 moveHistory 좌표는 예전 교차점에 남는 경우 —
 * Kata 입력(수순 재생)과 실제 판이 달라져 AI가 이미 돌이 있는 점을 비었다고 두는 것을 방지한다.
 * (LAUNCH_MISSILE에서 서버가 수순을 고쳤는데, 이후 clientSync가 클라의 옛 수순으로 덮어쓸 때 재정렬)
 */
function reconcileMoveHistoryCoordsToBoardState(game: LiveGameSession): void {
    const mh = game.moveHistory;
    const bs = game.boardState;
    if (!Array.isArray(mh) || mh.length === 0 || !Array.isArray(bs) || bs.length === 0) return;
    const sz = bs.length;
    const gc = String((game as { gameCategory?: string }).gameCategory ?? '');
    const pveLike =
        game.isSinglePlayer || gc === 'tower' || gc === 'singleplayer' || gc === 'guildwar' || gc === 'adventure';
    if (!pveLike) return;
    const isMissileLikeMode =
        game.mode === 'missile' ||
        (game.mode === 'mix' && Array.isArray((game.settings as any)?.mixedModes) && (game.settings as any).mixedModes.includes('missile'));
    // 이 좌표 보정은 "미사일 이동 후 수순-보드 불일치" 전용 복구다.
    // 히든 대국에 적용하면 방금 둔 히든 착수가 다른 칸으로 재매핑되는 부작용이 생길 수 있어 제한한다.
    if (!isMissileLikeMode) return;

    for (let pass = 0; pass < mh.length + 2; pass++) {
        let changed = false;
        const claimed = new Set<string>();
        for (let j = 0; j < mh.length; j++) {
            const m = mh[j];
            if (!m || m.x < 0 || m.y < 0) continue;
            if (m.player !== Player.Black && m.player !== Player.White) continue;
            if (m.y < sz && m.x < sz && bs[m.y][m.x] === m.player) {
                claimed.add(`${m.x},${m.y}`);
            }
        }
        for (let i = 0; i < mh.length; i++) {
            const m = mh[i];
            if (!m || m.x < 0 || m.y < 0) continue;
            if (m.player !== Player.Black && m.player !== Player.White) continue;
            if (isAiControlledPlayer(game, m.player)) continue;
            if (m.y < sz && m.x < sz && bs[m.y][m.x] === m.player) continue;
            const candidates: { x: number; y: number }[] = [];
            for (let y = 0; y < sz; y++) {
                for (let x = 0; x < sz; x++) {
                    if (bs[y][x] !== m.player) continue;
                    const key = `${x},${y}`;
                    if (claimed.has(key)) continue;
                    candidates.push({ x, y });
                }
            }
            if (candidates.length === 1) {
                const { x, y } = candidates[0]!;
                m.x = x;
                m.y = y;
                claimed.add(`${x},${y}`);
                changed = true;
            }
        }
        if (!changed) break;
    }
}

/** PVE: 클라(TOWER_CLIENT_MOVE 등)만 앞서 있는 판·hiddenMoves를 아이템 액션 직전 서버 세션에 반영 */
export function applyPveItemActionClientSync(game: LiveGameSession, payload: unknown): void {
    const sync = (payload as { clientSync?: PveItemActionClientSync })?.clientSync;
    if (!sync || typeof sync !== 'object') return;
    if (!Array.isArray(sync.boardState) || sync.boardState.length === 0) return;
    if (!Array.isArray(sync.moveHistory)) return;
    const serverCurrentPlayer = game.currentPlayer;
    const serverMoveHistoryLength = Array.isArray(game.moveHistory) ? game.moveHistory.length : 0;
    const syncedBoardState = sync.boardState.map((row: number[]) => [...row]);
    const syncedMoveHistory = sync.moveHistory.map((m) => ({ ...m }));
    const syncAdvancesServerMoves = syncedMoveHistory.length > serverMoveHistoryLength;
    keepServerAiMoveHistoryStable(game, syncedMoveHistory, syncedBoardState);
    game.boardState = syncedBoardState;
    game.moveHistory = syncedMoveHistory;
    if (sync.hiddenMoves != null && typeof sync.hiddenMoves === 'object') {
        game.hiddenMoves = { ...sync.hiddenMoves };
    }
    if (Array.isArray(sync.permanentlyRevealedStones)) {
        game.permanentlyRevealedStones = sync.permanentlyRevealedStones.map((p) => ({ ...p }));
    }
    if (sync.aiInitialHiddenStone === null) {
        (game as { aiInitialHiddenStone?: unknown }).aiInitialHiddenStone = undefined;
    } else if (
        sync.aiInitialHiddenStone &&
        typeof (sync.aiInitialHiddenStone as { x?: number }).x === 'number' &&
        typeof (sync.aiInitialHiddenStone as { y?: number }).y === 'number'
    ) {
        (game as { aiInitialHiddenStone?: { x: number; y: number } }).aiInitialHiddenStone = {
            x: sync.aiInitialHiddenStone.x,
            y: sync.aiInitialHiddenStone.y,
        };
    }
    if (sync.currentPlayer !== undefined && sync.currentPlayer !== null) {
        const staleSyncWouldSkipAiTurn =
            !syncAdvancesServerMoves &&
            isAiControlledPlayer(game, serverCurrentPlayer) &&
            !isAiControlledPlayer(game, sync.currentPlayer);
        if (!staleSyncWouldSkipAiTurn) {
        game.currentPlayer = sync.currentPlayer;
        }
    }
    if (sync.gameStatus !== undefined && sync.gameStatus !== null) {
        const srv = String(game.gameStatus);
        const cli = String(sync.gameStatus);
        // 아이템 UI는 서버가 먼저 전환한 뒤 클라·WS가 한 틱 늦으면 sync에 아직 playing이 남는다.
        // 그대로 덮으면 missile_selecting 등이 풀려 LAUNCH_MISSILE이 전부 400이 된다.
        const serverItemUi =
            srv === 'missile_selecting' ||
            srv === 'missile_animating' ||
            srv === 'hidden_placing' ||
            srv === 'scanning' ||
            srv === 'scanning_animating' ||
            srv === 'hidden_reveal_animating';
        if (!(serverItemUi && cli === 'playing')) {
            (game as { gameStatus: LiveGameSession['gameStatus'] }).gameStatus = sync.gameStatus;
        }
    }
    if (sync.captures && typeof sync.captures === 'object') {
        game.captures = { ...game.captures, ...sync.captures } as typeof game.captures;
    }
    if ('koInfo' in sync) {
        game.koInfo = sync.koInfo ?? null;
    }
    if (sync.totalTurns != null && Number.isFinite(sync.totalTurns)) {
        game.totalTurns = sync.totalTurns;
    }
    reconcileMoveHistoryCoordsToBoardState(game);

    const gc = String((game as any).gameCategory ?? '');
    const pveLike =
        game.isSinglePlayer || gc === 'tower' || gc === 'singleplayer' || gc === 'guildwar' || gc === 'adventure';
    if (pveLike) {
        // clientSync 이후에도 남은 오프닝 스냅샷 + 수순 조합이 Kata 재생과 어긋나 Illegal move가 날 수 있음 → 다음 AI에서 재검증
        (game as any).kataPveKataMovesFromBoardStateOnly = false;
    }
}
