import React from 'react';
import { CoreStat, EquipmentSlot, InventoryItem, ItemGrade } from '../types.js';
import { CORE_STATS_DATA, emptySlotImages, GRADE_LEVEL_REQUIREMENTS } from '../constants';
import Button from './Button.js';
import { BADUK_ABILITY_STAT_CAP, CORE_STAT_RADAR_ORDER } from './CoreStatsHexagonChart.js';

const gradeBackgrounds: Record<string, string> = {
    normal: '/images/equipments/normalbgi.png',
    uncommon: '/images/equipments/uncommonbgi.png',
    rare: '/images/equipments/rarebgi.png',
    epic: '/images/equipments/epicbgi.png',
    legendary: '/images/equipments/legendarybgi.png',
    mythic: '/images/equipments/mythicbgi.png',
    transcendent: '/images/equipments/transcendentbgi.webp',
};

const getStarDisplayInfo = (stars: number) => {
    if (stars >= 10) {
        return { text: `(★${stars})`, colorClass: 'prism-text-effect' };
    }
    if (stars >= 7) {
        return { text: `(★${stars})`, colorClass: 'text-purple-400' };
    }
    if (stars >= 4) {
        return { text: `(★${stars})`, colorClass: 'text-amber-400' };
    }
    if (stars >= 1) {
        return { text: `(★${stars})`, colorClass: 'text-white' };
    }
    return { text: '', colorClass: 'text-white' };
};

/** Profile 홈(네이티브·홈 탭·좌측 통합 스택)과 동일 슬롯 렌더링 */
const EquipmentSlotDisplay: React.FC<{
    slot: EquipmentSlot;
    item?: InventoryItem;
    onClick?: () => void;
    scaleFactor?: number;
    compact?: boolean;
}> = ({ slot, item, onClick, compact = false, scaleFactor = 1 }) => {
    const clickableClass = item && onClick ? 'cursor-pointer hover:scale-105 transition-transform' : '';
    const itemImgPct = Math.min(96, (compact ? 78 : 86) * scaleFactor);

    if (item) {
        const requiredLevel = GRADE_LEVEL_REQUIREMENTS[item.grade];
        const titleText = `${item.name} (착용 레벨 합: ${requiredLevel}) - 클릭하여 상세보기`;
        const starInfo = getStarDisplayInfo(item.stars);
        const isTranscendent = item.grade === ItemGrade.Transcendent;
        return (
            <div
                className={`relative aspect-square w-full rounded-lg border-2 border-color/50 bg-tertiary/50 p-0.5 ${clickableClass} ${isTranscendent ? 'transcendent-grade-slot' : ''}`}
                title={titleText}
                onClick={onClick}
            >
                <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 h-full w-full rounded-md object-cover" />
                {item.stars > 0 && (
                    <div
                        className={`absolute z-10 rounded-md border border-white/10 bg-black/55 font-bold backdrop-blur-[1px] ${
                            compact ? 'right-1 top-1 px-1 py-0.5 text-[10px]' : 'right-1.5 top-1.5 px-1.5 py-0.5 text-sm'
                        } ${starInfo.colorClass}`}
                        style={{ textShadow: '1px 1px 2px black' }}
                    >
                        ★{item.stars}
                    </div>
                )}
                {item.image && (
                    <img
                        src={item.image}
                        alt={item.name}
                        className={`absolute object-contain ${compact ? 'p-1' : 'p-1.5'}`}
                        style={{
                            width: `${itemImgPct}%`,
                            height: `${itemImgPct}%`,
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                        }}
                    />
                )}
            </div>
        );
    }
    if (compact) {
        return (
            <div className="relative flex aspect-square w-full items-center justify-center rounded-lg border-2 border-color/50 bg-tertiary/50 p-0.5">
                <img src={emptySlotImages[slot]} alt={`${slot} empty slot`} className="max-h-[94%] max-w-[94%] rounded-md object-contain" />
            </div>
        );
    }
    return (
        <img
            src={emptySlotImages[slot]}
            alt={`${slot} empty slot`}
            className="aspect-square w-full rounded-lg border-2 border-color/50 bg-tertiary/50"
        />
    );
};

