import { InventoryItem, EquipmentSlot, CoreStat, SpecialStat, MythicStat, ItemOption } from '../types/index.js';
import { ItemGrade } from '../types/enums.js';

export const emptySlotImages: Record<EquipmentSlot, string> = {
    fan: 'images/equipments/EmptyFanSlot.png',
    board: 'images/equipments/EmptyBoardSlot.png',
    top: 'images/equipments/EmptyTopSlot.png',
    bottom: 'images/equipments/EmptyBottomSlot.png',
    bowl: 'images/equipments/EmptyStoneBoxSlot.png',
    stones: 'images/equipments/EmptyStoneSlot.png',
};

export const slotNames: Record<EquipmentSlot, string> = {
    fan: '부채',
    board: '바둑판',
    top: '상의',
    bottom: '하의',
    bowl: '돌그릇',
    stones: '돌',
};

export const GRADE_LEVEL_REQUIREMENTS: Record<ItemGrade, number> = {
    [ItemGrade.Normal]: 2,
    [ItemGrade.Uncommon]: 3,
    [ItemGrade.Rare]: 5,
    [ItemGrade.Epic]: 10,
    [ItemGrade.Legendary]: 12,
    [ItemGrade.Mythic]: 15,
    [ItemGrade.Transcendent]: 15,
};

export const EQUIPMENT_POOL: (Omit<InventoryItem, 'id' | 'createdAt' | 'isEquipped' | 'level' | 'options' | 'quantity' | 'stars' | 'enhancementFails'> & { stars: 0 })[] = [
    // --- Fans (부채) ---
    { name: '푸른 바람 부채', slot: 'fan', image: 'images/equipments/Fan1.png', grade: ItemGrade.Normal, stars: 0, type: 'equipment', description: '가볍고 실용적인 대나무 부채입니다.' },
    { name: '은결 바람 부채', slot: 'fan', image: 'images/equipments/Fan2.png', grade: ItemGrade.Uncommon, stars: 0, type: 'equipment', description: '부드러운 비단으로 만들어져 손에 잘 감깁니다.' },
    { name: '화염 바람 부채', slot: 'fan', image: 'images/equipments/Fan3.png', grade: ItemGrade.Rare, stars: 0, type: 'equipment', description: '학의 날개처럼 우아하게 펼쳐지는 명인의 부채입니다.' },
    { name: '서리 바람 부채', slot: 'fan', image: 'images/equipments/Fan4.png', grade: ItemGrade.Epic, stars: 0, type: 'equipment', description: '묵직한 강철로 만들어져 위급 시 무기로도 사용할 수 있습니다.' },
    { name: '용비 바람 부채', slot: 'fan', image: 'images/equipments/Fan5.png', grade: ItemGrade.Legendary, stars: 0, type: 'equipment', description: '백 개의 하얀 깃털로 만들어진 전설적인 부채입니다.' },
    { name: '천룡 바람 부채', slot: 'fan', image: 'images/equipments/Fan6.png', grade: ItemGrade.Mythic, stars: 0, type: 'equipment', description: '바람을 일으켜 판세를 뒤엎는 신화 속 부채입니다.' },
    // --- Boards (바둑판) ---
    { name: '새싹 바둑판', slot: 'board', image: 'images/equipments/Board1.png', grade: ItemGrade.Normal, stars: 0, type: 'equipment', description: '초심자들이 사용하기 좋은 가벼운 오동나무 바둑판입니다.' },
    { name: '단풍결 바둑판', slot: 'board', image: 'images/equipments/Board2.png', grade: ItemGrade.Uncommon, stars: 0, type: 'equipment', description: '아름다운 결을 가진 비자나무로 만든 고급 바둑판입니다.' },
    { name: '산호결 바둑판', slot: 'board', image: 'images/equipments/Board3.png', grade: ItemGrade.Rare, stars: 0, type: 'equipment', description: '최고급 신비자 나무로 만들어져 돌을 놓는 소리가 청아합니다.' },
    { name: '흑단 바둑판', slot: 'board', image: 'images/equipments/Board4.png', grade: ItemGrade.Epic, stars: 0, type: 'equipment', description: '뜨거운 열정으로 다듬어진 화산암 바둑판입니다.' },
    { name: '용문 바둑판', slot: 'board', image: 'images/equipments/Board5.png', grade: ItemGrade.Legendary, stars: 0, type: 'equipment', description: '천 년의 세월을 간직한 금강송으로 만들어진 전설의 바둑판입니다.' },
    { name: '천룡 바둑판', slot: 'board', image: 'images/equipments/Board6.png', grade: ItemGrade.Mythic, stars: 0, type: 'equipment', description: '밤하늘의 별들을 수놓은 듯한 신화적인 바둑판입니다.' },
    // --- Tops (상의) ---
    { name: '봄빛 도복 상의', slot: 'top', image: 'images/equipments/Top1.png', grade: ItemGrade.Normal, stars: 0, type: 'equipment', description: '수련에 집중하기 좋은 편안한 상의입니다.' },
    { name: '여름빛 도복 상의', slot: 'top', image: 'images/equipments/Top2.png', grade: ItemGrade.Uncommon, stars: 0, type: 'equipment', description: '오랜 수련에도 해지지 않는 질긴 도복입니다.' },
    { name: '가을빛 도복 상의', slot: 'top', image: 'images/equipments/Top3.png', grade: ItemGrade.Rare, stars: 0, type: 'equipment', description: '고요한 기품이 느껴지는 선비의 도포입니다.' },
    { name: '겨울빛 도복 상의', slot: 'top', image: 'images/equipments/Top4.png', grade: ItemGrade.Epic, stars: 0, type: 'equipment', description: '날카로운 승부를 위해 만들어진 검객의 복장입니다.' },
    { name: '용비 도복 상의', slot: 'top', image: 'images/equipments/Top5.png', grade: ItemGrade.Legendary, stars: 0, type: 'equipment', description: '황제의 위엄을 상징하는 용무늬가 수놓아져 있습니다.' },
    { name: '천룡 도복 상의', slot: 'top', image: 'images/equipments/Top6.png', grade: ItemGrade.Mythic, stars: 0, type: 'equipment', description: '입는 자에게 신의 가호를 내린다는 신화 속 의상입니다.' },
    // --- Bottoms (하의) ---
    { name: '봄빛 도복 하의', slot: 'bottom', image: 'images/equipments/Bottom1.png', grade: ItemGrade.Normal, stars: 0, type: 'equipment', description: '움직임이 편한 수련용 바지입니다.' },
    { name: '여름빛 도복 하의', slot: 'bottom', image: 'images/equipments/Bottom2.png', grade: ItemGrade.Uncommon, stars: 0, type: 'equipment', description: '쉽게 닳지 않는 튼튼한 재질의 바지입니다.' },
    { name: '가을빛 도복 하의', slot: 'bottom', image: 'images/equipments/Bottom3.png', grade: ItemGrade.Rare, stars: 0, type: 'equipment', description: '도포와 한 벌을 이루는 고급 비단 바지입니다.' },
    { name: '겨울빛 도복 하의', slot: 'bottom', image: 'images/equipments/Bottom4.png', grade: ItemGrade.Epic, stars: 0, type: 'equipment', description: '어떠한 움직임에도 방해받지 않는 검객의 하의입니다.' },
    { name: '용비 도복 하의', slot: 'bottom', image: 'images/equipments/Bottom5.png', grade: ItemGrade.Legendary, stars: 0, type: 'equipment', description: '용포와 한 벌을 이루는 최고급 비단으로 만들어졌습니다.' },
    { name: '천룡 도복 하의', slot: 'bottom', image: 'images/equipments/Bottom6.png', grade: ItemGrade.Mythic, stars: 0, type: 'equipment', description: '구름을 엮어 만들었다다는 신화 속 하의입니다.' },
    // --- Bowls (바둑통) ---
    { name: '가벼운 나무통', slot: 'bowl', image: 'images/equipments/StoneBox1.png', grade: ItemGrade.Normal, stars: 0, type: 'equipment', description: '가볍고 저렴한 플라스틱 바둑통입니다.' },
    { name: '단단한 대나무통', slot: 'bowl', image: 'images/equipments/StoneBox2.png', grade: ItemGrade.Uncommon, stars: 0, type: 'equipment', description: '은은한 향이 나는 대추나무로 만든 바둑통입니다.' },
    { name: '홍목 바둑통', slot: 'bowl', image: 'images/equipments/StoneBox3.png', grade: ItemGrade.Rare, stars: 0, type: 'equipment', description: '아름다운 붉은 빛을 띠는 장미목으로 만들어졌습니다.' },
    { name: '흑단 바둑통', slot: 'bowl', image: 'images/equipments/StoneBox4.png', grade: ItemGrade.Epic, stars: 0, type: 'equipment', description: '기이하고 아름다운 무늬를 가진 괴목으로 만든 희귀한 바둑통입니다.' },
    { name: '용린 바둑통', slot: 'bowl', image: 'images/equipments/StoneBox5.png', grade: ItemGrade.Legendary, stars: 0, type: 'equipment', description: '용이 섬세하게 조각된 최고급 자단목 바둑통입니다.' },
    { name: '천룡 바둑통', slot: 'bowl', image: 'images/equipments/StoneBox6.png', grade: ItemGrade.Mythic, stars: 0, type: 'equipment', description: '고대 신의 유물을 담았다고 전해지는 신비로운 함입니다.' },
    // --- Stones (바둑돌) ---
    { name: '흑백 새싹돌', slot: 'stones', image: 'images/equipments/Stone1.png', grade: ItemGrade.Normal, stars: 0, type: 'equipment', description: '가볍고 저렴한 플라스틱 바둑돌입니다.' },
    { name: '은빛 결돌', slot: 'stones', image: 'images/equipments/Stone2.png', grade: ItemGrade.Uncommon, stars: 0, type: 'equipment', description: '강가에서 주운 매끄러운 조약돌로 만든 바둑돌입니다.' },
    { name: '홍옥 바둑돌', slot: 'stones', image: 'images/equipments/Stone3.png', grade: ItemGrade.Rare, stars: 0, type: 'equipment', description: '차가운 빛을 내는 흑요석으로 정교하게 깎아 만들었습니다.' },
    { name: '백옥 바둑돌', slot: 'stones', image: 'images/equipments/Stone4.png', grade: ItemGrade.Epic, stars: 0, type: 'equipment', description: '영롱한 빛을 내는 청옥과 백옥으로 만들어진 바둑돌입니다.' },
    { name: '용안 바둑돌', slot: 'stones', image: 'images/equipments/Stone5.png', grade: ItemGrade.Legendary, stars: 0, type: 'equipment', description: '해와 달, 별의 기운을 담아 벼려낸 전설적인 바둑돌입니다.' },
    { name: '천룡 바둑돌', slot: 'stones', image: 'images/equipments/Stone6.png', grade: ItemGrade.Mythic, stars: 0, type: 'equipment', description: '밤하늘의 은하수를 담아놓은 듯한 신화 속 바둑돌입니다.' },
    // --- 초월: 신화 부옵션 2개 — 우편·관리 지급 전용(상자 루트에서는 제외)
    { name: '천룡 바람 부채', slot: 'fan', image: 'images/equipments/Fan6.png', grade: ItemGrade.Transcendent, stars: 0, type: 'equipment', description: '신화 부옵션이 두 줄기로 깃든 초월의 부채입니다.' },
    { name: '천룡 바둑판', slot: 'board', image: 'images/equipments/Board6.png', grade: ItemGrade.Transcendent, stars: 0, type: 'equipment', description: '신화 부옵션이 두 줄기로 깃든 초월의 바둑판입니다.' },
    { name: '천룡 도복 상의', slot: 'top', image: 'images/equipments/Top6.png', grade: ItemGrade.Transcendent, stars: 0, type: 'equipment', description: '신화 부옵션이 두 줄기로 깃든 초월의 상의입니다.' },
    { name: '천룡 도복 하의', slot: 'bottom', image: 'images/equipments/Bottom6.png', grade: ItemGrade.Transcendent, stars: 0, type: 'equipment', description: '신화 부옵션이 두 줄기로 깃든 초월의 하의입니다.' },
    { name: '천룡 바둑통', slot: 'bowl', image: 'images/equipments/StoneBox6.png', grade: ItemGrade.Transcendent, stars: 0, type: 'equipment', description: '신화 부옵션이 두 줄기로 깃든 초월의 바둑통입니다.' },
    { name: '천룡 바둑돌', slot: 'stones', image: 'images/equipments/Stone6.png', grade: ItemGrade.Transcendent, stars: 0, type: 'equipment', description: '신화 부옵션이 두 줄기로 깃든 초월의 바둑돌입니다.' },
];

