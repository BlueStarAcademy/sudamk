/**
 * 클라이언트 측 경량 바둑 AI
 * 싱글플레이 게임에서 서버 부하를 최소화하기 위해 클라이언트에서 AI 수를 계산
 * 서버는 최종 수만 검증하여 처리
 */

import { Player, Point, BoardState } from '../types/index.js';

interface SimpleAiMove {
    x: number;
    y: number;
}

/**
 * 매우 간단한 바둑 AI (클라이언트 측)
 * 서버 부하 없이 빠르게 수를 계산
 */
export function calculateSimpleAiMove(
    boardState: BoardState,
    aiPlayer: Player,
    opponentPlayer: Player,
    koInfo: { point: Point; turn: number } | null,
    moveHistoryLength: number,
    difficulty: number = 1
): SimpleAiMove | null {
    const boardSize = boardState.length;
    const validMoves: Array<{ move: Point; score: number }> = [];

    // 1. 간단한 유효한 수 찾기 (주변만 검사)
    const checkedPoints = new Set<string>();
    const occupiedPoints: Point[] = [];

    // 기존 돌 위치 찾기
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (boardState[y][x] !== Player.None) {
                occupiedPoints.push({ x, y });
            }
        }
    }

    // 주변 위치만 검사 (성능 최적화)
    const candidates: Point[] = [];
    if (occupiedPoints.length > 0) {
        for (const point of occupiedPoints) {
            const neighbors = getNeighbors(point.x, point.y, boardSize);
            for (const neighbor of neighbors) {
                const key = `${neighbor.x},${neighbor.y}`;
                // 빈 칸만 후보로 추가 (이미 돌이 있는 위치는 제외)
                if (!checkedPoints.has(key)) {
                    const stoneAtPos = boardState[neighbor.y]?.[neighbor.x];
                    if (stoneAtPos === Player.None) {
                        checkedPoints.add(key);
                        candidates.push(neighbor);
                    }
                }
            }
        }
    } else {
        // 빈 보드: 중앙 영역만
        const centerStart = Math.floor(boardSize / 2) - 1;
        const centerEnd = Math.floor(boardSize / 2) + 2;
        for (let y = Math.max(0, centerStart); y < Math.min(boardSize, centerEnd); y++) {
            for (let x = Math.max(0, centerStart); x < Math.min(boardSize, centerEnd); x++) {
                if (boardState[y][x] === Player.None) {
                    candidates.push({ x, y });
                }
            }
        }
    }

    // 살릴 수 있는 아타리 그룹 판단 (살릴 수 없는 돌은 살리지 않도록)
    const groupsInAtari = getMyGroupsInAtari(boardState, aiPlayer, boardSize);
    const savableSet = new Set<string>();
    for (const g of groupsInAtari) {
        if (isGroupSavable(boardState, g, aiPlayer, opponentPlayer, boardSize, koInfo, moveHistoryLength)) {
            savableSet.add(g.stones.map(s => `${s.x},${s.y}`).sort().join('|'));
        }
    }

    // 2. 각 후보 수에 대한 점수 계산
    for (const candidate of candidates) {
        if (koInfo && koInfo.point.x === candidate.x && koInfo.point.y === candidate.y && koInfo.turn === moveHistoryLength) continue;

        const libertyCount = countLiberties(boardState, candidate, aiPlayer, boardSize);
        const captureScore = checkCaptureOpportunity(boardState, candidate, aiPlayer, opponentPlayer, boardSize);
        if (libertyCount === 0 && captureScore === 0) continue;

        let score = 0;

        // 0) 내 돌 살리기: 살릴 수 있는 그룹을 살리는 수는 최우선. 살릴 수 없는 그룹에 쓸데없이 두는 수는 감점
        const { saves, wastedSave } = checkSaveOwnAtari(
            boardState, candidate, aiPlayer, opponentPlayer, boardSize,
            groupsInAtari, savableSet, koInfo, moveHistoryLength
        );
        if (saves > 0 && !wastedSave) {
            score += 9000 + saves * 1000; // 살릴 수 있는 돌 살리기 최우선
        } else if (wastedSave) {
            score -= 4000; // 살릴 수 없는 돌 살리려다 낭비하는 수 감점
        }

        // 1) 즉시 따내기 (캡처)
        if (captureScore > 0) {
            score += 8000 + captureScore * 800;
        }

        // 2) 아타리(단수)·축: 상대 자유도 2→1 로 만드는 수 (다음 수에 잡을 수 있음)
        const atariScore = checkAtariOpportunity(boardState, candidate, aiPlayer, opponentPlayer, boardSize);
        if (atariScore > 0) {
            score += 4000 + atariScore * 400;
        }

        // 3) 연결·안정성 (다른 약한 그룹과 연결해 살리기)
        const connectionScore = checkConnectionAndStability(boardState, candidate, aiPlayer, boardSize);
        score += connectionScore * 350;

        // 4) 유저 돌 근처 접근 (공격·압박)
        const proximityScore = checkProximityToOpponent(boardState, candidate, opponentPlayer, boardSize);
        score += proximityScore * 450;

        // 5) 유저 그룹 위협 (자유도 감소, 장문·그물에 유리한 위치)
        const threatScore = checkThreatToOpponent(boardState, candidate, aiPlayer, opponentPlayer, boardSize);
        score += threatScore * 550;

        // 5-1) 불리한 끊기 감점: 상대를 끊었는데 내 돌이 약하면(자유도 1~2) 끊지 않는 게 나음
        const { cutsOpponent, myLibertiesAfter } = getCutAndLibertyAfter(boardState, candidate, aiPlayer, opponentPlayer, boardSize);
        if (cutsOpponent && myLibertiesAfter <= 2) {
            score -= 4500; // 끊으면 내가 불리한 수는 두지 않음
        }

        // 6) 기본 안전성
        if (libertyCount >= 3) score += 80;
        else if (libertyCount >= 2) score += 50;
        else if (libertyCount >= 1) score += 20;

        if (difficulty <= 3 && Math.random() < 0.3) score *= 0.5;

        validMoves.push({ move: candidate, score });
    }

    if (validMoves.length === 0) {
        return null; // 패스
    }

    // 점수 순으로 정렬
    validMoves.sort((a, b) => b.score - a.score);

    // 상위 3개 중에서 선택 (약간의 랜덤성)
    const topMoves = validMoves.slice(0, Math.min(3, validMoves.length));
    const selected = topMoves[Math.floor(Math.random() * topMoves.length)];

    return { x: selected.move.x, y: selected.move.y };
}

