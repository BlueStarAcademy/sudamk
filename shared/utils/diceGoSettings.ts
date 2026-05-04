import type { GameSettings } from '../../types.js';

export type DiceGoSpecialCountPick = Pick<
    GameSettings,
    'oddDiceCount' | 'evenDiceCount' | 'lowDiceCount' | 'highDiceCount'
>;

/** 설정 UI 표시값: 네 종이 모두 같으면 그 값, 구버전 불일치 시 최소값 */
export function getDiceGoUnifiedSpecialDiceCount(settings: DiceGoSpecialCountPick): number {
    const o = settings.oddDiceCount ?? 1;
    const e = settings.evenDiceCount ?? 1;
    const l = settings.lowDiceCount ?? 1;
    const h = settings.highDiceCount ?? 1;
    if (o === e && e === l && l === h) return o;
    return Math.min(o, e, l, h);
}

export function diceGoUnifiedSpecialDiceCounts(count: number): DiceGoSpecialCountPick {
    return {
        oddDiceCount: count,
        evenDiceCount: count,
        lowDiceCount: count,
        highDiceCount: count,
    };
}

/** 사이드바·설명 모달 등 한 줄 요약 */
export function formatDiceGoSpecialDiceSummary(settings: DiceGoSpecialCountPick): string {
    const o = settings.oddDiceCount ?? 0;
    const e = settings.evenDiceCount ?? 0;
    const l = settings.lowDiceCount ?? 0;
    const h = settings.highDiceCount ?? 0;
    if (o === e && e === l && l === h) {
        return `${o}개 (홀·짝·1~3·4~6 각)`;
    }
    return `홀${o}·짝${e}·저${l}·고${h}`;
}
