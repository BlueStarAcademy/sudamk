import React, { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
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
    isActionPointConsumable,
} from '../../constants';
import DraggableWindow from '../DraggableWindow.js';

interface EncyclopediaModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

type EncyclopediaItem = {
    name: string;
    description: string;
    type: InventoryItemType;
    slot: EquipmentSlot | null;
    image: string | null;
    grade: ItemGrade;
    quantity?: number;
};

const gradeBackgrounds: Record<ItemGrade, string> = {
    normal: 'images/equipments/normalbgi.png',
    uncommon: 'images/equipments/uncommonbgi.png',
    rare: 'images/equipments/rarebgi.png',
    epic: 'images/equipments/epicbgi.png',
    legendary: 'images/equipments/legendarybgi.png',
    mythic: 'images/equipments/mythicbgi.png',
    transcendent: 'images/equipments/mythicbgi.png',
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

/** 아이콘 기준 말풍선 위치 (뷰포트 안으로 클램프) */
function computeBubblePlacement(anchor: DOMRect): {
    left: number;
    top: number;
    maxW: number;
    placeBelow: boolean;
    arrowOffset: number;
} {
    const pad = 10;
    const gap = 12;
    const maxW = Math.min(520, window.innerWidth - pad * 2);
    const cx = anchor.left + anchor.width / 2;

    const rightSpace = window.innerWidth - anchor.right - pad;
    const leftSpace = anchor.left - pad;
    const placeRight = rightSpace >= maxW || rightSpace >= leftSpace;
    const preferredLeft = placeRight ? anchor.right + gap : anchor.left - maxW - gap;
    const left = Math.min(Math.max(preferredLeft, pad), window.innerWidth - maxW - pad);

    // 정확한 렌더 높이를 사전 측정하기 어렵기 때문에, 대각선 배치용 기준 높이를 사용해 상/하를 선택한다.
    const estimatedBubbleH = Math.min(420, Math.max(260, window.innerHeight * 0.42));
    const spaceBelow = window.innerHeight - anchor.bottom - pad;
    const spaceAbove = anchor.top - pad;
    const placeBelow = !(spaceAbove > spaceBelow && spaceBelow < estimatedBubbleH * 0.6);
    const arrowOffset = Math.min(Math.max(cx - left - 7, 16), maxW - 32);
    if (placeBelow) {
        const maxTop = window.innerHeight - estimatedBubbleH - pad;
        return { left, top: Math.min(anchor.bottom + gap, Math.max(pad, maxTop)), maxW, placeBelow, arrowOffset };
    }
    const top = Math.max(pad, anchor.top - estimatedBubbleH - gap);
    return { left, top, maxW, placeBelow, arrowOffset };
}

function computeBubblePlacementInModal(
    anchor: DOMRect,
    modalBounds: DOMRect,
    bubbleSize?: { height: number }
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

    /** 말풍선 상단(top)부터 모달 안쪽 하단까지 — 긴 설명은 이 높이 안에서 스크롤 */
    const edgePad = 10;
    const maxH = Math.max(120, Math.min(modalBottom - top - edgePad, modalInnerH));

    const arrowOffset = Math.min(Math.max(cx - left - 7, 16), maxW - 32);
    return { left, top, maxW, maxH, placeBelow, arrowOffset };
}

const EncyclopediaIconCell: React.FC<{
    item: EncyclopediaItem;
    bubbleOpen: boolean;
    onToggleBubble: (anchor: HTMLElement) => void;
}> = ({ item, bubbleOpen, onToggleBubble }) => (
    <button
        type="button"
        title={item.name}
        onClick={(e) => {
            e.stopPropagation();
            onToggleBubble(e.currentTarget);
        }}
        className={`group relative w-full rounded-lg p-0.5 transition-all duration-200 ${
            bubbleOpen
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

const EncyclopediaModal: React.FC<EncyclopediaModalProps> = ({ onClose, isTopmost }) => {
    type MainTab = 'equipment' | 'material' | 'consumable';

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

    /** 클릭한 아이콘 기준 말풍선 (뷰어 패널 대체) */
    const [itemBubble, setItemBubble] = useState<{ item: EncyclopediaItem; anchor: DOMRect; modalBounds: DOMRect } | null>(null);
    const bubbleContentRef = useRef<HTMLDivElement>(null);
    const [bubbleSize, setBubbleSize] = useState<{ height: number } | null>(null);

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

    /** 도감 재료 탭: 변경권 / 강화석 구분 (이름 기준) */
    const materialItemsByGroup = useMemo(() => {
        const all = Object.values(MATERIAL_ITEMS) as InventoryItem[];
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
        const all = [...CONSUMABLE_ITEMS];
        const byGrade = (a: InventoryItem, b: InventoryItem) => gradeOrder[a.grade] - gradeOrder[b.grade];
        const byName = (a: InventoryItem, b: InventoryItem) => a.name.localeCompare(b.name, 'ko');
        const pick = (pred: (i: InventoryItem) => boolean): EncyclopediaItem[] => {
            const filtered = all.filter(pred);
            return (filtered as InventoryItem[]).sort(byGrade) as EncyclopediaItem[];
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

    useEffect(() => {
        setItemBubble(null);
    }, [mainTab]);

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
        const ro = new ResizeObserver(measure);
        ro.observe(bubbleEl);
        return () => {
            ro.disconnect();
        };
    }, [itemBubble]);

    const isBubbleForItem = useCallback(
        (item: EncyclopediaItem) => !!(itemBubble && encyclopediaItemsEqual(itemBubble.item, item)),
        [itemBubble]
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
            className={`relative flex-1 overflow-hidden rounded-lg py-2.5 text-xs font-semibold tracking-wide transition-all duration-300 sm:text-sm ${
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

    /** 모달 전체를 스크롤 루트로 사용 (아이템 패널 위 휠 스크롤도 동작) */
    const listScrollClass = 'min-h-0 flex-1 px-2 py-2';

    const renderEquipmentIconGrid = () => (
        <div className={`flex min-h-0 flex-1 flex-col gap-4 ${listScrollClass}`}>
            {equipmentSlots.map((slot) => {
                const items = equipmentItemsBySlot[slot];
                if (items.length === 0) return null;
                return (
                    <div key={slot} className="min-w-0">
                        <div className="mb-2 flex items-center gap-2 border-b border-amber-500/20 pb-1.5">
                            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200/75 sm:text-xs">부위</span>
                            <h4 className="text-sm font-bold tracking-tight text-amber-100 sm:text-base">{slotNames[slot]}</h4>
                            <span className="ml-auto rounded-md bg-black/35 px-2 py-0.5 text-[10px] tabular-nums text-slate-400">{items.length}</span>
                        </div>
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(58px,1fr))] sm:gap-2.5">
                            {items.map((item) => (
                                <EncyclopediaIconCell
                                    key={encyclopediaItemKey(item)}
                                    item={item}
                                    bubbleOpen={isBubbleForItem(item)}
                                    onToggleBubble={(el) => toggleItemBubble(item, el)}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const miscIconGridClass =
        'grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(58px,1fr))] sm:gap-2.5';

    const renderMaterialIconGrid = () => {
        const { tickets, stones, other } = materialItemsByGroup;
        const sections: { key: string; title: string; items: EncyclopediaItem[] }[] = [
            { key: 'tickets', title: '변경권', items: tickets },
            { key: 'stones', title: '강화석', items: stones },
        ];
        if (other.length > 0) {
            sections.push({ key: 'other', title: '기타', items: other });
        }
        const hasAny = sections.some((s) => s.items.length > 0);

        return (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className={listScrollClass}>
                    {!hasAny ? (
                        <div className="flex h-24 items-center justify-center text-sm text-slate-500">표시할 재료가 없습니다.</div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {sections.map(({ key, title, items }) =>
                                items.length === 0 ? null : (
                                    <div key={key} className="min-w-0">
                                        <div className="mb-2 flex items-center gap-2 border-b border-amber-500/20 pb-1.5">
                                            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-amber-200/75 sm:text-xs">재료</span>
                                            <h4 className="text-sm font-bold tracking-tight text-amber-100 sm:text-base">{title}</h4>
                                            <span className="ml-auto rounded-md bg-black/35 px-2 py-0.5 text-[10px] tabular-nums text-slate-400">{items.length}</span>
                                        </div>
                                        <div className={miscIconGridClass}>
                                            {items.map((item) => (
                                                <EncyclopediaIconCell
                                                    key={encyclopediaItemKey(item)}
                                                    item={item}
                                                    bubbleOpen={isBubbleForItem(item)}
                                                    onToggleBubble={(el) => toggleItemBubble(item, el)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderConsumableIconGrid = () => {
        const hasAny = consumableItemsByCategory.some((s) => s.items.length > 0);

        return (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className={listScrollClass}>
                    {!hasAny ? (
                        <div className="flex h-24 items-center justify-center text-sm text-slate-500">표시할 소모품이 없습니다.</div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {consumableItemsByCategory.map(({ key, title, items }) =>
                                items.length === 0 ? null : (
                                    <div key={key} className="min-w-0">
                                        <div className="mb-2 flex items-center gap-2 border-b border-amber-500/20 pb-1.5">
                                            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-amber-200/75 sm:text-xs">소모품</span>
                                            <h4 className="text-sm font-bold tracking-tight text-amber-100 sm:text-base">{title}</h4>
                                            <span className="ml-auto rounded-md bg-black/35 px-2 py-0.5 text-[10px] tabular-nums text-slate-400">{items.length}</span>
                                        </div>
                                        <div className={miscIconGridClass}>
                                            {items.map((item) => (
                                                <EncyclopediaIconCell
                                                    key={encyclopediaItemKey(item)}
                                                    item={item}
                                                    bubbleOpen={isBubbleForItem(item)}
                                                    onToggleBubble={(el) => toggleItemBubble(item, el)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderEquipmentSubOptions = (item: EncyclopediaItem) => {
        if (item.type !== 'equipment' || !item.slot) return null;
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

        const sectionTitle = (text: string, accent: string) => (
            <h5 className={`text-[10px] font-extrabold leading-tight tracking-wide sm:text-sm ${accent}`}>{text}</h5>
        );

        const sectionShellClass =
            'rounded-lg border border-white/10 bg-black/25 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:px-3 sm:py-2.5';
        const optGridClass =
            'grid grid-cols-1 gap-x-2 gap-y-1 pt-1.5 text-[10px] leading-snug text-slate-300 sm:grid-cols-2 sm:gap-x-3 sm:gap-y-1.5 sm:pt-2 sm:text-sm sm:leading-relaxed';

        return (
            <div className="min-h-0 space-y-2.5">
                <div className={sectionShellClass}>
                    {sectionTitle('주옵션', 'text-amber-200/95')}
                    <p className="pt-1 text-[11px] leading-snug text-slate-300 sm:pt-1.5 sm:text-sm sm:leading-relaxed">
                        <strong className="text-amber-100">{mainStatNames}</strong>: +{mainStatValue}
                        {mainIsPercentage ? '%' : ''}
                    </p>
                </div>

                <div className={sectionShellClass}>
                    {sectionTitle(`부옵션 (랜덤 ${formatCount(rules.combatCount)}개)`, 'text-sky-200/95')}
                    <ul className={optGridClass}>
                        {combatPool.map((opt, index) => (
                            <li key={`${opt.type}-${index}`} className="min-w-0 break-words">
                                <strong className="text-sky-300">{opt.type}</strong>: +{opt.range[0]}~{opt.range[1]}
                                {opt.isPercentage ? '%' : ''}
                            </li>
                        ))}
                    </ul>
                </div>
                {hasSpecialOptions && (
                    <div className={sectionShellClass}>
                        {sectionTitle(`특수 옵션 (랜덤 ${formatCount(rules.specialCount)}개)`, 'text-emerald-200/95')}
                        <ul className={optGridClass}>
                            {Object.entries(SPECIAL_STATS_DATA).map(([key, def]) => (
                                <li key={key} className="min-w-0 break-words">
                                    <strong className="text-emerald-300">{def.name}</strong>: +{def.range[0]}~{def.range[1]}
                                    {def.isPercentage ? '%' : ''}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {hasMythic && (
                    <div className={sectionShellClass}>
                        {sectionTitle(`신화 옵션 (랜덤 ${formatCount(rules.mythicCount)}개)`, 'text-rose-200/95')}
                        <ul className={optGridClass}>
                            {Object.values(MythicStat).map((stat) => {
                                const data = MYTHIC_STATS_DATA[stat];
                                return (
                                    <li key={stat} className="min-w-0 break-words">
                                        <span
                                            className="inline cursor-help border-b border-dotted border-rose-400/35 decoration-rose-400/40 underline-offset-2"
                                            title={data.description}
                                        >
                                            <strong className="text-rose-300">{data.abbrevLabel}</strong>
                                            <span className="text-rose-200/90"> · {data.shortDescription}</span>
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>
        );
    };

    const renderItemBubbleInner = (item: EncyclopediaItem) => {
        const isEquipmentDetail = item.type === 'equipment' && item.slot;

        if (mainTab === 'equipment' && isEquipmentDetail) {
            return (
                <div className="flex flex-col gap-2.5 sm:gap-3.5">
                    <div className="rounded-xl border border-amber-300/25 bg-gradient-to-r from-amber-950/20 via-white/[0.02] to-indigo-950/25 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-3">
                        <div className="flex items-start gap-2 sm:gap-3">
                            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg ring-2 ring-amber-400/30 shadow-lg sm:h-16 sm:w-16">
                                <img src={gradeBackgrounds[item.grade]} alt="" className="absolute inset-0 h-full w-full object-cover" />
                                {item.image ? (
                                    <img
                                        src={item.image}
                                        alt=""
                                        className="absolute object-contain"
                                        style={{
                                            width: '80%',
                                            height: '80%',
                                            left: '50%',
                                            top: '50%',
                                            transform: 'translate(-50%, -50%)',
                                        }}
                                    />
                                ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className={`line-clamp-2 text-sm font-black leading-tight sm:truncate sm:text-base sm:leading-tight lg:text-lg ${gradeStyles[item.grade].color}`}>
                                    {item.name}
                                </h3>
                                <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] sm:gap-1.5 sm:text-xs">
                                    <span className="rounded-full border border-white/15 bg-black/35 px-2 py-0.5 text-slate-100">
                                        {slotNames[item.slot]}
                                    </span>
                                    <span
                                        className={`rounded-full border px-2 py-0.5 ${
                                            item.grade === 'mythic'
                                                ? 'border-amber-300/40 bg-amber-300/15 text-amber-100'
                                                : item.grade === 'transcendent'
                                                  ? 'border-cyan-300/40 bg-cyan-300/15 text-cyan-100'
                                                  : 'border-white/15 bg-white/5 text-slate-200'
                                        }`}
                                    >
                                        {gradeStyles[item.grade].name}
                                    </span>
                                    <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2 py-0.5 text-emerald-200/90">
                                        착용 레벨 합 {GRADE_LEVEL_REQUIREMENTS[item.grade]}
                                    </span>
                                </div>
                                <p className="mt-1.5 rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-[11px] leading-snug text-slate-300 sm:mt-2 sm:px-2.5 sm:py-2 sm:text-sm sm:leading-relaxed">
                                    {item.description}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="min-h-0 min-w-0 flex-1 pr-0.5 text-left">
                        {renderEquipmentSubOptions(item)}
                    </div>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center">
                <div className="relative h-20 w-20 overflow-hidden rounded-xl ring-2 ring-amber-400/25 shadow-lg sm:h-28 sm:w-28">
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
                                padding: '10%',
                                left: '50%',
                                top: '50%',
                                transform: 'translate(-50%, -50%)',
                            }}
                        />
                    ) : null}
                </div>
                <h3 className={`mt-2 text-center text-base font-black leading-snug tracking-tight sm:mt-3 sm:text-xl ${gradeStyles[item.grade].color}`}>
                    {item.name}
                </h3>
                <p
                    className={`mt-0.5 text-center text-[11px] sm:mt-1 sm:text-sm ${
                        item.type === 'equipment' ? gradeStyles[item.grade].color : 'text-slate-400'
                    }`}
                >
                    {item.type === 'equipment'
                        ? `${gradeStyles[item.grade].name} · ${item.slot ? slotNames[item.slot] : ''}`
                        : mainTab === 'material'
                          ? '재료'
                          : '소모품'}
                </p>
                {item.type === 'equipment' && (
                    <p className="mt-0.5 text-center text-[10px] text-slate-500 sm:mt-1 sm:text-[11px]">{`착용 레벨 합: ${GRADE_LEVEL_REQUIREMENTS[item.grade]}`}</p>
                )}
                <p className="mt-2 w-full border-t border-white/10 pt-2 text-left text-[11px] leading-snug text-slate-300 sm:mt-3 sm:pt-3 sm:text-center sm:text-base sm:leading-relaxed">
                    {item.description}
                </p>
            </div>
        );
    };

    const shellClass =
        'rounded-2xl border border-amber-900/20 bg-gradient-to-b from-[#12141c] via-[#0e1016] to-[#08090e] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_48px_-24px_rgba(0,0,0,0.85)]';

    const leftPanelShellClass = `${subPanelClass} flex min-h-0 w-full min-w-0 flex-1 flex-col`;

    const renderLeftPanel = () => {
        if (mainTab === 'equipment') {
            return (
                <div className={leftPanelShellClass}>
                    {renderEquipmentIconGrid()}
                </div>
            );
        }
        if (mainTab === 'material') {
            return (
                <div className={leftPanelShellClass}>
                    {renderMaterialIconGrid()}
                </div>
            );
        }
        return (
            <div className={leftPanelShellClass}>
                {renderConsumableIconGrid()}
            </div>
        );
    };

    return (
        <DraggableWindow
            title="도감"
            onClose={onClose}
            windowId="encyclopedia"
            initialWidth={700}
            initialHeight={880}
            isTopmost={isTopmost}
        >
            <div className={shellClass}>
                <div
                    className="mb-4 flex flex-shrink-0 gap-1 rounded-xl border border-white/[0.06] bg-black/40 p-1 shadow-inner backdrop-blur-md"
                    role="tablist"
                    aria-label="도감 카테고리"
                >
                    {mainTabBtn('equipment', '장비')}
                    {mainTabBtn('material', '재료')}
                    {mainTabBtn('consumable', '소모품')}
                </div>
                <div className="flex min-h-0 flex-col">{renderLeftPanel()}</div>
            </div>
            {itemBubble && bubblePlacement &&
                createPortal(
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
                            {renderItemBubbleInner(itemBubble.item)}
                        </div>
                    </div>,
                    document.body
                )}
        </DraggableWindow>
    );
};

export default EncyclopediaModal;