/**
 * 이웃 위치 가져오기
 */
function getNeighbors(x: number, y: number, boardSize: number): Point[] {
    const neighbors: Point[] = [];
    if (x > 0) neighbors.push({ x: x - 1, y });
    if (x < boardSize - 1) neighbors.push({ x: x + 1, y });
    if (y > 0) neighbors.push({ x, y: y - 1 });
    if (y < boardSize - 1) neighbors.push({ x, y: y + 1 });
    return neighbors;
}

/**
 * 따내기 기회 확인 (간단한 버전)
 */
function checkCaptureOpportunity(
    boardState: BoardState,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player,
    boardSize: number
): number {
    let captureCount = 0;
    const neighbors = getNeighbors(point.x, point.y, boardSize);

    for (const neighbor of neighbors) {
        if (boardState[neighbor.y][neighbor.x] === opponentPlayer) {
            const group = findGroup(boardState, neighbor.x, neighbor.y, opponentPlayer, boardSize);
            if (group && group.liberties === 1) {
                captureCount += group.stones.length;
            }
        }
    }

    return captureCount;
}

/**
 * 아타리(단수) 기회 확인
 */
function checkAtariOpportunity(
    boardState: BoardState,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player,
    boardSize: number
): number {
    const neighbors = getNeighbors(point.x, point.y, boardSize);
    let atariCount = 0;

    for (const neighbor of neighbors) {
        if (boardState[neighbor.y][neighbor.x] === opponentPlayer) {
            const group = findGroup(boardState, neighbor.x, neighbor.y, opponentPlayer, boardSize);
            if (group && group.liberties === 2) {
                atariCount += group.stones.length; // 그룹 크기도 고려
            }
        }
    }

    return atariCount;
}

