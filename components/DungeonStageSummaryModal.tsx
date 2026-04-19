import React, { useState } from 'react';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import Button from './Button.js';
import { TournamentType, TournamentState } from '../types.js';
import { ItemGrade } from '../types/enums.js';
import { TOURNAMENT_DEFINITIONS } from '../constants/tournaments.js';
import { CONSUMABLE_ITEMS, MATERIAL_ITEMS, gradeBackgrounds, EQUIPMENT_POOL, EQUIPMENT_GRADE_LABEL_KO } from '../constants/items.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { resolvePublicUrl } from '../utils/publicAssetUrl.js';

export interface DungeonStageSummaryModalProps {
    dungeonType: TournamentType;
    stage: number;
    tournamentState: TournamentState;
    userRank: number;
    wins: number;
    losses: number;
    baseRewards: {
        gold?: number;
        materials?: Record<string, number>;
        equipmentBoxes?: Record<string, number>;
        changeTickets?: number;
        changeTicketGrants?: { name: string; quantity: number }[];
    };
    rankReward?: {
        items?: Array<{ itemId: string; quantity?: number; min?: number; max?: number }>;
    };
    /** 월드챔피언십: 실제 지급된 장비 목록(보상 수령 후 표시) */
    grantedEquipmentDrops?: Array<{ name: string; image: string }>;
    nextStageUnlocked: boolean;
    /** 이미 클리어한 단계를 다시 클리어한 경우 true (다음 단계가 이미 열려있습니다 표시) */
    nextStageWasAlreadyUnlocked?: boolean;
    dailyScore?: number;
    previousRank?: number;
    currentRank?: number;
    onClose: () => void;
    isTopmost?: boolean;
}

