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

const CLAIM_MODAL_FRAME =
    'overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-b from-zinc-950/95 via-zinc-900/90 to-black shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_40px_rgba(0,0,0,0.45)]';

function ClaimHeroHeader({ previewMode, compact }: { previewMode: boolean; compact?: boolean }) {
    const { t } = useTranslation(['lobby', 'common']);
    return (
        <div
            className={
                compact
                    ? 'shrink-0 border-b border-amber-500/15 bg-gradient-to-r from-amber-950/55 via-black/35 to-amber-950/55 px-3 py-3 text-center'
                    : 'shrink-0 border-b border-amber-500/15 bg-gradient-to-r from-amber-950/55 via-black/35 to-amber-950/55 px-5 py-5 text-center'
            }
        >
            <p
                className={
                    compact
                        ? 'text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-200/65'
                        : 'text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/70'
                }
            >
                Reward
            </p>
            <h2
                className={
                    compact
                        ? 'mt-1 bg-gradient-to-r from-amber-50 via-amber-200 to-amber-100 bg-clip-text text-sm font-black tracking-tight text-transparent sm:text-base'
                        : 'mt-2 bg-gradient-to-r from-amber-50 via-amber-200 to-amber-100 bg-clip-text text-xl font-black tracking-tight text-transparent sm:text-2xl'
                }
            >
                {previewMode ? t('singleplayer.claimAllPreviewTitle') : t('singleplayer.claimAllSuccess')}
            </h2>
        </div>
    );
}

