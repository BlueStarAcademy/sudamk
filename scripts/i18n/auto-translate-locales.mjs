#!/usr/bin/env node
/**
 * Auto-translate ko catalog strings into all supported locales.
 * Output: shared/i18n/catalog/generated/{locale}.json
 *
 * Usage:
 *   node scripts/i18n/auto-translate-locales.mjs
 *   node scripts/i18n/auto-translate-locales.mjs ja zh-CN fr
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import translate from 'google-translate-api-x';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const catalogDir = path.join(root, 'shared/i18n/catalog');
const generatedDir = path.join(catalogDir, 'generated');
const koPath = path.join(catalogDir, 'ko.json');
const enPath = path.join(catalogDir, 'en.json');

const LOCALE_TO_GOOGLE = {
    ko: 'ko',
    en: 'en',
    ja: 'ja',
    'zh-CN': 'zh-CN',
    'zh-TW': 'zh-TW',
    es: 'es',
    fr: 'fr',
    de: 'de',
    pt: 'pt',
    ru: 'ru',
    vi: 'vi',
    th: 'th',
    id: 'id',
    ar: 'ar',
    hi: 'hi',
    tr: 'tr',
    it: 'it',
    pl: 'pl',
    nl: 'nl',
    ms: 'ms',
    uk: 'uk',
    sv: 'sv',
    cs: 'cs',
    ro: 'ro',
    he: 'he',
    fil: 'tl',
};

const ALL_LOCALES = Object.keys(LOCALE_TO_GOOGLE);

const PLACEHOLDER_RE = /\{\{[^}]+\}\}/g;
const KEEP_LITERALS = new Set(['회원탈퇴']);

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function flattenStrings(obj, prefix = '', out = new Map()) {
    if (typeof obj === 'string') {
        out.set(prefix, obj);
        return out;
    }
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        for (const [k, v] of Object.entries(obj)) {
            const next = prefix ? `${prefix}.${k}` : k;
            if (next === 'settings.languageOptions') continue;
            flattenStrings(v, next, out);
        }
    }
    return out;
}

function unflattenStrings(flat) {
    const rootObj = {};
    for (const [keyPath, value] of flat.entries()) {
        const parts = keyPath.split('.');
        let cur = rootObj;
        for (let i = 0; i < parts.length - 1; i++) {
            cur[parts[i]] ??= {};
            cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = value;
    }
    return rootObj;
}

function protectPlaceholders(text) {
    const tokens = [];
    const protectedText = text.replace(PLACEHOLDER_RE, (m) => {
        const token = `__PH_${tokens.length}__`;
        tokens.push({ token, value: m });
        return token;
    });
    return { protectedText, tokens };
}

function restorePlaceholders(text, tokens) {
    let out = text;
    for (const { token, value } of tokens) {
        out = out.split(token).join(value);
    }
    return out;
}

async function translateText(text, to) {
    if (!text || !text.trim()) return text;
    if (KEEP_LITERALS.has(text)) return text;
    if (/^[\d\s.,:+\-/%()[\]{}#]+$/.test(text)) return text;

    const { protectedText, tokens } = protectPlaceholders(text);
    try {
        const res = await translate(protectedText, { from: 'ko', to, forceBatch: false });
        const translated = Array.isArray(res) ? res.map((r) => r.text).join('') : res.text;
        return restorePlaceholders(translated, tokens);
    } catch (err) {
        console.warn(`[translate] failed (${to}): ${text.slice(0, 40)}…`, err?.message ?? err);
        return text;
    }
}

async function translateFlatMap(flatKo, locale) {
    if (locale === 'ko') {
        return new Map(flatKo);
    }
    if (locale === 'en') {
        const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
        const flatEn = flattenStrings(en);
        const out = new Map();
        for (const key of flatKo.keys()) {
            out.set(key, flatEn.get(key) ?? flatKo.get(key));
        }
        return out;
    }

    const googleTo = LOCALE_TO_GOOGLE[locale];
    const out = new Map();
    const entries = [...flatKo.entries()];
    const chunkSize = 35;

    for (let i = 0; i < entries.length; i += chunkSize) {
        const batch = entries.slice(i, i + chunkSize);
        const texts = batch.map(([, v]) => v);

        try {
            const res = await translate(texts, { from: 'ko', to: googleTo });
            const results = Array.isArray(res) ? res : [res];
            batch.forEach(([key], idx) => {
                out.set(key, results[idx]?.text ?? flatKo.get(key));
            });
        } catch (err) {
            console.warn(`[translate] batch failed (${locale}), falling back to single`, err?.message ?? err);
            for (const [key, value] of batch) {
                out.set(key, await translateText(value, googleTo));
                await sleep(150);
            }
        }

        process.stdout.write(`  ${locale}: ${Math.min(i + chunkSize, entries.length)}/${entries.length}\r`);
        await sleep(400);
    }
    console.log(`  ${locale}: ${entries.length}/${entries.length} done`);
    return out;
}

async function main() {
    const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL_LOCALES.filter((l) => l !== 'ko');
    const ko = JSON.parse(fs.readFileSync(koPath, 'utf8'));
    const flatKo = flattenStrings(ko);

    fs.mkdirSync(generatedDir, { recursive: true });

    console.log(`[auto-translate] ${flatKo.size} keys × ${targets.length} locales`);

    for (const locale of targets) {
        console.log(`[auto-translate] ${locale}…`);
        const flat = await translateFlatMap(flatKo, locale);
        const bundle = unflattenStrings(flat);
        const outPath = path.join(generatedDir, `${locale}.json`);
        fs.writeFileSync(outPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
        console.log(`[auto-translate] wrote ${path.relative(root, outPath)}`);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