const DungeonStageSummaryModal: React.FC<DungeonStageSummaryModalProps> = ({
    dungeonType,
    stage,
    tournamentState,
    userRank,
    wins,
    losses,
    baseRewards,
    rankReward,
    grantedEquipmentDrops,
    nextStageUnlocked,
    nextStageWasAlreadyUnlocked,
    dailyScore,
    previousRank,
    currentRank,
    onClose,
    isTopmost
}) => {
    const isCompactViewport = useIsHandheldDevice(1025);
    const { isNativeMobile } = useNativeMobileShell();
    const isMobile = isCompactViewport || isNativeMobile;
    const [mobileSummaryTab, setMobileSummaryTab] = useState<'thisRun' | 'stageTotals'>('thisRun');

    const tournamentName = TOURNAMENT_DEFINITIONS[dungeonType].name;
    const venueHeroImageUrl = resolvePublicUrl(TOURNAMENT_DEFINITIONS[dungeonType].image);
    const nextStage = stage < 10 ? stage + 1 : null;

    type RewardChip = { name: string; image: string; quantity: number; grade?: ItemGrade; displayAmount?: string };
    const rewardItemsMap = new Map<string, RewardChip>();

    // 동네바둑리그: 회차 문구 없이 골드 아이콘 + 수치만 (회차별 수량은 quantity)
    if (dungeonType === 'neighborhood' && baseRewards.gold && baseRewards.gold > 0) {
        if (tournamentState.matchGoldRewards && tournamentState.matchGoldRewards.length > 0) {
            tournamentState.matchGoldRewards.forEach((goldAmount: number, idx: number) => {
                rewardItemsMap.set(`neighborhood_round_${idx}`, {
                    name: `골드 ${goldAmount.toLocaleString()}`,
                    image: '/images/icon/Gold.png',
                    quantity: goldAmount,
                });
            });
        } else {
            rewardItemsMap.set('gold', {
                name: '골드',
                image: '/images/icon/Gold.png',
                quantity: baseRewards.gold,
            });
        }
    } else if (baseRewards.gold && baseRewards.gold > 0) {
        rewardItemsMap.set('gold', {
            name: '골드',
            image: '/images/icon/Gold.png',
            quantity: baseRewards.gold,
        });
    }
    // 전국바둑대회: 재료별 합산, 아이콘+개수만 표시
    if (dungeonType === 'national' && tournamentState.matchMaterialRewards && tournamentState.matchMaterialRewards.length > 0) {
        const nationalMerged = new Map<string, { quantity: number; image: string }>();
        tournamentState.matchMaterialRewards.forEach((roundMaterials: Record<string, number>) => {
            for (const [materialName, quantity] of Object.entries(roundMaterials)) {
                if (quantity <= 0) continue;
                const materialTemplate = MATERIAL_ITEMS[materialName];
                const img = materialTemplate?.image || '';
                const prev = nationalMerged.get(materialName);
                nationalMerged.set(materialName, {
                    quantity: (prev?.quantity ?? 0) + quantity,
                    image: img || prev?.image || '',
                });
            }
        });
        nationalMerged.forEach((v, materialName) => {
            rewardItemsMap.set(`national_${materialName}`, {
                name: materialName,
                image: v.image,
                quantity: v.quantity,
            });
        });
    } else if (baseRewards.materials) {
        for (const [materialName, quantity] of Object.entries(baseRewards.materials)) {
            const materialTemplate = MATERIAL_ITEMS[materialName];
            const existing = rewardItemsMap.get(materialName);
            if (existing) {
                existing.quantity += quantity;
            } else {
                rewardItemsMap.set(materialName, {
                    name: materialName,
                    image: materialTemplate?.image || '',
                    quantity: quantity
                });
            }
        }
    }
    // 월드챔피언십: 실제 지급된 장비를 인벤토리 카드 스타일(등급 배경 + 장비 이미지)로 표시
    if (dungeonType === 'world') {
        if (grantedEquipmentDrops && grantedEquipmentDrops.length > 0) {
            grantedEquipmentDrops.forEach((eq, idx) => {
                const template = EQUIPMENT_POOL.find(t => t.name === eq.name);
                const grade = template?.grade as ItemGrade | undefined;
                rewardItemsMap.set(`world_drop_${idx}_${eq.name}`, {
                    name: eq.name,
                    image: eq.image || '/images/equipments/normalbgi.png',
                    quantity: 1,
                    grade,
                });
            });
        } else if (tournamentState.accumulatedEquipmentItems && tournamentState.accumulatedEquipmentItems.length > 0) {
            tournamentState.accumulatedEquipmentItems.forEach((eq, idx) => {
                const grade = (eq as any).grade as ItemGrade | undefined;
                rewardItemsMap.set(`world_generated_${idx}_${eq.name}`, {
                    name: eq.name,
                    image: eq.image || '/images/equipments/normalbgi.png',
                    quantity: 1,
                    grade,
                });
            });
        } else if (tournamentState.accumulatedEquipmentDrops && tournamentState.accumulatedEquipmentDrops.length > 0) {
            const EQUIP_GRADE_IMAGE: Record<string, string> = {
                normal: '/images/equipments/normalbgi.png',
                uncommon: '/images/equipments/uncommonbgi.png',
                rare: '/images/equipments/rarebgi.png',
                epic: '/images/equipments/epicbgi.png',
                legendary: '/images/equipments/legendarybgi.png',
                mythic: '/images/equipments/mythicbgi.png',
                transcendent: '/images/equipments/transcendentbgi.webp',
            };
            (tournamentState.accumulatedEquipmentDrops as string[]).forEach((gradeKey: string, idx: number) => {
                const label = EQUIPMENT_GRADE_LABEL_KO[gradeKey] ?? gradeKey;
                const img = EQUIP_GRADE_IMAGE[gradeKey] || '/images/equipments/normalbgi.png';
                rewardItemsMap.set(`world_equip_${idx}_${gradeKey}`, {
                    name: `${label} 장비`,
                    image: img,
                    quantity: 1,
                    grade: gradeKey as ItemGrade,
                });
            });
        }
    } else if (baseRewards.equipmentBoxes) {
        for (const [boxName, quantity] of Object.entries(baseRewards.equipmentBoxes)) {
            const boxTemplate = CONSUMABLE_ITEMS.find(i => i.name === boxName);
            const existing = rewardItemsMap.get(boxName);
            if (existing) {
                existing.quantity += quantity;
            } else {
                rewardItemsMap.set(boxName, {
                    name: boxName,
                    image: boxTemplate?.image || '',
                    quantity: quantity
                });
            }
        }
    }
    if (baseRewards.changeTicketGrants && baseRewards.changeTicketGrants.length > 0) {
        for (const g of baseRewards.changeTicketGrants) {
            const mat = (MATERIAL_ITEMS as Record<string, { image?: string }>)[g.name];
            const img = mat?.image || '/images/use/change2.png';
            const key = `change_ticket_${g.name}`;
            const existing = rewardItemsMap.get(key);
            if (existing) {
                existing.quantity += g.quantity;
            } else {
                rewardItemsMap.set(key, {
                    name: g.name,
                    image: img,
                    quantity: g.quantity,
                    grade: ItemGrade.Normal,
                });
            }
        }
    } else if (baseRewards.changeTickets && baseRewards.changeTickets > 0) {
        rewardItemsMap.set('changeTickets', {
            name: `변경권 x${baseRewards.changeTickets}`,
            image: '/images/use/change2.png',
            quantity: baseRewards.changeTickets,
            grade: ItemGrade.Normal,
        });
    }
    if (rankReward?.items) {
        rankReward.items.forEach((item, rankIdx) => {
            let itemName = item.itemId;
            const hasRange = item.min != null && item.max != null;
            const qtyText = hasRange
                ? item.min === item.max
                    ? `${item.min}`
                    : `${item.min}~${item.max}`
                : item.quantity != null
                  ? `${item.quantity}`
                  : '';
            const displayAmount = qtyText || (item.quantity != null ? String(item.quantity) : '1');
            let itemTemplate = CONSUMABLE_ITEMS.find(i => i.name === itemName);
            if (!itemTemplate && (MATERIAL_ITEMS as any)[itemName]) {
                itemTemplate = { name: itemName, image: (MATERIAL_ITEMS as any)[itemName].image } as any;
            }
            if (!itemTemplate) {
                const nameMappings: Record<string, string> = {
                    '재료 상자1': '재료 상자 I', '재료 상자2': '재료 상자 II', '재료 상자3': '재료 상자 III',
                    '재료 상자4': '재료 상자 IV', '재료 상자5': '재료 상자 V', '재료 상자6': '재료 상자 VI',
                    '재료상자1': '재료 상자 I', '재료상자2': '재료 상자 II', '재료상자3': '재료 상자 III',
                    '재료상자4': '재료 상자 IV', '재료상자5': '재료 상자 V', '재료상자6': '재료 상자 VI',
                };
                const mappedName = nameMappings[itemName];
                if (mappedName) {
                    itemTemplate = CONSUMABLE_ITEMS.find(i => i.name === mappedName);
                    if (itemTemplate) itemName = mappedName;
                }
            }
            const image =
                itemTemplate?.image ||
                (itemName.includes('골드')
                    ? '/images/icon/Gold.png'
                    : itemName.includes('다이아')
                      ? '/images/icon/Zem.png'
                      : (MATERIAL_ITEMS as any)[item.itemId]?.image || '/images/Box/ResourceBox1.png');
            rewardItemsMap.set(`rank_${rankIdx}_${itemName}`, {
                name: itemName,
                image,
                quantity: 1,
                displayAmount,
            });
        });
    }
    const rewardItems = Array.from(rewardItemsMap.values());

    /** 칩 하단 숫자(이미지+숫자만). 월드 단일 장비는 등급만으로 구분해 숫자 생략 */
    const rewardChipFooterNumber = (item: RewardChip): string | null => {
        if (item.displayAmount != null && item.displayAmount !== '') return item.displayAmount;
        if (dungeonType === 'world' && item.grade != null && item.quantity <= 1) return null;
        return item.quantity.toLocaleString();
    };

    const panelCardClass =
        'rounded-xl border border-amber-500/18 bg-gradient-to-br from-slate-950/92 via-slate-900/78 to-violet-950/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-inset ring-white/[0.06]';
    const sectionTitleClass =
        'border-b border-white/[0.08] pb-1.5 font-bold uppercase tracking-[0.14em] text-amber-200/65 ' +
        (isMobile ? 'text-[11px]' : 'text-[10px] sm:text-[11px]');

    const nextStageStatusMobile = !nextStageUnlocked
        ? '3위 이상 시 열림'
        : nextStageWasAlreadyUnlocked
          ? '이미 열림'
          : '해제됨';
    const nextStageStatusDesktop = !nextStageUnlocked
        ? '잠김 (3위 이상 시 열림)'
        : nextStageWasAlreadyUnlocked
          ? '다음 단계가 이미 열려있습니다.'
          : '열림';

    const thisRunResultCard = (
        <div
            className={`${panelCardClass} flex w-full max-w-[19rem] flex-col items-center gap-2 p-2.5 sm:max-w-none sm:w-full sm:items-stretch sm:p-3 max-sm:mx-auto max-sm:gap-1.5 max-sm:p-2 max-sm:py-2.5`}
        >
            <h3 className={`${sectionTitleClass} max-sm:hidden text-center`}>이번 대회 결과</h3>
            {/* 모바일: 전적·순위·획득 점수·다음 단계를 한 세로 스택으로 가운데 정렬 */}
            <div className="flex flex-col items-center gap-2 sm:hidden">
                <div className="flex items-center justify-center gap-2.5 rounded-lg bg-black/25 px-3 py-2 ring-1 ring-inset ring-white/[0.06]">
                    <div className="text-center">
                        <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">전적</div>
                        <div className="mt-1 flex items-baseline justify-center gap-x-0.5 text-sm font-bold tabular-nums leading-none">
                            <span className="text-emerald-300">{wins}</span>
                            <span className="text-[11px] font-medium text-zinc-500">승</span>
                            <span className="mx-0.5 text-zinc-600">·</span>
                            <span className="text-rose-300">{losses}</span>
                            <span className="text-[11px] font-medium text-zinc-500">패</span>
                        </div>
                    </div>
                    <div className="h-9 w-px shrink-0 bg-white/12" aria-hidden />
                    <div className="text-center">
                        <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">순위</div>
                        <div className="mt-1 flex items-center justify-center gap-0.5">
                            <div
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                                    userRank === 1
                                        ? 'bg-gradient-to-br from-yellow-400 to-amber-600 text-black'
                                        : userRank === 2
                                          ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-gray-800'
                                          : userRank === 3
                                            ? 'bg-gradient-to-br from-amber-700 to-amber-900 text-amber-100'
                                            : 'bg-zinc-700 text-zinc-200'
                                }`}
                            >
                                {userRank}
                            </div>
                            <span className="text-[11px] font-medium text-zinc-400">위</span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-center gap-0.5 text-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">획득 점수</span>
                    <span className="text-base font-bold tabular-nums text-amber-200">
                        {dailyScore !== undefined ? `+${dailyScore.toLocaleString()}점` : '-'}
                    </span>
                </div>
                {nextStage !== null ? (
                    <div
                        className={`w-full max-w-[15.5rem] rounded-lg px-3 py-2 text-center text-[10px] leading-snug ring-1 ${
                            nextStageUnlocked
                                ? 'bg-emerald-950/45 text-emerald-200 ring-emerald-500/25'
                                : 'bg-black/35 text-zinc-400 ring-white/10'
                        }`}
                    >
                        <div className={`font-semibold ${nextStageUnlocked ? 'text-emerald-100' : 'text-zinc-300'}`}>
                            다음 {nextStage}단계
                        </div>
                        <div className={`mt-0.5 ${nextStageUnlocked ? 'text-emerald-200/90' : 'text-zinc-500'}`}>
                            {nextStageStatusMobile}
                        </div>
                    </div>
                ) : null}
            </div>
            <div className="flex max-sm:hidden flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm sm:text-base">
                    <span className="text-zinc-500">전적</span>
                    <span className="font-bold tabular-nums text-emerald-300">{wins}</span>
                    <span className="text-zinc-500">승</span>
                    <span className="text-zinc-600">-</span>
                    <span className="font-bold tabular-nums text-rose-300">{losses}</span>
                    <span className="text-zinc-500">패</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 sm:text-sm">순위</span>
                    <div
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold sm:h-8 sm:w-8 ${
                            userRank === 1
                                ? 'bg-gradient-to-br from-yellow-400 to-amber-600 text-black'
                                : userRank === 2
                                  ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-gray-800'
                                  : userRank === 3
                                    ? 'bg-gradient-to-br from-amber-700 to-amber-900 text-amber-100'
                                    : 'bg-zinc-700 text-zinc-200'
                        }`}
                    >
                        {userRank}
                    </div>
                    <span className="text-xs text-zinc-400 sm:text-sm">위</span>
                </div>
            </div>
            <div className="flex w-full items-center justify-between gap-2 border-t border-white/[0.06] pt-1.5 text-sm max-sm:hidden sm:text-base">
                <span className="shrink-0 text-xs text-zinc-500 sm:text-inherit">획득 점수</span>
                <span className="min-w-0 truncate text-right font-bold tabular-nums text-amber-200">
                    {dailyScore !== undefined ? `+${dailyScore.toLocaleString()}점` : '-'}
                </span>
            </div>
            {nextStage !== null ? (
                <div
                    className={`flex max-sm:hidden w-full max-w-full flex-col gap-1 rounded-lg px-2 py-1.5 text-xs leading-snug sm:flex-row sm:items-center sm:justify-between sm:text-sm ${
                        nextStageUnlocked ? 'bg-emerald-950/45 text-emerald-200 ring-1 ring-emerald-500/25' : 'bg-black/35 text-zinc-500 ring-1 ring-white/10'
                    }`}
                >
                    <span className="font-medium">{nextStage}단계</span>
                    <span>{nextStageStatusDesktop}</span>
                </div>
            ) : null}
        </div>
    );

    const stageTotalGames = wins + losses;
    const stageWinRateText = stageTotalGames === 0 ? '—' : `${((wins / stageTotalGames) * 100).toFixed(1)}%`;

    const stageTotalsCard = (
        <div
            className={`${panelCardClass} flex w-full max-w-[19rem] flex-col items-center justify-center p-2.5 text-center sm:max-w-none sm:w-full sm:p-3 max-sm:mx-auto max-sm:min-h-[9.5rem] max-sm:py-5`}
        >
            <h3 className={`${sectionTitleClass} mb-2 w-full max-sm:hidden text-center`}>현재 단계 누적 전적</h3>
            <div className="flex w-full max-w-full items-center justify-center gap-3 py-1 sm:gap-5 md:gap-8">
                <div className="min-w-0 text-center">
                    <div className="text-3xl font-bold tabular-nums text-emerald-300 sm:text-2xl">{wins}</div>
                    <div className="text-[11px] text-zinc-500 sm:text-[10px]">승</div>
                </div>
                <div className="h-12 w-px shrink-0 bg-white/15 sm:h-10" />
                <div className="min-w-0 text-center">
                    <div className="text-3xl font-bold tabular-nums text-rose-300 sm:text-2xl">{losses}</div>
                    <div className="text-[11px] text-zinc-500 sm:text-[10px]">패</div>
                </div>
                <div className="h-12 w-px shrink-0 bg-white/15 sm:h-10" />
                <div className="min-w-0 text-center">
                    <div className="text-3xl font-bold tabular-nums text-amber-200 sm:text-2xl">{stageWinRateText}</div>
                    <div className="text-[11px] text-zinc-500 sm:text-[10px]">승률</div>
                </div>
            </div>
        </div>
    );

    const renderMobileRewardStrip = () => {
        if (rewardItems.length === 0) {
            return <p className="py-0.5 text-center text-[10px] text-zinc-500">보상 없음</p>;
        }
        /** 한 줄 유지: 줄바꿈 대신 가로 스크롤, 월드 등 아이템 많을 때 칩을 살짝 축소 */
        const worldCompact = dungeonType === 'world' && rewardItems.length >= 5;
        const chipBox = worldCompact ? 'h-8 w-8' : 'h-9 w-9';
        const imgInBox = worldCompact ? 'h-5 w-5' : 'h-6 w-6';
        const colW = worldCompact ? 'w-[2.15rem]' : 'w-[2.5rem]';
        const footerText = worldCompact ? 'text-[6px]' : 'text-[7px]';

        return (
            <div
                className="w-full min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-0.5 pt-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] [scrollbar-color:rgba(251,191,36,0.35)_transparent]"
                role="region"
                aria-label="보상 아이콘"
            >
                <div className="mx-auto flex w-max max-w-none flex-nowrap items-end justify-center gap-x-[clamp(3px,1.2vw,6px)] px-0.5" role="list">
                    {rewardItems.map((item, index) => {
                        const maybeEquip = item as RewardChip;
                        const isWorldEquip = dungeonType === 'world' && maybeEquip.grade;
                        const footerNum = rewardChipFooterNumber(maybeEquip);

                        if (isWorldEquip && maybeEquip.grade) {
                            const grade = maybeEquip.grade;
                            const bg = gradeBackgrounds[grade] || gradeBackgrounds[ItemGrade.Normal];
                            return (
                                <div
                                    key={index}
                                    className={`flex ${colW} shrink-0 flex-col items-center gap-px`}
                                    role="listitem"
                                    title={item.name}
                                >
                                    <div className={`relative ${chipBox} overflow-hidden rounded-md ring-1 ring-amber-400/30`}>
                                        <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover" aria-hidden />
                                        <img
                                            src={item.image?.startsWith('/') ? item.image : `/${item.image}`}
                                            alt=""
                                            className="pointer-events-none absolute left-1/2 top-1/2 w-[74%] max-h-[74%] -translate-x-1/2 -translate-y-1/2 object-contain"
                                            loading="lazy"
                                            decoding="async"
                                        />
                                    </div>
                                    {footerNum ? (
                                        <span className={`${footerText} font-bold tabular-nums leading-none text-amber-200/95`}>{footerNum}</span>
                                    ) : null}
                                </div>
                            );
                        }

                        const src = item.image?.startsWith('/') ? item.image : item.image ? `/${item.image}` : '';
                        return (
                            <div
                                key={index}
                                className={`flex ${colW} shrink-0 flex-col items-center gap-px`}
                                role="listitem"
                                title={item.name}
                            >
                                <div
                                    className={`flex ${chipBox} items-center justify-center rounded-md border border-white/10 bg-black/45 ring-1 ring-inset ring-white/[0.05]`}
                                >
                                    {src ? (
                                        <img src={src} alt="" className={`${imgInBox} object-contain`} loading="lazy" decoding="async" />
                                    ) : null}
                                </div>
                                {footerNum ? (
                                    <span
                                        className={`max-w-[2.5rem] truncate text-center ${footerText} font-bold tabular-nums leading-none text-amber-200/95`}
                                    >
                                        {footerNum}
                                    </span>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <DraggableWindow
            title={`${tournamentName} ${stage}단계 결과`}
            onClose={onClose}
            windowId="dungeon-stage-summary"
            initialWidth={isMobile ? Math.min(560, typeof window !== 'undefined' ? window.innerWidth - 16 : 560) : 700}
            initialHeight={isMobile ? 780 : 640}
            closeOnOutsideClick={false}
            isTopmost={isTopmost}
            zIndex={isMobile ? 85 : 70}
            modal
            mobileViewportFit={isMobile}
            mobileViewportMaxHeightCss="92dvh"
            mobileViewportMaxHeightVh={92}
            mobileLockViewportHeight={isMobile}
            bodyScrollable={!isMobile}
            bodyNoScroll={isMobile}
            bodyPaddingClassName={isMobile ? '!p-0' : undefined}
        >
            <>
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#07080c] text-zinc-100">
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.07]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                    }}
                    aria-hidden
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-900/25 via-violet-900/10 to-transparent" aria-hidden />
                <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-purple-600/15 blur-3xl" aria-hidden />
                <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-amber-600/10 blur-3xl" aria-hidden />

                <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
                    <div className="relative flex h-[3.65rem] shrink-0 overflow-hidden rounded-xl ring-1 ring-amber-500/25 sm:h-[4.25rem] md:h-[5.25rem]">
                        <img src={venueHeroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/92 via-black/55 to-black/25" />
                        <div className="relative z-[1] flex flex-1 flex-col justify-center px-3.5 py-2">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/80 sm:text-xs">Championship</span>
                            <span className="line-clamp-2 text-base font-bold leading-tight text-white drop-shadow-md sm:text-lg">
                                {tournamentName}
                            </span>
                        </div>
                        <div className="relative z-[1] flex items-center pr-3 sm:pr-4">
                            <div className="rounded-lg bg-black/55 px-3 py-1.5 ring-1 ring-amber-400/30 backdrop-blur-sm">
                                <span className="block text-center text-[10px] font-semibold uppercase tracking-wider text-amber-200/85 sm:text-xs">단계</span>
                                <span className="block text-center text-2xl font-black tabular-nums leading-none text-white sm:text-3xl">{stage}</span>
                            </div>
                        </div>
                    </div>

                    {isMobile ? (
                        <>
                            <div
                                className="flex shrink-0 gap-1 border-b border-white/10 bg-black/25 px-2 pt-2"
                                role="tablist"
                                aria-label="결과 요약"
                            >
                                {(
                                    [
                                        ['thisRun', '이번 대회 결과'] as const,
                                        ['stageTotals', '현재 단계 누적 전적'] as const,
                                    ] as const
                                ).map(([key, label]) => {
                                    const active = mobileSummaryTab === key;
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            role="tab"
                                            aria-selected={active}
                                            onClick={() => setMobileSummaryTab(key)}
                                            className={`min-w-0 flex-1 rounded-t-md border border-b-0 px-1 py-2 text-center text-[9px] font-semibold leading-snug transition-colors sm:text-[10px] ${
                                                active
                                                    ? 'border-amber-500/40 bg-[#07080c] text-amber-100 ring-1 ring-amber-400/25 ring-offset-0'
                                                    : 'border-transparent bg-black/20 text-zinc-500 hover:bg-black/35 hover:text-zinc-300'
                                            }`}
                                        >
                                            <span className="line-clamp-2 break-words">{label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div
                                className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain px-2 py-1.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:w-0"
                                role="presentation"
                            >
                                <div className="flex min-h-full w-full flex-col">
                                    <div
                                        className="flex flex-1 flex-col items-center justify-center gap-2 px-1 py-2"
                                        role="tabpanel"
                                    >
                                        {mobileSummaryTab === 'thisRun' ? thisRunResultCard : stageTotalsCard}
                                    </div>
                                </div>
                            </div>
                            <div className="relative z-10 flex shrink-0 flex-col items-center gap-1 border-t border-white/10 bg-[#07080c]/95 px-2 py-1 backdrop-blur-[2px] pb-[max(0.35rem,env(safe-area-inset-bottom,0px))]">
                                <div className="w-full min-w-0 max-w-full">
                                    <h3 className="mb-0.5 border-b border-white/[0.08] pb-0.5 text-center text-[9px] font-bold uppercase tracking-[0.12em] text-amber-200/65">
                                        보상 내역
                                    </h3>
                                    {renderMobileRewardStrip()}
                                </div>
                                <Button
                                    bare
                                    onClick={onClose}
                                    colorScheme="none"
                                    className="mx-auto w-full max-w-[8.5rem] rounded-full border border-violet-300/45 bg-gradient-to-b from-violet-500 via-indigo-600 to-violet-950 py-1.5 text-xs font-bold text-white shadow-[0_8px_28px_-10px_rgba(109,40,217,0.55),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:border-violet-200/50 hover:shadow-[0_12px_32px_-8px_rgba(139,92,246,0.45)] active:translate-y-px"
                                >
                                    확인
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div
                            className={`flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-2.5 pb-2 pt-2.5 sm:px-3.5 sm:pb-3 sm:pt-3 sm:p-3 max-h-[min(52vh,420px)] overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgba(251,191,36,0.35)_transparent]`}
                        >
                            <div className="flex min-h-full w-full flex-col">
                                <div className="flex flex-1 flex-col items-center justify-center gap-2.5 sm:gap-3">
                                    <div className="grid w-full max-w-3xl grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                                        {thisRunResultCard}
                                        {stageTotalsCard}
                                    </div>

                                    <div
                                        className={`${panelCardClass} flex w-full max-w-3xl min-h-[140px] flex-col items-center p-2.5 sm:min-h-[160px] sm:p-3`}
                                    >
                                        <h3 className={`${sectionTitleClass} mb-2 w-full flex-shrink-0 text-center`}>보상 내역</h3>
                                    {rewardItems.length > 0 ? (
                                        <div className="grid w-full max-w-full grid-cols-5 justify-items-center gap-1.5 sm:gap-2">
                                            {rewardItems.map((item, index) => {
                                                const chip = item as RewardChip;
                                                const isWorldEquip = dungeonType === 'world' && chip.grade;
                                                const footerNum = rewardChipFooterNumber(chip);

                                                if (isWorldEquip && chip.grade) {
                                                    const grade = chip.grade;
                                                    const bg = gradeBackgrounds[grade] || gradeBackgrounds[ItemGrade.Normal];

                                                    return (
                                                        <div
                                                            key={index}
                                                            className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg"
                                                            title={item.name}
                                                        >
                                                            <div className="relative aspect-square h-12 w-12 overflow-hidden rounded-lg ring-1 ring-amber-400/25 sm:h-14 sm:w-14">
                                                                <img
                                                                    src={bg}
                                                                    alt=""
                                                                    className="absolute inset-0 h-full w-full rounded-md object-cover"
                                                                    aria-hidden
                                                                />
                                                                <img
                                                                    src={item.image?.startsWith('/') ? item.image : `/${item.image}`}
                                                                    alt=""
                                                                    className="pointer-events-none absolute left-1/2 top-1/2 w-[78%] max-h-[78%] -translate-x-1/2 -translate-y-1/2 object-contain"
                                                                    loading="lazy"
                                                                    decoding="async"
                                                                />
                                                            </div>
                                                            {footerNum ? (
                                                                <span className="text-[9px] font-bold tabular-nums text-amber-200">{footerNum}</span>
                                                            ) : null}
                                                        </div>
                                                    );
                                                }

                                                const src = item.image?.startsWith('/') ? item.image : item.image ? `/${item.image}` : '';
                                                return (
                                                    <div
                                                        key={index}
                                                        className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-white/10 bg-black/35 p-1.5 ring-1 ring-inset ring-white/[0.04] sm:p-2"
                                                        title={item.name}
                                                    >
                                                        <div className="flex h-10 w-10 items-center justify-center sm:h-11 sm:w-11">
                                                            {src ? <img src={src} alt="" className="h-7 w-7 object-contain sm:h-8 sm:w-8" /> : null}
                                                        </div>
                                                        {footerNum ? (
                                                            <span className="w-full truncate text-center text-[9px] font-bold tabular-nums text-amber-200">
                                                                {footerNum}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="py-2 text-center text-sm text-zinc-500">보상 없음</p>
                                    )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {!isMobile ? (
                <div
                    className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} relative z-10 flex shrink-0 flex-col items-center border-t border-white/10 bg-[#07080c]/95 px-2.5 py-2.5 backdrop-blur-[2px] sm:px-3 sm:py-3 sm:pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]`}
                >
                    <Button
                        bare
                        onClick={onClose}
                        colorScheme="none"
                        className="w-full max-w-md rounded-full border border-violet-300/45 bg-gradient-to-b from-violet-500 via-indigo-600 to-violet-950 py-3 text-base font-bold text-white shadow-[0_10px_36px_-10px_rgba(109,40,217,0.65),inset_0_1px_0_rgba(255,255,255,0.22)] transition-all hover:border-violet-200/50 hover:shadow-[0_14px_40px_-8px_rgba(139,92,246,0.55)] active:translate-y-px sm:py-2.5 sm:text-sm"
                    >
                        확인
                    </Button>
                </div>
            ) : null}
            </>
        </DraggableWindow>
    );
};

export default DungeonStageSummaryModal;
