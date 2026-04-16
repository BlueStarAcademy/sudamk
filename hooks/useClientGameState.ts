/**
 * 싱글플레이와 도전의 탑 게임의 공통 클라이언트 상태 관리 유틸리티
 * 서로 간섭하는 문제를 방지하기 위해 공통 로직을 여기로 추출
 */

import { Player, LiveGameSession, Point, GameMode } from '../types/index.js';
import { getFischerIncrementSeconds } from '../shared/utils/gameTimeControl.js';
import { recordPatternStoneConsumed, stripPatternStonesAtConsumedIntersections } from '../shared/utils/patternStoneConsume.js';

export type GameType = 'tower' | 'singleplayer';

export interface ClientMovePayload {
    gameId: string;
    x: number;
    y: number;
    newBoardState: any[][];
    capturedStones: Point[];
    newKoInfo: any;
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

const isSamePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

const hasPoint = (points: Point[] | undefined, target: Point) =>
    !!points?.some(point => isSamePoint(point, target));

const upsertPoint = (points: Point[] | undefined, target: Point): Point[] => {
    if (hasPoint(points, target)) {
        return points ? [...points] : [];
    }
    return [...(points || []), target];
};

const findMoveIndexAt = (moveHistory: LiveGameSession['moveHistory'] | undefined, x: number, y: number): number => {
    const moves = moveHistory || [];
    for (let i = moves.length - 1; i >= 0; i--) {
        if (moves[i].x === x && moves[i].y === y) {
            return i;
        }
    }
    return -1;
};

const getNeighbors = (x: number, y: number, boardSize: number): Point[] => {
    const neighbors: Point[] = [];
    if (x > 0) neighbors.push({ x: x - 1, y });
    if (x < boardSize - 1) neighbors.push({ x: x + 1, y });
    if (y > 0) neighbors.push({ x, y: y - 1 });
    if (y < boardSize - 1) neighbors.push({ x, y: y + 1 });
    return neighbors;
};

const collectCaptureAdjacentHiddenStones = (
    boardState: Player[][],
    capturedStones: Point[],
    movePlayer: Player,
    moveHistory: LiveGameSession['moveHistory'] | undefined,
    hiddenMoves: { [moveIndex: number]: boolean },
    permanentlyRevealedStones: Point[] | undefined
): { point: Point; player: Player }[] => {
    if (capturedStones.length === 0) {
        return [];
    }

    const contributors: { point: Point; player: Player }[] = [];
    const seen = new Set<string>();

    for (const capturedStone of capturedStones) {
        for (const neighbor of getNeighbors(capturedStone.x, capturedStone.y, boardState.length)) {
            if (boardState[neighbor.y]?.[neighbor.x] !== movePlayer) continue;

            const moveIndex = findMoveIndexAt(moveHistory, neighbor.x, neighbor.y);
            const isHiddenStone = moveIndex !== -1 && !!hiddenMoves[moveIndex];
            const key = `${neighbor.x},${neighbor.y}`;
            if (!isHiddenStone || seen.has(key) || hasPoint(permanentlyRevealedStones, neighbor)) continue;

            seen.add(key);
            contributors.push({ point: neighbor, player: movePlayer });
        }
    }

    return contributors;
};

const isHiddenModeActive = (game: LiveGameSession, hiddenMoves: { [moveIndex: number]: boolean }) =>
    game.mode === GameMode.Hidden ||
    (game.mode === GameMode.Mix && game.settings?.mixedModes?.includes(GameMode.Hidden)) ||
    ((game.settings as any)?.hiddenStoneCount ?? 0) > 0 ||
    Object.keys(hiddenMoves).length > 0 ||
    !!(game as any).aiInitialHiddenStone;

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
    const movePlayer = game.currentPlayer;
    const opponentPlayer = movePlayer === Player.Black ? Player.White : Player.Black;
    const newMoveHistory = [...(game.moveHistory || []), { x, y, player: movePlayer }];
    const updatedHiddenMoves = { ...(game.hiddenMoves || {}) };

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

