import { Player, GameMode } from '../types/enums.js';
import type { LiveGameSession } from '../types/index.js';
import { aiUserId } from '../shared/constants/auth.js';
import {
    getArenaStateBucket,
    resolveArenaSessionPolicy,
} from '../shared/utils/liveSessionArenaKind.js';

export function pveSessionStorageKey(gameId: string): string {
    return `gameState_${gameId}`;
}

function inferCurrentPlayerFromLastStoredMove(
    last: { player?: number } | null | undefined,
): Player | null {
    if (!last) return null;
    const pl = last.player;
    if (pl !== Player.Black && pl !== Player.White) return null;
    return pl === Player.Black ? Player.White : Player.Black;
}

function sessionIncludesBaseMode(g: LiveGameSession | undefined): boolean {
    if (!g) return false;
    if (
        typeof g.playingLockedBlackPlayerId === 'string' &&
        g.playingLockedBlackPlayerId.length > 0 &&
        typeof g.playingLockedWhitePlayerId === 'string' &&
        g.playingLockedWhitePlayerId.length > 0
    ) {
        return true;
    }
    if (g.mode === GameMode.Base) return true;
    if (g.mode === GameMode.Mix) {
        const mm = (g.settings as { mixedModes?: GameMode[] } | undefined)?.mixedModes;
        return Array.isArray(mm) && mm.includes(GameMode.Base);
    }
    if (Array.isArray(g.baseStones) && g.baseStones.length > 0) return true;
    if (typeof g.settings?.baseStones === 'number' && g.settings.baseStones > 0) return true;
    return false;
}

function coerceClassicPveHumanBlackSeatsIfSwapped(session: LiveGameSession): LiveGameSession {
    if (!session.player1?.id || !session.player2?.id) return session;
    if (session.player2.id !== aiUserId || session.player1.id === aiUserId) return session;
    if (sessionIncludesBaseMode(session)) return session;
    const humanId = session.player1.id;
    if (session.blackPlayerId === humanId && session.whitePlayerId === aiUserId) return session;
    if (session.blackPlayerId === aiUserId && session.whitePlayerId === humanId) {
        const next: LiveGameSession = {
            ...session,
            blackPlayerId: humanId,
            whitePlayerId: aiUserId,
        };
        const lb = session.playingLockedBlackPlayerId;
        const lw = session.playingLockedWhitePlayerId;
        if (lb === aiUserId && lw === humanId) {
            next.playingLockedBlackPlayerId = humanId;
            next.playingLockedWhitePlayerId = aiUserId;
        }
        return next;
    }
    return session;
}

export function boardGridHasAnyStones(board: LiveGameSession['boardState'] | undefined): boolean {
    if (!board || !Array.isArray(board)) return false;
    return board.some(
        (row) =>
            row &&
            Array.isArray(row) &&
            row.some((c: unknown) => c !== 0 && c != null && c !== undefined),
    );
}

export function isRecoverablePveSessionStorageSnapshot(parsed: Record<string, unknown> | null | undefined): boolean {
    if (!parsed || typeof parsed.gameId !== 'string' || !parsed.gameId) return false;
    const status = String(parsed.gameStatus || '');
    if (['ended', 'no_contest', 'rematch_pending'].includes(status)) return false;

    const moves = Array.isArray(parsed.moveHistory) ? parsed.moveHistory.length : 0;
    const totalTurns = typeof parsed.totalTurns === 'number' && Number.isFinite(parsed.totalTurns) ? parsed.totalTurns : 0;
    const cap = parsed.captures as Record<number, number> | undefined;
    const hasCaptures =
        cap &&
        typeof cap === 'object' &&
        ((cap[Player.Black] ?? 0) > 0 || (cap[Player.White] ?? 0) > 0);
    const hasBoard = boardGridHasAnyStones(parsed.boardState as LiveGameSession['boardState']);
    const hasPattern =
        (Array.isArray(parsed.blackPatternStones) && parsed.blackPatternStones.length > 0) ||
        (Array.isArray(parsed.whitePatternStones) && parsed.whitePatternStones.length > 0);

    return moves > 0 || totalTurns > 0 || hasCaptures || hasBoard || hasPattern;
}

