import { ItemGrade } from '../types/enums.js';
import type { InventoryItem, PairPetLobbyInventorySortMode } from '../types/entities.js';

/** 페어 펫·알 로비 인벤: 기본 슬롯 수(빈 칸 포함 표시) */
export const PAIR_PET_LOBBY_INV_BASE_SLOTS = 10;
/** 확장 1회당 추가 슬롯 수(가방은 10칸, 펫·알 로비는 5칸) */
export const PAIR_PET_LOBBY_INV_EXPAND_STEP = 5;
/** 펫·알 로비 인벤 최대 슬롯 */
export const PAIR_PET_LOBBY_INV_MAX_SLOTS = 50;

const PAIR_PET_LOBBY_INVENTORY_SORT_SET = new Set<string>([
    'recent',
    'oldest',
    'name',
    'petLevel',
    'gradeHigh',
    'petNumber',
]);

/**
 * 로비 인벤 «종류(번호)» 정렬: 펫 `pair-pet-N`, 영혼석 `pair-soul-N`의 N 오름차순.
 * 파싱 불가·미부여 templateId는 맨 뒤(9999).
 */
export function pairPetLobbyInventoryKindOrderIndex(item: Pick<InventoryItem, 'templateId'>): number {
    const tid = typeof item.templateId === 'string' ? item.templateId : '';
    if (tid.startsWith('pair-pet-')) {
        const n = Number.parseInt(tid.slice('pair-pet-'.length), 10);
        return Number.isFinite(n) ? n : 9999;
    }
    if (tid.startsWith('pair-soul-')) {
        const n = Number.parseInt(tid.slice('pair-soul-'.length), 10);
        return Number.isFinite(n) ? n : 9999;
    }
    return 9999;
}

/** 서버·클라 공통: 저장된 정렬 값 검증 */
export function normalizePairPetLobbyInventorySort(raw: unknown): PairPetLobbyInventorySortMode | undefined {
    if (typeof raw !== 'string' || !PAIR_PET_LOBBY_INVENTORY_SORT_SET.has(raw)) return undefined;
    return raw as PairPetLobbyInventorySortMode;
}

export function pairPetLobbyInventorySlots(stored?: number | null): number {
    if (typeof stored !== 'number' || !Number.isFinite(stored)) {
        return PAIR_PET_LOBBY_INV_BASE_SLOTS;
    }
    const n = Math.floor(stored);
    if (n < PAIR_PET_LOBBY_INV_BASE_SLOTS) return PAIR_PET_LOBBY_INV_BASE_SLOTS;
    if (n > PAIR_PET_LOBBY_INV_MAX_SLOTS) return PAIR_PET_LOBBY_INV_MAX_SLOTS;
    const extra = n - PAIR_PET_LOBBY_INV_BASE_SLOTS;
    const steps = Math.floor(extra / PAIR_PET_LOBBY_INV_EXPAND_STEP);
    return PAIR_PET_LOBBY_INV_BASE_SLOTS + steps * PAIR_PET_LOBBY_INV_EXPAND_STEP;
}

/** 완료한 확장 횟수(0이면 기본 슬롯만) */
export function pairPetLobbyExpansionCount(currentSlots: number): number {
    const s = pairPetLobbyInventorySlots(currentSlots);
    return Math.max(0, (s - PAIR_PET_LOBBY_INV_BASE_SLOTS) / PAIR_PET_LOBBY_INV_EXPAND_STEP);
}

/**
 * 다음 확장 1회에 필요한 다이아 — 가방(`EXPAND_INVENTORY`)과 동일 규칙:
 * `100 + (이미 완료한 확장 횟수) * 20`, 확장 횟수 = (정규화된 현재 슬롯 - BASE) / STEP.
 */
export function pairPetLobbyExpandDiamondCost(normalizedCurrentSlots: number): number {
    const expansionsMade = pairPetLobbyExpansionCount(normalizedCurrentSlots);
    return 100 + expansionsMade * 20;
}

/** 페어 로비 펫(알 제외) 마릿수 — 레거시 `quantity>1` 한 행도 합산 */
export function countPairLobbyPetEntriesInInventory(inv: InventoryItem[] | null | undefined): number {
    if (!Array.isArray(inv)) return 0;
    let sum = 0;
    for (const it of inv) {
        if (!isPairPetMaterial(it) || isPairEggItem(it)) continue;
        const raw = Number(it.quantity ?? 1);
        const q = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
        sum += Math.max(1, q);
    }
    return sum;
}

