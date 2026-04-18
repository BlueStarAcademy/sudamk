/**
 * KataServer Service
 *
 * KataServer Move API 연동 (Stateless)
 * 레벨 + 국면만 전송하면 서버가 레벨에 맞는 착점을 선택하여 반환
 */

import { Point } from '../types/index.js';

// 환경변수
const KATA_SERVER_URL = process.env.KATA_SERVER_URL?.trim();
const KATA_SERVER_KEY = process.env.KATA_SERVER_KEY?.trim();
const KATA_SERVER_TIMEOUT_MS = Math.max(5000, parseInt(process.env.KATA_SERVER_TIMEOUT_MS || '15000', 10));

// GTP coordinate letters (19x19 board, skipping I)
const LETTERS = "ABCDEFGHJKLMNOPQRST";

/**
 * Convert point to GTP coordinate format
 */
function pointToGtpCoord(x: number, y: number, boardSize: number): string {
    if (x === -1 || y === -1) return 'pass';
    if (x >= 0 && x < LETTERS.length && y >= 0 && y < boardSize) {
        const letter = LETTERS[x];
        const row = boardSize - y;
        return `${letter}${row}`;
    }
    return 'pass';
}

/**
 * Convert GTP coordinate to point
 */
function gtpCoordToPoint(coord: string, boardSize: number): Point {
    const normalized = coord.trim().toUpperCase();
    if (normalized === 'PASS' || normalized === '') {
        return { x: -1, y: -1 };
    }
    const letter = normalized.charAt(0);
    const x = LETTERS.indexOf(letter);
    if (x === -1) {
        throw new Error(`Invalid GTP coordinate letter: ${letter}`);
    }
    const rowStr = normalized.substring(1);
    const row = parseInt(rowStr, 10);
    if (isNaN(row) || row < 1 || row > boardSize) {
        throw new Error(`Invalid GTP coordinate row: ${rowStr} for boardSize=${boardSize}`);
    }
    if (x >= boardSize) {
        throw new Error(`Invalid GTP column: ${letter} for boardSize=${boardSize}`);
    }
    const y = boardSize - row;
    return { x, y };
}

/**
 * moveHistory → KataServer moves 형식 변환
 * Returns [["B","Q4"],["W","D16"],...]
 */
function toKataServerMoves(
    moveHistory: Array<{ x: number; y: number; player: number }>,
    boardSize: number
): [string, string][] {
    return moveHistory.map(m => {
        const color = m.player === 1 ? 'B' : 'W';
        const coord = pointToGtpCoord(m.x, m.y, boardSize);
        return [color, coord] as [string, string];
    });
}

export interface GenerateKataServerMoveParams {
    boardSize: number;
    player: 'black' | 'white';
    moveHistory: Array<{ x: number; y: number; player: number }>;
    level: number;      // -31 ~ 9
    komi?: number;
    gameId?: string;
    /**
     * KataServer가 game_id 헤더로 세션을 캐시하는 경우, 히든 전체 공개 등으로 수순이 같은 길이인데
     * 좌표가 바뀌면 이전 국면이 남아 AI가 멈추거나 잘못된 수를 고를 수 있다. 이 값을 바꿔 캐시를 무효화한다.
     * 재입장(/api/game/rejoin) 시에는 settings.kataSessionResumeSeq 기반 `rsN`이 태그에 포함된다(goAiBot).
     */
    kataSessionTag?: string;
    /** false: PASS 후보 제외(둘 곳이 없을 때만 PASS). 생략 시 서버 기본(true). */
    allowPass?: boolean;
}

/**
 * KataServer Move API로 AI 수 생성
 * 서버가 레벨에 맞는 착점 선택 로직을 모두 처리
 */
export async function generateKataServerMove(params: GenerateKataServerMoveParams): Promise<Point> {
    if (!KATA_SERVER_URL) {
        throw new Error('KATA_SERVER_URL is not set');
    }

    const { boardSize, moveHistory, level, komi, gameId, kataSessionTag, allowPass, player } = params;
    const moves = toKataServerMoves(moveHistory, boardSize);
    const isFirstMove = moves.length < 2;

    const body: Record<string, unknown> = {
        level,
        boardXSize: boardSize,
        boardYSize: boardSize,
        rules: 'korean',
        komi: komi ?? 6.5,
        moves,
        firstMove: isFirstMove,
        player,
    };
    if (allowPass === false) {
        body.allowPass = false;
    }

    const url = `${KATA_SERVER_URL}/move`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
    };
    if (KATA_SERVER_KEY) {
        headers['Authorization'] = `key ${KATA_SERVER_KEY}`;
    }
    if (gameId) {
        headers['game_id'] = kataSessionTag ? `${gameId}:${kataSessionTag}` : gameId;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), KATA_SERVER_TIMEOUT_MS);

    try {
        console.log(
            `[KataServer] Requesting move: level=${level} boardSize=${boardSize} moves=${moves.length} firstMove=${isFirstMove} player=${player}`
        );

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`KataServer API error: ${response.status} - ${text}`);
        }

        const data = await response.json();

        console.log(`[KataServer] Move response: move=${data.move} strategy=${data.strategy} winrate=${data.winrate} bestMove=${data.bestMove}`);

        if (!data.move || data.move === 'PASS') return { x: -1, y: -1 };
        return gtpCoordToPoint(data.move, boardSize);
    } catch (err: any) {
        if (err.name === 'AbortError') {
            throw new Error(`KataServer timeout (${KATA_SERVER_TIMEOUT_MS}ms)`);
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * KataServer 사용 가능 여부 (환경변수 설정 확인)
 */
export function isKataServerAvailable(): boolean {
    return !!KATA_SERVER_URL;
}
