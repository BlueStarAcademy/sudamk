import { Player, type LiveGameSession } from '../../types/index.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';
import { isPairClassicGame } from '../../shared/utils/pairGameTurn.js';
import { PVE_STRATEGIC_SERVER_AI_POST_HUMAN_DELAY_MS } from '../constants/pveStrategicAiSchedule.js';
import { aiProcessingQueue } from '../aiProcessingQueue.js';

/**
 * 모험·길드전 서버 Kata AI: 메인루프 setImmediate와 인라인 makeAiMove 이중 디스패치 대신
 * aiProcessingQueue 단일 경로로 스케줄한다 (페어 4인 수순과 동일 원칙).
 */
export function schedulePveStrategicAiTurnIfNeeded(game: LiveGameSession, now: number): void {
    if (isPairClassicGame(game.settings, game.mode)) return;

    const policy = resolveArenaSessionPolicy(game);
    if (policy.kind !== 'adventure' && policy.kind !== 'guildwar') return;
    if (!policy.usesServerKataAi) return;

    const currentPlayerId =
        game.currentPlayer === Player.Black ? game.blackPlayerId : game.whitePlayerId;
    const isAiSeat =
        currentPlayerId === 'ai-player-01' ||
        Boolean(currentPlayerId && String(currentPlayerId).startsWith('dungeon-bot-'));

    if (game.currentPlayer === Player.None || !isAiSeat) {
        game.aiTurnStartTime = undefined;
        return;
    }

    const startAt = now + PVE_STRATEGIC_SERVER_AI_POST_HUMAN_DELAY_MS;
    game.aiTurnStartTime = startAt;
    const gameId = game.id;
    setTimeout(() => {
        try {
            aiProcessingQueue.enqueue(gameId, undefined, { deferIfProcessing: true });
        } catch (err: unknown) {
            console.error(
                `[schedulePveStrategicAiTurnIfNeeded] Failed to enqueue ${gameId}:`,
                (err as Error)?.message ?? err,
            );
        }
    }, PVE_STRATEGIC_SERVER_AI_POST_HUMAN_DELAY_MS);
}