export function pairLobbyPetSlotCapacityFromUser(user: {
    pairPetLobbyPetSlotCount?: number | null;
    pairPetLobbySlotCount?: number | null;
}): number {
    return pairPetLobbyInventorySlots(user.pairPetLobbyPetSlotCount ?? user.pairPetLobbySlotCount);
}

/** 부화 수령·즉시 완료 등 펫 로비 칸이 꽉 찼는지(서버·클라 동일 판정). 부화 시작은 제외 */
export function isPairLobbyPetInventoryFull(user: {
    inventory?: InventoryItem[] | null;
    pairPetLobbyPetSlotCount?: number | null;
    pairPetLobbySlotCount?: number | null;
}): boolean {
    return countPairLobbyPetEntriesInInventory(user.inventory ?? []) >= pairLobbyPetSlotCapacityFromUser(user);
}

export const PAIR_EGG_TEMPLATE_ID = 'pair-egg-mystery';

/** 환영 우편 등: 신비로운알과 동일 이미지, 부화 시 슬롯 무관 1분·레벨 10 펫 */
export const PAIR_WELCOME_EGG_TEMPLATE_ID = 'pair-egg-welcome';
export const PAIR_WELCOME_EGG_HATCH_LEVEL = 10;

/** 상점 지급·MATERIAL_ITEMS 키와 동일한 알 이름 */
export const PAIR_EGG_MATERIAL_NAME = '신비로운알';

/** `(특)신비로운 알` — MATERIAL_ITEMS 객체 키·표기명과 동일 */
export const PAIR_WELCOME_EGG_MATERIAL_NAME = '(특)신비로운 알';

/** 알 썸네일(상점 카드·부화장 등 공통) */
export const PAIR_EGG_DISPLAY_IMAGE = '/images/pets/egg.webp';

/** 페어 로비·상점 표기용 영혼석 이름 (등급 순) */
export const PAIR_SOULSTONE_NAMES = ['새싹영혼석', '파동영혼석', '심연영혼석', '화염영혼석', '천광영혼석'] as const;

export function isPairSoulStoneMaterialName(name: string): boolean {
    return (PAIR_SOULSTONE_NAMES as readonly string[]).includes(name);
}

export function pairSoulTierFromMaterialName(name: string): number {
    const idx = (PAIR_SOULSTONE_NAMES as readonly string[]).indexOf(name);
    if (idx >= 0) return idx + 1;
    return 1;
}

export function pairSoulTemplateIdFromTier(tier: number): string {
    const t = Math.min(5, Math.max(1, Math.floor(tier)));
    return `pair-soul-${t}`;
}

export const PAIR_SOULSTONE_TEMPLATE_IDS = [
    'pair-soul-1',
    'pair-soul-2',
    'pair-soul-3',
    'pair-soul-4',
    'pair-soul-5',
] as const;

/** 재료·상점·로비·도감 공통: 영혼석 설명 */
export const PAIR_SOULSTONE_DISPLAY_DESCRIPTIONS: Record<(typeof PAIR_SOULSTONE_NAMES)[number], string> = {
    새싹영혼석: '일반 등급 펫을 고급 등급으로 올릴 때 필요한 재료입니다. 펫 Lv.10 이상부터 사용할 수 있습니다.',
    파동영혼석: '고급 등급 펫을 희귀 등급으로 올릴 때 필요한 재료입니다. 펫 Lv.20 이상부터 사용할 수 있습니다.',
    심연영혼석: '희귀 등급 펫을 에픽 등급으로 올릴 때 필요한 재료입니다. 펫 Lv.30 이상부터 사용할 수 있습니다.',
    화염영혼석: '에픽 등급 펫을 전설 등급으로 올릴 때 필요한 재료입니다. 펫 Lv.40 이상부터 사용할 수 있습니다.',
    천광영혼석: '전설 등급 펫을 신화 등급으로 올릴 때 필요한 재료입니다. 펫 Lv.50에서 사용할 수 있습니다.',
};

/** 알 수 없는 이름이면 빈 문자열 */
export function getPairSoulStoneDisplayDescription(name: string): string {
    if (!isPairSoulStoneMaterialName(name)) return '';
    return PAIR_SOULSTONE_DISPLAY_DESCRIPTIONS[name as (typeof PAIR_SOULSTONE_NAMES)[number]];
}