export const CONSUMABLE_ITEMS: (Omit<InventoryItem, 'id'|'createdAt'|'isEquipped'|'level'|'stars'|'options'|'enhancementFails' | 'slot'> & {slot: null, usable?: boolean, sellable?: boolean})[] = [
    { name: '장비 상자 I', description: '일반~희귀 등급 장비 획득', type: 'consumable', slot: null, image: '/images/Box/EquipmentBox1.png', grade: ItemGrade.Normal },
    { name: '장비 상자 II', description: '일반~에픽 등급 장비 획득', type: 'consumable', slot: null, image: '/images/Box/EquipmentBox2.png', grade: ItemGrade.Uncommon },
    { name: '장비 상자 III', description: '고급~전설 등급 장비 획득', type: 'consumable', slot: null, image: '/images/Box/EquipmentBox3.png', grade: ItemGrade.Rare },
    { name: '장비 상자 IV', description: '희귀~신화 등급 장비 획득', type: 'consumable', slot: null, image: '/images/Box/EquipmentBox4.png', grade: ItemGrade.Epic },
    { name: '장비 상자 V', description: '에픽~신화 등급 장비 획득', type: 'consumable', slot: null, image: '/images/Box/EquipmentBox5.png', grade: ItemGrade.Legendary },
    { name: '장비 상자 VI', description: '전설~신화 등급 장비 획득', type: 'consumable', slot: null, image: '/images/Box/EquipmentBox6.png', grade: ItemGrade.Mythic },
    { name: '재료 상자 I', description: '하급 ~ 상급 강화석 5개 획득', type: 'consumable', slot: null, image: '/images/Box/ResourceBox1.png', grade: ItemGrade.Normal },
    { name: '재료 상자 II', description: '하급 ~ 상급 강화석 5개 획득', type: 'consumable', slot: null, image: '/images/Box/ResourceBox2.png', grade: ItemGrade.Uncommon },
    { name: '재료 상자 III', description: '하급 ~ 상급 강화석 5개 획득', type: 'consumable', slot: null, image: '/images/Box/ResourceBox3.png', grade: ItemGrade.Rare },
    { name: '재료 상자 IV', description: '중급 ~ 최상급 강화석 5개 획득', type: 'consumable', slot: null, image: '/images/Box/ResourceBox4.png', grade: ItemGrade.Epic },
    { name: '재료 상자 V', description: '상급 ~ 신비의 강화석 5개 획득', type: 'consumable', slot: null, image: '/images/Box/ResourceBox5.png', grade: ItemGrade.Legendary },
    { name: '재료 상자 VI', description: '상급 ~ 신비의 강화석 5개 획득', type: 'consumable', slot: null, image: '/images/Box/ResourceBox6.png', grade: ItemGrade.Mythic },
    { name: '골드 꾸러미1', description: '10 ~ 500 골드 획득', type: 'consumable', slot: null, image: '/images/Box/GoldBox1.png', grade: ItemGrade.Normal },
    { name: '골드 꾸러미2', description: '100 ~ 1,000 골드 획득', type: 'consumable', slot: null, image: '/images/Box/GoldBox2.png', grade: ItemGrade.Uncommon },
    { name: '골드 꾸러미3', description: '500 ~ 3,000 골드 획득', type: 'consumable', slot: null, image: '/images/Box/GoldBox3.png', grade: ItemGrade.Rare },
    { name: '골드 꾸러미4', description: '1,000 ~ 10,000 골드 획득', type: 'consumable', slot: null, image: '/images/Box/GoldBox4.png', grade: ItemGrade.Epic },
    { name: '다이아 꾸러미1', description: '1 ~ 20 다이아 획득', type: 'consumable', slot: null, image: '/images/Box/DiaBox1.png', grade: ItemGrade.Rare },
    { name: '다이아 꾸러미2', description: '10 ~ 30 다이아 획득', type: 'consumable', slot: null, image: '/images/Box/DiaBox2.png', grade: ItemGrade.Epic },
    { name: '다이아 꾸러미3', description: '20 ~ 50 다이아 획득', type: 'consumable', slot: null, image: '/images/Box/DiaBox3.png', grade: ItemGrade.Legendary },
    { name: '다이아 꾸러미4', description: '30 ~ 100 다이아 획득', type: 'consumable', slot: null, image: '/images/Box/DiaBox4.png', grade: ItemGrade.Mythic },
    { name: '컨디션회복제(소)', description: '컨디션을 1~10 회복합니다.', type: 'consumable', slot: null, image: '/images/use/con1.png', grade: ItemGrade.Normal },
    { name: '컨디션회복제(중)', description: '컨디션을 10~20 회복합니다.', type: 'consumable', slot: null, image: '/images/use/con2.png', grade: ItemGrade.Uncommon },
    { name: '컨디션회복제(대)', description: '컨디션을 20~30 회복합니다.', type: 'consumable', slot: null, image: '/images/use/con3.png', grade: ItemGrade.Rare },
    { name: '턴 추가', description: '도전의 탑에서 사용할 수 있는 턴 추가 아이템입니다.', type: 'consumable', slot: null, image: '/images/button/addturn.png', grade: ItemGrade.Normal, usable: true, sellable: true },
    { name: '미사일', description: '도전의 탑에서 사용할 수 있는 미사일 아이템입니다.', type: 'consumable', slot: null, image: '/images/button/missile.png', grade: ItemGrade.Normal, usable: true, sellable: true },
    { name: '히든', description: '도전의 탑에서 사용할 수 있는 히든 아이템입니다.', type: 'consumable', slot: null, image: '/images/button/hidden.png', grade: ItemGrade.Normal, usable: true, sellable: true },
    { name: '스캔', description: '도전의 탑에서 사용할 수 있는 스캔 아이템입니다.', type: 'consumable', slot: null, image: '/images/button/scan.png', grade: ItemGrade.Normal, usable: true, sellable: true },
    { name: '배치변경', description: '도전의 탑에서 사용할 수 있는 배치변경 아이템입니다.', type: 'consumable', slot: null, image: '/images/button/reflesh.png', grade: ItemGrade.Normal, usable: true, sellable: true },
    { name: '행동력 회복제(+10)', description: '가방으로 지급', type: 'consumable', slot: null, image: '/images/icon/applus.png', grade: ItemGrade.Normal, usable: true, sellable: false },
    { name: '행동력 회복제(+20)', description: '가방으로 지급', type: 'consumable', slot: null, image: '/images/icon/applus.png', grade: ItemGrade.Uncommon, usable: true, sellable: false },
    { name: '행동력 회복제(+30)', description: '가방으로 지급', type: 'consumable', slot: null, image: '/images/icon/applus.png', grade: ItemGrade.Rare, usable: true, sellable: false },
];