    let updatedBlackTimeLeft = game.blackTimeLeft;
    let updatedWhiteTimeLeft = game.whiteTimeLeft;
    let updatedBlackByoyomiPeriodsLeft = game.blackByoyomiPeriodsLeft ?? game.settings?.byoyomiCount ?? 0;
    let updatedWhiteByoyomiPeriodsLeft = game.whiteByoyomiPeriodsLeft ?? game.settings?.byoyomiCount ?? 0;
    let updatedTurnDeadline = game.turnDeadline;
    let updatedTurnStartTime = game.turnStartTime;

    const timeIncrement = getFischerIncrementSeconds(game as any);
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

    const nextPlayer = movePlayer === Player.Black ? Player.White : Player.Black;
    let nextTime = nextPlayer === Player.Black ? updatedBlackTimeLeft : updatedWhiteTimeLeft;
    const nextByoyomiPeriods = nextPlayer === Player.Black ? updatedBlackByoyomiPeriodsLeft : updatedWhiteByoyomiPeriodsLeft;

    if (nextTime <= 0 && nextByoyomiPeriods <= 0) {
        nextTime = game.settings?.timeLimit ? game.settings.timeLimit * 60 : 0;
    }

    if (nextTime <= 0 && nextByoyomiPeriods > 0 && byoyomiTime > 0) {
        updatedTurnDeadline = now + (byoyomiTime * 1000);
        updatedTurnStartTime = now;
        if (nextPlayer === Player.Black) {
            updatedBlackTimeLeft = 0;
        } else {
            updatedWhiteTimeLeft = 0;
        }
    } else if (nextTime > 0) {
        updatedTurnDeadline = now + (nextTime * 1000);
        updatedTurnStartTime = now;
    }

    const finalKoInfo = newKoInfo || null;
    const revealModeActive = isHiddenModeActive(game, updatedHiddenMoves);

    const contributingHiddenStones =
        revealModeActive && capturedStones.length > 0
            ? collectCaptureAdjacentHiddenStones(
                newBoardState as Player[][],
                capturedStones,
                movePlayer,
                newMoveHistory,
                updatedHiddenMoves,
                game.permanentlyRevealedStones
            )
            : [];

    const capturedHiddenStones: { point: Point; player: Player }[] = [];
    if (revealModeActive && capturedStones.length > 0) {
        for (const stone of capturedStones) {
            const moveIndex = findMoveIndexAt(game.moveHistory, stone.x, stone.y);
            const wasHiddenMove = moveIndex !== -1 && !!game.hiddenMoves?.[moveIndex];
            const wasAiInitialHidden =
                (gameType === 'singleplayer' || gameType === 'tower') &&
                !!(game as any).aiInitialHiddenStone &&
                isSamePoint((game as any).aiInitialHiddenStone, stone);
            if ((wasHiddenMove || wasAiInitialHidden) && !hasPoint(game.permanentlyRevealedStones, stone)) {
                capturedHiddenStones.push({ point: stone, player: opponentPlayer });
            }
        }
    }

    const stonesToReveal = Array.from(
        new Map(
            [...contributingHiddenStones, ...capturedHiddenStones].map(item => [`${item.point.x},${item.point.y}`, item])
        ).values()
    );

    let updatedBlackPatternStones = game.blackPatternStones ? [...game.blackPatternStones] : undefined;
    let updatedWhitePatternStones = game.whitePatternStones ? [...game.whitePatternStones] : undefined;
    let consumedPatternSlice: { consumedPatternIntersections?: Point[] | null } = {
        consumedPatternIntersections: game.consumedPatternIntersections ? [...game.consumedPatternIntersections] : undefined,
    };
    const updatedCaptures = { ...(game.captures || {}) };
    const updatedHiddenStoneCaptures = { ...(game.hiddenStoneCaptures || {}) } as typeof game.hiddenStoneCaptures;
    let updatedPermanentlyRevealedStones = [...(game.permanentlyRevealedStones || [])];
    // 같은 교차점에 다시 착수할 때(히든이 따낸 자리 등) 이전 공개 마커가 남으면 문양/히든 표시가 꼬이므로 일반 착수면 해당 좌표 제거
    if (!isHidden) {
        updatedPermanentlyRevealedStones = updatedPermanentlyRevealedStones.filter(p => !(p.x === x && p.y === y));
    }
    const justCapturedEntries: { point: Point; player: Player; wasHidden: boolean; capturePoints?: number }[] = [];

