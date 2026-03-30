import type { SinglePlayerStageInfo } from '../types.js';

export type SinglePlayerClearReward = SinglePlayerStageInfo['rewards']['firstClear'];

/** 스테이지 보상 한 덩어리를 한 줄 요약 (테이블 셀용) */
export function formatSinglePlayerRewardCell(r: SinglePlayerClearReward | undefined): string {
    if (!r) return '—';
    const parts: string[] = [];
    if (typeof r.gold === 'number' && r.gold > 0) parts.push(`골드 ${r.gold.toLocaleString()}`);
    if (typeof r.exp === 'number' && r.exp > 0) parts.push(`경험 ${r.exp.toLocaleString()}`);
    if (r.items?.length) {
        parts.push(
            r.items.map((i) => `${i.itemId} ×${i.quantity}`).join(', ')
        );
    }
    if (r.bonus) parts.push(String(r.bonus));
    return parts.length > 0 ? parts.join(' · ') : '—';
}
