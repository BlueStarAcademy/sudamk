/**
 * 바둑 AI 봇 시스템
 * 싱글플레이, 도전의탑, 전략·모험 AI 대국 등에서 사용하는 1단계~10단계 바둑 AI.
 * 전략 goAi 경로는 KataServer만 사용한다. KATA_SERVER_URL 미설정·API 오류·무효 응답은 모두 예외로 전파한다(휴리스틱 폴백 없음).
 * 한 턴당 Kata 응답 좌표만 착수에 사용한다(히든 규칙으로 재질의·다른 좌표로 바꾸지 않음).
 * Kata가 PASS/빈 좌표만 주는 경우 `kataServerService`에서 예외로 끝나며, 그 경로에서는 기권·패스 폴백으로 가리지 않는다.
 */

import { LiveGameSession, Player, Point } from '../types/index.js';
import { getGoLogic, processMove } from './goLogic.js';
import * as types from '../types/index.js';
import * as summaryService from './summaryService.js';
import { getCaptureTarget, NO_CAPTURE_TARGET } from './utils/captureTargets.ts';
import * as db from './db.js';
import { hasTimeControl, shouldEnforceTimeControl } from './modes/shared.js';
import { isFischerStyleTimeControl } from '../shared/utils/gameTimeControl.js';
import { generateKataServerMoveCandidates, isKataServerAvailable } from './kataServerService.js';
import { SPECIAL_GAME_MODES } from '../constants/index.js';
import {
    consumeOpponentPatternStoneIfAny,
    isPatternIntersectionPermanentlyConsumed,
    stripPatternStonesAtConsumedIntersections,
} from '../shared/utils/patternStoneConsume.js';
import { adventureMonsterLevelToKataServerLevel, KATA_SERVER_LEVEL_BY_PROFILE_STEP } from '../shared/utils/strategicAiDifficulty.js';
import { getGuildWarKataServerLevelByBoardId } from '../shared/constants/guildConstants.js';
import { getTowerKataServerLevelByFloor } from '../shared/utils/towerKataServerLevel.js';
import { broadcastPlayingSnapshotBeforeScoring } from './utils/broadcastPlayingBeforeScoring.js';
import {
    cloneBoardStateForKataOpeningSnapshot,
    encodeBoardStateAsKataSetupMovesFromEmpty,
} from './kataCaptureSetupEncoding.js';
import { bumpGuildWarMaxSingleCapturePointsForPlayer } from '../shared/utils/guildWarMaxSingleCapturePoints.js';
import { reconcileStrategicAiBoardSizeWithGroundTruth } from './utils/effectiveBoardSize.js';

/** 싱글·탑 등 PVE: 마지막 AI 수 돌이 보인 뒤 계가 — 클라 착수 애니메이션과 순서 맞춤 */
const PVE_DEFERRED_AUTO_SCORING_AFTER_LAST_AI_MS = 600;
const pveDeferredAutoScoringTimers = new Map<string, ReturnType<typeof setTimeout>>();

function isPveDeferredAutoScoringGame(game: types.LiveGameSession): boolean {
    const gc = String((game as any).gameCategory ?? '');
    return !!(game.isSinglePlayer || gc === 'tower' || gc === 'singleplayer');
}

async function runDeferredPveAutoScoring(gameId: string): Promise<void> {
    try {
        const { getCachedGame } = await import('./gameCache.js');
        let g: types.LiveGameSession | null = await getCachedGame(gameId);
        if (!g) g = await db.getLiveGame(gameId);
        if (!g) return;
        const kick = (g as any).pendingAutoScoringKickoffAt as number | undefined;
        if (kick == null || !Number.isFinite(kick)) return;
        if (Date.now() < kick) {
            scheduleDeferredPveAutoScoring(gameId, Math.max(1, kick - Date.now()));
            return;
        }
        (g as any).pendingAutoScoringKickoffAt = undefined;
        if (g.gameStatus !== 'playing' && (g.gameStatus as string) !== 'hidden_placing') return;

        const scoringLimit = (g.settings as any)?.scoringTurnLimit;
        const useScoringLimitAsAuto =
            g.mode !== types.GameMode.Capture && scoringLimit != null && scoringLimit > 0;
        const autoScoringTurns =
            g.isSinglePlayer && g.stageId
                ? (await import('../constants/singlePlayerConstants.js')).SINGLE_PLAYER_STAGES.find((s) => s.id === g.stageId)
                      ?.autoScoringTurns
                : String((g as any).gameCategory ?? '') === 'tower' ||
                    String((g as any).gameCategory ?? '') === 'singleplayer'
                  ? (g.settings as any)?.autoScoringTurns
                  : useScoringLimitAsAuto
                    ? scoringLimit
                    : undefined;
        if (!autoScoringTurns) return;
        const countPassAsTurn =
            scoringLimit != null && scoringLimit > 0 && !g.isSinglePlayer && (g as any).gameCategory !== 'tower';
        const validMoves = (g.moveHistory || []).filter((m) => m.x !== -1 && m.y !== -1);
        const totalTurns = countPassAsTurn ? (g.moveHistory || []).length : validMoves.length;
        if (totalTurns < autoScoringTurns) return;

        const gameType = g.isSinglePlayer ? 'SinglePlayer' : 'PVE';
        console.log(
            `[GoAiBot][${gameType}] Deferred auto-scoring starting after last AI stone animation (game=${g.id}, turns=${totalTurns}/${autoScoringTurns})`
        );
        if (isLobbyAiStrategicGoGame(g)) {
            await broadcastPlayingSnapshotBeforeScoring(g);
        }
        g.endTime = Date.now();
        g.gameStatus = 'scoring';
        await db.saveGame(g);
        const { updateGameCache } = await import('./gameCache.js');
        updateGameCache(g);
        const { broadcastToGameParticipants } = await import('./socket.js');
        const gameToBroadcast = { ...g };
        delete (gameToBroadcast as any).boardState;
        broadcastToGameParticipants(g.id, { type: 'GAME_UPDATE', payload: { [g.id]: gameToBroadcast } }, g);
        const { getGameResult } = await import('./gameModes.js');
        await getGameResult(g);
    } catch (e: any) {
        console.error(`[runDeferredPveAutoScoring] game=${gameId}:`, e?.message ?? e);
    }
}

function scheduleDeferredPveAutoScoring(gameId: string | number | undefined, delayMs: number): void {
    const key = String(gameId ?? '');
    const prev = pveDeferredAutoScoringTimers.get(key);
    if (prev) clearTimeout(prev);
    const tid = setTimeout(() => {
        pveDeferredAutoScoringTimers.delete(key);
        void runDeferredPveAutoScoring(key);
    }, delayMs);
    pveDeferredAutoScoringTimers.set(key, tid);
}

/** AI 히든 연출 종료 직후 착수에만 쓰는 Kata 좌표 캐시(프로세스 메모리; 구 세이브의 animation.pendingHiddenMove로 재주입) */
const pendingAiHiddenKataMoveByGameId = new Map<string, Point>();

const hiddenKataCacheKey = (gameId: string | number | undefined): string => String(gameId ?? '');

function rehydratePendingAiHiddenKataFromStoredAnimation(game: types.LiveGameSession) {
    const anim = game.animation as { type?: string; pendingHiddenMove?: Point } | null | undefined;
    if (anim?.type !== 'ai_thinking' || !anim.pendingHiddenMove) return;
    const p = anim.pendingHiddenMove;
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) return;
    const key = hiddenKataCacheKey(game.id);
    if (!pendingAiHiddenKataMoveByGameId.has(key)) {
        pendingAiHiddenKataMoveByGameId.set(key, { x: p.x, y: p.y });
    }
}

/** 모험·로비 AI 대국: 계가 전 마지막 착수가 화면에 반영되도록 */
function isLobbyAiStrategicGoGame(game: types.LiveGameSession): boolean {
    return (
        !!game.isAiGame &&
        !game.isSinglePlayer &&
        (game as any).gameCategory !== 'tower' &&
        (game as any).gameCategory !== 'singleplayer' &&
        (game as any).gameCategory !== 'guildwar'
    );
}

/**
 * 유저 히든 전체 공개 등으로 수순 길이는 같아도 좌표가 바뀐 뒤, KataServer가 `game_id`로 이전 국면을 캐시하면 AI가 멈추거나
 * 잘못된 수를 고를 수 있다. 공개 직후 다음 Kata 요청에만 다른 태그를 붙여 캐시를 무효화한다.
 */
function bumpKataHiddenRevealCacheTag(game: types.LiveGameSession): string {
    const n = (((game as any).__kataHiddenRevealSeq as number) ?? 0) + 1;
    (game as any).__kataHiddenRevealSeq = n;
    return `hr${n}`;
}

/**
 * KataServer `game_id` 헤더용 세션 태그. 재접속(F5)·끊김 후 재입장 시 resume 시퀀스로 캐시를 비우고,
 * 히든 전체 공개 시에는 기존처럼 hr 태그를 함께 붙인다.
 */
export function composeKataSessionTagForGame(game: types.LiveGameSession, hiddenRevealTag?: string): string | undefined {
    const resumeRaw = Number((game.settings as any)?.kataSessionResumeSeq);
    const resume = Number.isFinite(resumeRaw) && resumeRaw > 0 ? Math.floor(resumeRaw) : 0;

    // 미사일/히든 아이템처럼 수순 길이는 같아도 좌표 배치가 바뀌는 경우를 위해
    // 보드+턴 기반 태그를 항상 포함해 Kata 캐시 키를 국면 단위로 분리한다.
    const board = game.boardState || [];
    const boardSize = Number((game.settings as any)?.boardSize) || board.length || 19;
    let hash = 2166136261 >>> 0; // FNV-1a style 32-bit hash
    for (let y = 0; y < board.length; y++) {
        const row = board[y] || [];
        for (let x = 0; x < row.length; x++) {
            const v = Number(row[x]) || 0;
            hash ^= ((v + 3) * 31 + x * 17 + y * 13) >>> 0;
            hash = Math.imul(hash, 16777619) >>> 0;
        }
    }
    const turnTag = game.currentPlayer === types.Player.Black ? 'b' : game.currentPlayer === types.Player.White ? 'w' : 'n';
    const boardTurnTag = `bt${boardSize}-${turnTag}-${hash.toString(36)}`;

    const parts: string[] = [];
    if (resume > 0) parts.push(`rs${resume}`);
    parts.push(boardTurnTag);
    if (hiddenRevealTag && String(hiddenRevealTag).trim()) parts.push(String(hiddenRevealTag).trim());
    if (parts.length === 0) return undefined;
    return parts.join('-');
}

/** 전략 AI 대국: 히든 개수는 player1/player2 좌석 기준(hidden_stones_p1/p2). AI가 항상 p2라는 가정은 길드전·색 배정에 깨질 수 있음 */
function getStrategicAiHiddenStonesKey(game: types.LiveGameSession, aiPlayerEnum: types.Player): 'hidden_stones_p1' | 'hidden_stones_p2' {
    const aiPlayerId = aiPlayerEnum === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
    if (!aiPlayerId || !game.player1?.id) return 'hidden_stones_p2';
    return aiPlayerId === game.player1.id ? 'hidden_stones_p1' : 'hidden_stones_p2';
}

/**
 * AI 봇 단계별 특성 정의
 */
export interface GoAiBotProfile {
    /** AI 단계 (1~10) */
    level: number;
    /** AI 이름 */
    name: string;
    /** 설명 */
    description: string;
    /** 따내기 성향 (0.0 ~ 1.0, 높을수록 따내기에 집중) */
    captureTendency: number;
    /** 영토 확보 성향 (0.0 ~ 1.0, 높을수록 영토에 집중) */
    territoryTendency: number;
    /** 전투 성향 (0.0 ~ 1.0, 높을수록 전투 선호) */
    combatTendency: number;
    /** 정석/포석 활용도 (0.0 ~ 1.0, 높을수록 정석/포석 활용) */
    josekiUsage: number;
    /** 사활 판단 능력 (0.0 ~ 1.0, 높을수록 정확한 사활 판단) */
    lifeDeathSkill: number;
    /** 행마 능력 (0.0 ~ 1.0, 높을수록 우수한 행마) */
    movementSkill: number;
    /** 실수 확률 (0.0 ~ 1.0, 높을수록 실수 많음) */
    mistakeRate: number;
    /** 승리 목적 달성도 (0.0 ~ 1.0, 높을수록 승리에 집중) */
    winFocus: number;
    /** 계산 깊이 (1~10, 높을수록 깊이 계산, 단계별로 미래를 내다보는 수) */
    calculationDepth: number;
    
    // 10단계별 바둑 기술 지식
    /** 1단계: 기본 규칙 (활로, 단수, 따내기) */
    knowsBasicRules: boolean;
    /** 2단계: 자충수 방지 */
    avoidsSelfAtari: boolean;
    /** 3단계: 먹여치기 및 환격 */
    knowsSacrificeAndCounter: boolean;
    /** 4단계: 단수 상황 판단 (따내기 vs 살리기) */
    knowsAtariJudgment: boolean;
    /** 5단계: 방향성 공격 (1선, 우리편 방향, 도망치기 힘든 방향) */
    knowsDirectionalAttack: boolean;
    /** 6단계: 초반 포석 (3-4선 선호) */
    knowsFuseki: boolean;
    /** 7단계: 영토 확보 및 전투 */
    knowsTerritoryAndCombat: boolean;
    /** 8단계: 고급 기술 (촉촉수, 축, 장문, 환격, 먹여치기) */
    knowsAdvancedTechniques: boolean;
    /** 9단계: 연결/끊음, 사활, 행마 */
    knowsConnectionLifeDeathMovement: boolean;
    /** 10단계: 마무리 (집 지키기/부수기) */
    knowsEndgame: boolean;
}

const getStrategicAiHiddenWindowMaxTurn = (game: LiveGameSession): number => {
    const scoringTurnLimit = Number((game.settings as any)?.scoringTurnLimit ?? 0);
    if (Number.isFinite(scoringTurnLimit) && scoringTurnLimit > 0) {
        // 40 -> 15, 60 -> 25, 80 -> 35. Other turn limits scale with the same ratio.
        return Math.max(1, Math.round(scoringTurnLimit / 2) - 5);
    }
    return 10;
};

const normalizeAiHiddenTurns = (value: unknown): number[] => {
    if (!Array.isArray(value)) return [];
    return value
        .map(turn => Number(turn))
        .filter(turn => Number.isInteger(turn) && turn > 0)
        .sort((a, b) => a - b);
};

const planStrategicAiHiddenTurns = (game: LiveGameSession, hiddenCount: number): number[] => {
    const existingTurns = normalizeAiHiddenTurns((game as any).aiHiddenItemTurns);
    const plannedUses = Math.max(existingTurns.length, hiddenCount >= 2 ? 2 : (hiddenCount > 0 ? 1 : 0));
    if (plannedUses <= 0) return [];

    const windowMaxTurn = getStrategicAiHiddenWindowMaxTurn(game);
    const legacyTurn = typeof game.aiHiddenItemTurn === 'number' && game.aiHiddenItemTurn > 0
        ? [game.aiHiddenItemTurn]
        : [];
    const mergedTurns = Array.from(new Set([...existingTurns, ...legacyTurn]))
        .filter(turn => turn <= windowMaxTurn)
        .sort((a, b) => a - b);

    while (mergedTurns.length < plannedUses) {
        const randomTurn = 1 + Math.floor(Math.random() * windowMaxTurn);
        if (!mergedTurns.includes(randomTurn)) {
            mergedTurns.push(randomTurn);
            mergedTurns.sort((a, b) => a - b);
        }
    }

    const finalTurns = mergedTurns.slice(0, plannedUses).sort((a, b) => a - b);
    (game as any).aiHiddenItemTurns = finalTurns;
    game.aiHiddenItemTurn = finalTurns[0];
    return finalTurns;
};

const getCurrentAiTurnIndex = (game: LiveGameSession, aiPlayerEnum: Player): number => {
    const aiTurnsPlayed = (game.moveHistory || []).filter(
        move => move.player === aiPlayerEnum && move.x !== -1 && move.y !== -1
    ).length;
    return aiTurnsPlayed + 1;
};

const collectContributingHiddenStones = (
    game: LiveGameSession,
    boardAfterMove: types.BoardState,
    move: Point,
    aiPlayerEnum: Player,
    capturedStones: Point[],
    isCurrentMoveHidden: boolean
): { point: Point; player: Player }[] => {
    const contributingHiddenStones: { point: Point; player: Player }[] = [];
    const seen = new Set<string>();
    const logic = getGoLogic({ ...game, boardState: boardAfterMove });

    for (const capturedStone of capturedStones) {
        for (const neighbor of logic.getNeighbors(capturedStone.x, capturedStone.y)) {
            if (boardAfterMove[neighbor.y][neighbor.x] !== aiPlayerEnum) continue;

            const isCurrentMove = neighbor.x === move.x && neighbor.y === move.y;
            let isHiddenStone = isCurrentMove ? isCurrentMoveHidden : false;
            if (!isCurrentMove) {
                for (let i = game.moveHistory.length - 1; i >= 0; i--) {
                    const historyMove = game.moveHistory[i];
                    if (historyMove.x === neighbor.x && historyMove.y === neighbor.y) {
                        isHiddenStone = !!game.hiddenMoves?.[i];
                        break;
                    }
                }
            }

            const key = `${neighbor.x},${neighbor.y}`;
            if (isHiddenStone && !seen.has(key) && !game.permanentlyRevealedStones?.some(point => point.x === neighbor.x && point.y === neighbor.y)) {
                seen.add(key);
                contributingHiddenStones.push({ point: { x: neighbor.x, y: neighbor.y }, player: aiPlayerEnum });
            }
        }
    }

    return contributingHiddenStones;
};

const applyAiCaptureOutcome = (
    game: LiveGameSession,
    result: ReturnType<typeof processMove>,
    move: Point,
    aiPlayerEnum: Player,
    opponentPlayerEnum: Player,
    isHiddenMode: boolean,
    isCurrentMoveHidden: boolean,
    now: number
): boolean => {
    if (result.capturedStones.length <= 0) {
        return false;
    }

    game.justCaptured = [];

    if (isHiddenMode) {
        const contributingHiddenStones = collectContributingHiddenStones(
            game,
            result.newBoardState,
            move,
            aiPlayerEnum,
            result.capturedStones,
            isCurrentMoveHidden
        );

        const capturedHiddenStones: { point: Point; player: Player }[] = [];
        for (const capturedStone of result.capturedStones) {
            let moveIndex = -1;
            for (let i = game.moveHistory.length - 1; i >= 0; i--) {
                const historyMove = game.moveHistory[i];
                if (historyMove.x === capturedStone.x && historyMove.y === capturedStone.y) {
                    moveIndex = i;
                    break;
                }
            }
            if (moveIndex !== -1 && game.hiddenMoves?.[moveIndex]) {
                const isPermanentlyRevealed = game.permanentlyRevealedStones?.some(
                    point => point.x === capturedStone.x && point.y === capturedStone.y
                );
                if (!isPermanentlyRevealed) {
                    capturedHiddenStones.push({ point: capturedStone, player: opponentPlayerEnum });
                }
            }
        }

        if (
            (game.isSinglePlayer ||
                (game as any).gameCategory === 'tower' ||
                (game as any).gameCategory === 'adventure') &&
            (game as any).aiInitialHiddenStone
        ) {
            const aiHidden = (game as any).aiInitialHiddenStone as Point;
            const isCaptured = result.capturedStones.some(stone => stone.x === aiHidden.x && stone.y === aiHidden.y);
            if (isCaptured) {
                const isPermanentlyRevealed = game.permanentlyRevealedStones?.some(
                    point => point.x === aiHidden.x && point.y === aiHidden.y
                );
                if (!isPermanentlyRevealed) {
                    capturedHiddenStones.push({ point: { x: aiHidden.x, y: aiHidden.y }, player: opponentPlayerEnum });
                }
            }
        }

        const allStonesToReveal = [...contributingHiddenStones, ...capturedHiddenStones];
        const uniqueStonesToReveal = Array.from(
            new Map(allStonesToReveal.map(item => [JSON.stringify(item.point), item])).values()
        );

        if (uniqueStonesToReveal.length > 0) {
            if (game.turnDeadline) {
                game.pausedTurnTimeLeft = (game.turnDeadline - now) / 1000;
                game.turnDeadline = undefined;
                game.turnStartTime = undefined;
            }

            game.boardState = result.newBoardState;
            game.gameStatus = 'hidden_reveal_animating';
            game.animation = {
                type: 'hidden_reveal',
                stones: uniqueStonesToReveal,
                startTime: now,
                duration: 2000
            };
            game.revealAnimationEndTime = now + 2000;
            game.pendingCapture = {
                stones: result.capturedStones,
                move: { player: aiPlayerEnum, x: move.x, y: move.y },
                hiddenContributors: contributingHiddenStones.map(item => item.point),
                capturedHiddenStones: capturedHiddenStones.map(item => item.point)
            };

            for (const stone of result.capturedStones) {
                game.boardState[stone.y][stone.x] = opponentPlayerEnum;
            }

            if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
            uniqueStonesToReveal.forEach(stone => {
                if (!game.permanentlyRevealedStones!.some(point => point.x === stone.point.x && point.y === stone.point.y)) {
                    game.permanentlyRevealedStones!.push(stone.point);
                }
            });

            return true;
        }
    }

    let clearAiInitialHiddenStone = false;
    const aiInitialHiddenStone = (game as any).aiInitialHiddenStone as Point | undefined;
    let guildWarCapturePointsThisMove = 0;

    for (const stone of result.capturedStones) {
        let moveIndex = -1;
        for (let i = game.moveHistory.length - 1; i >= 0; i--) {
            const historyMove = game.moveHistory[i];
            if (
                historyMove.x === stone.x &&
                historyMove.y === stone.y &&
                historyMove.player === opponentPlayerEnum
            ) {
                moveIndex = i;
                break;
            }
        }
        const wasHiddenMove = moveIndex !== -1 && !!game.hiddenMoves?.[moveIndex];
        const wasAiInitialHidden = !!aiInitialHiddenStone && aiInitialHiddenStone.x === stone.x && aiInitialHiddenStone.y === stone.y;

        let points = 1;
        let wasHidden = false;

        if (wasHiddenMove || wasAiInitialHidden) {
            points = 5;
            wasHidden = true;
            game.hiddenStoneCaptures[aiPlayerEnum] = (game.hiddenStoneCaptures[aiPlayerEnum] || 0) + 1;
            if (wasAiInitialHidden) {
                clearAiInitialHiddenStone = true;
            }
        } else {
            const isBaseStone = game.baseStones?.some((bs) => bs.x === stone.x && bs.y === stone.y);
            if (isBaseStone) {
                game.baseStoneCaptures[aiPlayerEnum]++;
                points = 5;
            } else if (consumeOpponentPatternStoneIfAny(game, stone, opponentPlayerEnum)) {
                points = 2;
            }
        }

        game.captures[aiPlayerEnum] += points;
        guildWarCapturePointsThisMove += points;
        game.justCaptured.push({ point: stone, player: opponentPlayerEnum, wasHidden, capturePoints: points });
        if (moveIndex !== -1 && game.hiddenMoves?.[moveIndex]) {
            delete game.hiddenMoves[moveIndex];
        }
    }

    bumpGuildWarMaxSingleCapturePointsForPlayer(game as any, aiPlayerEnum, guildWarCapturePointsThisMove);
    stripPatternStonesAtConsumedIntersections(game);

    if (clearAiInitialHiddenStone) {
        (game as any).aiInitialHiddenStone = undefined;
    }

    return false;
};

/**
 * 1단계~10단계 AI 봇 프로필 정의
 */
