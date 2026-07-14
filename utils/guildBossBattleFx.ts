import type { BattleLogEntry, GuildBossDuelOutcome, GuildBossFxKind } from '../types/index.js';
import { GuildResearchId } from '../types/enums.js';
import {
    GUILD_ATTACK_ICON,
    GUILD_RESEARCH_HEAL_BLOCK_IMG,
    GUILD_RESEARCH_IGNITE_IMG,
    GUILD_RESEARCH_REGEN_IMG,
    GUILD_RESEARCH_EVASION_IMG,
} from '../assets.js';

/** Skill-themed spectacle variant for arena-scale CSS VFX */
export type GuildBossFxSpectacle =
    | 'wave_crash'
    | 'wave_crush'
    | 'burn_surge'
    | 'burn_blast'
    | 'burn_dots'
    | 'nature_vines'
    | 'nature_spores'
    | 'heal_bloom'
    | 'mystery_swirl'
    | 'mystery_invert'
    | 'mystery_mind'
    | 'radiance_strike'
    | 'radiance_barrier'
    | 'radiance_judgment'
    | 'slash_cut'
    | 'debuff_suppress'
    | 'crush_default'
    | 'research_ignite'
    | 'research_regen'
    | 'research_heal_block'
    | 'research_heal_reduce'
    | 'research_damage_buff'
    | 'research_hp_buff'
    | 'research_hit_guard'
    | 'dodge'
    | 'guard_partial'
    | 'extra_turn'
    | 'generic';

export type GuildBossFxDirection = 'to-user' | 'to-boss' | 'none';

export type ResolvedGuildBossCombatFx = {
    fxKind: GuildBossFxKind;
    secondaryFxKind?: GuildBossFxKind;
    spectacle: GuildBossFxSpectacle;
    secondarySpectacle?: GuildBossFxSpectacle;
    direction: GuildBossFxDirection;
    duelOutcome: GuildBossDuelOutcome;
    researchId?: string;
    icon?: string;
    isCrit: boolean;
    attacker: 'user' | 'boss' | null;
    targetHit: 'user' | 'boss' | null;
};

/** Client playback state layered on top of resolved combat FX */
export type GuildBossCombatFxState = ResolvedGuildBossCombatFx & {
    spectacle?: GuildBossFxSpectacle;
    fxKey: number;
    missProjectile?: boolean;
};

type SkillFxMapEntry = { fxKind: GuildBossFxKind; spectacle: GuildBossFxSpectacle };

const SKILL_FX_MAP: Record<string, SkillFxMapEntry> = {
    청해_물결의압박: { fxKind: 'wave', spectacle: 'wave_crash' },
    청해_심해의고요: { fxKind: 'wave', spectacle: 'wave_crush' },
    청해_회복억제: { fxKind: 'debuff', spectacle: 'debuff_suppress' },
    홍염_불꽃돌파: { fxKind: 'burn', spectacle: 'burn_surge' },
    홍염_광열의폭발: { fxKind: 'burn', spectacle: 'burn_blast' },
    홍염_화상: { fxKind: 'burn', spectacle: 'burn_dots' },
    녹수_숲의압박: { fxKind: 'nature', spectacle: 'nature_vines' },
    녹수_포자확산: { fxKind: 'nature', spectacle: 'nature_spores' },
    녹수_자연의치유: { fxKind: 'heal', spectacle: 'heal_bloom' },
    현묘_혼란의수수께끼: { fxKind: 'mystery', spectacle: 'mystery_swirl' },
    현묘_뒤바뀐계산: { fxKind: 'mystery', spectacle: 'mystery_invert' },
    현묘_심리전: { fxKind: 'mystery', spectacle: 'mystery_mind' },
    백광_천벌의일격: { fxKind: 'radiance', spectacle: 'radiance_strike' },
    백광_광휘의결계: { fxKind: 'radiance', spectacle: 'radiance_barrier' },
    백광_심판의빛: { fxKind: 'radiance', spectacle: 'radiance_judgment' },
};

const FX_KIND_DEFAULT_SPECTACLE: Partial<Record<GuildBossFxKind, GuildBossFxSpectacle>> = {
    slash: 'slash_cut',
    wave: 'wave_crash',
    burn: 'burn_surge',
    nature: 'nature_vines',
    heal: 'heal_bloom',
    mystery: 'mystery_swirl',
    radiance: 'radiance_strike',
    crush: 'crush_default',
    debuff: 'debuff_suppress',
    dodge: 'dodge',
    guard_partial: 'guard_partial',
    research_ignite: 'research_ignite',
    research_regen: 'research_regen',
    research_heal_block: 'research_heal_block',
    research_heal_reduce: 'research_heal_reduce',
    research_damage_buff: 'research_damage_buff',
    research_hp_buff: 'research_hp_buff',
    research_hit_guard: 'research_hit_guard',
    extra_turn: 'extra_turn',
};

