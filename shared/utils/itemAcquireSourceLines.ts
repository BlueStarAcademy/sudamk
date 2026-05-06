import type { InventoryItem } from '../../types.js';
import { ItemGrade } from '../../types/enums.js';
import { gradeStyles, MATERIAL_ITEMS } from '../../constants/items.js';
import {
    isPairSoulStoneMaterialName,
    PAIR_EGG_MATERIAL_NAME,
    PAIR_WELCOME_EGG_MATERIAL_NAME,
    PAIR_PET_SHOP_SKUS,
} from '../constants/petLobby.js';
import { PAIR_TRAINING_SLOT_DEFS } from '../constants/pairTraining.js';
import { pairPetSoulConvertMaterialNameForGrade } from './pairPetSoulConvert.js';
import { PAIR_PET_GRADE_ORDER } from '../constants/pairPetGrade.js';
import { formatGoldAmountKoG, formatWalletDiamonds } from './walletAmountDisplay.js';
import { isActionPointConsumable, isConditionPotionConsumable } from '../../constants/items.js';

const TOWER_SHOP_CONSUMABLE_NAMES = new Set(['턴 추가', '미사일', '히든', '스캔', '배치변경']);

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
    return `슬롯 ${slots.join('·')}`;
}

function soulConvertAcquireGradesLabel(materialName: string): string {
    const grades: ItemGrade[] = [];
    for (const g of [...PAIR_PET_GRADE_ORDER, ItemGrade.Transcendent]) {
        if (pairPetSoulConvertMaterialNameForGrade(g) === materialName) grades.push(g);
    }
    const labels = grades.map((g) => gradeStyles[g]?.name ?? '').filter(Boolean);
    const uniq = [...new Set(labels)];
    if (!uniq.length) return '';
    if (uniq.length === 1) return uniq[0]!;
    return uniq.map((u) => `${u}`).join('·');
}

function soulPetShopAcquireSnippet(materialName: string): string {
    const sku = PAIR_PET_SHOP_SKUS.find((s) => s.id.startsWith('pair_shop_soul_') && s.materialName === materialName);
    if (!sku) return '';
    const price =
        sku.diamonds > 0
            ? `다이아 ${formatWalletDiamonds(sku.diamonds)}`
            : `골드 ${formatGoldAmountKoG(sku.gold)}`;
    return `${price}, 일일 ${sku.dailyLimit}회`;
}

/**
 * 가방·도감 수준의 「획득처」 안내(정적 요약). 상점 구매 미리보기 등에서 사용.
 */