/** 페어 펫상점 SKU (BUY_ 접두사 없음 → gameActions에서 상점 핸들러와 충돌하지 않음) */
export type PairPetShopSkuId =
    | 'pair_shop_egg_gold'
    | 'pair_shop_egg_diamond'
    | 'pair_shop_soul_1'
    | 'pair_shop_soul_2'
    | 'pair_shop_soul_3'
    | 'pair_shop_soul_4'
    | 'pair_shop_soul_5';

export type PairPetShopSku = {
    id: PairPetShopSkuId;
    /** 카드 제목 */
    label: string;
    gold: number;
    diamonds: number;
    /** 지급할 재료의 MATERIAL_ITEMS 키(이름) */
    materialName: string;
    quantity: number;
    /** KST 일일 구매 상한 (`dailyShopPurchases[sku]`와 연동). 0 이하면 무제한 */
    dailyLimit: number;
    /** 상세 설명(호버·툴팁) */
    description: string;
    /** 상점 카드 한 줄 요약 */
    shortDescription: string;
};

/** 일괄 표시·구매 처리 순서 */
export const PAIR_PET_SHOP_SKUS: PairPetShopSku[] = [
    {
        id: 'pair_shop_egg_gold',
        label: PAIR_EGG_MATERIAL_NAME,
        gold: 5000,
        diamonds: 0,
        materialName: PAIR_EGG_MATERIAL_NAME,
        quantity: 1,
        dailyLimit: 3,
        image: PAIR_EGG_DISPLAY_IMAGE,
        description: '부화장에서 무작위 AI 펫으로 부화할 수 있는 알입니다.',
        shortDescription: '펫이 부화하는 알',
    },
    {
        id: 'pair_shop_egg_diamond',
        label: '신비로운알(특)',
        gold: 0,
        diamonds: 200,
        materialName: PAIR_WELCOME_EGG_MATERIAL_NAME,
        quantity: 1,
        dailyLimit: 1,
        image: PAIR_EGG_DISPLAY_IMAGE,
        description:
            '신비로운 알과 같은 모습이지만, 어떤 부화 슬롯에서든 부화 시간이 1분이며 부화 시 레벨 10 AI 펫이 나옵니다.',
        shortDescription: '10레벨 펫이 1분만에 부화하는 알',
    },
    {
        id: 'pair_shop_soul_1',
        label: PAIR_SOULSTONE_NAMES[0],
        gold: 500,
        diamonds: 0,
        materialName: PAIR_SOULSTONE_NAMES[0],
        quantity: 1,
        dailyLimit: 0,
        image: '/images/pets/soulstone1.webp',
        description: PAIR_SOULSTONE_DISPLAY_DESCRIPTIONS[PAIR_SOULSTONE_NAMES[0]],
        shortDescription: '[일반] ➝ [고급] 펫 등급강화 재료',
    },
    {
        id: 'pair_shop_soul_2',
        label: PAIR_SOULSTONE_NAMES[1],
        gold: 1500,
        diamonds: 0,
        materialName: PAIR_SOULSTONE_NAMES[1],
        quantity: 1,
        dailyLimit: 0,
        image: '/images/pets/soulstone2.webp',
        description: PAIR_SOULSTONE_DISPLAY_DESCRIPTIONS[PAIR_SOULSTONE_NAMES[1]],
        shortDescription: '[고급] ➝ [희귀] 펫 등급강화 재료',
    },
    {
        id: 'pair_shop_soul_3',
        label: PAIR_SOULSTONE_NAMES[2],
        gold: 3000,
        diamonds: 0,
        materialName: PAIR_SOULSTONE_NAMES[2],
        quantity: 1,
        dailyLimit: 5,
        image: '/images/pets/soulstone3.webp',
        description: PAIR_SOULSTONE_DISPLAY_DESCRIPTIONS[PAIR_SOULSTONE_NAMES[2]],
        shortDescription: '[희귀] ➝ [에픽] 펫 등급강화 재료',
    },
    {
        id: 'pair_shop_soul_4',
        label: PAIR_SOULSTONE_NAMES[3],
        gold: 5000,
        diamonds: 0,
        materialName: PAIR_SOULSTONE_NAMES[3],
        quantity: 1,
        dailyLimit: 0,
        image: '/images/pets/soulstone4.webp',
        description: PAIR_SOULSTONE_DISPLAY_DESCRIPTIONS[PAIR_SOULSTONE_NAMES[3]],
        shortDescription: '[에픽] ➝ [전설] 펫 등급강화 재료',
    },
    {
        id: 'pair_shop_soul_5',
        label: PAIR_SOULSTONE_NAMES[4],
        gold: 10000,
        diamonds: 0,
        materialName: PAIR_SOULSTONE_NAMES[4],
        quantity: 1,
        dailyLimit: 0,
        image: '/images/pets/soulstone5.webp',
        description: PAIR_SOULSTONE_DISPLAY_DESCRIPTIONS[PAIR_SOULSTONE_NAMES[4]],
        shortDescription: '[전설] ➝ [신화] 펫 등급강화 재료',
    },
];

