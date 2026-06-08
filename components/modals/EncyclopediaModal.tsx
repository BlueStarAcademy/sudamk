import React, { useState, useMemo, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { InventoryItem, InventoryItemType, EquipmentSlot, ItemGrade, MythicStat } from '../../types.js';
import {
    EQUIPMENT_POOL,
    MATERIAL_ITEMS,
    CONSUMABLE_ITEMS,
    GRADE_SUB_OPTION_RULES,
    MAIN_STAT_DEFINITIONS,
    SUB_OPTION_POOLS,
    SPECIAL_STATS_DATA,
    MYTHIC_STATS_DATA,
    GRADE_LEVEL_REQUIREMENTS,
    formatEquipLevelRequirement,
    isActionPointConsumable,
    PAIR_PET_CATALOG,
} from '../../constants';
import { computeEnhancedMainValueAtStars } from '../../shared/utils/equipmentEnhancementStars.js';
import {
    PAIR_PET_HATCH_DISPOSITION_ENCYCLOPEDIA_LINES,
    PAIR_PET_HATCH_SPECIALIZATION_ENCYCLOPEDIA_LINES,
} from '../../shared/utils/pairPetRoll.js';
import { PAIR_PET_RPS_IMAGE_BY_ATTR } from '../../shared/utils/pairPetRps.js';
import type { PairPetRpsAttribute } from '../../types/entities.js';
import {
    isPairSoulStoneMaterialName,
    PAIR_EGG_MATERIAL_NAME,
    PAIR_EGG_TEMPLATE_ID,
    PAIR_WELCOME_EGG_MATERIAL_NAME,
    PAIR_SOULSTONE_NAMES,
} from '../../shared/constants/petLobby.js';
import { getMaterialBagUsageLines, getBagConsumableUsageHint } from '../../shared/utils/bagItemDetailHelpers.js';
import {
    resolveBagItemAcquireLines,
    resolvePetTabEggOrSoulAcquireLines,
    resolvePetTabEggOrSoulUsageLines,
} from '../../shared/utils/itemAcquireSourceLines.js';
import {
    MYTHIC_GRADE_SPECIAL_OPTION_STATS,
    TRANSCENDENT_GRADE_SPECIAL_OPTION_STATS,
} from '../../shared/utils/specialOptionGearEffects.js';
import DraggableWindow from '../DraggableWindow.js';
import { MythicStatAbbrev } from '../MythicStatAbbrev.js';
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../../shared/constants/pcShellLayout.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';

interface EncyclopediaModalProps {
    onClose: () => void;
    isTopmost?: boolean;
    /** PC 로비 중앙 인라인 패널 — DraggableWindow 생략 */
    embedded?: boolean;
}

type EncyclopediaItem = {
    name: string;
    description: string;
    type: InventoryItemType;
    slot: EquipmentSlot | null;
    image: string | null;
    grade: ItemGrade;
    quantity?: number;
    templateId?: string;
};

function isPetTabEggOrSoulStoneItem(item: EncyclopediaItem): boolean {
    return (
        isPairSoulStoneMaterialName(item.name) ||
        item.name === PAIR_EGG_MATERIAL_NAME ||
        item.name === PAIR_WELCOME_EGG_MATERIAL_NAME
    );
}

const gradeBackgrounds: Record<ItemGrade, string> = {
    normal: 'images/equipments/normalbgi.webp',
    uncommon: 'images/equipments/uncommonbgi.webp',
    rare: 'images/equipments/rarebgi.webp',
    epic: 'images/equipments/epicbgi.webp',
    legendary: 'images/equipments/legendarybgi.webp',
    mythic: 'images/equipments/mythicbgi.webp',
    transcendent: 'images/equipments/transcendentbgi.webp',
};

const gradeOrder: Record<ItemGrade, number> = {
    normal: 0,
    uncommon: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
    mythic: 5,
    transcendent: 6,
};

/** 신화/초월 등 동일 표시명 장비 구분용 (이름만으로는 목록 키·선택이 충돌함) */
function encyclopediaItemKey(item: EncyclopediaItem): string {
    return `${item.type}|${item.name}|${item.grade}|${item.slot ?? ''}`;
}

function encyclopediaItemsEqual(a: EncyclopediaItem, b: EncyclopediaItem): boolean {
    return a.name === b.name && a.grade === b.grade && a.type === b.type && (a.slot ?? null) === (b.slot ?? null);
}

function computeBubblePlacementInModal(
    anchor: DOMRect,
    modalBounds: DOMRect,
    bubbleSize?: { height: number },
): {
    left: number;
    top: number;
    maxW: number;
    maxH: number;
    placeBelow: boolean;
    arrowOffset: number;
} {
    const pad = 14;
    const gap = 10;
    const modalLeft = modalBounds.left + pad;
    const modalRight = modalBounds.right - pad;
    const modalTop = modalBounds.top + pad;
    const modalBottom = modalBounds.bottom - pad;
    const modalInnerW = Math.max(240, modalRight - modalLeft);
    const modalInnerH = Math.max(220, modalBottom - modalTop);

    const maxW = Math.min(520, modalInnerW);
    const cx = anchor.left + anchor.width / 2;
    const rightSpace = modalRight - anchor.right;
    const leftSpace = anchor.left - modalLeft;
    const placeRight = rightSpace >= maxW || rightSpace >= leftSpace;
    const preferredLeft = placeRight ? anchor.right + gap : anchor.left - maxW - gap;
    const left = Math.min(Math.max(preferredLeft, modalLeft), modalRight - maxW);

    const estimatedBubbleH = Math.min(420, Math.max(240, modalInnerH * 0.5));
    const measuredBubbleH = bubbleSize?.height ?? estimatedBubbleH;
    const clampedBubbleH = Math.min(measuredBubbleH, modalInnerH);
    const topSpace = anchor.top - modalTop;
    const bottomSpace = modalBottom - anchor.bottom;
    const placeBelow = bottomSpace >= clampedBubbleH || bottomSpace >= topSpace;
    const preferredTop = placeBelow ? anchor.bottom + gap : anchor.top - clampedBubbleH - gap;
    const top = Math.min(Math.max(preferredTop, modalTop), modalBottom - clampedBubbleH);

    const edgePad = 10;
    const maxH = Math.max(120, Math.min(modalBottom - top - edgePad, modalInnerH));
    const arrowOffset = Math.min(Math.max(cx - left - 7, 16), maxW - 32);
    return { left, top, maxW, maxH, placeBelow, arrowOffset };
}

/** 도감 재료 탭에서 제외 — 펫 탭(알·영혼석)으로만 표시 */
function isPetTabExclusiveMaterial(item: Pick<InventoryItem, 'name'>): boolean {
    return (
        isPairSoulStoneMaterialName(item.name) ||
        item.name === PAIR_EGG_MATERIAL_NAME ||
        item.name === PAIR_WELCOME_EGG_MATERIAL_NAME
    );
}

function isHighTierEncyclopediaEquipment(item: EncyclopediaItem | null | undefined): boolean {
    return (
        !!item &&
        item.type === 'equipment' &&
        (item.grade === ItemGrade.Mythic || item.grade === ItemGrade.Transcendent)
    );
}

function formatEncyclopediaMainStatNumber(v: number): string {
    if (!Number.isFinite(v)) return '0';
    const t = Math.round(v * 100) / 100;
    return Number.isInteger(t) ? String(t) : t.toFixed(2).replace(/\.?0+$/, '');
}

/** 가방·인벤토리와 동일: 행동력 회복제는 이미지 대신 ⚡ + 수치 */
function ActionPointIconOverlay({ name, compact }: { name: string; compact?: boolean }) {
    const m = name.match(/\+(\d+)/);
    const apValue = m?.[1];
    return (
        <span
            className={`absolute inset-0 z-[2] flex flex-col items-center justify-center ${compact ? 'text-[1.55rem] sm:text-[1.75rem]' : 'text-[2.8rem]'}`}
            style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
            aria-hidden
        >
            <span className="leading-none drop-shadow-[0_0_10px_rgba(34,211,238,0.55)]">⚡</span>
            {apValue ? (
                <span
                    className={`mt-0.5 font-bold text-cyan-300 drop-shadow-[0_0_4px_rgba(34,211,238,0.8)] ${
                        compact ? 'text-[10px] sm:text-[11px]' : 'text-base'
                    }`}
                >
                    +{apValue}
                </span>
            ) : null}
        </span>
    );
}

type EncyclopediaListSection = {
    key: string;
    title: string;
    badge: string;
    items: EncyclopediaItem[];
};

const EncyclopediaItemThumb: React.FC<{ item: EncyclopediaItem; size?: 'sm' | 'md' }> = ({ item, size = 'sm' }) => {
    const shell =
        size === 'sm'
            ? 'h-10 w-10 rounded-md'
            : 'h-[4.75rem] w-[4.75rem] rounded-lg ring-2 ring-amber-400/30 shadow-lg sm:h-[5.25rem] sm:w-[5.25rem]';
    return (
        <div className={`relative shrink-0 overflow-hidden ring-1 ring-inset ring-white/10 ${shell}`}>
            <img src={gradeBackgrounds[item.grade]} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {isActionPointConsumable(item.name) ? (
                <ActionPointIconOverlay name={item.name} compact />
            ) : item.image ? (
                <img
                    src={item.image}
                    alt=""
                    className="absolute object-contain"
                    style={{
                        width: '78%',
                        height: '78%',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                    }}
                />
            ) : null}
        </div>
    );
};

function encyclopediaItemAsInventoryPreview(item: EncyclopediaItem): InventoryItem {
    return {
        id: 'encyclopedia-preview',
        name: item.name,
        description: item.description,
        type: item.type === 'equipment' ? 'equipment' : item.type,
        slot: item.slot,
        quantity: 0,
        level: 0,
        isEquipped: false,
        createdAt: 0,
        image: item.image ?? '',
        grade: item.grade,
        stars: 0,
        ...(item.templateId ? { templateId: item.templateId } : {}),
    };
}

const EncyclopediaIconCell: React.FC<{
    item: EncyclopediaItem;
    active: boolean;
    onClick: (anchor: HTMLElement) => void;
}> = ({ item, active, onClick }) => (
    <button
        type="button"
        title={item.name}
        onClick={(e) => {
            e.stopPropagation();
            onClick(e.currentTarget);
        }}
        className={`group relative w-full rounded-lg p-0.5 transition-all duration-200 ${
            active
                ? 'z-[2] bg-amber-950/35 ring-2 ring-inset ring-amber-400/95 shadow-[inset_0_0_14px_rgba(251,191,36,0.18)]'
                : 'ring-1 ring-inset ring-white/[0.12] hover:z-[1] hover:bg-white/[0.04] hover:ring-amber-400/45'
        }`}
    >
        <div className="relative aspect-square w-full overflow-hidden rounded-md">
            <img src={gradeBackgrounds[item.grade]} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {isActionPointConsumable(item.name) ? (
                <ActionPointIconOverlay name={item.name} compact />
            ) : item.image ? (
                <img
                    src={item.image}
                    alt=""
                    className="absolute object-contain"
                    style={{
                        width: '78%',
                        height: '78%',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                    }}
                />
            ) : null}
        </div>
    </button>
);

const EncyclopediaModal: React.FC<EncyclopediaModalProps> = ({ onClose, isTopmost, embedded = false }) => {
    type MainTab = 'equipment' | 'material' | 'consumable' | 'pet';

    const { isNativeMobile, isNarrowViewport } = useNativeMobileShell();
    const useBubbleDetail = !embedded && (isNativeMobile || isNarrowViewport);

    const [mainTab, setMainTab] = useState<MainTab>('equipment');

    const equipmentSlots: EquipmentSlot[] = ['fan', 'board', 'top', 'bottom', 'bowl', 'stones'];
    const slotNames: Record<EquipmentSlot, string> = { fan: '부채', board: '바둑판', top: '상의', bottom: '하의', bowl: '바둑통', stones: '바둑돌' };
    const gradeStyles: Record<ItemGrade, { name: string; color: string }> = {
        normal: { name: '일반', color: 'text-slate-300' },
        uncommon: { name: '고급', color: 'text-emerald-300' },
        rare: { name: '희귀', color: 'text-sky-300' },
        epic: { name: '에픽', color: 'text-violet-300' },
        legendary: { name: '전설', color: 'text-rose-300' },
        mythic: { name: '신화', color: 'text-amber-200' },
        transcendent: { name: '초월', color: 'text-cyan-200' },
    };

    /** PC 뷰어 패널에서 선택된 항목 */
    const [selectedItem, setSelectedItem] = useState<EncyclopediaItem | null>(null);
    /** 모바일 말풍선 상세 */
    const [itemBubble, setItemBubble] = useState<{ item: EncyclopediaItem; anchor: DOMRect; modalBounds: DOMRect } | null>(null);
    const bubbleContentRef = useRef<HTMLDivElement>(null);
    const [bubbleSize, setBubbleSize] = useState<{ height: number } | null>(null);
    /** 장비 도감: 주옵·전투부옵 범위 미리보기 강화 단계 0~10 */
    const [encyclopediaEquipStars, setEncyclopediaEquipStars] = useState(0);

    const equipmentItemsBySlot = useMemo(() => {
        const map: Record<EquipmentSlot, EncyclopediaItem[]> = {
            fan: [],
            board: [],
            top: [],
            bottom: [],
            bowl: [],
            stones: [],
        };
        for (const raw of EQUIPMENT_POOL) {
            const slot = raw.slot as EquipmentSlot;
            if (!slot || !map[slot]) continue;
            map[slot].push(raw as EncyclopediaItem);
        }
        for (const slot of equipmentSlots) {
            map[slot].sort((a, b) => gradeOrder[a.grade] - gradeOrder[b.grade]);
        }
        return map;
    }, []);

    /** 도감 재료 탭: 변경권 / 강화석 구분 (이름 기준). 알·영혼석은 펫 탭 전용 */
    const materialItemsByGroup = useMemo(() => {
        const all = (Object.values(MATERIAL_ITEMS) as InventoryItem[]).filter((i) => !isPetTabExclusiveMaterial(i));
        const byGrade = (a: InventoryItem, b: InventoryItem) => gradeOrder[a.grade] - gradeOrder[b.grade];
        const tickets = all.filter((i) => i.name.includes('변경권')).sort(byGrade);
        const stones = all.filter((i) => i.name.includes('강화석')).sort(byGrade);
        const other = all.filter((i) => !i.name.includes('변경권') && !i.name.includes('강화석')).sort(byGrade);
        return {
            tickets: tickets as EncyclopediaItem[],
            stones: stones as EncyclopediaItem[],
            other: other as EncyclopediaItem[],
        };
    }, []);

    /** 도감 소모품 탭: 종류별 구분 */
    const consumableItemsByCategory = useMemo(() => {
        const all = [...CONSUMABLE_ITEMS] as InventoryItem[];
        const byGrade = (a: InventoryItem, b: InventoryItem) => gradeOrder[a.grade] - gradeOrder[b.grade];
        const byName = (a: InventoryItem, b: InventoryItem) => a.name.localeCompare(b.name, 'ko');
        const pick = (pred: (i: InventoryItem) => boolean): EncyclopediaItem[] => {
            const filtered = all.filter(pred);
            return filtered.sort(byGrade) as EncyclopediaItem[];
        };

        const towerNames = new Set(['턴 추가', '미사일', '히든', '스캔', '배치변경']);

        const sections: { key: string; title: string; items: EncyclopediaItem[] }[] = [
            { key: 'equipmentBox', title: '장비상자', items: pick((i) => i.name.includes('장비 상자')) },
            { key: 'resourceBox', title: '재료상자', items: pick((i) => i.name.includes('재료 상자')) },
            { key: 'goldBundle', title: '골드꾸러미', items: pick((i) => i.name.includes('골드 꾸러미')) },
            { key: 'diamondBundle', title: '다이아꾸러미', items: pick((i) => i.name.includes('다이아 꾸러미')) },
            { key: 'condition', title: '컨디션회복제', items: pick((i) => i.name.includes('컨디션')) },
            { key: 'actionPoint', title: '행동력 회복제', items: pick((i) => i.name.startsWith('행동력 회복제')) },
            { key: 'tower', title: '도전의 탑', items: pick((i) => towerNames.has(i.name)) },
        ];

        const assigned = new Set<string>();
        for (const s of sections) {
            for (const it of s.items) {
                assigned.add(encyclopediaItemKey(it));
            }
        }
        const other = all
            .filter((i) => !assigned.has(encyclopediaItemKey(i as EncyclopediaItem)))
            .sort(byName) as EncyclopediaItem[];
        if (other.length > 0) {
            sections.push({ key: 'other', title: '기타', items: other });
        }

        return sections;
    }, []);

    /** 도감 펫 탭: 알 → 영혼석 → 페어 펫 종류 */
    const petTabSections = useMemo((): { key: string; title: string; items: EncyclopediaItem[] }[] => {
        const eggRow = MATERIAL_ITEMS[PAIR_EGG_MATERIAL_NAME as keyof typeof MATERIAL_ITEMS];
        const welcomeEggRow = MATERIAL_ITEMS[PAIR_WELCOME_EGG_MATERIAL_NAME as keyof typeof MATERIAL_ITEMS];
        const eggItems: EncyclopediaItem[] = [
            ...(eggRow
                ? [
                      {
                          name: eggRow.name,
                          description: eggRow.description,
                          type: 'material' as const,
                          slot: null,
                          image: eggRow.image,
                          grade: eggRow.grade,
                          templateId:
                              (eggRow as InventoryItem).templateId ??
                              (eggRow.name === PAIR_EGG_MATERIAL_NAME ? PAIR_EGG_TEMPLATE_ID : undefined),
                      },
                  ]
                : []),
            ...(welcomeEggRow
                ? [
                      {
                          name: welcomeEggRow.name,
                          description: welcomeEggRow.description,
                          type: 'material' as const,
                          slot: null,
                          image: welcomeEggRow.image,
                          grade: welcomeEggRow.grade,
                          templateId: (welcomeEggRow as InventoryItem).templateId,
                      },
                  ]
                : []),
        ];
        const soulItems: EncyclopediaItem[] = PAIR_SOULSTONE_NAMES.map((name) => {
            const row = MATERIAL_ITEMS[name as keyof typeof MATERIAL_ITEMS];
            if (!row) return null;
            return {
                name: row.name,
                description: row.description,
                type: 'material' as const,
                slot: null,
                image: row.image,
                grade: row.grade,
                templateId: (row as InventoryItem).templateId,
            };
        }).filter(Boolean) as EncyclopediaItem[];
        const speciesItems: EncyclopediaItem[] = PAIR_PET_CATALOG.map((p) => ({
            name: p.displayName,
            description: p.description,
            type: 'material',
            slot: null,
            image: p.image,
            grade: p.grade,
        }));
        return [
            { key: 'egg', title: '알', items: eggItems },
            { key: 'soul', title: '영혼석', items: soulItems },
            { key: 'species', title: '페어 펫', items: speciesItems },
        ];
    }, []);

    const listSections = useMemo((): EncyclopediaListSection[] => {
        if (mainTab === 'equipment') {
            return equipmentSlots
                .map((slot) => ({
                    key: slot,
                    title: slotNames[slot],
                    badge: '부위',
                    items: equipmentItemsBySlot[slot],
                }))
                .filter((s) => s.items.length > 0);
        }
        if (mainTab === 'material') {
            const { tickets, stones, other } = materialItemsByGroup;
            const sections: EncyclopediaListSection[] = [
                { key: 'tickets', title: '변경권', badge: '재료', items: tickets },
                { key: 'stones', title: '강화석', badge: '재료', items: stones },
            ];
            if (other.length > 0) {
                sections.push({ key: 'other', title: '기타', badge: '재료', items: other });
            }
            return sections.filter((s) => s.items.length > 0);
        }
        if (mainTab === 'consumable') {
            return consumableItemsByCategory
                .filter((s) => s.items.length > 0)
                .map((s) => ({ ...s, badge: '소모품' }));
        }
        return petTabSections
            .filter((s) => s.items.length > 0)
            .map((s) => ({ ...s, badge: '펫' }));
    }, [mainTab, equipmentItemsBySlot, materialItemsByGroup, consumableItemsByCategory, petTabSections]);

    const selectedItemKey = selectedItem ? encyclopediaItemKey(selectedItem) : null;

    useEffect(() => {
        setItemBubble(null);
        if (useBubbleDetail) {
            setSelectedItem(null);
            return;
        }
        setEncyclopediaEquipStars(0);
        const first = listSections.flatMap((s) => s.items)[0] ?? null;
        setSelectedItem(first);
    }, [mainTab, listSections, useBubbleDetail]);

    useEffect(() => {
        if (useBubbleDetail || !selectedItem) return;
        const stillExists = listSections.some((s) =>
            s.items.some((it) => encyclopediaItemKey(it) === selectedItemKey),
        );
        if (!stillExists) {
            setSelectedItem(listSections.flatMap((s) => s.items)[0] ?? null);
        }
    }, [listSections, selectedItem, selectedItemKey, useBubbleDetail]);

    const encyclopediaEquipKey = useBubbleDetail
        ? itemBubble?.item?.type === 'equipment'
            ? encyclopediaItemKey(itemBubble.item)
            : null
        : selectedItem?.type === 'equipment'
          ? encyclopediaItemKey(selectedItem)
          : null;
    useEffect(() => {
        setEncyclopediaEquipStars(0);
    }, [encyclopediaEquipKey]);

    useEffect(() => {
        if (!itemBubble) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setItemBubble(null);
        };
        const onDocClick = (e: MouseEvent) => {
            if (bubbleContentRef.current?.contains(e.target as Node)) return;
            setItemBubble(null);
        };
        document.addEventListener('keydown', onKey);
        const t = window.setTimeout(() => document.addEventListener('click', onDocClick), 0);
        return () => {
            document.removeEventListener('keydown', onKey);
            window.clearTimeout(t);
            document.removeEventListener('click', onDocClick);
        };
    }, [itemBubble]);

    useLayoutEffect(() => {
        if (!itemBubble) {
            setBubbleSize(null);
            return;
        }
        const bubbleEl = bubbleContentRef.current;
        if (!bubbleEl) return;
        const measure = () => {
            const rect = bubbleEl.getBoundingClientRect();
            setBubbleSize({ height: rect.height });
        };
        measure();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
        if (ro) ro.observe(bubbleEl);
        return () => ro?.disconnect();
    }, [itemBubble]);

    const isBubbleForItem = useCallback(
        (item: EncyclopediaItem) => !!(itemBubble && encyclopediaItemsEqual(itemBubble.item, item)),
        [itemBubble],
    );

    const toggleItemBubble = useCallback((item: EncyclopediaItem, anchorEl: HTMLElement) => {
        setItemBubble((prev) => {
            if (prev && encyclopediaItemsEqual(prev.item, item)) return null;
            const modalEl = anchorEl.closest('[data-draggable-window="encyclopedia"]') as HTMLElement | null;
            const modalBounds = modalEl?.getBoundingClientRect() ?? anchorEl.getBoundingClientRect();
            return { item, anchor: anchorEl.getBoundingClientRect(), modalBounds };
        });
    }, []);

    const bubblePlacement = useMemo(() => {
        if (!itemBubble) return null;
        return computeBubblePlacementInModal(itemBubble.anchor, itemBubble.modalBounds, bubbleSize ?? undefined);
    }, [itemBubble, bubbleSize]);

    const mainTabBtn = (id: MainTab, label: string) => (
        <button
            type="button"
            key={id}
            onClick={() => setMainTab(id)}
            className={`relative flex-1 overflow-hidden rounded-lg py-1.5 text-[11px] font-semibold tracking-wide transition-all duration-300 sm:py-2 sm:text-sm ${
                mainTab === id
                    ? 'text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_24px_-4px_rgba(251,191,36,0.35)]'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
        >
            {mainTab === id && (
                <span
                    className="absolute inset-0 bg-gradient-to-b from-amber-600/35 via-amber-700/25 to-amber-950/40 ring-1 ring-amber-400/35"
                    aria-hidden
                />
            )}
            <span className="relative z-[1]">{label}</span>
        </button>
    );

    const subPanelClass =
        'rounded-xl border border-white/[0.08] bg-gradient-to-b from-slate-900/80 via-slate-950/90 to-black/80 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm';

    /** 우측 뷰어 — 장비·재료·소모품·펫 공통 타이포·섹션 UI */
    const viewerTitleClass =
        'line-clamp-3 text-base font-black leading-tight text-balance sm:text-lg sm:leading-tight lg:text-xl';
    const viewerChipClass = 'rounded-full border px-2.5 py-0.5 text-xs font-semibold sm:px-3 sm:py-1 sm:text-sm';
    const viewerBodyClass = 'text-sm leading-relaxed text-slate-300 sm:text-base sm:leading-relaxed';
    const viewerSectionShellClass =
        'rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:px-3.5 sm:py-3';
    const viewerSectionTitleClass = 'text-xs font-extrabold uppercase tracking-wide sm:text-sm';
    const viewerOptGridClass =
        'grid grid-cols-1 gap-x-3 gap-y-1.5 pt-2 text-sm leading-relaxed text-slate-300 sm:grid-cols-2 sm:gap-y-2 sm:text-base sm:leading-relaxed';
    const viewerFootnoteClass = 'text-xs leading-relaxed text-slate-500 sm:text-sm';
    const viewerHeaderCardClass =
        'rounded-xl border border-amber-300/25 bg-gradient-to-r from-amber-950/20 via-white/[0.02] to-indigo-950/25 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-3.5';
    const viewerDescBoxClass =
        'mt-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-left sm:mt-2.5 sm:px-3.5 sm:py-2.5';

    const renderViewerSection = (title: string, accentClass: string, children: React.ReactNode) => (
        <div className={viewerSectionShellClass}>
            <h5 className={`${viewerSectionTitleClass} ${accentClass}`}>{title}</h5>
            <div className="min-w-0 pt-2">{children}</div>
        </div>
    );

    const renderViewerBodyBlock = (children: React.ReactNode) => (
        <div className={viewerSectionShellClass}>
            <div className={viewerBodyClass}>{children}</div>
        </div>
    );

    const renderViewerLineList = (lines: string[], borderAccentClass: string) => (
        <ul className="mt-0 space-y-2">
            {lines.map((line, i) => (
                <li key={i} className={`border-l-2 py-0.5 pl-3 ${borderAccentClass} ${viewerBodyClass}`}>
                    {line}
                </li>
            ))}
        </ul>
    );

    /** 페어 펫 — 부화 성향·특화 후보 (2열 칩 그리드) */
    const viewerPetHatchSectionShellClass =
        'rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:px-3 sm:py-2.5';
    const viewerPetHatchItemClass =
        'min-w-0 break-words rounded-md border px-2 py-1 text-xs leading-snug text-slate-200/95 sm:text-sm sm:leading-snug';
    const viewerPetHatchGridClass = 'grid grid-cols-2 gap-1 pt-1.5 sm:gap-1.5';

    const renderPetHatchCompactSection = (
        title: string,
        titleAccentClass: string,
        itemBorderClass: string,
        lines: readonly string[],
    ) => (
        <div className={viewerPetHatchSectionShellClass}>
            <h5 className={`${viewerSectionTitleClass} ${titleAccentClass}`}>{title}</h5>
            <ul className={viewerPetHatchGridClass}>
                {lines.map((line, i) => (
                    <li key={`${title}-${i}`} className={`${viewerPetHatchItemClass} ${itemBorderClass}`}>
                        {line}
                    </li>
                ))}
            </ul>
        </div>
    );

    const PAIR_PET_RPS_LABELS: Record<PairPetRpsAttribute, string> = {
        1: '가위',
        2: '바위',
        3: '보',
    };
    const PAIR_PET_RPS_ATTRS: PairPetRpsAttribute[] = [1, 2, 3];

    const renderPetHatchRpsSection = () => (
        <div className={viewerPetHatchSectionShellClass}>
            <h5 className={`${viewerSectionTitleClass} text-sky-200/90`}>부화 시 속성</h5>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-md border border-sky-500/25 bg-sky-950/20 px-2.5 py-2 sm:gap-3 sm:px-3 sm:py-2.5">
                <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                    {PAIR_PET_RPS_ATTRS.map((attr) => (
                        <img
                            key={attr}
                            src={PAIR_PET_RPS_IMAGE_BY_ATTR[attr]}
                            alt={PAIR_PET_RPS_LABELS[attr]}
                            title={PAIR_PET_RPS_LABELS[attr]}
                            className="h-9 w-9 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] sm:h-11 sm:w-11"
                            loading="lazy"
                        />
                    ))}
                </div>
                <span className="text-xs leading-snug text-slate-400 sm:text-sm">(부화시 랜덤부여)</span>
            </div>
        </div>
    );

    /** 좌측 목록 스크롤 영역 */
    const listScrollClass = 'min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2 [-webkit-overflow-scrolling:touch]';

    /** 7열 아이콘(약 58px) + 간격·패딩 — 좌측 목록 최소 가로폭 */
    const listPanelWidthClass = embedded
        ? 'w-[32rem] max-w-[58%] shrink-0'
        : useBubbleDetail
          ? 'w-full min-w-0 flex-1'
          : 'w-full sm:w-[32rem] sm:max-w-[58%] sm:shrink-0';

    const iconGridClass = 'grid grid-cols-7 gap-1.5 sm:gap-2';

    const renderItemList = () => {
        if (listSections.length === 0) {
            return (
                <div className="flex h-full min-h-[8rem] items-center justify-center px-3 text-center text-sm text-slate-500">
                    표시할 항목이 없습니다.
                </div>
            );
        }

        return (
            <div className={listScrollClass}>
                <div className="flex flex-col gap-4">
                    {listSections.map(({ key, title, badge, items }) => (
                        <div key={key} className="min-w-0">
                            <div className="mb-2 flex items-center gap-2 border-b border-amber-500/20 pb-1.5">
                                <span className="text-[11px] font-black uppercase tracking-[0.12em] text-amber-200/75 sm:text-xs">
                                    {badge}
                                </span>
                                <h4 className="text-sm font-bold tracking-tight text-amber-100 sm:text-base">{title}</h4>
                                <span className="ml-auto rounded-md bg-black/35 px-2 py-0.5 text-[10px] tabular-nums text-slate-400">
                                    {items.length}
                                </span>
                            </div>
                            <div className={iconGridClass}>
                                {items.map((item) => {
                                    const itemKey = encyclopediaItemKey(item);
                                    return (
                                        <EncyclopediaIconCell
                                            key={itemKey}
                                            item={item}
                                            active={useBubbleDetail ? isBubbleForItem(item) : selectedItemKey === itemKey}
                                            onClick={(anchor) => {
                                                if (useBubbleDetail) {
                                                    toggleItemBubble(item, anchor);
                                                } else {
                                                    setSelectedItem(item);
                                                }
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderViewerPanel = () => {
        if (!selectedItem) {
            return (
                <div className="flex h-full min-h-[10rem] flex-col items-center justify-center gap-2 px-4 text-center text-slate-500">
                    <span className="text-3xl opacity-40" aria-hidden>
                        📖
                    </span>
                    <p className={viewerBodyClass}>아이콘을 선택하면 상세 정보가 표시됩니다.</p>
                </div>
            );
        }

        const isDenseEquipViewer = isHighTierEncyclopediaEquipment(selectedItem) && !!selectedItem.slot;

        return (
            <div
                className={`min-h-0 flex-1 p-2 sm:p-3 ${
                    isDenseEquipViewer ? 'overflow-hidden' : 'overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]'
                }`}
            >
                <div
                    className={`rounded-xl border border-amber-400/30 bg-gradient-to-b from-[#14151c] via-black/95 to-[#0a0a10] shadow-[0_12px_48px_-8px_rgba(0,0,0,0.9),0_0_40px_-16px_rgba(251,191,36,0.22)] ${
                        isDenseEquipViewer
                            ? 'h-full px-2 pb-2 pt-2 sm:px-3 sm:pb-2.5 sm:pt-2.5'
                            : 'min-h-full px-2.5 pb-3 pt-2.5 sm:px-4 sm:pb-4 sm:pt-3'
                    }`}
                    role="region"
                    aria-label="아이템 상세"
                >
                    {renderItemDetail(selectedItem)}
                </div>
            </div>
        );
    };

    const renderEquipmentSubOptions = (item: EncyclopediaItem, previewStars: number) => {
        if (item.type !== 'equipment' || !item.slot) return null;
        const isDenseEquipViewer = isHighTierEncyclopediaEquipment(item);
        const rules = GRADE_SUB_OPTION_RULES[item.grade];
        const formatCount = (count: [number, number]) => (count[0] === count[1] ? `${count[0]}` : `${count[0]}~${count[1]}`);
        const hasMythic = rules.mythicCount[0] > 0;
        /** 일반 등급 등 specialCount가 [0,0]이면 특수 옵션 없음 → 도감에서 블록 미표시 */
        const hasSpecialOptions = rules.specialCount[1] > 0;
        const combatPool = SUB_OPTION_POOLS[item.slot]?.[rules.combatTier] || [];

        const mainStatDef = MAIN_STAT_DEFINITIONS[item.slot];
        const mainStatGradeDef = mainStatDef.options[item.grade];
        const mainStatValue = mainStatGradeDef.value;
        const mainIsPercentage = mainStatDef.isPercentage;
        const mainStatNames = mainStatGradeDef.stats.join(' 또는 ');
        const starsClamped = Math.max(0, Math.min(10, Math.floor(previewStars)));
        const mainStatAtPreview = computeEnhancedMainValueAtStars(mainStatValue, item.grade, starsClamped);

        const sectionShellClass = viewerSectionShellClass;
        const optGridClass = isDenseEquipViewer
            ? 'grid grid-cols-3 gap-x-3 gap-y-1.5 pt-2 text-sm leading-relaxed text-slate-300 sm:gap-y-2 sm:text-base sm:leading-relaxed'
            : viewerOptGridClass;
        const optItemClass = 'min-w-0 break-words';
        const bodyClass = viewerBodyClass;
        const sectionTitleClass = viewerSectionTitleClass;

        const sectionTitle = (text: string, accent: string) => (
            <h5 className={`${sectionTitleClass} ${accent}`}>{text}</h5>
        );

        const mythicBoxClass =
            'mt-2 rounded-lg border px-3 py-2.5 text-sm leading-relaxed sm:text-base sm:leading-relaxed';
        const mythicBoxLabelClass = 'mb-1.5 text-xs font-semibold sm:text-sm';

        const combatSection = (
            <div className={sectionShellClass}>
                {sectionTitle(`부옵션 (랜덤 ${formatCount(rules.combatCount)}개)`, 'text-sky-200/95')}
                <ul className={optGridClass}>
                    {combatPool.map((opt, index) => (
                        <li key={`${opt.type}-${index}`} className={optItemClass}>
                            <strong className="text-sky-300">{opt.type}</strong>: +{opt.range[0]}~{opt.range[1]}
                            {opt.isPercentage ? '%' : ''}
                        </li>
                    ))}
                </ul>
            </div>
        );

        const specialSection = hasSpecialOptions ? (
            <div className={sectionShellClass}>
                {sectionTitle(`특수 옵션 (랜덤 ${formatCount(rules.specialCount)}개)`, 'text-emerald-200/95')}
                <ul className={optGridClass}>
                    {Object.entries(SPECIAL_STATS_DATA).map(([key, def]) => (
                        <li key={key} className={optItemClass}>
                            <strong className="text-emerald-300">{def.name}</strong>: +{def.range[0]}~{def.range[1]}
                            {def.isPercentage ? '%' : ''}
                        </li>
                    ))}
                </ul>
            </div>
        ) : null;

        return (
            <div className="min-h-0 space-y-3">
                <div className={sectionShellClass}>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
                        {sectionTitle('주옵션', 'text-amber-200/95')}
                        <label className="flex shrink-0 items-center gap-1.5">
                            <span className="sr-only">주옵 강화 단계</span>
                            <select
                                value={previewStars}
                                onChange={(e) => setEncyclopediaEquipStars(Number(e.target.value))}
                                className="cursor-pointer rounded-md border border-amber-500/35 bg-black/50 py-1.5 pl-2.5 pr-8 text-xs font-semibold text-amber-100 shadow-inner sm:text-sm"
                            >
                                <option value={0}>기본 (+0)</option>
                                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                                    <option key={n} value={n}>
                                        +{n}강
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <p className={`pt-2 ${bodyClass}`}>
                        <strong className="text-amber-100">{mainStatNames}</strong>
                        <span className="text-slate-400"> · {starsClamped === 0 ? '기본' : `+${starsClamped}강`} </span>
                        <span className="font-mono text-amber-100/95">
                            +{formatEncyclopediaMainStatNumber(mainStatAtPreview)}
                            {mainIsPercentage ? '%' : ''}
                        </span>
                        {starsClamped > 0 ? (
                            <span className={`mt-1 block ${viewerFootnoteClass}`}>
                                기본 +{formatEncyclopediaMainStatNumber(mainStatValue)}
                                {mainIsPercentage ? '%' : ''}
                            </span>
                        ) : null}
                    </p>
                </div>

                {combatSection}
                {specialSection}
                {hasMythic && (
                    <div className={sectionShellClass}>
                        {sectionTitle(`스페셜 옵션 (랜덤 ${formatCount(rules.mythicCount)}개)`, 'text-rose-200/95')}
                        {item.grade === ItemGrade.Mythic ? (
                            <div className={`${mythicBoxClass} border-rose-300/30 bg-rose-500/10 text-rose-100/95`}>
                                <p className={`${mythicBoxLabelClass} text-rose-200/90`}>신화 스페셜 옵션 후보</p>
                                <p className="break-words">
                                    {MYTHIC_GRADE_SPECIAL_OPTION_STATS.map((stat, index) => (
                                        <React.Fragment key={stat}>
                                            <MythicStatAbbrev stat={stat} textClassName="font-semibold text-rose-300" />
                                            {index < MYTHIC_GRADE_SPECIAL_OPTION_STATS.length - 1 && (
                                                <span className="px-1 text-rose-100/55">/</span>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </p>
                            </div>
                        ) : item.grade === ItemGrade.Transcendent ? (
                            <div className={`${mythicBoxClass} border-cyan-400/30 bg-cyan-500/10 text-cyan-50/95`}>
                                <p className={`${mythicBoxLabelClass} text-cyan-200/90`}>초월 스페셜 옵션 후보</p>
                                <p className="break-words">
                                    {TRANSCENDENT_GRADE_SPECIAL_OPTION_STATS.map((stat, index) => (
                                        <React.Fragment key={stat}>
                                            <MythicStatAbbrev stat={stat} textClassName="font-semibold text-cyan-300" />
                                            {index < TRANSCENDENT_GRADE_SPECIAL_OPTION_STATS.length - 1 && (
                                                <span className="px-1 text-cyan-100/55">/</span>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </p>
                            </div>
                        ) : (
                            <div className="mt-2 space-y-3">
                                <div>
                                    <p className={`${mythicBoxLabelClass} text-rose-200/90`}>신화 스페셜 옵션 후보</p>
                                    <ul className={optGridClass}>
                                        {MYTHIC_GRADE_SPECIAL_OPTION_STATS.map((stat) => {
                                            const data = MYTHIC_STATS_DATA[stat];
                                            return (
                                                <li key={stat} className="min-w-0 break-words text-rose-200/90">
                                                    <MythicStatAbbrev stat={stat} textClassName="font-semibold text-rose-300" />
                                                    <span className="text-rose-200/90"> · {data.shortDescription}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                                <div>
                                    <p className={`${mythicBoxLabelClass} text-cyan-200/90`}>초월 스페셜 옵션 후보</p>
                                    <ul className={optGridClass}>
                                        {TRANSCENDENT_GRADE_SPECIAL_OPTION_STATS.map((stat) => {
                                            const data = MYTHIC_STATS_DATA[stat];
                                            return (
                                                <li key={stat} className="min-w-0 break-words text-cyan-200/90">
                                                    <MythicStatAbbrev stat={stat} textClassName="font-semibold text-cyan-300" />
                                                    <span className="text-cyan-200/90"> · {data.shortDescription}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const encyclopediaGradeChipClass = (grade: ItemGrade) =>
        grade === 'mythic'
            ? 'border-amber-300/40 bg-amber-300/15 text-amber-100'
            : grade === 'transcendent'
              ? 'border-cyan-300/40 bg-cyan-300/15 text-cyan-100'
              : 'border-white/15 bg-white/5 text-slate-200';

    const renderItemDetail = (item: EncyclopediaItem) => {
        const isEquipmentDetail = item.type === 'equipment' && item.slot;
        const isDenseEquipViewer = isEquipmentDetail && isHighTierEncyclopediaEquipment(item);

        const kindLabel =
            isEquipmentDetail && item.slot
                ? slotNames[item.slot]
                : item.type === 'equipment'
                  ? '장비'
                  : mainTab === 'pet'
                    ? isPairSoulStoneMaterialName(item.name)
                        ? '영혼석'
                        : item.name === PAIR_EGG_MATERIAL_NAME || item.name === PAIR_WELCOME_EGG_MATERIAL_NAME
                          ? '알'
                          : '페어 펫'
                    : mainTab === 'material'
                      ? '재료'
                      : mainTab === 'consumable'
                        ? '소모품'
                        : item.type;

        const materialUsageLines = mainTab === 'material' ? getMaterialBagUsageLines(item.name) : [];
        const materialAcquireLines =
            mainTab === 'material' ? resolveBagItemAcquireLines(encyclopediaItemAsInventoryPreview(item)) : [];
        const consumableUsageLines =
            mainTab === 'consumable'
                ? (() => {
                      const hint = getBagConsumableUsageHint(item.name);
                      return [hint ?? '가방에서 사용할 수 있습니다.'];
                  })()
                : [];
        const consumableAcquireLines =
            mainTab === 'consumable' ? resolveBagItemAcquireLines(encyclopediaItemAsInventoryPreview(item)) : [];

        const headerCard = (
            <div className={`${viewerHeaderCardClass} ${isDenseEquipViewer ? '!p-2.5 sm:!p-3' : ''}`}>
                <div className={`flex items-start ${isDenseEquipViewer ? 'gap-2.5 sm:gap-3' : 'gap-3 sm:gap-3.5'}`}>
                    <EncyclopediaItemThumb item={item} size="md" />
                    <div className="min-w-0 flex-1">
                        <h3 className={`${viewerTitleClass} ${gradeStyles[item.grade].color}`}>{item.name}</h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:mt-2 sm:gap-2">
                            <span className={`${viewerChipClass} border-white/15 bg-black/35 text-slate-100`}>{kindLabel}</span>
                            <span className={`${viewerChipClass} ${encyclopediaGradeChipClass(item.grade)}`}>
                                {gradeStyles[item.grade].name}
                            </span>
                            {isEquipmentDetail ? (
                                <span
                                    className={`${viewerChipClass} border-emerald-300/25 bg-emerald-500/10 text-emerald-200/90`}
                                >
                                    {formatEquipLevelRequirement(GRADE_LEVEL_REQUIREMENTS[item.grade])}
                                </span>
                            ) : null}
                        </div>
                        <p
                            className={`${viewerDescBoxClass} ${viewerBodyClass} ${
                                isDenseEquipViewer ? 'line-clamp-2 !mt-1.5 !py-1.5 sm:!mt-2 sm:!py-2' : ''
                            }`}
                        >
                            {item.description}
                        </p>
                    </div>
                </div>
            </div>
        );

        let footer: React.ReactNode = null;

        if (mainTab === 'equipment' && isEquipmentDetail) {
            footer = <div className="min-h-0 min-w-0">{renderEquipmentSubOptions(item, encyclopediaEquipStars)}</div>;
        } else if (mainTab === 'pet' && isPetTabEggOrSoulStoneItem(item)) {
            const petPreview = encyclopediaItemAsInventoryPreview(item);
            const petUsageLines = resolvePetTabEggOrSoulUsageLines(petPreview);
            const petAcquireLines = resolvePetTabEggOrSoulAcquireLines(petPreview);
            footer = (
                <div className="space-y-3">
                    {renderViewerSection(
                        '사용처',
                        'text-sky-200/95',
                        renderViewerLineList(petUsageLines, 'border-sky-500/35'),
                    )}
                    {renderViewerSection(
                        '획득처',
                        'text-amber-200/90',
                        petAcquireLines.length > 0 ? (
                            renderViewerLineList(petAcquireLines, 'border-amber-400/35')
                        ) : (
                            <p className={`${viewerBodyClass} text-slate-500`}>안내 문구가 없습니다.</p>
                        ),
                    )}
                </div>
            );
        } else if (mainTab === 'pet') {
            footer = (
                <div className="space-y-2 sm:space-y-2.5">
                    {renderPetHatchCompactSection(
                        '부화 시 성향',
                        'text-fuchsia-200/90',
                        'border-fuchsia-500/25 bg-fuchsia-950/20',
                        PAIR_PET_HATCH_DISPOSITION_ENCYCLOPEDIA_LINES,
                    )}
                    {renderPetHatchCompactSection(
                        '부화 시 특화',
                        'text-amber-200/90',
                        'border-amber-500/25 bg-amber-950/15',
                        PAIR_PET_HATCH_SPECIALIZATION_ENCYCLOPEDIA_LINES,
                    )}
                    {renderPetHatchRpsSection()}
                </div>
            );
        } else if (mainTab === 'material') {
            const usageLines =
                materialUsageLines.length > 0
                    ? materialUsageLines
                    : ['이 재료는 현재 어떤 장비 강화에도 사용되지 않습니다.'];
            footer = (
                <div className="space-y-3">
                    {renderViewerSection(
                        '사용처',
                        'text-sky-200/95',
                        renderViewerLineList(usageLines, 'border-sky-500/35'),
                    )}
                    {renderViewerSection(
                        '획득처',
                        'text-amber-200/90',
                        materialAcquireLines.length > 0 ? (
                            renderViewerLineList(materialAcquireLines, 'border-amber-400/35')
                        ) : (
                            <p className={`${viewerBodyClass} text-slate-500`}>안내 문구가 없습니다.</p>
                        ),
                    )}
                </div>
            );
        } else if (mainTab === 'consumable') {
            footer = (
                <div className="space-y-3">
                    {renderViewerSection(
                        '사용처',
                        'text-sky-200/95',
                        renderViewerLineList(consumableUsageLines, 'border-sky-500/35'),
                    )}
                    {renderViewerSection(
                        '획득처',
                        'text-amber-200/90',
                        consumableAcquireLines.length > 0 ? (
                            renderViewerLineList(consumableAcquireLines, 'border-amber-400/35')
                        ) : (
                            <p className={`${viewerBodyClass} text-slate-500`}>안내 문구가 없습니다.</p>
                        ),
                    )}
                </div>
            );
        }

        return (
            <div className={`flex flex-col ${isDenseEquipViewer ? 'gap-2 sm:gap-2.5' : 'gap-3 sm:gap-3.5'}`}>
                {headerCard}
                {footer ? (
                    <div
                        className={`min-h-0 min-w-0 border-t border-white/10 text-left ${
                            isDenseEquipViewer ? 'pt-2 sm:pt-2.5' : 'pt-3 sm:pt-3.5'
                        }`}
                    >
                        {footer}
                    </div>
                ) : null}
            </div>
        );
    };

    const shellClass = embedded
        ? 'flex h-full min-h-0 flex-col overflow-hidden'
        : 'rounded-2xl border border-amber-900/20 bg-gradient-to-b from-[#12141c] via-[#0e1016] to-[#08090e] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_48px_-24px_rgba(0,0,0,0.85)]';

    const panelShellClass = `${subPanelClass} flex min-h-0 flex-col overflow-hidden`;

    const encyclopediaBody = (
        <div className={shellClass}>
            <div
                className="mb-3 flex shrink-0 gap-1 rounded-xl border border-white/[0.06] bg-black/40 p-1 shadow-inner backdrop-blur-md sm:mb-4"
                role="tablist"
                aria-label="도감 카테고리"
            >
                {mainTabBtn('equipment', '장비')}
                {mainTabBtn('material', '재료')}
                {mainTabBtn('consumable', '소모품')}
                {mainTabBtn('pet', '펫')}
            </div>
            <div
                className={`flex min-h-0 flex-1 gap-2 overflow-hidden sm:gap-3 ${
                    embedded ? 'flex-row' : useBubbleDetail ? 'flex-col' : 'flex-col sm:flex-row'
                }`}
            >
                <div className={`${panelShellClass} min-h-0 ${listPanelWidthClass}`}>
                    {renderItemList()}
                </div>
                {!useBubbleDetail ? (
                    <div className={`${panelShellClass} min-h-0 min-w-0 flex-1`}>
                        {renderViewerPanel()}
                    </div>
                ) : null}
            </div>
        </div>
    );

    const itemBubblePortal =
        useBubbleDetail && itemBubble && bubblePlacement && typeof document !== 'undefined'
            ? createPortal(
                  <div
                      ref={bubbleContentRef}
                      data-draggable-satellite="encyclopedia"
                      role="dialog"
                      aria-label="아이템 상세"
                      className="pointer-events-auto max-h-[min(100dvh-24px,100vh-24px)] overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-xl border border-amber-400/30 bg-gradient-to-b from-[#14151c] via-black/95 to-[#0a0a10] shadow-[0_12px_48px_-8px_rgba(0,0,0,0.9),0_0_40px_-16px_rgba(251,191,36,0.22)] [-webkit-overflow-scrolling:touch]"
                      style={{
                          position: 'fixed',
                          zIndex: 100000,
                          left: bubblePlacement.left,
                          top: bubblePlacement.top,
                          width: bubblePlacement.maxW,
                          maxHeight: bubblePlacement.maxH,
                      }}
                  >
                      {bubblePlacement.placeBelow ? (
                          <div
                              className="pointer-events-none absolute -top-[7px]"
                              style={{ left: bubblePlacement.arrowOffset }}
                              aria-hidden
                          >
                              <div className="h-0 w-0 border-x-[7px] border-b-[8px] border-x-transparent border-b-amber-500/45" />
                          </div>
                      ) : (
                          <div
                              className="pointer-events-none absolute -bottom-[7px]"
                              style={{ left: bubblePlacement.arrowOffset }}
                              aria-hidden
                          >
                              <div className="h-0 w-0 border-x-[7px] border-t-[8px] border-x-transparent border-t-amber-500/45" />
                          </div>
                      )}
                      <div className="min-h-0 px-2.5 pb-3 pt-2.5 sm:px-4 sm:pb-4 sm:pt-3">
                          {renderItemDetail(itemBubble.item)}
                      </div>
                  </div>,
                  document.body,
              )
            : null;

    if (embedded) {
        return <div className={PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS}>{encyclopediaBody}</div>;
    }

    return (
        <>
            <DraggableWindow
                title="도감"
                onClose={onClose}
                windowId="encyclopedia"
                initialWidth={useBubbleDetail ? 700 : 1040}
                initialHeight={880}
                isTopmost={isTopmost}
            >
                {encyclopediaBody}
            </DraggableWindow>
            {itemBubblePortal}
        </>
    );
};

export default EncyclopediaModal;
