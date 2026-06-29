import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    getAdventureStageById,
    getAdventureStageLevelRange,
    type AdventureMonsterBattleMode,
} from '../../constants/adventureConstants.js';
import { isAdventureChapterBossCodexId } from '../../constants/adventureMonstersCodex.js';
import {
    adventureMapMsUntilNextAppearance,
    adventureMapSuppressKey,
    compareAdventureMapMonstersForSchedule,
    getAdventureMapActiveDwellWindow,
    resolveAdventureMapSpawnSlot,
    fnv1a32,
    type AdventureMapMonsterInstance,
} from '../../shared/utils/adventureMapSchedule.js';
import {
    ADVENTURE_MAP_TREASURE_UI_ROW_ID,
    adventureTreasureChestEquipmentImageForStageIndex,
    getAdventureTreasureChestWindowMeta,
} from '../../shared/utils/adventureMapTreasureSchedule.js';
import { getAdventureAllowedBattleModes, resolveAdventureBoardSize } from '../../shared/utils/adventureBattleBoard.js';
import { formatAdventureRemainMs, getAdventureMonsterModeLabel } from './adventureI18nHelpers.js';
import AdventureMapMonsterLabel from './AdventureMapMonsterLabel.js';

export type AdventureChapterMonsterSituationListProps = {
    stageId: string;
    mapMonsters: AdventureMapMonsterInstance[];
    suppressRecord: Record<string, number>;
    nowMs: number;
    onPickRow: (codexId: string) => void;
    listClassName?: string;
    mapDwellMultiplier?: number;
    mapRespawnOffMultiplier?: number;
    treasureHandledForCurrentWindow?: boolean;
    treasureHandledKind?: 'dismissed' | 'claimed' | null;
};

