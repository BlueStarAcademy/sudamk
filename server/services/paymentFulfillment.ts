import * as db from '../db.js';
import { getCachedUser } from '../gameCache.js';
import { getSelectiveUserUpdate } from '../utils/userUpdateHelper.js';
import { addItemsToInventory } from '../../utils/inventoryUtils.js';
import { isDifferentMonthKST } from '../../shared/utils/timeUtils.js';
import {
    collectEquipmentCashPackageLoot,
    grantDiamondCashShopPackageFromMail,
} from '../actions/shopActions.js';
import {
    CASH_SHOP_DIAMOND_PACKAGE_IDS,
    CASH_SHOP_EQUIPMENT_PACKAGE_IDS,
    CASH_SHOP_REMOVE_ADS_PACKAGE_ID,
    type CashShopDiamondPackageId,
    type CashShopEquipmentPackageId,
} from '../../shared/constants/cashShopPackages.js';
import {
    VIP_SHOP_PRODUCT_IDS,
    type VipShopProductId,
    VIP_SHOP_DURATION_DAYS,
    getVipShopGrantFlagsForProductId,
} from '../../shared/constants/vipShopProducts.js';
import { applyVipDurationExtensionToUser } from '../../shared/utils/vipDurationGrant.js';
import {
    DIRECT_DIAMOND_PRODUCT_IDS,
    DIRECT_DIAMOND_AMOUNTS,
    type DirectDiamondProductId,
    type PaymentProductId,
} from '../../shared/constants/paymentProducts.js';
import * as guildService from '../guildService.js';

export type FulfillResult = { ok: true; broadcastFields: string[] } | { ok: false; error: string };

/**
 * 결제 완료된 주문의 상품 지급.
 * shopActions 의 BUY_VIP_PACKAGE / BUY_CASH_PACKAGE 지급 로직과 동일하되 결제 게이트(isAdmin)가 없다.
 * 호출 측(콜백 라우트)이 주문 검증·상태 전이·멱등성을 책임진다.
 */
export async function fulfillPaymentProduct(userId: string, productId: PaymentProductId): Promise<FulfillResult> {
    const user = await getCachedUser(userId);
    if (!user) return { ok: false, error: `유저를 찾을 수 없습니다: ${userId}` };
    const now = Date.now();

    let broadcastFields: string[];

    if ((VIP_SHOP_PRODUCT_IDS as readonly string[]).includes(productId)) {
        const id = productId as VipShopProductId;
        applyVipDurationExtensionToUser(user, getVipShopGrantFlagsForProductId(id), VIP_SHOP_DURATION_DAYS[id] * 86400000, now);
        broadcastFields = ['rewardVipExpiresAt', 'functionVipExpiresAt', 'vvipExpiresAt', 'vipShopAutoRenew'];
    } else if ((CASH_SHOP_DIAMOND_PACKAGE_IDS as readonly string[]).includes(productId)) {
        grantDiamondCashShopPackageFromMail(user, productId as CashShopDiamondPackageId, now);
        broadcastFields = ['diamonds', 'mail', 'activeDiamondPackageTier', 'diamondPackageExpiresAt', 'diamondPackageLastMailDayKST'];
    } else if ((CASH_SHOP_EQUIPMENT_PACKAGE_IDS as readonly string[]).includes(productId)) {
        const id = productId as CashShopEquipmentPackageId;
        const obtainedItems = collectEquipmentCashPackageLoot(id);
        if (!user.inventory) user.inventory = [];
        if (!user.inventorySlots) user.inventorySlots = { equipment: 30, consumable: 30, material: 30 };
        const { success, updatedInventory } = addItemsToInventory(user.inventory, user.inventorySlots, obtainedItems);
        if (!success || !updatedInventory) {
            // 결제는 이미 완료 — 실패로 두지 않고 우편으로 지급해 유실을 막는다
            const mail = {
                id: `payment-${productId}-${now}`,
                title: '구매 상품 지급',
                body: '인벤토리 공간 부족으로 우편으로 지급되었습니다.',
                attachments: { items: obtainedItems },
                receivedAt: now,
            };
            if (!Array.isArray(user.mail)) user.mail = [];
            (user.mail as unknown[]).push(mail as unknown);
            broadcastFields = ['mail'];
        } else {
            user.inventory = JSON.parse(JSON.stringify(updatedInventory));
            if (!user.dailyShopPurchases) user.dailyShopPurchases = {};
            const rec = user.dailyShopPurchases[productId];
            const purchasesThisMonth = rec && !isDifferentMonthKST(rec.date, now) ? rec.quantity : 0;
            user.dailyShopPurchases[productId] = { quantity: purchasesThisMonth + 1, date: now };
            const bonusEquipment = obtainedItems[obtainedItems.length - 1];
            await guildService.recordGuildEpicPlusEquipmentAcquisition(user, bonusEquipment ? [bonusEquipment] : []);
            broadcastFields = ['inventory', 'dailyShopPurchases', 'quests'];
        }
    } else if (productId === CASH_SHOP_REMOVE_ADS_PACKAGE_ID) {
        user.removeAdsPurchased = true;
        broadcastFields = ['removeAdsPurchased'];
    } else if ((DIRECT_DIAMOND_PRODUCT_IDS as readonly string[]).includes(productId)) {
        const amount = DIRECT_DIAMOND_AMOUNTS[productId as DirectDiamondProductId];
        user.diamonds = (Number(user.diamonds) || 0) + amount;
        broadcastFields = ['diamonds'];
    } else {
        return { ok: false, error: `지급 로직이 정의되지 않은 상품: ${productId}` };
    }

    getSelectiveUserUpdate(user, 'PAYMENT_FULFILL', { includeAll: true });
    await db.updateUser(user);
    const { broadcastUserUpdate } = await import('../socket.js');
    broadcastUserUpdate(user, broadcastFields as never[]);
    return { ok: true, broadcastFields };
}

/** 주문 생성 전 사전 차단 — 결제 후 지급 불가 상황을 막는다 */
export async function validatePurchasable(userId: string, productId: PaymentProductId): Promise<string | null> {
    const user = await getCachedUser(userId);
    if (!user) return '유저를 찾을 수 없습니다.';
    const now = Date.now();
    if (productId === CASH_SHOP_REMOVE_ADS_PACKAGE_ID && user.removeAdsPurchased) {
        return '이미 광고 제거 상품을 보유 중입니다.';
    }
    if ((CASH_SHOP_DIAMOND_PACKAGE_IDS as readonly string[]).includes(productId) && (user.diamondPackageExpiresAt ?? 0) > now) {
        return '진행 중인 다이아 패키지가 있을 때는 추가 구매할 수 없습니다.';
    }
    return null;
}