export const MATERIAL_ITEMS: Record<string, Omit<InventoryItem, 'id'|'createdAt'|'isEquipped'|'level'|'stars'|'options'|'enhancementFails'>> = {
    '옵션 종류 변경권': { name: '옵션 종류 변경권', description: '장비의 주옵션, 부옵션, 특수옵션 중 하나를 다른 종류의 옵션으로 변경할 수 있는 아이템입니다.', type: 'material', slot: null, image: '/images/use/change1.png', grade: ItemGrade.Normal },
    '옵션 수치 변경권': { name: '옵션 수치 변경권', description: '장비의 부옵션 또는 특수옵션 중 하나의 수치를 변경할 수 있는 아이템입니다.', type: 'material', slot: null, image: '/images/use/change2.png', grade: ItemGrade.Normal },
    '신화 옵션 변경권': { name: '신화 옵션 변경권', description: '신화 또는 초월 장비의 신화 옵션을 다른 신화 옵션으로 변경할 수 있는 아이템입니다.', type: 'material', slot: null, image: '/images/use/change3.png', grade: ItemGrade.Normal },
    '하급 강화석': { name: '하급 강화석', description: '장비 강화에 사용되는 기본 재료.', type: 'material', slot: null, image: '/images/materials/materials1.png', grade: ItemGrade.Normal },
    '중급 강화석': { name: '중급 강화석', description: '장비 강화에 사용되는 상급 재료.', type: 'material', slot: null, image: '/images/materials/materials2.png', grade: ItemGrade.Uncommon },
    '상급 강화석': { name: '상급 강화석', description: '장비 강화에 사용되는 최상급 재료.', type: 'material', slot: null, image: '/images/materials/materials3.png', grade: ItemGrade.Rare },
    '최상급 강화석': { name: '최상급 강화석', description: '장비 강화에 사용되는 희귀 재료.', type: 'material', slot: null, image: '/images/materials/materials4.png', grade: ItemGrade.Epic },
    '신비의 강화석': { name: '신비의 강화석', description: '장비 강화에 사용되는 고대 재료.', type: 'material', slot: null, image: '/images/materials/materials5.png', grade: ItemGrade.Legendary },
};

const TOWER_ONLY_CONSUMABLE_NAMES = new Set([
    '턴 추가', '턴증가', '미사일', '히든', '스캔', '배치 새로고침', '배치변경',
    'turn_add', 'turn_add_item', 'addturn', 'missile', 'hidden', 'scan', 'reflesh', 'refresh',
]);

const REFINEMENT_TICKET_NAMES = new Set(['옵션 종류 변경권', '옵션 수치 변경권', '신화 옵션 변경권']);

export function isActionPointConsumable(name: string | undefined): boolean {
    if (!name) return false;
    return name.startsWith('행동력 회복제');
}

export function isTowerOnlyConsumable(name: string | undefined): boolean {
    if (!name || typeof name !== 'string') return false;
    return TOWER_ONLY_CONSUMABLE_NAMES.has(name.trim());
}

export function isRefinementTicketMaterial(name: string | undefined): boolean {
    if (!name) return false;
    return REFINEMENT_TICKET_NAMES.has(name);
}

export const gradeBackgrounds: Record<ItemGrade, string> = {
    [ItemGrade.Normal]: '/images/equipments/normalbgi.png',
    [ItemGrade.Uncommon]: '/images/equipments/uncommonbgi.png',
    [ItemGrade.Rare]: '/images/equipments/rarebgi.png',
    [ItemGrade.Epic]: '/images/equipments/epicbgi.png',
    [ItemGrade.Legendary]: '/images/equipments/legendarybgi.png',
    [ItemGrade.Mythic]: '/images/equipments/mythicbgi.png',
    [ItemGrade.Transcendent]: '/images/equipments/mythicbgi.png',
};

export const gradeStyles: Record<ItemGrade, { name: string; color: string; background: string; }> = {
    normal: { name: '일반', color: 'text-gray-300', background: '/images/equipments/normalbgi.png' },
    uncommon: { name: '고급', color: 'text-green-400', background: '/images/equipments/uncommonbgi.png' },
    rare: { name: '희귀', color: 'text-blue-400', background: '/images/equipments/rarebgi.png' },
    epic: { name: '에픽', color: 'text-purple-400', background: '/images/equipments/epicbgi.png' },
    legendary: { name: '전설', color: 'text-red-500', background: '/images/equipments/legendarybgi.png' },
    mythic: { name: '신화', color: 'text-orange-400', background: '/images/equipments/mythicbgi.png' },
    transcendent: { name: '초월', color: 'text-cyan-300', background: '/images/equipments/mythicbgi.png' },
};

export const ENHANCEMENT_SUCCESS_RATES = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10]; // For +1 to +10

export const ENHANCEMENT_FAIL_BONUS_RATES: Record<ItemGrade, number> = {
    normal: 5,
    uncommon: 4,
    rare: 3,
    epic: 2,
    legendary: 1,
    mythic: 0.5,
    transcendent: 0.5,
};

