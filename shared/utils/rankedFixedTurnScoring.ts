import type { LiveGameSession, BoardState, Point } from '../types/entities.js';
import { Player } from '../types/enums.js';
import { modeIncludesCaptureRule, resolveArenaSessionPolicy } from './liveSessionArenaKind.js';

function findGroupLiberties(
    boardState: BoardState,
    startX: number,
    startY: number,
    playerColor: Player.Black | Player.White,
    visited: Set<string>,
): number | null {
    if (boardState[startY]?.[startX] !== playerColor) return null;
    const boardSize = boardState.length;
    const key = `${startX},${startY}`;
    if (visited.has(key)) return null;
    visited.add(key);

    const q: Point[] = [{ x: startX, y: startY }];
    const libertyPoints = new Set<string>();

    while (q.length > 0) {
        const { x: cx, y: cy } = q.shift()!;
        if (cx > 0) {
            const n = boardState[cy][cx - 1];
            if (n === Player.None) libertyPoints.add(`${cx - 1},${cy}`);
            else if (n === playerColor && !visited.has(`${cx - 1},${cy}`)) {
                visited.add(`${cx - 1},${cy}`);
                q.push({ x: cx - 1, y: cy });
            }
        }
        if (cx < boardSize - 1) {
            const n = boardState[cy][cx + 1];
            if (n === Player.None) libertyPoints.add(`${cx + 1},${cy}`);
            else if (n === playerColor && !visited.has(`${cx + 1},${cy}`)) {
                visited.add(`${cx + 1},${cy}`);
                q.push({ x: cx + 1, y: cy });
            }
        }
        if (cy > 0) {
            const n = boardState[cy - 1][cx];
            if (n === Player.None) libertyPoints.add(`${cx},${cy - 1}`);
            else if (n === playerColor && !visited.has(`${cx},${cy - 1}`)) {
                visited.add(`${cx},${cy - 1}`);
                q.push({ x: cx, y: cy - 1 });
            }
        }
        if (cy < boardSize - 1) {
            const n = boardState[cy + 1][cx];
            if (n === Player.None) libertyPoints.add(`${cx},${cy + 1}`);
            else if (n === playerColor && !visited.has(`${cx},${cy + 1}`)) {
                visited.add(`${cx},${cy + 1}`);
                q.push({ x: cx, y: cy + 1 });
            }
        }
    }

    return libertyPoints.size;
}

export function hasPlayerStoneGroupInAtari(
    boardState: BoardState | undefined | null,
    player: Player.Black | Player.White,
): boolean {
    if (!boardState?.length) return false;
    const boardSize = boardState.length;
    const visited = new Set<string>();
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (boardState[y][x] !== player) continue;
            const liberties = findGroupLiberties(boardState, x, y, player, visited);
            if (liberties === 1) return true;
        }
    }
    return false;
}

export function isRankedFixedTurnScoringSession(
    session: Pick<LiveGameSession, 'isRankedGame' | 'isAiGame' | 'mode' | 'settings'>,
): boolean {
    if (!session.isRankedGame || session.isAiGame) return false;
    if (modeIncludesCaptureRule(session.mode, session.settings)) return false;
    const limit = Number(session.settings?.scoringTurnLimit ?? 0);
    return Number.isFinite(limit) && limit > 0;
}

export function getRankedFixedTurnCount(session: LiveGameSession): number {
    const policy = resolveArenaSessionPolicy(session);
    if (policy.countPassAsTurn) {
        return (session.moveHistory || []).length;
    }
    return (session.moveHistory || []).filter((m) => m && m.x !== -1 && m.y !== -1).length;
}

/**
 * 랭킹전 계가 턴 제한: 정해진 수순 도달 후 백이 마지막 수를 두고 흑 차례일 때 계가.
 * 백의 마지막 수로 흑이 단수가 되었으면 흑이 따내기 한 수를 더 두고 계가한다.
 */
export function shouldTriggerRankedFixedTurnScoring(session: LiveGameSession): boolean {
    if (!isRankedFixedTurnScoringSession(session)) return false;
    const limit = Number(session.settings?.scoringTurnLimit ?? 0);
    if (!Number.isFinite(limit) || limit <= 0) return false;

    const turnCount = getRankedFixedTurnCount(session);
    if (turnCount > limit) return true;
    if (turnCount < limit) return false;

    if (session.currentPlayer !== Player.Black) return false;
    if (hasPlayerStoneGroupInAtari(session.boardState, Player.Black)) return false;
    return true;
}
