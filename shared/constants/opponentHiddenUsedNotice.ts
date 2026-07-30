/** 상대 히든 사용 알림 — 좌표·색 비공개, 사용 사실만 (서버 foulInfo.message / TurnDisplay) */
export const OPPONENT_HIDDEN_USED_NOTICE_KO = '상대가 히든을 사용했습니다.';

export const OPPONENT_HIDDEN_USED_FOUL_KIND = 'opponent_hidden_used' as const;
export const AI_HIDDEN_USED_FOUL_KIND = 'ai_hidden_used' as const;

export type HiddenUsedFoulKind =
    | typeof OPPONENT_HIDDEN_USED_FOUL_KIND
    | typeof AI_HIDDEN_USED_FOUL_KIND;