    if (stonesToReveal.length === 0) {
        for (const stone of capturedStones) {
            const isPatternStone = opponentPlayer === Player.Black
                ? !!updatedBlackPatternStones?.some(p => isSamePoint(p, stone))
                : !!updatedWhitePatternStones?.some(p => isSamePoint(p, stone));
            const moveIndex = findMoveIndexAt(game.moveHistory, stone.x, stone.y);
            const wasHiddenMove = moveIndex !== -1 && !!game.hiddenMoves?.[moveIndex];
            const wasAiInitialHidden =
                (gameType === 'singleplayer' || gameType === 'tower') &&
                !!(game as any).aiInitialHiddenStone &&
                isSamePoint((game as any).aiInitialHiddenStone, stone);

            let points = 1;
            let wasHidden = false;

            if (isPatternStone) {
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
                updatedPermanentlyRevealedStones = upsertPoint(updatedPermanentlyRevealedStones, stone);
            }

            if (wasHiddenMove && moveIndex !== -1) {
                delete updatedHiddenMoves[moveIndex];
            }

            updatedCaptures[movePlayer] = (updatedCaptures[movePlayer] || 0) + points;
            justCapturedEntries.push({ point: stone, player: opponentPlayer, wasHidden, capturePoints: points });
        }
    } else {
        for (const stone of stonesToReveal) {
            updatedPermanentlyRevealedStones = upsertPoint(updatedPermanentlyRevealedStones, stone.point);
        }
    }

    let checkInfo: { towerFloor?: number; stageId: string; newCaptures: { [key in Player]?: number }; gameType: GameType } | undefined;

    if (gameType === 'tower' && game.towerFloor !== undefined && game.towerFloor >= 1 && game.towerFloor <= 20 && game.stageId) {
        checkInfo = {
            towerFloor: game.towerFloor,
            stageId: game.stageId,
            newCaptures: updatedCaptures,
            gameType: 'tower'
        };
    } else if (gameType === 'singleplayer' && game.stageId) {
        const hasTargetScore = game.effectiveCaptureTargets && (
            (game.effectiveCaptureTargets[Player.Black] !== undefined && game.effectiveCaptureTargets[Player.Black] !== 999) ||
            (game.effectiveCaptureTargets[Player.White] !== undefined && game.effectiveCaptureTargets[Player.White] !== 999)
        );
        const isCaptureMode = game.mode === '따내기 바둑' || (game.mode as any) === 'capture';
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
        justCaptured: justCapturedEntries,
        newlyRevealed: [],
        animation: null,
        pendingCapture: null,
        revealAnimationEndTime: undefined,
        ...(updatedWhiteTurnsPlayed !== undefined ? { whiteTurnsPlayed: updatedWhiteTurnsPlayed } as any : {}),
        ...(updatedTotalTurns !== undefined ? { totalTurns: updatedTotalTurns } as any : {}),
    };

    if ((gameType === 'tower' || gameType === 'singleplayer') && isHidden && movePlayer === Player.Black) {
        (updatedGame as any).gameStatus = 'playing';
        const hiddenKey = 'hidden_stones_p1';
        const current = (game as any)[hiddenKey] ?? (game.settings as any)?.hiddenStoneCount ?? 0;
        (updatedGame as any)[hiddenKey] = Math.max(0, current - 1);
    }

    if ((gameType === 'singleplayer' || gameType === 'tower') && isHidden && movePlayer === Player.White) {
        (updatedGame as any).gameStatus = 'playing';
        (updatedGame as any).aiInitialHiddenStone = { x, y };
        (updatedGame as any).aiInitialHiddenStoneIsPrePlaced = false;
        const p2Hidden = (game as any).hidden_stones_p2 ?? (game.settings as any)?.hiddenStoneCount ?? 0;
        (updatedGame as any).hidden_stones_p2 = Math.max(0, p2Hidden - 1);
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
            duration: 2000
        } as any;
        updatedGame.revealAnimationEndTime = now + 2000;
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
            const { SINGLE_PLAYER_STAGES } = await import('../constants/singlePlayerConstants.js');
            const stage = SINGLE_PLAYER_STAGES.find((s: any) => s.id === checkInfo.stageId);
            
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

