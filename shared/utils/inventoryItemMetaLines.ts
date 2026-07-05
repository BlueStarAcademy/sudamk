import type { InventoryItem } from '../../types.js';
import { ItemGrade } from '../../types/enums.js';
import { ENHANCEMENT_COSTS, MATERIAL_ITEMS, isActionPointConsumable, isConditionPotionConsumable, isRefinementTicketMaterial } from '../../constants/items.js';
import {
    isPairSoulStoneMaterialName,
    PAIR_EGG_MATERIAL_NAME,
    PAIR_WELCOME_EGG_MATERIAL_NAME,
    PAIR_PET_SHOP_SKUS,
    isPairPetShopSkuUnlimitedDaily,
} from '../constants/petLobby.js';
import { PAIR_TRAINING_SLOT_DEFS } from '../constants/pairTraining.js';
import { pairPetSoulConvertMaterialNameForGrade } from './pairPetSoulConvert.js';
import { PAIR_PET_GRADE_ORDER, pairPetSoulStoneTierGradeUpgradeUsage } from '../constants/pairPetGrade.js';
import { formatGoldAmountKoG, formatWalletDiamonds } from './walletAmountDisplay.js';
import { findConsumableItem, normalizeConsumableName } from './bagItemDetailHelpers.js';

const TOWER_SHOP_CONSUMABLE_NAMES = new Set(['턴 추가', '미사일', '히든', '스캔', '배치변경']);

export type InventoryMetaLine = {
    key: string;
    params?: Record<string, string | number>;
    fallback: string;
};

function line(key: string, fallback: string, params?: Record<string, string | number>): InventoryMetaLine {
    return { key: `inventory:meta.${key}`, params, fallback };
}

const gradeOrder: Record<ItemGrade, number> = {
    normal: 0,
    uncommon: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
    mythic: 5,
    transcendent: 6,
};

function mergeConsecutiveStarLevels(levels: number[]): [number, number][] {
    const unique = [...new Set(levels)].sort((a, b) => a - b);
    if (unique.length === 0) return [];
    const ranges: [number, number][] = [];
    let start = unique[0];
    let end = unique[0];
    for (let i = 1; i < unique.length; i++) {
        if (unique[i] === end + 1) {
            end = unique[i];
        } else {
            ranges.push([start, end]);
            start = end = unique[i];
        }
    }
    ranges.push([start, end]);
    return ranges;
}

function soulStoneTierFromTemplateId(templateId: string | null | undefined): number {
    const m = /^pair-soul-(\d+)$/.exec(templateId ?? '');
    if (!m) return 1;
    return Math.min(5, Math.max(1, parseInt(m[1]!, 10)));
}

function soulTrainingRewardSlots(materialName: string): string {
    const slots: number[] = [];
    for (const def of PAIR_TRAINING_SLOT_DEFS) {
        if (def.soulTable.some((r) => r.materialName === materialName)) slots.push(def.slotIndex + 1);
    }
    if (!slots.length) return '';
    return slots.join('·');
}

function soulConvertAcquireGradesLabel(materialName: string): string {
    const grades: ItemGrade[] = [];
    for (const g of [...PAIR_PET_GRADE_ORDER, ItemGrade.Transcendent]) {
        if (pairPetSoulConvertMaterialNameForGrade(g) === materialName) grades.push(g);
    }
    return [...new Set(grades)].join('·');
}

function soulPetShopAcquireSnippet(materialName: string): { priceKey: string; priceParams: Record<string, string>; dailyLimit?: number } | null {
    const sku = PAIR_PET_SHOP_SKUS.find((s) => s.id.startsWith('pair_shop_soul_') && s.materialName === materialName);
    if (!sku) return null;
    if (sku.diamonds > 0) {
        return {
            priceKey: 'acquire.pet.soulShopDiamond',
            priceParams: { amount: formatWalletDiamonds(sku.diamonds) },
            dailyLimit: isPairPetShopSkuUnlimitedDaily(sku.dailyLimit) ? undefined : sku.dailyLimit,
        };
    }
    return {
        priceKey: 'acquire.pet.soulShopGold',
        priceParams: { amount: formatGoldAmountKoG(sku.gold) },
        dailyLimit: isPairPetShopSkuUnlimitedDaily(sku.dailyLimit) ? undefined : sku.dailyLimit,
    };
}

