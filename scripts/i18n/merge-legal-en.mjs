#!/usr/bin/env node
/**
 * Merge translated legal namespace from ko catalog into en catalog.
 * Batch-translates all string leaves under legal.*.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import translate from 'google-translate-api-x';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const koPath = path.join(root, 'shared/i18n/catalog/ko.json');
const enPath = path.join(root, 'shared/i18n/catalog/en.json');

const PLACEHOLDER_RE = /\{\{[^}]+\}\}/g;

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function collectStrings(obj, prefix = '', out = []) {
    if (typeof obj === 'string') {
        out.push({ path: prefix, value: obj });
        return out;
    }
    if (Array.isArray(obj)) {
        obj.forEach((item, i) => collectStrings(item, `${prefix}[${i}]`, out));
        return out;
    }
    if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
            collectStrings(v, prefix ? `${prefix}.${k}` : k, out);
        }
    }
    return out;
}

function setByPath(obj, pathStr, value) {
    const parts = pathStr.replace(/\[(\d+)\]/g, '.$1').split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
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

async function main() {
    const ko = JSON.parse(fs.readFileSync(koPath, 'utf8'));
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

    if (!ko.legal) {
        console.error('ko.json has no legal namespace');
        process.exit(1);
    }

    en.legal = structuredClone(ko.legal);
    const leaves = collectStrings(ko.legal, 'legal');
    console.log(`[merge-legal-en] ${leaves.length} strings to translate`);

    const chunkSize = 40;
    for (let i = 0; i < leaves.length; i += chunkSize) {
        const batch = leaves.slice(i, i + chunkSize);
        const protectedBatch = batch.map(({ value }) => protectPlaceholders(value));
        const texts = protectedBatch.map((p) => p.protectedText);

        try {
            const res = await translate(texts, { from: 'ko', to: 'en' });
            const results = Array.isArray(res) ? res : [res];
            batch.forEach(({ path: p }, idx) => {
                const translated = restorePlaceholders(results[idx]?.text ?? batch[idx].value, protectedBatch[idx].tokens);
                setByPath(en, p, translated);
            });
        } catch (err) {
            console.warn('[merge-legal-en] batch failed, falling back', err?.message ?? err);
            for (let j = 0; j < batch.length; j++) {
                const { path: p, value } = batch[j];
                const { protectedText, tokens } = protectPlaceholders(value);
                const res = await translate(protectedText, { from: 'ko', to: 'en' });
                const text = Array.isArray(res) ? res.map((r) => r.text).join('') : res.text;
                setByPath(en, p, restorePlaceholders(text, tokens));
                await sleep(100);
            }
        }

        process.stdout.write(`  ${Math.min(i + chunkSize, leaves.length)}/${leaves.length}\r`);
        await sleep(300);
    }

    en.legal.company.name = 'Ecostone';
    en.legal.company.serviceName = 'Sudam Baduk';

    fs.writeFileSync(enPath, `${JSON.stringify(en, null, 2)}\n`, 'utf8');
    console.log(`\n[merge-legal-en] wrote ${path.relative(root, enPath)}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
