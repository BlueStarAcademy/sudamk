import type { InventoryItem } from '../../types/index.js';

export const TRADE_LISTING_TICKET_NAME = '거래 등록권';

export function countTradeListingTickets(inventory: InventoryItem[] | undefined): number {
    return (inventory ?? [])
        .filter((item) => item.type === 'material' && item.name === TRADE_LISTING_TICKET_NAME)
        .reduce((sum, item) => sum + (item.quantity ?? 1), 0);
}
