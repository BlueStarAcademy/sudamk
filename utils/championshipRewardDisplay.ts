import { CONSUMABLE_ITEMS, MATERIAL_ITEMS } from '../constants';
import { ItemGrade } from '../types/enums.js';

/** 순위보상 itemId → CONSUMABLE 표기명 (TournamentBracket과 동일) */
const REWARD_ITEM_ID_TO_NAME: Record<string, string> = {
    '재료 상자1': '재료 상자 I',
    '재료 상자2': '재료 상자 II',
    '재료 상자3': '재료 상자 III',
    '재료 상자4': '재료 상자 IV',
    '재료 상자5': '재료 상자 V',
    '재료 상자6': '재료 상자 VI',
    '장비 상자1': '장비 상자 I',
    '장비 상자2': '장비 상자 II',
    '장비 상자3': '장비 상자 III',
    '장비 상자4': '장비 상자 IV',
    '장비 상자5': '장비 상자 V',
    '장비 상자6': '장비 상자 VI',
};

export function getChampionshipRewardItemImageUrl(itemName: string): string {
    const lookupName = REWARD_ITEM_ID_TO_NAME[itemName] ?? itemName;
    const consumable = CONSUMABLE_ITEMS.find(i => i.name === lookupName);
    if (consumable?.image) return consumable.image;
    const material = MATERIAL_ITEMS[lookupName] ?? MATERIAL_ITEMS[itemName];
    return material?.image ?? '';
}

export function getChampionshipRewardItemGrade(itemName: string): ItemGrade | undefined {
    const lookupName = REWARD_ITEM_ID_TO_NAME[itemName] ?? itemName;
    const consumable = CONSUMABLE_ITEMS.find(i => i.name === lookupName);
    return consumable?.grade;
}
