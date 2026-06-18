/**
 * 싱글플레이와 도전의 탑 게임의 공통 클라이언트 상태 관리 유틸리티
 * 서로 간섭하는 문제를 방지하기 위해 공통 로직을 여기로 추출
 */

import { Player, LiveGameSession, Point, GameMode } from '../types/index.js';
import { getFischerIncrementSeconds } from '../shared/utils/gameTimeControl.js';
import { recordPatternStoneConsumed, stripPatternStonesAtConsumedIntersections } from '../shared/utils/patternStoneConsume.js';
import { aiUserId } from '../shared/constants/auth.js';
import { resolveArenaSessionPolicy } from '../shared/utils/liveSessionArenaKind.js';
import {
    isIntersectionRecordedAsBaseStone,
    removeCapturedBaseStoneMarkersFromSession,
} from '../shared/utils/removeCapturedBaseStoneMarkers.js';
import { getTowerSessionFloor } from '../utils/towerPreGameDisplay.js';
import { findLatestMoveIndexAtExcludingRecordedBaseStones } from '../shared/utils/baseHiddenMoveIndex.js';
import { mixGoClearHiddenItemPhaseTimers, mixGoSessionHasHiddenItems } from '../shared/utils/mixGoRules.js';
import { getSpeedPerMoveSeconds } from '../shared/utils/gameTimeControl.js';
import { PVE_AI_HIDDEN_REVEAL_DURATION_MS } from '../shared/constants/gameSettings.js';
import { expandToAllUnrevealedHiddenStonesForPlayers } from '../shared/utils/expandHiddenRevealStones.js';
import {
    applySpeedTimePressureAfterClientMove,
    isSessionSpeedTimePressureMode,
} from '../shared/utils/speedTimePressureSessionSync.js';

export type GameType = 'tower' | 'singleplayer';

export interface ClientMovePayload {
    gameId: string;
    x: number;
    y: number;
    newBoardState: any[][];
    capturedStones: Point[];
    newKoInfo: any;
    /** 클릭 당시 클라이언트가 실제로 보고 있던 수순. 서버 hidden_placing 응답이 더 짧은 수순으로 끼어들어 히든 인덱스가 0으로 붙는 것을 막는다. */
    moveHistoryBeforeMove?: LiveGameSession['moveHistory'];
    /** moveHistoryBeforeMove와 같은 스냅샷의 히든 맵. */
    hiddenMovesBeforeMove?: LiveGameSession['hiddenMoves'];
    /** 착수자 명시(턴 레이스 시 currentPlayer 의존 오판 방지) */
    movePlayer?: Player;
    /** 도전의 탑 21층+ 히든 아이템 착수 시 true (gameStatus → playing, hiddenMoves 기록, hidden_stones_p1 감소) */
    isHidden?: boolean;
}

export interface GameStateUpdateResult {
    updatedGame: LiveGameSession;
    shouldCheckVictory: boolean;
    checkInfo?: {
        towerFloor?: number;
        stageId: string;
        newCaptures: { [key in Player]?: number };
        gameType: GameType;
    };
}

const getEffectiveFischerIncrementForClient = (game: LiveGameSession): number => {
    const isSpeedMode =
        game.mode === GameMode.Speed ||
        (game.mode === GameMode.Mix && !!game.settings?.mixedModes?.includes(GameMode.Speed));
    // AI 대국 스피드는 피셔 증분을 사용하지 않는다(서버 규칙과 동기화).
    if (game.isAiGame && isSpeedMode) return 0;
    return getFischerIncrementSeconds(game as any);
};

const isSamePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

const hasPoint = (points: Point[] | undefined, target: Point) =>
    !!points?.some(point => isSamePoint(point, target));

const upsertPoint = (points: Point[] | undefined, target: Point): Point[] => {
    if (hasPoint(points, target)) {
        return points ? [...points] : [];
    }
    return [...(points || []), target];
};

const findMoveIndexAt = (
    moveHistory: LiveGameSession['moveHistory'] | undefined,
    x: number,
    y: number,
    player?: Player,
    baseCtx?: Pick<LiveGameSession, 'baseStones' | 'baseStones_p1' | 'baseStones_p2' | 'gameStatus'>,
): number => {
    return findLatestMoveIndexAtExcludingRecordedBaseStones(moveHistory, x, y, player, baseCtx);
};

const getNeighbors = (x: number, y: number, boardSize: number): Point[] => {
    const neighbors: Point[] = [];
    if (x > 0) neighbors.push({ x: x - 1, y });
    if (x < boardSize - 1) neighbors.push({ x: x + 1, y });
    if (y > 0) neighbors.push({ x, y: y - 1 });
    if (y < boardSize - 1) neighbors.push({ x, y: y + 1 });
    return neighbors;
};