/**
 * INITIAL_STATE·rejoin가 빈 판으로 올 때 sessionStorage 스냅샷으로 PVE 진행 상태를 복원한다.
 */
export function augmentPveFromSessionStorageSnapshot(
    incoming: LiveGameSession,
    parsed: Record<string, unknown> | null | undefined,
): LiveGameSession {
    if (!parsed || (parsed as { gameId?: string }).gameId !== incoming.id) return incoming;

    const stMoves = Array.isArray((parsed as { moveHistory?: unknown }).moveHistory)
        ? ((parsed as { moveHistory: unknown[] }).moveHistory?.length ?? 0)
        : 0;
    const incMoves = Array.isArray(incoming.moveHistory) ? incoming.moveHistory.length : 0;
    const stTotalRaw = (parsed as { totalTurns?: unknown }).totalTurns;
    const stTotal = typeof stTotalRaw === 'number' && Number.isFinite(stTotalRaw) ? stTotalRaw : 0;
    const incTotal = incoming.totalTurns ?? 0;
    const cap = (parsed as { captures?: Record<number, number> }).captures;
    const hasStoredCaptures =
        cap &&
        typeof cap === 'object' &&
        ((cap[Player.Black] ?? 0) > 0 || (cap[Player.White] ?? 0) > 0);
    const pb = (parsed as { boardState?: LiveGameSession['boardState'] }).boardState;
    const hasStoredBoardStones = boardGridHasAnyStones(pb);
    const hasPattern =
        (Array.isArray((parsed as { blackPatternStones?: unknown }).blackPatternStones) &&
            (parsed as { blackPatternStones: unknown[] }).blackPatternStones.length > 0) ||
        (Array.isArray((parsed as { whitePatternStones?: unknown }).whitePatternStones) &&
            (parsed as { whitePatternStones: unknown[] }).whitePatternStones.length > 0);

    const midGame =
        stMoves > 0 ||
        stTotal > incTotal ||
        (stTotal > 0 && incMoves === 0) ||
        !!hasStoredCaptures ||
        hasStoredBoardStones ||
        hasPattern;

    if (!midGame) return incoming;

    const serverAheadOnMoves = incMoves > stMoves;
    const incHasBoardGrid =
        Array.isArray(incoming.boardState) &&
        incoming.boardState.length > 0 &&
        Array.isArray(incoming.boardState[0]) &&
        (incoming.boardState[0] as unknown[]).length > 0;

    const incPending = (incoming.gameStatus || '') === 'pending';
    const storedStatus = String((parsed as { gameStatus?: string }).gameStatus || '');
    const playingish = [
        'playing',
        'hidden_placing',
        'scanning',
        'missile_selecting',
        'missile_animating',
        'scanning_animating',
        'hidden_reveal_animating',
        'scoring',
        'hidden_final_reveal',
    ].includes(storedStatus);

    const out: LiveGameSession = { ...incoming };
    const pm = (parsed as { moveHistory?: LiveGameSession['moveHistory'] }).moveHistory;
    if (stMoves > incMoves && Array.isArray(pm)) {
        out.moveHistory = pm;
    }
    if (
        !serverAheadOnMoves &&
        Array.isArray(pb) &&
        pb.length > 0 &&
        Array.isArray(pb[0]) &&
        (pb[0] as unknown[]).length > 0
    ) {
        const pbOk = boardGridHasAnyStones(pb);
        if (pbOk && (stMoves > incMoves || !incHasBoardGrid || !boardGridHasAnyStones(incoming.boardState))) {
            out.boardState = pb;
        }
    }
    if (typeof stTotalRaw === 'number' && Number.isFinite(stTotalRaw) && stTotalRaw > (out.totalTurns ?? 0)) {
        (out as { totalTurns?: number }).totalTurns = stTotalRaw;
    }
    if (!serverAheadOnMoves && cap && typeof cap === 'object') out.captures = cap as LiveGameSession['captures'];
    const bsc = (parsed as { baseStoneCaptures?: unknown }).baseStoneCaptures;
    if (!serverAheadOnMoves && bsc && typeof bsc === 'object')
        (out as { baseStoneCaptures?: unknown }).baseStoneCaptures = bsc;
    const hsc = (parsed as { hiddenStoneCaptures?: unknown }).hiddenStoneCaptures;
    if (!serverAheadOnMoves && hsc && typeof hsc === 'object')
        (out as { hiddenStoneCaptures?: unknown }).hiddenStoneCaptures = hsc;

    if (incPending && (playingish || stMoves > 0)) {
        if (playingish && storedStatus) (out as { gameStatus?: string }).gameStatus = storedStatus as LiveGameSession['gameStatus'];
        else out.gameStatus = 'playing';
        const st = (parsed as { startTime?: unknown }).startTime;
        if (typeof st === 'number') (out as { startTime?: number }).startTime = st;
        const cp = (parsed as { currentPlayer?: unknown }).currentPlayer;
        if (typeof cp === 'number') out.currentPlayer = cp as Player;
    }

    const btl = (parsed as { blackTimeLeft?: unknown }).blackTimeLeft;
    if (typeof btl === 'number') out.blackTimeLeft = btl;
    const wtl = (parsed as { whiteTimeLeft?: unknown }).whiteTimeLeft;
    if (typeof wtl === 'number') out.whiteTimeLeft = wtl;
    if ((parsed as { turnDeadline?: unknown }).turnDeadline != null)
        out.turnDeadline = (parsed as { turnDeadline: number | undefined }).turnDeadline;
    if ((parsed as { turnStartTime?: unknown }).turnStartTime != null)
        out.turnStartTime = (parsed as { turnStartTime: number | undefined }).turnStartTime;
    const gst = (parsed as { gameStartTime?: unknown }).gameStartTime;
    if (typeof gst === 'number') (out as { gameStartTime?: number }).gameStartTime = gst;
    const btb = (parsed as { blackTurnLimitBonus?: unknown }).blackTurnLimitBonus;
    if (btb != null) (out as { blackTurnLimitBonus?: number }).blackTurnLimitBonus = Number(btb) || 0;

    const sbp = (parsed as { blackPatternStones?: unknown }).blackPatternStones;
    if (!serverAheadOnMoves && (stMoves > incMoves || incMoves === 0) && Array.isArray(sbp))
        out.blackPatternStones = sbp as LiveGameSession['blackPatternStones'];
    const swp = (parsed as { whitePatternStones?: unknown }).whitePatternStones;
    if (!serverAheadOnMoves && (stMoves > incMoves || incMoves === 0) && Array.isArray(swp))
        out.whitePatternStones = swp as LiveGameSession['whitePatternStones'];
    if (!serverAheadOnMoves && (parsed as { lastMove?: unknown }).lastMove != null)
        out.lastMove = (parsed as { lastMove: LiveGameSession['lastMove'] }).lastMove;
    if (!serverAheadOnMoves && (parsed as { koInfo?: unknown }).koInfo !== undefined)
        out.koInfo = (parsed as { koInfo: LiveGameSession['koInfo'] }).koInfo;
    const hm = (parsed as { hiddenMoves?: unknown }).hiddenMoves;
    if (!serverAheadOnMoves && hm && typeof hm === 'object') out.hiddenMoves = hm as LiveGameSession['hiddenMoves'];
    const pr = (parsed as { permanentlyRevealedStones?: unknown }).permanentlyRevealedStones;
    if (!serverAheadOnMoves && Array.isArray(pr)) out.permanentlyRevealedStones = pr as LiveGameSession['permanentlyRevealedStones'];
    const h1 = (parsed as { hidden_stones_p1?: unknown }).hidden_stones_p1;
    if (!serverAheadOnMoves && typeof h1 === 'number') (out as { hidden_stones_p1?: number }).hidden_stones_p1 = h1;
    const h2 = (parsed as { hidden_stones_p2?: unknown }).hidden_stones_p2;
    if (!serverAheadOnMoves && typeof h2 === 'number') (out as { hidden_stones_p2?: number }).hidden_stones_p2 = h2;

    return coerceClassicPveHumanBlackSeatsIfSwapped(out);
}