export const GO_AI_BOT_PROFILES: Record<number, GoAiBotProfile> = {
    1: {
        level: 1,
        name: '초급 AI (18급)',
        description: '초급단계의 18급 수준. 따내기에 집중하며 승리를 목표로 하는 AI',
        captureTendency: 0.95, // 따내기 성향 매우 강함
        territoryTendency: 0.2, // 영토 확보는 약함
        combatTendency: 0.8, // 전투 선호
        josekiUsage: 0.1, // 정석/포석 거의 사용 안함
        lifeDeathSkill: 0.2, // 사활 판단 약함
        movementSkill: 0.2, // 행마 능력 약함
        mistakeRate: 0.4, // 실수 많음
        winFocus: 0.95, // 승리에 집중
        calculationDepth: 1, // 1수 앞만 내다봄
        knowsBasicRules: true, // 1단계: 기본 규칙
        avoidsSelfAtari: false,
        knowsSacrificeAndCounter: false,
        knowsAtariJudgment: false,
        knowsDirectionalAttack: false,
        knowsFuseki: false,
        knowsTerritoryAndCombat: false,
        knowsAdvancedTechniques: false,
        knowsConnectionLifeDeathMovement: false,
        knowsEndgame: false,
    },
    2: {
        level: 2,
        name: '초급 AI (15급)',
        description: '초급단계의 15급 수준. 따내기를 선호하지만 기본적인 영토 개념 이해',
        captureTendency: 0.85,
        territoryTendency: 0.3,
        combatTendency: 0.7,
        josekiUsage: 0.15,
        lifeDeathSkill: 0.3,
        movementSkill: 0.3,
        mistakeRate: 0.35,
        winFocus: 0.9,
        calculationDepth: 2, // 2수 앞까지 내다봄
        knowsBasicRules: true,
        avoidsSelfAtari: true, // 2단계: 자충수 방지
        knowsSacrificeAndCounter: false,
        knowsAtariJudgment: false,
        knowsDirectionalAttack: false,
        knowsFuseki: false,
        knowsTerritoryAndCombat: false,
        knowsAdvancedTechniques: false,
        knowsConnectionLifeDeathMovement: false,
        knowsEndgame: false,
    },
    3: {
        level: 3,
        name: '초급 AI (12급)',
        description: '초급단계의 12급 수준. 따내기와 영토의 균형을 시작',
        captureTendency: 0.72,
        territoryTendency: 0.4,
        combatTendency: 0.6,
        josekiUsage: 0.2,
        lifeDeathSkill: 0.4,
        movementSkill: 0.4,
        mistakeRate: 0.3,
        winFocus: 0.85,
        calculationDepth: 3, // 3수 앞까지 내다봄
        knowsBasicRules: true,
        avoidsSelfAtari: true,
        knowsSacrificeAndCounter: true, // 3단계: 먹여치기 및 환격
        knowsAtariJudgment: false,
        knowsDirectionalAttack: false,
        knowsFuseki: false,
        knowsTerritoryAndCombat: false,
        knowsAdvancedTechniques: false,
        knowsConnectionLifeDeathMovement: false,
        knowsEndgame: false,
    },
    4: {
        level: 4,
        name: '중급 AI (9급)',
        description: '중급단계의 9급 수준. 기본적인 정석과 포석 이해',
        captureTendency: 0.62,
        territoryTendency: 0.5,
        combatTendency: 0.5,
        josekiUsage: 0.3,
        lifeDeathSkill: 0.5,
        movementSkill: 0.5,
        mistakeRate: 0.25,
        winFocus: 0.8,
        calculationDepth: 4, // 4수 앞까지 내다봄
        knowsBasicRules: true,
        avoidsSelfAtari: true,
        knowsSacrificeAndCounter: true,
        knowsAtariJudgment: true, // 4단계: 단수 상황 판단
        knowsDirectionalAttack: false,
        knowsFuseki: false,
        knowsTerritoryAndCombat: false,
        knowsAdvancedTechniques: false,
        knowsConnectionLifeDeathMovement: false,
        knowsEndgame: false,
    },
    5: {
        level: 5,
        name: '중급 AI (6급)',
        description: '중급단계의 6급 수준. 정석과 포석을 활용하며 전투 능력 향상',
        captureTendency: 0.7,
        territoryTendency: 0.5,
        combatTendency: 0.65,
        josekiUsage: 0.4,
        lifeDeathSkill: 0.6,
        movementSkill: 0.6,
        mistakeRate: 0.18,
        winFocus: 0.78,
        calculationDepth: 5, // 5수 앞까지 내다봄
        knowsBasicRules: true,
        avoidsSelfAtari: true,
        knowsSacrificeAndCounter: true,
        knowsAtariJudgment: true,
        knowsDirectionalAttack: true, // 5단계: 방향성 공격
        knowsFuseki: false,
        knowsTerritoryAndCombat: false,
        knowsAdvancedTechniques: false,
        knowsConnectionLifeDeathMovement: false,
        knowsEndgame: false,
    },
    6: {
        level: 6,
        name: '중급 AI (3급)',
        description: '중급단계의 3급 수준. 영토와 전투의 균형잡힌 플레이',
        captureTendency: 0.72,
        territoryTendency: 0.58,
        combatTendency: 0.7,
        josekiUsage: 0.5,
        lifeDeathSkill: 0.7,
        movementSkill: 0.7,
        mistakeRate: 0.12,
        winFocus: 0.75,
        calculationDepth: 6, // 6수 앞까지 내다봄
        knowsBasicRules: true,
        avoidsSelfAtari: true,
        knowsSacrificeAndCounter: true,
        knowsAtariJudgment: true,
        knowsDirectionalAttack: true,
        knowsFuseki: true, // 6단계: 초반 포석
        knowsTerritoryAndCombat: false,
        knowsAdvancedTechniques: false,
        knowsConnectionLifeDeathMovement: false,
        knowsEndgame: false,
    },
    7: {
        level: 7,
        name: '고급 AI (1단)',
        description: '고급단계의 1단 수준. 정석과 포석을 잘 활용하며 사활 판단 능력 향상',
        captureTendency: 0.8, // 공격적 따내기 선호
        territoryTendency: 0.55, // 영토보다 공격 우선
        combatTendency: 0.8, // 공격적인 전투
        josekiUsage: 0.55, // 정석 활용하되 공격 우선
        lifeDeathSkill: 0.75, // 사활 판단 정확
        movementSkill: 0.75, // 행마 능력 우수
        mistakeRate: 0.04, // 실수 적음
        winFocus: 0.7, // 승리에 집중
        calculationDepth: 7, // 7수 앞까지 내다봄
        knowsBasicRules: true,
        avoidsSelfAtari: true,
        knowsSacrificeAndCounter: true,
        knowsAtariJudgment: true,
        knowsDirectionalAttack: true,
        knowsFuseki: true,
        knowsTerritoryAndCombat: true, // 7단계: 영토 확보 및 전투
        knowsAdvancedTechniques: false,
        knowsConnectionLifeDeathMovement: false,
        knowsEndgame: false,
    },
    8: {
        level: 8,
        name: '고급 AI (2단)',
        description: '고급단계의 2단 수준. 우수한 행마와 정석 활용',
        captureTendency: 0.85, // 공격적 따내기 선호
        territoryTendency: 0.6, // 영토보다 공격 우선
        combatTendency: 0.85, // 공격적인 전투
        josekiUsage: 0.65, // 정석 활용하되 공격 우선
        lifeDeathSkill: 0.8, // 사활 판단 정확
        movementSkill: 0.8, // 행마 능력 우수
        mistakeRate: 0.03, // 실수 적음
        winFocus: 0.75, // 승리에 집중
        calculationDepth: 8, // 8수 앞까지 내다봄
        knowsBasicRules: true,
        avoidsSelfAtari: true,
        knowsSacrificeAndCounter: true,
        knowsAtariJudgment: true,
        knowsDirectionalAttack: true,
        knowsFuseki: true,
        knowsTerritoryAndCombat: true,
        knowsAdvancedTechniques: true, // 8단계: 고급 기술
        knowsConnectionLifeDeathMovement: false,
        knowsEndgame: false,
    },
    9: {
        level: 9,
        name: '유단자 AI (약 1단)',
        description: '유단자 수준의 약 1단. 전반적인 기술이 뛰어나며 정확한 판단',
        captureTendency: 0.9, // 공격적 따내기 선호
        territoryTendency: 0.6, // 영토보다 공격 우선
        combatTendency: 0.9, // 매우 공격적인 전투
        josekiUsage: 0.7, // 정석 활용하되 공격 우선
        lifeDeathSkill: 0.85, // 사활 판단 정확
        movementSkill: 0.85, // 행마 능력 우수
        mistakeRate: 0.015, // 실수 적음
        winFocus: 0.8, // 승리에 집중 (공격적)
        calculationDepth: 9, // 9수 앞까지 내다봄
        knowsBasicRules: true,
        avoidsSelfAtari: true,
        knowsSacrificeAndCounter: true,
        knowsAtariJudgment: true,
        knowsDirectionalAttack: true,
        knowsFuseki: true,
        knowsTerritoryAndCombat: true,
        knowsAdvancedTechniques: true,
        knowsConnectionLifeDeathMovement: true, // 9단계: 연결/끊음, 사활, 행마
        knowsEndgame: false,
    },
    10: {
        level: 10,
        name: '유단자 AI (4단)',
        description: '유단자 수준의 4단. 영토, 전투, 행마, 정석, 포석, 사활 등 전반적인 모든 기술이 뛰어남',
        captureTendency: 0.95, // 매우 적극적인 따내기 선호 (18급 수준으로 증가)
        territoryTendency: 0.6, // 영토보다 공격 우선
        combatTendency: 0.95, // 매우 공격적인 전투 능력
        josekiUsage: 0.7, // 정석/포석 활용하되 공격 우선
        lifeDeathSkill: 0.9, // 사활 판단 정확
        movementSkill: 0.9, // 행마 능력 우수
        mistakeRate: 0.01, // 실수 거의 없음
        winFocus: 0.85, // 승리에 집중 (공격적)
        calculationDepth: 10, // 10수 앞까지 내다봄
        knowsBasicRules: true,
        avoidsSelfAtari: true,
        knowsSacrificeAndCounter: true,
        knowsAtariJudgment: true,
        knowsDirectionalAttack: true,
        knowsFuseki: true,
        knowsTerritoryAndCombat: true,
        knowsAdvancedTechniques: true,
        knowsConnectionLifeDeathMovement: true,
        knowsEndgame: true, // 10단계: 마무리
    },
};

/**
 * AI 봇 단계에 맞는 프로필 가져오기
 */
export function getGoAiBotProfile(level: number): GoAiBotProfile {
    const profile = GO_AI_BOT_PROFILES[level];
    if (!profile) {
        console.warn(`[GoAiBot] Unknown AI level ${level}, using level 1 profile`);
        return GO_AI_BOT_PROFILES[1];
    }
    return profile;
}

/**
 * 바둑 AI 봇의 수를 두는 메인 함수
 * @param game 현재 게임 상태
 * @param aiLevel AI 봇 단계 (1~10)
 */
/** AI 대국에서 유저 히든을 AI에게 숨길지 여부 */
function shouldMaskUserHiddenFromAi(game: types.LiveGameSession): boolean {
    const isHiddenMode =
        game.mode === types.GameMode.Hidden ||
        (game.mode === types.GameMode.Mix && !!game.settings.mixedModes?.includes(types.GameMode.Hidden));
    if (!isHiddenMode) return false;

    const category = (game as any).gameCategory;
    const isSingleOrTower = game.isSinglePlayer || category === 'tower';
    /** 길드전 히든: 싱글/탑과 동일하게 유저 미공개 히든은 통과·빈칸으로만 인식 */
    const isGuildWarHiddenAi = category === 'guildwar' && !!game.isAiGame;
    // 전략바둑 AI 대국: 유저 히든을 AI가 모르게 처리 (유저가 통과한 것처럼 인식)
    const isStrategicAiGame =
        !!game.isAiGame &&
        !game.isSinglePlayer &&
        category !== 'tower' &&
        category !== 'singleplayer' &&
        category !== 'guildwar';

    return isSingleOrTower || isGuildWarHiddenAi || isStrategicAiGame;
}

/**
 * AI에게 전달할 수순: 유저의 히든 수는 통과(-1,-1)로 치환하여, AI가 히든 위치를 알 수 없도록 함
 */
function getMoveHistoryForAi(
    game: types.LiveGameSession,
    aiPlayerEnum: Player
): Array<{ x: number; y: number; player: number }> {
    const isHiddenMode =
        game.mode === types.GameMode.Hidden ||
        (game.mode === types.GameMode.Mix && !!game.settings.mixedModes?.includes(types.GameMode.Hidden));
    if (!isHiddenMode || !shouldMaskUserHiddenFromAi(game) || !game.moveHistory?.length) {
        return (game.moveHistory || []).map(m => ({ x: m.x, y: m.y, player: m.player }));
    }
    const userPlayerEnum = aiPlayerEnum === Player.White ? Player.Black : Player.White;
    return (game.moveHistory || []).map((m, moveIndex) => {
        const isHidden = game.hiddenMoves?.[moveIndex];
        const isUserHidden = isHidden && m.player === userPlayerEnum;
        const isRevealed = isUserHidden && game.permanentlyRevealedStones?.some(
            p => p.x === m.x && p.y === m.y
        );
        if (isUserHidden && !isRevealed) {
            return { x: -1, y: -1, player: m.player };
        }
        return { x: m.x, y: m.y, player: m.player };
    });
}

/**
 * KataServer 입력용 수순: 미공개 유저 히든이 남아 있을 때만 통로(-1,-1) 마스킹.
 * 전체 공개 후에는 실제 좌표 전체 + 현재 턴(생성 파라미터 player)으로 국면을 맞춰 재질의한다.
 */
function getMoveHistoryForKataServer(
    game: types.LiveGameSession,
    aiPlayerEnum: Player
): Array<{ x: number; y: number; player: number }> {
    const isHiddenMode =
        game.mode === types.GameMode.Hidden ||
        (game.mode === types.GameMode.Mix && !!game.settings.mixedModes?.includes(types.GameMode.Hidden));
    if (!isHiddenMode || !shouldMaskUserHiddenFromAi(game) || !game.moveHistory?.length) {
        return (game.moveHistory || []).map(m => ({ x: m.x, y: m.y, player: m.player }));
    }
    if (getUserUnrevealedHiddenPoints(game, aiPlayerEnum).length === 0) {
        return (game.moveHistory || []).map(m => ({ x: m.x, y: m.y, player: m.player }));
    }
    return getMoveHistoryForAi(game, aiPlayerEnum);
}

function oppositePlayerForKata(p: Player): Player {
    return p === Player.Black ? Player.White : Player.Black;
}

/** encode 접두 재생 후 다음 착수자가 wantToMove가 되도록 PASS를 덧붙인다. */
function appendPassesUntilSideToMove(
    moves: Array<{ x: number; y: number; player: Player }>,
    wantToMove: Player
): Array<{ x: number; y: number; player: Player }> {
    const out = [...moves];
    for (let i = 0; i < 4; i++) {
        const next = out.length === 0 ? Player.Black : oppositePlayerForKata(out[out.length - 1]!.player);
        if (next === wantToMove) return out;
        out.push({ x: -1, y: -1, player: next });
    }
    console.warn(
        `[buildKataMoveHistory] appendPassesUntilSideToMove: could not align to wantToMove=${wantToMove} (len=${moves.length})`,
    );
    return out;
}

function isMissileStrategicPve(game: types.LiveGameSession): boolean {
    const missileMode =
        game.mode === types.GameMode.Missile ||
        (game.mode === types.GameMode.Mix && !!game.settings.mixedModes?.includes(types.GameMode.Missile));
    if (!missileMode) return false;
    const cat = String((game as any).gameCategory ?? '');
    return game.isSinglePlayer || cat === 'tower' || cat === 'guildwar' || cat === 'adventure';
}

/**
 * 베이스 바둑은 시작 시 초기 베이스 돌이 moveHistory에 없어서
 * KataServer가 빈판으로 오인할 수 있다. 카타 입력용으로만 선행 수로 합쳐 전달한다.
 *
 * @param aiPlayerForKata 미사일 PVE 분기에서 {@link getBoardStateForAi}에 넘길 AI 색(보통 `makeGoAiBotMove`의 aiPlayerEnum).
 */
function buildKataMoveHistory(
    game: types.LiveGameSession,
    moveHistory: Array<{ x: number; y: number; player: number }>,
    aiPlayerForKata?: Player
): Array<{ x: number; y: number; player: number }> {
    const isBaseMode =
        game.mode === types.GameMode.Base ||
        (game.mode === types.GameMode.Mix && Boolean(game.settings.mixedModes?.includes(types.GameMode.Base)));
    if (isBaseMode) {
        const bs = game.settings?.boardSize ?? 19;
        const baseStones = (game.baseStones ?? []).filter(
            (s): s is { x: number; y: number; player: Player } =>
                !!s &&
                Number.isInteger(s.x) &&
                Number.isInteger(s.y) &&
                s.x >= 0 &&
                s.x < bs &&
                s.y >= 0 &&
                s.y < bs &&
                (s.player === Player.Black || s.player === Player.White)
        );
        if (baseStones.length === 0) return moveHistory;

        const occupied = new Set<string>();
        for (const m of moveHistory) {
            if (m.x >= 0 && m.y >= 0) occupied.add(`${m.x},${m.y}`);
        }

        const baseSetupMoves: Array<{ x: number; y: number; player: number }> = [];
        for (const s of baseStones) {
            const key = `${s.x},${s.y}`;
            if (occupied.has(key)) continue;
            baseSetupMoves.push({ x: s.x, y: s.y, player: s.player });
            occupied.add(key);
        }

        if (baseSetupMoves.length === 0) return moveHistory;
        return [...baseSetupMoves, ...moveHistory];
    }

    // 따내기·고정 포석 등: 선배치가 moveHistory에 없어 Kata가 빈 판으로만 재생하는 문제 방지
    // (도전의 탑·싱글·길드전·모험 등 moveHistory 없이 board만 깔리는 형태)
    const cat = (game as any).gameCategory;
    const needsKataBoardSetupPrefix =
        game.isSinglePlayer ||
        cat === 'tower' ||
        cat === 'guildwar' ||
        cat === 'adventure';
    if (!needsKataBoardSetupPrefix) return moveHistory;

    let setupMoves = (game as any).kataCaptureSetupMoves as
        | Array<{ x: number; y: number; player: number }>
        | undefined;
    let snap = (game as any).kataStrategicOpeningBoardState as types.BoardState | undefined;
    const bs = game.settings?.boardSize ?? 19;
    if (
        (!snap?.length || snap.length !== bs) &&
        String((game as any).gameCategory ?? '') === 'tower'
    ) {
        const backup = (game as any).kataTowerOpeningBoardBackup as types.BoardState | undefined;
        if (backup?.length === bs && backup.every((row) => Array.isArray(row) && row.length === bs)) {
            snap = backup;
            if (!(game as any).kataStrategicOpeningBoardState?.length) {
                (game as any).kataStrategicOpeningBoardState = cloneBoardStateForKataOpeningSnapshot(backup);
            }
        }
    }
    const snapOk =
        !!snap?.length &&
        snap.length === bs &&
        snap.every((row) => Array.isArray(row) && row.length === bs);

    // 스냅샷이 있으면 항상 여기서 재인코딩(구버전 연속 동색 접두 등으로 저장된 kataCaptureSetupMoves도 덮어씀).
    if (snapOk) {
        setupMoves = encodeBoardStateAsKataSetupMovesFromEmpty(snap);
        (game as any).kataCaptureSetupMoves = setupMoves;
    } else if (snap?.length) {
        console.warn(
            `[buildKataMoveHistory] kataStrategicOpeningBoardState size mismatch (snap=${snap?.length}, boardSize=${bs}) game=${game.id} — ignoring snapshot`,
        );
    } else if ((!Array.isArray(setupMoves) || setupMoves.length === 0) && moveHistory.length === 0 && game.boardState?.length) {
        setupMoves = encodeBoardStateAsKataSetupMovesFromEmpty(game.boardState);
        if (setupMoves.length > 0) {
            (game as any).kataCaptureSetupMoves = setupMoves;
            if (!(game as any).kataStrategicOpeningBoardState?.length) {
                (game as any).kataStrategicOpeningBoardState =
                    cloneBoardStateForKataOpeningSnapshot(game.boardState);
            }
        }
    }
    if (!setupMoves?.length) return moveHistory;

    // 미사일로 moveHistory의 과거 좌표만 바뀌면 오프닝 접두+수순 재생이 실제 판과 달라 Kata Illegal move가 난다.
    // 미사일 PVE: AI가 보는 판(getBoardStateForAi → 히든 마스킹 유지) 전체를 접두로만 보내고 차례는 PASS로 맞춘다.
    if (isMissileStrategicPve(game) && game.boardState?.length) {
        const aiEnum = aiPlayerForKata ?? game.currentPlayer;
        const boardForKata = getBoardStateForAi(game, aiEnum);
        const fromBoard = encodeBoardStateAsKataSetupMovesFromEmpty(boardForKata);
        if (fromBoard.length > 0) {
            const aligned = appendPassesUntilSideToMove(fromBoard, game.currentPlayer);
            if (process.env.NODE_ENV === 'development') {
                console.log(
                    `[buildKataMoveHistory] missile PVE: Kata prefix from AI-visible board (${fromBoard.length} stones + ${aligned.length - fromBoard.length} pass pad), game=${game.id}`,
                );
            }
            return aligned;
        }
    }

    return [...setupMoves, ...moveHistory];
}

/**
 * (x,y)가 유저의 미공개 히든 돌 위치인지 여부
 * 싱글플레이 히든바둑: AI가 해당 칸에 착수하지 않도록 판별용
 */
function isUserUnrevealedHiddenPosition(
    game: types.LiveGameSession,
    x: number,
    y: number,
    aiPlayerEnum: Player
): boolean {
    const isHiddenMode = game.mode === types.GameMode.Hidden ||
        (game.mode === types.GameMode.Mix && game.settings.mixedModes?.includes(types.GameMode.Hidden));
    if (!isHiddenMode || !shouldMaskUserHiddenFromAi(game) || !game.hiddenMoves || !game.moveHistory) return false;
    const userPlayerEnum = aiPlayerEnum === Player.White ? Player.Black : Player.White;
    for (let moveIndex = 0; moveIndex < game.moveHistory.length; moveIndex++) {
        if (!game.hiddenMoves[moveIndex]) continue;
        const move = game.moveHistory[moveIndex];
        if (!move || move.player !== userPlayerEnum || move.x !== x || move.y !== y) continue;
        const isRevealed = game.permanentlyRevealedStones?.some(p => p.x === x && p.y === y);
        return !isRevealed;
    }
    return false;
}

/**
 * 유저의 미공개 히든 돌 좌표 목록 (AI가 "유저 통과"로만 인식해야 하므로 해당 칸·인접 칸 착수 금지)
 */
/** 유저(또는 지정 플레이어)의 아직 permanently에 없는 히든 착점을 모두 완전 공개한다 */
function revealAllUnrevealedHiddensForPlayerEnum(game: types.LiveGameSession, playerEnum: Player) {
    if (!game.moveHistory || !game.hiddenMoves) return;
    if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
    for (let i = 0; i < game.moveHistory.length; i++) {
        if (!game.hiddenMoves[i]) continue;
        const m = game.moveHistory[i];
        if (!m || m.player !== playerEnum || m.x < 0 || m.y < 0) continue;
        if (!game.permanentlyRevealedStones.some(p => p.x === m.x && p.y === m.y)) {
            game.permanentlyRevealedStones.push({ x: m.x, y: m.y });
        }
    }
}

const USER_HIDDEN_FULL_REVEAL_MS = 2000;
/** AI 히든 아이템 "생각" 연출 길이 — 연출이 끝난 뒤에 Kata로 좌표를 정한다 */
const AI_HIDDEN_ITEM_THINKING_DURATION_MS = 6000;

/**
 * AI가 마스킹된 유저 히든을 찍어 전체 공개가 필요할 때: 영구 공개 + 전체공개 연출 후,
 * `hidden_reveal_animating` 종료 시 update*HiddenState에서 makeAiMove가 다시 호출되도록 플래그를 남긴다.
 */
function startUserHiddenFullRevealAnimationForAi(
    game: types.LiveGameSession,
    userPlayerEnum: Player,
    now: number
): boolean {
    if (!game.moveHistory || !game.hiddenMoves) return false;
    if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];

    const stones: { point: types.Point; player: Player }[] = [];
    for (let i = 0; i < game.moveHistory.length; i++) {
        if (!game.hiddenMoves[i]) continue;
        const m = game.moveHistory[i];
        if (!m || m.player !== userPlayerEnum || m.x < 0 || m.y < 0) continue;
        if (game.permanentlyRevealedStones.some(p => p.x === m.x && p.y === m.y)) continue;
        stones.push({ point: { x: m.x, y: m.y }, player: userPlayerEnum });
    }
    if (stones.length === 0) return false;

    for (const s of stones) {
        if (!game.permanentlyRevealedStones.some(p => p.x === s.point.x && p.y === s.point.y)) {
            game.permanentlyRevealedStones.push({ ...s.point });
        }
    }

    if (game.turnDeadline) {
        game.pausedTurnTimeLeft = (game.turnDeadline - now) / 1000;
        game.turnDeadline = undefined;
        game.turnStartTime = undefined;
    }

    bumpKataHiddenRevealCacheTag(game);
    game.gameStatus = 'hidden_reveal_animating';
    game.animation = {
        type: 'hidden_reveal',
        stones,
        startTime: now,
        duration: USER_HIDDEN_FULL_REVEAL_MS,
    };
    game.revealAnimationEndTime = now + USER_HIDDEN_FULL_REVEAL_MS;
    game.pendingCapture = null;
    (game as any).pendingAiMoveAfterUserHiddenFullReveal = true;

    return true;
}

