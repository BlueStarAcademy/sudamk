import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, '../components/TowerLobby.tsx');
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);

// Line 496–593: 랭킹 패널 내부(그라데이션 래퍼 제외), 598–638: 보유 아이템 내부
const rankingInner = lines.slice(495, 593).join('\n');
const inventoryInner = lines.slice(597, 638).join('\n');

const block =
    `        if (isNativeMobile) {
            return (
                <>
                    <div className="pointer-events-none absolute inset-0 z-0">
                        <img
                            src={TOWER_CHALLENGE_LOBBY_IMG}
                            alt=""
                            className="h-full w-full object-cover object-center"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/75" />
                    </div>
                    <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
                        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_5.5rem] gap-1 overflow-hidden">
                            <div className="flex min-h-0 min-w-0 flex-col gap-1 overflow-hidden">
                                <div className={\`flex max-h-[min(40dvh,44%)] min-h-0 flex-col overflow-hidden p-2 \${towerNativeGlass}\`}>
` +
    rankingInner +
    `
                                </div>
                                <div className={\`flex min-h-0 flex-1 flex-col overflow-hidden p-1 sm:p-2 \${towerNativeGlass}\`}>
                                    <h2 className="text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-300 mb-2 flex-shrink-0 drop-shadow-[0_0_4px_rgba(217,119,6,0.8)]">
                                        스테이지
                                    </h2>
                                    <div
                                        ref={stageScrollRef}
                                        className="flex-1 overflow-y-auto space-y-1.5 pr-1"
                                    >
                                        {renderTowerFloorRows()}
                                    </div>
                                </div>
                            </div>
                            <div className="flex min-h-0 min-w-0 flex-col gap-1 overflow-hidden">
                                <div className={\`min-h-0 shrink-0 overflow-hidden p-0.5 \${towerNativeGlass}\`}>
                                    <QuickAccessSidebar nativeHomeColumn fillHeight={false} />
                                </div>
                                <div className={\`flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-2 \${towerNativeGlass}\`}>
` +
    inventoryInner +
    `
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            );
        }

`;

const out = path.join(__dirname, '_tower_native_if_block.txt');
fs.writeFileSync(out, block);
console.log('written', out, block.length);
