import { Player } from '../types/index.js';
import type { BoardState } from '../types/index.js';
import { processMove } from './goLogic.js';

/**
 * 선포석 게임에서 `kataCaptureSetupMoves`가 유실돼도 Kata 수순 접두를 다시 만들 수 있도록
 * 게임 생성·배치 새로고침 시점의 `boardState` 깊은 복사를 JSON에 함께 둔다.
 */
export function cloneBoardStateForKataOpeningSnapshot(
    boardState: BoardState | null | undefined
): BoardState | undefined {
    if (!boardState?.length) return undefined;
    return boardState.map((row) => (Array.isArray(row) ? [...row] : row)) as BoardState;
}

/**
 * 빈 판에서 재생하면 현재 `boardState`와 같아지도록 하는 Kata 입력용 선행 수.
 * KataServer는 boardState를 받지 않고 moves만으로 국면을 복원하므로,
 * 따내기·고정 포석 등 moveHistory에 없는 선배치 돌을 이 배열로 앞에 붙인다.
 *
 * 일반 규칙(흑·백 번갈)으로 재생되도록: 연속 흑 착점 사이에 백 PASS, 연속 백 사이에 흑 PASS.
 * 마지막 수 이후 다음 착수가 흑이 되도록(대부분 탑·AI에서 유저 흑 선) 필요 시 한 수 PASS를 덧둔다.
 */
export function encodeBoardStateAsKataSetupMovesFromEmpty(
    boardState: BoardState | null | undefined
): Array<{ x: number; y: number; player: Player }> {
    if (!boardState?.length) return [];
    const size = boardState.length;
    const blacks: { x: number; y: number }[] = [];
    const whites: { x: number; y: number }[] = [];
    for (let y = 0; y < size; y++) {
        const row = boardState[y];
        if (!row || row.length !== size) continue;
        for (let x = 0; x < size; x++) {
            const c = row[x] as Player;
            if (c === Player.Black) blacks.push({ x, y });
            else if (c === Player.White) whites.push({ x, y });
        }
    }
    const cmp = (a: { x: number; y: number }, b: { x: number; y: number }) => a.y - b.y || a.x - b.x;
    blacks.sort(cmp);
    whites.sort(cmp);

    const out: Array<{ x: number; y: number; player: Player }> = [];
    if (blacks.length === 0 && whites.length === 0) return out;

    for (let i = 0; i < blacks.length; i++) {
        out.push({ ...blacks[i]!, player: Player.Black });
        if (i < blacks.length - 1) {
            out.push({ x: -1, y: -1, player: Player.White });
        }
    }

    if (blacks.length > 0 && whites.length === 0) {
        out.push({ x: -1, y: -1, player: Player.White });
        return out;
    }

    if (blacks.length === 0) {
        for (let i = 0; i < whites.length; i++) {
            out.push({ x: -1, y: -1, player: Player.Black });
            out.push({ ...whites[i]!, player: Player.White });
        }
        return out;
    }

    for (let i = 0; i < whites.length; i++) {
        out.push({ ...whites[i]!, player: Player.White });
        if (i < whites.length - 1) {
            out.push({ x: -1, y: -1, player: Player.Black });
        }
    }
    return out;
}

export function oppositePlayerForKata(p: Player): Player {
    return p === Player.Black ? Player.White : Player.Black;
}

/** encode 접두 재생 후 다음 착수자가 wantToMove가 되도록 PASS를 덧붙인다. */
export function appendPassesUntilSideToMove(
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
        `[appendPassesUntilSideToMove] could not align to wantToMove=${wantToMove} (len=${moves.length})`,
    );
    return out;
}

function boardsEqualForKata(a: BoardState, b: BoardState): boolean {
    if (!a?.length || !b?.length || a.length !== b.length) return false;
    for (let y = 0; y < a.length; y++) {
        if (!b[y] || a[y].length !== b[y].length) return false;
        for (let x = 0; x < a[y].length; x++) {
            if ((a[y][x] ?? 0) !== (b[y][x] ?? 0)) return false;
        }
    }
    return true;
}

/**
 * Kata 입력용 수열이 빈 판에서 규칙대로 재생되어 `targetBoard`와 일치하는지 검사.
 * (오프닝 접두 + moveHistory 불일치 시 KataGo Illegal move 방지)
 */
export function doesKataCombinedMovesReplayToBoard(
    boardSize: number,
    moves: Array<{ x: number; y: number; player: number }>,
    targetBoard: BoardState | null | undefined
): boolean {
    if (!targetBoard?.length || targetBoard.length !== boardSize) return false;
    let board: BoardState = Array.from({ length: boardSize }, () =>
        Array.from({ length: boardSize }, () => Player.None),
    );
    let koInfo: { point: { x: number; y: number }; turn: number } | null = null;
    let turnIdx = 0;
    for (const m of moves) {
        if (m.x < 0 || m.y < 0) {
            koInfo = null;
            turnIdx++;
            continue;
        }
        const r = processMove(
            board,
            { x: m.x, y: m.y, player: m.player as Player },
            koInfo,
            turnIdx,
            {}
        );
        if (!r.isValid) return false;
        board = r.newBoardState.map((row) => [...row]);
        koInfo = r.newKoInfo ?? null;
        turnIdx++;
    }
    return boardsEqualForKata(board, targetBoard);
}
