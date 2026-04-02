import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { InventoryItem, InventoryItemType, EquipmentSlot, ItemGrade, MythicStat } from '../../types.js';
import { EQUIPMENT_POOL, MATERIAL_ITEMS, CONSUMABLE_ITEMS, GRADE_SUB_OPTION_RULES, MAIN_STAT_DEFINITIONS, SUB_OPTION_POOLS, SPECIAL_STATS_DATA, MYTHIC_STATS_DATA, GRADE_LEVEL_REQUIREMENTS } from '../../constants';
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

const EncyclopediaModal: React.FC<EncyclopediaModalProps> = ({ onClose, isTopmost }) => {
    type MainTab = 'equipment' | 'material' | 'consumable' | 'help';
    type ConsumableCategory = '골드꾸러미' | '다이아꾸러미' | '장비상자' | '재료상자';

    const [mainTab, setMainTab] = useState<MainTab>('equipment');

    const equipmentSlots: EquipmentSlot[] = ['fan', 'board', 'top', 'bottom', 'bowl', 'stones'];
    const slotNames: Record<EquipmentSlot, string> = { fan: '부채', board: '바둑판', top: '상의', bottom: '하의', bowl: '바둑통', stones: '바둑돌' };
    const consumableCategories: { id: ConsumableCategory; name: string }[] = [
        { id: '장비상자', name: '장비상자' },
        { id: '재료상자', name: '재료상자' },
        { id: '골드꾸러미', name: '골드꾸러미' },
        { id: '다이아꾸러미', name: '다이아꾸러미' },
    ];
    const gradeStyles: Record<ItemGrade, { name: string; color: string }> = {
        normal: { name: '일반', color: 'text-slate-300' },
        uncommon: { name: '고급', color: 'text-emerald-300' },
        rare: { name: '희귀', color: 'text-sky-300' },
        epic: { name: '에픽', color: 'text-violet-300' },
        legendary: { name: '전설', color: 'text-rose-300' },
        mythic: { name: '신화', color: 'text-amber-200' },
        transcendent: { name: '초월', color: 'text-cyan-200' },
    };

    const [activeEquipmentSlot, setActiveEquipmentSlot] = useState<EquipmentSlot>('fan');
    const [selectedItem, setSelectedItem] = useState<EncyclopediaItem | null>(null);
    const [activeConsumableCategory, setActiveConsumableCategory] = useState<ConsumableCategory>('장비상자');

    const itemsForTab = useMemo<EncyclopediaItem[]>(() => {
        if (mainTab === 'equipment') {
            return EQUIPMENT_POOL.filter((item) => item.slot === activeEquipmentSlot).sort((a, b) => gradeOrder[a.grade] - gradeOrder[b.grade]);
        }
        if (mainTab === 'material') {
            return (Object.values(MATERIAL_ITEMS) as InventoryItem[]).sort((a, b) => gradeOrder[a.grade] - gradeOrder[b.grade]);
        }
        if (mainTab === 'consumable') {
            const keywordMap: Record<ConsumableCategory, string> = {
                골드꾸러미: '골드 꾸러미',
                다이아꾸러미: '다이아 꾸러미',
                장비상자: '장비 상자',
                재료상자: '재료 상자',
            };
            const keyword = keywordMap[activeConsumableCategory];
            return [...CONSUMABLE_ITEMS].filter((item) => item.name.includes(keyword)).sort((a, b) => a.name.localeCompare(b.name));
        }
        return [];
    }, [mainTab, activeEquipmentSlot, activeConsumableCategory]);

    useEffect(() => {
        if (mainTab === 'help') {
            setSelectedItem(null);
            return;
        }
        setSelectedItem((prev) => {
            if (itemsForTab.length === 0) return null;
            if (prev && itemsForTab.some((item) => encyclopediaItemsEqual(prev, item))) return prev;
            return itemsForTab[0];
        });
    }, [mainTab, itemsForTab]);

    const isItemSelected = useCallback(
        (item: EncyclopediaItem) => !!(selectedItem && encyclopediaItemsEqual(selectedItem, item)),
        [selectedItem]
    );

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

    const subNavBtn = (active: boolean, onClick: () => void, label: string, key: string) => (
        <button
            type="button"
            key={key}
            onClick={onClick}
            className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs transition-all md:w-full md:px-4 md:py-2 md:text-left md:text-sm ${
                active
                    ? 'bg-gradient-to-r from-amber-600/40 to-amber-800/30 text-amber-100 ring-1 ring-amber-400/30 shadow-[0_0_16px_-6px_rgba(251,191,36,0.4)]'
                    : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
            }`}
        >
            {label}
        </button>
    );

    const renderEquipmentSubOptions = () => {
        if (!selectedItem || selectedItem.type !== 'equipment' || !selectedItem.slot) return null;
        const rules = GRADE_SUB_OPTION_RULES[selectedItem.grade];
        const formatCount = (count: [number, number]) => (count[0] === count[1] ? `${count[0]}` : `${count[0]}~${count[1]}`);
        const hasMythic = rules.mythicCount[0] > 0;
        const combatPool = SUB_OPTION_POOLS[selectedItem.slot]?.[rules.combatTier] || [];

        const mainStatDef = MAIN_STAT_DEFINITIONS[selectedItem.slot];
        const mainStatGradeDef = mainStatDef.options[selectedItem.grade];
        const mainStatValue = mainStatGradeDef.value;
        const mainIsPercentage = mainStatDef.isPercentage;
        const mainStatNames = mainStatGradeDef.stats.join(' 또는 ');

        const sectionTitle = (text: string, accent: string) => (
            <h5
                className={`mt-3 border-b border-white/10 pb-1.5 text-xs font-semibold tracking-wide md:text-sm ${accent}`}
            >
                {text}
            </h5>
        );

        return (
            <>
                {sectionTitle('주옵션', 'text-amber-200/95')}
                <p className="py-1.5 text-[11px] leading-relaxed text-slate-300 md:text-xs">
                    <strong className="text-amber-100">{mainStatNames}</strong>: +{mainStatValue}
                    {mainIsPercentage ? '%' : ''}
                </p>

                {sectionTitle(`부옵션 (랜덤 ${formatCount(rules.combatCount)}개)`, 'text-sky-200/90')}
                <ul className="space-y-1 pt-1 text-[10px] text-slate-300 md:text-xs">
                    {combatPool.map((opt, index) => (
                        <li key={`${opt.type}-${index}`}>
                            <strong className="text-sky-300">{opt.type}</strong>: +{opt.range[0]}~{opt.range[1]}
                            {opt.isPercentage ? '%' : ''}
                        </li>
                    ))}
                </ul>

                {sectionTitle(`특수 옵션 (랜덤 ${formatCount(rules.specialCount)}개)`, 'text-emerald-200/90')}
                <ul className="space-y-1 pt-1 text-[10px] text-slate-300 md:text-xs">
                    {Object.entries(SPECIAL_STATS_DATA).map(([key, def]) => (
                        <li key={key}>
                            <strong className="text-emerald-300">{def.name}</strong>: +{def.range[0]}~{def.range[1]}
                            {def.isPercentage ? '%' : ''}
                        </li>
                    ))}
                </ul>
                {hasMythic && (
                    <>
                        {sectionTitle(`신화 옵션 (랜덤 ${formatCount(rules.mythicCount)}개)`, 'text-rose-200/90')}
                        <ul className="space-y-1 pt-1 text-[10px] text-slate-300 md:text-xs">
                            {Object.values(MythicStat).map((stat) => {
                                const data = MYTHIC_STATS_DATA[stat];
                                return (
                                    <li key={stat}>
                                        <strong className="text-rose-300">{data.name}</strong>: {data.description}
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
            </>
        );
    };

    const renderHelpContent = () => (
        <div className="h-full space-y-6 overflow-y-auto pr-2 text-left text-slate-300">
            <h3 className="bg-gradient-to-r from-amber-100 via-amber-200 to-amber-100 bg-clip-text text-center text-xl font-bold tracking-tight text-transparent md:text-2xl">
                도감 도움말 및 업데이트 내역
            </h3>
            <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4">
                <h4 className="mb-2 border-b border-emerald-500/25 pb-2 text-sm font-semibold text-emerald-200/95 md:text-base">최근 업데이트</h4>
                <ul className="list-inside list-disc space-y-1.5 text-xs md:text-sm">
                    <li>장비 주옵션 강화 보너스 규칙이 변경되었습니다. (+4, +7, +10 강화 시 2배 보너스)</li>
                    <li>소모품 탭의 아이템 정렬 방식이 종류별로 개선되었습니다.</li>
                </ul>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4">
                <h4 className="mb-2 border-b border-sky-500/25 pb-2 text-sm font-semibold text-sky-200/95 md:text-base">도감 사용법</h4>
                <ul className="list-inside list-disc space-y-2 text-xs md:text-sm">
                    <li>이 도감에서는 게임 내 모든 장비, 재료, 소모품의 상세 정보를 확인할 수 있습니다.</li>
                    <li>
                        <strong className="text-amber-100">장비 탭:</strong> 각 부위별 장비의 등급에 따른 획득 가능 옵션과 능력치 범위를 볼 수 있습니다. 강화 규칙과 부옵션 획득 규칙도 확인
                        가능합니다.
                    </li>
                    <li>
                        <strong className="text-amber-100">재료/소모품 탭:</strong> 각 아이템의 설명과 등급을 확인할 수 있습니다.
                    </li>
                    <li>
                        <strong className="text-amber-100">도움말 탭:</strong> 새로운 업데이트나 주요 변경사항이 있을 때마다 이곳에서 안내해 드립니다.
                    </li>
                </ul>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4">
                <h4 className="mb-2 border-b border-violet-500/25 pb-2 text-sm font-semibold text-violet-200/95 md:text-base">장비 옵션 상세</h4>
                <div className="space-y-3 text-xs md:text-sm">
                    <div>
                        <h5 className="font-semibold text-amber-100">주옵션</h5>
                        <p className="mt-1 pl-1 text-[11px] leading-relaxed text-slate-400 md:text-xs">
                            1강화마다 획득 시 부여되는 수치만큼 추가됩니다. 별 색상이 은색에서 금색(+4), 금색에서 푸른색(+7), 푸른색에서 프리즘색(+10)이 될 때 각각 2배로 강화됩니다.
                        </p>
                    </div>
                    <div>
                        <h5 className="font-semibold text-sky-200">부옵션</h5>
                        <p className="mt-1 pl-1 text-[11px] leading-relaxed text-slate-400 md:text-xs">
                            최대 4개까지 부여됩니다. 1강화마다 부옵션이 4개가 될 때까지 우선적으로 추가된 후, 4개가 모두 채워지면 기존 부옵션 중 하나가 랜덤하게 강화됩니다.
                        </p>
                    </div>
                    <div>
                        <h5 className="font-semibold text-emerald-200">특수 옵션 & 신화 옵션</h5>
                        <p className="mt-1 pl-1 text-[11px] leading-relaxed text-slate-400 md:text-xs">
                            강화되지 않는 고유한 고정 옵션입니다. 신화 등급 장비에서만 신화 옵션이 등장합니다.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    const layoutClasses = 'flex-row';

    const shellClass =
        'rounded-2xl border border-amber-900/20 bg-gradient-to-b from-[#12141c] via-[#0e1016] to-[#08090e] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_48px_-24px_rgba(0,0,0,0.85)]';

    return (
        <DraggableWindow title="도감" onClose={onClose} windowId="encyclopedia" initialWidth={920} isTopmost={isTopmost}>
            <div className={shellClass}>
                <div
                    className="mb-4 flex flex-shrink-0 gap-1 rounded-xl border border-white/[0.06] bg-black/40 p-1 shadow-inner backdrop-blur-md"
                    role="tablist"
                    aria-label="도감 카테고리"
                >
                    {mainTabBtn('equipment', '장비')}
                    {mainTabBtn('material', '재료')}
                    {mainTabBtn('consumable', '소모품')}
                    {mainTabBtn('help', '도움말')}
                </div>

                {mainTab === 'help' ? (
                    <div className="h-[calc(var(--vh,1vh)*65)] rounded-xl border border-white/[0.06] bg-black/30 p-4">{renderHelpContent()}</div>
                ) : (
                    <div className={`flex gap-4 h-[calc(var(--vh,1vh)*65)] ${layoutClasses}`}>
                        <div className="flex h-full w-1/2 flex-col gap-3">
                            {mainTab === 'consumable' && (
                                <div className={subPanelClass}>
                                    <h3 className="mb-2 hidden text-xs font-bold uppercase tracking-[0.2em] text-amber-200/70 md:block">종류</h3>
                                    <div className="flex flex-row gap-2 overflow-x-auto pb-1 scrollbar-thin md:flex-col md:overflow-y-auto md:overflow-x-hidden md:pb-0">
                                        {consumableCategories.map((cat) =>
                                            subNavBtn(activeConsumableCategory === cat.id, () => setActiveConsumableCategory(cat.id), cat.name, cat.id)
                                        )}
                                    </div>
                                </div>
                            )}
                            {mainTab === 'equipment' && (
                                <div className={subPanelClass}>
                                    <h3 className="mb-2 hidden text-xs font-bold uppercase tracking-[0.2em] text-amber-200/70 md:block">부위</h3>
                                    <div className="flex flex-row gap-2 overflow-x-auto pb-1 scrollbar-thin md:flex-col md:overflow-y-auto md:overflow-x-hidden md:pb-0">
                                        {equipmentSlots.map((slot) =>
                                            subNavBtn(activeEquipmentSlot === slot, () => setActiveEquipmentSlot(slot), slotNames[slot], slot)
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className={`${subPanelClass} flex min-h-0 flex-grow flex-col`}>
                                <h3 className="mb-2 flex-shrink-0 text-sm font-bold text-slate-100 md:text-base">아이템 목록</h3>
                                <div className="flex flex-grow flex-col space-y-1 overflow-y-auto pr-1 scrollbar-thin">
                                    {itemsForTab.map((item) => {
                                        const selected = isItemSelected(item);
                                        return (
                                            <button
                                                key={encyclopediaItemKey(item)}
                                                type="button"
                                                onClick={() => setSelectedItem(item)}
                                                className={`flex w-full items-center gap-2.5 rounded-lg p-2 text-left text-sm transition-all ${
                                                    selected
                                                        ? 'bg-gradient-to-r from-amber-900/45 to-amber-950/30 ring-1 ring-amber-400/35 shadow-[0_0_20px_-8px_rgba(251,191,36,0.35)]'
                                                        : 'hover:bg-white/[0.05]'
                                                }`}
                                            >
                                                <div className="relative h-9 w-9 flex-shrink-0">
                                                    <img
                                                        src={gradeBackgrounds[item.grade]}
                                                        alt=""
                                                        className="absolute inset-0 h-full w-full rounded-md object-cover ring-1 ring-black/40"
                                                    />
                                                    {item.image && (
                                                        <img
                                                            src={item.image}
                                                            alt=""
                                                            className="absolute object-contain p-0.5"
                                                            style={{ width: '80%', height: '80%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                                                        />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <span className={`block truncate font-medium ${gradeStyles[item.grade].color}`}>{item.name}</span>
                                                    {item.type === 'equipment' && (
                                                        <span className="text-[10px] text-slate-500">{gradeStyles[item.grade].name}</span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div
                            className={`flex min-h-0 w-1/2 flex-col items-center rounded-xl border border-amber-500/15 bg-gradient-to-b from-slate-950/90 via-black/60 to-slate-950/95 p-3 shadow-[inset_0_0_40px_-20px_rgba(251,191,36,0.12)] md:p-4`}
                        >
                            {selectedItem ? (
                                <>
                                    <div
                                        className={`relative flex-shrink-0 rounded-xl ring-1 ring-amber-400/20 shadow-[0_0_32px_-8px_rgba(251,191,36,0.25)] ${
                                            mainTab === 'equipment' ? 'h-24 w-24 md:h-40 md:w-40' : 'h-28 w-28 md:h-40 md:w-40'
                                        }`}
                                    >
                                        <img
                                            src={gradeBackgrounds[selectedItem.grade]}
                                            alt=""
                                            className="absolute inset-0 h-full w-full rounded-xl object-cover"
                                        />
                                        {selectedItem.image && (
                                            <img
                                                src={selectedItem.image}
                                                alt=""
                                                className="absolute object-contain"
                                                style={{
                                                    width: '80%',
                                                    height: '80%',
                                                    padding: '15%',
                                                    left: '50%',
                                                    top: '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                }}
                                            />
                                        )}
                                    </div>
                                    <h3
                                        className={`mt-3 text-center font-bold md:mt-4 ${gradeStyles[selectedItem.grade].color} ${
                                            mainTab === 'equipment' ? 'text-base md:text-2xl' : 'text-lg md:text-2xl'
                                        }`}
                                    >
                                        {selectedItem.name}
                                    </h3>
                                    <p
                                        className={`mt-0.5 text-center text-xs md:text-sm ${
                                            selectedItem.type === 'equipment' ? gradeStyles[selectedItem.grade].color : 'text-slate-400'
                                        }`}
                                    >
                                        {selectedItem.type === 'equipment'
                                            ? `[${gradeStyles[selectedItem.grade].name}] ${selectedItem.slot ? slotNames[selectedItem.slot] : ''}`
                                            : mainTab === 'material'
                                              ? '재료'
                                              : '소모품'}
                                    </p>
                                    {selectedItem.type === 'equipment' && (
                                        <p className="mt-1 text-[10px] text-slate-500 md:text-xs">{`착용 레벨 합: ${GRADE_LEVEL_REQUIREMENTS[selectedItem.grade]}`}</p>
                                    )}
                                    <div className="mt-3 min-h-0 w-full flex-grow overflow-y-auto border-t border-white/10 pt-3 pr-1 scrollbar-thin">
                                        {selectedItem.type === 'equipment' && renderEquipmentSubOptions()}
                                        {selectedItem.type !== 'equipment' && (
                                            <p className="py-2 text-center text-xs leading-relaxed text-slate-300 md:text-sm">{selectedItem.description}</p>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="flex h-full items-center justify-center text-slate-500">
                                    <p className="text-sm">아이템을 선택하세요.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </DraggableWindow>
    );
};

export default EncyclopediaModal;
