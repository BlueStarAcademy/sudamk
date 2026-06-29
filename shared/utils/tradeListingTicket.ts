import type { InventoryItem } from '../../types/index.js';

export const TRADE_LISTING_TICKET_NAME = '거래 등록권';
export const MAX_EXCHANGE_SELL_SLOTS = 3;
export const FREE_EXCHANGE_LISTING_SLOTS = 1;

export function countTradeListingTickets(inventory: InventoryItem[] | undefined): number {
    return (inventory ?? [])
        .filter((item) => item.type === 'material' && item.name === TRADE_LISTING_TICKET_NAME)
        .reduce((sum, item) => sum + (item.quantity ?? 1), 0);
}

export function resolveAllowedListingCount(params: {
    myListedCount: number;
    ticketCount: number;
    functionVipActive: boolean;
    isAdmin: boolean;
}): number {
    if (params.isAdmin) return Number.POSITIVE_INFINITY;
    if (params.functionVipActive) return MAX_EXCHANGE_SELL_SLOTS;
    return Math.min(
        MAX_EXCHANGE_SELL_SLOTS,
        Math.max(params.myListedCount, FREE_EXCHANGE_LISTING_SLOTS) + params.ticketCount,
    );
}

export function requiresTradeListingTicket(params: {
    myListedCount: number;
    functionVipActive: boolean;
    isAdmin: boolean;
}): boolean {
    return (
        !params.functionVipActive &&
        !params.isAdmin &&
        params.myListedCount >= FREE_EXCHANGE_LISTING_SLOTS
    );
}
