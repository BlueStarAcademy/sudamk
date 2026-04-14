import React, { useMemo } from 'react';
import { getAdventureStageById } from '../../constants/adventureConstants.js';
import { isAdventureChapterBossCodexId } from '../../constants/adventureMonstersCodex.js';
import {
    adventureMapMsUntilNextAppearance,
    adventureMapSuppressKey,
    type AdventureMapMonsterInstance,
} from '../../shared/utils/adventureMapSchedule.js';

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

    return (
        <ul className={listClassName ?? 'mt-2 space-y-1.5 sm:space-y-2'}>
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
                return (
                    <li key={row.codexId}>
                        <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-left transition hover:border-amber-400/35 hover:bg-black/45 active:scale-[0.99] sm:gap-2.5 sm:px-2.5 sm:py-2.5"
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