function resolveSoulStoneUsageMetaLines(item: InventoryItem): InventoryMetaLine[] {
    const tier = soulStoneTierFromTemplateId(item.templateId);
    const upgradeUsage = pairPetSoulStoneTierGradeUpgradeUsage(tier);
    if (upgradeUsage) {
        return [
            line('usage.pet.soulGradeUpgrade', '[펫 · 등급 강화] {{fromGrade}}→{{toGrade}} (펫 Lv.{{minLevel}} 이상)', {
                fromGrade: upgradeUsage.from,
                toGrade: upgradeUsage.to,
                minLevel: upgradeUsage.minLevel,
            }),
        ];
    }
    return [line('usage.pet.soulGradeUpgradeGeneric', '[펫 · 등급 강화] 페어 경기장 동료 AI 펫의 등급 상승에 사용')];
}

function resolveSoulStoneAcquireMetaLines(materialName: string): InventoryMetaLine[] {
    const lines: InventoryMetaLine[] = [];
    const train = soulTrainingRewardSlots(materialName);
    if (train) {
        lines.push(line('acquire.pet.soulTraining', '[펫 · 수련 보상] 슬롯 {{slots}}', { slots: train }));
    }
    const conv = soulConvertAcquireGradesLabel(materialName);
    if (conv) {
        lines.push(line('acquire.pet.soulConvert', '[펫 · 영혼 변환] {{grades}} 펫 분해 시 획득 가능', { grades: conv }));
    }
    const shop = soulPetShopAcquireSnippet(materialName);
    if (shop) {
        if (shop.dailyLimit != null) {
            lines.push(
                line(`${shop.priceKey}Daily`, `[펫 · 펫 상점] {{amount}}, 일일 {{limit}}회`, {
                    ...shop.priceParams,
                    limit: shop.dailyLimit,
                }),
            );
        } else {
            lines.push(line(shop.priceKey, `[펫 · 펫 상점] {{amount}}`, shop.priceParams));
        }
    }
    if (!lines.length) {
        lines.push(line('acquire.pet.soulFallback', '[펫] 페어 경기장·부화장 관련 콘텐츠에서 획득·교환할 수 있습니다.'));
    }
    return lines;
}

function resolveEggUsageMetaLines(name: string): InventoryMetaLine[] {
    if (name === PAIR_EGG_MATERIAL_NAME) {
        return [line('usage.pet.eggHatchRandom', '[펫 · 부화장] 슬롯에 배치해 무작위 종류의 AI 펫으로 부화')];
    }
    if (name === PAIR_WELCOME_EGG_MATERIAL_NAME) {
        return [line('usage.pet.welcomeEggHatch', '[펫 · 부화장] 슬롯에 배치 — 부화 시간 1분, 부화 시 레벨 10 AI 펫')];
    }
    return [];
}

function resolveEggAcquireMetaLines(name: string): InventoryMetaLine[] {
    if (name === PAIR_EGG_MATERIAL_NAME) {
        return [
            line('acquire.pet.eggShop', '[펫 · 펫 상점] 골드·다이아로 구매 가능(일일 한도)'),
            line('acquire.pet.eggRewards', '[펫 · 수련·이벤트] 일부 보상으로 획득'),
        ];
    }
    if (name === PAIR_WELCOME_EGG_MATERIAL_NAME) {
        return [
            line('acquire.pet.welcomeEggMail', '[우편] 신규 환영·운영 지급 등으로 획득할 수 있습니다.'),
            line('acquire.pet.welcomeEggShop', '[펫 · 펫 상점] 다이아로 구매 가능(일일 1개)'),
        ];
    }
    return [];
}

