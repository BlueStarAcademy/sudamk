import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import { Guild as GuildType, ServerAction, InventoryItem, ItemGrade } from '../../types/index.js';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { GUILD_SHOP_ITEMS, GuildShopItem } from '../../constants/guildConstants.js';
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
    normal: '/images/equipments/normalbgi.png',
    uncommon: '/images/equipments/uncommonbgi.png',
    rare: '/images/equipments/rarebgi.png',
    epic: '/images/equipments/epicbgi.png',
    legendary: '/images/equipments/legendarybgi.png',
    mythic: '/images/equipments/mythicbgi.png',
    transcendent: '/images/equipments/mythicbgi.png',
};


const ShopItemCard: React.FC<{ item: GuildShopItem; isNativeMobile: boolean }> = ({ item, isNativeMobile }) => {
    const { handlers, currentUserWithStatus } = useAppContext();
    const [showDescription, setShowDescription] = useState(false);
    
    const purchaseRecord = currentUserWithStatus?.dailyShopPurchases?.[item.itemId];
    const now = Date.now();
    let purchasesThisPeriod = 0;

    if (purchaseRecord) {
        const ts = purchaseRecord.lastPurchaseTimestamp ?? purchaseRecord.date;
        if (item.limitType === 'weekly' && !isDifferentWeekKST(ts, now)) {
            purchasesThisPeriod = purchaseRecord.quantity;
        }
        if (item.limitType === 'monthly' && !isDifferentMonthKST(ts, now)) {
            purchasesThisPeriod = purchaseRecord.quantity;
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
            <div 
                className={`bg-gradient-to-br from-[#312e81]/35 via-[#1e1b4b]/20 to-transparent rounded-lg flex items-center justify-center shadow-[0_0_25px_-8px_rgba(129,140,248,0.65)] cursor-pointer active:scale-95 transition-transform ${isNativeMobile ? 'w-[3.75rem] h-[3.75rem] mb-1.5' : 'w-16 h-16 mb-2 hover:scale-105'}`}
                onClick={() => setShowDescription(!showDescription)}
                onMouseEnter={() => { if (!isNativeMobile) setShowDescription(true); }}
                onMouseLeave={() => { if (!isNativeMobile) setShowDescription(false); }}
            >
                <img src={item.image} alt={item.name} className={`w-full h-full object-contain drop-shadow-[0_6px_12px_rgba(30,64,175,0.4)] ${isNativeMobile ? 'p-1' : 'p-1.5'}`} />
            </div>
            <h3 className={`font-semibold tracking-wide text-white drop-shadow-[0_2px_12px_rgba(99,102,241,0.55)] line-clamp-2 leading-tight ${isNativeMobile ? 'text-[11px] min-h-[2.5rem]' : 'text-sm line-clamp-1'}`}>
                {item.name}
            </h3>
            {showDescription && (
                <div className={`absolute z-50 left-1/2 -translate-x-1/2 bg-gray-900/95 border border-indigo-400/50 rounded-lg shadow-xl ${isNativeMobile ? 'top-[4.5rem] w-[min(92vw,14rem)] p-2' : 'top-20 w-48 p-2'}`}>
                    <p className={`text-slate-200/90 leading-relaxed ${isNativeMobile ? 'text-[11px]' : 'text-[10px]'}`}>
                        {item.description}
                    </p>
                </div>
            )}
            <div className={`flex flex-col items-stretch justify-center w-full ${isNativeMobile ? 'gap-1 mt-1.5' : 'gap-1.5 mt-2'}`}>
                <Button
                    onClick={handleBuy}
                    disabled={!canPurchase}
                    colorScheme="none"
                    className={`w-full justify-center rounded-lg border border-amber-400/50 bg-gradient-to-r from-amber-400/90 via-amber-300/90 to-amber-500/90 text-slate-900 shadow-[0_12px_32px_-18px_rgba(251,191,36,0.85)] hover:from-amber-300 hover:to-amber-500 ${!canPurchase ? 'opacity-50 cursor-not-allowed' : ''} ${isNativeMobile ? 'py-2' : 'py-1.5'}`}
                >
                    <div className="flex flex-col items-center justify-center gap-0.5">
                        <div className={`flex items-center justify-center font-semibold tracking-wide ${isNativeMobile ? 'gap-1 text-[13px]' : 'gap-1.5 text-xs'}`}>
                            <img src="/images/guild/tokken.png" alt="길드 코인" className={isNativeMobile ? 'w-4 h-4 drop-shadow-md' : 'w-5 h-5 drop-shadow-md'} />
                            <span>{item.cost.toLocaleString()}</span>
                        </div>
                        <span className={`text-slate-700/90 tracking-wide ${isNativeMobile ? 'text-[10px]' : 'text-[9px]'}`}>
                            {item.limitType === 'weekly' ? '주간' : '월간'} {remaining}/{item.limit}
                        </span>
                    </div>
                </Button>
            </div>
        </div>
    );
};


const GuildShopModal: React.FC<GuildShopModalProps> = ({ onClose, isTopmost }) => {
    const { currentUserWithStatus } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const [activeTab, setActiveTab] = useState<ShopTab>('equipment');

    const shopItemsForTab = useMemo(() => {
        const typeMap: Record<ShopTab, GuildShopItem['type'] | 'equipment_box'> = {
            'equipment': 'equipment_box',
            'material': 'material',
            'consumable': 'consumable',
        };
        return GUILD_SHOP_ITEMS.filter(item => item.type === typeMap[activeTab]);
    }, [activeTab]);

    return (
        <DraggableWindow
            title="길드 상점"
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
                        <div className={`bg-gradient-to-br from-amber-600/80 to-orange-600/80 rounded-xl flex items-center justify-center border-2 border-amber-400/50 shadow-lg shadow-amber-500/20 flex-shrink-0 ${isNativeMobile ? 'w-8 h-8' : 'w-10 h-10'}`}>
                            <span className={isNativeMobile ? 'text-base' : 'text-xl'}>🛒</span>
                        </div>
                        <h3 className={`font-bold bg-gradient-to-r from-amber-300 to-orange-300 bg-clip-text text-transparent truncate ${isNativeMobile ? 'text-base' : 'text-xl'}`}>길드 상점</h3>
                    </div>
                    <div className={`bg-gradient-to-br from-amber-900/90 via-yellow-800/80 to-amber-900/90 rounded-xl text-center border-2 border-amber-500/60 shadow-2xl backdrop-blur-md relative overflow-hidden flex-shrink-0 ${isNativeMobile ? 'px-2.5 py-1.5' : 'p-3'}`}>
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-yellow-400/10 to-amber-500/15 pointer-events-none"></div>
                        <div className="relative z-10">
                            <p className={`text-amber-200/80 font-semibold ${isNativeMobile ? 'text-[9px]' : 'text-[10px] mb-0.5'}`}>길드 코인</p>
                            <p className={`font-bold text-yellow-300 drop-shadow-lg flex items-center justify-center gap-1 tabular-nums ${isNativeMobile ? 'text-sm' : 'text-lg'}`}>
                                <img src="/images/guild/tokken.png" alt="Guild Coin" className={isNativeMobile ? 'w-4 h-4 drop-shadow-md' : 'w-5 h-5 drop-shadow-md'} />
                                {(currentUserWithStatus?.guildCoins ?? 0).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
                <div className={`flex bg-gray-900/70 p-1 rounded-lg flex-shrink-0 ${isNativeMobile ? 'mb-2' : 'mb-4'}`}>
                    {(['equipment', 'material', 'consumable'] as ShopTab[]).map(tab => {
                        const labels = { equipment: '장비', material: '재료', consumable: '소모품' };
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
                            <ShopItemCard key={item.itemId} item={item} isNativeMobile={isNativeMobile} />
                        ))}
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default GuildShopModal;