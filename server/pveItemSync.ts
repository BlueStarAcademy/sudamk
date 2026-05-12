import type { LiveGameSession, PveItemActionClientSync } from '../shared/types/index.js';
import { GameMode, Player } from '../types/index.js';
import { resolveArenaSessionPolicy } from '../shared/utils/liveSessionArenaKind.js';

/** 히든/스캔 모드 진입 등: 클라 `hiddenMoves`·`aiInitialHiddenStone` 병합으로 잘못된 돌이 히든으로 보이는 것을 막음 */
export type ApplyPveItemActionClientSyncOptions = {
    preserveServerHiddenPlacementMeta?: boolean;
};

const DEFAULT_AI_USER_ID = 'ai-player-01';

function isAiControlledPlayer(game: LiveGameSession, player: Player): boolean {
    const playerId = player === Player.Black ? game.blackPlayerId : player === Player.White ? game.whitePlayerId : undefined;
    return playerId === DEFAULT_AI_USER_ID || String(playerId ?? '').startsWith('dungeon-bot-');
}

function getBoardOwnerAt(game: LiveGameSession, x: number, y: number): Player | undefined {
    const owner = game.boardState?.[y]?.[x];
    return owner === Player.Black || owner === Player.White ? owner : undefined;
}

function isPlayablePoint(move: { x?: number; y?: number } | undefined): move is { x: number; y: number } {
    return (
        !!move &&
        typeof move.x === 'number' &&
        typeof move.y === 'number' &&
        Number.isInteger(move.x) &&
        Number.isInteger(move.y) &&
        move.x >= 0 &&
        move.y >= 0
    );
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
        game.mode === GameMode.Missile ||
        (game.mode === GameMode.Mix &&
            Array.isArray((game.settings as any)?.mixedModes) &&
            (game.settings as any).mixedModes.includes(GameMode.Missile));
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

const BASE_PRE_PLAY_STATUSES = new Set([
    'base_placement',
    'base_stone_color_choice',
    'base_same_color_points_bid',
    'base_game_start_confirmation',
]);

function isMissileLikePveGame(game: LiveGameSession): boolean {
    const gc = String((game as { gameCategory?: string }).gameCategory ?? '');
    const pveLike =
        game.isSinglePlayer || gc === 'tower' || gc === 'singleplayer' || gc === 'guildwar' || gc === 'adventure';
    if (!pveLike) return false;
    const mode = String(game.mode ?? '');
    return (
        game.mode === GameMode.Missile ||
        mode === 'missile' ||
        (game.mode === GameMode.Mix &&
            Array.isArray((game.settings as any)?.mixedModes) &&
            (game.settings as any).mixedModes.includes(GameMode.Missile))
    );
}

function applySameLengthHumanMoveHistorySync(
    game: LiveGameSession,
    syncedMoveHistory: LiveGameSession['moveHistory'],
    serverMoveHistoryLength: number
): void {
    if (!isMissileLikePveGame(game)) return;
    if (!Array.isArray(game.moveHistory) || !Array.isArray(syncedMoveHistory)) return;
    if (syncedMoveHistory.length !== serverMoveHistoryLength || game.moveHistory.length !== serverMoveHistoryLength) return;

    for (let i = 0; i < game.moveHistory.length; i++) {
        const serverMove = game.moveHistory[i];
        const syncedMove = syncedMoveHistory[i];
        if (!serverMove || !syncedMove) continue;
        if (serverMove.player !== syncedMove.player) continue;
        if (isAiControlledPlayer(game, serverMove.player)) continue;
        if (!isPlayablePoint(serverMove) || !isPlayablePoint(syncedMove)) continue;
        game.moveHistory[i] = { ...serverMove, x: syncedMove.x, y: syncedMove.y };
    }
}

function preserveBaseStonesAfterClientSync(
    game: LiveGameSession,
    serverBaseStonesSnapshot: NonNullable<LiveGameSession['baseStones']> | undefined,
    syncAdvancesServerMoves: boolean
): void {
    if (!serverBaseStonesSnapshot?.length || !Array.isArray(game.boardState)) return;

    if (!syncAdvancesServerMoves) {
        game.baseStones = serverBaseStonesSnapshot.map((stone) => ({ ...stone }));
        for (const stone of game.baseStones) {
            if (game.boardState[stone.y]?.[stone.x] !== undefined) {
                game.boardState[stone.y][stone.x] = stone.player;
            }
        }
        return;
    }

    // 클라 수순이 서버보다 앞선 경우에는 해당 좌표가 비었거나 다른 색이면 실제로 잡힌 것으로 본다.
    game.baseStones = serverBaseStonesSnapshot
        .filter((stone) => game.boardState[stone.y]?.[stone.x] === stone.player)
        .map((stone) => ({ ...stone }));
}

function mergeMonotonicCountRecord<T extends LiveGameSession['captures'] | LiveGameSession['baseStoneCaptures']>(
    current: T,
    incoming: T | undefined
): T {
    if (!incoming || typeof incoming !== 'object') return current;
    const keys = new Set<number>();
    for (const src of [current, incoming]) {
        if (!src || typeof src !== 'object') continue;
        for (const key of Object.keys(src as object)) keys.add(Number(key));
    }
    const out: Record<number, number> = {};
    for (const key of keys) {
        out[key] = Math.max(Number((current as any)?.[key]) || 0, Number((incoming as any)?.[key]) || 0);
    }
    return out as T;
}

function mergeHiddenMovesFromClientSync(
    game: LiveGameSession,
    incomingHiddenMoves: unknown,
    syncAdvancesServerMoves: boolean,
    serverMoveHistoryLength: number,
    allowClientIntroduceHiddenOnAppendedMoves: boolean
): void {
    if (incomingHiddenMoves == null || typeof incomingHiddenMoves !== 'object') return;
    const incoming = incomingHiddenMoves as Record<string, unknown>;
    const current = (game.hiddenMoves ?? {}) as Record<string, boolean>;
    const next: Record<number, boolean> = {};

    // Keep only valid server-confirmed entries for the current move history.
    for (const [idxRaw, isHidden] of Object.entries(current)) {
        if (!isHidden) continue;
        const idx = Number(idxRaw);
        if (!Number.isInteger(idx) || idx < 0) continue;
        if (!Array.isArray(game.moveHistory) || !game.moveHistory[idx]) continue;
        next[idx] = true;
    }

    for (const [idxRaw, isHidden] of Object.entries(incoming)) {
        if (!isHidden) continue;
        const idx = Number(idxRaw);
        if (!Number.isInteger(idx) || idx < 0) continue;
        if (!Array.isArray(game.moveHistory) || !game.moveHistory[idx]) continue;

        const alreadyServerHidden = !!current[idxRaw] || !!current[String(idx)];
        if (!alreadyServerHidden) {
            // Default: never trust client snapshots to relabel existing normal stones as hidden.
            // Exception: while actually placing a hidden stone, accept hidden labels only for
            // newly appended move indices in a client-advanced snapshot.
            //
            // 도전의 탑 등: 클라가 수순만 앞서고 hiddenMoves 맵은 stale(예: {0:true})인 패킷이 오면
            // `idx >= serverMoveHistoryLength`만으로는 serverMoveHistoryLength===0일 때 전 구간이 통과되어
            // 첫 수가 히든으로 재라벨링된다. 서버에 이미 수가 있으면 "append 구간"만 신뢰한다.
            const appendedOnlyIdx = idx >= serverMoveHistoryLength;
            const safeTailWhenCatchUpFromEmpty =
                serverMoveHistoryLength === 0 ? idx === game.moveHistory.length - 1 : true;
            const canIntroduceFromClient =
                allowClientIntroduceHiddenOnAppendedMoves &&
                syncAdvancesServerMoves &&
                appendedOnlyIdx &&
                safeTailWhenCatchUpFromEmpty;
            if (!canIntroduceFromClient) continue;
        }
        next[idx] = true;
    }

    game.hiddenMoves = next;
}

function mergePermanentlyRevealedPoints(
    current: LiveGameSession['permanentlyRevealedStones'],
    incoming: PveItemActionClientSync['permanentlyRevealedStones']
): LiveGameSession['permanentlyRevealedStones'] {
    const out: Array<{ x: number; y: number }> = [];
    const seen = new Set<string>();
    const pushUnique = (x: number, y: number) => {
        const key = `${x},${y}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ x, y });
    };

    if (Array.isArray(current)) {
        for (const p of current) {
            if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') continue;
            pushUnique(p.x, p.y);
        }
    }
    if (Array.isArray(incoming)) {
        for (const p of incoming) {
            if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') continue;
            pushUnique(p.x, p.y);
        }
    }

    return out.length > 0 ? out : undefined;
}

function applyClientBaseStoneSnapshotIfAuthoritative(
    game: LiveGameSession,
    sync: PveItemActionClientSync,
    serverBaseStonesSnapshot: NonNullable<LiveGameSession['baseStones']> | undefined,
    syncAdvancesServerMoves: boolean
): void {
    if (!Array.isArray(sync.baseStones) || !Array.isArray(game.boardState)) return;
    if (!syncAdvancesServerMoves && serverBaseStonesSnapshot?.length) return;

    game.baseStones = sync.baseStones
        .filter((stone) => {
            if (!stone || typeof stone.x !== 'number' || typeof stone.y !== 'number') return false;
            return game.boardState[stone.y]?.[stone.x] === stone.player;
        })
        .map((stone) => ({ ...stone }));
}

function applyClientOverlaySnapshotsIfPresent(game: LiveGameSession, sync: PveItemActionClientSync): void {
    if (Array.isArray(sync.blackPatternStones)) {
        game.blackPatternStones = sync.blackPatternStones.map((p) => ({ ...p }));
    }
    if (Array.isArray(sync.whitePatternStones)) {
        game.whitePatternStones = sync.whitePatternStones.map((p) => ({ ...p }));
    }
    if (Array.isArray(sync.consumedPatternIntersections)) {
        (game as any).consumedPatternIntersections = sync.consumedPatternIntersections.map((p) => ({ ...p }));
    }
    game.baseStoneCaptures = mergeMonotonicCountRecord(game.baseStoneCaptures, sync.baseStoneCaptures);
    game.hiddenStoneCaptures = mergeMonotonicCountRecord(game.hiddenStoneCaptures, sync.hiddenStoneCaptures);
}

function hasCommittedBaseOpeningWithoutMoves(
    game: LiveGameSession,
    serverBaseStonesSnapshot: NonNullable<LiveGameSession['baseStones']> | undefined,
    serverMoveHistoryLength: number
): boolean {
    return (
        serverMoveHistoryLength === 0 &&
        !!serverBaseStonesSnapshot?.length &&
        String(game.gameStatus) === 'playing'
    );
}

/** PVE: 클라(TOWER_CLIENT_MOVE 등)만 앞서 있는 판·hiddenMoves를 아이템 액션 직전 서버 세션에 반영 */
export function applyPveItemActionClientSync(
    game: LiveGameSession,
    payload: unknown,
    opts?: ApplyPveItemActionClientSyncOptions,
): void {
    const sync = (payload as { clientSync?: PveItemActionClientSync })?.clientSync;
    if (!sync || typeof sync !== 'object') return;
    if (!Array.isArray(sync.boardState) || sync.boardState.length === 0) return;
    if (!Array.isArray(sync.moveHistory)) return;
    const preserveHiddenMeta = opts?.preserveServerHiddenPlacementMeta === true;
    const serverHiddenMovesSnapshot = preserveHiddenMeta ? { ...(game.hiddenMoves ?? {}) } : null;
    const serverAiInitialHidden = preserveHiddenMeta ? (game as { aiInitialHiddenStone?: unknown }).aiInitialHiddenStone : undefined;
    const serverAiInitialHiddenPre = preserveHiddenMeta
        ? (game as { aiInitialHiddenStoneIsPrePlaced?: unknown }).aiInitialHiddenStoneIsPrePlaced
        : undefined;

    const serverMoveHistoryLength = Array.isArray(game.moveHistory) ? game.moveHistory.length : 0;
    const serverBaseStonesSnapshot = game.baseStones?.map((stone) => ({ ...stone }));
    const syncedBoardState = sync.boardState.map((row: number[]) => [...row]);
    const syncedMoveHistory = sync.moveHistory.map((m) => ({ ...m }));
    const syncAdvancesServerMoves = syncedMoveHistory.length > serverMoveHistoryLength;
    const serverBaseOpeningNoMoves = hasCommittedBaseOpeningWithoutMoves(
        game,
        serverBaseStonesSnapshot,
        serverMoveHistoryLength
    );
    const syncStatusString = String(sync.gameStatus ?? '');
    const syncCanReplaceServerProgress =
        syncAdvancesServerMoves ||
        (!serverBaseOpeningNoMoves && serverMoveHistoryLength === 0 && !BASE_PRE_PLAY_STATUSES.has(syncStatusString));
    keepServerAiMoveHistoryStable(game, syncedMoveHistory, syncedBoardState);
    if (syncCanReplaceServerProgress) {
        game.boardState = syncedBoardState;
        game.moveHistory = syncedMoveHistory;
    } else {
        applySameLengthHumanMoveHistorySync(game, syncedMoveHistory, serverMoveHistoryLength);
    }
    preserveBaseStonesAfterClientSync(game, serverBaseStonesSnapshot, syncAdvancesServerMoves);
    applyClientBaseStoneSnapshotIfAuthoritative(game, sync, serverBaseStonesSnapshot, syncAdvancesServerMoves);
    applyClientOverlaySnapshotsIfPresent(game, sync);
    if (!preserveHiddenMeta) {
        const serverHiddenPlacing = String(game.gameStatus ?? '') === 'hidden_placing';
        const clientHiddenPlacing = String(sync.gameStatus ?? '') === 'hidden_placing';
        // 히든 라벨 신규 도입은 "서버·클라 모두 hidden_placing"에서만 허용한다.
        // 한쪽만 hidden_placing인 스냅샷(REQUEST_SERVER_AI_MOVE 경합 등)은 stale 가능성이 높아
        // 기존 일반돌을 히든으로 재라벨링하는 원인이 된다.
        const allowClientIntroduceHiddenOnAppendedMoves = serverHiddenPlacing && clientHiddenPlacing;
        mergeHiddenMovesFromClientSync(
            game,
            sync.hiddenMoves,
            syncAdvancesServerMoves,
            serverMoveHistoryLength,
            allowClientIntroduceHiddenOnAppendedMoves
        );
    }
    game.permanentlyRevealedStones = mergePermanentlyRevealedPoints(
        game.permanentlyRevealedStones,
        sync.permanentlyRevealedStones
    );
    if (!preserveHiddenMeta) {
        if (sync.aiInitialHiddenStone === null) {
            if (!syncAdvancesServerMoves && (game as { aiInitialHiddenStone?: unknown }).aiInitialHiddenStone) {
                // Do not let stale client snapshots clear server-confirmed AI hidden coordinates.
            } else {
                (game as { aiInitialHiddenStone?: unknown }).aiInitialHiddenStone = undefined;
            }
        } else if (
            sync.aiInitialHiddenStone &&
            typeof (sync.aiInitialHiddenStone as { x?: number }).x === 'number' &&
            typeof (sync.aiInitialHiddenStone as { y?: number }).y === 'number'
        ) {
            const x = sync.aiInitialHiddenStone.x;
            const y = sync.aiInitialHiddenStone.y;
            const owner = getBoardOwnerAt(game, x, y);
            if (owner !== undefined && isAiControlledPlayer(game, owner)) {
                (game as { aiInitialHiddenStone?: { x: number; y: number } }).aiInitialHiddenStone = { x, y };
            }
        }
    }
    if (sync.currentPlayer !== undefined && sync.currentPlayer !== null) {
        // 오래된 sync는 서버의 최신 차례를 절대 되감지 않는다.
        // 베이스 시작 직후 stale sync가 유저 턴을 다시 AI(흑) 턴으로 바꿔 흑이 두 번 두는 문제가 있었다.
        if (syncCanReplaceServerProgress) {
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
        const staleBasePrePlayRewind =
            !syncCanReplaceServerProgress &&
            (srv === 'playing' || srv === 'hidden_placing') &&
            BASE_PRE_PLAY_STATUSES.has(cli);
        if (!(serverItemUi && cli === 'playing') && !staleBasePrePlayRewind) {
            (game as { gameStatus: LiveGameSession['gameStatus'] }).gameStatus = sync.gameStatus;
        }
    }
    if (sync.captures && typeof sync.captures === 'object') {
        game.captures = mergeMonotonicCountRecord(game.captures, sync.captures);
    }
    if ('koInfo' in sync) {
        game.koInfo = sync.koInfo ?? null;
    }
    if (sync.totalTurns != null && Number.isFinite(sync.totalTurns)) {
        const serverTotalTurns = Number(game.totalTurns ?? 0);
        const syncedTotalTurns = Math.floor(sync.totalTurns);
        if (syncCanReplaceServerProgress || syncedTotalTurns >= serverTotalTurns) {
            game.totalTurns = syncedTotalTurns;
        }
    }
    reconcileMoveHistoryCoordsToBoardState(game);

    if (preserveHiddenMeta && serverHiddenMovesSnapshot != null) {
        game.hiddenMoves = { ...serverHiddenMovesSnapshot };
        (game as { aiInitialHiddenStone?: unknown }).aiInitialHiddenStone = serverAiInitialHidden;
        (game as { aiInitialHiddenStoneIsPrePlaced?: unknown }).aiInitialHiddenStoneIsPrePlaced = serverAiInitialHiddenPre;
    }

    enforcePlayingSeatLockOnPveItemSync(game);

    const policy = resolveArenaSessionPolicy(game as any);
    if (policy.matchAxis === 'pve') {
        // clientSync 이후에도 남은 오프닝 스냅샷 + 수순 조합이 Kata 재생과 어긋나 Illegal move가 날 수 있음 → 다음 AI에서 재검증
        (game as any).kataPveKataMovesFromBoardStateOnly = false;
    }
}

/**
 * 베이스 세션의 본경기 단계에서 `blackPlayerId/whitePlayerId`가 잠금과 어긋났으면 되돌린다.
 * (베이스 임시 좌석 잔재가 어떤 경로로든 본경기에 새어나오지 않도록 추가 안전장치)
 */
function enforcePlayingSeatLockOnPveItemSync(game: LiveGameSession): void {
    const lb = (game as { playingLockedBlackPlayerId?: unknown }).playingLockedBlackPlayerId;
    const lw = (game as { playingLockedWhitePlayerId?: unknown }).playingLockedWhitePlayerId;
    if (typeof lb !== 'string' || lb.length === 0 || typeof lw !== 'string' || lw.length === 0) return;
    const status = String(game.gameStatus ?? '');
    if (status.startsWith('base_')) return;
    if (game.blackPlayerId === lb && game.whitePlayerId === lw) return;
    game.blackPlayerId = lb;
    game.whitePlayerId = lw;
}