function parseSessionStorageSnapshot(gameId: string): Record<string, unknown> | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(pveSessionStorageKey(gameId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed.gameId !== gameId) return null;
        return parsed;
    } catch {
        return null;
    }
}

function buildShellFromSnapshot(
    gameId: string,
    parsed: Record<string, unknown>,
    userId: string,
    existing?: LiveGameSession,
): LiveGameSession {
    if (existing) return existing;

    const p1 = parsed.player1 as LiveGameSession['player1'];
    const p2 = parsed.player2 as LiveGameSession['player2'];
    const mode = (parsed.mode as GameMode) || GameMode.Standard;
    const gameCategory = (parsed.gameCategory as LiveGameSession['gameCategory']) || undefined;
    const isSinglePlayer = Boolean(parsed.isSinglePlayer);
    const isAiGame = parsed.isAiGame !== false;

    const shell: LiveGameSession = {
        id: gameId,
        mode,
        gameCategory,
        isSinglePlayer,
        isAiGame,
        player1: p1 ?? ({ id: userId } as LiveGameSession['player1']),
        player2: p2 ?? ({ id: aiUserId } as LiveGameSession['player2']),
        blackPlayerId: (parsed.blackPlayerId as string) || userId,
        whitePlayerId: (parsed.whitePlayerId as string) || aiUserId,
        currentPlayer: Player.Black,
        settings: (parsed.settings as LiveGameSession['settings']) ?? { boardSize: 19, komi: 0.5 },
        boardState: [],
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        gameStatus: 'playing',
    } as LiveGameSession;

    if (parsed.stageId) (shell as { stageId?: string }).stageId = String(parsed.stageId);
    if (typeof parsed.towerFloor === 'number') shell.towerFloor = parsed.towerFloor;
    if (parsed.adventureStageId) (shell as { adventureStageId?: string }).adventureStageId = String(parsed.adventureStageId);

    if (gameId.startsWith('sp-game-')) {
        shell.isSinglePlayer = true;
        shell.gameCategory = 'singleplayer' as LiveGameSession['gameCategory'];
    } else if (gameId.startsWith('tower-')) {
        shell.gameCategory = 'tower' as LiveGameSession['gameCategory'];
    }

    return shell;
}