function getUserUnrevealedHiddenPoints(
    game: types.LiveGameSession,
    aiPlayerEnum: Player
): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];
    const isHiddenMode = game.mode === types.GameMode.Hidden ||
        (game.mode === types.GameMode.Mix && game.settings.mixedModes?.includes(types.GameMode.Hidden));
    if (!isHiddenMode || !shouldMaskUserHiddenFromAi(game) || !game.hiddenMoves || !game.moveHistory) return points;
    const userPlayerEnum = aiPlayerEnum === Player.White ? Player.Black : Player.White;
    for (let moveIndex = 0; moveIndex < game.moveHistory.length; moveIndex++) {
        if (!game.hiddenMoves[moveIndex]) continue;
        const move = game.moveHistory[moveIndex];
        if (!move || move.player !== userPlayerEnum || move.x < 0 || move.y < 0) continue;
        const isRevealed = game.permanentlyRevealedStones?.some(p => p.x === move.x && p.y === move.y);
        if (!isRevealed) points.push({ x: move.x, y: move.y });
    }
    return points;
}

/**
 * (x,y)가 유저 미공개 히든 돌 위치이거나 그 인접 칸인지 (AI가 "유저 통과"로만 인식하므로 이 구역 착수 금지)
 */
function isOnOrAdjacentToUserUnrevealedHidden(
    game: types.LiveGameSession,
    x: number,
    y: number,
    aiPlayerEnum: Player
): boolean {
    if (isUserUnrevealedHiddenPosition(game, x, y, aiPlayerEnum)) return true;
    const hiddenPoints = getUserUnrevealedHiddenPoints(game, aiPlayerEnum);
    if (hiddenPoints.length === 0) return false;
    const boardSize = game.settings?.boardSize ?? 19;
    for (const p of hiddenPoints) {
        const dx = Math.abs(x - p.x);
        const dy = Math.abs(y - p.y);
        if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) return true;
    }
    return false;
}

function isAdventureAiHiddenGame(game: types.LiveGameSession): boolean {
    return (game as any).gameCategory === 'adventure';
}

/**
 * Kata·휴리스틱에서 유저 미공개 히든 근처를 피할 때 사용.
 * 로비/길드 등은 기존처럼 해당 돌과 4방 인접까지 금지.
 * 모험 히든은 그 제한이 과해 Kata 수가 전부 폴백되는 경우가 많아, **돌이 있는 칸**만 금지한다.
 */
function isInvalidAiHiddenNeighborhoodForKataAndHeuristic(
    game: types.LiveGameSession,
    x: number,
    y: number,
    aiPlayerEnum: Player
): boolean {
    if (isUserUnrevealedHiddenPosition(game, x, y, aiPlayerEnum)) return true;
    if (isAdventureAiHiddenGame(game)) return false;
    return isOnOrAdjacentToUserUnrevealedHidden(game, x, y, aiPlayerEnum);
}

/**
 * AI가 보드 상태를 볼 때 유저의 히든 돌을 빈 공간으로 처리하는 헬퍼 함수
 * 싱글플레이·도전의 탑·길드전 히든(인간 vs AI)에서 {@link shouldMaskUserHiddenFromAi}가 참일 때 적용
 */
function getBoardStateForAi(
    game: types.LiveGameSession,
    aiPlayerEnum: Player
): types.BoardState {
    const isHiddenMode = game.mode === types.GameMode.Hidden ||
        (game.mode === types.GameMode.Mix && game.settings.mixedModes?.includes(types.GameMode.Hidden));

    // 싱글플레이 또는 도전의 탑이 아니면 원본 반환 (AI가 유저 히든을 볼 수 없게 할 때만 마스킹)
    if (!isHiddenMode || !shouldMaskUserHiddenFromAi(game)) {
        return game.boardState;
    }
    
    // 싱글플레이에서 AI는 항상 White, 유저는 Black
    const userPlayerEnum = aiPlayerEnum === Player.White ? Player.Black : Player.White;
    
    // 보드 상태 복사
    const aiBoardState: types.BoardState = game.boardState.map(row => [...row]);
    
    // 유저의 히든 돌은 AI에게 비공개: 보드에서 빈 칸으로 보이게 함 (유저가 둔 히든 위치를 AI가 알 수 없음)
    if (game.hiddenMoves && game.moveHistory) {
        for (let moveIndex = 0; moveIndex < game.moveHistory.length; moveIndex++) {
            if (game.hiddenMoves[moveIndex]) {
                const move = game.moveHistory[moveIndex];
                if (move && move.player === userPlayerEnum) {
                    const { x, y } = move;
                    const isPermanentlyRevealed = game.permanentlyRevealedStones?.some(
                        p => p.x === x && p.y === y
                    );
                    if (!isPermanentlyRevealed && aiBoardState[y]?.[x] === userPlayerEnum) {
                        aiBoardState[y][x] = Player.None;
                    }
                }
            }
        }
    }
    
    return aiBoardState;
}

/** 싱글/탑/모험 등 로비가 아닌 PvE 전략바둑(따내기·계가 가중 등에 공통 사용) */
function isSinglePlayerOrTowerPve(game: types.LiveGameSession): boolean {
    const cat = (game as any).gameCategory as string | undefined;
    return (
        !!game.isSinglePlayer ||
        cat === 'tower' ||
        cat === types.GameCategory.Adventure
    );
}

/** 싱글/도전의 탑: 승패가 따내기 점수 기준 */
function isPveCaptureMode(game: types.LiveGameSession): boolean {
    return isSinglePlayerOrTowerPve(game) && game.mode === types.GameMode.Capture;
}

/** 싱글/도전의 탑: 계가(집)로 승패 */
function isPveScoringMode(game: types.LiveGameSession): boolean {
    return isSinglePlayerOrTowerPve(game) && game.mode !== types.GameMode.Capture;
}

/** 따낸 돌 가중치 (문양돌 반영) — stoneOwner는 따인 돌의 색 */
function weightedStonesCaptured(
    game: types.LiveGameSession,
    stoneOwner: Player,
    capturedStones: Point[]
): number {
    let w = 0;
    for (const stone of capturedStones) {
        const wasPattern =
            (stoneOwner === types.Player.Black &&
                game.blackPatternStones?.some((p) => p.x === stone.x && p.y === stone.y)) ||
            (stoneOwner === types.Player.White &&
                game.whitePatternStones?.some((p) => p.x === stone.x && p.y === stone.y));
        w += wasPattern ? 3 : 1;
    }
    return w;
}

/**
 * 상대(차례가 온 플레이어)가 한 수에 따낼 수 있는 최대 가중 따내기 (스냅백·큰 따내기 등 함정 회피용)
 */
function getMaxOpponentWeightedCaptureReply(
    game: types.LiveGameSession,
    boardState: types.BoardState,
    koInfo: types.LiveGameSession['koInfo'],
    moveHistoryLen: number,
    opponentPlayer: Player,
    aiPlayer: Player,
    logic: ReturnType<typeof getGoLogic>
): number {
    const simGame: types.LiveGameSession = {
        ...game,
        boardState,
        koInfo,
        currentPlayer: opponentPlayer,
    };
    const moves = findAllValidMoves(simGame, logic, opponentPlayer);
    let maxW = 0;
    for (const m of moves) {
        const r = processMove(
            boardState,
            { ...m, player: opponentPlayer },
            koInfo,
            moveHistoryLen,
            { ignoreSuicide: true }
        );
        if (!r.isValid || r.capturedStones.length === 0) continue;
        const w = weightedStonesCaptured(game, aiPlayer, r.capturedStones);
        if (w > maxW) maxW = w;
    }
    return maxW;
}

