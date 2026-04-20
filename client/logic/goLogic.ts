// Client-side Go logic (read-only operations)
// This is a client-safe version of server/goLogic.ts
// Does not mutate game state, only provides read-only operations

import * as types from '../../shared/types/index.js';
import type { LiveGameSession, Point, BoardState, Player as PlayerType } from '../../shared/types/index.js';

/**
 * 주사위 바둑 흑 착수: 빈 점이어야 하며, 판에 백이 있으면 백의 활로에만 둘 수 있음.
 * 서버 `server/modes/diceGo.ts` DICE_PLACE_STONE 활로 검사와 동일 조건.
 */
export function isDiceGoLibertyPlacement(game: LiveGameSession, x: number, y: number): boolean {
    const boardState = game.boardState;
    if (!boardState?.length) return false;
    const row = boardState[y];
    if (!row || x < 0 || x >= row.length || y < 0 || y >= boardState.length) return false;
    if (row[x] !== types.Player.None) return false;

    const anyWhiteStones = boardState.flat().some((s) => s === types.Player.White);
    if (!anyWhiteStones) return true;

    const liberties = getGoLogic(game).getAllLibertiesOfPlayer(types.Player.White, boardState);
    if (liberties.length > 0 && !liberties.some((p) => p.x === x && p.y === y)) return false;
    return true;
}

/**
 * 도둑과 경찰 착수: 빈 점이어야 하며, 역할·턴에 따라 흑(도둑) 활로 규칙 적용.
 * 서버 `server/modes/thief.ts` THIEF_PLACE_STONE 활로 검사와 동일 조건 (`thiefFreestyleThiefPlacing` 포함).
 */
export function isThiefGoValidPlacement(game: LiveGameSession, x: number, y: number, actingUserId: string): boolean {
    const boardState = game.boardState;
    if (!boardState?.length || !game.thiefPlayerId) return false;
    const row = boardState[y];
    if (!row || x < 0 || x >= row.length || y < 0 || y >= boardState.length) return false;
    if (row[x] !== types.Player.None) return false;

    const logic = getGoLogic(game);
    const isThief = actingUserId === game.thiefPlayerId;

    if (isThief) {
        const noBlackStonesOnBoard = !boardState.flat().some((s) => s === types.Player.Black);
        const canPlaceFreely =
            game.turnInRound === 1 || noBlackStonesOnBoard || !!game.thiefFreestyleThiefPlacing;
        if (!canPlaceFreely) {
            const liberties = logic.getAllLibertiesOfPlayer(types.Player.Black, boardState);
            if (liberties.length > 0 && !liberties.some((p) => p.x === x && p.y === y)) return false;
        }
    } else {
        const blackStonesOnBoard = boardState.flat().some((s) => s === types.Player.Black);
        if (blackStonesOnBoard) {
            const liberties = logic.getAllLibertiesOfPlayer(types.Player.Black, boardState);
            if (liberties.length > 0 && !liberties.some((p) => p.x === x && p.y === y)) return false;
        }
    }
    return true;
}

export const getGoLogic = (game: LiveGameSession) => {
    const { boardState, settings: { boardSize } } = game;

    const getNeighbors = (x: number, y: number) => {
        const neighbors = [];
        if (x > 0) neighbors.push({ x: x - 1, y });
        if (x < boardSize - 1) neighbors.push({ x: x + 1, y });
        if (y > 0) neighbors.push({ x, y: y - 1 });
        if (y < boardSize - 1) neighbors.push({ x, y: y + 1 });
        return neighbors;
    };

    const findGroup = (startX: number, startY: number, playerColor: PlayerType, currentBoard: BoardState) => {
        if (startY < 0 || startY >= boardSize || startX < 0 || startX >= boardSize) return null;
        if (currentBoard[startY]?.[startX] !== playerColor) return null;
        
        const q: Point[] = [{ x: startX, y: startY }];
        const visitedStones = new Set([`${startX},${startY}`]);
        const libertyPoints = new Set<string>();
        const stones: Point[] = [{ x: startX, y: startY }];

        while (q.length > 0) {
            const { x: cx, y: cy } = q.shift()!;
            for (const n of getNeighbors(cx, cy)) {
                const key = `${n.x},${n.y}`;
                const neighborContent = currentBoard[n.y][n.x];

                if (neighborContent === types.Player.None) {
                    libertyPoints.add(key);
                } else if (neighborContent === playerColor) {
                    if (!visitedStones.has(key)) {
                        visitedStones.add(key);
                        q.push(n);
                        stones.push(n);
                    }
                }
            }
        }
        return { stones, liberties: libertyPoints.size, libertyPoints, player: playerColor };
    };

    const getAllGroups = (playerColor: PlayerType, currentBoard: BoardState) => {
        const groups: { stones: Point[]; liberties: number; libertyPoints: Set<string>; player: PlayerType }[] = [];
        const visited = new Set<string>();
        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                if (currentBoard[y][x] === playerColor && !visited.has(`${x},${y}`)) {
                    const group = findGroup(x, y, playerColor, currentBoard);
                    if (group) {
                        groups.push(group);
                        group.stones.forEach(s => visited.add(`${s.x},${s.y}`));
                    }
                }
            }
        }
        return groups;
    };
    
    const getAllLibertiesOfPlayer = (playerColor: PlayerType, currentBoard: BoardState): Point[] => {
        const allLibertyPoints = new Set<string>();
        const visited = new Set<string>();

        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                const stoneKey = `${x},${y}`;
                if (currentBoard[y][x] === playerColor && !visited.has(stoneKey)) {
                    const group = findGroup(x, y, playerColor, currentBoard);
                    if (group) {
                        group.stones.forEach(s => visited.add(`${s.x},${s.y}`));
                        group.libertyPoints.forEach(l => allLibertyPoints.add(l));
                    }
                }
            }
        }
        return Array.from(allLibertyPoints).map(key => {
            const [x, y] = key.split(',').map(Number);
            return { x, y };
        });
    };

    const getScore = () => {
        const territory = { [types.Player.Black]: 0, [types.Player.White]: 0, [types.Player.None]: 0 };
        const visited = Array(boardSize).fill(0).map(() => Array(boardSize).fill(false));

        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                if (boardState[y][x] !== types.Player.None) {
                    territory[boardState[y][x]]++;
                } else if (!visited[y][x]) {
                    const q = [{ x, y }];
                    visited[y][x] = true;
                    const region = [{ x, y }];
                    let touchesBlack = false;
                    let touchesWhite = false;

                    while (q.length > 0) {
                        const current = q.shift()!;
                        for (const n of getNeighbors(current.x, current.y)) {
                            if (!visited[n.y][n.x]) {
                                if (boardState[n.y][n.x] === types.Player.None) {
                                    visited[n.y][n.x] = true;
                                    q.push(n);
                                    region.push(n);
                                 } else if (boardState[n.y][n.x] === types.Player.Black) {
                                    touchesBlack = true;
                                } else {
                                    touchesWhite = true;
                                }
                            }
                        }
                    }

                    if (touchesBlack && !touchesWhite) {
                        territory[types.Player.Black] += region.length;
                    } else if (touchesWhite && !touchesBlack) {
                        territory[types.Player.White] += region.length;
                    }
                }
            }
        }
        
        // Add captures to the score
        territory[types.Player.Black] += game.captures[types.Player.Black];
        territory[types.Player.White] += game.captures[types.Player.White];

        return { score: { black: territory[types.Player.Black], white: territory[types.Player.White] } };
    };

    return {
        getScore,
        findGroup,
        getAllLibertiesOfPlayer,
        getNeighbors,
        getAllGroups,
    };
};

