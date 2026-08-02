/**
 * 사전구성 파티(최대 4) → 랭크/일반 매칭 형태 게이트 (롤식).
 * 3명은 1차에서 큐 불가.
 */
export type PremadePartyMatchForm = '1v1' | 'pair' | '2vAi';

export function allowedMatchFormsForPartySize(partySize: number): PremadePartyMatchForm[] {
    const n = Math.max(0, Math.floor(partySize));
    if (n <= 0) return [];
    if (n === 1) return ['1v1'];
    if (n === 2) return ['pair', '2vAi'];
    if (n === 4) return ['pair'];
    return []; // 3명 등
}

export function canQueueWithPartySize(partySize: number): boolean {
    return allowedMatchFormsForPartySize(partySize).length > 0;
}

export const PREMADE_PARTY_MAX_SIZE = 4;