/**
 * 유저 돌과의 근접성 확인 (공격적 접근)
 */
function checkProximityToOpponent(
    boardState: BoardState,
    point: Point,
    opponentPlayer: Player,
    boardSize: number
): number {
    let minDistance = Infinity;
    let nearbyOpponentStones = 0;

    // 모든 유저 돌과의 최단 거리 계산
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (boardState[y][x] === opponentPlayer) {
                const distance = Math.abs(point.x - x) + Math.abs(point.y - y);
                minDistance = Math.min(minDistance, distance);
                
                // 근처의 유저 돌 개수 (거리 2 이내)
                if (distance <= 2) {
                    nearbyOpponentStones++;
                }
            }
        }
    }

    // 거리가 가까울수록 높은 점수
    if (minDistance === Infinity) return 0.0; // 유저 돌이 없음
    if (minDistance === 1) return 3.0; // 바로 인접 (최고 점수)
    if (minDistance === 2) return 2.0; // 2칸 거리
    if (minDistance === 3) return 1.0; // 3칸 거리
    if (minDistance === 4) return 0.5; // 4칸 거리
    if (minDistance >= 5) return 0.1; // 멀면 낮은 점수

    // 근처에 유저 돌이 많을수록 더 높은 점수
    return Math.min(3.0, nearbyOpponentStones / 1.5);
}

/**
 * 유저 그룹 위협 확인 (자유도 감소)
 */
function checkThreatToOpponent(
    boardState: BoardState,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player,
    boardSize: number
): number {
    // 임시로 돌을 놓고 유저 그룹의 자유도 확인
    const tempBoard = boardState.map(row => [...row]);
    tempBoard[point.y][point.x] = aiPlayer;

    const neighbors = getNeighbors(point.x, point.y, boardSize);
    let threatScore = 0;

    for (const neighbor of neighbors) {
        if (tempBoard[neighbor.y][neighbor.x] === opponentPlayer) {
            const group = findGroup(tempBoard, neighbor.x, neighbor.y, opponentPlayer, boardSize);
            if (group) {
                const libertyCount = group.liberties;
                const groupSize = group.stones.length;
                // 자유도가 적을수록 위협적, 그룹이 클수록 더 위협적
                if (libertyCount === 1) {
                    threatScore += 8.0 + groupSize * 0.5; // 다음 턴에 잡을 수 있음
                } else if (libertyCount === 2) {
                    threatScore += 5.0 + groupSize * 0.3; // 2턴 안에 잡을 수 있음
                } else if (libertyCount === 3) {
                    threatScore += 2.5 + groupSize * 0.2; // 위협적
                } else if (libertyCount === 4) {
                    threatScore += 1.0 + groupSize * 0.1; // 약간 위협적
                }
            }
        }
    }

    return threatScore;
}

/**
 * 연결과 안정성 확인 (생사 개념)
 * 이미 잘 연결되어 끊어지지 않는 곳을 연결하는 수는 보너스 없음. 약한 그룹을 살리거나 끊김 위험이 있을 때만 연결 가치.
 */
