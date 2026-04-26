import { Player, type BoardState, type Point } from '../types/enums.js';

/**
 * 빈 연결 영역이 흑·백 돌을 모두 맞대는 경우의 '공배 후보' 성분(좌표 집합).
 * 실제로 집에서 뺄지는 Kata 소유권이 애매한 칸만 골라 쓰는 쪽에서 결정한다(큰 빈 공간 전체를 막지 않도록).
 */
export function getGongbaeEmptyPointKeys(boardState: BoardState, boardSize: number): Set<string> {
    const visited = Array(boardSize)
        .fill(0)
        .map(() => Array(boardSize).fill(false));
    const gongbae = new Set<string>();

    const getNeighbors = (x: number, y: number): Point[] => {
        const neighbors: Point[] = [];
        if (x > 0) neighbors.push({ x: x - 1, y });
        if (x < boardSize - 1) neighbors.push({ x: x + 1, y });
        if (y > 0) neighbors.push({ x, y: y - 1 });
        if (y < boardSize - 1) neighbors.push({ x, y: y + 1 });
        return neighbors;
    };

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (boardState[y][x] !== Player.None) continue;
            if (visited[y][x]) continue;

            const region: Point[] = [];
            const q: Point[] = [{ x, y }];
            visited[y][x] = true;
            let touchesBlack = false;
            let touchesWhite = false;

            while (q.length > 0) {
                const current = q.shift()!;
                region.push(current);

                for (const neighbor of getNeighbors(current.x, current.y)) {
                    const neighborContent = boardState[neighbor.y][neighbor.x];

                    if (neighborContent === Player.None && !visited[neighbor.y][neighbor.x]) {
                        visited[neighbor.y][neighbor.x] = true;
                        q.push(neighbor);
                    } else if (neighborContent === Player.Black) {
                        touchesBlack = true;
                    } else if (neighborContent === Player.White) {
                        touchesWhite = true;
                    }
                }
            }

            if (touchesBlack && touchesWhite) {
                for (const p of region) {
                    gongbae.add(`${p.x},${p.y}`);
                }
            }
        }
    }

    return gongbae;
}

/**
 * 수동 계가 등: 빈 교차점을 BFS로 묶어, 그 영역이 흑만 맞닿으면 흑 집, 백만 맞닿으면 백 집.
 * 흑·백 모두 맞닿으면 공배로 집에 넣지 않는다.
 */
export function classifyKoreanTerritoryFromBoard(
    boardState: BoardState,
    boardSize: number
): {
    blackEmptyCount: number;
    whiteEmptyCount: number;
    blackTerritoryPoints: Point[];
    whiteTerritoryPoints: Point[];
} {
    const visited = Array(boardSize)
        .fill(0)
        .map(() => Array(boardSize).fill(false));
    let blackEmptyCount = 0;
    let whiteEmptyCount = 0;
    const blackTerritoryPoints: Point[] = [];
    const whiteTerritoryPoints: Point[] = [];

    const getNeighbors = (x: number, y: number): Point[] => {
        const neighbors: Point[] = [];
        if (x > 0) neighbors.push({ x: x - 1, y });
        if (x < boardSize - 1) neighbors.push({ x: x + 1, y });
        if (y > 0) neighbors.push({ x, y: y - 1 });
        if (y < boardSize - 1) neighbors.push({ x, y: y + 1 });
        return neighbors;
    };

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (boardState[y][x] !== Player.None) continue;
            if (visited[y][x]) continue;

            const region: Point[] = [];
            const q: Point[] = [{ x, y }];
            visited[y][x] = true;
            let touchesBlack = false;
            let touchesWhite = false;

            while (q.length > 0) {
                const current = q.shift()!;
                region.push(current);

                for (const neighbor of getNeighbors(current.x, current.y)) {
                    const neighborContent = boardState[neighbor.y][neighbor.x];

                    if (neighborContent === Player.None && !visited[neighbor.y][neighbor.x]) {
                        visited[neighbor.y][neighbor.x] = true;
                        q.push(neighbor);
                    } else if (neighborContent === Player.Black) {
                        touchesBlack = true;
                    } else if (neighborContent === Player.White) {
                        touchesWhite = true;
                    }
                }
            }

            if (touchesBlack && !touchesWhite) {
                blackEmptyCount += region.length;
                blackTerritoryPoints.push(...region);
            } else if (touchesWhite && !touchesBlack) {
                whiteEmptyCount += region.length;
                whiteTerritoryPoints.push(...region);
            }
        }
    }

    return { blackEmptyCount, whiteEmptyCount, blackTerritoryPoints, whiteTerritoryPoints };
}
