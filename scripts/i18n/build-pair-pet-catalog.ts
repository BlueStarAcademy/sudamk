#!/usr/bin/env npx tsx
/**
 * Merge pair pet names, training slot names, and hatchery upgrade labels into ko/en catalog masters.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAIR_PET_CATALOG } from '../../shared/constants/petLobby.js';
import { PAIR_TRAINING_SLOT_DISPLAY_NAMES } from '../../shared/constants/pairTraining.js';
import { PAIR_HATCHERY_UPGRADE_TIER_DEFS } from '../../shared/constants/pairHatchery.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const catalogDir = path.join(root, 'shared/i18n/catalog');

const PET_EN: Record<string, string> = {
    'pair-pet-1': 'LumiFox',
    'pair-pet-2': 'Ice Nyang',
    'pair-pet-3': 'Goldie Nyang',
    'pair-pet-4': 'Snow Panda',
    'pair-pet-5': 'Pengkie',
    'pair-pet-6': 'Sunbird',
    'pair-pet-7': 'Bunniru',
    'pair-pet-8': 'Honey Bear',
    'pair-pet-9': 'Leaf Cat',
    'pair-pet-10': 'Sprout',
    'pair-pet-11': 'Viol Nyang',
    'pair-pet-12': 'Sunny',
    'pair-pet-13': 'Amber Fox',
    'pair-pet-14': 'Cream Nyang',
    'pair-pet-15': 'Wingy Cat',
    'pair-pet-16': 'Mask Dog',
    'pair-pet-17': 'Ivory Bear',
    'pair-pet-18': 'Snow Pet',
    'pair-pet-19': 'Chicky',
    'pair-pet-20': 'Shadow Wolf',
    'pair-pet-21': 'Wing Bunny',
    'pair-pet-22': 'Gold Chicky',
    'pair-pet-23': 'Pandaring',
    'pair-pet-24': 'Jelly Frog',
};

const TRAINING_SLOT_EN = [
    'Technique Training',
    'Life & Death Training',
    'Capture Training',
    'Joseki Training',
    'Game Record Training',
    'Endgame Training',
];

const HATCHERY_TIER_EN = ['Upgrade I', 'Upgrade II', 'Upgrade III'];

function loadJson(file: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJson(file: string, data: unknown): void {
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function merge(locale: 'ko' | 'en'): void {
    const file = path.join(catalogDir, `${locale}.json`);
    const catalog = loadJson(file);
    const pair = (catalog.pair ?? {}) as Record<string, unknown>;

    const pets: Record<string, { name: string }> = {};
    for (const entry of PAIR_PET_CATALOG) {
        pets[entry.templateId] = {
            name: locale === 'ko' ? entry.displayName : (PET_EN[entry.templateId] ?? entry.displayName),
        };
    }
    pair.pets = pets;

    const trainingSlots: Record<string, { name: string }> = {};
    PAIR_TRAINING_SLOT_DISPLAY_NAMES.forEach((koName, index) => {
        trainingSlots[String(index)] = {
            name: locale === 'ko' ? koName : (TRAINING_SLOT_EN[index] ?? koName),
        };
    });
    pair.trainingSlots = trainingSlots;

    const hatchery = (pair.hatchery ?? {}) as Record<string, unknown>;
    PAIR_HATCHERY_UPGRADE_TIER_DEFS.forEach((tier, i) => {
        hatchery[`upgradeTier${tier.tierIndex}`] =
            locale === 'ko' ? tier.displayLabel : (HATCHERY_TIER_EN[i] ?? tier.displayLabel);
    });
    pair.hatchery = hatchery;

    catalog.pair = pair;
    saveJson(file, catalog);

    const petCount = PAIR_PET_CATALOG.length;
    const slotCount = PAIR_TRAINING_SLOT_DISPLAY_NAMES.length;
    const tierCount = PAIR_HATCHERY_UPGRADE_TIER_DEFS.length;
    console.log(
        `[i18n:pair-pet] merged ${petCount} pets, ${slotCount} training slots, ${tierCount} hatchery tiers into ${locale}.json`,
    );
}

merge('ko');
merge('en');
