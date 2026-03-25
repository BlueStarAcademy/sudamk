import { Player, GameMode } from '../types/enums.js';
import type { LiveGameSession } from '../types/index.js';
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
): { stars: number; captures: number; scoreDiff?: number } {
    const aiEnum = humanEnum === Player.Black ? Player.White : Player.Black;
    const captures = game.captures?.[humanEnum] ?? 0;

    if (!humanWon) {
        return { stars: 0, captures };
    }

    if (game.mode === GameMode.Capture) {
        const opCap = game.captures?.[aiEnum] ?? 0;
        const margin = captures - opCap;
        const stars =
            captures >= GUILD_WAR_STAR_CAPTURE_TIER3_MIN
                ? 3
                : captures >= GUILD_WAR_STAR_CAPTURE_TIER2_MIN
                  ? 2
                  : 1;
        return { stars, captures, scoreDiff: margin };
    }

    const fs = game.finalScores;
    if (fs && typeof fs.black === 'number' && typeof fs.white === 'number') {
        const myTotal = humanEnum === Player.Black ? fs.black : fs.white;
        const opTotal = humanEnum === Player.Black ? fs.white : fs.black;
        const diff = myTotal - opTotal;
        const stars = scoreModeStarsFromDiff(diff);
        return { stars, captures, scoreDiff: Math.round(diff * 10) / 10 };
    }

    return { stars: 1, captures };
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
