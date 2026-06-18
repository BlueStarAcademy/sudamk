import fs from 'fs';

const koPath = 'shared/i18n/catalog/ko.json';
const enPath = 'shared/i18n/catalog/en.json';
const guildKo = JSON.parse(fs.readFileSync('scripts/i18n/_guild-catalog-snippet.json', 'utf8'));
const guildEn = JSON.parse(fs.readFileSync('scripts/i18n/_guild-catalog-snippet-en.json', 'utf8'));

function countKeys(obj) {
  let n = 0;
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') n += countKeys(v);
    else n += 1;
  }
  return n;
}

for (const [p, guild] of [[koPath, guildKo], [enPath, guildEn]]) {
  const catalog = JSON.parse(fs.readFileSync(p, 'utf8'));
  catalog.guild = guild;
  fs.writeFileSync(p, JSON.stringify(catalog, null, 2) + '\n');
  console.log('Updated', p, 'keys:', countKeys(guild));
}