export function bossIdToThemeFx(bossId: string): GuildBossFxKind {
    switch (bossId) {
        case 'boss_1':
            return 'wave';
        case 'boss_2':
            return 'burn';
        case 'boss_3':
            return 'nature';
        case 'boss_4':
            return 'mystery';
        case 'boss_5':
            return 'radiance';
        default:
            return 'slash';
    }
}

export function skillIdToSpectacle(skillId: string | undefined): GuildBossFxSpectacle | undefined {
    if (!skillId) return undefined;
    return SKILL_FX_MAP[skillId]?.spectacle;
}

export function skillIdToFxKind(
    skillId: string | undefined,
    bossId: string,
    opts?: { isHeal?: boolean; isDebuff?: boolean; isHpPercent?: boolean },
): GuildBossFxKind {
    if (opts?.isHeal) return 'heal';
    if (opts?.isDebuff) return 'debuff';
    // isHpPercent intentionally ignored — keep boss/skill theme (wave/burn/radiance…)
    if (skillId && SKILL_FX_MAP[skillId]) return SKILL_FX_MAP[skillId].fxKind;
    if (!skillId) return bossIdToThemeFx(bossId);
    if (skillId.includes('심해') || skillId.includes('물결')) return 'wave';
    if (skillId.includes('불꽃') || skillId.includes('광열') || skillId.includes('화상')) return 'burn';
    if (skillId.includes('숲') || skillId.includes('포자') || skillId.includes('자연')) return 'nature';
    if (skillId.includes('혼란') || skillId.includes('계산') || skillId.includes('심리')) return 'mystery';
    if (skillId.includes('천벌') || skillId.includes('광휘') || skillId.includes('심판')) return 'radiance';
    return bossIdToThemeFx(bossId);
}

export function fxKindToSpectacle(fxKind: GuildBossFxKind, skillId?: string): GuildBossFxSpectacle {
    const fromSkill = skillIdToSpectacle(skillId);
    if (fromSkill && fxKind !== 'dodge' && fxKind !== 'guard_partial' && fxKind !== 'extra_turn') {
        // Keep skill spectacle when kind still matches theme family
        const mapped = skillId ? SKILL_FX_MAP[skillId] : undefined;
        if (mapped && mapped.fxKind === fxKind) return fromSkill;
    }
    return FX_KIND_DEFAULT_SPECTACLE[fxKind] ?? 'generic';
}

export function parseDuelOutcomeFromMessage(message: string): GuildBossDuelOutcome {
    // Boss POV (current): 공격 실패 = fully resisted by user, 공격 성공 = boss got through
    if (message.includes('공격 실패') && !message.includes('/')) return 'full_success';
    if (message.includes('공격 성공') && !message.includes('/')) return 'fail';
    const partialBoss = message.match(/공격\s*(\d+)\s*\/\s*(\d+)/);
    if (partialBoss) {
        const bossHits = Number(partialBoss[1]);
        const total = Number(partialBoss[2]);
        const userResists = total - bossHits;
        if (userResists >= total && total > 0) return 'full_success';
        if (userResists > 0) return 'partial';
        return 'fail';
    }
    // Legacy user-POV phrasing (pending battle recovery / older logs)
    if (message.includes('방어 성공') && !message.includes('/')) return 'full_success';
    if (message.includes('방어 실패')) return 'fail';
    const partialUser = message.match(/방어\s*(\d+)\s*\/\s*(\d+)/);
    if (partialUser) {
        const ok = Number(partialUser[1]);
        const total = Number(partialUser[2]);
        if (ok >= total && total > 0) return 'full_success';
        if (ok > 0) return 'partial';
        return 'fail';
    }
    return 'none';
}