function checkConnectionAndStability(
    boardState: BoardState,
    point: Point,
    aiPlayer: Player,
    boardSize: number
): number {
    const tempBoard = boardState.map(row => [...row]);
    tempBoard[point.y][point.x] = aiPlayer;

    const neighbors = getNeighbors(point.x, point.y, boardSize);
    const connectedGroups: Array<{ stones: Point[]; liberties: number }> = [];

    for (const neighbor of neighbors) {
        if (tempBoard[neighbor.y][neighbor.x] === aiPlayer) {
            const group = findGroup(tempBoard, neighbor.x, neighbor.y, aiPlayer, boardSize);
            if (group) {
                const isNewGroup = !connectedGroups.some(g =>
                    g.stones.some(s => group.stones.some(gs => gs.x === s.x && gs.y === s.y))
                );
                if (isNewGroup) connectedGroups.push(group);
            }
        }
    }

    if (connectedGroups.length === 0) {
        return Math.max(0, -1.0); // 고립된 돌은 약간 감점
    }

    const minLiberties = Math.min(...connectedGroups.map(g => g.liberties));
    const maxLiberties = Math.max(...connectedGroups.map(g => g.liberties));
    const totalStones = connectedGroups.reduce((sum, g) => sum + g.stones.length, 0);

    // 이미 잘 연결되어 끊어지지 않는 곳: 두 그룹 모두 자유도 3 이상이면 불필요한 연결 → 보너스 거의 없음
    const bothSafe = connectedGroups.length >= 2 && minLiberties >= 3 && maxLiberties >= 3;
    if (bothSafe) {
        return 0;
    }

    // 끊김 위험이 있거나 약한 그룹을 살리는 연결만 가치 있음 (자유도 1~2인 그룹이 있을 때)
    if (minLiberties <= 2) {
        let connectionScore = connectedGroups.length * 2.0 + totalStones * 0.3 + minLiberties * 1.5;
        return Math.max(0, connectionScore);
    }

    // 한 그룹만 접한 경우 (확장/안정화): 보통 보너스
    return connectedGroups.length * 1.0 + minLiberties * 0.5;
}

/**
 * 자유도 계산 (간단한 버전)
 * 돌을 놓고 상대 돌을 따낸 후의 자유도를 계산
 */
function countLiberties(
    boardState: BoardState,
    point: Point,
    player: Player,
    boardSize: number
): number {
    // 임시로 돌을 놓고 자유도 확인
    const tempBoard = boardState.map(row => [...row]);
    tempBoard[point.y][point.x] = player;

    const opponentPlayer = player === Player.Black ? Player.White : Player.Black;
    
    // 상대 돌을 따낼 수 있는지 확인 (인접한 상대 그룹의 자유도가 1이면 따냄)
    const neighbors = getNeighbors(point.x, point.y, boardSize);
    for (const neighbor of neighbors) {
        if (tempBoard[neighbor.y][neighbor.x] === opponentPlayer) {
            const opponentGroup = findGroup(tempBoard, neighbor.x, neighbor.y, opponentPlayer, boardSize);
            if (opponentGroup && opponentGroup.liberties === 0) {
                // 상대 그룹을 따냄 (임시 보드에서 제거)
                for (const stone of opponentGroup.stones) {
                    tempBoard[stone.y][stone.x] = Player.None;
                }
            }
        }
    }

    // 상대 돌을 따낸 후 자신의 그룹의 자유도 확인
    const group = findGroup(tempBoard, point.x, point.y, player, boardSize);
    return group ? group.liberties : 0;
}

/** 그룹 정보 (자유도 좌표 포함) */
type GroupInfo = { stones: Point[]; liberties: number; libertyPoints: Point[] };

/**
 * 그룹 찾기 (자유도 좌표 포함)
 */