export async function makeGoAiBotMove(
    game: types.LiveGameSession,
    aiLevel: number
): Promise<void> {
    // 히든 돌 공개 애니메이션 중이면 AI 수를 두지 않음
    if (game.gameStatus === 'hidden_reveal_animating') {
        return;
    }
    
    // 아이템 사용 모드에서는 AI 수를 두지 않음 (사용자가 아이템을 사용 중)
    if (
        game.gameStatus === 'hidden_placing' ||
        game.gameStatus === 'scanning' ||
        game.gameStatus === 'scanning_animating' ||
        game.gameStatus === 'missile_selecting'
    ) {
        return;
    }
    
    // 일시정지 상태일 때는 AI 수를 두지 않음
    const isManuallyPaused = game.isAiGame && game.pausedTurnTimeLeft !== undefined && !game.turnDeadline && !game.itemUseDeadline;
    if (isManuallyPaused) {
        console.log(`[makeGoAiBotMove] Game ${game.id} is manually paused, skipping AI move`);
        return;
    }
    
    const aiPlayerEnum = game.currentPlayer;
    const opponentPlayerEnum = aiPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;
    const now = Date.now();

    reconcileStrategicAiBoardSizeWithGroundTruth(game);

    rehydratePendingAiHiddenKataFromStoredAnimation(game);

    const isHiddenMode = game.mode === types.GameMode.Hidden ||
        (game.mode === types.GameMode.Mix && game.settings.mixedModes?.includes(types.GameMode.Hidden));
    const totalTurns = (game.moveHistory || []).filter(m => m.x !== -1 && m.y !== -1).length;
    const isStrategicAiGame =
        game.isAiGame &&
        !game.isSinglePlayer &&
        (game as any).gameCategory !== 'tower' &&
        (game as any).gameCategory !== 'singleplayer';
    const aiHiddenKey = getStrategicAiHiddenStonesKey(game, aiPlayerEnum);
    if (isHiddenMode && isStrategicAiGame && (game as any)[aiHiddenKey] === undefined) {
        const cap = (game.settings as any)?.hiddenStoneCount ?? 0;
        if (cap > 0) {
            (game as any)[aiHiddenKey] = cap;
        }
    }
    let aiHiddenLeft = (game as any)[aiHiddenKey] ?? 0;
    let shouldApplyHiddenOnThisMove = !!(game as any).pendingAiHiddenPlacement;

    // AI 히든 아이템 연출 진행 중에는 실제 착수를 하지 않고 대기한다.
    if (game.aiHiddenItemAnimationEndTime != null && now < game.aiHiddenItemAnimationEndTime) {
        return;
    }

    try {
    // AI 히든 아이템 연출 종료 후 실제 히든 수 두기
    if (game.aiHiddenItemAnimationEndTime != null && now >= game.aiHiddenItemAnimationEndTime) {
        const wasAiThinkingHiddenReveal =
            (game.animation as { type?: string } | null | undefined)?.type === 'ai_thinking';
        game.aiHiddenItemAnimationEndTime = undefined;
        // 6초 만료 직후에도 클라·전광판에 연출 유지 → Kata 히든 착수 반영 뒤 finally에서 animation 정리
        // 연출 종료 후 "다음 착수는 히든으로 처리" 플래그를 영속 저장한다.
        // aiHiddenLeft만 보면 클라 동기화·좌석 키 불일치로 0이 되어 일반돌로 두는 경우가 있어,
        // 방금 끝난 연출이 ai_thinking(히든 아이템)이면 남은 개수와 무관하게 히든 착수로 간다.
        (game as any).pendingAiHiddenPlacement = Boolean(
            isHiddenMode && (aiHiddenLeft > 0 || wasAiThinkingHiddenReveal)
        );
        shouldApplyHiddenOnThisMove = !!(game as any).pendingAiHiddenPlacement;
    }

    // 방어 로직: AI 착수 계산 시점에는 항상 본경기 상태로 정규화한다.
    // (stale hidden_placing/scanning 잔류로 유저 턴 스캔 비활성·히든 오인 착수 방지)
    const statusForRecovery = String(game.gameStatus || '');
    if (statusForRecovery === 'hidden_placing' || statusForRecovery === 'scanning') {
        game.gameStatus = 'playing';
        game.itemUseDeadline = undefined;
        game.pausedTurnTimeLeft = undefined;
    }

    // 전략바둑 AI 히든 모드: AI 좌석의 hidden_stones_px / aiHiddenItemTurn 미설정 시 초기화
    if (isHiddenMode && isStrategicAiGame) {
        const cap = (game.settings as any)?.hiddenStoneCount ?? 0;
        if (cap > 0 && (game as any)[aiHiddenKey] === undefined) {
            (game as any)[aiHiddenKey] = cap;
            aiHiddenLeft = cap;
        }
        planStrategicAiHiddenTurns(game, (game as any)[aiHiddenKey] ?? aiHiddenLeft);
    }

    // AI 히든 아이템 사용 연출 시작 (실제 수는 다음 호출에서 히든으로 둠)
    aiHiddenLeft = (game as any)[aiHiddenKey] ?? aiHiddenLeft;
    const plannedAiHiddenTurns = isStrategicAiGame ? planStrategicAiHiddenTurns(game, aiHiddenLeft) : [];
    const usedAiHiddenItems = Math.max(0, Number((game as any).aiHiddenItemsUsedCount ?? 0));
    const currentAiTurnIndex = getCurrentAiTurnIndex(game, aiPlayerEnum);
    const nextPlannedAiHiddenTurn = plannedAiHiddenTurns[usedAiHiddenItems];
    const shouldUseStrategicAiHiddenItem = isStrategicAiGame && nextPlannedAiHiddenTurn === currentAiTurnIndex;

    if (!isKataServerAvailable()) {
        throw new Error(
            `[makeGoAiBotMove] KataServer를 사용할 수 없습니다(KATA_SERVER_URL 미설정). game=${game.id}`
        );
    }

    const goAiProfileLevel = Math.max(1, Math.min(10, aiLevel));
    const DIFFICULTY_TO_KATA_LEVEL = KATA_SERVER_LEVEL_BY_PROFILE_STEP;
    const configuredKataLevelRaw = Number((game.settings as any)?.kataServerLevel);
    let configuredKataLevel = Number.isFinite(configuredKataLevelRaw) ? configuredKataLevelRaw : undefined;
    // 도전의 탑·모험·길드전: DB/캐시·병합 등으로 settings.kataServerLevel만 빠지면 프로필 폴백으로 떨어져 체감이 달라짐 → 카테고리별 표로 복구.
    if (configuredKataLevel === undefined) {
        const gc = String((game as any).gameCategory ?? '');
        if (gc === 'tower') {
            const floorRaw = (game as any).towerFloor;
            const floor = typeof floorRaw === 'number' ? floorRaw : parseInt(String(floorRaw ?? ''), 10);
            if (Number.isFinite(floor) && floor >= 1) {
                configuredKataLevel = getTowerKataServerLevelByFloor(floor);
            }
        } else if (gc === 'adventure') {
            const lvRaw = (game as any).adventureMonsterLevel;
            const lv = typeof lvRaw === 'number' ? lvRaw : parseInt(String(lvRaw ?? ''), 10);
            if (Number.isFinite(lv) && lv >= 1) {
                configuredKataLevel = adventureMonsterLevelToKataServerLevel(lv);
            }
        } else if (gc === 'guildwar') {
            const boardId = String((game as any).guildWarBoardId ?? '');
            if (boardId) {
                configuredKataLevel = getGuildWarKataServerLevelByBoardId(boardId);
            }
        }
        if (configuredKataLevel !== undefined && game.settings && typeof game.settings === 'object') {
            (game.settings as any).kataServerLevel = configuredKataLevel;
        }
    }
    const resolvedKataLevel = configuredKataLevel ?? (DIFFICULTY_TO_KATA_LEVEL[goAiProfileLevel] ?? -12);
    if (process.env.NODE_ENV === 'development') {
        console.log(
            `[makeGoAiBotMove] game=${game.id} category=${(game as any).gameCategory ?? 'normal'} stage=${(game as any).stageId ?? '-'} floor=${(game as any).towerFloor ?? '-'} profileStep=${goAiProfileLevel} configuredKata=${configuredKataLevel ?? 'none'} resolvedKata=${resolvedKataLevel}`
        );
    }

    // 6초 연출만 시작하고 Kata는 호출하지 않는다. 만료 후 다음 makeGoAiBotMove 틱에서 Kata로 수를 정해 히든으로 둔다.
    if (
        isHiddenMode &&
        !shouldApplyHiddenOnThisMove &&
        (shouldUseStrategicAiHiddenItem ||
            (!game.aiHiddenItemUsed && game.aiHiddenItemTurn != null && totalTurns >= game.aiHiddenItemTurn))
    ) {
        const appliesToAi = game.isSinglePlayer || (game as any).gameCategory === 'tower' || isStrategicAiGame;
        if (aiHiddenLeft > 0 && appliesToAi) {
            (game as any).pendingAiHiddenPlacement = false;
            pendingAiHiddenKataMoveByGameId.delete(hiddenKataCacheKey(game.id));

            if (isStrategicAiGame) {
                (game as any).aiHiddenItemsUsedCount = usedAiHiddenItems + 1;
            }
            game.aiHiddenItemUsed = true;
            const aiPlayerId = aiPlayerEnum === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
            const hiddenNoticeMsg =
                (game as any).gameCategory === 'adventure'
                    ? '몬스터가 히든 아이템을 사용했습니다!'
                    : 'AI봇이 히든 아이템을 사용했습니다!';
            game.foulInfo = { message: hiddenNoticeMsg, expiry: now + AI_HIDDEN_ITEM_THINKING_DURATION_MS };
            game.animation = {
                type: 'ai_thinking',
                startTime: now,
                duration: AI_HIDDEN_ITEM_THINKING_DURATION_MS,
                playerId: aiPlayerId,
            };
            game.aiHiddenItemAnimationEndTime = now + AI_HIDDEN_ITEM_THINKING_DURATION_MS;
            await db.saveGame(game);
            const { broadcastToGameParticipants } = await import('./socket.js');
            const gameToBroadcast = { ...game };
            delete (gameToBroadcast as any).boardState;
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToBroadcast } }, game);
            return;
        }
    }

    // 전략바둑 턴 제한: 제한 수순에 도달한 국면에서는 AI가 수를 두지 않고 즉시 계가(모험/로비/길드전 동일,정확히 N수에서 종료)
    const scoringTurnLimit = (game.settings as any)?.scoringTurnLimit;
    if (
        scoringTurnLimit != null &&
        scoringTurnLimit > 0 &&
        game.mode !== types.GameMode.Capture &&
        !game.isSinglePlayer &&
        (game as any).gameCategory !== 'tower'
    ) {
        // scoringTurnLimit 기준 "턴"은 PASS(-1,-1)도 포함해서 카운트한다.
        const totalTurnsSoFar = (game.moveHistory || []).length;
        if (totalTurnsSoFar >= scoringTurnLimit) {
            console.log(
                `[makeGoAiBotMove] Game ${game.id} at or over scoringTurnLimit (${totalTurnsSoFar} >= ${scoringTurnLimit}), triggering getGameResult without making a move`,
            );
            if (isLobbyAiStrategicGoGame(game)) {
                await broadcastPlayingSnapshotBeforeScoring(game);
            }
            game.gameStatus = 'scoring';
            game.totalTurns = totalTurnsSoFar;
            await db.saveGame(game);
            const { broadcastToGameParticipants } = await import('./socket.js');
            const gameToBroadcast = { ...game };
            delete (gameToBroadcast as any).boardState;
            broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToBroadcast } }, game);
            const { getGameResult } = await import('./gameModes.js');
            try {
                await getGameResult(game);
            } catch (e: any) {
                console.error(`[makeGoAiBotMove] getGameResult failed for game ${game.id}:`, e?.message);
            }
            return;
        }
    }
    
    let selectedMove: Point | null = null;

    const cachedHiddenKata = pendingAiHiddenKataMoveByGameId.get(hiddenKataCacheKey(game.id));
    if (
        shouldApplyHiddenOnThisMove &&
        cachedHiddenKata &&
        Number.isInteger(cachedHiddenKata.x) &&
        Number.isInteger(cachedHiddenKata.y) &&
        !(cachedHiddenKata.x === -1 && cachedHiddenKata.y === -1)
    ) {
        // 구버전 세이브/재주입으로 캐시된 좌표만 우선(검증 실패 시에도 Kata 좌표 유지 → 아래 processMove에서 처리). PASS(-1,-1)는 Kata 실패와 동일 취급·캐시 미사용.
        selectedMove = { x: cachedHiddenKata.x, y: cachedHiddenKata.y };
    }

    const userPlayerEnumForHidden = aiPlayerEnum === types.Player.White ? types.Player.Black : types.Player.White;
    if (!selectedMove) {
        const kataLevel = resolvedKataLevel;
        const rawMoveHistory = getMoveHistoryForKataServer(game, aiPlayerEnum);
        const moveHistory = buildKataMoveHistory(game, rawMoveHistory, aiPlayerEnum);

        const kataParamsBase = {
            boardSize: game.settings.boardSize || 19,
            player: (aiPlayerEnum === types.Player.White ? 'white' : 'black') as 'white' | 'black',
            moveHistory,
            level: kataLevel,
            komi: game.settings.komi,
            gameId: game.id,
            kataSessionTag: composeKataSessionTagForGame(game, undefined),
        };
        const kataCandidates = await generateKataServerMoveCandidates(kataParamsBase);

        if (
            kataCandidates.length === 0 ||
            (kataCandidates.length === 1 &&
                kataCandidates[0]!.x === -1 &&
                kataCandidates[0]!.y === -1)
        ) {
            throw new Error(
                `[makeGoAiBotMove] KataServerMoveCandidates returned empty or PASS-only (unexpected after kataServerService hardening); game=${game.id}`,
            );
        }

        let pickedFromKata: Point | null = null;
        for (const cand of kataCandidates) {
            if (cand.x === -1 && cand.y === -1) continue;
            const trial = processMove(
                game.boardState,
                { ...cand, player: aiPlayerEnum },
                game.koInfo,
                game.moveHistory.length
            );
            if (trial.isValid) {
                pickedFromKata = cand;
                break;
            }
            // Kata는 마스킹 수순으로 빈 칸으로 본 착점이, 실제 판에서는 유저 미공개 히든 → 아래 isTargetHiddenOpponentStone과 동일하게 공개 연출로 처리
            if (isHiddenMode && shouldMaskUserHiddenFromAi(game)) {
                const stoneAt = game.boardState[cand.y]?.[cand.x];
                const moveIndexAtTarget = game.moveHistory.findIndex(m => m.x === cand.x && m.y === cand.y);
                if (
                    stoneAt === opponentPlayerEnum &&
                    moveIndexAtTarget !== -1 &&
                    game.hiddenMoves?.[moveIndexAtTarget] &&
                    !game.permanentlyRevealedStones?.some(p => p.x === cand.x && p.y === cand.y)
                ) {
                    pickedFromKata = cand;
                    break;
                }
            }
            console.warn(
                `[makeGoAiBotMove] Kata candidate (${cand.x},${cand.y}) invalid on server board; trying next, game=${game.id}`
            );
        }

        if (!pickedFromKata) {
            const logicFb = getGoLogic(game);
            let legalFb = findAllValidMoves(game, logicFb, aiPlayerEnum);
            if (
                getUserUnrevealedHiddenPoints(game, aiPlayerEnum).length > 0 &&
                legalFb.length > 0
            ) {
                legalFb = legalFb.filter(
                    m => !isInvalidAiHiddenNeighborhoodForKataAndHeuristic(game, m.x, m.y, aiPlayerEnum)
                );
            }
            if (legalFb.length === 0) {
                console.warn(`[makeGoAiBotMove] no legal move after invalid Kata coords → resign, game=${game.id}`);
                await summaryService.endGame(game, opponentPlayerEnum, 'resign');
                return;
            }
            pickedFromKata = legalFb[0]!;
            console.warn(
                `[makeGoAiBotMove] all Kata coords invalid; using first legal (${pickedFromKata.x},${pickedFromKata.y}), game=${game.id}`
            );
        }

        selectedMove = { x: pickedFromKata.x, y: pickedFromKata.y };
        console.log(
            `[makeGoAiBotMove] KataServer 수 적용 game=${game.id} level=${kataLevel} (${pickedFromKata.x},${pickedFromKata.y})`
        );
    }

    if (!selectedMove) {
        throw new Error(`[makeGoAiBotMove] KataServer에서 수를 얻지 못했습니다. game=${game.id}`);
    }

    // 히든 규칙: 유저의 미공개 히든 돌 위에 착점 시 공개 애니메이션 후 Kata 재질의.
    if (isHiddenMode && shouldMaskUserHiddenFromAi(game)) {
        const { x, y } = selectedMove;
        const stoneAtTarget = game.boardState[y][x];
        const moveIndexAtTarget = game.moveHistory.findIndex(m => m.x === x && m.y === y);
        const isTargetHiddenOpponentStone =
            stoneAtTarget === opponentPlayerEnum &&
            moveIndexAtTarget !== -1 &&
            game.hiddenMoves?.[moveIndexAtTarget] &&
            !game.permanentlyRevealedStones?.some(p => p.x === x && p.y === y);

        if (isTargetHiddenOpponentStone) {
            if (shouldApplyHiddenOnThisMove) {
                pendingAiHiddenKataMoveByGameId.delete(hiddenKataCacheKey(game.id));
            }
            if (startUserHiddenFullRevealAnimationForAi(game, opponentPlayerEnum, now)) {
                console.warn(
                    `[makeGoAiBotMove] Kata chose (${x},${y}) on unrevealed user hidden — full reveal animation then AI move (game=${game.id})`
                );
                await db.saveGame(game);
                return;
            }
            revealAllUnrevealedHiddensForPlayerEnum(game, opponentPlayerEnum);
            console.warn(
                `[makeGoAiBotMove] Kata chose (${x},${y}) on unrevealed user hidden — full reveal (no animation) & same-turn Kata re-query (game=${game.id})`
            );
            const kataLevel = resolvedKataLevel;
            const rawMoveHistory = getMoveHistoryForKataServer(game, aiPlayerEnum);
            const moveHistory = buildKataMoveHistory(game, rawMoveHistory, aiPlayerEnum);
            const hiddenRevealTag = bumpKataHiddenRevealCacheTag(game);
            const kataParamsReveal = {
                boardSize: game.settings.boardSize || 19,
                player: (aiPlayerEnum === types.Player.White ? 'white' : 'black') as 'white' | 'black',
                moveHistory,
                level: kataLevel,
                komi: game.settings.komi,
                gameId: game.id,
                kataSessionTag: composeKataSessionTagForGame(game, hiddenRevealTag),
            };
            const kataCandidatesReveal = await generateKataServerMoveCandidates(kataParamsReveal);

            if (
                kataCandidatesReveal.length === 0 ||
                (kataCandidatesReveal.length === 1 &&
                    kataCandidatesReveal[0]!.x === -1 &&
                    kataCandidatesReveal[0]!.y === -1)
            ) {
                throw new Error(
                    `[makeGoAiBotMove] Kata re-query returned empty or PASS-only (unexpected); game=${game.id}`,
                );
            }

            let pickedReveal: Point | null = null;
            for (const cand of kataCandidatesReveal) {
                if (cand.x === -1 && cand.y === -1) continue;
                const trial = processMove(
                    game.boardState,
                    { ...cand, player: aiPlayerEnum },
                    game.koInfo,
                    game.moveHistory.length
                );
                if (trial.isValid) {
                    pickedReveal = cand;
                    break;
                }
                console.warn(
                    `[makeGoAiBotMove] Kata re-query candidate (${cand.x},${cand.y}) invalid; trying next, game=${game.id}`
                );
            }
            if (!pickedReveal) {
                const logicFb = getGoLogic(game);
                let legalFb = findAllValidMoves(game, logicFb, aiPlayerEnum);
                if (
                    getUserUnrevealedHiddenPoints(game, aiPlayerEnum).length > 0 &&
                    legalFb.length > 0
                ) {
                    legalFb = legalFb.filter(
                        m => !isInvalidAiHiddenNeighborhoodForKataAndHeuristic(game, m.x, m.y, aiPlayerEnum)
                    );
                }
                if (legalFb.length === 0) {
                    await summaryService.endGame(game, opponentPlayerEnum, 'resign');
                    return;
                }
                pickedReveal = legalFb[0]!;
                console.warn(
                    `[makeGoAiBotMove] Kata re-query all coords invalid; legal (${pickedReveal.x},${pickedReveal.y}), game=${game.id}`
                );
            }
            selectedMove = { x: pickedReveal.x, y: pickedReveal.y };
        }
    }

    // 선택된 수 실행 (실제 보드 상태 사용)
    let result = processMove(
        game.boardState, // 실제 보드 상태 사용 (히든 돌 포함)
        { ...selectedMove, player: aiPlayerEnum },
        game.koInfo,
        game.moveHistory.length
    );
    if (!result.isValid) {
        if (shouldApplyHiddenOnThisMove) {
            pendingAiHiddenKataMoveByGameId.delete(hiddenKataCacheKey(game.id));
        }
        if (
            isHiddenMode &&
            shouldMaskUserHiddenFromAi(game) &&
            isUserUnrevealedHiddenPosition(game, selectedMove.x, selectedMove.y, aiPlayerEnum)
        ) {
            if (startUserHiddenFullRevealAnimationForAi(game, userPlayerEnumForHidden, now)) {
                console.warn(
                    `[makeGoAiBotMove] processMove invalid at (${selectedMove.x},${selectedMove.y}) on unrevealed user hidden — full reveal animation then AI move (game=${game.id})`
                );
                await db.saveGame(game);
                return;
            }
            revealAllUnrevealedHiddensForPlayerEnum(game, userPlayerEnumForHidden);
            console.warn(
                `[makeGoAiBotMove] processMove invalid at (${selectedMove.x},${selectedMove.y}) on unrevealed user hidden — forced full reveal, retry next AI tick (game=${game.id})`
            );
            await db.saveGame(game);
            return;
        }
        const logicEmergency = getGoLogic(game);
        let legalEmergency = findAllValidMoves(game, logicEmergency, aiPlayerEnum);
        if (
            getUserUnrevealedHiddenPoints(game, aiPlayerEnum).length > 0 &&
            legalEmergency.length > 0
        ) {
            legalEmergency = legalEmergency.filter(
                m => !isInvalidAiHiddenNeighborhoodForKataAndHeuristic(game, m.x, m.y, aiPlayerEnum)
            );
        }
        if (legalEmergency.length > 0) {
            const fb = legalEmergency[0]!;
            const retry = processMove(
                game.boardState,
                { ...fb, player: aiPlayerEnum },
                game.koInfo,
                game.moveHistory.length
            );
            if (retry.isValid) {
                console.warn(
                    `[makeGoAiBotMove] invalid Kata/hidden coord (${selectedMove.x},${selectedMove.y}); emergency legal (${fb.x},${fb.y}), game=${game.id}`
                );
                selectedMove = fb;
                result = retry;
            }
        }
        if (!result.isValid) {
            throw new Error(
                `[makeGoAiBotMove] Kata가 고른 수가 규칙상 무효입니다 (${selectedMove.x},${selectedMove.y}). game=${game.id}`
            );
        }
    }

    // 5. 최종 수 적용
    game.boardState = result.newBoardState;
    game.lastMove = { x: selectedMove.x, y: selectedMove.y };
    game.moveHistory.push({ player: aiPlayerEnum, x: selectedMove.x, y: selectedMove.y });
    if (shouldApplyHiddenOnThisMove) {
        if (!game.hiddenMoves) game.hiddenMoves = {};
        game.hiddenMoves[game.moveHistory.length - 1] = true;
        if (aiHiddenLeft > 0) {
            (game as any)[aiHiddenKey] = aiHiddenLeft - 1;
            aiHiddenLeft -= 1;
        }
        // AI 히든 착수 직후 클라이언트/서버가 동일 좌표를 즉시 참조할 수 있도록 공통 표식 유지.
        // (전략 AI 대국에서도 스캔 활성 조건의 폴백으로 사용)
        (game as any).aiInitialHiddenStone = { x: selectedMove.x, y: selectedMove.y };
        (game as any).aiInitialHiddenStoneIsPrePlaced = false;
        (game as any).pendingAiHiddenPlacement = false;
        pendingAiHiddenKataMoveByGameId.delete(hiddenKataCacheKey(game.id));
    }
    game.koInfo = result.newKoInfo;
    game.passCount = 0;
    game.gameStatus = 'playing';
    game.itemUseDeadline = undefined;
    game.pausedTurnTimeLeft = undefined;
    
    // 싱글플레이 턴 카운팅 업데이트 (AI가 수를 둘 때도 카운팅)
    // 히든돌이 moveHistory에 추가되지 않은 경우를 고려하여 실제 유효한 수만 카운팅
    if (game.isSinglePlayer && game.stageId) {
        const validMoves = game.moveHistory.filter(m => m.x !== -1 && m.y !== -1);
        game.totalTurns = validMoves.length;
    }

    // 6. 따낸 돌 처리 및 히든 돌 공개 처리 (이전 턴 justCaptured 잔류로 클라 점수 플로트가 꼬이지 않게 비움)
    game.justCaptured = [];
    const startedRevealAnimation = applyAiCaptureOutcome(
        game,
        result,
        selectedMove,
        aiPlayerEnum,
        opponentPlayerEnum,
        !!isHiddenMode,
        shouldApplyHiddenOnThisMove,
        now
    );
    if (startedRevealAnimation) {
        await db.saveGame(game);
        return; // 애니메이션 종료 후 updateHiddenState에서 처리
    }

    // 7. 살리기 바둑 모드에서 승리 조건 확인
    const isSurvivalModeCheck = (game.settings as any)?.isSurvivalMode === true;
    if (isSurvivalModeCheck && aiPlayerEnum === Player.White) {
        // 백(AI)의 턴 수 증가 (백이 한 수를 둘 때마다)
        const whiteTurnsPlayed = ((game as any).whiteTurnsPlayed || 0) + 1;
        (game as any).whiteTurnsPlayed = whiteTurnsPlayed;
        const survivalTurns = (game.settings as any)?.survivalTurns || 0;
        
        console.log(`[Survival Go] White move completed - turns: ${whiteTurnsPlayed}/${survivalTurns}, gameStatus: ${game.gameStatus}, isSurvivalMode: ${isSurvivalModeCheck}`);
        
        if (survivalTurns > 0 && game.gameStatus === 'playing') {
            // 백이 목표점수를 달성했는지 먼저 체크 (목표 달성 시 백 승리)
            const target = getCaptureTarget(game, Player.White);
            if (target !== undefined && target !== NO_CAPTURE_TARGET && game.captures[Player.White] >= target) {
                console.log(`[Survival Go] White reached target score after AI move (${target}), White wins`);
                await summaryService.endGame(game, Player.White, 'capture_limit');
                return;
            }
            
            // 백의 남은 턴이 0이 되면 흑 승리 (백이 목표점수를 달성하지 못함)
            // 백의 남은 턴 = survivalTurns - whiteTurnsPlayed
            // 백의 남은 턴이 0이 되었다는 것은 whiteTurnsPlayed >= survivalTurns
            const remainingTurns = survivalTurns - whiteTurnsPlayed;
            console.log(`[Survival Go] After White move - turns: ${whiteTurnsPlayed}/${survivalTurns}, remaining: ${remainingTurns}, gameStatus: ${game.gameStatus}`);
            if (remainingTurns <= 0) {
                console.log(`[Survival Go] White ran out of turns after AI move (${whiteTurnsPlayed}/${survivalTurns}), Black wins - ENDING GAME NOW`);
                await summaryService.endGame(game, Player.Black, 'capture_limit');
                return;
            }
        }
    } else {
        // 일반 따내기 바둑 모드에서 승리 조건 확인
        if (game.isSinglePlayer || game.mode === types.GameMode.Capture) {
            const target = getCaptureTarget(game, aiPlayerEnum);
            if (target !== undefined && target !== NO_CAPTURE_TARGET && game.captures[aiPlayerEnum] >= target) {
                await summaryService.endGame(game, aiPlayerEnum, 'capture_limit');
                return;
            }
        }
    }

    // 8. 시간 업데이트 및 턴 종료
    const aiPlayerTimeKey = aiPlayerEnum === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
    if (game.turnDeadline) {
        const timeRemaining = Math.max(0, (game.turnDeadline - now) / 1000);
        game[aiPlayerTimeKey] = timeRemaining;
    }

    // 싱글플레이/AI봇 대결 자동 계가 트리거 체크 (AI가 수를 둔 후)
    // hidden_placing, scanning 등 아이템 모드에서는 자동계가 체크를 하지 않음
    const isItemMode = ['hidden_placing', 'scanning', 'missile_selecting', 'missile_animating', 'scanning_animating'].includes(game.gameStatus);
    
    if (!isItemMode) {
        const scoringLimit = (game.settings as any)?.scoringTurnLimit;
        const useScoringLimitAsAuto =
            game.mode !== types.GameMode.Capture && scoringLimit != null && scoringLimit > 0;
        const autoScoringTurns = game.isSinglePlayer && game.stageId
            ? (await import('../constants/singlePlayerConstants.js')).SINGLE_PLAYER_STAGES.find(s => s.id === game.stageId)?.autoScoringTurns
            : (game as any).gameCategory === 'tower'
                ? (game.settings as any)?.autoScoringTurns
                : (useScoringLimitAsAuto ? scoringLimit : undefined);
        
        if (autoScoringTurns !== undefined || (game.isSinglePlayer && game.stageId)) {
            // scoringTurnLimit 기준 "턴"은 PASS(-1,-1)도 포함해서 카운트한다.
            const countPassAsTurn =
                (scoringLimit != null && scoringLimit > 0 && !game.isSinglePlayer && (game as any).gameCategory !== 'tower');
            const validMoves = game.moveHistory.filter(m => m.x !== -1 && m.y !== -1);
            const totalTurns = countPassAsTurn ? game.moveHistory.length : validMoves.length;
            game.totalTurns = totalTurns;
        
        if (autoScoringTurns) {
            const gameType = game.isSinglePlayer ? 'SinglePlayer' : 'AiGame';
            console.log(`[GoAiBot][${gameType}] Auto-scoring check: totalTurns=${totalTurns}, autoScoringTurns=${autoScoringTurns}, gameStatus=${game.gameStatus}`);
            if (totalTurns >= autoScoringTurns) {
                // 게임 상태를 먼저 확인하여 중복 트리거 방지
                if (game.gameStatus === 'playing' || (game.gameStatus as string) === 'hidden_placing') {
                    const gameType = game.isSinglePlayer ? 'SinglePlayer' : 'AiGame';
                    console.log(`[GoAiBot][${gameType}] Auto-scoring triggered at ${totalTurns} turns (stageId: ${game.stageId || 'N/A'}, validMovesLength: ${validMoves.length}, gameStatus: ${game.gameStatus})`);
                    // 싱글·탑 PVE: 마지막 수가 AI일 때 클라에 돌 착수 애니가 보인 뒤 계가가 이어지도록 약간 지연(턴 전환·저장·브로드캐스트는 아래로 진행)
                    if (isPveDeferredAutoScoringGame(game)) {
                        const kickAt = Date.now() + PVE_DEFERRED_AUTO_SCORING_AFTER_LAST_AI_MS;
                        (game as any).pendingAutoScoringKickoffAt = kickAt;
                        scheduleDeferredPveAutoScoring(game.id, PVE_DEFERRED_AUTO_SCORING_AFTER_LAST_AI_MS);
                        console.log(
                            `[GoAiBot][${gameType}] PVE auto-scoring deferred ${PVE_DEFERRED_AUTO_SCORING_AFTER_LAST_AI_MS}ms after last AI move (game=${game.id})`
                        );
                    } else {
                    if (isLobbyAiStrategicGoGame(game)) {
                        await broadcastPlayingSnapshotBeforeScoring(game);
                    }
                    // 계가 진입 시점에 종료 시각 고정 → 타이머 정지, 총 걸린 시간에 계가 연출 구간 제외
                    game.endTime = Date.now();
                    // 게임 상태를 먼저 scoring으로 변경하여 다른 로직이 게임을 재시작하지 않도록 함
                    game.gameStatus = 'scoring';
                    await db.saveGame(game);
                    const { broadcastToGameParticipants } = await import('./socket.js');
                    // boardState 제외하여 대역폭 절약
                    const gameToBroadcast = { ...game };
                    delete (gameToBroadcast as any).boardState;
                    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToBroadcast } }, game);
                    const { getGameResult } = await import('./gameModes.js');
                    try {
                        await getGameResult(game);
                    } catch (scoringError: any) {
                        console.error(`[GoAiBot][${gameType}] Error during auto-scoring for game ${game.id}:`, scoringError?.message);
                        console.error(`[GoAiBot][${gameType}] Scoring error stack:`, scoringError instanceof Error ? scoringError.stack : 'No stack trace');
                        // 에러가 발생해도 게임은 계속 진행 (fallback 로직이 처리함)
                    }
                    return;
                    }
                } else {
                    const gameType = game.isSinglePlayer ? 'SinglePlayer' : 'AiGame';
                    console.warn(`[GoAiBot][${gameType}] Auto-scoring condition met but gameStatus is not 'playing' or 'hidden_placing': ${game.gameStatus} (totalTurns=${totalTurns}, autoScoringTurns=${autoScoringTurns}) - FORCING TRIGGER`);
                    game.endTime = Date.now();
                    // 조건이 만족되었는데 gameStatus가 다른 경우 강제로 트리거
                    game.gameStatus = 'scoring';
                    await db.saveGame(game);
                    const { broadcastToGameParticipants } = await import('./socket.js');
                    const gameToBroadcast = { ...game };
                    delete (gameToBroadcast as any).boardState;
                    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: gameToBroadcast } }, game);
                    const { getGameResult } = await import('./gameModes.js');
                    try {
                        await getGameResult(game);
                    } catch (scoringError: any) {
                        console.error(`[GoAiBot][${gameType}] Error during forced auto-scoring for game ${game.id}:`, scoringError?.message);
                        console.error(`[GoAiBot][${gameType}] Scoring error stack:`, scoringError instanceof Error ? scoringError.stack : 'No stack trace');
                        // 에러가 발생해도 게임은 계속 진행 (fallback 로직이 처리함)
                    }
                    return;
                }
            } else {
                const gameType = game.isSinglePlayer ? 'SinglePlayer' : 'AiGame';
                console.log(`[GoAiBot][${gameType}] Auto-scoring condition not met: totalTurns=${totalTurns} < autoScoringTurns=${autoScoringTurns}`);
            }
        }
    }
    }
    
    // 싱글플레이 따내기 바둑: 흑(유저) 턴 수 제한 도달 시 AI 수 후 계가 없이 미션 실패 처리
    // (isItemMode가 위 블록에서 정의되지 않을 수 있으므로 여기서 별도 정의)
    const isItemModeHere = ['hidden_placing', 'scanning', 'missile_selecting', 'missile_animating', 'scanning_animating'].includes(game.gameStatus);
    const blackTurnLimit = (game.settings as any)?.blackTurnLimit;
    const isGuildWarCapture = (game as any).gameCategory === 'guildwar' && game.mode === types.GameMode.Capture;
    const shouldApplyBlackTurnLimit = (game.isSinglePlayer && game.stageId) || isGuildWarCapture;
    if (!isItemModeHere && shouldApplyBlackTurnLimit && blackTurnLimit !== undefined && aiPlayerEnum === types.Player.White && game.gameStatus === 'playing') {
        const blackMoves = game.moveHistory.filter(m => m.player === types.Player.Black && m.x !== -1 && m.y !== -1).length;
        if (blackMoves >= blackTurnLimit) {
            // 자동 계가 스테이지에서 총 턴 수가 이미 도달했으면 계가로 승패가 갈리므로 턴 제한 패배 적용 안 함
            let skipTurnLimitFail = false;
            if (game.stageId) {
                const { SINGLE_PLAYER_STAGES } = await import('../constants/singlePlayerConstants.js');
                const stage = SINGLE_PLAYER_STAGES.find(s => s.id === game.stageId);
                const autoScoringTurns = stage?.autoScoringTurns;
                if (autoScoringTurns != null) {
                    const totalTurnsNow = game.moveHistory.filter(m => m.x !== -1 && m.y !== -1).length;
                    if (totalTurnsNow >= autoScoringTurns) skipTurnLimitFail = true;
                }
            }
            if (!skipTurnLimitFail) {
                const targetForBlack = getCaptureTarget(game, Player.Black);
                const hasBlackTarget = targetForBlack !== undefined && targetForBlack !== NO_CAPTURE_TARGET;
                const blackCaptures = game.captures[Player.Black] ?? 0;

                // 흑이 이미 목표 따낸 돌을 달성했다면 턴 제한 패배를 적용하지 않고,
                // 이전에 처리된 capture_limit 결과(또는 이후 계가 결과)를 그대로 따른다.
                if (!(hasBlackTarget && blackCaptures >= (targetForBlack as number))) {
                    console.log(`[GoAiBot] blackTurnLimit reached after AI move: blackMoves=${blackMoves}, limit=${blackTurnLimit}, gameCategory=${(game as any).gameCategory}`);
                    const loseReason: types.WinReason = isGuildWarCapture ? 'capture_limit' : 'timeout';
                    await summaryService.endGame(game, types.Player.White, loseReason);
                    return;
                }
            }
        }
    }

    // 히든 돌 공개 애니메이션 직후에는 턴을 넘기지 않음
    // (updateHiddenState에서 이미 AI 턴을 유지하고 aiProcessingQueue에 추가했으므로)
    const isAiReTurnAfterReveal = (game as any).isAiReTurnAfterReveal;
    
    if (!isAiReTurnAfterReveal) {
        // 일반적인 경우: 턴 넘기기
        game.currentPlayer = opponentPlayerEnum;
        
        // 살리기 바둑 모드: 백이 수를 둔 후 턴을 넘긴 직후 승리 조건 체크
        const isSurvivalMode = (game.settings as any)?.isSurvivalMode === true;
        if (isSurvivalMode && aiPlayerEnum === Player.White && game.gameStatus === 'playing') {
            const whiteTurnsPlayed = (game as any).whiteTurnsPlayed || 0;
            const survivalTurns = (game.settings as any)?.survivalTurns || 0;
            const remainingTurns = survivalTurns - whiteTurnsPlayed;
            
            if (remainingTurns <= 0 && survivalTurns > 0) {
                console.log(`[Survival Go] White ran out of turns after turn change (${whiteTurnsPlayed}/${survivalTurns}), Black wins`);
                await summaryService.endGame(game, Player.Black, 'capture_limit');
                return;
            }
        }
        
        if (hasTimeControl(game.settings) && shouldEnforceTimeControl(game)) {
            const timeKey = game.currentPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
            const byoyomiKey = game.currentPlayer === types.Player.Black ? 'blackByoyomiPeriodsLeft' : 'whiteByoyomiPeriodsLeft';
            const isFischer = isFischerStyleTimeControl(game as any);
            const isNextInByoyomi = game[timeKey] <= 0 && game.settings.byoyomiCount > 0 && game[byoyomiKey] > 0 && !isFischer;
            
            if (isNextInByoyomi) {
                game.turnDeadline = now + game.settings.byoyomiTime * 1000;
            } else {
                game.turnDeadline = now + game[timeKey] * 1000;
            }
            game.turnStartTime = now;
        } else {
            game.turnDeadline = undefined;
            game.turnStartTime = undefined;
        }
        
        // AI가 수를 두고 턴을 넘겼으므로, 다음 사용자 턴이 시작됨
        // aiTurnStartTime은 undefined로 설정하여 다음 AI 턴까지 대기
        // (사용자가 수를 두면 standard.ts의 PLACE_STONE에서 aiTurnStartTime이 설정됨)
        const { aiUserId } = await import('./aiPlayer.js');
        const nextPlayerId = game.currentPlayer === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
        if (nextPlayerId === aiUserId) {
            // 다음 턴도 AI인 경우 (히든 돌 공개 후 재턴 등)
            game.aiTurnStartTime = now;
            console.log(`[makeGoAiBotMove] Next turn is also AI, setting aiTurnStartTime to now: ${now}, game ${game.id}`);
        } else {
            // 다음 턴이 사용자인 경우
            game.aiTurnStartTime = undefined;
            console.log(`[makeGoAiBotMove] Turn switched to user after AI move, clearing aiTurnStartTime, game ${game.id}`);
        }
    } else {
        // 히든 돌 공개 직후 AI 재턴: 플래그 제거 (다음 AI 수부터는 정상적으로 턴 넘김)
        (game as any).isAiReTurnAfterReveal = false;
    }
    // 히든 돌 공개 직후에는 턴을 넘기지 않고 AI 턴 유지 (updateHiddenState에서 이미 처리됨)
    } finally {
        const animThink = game.animation as { type?: string } | null | undefined;
        if (animThink?.type === 'ai_thinking' && game.aiHiddenItemAnimationEndTime == null) {
            game.animation = null;
            game.foulInfo = null;
        }
    }
}

/**
 * 모든 유효한 수 찾기 (전체 검사)
 */
function findAllValidMoves(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    aiPlayer: Player
): Point[] {
    const validMoves: Point[] = [];
    const boardSize = game.settings.boardSize;

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (game.boardState[y][x] === Player.None) {
                const result = processMove(
                    game.boardState,
                    { x, y, player: aiPlayer },
                    game.koInfo,
                    game.moveHistory.length
                );
                if (result.isValid) {
                    validMoves.push({ x, y });
                }
            }
        }
    }

    return validMoves;
}

/**
 * 빠른 휴리스틱으로 유효한 수 찾기 (낮은 난이도용, 성능 최적화)
 * 주변에 돌이 있는 위치만 검사하여 계산량을 대폭 줄임
 */
