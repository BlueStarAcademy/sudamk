import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../hooks/useAppContext.js';
import { Guild as GuildType, ServerAction, InventoryItem, ItemGrade } from '../../types/index.js';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { GUILD_SHOP_ITEMS, GuildShopItem } from '../../constants/guildConstants.js';
import { buildInventoryItemPreviewForPurchase } from '../../shared/utils/bagItemDetailHelpers.js';
import { EquipmentDetailPanel } from '../EquipmentDetailPanel.js';
import { isDifferentWeekKST, isDifferentMonthKST } from '../../utils/timeUtils.js';
import { addItemsToInventory } from '../../utils/inventoryUtils.js';
import { CONSUMABLE_ITEMS, MATERIAL_ITEMS } from '../../constants/index.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';

interface GuildShopModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

type ShopTab = 'equipment' | 'material' | 'consumable';

const gradeBackgrounds: Record<ItemGrade, string> = {
    normal: '/images/equipments/normalbgi.webp',
    uncommon: '/images/equipments/uncommonbgi.webp',
    rare: '/images/equipments/rarebgi.webp',
    epic: '/images/equipments/epicbgi.webp',
    legendary: '/images/equipments/legendarybgi.webp',
    mythic: '/images/equipments/mythicbgi.webp',
    transcendent: '/images/equipments/transcendentbgi.webp',
};


const ShopItemCard: React.FC<{ item: GuildShopItem; isNativeMobile: boolean; onShowDetail: (item: GuildShopItem) => void }> = ({
    item,
    isNativeMobile,
    onShowDetail,
}) => {
    const { t } = useTranslation(['guild', 'common']);
    const { handlers, currentUserWithStatus } = useAppContext();

    const purchaseRecord = currentUserWithStatus?.dailyShopPurchases?.[item.itemId];
    const now = Date.now();
    let purchasesThisPeriod = 0;

    if (purchaseRecord) {
        if (item.limitType === 'account') {
            purchasesThisPeriod = purchaseRecord.quantity;
        } else {
            const ts = purchaseRecord.lastPurchaseTimestamp ?? purchaseRecord.date;
            if (item.limitType === 'weekly' && !isDifferentWeekKST(ts, now)) {
                purchasesThisPeriod = purchaseRecord.quantity;
            }
            if (item.limitType === 'monthly' && !isDifferentMonthKST(ts, now)) {
                purchasesThisPeriod = purchaseRecord.quantity;
            }
        }
    }

    const remaining = item.limit - purchasesThisPeriod;
    const canAfford = (currentUserWithStatus?.guildCoins ?? 0) >= item.cost;
    const canPurchase = remaining > 0 && canAfford;

    const handleBuy = () => {
        if (canPurchase) {
            handlers.handleAction({
                type: 'GUILD_BUY_SHOP_ITEM',
                payload: { shopItemId: item.itemId, itemId: item.itemId, quantity: 1 }
            });
        }
    };

    return (
        <div
            className={`group relative flex flex-col items-center overflow-visible rounded-xl border border-indigo-400/35 bg-gradient-to-br from-[#1f2239]/95 via-[#0f172a]/95 to-[#060b12]/95 text-center shadow-[0_22px_55px_-30px_rgba(99,102,241,0.65)] transition-transform duration-300 ${
                isNativeMobile
                    ? 'p-2.5'
                    : 'p-3.5 hover:-translate-y-1 hover:shadow-[0_30px_70px_-32px_rgba(129,140,248,0.65)]'
            }`}
        >
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/80 to-transparent" />
                {!isNativeMobile ? (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.35),transparent_65%)] opacity-0 transition-opacity duration-500 group-hover:opacity-20" />
                ) : null}
            </div>
            <button
                type="button"
                title={t('shop.detailInfo')}
                className={`relative z-[1] flex items-center justify-center rounded-xl bg-gradient-to-br from-[#312e81]/40 via-[#1e1b4b]/25 to-transparent shadow-[0_0_28px_-8px_rgba(129,140,248,0.7)] transition-transform active:scale-95 ${
                    isNativeMobile
                        ? 'mb-2 h-[5.5rem] w-[5.5rem]'
                        : 'mb-2.5 h-28 w-28 hover:scale-105'
                }`}
                onClick={() => onShowDetail(item)}
            >
                <img
                    src={item.image}
                    alt={item.name}
                    className={`h-full w-full object-contain drop-shadow-[0_6px_12px_rgba(30,64,175,0.4)] ${
                        isNativeMobile ? 'p-1.5' : 'p-2'
                    }`}
                />
            </button>
            <button
                type="button"
                className={`relative z-[1] w-full text-center font-semibold leading-tight tracking-wide text-white drop-shadow-[0_2px_12px_rgba(99,102,241,0.55)] line-clamp-2 hover:text-amber-100/95 ${
                    isNativeMobile ? 'min-h-[2.5rem] text-[11px]' : 'min-h-[2.5rem] text-sm'
                }`}
                title={t('shop.detailInfo')}
                onClick={() => onShowDetail(item)}
            >
                {item.name}
            </button>
            <div
                className={`relative z-[1] flex w-full flex-col items-stretch justify-center ${
                    isNativeMobile ? 'mt-1.5 gap-1' : 'mt-2 gap-1.5'
                }`}
            >
                <Button
                    onClick={handleBuy}
                    disabled={!canPurchase}
                    colorScheme="none"
                    className={`w-full justify-center rounded-lg border border-amber-400/50 bg-gradient-to-r from-amber-400/90 via-amber-300/90 to-amber-500/90 text-slate-900 shadow-[0_12px_32px_-18px_rgba(251,191,36,0.85)] hover:from-amber-300 hover:to-amber-500 ${
                        !canPurchase ? 'cursor-not-allowed opacity-50' : ''
                    } ${isNativeMobile ? 'py-2' : 'py-1.5'}`}
                >
                    <div className="flex flex-col items-center justify-center gap-0.5">
                        <div
                            className={`flex items-center justify-center font-semibold tracking-wide ${
                                isNativeMobile ? 'gap-1 text-[13px]' : 'gap-1.5 text-xs'
                            }`}
                        >
                            <img
                                src="/images/guild/tokken.webp"
                                alt={t('common:resources.guildCoins')}
                                className={isNativeMobile ? 'h-4 w-4 drop-shadow-md' : 'h-5 w-5 drop-shadow-md'}
                            />
                            <span>{item.cost.toLocaleString()}</span>
                        </div>
                        <span className={`tracking-wide text-slate-700/90 ${isNativeMobile ? 'text-[10px]' : 'text-[9px]'}`}>
                            {item.limitType === 'account'
                                ? t('shop.limitAccount', { current: purchasesThisPeriod, limit: item.limit })
                                : item.limitType === 'weekly'
                                  ? t('shop.limitWeekly', { remaining, limit: item.limit })
                                  : t('shop.limitMonthly', { remaining, limit: item.limit })}
                        </span>
                    </div>
                </Button>
            </div>
        </div>
    );
};