export function resolveBagItemAcquireMetaLines(item: InventoryItem): InventoryMetaLine[] {
    const n = item.name;
    const lines: InventoryMetaLine[] = [];

    if (item.image === '/images/icon/Gold.webp') {
        return [
            line('acquire.gold.line1', '[경기·콘텐츠] 바둑 대국, 싱글플레이, 던전·리그 등'),
            line('acquire.gold.line2', '[퀘스트·모험] 일일·주간·월간 퀘스트, 보물상자, VIP 슬롯'),
            line('acquire.gold.line3', '[거래·분해] 거래소 판매 정산, 장비 분해, 일부 상점 판매'),
        ];
    }
    if (item.image === '/images/icon/Zem.webp') {
        return [
            line('acquire.diamond.line1', '[상점] 다이아 패키지·소모품·재료 탭'),
            line('acquire.diamond.line2', '[결제·이벤트] 충전, 운영·프로모션 우편'),
            line('acquire.diamond.line3', '[기능] 가방 슬롯 확장 등 일부 프리미엄 기능'),
        ];
    }

    if (isPairSoulStoneMaterialName(n)) {
        return [...resolveSoulStoneUsageMetaLines(item), ...resolveSoulStoneAcquireMetaLines(n)];
    }

    if (n === PAIR_EGG_MATERIAL_NAME) {
        return [...resolveEggUsageMetaLines(n), ...resolveEggAcquireMetaLines(n)];
    }

    if (n === PAIR_WELCOME_EGG_MATERIAL_NAME) {
        return [...resolveEggAcquireMetaLines(n), ...resolveEggUsageMetaLines(n)];
    }

    if (TOWER_SHOP_CONSUMABLE_NAMES.has(n)) {
        return [
            line('acquire.tower.line1', '[도전의 탑] 경기 정보의 아이템 상점(골드)에서 구매'),
            line('acquire.tower.line2', '[도전의 탑] 입장·클리어 보상, VIP 보상 등 일부 경로에서 획득'),
        ];
    }

    if (isActionPointConsumable(n)) {
        return [
            line('acquire.actionPoint.line1', '[상점] 골드 상점 — 행동력 회복제(+10/+20/+30), 일일 한도·단계 가격'),
            line('acquire.actionPoint.line2', '[우편·이벤트] 운영 보상·프로모션 지급'),
            line('acquire.actionPoint.line3', '[기능 VIP] 활성 시 매일 행동력 회복제 III 우편 지급'),
        ];
    }

    if (isConditionPotionConsumable(n)) {
        return [
            line('acquire.condition.line1', '[상점] 다이아 상점(소모품) 또는 관련 패키지'),
            line('acquire.condition.line2', '[퀘스트·이벤트] 일부 보상'),
        ];
    }

    const compact = n.replace(/\s+/g, '');
    if (n.includes('길드') && (n.includes('장비 상자') || n.includes('장비상자'))) {
        return [
            line('acquire.guildEquipBox.line1', '[길드 상점] 길드 코인으로만 구매 가능'),
            line('acquire.guildEquipBox.line2', '[상점·퀘스트] 일반 장비 상자와 유사하게 가방에서 사용해 장비 획득'),
        ];
    }

    if (n.includes('장비 상자') || compact.includes('장비상자')) {
        return [
            line('acquire.equipBox.line1', '[상점] 골드 상점(장비 탭), 광고 보상, 일부 현금 패키지'),
            line('acquire.equipBox.line2', '[퀘스트·VIP] 일일·주간·월간 퀘스트, 보상 VIP 슬롯 등'),
            line('acquire.equipBox.line3', '[모험·길드] 보물상자, 길드 보스전 결과 보상 등'),
        ];
    }

    if (n.includes('재료 상자') || compact.includes('재료상자')) {
        return [
            line('acquire.materialBox.line1', '[상점] 골드·다이아 상점(재료 탭), 광고 보상, 일부 패키지'),
            line('acquire.materialBox.line2', '[퀘스트·VIP] 일일·주간·월간 퀘스트, 보상 VIP 슬롯 등'),
        ];
    }

    if (n.includes('골드 꾸러미') || n.includes('골드꾸러미')) {
        return [
            line('acquire.goldBundle.line1', '[상점] 다이아 상점(소모품), 광고 보상'),
            line('acquire.goldBundle.line2', '[퀘스트·모험] 각종 보상·보물상자'),
        ];
    }

    if (n.includes('다이아 꾸러미') || n.includes('다이아꾸러미')) {
        return [
            line('acquire.diamondBundle.line1', '[상점] 다이아 상점(소모품), 광고 보상'),
            line('acquire.diamondBundle.line2', '[퀘스트·이벤트] 일부 보상'),
        ];
    }

    if (n.includes('보너스 스탯')) {
        return [
            line('acquire.bonusStat.line1', '[길드 상점] 길드 코인으로 구매(계정 한도)'),
            line('acquire.bonusStat.line2', '[성장] 전략·놀이 레벨 상승 시 일부 지급'),
        ];
    }

    if (item.type === 'material' && MATERIAL_ITEMS[n]?.name && !n.includes('상자')) {
        const isStone = n.includes('강화석');
        if (isStone) {
            return [
                line('acquire.enhancementStone.line1', '[길드 상점] 길드 코인으로 하급~신비의 강화석 교환 가능'),
                line('acquire.enhancementStone.line2', '[재료 상자] 상점·퀘스트·VIP 등에서 얻는 재료 상자'),
                line('acquire.enhancementStone.line3', '[대장간] 재료 합성·분해, 장비 강화 비용'),
                line('acquire.enhancementStone.line4', '[모험·랭크·길드] 승리·탑·보스전 등 보상'),
            ];
        }
        return [
            line('acquire.material.line1', '[상점] 골드·다이아 상점(재료), 길드 상점(일부)'),
            line('acquire.material.line2', '[퀘스트·모험·이벤트] 일일·주간·월간, 보물상자, 운영 보상'),
            line('acquire.material.line3', '[우편] 합성·강화 결과, 이벤트 지급'),
        ];
    }

    if (item.type === 'equipment') {
        return [
            line('acquire.equipment.line1', '[장비 상자] 가방에서 상자 사용 시 획득'),
            line('acquire.equipment.line2', '[모험] 스테이지·보스전 클리어 보상'),
            line('acquire.equipment.line3', '[거래소] 다른 유저의 등록 물품 구매'),
            line('acquire.equipment.line4', '[합성·제작] 대장간 합성·초월 장비 제작 등'),
        ];
    }

    if (item.type === 'consumable') {
        return [line('acquire.consumableGeneric', '[상점·퀘스트·우편] 일반 상점·이벤트·운영 보상')];
    }

    return lines;
}

