import { Player } from '../types/index.js';
import type { BoardState } from '../types/index.js';

/**
 * 빈 판에서 재생하면 현재 `boardState`와 같아지도록 하는 Kata 입력용 선행 수.
 * KataServer는 boardState를 받지 않고 moves만으로 국면을 복원하므로,
 * 따내기·고정 포석 등 moveHistory에 없는 선배치 돌을 이 배열로 앞에 붙인다.
 *
 * 순서: 흑 전부(행→열) 후 백 전부(행→열). 연속 동색 착점은 Kata 엔진이 포석으로 처리하는 경우가 많다.
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
    return [
        ...blacks.map((p) => ({ ...p, player: Player.Black })),
        ...whites.map((p) => ({ ...p, player: Player.White })),
    ];
}
