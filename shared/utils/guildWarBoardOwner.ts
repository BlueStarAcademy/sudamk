import { getGuildWarBoardMode } from '../constants/guildConstants.js';

/**
 * 길드전 한 칸(경기장)의 점령 길드 판정 — 양 길드의 최고 기록(`guild1BestResult` vs `guild2BestResult`) 비교.
 * 1) 획득 별 수가 많은 길드
 * 2) 동점이면 해당 칸 기록의 집점수(`score`, 계가·시간 보너스 반영값)
 * 3) 집점수도 동점(또는 한쪽만 score 없음)이면 먼저 기록을 남긴 쪽(`completedAt` 작을수록 우선)
 */
export function isGuildWarAttemptStrictlyBetter(
    prev: { stars: number; score?: number; completedAt?: number },
    cand: { stars: number; score?: number; completedAt?: number }
): boolean {
    if (cand.stars !== prev.stars) return cand.stars > prev.stars;
    const cs = cand.score ?? -1e15;
    const ps = prev.score ?? -1e15;
    if (cs !== ps) return cs > ps;
    return false;
}

export function getGuildWarBoardOwnerGuildId(
    board: { guild1BestResult?: GuildWarSideBest | null; guild2BestResult?: GuildWarSideBest | null } | null | undefined,
    guild1Id: string,
    guild2Id: string
): string | undefined {
    if (!board) return undefined;
    const r1 = board.guild1BestResult;
    const r2 = board.guild2BestResult;
    if (r1 && !r2) return guild1Id;
    if (!r1 && r2) return guild2Id;
    if (!r1 || !r2) return undefined;

    const stars1 = Number(r1.stars ?? 0) || 0;
    const stars2 = Number(r2.stars ?? 0) || 0;
    if (stars1 !== stars2) {
        return stars1 > stars2 ? guild1Id : guild2Id;
    }

    const s1 = typeof r1.score === 'number' && !Number.isNaN(r1.score) ? r1.score : null;
    const s2 = typeof r2.score === 'number' && !Number.isNaN(r2.score) ? r2.score : null;
    if (s1 !== null && s2 !== null) {
        if (s1 > s2) return guild1Id;
        if (s2 > s1) return guild2Id;
    }

    const c1 = Number(r1.completedAt) || 0;
    const c2 = Number(r2.completedAt) || 0;
    return c1 <= c2 ? guild1Id : guild2Id;
}

type GuildWarSideBest = {
    stars?: number;
    score?: number;
    completedAt?: number;
    captures?: number;
};

type GuildWarBoardAttemptsLike = {
    guild1BestResult?: GuildWarSideBest | null;
    guild2BestResult?: GuildWarSideBest | null;
    guild1Attempts?: number;
    guild2Attempts?: number;
    guild1Stars?: number;
    guild2Stars?: number;
    /** 없으면 `boardId`로 `getGuildWarBoardMode` 추론 */
    gameMode?: string;
};

/**
 * 실제 대국 기록으로 점령이 없을 때만: 봇 길드전에서 칸별 사용 도전권 횟수로 점령 길드를 정한다.
 * (서버 `applyBotGuildWarAttemptScript`가 채우는 guild1Attempts / guild2Attempts 와 동일 기준)
 */
export function getGuildWarBoardOwnerGuildIdWithBotAttemptsFallback(
    board: GuildWarBoardAttemptsLike | null | undefined,
    guild1Id: string,
    guild2Id: string,
    botGuildId: string,
): string | undefined {
    const canonical = getGuildWarBoardOwnerGuildId(board, guild1Id, guild2Id);
    if (canonical) return canonical;

    if (!board) return undefined;
    const g1a = Number(board.guild1Attempts ?? 0) || 0;
    const g2a = Number(board.guild2Attempts ?? 0) || 0;
    if (g1a === 0 && g2a === 0) return undefined;

    const botOnG1 = guild1Id === botGuildId;
    const botAtt = botOnG1 ? g1a : g2a;
    const humAtt = botOnG1 ? g2a : g1a;
    const humanId = botOnG1 ? guild2Id : guild1Id;

    if (botAtt > humAtt) return botGuildId;
    if (humAtt > botAtt) return humanId;

    const s1 = Number(board.guild1Stars ?? 0) || 0;
    const s2 = Number(board.guild2Stars ?? 0) || 0;
    if (s1 !== s2) return s1 > s2 ? guild1Id : guild2Id;
    return undefined;
}

