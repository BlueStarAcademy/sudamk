import type { LiveGameSession, Point } from '../../types/index.js';
import { Player } from '../../types/index.js';

const HIDDEN_GLOBALLY_VISIBLE_STATUSES = new Set(['hidden_final_reveal', 'scoring', 'ended', 'no_contest']);

function samePoint(a: Point | undefined, b: Point): boolean {
    return Boolean(a && a.x === b.x && a.y === b.y);
}

function isHiddenPointVisibleToSpectator(game: LiveGameSession, point: Point): boolean {
    if (HIDDEN_GLOBALLY_VISIBLE_STATUSES.has(String(game.gameStatus))) return true;
    return Boolean(game.permanentlyRevealedStones?.some((p) => samePoint(p, point)));
}

function cloneBoard(board: LiveGameSession['boardState']): LiveGameSession['boardState'] {
    return Array.isArray(board) ? board.map((row) => (Array.isArray(row) ? [...row] : row)) : board;
}

/**
 * Neutral spectator view: never send per-player scan data, and hide unrevealed hidden stones
 * from the board so alt-account spectating cannot expose hidden-mode information.
 */
export function buildSpectatorGameView(game: LiveGameSession): LiveGameSession {
    const spectatorGame: LiveGameSession = {
        ...game,
        boardState: cloneBoard(game.boardState),
        revealedHiddenMoves: {},
        newlyRevealed: [],
    };

    delete (spectatorGame as { scannedAiInitialHiddenByUser?: unknown }).scannedAiInitialHiddenByUser;

    const hiddenMoves = game.hiddenMoves;
    if (hiddenMoves && game.moveHistory?.length && Array.isArray(spectatorGame.boardState)) {
        for (const [rawIndex, hidden] of Object.entries(hiddenMoves)) {
            if (!hidden) continue;
            const idx = Number(rawIndex);
            if (!Number.isInteger(idx)) continue;
            const move = game.moveHistory[idx];
            if (!move || move.x < 0 || move.y < 0) continue;
            if (isHiddenPointVisibleToSpectator(game, move)) continue;
            const row = spectatorGame.boardState[move.y];
            if (Array.isArray(row) && row[move.x] === move.player) {
                row[move.x] = Player.None;
            }
        }
    }

    if (spectatorGame.animation?.type === 'hidden_reveal') {
        const stones = spectatorGame.animation.stones ?? [];
        const canShowReveal = stones.every((stone) => isHiddenPointVisibleToSpectator(game, stone.point));
        if (!canShowReveal) {
            spectatorGame.animation = null;
            spectatorGame.revealAnimationEndTime = undefined;
        }
    }

    spectatorGame.hiddenMoves = {};
    return spectatorGame;
}
