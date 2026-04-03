import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, '../components/TowerLobby.tsx');
let s = fs.readFileSync(p, 'utf8');

const marker = '{stages.map((floor) => {';
const start = s.indexOf(marker);
if (start < 0) {
    console.error('start not found');
    process.exit(1);
}
const closePat = '\n                        })}';
const closeIdx = s.indexOf(closePat, start);
if (closeIdx < 0) {
    console.error('close pattern not found');
    process.exit(1);
}
const endIdx = closeIdx + closePat.length;
const mapBlock = s.slice(start, endIdx);

// Inner: stages.map((floor) => { ... });
const inner = mapBlock
    .replace(/^\s*\{stages\.map\(\(floor\) => \{/, 'stages.map((floor) => {')
    .replace(/\}\)\}\s*$/, '});');

const towerNative = `    const towerNativeGlass =
        'rounded-xl border border-amber-500/40 bg-gray-950/50 backdrop-blur-md shadow-lg shadow-black/30';

    const renderTowerFloorRows = () =>
        ${inner}
`;

const replacement = '                        {renderTowerFloorRows()}';
const newS = s.slice(0, start) + replacement + s.slice(endIdx);

const insertPoint = newS.indexOf('function renderTowerMainColumns()');
if (insertPoint < 0) {
    console.error('insertPoint not found');
    process.exit(1);
}
const final = newS.slice(0, insertPoint) + towerNative + '\n\n    ' + newS.slice(insertPoint);

fs.writeFileSync(p, final);
console.log('ok bytes', final.length);