export function resolveBagItemAcquireLines(item: InventoryItem): string[] {
    const n = item.name;
    const lines: string[] = [];

    /** 획득 모달 등: 통화 전용 스냅샷(이미지로만 구분되는 경우) */
    if (item.image === '/images/icon/Gold.png') {
        lines.push('[경기·콘텐츠] 바둑 대국, 싱글플레이, 던전·리그 등');
        lines.push('[퀘스트·모험] 일일·주간·월간 퀘스트, 보물상자, VIP 슬롯');
        lines.push('[거래·분해] 거래소 판매 정산, 장비 분해, 일부 상점 판매');
        return lines;
    }
    if (item.image === '/images/icon/Zem.png') {
        lines.push('[상점] 다이아 패키지·소모품·재료 탭');
        lines.push('[결제·이벤트] 충전, 운영·프로모션 우편');
        lines.push('[기능] 가방 슬롯 확장 등 일부 프리미엄 기능');
        return lines;
    }

    if (isPairSoulStoneMaterialName(n)) {
        const tier = soulStoneTierFromTemplateId(item.templateId);
        const fromG = PAIR_PET_GRADE_ORDER[tier - 1];
        const toG = PAIR_PET_GRADE_ORDER[tier];
        if (fromG && toG) {
            lines.push(
                `[펫 · 사용] ${gradeStyles[fromG]?.name ?? ''} 등급 펫을 ${gradeStyles[toG]?.name ?? ''} 등급으로 승급할 때 소모`
            );
        }
        const train = soulTrainingRewardSlots(n);
        if (train) lines.push(`[펫 · 수련 보상] ${train}`);
        const conv = soulConvertAcquireGradesLabel(n);
        if (conv) lines.push(`[펫 · 영혼 변환] ${conv} 펫 분해 시 획득 가능`);
        const shop = soulPetShopAcquireSnippet(n);
        if (shop) lines.push(`[펫 · 펫 상점] ${shop}`);
        if (!lines.length) lines.push('[펫] 페어 경기장·부화장 관련 콘텐츠에서 획득·교환할 수 있습니다.');
        return lines;
    }

    if (n === PAIR_EGG_MATERIAL_NAME) {
        lines.push('[펫 · 부화장] 신비로운알을 부화할 때 소모');
        lines.push('[펫 · 펫 상점] 골드·다이아로 구매 가능(일일 한도)');
        lines.push('[펫 · 수련·이벤트] 일부 보상으로 획득');
        return lines;
    }

    if (n === PAIR_WELCOME_EGG_MATERIAL_NAME) {
        lines.push('[우편] 신규 환영·운영 지급 등으로 획득할 수 있습니다.');
        lines.push('[펫 · 부화장] 어떤 슬롯에서든 부화 시간 1분, 부화 시 레벨 5 펫');
        return lines;
    }

    if (TOWER_SHOP_CONSUMABLE_NAMES.has(n)) {
        lines.push('[도전의 탑] 경기 정보의 아이템 상점(골드)에서 구매');
        lines.push('[도전의 탑] 입장·클리어 보상, VIP 보상 등 일부 경로에서 획득');
        return lines;
    }

    if (isActionPointConsumable(n)) {
        lines.push('[상점] 골드 상점 — 행동력 회복제(+10/+20/+30), 일일 한도·단계 가격');
        lines.push('[우편·이벤트] 운영 보상·프로모션 지급');
        lines.push('[기능 VIP] 활성 시 매일 행동력 회복제 III 우편 지급');
        return lines;
    }

    if (isConditionPotionConsumable(n)) {
        lines.push('[상점] 다이아 상점(소모품) 또는 관련 패키지');
        lines.push('[퀘스트·이벤트] 일부 보상');
        return lines;
    }

    const compact = n.replace(/\s+/g, '');
    if (n.includes('길드') && (n.includes('장비 상자') || n.includes('장비상자'))) {
        lines.push('[길드 상점] 길드 코인으로만 구매 가능');
        lines.push('[상점·퀘스트] 일반 장비 상자와 유사하게 가방에서 사용해 장비 획득');
        return lines;
    }

    if (n.includes('장비 상자') || compact.includes('장비상자')) {
        lines.push('[상점] 골드 상점(장비 탭), 광고 보상, 일부 현금 패키지');
        lines.push('[퀘스트·VIP] 일일·주간·월간 퀘스트, 보상 VIP 슬롯 등');
        lines.push('[모험·길드] 보물상자, 길드 보스전 결과 보상 등');
        return lines;
    }

    if (n.includes('재료 상자') || compact.includes('재료상자')) {
        lines.push('[상점] 골드·다이아 상점(재료 탭), 광고 보상, 일부 패키지');
        lines.push('[퀘스트·VIP] 일일·주간·월간 퀘스트, 보상 VIP 슬롯 등');
        return lines;
    }

    if (n.includes('골드 꾸러미') || n.includes('골드꾸러미')) {
        lines.push('[상점] 다이아 상점(소모품), 광고 보상');
        lines.push('[퀘스트·모험] 각종 보상·보물상자');
        return lines;
    }

    if (n.includes('다이아 꾸러미') || n.includes('다이아꾸러미')) {
        lines.push('[상점] 다이아 상점(소모품), 광고 보상');
        lines.push('[퀘스트·이벤트] 일부 보상');
        return lines;
    }

    if (n.includes('보너스 스탯')) {
        lines.push('[길드 상점] 길드 코인으로 구매(계정 한도)');
        lines.push('[성장] 전략·놀이 레벨 상승 시 일부 지급');
        return lines;
    }

    if (item.type === 'material' && MATERIAL_ITEMS[n]?.name && !n.includes('상자')) {
        const isStone = n.includes('강화석');
        if (isStone) {
            lines.push('[길드 상점] 길드 코인으로 하급~신비의 강화석 교환 가능');
            lines.push('[재료 상자] 상점·퀘스트·VIP 등에서 얻는 재료 상자');
            lines.push('[대장간] 재료 합성·분해, 장비 강화 비용');
            lines.push('[모험·랭크·길드] 승리·탑·보스전 등 보상');
        } else {
            lines.push('[상점] 골드·다이아 상점(재료), 길드 상점(일부)');
            lines.push('[퀘스트·모험·이벤트] 일일·주간·월간, 보물상자, 운영 보상');
            lines.push('[우편] 합성·강화 결과, 이벤트 지급');
        }
        return lines;
    }

    if (item.type === 'equipment') {
        lines.push('[장비 상자] 가방에서 상자 사용 시 획득');
        lines.push('[모험] 스테이지·보스전 클리어 보상');
        lines.push('[거래소] 다른 유저의 등록 물품 구매');
        lines.push('[합성·제작] 대장간 합성·초월 장비 제작 등');
        return lines;
    }

    if (item.type === 'consumable') {
        lines.push('[상점·퀘스트·우편] 일반 상점·이벤트·운영 보상');
        return lines;
    }

    return lines;
}