/** 챔피언십 실전 KATA 가중 합산 점수(로비·경기장 패널과 동일 공식) */
export type ChampionshipPhaseAbilityScores = {
    opening: number;
    midgame: number;
    endgame: number;
};

export interface HomeNativeMergedEquipmentAbilityPanelProps {
    equippedItems: InventoryItem[];
    presets: Array<{ name: string }> | undefined;
    selectedPreset: number;
    onPresetChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
    onOpenEquipmentEffects: () => void;
    onOpenStatAllocation: () => void;
    onViewEquippedItem: (item: InventoryItem) => void;
    finalByStat: Record<CoreStat, number>;
    baseByStat: Record<CoreStat, number>;
    badukAbilityTotal: number;
    availablePoints: number;
    /** 바깥 rounded border 패널 (챔피언십 로비 등) */
    framed?: boolean;
    /** false면 PC 프로필 홈 통합 스택과 동일(네이티브 홈보다 여유 있는 크기) */
    compactLayout?: boolean;
    /** 챔피언십 로비: 장비·6스탯 하단에 초반/중반/종반 가중 능력치 점수 */
    championshipPhaseAbilityScores?: ChampionshipPhaseAbilityScores;
}

/**
 * 네이티브 홈 좌측 통합 스택의「바둑능력 배너 + 장비(3×2·프리셋) + 6가지 능력치 그리드」와 동일 UI.
 * (Profile `HomeMergedUserStackContent` 중 `border-t` 블록과 동일 구조·클래스)
 */
