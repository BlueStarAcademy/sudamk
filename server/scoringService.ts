import * as types from '../types/index.js';
import type { LiveGameSession, Point, BoardState, AnalysisResult } from '../types/index.js';
import { Player } from '../types/index.js';

/**
 * 자체 계가 프로그램
 * KataGo가 실패하거나 타임아웃되었을 때 사용하는 백업 계가 시스템
 */

interface GroupInfo {
    stones: Point[];
    liberties: number;
    libertyPoints: Set<string>;
    isAlive: boolean;
}

/**
 * 빈 점의 영역을 계산합니다 (한국식 계가)
 * 영토 점 좌표도 함께 반환 (보드 시각화용)
 */
function calculateTerritory(
    boardState: BoardState,
    boardSize: number
): { black: number; white: number; blackTerritoryPoints: Point[]; whiteTerritoryPoints: Point[] } {
    const visited = Array(boardSize).fill(0).map(() => Array(boardSize).fill(false));
    let blackTerritory = 0;
    let whiteTerritory = 0;
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

            // BFS로 연결된 빈 영역 찾기
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

            // 영역이 한쪽 색상만 접촉하면 그 색상의 영역
            if (touchesBlack && !touchesWhite) {
                blackTerritory += region.length;
                blackTerritoryPoints.push(...region);
            } else if (touchesWhite && !touchesBlack) {
                whiteTerritory += region.length;
                whiteTerritoryPoints.push(...region);
            }
            // 양쪽 모두 접촉하거나 아무것도 접촉하지 않으면 중립 (계산하지 않음)
        }
    }

    return { black: blackTerritory, white: whiteTerritory, blackTerritoryPoints, whiteTerritoryPoints };
}

/**
 * 그룹의 생사를 판정합니다
 * 보수적 휴리스틱: 과도한 사석 판정(살아있는 그룹을 죽은 것으로 오판) 방지
 * - 자유도 2개 이상: 살아있음
 * - 자유도 1개: 단일 돌만 죽음으로 판정 (2개 이상 돌은 연결/포착 가능성 있어 살아있음으로)
 * - 자유도 0: 죽음 (실제로는 착점 후 제거되므로 보드에 없음)
 */
function determineGroupLife(
    group: { stones: Point[]; liberties: number; libertyPoints: Set<string> },
    boardState: BoardState,
    boardSize: number
): boolean {
    if (group.liberties >= 2) {
        return true;
    }
    if (group.liberties === 1) {
        // 자유도 1개: 단일 돌만 확실히 죽음. 2개 이상 돌은 포착/연결로 살 수 있음
        return group.stones.length > 1;
    }
    return false;
}

/**
 * 모든 그룹의 생사를 판정합니다
 */