function findAllValidMovesFast(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    aiPlayer: Player
): Point[] {
    const validMoves: Point[] = [];
    const boardSize = game.settings.boardSize;
    const checkedPoints = new Set<string>();

    // 기존 돌 주변만 검사 (빈 보드의 경우 중앙 영역만 검사)
    const occupiedPoints: Point[] = [];
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (game.boardState[y][x] !== Player.None) {
                occupiedPoints.push({ x, y });
            }
        }
    }

    // 주변 위치 검사
    if (occupiedPoints.length > 0) {
        for (const point of occupiedPoints) {
            const neighbors = logic.getNeighbors(point.x, point.y);
            for (const neighbor of neighbors) {
                const key = `${neighbor.x},${neighbor.y}`;
                if (!checkedPoints.has(key) && game.boardState[neighbor.y][neighbor.x] === Player.None) {
                    checkedPoints.add(key);
                    const result = processMove(
                        game.boardState,
                        { x: neighbor.x, y: neighbor.y, player: aiPlayer },
                        game.koInfo,
                        game.moveHistory.length
                    );
                    if (result.isValid) {
                        validMoves.push({ x: neighbor.x, y: neighbor.y });
                    }
                }
            }
        }
    } else {
        // 빈 보드: 중앙 영역만 검사 (3x3 ~ 5x5)
        const centerStart = Math.floor(boardSize / 2) - 2;
        const centerEnd = Math.floor(boardSize / 2) + 3;
        for (let y = Math.max(0, centerStart); y < Math.min(boardSize, centerEnd); y++) {
            for (let x = Math.max(0, centerStart); x < Math.min(boardSize, centerEnd); x++) {
                if (game.boardState[y][x] === Player.None) {
                    const result = processMove(
                        game.boardState,
                        { x, y, player: aiPlayer },
                        game.koInfo,
                        game.moveHistory.length
                    );
                    if (result.isValid) {
                        validMoves.push({ x, y });
                    }
                }
            }
        }
    }

    // 최소한 몇 개는 있어야 함 (없으면 전체 검사)
    if (validMoves.length < 5) {
        return findAllValidMoves(game, logic, aiPlayer);
    }

    return validMoves;
}

/**
 * AI 프로필에 따라 수를 점수화
 */
function scoreMovesByProfile(
    moves: Point[],
    game: types.LiveGameSession,
    profile: GoAiBotProfile,
    logic: ReturnType<typeof getGoLogic>,
    aiPlayer: Player,
    opponentPlayer: Player
): Array<{ move: Point; score: number }> {
    const scoredMoves: Array<{ move: Point; score: number }> = [];

    const pveCap = isPveCaptureMode(game);
    const pveScore = isPveScoringMode(game);
    const territoryMul = pveScore ? 1.5 : pveCap ? 0.38 : 1;
    const territoryStrategyMul = pveScore ? 1.45 : pveCap ? 0.42 : 1;

    for (const move of moves) {
        let score = 0;
        const point: Point = { x: move.x, y: move.y };

        // 0. 자신의 단수 그룹을 살리기 vs 따내기 판단 (미래를 내다보며 살릴 수 있는지 확인)
        const testResultForSave = processMove(
            game.boardState,
            { ...point, player: aiPlayer },
            game.koInfo,
            game.moveHistory.length,
            { ignoreSuicide: true }
        );
        
        let saveScore = 0;
        let captureScore = 0;
        
        if (testResultForSave.isValid) {
            const myGroupsBefore = logic.getAllGroups(aiPlayer, game.boardState);
            const myGroupsAfter = logic.getAllGroups(aiPlayer, testResultForSave.newBoardState);
            
            for (const groupBefore of myGroupsBefore) {
                if (groupBefore.libertyPoints.size === 1) {
                    const matchingAfter = myGroupsAfter.find(ga =>
                        ga.stones.some(ast => groupBefore.stones.some(bst => ast.x === bst.x && ast.y === bst.y))
                    );
                    if (matchingAfter && matchingAfter.libertyPoints.size > 1) {
                        // 자신의 단수 그룹을 살린 경우
                        const groupSize = groupBefore.stones.length;
                        const saveOwnGroupValue = evaluateGroupValue(
                            groupBefore,
                            game,
                            logic,
                            aiPlayer,
                            profile
                        );
                        
                        // 미래를 내다보며 살릴 수 있는지 판단
                        const canBeSaved = canGroupBeSaved(
                            game,
                            testResultForSave.newBoardState,
                            testResultForSave.newKoInfo,
                            matchingAfter,
                            aiPlayer,
                            opponentPlayer,
                            profile,
                            logic
                        );
                        
                        if (canBeSaved) {
                            // 살릴 수 있는 그룹 - 살리기와 따내기를 같은 등급의 점수로
                            saveScore += 5000 + saveOwnGroupValue * 500 + groupSize * 200;
                        } else {
                            // 살릴 수 없는 그룹 - 살리기 점수를 낮추고 따내기 우선
                            saveScore += 2000 + saveOwnGroupValue * 200 + groupSize * 100;
                        }
                    }
                }
            }
        }

        // 1. 따내기 성향 반영 (살리기와 같은 등급의 점수)
        const captureOpportunityScore = evaluateCaptureOpportunity(game, logic, point, aiPlayer, opponentPlayer);
        if (captureOpportunityScore > 0) {
            // 따내기 점수도 살리기와 비슷한 수준으로 설정 (같은 등급)
            captureScore += 5000 + captureOpportunityScore * 500;
        }
        captureScore += captureOpportunityScore * profile.captureTendency * 300;
        if (pveCap && captureOpportunityScore > 0) {
            captureScore += 3800 + captureOpportunityScore * 420;
        }
        
        // 살리기와 따내기 중 선택 (미래를 내다본 판단에 따라)
        if (saveScore > 0 && captureScore > 0) {
            if (isSinglePlayerOrTowerPve(game)) {
                const saveWeight = pveCap ? 0.16 : 0.25;
                score += captureScore + saveScore * saveWeight;
            } else if (saveScore >= 5000) {
                // 살릴 수 있는 그룹 - 살리기와 따내기를 같은 등급으로 처리하되, 살리기 우선
                score += saveScore;
                score += captureScore * 0.3;
            } else {
                score += captureScore;
                score += saveScore * 0.3;
            }
        } else if (saveScore > 0) {
            score += saveScore;
        } else if (captureScore > 0) {
            score += captureScore;
        }

        // 2. 영토 확보 성향 반영 (방어 우선)
        const territoryScore = evaluateTerritory(game, logic, point, aiPlayer, profile);
        
        // 영토 확보 전략 단계별 평가
        const territoryStrategyScore = evaluateTerritoryStrategy(game, logic, point, aiPlayer, opponentPlayer, profile);
        score += territoryStrategyScore * territoryStrategyMul;
        
        // 방어적인 수는 더 높은 가중치 적용 (계가 PvE에서는 영토 우선, 따내기 PvE에서는 가중 낮춤)
        if (territoryScore > 5.0) {
            // 방어적인 수는 매우 높은 점수
            score += territoryScore * profile.territoryTendency * 200 * territoryMul;
        } else if (territoryScore < 0) {
            // 영토를 메우는 수는 패널티
            score += territoryScore * profile.territoryTendency * 100 * territoryMul;
        } else {
            score += territoryScore * profile.territoryTendency * 50 * territoryMul;
        }
        
        // 2-1. 방어 방향 평가 (선의 높이에 따른 방어 우선순위)
        if (territoryScore > 5.0) {
            // 방어적인 수일 때만 방어 방향 평가
            const defensiveDirectionScore = evaluateDefensiveDirection(game, point, aiPlayer, profile);
            score += defensiveDirectionScore * profile.territoryTendency * 150 * territoryMul; // 방어 방향 점수
        }

        // 3. 전투 성향 반영
        const combatScore = evaluateCombat(game, logic, point, aiPlayer, opponentPlayer);
        score += combatScore * profile.combatTendency * 80;

        // 4. 아타리(단수) 기회 평가
        const atariScore = evaluateAtariOpportunity(game, logic, point, aiPlayer, opponentPlayer);
        if (atariScore > 0) {
            const atariMul = pveCap ? 1.38 : pveScore ? 0.92 : 1;
            score += (1000 + atariScore * profile.captureTendency * 200) * atariMul; // 높은 점수
        }

        // 4-1. 유저 돌 근처로 접근 (공격적 접근) - 싱글/도전의 탑 PvE
        if (isSinglePlayerOrTowerPve(game)) {
            const proximityScore = evaluateProximityToOpponent(game, logic, point, opponentPlayer);
            const proxMul = pveCap ? 1.35 : pveScore ? 0.85 : 1;
            score += proximityScore * profile.combatTendency * 250 * proxMul; // 유저 돌 근처로 가는 수
        }

        // 4-2. 공격 기회 평가 (유저 그룹 위협)
        if (isSinglePlayerOrTowerPve(game)) {
            const attackScore = evaluateAttackOpportunity(game, logic, point, aiPlayer, opponentPlayer);
            const atkMul = pveCap ? 1.4 : pveScore ? 0.75 : 1;
            score += attackScore * profile.combatTendency * 200 * atkMul; // 유저 그룹을 위협하는 수
        }

        // 5. 정석/포석 활용도 반영 (고수일수록 더 반영)
        if (profile.josekiUsage > 0.3) {
            const josekiScore = evaluateJoseki(game, point, aiPlayer);
            score += josekiScore * profile.josekiUsage * 40;
        }

        // 6. 사활 판단 능력 반영
        if (profile.lifeDeathSkill > 0.3) {
            const lifeDeathScore = evaluateLifeDeath(game, logic, point, aiPlayer, opponentPlayer);
            score += lifeDeathScore * profile.lifeDeathSkill * 80;
        }

        // 7. 행마 능력 반영
        if (profile.movementSkill > 0.3) {
            const movementScore = evaluateMovement(game, logic, point, aiPlayer);
            score += movementScore * profile.movementSkill * 40;
        }

        // 8. 승리 목적 달성도 반영 (목표 점수에 근접할수록 높은 점수)
        if (profile.winFocus > 0.5 && (isSinglePlayerOrTowerPve(game) || game.mode === types.GameMode.Capture)) {
            const winFocusScore = evaluateWinFocus(game, logic, point, aiPlayer, opponentPlayer);
            const wfMul = isPveCaptureMode(game) ? 1.35 : 1;
            score += winFocusScore * profile.winFocus * 150 * wfMul;
        }

        // 9. 2단계: 자충수 방지 (단수당한 자신의 돌을 살리는 경우는 예외)
        // 먼저 단수당한 자신의 돌을 살리는지 확인
        const testResultForSelfAtari = processMove(
            game.boardState,
            { ...point, player: aiPlayer },
            game.koInfo,
            game.moveHistory.length,
            { ignoreSuicide: true }
        );
        let isSavingOwnAtariGroup = false;
        if (testResultForSelfAtari.isValid) {
            const myGroupsBefore = logic.getAllGroups(aiPlayer, game.boardState);
            const myGroupsAfter = logic.getAllGroups(aiPlayer, testResultForSelfAtari.newBoardState);
            for (const groupBefore of myGroupsBefore) {
                if (groupBefore.libertyPoints.size === 1) {
                    const matchingAfter = myGroupsAfter.find(ga =>
                        ga.stones.some(ast => groupBefore.stones.some(bst => ast.x === bst.x && ast.y === bst.y))
                    );
                    if (matchingAfter && matchingAfter.libertyPoints.size > 1) {
                        isSavingOwnAtariGroup = true;
                        break;
                    }
                }
            }
        }
        
        // 단수당한 자신의 돌을 살리는 경우가 아니면 자충수 패널티 적용
        if (profile.avoidsSelfAtari && !isSavingOwnAtariGroup) {
            const selfAtariPenalty = evaluateSelfAtari(game, logic, point, aiPlayer);
            // 자충수는 매우 큰 패널티 (다른 점수로 상쇄되지 않도록)
            // evaluateSelfAtari는 자충수면 1.0, 아니면 0.0을 반환
            if (selfAtariPenalty > 0) {
                // 자충수인 경우 점수를 매우 낮게 설정하여 거의 선택되지 않도록 함
                score = -100000; // 매우 큰 음수로 설정하여 다른 점수와 관계없이 최하위로
            }
        }

        // 10. 3단계: 먹여치기 및 환격
        if (profile.knowsSacrificeAndCounter) {
            const sacrificeScore = evaluateSacrificeAndCounter(game, logic, point, aiPlayer, opponentPlayer);
            score += sacrificeScore * 300;
        }

        // 11. 4단계: 단수 상황 판단 (따내기 vs 살리기) - 가치 판단
        const atariJudgmentScore = evaluateAtariJudgment(game, logic, point, aiPlayer, opponentPlayer);
        const testResult = testResultForSave; // 위에서 이미 계산한 결과 재사용
        
        // 살리기 vs 따내기 가치 비교 (살리기가 이미 처리되지 않은 경우에만)
        let alreadySaved = false;
        if (testResult.isValid) {
            const myGroupsAfter = logic.getAllGroups(aiPlayer, testResult.newBoardState);
            const myGroupsBefore = logic.getAllGroups(aiPlayer, game.boardState);
            for (const groupBefore of myGroupsBefore) {
                if (groupBefore.libertyPoints.size === 1) {
                    const matchingAfter = myGroupsAfter.find(ga =>
                        ga.stones.some(ast => groupBefore.stones.some(bst => ast.x === bst.x && ast.y === bst.y))
                    );
                    if (matchingAfter && matchingAfter.libertyPoints.size > 1) {
                        alreadySaved = true; // 이미 살리기로 처리됨
                        break;
                    }
                }
            }
        }
        
        if (testResult.isValid && profile.knowsAtariJudgment && !alreadySaved) {
            let captureOpponentValue = 0;
            
            // 상대방 돌을 따내는 경우의 가치 평가
            if (testResult.capturedStones.length > 0) {
                // 따낼 돌의 개수와 가치 평가
                let captureValue = 0;
                for (const stone of testResult.capturedStones) {
                    const wasPatternStone = (opponentPlayer === Player.Black && game.blackPatternStones?.some(p => p.x === stone.x && p.y === stone.y)) ||
                                            (opponentPlayer === Player.White && game.whitePatternStones?.some(p => p.x === stone.x && p.y === stone.y));
                    captureValue += wasPatternStone ? 3 : 1; // 문양돌은 더 가치 있음
                }
                
                // 따낼 그룹의 크기와 중요도 평가
                const opponentGroupsBefore = logic.getAllGroups(opponentPlayer, game.boardState);
                for (const stone of testResult.capturedStones) {
                    const capturedGroup = opponentGroupsBefore.find(g =>
                        g.stones.some(s => s.x === stone.x && s.y === stone.y)
                    );
                    if (capturedGroup) {
                        // 그룹 크기에 따라 가치 증가 (큰 그룹을 잡는 것이 더 가치 있음)
                        captureValue += capturedGroup.stones.length * 0.5;
                    }
                }
                
                captureOpponentValue = captureValue;
            }
            
            // 가치 비교 후 점수 부여 (살리기가 이미 처리되지 않은 경우에만)
            if (captureOpponentValue > 0) {
                // 상대방 돌을 따내는 경우
                score += 3000 + captureOpponentValue * 400;
            } else {
                // 일반적인 단수 상황 판단
                score += atariJudgmentScore * 400;
            }
        } else if (profile.knowsAtariJudgment && !alreadySaved) {
            score += atariJudgmentScore * 400;
        }

        // 12. 5단계: 방향성 공격
        if (profile.knowsDirectionalAttack) {
            const directionalScore = evaluateDirectionalAttack(game, logic, point, aiPlayer, opponentPlayer);
            score += directionalScore * 200;
        }

        // 13. 6단계: 초반 포석 (3-4선 선호)
        if (profile.knowsFuseki) {
            const moveCount = game.moveHistory.length;
            if (moveCount <= 50) {
                const fusekiScore = evaluateFuseki(game, point, aiPlayer, profile.level);
                score += fusekiScore * 150;
            }
        }

        // 14. 7단계: 영토 확보 및 전투 (이미 위에서 평가됨, 추가 보정)
        if (profile.knowsTerritoryAndCombat) {
            const territoryCombatScore = evaluateTerritoryAndCombat(game, logic, point, aiPlayer, opponentPlayer);
            score += territoryCombatScore * 100;
        }

        // 15. 8단계: 고급 기술 (촉촉수, 축, 장문, 환격, 먹여치기)
        if (profile.knowsAdvancedTechniques) {
            const advancedScore = evaluateAdvancedTechniques(game, logic, point, aiPlayer, opponentPlayer);
            score += advancedScore * 250;
        }

        // 15-1. 포위된 그룹의 탈출 시도 (높은 우선순위) — 따내기 PvE에서는 따내기·공격이 우선이므로 가중 완화
        const escapeScore = evaluateEscapeFromSurround(game, logic, point, aiPlayer, opponentPlayer);
        if (escapeScore > 0) {
            score += escapeScore * (pveCap ? 420 : 1500); // 탈출 시도는 매우 높은 점수
        }

        // 16. 9단계: 연결/끊음, 사활, 행마
        if (profile.knowsConnectionLifeDeathMovement) {
            const connectionScore = evaluateConnectionAndCut(game, logic, point, aiPlayer, opponentPlayer);
            score += connectionScore * 200;
            const lifeDeathScore = evaluateLifeDeathAdvanced(game, logic, point, aiPlayer, opponentPlayer);
            score += lifeDeathScore * 300;
            const movementScore = evaluateMovementAdvanced(game, logic, point, aiPlayer);
            score += movementScore * 150;
        }

        // 17. 10단계: 마무리 (집 지키기/부수기)
        if (profile.knowsEndgame) {
            const moveCount = game.moveHistory.length;
            const boardSize = game.settings.boardSize;
            const totalSpaces = boardSize * boardSize;
            const occupiedSpaces = game.boardState.flat().filter(c => c !== types.Player.None).length;
            const occupancyRate = occupiedSpaces / totalSpaces;
            
            // 보드의 70% 이상이 차면 마무리 단계로 간주
            if (occupancyRate >= 0.7 || moveCount >= totalSpaces * 0.7) {
                const endgameScore = evaluateEndgame(game, logic, point, aiPlayer, opponentPlayer);
                score += endgameScore * 400;
            }
        }

        // 18. 미래를 내다보는 평가 (calculationDepth에 따라)
        if (profile.calculationDepth > 1 && testResultForSave.isValid) {
            const lookAheadScore = evaluateLookAhead(
                game,
                testResultForSave.newBoardState,
                testResultForSave.newKoInfo,
                point,
                aiPlayer,
                opponentPlayer,
                profile,
                logic,
                profile.calculationDepth - 1 // 이미 1수는 둔 상태이므로 -1
            );
            let lookMul = profile.calculationDepth * 50;
            // 따내기 PvE에서 즉시 따내기 수는 상대 1수 샘플링이 불완전해 과소평가되기 쉬움 → 가중 완화
            if (pveCap && testResultForSave.capturedStones.length > 0) {
                lookMul *= 0.42;
            } else if (pveScore) {
                lookMul *= 1.12;
            }
            score += lookAheadScore * lookMul; // 깊이에 따라 가중치 증가
        }

        if (
            isSinglePlayerOrTowerPve(game) &&
            testResultForSave.isValid &&
            testResultForSave.capturedStones.length > 0 &&
            score > -90000
        ) {
            score += pveCap ? 640000 : 540000;
        }

        // 따내기 PvE: 한 수 교환으로 손해(상대가 더 크게 따냄)만 피함 — 무조건 따내기는 유지하되 명백한 함정은 감점
        if (
            pveCap &&
            testResultForSave.isValid &&
            testResultForSave.capturedStones.length > 0 &&
            score > -90000
        ) {
            const myGain = weightedStonesCaptured(game, opponentPlayer, testResultForSave.capturedStones);
            const oppReply = getMaxOpponentWeightedCaptureReply(
                game,
                testResultForSave.newBoardState,
                testResultForSave.newKoInfo,
                game.moveHistory.length + 1,
                opponentPlayer,
                aiPlayer,
                logic
            );
            if (oppReply > myGain) {
                const gap = oppReply - myGain;
                score -= Math.min(580000, 120000 + gap * 95000);
            }
        }

        scoredMoves.push({ move, score });
    }

    // 점수 순으로 정렬
    scoredMoves.sort((a, b) => b.score - a.score);

    return scoredMoves;
}

/**
 * 따내기 기회 평가
 */
function evaluateCaptureOpportunity(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player
): number {
    // 이 수로 상대 돌을 따낼 수 있는지 확인
    const testResult = processMove(
        game.boardState,
        { ...point, player: aiPlayer },
        game.koInfo,
        game.moveHistory.length,
        { ignoreSuicide: true }
    );

    if (testResult.isValid && testResult.capturedStones.length > 0) {
        let captureScore = 0;
        for (const stone of testResult.capturedStones) {
            // 문양돌은 2점, 일반 돌은 1점
            const wasPatternStone = (opponentPlayer === Player.Black && game.blackPatternStones?.some(p => p.x === stone.x && p.y === stone.y)) ||
                                    (opponentPlayer === Player.White && game.whitePatternStones?.some(p => p.x === stone.x && p.y === stone.y));
            captureScore += wasPatternStone ? 2 : 1;
        }
        return captureScore;
    }

    return 0;
}

/**
 * 방어 방향 평가 (선의 높이에 따른 방어 우선순위)
 * 낮은 단계: 1선부터 막으려고 함
 * 높은 단계: 3~4선부터 막으려고 함, 중앙에 가까운 곳부터 막으려고 함
 */
function evaluateDefensiveDirection(
    game: types.LiveGameSession,
    point: Point,
    aiPlayer: Player,
    profile: GoAiBotProfile
): number {
    const boardSize = game.settings.boardSize;
    
    // 현재 위치의 선 계산 (가장자리에서 얼마나 떨어져 있는지)
    // 1선 = 가장자리 (x=0, x=boardSize-1, y=0, y=boardSize-1)
    // 2선 = 그 다음
    // 3선, 4선 = 중앙에 가까운 선
    const distanceFromEdge = Math.min(
        point.x,                                    // 왼쪽 가장자리까지 거리
        point.y,                                    // 위쪽 가장자리까지 거리
        boardSize - 1 - point.x,                    // 오른쪽 가장자리까지 거리
        boardSize - 1 - point.y                    // 아래쪽 가장자리까지 거리
    );
    
    // 선 계산 (1선 = 가장자리, 2선, 3선, 4선...)
    const line = distanceFromEdge + 1; // 1선부터 시작
    const maxLine = Math.ceil(boardSize / 2);
    const normalizedLine = (line - 1) / (maxLine - 1); // 0.0 (1선) ~ 1.0 (중앙)
    
    // 중앙까지의 거리 (중앙 선호도 계산용)
    const centerX = boardSize / 2;
    const centerY = boardSize / 2;
    const distanceFromCenterX = Math.abs(point.x - centerX);
    const distanceFromCenterY = Math.abs(point.y - centerY);
    const distanceFromCenter = Math.sqrt(distanceFromCenterX * distanceFromCenterX + distanceFromCenterY * distanceFromCenterY);
    const maxDistanceFromCenter = Math.sqrt((boardSize / 2) * (boardSize / 2) * 2);
    const centrality = 1.0 - (distanceFromCenter / maxDistanceFromCenter); // 0.0 (가장자리) ~ 1.0 (중앙)
    
    // AI 난이도에 따른 방어 방향 선호도
    // 낮은 단계(1-3): 1선부터 막으려고 함 (패널티 없음)
    // 중간 단계(4-6): 2선부터 막으려고 함
    // 높은 단계(7-10): 3~4선부터 막으려고 함, 중앙에 가까운 곳 선호
    
    const level = profile.level;
    let directionScore = 0;
    
    if (level <= 3) {
        // 낮은 단계: 1선부터 막으려고 함 (방향 점수 없음)
        directionScore = 0;
    } else if (level <= 6) {
        // 중간 단계: 2선 이상 선호 (1선은 약간 패널티)
        if (line === 1) {
            directionScore = -1.0; // 1선은 약간 패널티
        } else if (line >= 2 && line <= 3) {
            directionScore = 1.0; // 2~3선 선호
        } else {
            directionScore = 0.5; // 그 외
        }
    } else {
        // 높은 단계(7-10): 3~4선부터 막으려고 함, 중앙에 가까운 곳 선호
        if (line === 1) {
            directionScore = -3.0; // 1선은 큰 패널티 (죽음의 선)
        } else if (line === 2) {
            directionScore = -1.0; // 2선도 약간 패널티
        } else if (line >= 3 && line <= 4) {
            directionScore = 3.0; // 3~4선은 높은 점수
        } else if (line >= 5) {
            directionScore = 1.0; // 5선 이상도 괜찮음
        }
        
        // 중앙에 가까울수록 추가 점수
        directionScore += centrality * 2.0; // 중앙에 가까울수록 추가 점수
    }
    
    return directionScore;
}

/**
 * 영토 확보 평가 (방어 vs 영토 메우기 구분)
 */
