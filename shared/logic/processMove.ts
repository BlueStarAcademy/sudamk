import * as types from '../types/index.js';
import type { LiveGameSession, Point, BoardState, Player as PlayerType } from '../types/index.js';

/**
 * Pure Go rules engine shared by client and server.
 *
 * - Validates a placement move (occupied, ko, suicide)
 * - Applies captures
 * - Produces next koInfo
 *
 * Notes:
 * - Pass is not represented here. Pass should be handled as an action (x=-1,y=-1) outside this function.
 * - Uses `boardState[y][x]` indexing.
 */
export const processMove = (
  boardState: BoardState,
  move: { x: number; y: number; player: PlayerType },
  koInfo: LiveGameSession['koInfo'],
  moveHistoryLength: number,
  options?: { ignoreSuicide?: boolean; isSinglePlayer?: boolean; opponentPlayer?: PlayerType }
): {
  isValid: boolean;
  newBoardState: BoardState;
  capturedStones: Point[];
  newKoInfo: LiveGameSession['koInfo'];
  reason?: 'ko' | 'suicide' | 'occupied';
} => {
  const { x, y, player } = move;
  const boardSize = boardState.length;
  const opponent = player === types.Player.Black ? types.Player.White : types.Player.Black;

  // Range check
  if (y < 0 || y >= boardSize || x < 0 || x >= boardSize) {
    return { isValid: false, reason: 'occupied', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
  }

  const stoneAtPosition = boardState[y][x];

  // Own stone
  if (stoneAtPosition === player) {
    return { isValid: false, reason: 'occupied', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
  }

  // Single-player: explicitly block placing on opponent stone when requested
  if (options?.isSinglePlayer && options?.opponentPlayer && stoneAtPosition === options.opponentPlayer) {
    return { isValid: false, reason: 'occupied', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
  }

  // PvP: block placing on opponent stone
  if (!options?.isSinglePlayer && stoneAtPosition === opponent) {
    return { isValid: false, reason: 'occupied', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
  }

  // Any occupied
  if (stoneAtPosition !== types.Player.None) {
    return { isValid: false, reason: 'occupied', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
  }

  // Simple ko
  if (koInfo && koInfo.point.x === x && koInfo.point.y === y && koInfo.turn === moveHistoryLength) {
    return { isValid: false, reason: 'ko', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
  }

  const tempBoard: BoardState = JSON.parse(JSON.stringify(boardState));
  tempBoard[y][x] = player;

  const getNeighbors = (px: number, py: number): Point[] => {
    const neighbors: Point[] = [];
    if (px > 0) neighbors.push({ x: px - 1, y: py });
    if (px < boardSize - 1) neighbors.push({ x: px + 1, y: py });
    if (py > 0) neighbors.push({ x: px, y: py - 1 });
    if (py < boardSize - 1) neighbors.push({ x: px, y: py + 1 });
    return neighbors;
  };

  const findGroup = (
    startX: number,
    startY: number,
    playerColor: PlayerType,
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

    return { stones, liberties: libertyPoints.size };
  };

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

  if (capturedStones.length > 0) {
    for (const stone of capturedStones) {
      tempBoard[stone.y][stone.x] = types.Player.None;
    }
  }

  const myGroup = findGroup(x, y, player, tempBoard);
  if (!options?.ignoreSuicide && myGroup && myGroup.liberties === 0) {
    return { isValid: false, reason: 'suicide', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
  }

  let newKoInfo: LiveGameSession['koInfo'] = null;
  if (myGroup && capturedStones.length === 1 && myGroup.stones.length === 1 && myGroup.liberties === 1) {
    newKoInfo = { point: singleCapturePoint!, turn: moveHistoryLength + 1 };
  }

  return { isValid: true, newBoardState: tempBoard, capturedStones, newKoInfo };
};

