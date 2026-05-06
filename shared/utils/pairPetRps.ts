import type { PairPetCoreStatsSix } from '../constants/pairArena.js';
import type { User, InventoryItem, PairPetRpsAttribute } from '../types/entities.js';
import type { PairGameTurnSeat } from './pairGameTurn.js';
import {
    resolvePairPetMetaFromInventoryRow,
    isPairPetRpsAttribute,
    backfillPairPetRpsAttribute,
    resolvePairPetRpsAttributeFromMeta,
} from './pairPetRoll.js';
import { getEquippedPairPetInventoryRow } from './pairEquippedPet.js';

export type { PairPetRpsAttribute } from '../types/entities.js';
export { isPairPetRpsAttribute, resolvePairPetRpsAttributeFromMeta, backfillPairPetRpsAttribute } from './pairPetRoll.js';

export const PAIR_PET_RPS_IMAGE_BY_ATTR: Record<PairPetRpsAttribute, string> = {
    1: '/images/pets/attribute1.webp',
    2: '/images/pets/attribute2.webp',
    3: '/images/pets/attribute3.webp',
};

/** 인게임 아바타 등 `anchor` 한 변(px)에 비례한 가위·바위·보 뱃지 한 변 */
export function pairPetRpsBadgePxFromAnchor(anchorPx: number): number {
    if (!Number.isFinite(anchorPx) || anchorPx <= 0) return 18;
    return Math.min(34, Math.max(15, Math.round(anchorPx * 0.4 + 2)));
}

/**
 * 펫 초상 셸·로비 썸네일 등 부모(보통 `position: relative` 정사각) 너비에 맞춤.
 * 이미지 타일이 커지면 퍼센트가 커지고, 너무 작거나 클 때는 px로 바닥·상한.
 */
export const PAIR_PET_RPS_BADGE_SHELL_SIZE_CSS = 'clamp(15px, 30%, 32px)';

