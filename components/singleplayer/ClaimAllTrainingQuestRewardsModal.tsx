import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { SINGLE_PLAYER_MISSIONS } from '../../constants/singlePlayerConstants.js';
import { PREMIUM_QUEST_BTN } from './trainingQuestPremiumButtons.js';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { useLocalizedInventoryItemName } from '../../shared/i18n/localizedCatalog.js';
import { formatGoldAmountKoG, formatWalletDiamonds } from '../../shared/utils/walletAmountDisplay.js';
import { getItemTemplateByName } from '../../utils/itemTemplateLookup.js';
import { useAdContext } from '../ads/AdProvider.js';
import type { InventoryItem } from '../../types.js';

type ClaimRewardType = 'gold' | 'diamonds' | 'enhance_stone' | 'equipment_box';

interface ClaimAllTrainingQuestRewardsModalProps {
    rewards: Array<{
        missionId: string;
        missionName: string;
        /** 수령 시점 미션 레벨 (1~10). 구버전 응답에는 없을 수 있음 */
        missionLevel?: number;
        rewardType: ClaimRewardType;
        rewardAmount: number;
        claimCycles?: number;
    }>;
    totalGold: number;
    totalDiamonds: number;
    totalItemCycles?: number;
    /** 수령 완료 후 실제 지급된 강화석·장비상자 등 */
    items?: InventoryItem[];
    mode?: 'preview' | 'claimed';
    onClaimNormal?: () => Promise<boolean>;
    onClaimAdDouble?: () => Promise<boolean>;
    onClose: () => void;
    isTopmost?: boolean;
}

function AdDoubleButtonLabel({ claiming }: { claiming?: boolean }) {
    const { t } = useTranslation(['lobby', 'common']);
    if (claiming) return <>{t('singleplayer.claimAllAdClaiming')}</>;
    return (
        <span className="inline-flex items-center justify-center gap-1 whitespace-nowrap" aria-label={t('singleplayer.claimAllAdDoubleAria')}>
            <span>{t('singleplayer.claimAllAdDouble')}</span>
            <img src="/images/icon/Gold.webp" alt="" className="h-3.5 w-3.5 shrink-0 object-contain sm:h-4 sm:w-4" />
            <span className="tabular-nums">×2</span>
            <img src="/images/icon/Zem.webp" alt="" className="h-3.5 w-3.5 shrink-0 object-contain sm:h-4 sm:w-4" />
            <span className="tabular-nums">×2</span>
        </span>
    );
}

function sumItemRewardCycles(
    rewards: ClaimAllTrainingQuestRewardsModalProps['rewards'],
    rewardType: 'enhance_stone' | 'equipment_box',
): number {
    return rewards.reduce((sum, reward) => {
        if (reward.rewardType !== rewardType) return sum;
        const cycles = reward.claimCycles ?? reward.rewardAmount;
        return sum + (Number.isFinite(cycles) ? cycles : 0);
    }, 0);
}

