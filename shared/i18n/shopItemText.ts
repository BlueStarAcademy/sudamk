import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { shopItemDisplayFallback, type ShopItemDisplayField } from '../constants/shopItemDisplay.js';
import { tx } from './runtimeText.js';

export function translateShopItem(itemId: string, field: ShopItemDisplayField): string {
    const fallback = shopItemDisplayFallback(itemId, field);
    return tx(`shop:items.${itemId}.${field}`, { defaultValue: fallback });
}

/** React components: re-renders when shop locale changes. */
export function useLocalizedShopItem() {
    const { i18n } = useTranslation('shop');
    return useCallback(
        (itemId: string, field: ShopItemDisplayField) => translateShopItem(itemId, field),
        [i18n.language],
    );
}