export function isSessionPveArena(session: Partial<LiveGameSession> | null | undefined): boolean {
    if (!session) return false;
    return resolveArenaSessionPolicy(session as LiveGameSession).matchAxis === 'pve';
}

export function loadRecoverablePveGameFromSessionStorage(
    gameId: string,
    options?: { shell?: LiveGameSession; userId?: string },
): LiveGameSession | null {
    const parsed = parseSessionStorageSnapshot(gameId);
    if (!parsed || !isRecoverablePveSessionStorageSnapshot(parsed)) return null;

    const userId = options?.userId;
    if (userId) {
        const ids = new Set<string>();
        const p1 = (parsed.player1 as { id?: string } | undefined)?.id;
        const p2 = (parsed.player2 as { id?: string } | undefined)?.id;
        if (p1) ids.add(p1);
        if (p2) ids.add(p2);
        if (options.shell?.player1?.id) ids.add(options.shell.player1.id);
        if (options.shell?.player2?.id) ids.add(options.shell.player2.id);
        if (ids.size > 0 && !ids.has(userId)) return null;
    }

    const shell = buildShellFromSnapshot(gameId, parsed, userId ?? '', options?.shell);
    const restored = augmentPveFromSessionStorageSnapshot(shell, parsed);
    if (!isSessionPveArena(restored)) return null;
    if (!boardGridHasAnyStones(restored.boardState) && !(restored.moveHistory?.length ?? 0)) return null;
    return restored;
}

export function getArenaStoreBucketForSession(session: LiveGameSession): ReturnType<typeof getArenaStateBucket> {
    return getArenaStateBucket(session);
}