const collectCapturingGroupHiddenStones = (
    boardState: Player[][],
    moveX: number,
    moveY: number,
    movePlayer: Player,
    moveHistory: LiveGameSession['moveHistory'] | undefined,
    hiddenMoves: { [moveIndex: number]: boolean },
    permanentlyRevealedStones: Point[] | undefined,
    baseCtx?: Pick<LiveGameSession, 'baseStones' | 'baseStones_p1' | 'baseStones_p2' | 'gameStatus'>,
    aiInitialHiddenStone?: Point | null,
    isCurrentMoveHidden = false,
): { point: Point; player: Player }[] => {
    const contributors: { point: Point; player: Player }[] = [];
    const seen = new Set<string>();
    const capturingGroupPoints = new Set<string>();
    const queue: Point[] = [{ x: moveX, y: moveY }];
    capturingGroupPoints.add(`${moveX},${moveY}`);

    while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const neighbor of getNeighbors(cur.x, cur.y, boardState.length)) {
            const key = `${neighbor.x},${neighbor.y}`;
            if (capturingGroupPoints.has(key)) continue;
            if (boardState[neighbor.y]?.[neighbor.x] !== movePlayer) continue;
            capturingGroupPoints.add(key);
            queue.push(neighbor);
        }
    }

    for (const key of capturingGroupPoints) {
        const [nx, ny] = key.split(',').map(Number);
        const isCurrentMove = nx === moveX && ny === moveY;
        let isHiddenStone = isCurrentMove ? isCurrentMoveHidden : false;
        if (!isCurrentMove) {
            const moveIndex = findMoveIndexAt(moveHistory, nx, ny, movePlayer, baseCtx);
            isHiddenStone = moveIndex !== -1 && !!hiddenMoves[moveIndex];
            if (
                !isHiddenStone &&
                aiInitialHiddenStone &&
                nx === aiInitialHiddenStone.x &&
                ny === aiInitialHiddenStone.y &&
                !hasPoint(permanentlyRevealedStones, { x: nx, y: ny })
            ) {
                isHiddenStone = true;
            }
        }
        if (!isHiddenStone || seen.has(key) || hasPoint(permanentlyRevealedStones, { x: nx, y: ny })) continue;
        seen.add(key);
        contributors.push({ point: { x: nx, y: ny }, player: movePlayer });
    }

    return contributors;
};

const isHiddenModeActive = (game: LiveGameSession, hiddenMoves: { [moveIndex: number]: boolean }) =>
    mixGoSessionHasHiddenItems(game.mode, game.settings as any) ||
    Object.keys(hiddenMoves).length > 0 ||
    !!(game as any).aiInitialHiddenStone;

const isAiControlledPlayerId = (id: string | undefined | null): boolean =>
    id === aiUserId || Boolean(id && (id.startsWith('dungeon-bot-') || id.startsWith('pair-') || id.startsWith('pet-ai-')));

const getPlayerIdForEnum = (game: LiveGameSession, player: Player): string | null | undefined =>
    player === Player.Black ? game.blackPlayerId : player === Player.White ? game.whitePlayerId : undefined;

const getHiddenInventoryKeyForPlayer = (player: Player): 'hidden_stones_p1' | 'hidden_stones_p2' =>
    player === Player.Black ? 'hidden_stones_p1' : 'hidden_stones_p2';

const hiddenPointMatches = (stone: Point & { player?: Player }, target: Point, player: Player): boolean =>
    stone.x === target.x && stone.y === target.y && (stone.player === undefined || stone.player === player);

const isHumanPveHiddenMove = (game: LiveGameSession, movePlayer: Player): boolean => {
    const policy = resolveArenaSessionPolicy(game as any);
    if (policy.matchAxis !== 'pve') return false;
    const playerId = getPlayerIdForEnum(game, movePlayer);
    if (playerId) return !isAiControlledPlayerId(playerId);

    const opponent = movePlayer === Player.Black ? Player.White : Player.Black;
    const opponentId = getPlayerIdForEnum(game, opponent);
    // 한쪽 좌석 id만 슬림 패킷/스토리지에 남는 경우: 상대가 AI면 이 착수는 인간 PVE 히든으로 본다.
    if (opponentId && isAiControlledPlayerId(opponentId)) return true;
    if (opponentId && !isAiControlledPlayerId(opponentId)) return false;

    // 구 세션 폴백: 싱글/탑은 기존처럼 유저 흑을 기본값으로 둔다.
    return movePlayer === Player.Black;
};

function upsertHumanHiddenStonePoint(
    points: Array<Point & { player?: Player }> | undefined,
    target: Point,
    player: Player
): Array<Point & { player?: Player }> {
    const next = (points || []).filter(point => !(point.x === target.x && point.y === target.y && point.player === player));
    next.push({ x: target.x, y: target.y, player });
    return next;
}