function evaluateTerritory(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    profile?: GoAiBotProfile
): number {
    const boardSize = game.settings.boardSize;
    let territoryScore = 0;

    // 주변 4방향 확인 (상하좌우)
    const directions = [
        { x: -1, y: 0 }, { x: 1, y: 0 },
        { x: 0, y: -1 }, { x: 0, y: 1 }
    ];

    let myStonesCount = 0;
    let emptySpacesCount = 0;
    let opponentStonesCount = 0;
    let isDefensiveMove = false; // 방어적인 수인지 확인
    let isFillingTerritory = false; // 영토를 메우는 수인지 확인

    // 상대 그룹들 확인 (방어 평가용)
    const opponentGroups = logic.getAllGroups(aiPlayer === Player.Black ? Player.White : Player.Black, game.boardState);

    for (const dir of directions) {
        const nx = point.x + dir.x;
        const ny = point.y + dir.y;
        if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
            const cell = game.boardState[ny][nx];
            if (cell === Player.None) {
                emptySpacesCount++;
                // 빈 공간이지만 상대가 침입할 수 있는 곳인지 확인
                // 상대 돌이 근처에 있으면 방어적인 수
                const neighbors = logic.getNeighbors(nx, ny);
                for (const neighbor of neighbors) {
                    const neighborCell = game.boardState[neighbor.y]?.[neighbor.x];
                    if (neighborCell === (aiPlayer === Player.Black ? Player.White : Player.Black)) {
                        isDefensiveMove = true;
                        break;
                    }
                }
            } else if (cell === aiPlayer) {
                myStonesCount++;
            } else {
                opponentStonesCount++;
                isDefensiveMove = true; // 상대 돌 근처는 방어적인 수
            }
        }
    }

    // 자신의 그룹으로 완전히 둘러싸인 영역인지 확인 (영토 메우기)
    // 주변 8방향 모두 확인
    const allDirections = [
        { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
        { x: -1, y: 0 }, { x: 1, y: 0 },
        { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 }
    ];
    let myStonesAround = 0;
    let emptySpacesAround = 0;
    let opponentStonesAround = 0;
    
    for (const dir of allDirections) {
        const nx = point.x + dir.x;
        const ny = point.y + dir.y;
        if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
            const cell = game.boardState[ny][nx];
            if (cell === aiPlayer) {
                myStonesAround++;
            } else if (cell === Player.None) {
                emptySpacesAround++;
            } else {
                opponentStonesAround++;
            }
        }
    }
    
    // 자신의 돌로 완전히 둘러싸인 곳 (빈 공간이 없고 상대 돌도 없음) - 영토 메우기
    if (myStonesAround >= 4 && emptySpacesAround === 0 && opponentStonesAround === 0) {
        isFillingTerritory = true;
    }

    // 방어적인 수 (상대가 침입할 수 있는 곳을 막는 수) - 높은 점수
    if (isDefensiveMove) {
        territoryScore += 5.0; // 방어적인 수는 높은 점수
        if (opponentStonesCount > 0) {
            territoryScore += opponentStonesCount * 2.0; // 상대 돌이 많을수록 더 중요
        }
        // 상대 그룹이 근처에 있으면 더 중요
        for (const oppGroup of opponentGroups) {
            for (const stone of oppGroup.stones) {
                const distance = Math.abs(point.x - stone.x) + Math.abs(point.y - stone.y);
                if (distance <= 2) {
                    territoryScore += 1.0; // 상대 그룹 근처 방어는 더 중요
                    break;
                }
            }
        }
        
        // 방어 방향 평가 (선의 높이에 따른 방어 우선순위)
        // 이 부분은 scoreMovesByProfile에서 profile을 전달받아 처리하므로 여기서는 기본 점수만 부여
    } else if (isFillingTerritory) {
        // 이미 확정된 영토 안에 두는 수 (영토 메우기) - 큰 패널티
        territoryScore -= 15.0; // 영토를 메우는 것은 매우 비효율적
    } else if (myStonesCount >= 3 && emptySpacesCount === 0) {
        // 자신의 돌로 둘러싸인 곳 - 패널티
        territoryScore -= 10.0; // 영토를 메우는 것은 비효율적
    } else if (myStonesCount >= 2) {
        // 자신의 돌이 많지만 방어적이지 않은 경우 - 약간의 점수만
        territoryScore += 0.5;
    } else {
        // 새로운 영토 확보 시도
        territoryScore += 1.0;
    }

    // 모서리와 변은 영토 확보에 유리 (단, 방어적인 수가 아닐 때만)
    if (!isDefensiveMove) {
        const isCorner = (point.x === 0 || point.x === boardSize - 1) && 
                         (point.y === 0 || point.y === boardSize - 1);
        const isEdge = (point.x === 0 || point.x === boardSize - 1) || 
                      (point.y === 0 || point.y === boardSize - 1);
        
        if (isCorner) territoryScore += 2;
        else if (isEdge) territoryScore += 1;
    }

    return territoryScore;
}

/**
 * 영토 확보 전략 단계별 평가
 * 1. 최고 단계: 상대방의 영토가 넓어지지 못하게 하면서 내 영토를 넓혀나가는 자리
 * 2. 중간 단계: 내 영토만 넓어지는 자리 또는 상대방의 영토만 넓어지지 못하게 두는 자리
 * 3. 초보 단계: 영토의 개념을 막 이해하고 10집 이상의 영토를 만들려고 노력
 * 4. 최하 단계: 내 영토를 넓히기는 커녕 메워서 없애는 단계 (이미 패널티 있음)
 */
function evaluateTerritoryStrategy(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player,
    profile: GoAiBotProfile
): number {
    const boardSize = game.settings.boardSize;
    let strategyScore = 0;
    
    // 임시 보드로 수를 시뮬레이션
    const tempBoard = game.boardState.map(row => [...row]);
    tempBoard[point.y][point.x] = aiPlayer;
    
    // 내 영토 확장 가능성 평가
    const myTerritoryExpansion = evaluateMyTerritoryExpansion(tempBoard, logic, point, aiPlayer, boardSize);
    
    // 상대방 영토 확장 방지 평가
    const opponentTerritoryBlock = evaluateOpponentTerritoryBlock(tempBoard, logic, point, aiPlayer, opponentPlayer, boardSize);
    
    // 10집 이상 영토 만들기 평가
    const largeTerritoryScore = evaluateLargeTerritory(tempBoard, logic, point, aiPlayer, boardSize);
    
    // AI 레벨에 따른 전략 선택
    if (profile.level >= 7) {
        // 최고 단계: 상대방 영토 확장 방지 + 내 영토 확장
        if (opponentTerritoryBlock > 0 && myTerritoryExpansion > 0) {
            strategyScore += (opponentTerritoryBlock + myTerritoryExpansion) * 300; // 매우 높은 점수
        } else if (opponentTerritoryBlock > 0) {
            strategyScore += opponentTerritoryBlock * 200; // 상대방 방어도 중요
        } else if (myTerritoryExpansion > 0) {
            strategyScore += myTerritoryExpansion * 150; // 내 영토 확장
        }
    } else if (profile.level >= 4) {
        // 중간 단계: 내 영토 확장 또는 상대방 영토 확장 방지
        if (myTerritoryExpansion > 0) {
            strategyScore += myTerritoryExpansion * 200;
        }
        if (opponentTerritoryBlock > 0) {
            strategyScore += opponentTerritoryBlock * 200;
        }
    } else if (profile.level >= 2) {
        // 초보 단계: 10집 이상 영토 만들기 노력
        strategyScore += largeTerritoryScore * 150;
    }
    // 최하 단계(level 1)는 이미 evaluateTerritory에서 영토 메우기 패널티가 있음
    
    return strategyScore;
}

/**
 * 내 영토 확장 가능성 평가
 */
function evaluateMyTerritoryExpansion(
    board: Player[][],
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    boardSize: number
): number {
    let expansionScore = 0;
    
    // 주변 8방향 확인
    const directions = [
        { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
        { x: -1, y: 0 }, { x: 1, y: 0 },
        { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 }
    ];
    
    let myStonesNearby = 0;
    let emptySpacesNearby = 0;
    
    for (const dir of directions) {
        const nx = point.x + dir.x;
        const ny = point.y + dir.y;
        if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
            const cell = board[ny][nx];
            if (cell === aiPlayer) {
                myStonesNearby++;
            } else if (cell === Player.None) {
                emptySpacesNearby++;
            }
        }
    }
    
    // 내 돌이 있고 빈 공간이 많으면 영토 확장 가능
    if (myStonesNearby >= 2 && emptySpacesNearby >= 3) {
        expansionScore += 5.0; // 영토 확장 가능성 높음
    } else if (myStonesNearby >= 1 && emptySpacesNearby >= 2) {
        expansionScore += 2.0; // 영토 확장 가능성 있음
    }
    
    return expansionScore;
}

/**
 * 상대방 영토 확장 방지 평가
 */
function evaluateOpponentTerritoryBlock(
    board: Player[][],
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player,
    boardSize: number
): number {
    let blockScore = 0;
    
    // 주변 8방향 확인
    const directions = [
        { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
        { x: -1, y: 0 }, { x: 1, y: 0 },
        { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 }
    ];
    
    let opponentStonesNearby = 0;
    let emptySpacesNearby = 0;
    
    for (const dir of directions) {
        const nx = point.x + dir.x;
        const ny = point.y + dir.y;
        if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
            const cell = board[ny][nx];
            if (cell === opponentPlayer) {
                opponentStonesNearby++;
            } else if (cell === Player.None) {
                emptySpacesNearby++;
                // 상대방이 이 빈 공간에 두면 영토를 확장할 수 있는지 확인
                const neighbors = logic.getNeighbors(nx, ny);
                let opponentCanExpand = false;
                for (const neighbor of neighbors) {
                    if (neighbor.x >= 0 && neighbor.x < boardSize && neighbor.y >= 0 && neighbor.y < boardSize) {
                        if (board[neighbor.y][neighbor.x] === opponentPlayer) {
                            opponentCanExpand = true;
                            break;
                        }
                    }
                }
                if (opponentCanExpand) {
                    emptySpacesNearby += 0.5; // 상대방이 확장할 수 있는 빈 공간
                }
            }
        }
    }
    
    // 상대방 돌이 있고, 상대방이 확장할 수 있는 빈 공간이 많으면 방어 중요
    if (opponentStonesNearby >= 1 && emptySpacesNearby >= 2) {
        blockScore += 5.0; // 상대방 영토 확장 방지 중요
    } else if (opponentStonesNearby >= 1 && emptySpacesNearby >= 1) {
        blockScore += 2.0; // 상대방 영토 확장 방지
    }
    
    return blockScore;
}

/**
 * 10집 이상 영토 만들기 평가
 */
function evaluateLargeTerritory(
    board: Player[][],
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    boardSize: number
): number {
    let largeTerritoryScore = 0;
    
    // BFS로 연결된 빈 공간과 내 돌의 개수 확인
    const visited = new Set<string>();
    const queue: Point[] = [point];
    visited.add(`${point.x},${point.y}`);
    
    let myStonesInArea = 0;
    let emptySpacesInArea = 0;
    
    const directions = [
        { x: -1, y: 0 }, { x: 1, y: 0 },
        { x: 0, y: -1 }, { x: 0, y: 1 }
    ];
    
    while (queue.length > 0) {
        const current = queue.shift()!;
        
        for (const dir of directions) {
            const nx = current.x + dir.x;
            const ny = current.y + dir.y;
            const key = `${nx},${ny}`;
            
            if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize && !visited.has(key)) {
                visited.add(key);
                const cell = board[ny][nx];
                
                if (cell === aiPlayer) {
                    myStonesInArea++;
                    queue.push({ x: nx, y: ny });
                } else if (cell === Player.None) {
                    emptySpacesInArea++;
                    // 내 돌로 둘러싸인 빈 공간인지 확인
                    const neighbors = logic.getNeighbors(nx, ny);
                    let surroundedByMyStones = true;
                    for (const neighbor of neighbors) {
                        if (neighbor.x >= 0 && neighbor.x < boardSize && neighbor.y >= 0 && neighbor.y < boardSize) {
                            if (board[neighbor.y][neighbor.x] !== aiPlayer && board[neighbor.y][neighbor.x] !== Player.None) {
                                surroundedByMyStones = false;
                                break;
                            }
                        }
                    }
                    if (surroundedByMyStones) {
                        queue.push({ x: nx, y: ny });
                    }
                }
            }
        }
    }
    
    // 10집 이상의 영토를 만들 수 있는지 평가
    const potentialTerritory = myStonesInArea + emptySpacesInArea;
    if (potentialTerritory >= 10) {
        largeTerritoryScore += 10.0; // 10집 이상 영토 가능
    } else if (potentialTerritory >= 5) {
        largeTerritoryScore += 5.0; // 5집 이상 영토 가능
    }
    
    return largeTerritoryScore;
}

/**
 * 전투 평가
 */
function evaluateCombat(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player
): number {
    const boardSize = game.settings.boardSize;
    let combatScore = 0;

    // 상대 돌과 인접한 위치인지 확인
    const directions = [
        { x: -1, y: 0 }, { x: 1, y: 0 },
        { x: 0, y: -1 }, { x: 0, y: 1 }
    ];

    for (const dir of directions) {
        const nx = point.x + dir.x;
        const ny = point.y + dir.y;
        if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
            const cell = game.boardState[ny][nx];
            if (cell === opponentPlayer) {
                combatScore += 2; // 상대 돌과 인접
            } else if (cell === aiPlayer) {
                combatScore += 1; // 자신의 돌과 연결
            }
        }
    }

    return combatScore;
}

/**
 * 아타리(단수) 기회 평가
 */
function evaluateAtariOpportunity(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player
): number {
    const testResult = processMove(
        game.boardState,
        { ...point, player: aiPlayer },
        game.koInfo,
        game.moveHistory.length,
        { ignoreSuicide: true }
    );

    if (!testResult.isValid) return 0;

    let atariScore = 0;

    const opponentGroupsBefore = logic.getAllGroups(opponentPlayer, game.boardState);
    const opponentGroupsAfter = logic.getAllGroups(opponentPlayer, testResult.newBoardState);

    for (const groupAfter of opponentGroupsAfter) {
        const libertiesAfter = groupAfter.libertyPoints.size;
        if (libertiesAfter > 2) continue;

        const matchingBefore = opponentGroupsBefore.find(groupBefore =>
            groupBefore.stones.some(beforeStone =>
                groupAfter.stones.some(afterStone => afterStone.x === beforeStone.x && afterStone.y === beforeStone.y)
            )
        );

        if (!matchingBefore) continue;

        const libertiesBefore = matchingBefore.libertyPoints.size;
        if (libertiesAfter === 1 && libertiesBefore > libertiesAfter) {
            // 즉시 단수 상황
            atariScore += 5;
        } else if (libertiesAfter === 2 && libertiesBefore - libertiesAfter >= 2) {
            // 빠르게 단수로 몰 수 있는 경우
            atariScore += 3;
        } else if (libertiesAfter < libertiesBefore) {
            atariScore += 1.5;
        }
    }

    return atariScore;
}

/**
 * 정석/포석 평가 (간단한 구현)
 */
function evaluateJoseki(
    game: types.LiveGameSession,
    point: Point,
    aiPlayer: Player
): number {
    const boardSize = game.settings.boardSize;
    
    // 간단한 정석 위치 평가
    // 모서리 3-3, 3-4, 4-4 등 기본 포석 위치
    const cornerPositions = [
        { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 2 }, { x: 3, y: 3 },
        { x: boardSize - 3, y: 2 }, { x: boardSize - 3, y: 3 },
        { x: boardSize - 4, y: 2 }, { x: boardSize - 4, y: 3 },
        { x: 2, y: boardSize - 3 }, { x: 3, y: boardSize - 3 },
        { x: 2, y: boardSize - 4 }, { x: 3, y: boardSize - 4 },
        { x: boardSize - 3, y: boardSize - 3 }, { x: boardSize - 4, y: boardSize - 3 },
        { x: boardSize - 3, y: boardSize - 4 }, { x: boardSize - 4, y: boardSize - 4 },
    ];

    for (const pos of cornerPositions) {
        if (point.x === pos.x && point.y === pos.y) {
            return 1.0; // 정석 위치
        }
    }

    // 변의 포석 위치
    const edgePositions = [
        { x: 2, y: 0 }, { x: 3, y: 0 }, { x: boardSize - 3, y: 0 }, { x: boardSize - 4, y: 0 },
        { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 0, y: boardSize - 3 }, { x: 0, y: boardSize - 4 },
        { x: boardSize - 1, y: 2 }, { x: boardSize - 1, y: 3 },
        { x: boardSize - 1, y: boardSize - 3 }, { x: boardSize - 1, y: boardSize - 4 },
        { x: 2, y: boardSize - 1 }, { x: 3, y: boardSize - 1 },
        { x: boardSize - 3, y: boardSize - 1 }, { x: boardSize - 4, y: boardSize - 1 },
    ];

    for (const pos of edgePositions) {
        if (point.x === pos.x && point.y === pos.y) {
            return 0.7; // 변의 포석 위치
        }
    }

    return 0.3; // 일반 위치
}

/**
 * 사활 판단 평가
 */
function evaluateLifeDeath(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player
): number {
    // 자신의 그룹이 위험한지, 상대 그룹을 잡을 수 있는지 평가
    const testResult = processMove(
        game.boardState,
        { ...point, player: aiPlayer },
        game.koInfo,
        game.moveHistory.length,
        { ignoreSuicide: true }
    );

    if (!testResult.isValid) return -2; // 자살수는 매우 낮은 점수

    // 따낼 수 있으면 높은 점수
    if (testResult.capturedStones.length > 0) {
        return 1.5;
    }

    // 자신의 그룹을 살리는 수인지 확인
    const groups = logic.getAllGroups(aiPlayer, testResult.newBoardState);
    const pointGroup = groups.find(g => g.stones.some(p => p.x === point.x && p.y === point.y));
    if (pointGroup) {
        const libertyCount = pointGroup.libertyPoints.size;
        if (libertyCount >= 2) {
            return 0.8; // 그룹을 살리는 수
        }
    }

    return 0.4;
}

/**
 * 행마 평가
 */
function evaluateMovement(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player
): number {
    const boardSize = game.settings.boardSize;
    let movementScore = 0;

    // 자신의 돌과 연결되는지 확인
    const directions = [
        { x: -1, y: 0 }, { x: 1, y: 0 },
        { x: 0, y: -1 }, { x: 0, y: 1 }
    ];

    let connectedCount = 0;
    for (const dir of directions) {
        const nx = point.x + dir.x;
        const ny = point.y + dir.y;
        if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
            const cell = game.boardState[ny][nx];
            if (cell === aiPlayer) {
                connectedCount++;
                movementScore += 0.8; // 자신의 돌과 연결
            } else if (cell === Player.None) {
                movementScore += 0.3; // 빈 공간으로 확장
            }
        }
    }

    // 연결된 돌이 많을수록 좋음
    if (connectedCount >= 2) {
        movementScore += 1.0;
    }

    return movementScore;
}

/**
 * 승리 목적 달성도 평가
 */
function evaluateWinFocus(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player
): number {
    const target = getCaptureTarget(game, aiPlayer);
    if (target === undefined || target === NO_CAPTURE_TARGET) return 0;
    const currentScore = game.captures[aiPlayer] || 0;
    const remainingScore = target - currentScore;

    // 목표 점수에 가까울수록 높은 점수
    if (remainingScore <= 0) return 0; // 이미 달성

    // 이 수로 따낼 수 있는 점수 확인
    const testResult = processMove(
        game.boardState,
        { ...point, player: aiPlayer },
        game.koInfo,
        game.moveHistory.length,
        { ignoreSuicide: true }
    );

    if (testResult.isValid && testResult.capturedStones.length > 0) {
        let captureScore = 0;
        for (const stone of testResult.capturedStones) {
            const wasPatternStone = (opponentPlayer === Player.Black && game.blackPatternStones?.some(p => p.x === stone.x && p.y === stone.y)) ||
                                    (opponentPlayer === Player.White && game.whitePatternStones?.some(p => p.x === stone.x && p.y === stone.y));
            captureScore += wasPatternStone ? 2 : 1;
        }

        // 목표 달성에 가까운 수일수록 높은 점수
        if (currentScore + captureScore >= target) {
            return 10.0; // 승리 수
        } else if (remainingScore <= 3) {
            return captureScore * 2; // 목표에 가까움
        } else {
            return captureScore;
        }
    }

    return 0;
}

/**
 * 빠른 휴리스틱 점수화 (낮은 난이도용, 성능 최적화)
 * 간단한 따내기와 기본적인 안전성만 평가
 */
function scoreMovesFast(
    moves: Point[],
    game: types.LiveGameSession,
    profile: GoAiBotProfile,
    logic: ReturnType<typeof getGoLogic>,
    aiPlayer: Player,
    opponentPlayer: Player
): Array<{ move: Point; score: number }> {
    const scoredMoves: Array<{ move: Point; score: number }> = [];

    for (const move of moves) {
        let score = 0;
        const point: Point = { x: move.x, y: move.y };

        const testResult = processMove(
            game.boardState,
            { ...point, player: aiPlayer },
            game.koInfo,
            game.moveHistory.length,
            { ignoreSuicide: true }
        );
        const captureScore = evaluateCaptureOpportunity(game, logic, point, aiPlayer, opponentPlayer);
        const pveCaptureFirst = isSinglePlayerOrTowerPve(game);
        const pveCapFast = isPveCaptureMode(game);

        if (pveCaptureFirst) {
            if (pveCapFast) {
                // 따내기 PvE: 즉시 따내기 우선 (저난이도 휴리스틱 강화)
                if (captureScore > 0) {
                    score += 62000 + captureScore * 2800;
                }
            } else {
                // 계가 PvE: 영토·전략 점수를 두고 따내기는 보조
                if (captureScore > 0) {
                    score += 14000 + captureScore * 900;
                }
                const tsFast = evaluateTerritory(game, logic, point, aiPlayer, profile);
                if (tsFast > 5.0) {
                    score += tsFast * profile.territoryTendency * 165;
                } else if (tsFast < 0) {
                    score += tsFast * profile.territoryTendency * 85;
                } else {
                    score += tsFast * profile.territoryTendency * 48;
                }
                score += evaluateTerritoryStrategy(game, logic, point, aiPlayer, opponentPlayer, profile) * 1.38;
            }
            if (testResult.isValid) {
                const myGroupsBefore = logic.getAllGroups(aiPlayer, game.boardState);
                const myGroupsAfter = logic.getAllGroups(aiPlayer, testResult.newBoardState);
                for (const groupBefore of myGroupsBefore) {
                    if (groupBefore.libertyPoints.size === 1) {
                        const matchingAfter = myGroupsAfter.find(ga =>
                            ga.stones.some(ast => groupBefore.stones.some(bst => ast.x === bst.x && ast.y === bst.y))
                        );
                        if (matchingAfter && matchingAfter.libertyPoints.size > 1) {
                            const groupSize = groupBefore.stones.length;
                            score += pveCapFast ? 7800 + groupSize * 620 : 8800 + groupSize * 900;
                        }
                    }
                }
            }
        } else {
            // 0. 자신의 단수 그룹을 살리기 (최우선 - 따내기보다도 우선)
            if (testResult.isValid) {
                const myGroupsBefore = logic.getAllGroups(aiPlayer, game.boardState);
                const myGroupsAfter = logic.getAllGroups(aiPlayer, testResult.newBoardState);
                for (const groupBefore of myGroupsBefore) {
                    if (groupBefore.libertyPoints.size === 1) {
                        const matchingAfter = myGroupsAfter.find(ga =>
                            ga.stones.some(ast => groupBefore.stones.some(bst => ast.x === bst.x && ast.y === bst.y))
                        );
                        if (matchingAfter && matchingAfter.libertyPoints.size > 1) {
                            const groupSize = groupBefore.stones.length;
                            score += 8000 + groupSize * 1000;
                        }
                    }
                }
            }
            // 1. 즉시 따내기 기회
            if (captureScore > 0) {
                score += 5000 + captureScore * 500;
            }
        }

        // 2. 아타리(단수) 기회
        const atariScore = evaluateAtariOpportunity(game, logic, point, aiPlayer, opponentPlayer);
        if (atariScore > 0) {
            const atFastMul = pveCapFast ? 1.38 : pveCaptureFirst && !pveCapFast ? 0.94 : 1;
            score += (2000 + atariScore * 200) * atFastMul; // 높은 점수
        }

        // 2-1. 유저 돌 근처로 접근 (공격적 접근)
        const proximityScore = evaluateProximityToOpponent(game, logic, point, opponentPlayer);
        const proxFastMul = pveCapFast ? 1.32 : pveCaptureFirst && !pveCapFast ? 0.88 : 1;
        score += proximityScore * 300 * proxFastMul; // 유저 돌 근처로 가는 수

        // 2-2. 공격 기회 평가 (유저 그룹 위협)
        const attackScore = evaluateAttackOpportunity(game, logic, point, aiPlayer, opponentPlayer);
        const atkFastMul = pveCapFast ? 1.35 : pveCaptureFirst && !pveCapFast ? 0.82 : 1;
        score += attackScore * 250 * atkFastMul; // 유저 그룹을 위협하는 수

        // 3. 기본 안전성 (간단한 자유도 체크만)
        // 자충수 체크 (먹여치기/환격수는 예외)
        // testResult는 이미 위에서 선언되었으므로 재사용
        if (testResult.isValid) {
            const groups = logic.getAllGroups(aiPlayer, testResult.newBoardState);
            const pointGroup = groups.find(g => g.stones.some(p => p.x === point.x && p.y === point.y));
            if (pointGroup) {
                const libertyCount = pointGroup.libertyPoints.size;
                // 자충수 체크 (활로가 1개이고 따낸 돌이 없으면 자충수)
                if (libertyCount === 1 && testResult.capturedStones.length === 0) {
                    // 자충수인 경우 매우 낮은 점수로 설정
                    score = -100000; // 매우 큰 음수로 설정하여 거의 선택되지 않도록 함
                } else {
                    if (libertyCount >= 3) score += 50;
                    else if (libertyCount >= 2) score += 30;
                    else if (libertyCount >= 1) score += 10;
                }
            }
        }

        // 4. 프로필 기반 가중치 적용
        score *= (1 + profile.captureTendency * 0.5);

        scoredMoves.push({ move, score });
    }

    // 점수 순으로 정렬
    scoredMoves.sort((a, b) => b.score - a.score);

    return scoredMoves;
}

