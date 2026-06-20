/**
 * AI 처리 큐 시스템
 * 여러 싱글플레이 게임이 동시에 AI를 처리할 때 CPU 과부하를 방지하기 위해
 * 동시에 처리할 수 있는 AI 게임 수를 제한합니다.
 */

import { LiveGameSession, Player, GameMode } from '../types/index.js';
import {
    CHESS_GO_PIECE_TO_STONE_DELAY_MS,
    PAIR_AI_MOVE_REVEAL_DELAY_MS,
    PLAYFUL_AI_BATCH_STONE_INTERVAL_MS,
    PLAYFUL_AI_QUEUE_PRE_ACTION_DELAY_MS,
} from '../constants';
import { makeAiMove, aiUserId } from './aiPlayer.js';
import { getCachedGame, updateGameCache } from './gameCache.js';
import * as db from './db.js';
import { broadcast } from './socket.js';
import { cpus } from 'os';
import { getCurrentPairTurnSeat, isPairAiSeat, isPairClassicGame } from '../shared/utils/pairGameTurn.js';

interface QueuedAiTask {
    gameId: string;
    priority: number; // 높을수록 우선순위가 높음 (최근 게임일수록 높음)
    queuedAt: number;
}

interface QueueStats {
    totalProcessed: number;
    totalQueued: number;
    averageWaitTime: number;
    maxWaitTime: number;
}

const AI_GO_STALL_RETRY_STATUSES = new Set([
    'playing',
    'hidden_reveal_animating',
]);

function getCurrentPlayerId(game: LiveGameSession): string | undefined {
    const pairSeat = isPairClassicGame(game.settings, game.mode) ? getCurrentPairTurnSeat(game.settings) : null;
    return pairSeat?.participantId ?? (game.currentPlayer === Player.Black ? game.blackPlayerId : game.whitePlayerId) ?? undefined;
}

function isAiControlledTurn(game: LiveGameSession): boolean {
    const pairSeat = isPairClassicGame(game.settings, game.mode) ? getCurrentPairTurnSeat(game.settings) : null;
    if (pairSeat && isPairAiSeat(pairSeat)) return true;
    const playerId = getCurrentPlayerId(game);
    return playerId === aiUserId || (playerId != null && String(playerId).startsWith('dungeon-bot-'));
}

function getAnimationRetryDelayMs(game: LiveGameSession): number | null {
    const animation = game.animation as { startTime?: number; duration?: number } | null | undefined;
    if (!animation || !Number.isFinite(animation.startTime) || !Number.isFinite(animation.duration)) {
        return null;
    }
    const endAt = Number(animation.startTime) + Math.max(0, Number(animation.duration));
    return Math.max(250, endAt - Date.now() + 80);
}

class AiProcessingQueue {
    private queue: QueuedAiTask[] = [];
    private processing: Set<string> = new Set(); // 현재 처리 중인 게임 ID
    private readonly maxConcurrent: number; // 동시에 처리할 수 있는 최대 게임 수
    private processingInterval: ReturnType<typeof setInterval> | null = null;
    private stats: QueueStats = {
        totalProcessed: 0,
        totalQueued: 0,
        averageWaitTime: 0,
        maxWaitTime: 0,
    };
    /** 연속 실패 시 재시도 간격을 늘리기 위한 카운터 */
    private retryCounts: Map<string, number> = new Map();

    constructor(maxConcurrent?: number) {
        // CPU 코어 수를 기반으로 동시 처리 수 결정 (기본값: 코어 수 * 4, 최소 10, 최대 50)
        const cpuCount = cpus().length;
        this.maxConcurrent = maxConcurrent ?? Math.min(Math.max(cpuCount * 4, 10), 50);
        console.log(`[AI Queue] Initialized with maxConcurrent: ${this.maxConcurrent} (CPU cores: ${cpuCount})`);
        this.startProcessing();
    }

    /**
     * AI 처리를 큐에 추가
     * @param gameId 게임 ID
     * @param priority 우선순위 (기본값: 현재 시간, 최근일수록 높음)
     */
    enqueue(gameId: string, priority?: number, options?: { deferIfProcessing?: boolean }): void {
        const alreadyQueued = this.queue.some(task => task.gameId === gameId);
        const inFlight = this.processing.has(gameId);
        // 이미 큐에 있거나 처리 중이면 무시 (페어 연속 AI 좌석은 defer로 처리 종료 후 재등록)
        if (alreadyQueued || inFlight) {
            if (options?.deferIfProcessing && inFlight && !alreadyQueued) {
                setTimeout(() => this.enqueue(gameId, priority), 0);
            }
            return;
        }

        const task: QueuedAiTask = {
            gameId,
            priority: priority ?? Date.now(),
            queuedAt: Date.now(),
        };

        this.queue.push(task);
        // 우선순위 순으로 정렬 (높은 우선순위가 먼저)
        this.queue.sort((a, b) => b.priority - a.priority);
    }

