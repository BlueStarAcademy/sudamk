import { randomUUID } from 'crypto';
import type { InventoryItem } from '../types/index.js';
import { EQUIPMENT_POOL, GRADE_LEVEL_REQUIREMENTS, resolveEquipmentTemplateLookupName } from '../shared/constants/index.js';
import { ItemGrade } from '../shared/types/enums.js';
import { createItemFromTemplate } from './shop.js';
import {
    applyEnhancementStarsToEquipmentItem,
    createSeededRandom,
    getMailEquipmentDisplayStars,
    isMailAttachmentEquipment,
} from '../shared/utils/equipmentEnhancementStars.js';
import { normalizeInventoryEquipmentItem } from '../shared/utils/inventoryLegacyNormalize.js';
import { createItemInstancesFromReward } from '../utils/inventoryUtils.js';

/**
 * 우편 첨부 장비 수령 시: mailPreEnhanced + 강화 단계가 있으면 저장된 options를 믿지 않고
 * 템플릿 → 동일 시드로 강화 틱을 다시 적용한다. (직렬화 깨짐·문자열 이어붙기 방지)
 * 시드는 발송 시와 동일하게 `${mailId}|${첨부배열인덱스}|${stars}`.
 */
function tryRehydratePreEnhancedMailEquipment(
    inv: InventoryItem,
    mailId: string,
    attachmentIndex: number
): InventoryItem | null {
    if (inv.mailPreEnhanced !== true) return null;
    const stars = getMailEquipmentDisplayStars(inv);
    if (stars <= 0) return null;

    const lookupName = resolveEquipmentTemplateLookupName(inv.name, inv.grade as ItemGrade) ?? inv.name;
    const template =
        EQUIPMENT_POOL.find((t) => t.name === lookupName && t.grade === inv.grade) ??
        EQUIPMENT_POOL.find((t) => t.name === lookupName);
    if (!template?.slot) return null;

    const eq = createItemFromTemplate(template);
    applyEnhancementStarsToEquipmentItem(eq, stars, {
        rng: createSeededRandom(`${mailId}|${attachmentIndex}|${stars}`),
    });
    eq.level =
        typeof inv.level === 'number' && Number.isFinite(inv.level)
            ? inv.level
            : GRADE_LEVEL_REQUIREMENTS[eq.grade] ?? eq.level;
    const ref = inv as InventoryItem & { refinementCount?: number };
    if (typeof ref.refinementCount === 'number') {
        (eq as InventoryItem & { refinementCount?: number }).refinementCount = ref.refinementCount;
    }
    eq.enhancementFails = inv.enhancementFails ?? 0;
    delete (eq as InventoryItem & { mailPreEnhanced?: boolean }).mailPreEnhanced;
    const normalized = normalizeInventoryEquipmentItem(eq);
    return { ...normalized, id: `item-${randomUUID()}` };
}

/**
 * 우편 attachments.items 전용. mailId는 해당 우편의 `mail.id`와 반드시 일치해야 시드가 발송과 맞는다.
 */
export function createItemInstancesFromMailAttachments(
    itemRefs: (InventoryItem | { itemId: string; quantity: number })[],
    mailId: string
): InventoryItem[] {
    const out: InventoryItem[] = [];
    for (let idx = 0; idx < itemRefs.length; idx++) {
        const itemRef = itemRefs[idx];
        if ('id' in itemRef && isMailAttachmentEquipment(itemRef as InventoryItem)) {
            const inv = itemRef as InventoryItem;
            const rebuilt = tryRehydratePreEnhancedMailEquipment(inv, mailId, idx);
            if (rebuilt) {
                out.push(rebuilt);
                continue;
            }
        }
        out.push(...createItemInstancesFromReward([itemRef as InventoryItem | { itemId: string; quantity: number }]));
    }
    return out;
}