const AdventureChapterMonsterSituationList: React.FC<AdventureChapterMonsterSituationListProps> = ({
    stageId,
    mapMonsters,
    suppressRecord,
    nowMs,
    onPickRow,
    listClassName,
    mapDwellMultiplier = 1,
    mapRespawnOffMultiplier = 1,
    treasureHandledForCurrentWindow = false,
    treasureHandledKind = null,
}) => {
    const { t } = useTranslation('lobby');
    const stage = useMemo(() => getAdventureStageById(stageId), [stageId]);

    const rows = useMemo(() => {
        if (!stage) return [];
        return [...stage.monsters].sort(compareAdventureMapMonstersForSchedule);
    }, [stage]);

    const treasureStatusLabel = (active: boolean, handled: boolean, kind: 'dismissed' | 'claimed' | null) => {
        if (active) return t('adventure.appearing');
        if (handled) return kind === 'claimed' ? t('adventure.claimed') : t('adventure.skipped');
        return t('adventure.unknown');
    };

    if (!stage) {
        return <p className="px-2 text-center text-sm text-zinc-500">{t('adventure.noStageInfo')}</p>;
    }

    const { min: chapterLvMin, max: chapterLvMax } = getAdventureStageLevelRange(stage.stageIndex);
    const chapterMidLevel = Math.floor((chapterLvMin + chapterLvMax) / 2);

    const treasureWindowMeta = getAdventureTreasureChestWindowMeta(stage.id, nowMs);
    const treasureListActive = Boolean(treasureWindowMeta) && !treasureHandledForCurrentWindow;
    const treasureImg = adventureTreasureChestEquipmentImageForStageIndex(stage.stageIndex);

    return (
        <ul className={listClassName ?? 'mt-1 space-y-2 sm:space-y-2.5'}>
            <li key="adventure-treasure-row">
                <button
                    type="button"
                    disabled={!treasureListActive && !treasureWindowMeta}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition sm:gap-2.5 sm:px-3.5 sm:py-3 ${
                        treasureListActive
                            ? 'border-amber-400/35 bg-amber-950/25 hover:border-amber-400/55 hover:bg-amber-950/40 active:scale-[0.99]'
                            : treasureWindowMeta && treasureHandledForCurrentWindow
                              ? 'cursor-not-allowed border-zinc-600/40 bg-zinc-900/40 opacity-70'
                              : 'cursor-not-allowed border-zinc-600/40 bg-zinc-900/40 opacity-60'
                    }`}
                    onClick={() => {
                        if (treasureListActive || treasureWindowMeta) onPickRow(ADVENTURE_MAP_TREASURE_UI_ROW_ID);
                    }}
                >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-amber-400/45 bg-black/40 sm:h-10 sm:w-10">
                            <img src={treasureImg} alt="" className="h-full w-full object-contain p-0.5" draggable={false} />
                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
                                <span className="rounded-full border border-white/35 bg-black/55 px-1 py-px text-[10px] font-black leading-none text-white shadow sm:text-[11px]">
                                    ?
                                </span>
                            </span>
                        </span>
                        <span className="min-w-0 whitespace-nowrap text-[11px] font-bold text-amber-50 sm:text-xs">{t('adventure.treasureChest')}</span>
                    </span>
                    <span
                        className={[
                            'shrink-0 whitespace-nowrap font-mono text-[10px] font-bold tabular-nums sm:text-[11px]',
                            treasureListActive ? 'text-emerald-300' : 'text-zinc-400',
                        ].join(' ')}
                    >
                        {treasureStatusLabel(
                            treasureListActive,
                            Boolean(treasureWindowMeta && treasureHandledForCurrentWindow),
                            treasureHandledKind,
                        )}
                    </span>
                </button>
            </li>
            {rows.map((row) => {
                const mapMonster = mapMonsters.find((m) => m.codexId === row.codexId && m.expiresAt > nowMs);
                const boss = isAdventureChapterBossCodexId(row.codexId);
                const supK = adventureMapSuppressKey(stage.id, row.codexId);
                const spawnSlot = resolveAdventureMapSpawnSlot(stage.monsters, row.codexId);
                const dwellWindow = getAdventureMapActiveDwellWindow(
                    nowMs,
                    stage.id,
                    row.codexId,
                    boss,
                    suppressRecord[supK],
                    mapDwellMultiplier,
                    mapRespawnOffMultiplier,
                    spawnSlot,
                );
                const untilAppear = adventureMapMsUntilNextAppearance(
                    nowMs,
                    stage.id,
                    row.codexId,
                    boss,
                    suppressRecord[supK],
                    mapDwellMultiplier,
                    mapRespawnOffMultiplier,
                    spawnSlot,
                );
                const disappearMs = dwellWindow ? Math.max(0, dwellWindow.windowEnd - nowMs) : 0;
                const rightSlot =
                    disappearMs > 0
                        ? formatAdventureRemainMs(t, disappearMs)
                        : formatAdventureRemainMs(t, untilAppear);

                const boardSize = resolveAdventureBoardSize(stage.id, row.codexId, `chapter-situation-${row.codexId}`, {
                    monsterLevel: chapterMidLevel,
                    chapterLevelMin: chapterLvMin,
                    chapterLevelMax: chapterLvMax,
                });
                const allowedModes = getAdventureAllowedBattleModes(boardSize) as AdventureMonsterBattleMode[];
                const fallbackMode =
                    allowedModes[fnv1a32(`${stage.id}|${row.codexId}|situationBadge`) % Math.max(1, allowedModes.length)] ??
                    'classic';
                const displayMode: AdventureMonsterBattleMode = mapMonster?.mode ?? fallbackMode;
                const modeLabel = getAdventureMonsterModeLabel(t, displayMode);

                return (
                    <li key={row.codexId}>
                        <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-left transition hover:border-amber-400/35 hover:bg-black/45 active:scale-[0.99] sm:gap-2 sm:px-3 sm:py-2.5"
                            onClick={() => onPickRow(row.codexId)}
                        >
                            <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap">
                                <AdventureMapMonsterLabel
                                    variant="list"
                                    level={mapMonster?.level}
                                    name={row.name}
                                    modeLabel={modeLabel}
                                    boss={boss}
                                    compact={false}
                                />
                            </span>
                            <span
                                className={[
                                    'shrink-0 whitespace-nowrap font-mono text-[10px] font-bold tabular-nums sm:text-[11px]',
                                    disappearMs > 0 ? 'text-emerald-300' : 'text-amber-200',
                                ].join(' ')}
                            >
                                {rightSlot}
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
};

export default AdventureChapterMonsterSituationList;