function findGroupWithLibertyPoints(
    boardState: BoardState,
    startX: number,
    startY: number,
    player: Player,
    boardSize: number
): GroupInfo | null {
    if (boardState[startY][startX] !== player) return null;

    const stones: Point[] = [];
    const visited = new Set<string>();
    const queue: Point[] = [{ x: startX, y: startY }];

    while (queue.length > 0) {
        const current = queue.shift()!;
        const key = `${current.x},${current.y}`;
        if (visited.has(key)) continue;
        visited.add(key);
        if (boardState[current.y][current.x] === player) {
            stones.push(current);
            for (const n of getNeighbors(current.x, current.y, boardSize)) {
                if (!visited.has(`${n.x},${n.y}`)) queue.push(n);
            }
        }
    }

    const libertySet = new Set<string>();
    const libertyPoints: Point[] = [];
    for (const stone of stones) {
        for (const n of getNeighbors(stone.x, stone.y, boardSize)) {
            if (boardState[n.y][n.x] === Player.None) {
                const k = `${n.x},${n.y}`;
                if (!libertySet.has(k)) {
                    libertySet.add(k);
                    libertyPoints.push({ x: n.x, y: n.y });
                }
            }
        }
    }
    return { stones, liberties: libertySet.size, libertyPoints };
}

function findGroup(
    boardState: BoardState,
    startX: number,
    startY: number,
    player: Player,
    boardSize: number
): { stones: Point[]; liberties: number } | null {
    const g = findGroupWithLibertyPoints(boardState, startX, startY, player, boardSize);
    return g ? { stones: g.stones, liberties: g.liberties } : null;
}

/**
 * 내 돌 중 아타리(자유도 1)인 그룹들 반환 (살릴 수 있는지 판단용)
 */
function getMyGroupsInAtari(
    boardState: BoardState,
    aiPlayer: Player,
    boardSize: number
): GroupInfo[] {
    const seen = new Set<string>();
    const result: GroupInfo[] = [];
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (boardState[y][x] !== aiPlayer) continue;
            const key = `${x},${y}`;
            if (seen.has(key)) continue;
            const g = findGroupWithLibertyPoints(boardState, x, y, aiPlayer, boardSize);
            if (g && g.liberties === 1) {
                result.push(g);
                for (const s of g.stones) seen.add(`${s.x},${s.y}`);
            }
        }
    }
    return result;
}

/**
 * 이 수가 자살수인지 (돌을 놓은 뒤 내 그룹 자유도가 0이고 따낸 돌이 없으면 자살)
 */
function isSelfAtari(
    boardState: BoardState,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player,
    boardSize: number
): boolean {
    const libs = countLiberties(boardState, point, aiPlayer, boardSize);
    const captureScore = checkCaptureOpportunity(boardState, point, aiPlayer, opponentPlayer, boardSize);
    return libs === 0 && captureScore === 0;
}

/**
 * 이 그룹을 살릴 수 있는지 판단: 탈출 수(자유도 칸) 중 하나라도 두면 자유도 2 이상이 되고 자살이 아니면 살릴 수 있음
 */
function isGroupSavable(
    boardState: BoardState,
    group: GroupInfo,
    aiPlayer: Player,
    opponentPlayer: Player,
    boardSize: number,
    koInfo: { point: Point; turn: number } | null,
    moveHistoryLength: number
): boolean {
    for (const lib of group.libertyPoints) {
        if (koInfo && koInfo.point.x === lib.x && koInfo.point.y === lib.y && koInfo.turn === moveHistoryLength) continue;
        if (isSelfAtari(boardState, lib, aiPlayer, opponentPlayer, boardSize)) continue;
        const tempBoard = boardState.map(row => [...row]);
        tempBoard[lib.y][lib.x] = aiPlayer;
        const opp = aiPlayer === Player.Black ? Player.White : Player.Black;
        for (const n of getNeighbors(lib.x, lib.y, boardSize)) {
            if (tempBoard[n.y][n.x] === opp) {
                const og = findGroup(tempBoard, n.x, n.y, opp, boardSize);
                if (og && og.liberties === 0) {
                    for (const s of og.stones) tempBoard[s.y][s.x] = Player.None;
                    break;
                }
            }
        }
        const myGroup = findGroup(tempBoard, lib.x, lib.y, aiPlayer, boardSize);
        if (myGroup && myGroup.liberties >= 2) return true;
    }
    return false;
}

