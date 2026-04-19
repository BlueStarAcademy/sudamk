// 길드 보스 난이도 단계(1~10): 체력/능력치/보상/등급 컷 스케일
import type { GuildBossInfo } from '../types/index.js';
import { CoreStat, ItemGrade } from '../types/enums.js';
import {
    GUILD_BOSS_DAMAGE_ABSOLUTE_BOUNDS,
    GUILD_BOSS_REWARDS_BY_GRADE,
    GUILD_BOSS_TICKET_TYPES,
    GUILD_BOSS_LOTTO_CHANCE,
    GUILD_BOSS_SSS_LOTTO_POOL,
} from '../constants/index.js';

export const GUILD_BOSS_MAX_DIFFICULTY_STAGE = 10;

const getRandom = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export function clampGuildBossStage(n: number | undefined | null): number {
    const x = typeof n === 'number' && !Number.isNaN(n) ? Math.floor(n) : 1;
    return Math.min(GUILD_BOSS_MAX_DIFFICULTY_STAGE, Math.max(1, x));
}

export function guildBossHpMultiplier(stage: number): number {
    return Math.pow(1.5, clampGuildBossStage(stage) - 1);
}

/** 보스 스킬·대결용 능력 배율 (단계당 1.2배) */
export function guildBossStatMultiplier(stage: number): number {
    return Math.pow(1.2, clampGuildBossStage(stage) - 1);
}

/** 골드·재화 등 보상 배율 (단계당 1.5배) */
export function guildBossRewardMultiplier(stage: number): number {
    return Math.pow(1.5, clampGuildBossStage(stage) - 1);
}

export type GuildBossSwapMailTier = 'half' | 'quarter' | 'defeated' | 'none';

// 월요일 0시 "보스 교체 정산" 보상 설계용 기본값 (1단계 기준)
// 각 단계는 `guildBossRewardMultiplier(stage)=1.5^(stage-1)`로 스케일됩니다.
const GUILD_BOSS_SWAP_MAIL_BASE_1ST: Record<
    Exclude<GuildBossSwapMailTier, 'none'>,
    { researchPoints: number; guildCoins: number }
> = {
    half: { researchPoints: 200, guildCoins: 50 }, // 잔여 50% 이하
    quarter: { researchPoints: 400, guildCoins: 100 }, // 잔여 25% 이하
    defeated: { researchPoints: 800, guildCoins: 200 }, // 격파(0)
};

export function getGuildBossSwapMailBaseRewards(stage: number, tier: Exclude<GuildBossSwapMailTier, 'none'>) {
    const mult = guildBossRewardMultiplier(stage);
    const base = GUILD_BOSS_SWAP_MAIL_BASE_1ST[tier];
    return {
        researchPoints: Math.max(0, Math.round(base.researchPoints * mult)),
        guildCoins: Math.max(0, Math.round(base.guildCoins * mult)),
    };
}

/**
 * "내 총 데미지 / 최대 총 데미지" 비율로 추가 보상 비율 산정
 * - 0 : 추가 0
 * - 상위권일수록 추가 비율 증가
 */
export function getGuildBossSwapMailExtraRate(damageShare: number): number {
    const s = Math.max(0, Math.min(1, damageShare));
    if (s <= 0) return 0;
    if (s >= 0.9) return 1.0; // 100% 추가
    if (s >= 0.6) return 0.6;
    if (s >= 0.3) return 0.3;
    return 0.1;
}

export function getGuildBossSwapMailMemberRewards(args: {
    stage: number;
    tier: Exclude<GuildBossSwapMailTier, 'none'>;
    memberDamage: number;
    maxDamage: number;
}): { researchPoints: number; guildCoins: number } {
    const { stage, tier, memberDamage, maxDamage } = args;
    const base = getGuildBossSwapMailBaseRewards(stage, tier);
    const share = maxDamage > 0 ? memberDamage / maxDamage : 0;
    const extraRate = getGuildBossSwapMailExtraRate(share);
    return {
        researchPoints: Math.round(base.researchPoints * (1 + extraRate)),
        guildCoins: Math.round(base.guildCoins * (1 + extraRate)),
    };
}

export function getScaledGuildBossMaxHp(baseMaxHp: number, stage: number): number {
    return Math.max(1, Math.round(baseMaxHp * guildBossHpMultiplier(stage)));
}

