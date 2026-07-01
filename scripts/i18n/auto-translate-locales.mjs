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

const CHUNK_SIZE = Number(process.env.I18N_TRANSLATE_CHUNK_SIZE) || 20;
const BATCH_DELAY_MS = Number(process.env.I18N_TRANSLATE_BATCH_DELAY_MS) || 700;
const SINGLE_DELAY_MS = Number(process.env.I18N_TRANSLATE_SINGLE_DELAY_MS) || 300;
const MAX_RETRIES = Number(process.env.I18N_TRANSLATE_MAX_RETRIES) || 4;

const TRANSLATE_OPTS = {
    from: 'ko',
    rejectOnPartialFail: false,
};

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

async function translateText(text, to, { quiet = false } = {}) {
    if (!text || !text.trim()) return text;
    if (KEEP_LITERALS.has(text)) return text;
    if (/^[\d\s.,:+\-/%()[\]{}#]+$/.test(text)) return text;

    const { protectedText, tokens } = protectPlaceholders(text);
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const res = await translate(protectedText, { ...TRANSLATE_OPTS, to, forceBatch: false });
            const translated = Array.isArray(res) ? res.map((r) => r.text).join('') : res.text;
            if (translated != null && String(translated).trim() !== '') {
                return restorePlaceholders(translated, tokens);
            }
        } catch (err) {
            const isLast = attempt === MAX_RETRIES - 1;
            if (isLast && !quiet) {
                console.warn(`[translate] failed (${to}): ${text.slice(0, 40)}…`, err?.message ?? err);
            }
            if (!isLast) {
                await sleep(SINGLE_DELAY_MS * (attempt + 2));
            }
        }
    }
    return text;
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
    const retryQueue = [];

    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
        const batch = entries.slice(i, i + CHUNK_SIZE);
        const prepared = batch.map(([, value]) => protectPlaceholders(value));
        const texts = prepared.map((p) => p.protectedText);

        try {
            const res = await translate(texts, { ...TRANSLATE_OPTS, to: googleTo });
            const results = Array.isArray(res) ? res : [res];
            batch.forEach(([key, value], idx) => {
                const raw = results[idx]?.text;
                if (raw != null && String(raw).trim() !== '') {
                    out.set(key, restorePlaceholders(raw, prepared[idx].tokens));
                } else {
                    retryQueue.push([key, value]);
                }
            });
        } catch (err) {
            console.warn(`[translate] batch failed (${locale}), falling back to single`, err?.message ?? err);
            for (const [key, value] of batch) {
                out.set(key, await translateText(value, googleTo));
                await sleep(SINGLE_DELAY_MS);
            }
        }

        process.stdout.write(`  ${locale}: ${Math.min(i + CHUNK_SIZE, entries.length)}/${entries.length}\r`);
        await sleep(BATCH_DELAY_MS);
    }

    if (retryQueue.length > 0) {
        console.log(`\n  ${locale}: retrying ${retryQueue.length} partial/failed keys…`);
        for (const [key, value] of retryQueue) {
            out.set(key, await translateText(value, googleTo));
            await sleep(SINGLE_DELAY_MS * 2);
        }
    }

    const stillKo = [...flatKo.entries()].filter(([key, koText]) => {
        const translated = out.get(key);
        return translated === koText && koText.trim() && !KEEP_LITERALS.has(koText);
    });
    if (stillKo.length > 0) {
        console.warn(`  ${locale}: ${stillKo.length} keys still untranslated (kept ko source)`);
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
