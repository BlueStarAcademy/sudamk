#!/usr/bin/env npx tsx
/**
 * Merge inventory item names/descriptions + mythic stat labels into ko/en catalog masters.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MythicStat } from '../../types/enums.js';
import {
    EQUIPMENT_POOL,
    CONSUMABLE_ITEMS,
    MATERIAL_ITEMS,
    MYTHIC_STATS_DATA,
} from '../../shared/constants/items.js';
import {
    listInventoryItemCatalogEntries,
    resolveInventoryItemCatalogEntry,
} from '../../shared/constants/inventoryItemCatalog.js';
import { SHOP_ITEM_DISPLAY } from '../../shared/constants/shopItemDisplay.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const catalogDir = path.join(root, 'shared/i18n/catalog');

const EQUIPMENT_EN: Record<string, { name: string; description: string }> = {
    '푸른 바람 부채': { name: 'Blue Wind Fan', description: 'A light, practical bamboo fan.' },
    '은결 바람 부채': { name: 'Silver Wind Fan', description: 'A soft silk fan that fits comfortably in your hand.' },
    '화염 바람 부채': { name: 'Flame Wind Fan', description: "A master's fan that spreads gracefully like a crane's wings." },
    '서리 바람 부채': { name: 'Frost Wind Fan', description: 'Forged from heavy steel; can serve as a weapon in a pinch.' },
    '용비 바람 부채': { name: 'Dragon Feather Fan', description: 'A legendary fan made from a hundred white feathers.' },
    '천룡 바람 부채': { name: 'Heavenly Dragon Fan', description: 'A mythical fan said to stir winds that overturn the board.' },
    '신룡 바람 부채': { name: 'Divine Dragon Fan', description: 'A transcendent fan holding the breath of a sky-splitting dragon.' },
    '새싹 바둑판': { name: 'Sprout Board', description: 'A light paulownia board ideal for beginners.' },
    '단풍결 바둑판': { name: 'Maple Grain Board', description: 'A premium board of beautiful persimmon wood grain.' },
    '산호결 바둑판': { name: 'Coral Grain Board', description: 'A top-grade shinigi board with a clear stone placement sound.' },
    '흑단 바둑판': { name: 'Ebony Board', description: 'A volcanic stone board shaped with burning passion.' },
    '용문 바둑판': { name: 'Dragon Gate Board', description: 'A legendary board of thousand-year golden pine.' },
    '천룡 바둑판': { name: 'Heavenly Dragon Board', description: 'A mythical board inlaid like a night sky of stars.' },
    '신룡 바둑판': { name: 'Divine Dragon Board', description: 'A transcendent board that opens a path to victory with every move.' },
    '봄빛 도복 상의': { name: 'Spring Gi Top', description: 'Comfortable top wear suited for focused training.' },
    '여름빛 도복 상의': { name: 'Summer Gi Top', description: 'Durable gi that withstands long practice sessions.' },
    '가을빛 도복 상의': { name: 'Autumn Gi Top', description: 'A scholar\'s robe with quiet dignity.' },
    '겨울빛 도복 상의': { name: 'Winter Gi Top', description: 'Attire of a swordsman crafted for sharp matches.' },
    '용비 도복 상의': { name: 'Dragon Robe Top', description: 'Embroidered with dragon motifs symbolizing imperial majesty.' },
    '천룡 도복 상의': { name: 'Heavenly Dragon Gi Top', description: 'Mythic garb said to grant divine protection to the wearer.' },
    '신룡 도복 상의': { name: 'Divine Dragon Gi Top', description: 'Transcendent top wear woven with dragon-scale light for unwavering focus.' },
    '봄빛 도복 하의': { name: 'Spring Gi Bottom', description: 'Training pants that allow easy movement.' },
    '여름빛 도복 하의': { name: 'Summer Gi Bottom', description: 'Sturdy pants that resist wear.' },
    '가을빛 도복 하의': { name: 'Autumn Gi Bottom', description: 'Fine silk pants paired with the scholar\'s robe.' },
    '겨울빛 도복 하의': { name: 'Winter Gi Bottom', description: 'Bottom wear that never hinders a swordsman\'s movement.' },
    '용비 도복 하의': { name: 'Dragon Robe Bottom', description: 'Finest silk bottoms paired with the dragon robe.' },
    '천룡 도복 하의': { name: 'Heavenly Dragon Gi Bottom', description: 'Mythic bottoms said to be woven from clouds.' },
    '신룡 도복 하의': { name: 'Divine Dragon Gi Bottom', description: 'Transcendent bottoms imbued with a dragon\'s will for balance in any storm.' },
    '가벼운 나무통': { name: 'Light Wood Bowl', description: 'A light, inexpensive plastic go bowl.' },
    '단단한 대나무통': { name: 'Sturdy Bamboo Bowl', description: 'A go bowl of jujube wood with a subtle fragrance.' },
    '홍목 바둑통': { name: 'Rosewood Bowl', description: 'Crafted from rosewood with a beautiful red hue.' },
    '흑단 바둑통': { name: 'Ebony Bowl', description: 'A rare bowl of exotic wood with striking patterns.' },
    '용린 바둑통': { name: 'Dragon Scale Bowl', description: 'A finest red sandalwood bowl delicately carved with dragons.' },
    '천룡 바둑통': { name: 'Heavenly Dragon Bowl', description: 'A mysterious case said to hold an ancient god\'s relic.' },
    '신룡 바둑통': { name: 'Divine Dragon Bowl', description: 'A transcendent bowl that seals battlefield aura into every stone drawn.' },
    '흑백 새싹돌': { name: 'Sprout Stones', description: 'Light, inexpensive plastic go stones.' },
    '은빛 결돌': { name: 'Silver Grain Stones', description: 'Go stones polished from smooth river pebbles.' },
    '홍옥 바둑돌': { name: 'Ruby Go Stones', description: 'Precisely cut obsidian stones with a cold gleam.' },
    '백옥 바둑돌': { name: 'Jade Go Stones', description: 'Stones of blue and white jade with a luminous glow.' },
    '용안 바둑돌': { name: 'Dragon Eye Stones', description: 'Legendary stones forged with the energy of sun, moon, and stars.' },
    '천룡 바둑돌': { name: 'Heavenly Dragon Stones', description: 'Mythic stones like a galaxy poured into the night sky.' },
    '신룡 바둑돌': { name: 'Divine Dragon Stones', description: 'Transcendent stones forged from dawn-star fragments to dominate the board in a single move.' },
};

const CONSUMABLE_EN: Record<string, { name: string; description: string }> = {
    '턴 추가': { name: 'Extra Turn', description: 'Adds an extra turn in Tower of Challenge.' },
    '미사일': { name: 'Missile', description: 'Missile item for Tower of Challenge.' },
    '히든': { name: 'Hidden', description: 'Hidden stone item for Tower of Challenge.' },
    '스캔': { name: 'Scan', description: 'Scan item for Tower of Challenge.' },
    '배치변경': { name: 'Reposition', description: 'Reposition item for Tower of Challenge.' },
    '신비로운알': { name: 'Mysterious Egg', description: 'Hatch a random AI pet in the incubator.' },
};

const MATERIAL_EN: Record<string, { name: string; description: string }> = {
    '제련의 부적': { name: 'Refinement Charm', description: 'Adds one refinement attempt to gear that cannot be refined.' },
    '거래 등록권': { name: 'Trade Listing Ticket', description: 'Permit to register additional items for sale on the exchange.' },
    '하급 강화석': { name: 'Low Enhancement Stone', description: 'Basic material for gear enhancement.' },
    '중급 강화석': { name: 'Mid Enhancement Stone', description: 'Mid-tier material for gear enhancement.' },
    '상급 강화석': { name: 'High Enhancement Stone', description: 'High-tier material for gear enhancement.' },
    '최상급 강화석': { name: 'Superior Enhancement Stone', description: 'Rare material for gear enhancement.' },
    '신비의 강화석': { name: 'Mystic Enhancement Stone', description: 'Ancient material for gear enhancement.' },
    '새싹영혼석': { name: 'Sprout Soul Stone', description: 'Soul stone material for pair pets.' },
    '파동영혼석': { name: 'Pulse Soul Stone', description: 'Soul stone material for pair pets.' },
    '심연영혼석': { name: 'Abyss Soul Stone', description: 'Soul stone material for pair pets.' },
    '화염영혼석': { name: 'Flame Soul Stone', description: 'Soul stone material for pair pets.' },
    '천광영혼석': { name: 'Celestial Soul Stone', description: 'Soul stone material for pair pets.' },
};

function loadJson(file: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJson(file: string, data: unknown): void {
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function shopEnName(shopId: string, fallback: string): string {
    const enCatalog = loadJson(path.join(catalogDir, 'en.json'));
    const shopItems = (enCatalog.shop as { items?: Record<string, { name?: string }> })?.items;
    return shopItems?.[shopId]?.name ?? fallback;
}

function shopEnDescription(shopId: string, fallback: string): string {
    const enCatalog = loadJson(path.join(catalogDir, 'en.json'));
    const shopItems = (enCatalog.shop as { items?: Record<string, { description?: string }> })?.items;
    return shopItems?.[shopId]?.description ?? fallback;
}

function resolveEnText(koName: string, koDescription: string | undefined, slug: string): { name: string; description: string } {
    if (EQUIPMENT_EN[koName]) return EQUIPMENT_EN[koName];
    if (CONSUMABLE_EN[koName]) return CONSUMABLE_EN[koName];
    if (MATERIAL_EN[koName]) return MATERIAL_EN[koName];
    if (slug.startsWith('shop_')) {
        const shopId = slug.slice('shop_'.length);
        return {
            name: shopEnName(shopId, koName),
            description: shopEnDescription(shopId, koDescription ?? ''),
        };
    }
    return { name: koName, description: koDescription ?? '' };
}

function buildItemsCatalog(locale: 'ko' | 'en'): Record<string, { name: string; description: string }> {
    const items: Record<string, { name: string; description: string }> = {};
    for (const entry of listInventoryItemCatalogEntries()) {
        const koDesc = entry.description ?? '';
        if (locale === 'ko') {
            items[entry.slug] = { name: entry.name, description: koDesc };
        } else {
            items[entry.slug] = resolveEnText(entry.name, koDesc, entry.slug);
        }
    }
    return items;
}

function buildMythicStatsCatalog(locale: 'ko' | 'en'): Record<string, { name: string; abbrev: string; short: string; description: string }> {
    const MYTHIC_EN: Record<string, { name: string; abbrev: string; short: string; description: string }> = {
        GuildBossRewardGradeUp: {
            name: 'Guild boss reward tier up',
            abbrev: 'Boss reward tier',
            short: 'Guild boss reward grade +1',
            description: 'Raises guild boss battle reward tier by one step (max SSS).',
        },
        GuildBossExtraDamage5: {
            name: 'Guild boss bonus damage 5%',
            abbrev: 'Boss dmg 5%',
            short: 'Guild boss damage +5%',
            description: 'Adds 5% final damage against guild bosses.',
        },
        TowerApMinus1Floors1to35: {
            name: 'Tower (1–35F) AP cost -1',
            abbrev: 'Tower AP (1–35)',
            short: 'Tower 1–35F AP -1',
            description: 'Reduces AP required to enter Tower floors 1–35 by 1.',
        },
        ApRegenMinus30s: {
            name: 'AP recovery time -30s',
            abbrev: 'AP regen -30s',
            short: 'AP recovery -30s',
            description: 'Reduces time to recover 1 AP by 30 seconds.',
        },
        AdventureScanPlus1: {
            name: 'Adventure scan +1',
            abbrev: 'Adv. scan +1',
            short: 'Adventure scan +1',
            description: 'Grants 1 extra scan item at adventure start.',
        },
        AdventureMissilePlus1: {
            name: 'Adventure missile +1',
            abbrev: 'Adv. missile +1',
            short: 'Adventure missile +1',
            description: 'Grants 1 extra missile item at adventure start.',
        },
        AdventureGoldBonus15: {
            name: 'Adventure gold reward +15%',
            abbrev: 'Adv. gold 15%',
            short: 'Adventure gold +15%',
            description: 'Increases adventure victory gold by 15%.',
        },
        GuildBossExtraRewardDuplicate: {
            name: 'Guild boss bonus reward',
            abbrev: 'Boss reward extra',
            short: 'Duplicate one guild boss reward',
            description: 'Receive one additional guild boss reward (stacks across gear).',
        },
        GuildBossExtraDamage10: {
            name: 'Guild boss bonus damage 10%',
            abbrev: 'Boss dmg 10%',
            short: 'Guild boss damage +10%',
            description: 'Adds 10% final damage against guild bosses.',
        },
        TowerApMinus1AllFloors: {
            name: 'Tower AP cost -1',
            abbrev: 'Tower AP all',
            short: 'All tower floors AP -1',
            description: 'Reduces AP required for all tower floors by 1.',
        },
        ApRegenMinus60s: {
            name: 'AP recovery time -60s',
            abbrev: 'AP regen -60s',
            short: 'AP recovery -60s',
            description: 'Reduces time to recover 1 AP by 60 seconds.',
        },
        AdventureScanTranscendent: {
            name: 'Adventure scan +1',
            abbrev: 'Adv. scan +1',
            short: 'Adventure scan +2 (transcendent)',
            description: 'Grants 2 extra scan items in adventure.',
        },
        AdventureMissilePlus2: {
            name: 'Adventure missile +2',
            abbrev: 'Adv. missile +2',
            short: 'Adventure missile +2',
            description: 'Grants 2 extra missile items at adventure start.',
        },
        AdventureGoldBonus20: {
            name: 'Adventure gold reward +20%',
            abbrev: 'Adv. gold 20%',
            short: 'Adventure gold +20%',
            description: 'Increases adventure victory gold by 20%.',
        },
    };

    const out: Record<string, { name: string; abbrev: string; short: string; description: string }> = {};
    for (const [enumKey, koValue] of Object.entries(MythicStat)) {
        const stat = koValue as MythicStat;
        const data = MYTHIC_STATS_DATA[stat];
        if (!data) continue;
        if (locale === 'ko') {
            out[enumKey] = {
                name: data.name,
                abbrev: data.abbrevLabel,
                short: data.shortDescription,
                description: data.description,
            };
        } else {
            out[enumKey] = MYTHIC_EN[enumKey] ?? {
                name: data.name,
                abbrev: data.abbrevLabel,
                short: data.shortDescription,
                description: data.description,
            };
        }
    }
    return out;
}

function mergeCatalog(locale: 'ko' | 'en'): void {
    const file = path.join(catalogDir, `${locale}.json`);
    const catalog = loadJson(file);
    const inventory = (catalog.inventory ?? {}) as Record<string, unknown>;
    inventory.items = buildItemsCatalog(locale);
    inventory.stats = {
        ...(inventory.stats as object),
        mythic: buildMythicStatsCatalog(locale),
    };
    inventory.optionValueLine = locale === 'ko' ? '{{stat}} +{{value}}{{suffix}}' : '{{stat}} +{{value}}{{suffix}}';
    inventory.optionRange = locale === 'ko' ? '[{{lo}}~{{hi}}{{suffix}}]' : '[{{lo}}~{{hi}}{{suffix}}]';
    inventory.optionEnhancement = locale === 'ko' ? '({{count}}강화)' : '({{count}} enhance)';
    catalog.inventory = inventory;
    saveJson(file, catalog);
    console.log(`[i18n:inventory-items] merged ${Object.keys(inventory.items as object).length} items into ${locale}.json`);
}

mergeCatalog('ko');
mergeCatalog('en');

// Sanity: all equipment has EN name different from KO or explicit map
const missingEn = EQUIPMENT_POOL.filter((eq) => {
    const entry = resolveInventoryItemCatalogEntry(eq.name);
    if (!entry) return true;
    const en = resolveEnText(eq.name, eq.description, entry.slug);
    return en.name === eq.name && !EQUIPMENT_EN[eq.name];
});
if (missingEn.length > 0) {
    console.warn('[i18n:inventory-items] missing EN overrides:', missingEn.map((e) => e.name).join(', '));
}
