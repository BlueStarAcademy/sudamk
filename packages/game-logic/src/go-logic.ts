/**
 * Go game logic
 * Core rules for Go game (바둑)
 */

export type Point = {
  x: number;
  y: number;
};

export type Player = 0 | 1 | 2; // None, Black, White

export type BoardState = Player[][];

export interface Move {
  x: number;
  y: number;
  player: Player;
}

export interface ProcessMoveResult {
  success: boolean;
  newBoardState?: BoardState;
  captures?: number;
  koPoint?: Point;
  error?: string;
}

/**
 * Process a move on the board
 * Migrated from the original project
 */
export function processMove(
  boardState: BoardState,
  move: Move,
  koInfo: { point: Point; turn: number } | null,
  moveHistoryLength: number = 0
): ProcessMoveResult {
  const { x, y, player } = move;
  const boardSize = boardState.length;
  const opponent = player === 1 ? 2 : 1;

  // Range check
  if (y < 0 || y >= boardSize || x < 0 || x >= boardSize) {
    return { success: false, error: 'Move out of bounds' };
  }

  // Check if position is occupied
  const stoneAtPosition = boardState[y][x];
  if (stoneAtPosition !== 0) {
    return { success: false, error: 'Position already occupied' };
  }

  // Check ko rule
  if (koInfo && koInfo.point.x === x && koInfo.point.y === y && koInfo.turn === moveHistoryLength) {
    return { success: false, error: 'Ko rule violation' };
  }

  // Create temporary board
  const tempBoard: BoardState = boardState.map((row) => [...row]);
  tempBoard[y][x] = player;

  // Get neighbors
  const getNeighbors = (px: number, py: number): Point[] => {
    const neighbors: Point[] = [];
    if (px > 0) neighbors.push({ x: px - 1, y: py });
    if (px < boardSize - 1) neighbors.push({ x: px + 1, y: py });
    if (py > 0) neighbors.push({ x: px, y: py - 1 });
    if (py < boardSize - 1) neighbors.push({ x: px, y: py + 1 });
    return neighbors;
  };

  // Find group and liberties
  const findGroup = (
    startX: number,
    startY: number,
    playerColor: Player,
    currentBoard: BoardState
  ): { stones: Point[]; liberties: number } | null => {
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

        if (neighborContent === 0) {
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
    return { stones, liberties: libertyPoints.size };
  };

  // Check for captures
  let capturedStones: Point[] = [];
  let singleCapturePoint: Point | null = null;
  const checkedOpponentNeighbors = new Set<string>();

  for (const n of getNeighbors(x, y)) {
    const key = `${n.x},${n.y}`;
    if (tempBoard[n.y][n.x] === opponent && !checkedOpponentNeighbors.has(key)) {
      const group = findGroup(n.x, n.y, opponent, tempBoard);
      if (group && group.liberties === 0) {
        capturedStones.push(...group.stones);
        if (group.stones.length === 1) {
          singleCapturePoint = group.stones[0];
        }
        group.stones.forEach((s) => checkedOpponentNeighbors.add(`${s.x},${s.y}`));
      }
    }
  }

  // Remove captured stones
  if (capturedStones.length > 0) {
    for (const stone of capturedStones) {
      tempBoard[stone.y][stone.x] = 0;
    }
  }

  // Check for suicide
  const myGroup = findGroup(x, y, player, tempBoard);
  if (myGroup && myGroup.liberties === 0) {
    return { success: false, error: 'Suicide move not allowed' };
  }

  // Update ko info
  let newKoInfo: { point: Point; turn: number } | null = null;
  if (
    myGroup &&
    capturedStones.length === 1 &&
    myGroup.stones.length === 1 &&
    myGroup.liberties === 1 &&
    singleCapturePoint
  ) {
    newKoInfo = { point: singleCapturePoint, turn: moveHistoryLength + 1 };
  }

  return {
    success: true,
    newBoardState: tempBoard,
    captures: capturedStones.length,
    koPoint: newKoInfo?.point,
  };
}

/**
 * Check if a move is valid
 */
export function isValidMove(
  boardState: BoardState,
  move: Move,
  koInfo: { point: Point; turn: number } | null,
  moveHistoryLength: number = 0
): boolean {
  const result = processMove(boardState, move, koInfo, moveHistoryLength);
  return result.success;
}

/**
 * Calculate captures
 */
export function calculateCaptures(
  boardState: BoardState,
  move: Move,
  koInfo: { point: Point; turn: number } | null = null,
  moveHistoryLength: number = 0
): number {
  const result = processMove(boardState, move, koInfo, moveHistoryLength);
  return result.captures || 0;
}