// 등급별 메인 옵션 강화 증가 배수 테이블
// 인덱스 0~9는 각각 목표 별 수 1~10강에 해당
export const MAIN_ENHANCEMENT_STEP_MULTIPLIER: Record<ItemGrade, number[]> = {
    normal:   [1.0, 1.0, 1.0, 0.8, 0.6, 0.6, 0.4, 0.4, 0.3, 0.3],
    uncommon: [1.0, 1.0, 1.0, 0.9, 0.7, 0.7, 0.5, 0.5, 0.4, 0.4],
    rare:     [1.0, 1.0, 1.0, 1.0, 0.9, 0.9, 0.6, 0.6, 0.5, 0.5],
    epic:     [1.0, 1.0, 1.0, 1.1, 1.0, 1.0, 0.8, 0.8, 0.6, 0.6],
    legendary:[1.1, 1.1, 1.1, 1.2, 1.1, 1.1, 0.9, 0.9, 0.7, 0.7],
    mythic:   [1.1, 1.1, 1.1, 1.3, 1.2, 1.2, 1.0, 1.0, 0.8, 0.8],
    transcendent: [1.2, 1.2, 1.2, 1.4, 1.3, 1.3, 1.1, 1.1, 0.9, 0.9],
};

/** 마이그레이션 스크립트용 — 초월 등급과 동일 배율 */
export const DIVINE_MYTHIC_ENHANCEMENT_STEP_MULTIPLIER: number[] = [
    1.2, 1.2, 1.2, 1.4, 1.3, 1.3, 1.1, 1.1, 0.9, 0.9,
];

export const ENHANCEMENT_COSTS: Record<ItemGrade, { amount: number; name: string }[][]> = {
    normal: [
        /* +1 */ [{ amount: 10, name: '하급 강화석' }],
        /* +2 */ [{ amount: 15, name: '하급 강화석' }],
        /* +3 */ [{ amount: 20, name: '하급 강화석' }],
        /* +4 */ [{ amount: 25, name: '하급 강화석' }],
        /* +5 */ [{ amount: 30, name: '하급 강화석' }],
        /* +6 */ [{ amount: 30, name: '중급 강화석' }],
        /* +7 */ [{ amount: 50, name: '중급 강화석' }],
        /* +8 */ [{ amount: 5, name: '상급 강화석' }],
        /* +9 */ [{ amount: 10, name: '상급 강화석' }],
        /* +10 */[{ amount: 5, name: '최상급 강화석' }],
    ],
    uncommon: [
        /* +1 */ [{ amount: 20, name: '하급 강화석' }],
        /* +2 */ [{ amount: 30, name: '하급 강화석' }],
        /* +3 */ [{ amount: 40, name: '하급 강화석' }],
        /* +4 */ [{ amount: 50, name: '하급 강화석' }],
        /* +5 */ [{ amount: 60, name: '하급 강화석' }],
        /* +6 */ [{ amount: 50, name: '중급 강화석' }],
        /* +7 */ [{ amount: 10, name: '상급 강화석' }],
        /* +8 */ [{ amount: 20, name: '상급 강화석' }],
        /* +9 */ [{ amount: 10, name: '최상급 강화석' }],
        /* +10 */[{ amount: 20, name: '최상급 강화석' }],
    ],
    rare: [
        /* +1 */ [{ amount: 10, name: '중급 강화석' }],
        /* +2 */ [{ amount: 15, name: '중급 강화석' }],
        /* +3 */ [{ amount: 20, name: '중급 강화석' }],
        /* +4 */ [{ amount: 25, name: '중급 강화석' }],
        /* +5 */ [{ amount: 30, name: '중급 강화석' }],
        /* +6 */ [{ amount: 100, name: '중급 강화석' }],
        /* +7 */ [{ amount: 20, name: '상급 강화석' }],
        /* +8 */ [{ amount: 40, name: '상급 강화석' }],
        /* +9 */ [{ amount: 15, name: '최상급 강화석' }],
        /* +10 */[{ amount: 30, name: '최상급 강화석' }],
    ],
    epic: [
        /* +1 */ [{ amount: 20, name: '중급 강화석' }],
        /* +2 */ [{ amount: 30, name: '중급 강화석' }],
        /* +3 */ [{ amount: 40, name: '중급 강화석' }],
        /* +4 */ [{ amount: 50, name: '중급 강화석' }],
        /* +5 */ [{ amount: 60, name: '중급 강화석' }],
        /* +6 */ [{ amount: 30, name: '상급 강화석' }],
        /* +7 */ [{ amount: 50, name: '상급 강화석' }],
        /* +8 */ [{ amount: 20, name: '최상급 강화석' }],
        /* +9 */ [{ amount: 45, name: '최상급 강화석' }],
        /* +10 */[{ amount: 80, name: '최상급 강화석' }],
    ],
    legendary: [
        /* +1 */ [{ amount: 10, name: '상급 강화석' }],
        /* +2 */ [{ amount: 15, name: '상급 강화석' }],
        /* +3 */ [{ amount: 20, name: '상급 강화석' }],
        /* +4 */ [{ amount: 25, name: '상급 강화석' }],
        /* +5 */ [{ amount: 30, name: '상급 강화석' }],
        /* +6 */ [{ amount: 100, name: '상급 강화석' }],
        /* +7 */ [{ amount: 20, name: '최상급 강화석' }],
        /* +8 */ [{ amount: 50, name: '최상급 강화석' }],
        /* +9 */ [{ amount: 100, name: '최상급 강화석' }],
        /* +10 */[{ amount: 10, name: '신비의 강화석' }],
    ],
    mythic: [
        /* +1 */ [{ amount: 20, name: '상급 강화석' }],
        /* +2 */ [{ amount: 30, name: '상급 강화석' }],
        /* +3 */ [{ amount: 40, name: '상급 강화석' }],
        /* +4 */ [{ amount: 50, name: '상급 강화석' }],
        /* +5 */ [{ amount: 60, name: '상급 강화석' }],
        /* +6 */ [{ amount: 40, name: '최상급 강화석' }],
        /* +7 */ [{ amount: 80, name: '최상급 강화석' }],
        /* +8 */ [{ amount: 10, name: '신비의 강화석' }],
        /* +9 */ [{ amount: 50, name: '신비의 강화석' }],
        /* +10 */[{ amount: 100, name: '신비의 강화석' }],
    ],
    transcendent: [
        /* +1 */ [{ amount: 20, name: '상급 강화석' }],
        /* +2 */ [{ amount: 30, name: '상급 강화석' }],
        /* +3 */ [{ amount: 40, name: '상급 강화석' }],
        /* +4 */ [{ amount: 50, name: '상급 강화석' }],
        /* +5 */ [{ amount: 60, name: '상급 강화석' }],
        /* +6 */ [{ amount: 40, name: '최상급 강화석' }],
        /* +7 */ [{ amount: 80, name: '최상급 강화석' }],
        /* +8 */ [{ amount: 10, name: '신비의 강화석' }],
        /* +9 */ [{ amount: 50, name: '신비의 강화석' }],
        /* +10 */[{ amount: 100, name: '신비의 강화석' }],
    ],
};

/**
 * 장비 분해 환급 재료 계산용 강화 비용 행. +10(만렙)은 다음 단계 비용이 없으므로 마지막 행(+9→+10)을 씁니다.
 * (분해 미리보기 UI와 서버 DISASSEMBLE_ITEM이 동일 인덱스를 쓰도록 맞춤.)
 */
export function getEnhancementCostRowForDisassembly(
    grade: ItemGrade,
    stars: number | undefined | null
): { amount: number; name: string }[] | undefined {
    const rows = ENHANCEMENT_COSTS[grade];
    if (!rows?.length) return undefined;
    const idx = Math.min(Math.max(0, stars ?? 0), rows.length - 1);
    return rows[idx];
}

export const ENHANCEMENT_GOLD_COSTS_BASE: Record<ItemGrade, number> = {
    normal: 100,
    uncommon: 200,
    rare: 300,
    epic: 500,
    legendary: 1000,
    mythic: 2000,
    transcendent: 2200,
};

export const calculateEnhancementGoldCost = (grade: ItemGrade, currentStars: number): number => {
    const baseCost = ENHANCEMENT_GOLD_COSTS_BASE[grade];
    // Cost increases by 1.5x for each star level
    return Math.round(baseCost * (1.5 ** currentStars));
};


export const ITEM_SELL_PRICES: Record<ItemGrade, number> = {
    normal: 50,
    uncommon: 100,
    rare: 200,
    epic: 300,
    legendary: 500,
    mythic: 1000,
    transcendent: 1200,
};

export const MATERIAL_SELL_PRICES: Record<string, number> = {
    '하급 강화석': 10,
    '중급 강화석': 30,
    '상급 강화석': 50,
    '최상급 강화석': 100,
    '신비의 강화석': 200,
};

