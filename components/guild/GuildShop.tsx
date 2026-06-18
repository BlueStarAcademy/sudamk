import React from 'react';
import { useTranslation } from 'react-i18next';
import type { GuildShop } from '../../types/entities.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import Button from '../Button.js';

interface GuildShopProps {
    guildId: string;
    shopItems: GuildShop[];
    onShopItemsUpdate: (items: GuildShop[]) => void;
}

const GuildShopComponent: React.FC<GuildShopProps> = ({ guildId, shopItems, onShopItemsUpdate }) => {
    const { t } = useTranslation('guild');
    const { handlers } = useAppContext();

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">{t('shop.title')}</h2>
            <div className="space-y-2">
                {shopItems.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">{t('shopLegacy.empty')}</p>
                ) : (
                    shopItems.map((item) => (
                        <div key={item.id} className="p-4 bg-gray-800/50 rounded-lg flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-white">Item {item.itemTemplateId}</h3>
                                <p className="text-yellow-400 font-semibold">{t('shopLegacy.goldPrice', { price: item.price.toLocaleString() })}</p>
                                {item.stock !== -1 && (
                                    <p className="text-sm text-gray-400">
                                        {t('shopLegacy.stock', {
                                            remaining: item.stock - (item.purchasedBy?.length || 0),
                                            total: item.stock,
                                        })}
                                    </p>
                                )}
                            </div>
                            <Button
                                onClick={async () => {
                                    try {
                                        const result: any = await handlers.handleAction({
                                            type: 'PURCHASE_GUILD_SHOP_ITEM',
                                            payload: { shopItemId: item.id },
                                        });
                                        if (result?.error) {
                                            alert(result.error);
                                        } else {
                                            window.location.reload();
                                        }
                                    } catch (error: any) {
                                        alert(error.message || t('shopLegacy.purchaseFailed'));
                                    }
                                }}
                                colorScheme="green"
                                className="!py-2 !px-4"
                                disabled={item.stock !== -1 && (item.purchasedBy?.length || 0) >= item.stock}
                            >
                                {t('shopLegacy.purchase')}
                            </Button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default GuildShopComponent;