/** 페어 펫 상점 SKU 일일 구매 한도 없음 (`dailyLimit <= 0`) */
export function isPairPetShopSkuUnlimitedDaily(dailyLimit: number): boolean {
    return dailyLimit <= 0;
}

/**
 * 영혼석 1개 판매 골드 — 페어 상점에서 해당 영혼석을 골드로 살 때의 가격의 10% (`PAIR_PET_SHOP_SKUS`와 동기화).
 * 골드 구매가가 없는 SKU면 `null`.
 */
export function pairSoulStoneMaterialSellGoldPerUnit(materialName: string): number | null {
    const sku = PAIR_PET_SHOP_SKUS.find((s) => s.id.startsWith('pair_shop_soul_') && s.materialName === materialName);
    if (!sku) return null;
    const shopGold = Math.max(0, Math.floor(Number(sku.gold) || 0));
    if (shopGold <= 0) return null;
    return Math.floor(shopGold * 0.1);
}

/** `pair-pet-1` … `pair-pet-24` / `pet1.webp` … 순서에 대응하는 표시 이름 */
export const PAIR_PET_KIND_NAMES = [
    '루미폭스',
    '아이스냥',
    '골디냥',
    '스노우판다',
    '펭키',
    '썬버드',
    '바니루',
    '허니베어',
    '리프캣',
    '스프라우트',
    '바이올냥',
    '썬키',
    '앰버폭스',
    '크림냥',
    '윙키트',
    '마스크독',
    '아이보리베어',
    '스노우펫',
    '치키',
    '섀도울프',
    '윙바니',
    '골드치키',
    '팬더링',
    '젤리프로그',
] as const;

/** 도감·툴팁용 — 이름·컨셉에 맞는 짧은 소개 (pet1~24 순) */
export const PAIR_PET_KIND_DESCRIPTIONS: readonly string[] = [
    '은은하게 빛나는 털의 여우 아이. 밤길도 이 친구랑이면 든든해요.',
    '얼음 결 같은 눈망울의 냥이. 차갑게 굴더도 안으면 금방 녹아요.',
    '햇살 담은 금빛 털. 보물보다 당신 옆이 더 좋다고 해요.',
    '눈처럼 하얀 배와 멜빵 무늬. 구르다 넘어져도 먼저 웃는 판다예요.',
    '비틀거려도 당당한 걸음. 물가 산책을 제일 좋아하는 펭귄 친구.',
    '햇살 한 줌 등에 이고 날아오는 따스한 새.',
    '귀는 쫑긋, 당근 냄새면 어디든 깡총 따라가요.',
    '꿀단지보다 달콤한 건 역시 곁에 있는 당신이래요.',
    '잎사귀 모자 쓴 듯한 숲속 고양이. 산책길이 더 상쾌해져요.',
    '머리 위 새싹이 하루가 다르게 자라요. 물 주면 더 신나요.',
    '보랏빛 향기가 맴도는 듯한, 조금 신비로운 냥이.',
    '햇볕 쨍한 날 꼬리 흔들며 뛰는 에너지 만점 친구.',
    '호박처럼 따뜻한 눈빛의 여우. 가을 산책엔 딱이에요.',
    '크림처럼 부드러운 털, 안으면 기분이 녹아요.',
    '작은 날개로 풀잎만큼 살짝 떠오르는 상상력 만렙 냥이.',
    '멋진 마스크 무늬 얼굴, 장난감 앞에서는 아직 애기 강아지.',
    '아이보리빛 포근함. 말없이 꼭 안아 주는 스타일이에요.',
    '눈송이처럼 가볍고 하얀 설원의 단짝.',
    '눈치는 빠른데 애교는 더 많아요. 장난치다 들키면 삐질 수도.',
    '그림자 속에서도 눈빛만 반짝. 조용히 옆을 지켜줘요.',
    '날개 달린 토끼, 구름 위 깡총이 꿈이래요.',
    '금빛 반짝임에 자신감 만점, 무대 없어도 주인공이에요.',
    '아기 팬더처럼 뭉글뭉글, 반달 눈가가 매력.',
    '통통 튕기는 젤리 같은 개굴. 웃으면 볼이 출렁해요.',
];

