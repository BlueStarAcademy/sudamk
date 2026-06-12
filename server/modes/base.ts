

import * as types from '../../types/index.js';
import { getGoLogic } from '../goLogic.js';
// FIX: Changed import path to avoid circular dependency
import { transitionToPlayingOrUniformRoulette } from './shared.js';
import { aiUserId } from '../aiPlayer.js';
import { processMove } from '../goLogic.js';
import { pickAiKomiValueAvoiding } from '../../shared/utils/singlePlayerAiBaseKomiBid.js';
import {
    cloneBoardStateForKataOpeningSnapshot,
    encodeBoardStateAsKataSetupMovesFromEmpty,
} from '../kataCaptureSetupEncoding.js';
import { modeIncludesBaseCaptureMix, resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';
import { PRE_GAME_PVP_COUNTDOWN_MS } from '../../shared/constants/preGameCountdown.js';

const DEFAULT_BASE_AI_KOMI_MIN = 5;
const DEFAULT_BASE_AI_KOMI_MAX = 20;

const randomBaseAiKomiBid = (): number =>
    DEFAULT_BASE_AI_KOMI_MIN +
    Math.floor(Math.random() * (DEFAULT_BASE_AI_KOMI_MAX - DEFAULT_BASE_AI_KOMI_MIN + 1));

/** 메인 루프가 매 틱 호출해도 동일한 값이 나오게 (AI 선호·타임아웃 무작위 흔들림 방지) */
const pickBlackOrWhiteFromDeterministicSeed = (seed: string): types.Player => {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    const u = h >>> 0;
    return (u & 1) === 0 ? types.Player.Black : types.Player.White;
};

/** 모험 베이스: 몬스터 대전은 카운트다운·자동 타임아웃 없이 유저 조작만으로 진행 */
const isAdventureBaseGame = (game: types.LiveGameSession) => game.gameCategory === 'adventure';

/** 싱글도 모험과 같이「시작하기」만 받고, 메인 루프 30초 타임아웃으로 playing만 되면 모달과 어긋난다 */
const skipBaseStartConfirmationDeadline = (game: types.LiveGameSession) =>
    isAdventureBaseGame(game) || game.isSinglePlayer;

const shouldUseBaseSetupCountdown = (game: types.LiveGameSession) =>
    resolveArenaSessionPolicy(game).matchAxis === 'pvp';

const shouldAutoRandomizeBasePlacement = (game: types.LiveGameSession) =>
    resolveArenaSessionPolicy(game).usesAutomaticBaseStonePlacement;

const isAiLikeParticipantId = (id?: string | null): boolean =>
    !!id && (id === aiUserId || String(id).startsWith('dungeon-bot-'));

const resolveAiParticipantId = (game: types.LiveGameSession): string | null => {
    if (isAiLikeParticipantId(game.player1.id)) return game.player1.id;
    if (isAiLikeParticipantId(game.player2.id)) return game.player2.id;
    return null;
};

/**
 * 배치 단계 임시 좌석으로 p1/p2 키의 돌 색을 정한다.
 * - 본대국 좌석(`blackPlayerId`/`whitePlayerId`)은 색 확정 전에는 비어 있어야 하므로 절대 읽지 않는다.
 * - 임시 좌석이 둘 다 비어 있으면(예: 잘못된 호출) p1=Black, p2=White로 안전하게 폴백한다.
 */
const getBasePlacementColorForKey = (
    game: types.LiveGameSession,
    key: 'baseStones_p1' | 'baseStones_p2'
): types.Player => {
    const playerId = key === 'baseStones_p1' ? game.player1.id : game.player2.id;
    const tempBlackId = game.basePlacementBlackPlayerId;
    if (typeof tempBlackId === 'string' && tempBlackId.length > 0) {
        return tempBlackId === playerId ? types.Player.Black : types.Player.White;
    }
    return key === 'baseStones_p1' ? types.Player.Black : types.Player.White;
};

const getBasePlacementColorForUserId = (
    game: types.LiveGameSession,
    userId: string
): types.Player | null => {
    if (userId === game.player1.id) {
        return getBasePlacementColorForKey(game, 'baseStones_p1');
    }
    if (userId === game.player2.id) {
        return getBasePlacementColorForKey(game, 'baseStones_p2');
    }
    return null;
};

/**
 * 베이스 배치 단계 동안 사용할 임시 흑/백 좌석을 결정해 `basePlacementBlackPlayerId`/`basePlacementWhitePlayerId`에만 적는다.
 * - 본대국 좌석(`blackPlayerId`/`whitePlayerId`)은 깔끔하게 비워서, 색이 확정될 때 단 한 번만 씌우도록 보장한다.
 * - 같은 게임 id·참가자 조합에 대해 결정적이라 매 틱 호출해도 동일한 임시 좌석이 나온다.
 */
const assignProvisionalBaseColors = (game: types.LiveGameSession) => {
    const p1Color = pickBlackOrWhiteFromDeterministicSeed(`${game.id}:baseProvisionalColor:${game.player1.id}:${game.player2.id}`);
    if (p1Color === types.Player.Black) {
        game.basePlacementBlackPlayerId = game.player1.id;
        game.basePlacementWhitePlayerId = game.player2.id;
    } else {
        game.basePlacementBlackPlayerId = game.player2.id;
        game.basePlacementWhitePlayerId = game.player1.id;
    }
    /** 색 확정 전까지는 본대국 좌석을 비워 둔다 — 어디에서도 임시 좌석을 진실원으로 오인하지 않게 한다. */
    game.blackPlayerId = null;
    game.whitePlayerId = null;
};

/**
 * 색이 최종 확정된 직후, 본대국 좌석을 한 번만 씌우고 임시 좌석을 즉시 깨끗이 비운다.
 * - `playingLockedBlackPlayerId/whitePlayerId`도 같은 시점에 박아 두어, 본대국 진입 전후 어떤 패킷도 좌석을 뒤집지 못하게 한다.
 * - 호출 후에는 `basePlacementBlackPlayerId/whitePlayerId`가 사라지므로, 이후 로직은 절대 임시 좌석을 읽지 않는다.
 */
const commitFinalBaseSeats = (
    game: types.LiveGameSession,
    finalBlackPlayerId: string,
    finalWhitePlayerId: string,
) => {
    game.blackPlayerId = finalBlackPlayerId;
    game.whitePlayerId = finalWhitePlayerId;
    game.playingLockedBlackPlayerId = finalBlackPlayerId;
    game.playingLockedWhitePlayerId = finalWhitePlayerId;
    game.basePlacementBlackPlayerId = undefined;
    game.basePlacementWhitePlayerId = undefined;
};

const enterBaseGameStartConfirmation = (game: types.LiveGameSession, now: number) => {
    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    game.gameStatus = 'base_game_start_confirmation';
    game.revealEndTime = skipBaseStartConfirmationDeadline(game) ? undefined : now + PRE_GAME_PVP_COUNTDOWN_MS;
    game.preGameConfirmations = { [p1Id]: false, [p2Id]: false };
    if (game.isAiGame) {
        const aiId = resolveAiParticipantId(game);
        if (aiId) game.preGameConfirmations[aiId] = true;
    }
    game.turnDeadline = undefined;
    game.turnStartTime = undefined;
    game.pausedTurnTimeLeft = undefined;
};

export const enterBaseCaptureStartConfirmation = enterBaseGameStartConfirmation;

export const initializeBase = (game: types.LiveGameSession, now: number) => {
    game.gameStatus = 'base_placement';
    game.basePlacementDeadline = shouldUseBaseSetupCountdown(game) ? now + PRE_GAME_PVP_COUNTDOWN_MS : undefined;
    game.baseStones_p1 = [];
    game.baseStones_p2 = [];
    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    game.basePlacementReady = { [p1Id]: false, [p2Id]: false };
    assignProvisionalBaseColors(game);
    game.settings.komi = 0.5; // Base komi for bidding
    // Base 모드의 실제 시계는 시작 확인 이후(playing)부터 흐르게 유지
    game.turnDeadline = undefined;
    game.turnStartTime = undefined;
    game.pausedTurnTimeLeft = undefined;
    game.preGameConfirmations = {};
    game.baseKomiBidsSnapshot = undefined;

    if (shouldAutoRandomizeBasePlacement(game)) {
        placeRemainingStonesRandomly(game, 'baseStones_p1', 'pveAuto');
        placeRemainingStonesRandomly(game, 'baseStones_p2', 'pveAuto');
        game.basePlacementReady = { [p1Id]: true, [p2Id]: true };
        resolveBasePlacementAndTransition(game, now);
        return;
    }

    // 로비/모험 AI 대국: 봇의 베이스돌은 시작 즉시 랜덤으로 모두 배치해 둔다.
    // 싱글플레이는 유저가 보이지 않는 AI 선점 좌표를 클릭해 400이 나는 것을 막기 위해
    // 유저 배치 확정 시 resolveBasePlacementAndTransition에서 AI 부족분을 채운다.
    if (game.isAiGame && !game.isSinglePlayer) {
        const aiId = resolveAiParticipantId(game);
        if (aiId) {
            const aiBaseKey: 'baseStones_p1' | 'baseStones_p2' =
                aiId === game.player1.id ? 'baseStones_p1' : 'baseStones_p2';
            placeRemainingStonesRandomly(game, aiBaseKey);
            game.basePlacementReady![aiId] = true;
        }
    } else if (game.isAiGame) {
        const aiId = resolveAiParticipantId(game);
        if (aiId) game.basePlacementReady![aiId] = true;
    }
};

const clearBasePlacementReadyForUser = (game: types.LiveGameSession, userId: string) => {
    if (!game.basePlacementReady) return;
    game.basePlacementReady[userId] = false;
};

const getPairLobbyOwnerId = (game: types.LiveGameSession): string | undefined => {
    const id = (game.settings as types.GameSettings | undefined)?.pairGame?.pairLobbyOwnerId;
    if (typeof id !== 'string' || id.length === 0) return undefined;
    if (id !== game.player1.id && id !== game.player2.id) return undefined;
    return id;
};

const clearBothPlayersBasePlacementReady = (game: types.LiveGameSession) => {
    if (!game.basePlacementReady) {
        game.basePlacementReady = { [game.player1.id]: false, [game.player2.id]: false };
    }
    game.basePlacementReady[game.player1.id] = false;
    game.basePlacementReady[game.player2.id] = false;
};

/** 페어 방장 배치: 먼저 p1석 N개 → 이어서 p2석 N개 */
const resolvePairHostActiveBaseStoneKey = (game: types.LiveGameSession): 'baseStones_p1' | 'baseStones_p2' | null => {
    const target = game.settings.baseStones ?? 4;
    const n1 = game.baseStones_p1?.length ?? 0;
    const n2 = game.baseStones_p2?.length ?? 0;
    if (n1 < target) return 'baseStones_p1';
    if (n2 < target) return 'baseStones_p2';
    return null;
};

/** 재배치·취소: p2에 돌이 있으면 p2부터, 없으면 p1 */
const resolvePairHostResetOrUndoBaseStoneKey = (game: types.LiveGameSession): 'baseStones_p1' | 'baseStones_p2' | null => {
    const n2 = game.baseStones_p2?.length ?? 0;
    if (n2 > 0) return 'baseStones_p2';
    const n1 = game.baseStones_p1?.length ?? 0;
    if (n1 > 0) return 'baseStones_p1';
    return null;
};

// Helper function to check if a stone placement would result in immediate capture
const wouldBeImmediatelyCaptured = (board: types.BoardState, x: number, y: number, player: types.Player): boolean => {
    // Try placing the stone
    const result = processMove(
        board,
        { x, y, player },
        null, // no ko info for initial placement
        0, // move history length
        { ignoreSuicide: true } // allow suicide for initial check
    );

    if (!result.isValid) {
        return true; // Invalid move, skip this position
    }

    // Check if the placed stone's group has only one liberty
    // If so, check if opponent can capture it by playing at that liberty
    const opponent = player === types.Player.Black ? types.Player.White : types.Player.Black;
    const boardSize = board.length;
    
    // Get neighbors of the placed stone
    const getNeighbors = (px: number, py: number) => {
        const neighbors = [];
        if (px > 0) neighbors.push({ x: px - 1, y: py });
        if (px < boardSize - 1) neighbors.push({ x: px + 1, y: py });
        if (py > 0) neighbors.push({ x: px, y: py - 1 });
        if (py < boardSize - 1) neighbors.push({ x: px, y: py + 1 });
        return neighbors;
    };

    // Find the group containing the placed stone
    const findGroup = (startX: number, startY: number, playerColor: types.Player, currentBoard: types.BoardState) => {
        if (currentBoard[startY]?.[startX] !== playerColor) return null;
        const q: types.Point[] = [{ x: startX, y: startY }];
        const visitedStones = new Set([`${startX},${startY}`]);
        const libertyPoints = new Set<string>();
        const stones: types.Point[] = [{ x: startX, y: startY }];

        while (q.length > 0) {
            const { x: cx, y: cy } = q.shift()!;
            for (const n of getNeighbors(cx, cy)) {
                const key = `${n.x},${n.y}`;
                const neighborContent = currentBoard[n.y][n.x];

                if (neighborContent === types.Player.None) {
                    libertyPoints.add(key);
                } else if (neighborContent === playerColor) {
                    if (!visitedStones.has(key)) {
                        visitedStones.add(key);
                        q.push(n);
                        stones.push(n);
                    }
                }
            }
        }
        return { stones, liberties: Array.from(libertyPoints).map(k => {
            const [nx, ny] = k.split(',').map(Number);
            return { x: nx, y: ny };
        }) };
    };

    const myGroup = findGroup(x, y, player, result.newBoardState);
    if (!myGroup) {
        return true; // Couldn't find group, skip
    }

    // If the group has only one liberty, check if opponent can capture by playing there
    if (myGroup.liberties.length === 1) {
        const liberty = myGroup.liberties[0];
        const opponentResult = processMove(
            result.newBoardState,
            { x: liberty.x, y: liberty.y, player: opponent },
            null,
            1,
            { ignoreSuicide: false }
        );

        // If opponent can capture our stone by playing at the liberty, it's a bad placement
        if (opponentResult.isValid && opponentResult.capturedStones.some(s => s.x === x && s.y === y)) {
            return true;
        }
    }

    return false;
};

/** 판 가장자리(1·N선)에서 떨어진 격자 수 — 클수록 중앙에 가깝다. */
const edgeInset = (x: number, y: number, boardSize: number): number =>
    Math.min(x, y, boardSize - 1 - x, boardSize - 1 - y);

type BaseRandCell = { x: number; y: number; inset: number };
type BaseRandomPlacementBand = 'standard' | 'pveAuto';

/**
 * 베이스 랜덤 배치: PVP 수동 보조는 3·4선, PVE 자동 배치는 2~5선을 우선 사용한다.
 * edgeInset 0이 1선이므로 2~5선은 edgeInset 1..4이다.
 * 작은 판은 가능한 범위로 완화.
 */
const baseStoneRandomInsetBand = (
    boardSize: number,
    band: BaseRandomPlacementBand = 'standard'
): { minInset: number; maxInset: number } => {
    if (band === 'pveAuto') {
        const maxInset = Math.min(4, Math.floor((boardSize - 1) / 2));
        return { minInset: boardSize <= 2 ? 0 : 1, maxInset: Math.max(boardSize <= 2 ? 0 : 1, maxInset) };
    }
    if (boardSize <= 5) return { minInset: 1, maxInset: 2 };
    if (boardSize <= 7) return { minInset: 1, maxInset: 3 };
    return { minInset: 2, maxInset: 3 };
};

const manhattanMinToOccupied = (x: number, y: number, occupied: Set<string>): number => {
    let best = 999;
    for (const key of occupied) {
        const parts = key.split(',');
        const ox = Number(parts[0]);
        const oy = Number(parts[1]);
        if (!Number.isFinite(ox) || !Number.isFinite(oy)) continue;
        const d = Math.abs(x - ox) + Math.abs(y - oy);
        if (d < best) best = d;
    }
    return best >= 999 ? 0 : best;
};

const filterCellsByInsetBand = (cells: BaseRandCell[], minInset: number, maxInset: number): BaseRandCell[] =>
    cells.filter((c) => c.inset >= minInset && c.inset <= maxInset);

/** interiorOnly: 1~(N-2) 선 안만(가장자리 1·N선 제외). 보드가 너무 작으면 interior 없음. */
const listBaseRandomCandidates = (
    boardSize: number,
    occupied: Set<string>,
    tempBoard: types.BoardState,
    playerColor: types.Player,
    interiorOnly: boolean,
    requireNonCapture: boolean
): BaseRandCell[] => {
    const lo = interiorOnly && boardSize > 2 ? 1 : 0;
    const hi = interiorOnly && boardSize > 2 ? boardSize - 2 : boardSize - 1;
    const out: BaseRandCell[] = [];
    for (let y = lo; y <= hi; y++) {
        for (let x = lo; x <= hi; x++) {
            const k = `${x},${y}`;
            if (occupied.has(k)) continue;
            if (requireNonCapture && wouldBeImmediatelyCaptured(tempBoard, x, y, playerColor)) continue;
            out.push({
                x,
                y,
                inset: edgeInset(x, y, boardSize),
            });
        }
    }
    return out;
};

const tiersBaseRandom: Array<[boolean, boolean]> = [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
];

/** 3~4선 띠 안에서, 이미 놓인 돌·상대 베이스와 맨해튼 거리가 큰 칸을 우선해 고른 뒤 그중 무작위. */
const collectBandPoolForBaseRandom = (
    boardSize: number,
    occupied: Set<string>,
    tempBoard: types.BoardState,
    playerColor: types.Player,
    minInset: number,
    maxInset: number
): BaseRandCell[] => {
    const acc: BaseRandCell[] = [];
    for (const [interiorOnly, requireNonCapture] of tiersBaseRandom) {
        const pool = listBaseRandomCandidates(boardSize, occupied, tempBoard, playerColor, interiorOnly, requireNonCapture);
        const band = filterCellsByInsetBand(pool, minInset, maxInset);
        for (const c of band) acc.push(c);
        if (acc.length > 0) break;
    }
    return acc;
};

/** 띠 후보가 없을 때: 전체 후보 중 퍼짐 최대(동률±1 중 랜덤), 보드 중심 몰림 없음 */
const pickBaseStoneRandomCellSpreadFallback = (
    boardSize: number,
    occupied: Set<string>,
    tempBoard: types.BoardState,
    playerColor: types.Player
): { x: number; y: number } | null => {
    for (const [interiorOnly, requireNonCapture] of tiersBaseRandom) {
        const pool = listBaseRandomCandidates(boardSize, occupied, tempBoard, playerColor, interiorOnly, requireNonCapture);
        if (pool.length === 0) continue;
        const scored = pool.map((c) => ({
            c,
            spread: occupied.size === 0 ? 0 : manhattanMinToOccupied(c.x, c.y, occupied),
        }));
        scored.sort((a, b) => (b.spread !== a.spread ? b.spread - a.spread : b.c.inset - a.c.inset));
        const topSpread = scored[0]!.spread;
        const spreadTier = scored.filter((s) => s.spread >= topSpread - 1);
        const pick = spreadTier[Math.floor(Math.random() * spreadTier.length)]!.c;
        return { x: pick.x, y: pick.y };
    }
    return null;
};

const pickBaseStoneRandomCellInBandWithSpread = (
    boardSize: number,
    occupied: Set<string>,
    tempBoard: types.BoardState,
    playerColor: types.Player,
    band: BaseRandomPlacementBand = 'standard'
): { x: number; y: number } | null => {
    const { minInset: bandMin, maxInset: bandMax } = baseStoneRandomInsetBand(boardSize, band);

    let bandPool = collectBandPoolForBaseRandom(boardSize, occupied, tempBoard, playerColor, bandMin, bandMax);
    if (bandPool.length === 0) {
        bandPool = collectBandPoolForBaseRandom(
            boardSize,
            occupied,
            tempBoard,
            playerColor,
            Math.max(0, bandMin - 1),
            Math.min(Math.floor((boardSize - 1) / 2), bandMax + 1)
        );
    }
    if (bandPool.length === 0) {
        return pickBaseStoneRandomCellSpreadFallback(boardSize, occupied, tempBoard, playerColor);
    }

    const scored = bandPool.map((c) => ({
        c,
        spread: occupied.size === 0 ? 0 : manhattanMinToOccupied(c.x, c.y, occupied),
    }));
    scored.sort((a, b) => b.spread - a.spread);
    const topSpread = scored[0]!.spread;
    const spreadTier = scored.filter((s) => s.spread >= topSpread - 1);
    const pick = spreadTier[Math.floor(Math.random() * spreadTier.length)]!.c;
    return { x: pick.x, y: pick.y };
};

const placeRemainingStonesRandomly = (
    game: types.LiveGameSession,
    playerKey: 'baseStones_p1' | 'baseStones_p2',
    band: BaseRandomPlacementBand = 'standard',
) => {
    const target = game.settings.baseStones ?? 4;
    
    if (!game[playerKey]) {
        game[playerKey] = [];
    }
    const stonesToPlace = target - game[playerKey]!.length;

    if (stonesToPlace <= 0) {
        return;
    }

    const occupied = new Set<string>();
    (game.baseStones_p1 ?? []).forEach(p => occupied.add(`${p.x},${p.y}`));
    (game.baseStones_p2 ?? []).forEach(p => occupied.add(`${p.x},${p.y}`));
    
    const { boardSize } = game.settings;

    const playerColor = getBasePlacementColorForKey(game, playerKey);

    // Create a temporary board state with currently placed stones
    const tempBoard: types.BoardState = Array(boardSize).fill(0).map(() => Array(boardSize).fill(types.Player.None));
    (game.baseStones_p1 ?? []).forEach(p => tempBoard[p.y][p.x] = getBasePlacementColorForKey(game, 'baseStones_p1'));
    (game.baseStones_p2 ?? []).forEach(p => tempBoard[p.y][p.x] = getBasePlacementColorForKey(game, 'baseStones_p2'));

    for (let i = 0; i < stonesToPlace; i++) {
        const picked = pickBaseStoneRandomCellInBandWithSpread(boardSize, occupied, tempBoard, playerColor, band);
        if (!picked) {
            console.warn(`[BaseGo] No empty cells left for base stone placement (playerKey=${playerKey}).`);
            return;
        }
        const { x, y } = picked;
        const key = `${x},${y}`;
        tempBoard[y][x] = playerColor;
        game[playerKey]!.push({ x, y });
        occupied.add(key);
    }
};

/**
 * 부족분 무작위 보충·겹침 제거·즉시 따임 판정으로 `baseStones_p1`/`p2`만 갱신. `gameStatus`는 바꾸지 않는다.
 */
const runBasePlacementAutoFillAndValidate = (game: types.LiveGameSession) => {
    const target = game.settings.baseStones ?? 4;
    const { boardSize } = game.settings;
    const MAX_AUTOFILL_ATTEMPTS = 4;
    const band: BaseRandomPlacementBand = shouldAutoRandomizeBasePlacement(game) ? 'pveAuto' : 'standard';

    for (let attempt = 0; attempt < MAX_AUTOFILL_ATTEMPTS; attempt++) {
        if ((game.baseStones_p1?.length ?? 0) < target) {
            placeRemainingStonesRandomly(game, 'baseStones_p1', band);
        }
        if ((game.baseStones_p2?.length ?? 0) < target) {
            placeRemainingStonesRandomly(game, 'baseStones_p2', band);
        }

        const p1Stones = [...(game.baseStones_p1 || [])];
        const p2Stones = [...(game.baseStones_p2 || [])];
        const coordMap = new Map<string, { player: 'p1' | 'p2'; point: types.Point }[]>();
        p1Stones.forEach((p) => {
            const key = `${p.x},${p.y}`;
            if (!coordMap.has(key)) coordMap.set(key, []);
            coordMap.get(key)!.push({ player: 'p1', point: p });
        });
        p2Stones.forEach((p) => {
            const key = `${p.x},${p.y}`;
            if (!coordMap.has(key)) coordMap.set(key, []);
            coordMap.get(key)!.push({ player: 'p2', point: p });
        });
        const overlappingCoords = new Set<string>();
        for (const [key, stones] of coordMap.entries()) {
            if (stones.length > 1) {
                overlappingCoords.add(key);
            }
        }
        let validP1Stones = p1Stones.filter((p) => !overlappingCoords.has(`${p.x},${p.y}`));
        let validP2Stones = p2Stones.filter((p) => !overlappingCoords.has(`${p.x},${p.y}`));
        if (validP1Stones.length > 0 || validP2Stones.length > 0) {
            const tempBoard: types.BoardState = Array(boardSize)
                .fill(0)
                .map(() => Array(boardSize).fill(types.Player.None));
            validP1Stones.forEach((p) => (tempBoard[p.y][p.x] = getBasePlacementColorForKey(game, 'baseStones_p1')));
            validP2Stones.forEach((p) => (tempBoard[p.y][p.x] = getBasePlacementColorForKey(game, 'baseStones_p2')));
            const tempGame = { boardState: tempBoard, settings: { boardSize } } as types.LiveGameSession;
            const logic = getGoLogic(tempGame);
            const stonesToRemove = new Set<string>();
            const allStones = [
                ...validP1Stones.map((p) => ({ ...p, player: getBasePlacementColorForKey(game, 'baseStones_p1') })),
                ...validP2Stones.map((p) => ({ ...p, player: getBasePlacementColorForKey(game, 'baseStones_p2') })),
            ];
            for (const stone of allStones) {
                const group = logic.findGroup(stone.x, stone.y, stone.player, tempBoard);
                if (group && group.liberties === 0) {
                    group.stones.forEach((s) => stonesToRemove.add(`${s.x},${s.y}`));
                }
            }
            if (stonesToRemove.size > 0) {
                validP1Stones = validP1Stones.filter((p) => !stonesToRemove.has(`${p.x},${p.y}`));
                validP2Stones = validP2Stones.filter((p) => !stonesToRemove.has(`${p.x},${p.y}`));
            }
        }

        game.baseStones_p1 = validP1Stones;
        game.baseStones_p2 = validP2Stones;

        if ((validP1Stones.length ?? 0) >= target && (validP2Stones.length ?? 0) >= target) {
            break;
        }
    }

    game.basePlacementDeadline = undefined;
    game.basePlacementReady = undefined;
};

const resolveBasePlacementAndTransition = (game: types.LiveGameSession, now: number) => {
    runBasePlacementAutoFillAndValidate(game);

    if (modeIncludesBaseCaptureMix(game.mode, game.settings)) {
        game.gameStatus = 'capture_bidding';
        game.bids = { [game.player1.id]: null, [game.player2.id]: null };
        game.biddingRound = 1;
        game.captureFirstRoundTieBidSnapshot = undefined;
        game.captureBidDeadline = shouldUseBaseSetupCountdown(game) ? now + PRE_GAME_PVP_COUNTDOWN_MS : undefined;
        game.baseStoneColorChoices = undefined;
        game.baseColorChoiceDeadline = undefined;
        game.baseSameColorTieColor = undefined;
        game.komiBids = undefined;
        game.komiBiddingDeadline = undefined;
        game.komiBiddingRound = undefined;
        game.turnDeadline = undefined;
        game.turnStartTime = undefined;
        game.pausedTurnTimeLeft = undefined;
        return;
    }

    game.gameStatus = 'base_stone_color_choice';
    game.baseStoneColorChoices = { [game.player1.id]: null, [game.player2.id]: null };
    game.baseColorChoiceDeadline = shouldUseBaseSetupCountdown(game) ? now + PRE_GAME_PVP_COUNTDOWN_MS : undefined;
    game.baseSameColorTieColor = undefined;
    game.komiBids = undefined;
    game.komiBiddingDeadline = undefined;
    game.komiBiddingRound = undefined;
    game.turnDeadline = undefined;
    game.turnStartTime = undefined;
    game.pausedTurnTimeLeft = undefined;
};

const oppositeStoneColor = (c: types.Player): types.Player =>
    c === types.Player.Black ? types.Player.White : types.Player.Black;

const clearBasePrePlayState = (game: types.LiveGameSession) => {
    game.komiBids = undefined;
    game.komiBiddingRound = undefined;
    game.komiBidRevealProcessed = undefined;
    game.baseStoneColorChoices = undefined;
    game.baseColorChoiceDeadline = undefined;
    game.baseSameColorTieColor = undefined;
    game.komiBiddingDeadline = undefined;
    game.basePlacementDeadline = undefined;
    game.revealEndTime = undefined;
    /** 임시 좌석은 색 확정과 함께 commitFinalBaseSeats에서 이미 비워졌어야 하지만, 안전을 위해 한 번 더 보장 */
    game.basePlacementBlackPlayerId = undefined;
    game.basePlacementWhitePlayerId = undefined;
};

const markBaseFinalColorAssignment = (game: types.LiveGameSession, now: number) => {
    (game as any).baseFinalColorAssignment = {
        blackPlayerId: game.blackPlayerId,
        whitePlayerId: game.whitePlayerId,
        lockedAt: now,
    };
};

/** 배치 당시 임시 흑/백에 따라 베이스돌을 판에 커밋한다. 최종 흑/백 유저는 이후 덮어쓴다. */
const commitBaseStonesToBoardPreservingPlacementColors = (
    game: types.LiveGameSession,
    newBoardState: types.BoardState,
) => {
    game.baseStones = [];
    (game.baseStones_p1 || []).forEach((p) => {
        const player = getBasePlacementColorForKey(game, 'baseStones_p1');
        newBoardState[p.y][p.x] = player;
        game.baseStones!.push({ ...p, player });
    });
    (game.baseStones_p2 || []).forEach((p) => {
        const player = getBasePlacementColorForKey(game, 'baseStones_p2');
        newBoardState[p.y][p.x] = player;
        game.baseStones!.push({ ...p, player });
    });
    game.boardState = newBoardState;
    game.baseStones_p1 = [];
    game.baseStones_p2 = [];
};

export const finalizeBaseCaptureBidResolution = (
    game: types.LiveGameSession,
    now: number,
    finalBlackPlayerId: string,
    finalWhitePlayerId: string,
) => {
    const newBoardState = Array(game.settings.boardSize)
        .fill(0)
        .map(() => Array(game.settings.boardSize).fill(types.Player.None));
    commitBaseStonesToBoardPreservingPlacementColors(game, newBoardState);
    commitFinalBaseSeats(game, finalBlackPlayerId, finalWhitePlayerId);
    markBaseFinalColorAssignment(game, now);
    game.finalKomi = game.settings.komi ?? 0.5;
    (game as any).kataStrategicOpeningBoardState = cloneBoardStateForKataOpeningSnapshot(newBoardState);
    (game as any).kataCaptureSetupMoves = encodeBoardStateAsKataSetupMovesFromEmpty(newBoardState);
    clearBasePrePlayState(game);
};

/** 선호 색이 다르면 즉시 흑·백 유저·덤(백 +0.5)·판(배치 색 유지) 확정 후 대국 시작 */
const finalizeBaseDifferentStoneColorChoices = (
    game: types.LiveGameSession,
    now: number,
    c1: types.Player,
    c2: types.Player,
) => {
    const p1 = game.player1;
    const p2 = game.player2;
    const blackPlayerId = c1 === types.Player.Black ? p1.id : p2.id;
    const whitePlayerId = c1 === types.Player.White ? p1.id : p2.id;
    /** 베이스 모드 `settings.komi`(기본 0.5)를 백 덤으로 그대로 사용 — 입찰 단계 없이 확정 */
    const finalKomi = game.settings.komi ?? 0.5;

    const newBoardState = Array(game.settings.boardSize)
        .fill(0)
        .map(() => Array(game.settings.boardSize).fill(types.Player.None));
    /** 임시 좌석을 commitFinalBaseSeats로 깨끗이 비우기 직전에 베이스돌의 배치 색을 판에 반영해야 한다. */
    commitBaseStonesToBoardPreservingPlacementColors(game, newBoardState);
    /** 본대국 좌석을 단 한 번 박고, 같은 시점에 좌석 잠금까지 켠 뒤 임시 좌석을 즉시 제거 — 어떤 패킷도 더 이상 임시 좌석으로 되돌리지 못한다. */
    commitFinalBaseSeats(game, blackPlayerId, whitePlayerId);
    markBaseFinalColorAssignment(game, now);
    game.finalKomi = finalKomi;
    /** 본대국에서는 `game.baseStones`만 베이스 좌표 소스 — p1/p2가 남으면 빈 자리 재착수가 베이스로 오인될 수 있음 */
    (game as any).kataStrategicOpeningBoardState = cloneBoardStateForKataOpeningSnapshot(newBoardState);
    (game as any).kataCaptureSetupMoves = encodeBoardStateAsKataSetupMovesFromEmpty(newBoardState);
    game.baseKomiBidsSnapshot = {
        [p1.id]: { color: c1, komi: 0 },
        [p2.id]: { color: c2, komi: 0 },
    };
    clearBasePrePlayState(game);
    enterBaseGameStartConfirmation(game, now);
};

const resolveBaseStoneColorChoicePhase = (game: types.LiveGameSession, now: number) => {
    const p1 = game.player1.id;
    const p2 = game.player2.id;
    if (!game.baseStoneColorChoices) {
        game.baseStoneColorChoices = { [p1]: null, [p2]: null };
    }
    const aiId = resolveAiParticipantId(game);
    const humanId = aiId === p1 ? p2 : p1;
    if (game.isAiGame && aiId) {
        const humanChoice = game.baseStoneColorChoices[humanId];
        if (humanChoice != null && game.baseStoneColorChoices[aiId] == null) {
            const aiPlacedStoneColor = getBasePlacementColorForUserId(game, aiId);
            game.baseStoneColorChoices[aiId] =
                aiPlacedStoneColor ??
                pickBlackOrWhiteFromDeterministicSeed(`${game.id}:baseAiStonePref:${humanId}:${humanChoice}`);
        }
    }

    let c1 = game.baseStoneColorChoices[p1] ?? null;
    let c2 = game.baseStoneColorChoices[p2] ?? null;
    const deadlinePassed = !!game.baseColorChoiceDeadline && now > game.baseColorChoiceDeadline;
    const bothChosen = c1 != null && c2 != null;
    if (!bothChosen && !deadlinePassed) return;

    if (deadlinePassed) {
        if (c1 == null && c2 == null) {
            c1 = pickBlackOrWhiteFromDeterministicSeed(`${game.id}:baseColorDeadline:${p1}`);
            c2 = pickBlackOrWhiteFromDeterministicSeed(`${game.id}:baseColorDeadline:${p2}`);
        } else if (c1 == null) {
            c1 = oppositeStoneColor(c2!);
        } else if (c2 == null) {
            c2 = oppositeStoneColor(c1!);
        }
    }

    game.baseStoneColorChoices![p1] = c1;
    game.baseStoneColorChoices![p2] = c2;
    game.baseColorChoiceDeadline = undefined;

    if (c1 === null || c2 === null) return;

    if (c1 !== c2) {
        // 선호가 다르면 흑·백은 선택 그대로, 덤은 settings.komi(기본 0.5)만 적용 후 경기 시작 확인(모달)으로
        finalizeBaseDifferentStoneColorChoices(game, now, c1, c2);
    } else {
        game.baseSameColorTieColor = c1;
        game.gameStatus = 'base_same_color_points_bid';
        game.komiBids = { [p1]: null, [p2]: null };
        game.komiBiddingDeadline = shouldUseBaseSetupCountdown(game) ? now + PRE_GAME_PVP_COUNTDOWN_MS : undefined;
        game.komiBiddingRound = 1;
        game.turnDeadline = undefined;
        game.turnStartTime = undefined;
        game.pausedTurnTimeLeft = undefined;
    }
};

/** 같은 색상 선택 후 덤 입찰 결과로 최종 흑·백·덤·판을 확정한다. */
const applyBaseKomiBidResolution = (game: types.LiveGameSession, now: number) => {
    const p1 = game.player1;
    const p2 = game.player2;
    const p1Bid = game.komiBids?.[p1.id];
    const p2Bid = game.komiBids?.[p2.id];
    if (p1Bid == null || p2Bid == null) return;

    const lockedColor = game.baseSameColorTieColor;
    if (lockedColor !== types.Player.Black && lockedColor !== types.Player.White) return;

    const baseKomi = game.settings.komi ?? 0.5;
    const p1Komi = Math.max(0, Math.floor(Number(p1Bid.komi) || 0));
    const p2Komi = Math.max(0, Math.floor(Number(p2Bid.komi) || 0));
    const winnerId =
        p1Komi > p2Komi
            ? p1.id
            : p2Komi > p1Komi
              ? p2.id
              : pickBlackOrWhiteFromDeterministicSeed(`${game.id}:baseSameColorKomiTie:${p1Komi}:${lockedColor}`) === types.Player.Black
                ? p1.id
                : p2.id;
    const loserId = winnerId === p1.id ? p2.id : p1.id;
    const winningBidKomi = Math.max(p1Komi, p2Komi);

    const finalBlackPlayerId = lockedColor === types.Player.Black ? winnerId : loserId;
    const finalWhitePlayerId = lockedColor === types.Player.White ? winnerId : loserId;
    const finalKomi = lockedColor === types.Player.Black ? winningBidKomi + baseKomi : baseKomi - winningBidKomi;

    const newBoardState = Array(game.settings.boardSize)
        .fill(0)
        .map(() => Array(game.settings.boardSize).fill(types.Player.None));
    /** 임시 좌석을 commitFinalBaseSeats로 비우기 직전, 베이스돌 배치 색을 그대로 판에 반영 */
    commitBaseStonesToBoardPreservingPlacementColors(game, newBoardState);
    /** 본대국 좌석 단 한 번 박고 좌석 잠금까지 켠 뒤 임시 좌석 즉시 제거 */
    commitFinalBaseSeats(game, finalBlackPlayerId, finalWhitePlayerId);
    markBaseFinalColorAssignment(game, now);
    game.finalKomi = finalKomi;
    (game as any).kataStrategicOpeningBoardState = cloneBoardStateForKataOpeningSnapshot(newBoardState);
    (game as any).kataCaptureSetupMoves = encodeBoardStateAsKataSetupMovesFromEmpty(newBoardState);
    game.baseKomiBidsSnapshot = { [p1.id]: { color: lockedColor, komi: p1Komi }, [p2.id]: { color: lockedColor, komi: p2Komi } };
    clearBasePrePlayState(game);
    enterBaseGameStartConfirmation(game, now);
};

export const updateBaseState = (game: types.LiveGameSession, now: number) => {
    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    
    switch (game.gameStatus) {
        case 'base_placement': {
            const p1StonesCount = game.baseStones_p1?.length ?? 0;
            const p2StonesCount = game.baseStones_p2?.length ?? 0;
            const target = game.settings.baseStones ?? 4;
            const bothDonePlacing = p1StonesCount >= target && p2StonesCount >= target;
            const bothReady =
                (game.basePlacementReady?.[p1Id] ?? false) && (game.basePlacementReady?.[p2Id] ?? false);
            const deadlinePassed =
                shouldUseBaseSetupCountdown(game) && !!game.basePlacementDeadline && now > game.basePlacementDeadline;
            // AI전: 봇은 시작 시 ready이지만 무작위 배치가 일부만 성공하면 돌 수가 부족할 수 있음.
            // resolveBasePlacementAndTransition이 부족분을 다시 채우므로, ready만 맞으면 전환한다.
            const canResolveBasePlacement =
                deadlinePassed || (bothReady && (bothDonePlacing || game.isAiGame));

            if (canResolveBasePlacement) {
                resolveBasePlacementAndTransition(game, now);
            }
            break;
        }
        case 'base_stone_color_choice': {
            resolveBaseStoneColorChoicePhase(game, now);
            break;
        }
        case 'base_same_color_points_bid': {
            const lockedSame = game.baseSameColorTieColor;
            if (game.isAiGame && game.komiBids) {
                const aiId = resolveAiParticipantId(game);
                if (aiId) {
                    const humanId = aiId === p1Id ? p2Id : p1Id;
                    if (lockedSame != null && game.komiBids[humanId] != null && game.komiBids[aiId] == null) {
                        const fromStage = (game.settings as types.GameSettings | undefined)?.singlePlayerAiBaseKomiBid;
                        const humanK = game.komiBids[humanId]!.komi;
                        const aiKomi = pickAiKomiValueAvoiding(fromStage, Number.isFinite(humanK) ? humanK : undefined);
                        game.komiBids[aiId] = { color: lockedSame, komi: Math.min(100, Math.max(0, Math.floor(aiKomi))) };
                    }
                }
            }
            const bothHaveBid = game.komiBids?.[p1Id] != null && game.komiBids?.[p2Id] != null;
            const deadlinePassed = shouldUseBaseSetupCountdown(game) && !!game.komiBiddingDeadline && now > game.komiBiddingDeadline;

            if (bothHaveBid || deadlinePassed) {
                if (deadlinePassed) {
                    const fillP1 = { color: lockedSame ?? types.Player.Black, komi: randomBaseAiKomiBid() };
                    const fillP2 = { color: lockedSame ?? types.Player.Black, komi: randomBaseAiKomiBid() };
                    if (!game.komiBids![p1Id]) game.komiBids![p1Id] = fillP1;
                    if (!game.komiBids![p2Id]) game.komiBids![p2Id] = fillP2;
                }
                applyBaseKomiBidResolution(game, now);
            }
            break;
        }
        case 'base_game_start_confirmation': {
            const bothConfirmed = game.preGameConfirmations?.[p1Id] && game.preGameConfirmations?.[p2Id];
            const deadlinePassed =
                !skipBaseStartConfirmationDeadline(game) && !!game.revealEndTime && now > game.revealEndTime;
            if (bothConfirmed || deadlinePassed) {
                transitionToPlayingOrUniformRoulette(game, now);
            }
            break;
        }
    }
};

/** `/api/action` 본문에 game을 실어 WS 없이도 클라가 본경기 전환을 반영하게 함 */
export function baseHttpGameSnapshot(game: types.LiveGameSession): types.HandleActionResult {
    const boardState =
        game.boardState && Array.isArray(game.boardState)
            ? game.boardState.map((row: number[]) => [...row])
            : game.boardState;
    return { clientResponse: { gameId: game.id, game: { ...game, boardState } as types.LiveGameSession } };
}

export const handleBaseAction = (game: types.LiveGameSession, action: types.ServerAction & { userId: string }, user: types.User): types.HandleActionResult | null => {
    const { type, payload } = action as any;
    const now = Date.now();

    switch (type) {
        case 'PLACE_BASE_STONE':
            if (game.gameStatus !== 'base_placement') return { error: "Not in base placement phase." };
            {
                const pairHostId = getPairLobbyOwnerId(game);
                const myStonesKey =
                    pairHostId != null
                        ? (() => {
                              if (user.id !== pairHostId) {
                                  return null as 'baseStones_p1' | 'baseStones_p2' | null;
                              }
                              return resolvePairHostActiveBaseStoneKey(game);
                          })()
                        : user.id === game.player1.id
                          ? ('baseStones_p1' as const)
                          : user.id === game.player2.id
                            ? ('baseStones_p2' as const)
                            : null;
                if (myStonesKey == null) {
                    return {
                        error:
                            pairHostId != null
                                ? '페어 방장만 베이스돌을 놓을 수 있습니다.'
                                : '베이스돌을 놓을 수 없습니다.',
                    };
                }
                if (!game[myStonesKey]) game[myStonesKey] = [];
                if ((game[myStonesKey]?.length ?? 0) >= game.settings.baseStones!) return { error: "Already placed all stones." };
                if (game[myStonesKey]!.some(p => p.x === payload.x && p.y === payload.y)) return { error: "Already placed a stone there." };
                const otherKey: 'baseStones_p1' | 'baseStones_p2' = myStonesKey === 'baseStones_p1' ? 'baseStones_p2' : 'baseStones_p1';
                if ((game[otherKey] ?? []).some((p) => p.x === payload.x && p.y === payload.y)) {
                    return { error: '상대 베이스돌이 있는 자리에는 둘 수 없습니다.' };
                }
                game[myStonesKey]!.push({ x: payload.x, y: payload.y });
                if (pairHostId != null) clearBothPlayersBasePlacementReady(game);
                else clearBasePlacementReadyForUser(game, user.id);
            }
            return {};
        case 'PLACE_REMAINING_BASE_STONES_RANDOMLY':
            if (game.gameStatus !== 'base_placement') return { error: "Not in base placement phase." };
            {
                const pairHostId = getPairLobbyOwnerId(game);
                const playerStonesKey =
                    pairHostId != null
                        ? user.id === pairHostId
                            ? resolvePairHostActiveBaseStoneKey(game)
                            : null
                        : user.id === game.player1.id
                          ? ('baseStones_p1' as const)
                          : ('baseStones_p2' as const);
                if (playerStonesKey == null) {
                    return { error: pairHostId != null ? '페어 방장만 베이스돌을 놓을 수 있습니다.' : 'Not in base placement phase.' };
                }
                placeRemainingStonesRandomly(game, playerStonesKey);
                if (pairHostId != null) clearBothPlayersBasePlacementReady(game);
                else clearBasePlacementReadyForUser(game, user.id);
            }
            return {};
        case 'RESET_MY_BASE_STONE_PLACEMENTS':
            if (game.gameStatus !== 'base_placement') return { error: "Not in base placement phase." };
            {
                const pairHostId = getPairLobbyOwnerId(game);
                const resetKey =
                    pairHostId != null
                        ? user.id === pairHostId
                            ? resolvePairHostResetOrUndoBaseStoneKey(game)
                            : null
                        : user.id === game.player1.id
                          ? ('baseStones_p1' as const)
                          : ('baseStones_p2' as const);
                if (resetKey == null) {
                    return { error: pairHostId != null ? '페어 방장만 재배치할 수 있습니다.' : 'Not in base placement phase.' };
                }
                game[resetKey] = [];
                if (pairHostId != null) clearBothPlayersBasePlacementReady(game);
                else clearBasePlacementReadyForUser(game, user.id);
            }
            return {};
        case 'UNDO_LAST_BASE_STONE_PLACEMENT':
            if (game.gameStatus !== 'base_placement') return { error: "Not in base placement phase." };
            {
                const pairHostId = getPairLobbyOwnerId(game);
                const undoKey =
                    pairHostId != null
                        ? user.id === pairHostId
                            ? resolvePairHostResetOrUndoBaseStoneKey(game)
                            : null
                        : user.id === game.player1.id
                          ? ('baseStones_p1' as const)
                          : ('baseStones_p2' as const);
                if (undoKey == null) {
                    return { error: pairHostId != null ? '페어 방장만 취소할 수 있습니다.' : 'Not in base placement phase.' };
                }
                const undoArr = game[undoKey];
                if (!undoArr || undoArr.length === 0) return { error: "취소할 배치가 없습니다." };
                undoArr.pop();
                if (pairHostId != null) clearBothPlayersBasePlacementReady(game);
                else clearBasePlacementReadyForUser(game, user.id);
            }
            return {};
        case 'CONFIRM_BASE_PLACEMENT_COMPLETE': {
            if (game.gameStatus !== 'base_placement') return { error: '베이스돌 배치 단계가 아닙니다.' };
            const targetStones = game.settings.baseStones ?? 4;
            const pairHostId = getPairLobbyOwnerId(game);
            if (pairHostId != null) {
                if (user.id !== pairHostId) return { error: '페어 방장만 배치 완료를 확정할 수 있습니다.' };
                if ((game.baseStones_p1?.length ?? 0) < targetStones || (game.baseStones_p2?.length ?? 0) < targetStones) {
                    return { error: '양쪽 베이스돌을 모두 놓은 뒤에 배치 완료를 눌러 주세요.' };
                }
                if (!game.basePlacementReady) {
                    game.basePlacementReady = { [game.player1.id]: false, [game.player2.id]: false };
                    if (game.isAiGame) {
                        const aiId = resolveAiParticipantId(game);
                        if (aiId) game.basePlacementReady[aiId] = true;
                    }
                }
                game.basePlacementReady[game.player1.id] = true;
                game.basePlacementReady[game.player2.id] = true;
                if (game.isAiGame) {
                    resolveBasePlacementAndTransition(game, now);
                    return baseHttpGameSnapshot(game);
                }
                /** `mixed_pair` 등에서는 HTTP 액션 직후 `updateStrategicGameState` 틱이 생략될 수 있어 여기서 한 번 진행 */
                updateBaseState(game, now);
                return {};
            }
            const confirmKey = user.id === game.player1.id ? 'baseStones_p1' : 'baseStones_p2';
            if ((game[confirmKey]?.length ?? 0) < targetStones) {
                return { error: '베이스돌을 모두 놓은 뒤에 배치 완료를 눌러 주세요.' };
            }
            if (!game.basePlacementReady) {
                game.basePlacementReady = { [game.player1.id]: false, [game.player2.id]: false };
                if (game.isAiGame) {
                    const aiId = resolveAiParticipantId(game);
                    if (aiId) game.basePlacementReady[aiId] = true;
                }
            }
            game.basePlacementReady[user.id] = true;
            if (game.isAiGame) {
                resolveBasePlacementAndTransition(game, now);
                return baseHttpGameSnapshot(game);
            }
            updateBaseState(game, now);
            return {};
        }
        case 'SUBMIT_BASE_STONE_COLOR_CHOICE': {
            if (game.gameStatus !== 'base_stone_color_choice') return { error: '선호 돌 선택 단계가 아닙니다.' };
            const col = payload.color as types.Player;
            if (col !== types.Player.Black && col !== types.Player.White) {
                return { error: '흑 또는 백만 선택할 수 있습니다.' };
            }
            if (!game.baseStoneColorChoices) {
                game.baseStoneColorChoices = { [game.player1.id]: null, [game.player2.id]: null };
            }
            const pairHostIdChoice = getPairLobbyOwnerId(game);
            const subjectId =
                pairHostIdChoice != null && typeof payload.choiceForUserId === 'string'
                    ? payload.choiceForUserId === game.player2.id
                        ? game.player2.id
                        : game.player1.id
                    : user.id;
            if (pairHostIdChoice != null && user.id !== pairHostIdChoice) {
                return { error: '페어 방장만 돌 색을 선택할 수 있습니다.' };
            }
            if (pairHostIdChoice != null && subjectId !== game.player1.id && subjectId !== game.player2.id) {
                return { error: '선택 대상이 올바르지 않습니다.' };
            }
            if (game.baseStoneColorChoices[subjectId] != null) return { error: '이미 선택했습니다.' };
            game.baseStoneColorChoices[subjectId] = col;
            return {};
        }
        case 'UPDATE_KOMI_BID': {
            const inSameColorBid = game.gameStatus === 'base_same_color_points_bid';
            if (!inSameColorBid) return { error: 'Cannot bid now.' };
            if (!game.komiBids) game.komiBids = {};
            const pairHostIdBid = getPairLobbyOwnerId(game);
            const bidSubjectId =
                pairHostIdBid != null && typeof payload.bidForUserId === 'string'
                    ? payload.bidForUserId === game.player2.id
                        ? game.player2.id
                        : game.player1.id
                    : user.id;
            if (pairHostIdBid != null && user.id !== pairHostIdBid) {
                return { error: '페어 방장만 덤 입찰을 할 수 있습니다.' };
            }
            if (pairHostIdBid != null && bidSubjectId !== game.player1.id && bidSubjectId !== game.player2.id) {
                return { error: '입찰 대상이 올바르지 않습니다.' };
            }
            if (game.komiBids?.[bidSubjectId]) return { error: 'Cannot bid now.' };
            const bid = payload.bid as { color: types.Player; komi: number };
            const locked = game.baseSameColorTieColor;
            if (locked == null) return { error: '동색 입찰 상태가 아닙니다.' };
            const k = Math.floor(Number(bid?.komi));
            const komi = Number.isFinite(k) ? Math.max(0, Math.min(100, k)) : 0;
            game.komiBids[bidSubjectId] = { color: locked, komi };
            return {};
        }
        case 'CONFIRM_BASE_REVEAL': {
            if (game.gameStatus === 'base_game_start_confirmation') {
                if (!game.preGameConfirmations) game.preGameConfirmations = {};
                game.preGameConfirmations[user.id] = true;
                // AI 대국 안전장치:
                // 일부 케이스에서 AI 확인 플래그가 참가자 키와 어긋나 "상대방 확인 대기 중"에 머무를 수 있으므로
                // 유저가 확인을 누른 시점에 상대(AI) 확인을 보정하고 즉시 시작 전환한다.
                if (game.isAiGame) {
                    const opponentId = game.player1.id === user.id ? game.player2.id : game.player1.id;
                    game.preGameConfirmations[opponentId] = true;
                    transitionToPlayingOrUniformRoulette(game, now);
                }
                return baseHttpGameSnapshot(game);
            }
            // 틱·PVP 타임아웃 등으로 이미 playing인데 클라가 모달을 늦게 닫는 경우(싱글 베이스)
            const baseReadyNoMoves =
                game.isSinglePlayer &&
                game.gameStatus === 'playing' &&
                !(game.moveHistory && game.moveHistory.length > 0) &&
                Boolean(game.blackPlayerId && game.whitePlayerId) &&
                ((game.baseStones?.length ?? 0) > 0 ||
                    (typeof game.settings?.baseStones === 'number' && game.settings.baseStones > 0));
            if (baseReadyNoMoves) return baseHttpGameSnapshot(game);
            return { error: 'Not in confirmation phase.' };
        }
    }
    return null;
};