    /**
     * 큐에서 제거 (게임이 종료되거나 더 이상 AI 처리가 필요 없을 때)
     */
    dequeue(gameId: string): void {
        this.queue = this.queue.filter(task => task.gameId !== gameId);
        this.processing.delete(gameId);
    }

    /** 메인 루프가 동일 게임에서 Kata/goAiBot 동기 연산과 겹치지 않도록 할 때 사용 */
    isProcessingGame(gameId: string): boolean {
        return this.processing.has(gameId);
    }

    /**
     * 큐 처리 시작
     */
    private startProcessing(): void {
        // 10ms마다 큐를 확인하고 처리 가능한 작업을 시작 (더 빠른 응답)
        this.processingInterval = setInterval(() => {
            this.processQueue();
        }, 10);
    }

    /**
     * 큐 처리 중지
     */
    stopProcessing(): void {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
    }

    /**
     * 큐에서 처리 가능한 작업을 가져와서 실행
     */
    private async processQueue(): Promise<void> {
        // 동시 처리 제한 확인
        if (this.processing.size >= this.maxConcurrent) {
            return;
        }

        // 큐가 비어있으면 종료
        if (this.queue.length === 0) {
            return;
        }

        // 가능한 한 여러 작업을 동시에 시작 (배치 처리)
        const availableSlots = this.maxConcurrent - this.processing.size;
        const tasksToProcess = Math.min(availableSlots, this.queue.length);

        for (let i = 0; i < tasksToProcess; i++) {
            const task = this.queue.shift();
            if (!task) {
                break;
            }

            // 대기 시간 통계 업데이트
            const waitTime = Date.now() - task.queuedAt;
            this.stats.totalQueued++;
            this.stats.averageWaitTime = (this.stats.averageWaitTime * (this.stats.totalQueued - 1) + waitTime) / this.stats.totalQueued;
            this.stats.maxWaitTime = Math.max(this.stats.maxWaitTime, waitTime);

            // 처리 중으로 표시
            this.processing.add(task.gameId);

            // 비동기로 처리 (블로킹 방지)
            this.processAiMove(task.gameId).finally(() => {
                this.processing.delete(task.gameId);
                this.stats.totalProcessed++;
            });
        }
    }

