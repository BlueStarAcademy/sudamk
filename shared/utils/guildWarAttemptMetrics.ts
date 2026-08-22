import { Player, GameMode } from '../types/enums.js';
import type { LiveGameSession } from '../types/index.js';
import { processMove } from '../logic/processMove.js';
import {
    GUILD_WAR_STAR_CAPTURE_TIER2_MIN,
    GUILD_WAR_STAR_CAPTURE_TIER3_MIN,
    getGuildWarStarScoreTier2MinDiff,
    getGuildWarStarScoreTier3MinDiff,
    GUILD_WAR_MATCH_GOLD_BY_STARS,
    GUILD_WAR_MATCH_GOLD_MISSILE_MULT,
    GUILD_WAR_MATCH_GOLD_HIDDEN_MULT,
} from '../constants/guildConstants.js';

function scoreModeStarsFromDiff(diff: number, boardId: string | undefined): number {
    const t3 = getGuildWarStarScoreTier3MinDiff(boardId);
    const t2 = getGuildWarStarScoreTier2MinDiff(boardId);
    if (diff >= t3) return 3;
    if (diff >= t2) return 2;
    return 1;
}

function scoreTotalsFromSession(game: LiveGameSession): { black: number; white: number } | null {
    const fs = game.finalScores;
    if (fs && typeof fs.black === 'number' && typeof fs.white === 'number') {
        return { black: fs.black, white: fs.white };
    }
    const ar = game.analysisResult;
    if (!ar || typeof ar !== 'object') return null;
    const pick =
        ar.system ??
        (game.blackPlayerId ? ar[game.blackPlayerId] : undefined) ??
        Object.values(ar)[0];
    const sd = pick?.scoreDetails;
    const black = sd?.black?.total;
    const white = sd?.white?.total;
    if (typeof black === 'number' && typeof white === 'number') {
        return { black, white };
    }
    return null;
}

export type GuildWarStarConditionKind = 'capture' | 'score';

export type GuildWarStarConditionFlags = {
    kind: GuildWarStarConditionKind;
    win: boolean;
    tier2: boolean;
    tier3: boolean;
    stars: number;
    captureT2: number;
    captureT3: number;
    scoreT2: number;
    scoreT3: number;
};

function clampGuildWarStars(stars: number): number {
    if (!Number.isFinite(stars)) return 0;
    return Math.max(0, Math.min(3, Math.round(stars)));
}

/**
 * 정산된 별 개수(0~3)로 조건별 금/은 표시를 복원한다.
 * 따내기는 승리 없이도 2·3번째 별을 딸 수 있어 `humanWon`이 필요하다.
 */
export function guildWarStarFlagsFromAwardedStars(
    kind: GuildWarStarConditionKind,
    humanWon: boolean,
    awardedStars: number
): Pick<GuildWarStarConditionFlags, 'win' | 'tier2' | 'tier3'> {
    const stars = clampGuildWarStars(awardedStars);
    if (kind === 'score') {
        return { win: stars >= 1, tier2: stars >= 2, tier3: stars >= 3 };
    }
    if (stars >= 3) return { win: true, tier2: true, tier3: true };
    if (stars === 2) {
        if (humanWon) return { win: true, tier2: true, tier3: false };
        return { win: false, tier2: true, tier3: true };
    }
    if (stars === 1) {
        if (humanWon) return { win: true, tier2: false, tier3: false };
        return { win: false, tier2: true, tier3: false };
    }
    return { win: false, tier2: false, tier3: false };
}

/**
 * 인게임·결과 UI 공통: 실제 `game.mode`로 따내기/계가 조건을 가른다.
 * (`getGuildWarBoardMode(boardId)` 레거시 칸 배정은 쓰지 않음)
 * `awardedStars`가 있으면 결과 화면은 정산 별 개수를 금별 표시의 기준으로 삼는다.
 */
