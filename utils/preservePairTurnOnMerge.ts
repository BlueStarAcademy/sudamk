import type { LiveGameSession } from '../types/index.js';
import { Player } from '../types/index.js';
import { isPairClassicGame, normalizePairTurnIndex } from '../shared/utils/pairGameTurn.js';

/** 페어 4인 수순: 낡은 GAME_UPDATE가 currentTurnIndex·currentPlayer를 되돌리면 유저 턴만 반복되는 버그 */
export function preservePairTurnIfExistingAhead(
    existing: LiveGameSession | undefined,
    merged: LiveGameSession,
): LiveGameSession {
    if (!existing || !isPairClassicGame(merged.settings, merged.mode)) return merged;
    const epg = existing.settings?.pairGame;
    const mpg = merged.settings?.pairGame;
    if (!epg?.turnOrder?.length || !mpg?.turnOrder?.length) return merged;

    // 서버 revision이 앞선 패킷은 권위 — 낙관적 로컬 자리/턴으로 덮지 않는다.
    const incomingRev = merged.serverRevision ?? 0;
    const existingRev = existing.serverRevision ?? 0;
    if (incomingRev > existingRev) return merged;

    const em = existing.moveHistory?.length ?? 0;
    const mm = merged.moveHistory?.length ?? 0;
    if (em > mm) {
        const serverMoves = merged.moveHistory ?? [];
        const clientMoves = existing.moveHistory ?? [];
        const prefixMatches =
            mm === 0 ||
            serverMoves.every(
                (m, i) =>
                    (m as { x?: number; y?: number; player?: Player }).x ===
                        (clientMoves[i] as { x?: number; y?: number; player?: Player })?.x &&
                    (m as { x?: number; y?: number; player?: Player }).y ===
                        (clientMoves[i] as { x?: number; y?: number; player?: Player })?.y &&
                    (m as { x?: number; y?: number; player?: Player }).player ===
                        (clientMoves[i] as { x?: number; y?: number; player?: Player })?.player,
            );
        if (!prefixMatches) return merged;

        return {
            ...merged,
            settings: {
                ...merged.settings,
                pairGame: {
                    ...mpg,
                    ...epg,
                    turnOrder: epg.turnOrder,
                    currentTurnIndex: epg.currentTurnIndex,
                    passSeatIds: epg.passSeatIds,
                },
            },
            boardState: existing.boardState,
            moveHistory: existing.moveHistory,
            currentPlayer: existing.currentPlayer,
            captures: existing.captures ?? merged.captures,
            koInfo: existing.koInfo ?? merged.koInfo,
            lastMove: existing.lastMove ?? merged.lastMove,
        };
    }
    if (em !== mm) return merged;

    const eIdx = normalizePairTurnIndex(epg);
    const mIdx = normalizePairTurnIndex(mpg);
    if (eIdx === mIdx) return merged;

    const len = epg.turnOrder.length;
    const expectedIdx = len > 0 ? em % len : 0;
    if (eIdx === expectedIdx && mIdx !== expectedIdx) {
        return {
            ...merged,
            settings: {
                ...merged.settings,
                pairGame: {
                    ...mpg,
                    currentTurnIndex: eIdx,
                    turnOrder: epg.turnOrder,
                    passSeatIds: epg.passSeatIds,
                },
            },
            currentPlayer: existing.currentPlayer,
        };
    }
    return merged;
}
