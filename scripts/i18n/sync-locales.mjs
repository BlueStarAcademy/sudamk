#!/usr/bin/env node
/**
 * Sync locale bundles:
 * - ko / en: catalog masters
 * - others: catalog/generated/{locale}.json if present, else en + patches
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const catalogDir = path.join(root, 'shared/i18n/catalog');
const generatedDir = path.join(catalogDir, 'generated');
const patchesDir = path.join(catalogDir, 'patches');
const outDir = path.join(root, 'shared/i18n/locales');

const SUPPORTED = [
    { code: 'ko', nativeName: '한국어' },
    { code: 'en', nativeName: 'English' },
    { code: 'ja', nativeName: '日本語' },
    { code: 'zh-CN', nativeName: '简体中文' },
    { code: 'zh-TW', nativeName: '繁體中文' },
    { code: 'es', nativeName: 'Español' },
    { code: 'fr', nativeName: 'Français' },
    { code: 'de', nativeName: 'Deutsch' },
    { code: 'pt', nativeName: 'Português' },
    { code: 'ru', nativeName: 'Русский' },
    { code: 'vi', nativeName: 'Tiếng Việt' },
    { code: 'th', nativeName: 'ไทย' },
    { code: 'id', nativeName: 'Bahasa Indonesia' },
    { code: 'ar', nativeName: 'العربية' },
    { code: 'hi', nativeName: 'हिन्दी' },
    { code: 'tr', nativeName: 'Türkçe' },
    { code: 'it', nativeName: 'Italiano' },
    { code: 'pl', nativeName: 'Polski' },
    { code: 'nl', nativeName: 'Nederlands' },
    { code: 'ms', nativeName: 'Bahasa Melayu' },
    { code: 'uk', nativeName: 'Українська' },
    { code: 'sv', nativeName: 'Svenska' },
    { code: 'cs', nativeName: 'Čeština' },
    { code: 'ro', nativeName: 'Română' },
    { code: 'he', nativeName: 'עברית' },
    { code: 'fil', nativeName: 'Filipino' },
];

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function deepMerge(base, patch) {
    if (!patch || typeof patch !== 'object') return base;
    const out = Array.isArray(base) ? [...base] : { ...base };
    for (const [key, value] of Object.entries(patch)) {
        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            typeof out[key] === 'object' &&
            out[key] !== null &&
            !Array.isArray(out[key])
        ) {
            out[key] = deepMerge(out[key], value);
        } else {
            out[key] = value;
        }
    }
    return out;
}

function buildLanguageOptions() {
    return Object.fromEntries(SUPPORTED.map((l) => [l.code, l.nativeName]));
}

function injectLanguageOptions(bundle) {
    return deepMerge(bundle, {
        settings: {
            languageOptions: buildLanguageOptions(),
        },
    });
}

function main() {
    const koMaster = readJson(path.join(catalogDir, 'ko.json'));
    const enMaster = readJson(path.join(catalogDir, 'en.json'));

    fs.mkdirSync(outDir, { recursive: true });
    fs.mkdirSync(patchesDir, { recursive: true });
    fs.mkdirSync(generatedDir, { recursive: true });

    for (const { code } of SUPPORTED) {
        let bundle;
        const generatedPath = path.join(generatedDir, `${code}.json`);

        if (code === 'ko') {
            bundle = structuredClone(koMaster);
        } else if (code === 'en') {
            bundle = structuredClone(enMaster);
        } else if (fs.existsSync(generatedPath)) {
            bundle = readJson(generatedPath);
        } else {
            bundle = structuredClone(enMaster);
            const patchPath = path.join(patchesDir, `${code}.json`);
            if (fs.existsSync(patchPath)) {
                bundle = deepMerge(bundle, readJson(patchPath));
            }
        }

        bundle = injectLanguageOptions(bundle);
        const outPath = path.join(outDir, `${code}.json`);
        fs.writeFileSync(outPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
        console.log(`[i18n:sync] wrote ${path.relative(root, outPath)}`);
    }
}

main();