export function evaluateGuildWarStarConditionFlags(
    game: LiveGameSession,
    humanEnum: Player,
    humanWon: boolean,
    awardedStars?: number
): GuildWarStarConditionFlags {
    const metrics = computeGuildWarAttemptMetrics(game, humanEnum, humanWon);
    const boardId = (game as { guildWarBoardId?: string }).guildWarBoardId;
    const kind: GuildWarStarConditionKind = game.mode === GameMode.Capture ? 'capture' : 'score';
    const captureT2 = GUILD_WAR_STAR_CAPTURE_TIER2_MIN;
    const captureT3 = GUILD_WAR_STAR_CAPTURE_TIER3_MIN;
    const scoreT2 = getGuildWarStarScoreTier2MinDiff(boardId);
    const scoreT3 = getGuildWarStarScoreTier3MinDiff(boardId);

    let win: boolean;
    let tier2: boolean;
    let tier3: boolean;
    if (kind === 'capture') {
        const max = metrics.maxSingleCapture ?? 0;
        win = humanWon;
        tier2 = max >= captureT2;
        tier3 = max >= captureT3;
    } else {
        const diff = metrics.scoreDiff ?? 0;
        win = humanWon;
        tier2 = humanWon && diff >= scoreT2;
        tier3 = humanWon && diff >= scoreT3;
    }

    const awarded =
        typeof awardedStars === 'number' && Number.isFinite(awardedStars)
            ? clampGuildWarStars(awardedStars)
            : undefined;
    if (awarded != null) {
        const overlaid = guildWarStarFlagsFromAwardedStars(kind, humanWon, awarded);
        win = overlaid.win;
        tier2 = overlaid.tier2;
        tier3 = overlaid.tier3;
    }

    return {
        kind,
        win,
        tier2,
        tier3,
        stars: awarded ?? metrics.stars,
        captureT2,
        captureT3,
        scoreT2,
        scoreT3,
    };
}

/**
 * 길드전 한 판 기준 별·따내기 수 등 (서버 `guildWarBoardResult`와 동일).
 * 따내기 모드에서 `maxSingleCapture`는 **한 수 포획 점수 합의 최대값**(문양·배치돌 가중 반영).
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

    if (game.mode === GameMode.Capture) {
        const opCap = game.captures?.[aiEnum] ?? 0;
        const margin = captures - opCap;
        const trackedMaxPoints = Number((game as any)?.maxSingleCapturePointsByPlayer?.[humanEnum] ?? 0) || 0;
        const maxSingleCapture =
            trackedMaxPoints > 0 ? trackedMaxPoints : getMaxSingleCaptureForPlayer(game, humanEnum);
        /** 길드전 집점수(따내기): 따낸 돌 총점의 2배 + 남은 시간 보너스(10초당 1집) */
        const captureHouseScore = captures * 2 + timeHouseBonus;
        // 별 개수는 UI「별 달성 조건」과 동일: 승리·한 번에 3점·한 번에 5점 각각 1개씩(최대 3)
        const stars =
            (humanWon ? 1 : 0) +
            (maxSingleCapture >= GUILD_WAR_STAR_CAPTURE_TIER2_MIN ? 1 : 0) +
            (maxSingleCapture >= GUILD_WAR_STAR_CAPTURE_TIER3_MIN ? 1 : 0);
        return { stars, captures, score: captureHouseScore, scoreDiff: margin, maxSingleCapture };
    }

    if (!humanWon) {
        return { stars: 0, captures, score: 0 };
    }

    const totals = scoreTotalsFromSession(game);
    if (totals) {
        const myTotal = humanEnum === Player.Black ? totals.black : totals.white;
        const opTotal = humanEnum === Player.Black ? totals.white : totals.black;
        const myHouseScore = Math.round((myTotal + timeHouseBonus) * 10) / 10;
        const diff = myTotal - opTotal;
        const stars = scoreModeStarsFromDiff(diff, (game as { guildWarBoardId?: string }).guildWarBoardId);
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
 * 길드전 한 판 종료 골드 — {@link GUILD_WAR_MATCH_GOLD_BY_STARS} 및 모드 배율과 동일.
 */
export function getGuildWarMatchGoldReward(mode: GameMode, stars: number): number {
    if (stars <= 0) return 0;
    const tier = Math.min(3, Math.max(1, stars)) as 1 | 2 | 3;
    const base = GUILD_WAR_MATCH_GOLD_BY_STARS[tier] ?? 0;
    if (mode === GameMode.Missile) return Math.round(base * GUILD_WAR_MATCH_GOLD_MISSILE_MULT);
    if (mode === GameMode.Hidden) return Math.round(base * GUILD_WAR_MATCH_GOLD_HIDDEN_MULT);
    return base;
}
