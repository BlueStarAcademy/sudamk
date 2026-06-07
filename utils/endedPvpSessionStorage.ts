import { Player } from '../types/enums.js';
import type { LiveGameSession } from '../types/index.js';
import { isPvpHumanGameRecordEligible } from './strategicPvpGameRecord.js';

const TERMINAL_PVP_STATUSES = new Set(['ended', 'no_contest', 'scoring', 'rematch_pending']);

export function endedPvpSessionStorageKey(gameId: string): string {
    return `gameState_${gameId}`;
}

/** 종료·계가 중 PVP 대국을 F5·기보 저장 전까지 sessionStorage에 보관 */
export function persistEndedPvpGameToSessionStorage(game: LiveGameSession): void {
    if (typeof sessionStorage === 'undefined') return;
    if (!isPvpHumanGameRecordEligible(game)) return;
    const status = game.gameStatus || '';
    if (!TERMINAL_PVP_STATUSES.has(status)) return;

    try {
        sessionStorage.setItem(
            endedPvpSessionStorageKey(game.id),
            JSON.stringify({
                gameId: game.id,
                gameStatus: game.gameStatus,
                winReason: game.winReason,
                winner: game.winner,
                mode: game.mode,
                gameCategory: game.gameCategory,
                isSinglePlayer: game.isSinglePlayer,
                isAiGame: game.isAiGame,
                player1: game.player1,
                player2: game.player2,
                blackPlayerId: game.blackPlayerId,
                whitePlayerId: game.whitePlayerId,
                currentPlayer: game.currentPlayer,
                boardState: game.boardState,
                moveHistory: game.moveHistory ?? [],
                captures: game.captures ?? { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
                baseStoneCaptures: game.baseStoneCaptures,
                hiddenStoneCaptures: game.hiddenStoneCaptures,
                finalScores: game.finalScores,
                analysisResult: game.analysisResult,
                summary: game.summary,
                settings: game.settings,
                createdAt: game.createdAt,
                gameStartTime: game.gameStartTime,
                endTime: (game as { endTime?: number }).endTime,
                totalTurns: game.totalTurns,
                blackTimeLeft: game.blackTimeLeft,
                whiteTimeLeft: game.whiteTimeLeft,
                shortGameNoContest: (game as { shortGameNoContest?: boolean }).shortGameNoContest,
                timestamp: Date.now(),
            }),
        );
    } catch {
        /* quota / private mode */
    }
}

export function loadEndedPvpGameFromSessionStorage(gameId: string): LiveGameSession | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(endedPvpSessionStorageKey(gameId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed.gameId !== gameId) return null;
        const status = String(parsed.gameStatus || '');
        if (!TERMINAL_PVP_STATUSES.has(status)) return null;
        const game = parsed as unknown as LiveGameSession;
        if (!isPvpHumanGameRecordEligible(game)) return null;
        return game;
    } catch {
        return null;
    }
}
