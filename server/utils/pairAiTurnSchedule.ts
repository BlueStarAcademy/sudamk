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
        const gameId = game.id;
        // makeGoAiBotMove/PLACE_STONE 처리 중에는 큐가 inFlight라 즉시 enqueue가 무시될 수 있음 → 다음 틱에 재등록
        setTimeout(() => {
            void import('../aiProcessingQueue.js')
                .then(({ aiProcessingQueue }) =>
                    aiProcessingQueue.enqueue(gameId, undefined, { deferIfProcessing: true }),
                )
                .catch((err: unknown) =>
                    console.error(
                        `[schedulePairAiTurnIfNeeded] Failed to enqueue pair AI turn ${gameId}:`,
                        (err as Error)?.message ?? err,
                    ),
                );
        }, 0);
    } else {
        game.aiTurnStartTime = undefined;
    }
}