/**
 * 이 수가 상대를 끊는 수인지, 그리고 끊은 뒤 내 돌의 자유도 (불리한 끊기 판단용)
 */
function getCutAndLibertyAfter(
    boardState: BoardState,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player,
    boardSize: number
): { cutsOpponent: boolean; myLibertiesAfter: number } {
    const tempBoard = boardState.map(row => [...row]);
    tempBoard[point.y][point.x] = aiPlayer;

    for (const n of getNeighbors(point.x, point.y, boardSize)) {
        if (tempBoard[n.y][n.x] === opponentPlayer) {
            const og = findGroup(tempBoard, n.x, n.y, opponentPlayer, boardSize);
            if (og && og.liberties === 0) {
                for (const s of og.stones) tempBoard[s.y][s.x] = Player.None;
            }
        }
    }

    const adjacentOpponentGroups: Array<{ stones: Point[] }> = [];
    for (const n of getNeighbors(point.x, point.y, boardSize)) {
        if (tempBoard[n.y][n.x] === opponentPlayer) {
            const g = findGroup(tempBoard, n.x, n.y, opponentPlayer, boardSize);
            if (g) {
                const isNew = !adjacentOpponentGroups.some(ag =>
                    ag.stones.some(as => g.stones.some(gs => gs.x === as.x && gs.y === as.y))
                );
                if (isNew) adjacentOpponentGroups.push(g);
            }
        }
    }

    const myGroup = findGroup(tempBoard, point.x, point.y, aiPlayer, boardSize);
    const myLibertiesAfter = myGroup ? myGroup.liberties : 0;
    const cutsOpponent = adjacentOpponentGroups.length >= 2;

    return { cutsOpponent, myLibertiesAfter };
}

/**
 * 이 수가 내 아타리 그룹을 살리는 수인지, 그리고 그 그룹이 살릴 수 있는 그룹인지
 */
function checkSaveOwnAtari(
    boardState: BoardState,
    point: Point,
    aiPlayer: Player,
    opponentPlayer: Player,
    boardSize: number,
    groupsInAtari: GroupInfo[],
    savableSet: Set<string>,
    koInfo: { point: Point; turn: number } | null,
    moveHistoryLength: number
): { saves: number; wastedSave: boolean } {
    let saves = 0;
    let wastedSave = false;
    const tempBoard = boardState.map(row => [...row]);
    tempBoard[point.y][point.x] = aiPlayer;
    const opp = aiPlayer === Player.Black ? Player.White : Player.Black;
    for (const n of getNeighbors(point.x, point.y, boardSize)) {
        if (tempBoard[n.y][n.x] === opp) {
            const og = findGroup(tempBoard, n.x, n.y, opp, boardSize);
            if (og && og.liberties === 0) {
                for (const s of og.stones) tempBoard[s.y][s.x] = Player.None;
            }
        }
    }
    for (const g of groupsInAtari) {
        const hasStoneHere = g.stones.some(s => s.x === point.x && s.y === point.y);
        const libertyHere = g.libertyPoints.some(l => l.x === point.x && l.y === point.y);
        if (!libertyHere && !hasStoneHere) continue;
        const merged = findGroup(tempBoard, point.x, point.y, aiPlayer, boardSize);
        if (!merged) continue;
        const stillHasGroupStones = g.stones.some(s => merged.stones.some(m => m.x === s.x && m.y === s.y));
        if (!stillHasGroupStones) continue;
        if (merged.liberties >= 2) {
            saves++;
            const key = g.stones.map(s => `${s.x},${s.y}`).sort().join('|');
            if (!savableSet.has(key)) wastedSave = true;
        } else if (merged.liberties === 1) {
            const key = g.stones.map(s => `${s.x},${s.y}`).sort().join('|');
            if (!savableSet.has(key)) wastedSave = true;
        }
    }
    return { saves, wastedSave };
}