const HomeNativeMergedEquipmentAbilityPanel: React.FC<HomeNativeMergedEquipmentAbilityPanelProps> = ({
    equippedItems,
    presets,
    selectedPreset,
    onPresetChange,
    onOpenEquipmentEffects,
    onOpenStatAllocation,
    onViewEquippedItem,
    finalByStat,
    baseByStat,
    badukAbilityTotal,
    availablePoints,
    framed = false,
    compactLayout = true,
    championshipPhaseAbilityScores,
}) => {
    const ch = compactLayout;
    const getItemForSlot = (slot: EquipmentSlot) => equippedItems.find((it) => it.slot === slot);

    const mergeEquipScale = ch ? 0.82 : 1.18;
    const homeEquipGrid = ch
        ? 'grid w-full grid-cols-3 gap-x-1 gap-y-0.5 auto-rows-auto sm:gap-x-1.5 sm:gap-y-1'
        : 'grid w-full grid-cols-3 gap-1.5 auto-rows-auto sm:gap-2';
    const mergeSlotCapClass = ch ? 'mx-auto w-full max-w-[min(100%,4.55rem)]' : 'w-full';

    const equipmentBlock = (
        <div className="flex min-h-0 w-full flex-col items-stretch gap-1 overflow-x-hidden overflow-y-visible">
            <div className={`${homeEquipGrid} min-w-0`}>
                {(['fan', 'top', 'bottom', 'board', 'bowl', 'stones'] as EquipmentSlot[]).map((slot) => {
                    const item = getItemForSlot(slot);
                    return (
                        <div key={slot} className="flex w-full items-center justify-center">
                            <div className={mergeSlotCapClass}>
                                <EquipmentSlotDisplay
                                    slot={slot}
                                    item={item}
                                    onClick={() => item && onViewEquippedItem(item)}
                                    scaleFactor={mergeEquipScale}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="relative z-20 flex w-full min-w-0 flex-row items-stretch gap-1.5 overflow-visible border-t border-amber-500/25 px-0.5 pt-1.5">
                <select
                    value={selectedPreset}
                    onChange={onPresetChange}
                    className="min-h-[26px] min-w-0 flex-1 rounded-md border border-color bg-secondary px-1.5 py-0.5 text-[11px] shadow-sm focus:border-accent focus:ring-1 focus:ring-accent sm:min-h-[28px] sm:text-xs"
                    title={presets?.[selectedPreset]?.name}
                >
                    {presets &&
                        presets.map((preset, index) => (
                            <option key={index} value={index}>
                                {preset.name}
                            </option>
                        ))}
                </select>
                <Button
                    onClick={onOpenEquipmentEffects}
                    colorScheme="none"
                    className={`!shrink-0 !whitespace-nowrap !justify-center rounded-md border border-indigo-400/50 bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white ${ch ? '!px-1.5 !py-0.5 !text-[10px] sm:!text-[11px]' : '!px-2 !py-0.5 !text-[10px] sm:!text-xs'}`}
                >
                    장비 효과
                </Button>
            </div>
        </div>
    );

    const bannerBlock = (
        <div
            className={`relative w-full shrink-0 rounded-xl border border-amber-600/45 bg-gradient-to-r from-zinc-800 via-zinc-900 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ${
                ch ? 'px-1.5 py-1 sm:px-2 sm:py-1.5' : 'px-2 py-1.5 sm:px-2.5 sm:py-2'
            }`}
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" aria-hidden />
            <div className={`relative flex min-w-0 flex-nowrap items-center justify-between ${ch ? 'gap-1' : 'gap-1.5'}`}>
                <div className={`flex min-w-0 items-baseline ${ch ? 'gap-1 sm:gap-1.5' : 'gap-1.5 sm:gap-2'}`}>
                    <span
                        className={`shrink-0 bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200/90 bg-clip-text font-bold tracking-tight text-transparent drop-shadow-[0_0_20px_rgba(251,191,36,0.22)] ${
                            ch ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
                        }`}
                        title="6개 핵심 능력치 합계"
                    >
                        바둑능력
                    </span>
                    <span
                        className={`min-w-0 font-mono font-black tabular-nums leading-none text-amber-100 drop-shadow-[0_1px_0_rgba(0,0,0,0.35)] ${
                            ch ? 'text-lg sm:text-xl' : 'text-2xl sm:text-[1.75rem]'
                        }`}
                        title="6개 핵심 능력치 합계"
                    >
                        {badukAbilityTotal}
                    </span>
                </div>
                <div className={`flex shrink-0 items-center ${ch ? 'gap-1 sm:gap-1.5' : 'gap-1.5 sm:gap-2'}`}>
                    <span
                        className={`whitespace-nowrap font-medium text-amber-100/90 ${ch ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'}`}
                        title={`보너스: ${availablePoints}P`}
                    >
                        보너스 <span className="font-bold tabular-nums text-emerald-300">{availablePoints}</span>
                        <span className="text-amber-100/50">P</span>
                    </span>
                    <Button
                        onClick={onOpenStatAllocation}
                        colorScheme="none"
                        className={`!shrink-0 !whitespace-nowrap !rounded-lg !border-2 !border-cyan-300/65 !bg-gradient-to-r !from-indigo-500 !via-violet-500 !to-fuchsia-500 !font-bold !text-white !shadow-[0_10px_26px_-10px_rgba(99,102,241,0.75)] hover:!brightness-110 ${
                            ch
                                ? '!px-2 !py-1 !text-[11px] sm:!px-2.5 sm:!py-1 sm:!text-xs'
                                : '!px-3 !py-1.5 !text-xs sm:!px-3.5 sm:!py-1.5 sm:!text-sm'
                        }`}
                    >
                        분배
                    </Button>
                </div>
            </div>
        </div>
    );

    const coreStatsGrid = (
        <div className={`grid w-full min-w-0 shrink-0 grid-cols-1 ${ch ? 'gap-0.5 sm:gap-1' : 'gap-1 sm:gap-1.5'}`}>
            {CORE_STAT_RADAR_ORDER.map((stat) => {
                const cap = BADUK_ABILITY_STAT_CAP;
                const finalV = Number(finalByStat[stat]);
                const safeFinal = Number.isFinite(finalV) ? finalV : 0;
                const v = Math.min(cap, Math.max(0, Math.floor(safeFinal)));
                const baseV = baseByStat[stat] ?? 0;
                const bonus = safeFinal - baseV;
                const bonusRounded = Math.round(bonus);
                const hasBonus = bonusRounded > 0;
                const label = CORE_STATS_DATA[stat]?.name ?? stat;
                const statLabelClass =
                    'max-w-[58%] truncate text-left text-[11px] font-semibold leading-snug text-slate-300 sm:text-xs';
                const statValueClass = 'font-mono text-xs font-bold tabular-nums text-amber-100 sm:text-sm';
                const statBonusClass = ch
                    ? 'shrink-0 font-mono text-[10px] font-semibold tabular-nums text-emerald-400/95 sm:text-[11px]'
                    : 'shrink-0 font-mono text-[10px] font-semibold tabular-nums text-emerald-400/95 sm:text-xs';
                return (
                    <div
                        key={stat}
                        className={
                            ch
                                ? 'flex min-w-0 flex-row items-center justify-between gap-1 rounded-md border border-white/10 bg-black/30 px-1 py-0.5 sm:px-1.5 sm:py-1'
                                : 'flex min-w-0 flex-row items-center justify-between gap-1.5 rounded-md border border-white/10 bg-black/30 px-1.5 py-1 sm:px-2'
                        }
                        title={
                            hasBonus
                                ? `기본 ${baseV} → 표시 ${v} (장비·보너스 +${bonusRounded})`
                                : baseV !== v
                                  ? `기본 ${baseV} · 장비·보너스 반영`
                                  : undefined
                        }
                    >
                        <span className={statLabelClass}>{label}</span>
                        <span className={`flex min-w-0 flex-wrap items-center leading-tight shrink-0 justify-end gap-x-1`}>
                            <span className={statValueClass}>{v}</span>
                            {hasBonus ? <span className={statBonusClass}>(+{bonusRounded})</span> : null}
                        </span>
                    </div>
                );
            })}
        </div>
    );

    const phaseAbilityFooter =
        championshipPhaseAbilityScores != null ? (
            <div
                className={`mt-1.5 w-full shrink-0 rounded-lg border border-amber-500/25 bg-black/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
                    ch ? 'px-1 py-1.5 sm:px-1.5 sm:py-2' : 'px-2 py-2 sm:px-2.5 sm:py-2.5'
                }`}
                aria-label="챔피언십 페이즈별 능력치 점수"
            >
                <div className="grid w-full grid-cols-3 gap-1 sm:gap-1.5">
                    {(
                        [
                            { key: 'opening' as const, label: '초반' },
                            { key: 'midgame' as const, label: '중반' },
                            { key: 'endgame' as const, label: '종반' },
                        ] as const
                    ).map(({ key, label }) => (
                        <div
                            key={key}
                            className={`flex min-w-0 flex-col items-center justify-center rounded-md border border-white/10 bg-black/35 px-0.5 py-1 sm:px-1 ${
                                ch ? 'gap-0.5 py-1.5 sm:py-2' : 'gap-1 py-2 sm:py-2.5'
                            }`}
                        >
                            <span
                                className={`font-bold text-slate-200 ${
                                    ch ? 'text-xs font-extrabold sm:text-sm' : 'text-sm font-extrabold sm:text-base'
                                }`}
                            >
                                {label}
                            </span>
                            <span
                                className={`font-mono font-black tabular-nums text-amber-100 ${
                                    ch ? 'text-sm sm:text-base' : 'text-base sm:text-lg'
                                }`}
                            >
                                {championshipPhaseAbilityScores[key]}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        ) : null;

    const inner = (
        <>
            {bannerBlock}
            <div className={`mt-1 flex min-h-0 w-full min-w-0 flex-row items-stretch ${ch ? 'gap-1.5 sm:gap-2' : 'gap-2 sm:gap-2.5'}`}>
                <div className={`flex flex-none flex-col justify-start ${compactLayout ? 'w-[min(15.5rem,100%)]' : 'w-[min(18rem,100%)]'}`}>{equipmentBlock}</div>
                <div
                    className="w-px shrink-0 self-stretch bg-gradient-to-b from-amber-600/5 via-amber-400/50 to-amber-600/5"
                    aria-hidden
                />
                <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center overflow-x-hidden py-0.5">{coreStatsGrid}</div>
            </div>
            {phaseAbilityFooter}
        </>
    );

    if (!framed) {
        return <div className="text-on-panel">{inner}</div>;
    }

    return (
        <div className="relative w-full shrink-0 overflow-hidden rounded-xl border-2 border-amber-500/45 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_40px_-20px_rgba(0,0,0,0.72)] ring-1 ring-amber-100/12">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" aria-hidden />
            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" aria-hidden />
            <div className="relative p-2 text-on-panel sm:p-2.5">{inner}</div>
        </div>
    );
};

export default HomeNativeMergedEquipmentAbilityPanel;