    /**
     * 실제 AI 수 처리
     */
    private async processAiMove(gameId: string): Promise<void> {
        try {
            // 캐시에서 게임 가져오기 (지연 후 최신 세션으로 갱신할 수 있어 let)
            let game = await getCachedGame(gameId);
            if (!game) {
                console.warn(`[AI Queue] Game ${gameId} not found in cache`);
                return;
            }

            // 게임이 종료되었거나 AI 차례가 아니면 무시
            // 전략바둑 playing + 놀이바둑 전체(알까기·컬링·주사위·오목·따목·도둑) AI 행동 가능 상태 허용
            const allowedStatuses = [
                'playing', 'hidden_placing', 'hidden_reveal_animating',
                'alkkagi_playing', 'alkkagi_placement', 'alkkagi_simultaneous_placement',
                'curling_playing',
                'curling_tiebreaker_playing',
                'dice_rolling', 'dice_placing', 'dice_turn_rolling', 'dice_turn_choice', 'dice_start_confirmation',
                'thief_rolling', 'thief_placing',
            ];
            if (!allowedStatuses.includes(game.gameStatus) || game.currentPlayer === undefined) {
                return;
            }

            if (!isAiControlledTurn(game)) {
                return;
            }

            // 백(AI) 차례일 때 1초 생각하는 연출
            const isPlacingStones = game.gameStatus === 'dice_placing' || game.gameStatus === 'thief_placing';
            const isAdventureAiGame = game.isAiGame && (game as any).gameCategory === 'adventure';
            const pairClassicAiTurn =
                isPairClassicGame(game.settings, game.mode) &&
                isPairAiSeat(getCurrentPairTurnSeat(game.settings));
            if (isAdventureAiGame && !isPlacingStones) {
                const thinkDelayMs = 1000 + Math.floor(Math.random() * 1000);
                await new Promise(resolve => setTimeout(resolve, thinkDelayMs));
            }
            if (!isAdventureAiGame && !pairClassicAiTurn && game.currentPlayer === Player.White && !isPlacingStones) {
                const preActionDelayMs =
                    game.mode === GameMode.Dice || game.mode === GameMode.Thief
                        ? PLAYFUL_AI_QUEUE_PRE_ACTION_DELAY_MS
                        : 1000;
                await new Promise(resolve => setTimeout(resolve, preActionDelayMs));
            }
            // 주사위/도둑 착수: 연속 착수 간격 (PLAYFUL_AI_BATCH_STONE_INTERVAL_MS)
            if (isPlacingStones) {
                await new Promise(resolve => setTimeout(resolve, PLAYFUL_AI_BATCH_STONE_INTERVAL_MS));
            }

            // 지연 동안 다른 요청이 턴을 바꿨을 수 있음 — 최신 캐시로 재검증 (모험 등에서 오적용 방지)
            const latest = await getCachedGame(gameId);
            if (!latest) {
                console.warn(`[AI Queue] Game ${gameId} missing from cache after think delay`);
                return;
            }
            game = latest;
            if (!allowedStatuses.includes(game.gameStatus) || game.currentPlayer === undefined) {
                return;
            }
            if (game.gameStatus === 'hidden_reveal_animating') {
                const beforeStatus = game.gameStatus;
                const beforeRevealEnd = game.revealAnimationEndTime;
                const { updateHiddenState } = await import('./modes/hidden.js');
                await updateHiddenState(game, Date.now());
                const revealResolved =
                    game.gameStatus !== beforeStatus ||
                    beforeRevealEnd !== game.revealAnimationEndTime ||
                    game.revealAnimationEndTime == null;
                if (revealResolved) {
                    updateGameCache(game);
                    db.saveGame(game).catch(err => {
                        console.error(`[AI Queue] Failed to save hidden reveal resolution ${gameId}:`, err);
                    });
                    const { broadcastToGameParticipants } = await import('./socket.js');
                    const payloadGame =
                        game.boardState && Array.isArray(game.boardState) && game.boardState.length > 0
                            ? { ...game, boardState: game.boardState.map((row: number[]) => [...row]) }
                            : game;
                    broadcastToGameParticipants(gameId, { type: 'GAME_UPDATE', payload: { [gameId]: payloadGame } }, game);
                }
                if (!allowedStatuses.includes(game.gameStatus) || game.currentPlayer === undefined) {
                    return;
                }
            }
            if (!isAiControlledTurn(game)) {
                return;
            }
            const beforeMoveCount = game.moveHistory?.length ?? 0;
            const pairClassic = isPairClassicGame(game.settings, game.mode);

            // AI 수 처리 — makeAiMove(goAiBot/Kata)는 동기 구간이 길어 이벤트 루프를 막는다.
            // processGame과 동일하게 setImmediate로 한 틱 미루어 updateGameStates 타임아웃이 동작하게 한다.
            await new Promise<void>((resolve, reject) => {
                setImmediate(() => {
                    void (async () => {
                        try {
                            await makeAiMove(game);
                            resolve();
                        } catch (moveErr) {
                            reject(moveErr);
                        }
                    })();
                });
            });
            const afterMoveCount = game.moveHistory?.length ?? beforeMoveCount;
            const stalledOnAiTurn =
                afterMoveCount <= beforeMoveCount &&
                isAiControlledTurn(game) &&
                AI_GO_STALL_RETRY_STATUSES.has(String(game.gameStatus));
            const pairHiddenRevealFollowUp =
                pairClassic &&
                afterMoveCount > beforeMoveCount &&
                game.gameStatus === 'hidden_reveal_animating';
            /** 상대 AI가 두고 턴이 펫/다음 AI로 넘어갈 때 makeGoAiBotMove 안에서 enqueue가 processing 때문에 무시되는 경우 */
            const consecutivePairAiSeat =
                pairClassic &&
                afterMoveCount > beforeMoveCount &&
                isAiControlledTurn(game) &&
                AI_GO_STALL_RETRY_STATUSES.has(String(game.gameStatus));
            const chessGoAwaitingStoneAfterPieceMove =
                game.mode === GameMode.Chess &&
                game.chessPieceMovedThisTurn === true &&
                afterMoveCount <= beforeMoveCount &&
                isAiControlledTurn(game) &&
                AI_GO_STALL_RETRY_STATUSES.has(String(game.gameStatus));
            if (chessGoAwaitingStoneAfterPieceMove) {
                setTimeout(() => this.enqueue(gameId), CHESS_GO_PIECE_TO_STONE_DELAY_MS);
            } else if (stalledOnAiTurn) {
                const retryCount = (this.retryCounts.get(gameId) ?? 0) + 1;
                this.retryCounts.set(gameId, retryCount);
                const animationDelay = getAnimationRetryDelayMs(game);
                const retryDelayMs =
                    animationDelay ??
                    Math.min(5000, 500 * Math.max(1, retryCount));
                console.warn(
                    `[AI Queue] AI turn made no progress; requeueing game=${gameId} status=${game.gameStatus} moves=${beforeMoveCount}->${afterMoveCount} retry=${retryCount} delay=${retryDelayMs}ms`
                );
                setTimeout(() => this.enqueue(gameId), retryDelayMs);
            } else if (pairHiddenRevealFollowUp) {
                const retryDelayMs = getAnimationRetryDelayMs(game) ?? 500;
                setTimeout(() => this.enqueue(gameId), retryDelayMs);
            } else if (consecutivePairAiSeat) {
                setTimeout(() => this.enqueue(gameId), PAIR_AI_MOVE_REVEAL_DELAY_MS);
            } else {
                this.retryCounts.delete(gameId);
            }

            // 강제응수·goAiBot 등으로 보드가 바뀐 직후 lastUpdated가 오래되면 캐시 만료 → DB 폴백이 빈판/낡은 판을 줄 수 있음
            updateGameCache(game);

            // DB 저장 (비동기, 응답 지연 최소화)
            db.saveGame(game).catch(err => {
                console.error(`[AI Queue] Failed to save game ${gameId}:`, err);
            });

            // 브로드캐스트 (게임 참가자에게만 전송)
            // 비동기 경합에서 직후 game 객체가 다시 변해 "보낸 패킷"과 화면이 어긋나는 것을 줄이기 위해 스냅샷 전송
            const { broadcastToGameParticipants } = await import('./socket.js');
            const payloadGame =
                game.boardState && Array.isArray(game.boardState) && game.boardState.length > 0
                    ? { ...game, boardState: game.boardState.map((row: number[]) => [...row]) }
                    : game;
            broadcastToGameParticipants(gameId, { type: 'GAME_UPDATE', payload: { [gameId]: payloadGame } }, game);

            // 히든 아이템 연출(6초) 동안 makeGoAiBotMove가 대기 반환한 경우,
            // 연출 종료 후 실제 AI 착수를 위해 같은 게임을 다시 큐에 넣는다.
            if (game.aiHiddenItemAnimationEndTime && Date.now() < game.aiHiddenItemAnimationEndTime) {
                const delayMs = Math.max(100, game.aiHiddenItemAnimationEndTime - Date.now() + 50);
                setTimeout(() => this.enqueue(gameId), delayMs);
                return;
            }

            // 주사위 바둑/도둑과 경찰: 남은 돌이 있으면 1초 후 한 개씩 두는 연출을 위해 재등록
            if ((game.gameStatus === 'dice_placing' || game.gameStatus === 'thief_placing') && (game.stonesToPlace ?? 0) > 0) {
                setTimeout(() => this.enqueue(gameId), PLAYFUL_AI_BATCH_STONE_INTERVAL_MS);
            }
        } catch (error) {
            console.error(`[AI Queue] Error processing AI move for game ${gameId}:`, error);
            const retryCount = (this.retryCounts.get(gameId) ?? 0) + 1;
            this.retryCounts.set(gameId, retryCount);

            // Kata 서버 타임아웃/일시 오류 등은 자동 재시도로 복구한다.
            // (최대 15초까지 점진 백오프)
            const retryDelayMs = Math.min(15000, 1000 * Math.max(1, retryCount));
            setTimeout(async () => {
                try {
                    const latest = await getCachedGame(gameId);
                    if (!latest) return;
                    const allowedStatuses = new Set([
                        'playing',
                        'hidden_placing',
                        'hidden_reveal_animating',
                        'alkkagi_playing',
                        'alkkagi_placement',
                        'alkkagi_simultaneous_placement',
                        'curling_playing',
                        'curling_tiebreaker_playing',
                        'dice_rolling',
                        'dice_placing',
                        'dice_turn_rolling',
                        'dice_turn_choice',
                        'dice_start_confirmation',
                        'thief_rolling',
                        'thief_placing',
                    ]);
                    if (!allowedStatuses.has(latest.gameStatus)) return;
                    if (!isAiControlledTurn(latest)) return;
                    this.enqueue(gameId);
                } catch (requeueErr) {
                    console.error(`[AI Queue] Failed to schedule retry for ${gameId}:`, requeueErr);
                }
            }, retryDelayMs);
        }
    }

    /**
     * 큐 상태 확인 (디버깅용)
     */
    getStatus(): { 
        queueLength: number; 
        processing: number; 
        processingGames: string[];
        maxConcurrent: number;
        stats: QueueStats;
    } {
        return {
            queueLength: this.queue.length,
            processing: this.processing.size,
            processingGames: Array.from(this.processing),
            maxConcurrent: this.maxConcurrent,
            stats: { ...this.stats },
        };
    }
}

// 싱글톤 인스턴스 생성 (CPU 코어 수 기반으로 동적 설정)
export const aiProcessingQueue = new AiProcessingQueue();

