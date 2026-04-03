import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const towerPath = path.join(__dirname, '../components/TowerLobby.tsx');
const blockPath = path.join(__dirname, '_tower_native_if_block.txt');

let t = fs.readFileSync(towerPath, 'utf8');
const block = fs.readFileSync(blockPath, 'utf8');

const needle = `    function renderTowerMainColumns() {
        return (
            <>
                    {/* 좌측: 랭킹 Top 100 + 보유 아이템 (아래쪽 별도 패널) */}`;

const replacement = `    function renderTowerMainColumns() {
${block}        return (
            <>
                    {/* 좌측: 랭킹 Top 100 + 보유 아이템 (아래쪽 별도 패널) */}`;

if (!t.includes(needle)) {
    console.error('needle not found');
    process.exit(1);
}
t = t.replace(needle, replacement);
fs.writeFileSync(towerPath, t);
console.log('inserted');
