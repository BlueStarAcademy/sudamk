/**
 * Shop UI itemId → Korean display name/description (server matching uses Korean names).
 * Used as i18n defaultValue when `shop:items.{id}.*` is missing in a locale file.
 */
export type ShopItemDisplayField = 'name' | 'description';

export type ShopItemDisplayEntry = { name: string; description: string };

export const SHOP_ITEM_DISPLAY: Record<string, ShopItemDisplayEntry> = {
    equipment_box_1: { name: '장비 상자 I', description: '일반~희귀 등급 장비 획득' },
    equipment_box_2: { name: '장비 상자 II', description: '일반~에픽 등급 장비 획득' },
    equipment_box_3: { name: '장비 상자 III', description: '고급~전설 등급 장비 획득' },
    equipment_box_4: { name: '장비 상자 IV', description: '희귀~신화 등급 장비 획득' },
    equipment_box_5: { name: '장비 상자 V', description: '에픽~신화 등급 장비 획득' },
    equipment_box_6: { name: '장비 상자 VI', description: '전설~신화 등급 장비 획득' },
    material_box_1: { name: '재료 상자 I', description: '하급 ~ 상급 강화석 5개 획득' },
    material_box_2: { name: '재료 상자 II', description: '하급 ~ 상급 강화석 5개 획득' },
    material_box_3: { name: '재료 상자 III', description: '하급 ~ 상급 강화석 5개 획득' },
    material_box_4: { name: '재료 상자 IV', description: '중급 ~ 최상급 강화석 5개 획득' },
    material_box_5: { name: '재료 상자 V', description: '상급 ~ 신비의 강화석 5개 획득' },
    material_box_6: { name: '재료 상자 VI', description: '상급 ~ 신비의 강화석 5개 획득' },
    equipment_unbind_ticket: {
        name: '귀속 해제권',
        description: '귀속 장비 거래가능 상태로 변경',
    },
    refinement_charm: {
        name: '제련의 부적',
        description: '제련불가 장비 제련 횟수 1회 추가',
    },
    option_type_change_ticket: {
        name: '옵션 종류 변경권',
        description: '장비의 주옵션, 부옵션, 특수옵션 중 하나를 다른 종류의 옵션으로 변경할 수 있는 아이템입니다.',
    },
    option_value_change_ticket: {
        name: '옵션 수치 변경권',
        description: '장비의 부옵션 또는 특수옵션 중 하나의 수치를 변경할 수 있는 아이템입니다.',
    },
    mythic_option_change_ticket: {
        name: '스페셜 옵션 변경권',
        description: '신화 또는 초월 장비의 스페셜 옵션을 다른 스페셜 옵션으로 변경할 수 있는 아이템입니다.',
    },
    condition_potion_small: {
        name: '컨디션회복제(소)',
        description: '긴장감을 완화시켜주는 컨디션 회복제',
    },
    condition_potion_medium: {
        name: '컨디션회복제(중)',
        description: '머리가 맑아지는 느낌의 컨디션 회복제',
    },
    condition_potion_large: {
        name: '컨디션회복제(대)',
        description: '오늘의 대회를 성공적으로 치를 것 같은 컨디션 회복제',
    },
    action_point_10: { name: '행동력 회복제(+10)', description: '뭔가 하고싶은 의욕이 생긴다.' },
    action_point_20: { name: '행동력 회복제(+20)', description: '뭔가 해야 할 것 같다.' },
    action_point_30: { name: '행동력 회복제(+30)', description: '바로 경기를 하러 가자.' },
};

export function shopItemDisplayFallback(itemId: string, field: ShopItemDisplayField): string {
    return SHOP_ITEM_DISPLAY[itemId]?.[field] ?? itemId;
}
