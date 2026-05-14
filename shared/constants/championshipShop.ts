/**
 * 챔피언십 상점 — 클라이언트 목록·서버 검증 공통 소스
 */

import { getChampionshipEquipmentBoxShopInfoLineKo } from './shopLootTables.js';
export type ChampionshipShopTab = 'equipment' | 'change' | 'special';

export type ChampionshipShopEquipmentProduct = {
    id: string;
    tab: 'equipment';
    label: string;
    /** 1~6 → 기존 장비상자 I~VI와 동일 루트 테이블(일반 등급 제외) */
    boxLevel: 1 | 2 | 3 | 4 | 5 | 6;
    champCoins: number;
    image: string;
    description: string;
};

export type ChampionshipShopMaterialProduct = {
    id: string;
    tab: 'change' | 'special';
    label: string;
    /** MATERIAL_ITEMS 키 */
    materialName: string;
    champCoins: number;
    image: string;
    description: string;
    /** 특수 탭 주간 한도(없으면 무제한) */
    weeklyLimit?: number;
};

export type ChampionshipShopProduct = ChampionshipShopEquipmentProduct | ChampionshipShopMaterialProduct;

const BOX_IMG = (n: number) => `/images/Box/EquipmentBox${n}.webp`;

export const CHAMPIONSHIP_SHOP_EQUIPMENT: readonly ChampionshipShopEquipmentProduct[] = [
    {
        id: 'championship_equip_box_1',
        tab: 'equipment',
        label: '챔피언십 장비 상자 I',
        boxLevel: 1,
        champCoins: 100,
        image: BOX_IMG(1),
        description: getChampionshipEquipmentBoxShopInfoLineKo(1),
    },
    {
        id: 'championship_equip_box_2',
        tab: 'equipment',
        label: '챔피언십 장비 상자 II',
        boxLevel: 2,
        champCoins: 200,
        image: BOX_IMG(2),
        description: getChampionshipEquipmentBoxShopInfoLineKo(2),
    },
    {
        id: 'championship_equip_box_3',
        tab: 'equipment',
        label: '챔피언십 장비 상자 III',
        boxLevel: 3,
        champCoins: 500,
        image: BOX_IMG(3),
        description: getChampionshipEquipmentBoxShopInfoLineKo(3),
    },
    {
        id: 'championship_equip_box_4',
        tab: 'equipment',
        label: '챔피언십 장비 상자 IV',
        boxLevel: 4,
        champCoins: 1000,
        image: BOX_IMG(4),
        description: getChampionshipEquipmentBoxShopInfoLineKo(4),
    },
    {
        id: 'championship_equip_box_5',
        tab: 'equipment',
        label: '챔피언십 장비 상자 V',
        boxLevel: 5,
        champCoins: 2000,
        image: BOX_IMG(5),
        description: getChampionshipEquipmentBoxShopInfoLineKo(5),
    },
    {
        id: 'championship_equip_box_6',
        tab: 'equipment',
        label: '챔피언십 장비 상자 VI',
        boxLevel: 6,
        champCoins: 5000,
        image: BOX_IMG(6),
        description: getChampionshipEquipmentBoxShopInfoLineKo(6),
    },
] as const;

export const CHAMPIONSHIP_SHOP_CHANGE: readonly ChampionshipShopMaterialProduct[] = [
    {
        id: 'championship_change_value',
        tab: 'change',
        label: '옵션 수치 변경권',
        materialName: '옵션 수치 변경권',
        champCoins: 50,
        image: '/images/use/change2.webp',
        description: '부옵션 또는 특수옵션 수치 변경',
    },
    {
        id: 'championship_change_kind',
        tab: 'change',
        label: '옵션 종류 변경권',
        materialName: '옵션 종류 변경권',
        champCoins: 150,
        image: '/images/use/change1.webp',
        description: '주옵션·부옵션·특수옵션 중 하나의 종류 변경',
    },
    {
        id: 'championship_change_special',
        tab: 'change',
        label: '스페셜 옵션 변경권',
        materialName: '스페셜 옵션 변경권',
        champCoins: 100,
        image: '/images/use/change3.webp',
        description: '신화·초월 장비의 스페셜 옵션 변경',
    },
] as const;

export const CHAMPIONSHIP_SHOP_SPECIAL: readonly ChampionshipShopMaterialProduct[] = [
    {
        id: 'championship_special_unbind',
        tab: 'special',
        label: '귀속 해제권',
        materialName: '귀속 해제권',
        champCoins: 500,
        image: '/images/use/belong.webp',
        description: '귀속 장비를 거래 가능 상태로',
        weeklyLimit: 5,
    },
    {
        id: 'championship_special_refine',
        tab: 'special',
        label: '제련의 부적',
        materialName: '제련의 부적',
        champCoins: 1000,
        image: '/images/use/refine.webp',
        description: '제련 불가 장비에 제련 횟수 +1',
        weeklyLimit: 3,
    },
    {
        id: 'championship_special_trade',
        tab: 'special',
        label: '거래소 등록권',
        materialName: '거래 등록권',
        champCoins: 3000,
        image: '/images/use/allowtrade.webp',
        description: '거래소에 물품 1개 등록',
        weeklyLimit: 1,
    },
] as const;

const ALL_PRODUCTS: ChampionshipShopProduct[] = [
    ...CHAMPIONSHIP_SHOP_EQUIPMENT,
    ...CHAMPIONSHIP_SHOP_CHANGE,
    ...CHAMPIONSHIP_SHOP_SPECIAL,
];

export function getChampionshipShopProductById(productId: string): ChampionshipShopProduct | undefined {
    return ALL_PRODUCTS.find((p) => p.id === productId);
}
