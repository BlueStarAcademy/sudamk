/** 대국 신청 시 상대의 행동력이 부족할 때 서버·클라이언트 공통 메시지 */
export const OPPONENT_INSUFFICIENT_ACTION_POINTS_MESSAGE =
    '상대방이 행동력이 부족하여 신청할 수 없습니다.';

/** 상대 부족 모달·인라인 보조 설명 */
export const OPPONENT_INSUFFICIENT_AP_DETAIL =
    '상대방에게도 대국을 진행할 만큼의 행동력(⚡)이 있어야 합니다. 상대가 충전한 뒤 다시 시도해 주세요.';

/** 인라인 경고 제목 (한 줄) */
export const OPPONENT_INSUFFICIENT_AP_INLINE_HEADING = '상대방의 행동력이 부족합니다.';

/** 본인 부족 모달·인라인 — 진행 불가 이유 */
export const SELF_INSUFFICIENT_AP_HEADING = '본인의 행동력이 부족합니다.';
export const SELF_INSUFFICIENT_AP_DETAIL =
    '대국 신청·수락, AI 대국 시작 등에는 행동력(⚡)이 필요합니다. 충전한 뒤 다시 시도해 주세요.';

export function formatMatchActionPointsLine(required: number, current: number): string {
    return `필요 ⚡${required} · 현재 보유 ⚡${current}`;
}

const LEGACY_OPPONENT_AP_MESSAGE = '상대방의 액션 포인트가 부족합니다.';

export function isOpponentInsufficientActionPointsError(message: string): boolean {
    return message === OPPONENT_INSUFFICIENT_ACTION_POINTS_MESSAGE || message === LEGACY_OPPONENT_AP_MESSAGE;
}
