#!/usr/bin/env npx tsx
/**
 * Merge inventory meta (description / usage / acquire) strings into ko/en catalog masters.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const catalogDir = path.join(root, 'shared/i18n/catalog');

const META_EN: Record<string, string> = {
    'description.gold': 'The main currency used across the Go world.',
    'description.diamond': 'Premium currency for special purchases and expansions.',
    'usage.goldSpend': 'Spent at shops, enhancement, crafting, entry fees, and more.',
    'usage.diamondSpend': 'Used in the diamond shop, bag expansion, and similar features.',
    'usage.unbindTicket': '[Bag] → [Select gear] → [Unbind]',
    'usage.refinementCharm': '[Blacksmith] → [Refinement] — select gear that cannot be refined',
    'usage.refinementTicket.optionType': '[Blacksmith — Refinement] Change option type',
    'usage.refinementTicket.optionValue': '[Blacksmith — Refinement] Reroll option value',
    'usage.refinementTicket.specialOption': '[Blacksmith — Refinement] Change special option',
    'usage.refinementTicket.mythicOption': '[Blacksmith — Refinement] Change mythic option',
    'usage.refinementTicket.generic': '[Blacksmith — Refinement] Change option',
    'usage.conditionPotion': '[Championship] Restore {{lo}}–{{hi}} condition before a match',
    'usage.actionPointInstant': '[Use now] Restore +{{amount}} AP',
    'usage.actionPointInstantGeneric': '[Use now] Restore AP',
    'usage.openBoxInBag': 'Use from your bag to receive rewards.',
    'usage.equipmentBoxOpen': 'Open the box from your bag to obtain gear.',
    'usage.enhancementMaterial.single': '[{{gradeLabel}}] Gear: {{rangeLabel}}',
    'usage.enhancementMaterial.range': '[{{gradeLabel}}] Gear: {{rangeLabel}}',
    'enhanceRange.single': '+{{stars}} enhance',
    'enhanceRange.range': '+{{minStars}}~{{maxStars}} enhance',
    'usage.pet.soulGradeUpgrade': '[Pet · Grade up] {{fromGrade}}→{{toGrade}} (Pet Lv.{{minLevel}}+)',
    'usage.pet.soulGradeUpgradeGeneric': '[Pet · Grade up] Used to raise pair arena AI pet grade',
    'usage.pet.eggHatchRandom': '[Pet · Incubator] Place in a slot to hatch a random AI pet',
    'usage.pet.welcomeEggHatch': '[Pet · Incubator] 1 min hatch — level 10 AI pet',
    'acquire.gold.line1': '[Matches · Content] PvP, singleplayer, dungeons, leagues, etc.',
    'acquire.gold.line2': '[Quests · Adventure] Daily/weekly/monthly quests, treasure boxes, VIP slots',
    'acquire.gold.line3': '[Trade · Disassembly] Exchange sales, gear disassembly, some shop sales',
    'acquire.diamond.line1': '[Shop] Diamond packages, consumables, materials tabs',
    'acquire.diamond.line2': '[Payment · Events] Top-ups, promo mail from operations',
    'acquire.diamond.line3': '[Features] Bag expansion and other premium features',
    'acquire.tower.line1': '[Tower] Item shop on the match info screen (gold)',
    'acquire.tower.line2': '[Tower] Entry/clear rewards, VIP rewards, and more',
    'acquire.actionPoint.line1': '[Shop] Gold shop — AP potions (+10/+20/+30), daily limits',
    'acquire.actionPoint.line2': '[Mail · Events] Operations rewards and promotions',
    'acquire.actionPoint.line3': '[Function VIP] Daily AP potion III mail while active',
    'acquire.condition.line1': '[Shop] Diamond shop (consumables) or related packages',
    'acquire.condition.line2': '[Quests · Events] Some reward sources',
    'acquire.guildEquipBox.line1': '[Guild shop] Guild coins only',
    'acquire.guildEquipBox.line2': '[Shop · Quests] Use from bag like normal equipment boxes',
    'acquire.equipBox.line1': '[Shop] Gold shop (gear), ad rewards, some cash packages',
    'acquire.equipBox.line2': '[Quests · VIP] Daily/weekly/monthly quests, reward VIP slots',
    'acquire.equipBox.line3': '[Adventure · Guild] Treasure boxes, guild boss rewards, etc.',
    'acquire.materialBox.line1': '[Shop] Gold/diamond shops (materials), ads, packages',
    'acquire.materialBox.line2': '[Quests · VIP] Daily/weekly/monthly quests, reward VIP slots',
    'acquire.goldBundle.line1': '[Shop] Diamond shop (consumables), ad rewards',
    'acquire.goldBundle.line2': '[Quests · Adventure] Various rewards and treasure boxes',
    'acquire.diamondBundle.line1': '[Shop] Diamond shop (consumables), ad rewards',
    'acquire.diamondBundle.line2': '[Quests · Events] Some rewards',
    'acquire.bonusStat.line1': '[Guild shop] Guild coins (account limit)',
    'acquire.bonusStat.line2': '[Growth] Some grants on strategy/play level-ups',
    'acquire.enhancementStone.line1': '[Guild shop] Exchange low–mystic enhancement stones',
    'acquire.enhancementStone.line2': '[Material boxes] From shops, quests, VIP, etc.',
    'acquire.enhancementStone.line3': '[Blacksmith] Synthesis, disassembly, enhancement costs',
    'acquire.enhancementStone.line4': '[Adventure · Rank · Guild] Wins, tower, boss war rewards',
    'acquire.material.line1': '[Shop] Gold/diamond material shops, guild shop (some)',
    'acquire.material.line2': '[Quests · Adventure · Events] Daily/weekly/monthly, boxes, ops rewards',
    'acquire.material.line3': '[Mail] Crafting/enhancement results, event grants',
    'acquire.equipment.line1': '[Equipment boxes] Open boxes from your bag',
    'acquire.equipment.line2': '[Adventure] Stage and boss clear rewards',
    'acquire.equipment.line3': '[Exchange] Buy listed items from other players',
    'acquire.equipment.line4': '[Crafting] Blacksmith combine, transcendent crafting, etc.',
    'acquire.consumableGeneric': '[Shop · Quests · Mail] Shops, events, operations rewards',
    'acquire.pet.soulTraining': '[Pet · Training rewards] Slots {{slots}}',
    'acquire.pet.soulConvert': '[Pet · Soul convert] From disassembling {{grades}} pets',
    'acquire.pet.soulShopDiamond': '[Pet · Pet shop] {{amount}} diamonds',
    'acquire.pet.soulShopGold': '[Pet · Pet shop] {{amount}} gold',
    'acquire.pet.soulShopDiamondDaily': '[Pet · Pet shop] {{amount}} diamonds, {{limit}}/day',
    'acquire.pet.soulShopGoldDaily': '[Pet · Pet shop] {{amount}} gold, {{limit}}/day',
    'acquire.pet.soulFallback': '[Pet] Pair arena and incubator content',
    'acquire.pet.eggShop': '[Pet · Pet shop] Buy with gold/diamonds (daily limit)',
    'acquire.pet.eggRewards': '[Pet · Training · Events] Some reward sources',
    'acquire.pet.welcomeEggMail': '[Mail] Welcome grants, operations mail, etc.',
    'acquire.pet.welcomeEggShop': '[Pet · Pet shop] Diamonds (1/day)',
};

const META_KO: Record<string, string> = {
    'description.gold': '바둑계 전역에서 사용되는 대표 화폐입니다.',
    'description.diamond': '특별한 구매·확장 등에 사용되는 프리미엄 재화입니다.',
    'usage.goldSpend': '상점, 강화·제작, 입장료 등 골드 소비처에서 사용됩니다.',
    'usage.diamondSpend': '다이아 상점, 가방 슬롯 확장 등에서 사용됩니다.',
    'usage.unbindTicket': '[가방]-[장비선택]-[귀속해제]',
    'usage.refinementCharm': '[대장간]-[장비제련] 제련불가 장비 선택',
    'usage.refinementTicket.optionType': '[대장간 - 장비제련] 옵션 종류변경',
    'usage.refinementTicket.optionValue': '[대장간 - 장비제련] 옵션 수치변경',
    'usage.refinementTicket.specialOption': '[대장간 - 장비제련] 스페셜 옵션변경',
    'usage.refinementTicket.mythicOption': '[대장간 - 장비제련] 신화 옵션변경',
    'usage.refinementTicket.generic': '[대장간 - 장비제련] 옵션 변경',
    'usage.conditionPotion': '[챔피언십] 경기시작 전 컨디션 {{lo}}~{{hi}}회복',
    'usage.actionPointInstant': '[즉시사용] 행동력 회복 +{{amount}}',
    'usage.actionPointInstantGeneric': '[즉시사용] 행동력 회복',
    'usage.openBoxInBag': '가방에서 사용하면 보상을 획득합니다.',
    'usage.equipmentBoxOpen': '가방에서 상자를 사용하면 장비를 획득할 수 있습니다.',
    'usage.enhancementMaterial.single': '[{{gradeLabel}}] 장비 : {{rangeLabel}}',
    'usage.enhancementMaterial.range': '[{{gradeLabel}}] 장비 : {{rangeLabel}}',
    'enhanceRange.single': '{{stars}}강화',
    'enhanceRange.range': '{{minStars}}~{{maxStars}}강화',
    'usage.pet.soulGradeUpgrade': '[펫 · 등급 강화] {{fromGrade}}→{{toGrade}} (펫 Lv.{{minLevel}} 이상)',
    'usage.pet.soulGradeUpgradeGeneric': '[펫 · 등급 강화] 페어 경기장 동료 AI 펫의 등급 상승에 사용',
    'usage.pet.eggHatchRandom': '[펫 · 부화장] 슬롯에 배치해 무작위 종류의 AI 펫으로 부화',
    'usage.pet.welcomeEggHatch': '[펫 · 부화장] 슬롯에 배치 — 부화 시간 1분, 부화 시 레벨 10 AI 펫',
    'acquire.gold.line1': '[경기·콘텐츠] 바둑 대국, 싱글플레이, 던전·리그 등',
    'acquire.gold.line2': '[퀘스트·모험] 일일·주간·월간 퀘스트, 보물상자, VIP 슬롯',
    'acquire.gold.line3': '[거래·분해] 거래소 판매 정산, 장비 분해, 일부 상점 판매',
    'acquire.diamond.line1': '[상점] 다이아 패키지·소모품·재료 탭',
    'acquire.diamond.line2': '[결제·이벤트] 충전, 운영·프로모션 우편',
    'acquire.diamond.line3': '[기능] 가방 슬롯 확장 등 일부 프리미엄 기능',
    'acquire.tower.line1': '[도전의 탑] 경기 정보의 아이템 상점(골드)에서 구매',
    'acquire.tower.line2': '[도전의 탑] 입장·클리어 보상, VIP 보상 등 일부 경로에서 획득',
    'acquire.actionPoint.line1': '[상점] 골드 상점 — 행동력 회복제(+10/+20/+30), 일일 한도·단계 가격',
    'acquire.actionPoint.line2': '[우편·이벤트] 운영 보상·프로모션 지급',
    'acquire.actionPoint.line3': '[기능 VIP] 활성 시 매일 행동력 회복제 III 우편 지급',
    'acquire.condition.line1': '[상점] 다이아 상점(소모품) 또는 관련 패키지',
    'acquire.condition.line2': '[퀘스트·이벤트] 일부 보상',
    'acquire.guildEquipBox.line1': '[길드 상점] 길드 코인으로만 구매 가능',
    'acquire.guildEquipBox.line2': '[상점·퀘스트] 일반 장비 상자와 유사하게 가방에서 사용해 장비 획득',
    'acquire.equipBox.line1': '[상점] 골드 상점(장비 탭), 광고 보상, 일부 현금 패키지',
    'acquire.equipBox.line2': '[퀘스트·VIP] 일일·주간·월간 퀘스트, 보상 VIP 슬롯 등',
    'acquire.equipBox.line3': '[모험·길드] 보물상자, 길드 보스전 결과 보상 등',
    'acquire.materialBox.line1': '[상점] 골드·다이아 상점(재료 탭), 광고 보상, 일부 패키지',
    'acquire.materialBox.line2': '[퀘스트·VIP] 일일·주간·월간 퀘스트, 보상 VIP 슬롯 등',
    'acquire.goldBundle.line1': '[상점] 다이아 상점(소모품), 광고 보상',
    'acquire.goldBundle.line2': '[퀘스트·모험] 각종 보상·보물상자',
    'acquire.diamondBundle.line1': '[상점] 다이아 상점(소모품), 광고 보상',
    'acquire.diamondBundle.line2': '[퀘스트·이벤트] 일부 보상',
    'acquire.bonusStat.line1': '[길드 상점] 길드 코인으로 구매(계정 한도)',
    'acquire.bonusStat.line2': '[성장] 전략·놀이 레벨 상승 시 일부 지급',
    'acquire.enhancementStone.line1': '[길드 상점] 길드 코인으로 하급~신비의 강화석 교환 가능',
    'acquire.enhancementStone.line2': '[재료 상자] 상점·퀘스트·VIP 등에서 얻는 재료 상자',
    'acquire.enhancementStone.line3': '[대장간] 재료 합성·분해, 장비 강화 비용',
    'acquire.enhancementStone.line4': '[모험·랭크·길드] 승리·탑·보스전 등 보상',
    'acquire.material.line1': '[상점] 골드·다이아 상점(재료), 길드 상점(일부)',
    'acquire.material.line2': '[퀘스트·모험·이벤트] 일일·주간·월간, 보물상자, 운영 보상',
    'acquire.material.line3': '[우편] 합성·강화 결과, 이벤트 지급',
    'acquire.equipment.line1': '[장비 상자] 가방에서 상자 사용 시 획득',
    'acquire.equipment.line2': '[모험] 스테이지·보스전 클리어 보상',
    'acquire.equipment.line3': '[거래소] 다른 유저의 등록 물품 구매',
    'acquire.equipment.line4': '[합성·제작] 대장간 합성·초월 장비 제작 등',
    'acquire.consumableGeneric': '[상점·퀘스트·우편] 일반 상점·이벤트·운영 보상',
    'acquire.pet.soulTraining': '[펫 · 수련 보상] 슬롯 {{slots}}',
    'acquire.pet.soulConvert': '[펫 · 영혼 변환] {{grades}} 펫 분해 시 획득 가능',
    'acquire.pet.soulShopDiamond': '[펫 · 펫 상점] 다이아 {{amount}}',
    'acquire.pet.soulShopGold': '[펫 · 펫 상점] 골드 {{amount}}',
    'acquire.pet.soulShopDiamondDaily': '[펫 · 펫 상점] 다이아 {{amount}}, 일일 {{limit}}회',
    'acquire.pet.soulShopGoldDaily': '[펫 · 펫 상점] 골드 {{amount}}, 일일 {{limit}}회',
    'acquire.pet.soulFallback': '[펫] 페어 경기장·부화장 관련 콘텐츠에서 획득·교환할 수 있습니다.',
    'acquire.pet.eggShop': '[펫 · 펫 상점] 골드·다이아로 구매 가능(일일 한도)',
    'acquire.pet.eggRewards': '[펫 · 수련·이벤트] 일부 보상으로 획득',
    'acquire.pet.welcomeEggMail': '[우편] 신규 환영·운영 지급 등으로 획득할 수 있습니다.',
    'acquire.pet.welcomeEggShop': '[펫 · 펫 상점] 다이아로 구매 가능(일일 1개)',
};

function nestMeta(flat: Record<string, string>): Record<string, unknown> {
    const root: Record<string, unknown> = {};
    for (const [compound, value] of Object.entries(flat)) {
        const parts = compound.split('.');
        let cursor: Record<string, unknown> = root;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i]!;
            if (!cursor[part] || typeof cursor[part] !== 'object') {
                cursor[part] = {};
            }
            cursor = cursor[part] as Record<string, unknown>;
        }
        cursor[parts[parts.length - 1]!] = value;
    }
    return root;
}

function loadJson(file: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJson(file: string, data: unknown): void {
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function merge(locale: 'ko' | 'en'): void {
    const file = path.join(catalogDir, `${locale}.json`);
    const catalog = loadJson(file);
    const inventory = (catalog.inventory ?? {}) as Record<string, unknown>;
    inventory.meta = nestMeta(locale === 'ko' ? META_KO : META_EN);
    catalog.inventory = inventory;
    saveJson(file, catalog);
    console.log(`[i18n:inventory-meta] merged ${Object.keys(locale === 'ko' ? META_KO : META_EN).length} keys into ${locale}.json`);
}

merge('ko');
merge('en');
