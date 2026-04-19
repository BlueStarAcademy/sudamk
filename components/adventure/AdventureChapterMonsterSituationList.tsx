import React, { useMemo } from 'react';
import {
    ADVENTURE_MONSTER_MODE_BADGE_SHORT,
    ADVENTURE_MONSTER_MODE_LABELS,
    getAdventureStageById,
    getAdventureStageLevelRange,
    type AdventureMonsterBattleMode,
} from '../../constants/adventureConstants.js';
import { isAdventureChapterBossCodexId } from '../../constants/adventureMonstersCodex.js';
import {
    adventureMapMsUntilNextAppearance,
    adventureMapSuppressKey,
    fnv1a32,
    type AdventureMapMonsterInstance,
} from '../../shared/utils/adventureMapSchedule.js';
import {
    ADVENTURE_MAP_TREASURE_UI_ROW_ID,
    adventureTreasureChestEquipmentImageForStageIndex,
    getAdventureTreasureChestWindowMeta,
} from '../../shared/utils/adventureMapTreasureSchedule.js';
import { getAdventureAllowedBattleModes, resolveAdventureBoardSize } from '../../shared/utils/adventureBattleBoard.js';

function formatRemainMs(ms: number): string {
    if (ms <= 0) return '0초';
    const sec = Math.ceil(ms / 1000);
    if (sec < 90) return `${sec}초`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m < 60) return `${m}분${s > 0 ? ` ${s}초` : ''}`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}시간 ${mm}분`;
}

export type AdventureChapterMonsterSituationListProps = {
    stageId: string;
    mapMonsters: AdventureMapMonsterInstance[];
    suppressRecord: Record<string, number>;
    nowMs: number;
    onPickRow: (codexId: string) => void;
    listClassName?: string;
    mapDwellMultiplier?: number;
    mapRespawnOffMultiplier?: number;
    /** 이번 출현 창에서 수령·건너뛰기로 비활성(맵과 동일) */
    treasureHandledForCurrentWindow?: boolean;
    /** 비활성일 때 목록 우측 문구 구분 */
    treasureHandledKind?: 'dismissed' | 'claimed' | null;
};

/**
 * 챕터별 몬스터 출현 중 / 다음 출현까지 시간 목록 (맵 오버레이·모달 공통).
 */
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
    const stage = useMemo(() => getAdventureStageById(stageId), [stageId]);

    const rows = useMemo(() => {
        if (!stage) return [];
        return [...stage.monsters].sort((a, b) => {
            const ab = isAdventureChapterBossCodexId(a.codexId) ? 1 : 0;
            const bb = isAdventureChapterBossCodexId(b.codexId) ? 1 : 0;
            if (ab !== bb) return ab - bb;
            return a.codexId.localeCompare(b.codexId);
        });
    }, [stage]);

    if (!stage) {
        return <p className="px-2 text-center text-sm text-zinc-500">스테이지 정보가 없습니다.</p>;
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
                        <span className="min-w-0 truncate text-[12px] font-bold text-amber-50 sm:text-sm">보물상자</span>
                    </span>
                    <span
                        className={[
                            'shrink-0 font-mono text-[11px] font-bold tabular-nums sm:text-xs',
                            treasureListActive ? 'text-emerald-300' : 'text-zinc-400',
                        ].join(' ')}
                    >
                        {treasureListActive
                            ? '출현중'
                            : treasureWindowMeta && treasureHandledForCurrentWindow
                              ? treasureHandledKind === 'claimed'
                                  ? '수령완료'
                                  : '건너뜀'
                              : '알수없음'}
                    </span>
                </button>
            </li>
            {rows.map((row) => {
                const mapMonster = mapMonsters.find((m) => m.codexId === row.codexId && m.expiresAt > nowMs);
                const boss = isAdventureChapterBossCodexId(row.codexId);
                const supK = adventureMapSuppressKey(stage.id, row.codexId);
                const untilAppear = adventureMapMsUntilNextAppearance(
                    nowMs,
                    stage.id,
                    row.codexId,
                    boss,
                    suppressRecord[supK],
                    mapDwellMultiplier,
                    mapRespawnOffMultiplier,
                );
                const rightSlot = mapMonster ? '출현중' : formatRemainMs(untilAppear);

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

                return (
                    <li key={row.codexId}>
                        <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-left transition hover:border-amber-400/35 hover:bg-black/45 active:scale-[0.99] sm:gap-2.5 sm:px-3.5 sm:py-3"
                            onClick={() => onPickRow(row.codexId)}
                        >
                            <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-amber-50 sm:text-sm">
                                <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                                    {mapMonster ? (
                                        <span
                                            className="shrink-0 font-mono text-[11px] font-black tabular-nums text-emerald-200 sm:text-xs"
                                            aria-label={`레벨 ${mapMonster.level}`}
                                        >
                                            Lv.{mapMonster.level}
                                        </span>
                                    ) : null}
                                    <span className="min-w-0 truncate">{row.name}</span>
                                    <span
                                        className="shrink-0 rounded bg-violet-950/90 px-0.5 py-px font-mono text-[10px] font-bold leading-none text-fuchsia-100 shadow-sm sm:text-[11px]"
                                        title={ADVENTURE_MONSTER_MODE_LABELS[displayMode]}
                                    >
                                        {ADVENTURE_MONSTER_MODE_BADGE_SHORT[displayMode]}
                                    </span>
                                    {boss ? (
                                        <span className="shrink-0 rounded border border-amber-400/45 bg-amber-500/15 px-1 py-px text-[8px] font-black uppercase tracking-wider text-amber-100 sm:text-[9px]">
                                            보스
                                        </span>
                                    ) : null}
                                </span>
                            </span>
                            <span
                                className={[
                                    'shrink-0 font-mono text-[11px] font-bold tabular-nums sm:text-xs',
                                    mapMonster ? 'text-emerald-300' : 'text-amber-200',
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
