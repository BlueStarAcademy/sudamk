import { Player, GameMode } from '../types/enums.js';
import type { LiveGameSession } from '../types/index.js';
import { processMove } from '../logic/processMove.js';
import {
    GUILD_WAR_STAR_CAPTURE_TIER2_MIN,
    GUILD_WAR_STAR_CAPTURE_TIER3_MIN,
    GUILD_WAR_STAR_SCORE_TIER2_MIN_DIFF,
    GUILD_WAR_STAR_SCORE_TIER3_MIN_DIFF,
} from '../constants/guildConstants.js';

function scoreModeStarsFromDiff(diff: number): number {
    if (diff >= GUILD_WAR_STAR_SCORE_TIER3_MIN_DIFF) return 3;
    if (diff >= GUILD_WAR_STAR_SCORE_TIER2_MIN_DIFF) return 2;
    return 1;
}

/**
 * 길드전 한 판 기준 별·따내기 수 등 (서버 `guildWarBoardResult`와 동일).
 */
export function computeGuildWarAttemptMetrics(
    game: LiveGameSession,
    humanEnum: Player,
    humanWon: boolean
): { stars: number; captures: number; score?: number; scoreDiff?: number; maxSingleCapture?: number } {
    const aiEnum = humanEnum === Player.Black ? Player.White : Player.Black;
    const captures = game.captures?.[humanEnum] ?? 0;
    const myTimeLeftSec = humanEnum === Player.Black
        ? Math.max(0, Math.floor(game.blackTimeLeft ?? 0))
        : Math.max(0, Math.floor(game.whiteTimeLeft ?? 0));
    // 길드전 동점 비교용 집점수: 종료 시점 남은 시간 10초당 1집 보너스
    const timeHouseBonus = Math.floor(myTimeLeftSec / 10);

    if (!humanWon) {
        return { stars: 0, captures, score: 0 };
    }

    if (game.mode === GameMode.Capture) {
        const opCap = game.captures?.[aiEnum] ?? 0;
        const margin = captures - opCap;
        const trackedMaxSingleCapture = Number((game as any)?.maxSingleCaptureByPlayer?.[humanEnum] ?? 0) || 0;
        const maxSingleCapture = trackedMaxSingleCapture > 0
            ? trackedMaxSingleCapture
            : getMaxSingleCaptureForPlayer(game, humanEnum);
        const stars =
            maxSingleCapture >= GUILD_WAR_STAR_CAPTURE_TIER3_MIN
                ? 3
                : maxSingleCapture >= GUILD_WAR_STAR_CAPTURE_TIER2_MIN
                  ? 2
                  : 1;
        return { stars, captures, score: timeHouseBonus, scoreDiff: margin, maxSingleCapture };
    }

    const fs = game.finalScores;
    if (fs && typeof fs.black === 'number' && typeof fs.white === 'number') {
        const myTotal = humanEnum === Player.Black ? fs.black : fs.white;
        const opTotal = humanEnum === Player.Black ? fs.white : fs.black;
        const myHouseScore = Math.round((myTotal + timeHouseBonus) * 10) / 10;
        const diff = myTotal - opTotal;
        const stars = scoreModeStarsFromDiff(diff);
        return { stars, captures, score: myHouseScore, scoreDiff: Math.round(diff * 10) / 10 };
    }

    return { stars: 1, captures, score: timeHouseBonus };
}

function getMaxSingleCaptureForPlayer(game: LiveGameSession, player: Player): number {
    const boardSize = Math.max(1, Number(game.settings?.boardSize ?? 9) || 9);
    const boardState: Player[][] = Array.from({ length: boardSize }, () => Array(boardSize).fill(Player.None));
    let koInfo: LiveGameSession['koInfo'] = null;
    let maxSingleCapture = 0;

    const baseStones = game.baseStones || [];
    for (const stone of baseStones) {
        if (!stone || stone.x < 0 || stone.y < 0 || stone.x >= boardSize || stone.y >= boardSize) continue;
        if (stone.player === Player.Black || stone.player === Player.White) {
            boardState[stone.y][stone.x] = stone.player;
        }
    }

    (game.moveHistory || []).forEach((move, idx) => {
        if (!move || move.x < 0 || move.y < 0) return;
        const result = processMove(
            boardState,
            { x: move.x, y: move.y, player: move.player },
            koInfo,
            idx
        );
        if (!result.isValid) return;
        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                boardState[y][x] = result.newBoardState[y][x];
            }
        }
        koInfo = result.newKoInfo;
        if (move.player === player) {
            maxSingleCapture = Math.max(maxSingleCapture, result.capturedStones.length);
        }
    });

    return maxSingleCapture;
}

/**
 * 길드전 종료 골드: 따내기 기준 1★300 / 2★500 / 3★1000, 0★0.
 * 미사일 1.5배, 히든 2배, 그 외(클래식·따내기)는 따내기와 동일.
 */
export function getGuildWarMatchGoldReward(mode: GameMode, stars: number): number {
    if (stars <= 0) return 0;
    const tier = Math.min(3, Math.max(1, stars));
    const captureTable: Record<number, number> = { 1: 300, 2: 500, 3: 1000 };
    const base = captureTable[tier] ?? 0;
    if (mode === GameMode.Missile) return Math.round(base * 1.5);
    if (mode === GameMode.Hidden) return Math.round(base * 2);
    return base;
}