function findDeadStones(
    boardState: BoardState,
    boardSize: number,
    player: Player
): Point[] {
    const deadStones: Point[] = [];
    const visited = new Set<string>();

    const getNeighbors = (x: number, y: number): Point[] => {
        const neighbors: Point[] = [];
        if (x > 0) neighbors.push({ x: x - 1, y });
        if (x < boardSize - 1) neighbors.push({ x: x + 1, y });
        if (y > 0) neighbors.push({ x, y: y - 1 });
        if (y < boardSize - 1) neighbors.push({ x, y: y + 1 });
        return neighbors;
    };

    const findGroup = (startX: number, startY: number, playerColor: Player): GroupInfo | null => {
        if (startY < 0 || startY >= boardSize || startX < 0 || startX >= boardSize) return null;
        if (boardState[startY][startX] !== playerColor) return null;

        const q: Point[] = [{ x: startX, y: startY }];
        const visitedStones = new Set([`${startX},${startY}`]);
        const libertyPoints = new Set<string>();
        const stones: Point[] = [{ x: startX, y: startY }];

        while (q.length > 0) {
            const { x: cx, y: cy } = q.shift()!;
            for (const n of getNeighbors(cx, cy)) {
                const key = `${n.x},${n.y}`;
                const neighborContent = boardState[n.y][n.x];

                if (neighborContent === Player.None) {
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

        return { stones, liberties: libertyPoints.size, libertyPoints, isAlive: false };
    };

    // 모든 그룹 찾기
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            const key = `${x},${y}`;
            if (boardState[y][x] === player && !visited.has(key)) {
                const group = findGroup(x, y, player);
                if (group) {
                    group.stones.forEach(s => visited.add(`${s.x},${s.y}`));
                    
                    // 그룹의 생사 판정
                    const isAlive = determineGroupLife(group, boardState, boardSize);
                    
                    if (!isAlive) {
                        // 죽은 그룹의 모든 돌을 사석으로 추가
                        deadStones.push(...group.stones);
                    }
                }
            }
        }
    }

    return deadStones;
}

/**
 * 자체 계가 프로그램 메인 함수
 * KataGo가 실패했을 때 사용하는 백업 계가 시스템
 */
export function calculateScoreManually(session: LiveGameSession): AnalysisResult {
    console.log(`[ScoringService] Starting manual score calculation for game ${session.id}`);
    
    const { boardState, settings, captures } = session;
    const boardSize = settings.boardSize;
    const komi = session.finalKomi ?? settings.komi ?? 6.5;

    // 1. 영역 계산
    const territory = calculateTerritory(boardState, boardSize);
    console.log(`[ScoringService] Territory: Black=${territory.black}, White=${territory.white}`);

    // 2. 사석 찾기
    const blackDeadStones = findDeadStones(boardState, boardSize, Player.Black);
    const whiteDeadStones = findDeadStones(boardState, boardSize, Player.White);
    console.log(`[ScoringService] Dead stones: Black=${blackDeadStones.length}, White=${whiteDeadStones.length}`);

    // 3. 캡처된 돌 (이미 게임에서 추적됨)
    const blackCaptures = captures[Player.Black] || 0;
    const whiteCaptures = captures[Player.White] || 0;
    console.log(`[ScoringService] Captures: Black=${blackCaptures}, White=${whiteCaptures}`);

    // 4. 최종 점수 계산 (한국식 계가)
    // 영역 + 사석 + 캡처된 돌
    const blackScore = territory.black + whiteDeadStones.length + blackCaptures;
    const whiteScore = territory.white + blackDeadStones.length + whiteCaptures + komi;

    console.log(`[ScoringService] Final scores: Black=${blackScore}, White=${whiteScore} (komi=${komi})`);

    // 5. 승률 계산 (간단한 휴리스틱)
    const scoreLead = blackScore - whiteScore;
    const winRateBlack = scoreLead > 0 ? 100 : (scoreLead < 0 ? 0 : 50);

    // 6. AnalysisResult 형식으로 변환
    const result: AnalysisResult = {
        winRateBlack,
        winRateChange: 0, // 수동 계산이므로 변화 없음
        scoreLead,
        deadStones: [...blackDeadStones, ...whiteDeadStones],
        ownershipMap: null, // 수동 계산에서는 ownership map 생성하지 않음
        recommendedMoves: [], // 수동 계산에서는 추천 수 없음
        areaScore: {
            black: blackScore,
            white: whiteScore
        },
        scoreDetails: {
            black: {
                territory: territory.black,
                captures: blackCaptures,
                liveCaptures: blackCaptures,
                deadStones: whiteDeadStones.length,
                baseStoneBonus: 0,
                hiddenStoneBonus: 0,
                timeBonus: 0,
                itemBonus: 0,
                total: blackScore
            },
            white: {
                territory: territory.white,
                captures: whiteCaptures,
                liveCaptures: whiteCaptures,
                deadStones: blackDeadStones.length,
                komi,
                baseStoneBonus: 0,
                hiddenStoneBonus: 0,
                timeBonus: 0,
                itemBonus: 0,
                total: whiteScore
            }
        },
        blackConfirmed: territory.blackTerritoryPoints,
        whiteConfirmed: territory.whiteTerritoryPoints,
        blackRight: [],
        whiteRight: [],
        blackLikely: [],
        whiteLikely: []
    };

    console.log(`[ScoringService] Manual score calculation completed for game ${session.id}`);
    return result;
}

