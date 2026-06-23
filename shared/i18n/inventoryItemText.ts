import type { TFunction } from 'i18next';
import { CoreStat, MythicStat, SpecialStat } from '../../types/enums.js';
import { MYTHIC_STATS_DATA, SPECIAL_STATS_DATA } from '../constants/items.js';
import { resolveInventoryItemCatalogEntry } from '../constants/inventoryItemCatalog.js';
import { coerceSpecialStatType } from '../utils/specialStatMilestones.js';
import type { ItemOption } from '../types/entities.js';
import {
    resolveBagOptionEnhancementCount,
    stripOptionDisplayRange,
} from '../utils/bagEquipmentOptionDisplay.js';
import {
    computeSpecialSubRollBoundsAfterMilestones,
} from '../utils/specialStatMilestones.js';

const MYTHIC_STAT_SET = new Set<string>(Object.values(MythicStat));

function isMythicStatType(type: string): type is MythicStat {
    return MYTHIC_STAT_SET.has(type);
}

const CORE_STAT_I18N: Record<CoreStat, string> = {
    [CoreStat.Concentration]: 'profile:coreStats.concentration',
    [CoreStat.ThinkingSpeed]: 'profile:coreStats.thinkingSpeed',
    [CoreStat.Judgment]: 'profile:coreStats.judgment',
    [CoreStat.Calculation]: 'profile:coreStats.calculation',
    [CoreStat.CombatPower]: 'profile:coreStats.combatPower',
    [CoreStat.Stability]: 'profile:coreStats.stability',
};

const SPECIAL_STAT_I18N: Record<SpecialStat, string> = {
    [SpecialStat.ActionPointMax]: 'profile:specialStats.actionPointMax',
    [SpecialStat.StrategyXpBonus]: 'profile:specialStats.strategyXpBonus',
    [SpecialStat.PlayfulXpBonus]: 'profile:specialStats.playfulXpBonus',
    [SpecialStat.ChampionshipVenueAllStats]: 'profile:specialStats.championshipVenueAllStats',
    [SpecialStat.GuildBossBattleAllStats]: 'profile:specialStats.guildBossBattleAllStats',
};

function mythicStatEnumKey(stat: MythicStat): string {
    return (Object.entries(MythicStat).find(([, v]) => v === stat)?.[0] ?? stat) as string;
}

export function translateInventoryItemName(name: string | undefined, t: TFunction): string {
    if (!name?.trim()) return '';
    const entry = resolveInventoryItemCatalogEntry(name);
    if (!entry) return name;
    return t(`inventory:items.${entry.slug}.name`, { defaultValue: entry.name });
}

export function translateInventoryItemDescription(name: string | undefined, description: string | undefined, t: TFunction): string {
    const entry = resolveInventoryItemCatalogEntry(name);
    const fallback = description?.trim() || entry?.description || '';
    if (!entry) return fallback;
    return t(`inventory:items.${entry.slug}.description`, { defaultValue: fallback });
}

export function translateCoreStatName(type: string, t: TFunction): string {
    const coreValues = Object.values(CoreStat) as string[];
    if (coreValues.includes(type)) {
        return t(CORE_STAT_I18N[type as CoreStat], { defaultValue: type });
    }
    const byKey = (CoreStat as Record<string, string>)[type];
    if (byKey && CORE_STAT_I18N[byKey as CoreStat]) {
        return t(CORE_STAT_I18N[byKey as CoreStat], { defaultValue: byKey });
    }
    return type;
}

export function translateSpecialStatName(type: string, t: TFunction): string {
    const stat = coerceSpecialStatType(type);
    if (stat && SPECIAL_STAT_I18N[stat]) {
        return t(SPECIAL_STAT_I18N[stat], { defaultValue: SPECIAL_STATS_DATA[stat].name });
    }
    return type;
}

export function translateMythicStatAbbrev(stat: MythicStat, t: TFunction): string {
    const key = mythicStatEnumKey(stat);
    const fallback = MYTHIC_STATS_DATA[stat]?.abbrevLabel ?? stat;
    return t(`inventory:stats.mythic.${key}.abbrev`, { defaultValue: fallback });
}

export function translateMythicStatName(stat: MythicStat, t: TFunction): string {
    const key = mythicStatEnumKey(stat);
    const fallback = MYTHIC_STATS_DATA[stat]?.name ?? stat;
    return t(`inventory:stats.mythic.${key}.name`, { defaultValue: fallback });
}

export function translateMythicStatDescription(stat: MythicStat, t: TFunction): string {
    const key = mythicStatEnumKey(stat);
    const fallback = MYTHIC_STATS_DATA[stat]?.description ?? '';
    return t(`inventory:stats.mythic.${key}.description`, { defaultValue: fallback });
}

export function translateMythicStatShortDescription(stat: MythicStat, t: TFunction): string {
    const key = mythicStatEnumKey(stat);
    const fallback = MYTHIC_STATS_DATA[stat]?.shortDescription ?? '';
    return t(`inventory:stats.mythic.${key}.short`, { defaultValue: fallback });
}

export function formatLocalizedOptionValueLine(
    statLabel: string,
    value: number,
    isPercentage: boolean,
    t: TFunction,
): string {
    const suffix = isPercentage ? '%' : '';
    return t('inventory:optionValueLine', {
        stat: statLabel,
        value,
        suffix,
        defaultValue: `${statLabel} +${value}${suffix}`,
    });
}

export function formatLocalizedBagOptionLabel(opt: ItemOption, itemStars: number, t: TFunction): string {
    if (isMythicStatType(opt.type)) {
        const abbrev = translateMythicStatAbbrev(opt.type as MythicStat, t);
        return formatLocalizedOptionValueLine(abbrev, Number(opt.value) || 0, Boolean(opt.isPercentage), t);
    }
    const special = coerceSpecialStatType(opt.type);
    if (special) {
        const label = translateSpecialStatName(special, t);
        return formatLocalizedOptionValueLine(label, Number(opt.value) || 0, Boolean(opt.isPercentage), t);
    }
    const coreValues = Object.values(CoreStat) as string[];
    if (coreValues.includes(opt.type)) {
        const label = translateCoreStatName(opt.type, t);
        return formatLocalizedOptionValueLine(label, Number(opt.value) || 0, Boolean(opt.isPercentage), t);
    }
    return stripOptionDisplayRange(opt.display);
}

export function formatLocalizedBagOptionRangeTrailing(opt: ItemOption, itemStars: number, t: TFunction): string | null {
    if (!opt.range || opt.range.length !== 2) return null;
    let lo = Math.round(Number(opt.range[0]));
    let hi = Math.round(Number(opt.range[1]));
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    const stat = coerceSpecialStatType(opt.type);
    const enh = resolveBagOptionEnhancementCount(opt, itemStars);
    if (stat) {
        [lo, hi] = computeSpecialSubRollBoundsAfterMilestones([lo, hi], stat, enh);
    }
    const pct = opt.isPercentage ? '%' : '';
    const rangePart = t('inventory:optionRange', {
        lo,
        hi,
        suffix: pct,
        defaultValue: `[${lo}~${hi}${pct}]`,
    });
    if (enh > 0) {
        return `${rangePart} ${t('inventory:optionEnhancement', { count: enh, defaultValue: `(${enh}강화)` })}`;
    }
    return rangePart;
}