export function resolvePetTabEggOrSoulUsageMetaLines(item: InventoryItem): InventoryMetaLine[] {
    if (isPairSoulStoneMaterialName(item.name)) return resolveSoulStoneUsageMetaLines(item);
    return resolveEggUsageMetaLines(item.name);
}

export function resolvePetTabEggOrSoulAcquireMetaLines(item: InventoryItem): InventoryMetaLine[] {
    if (isPairSoulStoneMaterialName(item.name)) return resolveSoulStoneAcquireMetaLines(item.name);
    return resolveEggAcquireMetaLines(item.name);
}

export function getEnhancementMaterialUsageMetaLines(materialName: string): InventoryMetaLine[] {
    const groupedDetails: Record<ItemGrade, number[]> = {
        [ItemGrade.Normal]: [],
        [ItemGrade.Uncommon]: [],
        [ItemGrade.Rare]: [],
        [ItemGrade.Epic]: [],
        [ItemGrade.Legendary]: [],
        [ItemGrade.Mythic]: [],
        [ItemGrade.Transcendent]: [],
    };

    for (const grade in ENHANCEMENT_COSTS) {
        const costsForGrade = ENHANCEMENT_COSTS[grade as ItemGrade];
        costsForGrade.forEach((costArray, starIndex) => {
            costArray.forEach((cost) => {
                if (cost.name === materialName) {
                    groupedDetails[grade as ItemGrade].push(starIndex + 1);
                }
            });
        });
    }

    const details: InventoryMetaLine[] = [];
    const gradeKeys = Object.keys(groupedDetails) as ItemGrade[];
    gradeKeys.sort((a, b) => gradeOrder[a] - gradeOrder[b]);

    for (const grade of gradeKeys) {
        const starLevels = groupedDetails[grade];
        if (starLevels.length === 0) continue;
        for (const [lo, hi] of mergeConsecutiveStarLevels(starLevels)) {
            const rangeKey = lo === hi ? 'single' : 'range';
            const params: Record<string, string | number> = { grade };
            if (rangeKey === 'single') {
                params.stars = lo;
            } else {
                params.minStars = lo;
                params.maxStars = hi;
            }
            details.push(
                line(`usage.enhancementMaterial.${rangeKey}`, `[{{gradeLabel}}] 장비 : {{rangeLabel}}`, params),
            );
        }
    }
    return details;
}

