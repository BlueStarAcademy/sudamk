import type { Point } from '../types/index.js';

const GTP_COLUMN_LETTERS = 'ABCDEFGHJKLMNOPQRST';

export type KataAnalysisMoveInfo = {
    move?: string;
    winrate?: number;
    scoreLead?: number;
    visits?: number;
};

export type KataNoPassMoveSelection = {
    move: string;
    point: Point;
    winrate?: number;
    scoreLead?: number;
    source: 'topMove' | 'nonPassFallback' | 'passAllowed';
};

export function isPassLikeGtpMove(move: string | null | undefined): boolean {
    const normalized = String(move ?? '').trim().toUpperCase();
    return normalized === '' || normalized === 'PASS' || normalized === 'RESIGN';
}

export function gtpMoveToPoint(move: string, boardSize: number): Point | null {
    const normalized = move.trim().toUpperCase();
    if (isPassLikeGtpMove(normalized)) return null;

    const letter = normalized.charAt(0);
    const x = GTP_COLUMN_LETTERS.indexOf(letter);
    if (x < 0 || x >= boardSize) return null;

    const row = Number.parseInt(normalized.slice(1), 10);
    if (!Number.isInteger(row) || row < 1 || row > boardSize) return null;

    return { x, y: boardSize - row };
}

export function selectKataMoveWithoutPass(
    moveInfos: KataAnalysisMoveInfo[] | undefined,
    boardSize: number,
    allowPass: boolean,
): KataNoPassMoveSelection | null {
    if (!Array.isArray(moveInfos) || moveInfos.length === 0) return null;

    const top = moveInfos[0];
    const topMove = top?.move;
    if (topMove && !isPassLikeGtpMove(topMove)) {
        const point = gtpMoveToPoint(topMove, boardSize);
        if (point) {
            return {
                move: topMove,
                point,
                winrate: top.winrate,
                scoreLead: top.scoreLead,
                source: 'topMove',
            };
        }
    }

    if (allowPass && topMove && topMove.trim().toUpperCase() === 'PASS') {
        return {
            move: 'PASS',
            point: { x: -1, y: -1 },
            winrate: top.winrate,
            scoreLead: top.scoreLead,
            source: 'passAllowed',
        };
    }

    for (const info of moveInfos.slice(1)) {
        if (!info?.move || isPassLikeGtpMove(info.move)) continue;
        const point = gtpMoveToPoint(info.move, boardSize);
        if (!point) continue;
        return {
            move: info.move,
            point,
            winrate: info.winrate,
            scoreLead: info.scoreLead,
            source: 'nonPassFallback',
        };
    }

    return null;
}