export function getCurrentGuildBossStage(
    state:
        | {
              currentBossStage?: number;
              bossStageByBossId?: Record<string, number>;
              currentBossId?: string;
          }
        | null
        | undefined,
    currentBossId: string
): number {
    if (!state) return 1;
    const fromMap = state.bossStageByBossId?.[currentBossId];
    const raw = state.currentBossStage ?? fromMap;
    return clampGuildBossStage(raw ?? 1);
}

function scaleTuple(value: [number, number], mult: number): [number, number] {
    return [Math.round(value[0] * mult), Math.round(value[1] * mult)];
}

export function scaleGuildBossForStage(boss: GuildBossInfo, stage: number): GuildBossInfo {
    const st = clampGuildBossStage(stage);
    const hpM = guildBossHpMultiplier(st);
    const statM = guildBossStatMultiplier(st);
    const scaledMaxHp = Math.max(1, Math.round(boss.maxHp * hpM));

    const scaledStats = { ...boss.stats };
    for (const k of Object.keys(scaledStats) as CoreStat[]) {
        scaledStats[k] = Math.round(scaledStats[k] * statM);
    }

    const scaleEffects = <T extends { type: string; value?: [number, number]; debuffValue?: [number, number] }>(effs: T[]): T[] =>
        effs.map((e) => {
            const next = { ...e } as T;
            if ((e.type === 'damage' || e.type === 'heal' || e.type === 'hp_percent') && e.value) {
                (next as any).value = scaleTuple(e.value, statM);
            }
            if (e.type === 'debuff' && e.debuffValue) {
                (next as any).debuffValue = scaleTuple(e.debuffValue, statM);
            }
            return next;
        });

    const skills = boss.skills.map((skill) => {
        if (skill.type === 'active') {
            return {
                ...skill,
                onSuccess: scaleEffects(skill.onSuccess),
                onFailure: scaleEffects(skill.onFailure),
            };
        }
        return {
            ...skill,
            passiveEffect: scaleEffects(skill.passiveEffect),
        };
    });

    return {
        ...boss,
        maxHp: scaledMaxHp,
        hp: scaledMaxHp,
        stats: scaledStats,
        skills: skills as GuildBossInfo['skills'],
    };
}

function scaledDamageBounds(stage: number): number[] {
    const m = guildBossStatMultiplier(stage);
    return GUILD_BOSS_DAMAGE_ABSOLUTE_BOUNDS.map((b) => Math.round(b * m));
}

function calculateGuildBossGrade(damage: number, stage: number): number {
    const bounds = scaledDamageBounds(stage);
    for (let i = 0; i < bounds.length; i++) {
        if (damage < bounds[i]) return i + 1;
    }
    return 12;
}

function adjustEquipmentTableForStage(
    table: { grade: ItemGrade; weight: number }[],
    stage: number
): { grade: ItemGrade; weight: number }[] {
    if (stage <= 1) return table;
    const m = guildBossRewardMultiplier(stage);
    return table.map(({ grade, weight }) => {
        let w = weight;
        if (grade === ItemGrade.Normal || grade === ItemGrade.Uncommon) {
            w = Math.max(1, Math.round(w / Math.sqrt(m)));
        } else if (grade === ItemGrade.Rare) {
            w = Math.max(1, Math.round(w * Math.pow(m, 0.25)));
        } else {
            w = Math.max(1, Math.round(w * m));
        }
        return { grade, weight: w };
    });
}

function rollMythicForHighTier(tier: number, stage: number, current: ItemGrade): ItemGrade {
    if (tier < 10 || stage < 7) return current;
    const p = stage >= GUILD_BOSS_MAX_DIFFICULTY_STAGE ? 0.05 : 0.01;
    if (Math.random() < p) return ItemGrade.Mythic;
    return current;
}

export type GuildBossRewardCalcOptions = {
    /** 보상 등급 인덱스(1~12)를 이 값만큼 올림 (최대 12) */
    rewardTierShift?: number;
    /** 지급된 보상 줄 중 하나를 동일 수량만큼 추가로 받는 횟수(초월 「보상추가」 장비 줄 수만큼) */
    duplicateRewardCount?: number;
};