function ClaimSectionTitle({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
    return (
        <h3
            className={
                compact
                    ? 'mb-2 flex items-center justify-center gap-2 text-[11px] font-bold text-amber-100/90'
                    : 'mb-3 flex items-center justify-center gap-2 text-sm font-bold text-amber-100/90'
            }
        >
            <span className="h-px w-5 bg-gradient-to-r from-transparent to-amber-500/50 sm:w-6" aria-hidden />
            {children}
            <span className="h-px w-5 bg-gradient-to-l from-transparent to-amber-500/50 sm:w-6" aria-hidden />
        </h3>
    );
}

function ClaimFacilityRows({
    rewards,
    compact,
}: {
    rewards: ClaimAllTrainingQuestRewardsModalProps['rewards'];
    compact?: boolean;
}) {
    return (
        <div className={compact ? 'flex flex-col gap-1.5' : 'flex flex-col gap-2'}>
            {rewards.map((reward) => {
                const missionInfo = SINGLE_PLAYER_MISSIONS.find((m) => m.id === reward.missionId);
                const displayName = resolveMissionDisplayName(reward.missionId, reward.missionName);
                return (
                    <div
                        key={reward.missionId}
                        className={
                            compact
                                ? 'flex items-start justify-between gap-2 rounded-xl border border-white/[0.06] bg-gradient-to-r from-zinc-900/80 via-black/40 to-zinc-900/70 px-2.5 py-2 shadow-inner'
                                : 'flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-gradient-to-r from-zinc-900/80 via-black/40 to-zinc-900/70 px-3 py-2.5 shadow-inner'
                        }
                    >
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            {missionInfo && (
                                <img
                                    src={missionInfo.image}
                                    alt={
                                        typeof reward.missionLevel === 'number' && reward.missionLevel >= 1
                                            ? `${displayName} Lv.${reward.missionLevel}`
                                            : displayName
                                    }
                                    className={
                                        compact
                                            ? 'mt-0.5 h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-amber-400/25'
                                            : 'h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-amber-400/25'
                                    }
                                    loading="lazy"
                                    decoding="async"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                    }}
                                />
                            )}
                            <div className="min-w-0 flex-1">
                                <h3
                                    className={
                                        compact
                                            ? 'break-words text-left text-xs font-semibold leading-snug text-amber-50 sm:text-[13px]'
                                            : 'truncate text-left text-sm font-bold text-amber-50'
                                    }
                                >
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
    );
}

type ClaimRewardSummaryTile = {
    key: string;
    icon: string;
    iconAlt: string;
    nameLabel: string;
    amountLabel: string;
    amountClass: string;
    tileClass: string;
};

/** 골드·다이아·강화석·장비상자를 2x2 획득 보상 그리드로 표시 */
function ClaimAllRewardsSummary({
    totalGold,
    totalDiamonds,
    totalEnhanceStoneCycles,
    totalEquipmentBoxCycles,
    claimedItems,
    compact,
}: {
    totalGold: number;
    totalDiamonds: number;
    totalEnhanceStoneCycles: number;
    totalEquipmentBoxCycles: number;
    claimedItems?: InventoryItem[];
    compact?: boolean;
}) {
    const { t } = useTranslation(['lobby', 'common']);
    const localizedItemName = useLocalizedInventoryItemName();
    const aggregatedItems = useMemo(
        () => (claimedItems?.length ? aggregateClaimedItems(claimedItems) : []),
        [claimedItems],
    );

    const tiles = useMemo(() => {
        const next: ClaimRewardSummaryTile[] = [];
        if (totalGold > 0) {
            next.push({
                key: 'gold',
                icon: '/images/icon/Gold.webp',
                iconAlt: t('common:resources.gold'),
                nameLabel: t('common:resources.gold'),
                amountLabel: `+${formatGoldAmountKoG(totalGold)}`,
                amountClass: 'text-amber-200',
                tileClass:
                    'border-amber-400/30 bg-gradient-to-b from-amber-950/55 via-amber-950/25 to-black/50 shadow-[inset_0_1px_0_rgba(251,191,36,0.12)]',
            });
        }
        if (totalDiamonds > 0) {
            next.push({
                key: 'diamonds',
                icon: '/images/icon/Zem.webp',
                iconAlt: t('common:resources.diamonds'),
                nameLabel: t('common:resources.diamonds'),
                amountLabel: `+${formatWalletDiamonds(totalDiamonds)}`,
                amountClass: 'text-cyan-200',
                tileClass:
                    'border-cyan-400/30 bg-gradient-to-b from-cyan-950/50 via-cyan-950/20 to-black/50 shadow-[inset_0_1px_0_rgba(34,211,238,0.12)]',
            });
        }
        if (totalEnhanceStoneCycles > 0) {
            next.push({
                key: 'enhance_stone',
                icon: '/images/materials/materials1.webp',
                iconAlt: t('singleplayer.enhanceStone'),
                nameLabel: t('singleplayer.enhanceStone'),
                amountLabel: t('singleplayer.claimAllItemQty', { quantity: totalEnhanceStoneCycles }),
                amountClass: 'text-violet-100',
                tileClass:
                    'border-violet-400/30 bg-gradient-to-b from-violet-950/50 via-violet-950/20 to-black/50 shadow-[inset_0_1px_0_rgba(167,139,250,0.12)]',
            });
        }
        if (totalEquipmentBoxCycles > 0) {
            next.push({
                key: 'equipment_box',
                icon: '/images/Box/EquipmentBox1.webp',
                iconAlt: t('singleplayer.equipmentBox'),
                nameLabel: t('singleplayer.equipmentBox'),
                amountLabel: t('singleplayer.claimAllItemQty', { quantity: totalEquipmentBoxCycles }),
                amountClass: 'text-rose-100',
                tileClass:
                    'border-rose-400/25 bg-gradient-to-b from-rose-950/45 via-rose-950/20 to-black/50 shadow-[inset_0_1px_0_rgba(251,113,133,0.1)]',
            });
        }
        return next;
    }, [t, totalDiamonds, totalEnhanceStoneCycles, totalEquipmentBoxCycles, totalGold]);

    if (!tiles.length && !aggregatedItems.length) return null;

    const shell = compact
        ? 'w-full rounded-xl border border-amber-500/25 bg-gradient-to-b from-zinc-900/90 via-zinc-950/80 to-black/90 px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
        : 'w-full rounded-2xl border border-amber-500/25 bg-gradient-to-b from-zinc-900/90 via-zinc-950/80 to-black/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';
    const tilePad = compact ? 'px-2 py-2.5' : 'px-3 py-3.5';
    const iconClass = compact ? 'h-8 w-8' : 'h-10 w-10';
    const nameText = compact ? 'text-[10px] sm:text-[11px]' : 'text-[11px] sm:text-xs';
    const amountText = compact ? 'text-sm sm:text-[15px]' : 'text-base sm:text-lg';
    const detailPad = compact ? 'px-2.5 py-1.5' : 'px-3 py-2.5';
    const detailIcon = compact ? 'h-7 w-7' : 'h-8 w-8';
    const detailText = compact ? 'text-xs sm:text-[13px]' : 'text-sm';

    return (
        <div className={shell}>
            <ClaimSectionTitle compact={compact}>{t('singleplayer.claimAllObtainedItems')}</ClaimSectionTitle>
            {tiles.length > 0 && (
                <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-2.5'}`}>
                    {tiles.map((tile) => (
                        <div
                            key={tile.key}
                            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border ${tile.tileClass} ${tilePad}`}
                        >
                            <img
                                src={tile.icon}
                                alt={tile.iconAlt}
                                className={`${iconClass} shrink-0 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]`}
                            />
                            <span className={`w-full truncate text-center font-semibold text-zinc-300/90 ${nameText}`} title={tile.nameLabel}>
                                {tile.nameLabel}
                            </span>
                            <span
                                className={`w-full truncate text-center font-extrabold tabular-nums tracking-tight ${amountText} ${tile.amountClass}`}
                                title={tile.amountLabel}
                            >
                                {tile.amountLabel}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            {aggregatedItems.length > 0 && (
                <div
                    className={`flex flex-col gap-1.5 ${
                        tiles.length > 0
                            ? compact
                                ? 'mt-2.5 border-t border-amber-500/15 pt-2.5'
                                : 'mt-3.5 border-t border-amber-500/15 pt-3.5'
                            : ''
                    }`}
                >
                    {aggregatedItems.map((row) => (
                        <div
                            key={row.key}
                            className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 rounded-lg border border-white/[0.05] bg-black/40 ${detailPad}`}
                        >
                            <img
                                src={row.image}
                                alt=""
                                className={`${detailIcon} shrink-0 object-contain`}
                                aria-hidden
                            />
                            <span className={`min-w-0 truncate text-left font-semibold text-zinc-100 ${detailText}`}>
                                {localizedItemName(row.name)}
                            </span>
                            <span className={`shrink-0 font-bold tabular-nums text-amber-200 ${detailText}`}>
                                {t('singleplayer.claimAllItemQty', { quantity: row.quantity })}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ClaimRewardAmount({ reward }: { reward: ClaimAllTrainingQuestRewardsModalProps['rewards'][number] }) {
    const { t } = useTranslation(['lobby', 'common']);
    if (reward.rewardType === 'gold') {
        return (
            <>
                <img src="/images/icon/Gold.webp" alt={t('common:resources.gold')} className="h-5 w-5" />
                <span className="text-xs font-extrabold tabular-nums text-amber-200 sm:text-sm">
                    +{formatGoldAmountKoG(reward.rewardAmount)}
                </span>
            </>
        );
    }
    if (reward.rewardType === 'diamonds') {
        return (
            <>
                <img src="/images/icon/Zem.webp" alt={t('common:resources.diamonds')} className="h-5 w-5" />
                <span className="text-xs font-extrabold tabular-nums text-cyan-200 sm:text-sm">
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
            <img src={icon} alt="" className="h-5 w-5 object-contain" />
            <span className="text-xs font-extrabold tabular-nums text-violet-100 sm:text-sm">
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
        <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${CLAIM_MODAL_FRAME}`}>
            <ClaimHeroHeader previewMode={previewMode} compact />

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2.5 pb-2.5 pt-2 sm:px-3 sm:pb-3">
                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-xl border border-white/[0.04] bg-black/30 px-2 py-2 [-webkit-overflow-scrolling:touch] [scrollbar-gutter:auto]">
                    <ClaimFacilityRows rewards={rewards} compact />
                </div>

                <div className="mt-2.5 flex shrink-0 flex-col items-center gap-2.5">
                    <ClaimAllRewardsSummary
                        totalGold={totalGold}
                        totalDiamonds={totalDiamonds}
                        totalEnhanceStoneCycles={totalEnhanceStoneCycles}
                        totalEquipmentBoxCycles={totalEquipmentBoxCycles}
                        claimedItems={!previewMode ? items : undefined}
                        compact
                    />

                    {previewMode ? (
                        <div className="grid w-full grid-cols-2 gap-2">
                            <Button
                                onClick={handleAd}
                                disabled={pending != null}
                                colorScheme="none"
                                bare
                                className={`${PREMIUM_QUEST_BTN.claimAllConfirm} !w-full !max-w-none !whitespace-nowrap !px-2 !text-xs sm:!text-sm`}
                                cooldownMs={0}
                            >
                                {pending === 'ad' ? <AdDoubleButtonLabel claiming /> : <AdDoubleButtonLabel />}
                            </Button>
                            <Button
                                onClick={handleNormal}
                                disabled={pending != null}
                                colorScheme="none"
                                bare
                                className={`${PREMIUM_QUEST_BTN.claimAllConfirm} !w-full !max-w-none !whitespace-nowrap !px-2 !text-xs sm:!text-sm`}
                                cooldownMs={0}
                            >
                                {pending === 'normal' ? t('singleplayer.claiming') : t('singleplayer.claimAllNormal')}
                            </Button>
                        </div>
                    ) : (
                        <Button
                            onClick={onClose}
                            colorScheme="none"
                            bare
                            className={`${PREMIUM_QUEST_BTN.claimAllConfirm} !max-w-[12rem]`}
                            cooldownMs={0}
                        >
                            {t('common:actions.ok')}
                        </Button>
                    )}
                </div>
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
    const summaryTileCount =
        (totalGold > 0 ? 1 : 0) +
        (totalDiamonds > 0 ? 1 : 0) +
        (totalEnhanceStoneCycles > 0 ? 1 : 0) +
        (totalEquipmentBoxCycles > 0 ? 1 : 0);
    const claimedItemRowCount = !previewMode ? aggregateClaimedItems(claimedItems).length : 0;
    const hasTotals = summaryTileCount > 0 || claimedItemRowCount > 0;

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
        if (typeof window === 'undefined') return isCompactUi ? 620 : 720;
        const vh = window.innerHeight;
        const cap = Math.floor(vh * 0.9);
        const safe = Math.max(0, vh - Math.floor(vh * 0.08));
        const useCap = Math.min(cap, safe);

        const summaryGridRows = Math.ceil(summaryTileCount / 2);
        if (isCompactUi) {
            const chrome = 56 + 8;
            const bodyPad = 28;
            const hero = 72;
            const row = 58;
            const list = Math.min(220, Math.max(64, rewards.length * row + 12));
            const totals = hasTotals ? 40 + summaryGridRows * 88 + claimedItemRowCount * 36 : 0;
            const btn = 88;
            const inner = hero + list + totals + btn;
            return Math.min(Math.max(360, chrome + bodyPad + inner), useCap);
        }
        const chrome = 52 + 48;
        const bodyPad = 36;
        const hero = 96;
        const row = 68;
        const list = Math.min(280, Math.max(80, rewards.length * row + 16));
        const totals = hasTotals ? 52 + summaryGridRows * 100 + claimedItemRowCount * 40 : 0;
        const btn = 80;
        const inner = hero + list + totals + btn;
        return Math.min(Math.max(420, chrome + bodyPad + inner), useCap);
    }, [claimedItemRowCount, hasTotals, isCompactUi, rewards.length, summaryTileCount]);

    return (
        <DraggableWindow
            title={t('singleplayer.claimAllModalTitle')}
            modal={true}
            closeOnOutsideClick={true}
            onClose={onClose}
            windowId="claim-all-training-quest-rewards"
            initialWidth={isCompactUi ? 392 : 560}
            initialHeight={panelInitialHeight}
            isTopmost={isTopmost}
            zIndex={10000}
            mobileViewportFit={isCompactUi}
            mobileViewportMaxHeightVh={90}
            mobileViewportMaxHeightCss="min(90dvh, calc(100dvh - max(16px, env(safe-area-inset-top, 0px)) - max(16px, env(safe-area-inset-bottom, 0px))))"
            pcViewportMaxHeightCss="min(90dvh, calc(100dvh - 1.5rem))"
            bodyNoScroll={isCompactUi}
            bodyPaddingClassName={
                isCompactUi
                    ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-2 pb-[max(0.45rem,env(safe-area-inset-bottom,0px))] pt-1.5 sm:px-2.5 sm:pb-[max(0.55rem,env(safe-area-inset-bottom,0px))] sm:pt-2'
                    : 'p-3 sm:p-4'
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
                <div className={`${CLAIM_MODAL_FRAME} mx-auto flex w-full min-h-0 flex-col text-center text-on-panel`}>
                    <ClaimHeroHeader previewMode={previewMode} />

                    <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                        <div className="mb-3 max-h-[min(40vh,18rem)] min-h-0 overflow-x-hidden overflow-y-auto rounded-xl border border-white/[0.04] bg-black/30 p-3">
                            <ClaimFacilityRows rewards={rewards} />
                        </div>

                        {hasTotals && (
                            <div className="mb-4">
                                <ClaimAllRewardsSummary
                                    totalGold={totalGold}
                                    totalDiamonds={totalDiamonds}
                                    totalEnhanceStoneCycles={totalEnhanceStoneCycles}
                                    totalEquipmentBoxCycles={totalEquipmentBoxCycles}
                                    claimedItems={!previewMode ? claimedItems : undefined}
                                />
                            </div>
                        )}

                        {previewMode ? (
                            <div className="grid grid-cols-2 justify-center gap-2.5 pt-0.5">
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
                            <div className="flex justify-center pt-0.5">
                                <Button
                                    onClick={onClose}
                                    colorScheme="none"
                                    bare
                                    className={`${PREMIUM_QUEST_BTN.claimAllConfirm} !max-w-[12.5rem]`}
                                    cooldownMs={0}
                                >
                                    {t('common:actions.ok')}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </DraggableWindow>
    );
};

export default ClaimAllTrainingQuestRewardsModal;
