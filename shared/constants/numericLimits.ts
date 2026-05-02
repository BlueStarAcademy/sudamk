/** 한국식 100억 = 10,000,000,000 — 골드 보유 상한 및 범용 정수 입력 최댓값 */
export const MAX_PLAYER_GOLD = 10_000_000_000;

/** 다이아몬드 보유·거래소 다이아 판매가 상한 */
export const MAX_PLAYER_DIAMONDS = 10_000_000;

/** 골드 UI: 10억 = 1G */
export const GOLD_G_DISPLAY_UNIT = 1_000_000_000;

export const MAX_GAME_INTEGER_INPUT = MAX_PLAYER_GOLD;

export const GOLD_CAP_EXCEEDED_KO_MESSAGE = '100억 이상은 골드를 보유할 수 없습니다.';

export const DIAMOND_CAP_EXCEEDED_KO_MESSAGE = '다이아몬드는 최대 1,000만 개까지 보유할 수 있습니다.';

export function maxExchangeListPrice(currency: 'gold' | 'diamonds'): number {
    return currency === 'gold' ? MAX_PLAYER_GOLD : MAX_PLAYER_DIAMONDS;
}