export const PAIR_PET_CATALOG: Array<{
    templateId: string;
    displayName: string;
    description: string;
    image: string;
    grade: ItemGrade;
}> = Array.from({ length: 24 }, (_, i) => {
    const n = i + 1;
    return {
        templateId: `pair-pet-${n}`,
        displayName: PAIR_PET_KIND_NAMES[i] ?? `펫 ${n}`,
        description:
            PAIR_PET_KIND_DESCRIPTIONS[i] ?? '페어 경기장에서 동행하는 AI 펫입니다.',
        image: `/images/pets/pet${n}.webp`,
        grade: ItemGrade.Normal,
    };
});

export function isPairPetMaterial(item: Pick<InventoryItem, 'templateId' | 'name'>): boolean {
    return typeof item.templateId === 'string' && item.templateId.startsWith('pair-pet-');
}

export function isPairWelcomeEggItem(item: Pick<InventoryItem, 'templateId' | 'name'>): boolean {
    return item.templateId === PAIR_WELCOME_EGG_TEMPLATE_ID || item.name === PAIR_WELCOME_EGG_MATERIAL_NAME;
}

export function isPairEggItem(item: Pick<InventoryItem, 'templateId' | 'name'>): boolean {
    return (
        isPairWelcomeEggItem(item) ||
        item.templateId === PAIR_EGG_TEMPLATE_ID ||
        item.name === PAIR_EGG_MATERIAL_NAME ||
        item.name === '페어 미스터리 알'
    );
}

export function pairEggTemplateIdForHatch(item: Pick<InventoryItem, 'templateId' | 'name'>): string {
    if (isPairWelcomeEggItem(item)) return PAIR_WELCOME_EGG_TEMPLATE_ID;
    return typeof item.templateId === 'string' && item.templateId.length > 0
        ? item.templateId
        : PAIR_EGG_TEMPLATE_ID;
}

/** 부화 시작 시 서버와 동일 순서로 소모될 첫 알 행(수량 ≥ 1). `(특)신비로운 알`을 일반 신비로운알보다 우선 */
export function findFirstHatchablePairEgg(inv: InventoryItem[] | null | undefined): InventoryItem | undefined {
    if (!Array.isArray(inv)) return undefined;
    for (const it of inv) {
        if (isPairWelcomeEggItem(it) && (it.quantity ?? 1) >= 1) return it;
    }
    for (const it of inv) {
        if (isPairEggItem(it) && (it.quantity ?? 1) >= 1) return it;
    }
    return undefined;
}

export function isPairSoulStoneItem(item: Pick<InventoryItem, 'templateId' | 'name'>): boolean {
    return typeof item.templateId === 'string' && item.templateId.startsWith('pair-soul-');
}

/**
 * 일반 가방·대장간 등 공용 UI에서 제외 — 페어 경기장(대기실) 로비 인벤에서만 표시·관리.
 * `type === 'material'` 여부로 판별하지 않고, 알·펫·영혼석을 도메인 규칙으로만 묶습니다.
 */
export function isPairArenaExclusiveBagItem(item: Pick<InventoryItem, 'templateId' | 'name'>): boolean {
    return isPairEggItem(item) || isPairPetMaterial(item) || isPairSoulStoneItem(item);
}

export function rollPairPetTemplateId(): string {
    const idx = Math.floor(Math.random() * PAIR_PET_CATALOG.length);
    return PAIR_PET_CATALOG[idx]!.templateId;
}

export function getPairPetDefinition(templateId: string) {
    return PAIR_PET_CATALOG.find((p) => p.templateId === templateId);
}

/** 인벤 행 이름이 구버전이어도 `templateId` 기준으로 카탈로그 표기명 사용 */
export function getPairPetDisplayName(item: Pick<InventoryItem, 'templateId' | 'name'>): string {
    const tid = item.templateId;
    if (typeof tid === 'string' && tid.startsWith('pair-pet-')) {
        return getPairPetDefinition(tid)?.displayName ?? item.name;
    }
    return item.name;
}