/** 시뮬레이터·서버 공통: 단계 반영 보상 계산 */
export function calculateGuildBossBattleRewards(
    damage: number,
    stage: number,
    opts?: GuildBossRewardCalcOptions
): {
    tier: number;
    guildXp: number;
    guildCoins: number;
    researchPoints: number;
    gold: number;
    materials: { name: string; quantity: number };
    materialsBonus?: { name: string; quantity: number };
    tickets: { name: string; quantity: number }[];
    equipment?: { grade: ItemGrade };
    materialBox?: { name: string; quantity: number };
} {
    const st = clampGuildBossStage(stage);
    const rewardMult = guildBossRewardMultiplier(st);
    const rawGrade = calculateGuildBossGrade(damage, st);
    const shift = Math.max(0, Math.floor(opts?.rewardTierShift ?? 0));
    const grade = Math.min(12, Math.max(1, rawGrade + shift));
    const cfg = GUILD_BOSS_REWARDS_BY_GRADE[grade]!;

    const scaleReward = (v: number) => Math.max(0, Math.round(v * rewardMult));

    let gold = scaleReward(getRandom(cfg.gold[0], cfg.gold[1]));
    let guildCoins = scaleReward(getRandom(cfg.guildCoins[0], cfg.guildCoins[1]));
    let researchPoints = scaleReward(getRandom(cfg.researchPoints[0], cfg.researchPoints[1]));
    let guildXp = scaleReward(getRandom(cfg.guildXp[0], cfg.guildXp[1]));
    const ticketCount = getRandom(cfg.tickets[0], cfg.tickets[1]);

    let materialName = cfg.materials.name;
    let materialQuantity = scaleReward(getRandom(cfg.materials.quantity[0], cfg.materials.quantity[1]));
    let materialsBonus: { name: string; quantity: number } | undefined;
    let lottoMaterialBox: { name: string; quantity: number } | undefined;

    if (grade === 12) {
        materialName = Math.random() < 0.5 ? '상급 강화석' : '최상급 강화석';
        materialQuantity = scaleReward(getRandom(7, 12));
        if (Math.random() < 0.05) materialsBonus = { name: '신비의 강화석', quantity: scaleReward(getRandom(1, 3)) };
    }

    const tickets: { name: string; quantity: number }[] = [];
    for (let i = 0; i < ticketCount; i++) {
        const ticketType = GUILD_BOSS_TICKET_TYPES[Math.floor(Math.random() * GUILD_BOSS_TICKET_TYPES.length)];
        const existing = tickets.find((t) => t.name === ticketType);
        if (existing) existing.quantity++;
        else tickets.push({ name: ticketType, quantity: 1 });
    }

    if (Math.random() < GUILD_BOSS_LOTTO_CHANCE) {
        if (grade < 12) {
            const nextCfg = GUILD_BOSS_REWARDS_BY_GRADE[grade + 1]!;
            const bonusTypes: Array<'gold' | 'guildCoins' | 'researchPoints' | 'materials'> = ['gold', 'guildCoins', 'researchPoints', 'materials'];
            const chosen = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
            switch (chosen) {
                case 'gold':
                    gold += scaleReward(getRandom(nextCfg.gold[0], nextCfg.gold[1]));
                    break;
                case 'guildCoins':
                    guildCoins += scaleReward(getRandom(nextCfg.guildCoins[0], nextCfg.guildCoins[1]));
                    break;
                case 'researchPoints':
                    researchPoints += scaleReward(getRandom(nextCfg.researchPoints[0], nextCfg.researchPoints[1]));
                    break;
                case 'materials':
                    materialQuantity += scaleReward(getRandom(nextCfg.materials.quantity[0], nextCfg.materials.quantity[1]));
                    break;
            }
        } else {
            const pool = GUILD_BOSS_SSS_LOTTO_POOL;
            const totalW = pool.reduce((s, p) => s + p.weight, 0);
            let r = Math.random() * totalW;
            let chosen: (typeof pool)[number]['type'] = pool[0].type;
            for (const p of pool) {
                if (r < p.weight) {
                    chosen = p.type;
                    break;
                }
                r -= p.weight;
            }
            if (chosen === 'gold') gold += scaleReward(getRandom(cfg.gold[0], cfg.gold[1]));
            else if (chosen === 'guildCoins') guildCoins += scaleReward(getRandom(cfg.guildCoins[0], cfg.guildCoins[1]));
            else if (chosen === 'researchPoints') researchPoints += scaleReward(getRandom(cfg.researchPoints[0], cfg.researchPoints[1]));
            else if (chosen === 'materials') materialQuantity += scaleReward(getRandom(1, 3));
            else if (chosen === 'materialBox') {
                lottoMaterialBox = Math.random() < 70 / 75 ? { name: '재료 상자 III', quantity: 1 } : { name: '재료 상자 IV', quantity: 1 };
            }
        }
    }

    const equipmentTable = adjustEquipmentTableForStage(cfg.equipmentTable, st);
    const totalWeight = equipmentTable.reduce((s, x) => s + x.weight, 0);
    let rw = Math.random() * totalWeight;
    let selectedGrade: ItemGrade = equipmentTable[0].grade;
    for (const item of equipmentTable) {
        if (rw < item.weight) {
            selectedGrade = item.grade;
            break;
        }
        rw -= item.weight;
    }
    selectedGrade = rollMythicForHighTier(grade, st, selectedGrade);

    let materialBox: { name: string; quantity: number } | undefined;
    if (grade === 12 && cfg.materialBox) {
        const roll = Math.random() * 100;
        if (roll < 70) materialBox = { name: '재료 상자 III', quantity: 1 };
        else if (roll < 75) materialBox = { name: '재료 상자 IV', quantity: 1 };
    }

    const out: {
        tier: number;
        guildXp: number;
        guildCoins: number;
        researchPoints: number;
        gold: number;
        materials: { name: string; quantity: number };
        materialsBonus?: { name: string; quantity: number };
        tickets: { name: string; quantity: number }[];
        equipment?: { grade: ItemGrade };
        materialBox?: { name: string; quantity: number };
    } = {
        tier: grade,
        guildXp,
        guildCoins,
        researchPoints,
        gold,
        materials: { name: materialName, quantity: materialQuantity },
        tickets,
        equipment: { grade: selectedGrade },
    };
    if (materialsBonus?.name === '신비의 강화석') out.materialsBonus = materialsBonus;
    if (lottoMaterialBox) out.materialBox = lottoMaterialBox;
    else if (materialBox) out.materialBox = materialBox;

    const dupN = Math.max(0, Math.floor(opts?.duplicateRewardCount ?? 0));
    for (let dupIter = 0; dupIter < dupN; dupIter++) {
        const dupPick: Array<{ w: number; apply: () => void }> = [];
        const g0 = out.gold;
        if (g0 > 0) dupPick.push({ w: 1, apply: () => { out.gold += g0; } });
        const gc0 = out.guildCoins;
        if (gc0 > 0) dupPick.push({ w: 1, apply: () => { out.guildCoins += gc0; } });
        const rp0 = out.researchPoints;
        if (rp0 > 0) dupPick.push({ w: 1, apply: () => { out.researchPoints += rp0; } });
        const gx0 = out.guildXp;
        if (gx0 > 0) dupPick.push({ w: 1, apply: () => { out.guildXp += gx0; } });
        const mq0 = out.materials.quantity;
        if (mq0 > 0) dupPick.push({ w: 1, apply: () => { out.materials = { ...out.materials, quantity: out.materials.quantity + mq0 }; } });
        if (out.materialsBonus && out.materialsBonus.quantity > 0) {
            const b = out.materialsBonus;
            dupPick.push({ w: 1, apply: () => { out.materialsBonus = { ...b, quantity: b.quantity + b.quantity }; } });
        }
        for (let ti = 0; ti < out.tickets.length; ti++) {
            const t = out.tickets[ti]!;
            if (t.quantity > 0) {
                const q0 = t.quantity;
                dupPick.push({
                    w: 1,
                    apply: () => {
                        out.tickets = out.tickets.map((x, i) => (i === ti ? { ...x, quantity: x.quantity + q0 } : x));
                    },
                });
            }
        }
        if (out.materialBox && out.materialBox.quantity > 0) {
            const mb = out.materialBox;
            dupPick.push({ w: 1, apply: () => { out.materialBox = { ...mb, quantity: mb.quantity + mb.quantity }; } });
        }
        if (dupPick.length > 0) {
            const r = Math.floor(Math.random() * dupPick.length);
            dupPick[r]!.apply();
        }
    }

    return out;
}