/** 골드·다이아·강화석·장비 상자 행: 아이콘 열·숫자 열 정렬 */
function ClaimAllTotalsBox({
    totalGold,
    totalDiamonds,
    totalEnhanceStoneCycles,
    totalEquipmentBoxCycles,
    variant,
}: {
    totalGold: number;
    totalDiamonds: number;
    totalEnhanceStoneCycles: number;
    totalEquipmentBoxCycles: number;
    variant: 'compact' | 'comfortable';
}) {
    const { t } = useTranslation(['lobby', 'common']);
    if (
        totalGold <= 0 &&
        totalDiamonds <= 0 &&
        totalEnhanceStoneCycles <= 0 &&
        totalEquipmentBoxCycles <= 0
    ) {
        return null;
    }

    const shell =
        variant === 'compact'
            ? 'w-full max-w-[13rem] space-y-1.5 rounded-lg border border-emerald-400/30 bg-gradient-to-br from-emerald-950/55 via-gray-900/80 to-slate-950/90 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_18px_rgba(0,0,0,0.35)] sm:max-w-[13.5rem] sm:px-3.5 sm:py-2'
            : 'w-full max-w-[14.5rem] space-y-2 rounded-xl border border-emerald-400/35 bg-gradient-to-br from-emerald-950/50 via-gray-900/85 to-slate-950/95 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_6px_22px_rgba(0,0,0,0.4)] sm:max-w-[15rem] sm:px-4 sm:py-3.5';

    const titleClass =
        variant === 'compact'
            ? 'text-center text-xs font-bold leading-snug text-amber-100/95 sm:text-sm'
            : 'text-center text-base font-bold text-amber-100 sm:text-lg';

    const rowGrid = 'grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-2';
    const iconWrap = 'flex h-7 items-center justify-center sm:h-8';
    const iconClass = variant === 'compact' ? 'h-6 w-6 sm:h-7 sm:w-7' : 'h-7 w-7 sm:h-8 sm:w-8';
    const numClass =
        variant === 'compact'
            ? 'text-right text-sm font-bold tabular-nums tracking-tight text-yellow-300 sm:text-base'
            : 'text-right text-lg font-bold tabular-nums tracking-tight text-yellow-300 sm:text-xl';
    const diaClass =
        variant === 'compact'
            ? 'text-right text-sm font-bold tabular-nums tracking-tight text-cyan-300 sm:text-base'
            : 'text-right text-lg font-bold tabular-nums tracking-tight text-cyan-300 sm:text-xl';
    const itemClass =
        variant === 'compact'
            ? 'text-right text-sm font-bold tabular-nums tracking-tight text-violet-200 sm:text-base'
            : 'text-right text-lg font-bold tabular-nums tracking-tight text-violet-200 sm:text-xl';

    return (
        <div className={shell}>
            <h3 className={titleClass}>{t('singleplayer.totalSum')}</h3>
            <div className="flex flex-col gap-2 sm:gap-2.5">
                {totalGold > 0 && (
                    <div className={rowGrid}>
                        <div className={iconWrap}>
                            <img src="/images/icon/Gold.webp" alt={t('common:resources.gold')} className={`${iconClass} shrink-0 object-contain`} />
                        </div>
                        <span className={numClass}>+{formatGoldAmountKoG(totalGold)}</span>
                    </div>
                )}
                {totalDiamonds > 0 && (
                    <div className={rowGrid}>
                        <div className={iconWrap}>
                            <img src="/images/icon/Zem.webp" alt={t('common:resources.diamonds')} className={`${iconClass} shrink-0 object-contain`} />
                        </div>
                        <span className={diaClass}>+{formatWalletDiamonds(totalDiamonds)}</span>
                    </div>
                )}
                {totalEnhanceStoneCycles > 0 && (
                    <div className={rowGrid}>
                        <div className={iconWrap}>
                            <img
                                src="/images/materials/materials1.webp"
                                alt={t('singleplayer.enhanceStone')}
                                className={`${iconClass} shrink-0 object-contain`}
                            />
                        </div>
                        <span className={itemClass}>
                            {t('singleplayer.claimAllItemCycles', {
                                name: t('singleplayer.enhanceStone'),
                                cycles: totalEnhanceStoneCycles,
                            })}
                        </span>
                    </div>
                )}
                {totalEquipmentBoxCycles > 0 && (
                    <div className={rowGrid}>
                        <div className={iconWrap}>
                            <img
                                src="/images/Box/EquipmentBox1.webp"
                                alt={t('singleplayer.equipmentBox')}
                                className={`${iconClass} shrink-0 object-contain`}
                            />
                        </div>
                        <span className={itemClass}>
                            {t('singleplayer.claimAllItemCycles', {
                                name: t('singleplayer.equipmentBox'),
                                cycles: totalEquipmentBoxCycles,
                            })}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

function resolveMissionDisplayName(missionId: string, fallbackName: string): string {
    return SINGLE_PLAYER_MISSIONS.find((m) => m.id === missionId)?.name ?? fallbackName;
}

function formatMissionLabel(missionName: string, missionLevel?: number): React.ReactNode {
    if (typeof missionLevel === 'number' && missionLevel >= 1) {
        return (
            <>
                {missionName}{' '}
                <span className="whitespace-nowrap font-semibold text-amber-200/90 tabular-nums">Lv.{missionLevel}</span>
            </>
        );
    }
    return missionName;
}

function resolveRewardItemImage(item: InventoryItem): string {
    const lookupKey = item.name ?? (item as { itemId?: string }).itemId;
    if (item.image && item.image.trim().length > 0) {
        return item.image.startsWith('http') || item.image.startsWith('/') ? item.image : `/${item.image}`;
    }
    const template = lookupKey ? getItemTemplateByName(lookupKey) : null;
    const path = template?.image;
    if (!path) return '/images/icon/Reward.webp';
    return path.startsWith('http') || path.startsWith('/') ? path : `/${path}`;
}

const CLAIM_ITEM_SORT_ORDER = [
    '하급 강화석',
    '중급 강화석',
    '상급 강화석',
    '최상급 강화석',
    '신비의 강화석',
    '장비 상자 I',
    '장비 상자 II',
    '장비 상자 III',
    '장비 상자 IV',
    '장비 상자 V',
    '장비 상자 VI',
] as const;

function claimItemSortIndex(name: string): number {
    const idx = CLAIM_ITEM_SORT_ORDER.indexOf(name as (typeof CLAIM_ITEM_SORT_ORDER)[number]);
    return idx >= 0 ? idx : CLAIM_ITEM_SORT_ORDER.length;
}

/** 이름별로 합산해 강화석·장비상자 종류와 수량을 한눈에 보이게 한다. */
function aggregateClaimedItems(items: InventoryItem[]): Array<{ key: string; name: string; quantity: number; image: string }> {
    const byName = new Map<string, { key: string; name: string; quantity: number; image: string }>();
    for (const item of items) {
        const name = (item.name ?? (item as { itemId?: string }).itemId ?? '').trim();
        if (!name) continue;
        const quantity = Math.max(0, Number(item.quantity) || 0);
        if (quantity <= 0) continue;
        const existing = byName.get(name);
        if (existing) {
            existing.quantity += quantity;
            continue;
        }
        byName.set(name, {
            key: name,
            name,
            quantity,
            image: resolveRewardItemImage(item),
        });
    }
    return Array.from(byName.values()).sort((a, b) => {
        const order = claimItemSortIndex(a.name) - claimItemSortIndex(b.name);
        return order !== 0 ? order : a.name.localeCompare(b.name, 'ko');
    });
}

function ClaimedItemsSection({ items, compact }: { items: InventoryItem[]; compact?: boolean }) {
    const { t } = useTranslation(['lobby', 'common']);
    const localizedItemName = useLocalizedInventoryItemName();
    const aggregated = useMemo(() => aggregateClaimedItems(items), [items]);
    if (!aggregated.length) return null;

    const rowPad = compact ? 'px-2 py-1.5' : 'px-3 py-2';
    const iconClass = compact ? 'h-7 w-7' : 'h-8 w-8';
    const nameClass = compact ? 'text-xs sm:text-[13px]' : 'text-sm';
    const qtyClass = compact ? 'text-xs sm:text-[13px]' : 'text-sm';

    return (
        <div
            className={
                compact
                    ? 'w-full rounded-lg border border-amber-500/20 bg-gradient-to-b from-zinc-900/80 to-black/80 px-2 py-2'
                    : 'rounded-xl border border-amber-500/20 bg-gradient-to-b from-zinc-900/80 to-black/80 p-3'
            }
        >
            <h3
                className={
                    compact
                        ? 'mb-2 text-center text-[11px] font-bold text-amber-100/90'
                        : 'mb-3 flex items-center justify-center gap-2 text-sm font-bold text-amber-100/90'
                }
            >
                {t('singleplayer.claimAllObtainedItems')}
            </h3>
            <div className="flex flex-col gap-1.5">
                {aggregated.map((row) => (
                    <div
                        key={row.key}
                        className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 rounded-md bg-black/35 ${rowPad}`}
                    >
                        <img
                            src={row.image}
                            alt=""
                            className={`${iconClass} shrink-0 object-contain`}
                            aria-hidden
                        />
                        <span className={`min-w-0 truncate text-left font-semibold text-gray-100 ${nameClass}`}>
                            {localizedItemName(row.name)}
                        </span>
                        <span className={`shrink-0 font-bold tabular-nums text-violet-200 ${qtyClass}`}>
                            {t('singleplayer.claimAllItemQty', { quantity: row.quantity })}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ClaimRewardAmount({ reward }: { reward: ClaimAllTrainingQuestRewardsModalProps['rewards'][number] }) {
    const { t } = useTranslation(['lobby', 'common']);
    if (reward.rewardType === 'gold') {
        return (
            <>
                <img src="/images/icon/Gold.webp" alt={t('common:resources.gold')} className="h-4 w-4" />
                <span className="text-xs font-bold tabular-nums text-yellow-300 sm:text-[13px]">
                    +{formatGoldAmountKoG(reward.rewardAmount)}
                </span>
            </>
        );
    }
    if (reward.rewardType === 'diamonds') {
        return (
            <>
                <img src="/images/icon/Zem.webp" alt={t('common:resources.diamonds')} className="h-4 w-4" />
                <span className="text-xs font-bold tabular-nums text-cyan-300 sm:text-[13px]">
                    +{formatWalletDiamonds(reward.rewardAmount)}
                </span>
            </>
        );
    }
    const isEnhanceStone = reward.rewardType === 'enhance_stone';
    const icon = isEnhanceStone ? '/images/materials/materials1.webp' : '/images/Box/EquipmentBox1.webp';
    const typeName = isEnhanceStone ? t('singleplayer.enhanceStone') : t('singleplayer.equipmentBox');
    const cycles = reward.claimCycles ?? reward.rewardAmount;
    return (
        <>
            <img src={icon} alt="" className="h-4 w-4 object-contain" />
            <span className="text-xs font-bold tabular-nums text-violet-200 sm:text-[13px]">
                {t('singleplayer.claimAllRandomItems', { name: typeName, cycles })}
            </span>
        </>
    );
}

/** 모바일: transform scale 없이 1:1 렌더링. 보상 목록만 스크롤해 글·이미지가 뭉개지지 않게 함. */
function MobileClaimBody({
    rewards,
    totalGold,
    totalDiamonds,
    totalEnhanceStoneCycles,
    totalEquipmentBoxCycles,
    items,
    mode,
    onClaimNormal,
    onClaimAdDouble,
    onClose,
}: {
    rewards: ClaimAllTrainingQuestRewardsModalProps['rewards'];
    totalGold: number;
    totalDiamonds: number;
    totalEnhanceStoneCycles: number;
    totalEquipmentBoxCycles: number;
    items: InventoryItem[];
    mode: 'preview' | 'claimed';
    onClaimNormal?: () => Promise<boolean>;
    onClaimAdDouble?: () => Promise<boolean>;
    onClose: () => void;
}) {
    const { t } = useTranslation(['lobby', 'common']);
    const { showShopAdRewardInterstitial } = useAdContext();
    const [pending, setPending] = useState<'normal' | 'ad' | null>(null);

    const handleNormal = () => {
        if (!onClaimNormal || pending) return;
        setPending('normal');
        void onClaimNormal().finally(() => setPending(null));
    };
    const handleAd = () => {
        if (!onClaimAdDouble || pending) return;
        showShopAdRewardInterstitial(
            () => {
                setPending('ad');
                void onClaimAdDouble().finally(() => setPending(null));
            },
            {
                placementName: 'singleplayer-training-quest-claim-all-double',
                onDismissed: () => window.alert(t('common:ads.dismissedNoReward')),
            },
        );
    };
    const previewMode = mode === 'preview';

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <h2 className="shrink-0 px-0.5 text-center text-xs font-bold leading-snug text-white/95 sm:text-sm">
                {previewMode ? t('singleplayer.claimAllPreviewTitle') : t('singleplayer.claimAllSuccess')}
            </h2>

            <div
                className="mt-1.5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-lg bg-gray-900/50 px-1.5 py-1.5 [-webkit-overflow-scrolling:touch] [scrollbar-gutter:auto]"
            >
                <div className="flex flex-col gap-1">
                    {rewards.map((reward) => {
                        const missionInfo = SINGLE_PLAYER_MISSIONS.find((m) => m.id === reward.missionId);
                        const displayName = resolveMissionDisplayName(reward.missionId, reward.missionName);
                        return (
                            <div
                                key={reward.missionId}
                                className="flex items-start justify-between gap-2 rounded-md bg-gray-800/50 px-2 py-1.5"
                            >
                                <div className="flex min-w-0 flex-1 items-start gap-2">
                                    {missionInfo && (
                                        <img
                                            src={missionInfo.image}
                                            alt={
                                                typeof reward.missionLevel === 'number' && reward.missionLevel >= 1
                                                    ? `${displayName} Lv.${reward.missionLevel}`
                                                    : displayName
                                            }
                                            className="mt-0.5 h-8 w-8 shrink-0 rounded object-cover"
                                            loading="lazy"
                                            decoding="async"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                            }}
                                        />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <h3 className="break-words text-left text-xs font-semibold leading-snug text-white sm:text-[13px]">
                                            {formatMissionLabel(displayName, reward.missionLevel)}
                                        </h3>
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                                    <ClaimRewardAmount reward={reward} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="mt-2 flex shrink-0 flex-col items-center gap-2 border-t border-white/10 pt-2">
                <ClaimAllTotalsBox
                    totalGold={totalGold}
                    totalDiamonds={totalDiamonds}
                    totalEnhanceStoneCycles={previewMode ? totalEnhanceStoneCycles : 0}
                    totalEquipmentBoxCycles={previewMode ? totalEquipmentBoxCycles : 0}
                    variant="compact"
                />
                {!previewMode && items.length > 0 && (
                    <div className="w-full max-w-[16rem]">
                        <ClaimedItemsSection items={items} compact />
                    </div>
                )}

                {previewMode ? (
                    <div className="grid w-full grid-cols-2 gap-2">
                        <Button
                            onClick={handleAd}
                            disabled={pending != null}
                            colorScheme="none"
                            bare
                            className={`${PREMIUM_QUEST_BTN.claimAllConfirm} mt-0.5 !w-full !max-w-none !whitespace-nowrap !px-2 !text-xs sm:!text-sm`}
                            cooldownMs={0}
                        >
                            {pending === 'ad' ? (
                                <AdDoubleButtonLabel claiming />
                            ) : (
                                <AdDoubleButtonLabel />
                            )}
                        </Button>
                        <Button
                            onClick={handleNormal}
                            disabled={pending != null}
                            colorScheme="none"
                            bare
                            className={`${PREMIUM_QUEST_BTN.claimAllConfirm} mt-0.5 !w-full !max-w-none !whitespace-nowrap !px-2 !text-xs sm:!text-sm`}
                            cooldownMs={0}
                        >
                            {pending === 'normal' ? t('singleplayer.claiming') : t('singleplayer.claimAllNormal')}
                        </Button>
                    </div>
                ) : (
                    <Button onClick={onClose} colorScheme="none" bare className={`${PREMIUM_QUEST_BTN.claimAllConfirm} mt-0.5`} cooldownMs={0}>
                        {t('common:actions.ok')}
                    </Button>
                )}
            </div>
        </div>
    );
}

const ClaimAllTrainingQuestRewardsModal: React.FC<ClaimAllTrainingQuestRewardsModalProps> = ({
    rewards,
    totalGold,
    totalDiamonds,
    items,
    mode = 'claimed',
    onClaimNormal,
    onClaimAdDouble,
    onClose,
    isTopmost,
}) => {
    const { t } = useTranslation(['lobby', 'common']);
    const { showShopAdRewardInterstitial } = useAdContext();
    const isHandheld = useIsHandheldDevice(1025);
    const { isNativeMobile } = useNativeMobileShell();
    const isCompactUi = isHandheld || isNativeMobile;
    const [pending, setPending] = useState<'normal' | 'ad' | null>(null);
    const previewMode = mode === 'preview';
    const claimedItems = Array.isArray(items) ? items : [];
    const totalEnhanceStoneCycles = sumItemRewardCycles(rewards, 'enhance_stone');
    const totalEquipmentBoxCycles = sumItemRewardCycles(rewards, 'equipment_box');
    // 수령 후에는 실제 아이템 타일로 대체하므로 사이클 합계는 미리보기에서만 표시
    const showItemCycleTotals = previewMode;
    const hasTotals =
        totalGold > 0 ||
        totalDiamonds > 0 ||
        (showItemCycleTotals && totalEnhanceStoneCycles > 0) ||
        (showItemCycleTotals && totalEquipmentBoxCycles > 0) ||
        (!previewMode && claimedItems.length > 0);
    const totalsRowCount =
        (totalGold > 0 ? 1 : 0) +
        (totalDiamonds > 0 ? 1 : 0) +
        (showItemCycleTotals && totalEnhanceStoneCycles > 0 ? 1 : 0) +
        (showItemCycleTotals && totalEquipmentBoxCycles > 0 ? 1 : 0) +
        (!previewMode && claimedItems.length > 0 ? 1 : 0);

    const handleNormal = () => {
        if (!onClaimNormal || pending) return;
        setPending('normal');
        void onClaimNormal().finally(() => setPending(null));
    };
    const handleAd = () => {
        if (!onClaimAdDouble || pending) return;
        showShopAdRewardInterstitial(
            () => {
                setPending('ad');
                void onClaimAdDouble().finally(() => setPending(null));
            },
            {
                placementName: 'singleplayer-training-quest-claim-all-double',
                onDismissed: () => window.alert(t('common:ads.dismissedNoReward')),
            },
        );
    };

    /** 헤더·푸터·패딩·본문 블록을 반영해 내용이 잘리지 않게 높이 추정, 뷰포트 상한 내에서만 캡 */
    const panelInitialHeight = useMemo(() => {
        if (typeof window === 'undefined') return isCompactUi ? 560 : 640;
        const vh = window.innerHeight;
        const cap = Math.floor(vh * 0.92);
        const safe = Math.max(0, vh - Math.floor(vh * 0.08));
        const useCap = Math.min(cap, safe);

        if (isCompactUi) {
            const chrome = 56 + 8;
            const bodyPad = 36;
            const title = 40;
            const row = 52;
            const list = Math.max(48, rewards.length * row + 8);
            const totals = hasTotals ? 48 + totalsRowCount * 36 : 0;
            const btn = 96;
            const inner = title + list + totals + btn;
            return Math.min(Math.max(280, chrome + bodyPad + inner), useCap);
        }
        const chrome = 52 + 48;
        const bodyPad = 40;
        const title = 56;
        const row = 60;
        const list = Math.max(56, rewards.length * row + 12);
        const totals = hasTotals ? 56 + totalsRowCount * 40 : 0;
        const btn = 72;
        const inner = title + list + totals + btn;
        return Math.min(Math.max(340, chrome + bodyPad + inner), useCap);
    }, [claimedItems.length, hasTotals, isCompactUi, rewards.length, totalsRowCount]);

    return (
        <DraggableWindow
            title={t('singleplayer.claimAllModalTitle')}
            modal={true}
            closeOnOutsideClick={true}
            onClose={onClose}
            windowId="claim-all-training-quest-rewards"
            initialWidth={isCompactUi ? 360 : 500}
            initialHeight={panelInitialHeight}
            isTopmost={isTopmost}
            zIndex={10000}
            mobileViewportFit={isCompactUi}
            mobileViewportMaxHeightVh={92}
            mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - max(16px, env(safe-area-inset-top, 0px)) - max(16px, env(safe-area-inset-bottom, 0px))))"
            pcViewportMaxHeightCss="min(92dvh, calc(100dvh - 1.5rem))"
            bodyNoScroll={isCompactUi}
            bodyPaddingClassName={
                isCompactUi
                    ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2 sm:px-3 sm:pb-[max(0.65rem,env(safe-area-inset-bottom,0px))] sm:pt-2.5'
                    : 'p-4'
            }
        >
            {isCompactUi ? (
                <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden text-on-panel">
                    <MobileClaimBody
                        rewards={rewards}
                        totalGold={totalGold}
                        totalDiamonds={totalDiamonds}
                        totalEnhanceStoneCycles={totalEnhanceStoneCycles}
                        totalEquipmentBoxCycles={totalEquipmentBoxCycles}
                        items={claimedItems}
                        mode={mode}
                        onClaimNormal={onClaimNormal}
                        onClaimAdDouble={onClaimAdDouble}
                        onClose={onClose}
                    />
                </div>
            ) : (
                <div className="mx-auto flex w-full max-w-[min(100%,26rem)] min-h-0 flex-col text-center text-on-panel">
                    <h2 className="mb-3 shrink-0 text-lg font-bold leading-snug sm:text-xl">
                        {previewMode ? t('singleplayer.claimAllPreviewTitle') : t('singleplayer.claimAllSuccess')}
                    </h2>

                    <div className="mb-3 min-h-0 space-y-1.5 overflow-x-hidden overflow-y-visible rounded-lg bg-gray-900/50 p-3">
                        {rewards.map((reward) => {
                            const missionInfo = SINGLE_PLAYER_MISSIONS.find((m) => m.id === reward.missionId);
                            const displayName = resolveMissionDisplayName(reward.missionId, reward.missionName);
                            return (
                                <div
                                    key={reward.missionId}
                                    className="flex items-center justify-between gap-2 rounded-lg bg-gray-800/50 p-2.5"
                                >
                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                        {missionInfo && (
                                            <img
                                                src={missionInfo.image}
                                                alt={
                                                    typeof reward.missionLevel === 'number' && reward.missionLevel >= 1
                                                        ? `${displayName} Lv.${reward.missionLevel}`
                                                        : displayName
                                                }
                                                className="h-9 w-9 flex-shrink-0 rounded-lg object-cover"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                }}
                                            />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <h3 className="truncate text-left text-xs font-bold text-white sm:text-sm">
                                                {formatMissionLabel(displayName, reward.missionLevel)}
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                        <ClaimRewardAmount reward={reward} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {(totalGold > 0 || totalDiamonds > 0 || (previewMode && (totalEnhanceStoneCycles > 0 || totalEquipmentBoxCycles > 0))) && (
                        <div className="mb-3 flex justify-center">
                            <ClaimAllTotalsBox
                                totalGold={totalGold}
                                totalDiamonds={totalDiamonds}
                                totalEnhanceStoneCycles={previewMode ? totalEnhanceStoneCycles : 0}
                                totalEquipmentBoxCycles={previewMode ? totalEquipmentBoxCycles : 0}
                                variant="comfortable"
                            />
                        </div>
                    )}
                    {!previewMode && claimedItems.length > 0 && (
                        <div className="mb-3">
                            <ClaimedItemsSection items={claimedItems} />
                        </div>
                    )}

                    {previewMode ? (
                        <div className="grid grid-cols-2 justify-center gap-2 pt-1">
                            <Button
                                onClick={handleAd}
                                disabled={pending != null}
                                colorScheme="none"
                                bare
                                className={`${PREMIUM_QUEST_BTN.claimAllConfirm} !w-full !max-w-none !whitespace-nowrap !px-3`}
                                cooldownMs={0}
                            >
                                {pending === 'ad' ? <AdDoubleButtonLabel claiming /> : <AdDoubleButtonLabel />}
                            </Button>
                            <Button
                                onClick={handleNormal}
                                disabled={pending != null}
                                colorScheme="none"
                                bare
                                className={`${PREMIUM_QUEST_BTN.claimAllConfirm} !w-full !max-w-none !whitespace-nowrap !px-3`}
                                cooldownMs={0}
                            >
                                {pending === 'normal' ? t('singleplayer.claiming') : t('singleplayer.claimAllNormal')}
                            </Button>
                        </div>
                    ) : (
                        <div className="flex justify-center pt-1">
                            <Button onClick={onClose} colorScheme="none" bare className={PREMIUM_QUEST_BTN.claimAllConfirm} cooldownMs={0}>
                                {t('common:actions.ok')}
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </DraggableWindow>
    );
};

export default ClaimAllTrainingQuestRewardsModal;
