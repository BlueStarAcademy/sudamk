import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogDir = path.join(__dirname, '../../shared/i18n/catalog');
const patchPath = path.join(__dirname, '_new-namespaces.json');

const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'));

for (const locale of ['ko', 'en']) {
    const filePath = path.join(catalogDir, `${locale}.json`);
    const catalog = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const chunk = patch[locale];
    if (!chunk) throw new Error(`Missing locale ${locale} in patch`);
    for (const [ns, value] of Object.entries(chunk)) {
        catalog[ns] = { ...(catalog[ns] ?? {}), ...value };
    }
    fs.writeFileSync(filePath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
    console.log(`Updated ${filePath}`);
}
