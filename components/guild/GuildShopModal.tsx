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
        <div className={`group relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1f2239]/95 via-[#0f172a]/95 to-[#060b12]/95 border border-indigo-400/35 shadow-[0_22px_55px_-30px_rgba(99,102,241,0.65)] flex flex-col items-center text-center transition-transform duration-300 ${isNativeMobile ? 'p-2' : 'p-3 hover:-translate-y-1 hover:shadow-[0_30px_70px_-32px_rgba(129,140,248,0.65)]'}`}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/80 to-transparent pointer-events-none" />
            {!isNativeMobile && (
                <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.35),transparent_65%)] pointer-events-none" />
            )}
            <button
                type="button"
                title={t('shop.detailInfo')}
                className={`bg-gradient-to-br from-[#312e81]/35 via-[#1e1b4b]/20 to-transparent rounded-lg flex items-center justify-center shadow-[0_0_25px_-8px_rgba(129,140,248,0.65)] cursor-pointer active:scale-95 transition-transform ${isNativeMobile ? 'w-[3.75rem] h-[3.75rem] mb-1.5' : 'w-16 h-16 mb-2 hover:scale-105'}`}
                onClick={() => onShowDetail(item)}
            >
                <img src={item.image} alt={item.name} className={`w-full h-full object-contain drop-shadow-[0_6px_12px_rgba(30,64,175,0.4)] ${isNativeMobile ? 'p-1' : 'p-1.5'}`} />
            </button>
            <button
                type="button"
                className={`w-full text-center font-semibold tracking-wide text-white drop-shadow-[0_2px_12px_rgba(99,102,241,0.55)] line-clamp-2 leading-tight hover:text-amber-100/95 ${isNativeMobile ? 'text-[11px] min-h-[2.5rem]' : 'text-sm line-clamp-1'}`}
                title={t('shop.detailInfo')}
                onClick={() => onShowDetail(item)}
            >
                {item.name}
            </button>
            <div className={`flex flex-col items-stretch justify-center w-full ${isNativeMobile ? 'gap-1 mt-1.5' : 'gap-1.5 mt-2'}`}>
                <Button
                    onClick={handleBuy}
                    disabled={!canPurchase}
                    colorScheme="none"
                    className={`w-full justify-center rounded-lg border border-amber-400/50 bg-gradient-to-r from-amber-400/90 via-amber-300/90 to-amber-500/90 text-slate-900 shadow-[0_12px_32px_-18px_rgba(251,191,36,0.85)] hover:from-amber-300 hover:to-amber-500 ${!canPurchase ? 'opacity-50 cursor-not-allowed' : ''} ${isNativeMobile ? 'py-2' : 'py-1.5'}`}
                >
                    <div className="flex flex-col items-center justify-center gap-0.5">
                        <div className={`flex items-center justify-center font-semibold tracking-wide ${isNativeMobile ? 'gap-1 text-[13px]' : 'gap-1.5 text-xs'}`}>
                            <img src="/images/guild/tokken.webp" alt={t('common:resources.guildCoins')} className={isNativeMobile ? 'w-4 h-4 drop-shadow-md' : 'w-5 h-5 drop-shadow-md'} />
                            <span>{item.cost.toLocaleString()}</span>
                        </div>
                        <span className={`text-slate-700/90 tracking-wide ${isNativeMobile ? 'text-[10px]' : 'text-[9px]'}`}>
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
            bodyPaddingClassName={isNativeMobile ? 'p-2' : undefined}
        >
            <div className={`flex flex-col relative min-h-0 ${isNativeMobile ? 'flex-1 h-full' : 'h-[calc(var(--vh,1vh)*60)]'}`}>
                <div className={`flex justify-between items-center flex-shrink-0 gap-2 ${isNativeMobile ? 'mb-2' : 'mb-4'}`}>
                    <div className={`flex items-center min-w-0 ${isNativeMobile ? 'gap-2' : 'gap-2.5'}`}>
                        <h3 className={`font-bold bg-gradient-to-r from-amber-300 to-orange-300 bg-clip-text text-transparent truncate ${isNativeMobile ? 'text-base' : 'text-xl'}`}>{t('shop.title')}</h3>
                    </div>
                    <div className={`bg-gradient-to-br from-amber-900/90 via-yellow-800/80 to-amber-900/90 rounded-xl text-center border-2 border-amber-500/60 shadow-2xl backdrop-blur-md relative overflow-hidden flex-shrink-0 ${isNativeMobile ? 'px-2.5 py-1.5' : 'p-3'}`}>
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-yellow-400/10 to-amber-500/15 pointer-events-none"></div>
                        <div className="relative z-10">
                            <p className={`text-amber-200/80 font-semibold ${isNativeMobile ? 'text-[9px]' : 'text-[10px] mb-0.5'}`}>{t('common:resources.guildCoins')}</p>
                            <p className={`font-bold text-yellow-300 drop-shadow-lg flex items-center justify-center gap-1 tabular-nums ${isNativeMobile ? 'text-sm' : 'text-lg'}`}>
                                <img src="/images/guild/tokken.webp" alt="Guild Coin" className={isNativeMobile ? 'w-4 h-4 drop-shadow-md' : 'w-5 h-5 drop-shadow-md'} />
                                {(currentUserWithStatus?.guildCoins ?? 0).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
                <div className={`flex bg-gray-900/70 p-1 rounded-lg flex-shrink-0 ${isNativeMobile ? 'mb-2' : 'mb-4'}`}>
                    {(['equipment', 'material', 'consumable'] as ShopTab[]).map(tab => {
                        const labels = { equipment: t('shop.tabEquipment'), material: t('shop.tabMaterial'), consumable: t('shop.tabConsumable') };
                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 ${isNativeMobile ? 'py-1.5 text-[11px]' : 'py-2 text-sm'} font-semibold rounded-md transition-all ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}
                            >
                                {labels[tab]}
                            </button>
                        );
                    })}
                </div>
                <div className={`min-h-0 flex-1 overflow-y-auto ${isNativeMobile ? 'pr-1' : 'pr-2'}`}>
                    <div className={`grid items-start ${isNativeMobile ? 'grid-cols-2 gap-1.5' : 'grid-cols-4 gap-3'}`}>
                        {shopItemsForTab.map(item => (
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