const GuildShopModal: React.FC<GuildShopModalProps> = ({ onClose, isTopmost }) => {
    const { t } = useTranslation(['guild', 'common']);
    const { currentUserWithStatus } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const [activeTab, setActiveTab] = useState<ShopTab>('equipment');
    const [detailItem, setDetailItem] = useState<GuildShopItem | null>(null);

    const guildDetailPreview = useMemo(() => {
        if (!detailItem) return null;
        return buildInventoryItemPreviewForPurchase({
            itemId: detailItem.itemId,
            name: detailItem.name,
            type: detailItem.type === 'equipment_box' ? 'consumable' : detailItem.type,
            image: detailItem.image,
            description: detailItem.description,
            gradeHint: detailItem.grade,
        });
    }, [detailItem]);

    const shopItemsForTab = useMemo(() => {
        const typeMap: Record<ShopTab, GuildShopItem['type'] | 'equipment_box'> = {
            'equipment': 'equipment_box',
            'material': 'material',
            'consumable': 'consumable',
        };
        return GUILD_SHOP_ITEMS.filter(item => item.type === typeMap[activeTab]);
    }, [activeTab]);

    return (
        <>
        <DraggableWindow
            title={t('shop.title')}
            onClose={onClose}
            windowId="guild-shop"
            initialWidth={900}
            initialHeight={750}
            isTopmost={isTopmost}
            variant="store"
            mobileViewportFit={isNativeMobile}
            mobileViewportMaxHeightVh={94}
            bodyScrollable={false}
            bodyNoScroll
            bodyPaddingClassName={
                isNativeMobile
                    ? 'flex min-h-0 min-w-0 flex-1 flex-col !px-2.5 !pt-2.5 !pb-[max(0.8rem,env(safe-area-inset-bottom,0px))]'
                    : 'flex min-h-0 min-w-0 flex-1 flex-col !p-4'
            }
        >
            <div className="relative flex h-full min-h-0 w-full flex-1 flex-col">
                <div className={`flex shrink-0 items-center justify-between gap-2 ${isNativeMobile ? 'mb-2' : 'mb-3'}`}>
                    <div className={`flex min-w-0 items-center ${isNativeMobile ? 'gap-2' : 'gap-2.5'}`}>
                        <h3
                            className={`truncate bg-gradient-to-r from-amber-300 to-orange-300 bg-clip-text font-bold text-transparent ${
                                isNativeMobile ? 'text-base' : 'text-xl'
                            }`}
                        >
                            {t('shop.title')}
                        </h3>
                    </div>
                    <div
                        className={`relative flex-shrink-0 overflow-hidden rounded-xl border-2 border-amber-500/60 bg-gradient-to-br from-amber-900/90 via-yellow-800/80 to-amber-900/90 text-center shadow-2xl backdrop-blur-md ${
                            isNativeMobile ? 'px-2.5 py-1.5' : 'p-3'
                        }`}
                    >
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/20 via-yellow-400/10 to-amber-500/15" />
                        <div className="relative z-10">
                            <p className={`font-semibold text-amber-200/80 ${isNativeMobile ? 'text-[9px]' : 'mb-0.5 text-[10px]'}`}>
                                {t('common:resources.guildCoins')}
                            </p>
                            <p
                                className={`flex items-center justify-center gap-1 font-bold tabular-nums text-yellow-300 drop-shadow-lg ${
                                    isNativeMobile ? 'text-sm' : 'text-lg'
                                }`}
                            >
                                <img
                                    src="/images/guild/tokken.webp"
                                    alt=""
                                    className={isNativeMobile ? 'h-4 w-4 drop-shadow-md' : 'h-5 w-5 drop-shadow-md'}
                                />
                                {(currentUserWithStatus?.guildCoins ?? 0).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
                <div className={`flex shrink-0 rounded-lg bg-gray-900/70 p-1 ${isNativeMobile ? 'mb-2' : 'mb-3'}`}>
                    {(['equipment', 'material', 'consumable'] as ShopTab[]).map((tab) => {
                        const labels = {
                            equipment: t('shop.tabEquipment'),
                            material: t('shop.tabMaterial'),
                            consumable: t('shop.tabConsumable'),
                        };
                        return (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 rounded-md font-semibold transition-all ${
                                    isNativeMobile ? 'py-1.5 text-[11px]' : 'py-2 text-sm'
                                } ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}
                            >
                                {labels[tab]}
                            </button>
                        );
                    })}
                </div>
                <div
                    className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch] ${
                        isNativeMobile ? 'pr-0.5' : 'pr-1'
                    }`}
                >
                    <div
                        className={`grid content-start items-start ${
                            isNativeMobile ? 'grid-cols-2 gap-2 pb-3' : 'grid-cols-4 gap-3.5 pb-4'
                        }`}
                    >
                        {shopItemsForTab.map((item) => (
                            <ShopItemCard
                                key={item.itemId}
                                item={item}
                                isNativeMobile={isNativeMobile}
                                onShowDetail={setDetailItem}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </DraggableWindow>
        {detailItem && guildDetailPreview ? (
                <DraggableWindow
                    title={t('shop.itemDetail')}
                    onClose={() => setDetailItem(null)}
                    windowId="guild-shop-item-detail"
                    initialWidth={480}
                    isTopmost={isTopmost}
                    variant="store"
                    mobileViewportFit={isNativeMobile}
                    mobileViewportMaxHeightVh={94}
                    hideFooter
                    shrinkHeightToContent
                    bodyScrollable={false}
                >
                    <div className={`min-h-0 overflow-x-hidden ${isNativeMobile ? 'p-2' : 'p-2.5'}`}>
                        <p className="mb-1.5 rounded-lg border border-amber-500/25 bg-amber-950/20 px-2 py-1 text-center text-[10px] font-medium leading-snug text-amber-100/90">
                            {t('shop.detailHint')}
                        </p>
                        <EquipmentDetailPanel
                            item={guildDetailPreview}
                            optionsScrollable={false}
                            comfortableTypography={false}
                            showAcquireSources
                            hideOwnedQuantity
                            iconSlotPx={60}
                        />
                    </div>
                </DraggableWindow>
            ) : null}
        </>
    );
};

export default GuildShopModal;