function hashSeed(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** a 기준: a가 b에게 이기면 1, 비기면 0, 지면 -1 */
export function pairPetRpsCompare(a: PairPetRpsAttribute, b: PairPetRpsAttribute): -1 | 0 | 1 {
    if (a === b) return 0;
    if ((a === 1 && b === 3) || (a === 2 && b === 1) || (a === 3 && b === 2)) return 1;
    return -1;
}

export function scalePairPetCoreStatsSix(stats: PairPetCoreStatsSix, factor: number): PairPetCoreStatsSix {
    const r = (n: number) => Math.max(1, Math.round(n * factor));
    return {
        concentration: r(stats.concentration),
        thinkingSpeed: r(stats.thinkingSpeed),
        judgment: r(stats.judgment),
        calculation: r(stats.calculation),
        combatPower: r(stats.combatPower),
        stability: r(stats.stability),
    };
}

type PairTeamMembers = { id: string; name: string; kind: string; slot: string }[];

function participantTeam(
    teamA: PairTeamMembers | undefined,
    teamB: PairTeamMembers | undefined,
    participantId: string,
): 'A' | 'B' | null {
    if (teamA?.some((m) => m.id === participantId)) return 'A';
    if (teamB?.some((m) => m.id === participantId)) return 'B';
    return null;
}

/** 페어 펫 AI 대전: 팀 B에 상대 AI·상대 펫 AI가 함께 있는 전형 레이아웃 — 속성 배율을 ±5%로 완화 */
export function isPairPetAiDualOpponentLayout(pairGame: {
    teamA: { members: PairTeamMembers };
    teamB: { members: PairTeamMembers };
}): boolean {
    const b = pairGame.teamB?.members ?? [];
    return b.some((m) => m.id === 'pair-opponent-ai') && b.some((m) => m.id === 'pair-opponent-pet');
}

function rollOpponentRps(gameId: string, participantId: string, rng: () => number): PairPetRpsAttribute {
    if (participantId === 'pair-opponent-ai' || participantId === 'pair-opponent-pet') {
        return (1 + Math.floor(rng() * 3)) as PairPetRpsAttribute;
    }
    const r = mulberry32(hashSeed(`${gameId}|rps-seat|${participantId}`));
    return (1 + Math.floor(r() * 3)) as PairPetRpsAttribute;
}

/**
 * 페어 인게임: pet/ai 좌석에 가위바위보 속성을 붙이고, 팀이 다른 좌석끼리 약하면 본인 6코어 감소·유리하면 상대 6코어 감소.
 * 펫 펫 AI 대전(상대 AI 두 좌석)은 ±10% 대신 ±5%.
 */
export function applyPairPetRpsForPairGameStart(
    pairGame: {
        teamA: { members: PairTeamMembers };
        teamB: { members: PairTeamMembers };
        petKataStatsByParticipantId?: Record<string, PairPetCoreStatsSix>;
        pairPetRpsAttributeByParticipantId?: Record<string, PairPetRpsAttribute>;
    },
    turnOrder: PairGameTurnSeat[],
    petStatUsers: User[],
    gameId: string,
): string[] {
    const rpsSeats = turnOrder.filter((s) => s.kind === 'pet' || s.kind === 'ai');
    if (rpsSeats.length < 2) return [];

    const stats = pairGame.petKataStatsByParticipantId;
    if (!stats || Object.keys(stats).length === 0) return [];

    const dualAi = isPairPetAiDualOpponentLayout(pairGame);
    const weakFactor = dualAi ? 0.95 : 0.9;
    const advantageDebuff = dualAi ? 0.95 : 0.9;

    const teamA = pairGame.teamA?.members;
    const teamB = pairGame.teamB?.members;

    const attr: Record<string, PairPetRpsAttribute> = {};
    const rngStream = mulberry32(hashSeed(`${gameId}|pair-rps-opponents`));

    for (const u of petStatUsers) {
        const row = getEquippedPairPetInventoryRow(u) as InventoryItem | null;
        if (!row) continue;
        const meta = resolvePairPetMetaFromInventoryRow(row);
        const a = resolvePairPetRpsAttributeFromMeta(meta, row.id, row.createdAt ?? Date.now());
        attr[`pet-ai-${u.id}`] = a;
    }

    for (const s of rpsSeats) {
        const pid = s.participantId;
        if (attr[pid] != null) continue;
        if (/^pet-ai-/.test(pid)) {
            attr[pid] = backfillPairPetRpsAttribute(`${gameId}|${pid}`, 0);
            continue;
        }
        attr[pid] = rollOpponentRps(gameId, pid, rngStream);
    }

    const mult: Record<string, number> = {};
    for (const s of rpsSeats) {
        if (stats[s.participantId]) mult[s.participantId] = 1;
    }

    for (const pSeat of rpsSeats) {
        const pId = pSeat.participantId;
        const pTeam = participantTeam(teamA, teamB, pId);
        if (!pTeam || !stats[pId]) continue;
        const aP = attr[pId];
        if (!isPairPetRpsAttribute(aP)) continue;

        for (const oSeat of rpsSeats) {
            const oId = oSeat.participantId;
            if (pId === oId) continue;
            const oTeam = participantTeam(teamA, teamB, oId);
            if (!oTeam || oTeam === pTeam || !stats[oId]) continue;
            const aO = attr[oId];
            if (!isPairPetRpsAttribute(aO)) continue;

            const cmp = pairPetRpsCompare(aP, aO);
            if (cmp < 0) mult[pId]! *= weakFactor;
            if (cmp > 0) mult[oId]! *= advantageDebuff;
        }
    }

    const nextStats: Record<string, PairPetCoreStatsSix> = { ...stats };
    const debuffedParticipantIds: string[] = [];
    for (const id of Object.keys(mult)) {
        const f = mult[id]!;
        if (typeof f === 'number' && f > 0 && f < 0.999999 && stats[id]) {
            nextStats[id] = scalePairPetCoreStatsSix(stats[id]!, f);
            debuffedParticipantIds.push(id);
        }
    }
    pairGame.petKataStatsByParticipantId = nextStats;
    pairGame.pairPetRpsAttributeByParticipantId = { ...attr };
    return debuffedParticipantIds;
}