function sanitizeHumanHiddenMoveIndexes(
    hiddenMoves: { [moveIndex: number]: boolean },
    moveHistory: LiveGameSession['moveHistory'],
    game: LiveGameSession,
    humanHiddenStonePoints: Array<Point & { player?: Player }> | undefined
): { [moveIndex: number]: boolean } {
    if (!Array.isArray(moveHistory) || !humanHiddenStonePoints?.length) return hiddenMoves;
    const next: { [moveIndex: number]: boolean } = {};
    for (const [rawIndex, isHidden] of Object.entries(hiddenMoves)) {
        if (!isHidden) continue;
        const index = Number(rawIndex);
        if (!Number.isInteger(index) || index < 0) continue;
        const move = moveHistory[index];
        if (!move || move.x < 0 || move.y < 0) continue;
        if (isHumanPveHiddenMove(game, move.player)) {
            if (humanHiddenStonePoints.some(point => hiddenPointMatches(point, move, move.player))) {
                next[index] = true;
            }
            continue;
        }
        next[index] = true;
    }
    for (const point of humanHiddenStonePoints) {
        for (let i = moveHistory.length - 1; i >= 0; i--) {
            const move = moveHistory[i];
            if (
                move &&
                move.x === point.x &&
                move.y === point.y &&
                (point.player === undefined || move.player === point.player)
            ) {
                next[i] = true;
                break;
            }
        }
    }
    return next;
}

/**
 * 클라이언트 이동 처리 후 게임 상태 업데이트
 */
