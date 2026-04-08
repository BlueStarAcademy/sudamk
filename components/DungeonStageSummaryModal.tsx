import React from 'react';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import Button from './Button.js';
import { TournamentType, TournamentState } from '../types.js';
import { ItemGrade } from '../types/enums.js';
import { TOURNAMENT_DEFINITIONS } from '../constants/tournaments.js';
import { CONSUMABLE_ITEMS, MATERIAL_ITEMS, gradeBackgrounds, EQUIPMENT_POOL } from '../constants/items.js';
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

    const tournamentName = TOURNAMENT_DEFINITIONS[dungeonType].name;
    const venueHeroImageUrl = resolvePublicUrl(TOURNAMENT_DEFINITIONS[dungeonType].image);
    const nextStage = stage < 10 ? stage + 1 : null;

    const rewardItemsMap = new Map<string, { name: string; image: string; quantity: number; grade?: ItemGrade }>();

    // 동네바둑리그: 1회차~5회차 각각 N 골드 형태로 표시 (경기별 기본보상)
    if (dungeonType === 'neighborhood' && baseRewards.gold && baseRewards.gold > 0) {
        if (tournamentState.matchGoldRewards && tournamentState.matchGoldRewards.length > 0) {
            tournamentState.matchGoldRewards.forEach((goldAmount: number, idx: number) => {
                rewardItemsMap.set(`neighborhood_round_${idx}`, {
                    name: `${idx + 1}회차 ${goldAmount.toLocaleString()} 골드`,
                    image: '/images/icon/Gold.png',
                    quantity: 1
                });
            });
        } else {
            rewardItemsMap.set('gold', {
                name: `${baseRewards.gold.toLocaleString()} 골드`,
                image: '/images/icon/Gold.png',
                quantity: 1
            });
        }
    } else if (baseRewards.gold && baseRewards.gold > 0) {
        rewardItemsMap.set('gold', {
            name: `${baseRewards.gold.toLocaleString()} 골드`,
            image: '/images/icon/Gold.png',
            quantity: 1
        });
    }
    // 전국바둑대회: 각 경기(라운드)당 보상 더미 하나씩 표시 (8강/4강/결승 등 경기별 구분)
    if (dungeonType === 'national' && tournamentState.matchMaterialRewards && tournamentState.matchMaterialRewards.length > 0) {
        tournamentState.matchMaterialRewards.forEach((roundMaterials: Record<string, number>, roundIndex: number) => {
            const parts: string[] = [];
            let firstImage = '';
            for (const [materialName, quantity] of Object.entries(roundMaterials)) {
                if (quantity <= 0) continue;
                parts.push(`${materialName} ${quantity}개`);
                const materialTemplate = MATERIAL_ITEMS[materialName];
                if (!firstImage && materialTemplate?.image) firstImage = materialTemplate.image;
            }
            if (parts.length > 0) {
                rewardItemsMap.set(`national_match_${roundIndex}`, {
                    name: parts.join(', '),
                    image: firstImage || '',
                    quantity: 1
                });
            }
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
                transcendent: '/images/equipments/mythicbgi.png',
            };
            const EQUIP_GRADE_LABEL: Record<string, string> = {
                normal: '일반', uncommon: '고급', rare: '희귀', epic: '에픽', legendary: '전설', mythic: '신화', transcendent: '초월',
            };
            (tournamentState.accumulatedEquipmentDrops as string[]).forEach((gradeKey: string, idx: number) => {
                const label = EQUIP_GRADE_LABEL[gradeKey] ?? gradeKey;
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
        for (const item of rankReward.items) {
            let itemName = item.itemId;
            const hasRange = item.min != null && item.max != null;
            const qtyText = hasRange ? (item.min === item.max ? `${item.min}` : `${item.min}~${item.max}`) : (item.quantity != null ? `${item.quantity}` : '');
            // N 골드 / N 다이아 형태로 통일 (숫자 먼저)
            const displayName = qtyText
                ? (itemName.includes('골드') ? `${qtyText} 골드` : itemName.includes('다이아') ? `${qtyText} 다이아` : `${itemName} ${qtyText}`)
                : itemName;
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
            const image = itemTemplate?.image || (itemName.includes('골드') ? '/images/icon/Gold.png' : itemName.includes('다이아') ? '/images/icon/Zem.png' : (MATERIAL_ITEMS as any)[item.itemId]?.image || '/images/Box/ResourceBox1.png');
            rewardItemsMap.set(`rank_${itemName}_${qtyText}`, {
                name: displayName,
                image,
                quantity: 1
            });
        }
    }
    const rewardItems = Array.from(rewardItemsMap.values());

    const panelCardClass =
        'rounded-xl border border-amber-500/18 bg-gradient-to-br from-slate-950/92 via-slate-900/78 to-violet-950/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-inset ring-white/[0.06]';
    const sectionTitleClass =
        'border-b border-white/[0.08] pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200/65 sm:text-[11px]';

    return (
        <DraggableWindow
            title={`${tournamentName} ${stage}단계 결과`}
            onClose={onClose}
            windowId="dungeon-stage-summary"
            initialWidth={isMobile ? Math.min(560, typeof window !== 'undefined' ? window.innerWidth - 16 : 560) : 700}
            initialHeight={isMobile ? 720 : 640}
            closeOnOutsideClick={false}
            isTopmost={isTopmost}
            zIndex={isMobile ? 85 : 70}
            modal
            mobileViewportFit={isMobile}
            mobileViewportMaxHeightCss="92dvh"
            mobileViewportMaxHeightVh={92}
            bodyScrollable
            hideFooter={isMobile}
            skipSavedPosition={isMobile}
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
                    <div className="relative flex h-[4.25rem] shrink-0 overflow-hidden rounded-xl ring-1 ring-amber-500/25 sm:h-[5.25rem]">
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

                    <div
                        className={`min-h-0 flex-1 overflow-x-hidden px-2.5 pb-2 pt-2.5 sm:px-3.5 sm:pb-3 sm:pt-3 sm:p-3 ${
                            isMobile
                                ? 'overflow-y-visible'
                                : `max-h-[min(52vh,420px)] overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgba(251,191,36,0.35)_transparent]`
                        }`}
                    >
                        <div className="flex flex-col gap-2.5 sm:gap-3">
                            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                                <div className={`${panelCardClass} flex flex-col gap-2 p-2.5 sm:p-3`}>
                                    <h3 className={sectionTitleClass}>이번 대회 결과</h3>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
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
                                    <div className="flex items-center justify-between text-sm sm:text-base">
                                        <span className="text-zinc-500">획득 점수</span>
                                        <span className="font-bold tabular-nums text-amber-200">
                                            {dailyScore !== undefined ? `+${dailyScore.toLocaleString()}점` : '-'}
                                        </span>
                                    </div>
                                    {nextStage !== null && (
                                        <div
                                            className={`flex flex-col gap-1 rounded-lg px-2 py-1.5 text-xs leading-snug sm:flex-row sm:items-center sm:justify-between sm:text-sm ${
                                                nextStageUnlocked ? 'bg-emerald-950/45 text-emerald-200 ring-1 ring-emerald-500/25' : 'bg-black/35 text-zinc-500 ring-1 ring-white/10'
                                            }`}
                                        >
                                            <span className="font-medium">{nextStage}단계</span>
                                            <span>
                                                {!nextStageUnlocked
                                                    ? '잠김 (3위 이상 시 열림)'
                                                    : nextStageWasAlreadyUnlocked
                                                      ? '다음 단계가 이미 열려있습니다.'
                                                      : '열림'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className={`${panelCardClass} flex flex-col justify-center p-2.5 sm:p-3`}>
                                    <h3 className={`${sectionTitleClass} mb-2`}>현재 단계 누적 전적</h3>
                                    <div className="flex items-center justify-center gap-8 py-1 sm:gap-6">
                                        <div className="text-center">
                                            <div className="text-3xl font-bold tabular-nums text-emerald-300 sm:text-2xl">{wins}</div>
                                            <div className="text-[11px] text-zinc-500 sm:text-[10px]">승</div>
                                        </div>
                                        <div className="h-12 w-px bg-white/15 sm:h-10" />
                                        <div className="text-center">
                                            <div className="text-3xl font-bold tabular-nums text-rose-300 sm:text-2xl">{losses}</div>
                                            <div className="text-[11px] text-zinc-500 sm:text-[10px]">패</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className={`${panelCardClass} flex min-h-[140px] flex-col p-2.5 sm:min-h-[160px] sm:p-3`}>
                                <h3 className={`${sectionTitleClass} mb-2 flex-shrink-0`}>보상 내역</h3>
                                {rewardItems.length > 0 ? (
                                    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 sm:gap-2">
                                        {rewardItems.map((item, index) => {
                                            const maybeEquip = item as typeof item & { grade?: ItemGrade };
                                            const isWorldEquip = dungeonType === 'world' && maybeEquip.grade;

                                            if (isWorldEquip && maybeEquip.grade) {
                                                const grade = maybeEquip.grade;
                                                const bg = gradeBackgrounds[grade] || gradeBackgrounds[ItemGrade.Normal];
                                                const thumbSize = isMobile ? 'w-16 h-16' : 'w-14 h-14';

                                                return (
                                                    <div
                                                        key={index}
                                                        className="flex min-w-0 flex-col items-center justify-center rounded-lg"
                                                        title={item.name}
                                                    >
                                                        <div className={`relative aspect-square ${thumbSize} overflow-hidden rounded-lg ring-1 ring-amber-400/25`}>
                                                            <img
                                                                src={bg}
                                                                alt={grade}
                                                                className="absolute inset-0 h-full w-full rounded-md object-cover"
                                                                aria-hidden
                                                            />
                                                            <img
                                                                src={item.image?.startsWith('/') ? item.image : `/${item.image}`}
                                                                alt={item.name}
                                                                className="pointer-events-none absolute left-1/2 top-1/2 w-[78%] max-h-[78%] -translate-x-1/2 -translate-y-1/2 object-contain"
                                                                loading="lazy"
                                                                decoding="async"
                                                            />
                                                        </div>
                                                        <span className="mt-1 line-clamp-2 w-full text-center text-[11px] leading-tight text-zinc-200 sm:text-[10px]">
                                                            {item.name}
                                                        </span>
                                                    </div>
                                                );
                                            }

                                            const iconSize = isMobile ? 'h-11 w-11' : 'h-8 w-8';

                                            return (
                                                <div
                                                    key={index}
                                                    className="flex min-w-0 flex-col items-center justify-center rounded-lg border border-white/10 bg-black/35 p-1.5 ring-1 ring-inset ring-white/[0.04] sm:p-2"
                                                >
                                                    <img src={item.image} alt="" className={`${iconSize} object-contain`} />
                                                    <span className="mt-1 line-clamp-2 w-full text-center text-[11px] leading-tight text-zinc-200 sm:text-[10px]">
                                                        {item.name}
                                                    </span>
                                                    {item.quantity > 1 && (
                                                        <span className="text-[11px] font-bold text-amber-200 sm:text-[10px]">×{item.quantity}</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="py-2 text-sm text-zinc-500">보상 없음</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div
                className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} relative z-10 flex shrink-0 flex-col border-t border-white/10 bg-[#07080c]/95 px-2.5 py-2.5 backdrop-blur-[2px] sm:px-3 sm:py-3 sm:pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]`}
            >
                <Button
                    bare
                    onClick={onClose}
                    colorScheme="none"
                    className="w-full rounded-full border border-violet-300/45 bg-gradient-to-b from-violet-500 via-indigo-600 to-violet-950 py-3 text-base font-bold text-white shadow-[0_10px_36px_-10px_rgba(109,40,217,0.65),inset_0_1px_0_rgba(255,255,255,0.22)] transition-all hover:border-violet-200/50 hover:shadow-[0_14px_40px_-8px_rgba(139,92,246,0.55)] active:translate-y-px sm:py-2.5 sm:text-sm"
                >
                    확인
                </Button>
            </div>
            </>
        </DraggableWindow>
    );
};

export default DungeonStageSummaryModal;
