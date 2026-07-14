import type { BattleLogEntry, GuildBossDuelOutcome, GuildBossFxKind } from '../types/index.js';
import { GuildResearchId } from '../types/enums.js';
import {
    GUILD_ATTACK_ICON,
    GUILD_RESEARCH_HEAL_BLOCK_IMG,
    GUILD_RESEARCH_IGNITE_IMG,
    GUILD_RESEARCH_REGEN_IMG,
    GUILD_RESEARCH_EVASION_IMG,
} from '../assets.js';

export type ResolvedGuildBossCombatFx = {
    fxKind: GuildBossFxKind;
    secondaryFxKind?: GuildBossFxKind;
    duelOutcome: GuildBossDuelOutcome;
    researchId?: string;
    icon?: string;
    isCrit: boolean;
    attacker: 'user' | 'boss' | null;
    targetHit: 'user' | 'boss' | null;
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

export function skillIdToFxKind(skillId: string | undefined, bossId: string, opts?: {
    isHeal?: boolean;
    isDebuff?: boolean;
    isHpPercent?: boolean;
}): GuildBossFxKind {
    if (opts?.isHeal) return 'heal';
    if (opts?.isDebuff) return 'debuff';
    if (opts?.isHpPercent) return 'crush';
    if (!skillId) return bossIdToThemeFx(bossId);
    if (skillId.includes('심해') || skillId.includes('물결')) return 'wave';
    if (skillId.includes('불꽃') || skillId.includes('광열') || skillId.includes('화상')) return 'burn';
    if (skillId.includes('숲') || skillId.includes('포자') || skillId.includes('자연')) return 'nature';
    if (skillId.includes('혼란') || skillId.includes('계산') || skillId.includes('심리')) return 'mystery';
    if (skillId.includes('천벌') || skillId.includes('광휘') || skillId.includes('심판')) return 'radiance';
    return bossIdToThemeFx(bossId);
}

export function parseDuelOutcomeFromMessage(message: string): GuildBossDuelOutcome {
    if (message.includes('방어 성공') && !message.includes('/')) return 'full_success';
    if (message.includes('방어 실패')) return 'fail';
    const partial = message.match(/방어\s*(\d+)\s*\/\s*(\d+)/);
    if (partial) {
        const ok = Number(partial[1]);
        const total = Number(partial[2]);
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
    }

    let attacker: 'user' | 'boss' | null = null;
    let targetHit: 'user' | 'boss' | null = null;

    if (fxKind === 'extra_turn' || fxKind === 'research_hp_buff') {
        attacker = 'user';
        targetHit = null;
    } else if (
        fxKind === 'research_heal_block' ||
        fxKind === 'research_heal_reduce'
    ) {
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
        targetHit = entry.message.includes('보스 HP') || fxKind === 'slash' || fxKind === 'research_ignite' ? 'boss' : null;
    } else {
        attacker = 'boss';
        targetHit = entry.damageTaken !== undefined || entry.debuffsApplied?.length ? 'user' : entry.bossHealingDone ? 'boss' : 'user';
    }

    return {
        fxKind,
        secondaryFxKind,
        duelOutcome,
        researchId,
        icon,
        isCrit,
        attacker,
        targetHit,
    };
}
