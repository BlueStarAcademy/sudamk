import type { ItemOption } from '../types/entities.js';
import { SpecialStat } from '../types/enums.js';
import { SPECIAL_STATS_DATA } from '../constants/items.js';

/** 저장 데이터(구 문자열) → 현재 SpecialStat */
const LEGACY_SPECIAL_STAT_TYPE: Record<string, SpecialStat> = {
    '놀이 경험치 추가획득': SpecialStat.PlayfulXpBonus,
    '챔피언십 경기장 모든 능력치': SpecialStat.ChampionshipVenueAllStats,
    '길드 보스전 추가 능력치': SpecialStat.GuildBossBattleAllStats,
};

export function coerceSpecialStatType(raw: unknown): SpecialStat | undefined {
    if (typeof raw !== 'string') return undefined;
    const vals = Object.values(SpecialStat) as string[];
    if (vals.includes(raw)) return raw as SpecialStat;
    return LEGACY_SPECIAL_STAT_TYPE[raw];
}

/** 별 색상 구간과 동일한 강화 단계 */
export const SPECIAL_STAT_ENHANCEMENT_MILESTONE_STARS = [4, 7, 10] as const;

export function milestoneTierCountFromStars(stars: number): number {
    const s = Math.max(0, Math.min(10, Math.floor(Number(stars) || 0)));
    return (s >= 4 ? 1 : 0) + (s >= 7 ? 1 : 0) + (s >= 10 ? 1 : 0);
}

/** +4 / +7 / +10 달성 시 해당 특수 옵션 수치에 가산되는 양 */
export function getSpecialStatMilestoneValueDelta(stat: SpecialStat): number {
    switch (stat) {
        case SpecialStat.ActionPointMax:
            return 1;
        case SpecialStat.StrategyXpBonus:
        case SpecialStat.PlayfulXpBonus:
            return 3;
        case SpecialStat.ChampionshipVenueAllStats:
        case SpecialStat.GuildBossBattleAllStats:
            return 1;
        default:
            return 0;
    }
}

export function computeSpecialSubRollBoundsAfterMilestones(
    baseRange: [number, number],
    stat: SpecialStat,
    milestones: number
): [number, number] {
    const m = Math.max(0, Math.min(3, Math.floor(milestones)));
    const d = getSpecialStatMilestoneValueDelta(stat);
    const b0 = Math.round(Number(baseRange[0]));
    const b1 = Math.round(Number(baseRange[1]));
    return [b0 + m * d, b1 + m * d];
}

export function formatSpecialSubItemDisplay(
    sub: { value: unknown; range?: [number, number]; enhancements?: number; type: string },
    def: { name: string; isPercentage: boolean; range: [number, number] }
): string {
    const stat = sub.type as SpecialStat;
    const m = Math.max(0, Math.min(3, Math.floor(Number(sub.enhancements) || 0)));
    const baseR: [number, number] =
        sub.range && sub.range.length === 2
            ? [Math.round(Number(sub.range[0])), Math.round(Number(sub.range[1]))]
            : [def.range[0], def.range[1]];
    const [lo, hi] = computeSpecialSubRollBoundsAfterMilestones(baseR, stat, m);
    const v = Number(sub.value);
    const safe = Number.isFinite(v) ? v : 0;
    const pct = def.isPercentage ? '%' : '';
    return `${def.name} +${safe}${pct} [${lo}~${hi}]`;
}

/** 장비 패널 등: 저장된 display 대신 현재 표기명으로 한 줄 생성 */
export function formatSpecialSubLineForPanel(
    opt: Pick<ItemOption, 'type' | 'value' | 'range' | 'enhancements' | 'display'>,
    stars: number
): string {
    const stat = coerceSpecialStatType(opt.type);
    if (!stat) return opt.display ?? String(opt.type);
    const def = SPECIAL_STATS_DATA[stat];
    if (!def) return opt.display ?? String(opt.type);
    const enhancements = opt.enhancements ?? milestoneTierCountFromStars(stars);
    return formatSpecialSubItemDisplay(
        { type: stat, value: opt.value, range: opt.range, enhancements },
        def
    );
}