export const CONSUMABLE_SELL_PRICES: Record<string, number> = {
    '골드 꾸러미1': 0,
    '골드꾸러미1': 0, // 이름 변형 대응
    // 도전의 탑 아이템 판매 가격 (구매 가격의 20%)
    '턴 추가': 60, // 300 * 0.2
    '미사일': 60, // 300 * 0.2
    '히든': 100, // 500 * 0.2
    '스캔': 40, // 200 * 0.2
    '배치변경': 20, // 100 * 0.2
    '옵션 종류 변경권': 100, // 500 * 0.2
    '옵션 수치 변경권': 100, // 500 * 0.2
    '신화 옵션 변경권': 0, // 판매 불가
};

export const BASE_SLOTS_PER_CATEGORY = 30;
export const EXPANSION_AMOUNT = 10;

export const MAX_EQUIPMENT_SLOTS = 100;
export const MAX_CONSUMABLE_SLOTS = 50;
export const MAX_MATERIAL_SLOTS = 50;

// Core Stat Info
export const CORE_STATS_DATA: Record<CoreStat, { name: string; description: string }> = {
    [CoreStat.Concentration]: { name: '집중력', description: '모든 구간에 꾸준히 영향을 미칩니다. 안정적인 시작과 중반 운영, 끝내기에서의 실수 방지에 기여하는 기본 능력치입니다.' },
    [CoreStat.ThinkingSpeed]: { name: '사고속도', description: '챔피언십 초반전에 영향을 줍니다. 빠른 판단으로 초반 흐름을 유리하게 가져와 꾸준히 점수를 쌓는 데 도움을 줍니다.' },
    [CoreStat.Judgment]: { name: '판단력', description: '챔피언십 중반전에 가장 큰 영향을 미칩니다. 복잡한 형세에서 정확한 판단으로 미세한 이득을 점수로 연결하는 핵심 변수입니다.' },
    [CoreStat.Calculation]: { name: '계산력', description: '챔피언십 끝내기에서 승패를 결정짓는 가장 중요한 능력치입니다. 점수를 극대화하고 승리를 확정 짓는 데 사용됩니다.' },
    [CoreStat.CombatPower]: { name: '전투력', description: '챔피언십 초반전에 가장 큰 영향을 미칩니다. 높은 전투력은 초반 기세를 장악하고 점수를 쌓는 데 결정적인 역할을 합니다.' },
    [CoreStat.Stability]: { name: '안정감', description: '챔피언십 중반전과 끝내기에 중요하게 작용합니다. 상대의 공격을 효과적으로 방어하고 점수 손실을 최소화하는 방어 변수입니다.' },
};

export const MAIN_STAT_DEFINITIONS: Record<EquipmentSlot, {
    isPercentage: boolean;
    options: Record<ItemGrade, {
        stats: CoreStat[];
        value: number;
    }>
}> = {
    fan: {
        isPercentage: true,
        options: {
            normal:   { stats: [CoreStat.ThinkingSpeed, CoreStat.Concentration], value: 4 },
            uncommon: { stats: [CoreStat.ThinkingSpeed, CoreStat.Concentration], value: 6 },
            rare:     { stats: [CoreStat.ThinkingSpeed, CoreStat.Concentration], value: 8 },
            epic:     { stats: [CoreStat.ThinkingSpeed, CoreStat.Concentration], value: 10 },
            legendary:{ stats: [CoreStat.ThinkingSpeed, CoreStat.Concentration], value: 12 },
            mythic:   { stats: [CoreStat.ThinkingSpeed, CoreStat.Concentration], value: 15 },
            transcendent: { stats: [CoreStat.ThinkingSpeed, CoreStat.Concentration], value: 17 },
        }
    },
    board: {
        isPercentage: true,
        options: {
            normal:   { stats: [CoreStat.Stability, CoreStat.Calculation], value: 4 },
            uncommon: { stats: [CoreStat.Stability, CoreStat.Calculation], value: 6 },
            rare:     { stats: [CoreStat.Stability, CoreStat.Calculation], value: 8 },
            epic:     { stats: [CoreStat.Stability, CoreStat.Calculation], value: 10 },
            legendary:{ stats: [CoreStat.Stability, CoreStat.Calculation], value: 12 },
            mythic:   { stats: [CoreStat.Stability, CoreStat.Calculation], value: 15 },
            transcendent: { stats: [CoreStat.Stability, CoreStat.Calculation], value: 17 },
        }
    },
    top: {
        isPercentage: true,
        options: {
            normal:   { stats: [CoreStat.CombatPower, CoreStat.Judgment], value: 4 },
            uncommon: { stats: [CoreStat.CombatPower, CoreStat.Judgment], value: 6 },
            rare:     { stats: [CoreStat.CombatPower, CoreStat.Judgment], value: 8 },
            epic:     { stats: [CoreStat.CombatPower, CoreStat.Judgment], value: 10 },
            legendary:{ stats: [CoreStat.CombatPower, CoreStat.Judgment], value: 12 },
            mythic:   { stats: [CoreStat.CombatPower, CoreStat.Judgment], value: 15 },
            transcendent: { stats: [CoreStat.CombatPower, CoreStat.Judgment], value: 17 },
        }
    },
    bottom: {
        isPercentage: false,
        options: {
            normal:   { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.Judgment, CoreStat.Calculation, CoreStat.ThinkingSpeed], value: 8 },
            uncommon: { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.Judgment, CoreStat.Calculation, CoreStat.ThinkingSpeed], value: 12 },
            rare:     { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.Judgment, CoreStat.Calculation, CoreStat.ThinkingSpeed], value: 16 },
            epic:     { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.Judgment, CoreStat.Calculation, CoreStat.ThinkingSpeed], value: 20 },
            legendary:{ stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.Judgment, CoreStat.Calculation, CoreStat.ThinkingSpeed], value: 24 },
            mythic:   { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.Judgment, CoreStat.Calculation, CoreStat.ThinkingSpeed], value: 30 },
            transcendent: { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.Judgment, CoreStat.Calculation, CoreStat.ThinkingSpeed], value: 33 },
        }
    },
    stones: {
        isPercentage: false,
        options: {
            normal:   { stats: [CoreStat.CombatPower, CoreStat.Calculation], value: 8 },
            uncommon: { stats: [CoreStat.CombatPower, CoreStat.Calculation], value: 12 },
            rare:     { stats: [CoreStat.CombatPower, CoreStat.Calculation], value: 16 },
            epic:     { stats: [CoreStat.CombatPower, CoreStat.Calculation], value: 20 },
            legendary:{ stats: [CoreStat.CombatPower, CoreStat.Calculation], value: 24 },
            mythic:   { stats: [CoreStat.CombatPower, CoreStat.Calculation], value: 30 },
            transcendent: { stats: [CoreStat.CombatPower, CoreStat.Calculation], value: 33 },
        }
    },
    bowl: {
        isPercentage: false,
        options: {
            normal:   { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.ThinkingSpeed], value: 8 },
            uncommon: { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.ThinkingSpeed], value: 12 },
            rare:     { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.ThinkingSpeed], value: 16 },
            epic:     { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.ThinkingSpeed], value: 20 },
            legendary:{ stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.ThinkingSpeed], value: 24 },
            mythic:   { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.ThinkingSpeed], value: 30 },
            transcendent: { stats: [CoreStat.Concentration, CoreStat.Stability, CoreStat.ThinkingSpeed], value: 33 },
        }
    }
};
export const SPECIAL_STATS_DATA: Record<SpecialStat, { name: string; description: string; isPercentage: boolean; range: [number, number]; }> = {
    [SpecialStat.ActionPointMax]: { name: '행동력 최대치', description: '행동력의 최대치를 증가시킵니다.', isPercentage: false, range: [2, 5] },
    [SpecialStat.ActionPointRegen]: { name: '행동력 회복속도', description: '행동력이 회복되는 속도를 증가시킵니다.', isPercentage: true, range: [1, 3] },
    [SpecialStat.StrategyXpBonus]: { name: '전략 경험치 추가획득', description: '전략 바둑 승리 시 획득하는 경험치를 증가시킵니다.', isPercentage: true, range: [1, 3] },
    [SpecialStat.PlayfulXpBonus]: { name: '놀이 경험치 추가획득', description: '놀이 바둑 승리 시 획득하는 경험치를 증가시킵니다.', isPercentage: true, range: [1, 3] },
    [SpecialStat.GoldBonus]: { name: '골드보상 추가', description: '경기 승리 시 골드 보상을 추가로 획득합니다.', isPercentage: true, range: [1, 3] },
    [SpecialStat.ItemDropRate]: { name: '장비상자 획득확률 증가', description: '경기 승리 시 장비상자 획득 확률을 증가시킵니다.', isPercentage: true, range: [1, 2] },
    [SpecialStat.MaterialDropRate]: { name: '재료상자 획득확률 증가', description: '경기 승리 시 재료상자 획득 확률을 증가시킵니다.', isPercentage: true, range: [1, 3] },
};