/**
 * 살리기 바둑 모드: AI(백)가 유저(흑)의 돌을 적극적으로 잡으러 오는 전략으로 수를 점수화
 */
function scoreMovesForAggressiveCapture(
    moves: Point[],
    game: types.LiveGameSession,
    profile: GoAiBotProfile,
    logic: ReturnType<typeof getGoLogic>,
    aiPlayer: Player,
    opponentPlayer: Player
): Array<{ move: Point; score: number }> {
    const scoredMoves: Array<{ move: Point; score: number }> = [];

    for (const move of moves) {
        let score = 0;
        const point: Point = { x: move.x, y: move.y };

        // 살리기 바둑의 목표: 유저(흑)의 돌을 적극적으로 잡기
        // 하지만 자신의 단수 그룹을 살리는 것은 최우선

        // 0. 자신의 단수 그룹을 살리기 (최우선 - 따내기보다도 우선)
        const testResult = processMove(
            game.boardState,
            { ...point, player: aiPlayer },
            game.koInfo,
            game.moveHistory.length,
            { ignoreSuicide: true }
        );
        if (testResult.isValid) {
            const myGroupsBefore = logic.getAllGroups(aiPlayer, game.boardState);
            const myGroupsAfter = logic.getAllGroups(aiPlayer, testResult.newBoardState);
            for (const groupBefore of myGroupsBefore) {
                if (groupBefore.libertyPoints.size === 1) {
                    const matchingAfter = myGroupsAfter.find(ga =>
                        ga.stones.some(ast => groupBefore.stones.some(bst => ast.x === bst.x && ast.y === bst.y))
                    );
                    if (matchingAfter && matchingAfter.libertyPoints.size > 1) {
                        // 자신의 단수 그룹을 살린 경우 - 최우선 점수
                        const groupSize = groupBefore.stones.length;
                        score += 10000 + groupSize * 1500; // 매우 높은 점수로 최우선 처리
                    }
                }
            }
        }

        // 1. 따내기 기회 평가 (최우선) - 유저의 돌을 잡을 수 있는 수
        const captureScore = evaluateCaptureOpportunity(game, logic, point, aiPlayer, opponentPlayer);
        if (captureScore > 0) {
            score += 5000 + captureScore * 800; // 따내기가 최우선 (매우 높은 가중치)
        }

        // 2. 공격 기회 평가 - 유저의 돌을 위협하는 수
        const attackScore = evaluateAttackOpportunity(game, logic, point, aiPlayer, opponentPlayer);
        score += attackScore * 500; // 공격 기회도 매우 높은 점수

        // 3. 유저 돌과의 근접성 평가 - 유저 돌 근처로 가는 수
        const proximityScore = evaluateProximityToOpponent(game, logic, point, opponentPlayer);
        score += proximityScore * 400; // 유저 돌 근처로 접근 (높은 가중치)

        // 4. 유저 그룹을 포위하는 수 평가
        const surroundScore = evaluateSurroundOpportunity(game, logic, point, aiPlayer, opponentPlayer);
        score += surroundScore * 350; // 유저 그룹 포위 (높은 가중치)

        // 5. 전투 성향 반영 - 유저와 전투를 벌이는 수
        const combatScore = evaluateCombat(game, logic, point, aiPlayer, opponentPlayer);
        score += combatScore * 150; // 전투 성향 (가중치 증가)

        // 5-1. 자충수 방지 (먹여치기/환격수는 예외)
        // 단수당한 자신의 돌을 살리는 경우는 이미 위에서 처리됨
        if (testResult.isValid) {
            const groups = logic.getAllGroups(aiPlayer, testResult.newBoardState);
            const pointGroup = groups.find(g => g.stones.some(p => p.x === point.x && p.y === point.y));
            if (pointGroup) {
                const libertyCount = pointGroup.libertyPoints.size;
                // 자충수 체크 (활로가 1개이고 따낸 돌이 없으면 자충수)
                if (libertyCount === 1 && testResult.capturedStones.length === 0) {
                    // 자충수인 경우 매우 낮은 점수로 설정
                    score = -100000; // 매우 큰 음수로 설정하여 거의 선택되지 않도록 함
                }
            }
        }

        // 6. 자신의 안전성도 약간 고려 (너무 위험한 수는 피하기)
        const safetyScore = evaluateSafety(game, logic, point, aiPlayer);
        score += safetyScore * 20; // 안전성은 매우 낮은 가중치 (공격 우선)

        // 7. 실수 확률 적용 (공격 모드에서는 실수율 감소)
        if (Math.random() < profile.mistakeRate * 0.3) { // 살리기 공격 모드에서는 실수율 더 감소
            score *= 0.95; // 실수 시에도 점수 감소를 최소화
        }

        scoredMoves.push({ move, score });
    }

    // 점수 순으로 정렬
    scoredMoves.sort((a, b) => b.score - a.score);

    return scoredMoves;
}

/**
 * 공격 기회 평가 - 유저의 돌을 위협할 수 있는 수
 */
function evaluateAttackOpportunity(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player
): number {
    const testResult = processMove(
        game.boardState,
        { ...point, player: aiPlayer },
        game.koInfo,
        game.moveHistory.length,
        { ignoreSuicide: true }
    );

    if (!testResult.isValid) return 0;

    // 이 수를 둔 후 유저의 그룹이 위험해지는지 확인
    const opponentGroups = logic.getAllGroups(opponentPlayer, testResult.newBoardState);
    let attackScore = 0;

    for (const group of opponentGroups) {
        const libertyCount = group.libertyPoints.size;
        // 유저 그룹의 자유도가 적을수록 공격 성공 가능성 높음
        if (libertyCount === 1) {
            attackScore += 5.0; // 다음 턴에 잡을 수 있는 위치 (점수 증가)
        } else if (libertyCount === 2) {
            attackScore += 3.5; // 2턴 안에 잡을 수 있는 위치 (점수 증가)
        } else if (libertyCount === 3) {
            attackScore += 2.0; // 위협적인 위치 (점수 증가)
        } else if (libertyCount === 4) {
            attackScore += 1.0; // 약간 위협적인 위치 (추가)
        }

        // 이 수가 유저 그룹의 자유도를 감소시켰는지 확인 (이전 상태와 비교)
        const oldOpponentGroups = logic.getAllGroups(opponentPlayer, game.boardState);
        const oldGroup = oldOpponentGroups.find(g => 
            g.stones.some(s => group.stones.some(gs => gs.x === s.x && gs.y === s.y))
        );
        if (oldGroup && libertyCount < oldGroup.libertyPoints.size) {
            attackScore += 2.5; // 자유도를 줄인 수 (점수 증가)
        }
    }

    return attackScore;
}

/**
 * 유저 돌과의 근접성 평가 - 유저 돌 근처로 가는 수
 */
function evaluateProximityToOpponent(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    opponentPlayer: Player
): number {
    const boardSize = game.settings.boardSize;
    let minDistance = Infinity;
    let nearbyOpponentStones = 0;

    // 모든 유저 돌과의 최단 거리 계산
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (game.boardState[y][x] === opponentPlayer) {
                const distance = Math.abs(point.x - x) + Math.abs(point.y - y);
                minDistance = Math.min(minDistance, distance);
                
                // 근처의 유저 돌 개수 (거리 2 이내)
                if (distance <= 2) {
                    nearbyOpponentStones++;
                }
            }
        }
    }

    // 거리가 가까울수록 높은 점수 (공격적)
    if (minDistance === Infinity) return 0.0; // 유저 돌이 없음
    if (minDistance === 1) return 2.0; // 바로 인접 (최고 점수, 점수 증가)
    if (minDistance === 2) return 1.5; // 2칸 거리 (점수 증가)
    if (minDistance === 3) return 1.0; // 3칸 거리 (점수 증가)
    if (minDistance === 4) return 0.5; // 4칸 거리 (점수 증가)
    if (minDistance >= 5) return 0.1; // 멀면 낮은 점수

    // 근처에 유저 돌이 많을수록 더 높은 점수
    return Math.min(2.0, nearbyOpponentStones / 2.0); // 최대 점수 증가
}

/**
 * 유저 그룹 포위 기회 평가
 */
function evaluateSurroundOpportunity(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player
): number {
    const testResult = processMove(
        game.boardState,
        { ...point, player: aiPlayer },
        game.koInfo,
        game.moveHistory.length,
        { ignoreSuicide: true }
    );

    if (!testResult.isValid) return 0;

    const boardSize = game.settings.boardSize;
    let surroundScore = 0;

    // 이 수 주변의 유저 그룹 확인
    const directions = [
        { x: -1, y: 0 }, { x: 1, y: 0 },
        { x: 0, y: -1 }, { x: 0, y: 1 }
    ];

    for (const dir of directions) {
        const nx = point.x + dir.x;
        const ny = point.y + dir.y;
        if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
            if (testResult.newBoardState[ny][nx] === opponentPlayer) {
                // 유저 돌과 인접한 위치에 자신의 돌을 둠
                const opponentGroups = logic.getAllGroups(opponentPlayer, testResult.newBoardState);
                const nearbyGroup = opponentGroups.find(g => 
                    g.stones.some(p => p.x === nx && p.y === ny)
                );
                
                if (nearbyGroup) {
                    const libertyCount = nearbyGroup.libertyPoints.size;
                    // 유저 그룹을 포위하는 수일수록 높은 점수
                    if (libertyCount === 1) {
                        surroundScore += 4.0; // 거의 잡을 수 있는 위치 (점수 증가)
                    } else if (libertyCount === 2) {
                        surroundScore += 3.0; // 위험한 위치 (점수 증가)
                    } else if (libertyCount === 3) {
                        surroundScore += 2.0; // 포위 중 (점수 증가)
                    } else if (libertyCount === 4) {
                        surroundScore += 1.0; // 약간 포위 (추가)
                    }
                }
            }
        }
    }

    return surroundScore;
}

/**
 * 안전성 평가 (자신의 그룹을 살리는 수)
 */
function evaluateSafety(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player
): number {
    const testResult = processMove(
        game.boardState,
        { ...point, player: aiPlayer },
        game.koInfo,
        game.moveHistory.length,
        { ignoreSuicide: true }
    );

    if (!testResult.isValid) return -1.0; // 자살수는 매우 위험

    // 자신의 그룹의 자유도 확인
    const groups = logic.getAllGroups(aiPlayer, testResult.newBoardState);
    const pointGroup = groups.find(g => g.stones.some(p => p.x === point.x && p.y === point.y));
    
    if (pointGroup) {
        const libertyCount = pointGroup.libertyPoints.size;
        if (libertyCount >= 3) return 1.0; // 매우 안전
        if (libertyCount >= 2) return 0.7; // 안전
        if (libertyCount >= 1) return 0.3; // 위험
        return 0.0; // 매우 위험 (자유도 없음)
    }

    return 0.5; // 새로운 그룹 생성
}

/**
 * 포위된 그룹의 탈출 평가 (넓은 방향으로 연결하며 탈출)
 */
