import type { LiveGameSession } from '../../types/index.js';
import { getCurrentPairTurnSeat, isPairAiSeat, isPairClassicGame } from '../../shared/utils/pairGameTurn.js';

/**
 * 페어 4인 수순(흑1→백1→흑2→백2): AI/펫 좌석만 aiProcessingQueue로 스케줄한다.
 * processGame 메인루프 setImmediate와 이중 디스패치하면 백1 스킵·흑 연속 착수가 난다.
 */
export function schedulePairAiTurnIfNeeded(game: LiveGameSession, now: number): void {
    if (!isPairClassicGame(game.settings, game.mode)) return;
    const seat = getCurrentPairTurnSeat(game.settings);
    if (isPairAiSeat(seat)) {
        game.aiTurnStartTime = now;
        void import('../aiProcessingQueue.js')
            .then(({ aiProcessingQueue }) =>
                aiProcessingQueue.enqueue(game.id, undefined, { deferIfProcessing: true }),
            )
            .catch((err: unknown) =>
                console.error(
                    `[schedulePairAiTurnIfNeeded] Failed to enqueue pair AI turn ${game.id}:`,
                    (err as Error)?.message ?? err,
                ),
            );
    } else {
        game.aiTurnStartTime = undefined;
    }
}