/** 맵·대시보드 합산: 각 길드 칸의 집점수는 상대 점령과 무관하게 해당 길드 최고 기록만 반영 (구데이터는 captures 보조) */
export function guildWarHouseScoreFromStoredBest(
    r: GuildWarSideBest | null | undefined,
    boardMode: string | undefined,
): number {
    if (!r) return 0;
    if (typeof r.score === 'number' && !Number.isNaN(r.score)) return r.score;
    const mode = String(boardMode ?? '');
    if (mode === 'capture') return (Number(r.captures) || 0) * 2;
    return Number(r.captures) || 0;
}

function guildWarClientDisplayHash(s: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

/** 봇 길드전에서 기록 없이 도전권만으로 점령한 칸: 날개 별·상단 집 합·점령 기록 패널 표시용 (서버와 무관한 UI 전용) */
export type GuildWarBotBoardDisplayTally = {
    guild1Stars: number;
    guild2Stars: number;
    guild1HouseTally: number;
    guild2HouseTally: number;
    occupierCapturesDisplay?: number;
    occupierScoreDiffDisplay?: number;
};

export function getGuildWarBotBoardDisplayTally(
    board: GuildWarBoardAttemptsLike | null | undefined,
    input: {
        warId: string;
        boardId: string;
        guild1Id: string;
        guild2Id: string;
        botGuildId: string;
        isBotWar: boolean;
    },
): GuildWarBotBoardDisplayTally {
    const g1s = Number(board?.guild1Stars ?? 0) || 0;
    const g2s = Number(board?.guild2Stars ?? 0) || 0;
    let outG1 = g1s;
    let outG2 = g2s;

    const boardMode =
        (board?.gameMode as string | undefined) ||
        (input.boardId ? getGuildWarBoardMode(input.boardId) : undefined);

    let house1 = guildWarHouseScoreFromStoredBest(board?.guild1BestResult, boardMode);
    let house2 = guildWarHouseScoreFromStoredBest(board?.guild2BestResult, boardMode);

    let occupierCapturesDisplay: number | undefined;
    let occupierScoreDiffDisplay: number | undefined;

    if (!input.isBotWar || !board) {
        return {
            guild1Stars: outG1,
            guild2Stars: outG2,
            guild1HouseTally: house1,
            guild2HouseTally: house2,
        };
    }

    const botOnG1 = input.guild1Id === input.botGuildId;
    const botAtt = (botOnG1 ? Number(board.guild1Attempts ?? 0) : Number(board.guild2Attempts ?? 0)) || 0;

    const botBest = botOnG1 ? board.guild1BestResult : board.guild2BestResult;
    const hasBotRealScore = botBest && typeof botBest.score === 'number' && !Number.isNaN(botBest.score);

    /**
     * 봇 칸: 서버에 집점수(score) 기록이 없을 때 도전권만 있는 연출용 값.
     * 예전에는 `점령 길드 === 봇`일 때만 넣어, 점령이 바뀌면 0 ↔ 합성으로 깜빡였음.
     * 점령과 무관하게(해당 칸에 봇 도전이 있으면) war·칸 기준 고정값만 쓴다.
     */
    if (botAtt >= 1 && !hasBotRealScore) {
        const h = guildWarClientDisplayHash(`${input.warId}|${input.boardId}|bot-house`);
        const h2 = guildWarClientDisplayHash(`${input.warId}|${input.boardId}|bot-house2`);
        const synth = 18 + (h % 52) + (h2 % 28);
        if (botOnG1) house1 = synth;
        else house2 = synth;
    }

    const botSlotStars = botOnG1 ? outG1 : outG2;
    if (botSlotStars === 0 && botAtt >= 1) {
        const sh = guildWarClientDisplayHash(`${input.warId}|${input.boardId}|bot-syn-stars`);
        const synStar = 1 + (sh % 3);
        if (botOnG1) outG1 = synStar;
        else outG2 = synStar;
    }

    const bothBestMissing = !board.guild1BestResult && !board.guild2BestResult;
    if (bothBestMissing) {
        const ph = guildWarClientDisplayHash(`${input.warId}|${input.boardId}|occ`);
        occupierCapturesDisplay = 2 + (ph % 6) + ((ph >>> 8) % 5);
        occupierScoreDiffDisplay = 3 + ((ph >>> 4) % 14) + ((ph >>> 12) % 12);
    }

    return {
        guild1Stars: outG1,
        guild2Stars: outG2,
        guild1HouseTally: house1,
        guild2HouseTally: house2,
        occupierCapturesDisplay,
        occupierScoreDiffDisplay,
    };
}