export const MYTHIC_STATS_DATA: Record<MythicStat, { name: string; description: string; shortDescription: string; abbrevLabel: string; value: (range: [number, number]) => number; }> = {
    [MythicStat.MannerActionCooldown]: { 
        name: '매너 액션 버튼 생성시간 감소', 
        description: '매너 액션 버튼 생성시간을 감소시킵니다.', 
        shortDescription: '매너액션 쿨타임 -30초', 
        abbrevLabel: '매너액션 쿨감',
        value: () => 30 
    }, // Fixed 30s reduction
    [MythicStat.StrategicGoldBonus]: { 
        name: '전략 골드 보너스', 
        description: '전략 바둑 경기중 착수시 20%확률로 골드획득(10~50골드) 최대5회', 
        shortDescription: '전략바둑중 골드(10~50)획득 5회(20%)', 
        abbrevLabel: '전략 골드',
        value: () => 1 
    },
    [MythicStat.PlayfulGoldBonus]: { 
        name: '놀이 골드 보너스', 
        description: '놀이 바둑 경기중 60초마다 20%확률로 골드획득(10~50골드) 최대5회', 
        shortDescription: '놀이바둑중 골드(10~50)획득 5회(20%)', 
        abbrevLabel: '놀이 골드',
        value: () => 1 
    },
    [MythicStat.DiceGoOddBonus]: { 
        name: '주사위 홀/짝 보너스', 
        description: '주사위 바둑에서 홀·짝·낮은수·높은수 아이템 각 1개씩 추가', 
        shortDescription: '주사위바둑 아이템 추가+1', 
        abbrevLabel: '주사위 보너스',
        value: () => 1 
    },
    [MythicStat.AlkkagiSlowBonus]: { 
        name: '알까기 슬로우 보너스', 
        description: '알까기 및 바둑컬링에서 슬로우 아이템 1개추가', 
        shortDescription: '알까기/컬링 슬로우 +1개', 
        abbrevLabel: '슬로우 보너스',
        value: () => 1 
    },
    [MythicStat.AlkkagiAimingBonus]: { 
        name: '알까기 조준선 보너스', 
        description: '알까기 및 바둑컬링에서 조준선 아이템 1개추가', 
        shortDescription: '알까기/컬링 조준선 +1개', 
        abbrevLabel: '조준선 보너스',
        value: () => 1 
    },
};

/** 생성 시 전투·특수 개수는 등급별; 강화는 전투 부옵 최대 4줄까지 추가 후 줄 수치만 강화. mythicCount만 신화 줄 수(0/1/2). */
export const GRADE_SUB_OPTION_RULES: Record<ItemGrade, { combatCount: [number, number]; specialCount: [number, number]; mythicCount: [number, number]; combatTier: number; }> = {
    normal:   { combatCount: [1, 2], specialCount: [0, 0], mythicCount: [0, 0], combatTier: 1 },
    uncommon: { combatCount: [2, 3], specialCount: [1, 1], mythicCount: [0, 0], combatTier: 2 },
    rare:     { combatCount: [3, 3], specialCount: [1, 1], mythicCount: [0, 0], combatTier: 3 },
    epic:     { combatCount: [3, 4], specialCount: [1, 1], mythicCount: [0, 0], combatTier: 4 },
    legendary:{ combatCount: [4, 4], specialCount: [1, 2], mythicCount: [0, 0], combatTier: 5 },
    mythic:   { combatCount: [4, 4], specialCount: [1, 2], mythicCount: [1, 1], combatTier: 6 },
    transcendent: { combatCount: [4, 4], specialCount: [1, 2], mythicCount: [2, 2], combatTier: 7 },
};

export type SubOptionDefinition = { type: CoreStat; isPercentage: boolean; range: [number, number] };

/**
 * 부옵션 강화·제련 시 풀에서 정의 찾기. 동일 스탯이 %/고정 수치로 중복될 수 있어 isPercentage를 엄격히 구분.
 * 레거시 데이터에서 isPercentage 누락(undefined)은 고정 수치(false)로 간주. 직렬화로 문자열이 온 경우도 보정.
 * 해당 슬롯에 동일 스탯 정의가 하나뿐이면 플래그 불일치 시 그 정의를 사용(잘못된 플래그 보정).
 */
export function resolveCombatSubPoolDefinition(
    pool: SubOptionDefinition[],
    statType: CoreStat,
    isPercentage?: unknown
): SubOptionDefinition | undefined {
    const wantPct =
        isPercentage === true ||
        isPercentage === 1 ||
        (typeof isPercentage === 'string' && isPercentage.toLowerCase() === 'true');
    const exact = pool.find((s) => s.type === statType && (s.isPercentage === true) === wantPct);
    if (exact) return exact;
    const sameType = pool.filter((s) => s.type === statType);
    if (sameType.length === 1) return sameType[0];
    return undefined;
}