export function getMaterialBagUsageMetaLines(materialName: string): InventoryMetaLine[] {
    if (materialName === '귀속 해제권') {
        return [line('usage.unbindTicket', '[가방]-[장비선택]-[귀속해제]')];
    }
    if (materialName === '제련의 부적') {
        return [line('usage.refinementCharm', '[대장간]-[장비제련] 제련불가 장비 선택')];
    }
    if (isRefinementTicketMaterial(materialName)) {
        const ticketKey: Record<string, string> = {
            '옵션 종류 변경권': 'usage.refinementTicket.optionType',
            '옵션 수치 변경권': 'usage.refinementTicket.optionValue',
            '스페셜 옵션 변경권': 'usage.refinementTicket.specialOption',
            '신화 옵션 변경권': 'usage.refinementTicket.mythicOption',
        };
        const key = ticketKey[materialName] ?? 'usage.refinementTicket.generic';
        return [line(key, `[대장간 - 장비제련] ${materialName.replace(' 변경권', '변경')}`)];
    }
    return getEnhancementMaterialUsageMetaLines(materialName);
}

export function getBagConsumableUsageMetaLine(name: string): InventoryMetaLine | null {
    if (isConditionPotionConsumable(name)) {
        const compact = name.replace(/\s+/g, '');
        let lo = 1;
        let hi = 10;
        if (compact.includes('(중)')) {
            lo = 10;
            hi = 20;
        } else if (compact.includes('(대)')) {
            lo = 20;
            hi = 30;
        }
        return line('usage.conditionPotion', '[챔피언십] 경기시작 전 컨디션 {{lo}}~{{hi}}회복', { lo, hi });
    }
    if (isActionPointConsumable(name)) {
        const m = name.match(/\+(\d+)/);
        const amount = m ? m[1] : '';
        if (amount) {
            return line('usage.actionPointInstant', '[즉시사용] 행동력 회복 +{{amount}}', { amount });
        }
        return line('usage.actionPointInstantGeneric', '[즉시사용] 행동력 회복');
    }
    const compact = name.replace(/\s+/g, '');
    if (compact.includes('꾸러미') || compact.includes('상자')) {
        return line('usage.openBoxInBag', '가방에서 사용하면 보상을 획득합니다.');
    }
    return null;
}

export function resolveItemObtainDescriptionMeta(item: InventoryItem): InventoryMetaLine | string {
    const trimmed = (item.description || '').trim();
    if (trimmed) return trimmed;
    if (item.image === '/images/icon/Gold.webp') {
        return line('description.gold', '바둑계 전역에서 사용되는 대표 화폐입니다.');
    }
    if (item.image === '/images/icon/Zem.webp') {
        return line('description.diamond', '특별한 구매·확장 등에 사용되는 프리미엄 재화입니다.');
    }
    if (item.type === 'consumable') {
        const c = findConsumableItem(item.name);
        if (c?.description) return (c.description || '').trim();
    }
    if (item.type === 'material') {
        const m = MATERIAL_ITEMS[item.name];
        if (m?.description) return (m.description || '').trim();
        const m2 = MATERIAL_ITEMS[normalizeConsumableName(item.name)];
        if (m2?.description) return (m2.description || '').trim();
    }
    return '';
}

export function resolveItemObtainUsageMetaLines(item: InventoryItem): InventoryMetaLine[] {
    if (item.image === '/images/icon/Gold.webp') {
        return [line('usage.goldSpend', '상점, 강화·제작, 입장료 등 골드 소비처에서 사용됩니다.')];
    }
    if (item.image === '/images/icon/Zem.webp') {
        return [line('usage.diamondSpend', '다이아 상점, 가방 슬롯 확장 등에서 사용됩니다.')];
    }
    if (item.type === 'material') {
        return getMaterialBagUsageMetaLines(item.name);
    }
    if (item.type === 'consumable') {
        const hint = getBagConsumableUsageMetaLine(item.name);
        return hint ? [hint] : [];
    }
    return [];
}

export function resolvePurchaseModalUsageMetaLines(params: { name: string; type: InventoryItem['type'] }): InventoryMetaLine[] {
    if (params.type === 'material') {
        return getMaterialBagUsageMetaLines(params.name);
    }
    const hint = getBagConsumableUsageMetaLine(params.name);
    if (hint) return [hint];
    if (params.type === 'equipment') {
        return [line('usage.equipmentBoxOpen', '가방에서 상자를 사용하면 장비를 획득할 수 있습니다.')];
    }
    return [];
}
