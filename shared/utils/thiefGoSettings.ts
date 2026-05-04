import type { GameSettings } from '../../types.js';

export type ThiefSpecialDicePick = Pick<GameSettings, 'thiefHigh36ItemCount' | 'thiefNoOneItemCount'>;

/** 설정 UI 표시값: 두 종이 같으면 그 값, 구버전 불일치 시 최소값 */
export function getThiefUnifiedSpecialDiceCount(settings: ThiefSpecialDicePick): number {
    const h = settings.thiefHigh36ItemCount ?? 1;
    const n = settings.thiefNoOneItemCount ?? 1;
    if (h === n) return h;
    return Math.min(h, n);
}

export function thiefUnifiedSpecialDiceCounts(count: number): ThiefSpecialDicePick {
    return {
        thiefHigh36ItemCount: count,
        thiefNoOneItemCount: count,
    };
}

/** 사이드바·로비 등 한 줄 요약 */
export function formatThiefSpecialDiceSummary(settings: ThiefSpecialDicePick): string {
    const h = settings.thiefHigh36ItemCount ?? 0;
    const n = settings.thiefNoOneItemCount ?? 0;
    if (h === n) {
        return `${h}개 (높은수 3~6 · 1방지 2~5 각)`;
    }
    return `높은수(3~6) ${h}개 · 1방지(2~5) ${n}개`;
}