export const SUB_OPTION_POOLS: Record<EquipmentSlot, Record<number, SubOptionDefinition[]>> = {
    fan: {
        1: [ { type: CoreStat.Concentration, isPercentage: true, range: [1, 2] }, { type: CoreStat.CombatPower, isPercentage: false, range: [2, 5] }, { type: CoreStat.Judgment, isPercentage: false, range: [2, 5] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [1, 2] }, { type: CoreStat.Stability, isPercentage: false, range: [2, 5] }, { type: CoreStat.Calculation, isPercentage: false, range: [2, 5] } ],
        2: [ { type: CoreStat.Concentration, isPercentage: true, range: [2, 3] }, { type: CoreStat.CombatPower, isPercentage: false, range: [3, 6] }, { type: CoreStat.Judgment, isPercentage: false, range: [3, 6] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [2, 3] }, { type: CoreStat.Stability, isPercentage: false, range: [3, 6] }, { type: CoreStat.Calculation, isPercentage: false, range: [3, 6] } ],
        3: [ { type: CoreStat.Concentration, isPercentage: true, range: [3, 5] }, { type: CoreStat.CombatPower, isPercentage: false, range: [4, 7] }, { type: CoreStat.Judgment, isPercentage: false, range: [4, 7] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [3, 5] }, { type: CoreStat.Stability, isPercentage: false, range: [4, 7] }, { type: CoreStat.Calculation, isPercentage: false, range: [4, 7] } ],
        4: [ { type: CoreStat.Concentration, isPercentage: true, range: [4, 6] }, { type: CoreStat.CombatPower, isPercentage: false, range: [5, 8] }, { type: CoreStat.Judgment, isPercentage: false, range: [5, 8] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [4, 6] }, { type: CoreStat.Stability, isPercentage: false, range: [5, 8] }, { type: CoreStat.Calculation, isPercentage: false, range: [5, 8] } ],
        5: [ { type: CoreStat.Concentration, isPercentage: true, range: [5, 7] }, { type: CoreStat.CombatPower, isPercentage: false, range: [7, 10] }, { type: CoreStat.Judgment, isPercentage: false, range: [7, 10] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [5, 7] }, { type: CoreStat.Stability, isPercentage: false, range: [7, 10] }, { type: CoreStat.Calculation, isPercentage: false, range: [7, 10] } ],
        6: [ { type: CoreStat.Concentration, isPercentage: true, range: [8, 10] }, { type: CoreStat.CombatPower, isPercentage: false, range: [10, 15] }, { type: CoreStat.Judgment, isPercentage: false, range: [10, 15] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [8, 10] }, { type: CoreStat.Stability, isPercentage: false, range: [10, 15] }, { type: CoreStat.Calculation, isPercentage: false, range: [10, 15] } ],
        7: [ { type: CoreStat.Concentration, isPercentage: true, range: [9, 12] }, { type: CoreStat.CombatPower, isPercentage: false, range: [11, 17] }, { type: CoreStat.Judgment, isPercentage: false, range: [11, 17] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [9, 12] }, { type: CoreStat.Stability, isPercentage: false, range: [11, 17] }, { type: CoreStat.Calculation, isPercentage: false, range: [11, 17] } ]
    },
    board: {
        1: [ { type: CoreStat.Concentration, isPercentage: true, range: [1, 2] }, { type: CoreStat.CombatPower, isPercentage: false, range: [2, 5] }, { type: CoreStat.Judgment, isPercentage: false, range: [2, 5] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [2, 5] }, { type: CoreStat.Stability, isPercentage: true, range: [1, 2] }, { type: CoreStat.Calculation, isPercentage: false, range: [2, 5] } ],
        2: [ { type: CoreStat.Concentration, isPercentage: true, range: [2, 3] }, { type: CoreStat.CombatPower, isPercentage: false, range: [3, 6] }, { type: CoreStat.Judgment, isPercentage: false, range: [3, 6] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [3, 6] }, { type: CoreStat.Stability, isPercentage: true, range: [2, 3] }, { type: CoreStat.Calculation, isPercentage: false, range: [3, 6] } ],
        3: [ { type: CoreStat.Concentration, isPercentage: true, range: [3, 5] }, { type: CoreStat.CombatPower, isPercentage: false, range: [4, 7] }, { type: CoreStat.Judgment, isPercentage: false, range: [4, 7] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [4, 7] }, { type: CoreStat.Stability, isPercentage: true, range: [3, 5] }, { type: CoreStat.Calculation, isPercentage: false, range: [4, 7] } ],
        4: [ { type: CoreStat.Concentration, isPercentage: true, range: [4, 6] }, { type: CoreStat.CombatPower, isPercentage: false, range: [5, 8] }, { type: CoreStat.Judgment, isPercentage: false, range: [5, 8] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [5, 8] }, { type: CoreStat.Stability, isPercentage: true, range: [4, 6] }, { type: CoreStat.Calculation, isPercentage: false, range: [5, 8] } ],
        5: [ { type: CoreStat.Concentration, isPercentage: true, range: [5, 7] }, { type: CoreStat.CombatPower, isPercentage: false, range: [7, 10] }, { type: CoreStat.Judgment, isPercentage: false, range: [7, 10] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [7, 10] }, { type: CoreStat.Stability, isPercentage: true, range: [5, 7] }, { type: CoreStat.Calculation, isPercentage: false, range: [7, 10] } ],
        6: [ { type: CoreStat.Concentration, isPercentage: true, range: [8, 10] }, { type: CoreStat.CombatPower, isPercentage: false, range: [10, 15] }, { type: CoreStat.Judgment, isPercentage: false, range: [10, 15] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [10, 15] }, { type: CoreStat.Stability, isPercentage: true, range: [8, 10] }, { type: CoreStat.Calculation, isPercentage: false, range: [10, 15] } ],
        7: [ { type: CoreStat.Concentration, isPercentage: true, range: [9, 12] }, { type: CoreStat.CombatPower, isPercentage: false, range: [11, 17] }, { type: CoreStat.Judgment, isPercentage: false, range: [11, 17] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [11, 17] }, { type: CoreStat.Stability, isPercentage: true, range: [9, 12] }, { type: CoreStat.Calculation, isPercentage: false, range: [11, 17] } ]
    },
    top: {
        1: [ { type: CoreStat.Concentration, isPercentage: false, range: [2, 5] }, { type: CoreStat.Concentration, isPercentage: true, range: [1, 2] }, { type: CoreStat.CombatPower, isPercentage: true, range: [1, 2] }, { type: CoreStat.CombatPower, isPercentage: false, range: [2, 5] }, { type: CoreStat.Judgment, isPercentage: false, range: [2, 5] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [2, 5] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [1, 2] }, { type: CoreStat.Stability, isPercentage: false, range: [2, 5] }, { type: CoreStat.Stability, isPercentage: true, range: [1, 2] }, { type: CoreStat.Calculation, isPercentage: true, range: [1, 2] } ],
        2: [ { type: CoreStat.Concentration, isPercentage: false, range: [3, 6] }, { type: CoreStat.Concentration, isPercentage: true, range: [2, 3] }, { type: CoreStat.CombatPower, isPercentage: true, range: [2, 3] }, { type: CoreStat.CombatPower, isPercentage: false, range: [3, 6] }, { type: CoreStat.Judgment, isPercentage: false, range: [3, 6] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [3, 6] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [2, 3] }, { type: CoreStat.Stability, isPercentage: false, range: [3, 6] }, { type: CoreStat.Stability, isPercentage: true, range: [2, 3] }, { type: CoreStat.Calculation, isPercentage: true, range: [2, 3] } ],
        3: [ { type: CoreStat.Concentration, isPercentage: false, range: [4, 7] }, { type: CoreStat.Concentration, isPercentage: true, range: [3, 5] }, { type: CoreStat.CombatPower, isPercentage: true, range: [3, 5] }, { type: CoreStat.CombatPower, isPercentage: false, range: [4, 7] }, { type: CoreStat.Judgment, isPercentage: false, range: [4, 7] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [4, 7] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [3, 5] }, { type: CoreStat.Stability, isPercentage: false, range: [4, 7] }, { type: CoreStat.Stability, isPercentage: true, range: [3, 5] }, { type: CoreStat.Calculation, isPercentage: true, range: [3, 5] } ],
        4: [ { type: CoreStat.Concentration, isPercentage: false, range: [5, 8] }, { type: CoreStat.Concentration, isPercentage: true, range: [4, 6] }, { type: CoreStat.CombatPower, isPercentage: true, range: [4, 6] }, { type: CoreStat.CombatPower, isPercentage: false, range: [5, 8] }, { type: CoreStat.Judgment, isPercentage: false, range: [5, 8] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [5, 8] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [4, 6] }, { type: CoreStat.Stability, isPercentage: false, range: [5, 8] }, { type: CoreStat.Stability, isPercentage: true, range: [4, 6] }, { type: CoreStat.Calculation, isPercentage: true, range: [4, 6] } ],
        5: [ { type: CoreStat.Concentration, isPercentage: false, range: [7, 10] }, { type: CoreStat.Concentration, isPercentage: true, range: [5, 7] }, { type: CoreStat.CombatPower, isPercentage: true, range: [5, 7] }, { type: CoreStat.CombatPower, isPercentage: false, range: [7, 10] }, { type: CoreStat.Judgment, isPercentage: false, range: [7, 10] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [7, 10] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [5, 7] }, { type: CoreStat.Stability, isPercentage: false, range: [7, 10] }, { type: CoreStat.Stability, isPercentage: true, range: [5, 7] }, { type: CoreStat.Calculation, isPercentage: true, range: [5, 7] } ],
        6: [ { type: CoreStat.Concentration, isPercentage: false, range: [10, 15] }, { type: CoreStat.Concentration, isPercentage: true, range: [8, 10] }, { type: CoreStat.CombatPower, isPercentage: true, range: [8, 10] }, { type: CoreStat.CombatPower, isPercentage: false, range: [10, 15] }, { type: CoreStat.Judgment, isPercentage: false, range: [10, 15] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [10, 15] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [8, 10] }, { type: CoreStat.Stability, isPercentage: false, range: [10, 15] }, { type: CoreStat.Stability, isPercentage: true, range: [8, 10] }, { type: CoreStat.Calculation, isPercentage: true, range: [8, 10] } ],
        7: [ { type: CoreStat.Concentration, isPercentage: false, range: [11, 17] }, { type: CoreStat.Concentration, isPercentage: true, range: [9, 12] }, { type: CoreStat.CombatPower, isPercentage: true, range: [9, 12] }, { type: CoreStat.CombatPower, isPercentage: false, range: [11, 17] }, { type: CoreStat.Judgment, isPercentage: false, range: [11, 17] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [11, 17] }, { type: CoreStat.ThinkingSpeed, isPercentage: true, range: [9, 12] }, { type: CoreStat.Stability, isPercentage: false, range: [11, 17] }, { type: CoreStat.Stability, isPercentage: true, range: [9, 12] }, { type: CoreStat.Calculation, isPercentage: true, range: [9, 12] } ]
    },
    bottom: {
        1: [ { type: CoreStat.Concentration, isPercentage: false, range: [2, 5] }, { type: CoreStat.CombatPower, isPercentage: false, range: [2, 5] }, { type: CoreStat.Judgment, isPercentage: false, range: [2, 5] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [2, 5] }, { type: CoreStat.Stability, isPercentage: false, range: [2, 5] }, { type: CoreStat.Calculation, isPercentage: false, range: [2, 5] } ],
        2: [ { type: CoreStat.Concentration, isPercentage: false, range: [3, 6] }, { type: CoreStat.CombatPower, isPercentage: false, range: [3, 6] }, { type: CoreStat.Judgment, isPercentage: false, range: [3, 6] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [3, 6] }, { type: CoreStat.Stability, isPercentage: false, range: [3, 6] }, { type: CoreStat.Calculation, isPercentage: false, range: [3, 6] } ],
        3: [ { type: CoreStat.Concentration, isPercentage: false, range: [4, 7] }, { type: CoreStat.CombatPower, isPercentage: false, range: [4, 7] }, { type: CoreStat.Judgment, isPercentage: false, range: [4, 7] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [4, 7] }, { type: CoreStat.Stability, isPercentage: false, range: [4, 7] }, { type: CoreStat.Calculation, isPercentage: false, range: [4, 7] } ],
        4: [ { type: CoreStat.Concentration, isPercentage: false, range: [5, 8] }, { type: CoreStat.CombatPower, isPercentage: false, range: [5, 8] }, { type: CoreStat.Judgment, isPercentage: false, range: [5, 8] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [5, 8] }, { type: CoreStat.Stability, isPercentage: false, range: [5, 8] }, { type: CoreStat.Calculation, isPercentage: false, range: [5, 8] } ],
        5: [ { type: CoreStat.Concentration, isPercentage: false, range: [7, 10] }, { type: CoreStat.CombatPower, isPercentage: false, range: [7, 10] }, { type: CoreStat.Judgment, isPercentage: false, range: [7, 10] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [7, 10] }, { type: CoreStat.Stability, isPercentage: false, range: [7, 10] }, { type: CoreStat.Calculation, isPercentage: false, range: [7, 10] } ],
        6: [ { type: CoreStat.Concentration, isPercentage: false, range: [8, 12] }, { type: CoreStat.CombatPower, isPercentage: false, range: [8, 12] }, { type: CoreStat.Judgment, isPercentage: false, range: [8, 12] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [8, 12] }, { type: CoreStat.Stability, isPercentage: false, range: [8, 12] }, { type: CoreStat.Calculation, isPercentage: false, range: [8, 12] } ],
        7: [ { type: CoreStat.Concentration, isPercentage: false, range: [9, 13] }, { type: CoreStat.CombatPower, isPercentage: false, range: [9, 13] }, { type: CoreStat.Judgment, isPercentage: false, range: [9, 13] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [9, 13] }, { type: CoreStat.Stability, isPercentage: false, range: [9, 13] }, { type: CoreStat.Calculation, isPercentage: false, range: [9, 13] } ]
    },
    stones: {
        1: [ { type: CoreStat.Concentration, isPercentage: false, range: [2, 5] }, { type: CoreStat.CombatPower, isPercentage: false, range: [2, 5] }, { type: CoreStat.Judgment, isPercentage: false, range: [2, 5] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [2, 5] }, { type: CoreStat.Stability, isPercentage: false, range: [2, 5] } ],
        2: [ { type: CoreStat.Concentration, isPercentage: false, range: [3, 6] }, { type: CoreStat.CombatPower, isPercentage: false, range: [3, 6] }, { type: CoreStat.Judgment, isPercentage: false, range: [3, 6] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [3, 6] }, { type: CoreStat.Stability, isPercentage: false, range: [3, 6] } ],
        3: [ { type: CoreStat.Concentration, isPercentage: false, range: [4, 7] }, { type: CoreStat.CombatPower, isPercentage: false, range: [4, 7] }, { type: CoreStat.Judgment, isPercentage: false, range: [4, 7] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [4, 7] }, { type: CoreStat.Stability, isPercentage: false, range: [4, 7] } ],
        4: [ { type: CoreStat.Concentration, isPercentage: false, range: [5, 8] }, { type: CoreStat.CombatPower, isPercentage: false, range: [5, 8] }, { type: CoreStat.Judgment, isPercentage: false, range: [5, 8] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [5, 8] }, { type: CoreStat.Stability, isPercentage: false, range: [5, 8] } ],
        5: [ { type: CoreStat.Concentration, isPercentage: false, range: [7, 10] }, { type: CoreStat.CombatPower, isPercentage: false, range: [7, 10] }, { type: CoreStat.Judgment, isPercentage: false, range: [7, 10] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [7, 10] }, { type: CoreStat.Stability, isPercentage: false, range: [7, 10] } ],
        6: [ { type: CoreStat.Concentration, isPercentage: false, range: [8, 12] }, { type: CoreStat.CombatPower, isPercentage: false, range: [8, 12] }, { type: CoreStat.Judgment, isPercentage: false, range: [8, 12] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [8, 12] }, { type: CoreStat.Stability, isPercentage: false, range: [8, 12] } ],
        7: [ { type: CoreStat.Concentration, isPercentage: false, range: [9, 13] }, { type: CoreStat.CombatPower, isPercentage: false, range: [9, 13] }, { type: CoreStat.Judgment, isPercentage: false, range: [9, 13] }, { type: CoreStat.ThinkingSpeed, isPercentage: false, range: [9, 13] }, { type: CoreStat.Stability, isPercentage: false, range: [9, 13] } ]
    },
    bowl: {
        1: [ { type: CoreStat.Concentration, isPercentage: false, range: [2, 5] }, { type: CoreStat.CombatPower, isPercentage: false, range: [2, 5] }, { type: CoreStat.Judgment, isPercentage: false, range: [2, 5] }, { type: CoreStat.Stability, isPercentage: false, range: [2, 5] }, { type: CoreStat.Calculation, isPercentage: false, range: [2, 5] } ],
        2: [ { type: CoreStat.Concentration, isPercentage: false, range: [3, 6] }, { type: CoreStat.CombatPower, isPercentage: false, range: [3, 6] }, { type: CoreStat.Judgment, isPercentage: false, range: [3, 6] }, { type: CoreStat.Stability, isPercentage: false, range: [3, 6] }, { type: CoreStat.Calculation, isPercentage: false, range: [3, 6] } ],
        3: [ { type: CoreStat.Concentration, isPercentage: false, range: [4, 7] }, { type: CoreStat.CombatPower, isPercentage: false, range: [4, 7] }, { type: CoreStat.Judgment, isPercentage: false, range: [4, 7] }, { type: CoreStat.Stability, isPercentage: false, range: [4, 7] }, { type: CoreStat.Calculation, isPercentage: false, range: [4, 7] } ],
        4: [ { type: CoreStat.Concentration, isPercentage: false, range: [5, 8] }, { type: CoreStat.CombatPower, isPercentage: false, range: [5, 8] }, { type: CoreStat.Judgment, isPercentage: false, range: [5, 8] }, { type: CoreStat.Stability, isPercentage: false, range: [5, 8] }, { type: CoreStat.Calculation, isPercentage: false, range: [5, 8] } ],
        5: [ { type: CoreStat.Concentration, isPercentage: false, range: [7, 10] }, { type: CoreStat.CombatPower, isPercentage: false, range: [7, 10] }, { type: CoreStat.Judgment, isPercentage: false, range: [7, 10] }, { type: CoreStat.Stability, isPercentage: false, range: [7, 10] }, { type: CoreStat.Calculation, isPercentage: false, range: [7, 10] } ],
        6: [ { type: CoreStat.Concentration, isPercentage: false, range: [8, 12] }, { type: CoreStat.CombatPower, isPercentage: false, range: [8, 12] }, { type: CoreStat.Judgment, isPercentage: false, range: [8, 12] }, { type: CoreStat.Stability, isPercentage: false, range: [8, 12] }, { type: CoreStat.Calculation, isPercentage: false, range: [8, 12] } ],
        7: [ { type: CoreStat.Concentration, isPercentage: false, range: [9, 13] }, { type: CoreStat.CombatPower, isPercentage: false, range: [9, 13] }, { type: CoreStat.Judgment, isPercentage: false, range: [9, 13] }, { type: CoreStat.Stability, isPercentage: false, range: [9, 13] }, { type: CoreStat.Calculation, isPercentage: false, range: [9, 13] } ]
    },
};