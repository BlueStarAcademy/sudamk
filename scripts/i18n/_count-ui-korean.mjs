import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      'components/TournamentBracket.tsx',
      'components/PairWaitingLobby.tsx',
      'components/ExchangeModal.tsx',
      'components/TowerLobby.tsx',
      'components/ShopModal.tsx',
      'components/ProfileEditModal.tsx',
      'components/InventoryModal.tsx',
      'components/NegotiationModal.tsx',
      'components/Profile.tsx',
      'components/QuestsModal.tsx',
    ];

const ko = /[\uAC00-\uD7A3]/;
const strKo = /['"`][^'"`]*[\uAC00-\uD7A3]/;

for (const f of files) {
  const lines = fs.readFileSync(path.join(root, f), 'utf8').split('\n');
  let all = 0;
  let ui = 0;
  const uiHits = [];
  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/**') || t.startsWith('/*')) return;
    if (ko.test(line)) {
      all++;
      if (strKo.test(line)) {
        ui++;
        uiHits.push(`${i + 1}: ${t.slice(0, 100)}`);
      }
    }
  });
  console.log(`${f}: ui=${ui} nonComment=${all}`);
}