/** Resolve presentation for a log line (prefers entry.fxKind, falls back to message/icon). */
export function resolveGuildBossCombatFx(entry: BattleLogEntry, bossId: string): ResolvedGuildBossCombatFx {
    const duelOutcome = entry.duelOutcome ?? parseDuelOutcomeFromMessage(entry.message);
    const isCrit = Boolean(entry.isCrit);
    const icon = entry.icon;

    let fxKind: GuildBossFxKind = entry.fxKind ?? 'slash';
    let researchId = entry.researchId;
    let secondaryFxKind: GuildBossFxKind | undefined;

    if (!entry.fxKind) {
        if (icon === GUILD_ATTACK_ICON || (entry.isUserAction && entry.message.includes('보스 HP -') && !entry.message.includes('연구'))) {
            fxKind = 'slash';
        } else if (icon === GUILD_RESEARCH_IGNITE_IMG || entry.message.includes('연구-점화')) {
            fxKind = 'research_ignite';
            researchId = researchId ?? GuildResearchId.boss_skill_ignite;
        } else if (icon === GUILD_RESEARCH_REGEN_IMG || entry.message.includes('연구-회복]')) {
            fxKind = 'research_regen';
            researchId = researchId ?? GuildResearchId.boss_skill_regen;
        } else if (icon === GUILD_RESEARCH_EVASION_IMG || entry.message.includes('연구-공격회피')) {
            fxKind = 'dodge';
            researchId = researchId ?? GuildResearchId.boss_attack_evasion;
        } else if (entry.message.includes('연구-회복불가')) {
            fxKind = 'research_heal_block';
            researchId = researchId ?? GuildResearchId.boss_skill_heal_block;
        } else if (entry.message.includes('연구-회복감소')) {
            fxKind = 'research_heal_reduce';
            researchId = researchId ?? GuildResearchId.boss_skill_heal_block;
        } else if (entry.message.includes('추가공격')) {
            fxKind = 'extra_turn';
        } else if (entry.healingDone || entry.bossHealingDone) {
            fxKind = 'heal';
        } else if (entry.debuffsApplied && entry.debuffsApplied.length > 0) {
            fxKind = 'debuff';
        } else if (!entry.isUserAction) {
            fxKind = skillIdToFxKind(entry.skillId, bossId, {
                isHeal: Boolean(entry.bossHealingDone),
                isDebuff: Boolean(entry.debuffsApplied?.length),
            });
        }
    }

    if ((duelOutcome === 'full_success' || fxKind === 'dodge') && !entry.isUserAction) {
        const themeFx = skillIdToFxKind(entry.skillId, bossId, {
            isHeal: Boolean(entry.bossHealingDone),
            isDebuff: Boolean(entry.debuffsApplied?.length),
        });
        secondaryFxKind = themeFx !== 'dodge' ? themeFx : bossIdToThemeFx(bossId);
        fxKind = 'dodge';
    } else if (duelOutcome === 'partial' && !entry.isUserAction) {
        secondaryFxKind = 'guard_partial';
    } else if (fxKind === 'slash' && researchId === GuildResearchId.boss_damage_increase) {
        secondaryFxKind = 'research_damage_buff';
    } else if (
        researchId === GuildResearchId.boss_hit_damage_reduction &&
        fxKind !== 'dodge' &&
        !entry.isUserAction
    ) {
        secondaryFxKind = 'research_hit_guard';
    }

    let attacker: 'user' | 'boss' | null = null;
    let targetHit: 'user' | 'boss' | null = null;

    if (fxKind === 'extra_turn' || fxKind === 'research_hp_buff') {
        attacker = 'user';
        targetHit = null;
    } else if (fxKind === 'research_heal_block' || fxKind === 'research_heal_reduce') {
        attacker = 'user';
        targetHit = 'boss';
    } else if (fxKind === 'research_regen' || entry.healingDone) {
        attacker = 'user';
        targetHit = 'user';
    } else if (fxKind === 'heal' && entry.bossHealingDone) {
        attacker = 'boss';
        targetHit = 'boss';
    } else if (fxKind === 'dodge') {
        attacker = 'boss';
        targetHit = 'user';
    } else if (entry.isUserAction) {
        attacker = 'user';
        targetHit =
            entry.message.includes('보스 HP') || fxKind === 'slash' || fxKind === 'research_ignite' ? 'boss' : null;
    } else {
        attacker = 'boss';
        targetHit =
            entry.damageTaken !== undefined || entry.debuffsApplied?.length
                ? 'user'
                : entry.bossHealingDone
                  ? 'boss'
                  : 'user';
    }

    const direction: GuildBossFxDirection =
        attacker === 'boss' && targetHit === 'user'
            ? 'to-user'
            : attacker === 'user' && targetHit === 'boss'
              ? 'to-boss'
              : 'none';

    const spectacle =
        fxKind === 'dodge'
            ? 'dodge'
            : fxKindToSpectacle(fxKind, entry.skillId);

    const secondarySpectacle = secondaryFxKind
        ? secondaryFxKind === 'guard_partial'
            ? 'guard_partial'
            : secondaryFxKind === 'research_hit_guard'
              ? 'research_hit_guard'
              : secondaryFxKind === 'research_damage_buff'
                ? 'research_damage_buff'
                : fxKindToSpectacle(secondaryFxKind, entry.skillId)
        : undefined;

    return {
        fxKind,
        secondaryFxKind,
        spectacle,
        secondarySpectacle,
        direction,
        duelOutcome,
        researchId,
        icon,
        isCrit,
        attacker,
        targetHit,
    };
}