export function updateGameStateAfterMove(
    game: LiveGameSession,
    payload: ClientMovePayload & { isPass?: boolean },
    gameType: GameType
): GameStateUpdateResult {
    const { x, y, newBoardState, capturedStones, newKoInfo, isPass, isHidden } = payload;

    if (isPass && x === -1 && y === -1) {
        const movePlayer = game.currentPlayer;
        const updatedGame = {
            ...game,
            passCount: (game.passCount || 0) + 1,
            lastMove: { x: -1, y: -1 },
            lastTurnStones: null,
            moveHistory: [...(game.moveHistory || []), { player: movePlayer, x: -1, y: -1 }],
            currentPlayer: movePlayer === Player.Black ? Player.White : Player.Black,
            // 통과 시 단순 코 금지 해제(서버 PASS_TURN과 동일). stale koInfo로 다음 착수가 막히지 않도록 함
            koInfo: newKoInfo ?? null
        };

        return {
            updatedGame,
            shouldCheckVictory: false,
            checkInfo: undefined
        };
    }

    const now = Date.now();
    const payloadMovePlayer = payload.movePlayer;
    const movePlayer =
        payloadMovePlayer === Player.Black || payloadMovePlayer === Player.White
            ? payloadMovePlayer
            : game.currentPlayer;
    const opponentPlayer = movePlayer === Player.Black ? Player.White : Player.Black;
    const nextPlayer = opponentPlayer;
    const currentMoveHistory = game.moveHistory || [];
    const payloadBaseMoveHistory = Array.isArray(payload.moveHistoryBeforeMove)
        ? payload.moveHistoryBeforeMove
        : undefined;
    const usePayloadMoveHistoryBase =
        !!payloadBaseMoveHistory &&
        (payloadBaseMoveHistory.length > currentMoveHistory.length ||
            (isHidden && payloadBaseMoveHistory.length === currentMoveHistory.length));
    const baseMoveHistory = usePayloadMoveHistoryBase ? payloadBaseMoveHistory : currentMoveHistory;
    const baseHiddenMoves =
        usePayloadMoveHistoryBase && payload.hiddenMovesBeforeMove
            ? payload.hiddenMovesBeforeMove
            : game.hiddenMoves;
    const newMoveHistory = [...baseMoveHistory, { x, y, player: movePlayer }];
    const updatedHiddenMoves = { ...(baseHiddenMoves || {}) };

    if (isHidden) {
        updatedHiddenMoves[newMoveHistory.length - 1] = true;
    }

    let updatedWhiteTurnsPlayed = (game as any).whiteTurnsPlayed;
    if (gameType === 'singleplayer' && movePlayer === Player.White) {
        updatedWhiteTurnsPlayed = ((game as any).whiteTurnsPlayed || 0) + 1;
    }

    let updatedTotalTurns = game.totalTurns;
    if ((gameType === 'singleplayer' || gameType === 'tower') && game.stageId) {
        const validMoves = newMoveHistory.filter(m => m.x !== -1 && m.y !== -1);
        if (!isPass) {
            if (game.totalTurns != null && game.totalTurns >= 0) {
                updatedTotalTurns = game.totalTurns + 1;
            } else {
                let storedTotal: number | null = null;
                try {
                    const key = `gameState_${game.id}`;
                    const stored = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null;
                    if (stored) {
                        const parsed = JSON.parse(stored);
                        if (parsed.gameId === game.id && typeof parsed.totalTurns === 'number' && parsed.totalTurns > 0) {
                            storedTotal = parsed.totalTurns;
                        }
                    }
                } catch {
                    // ignore
                }
                updatedTotalTurns = storedTotal != null ? storedTotal + 1 : validMoves.length;
            }
        } else {
            updatedTotalTurns = validMoves.length;
        }
    }

    let speedSyncedSettings = game.settings ? ({ ...game.settings } as LiveGameSession['settings']) : game.settings;
    let speedSyncedCaptures: LiveGameSession['captures'] = game.captures
        ? ({ ...game.captures } as LiveGameSession['captures'])
        : ({ [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 } as LiveGameSession['captures']);

    if (!isPass && isSessionSpeedTimePressureMode(game)) {
        const speedScratch: LiveGameSession = {
            ...game,
            settings: speedSyncedSettings,
            captures: speedSyncedCaptures,
        };
        applySpeedTimePressureAfterClientMove(speedScratch, movePlayer, now, aiUserId);
        speedSyncedSettings = speedScratch.settings;
        speedSyncedCaptures = speedScratch.captures as LiveGameSession['captures'];
    }

    let updatedBlackTimeLeft = game.blackTimeLeft;
    let updatedWhiteTimeLeft = game.whiteTimeLeft;
    let updatedBlackByoyomiPeriodsLeft = game.blackByoyomiPeriodsLeft ?? game.settings?.byoyomiCount ?? 0;
    let updatedWhiteByoyomiPeriodsLeft = game.whiteByoyomiPeriodsLeft ?? game.settings?.byoyomiCount ?? 0;
    let updatedTurnDeadline = game.turnDeadline;
    let updatedTurnStartTime = game.turnStartTime;

    if (isSessionSpeedTimePressureMode(game)) {
        const turnElapsed =
            typeof game.turnStartTime === 'number' ? Math.max(0, (now - game.turnStartTime) / 1000) : 0;
        if (movePlayer === Player.Black) {
            updatedBlackTimeLeft = Math.max(0, (game.blackTimeLeft ?? 0) - turnElapsed);
        } else {
            updatedWhiteTimeLeft = Math.max(0, (game.whiteTimeLeft ?? 0) - turnElapsed);
        }
        const perMoveSec = getSpeedPerMoveSeconds(game as any);
        updatedTurnDeadline = now + perMoveSec * 1000;
        updatedTurnStartTime = now;
    } else {
        const timeIncrement = getEffectiveFischerIncrementForClient(game);
        const byoyomiTime = game.settings?.byoyomiTime ?? 0;

        if (movePlayer === Player.Black) {
            let currentTime = game.turnDeadline
                ? Math.max(0, (game.turnDeadline - now) / 1000)
                : (game.blackTimeLeft || 0);
            if (timeIncrement > 0) currentTime += timeIncrement;
            if (currentTime <= 0 && updatedBlackByoyomiPeriodsLeft > 0 && byoyomiTime > 0) {
                updatedBlackTimeLeft = 0;
                updatedBlackByoyomiPeriodsLeft = Math.max(0, updatedBlackByoyomiPeriodsLeft - 1);
            } else {
                updatedBlackTimeLeft = Math.max(0, currentTime);
            }
        } else {
            let currentTime = game.turnDeadline
                ? Math.max(0, (game.turnDeadline - now) / 1000)
                : (game.whiteTimeLeft || 0);
            if (timeIncrement > 0) currentTime += timeIncrement;
            if (currentTime <= 0 && updatedWhiteByoyomiPeriodsLeft > 0 && byoyomiTime > 0) {
                updatedWhiteTimeLeft = 0;
                updatedWhiteByoyomiPeriodsLeft = Math.max(0, updatedWhiteByoyomiPeriodsLeft - 1);
            } else {
                updatedWhiteTimeLeft = Math.max(0, currentTime);
            }
        }

        let nextTime = nextPlayer === Player.Black ? updatedBlackTimeLeft : updatedWhiteTimeLeft;
        const nextByoyomiPeriods =
            nextPlayer === Player.Black ? updatedBlackByoyomiPeriodsLeft : updatedWhiteByoyomiPeriodsLeft;

        if (nextTime <= 0 && nextByoyomiPeriods <= 0) {
            nextTime = game.settings?.timeLimit ? game.settings.timeLimit * 60 : 0;
        }

        if (nextTime <= 0 && nextByoyomiPeriods > 0 && byoyomiTime > 0) {
            updatedTurnDeadline = now + byoyomiTime * 1000;
            updatedTurnStartTime = now;
            if (nextPlayer === Player.Black) {
                updatedBlackTimeLeft = 0;
            } else {
                updatedWhiteTimeLeft = 0;
            }
        } else if (nextTime > 0) {
            updatedTurnDeadline = now + nextTime * 1000;
            updatedTurnStartTime = now;
        }
    }

    const finalKoInfo = newKoInfo || null;
    const revealModeActive = isHiddenModeActive(game, updatedHiddenMoves);

    const aiInitialHiddenStone = (game as { aiInitialHiddenStone?: Point | null }).aiInitialHiddenStone;
    const contributingHiddenStones =
        revealModeActive && capturedStones.length > 0
            ? collectCapturingGroupHiddenStones(
                newBoardState as Player[][],
                x,
                y,
                movePlayer,
                newMoveHistory,
                updatedHiddenMoves,
                game.permanentlyRevealedStones,
                game,
                aiInitialHiddenStone,
                !!isHidden,
            )
            : [];

    const capturedHiddenStones: { point: Point; player: Player }[] = [];
    if (revealModeActive && capturedStones.length > 0) {
        for (const stone of capturedStones) {
            const moveIndex = findMoveIndexAt(baseMoveHistory, stone.x, stone.y, opponentPlayer, game);
            const wasHiddenMove = moveIndex !== -1 && !!baseHiddenMoves?.[moveIndex];
            const wasAiInitialHidden =
                !!(aiInitialHiddenStone && isSamePoint(aiInitialHiddenStone, stone));
            if ((wasHiddenMove || wasAiInitialHidden) && !hasPoint(game.permanentlyRevealedStones, stone)) {
                capturedHiddenStones.push({ point: stone, player: opponentPlayer });
            }
        }
    }

    const resolveAiPlayerEnum = (): Player => {
        if (isAiControlledPlayerId(game.blackPlayerId)) return Player.Black;
        if (isAiControlledPlayerId(game.whitePlayerId)) return Player.White;
        return Player.None;
    };
    const aiPlayerEnum = resolveAiPlayerEnum();
    const revealSeed = Array.from(
        new Map(
            [...contributingHiddenStones, ...capturedHiddenStones].map((item) => [
                `${item.point.x},${item.point.y}`,
                item,
            ])
        ).values()
    );
    const stonesToReveal = expandToAllUnrevealedHiddenStonesForPlayers(
        {
            ...game,
            boardState: newBoardState as Player[][],
            moveHistory: newMoveHistory,
            hiddenMoves: updatedHiddenMoves,
        } as LiveGameSession,
        revealSeed,
        { aiPlayerEnum },
    );
    const involvesAiHidden = stonesToReveal.some((stone) => stone.player === aiPlayerEnum);
    const revealDuration = involvesAiHidden ? PVE_AI_HIDDEN_REVEAL_DURATION_MS : 2000;

    let updatedBlackPatternStones = game.blackPatternStones ? [...game.blackPatternStones] : undefined;
    let updatedWhitePatternStones = game.whitePatternStones ? [...game.whitePatternStones] : undefined;
    let consumedPatternSlice: { consumedPatternIntersections?: Point[] | null } = {
        consumedPatternIntersections: game.consumedPatternIntersections ? [...game.consumedPatternIntersections] : undefined,
    };
    const updatedCaptures = { ...(speedSyncedCaptures || {}) };
    const updatedHiddenStoneCaptures = { ...(game.hiddenStoneCaptures || {}) } as typeof game.hiddenStoneCaptures;
    const updatedBaseStoneCaptures = {
        [Player.None]: game.baseStoneCaptures?.[Player.None] ?? 0,
        [Player.Black]: game.baseStoneCaptures?.[Player.Black] ?? 0,
        [Player.White]: game.baseStoneCaptures?.[Player.White] ?? 0,
    } as typeof game.baseStoneCaptures;
    let updatedPermanentlyRevealedStones = [...(game.permanentlyRevealedStones || [])];
    // 같은 교차점에 다시 착수할 때(히든이 따낸 자리 등) 이전 공개 마커가 남으면 문양/히든 표시가 꼬이므로 일반 착수면 해당 좌표 제거
    if (!isHidden) {
        updatedPermanentlyRevealedStones = updatedPermanentlyRevealedStones.filter(p => !(p.x === x && p.y === y));
    }

    let updatedBaseStones: Point[] | undefined | null = game.baseStones ? [...game.baseStones] : null;
    if (updatedBaseStones && updatedBaseStones.length > 0 && capturedStones.length > 0) {
        const scratch = { baseStones: [...updatedBaseStones] } as LiveGameSession;
        removeCapturedBaseStoneMarkersFromSession(scratch, capturedStones);
        updatedBaseStones = scratch.baseStones?.length ? [...(scratch.baseStones as Point[])] : undefined;
    }
    if (updatedBaseStones && updatedBaseStones.length === 0) {
        updatedBaseStones = undefined;
    }
    const justCapturedEntries: {
        point: Point;
        player: Player;
        wasHidden: boolean;
        capturePoints?: number;
        wasBaseStone?: boolean;
    }[] = [];

    if (stonesToReveal.length === 0) {
        for (const stone of capturedStones) {
            const isPatternStone = opponentPlayer === Player.Black
                ? !!updatedBlackPatternStones?.some(p => isSamePoint(p, stone))
                : !!updatedWhitePatternStones?.some(p => isSamePoint(p, stone));
            const moveIndex = findMoveIndexAt(baseMoveHistory, stone.x, stone.y, opponentPlayer, game);
            const wasHiddenMove = moveIndex !== -1 && !!baseHiddenMoves?.[moveIndex];
            const wasAiInitialHidden =
                (gameType === 'singleplayer' || gameType === 'tower') &&
                !!(game as any).aiInitialHiddenStone &&
                isSamePoint((game as any).aiInitialHiddenStone, stone);

            const isBaseStone = isIntersectionRecordedAsBaseStone(game, stone.x, stone.y);

            let points = 1;
            let wasHidden = false;

            if (isBaseStone) {
                points = 5;
                updatedBaseStoneCaptures[movePlayer] = (updatedBaseStoneCaptures[movePlayer] || 0) + 1;
                recordPatternStoneConsumed(consumedPatternSlice, stone);
            } else if (isPatternStone) {
                points = 2;
                if (opponentPlayer === Player.Black) {
                    updatedBlackPatternStones = updatedBlackPatternStones?.filter(p => !isSamePoint(p, stone));
                } else {
                    updatedWhitePatternStones = updatedWhitePatternStones?.filter(p => !isSamePoint(p, stone));
                }
                recordPatternStoneConsumed(consumedPatternSlice, stone);
            } else if (wasHiddenMove || wasAiInitialHidden) {
                points = 5;
                wasHidden = true;
                updatedHiddenStoneCaptures[movePlayer] = (updatedHiddenStoneCaptures[movePlayer] || 0) + 1;
                recordPatternStoneConsumed(consumedPatternSlice, stone);
                updatedPermanentlyRevealedStones = upsertPoint(updatedPermanentlyRevealedStones, stone);
            }

            if (wasHiddenMove && moveIndex !== -1) {
                delete updatedHiddenMoves[moveIndex];
            }

            updatedCaptures[movePlayer] = (updatedCaptures[movePlayer] || 0) + points;
            justCapturedEntries.push({
                point: stone,
                player: opponentPlayer,
                wasHidden,
                capturePoints: points,
                ...(isBaseStone ? { wasBaseStone: true as const } : {}),
            });
        }
    } else {
        for (const stone of stonesToReveal) {
            updatedPermanentlyRevealedStones = upsertPoint(updatedPermanentlyRevealedStones, stone.point);
        }
    }

    let checkInfo: { towerFloor?: number; stageId: string; newCaptures: { [key in Player]?: number }; gameType: GameType } | undefined;

    const towerSessionFloor = gameType === 'tower' ? getTowerSessionFloor(game) : 0;
    if (gameType === 'tower' && towerSessionFloor >= 1 && towerSessionFloor <= 20 && game.stageId) {
        checkInfo = {
            towerFloor: towerSessionFloor,
            stageId: game.stageId,
            newCaptures: updatedCaptures,
            gameType: 'tower'
        };
    } else if (gameType === 'singleplayer' && game.stageId) {
        const hasTargetScore = game.effectiveCaptureTargets && (
            (game.effectiveCaptureTargets[Player.Black] !== undefined && game.effectiveCaptureTargets[Player.Black] !== 999) ||
            (game.effectiveCaptureTargets[Player.White] !== undefined && game.effectiveCaptureTargets[Player.White] !== 999)
        );
        const isCaptureMode = game.mode === GameMode.Capture || (game.mode as any) === 'capture';
        if (hasTargetScore || isCaptureMode) {
            checkInfo = {
                stageId: game.stageId,
                newCaptures: updatedCaptures,
                gameType: 'singleplayer'
            };
        }
    }

    const patternScratch: LiveGameSession = {
        ...game,
        blackPatternStones: updatedBlackPatternStones,
        whitePatternStones: updatedWhitePatternStones,
        consumedPatternIntersections: consumedPatternSlice.consumedPatternIntersections ?? undefined,
    };
    stripPatternStonesAtConsumedIntersections(patternScratch);
    updatedBlackPatternStones = patternScratch.blackPatternStones;
    updatedWhitePatternStones = patternScratch.whitePatternStones;

    const updatedGame: LiveGameSession = {
        ...game,
        settings: speedSyncedSettings,
        boardState: newBoardState,
        koInfo: finalKoInfo,
        lastMove: { x, y },
        moveHistory: newMoveHistory,
        captures: updatedCaptures,
        blackPatternStones: updatedBlackPatternStones,
        whitePatternStones: updatedWhitePatternStones,
        consumedPatternIntersections: patternScratch.consumedPatternIntersections,
        currentPlayer: nextPlayer,
        serverRevision: (game.serverRevision || 0) + 1,
        blackTimeLeft: updatedBlackTimeLeft,
        whiteTimeLeft: updatedWhiteTimeLeft,
        blackByoyomiPeriodsLeft: updatedBlackByoyomiPeriodsLeft,
        whiteByoyomiPeriodsLeft: updatedWhiteByoyomiPeriodsLeft,
        turnDeadline: updatedTurnDeadline,
        turnStartTime: updatedTurnStartTime,
        hiddenMoves: updatedHiddenMoves,
        permanentlyRevealedStones: updatedPermanentlyRevealedStones,
        hiddenStoneCaptures: updatedHiddenStoneCaptures,
        baseStoneCaptures: updatedBaseStoneCaptures,
        ...(updatedBaseStones !== null ? { baseStones: updatedBaseStones } : {}),
        justCaptured: justCapturedEntries,
        newlyRevealed: [],
        animation: null,
        pendingCapture: null,
        revealAnimationEndTime: undefined,
        ...(updatedWhiteTurnsPlayed !== undefined ? { whiteTurnsPlayed: updatedWhiteTurnsPlayed } as any : {}),
        ...(updatedTotalTurns !== undefined ? { totalTurns: updatedTotalTurns } as any : {}),
    };

    if ((gameType === 'tower' || gameType === 'singleplayer') && isHidden && isHumanPveHiddenMove(game, movePlayer)) {
        (updatedGame as any).gameStatus = 'playing';
        mixGoClearHiddenItemPhaseTimers(updatedGame);
        updatedGame.humanHiddenStonePoints = upsertHumanHiddenStonePoint(
            game.humanHiddenStonePoints,
            { x, y },
            movePlayer
        );
        updatedGame.hiddenMoves = sanitizeHumanHiddenMoveIndexes(
            updatedGame.hiddenMoves || {},
            updatedGame.moveHistory,
            updatedGame,
            updatedGame.humanHiddenStonePoints
        );
        const hiddenKey = getHiddenInventoryKeyForPlayer(movePlayer);
        const current = (game as any)[hiddenKey] ?? (game.settings as any)?.hiddenStoneCount ?? 0;
        (updatedGame as any)[hiddenKey] = Math.max(0, current - 1);
    }

    if ((gameType === 'singleplayer' || gameType === 'tower') && isHidden && !isHumanPveHiddenMove(game, movePlayer)) {
        (updatedGame as any).gameStatus = 'playing';
        mixGoClearHiddenItemPhaseTimers(updatedGame);
        (updatedGame as any).aiInitialHiddenStone = { x, y };
        (updatedGame as any).aiInitialHiddenStoneIsPrePlaced = false;
        const aiHiddenKey = getHiddenInventoryKeyForPlayer(movePlayer);
        const aiHidden = (game as any)[aiHiddenKey] ?? (game.settings as any)?.hiddenStoneCount ?? 0;
        (updatedGame as any)[aiHiddenKey] = Math.max(0, aiHidden - 1);
        const plannedTurns = Array.isArray((game as any).aiHiddenItemTurns) ? (game as any).aiHiddenItemTurns as number[] : [];
        const usedCount = Math.max(0, Number((game as any).aiHiddenItemsUsedCount ?? 0));
        const nextUsedCount = usedCount + 1;
        (updatedGame as any).aiHiddenItemsUsedCount = nextUsedCount;
        (updatedGame as any).aiHiddenItemUsed = plannedTurns.length > 0
            ? nextUsedCount >= plannedTurns.length
            : true;
    }

    if (
        (gameType === 'singleplayer' || gameType === 'tower') &&
        !!(game as any).aiInitialHiddenStone &&
        capturedHiddenStones.some(stone => isSamePoint(stone.point, (game as any).aiInitialHiddenStone))
    ) {
        (updatedGame as any).aiInitialHiddenStone = undefined;
        (updatedGame as any).aiInitialHiddenStoneIsPrePlaced = false;
    }

    if (stonesToReveal.length > 0) {
        const boardDuringReveal = (newBoardState || []).map(row => [...row]);
        // 따낸 돌은 보드에서 제거(빈 칸). opponentPlayer로 덮어쓰면 따낸 돌이 다시 남는 버그 발생
        for (const stone of capturedStones) {
            if (boardDuringReveal[stone.y]) {
                boardDuringReveal[stone.y][stone.x] = Player.None;
            }
        }

        updatedGame.boardState = boardDuringReveal;
        updatedGame.currentPlayer = movePlayer;
        updatedGame.gameStatus = 'hidden_reveal_animating';
        updatedGame.animation = {
            type: 'hidden_reveal',
            stones: stonesToReveal,
            startTime: now,
            duration: revealDuration,
        } as any;
        updatedGame.revealAnimationEndTime = now + revealDuration;
        updatedGame.pendingCapture = {
            stones: capturedStones,
            move: { x, y, player: movePlayer },
            hiddenContributors: contributingHiddenStones.map(item => item.point),
            capturedHiddenStones: capturedHiddenStones.map(item => item.point)
        };
        updatedGame.captures = { ...(game.captures || {}) };
        updatedGame.hiddenStoneCaptures = { ...(game.hiddenStoneCaptures || {}) } as typeof game.hiddenStoneCaptures;
        updatedGame.blackPatternStones = game.blackPatternStones ? [...game.blackPatternStones] : game.blackPatternStones;
        updatedGame.whitePatternStones = game.whitePatternStones ? [...game.whitePatternStones] : game.whitePatternStones;
        updatedGame.justCaptured = [];
        updatedGame.newlyRevealed = [];
        updatedGame.turnDeadline = undefined;
        updatedGame.turnStartTime = undefined;
        updatedGame.pausedTurnTimeLeft = game.turnDeadline
            ? Math.max(0, (game.turnDeadline - now) / 1000)
            : game.pausedTurnTimeLeft;
        updatedGame.itemUseDeadline = undefined;
    }

    return {
        updatedGame,
        shouldCheckVictory: !!checkInfo,
        checkInfo
    };
}

/**
 * 승리 조건 체크 (도전의 탑 및 싱글플레이)
 */
export async function checkVictoryCondition(
    checkInfo: { towerFloor?: number; stageId: string; newCaptures: { [key in Player]?: number }; gameType: GameType },
    gameId: string,
    effectiveCaptureTargets?: { [key in Player]?: number }
): Promise<{ winner: Player; winReason: string } | null> {
    try {
        if (checkInfo.gameType === 'tower') {
            // 서버 START_TOWER / effectiveCaptureTargets와 동일하게 판정 (층별 목표 덮어쓰기 반영)
            const { TOWER_STAGES } = await import('../constants/towerConstants.js');
            const stage = TOWER_STAGES.find((s: any) => s.id === checkInfo.stageId);
            if (!stage) {
                return null;
            }
            const NO_CAPTURE_TARGET = 999;
            const blackTarget =
                effectiveCaptureTargets?.[Player.Black] ?? stage.targetScore?.black ?? NO_CAPTURE_TARGET;
            const whiteTarget =
                effectiveCaptureTargets?.[Player.White] ?? stage.targetScore?.white ?? NO_CAPTURE_TARGET;

            const blackCaptures = checkInfo.newCaptures[Player.Black] || 0;
            const whiteCaptures = checkInfo.newCaptures[Player.White] || 0;

            if (blackTarget !== NO_CAPTURE_TARGET && blackCaptures >= blackTarget) {
                return { winner: Player.Black, winReason: 'capture_limit' };
            }
            if (whiteTarget !== NO_CAPTURE_TARGET && whiteCaptures >= whiteTarget) {
                return { winner: Player.White, winReason: 'capture_limit' };
            }
        } else if (checkInfo.gameType === 'singleplayer') {
            // 싱글플레이 승리 조건 체크
            const { getSinglePlayerStages } = await import('../constants/singlePlayerConstants.js');
            const stage = getSinglePlayerStages().find((s: any) => s.id === checkInfo.stageId);
            
            if (!stage) {
                return null;
            }
            
            // 살리기 바둑 모드: 백의 남은 턴 체크
            if (stage.survivalTurns) {
                // 살리기 바둑은 클라이언트에서 백의 턴 수를 추적할 수 없으므로 서버에서만 처리
                // 하지만 백이 수를 둔 후 클라이언트에서도 체크 가능
                return null;
            }
            
            // effectiveCaptureTargets가 있으면 사용, 없으면 stage.targetScore 사용
            const blackTarget = effectiveCaptureTargets?.[Player.Black] ?? stage.targetScore?.black ?? 999;
            const whiteTarget = effectiveCaptureTargets?.[Player.White] ?? stage.targetScore?.white ?? 999;
            
            const blackCaptures = checkInfo.newCaptures[Player.Black] || 0;
            const whiteCaptures = checkInfo.newCaptures[Player.White] || 0;
            
            // NO_CAPTURE_TARGET (999)은 목표가 없음을 의미
            const NO_CAPTURE_TARGET = 999;
            
            // 흑(유저)이 목표 따낸 돌의 수를 달성하면 승리
            if (blackTarget !== NO_CAPTURE_TARGET && blackCaptures >= blackTarget) {
                return { winner: Player.Black, winReason: 'capture_limit' };
            }
            
            // 백(AI)이 목표 점수를 달성하면 패배
            if (whiteTarget !== NO_CAPTURE_TARGET && whiteCaptures >= whiteTarget) {
                return { winner: Player.White, winReason: 'capture_limit' };
            }
        }
        
        return null;
    } catch (err) {
        console.error('[checkVictoryCondition] Failed to import stages:', err);
        return null;
    }
}

/**
 * 게임 타입 판단
 */
export function getGameType(game: LiveGameSession): GameType | null {
    if (game.gameCategory === 'tower') {
        return 'tower';
    }
    if (game.isSinglePlayer) {
        return 'singleplayer';
    }
    return null;
}