function evaluateEscapeFromSurround(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player
): number {
    const testResult = processMove(
        game.boardState,
        { ...point, player: aiPlayer },
        game.koInfo,
        game.moveHistory.length,
        { ignoreSuicide: true }
    );

    if (!testResult.isValid) return 0;

    let escapeScore = 0;
    const myGroups = logic.getAllGroups(aiPlayer, game.boardState);
    const opponentGroups = logic.getAllGroups(opponentPlayer, game.boardState);

    // 자신의 그룹 중 포위당한 그룹 찾기
    for (const myGroup of myGroups) {
        const libertyCount = myGroup.libertyPoints.size;
        
        // 활로가 적은 그룹 (포위당한 그룹)
        if (libertyCount <= 3) {
            // 이 수로 이 그룹과 연결되는지 확인
            const myGroupsAfter = logic.getAllGroups(aiPlayer, testResult.newBoardState);
            const connectedGroup = myGroupsAfter.find(ga =>
                ga.stones.some(ast => myGroup.stones.some(bst => ast.x === bst.x && ast.y === bst.y))
            );

            if (connectedGroup) {
                const newLibertyCount = connectedGroup.libertyPoints.size;
                
                // 활로가 증가했으면 탈출 시도
                if (newLibertyCount > libertyCount) {
                    const libertyIncrease = newLibertyCount - libertyCount;
                    
                    // 활로 증가량에 따라 점수 부여
                    escapeScore += 3.0 + libertyIncrease * 2.0; // 기본 3점 + 활로 증가당 2점
                    
                    // 넓은 방향으로 탈출하는지 확인
                    // 주변의 빈 공간(활로) 개수 확인
                    const directions = [
                        { x: -1, y: 0 }, { x: 1, y: 0 },
                        { x: 0, y: -1 }, { x: 0, y: 1 }
                    ];
                    
                    let wideDirectionScore = 0;
                    for (const dir of directions) {
                        const nx = point.x + dir.x;
                        const ny = point.y + dir.y;
                        if (nx >= 0 && nx < game.settings.boardSize && ny >= 0 && ny < game.settings.boardSize) {
                            const cell = testResult.newBoardState[ny][nx];
                            if (cell === Player.None) {
                                // 빈 공간이면 넓은 방향
                                wideDirectionScore += 1.0;
                            }
                        }
                    }
                    
                    // 넓은 방향으로 탈출하면 추가 점수
                    if (wideDirectionScore >= 2) {
                        escapeScore += 2.0; // 넓은 방향으로 탈출
                    }
                    
                    // 상대 그룹이 근처에 있으면 더 긴급함
                    for (const oppGroup of opponentGroups) {
                        for (const stone of oppGroup.stones) {
                            const distance = Math.abs(point.x - stone.x) + Math.abs(point.y - stone.y);
                            if (distance <= 2) {
                                escapeScore += 1.5; // 상대 그룹 근처 탈출은 더 중요
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    return escapeScore;
}

/**
 * 도망 평가 (상대 돌과 멀어지는 수)
 */
function evaluateEscape(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player
): number {
    const boardSize = game.settings.boardSize;
    let escapeScore = 0;

    // 자신의 돌들의 평균 위치 계산
    let totalX = 0, totalY = 0, count = 0;
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (game.boardState[y][x] === aiPlayer) {
                totalX += x;
                totalY += y;
                count++;
            }
        }
    }

    if (count === 0) return 0.5; // 자신의 돌이 없음

    const avgX = totalX / count;
    const avgY = totalY / count;

    // 자신의 돌들과의 거리 (너무 멀면 안됨, 적당히 떨어져야 함)
    const distanceFromGroup = Math.abs(point.x - avgX) + Math.abs(point.y - avgY);
    if (distanceFromGroup >= 1 && distanceFromGroup <= 3) {
        escapeScore += 0.8; // 적당한 거리로 이동
    }

    // 상대 돌들과의 거리
    let minOpponentDistance = Infinity;
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (game.boardState[y][x] === opponentPlayer) {
                const distance = Math.abs(point.x - x) + Math.abs(point.y - y);
                minOpponentDistance = Math.min(minOpponentDistance, distance);
            }
        }
    }

    if (minOpponentDistance >= 3) {
        escapeScore += 0.5; // 상대와 멀리 떨어짐
    }

    return escapeScore;
}

/**
 * 자유도 증가 평가
 */
function evaluateLibertyGain(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player
): number {
    const testResult = processMove(
        game.boardState,
        { ...point, player: aiPlayer },
        game.koInfo,
        game.moveHistory.length,
        { ignoreSuicide: true }
    );

    if (!testResult.isValid) return 0;

    const groups = logic.getAllGroups(aiPlayer, testResult.newBoardState);
    const pointGroup = groups.find(g => g.stones.some(p => p.x === point.x && p.y === point.y));
    
    if (pointGroup) {
        const libertyCount = pointGroup.libertyPoints.size;
        // 자유도가 많을수록 좋음
        return Math.min(1.0, libertyCount / 5.0);
    }

    return 0.3; // 새로운 그룹
}

/**
 * 그룹의 가치 평가 (살리기 vs 따내기 판단용)
 */
function evaluateGroupValue(
    group: { stones: Point[]; liberties: number; libertyPoints: Set<string>; player: Player },
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    aiPlayer: Player,
    profile: GoAiBotProfile
): number {
    const boardSize = game.settings.boardSize;
    let value = 0;
    
    // 1. 그룹 크기 (큰 그룹일수록 더 가치 있음)
    const groupSize = group.stones.length;
    value += groupSize * 2.0; // 그룹 크기당 2점
    
    // 2. 그룹의 위치 (중앙에 가까울수록 더 가치 있음)
    let avgX = 0, avgY = 0;
    for (const stone of group.stones) {
        avgX += stone.x;
        avgY += stone.y;
    }
    avgX /= groupSize;
    avgY /= groupSize;
    const centerX = boardSize / 2;
    const centerY = boardSize / 2;
    const distanceFromCenter = Math.abs(avgX - centerX) + Math.abs(avgY - centerY);
    const maxDistance = boardSize;
    const centrality = 1.0 - (distanceFromCenter / maxDistance);
    value += centrality * 5.0; // 중앙에 가까울수록 더 가치 있음
    
    // 3. 그룹의 활로 수 (활로가 많을수록 더 가치 있음)
    const libertyCount = group.libertyPoints.size;
    value += libertyCount * 1.5; // 활로당 1.5점
    
    // 4. 게임 진행 상황 (후반일수록 큰 그룹이 더 중요)
    const moveCount = game.moveHistory.length;
    const totalSpaces = boardSize * boardSize;
    const gameProgress = Math.min(1.0, moveCount / (totalSpaces * 0.7)); // 70% 진행 시 1.0
    if (gameProgress > 0.6) {
        // 후반일수록 큰 그룹의 가치 증가
        value += groupSize * gameProgress * 1.5;
    }
    
    // 5. AI 난이도에 따른 가치 판단 능력 (높을수록 더 정확한 판단)
    const judgmentSkill = profile.lifeDeathSkill;
    value *= (0.7 + judgmentSkill * 0.3); // 낮은 난이도는 가치를 약간 낮게 평가
    
    return value;
}

/**
 * 2단계: 자충수 방지 평가
 */
function evaluateSelfAtari(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player
): number {
    const testResult = processMove(
        game.boardState,
        { ...point, player: aiPlayer },
        game.koInfo,
        game.moveHistory.length,
        { ignoreSuicide: true }
    );

    if (!testResult.isValid) return 1.0; // 자충수는 1.0 반환 (패널티)

    const groups = logic.getAllGroups(aiPlayer, testResult.newBoardState);
    const pointGroup = groups.find(g => g.stones.some(p => p.x === point.x && p.y === point.y));
    
    if (pointGroup) {
        const libertyCount = pointGroup.libertyPoints.size;
        // 자유도가 1이면 자충수
        if (libertyCount === 1) {
            // 하지만 따낼 수 있으면 괜찮음 (먹여치기)
            if (testResult.capturedStones.length > 0) {
                return 0.0; // 먹여치기는 괜찮음
            }
            return 1.0; // 자충수
        }
    }

    return 0.0; // 자충수 아님
}

/**
 * 3단계: 먹여치기 및 환격 평가
 */
function evaluateSacrificeAndCounter(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player
): number {
    const testResult = processMove(
        game.boardState,
        { ...point, player: aiPlayer },
        game.koInfo,
        game.moveHistory.length,
        { ignoreSuicide: true }
    );

    if (!testResult.isValid) return 0;

    let score = 0;

    // 먹여치기: 자충수를 두지만 상대를 따낼 수 있는 경우
    const groups = logic.getAllGroups(aiPlayer, testResult.newBoardState);
    const pointGroup = groups.find(g => g.stones.some(p => p.x === point.x && p.y === point.y));
    
    if (pointGroup && pointGroup.libertyPoints.size === 1 && testResult.capturedStones.length > 0) {
        score += 3.0; // 먹여치기
    }

    // 환격: 상대가 따내려고 할 때 역으로 따내기
    // 상대 그룹이 단수 상태이고, 이 수로 역으로 따낼 수 있는 경우
    const opponentGroups = logic.getAllGroups(opponentPlayer, game.boardState);
    for (const oppGroup of opponentGroups) {
        if (oppGroup.libertyPoints.size === 1) {
            const liberty = Array.from(oppGroup.libertyPoints)[0];
            const [lx, ly] = liberty.split(',').map(Number);
            if (lx === point.x && ly === point.y) {
                // 상대의 단수 자리에 두어서 역으로 따낼 수 있는 경우
                if (testResult.capturedStones.length > 0) {
                    score += 4.0; // 환격
                }
            }
        }
    }

    return score;
}

/**
 * 4단계: 단수 상황 판단 (따내기 vs 살리기)
 */
function evaluateAtariJudgment(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player
): number {
    const testResult = processMove(
        game.boardState,
        { ...point, player: aiPlayer },
        game.koInfo,
        game.moveHistory.length,
        { ignoreSuicide: true }
    );

    if (!testResult.isValid) return 0;

    let score = 0;

    // 상대 그룹을 단수로 만들 수 있는 경우
    const opponentGroupsBefore = logic.getAllGroups(opponentPlayer, game.boardState);
    const opponentGroupsAfter = logic.getAllGroups(opponentPlayer, testResult.newBoardState);

    for (const groupAfter of opponentGroupsAfter) {
        if (groupAfter.libertyPoints.size === 1) {
            const matchingBefore = opponentGroupsBefore.find(gb =>
                gb.stones.some(bs => groupAfter.stones.some(as => as.x === bs.x && as.y === bs.y))
            );
            if (matchingBefore && matchingBefore.libertyPoints.size > 1) {
                // 상대 그룹을 단수로 만든 경우
                score += 2.0;
            }
        }
    }

    // 자신의 그룹이 단수 상태일 때 살리기 (최우선)
    const myGroupsBefore = logic.getAllGroups(aiPlayer, game.boardState);
    const myGroupsAfter = logic.getAllGroups(aiPlayer, testResult.newBoardState);
    
    for (const groupBefore of myGroupsBefore) {
        if (groupBefore.libertyPoints.size === 1) {
            const matchingAfter = myGroupsAfter.find(ga =>
                ga.stones.some(ast => groupBefore.stones.some(bst => ast.x === bst.x && ast.y === bst.y))
            );
            if (matchingAfter && matchingAfter.libertyPoints.size > 1) {
                // 자신의 단수 그룹을 살린 경우 - 매우 높은 점수 (최우선)
                const groupSize = groupBefore.stones.length;
                // 그룹 크기에 따라 점수 차등 (큰 그룹일수록 더 중요)
                score += 15.0 + groupSize * 2.0; // 기본 15점 + 그룹 크기당 2점
            }
        }
    }

    return score;
}

/**
 * 5단계: 방향성 공격 평가
 */
function evaluateDirectionalAttack(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player
): number {
    const boardSize = game.settings.boardSize;
    let score = 0;

    // 1선 방향으로 몰기 (변으로 몰기)
    const isEdge = point.x === 0 || point.x === boardSize - 1 || point.y === 0 || point.y === boardSize - 1;
    if (isEdge) {
        // 상대 돌이 근처에 있으면 변으로 몰기
        const directions = [
            { x: -1, y: 0 }, { x: 1, y: 0 },
            { x: 0, y: -1 }, { x: 0, y: 1 }
        ];
        for (const dir of directions) {
            const nx = point.x + dir.x;
            const ny = point.y + dir.y;
            if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
                if (game.boardState[ny][nx] === opponentPlayer) {
                    score += 1.5; // 변으로 몰기
                }
            }
        }
    }

    // 우리편 방향으로 몰기
    const myGroups = logic.getAllGroups(aiPlayer, game.boardState);
    if (myGroups.length > 0) {
        const nearestGroup = myGroups.reduce((nearest, group) => {
            const groupCenter = {
                x: group.stones.reduce((sum, s) => sum + s.x, 0) / group.stones.length,
                y: group.stones.reduce((sum, s) => sum + s.y, 0) / group.stones.length
            };
            const dist = Math.abs(point.x - groupCenter.x) + Math.abs(point.y - groupCenter.y);
            return dist < nearest.dist ? { group, dist } : nearest;
        }, { group: myGroups[0], dist: Infinity });

        const groupCenter = {
            x: nearestGroup.group.stones.reduce((sum, s) => sum + s.x, 0) / nearestGroup.group.stones.length,
            y: nearestGroup.group.stones.reduce((sum, s) => sum + s.y, 0) / nearestGroup.group.stones.length
        };
        
        // 우리편 그룹 방향으로 상대를 몰기
        const oppGroups = logic.getAllGroups(opponentPlayer, game.boardState);
        for (const oppGroup of oppGroups) {
            const oppCenter = {
                x: oppGroup.stones.reduce((sum, s) => sum + s.x, 0) / oppGroup.stones.length,
                y: oppGroup.stones.reduce((sum, s) => sum + s.y, 0) / oppGroup.stones.length
            };
            
            // 상대 그룹이 우리편 그룹과 이 수 사이에 있으면 좋음
            const toMyGroup = { x: groupCenter.x - point.x, y: groupCenter.y - point.y };
            const toOppGroup = { x: oppCenter.x - point.x, y: oppCenter.y - point.y };
            const dotProduct = toMyGroup.x * toOppGroup.x + toMyGroup.y * toOppGroup.y;
            if (dotProduct > 0) {
                score += 2.0; // 우리편 방향으로 몰기
            }
        }
    }

    // 도망치기 힘든 방향으로 몰기 (변과 모서리)
    if (isEdge) {
        const isCorner = (point.x === 0 || point.x === boardSize - 1) && 
                         (point.y === 0 || point.y === boardSize - 1);
        if (isCorner) {
            score += 2.5; // 모서리는 도망치기 매우 힘듦
        } else {
            score += 1.5; // 변은 도망치기 힘듦
        }
    }

    return score;
}

/**
 * 6단계: 초반 포석 평가 (3-4선 선호)
 * AI 레벨에 따라 선의 높이 선호도가 달라짐
 */
function evaluateFuseki(
    game: types.LiveGameSession,
    point: Point,
    aiPlayer: Player,
    aiLevel: number
): number {
    const boardSize = game.settings.boardSize;
    const moveCount = game.moveHistory.length;
    
    if (moveCount > 50) return 0; // 초반 50수까지만

    let score = 0;

    // 선의 높이 계산 (1선 = 가장자리, 2선, 3선, 4선...)
    const distanceFromEdge = Math.min(
        point.x,
        point.y,
        boardSize - 1 - point.x,
        boardSize - 1 - point.y
    );
    const line = distanceFromEdge + 1; // 1선부터 시작

    // AI 레벨에 따른 선의 높이 선호도
    if (aiLevel >= 7) {
        // 최고 등급 (7-10단계): 3-4선 주로, 가끔 2선과 5선, 1선과 6선 이상은 거의 안 둠
        if (line === 3 || line === 4) {
            score += 5.0; // 3-4선: 매우 높은 점수
        } else if (line === 2 || line === 5) {
            score += 0.5; // 2선, 5선: 약간의 점수 (가끔)
        } else if (line === 1) {
            score -= 10.0; // 1선: 매우 큰 패널티 (거의 안 둠)
        } else if (line >= 6) {
            score -= 8.0; // 6선 이상: 큰 패널티 (거의 안 둠)
        }
    } else if (aiLevel >= 4) {
        // 중간 등급 (4-6단계): 3-4선 선호, 2선과 5선은 약간 패널티, 1선과 6선 이상은 패널티
        if (line === 3 || line === 4) {
            score += 3.0; // 3-4선: 높은 점수
        } else if (line === 2 || line === 5) {
            score -= 1.0; // 2선, 5선: 약간 패널티
        } else if (line === 1) {
            score -= 3.0; // 1선: 패널티
        } else if (line >= 6) {
            score -= 2.0; // 6선 이상: 패널티
        }
    } else {
        // 하위 등급 (1-3단계): 기존 로직 유지
        if (line === 3 || line === 4) {
            score += 2.0; // 좋은 선
        } else if (line === 1) {
            score -= 1.5; // 1선은 나쁨
        } else if (line === 2) {
            score -= 1.0; // 2선도 나쁨
        } else {
            score -= 0.5; // 5선 이상도 나쁨
        }
    }

    // 모서리 3-3, 3-4, 4-4 등 좋은 포석 위치
    const cornerPositions = [
        { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 2 }, { x: 3, y: 3 },
        { x: boardSize - 3, y: 2 }, { x: boardSize - 3, y: 3 },
        { x: boardSize - 4, y: 2 }, { x: boardSize - 4, y: 3 },
        { x: 2, y: boardSize - 3 }, { x: 3, y: boardSize - 3 },
        { x: 2, y: boardSize - 4 }, { x: 3, y: boardSize - 4 },
        { x: boardSize - 3, y: boardSize - 3 }, { x: boardSize - 4, y: boardSize - 3 },
        { x: boardSize - 3, y: boardSize - 4 }, { x: boardSize - 4, y: boardSize - 4 },
    ];

    for (const pos of cornerPositions) {
        if (point.x === pos.x && point.y === pos.y) {
            score += 3.0; // 정석 위치
            break;
        }
    }

    return score;
}

/**
 * 7단계: 영토 확보 및 전투 평가
 */
function evaluateTerritoryAndCombat(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player
): number {
    let score = 0;

    // 적은 돌로 많은 영토 확보
    const territoryScore = evaluateTerritory(game, logic, point, aiPlayer);
    const combatScore = evaluateCombat(game, logic, point, aiPlayer, opponentPlayer);
    
    // 영토와 전투의 균형
    score += territoryScore * 0.6 + combatScore * 0.4;

    // 영토를 넓히기 위해 상대와 부딪혀 싸우기
    if (combatScore > 0) {
        score += 1.0; // 전투를 통한 영토 확보
    }

    return score;
}

/**
 * 8단계: 고급 기술 평가 (촉촉수, 축, 장문, 환격, 먹여치기)
 */
function evaluateAdvancedTechniques(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player
): number {
    let score = 0;

    // 촉촉수: 연속 단수공격할 수 있는 방향으로 3수 앞 내다보기
    const testResult = processMove(
        game.boardState,
        { ...point, player: aiPlayer },
        game.koInfo,
        game.moveHistory.length,
        { ignoreSuicide: true }
    );

    if (!testResult.isValid) return 0;

    // 상대 그룹을 단수로 만들고, 다음에도 계속 단수 공격 가능한지 확인
    const opponentGroupsAfter = logic.getAllGroups(opponentPlayer, testResult.newBoardState);
    for (const group of opponentGroupsAfter) {
        if (group.libertyPoints.size === 1) {
            // 다음 수에도 단수 공격 가능한지 시뮬레이션
            const liberty = Array.from(group.libertyPoints)[0];
            const [lx, ly] = liberty.split(',').map(Number);
            const nextMoveResult = processMove(
                testResult.newBoardState,
                { x: lx, y: ly, player: aiPlayer },
                null,
                game.moveHistory.length + 1,
                { ignoreSuicide: true }
            );
            if (nextMoveResult.isValid) {
                const nextOppGroups = logic.getAllGroups(opponentPlayer, nextMoveResult.newBoardState);
                for (const nextGroup of nextOppGroups) {
                    if (nextGroup.libertyPoints.size === 1) {
                        score += 3.0; // 촉촉수
                    }
                }
            }
        }
    }

    // 축: 상대 돌을 포위하는 수
    const directions = [
        { x: -1, y: 0 }, { x: 1, y: 0 },
        { x: 0, y: -1 }, { x: 0, y: 1 }
    ];
    for (const dir of directions) {
        const nx = point.x + dir.x;
        const ny = point.y + dir.y;
        if (nx >= 0 && nx < game.settings.boardSize && ny >= 0 && ny < game.settings.boardSize) {
            if (testResult.newBoardState[ny][nx] === opponentPlayer) {
                const oppGroups = logic.getAllGroups(opponentPlayer, testResult.newBoardState);
                const nearbyGroup = oppGroups.find(g => g.stones.some(s => s.x === nx && s.y === ny));
                if (nearbyGroup && nearbyGroup.libertyPoints.size <= 2) {
                    score += 2.0; // 축
                }
            }
        }
    }

    // 장문: 긴 연결을 만드는 수
    const myGroupsAfter = logic.getAllGroups(aiPlayer, testResult.newBoardState);
    const pointGroup = myGroupsAfter.find(g => g.stones.some(p => p.x === point.x && p.y === point.y));
    if (pointGroup && pointGroup.stones.length >= 3) {
        score += 1.5; // 장문
    }

    // 환격과 먹여치기는 이미 evaluateSacrificeAndCounter에서 평가됨
    const sacrificeScore = evaluateSacrificeAndCounter(game, logic, point, aiPlayer, opponentPlayer);
    score += sacrificeScore * 0.5;

    return score;
}

/**
 * 9단계: 연결과 끊음 평가
 */
function evaluateConnectionAndCut(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player
): number {
    const testResult = processMove(
        game.boardState,
        { ...point, player: aiPlayer },
        game.koInfo,
        game.moveHistory.length,
        { ignoreSuicide: true }
    );

    if (!testResult.isValid) return 0;

    let score = 0;

    // 자신의 그룹 연결
    const myGroupsBefore = logic.getAllGroups(aiPlayer, game.boardState);
    const myGroupsAfter = logic.getAllGroups(aiPlayer, testResult.newBoardState);
    
    if (myGroupsAfter.length < myGroupsBefore.length) {
        // 그룹이 연결됨
        score += 2.0;
    }

    // 상대 그룹 끊기
    const oppGroupsBefore = logic.getAllGroups(opponentPlayer, game.boardState);
    const oppGroupsAfter = logic.getAllGroups(opponentPlayer, testResult.newBoardState);
    
    if (oppGroupsAfter.length > oppGroupsBefore.length) {
        // 상대 그룹을 끊음
        score += 3.0; // 끊기가 더 중요
    }

    return score;
}

/**
 * 9단계: 고급 사활 판단
 */
function evaluateLifeDeathAdvanced(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player
): number {
    const testResult = processMove(
        game.boardState,
        { ...point, player: aiPlayer },
        game.koInfo,
        game.moveHistory.length,
        { ignoreSuicide: true }
    );

    if (!testResult.isValid) return 0;

    let score = 0;

    // 떨어진 두 개 이상의 집을 만들어 살리기
    const myGroupsAfter = logic.getAllGroups(aiPlayer, testResult.newBoardState);
    const pointGroup = myGroupsAfter.find(g => g.stones.some(p => p.x === point.x && p.y === point.y));
    
    if (pointGroup) {
        // 그룹이 두 개 이상의 독립적인 공간(집)을 가지고 있는지 확인
        // 간단한 휴리스틱: 자유도가 많고 돌이 많으면 살 가능성 높음
        if (pointGroup.libertyPoints.size >= 4 && pointGroup.stones.length >= 3) {
            score += 2.0; // 살 가능성
        }
    }

    // 떨어진 두 개 이상의 집을 만들지 못하게 하여 잡기
    const oppGroupsAfter = logic.getAllGroups(opponentPlayer, testResult.newBoardState);
    for (const oppGroup of oppGroupsAfter) {
        if (oppGroup.libertyPoints.size <= 2 && oppGroup.stones.length >= 2) {
            // 상대 그룹이 집을 만들기 어려운 상태
            score += 2.5; // 잡을 가능성
        }
    }

    return score;
}

/**
 * 9단계: 고급 행마 평가
 */
function evaluateMovementAdvanced(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player
): number {
    const boardSize = game.settings.boardSize;
    let score = 0;

    // 내 돌이 끊어지지 않고 가장 멀리 움직이기
    const myGroups = logic.getAllGroups(aiPlayer, game.boardState);
    if (myGroups.length > 0) {
        let maxDistance = 0;
        for (const group of myGroups) {
            const groupCenter = {
                x: group.stones.reduce((sum, s) => sum + s.x, 0) / group.stones.length,
                y: group.stones.reduce((sum, s) => sum + s.y, 0) / group.stones.length
            };
            const distance = Math.abs(point.x - groupCenter.x) + Math.abs(point.y - groupCenter.y);
            maxDistance = Math.max(maxDistance, distance);
        }
        
        // 적당한 거리 (2-4)로 이동하는 것이 좋음
        if (maxDistance >= 2 && maxDistance <= 4) {
            score += 1.5;
        }
    }

    // 행마 패턴 인식
    const testResult = processMove(
        game.boardState,
        { ...point, player: aiPlayer },
        game.koInfo,
        game.moveHistory.length,
        { ignoreSuicide: true }
    );

    if (testResult.isValid) {
        const myGroupsAfter = logic.getAllGroups(aiPlayer, testResult.newBoardState);
        const pointGroup = myGroupsAfter.find(g => g.stones.some(p => p.x === point.x && p.y === point.y));
        
        if (pointGroup) {
            // 입구자행마: 두 돌 사이에 두기
            const neighbors = logic.getNeighbors(point.x, point.y);
            let myNeighborCount = 0;
            for (const n of neighbors) {
                if (testResult.newBoardState[n.y][n.x] === aiPlayer) {
                    myNeighborCount++;
                }
            }
            if (myNeighborCount === 2) {
                score += 1.0; // 입구자행마
            }

            // 날일자행마: 한 칸 뛰기
            if (myGroups.length > 0) {
                const nearestGroup = myGroups[0];
                const groupCenter = {
                    x: nearestGroup.stones.reduce((sum, s) => sum + s.x, 0) / nearestGroup.stones.length,
                    y: nearestGroup.stones.reduce((sum, s) => sum + s.y, 0) / nearestGroup.stones.length
                };
                const distance = Math.abs(point.x - groupCenter.x) + Math.abs(point.y - groupCenter.y);
                if (distance === 2) {
                    score += 1.0; // 날일자행마
                }
            }

            // 눈목자행마: 대각선으로 두 칸
            // 밭전자행마: 직선으로 두 칸
            // 쌍점행마: 두 점에 동시에 두기 (연결)
            if (pointGroup.stones.length >= 2) {
                score += 0.5; // 행마 패턴
            }
        }
    }

    return score;
}

/**
 * 10단계: 마무리 평가 (집 지키기/부수기)
 */
function evaluateEndgame(
    game: types.LiveGameSession,
    logic: ReturnType<typeof getGoLogic>,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player
): number {
    let score = 0;

    const testResult = processMove(
        game.boardState,
        { ...point, player: aiPlayer },
        game.koInfo,
        game.moveHistory.length,
        { ignoreSuicide: true }
    );

    if (!testResult.isValid) return 0;

    // 한 집이라도 더 지키기
    const myGroupsAfter = logic.getAllGroups(aiPlayer, testResult.newBoardState);
    const pointGroup = myGroupsAfter.find(g => g.stones.some(p => p.x === point.x && p.y === point.y));
    
    if (pointGroup) {
        // 그룹 주변의 빈 공간(집) 계산
        const emptySpaces = new Set<string>();
        for (const stone of pointGroup.stones) {
            const neighbors = logic.getNeighbors(stone.x, stone.y);
            for (const n of neighbors) {
                if (testResult.newBoardState[n.y][n.x] === types.Player.None) {
                    emptySpaces.add(`${n.x},${n.y}`);
                }
            }
        }
        score += emptySpaces.size * 0.5; // 집 지키기
    }

    // 한 집이라도 더 부수기
    const oppGroupsAfter = logic.getAllGroups(opponentPlayer, testResult.newBoardState);
    for (const oppGroup of oppGroupsAfter) {
        // 상대 그룹 주변의 빈 공간을 줄이기
        const emptySpaces = new Set<string>();
        for (const stone of oppGroup.stones) {
            const neighbors = logic.getNeighbors(stone.x, stone.y);
            for (const n of neighbors) {
                if (testResult.newBoardState[n.y][n.x] === types.Player.None) {
                    emptySpaces.add(`${n.x},${n.y}`);
                }
            }
        }
        
        // 이 수가 상대 그룹의 집을 줄였는지 확인
        const oppGroupsBefore = logic.getAllGroups(opponentPlayer, game.boardState);
        const matchingBefore = oppGroupsBefore.find(gb =>
            gb.stones.some(bs => oppGroup.stones.some(as => as.x === bs.x && as.y === bs.y))
        );
        if (matchingBefore) {
            const beforeEmptySpaces = new Set<string>();
            for (const stone of matchingBefore.stones) {
                const neighbors = logic.getNeighbors(stone.x, stone.y);
                for (const n of neighbors) {
                    if (game.boardState[n.y][n.x] === types.Player.None) {
                        beforeEmptySpaces.add(`${n.x},${n.y}`);
                    }
                }
            }
            if (emptySpaces.size < beforeEmptySpaces.size) {
                score += (beforeEmptySpaces.size - emptySpaces.size) * 0.8; // 집 부수기
            }
        }
    }

    return score;
}

/**
 * 미래를 내다보는 평가 (look-ahead search)
 * 지정된 깊이만큼 미래의 수를 시뮬레이션하여 수의 가치를 평가
 */
function evaluateLookAhead(
    game: types.LiveGameSession,
    boardState: types.BoardState,
    koInfo: { point: Point; turn: number } | null,
    lastMove: Point,
    aiPlayer: Player,
    opponentPlayer: Player,
    profile: GoAiBotProfile,
    logic: ReturnType<typeof getGoLogic>,
    depth: number
): number {
    if (depth <= 0) {
        return 0; // 더 이상 내다볼 수 없음
    }

    // 현재 플레이어는 상대방 (AI가 수를 둔 후 상대방 차례)
    const currentPlayer = opponentPlayer;
    const nextPlayer = aiPlayer;

    // 현재 보드 상태로 게임 객체 생성
    const simulatedGame: types.LiveGameSession = {
        ...game,
        boardState,
        koInfo,
        currentPlayer
    };

    // 상대방의 가능한 수 찾기 (최대 5개만 고려하여 성능 최적화)
    const opponentMoves = findAllValidMovesFast(simulatedGame, logic, currentPlayer);
    if (opponentMoves.length === 0) {
        // 상대방이 둘 수 없으면 좋은 상황
        return 100;
    }

    // 상위 5개 수만 고려 (성능 최적화)
    const topMoves = opponentMoves.slice(0, Math.min(5, opponentMoves.length));
    let totalScore = 0;
    let validSimulations = 0;

    for (const move of topMoves) {
        const moveResult = processMove(
            boardState,
            { ...move, player: currentPlayer },
            koInfo,
            game.moveHistory.length + 1,
            { ignoreSuicide: true }
        );

        if (!moveResult.isValid) continue;

        // 상대방이 수를 둔 후의 상황 평가
        let moveScore = 0;

        // 1. 상대방이 우리 돌을 따냈는지 확인 (나쁜 상황)
        const myGroupsAfterOpponent = logic.getAllGroups(aiPlayer, moveResult.newBoardState);
        const myGroupsBeforeOpponent = logic.getAllGroups(aiPlayer, boardState);
        for (const groupBefore of myGroupsBeforeOpponent) {
            const matchingAfter = myGroupsAfterOpponent.find(ga =>
                ga.stones.some(ast => groupBefore.stones.some(bst => ast.x === bst.x && ast.y === bst.y))
            );
            if (!matchingAfter) {
                // 우리 그룹이 사라졌음 = 상대방이 따냄
                moveScore -= groupBefore.stones.length * 100;
            } else if (groupBefore.libertyPoints.size > 1 && matchingAfter.libertyPoints.size === 1) {
                // 우리 그룹이 단수로 위협받게 됨
                moveScore -= 50;
            }
        }

        // 2. 우리가 상대방 돌을 따낼 수 있는 기회가 생겼는지 확인 (좋은 상황)
        const opponentGroupsAfter = logic.getAllGroups(opponentPlayer, moveResult.newBoardState);
        for (const group of opponentGroupsAfter) {
            if (group.libertyPoints.size === 1) {
                // 상대방 그룹이 단수가 됨
                moveScore += group.stones.length * 50;
            }
        }

        // 3. 재귀적으로 다음 수 평가 (깊이 감소)
        if (depth > 1) {
            const nextLookAheadScore = evaluateLookAhead(
                game,
                moveResult.newBoardState,
                moveResult.newKoInfo,
                move,
                aiPlayer,
                opponentPlayer,
                profile,
                logic,
                depth - 1
            );
            moveScore += nextLookAheadScore * 0.5; // 재귀 점수는 가중치 감소
        }

        totalScore += moveScore;
        validSimulations++;
    }

    // 평균 점수 반환 (시뮬레이션이 없으면 0)
    return validSimulations > 0 ? totalScore / validSimulations : 0;
}

/**
 * 그룹을 살릴 수 있는지 미래를 내다보며 판단
 * calculationDepth에 따라 미래의 수를 시뮬레이션하여 그룹이 살릴 수 있는지 확인
 */
function canGroupBeSaved(
    game: types.LiveGameSession,
    boardState: types.BoardState,
    koInfo: { point: Point; turn: number } | null,
    group: { stones: Point[]; liberties: number; libertyPoints: Set<string>; player: Player },
    aiPlayer: Player,
    opponentPlayer: Player,
    profile: GoAiBotProfile,
    logic: ReturnType<typeof getGoLogic>
): boolean {
    // calculationDepth가 1이면 미래를 내다볼 수 없으므로 기본적으로 살릴 수 있다고 가정
    if (profile.calculationDepth <= 1) {
        return true; // 낮은 난이도는 살릴 수 있다고 가정
    }

    // 그룹의 활로가 2개 이상이면 살릴 수 있다고 판단
    if (group.libertyPoints.size >= 2) {
        return true;
    }

    // 활로가 1개인 경우, 미래를 내다보며 살릴 수 있는지 확인
    if (group.libertyPoints.size === 1) {
        // 상대방이 다음 수에 그룹을 잡을 수 있는지 확인
        const libertyPoint = Array.from(group.libertyPoints)[0];
        const [x, y] = libertyPoint.split(',').map(Number);
        
        // 상대방이 그 활로에 두면 그룹이 잡힘
        const opponentMoveResult = processMove(
            boardState,
            { x, y, player: opponentPlayer },
            koInfo,
            game.moveHistory.length + 1,
            { ignoreSuicide: true }
        );
        
        if (opponentMoveResult.isValid) {
            // 상대방이 그 활로에 두면 그룹이 잡히는지 확인
            const groupsAfterOpponent = logic.getAllGroups(aiPlayer, opponentMoveResult.newBoardState);
            const groupStillExists = groupsAfterOpponent.some(ga =>
                ga.stones.some(ast => group.stones.some(bst => ast.x === bst.x && ast.y === bst.y))
            );
            
            if (!groupStillExists) {
                // 상대방이 다음 수에 잡을 수 있음 - 살릴 수 없음
                return false;
            }
        }
        
        // 더 깊이 내다보기 (calculationDepth에 따라)
        if (profile.calculationDepth > 2) {
            // AI가 다음 수에 그룹을 더 안전하게 만들 수 있는지 확인
            const simulatedGame: types.LiveGameSession = {
                ...game,
                boardState,
                koInfo,
                currentPlayer: aiPlayer
            };
            
            const aiMoves = findAllValidMovesFast(simulatedGame, logic, aiPlayer);
            let canSaveInFuture = false;
            
            // AI의 가능한 수 중에서 그룹을 살릴 수 있는 수가 있는지 확인
            for (const move of aiMoves.slice(0, Math.min(5, aiMoves.length))) {
                const aiMoveResult = processMove(
                    boardState,
                    { ...move, player: aiPlayer },
                    koInfo,
                    game.moveHistory.length + 1,
                    { ignoreSuicide: true }
                );
                
                if (!aiMoveResult.isValid) continue;
                
                const groupsAfterAi = logic.getAllGroups(aiPlayer, aiMoveResult.newBoardState);
                const groupAfterAi = groupsAfterAi.find(ga =>
                    ga.stones.some(ast => group.stones.some(bst => ast.x === bst.x && ast.y === bst.y))
                );
                
                if (groupAfterAi && groupAfterAi.libertyPoints.size >= 2) {
                    // AI가 수를 두면 그룹이 더 안전해짐
                    canSaveInFuture = true;
                    break;
                }
            }
            
            if (!canSaveInFuture) {
                // AI가 다음 수에 그룹을 살릴 수 없음 - 살릴 수 없음
                return false;
            }
        }
    }

    // 기본적으로 살릴 수 있다고 판단
    return true;
}
