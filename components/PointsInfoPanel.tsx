import React, { useEffect, useMemo, useState } from 'react';
import { getDungeonStageScore } from '../constants';
import { TournamentType } from '../types';
import { useAppContext } from '../hooks/useAppContext.js';
import { normalizeDungeonProgress } from '../utils/championshipDungeonProgress.js';

const emptyDungeonProgress = {
    currentStage: 0,
    unlockedStages: [1] as number[],
    stageResults: {} as Record<number, unknown>,
    dailyStageAttempts: {} as Record<number, unknown>,
};

const TOURNAMENT_ARENA_META: { type: TournamentType; arena: string; title: string; maxRank: number }[] = [
    { type: 'neighborhood', arena: '동네', title: '동네바둑리그', maxRank: 6 },
    { type: 'national', arena: '전국', title: '전국바둑대회', maxRank: 8 },
    { type: 'world', arena: '세계', title: '월드챔피언십', maxRank: 15 },
];

/** 같은 점수인 연속 순위를 묶어서 [{ label: '1위' | '4~7위', points }] 형태로 반환 */
function groupRanksByScore(type: TournamentType, stage: number, maxRank: number): { key: string; label: string; points: number; rankStart: number }[] {
    const items: { rank: number; points: number }[] = [];
    for (let r = 1; r <= maxRank; r++) {
        items.push({ rank: r, points: getDungeonStageScore(type, stage, r) });
    }
    const groups: { key: string; label: string; points: number; rankStart: number }[] = [];
    let i = 0;
    while (i < items.length) {
        const startRank = items[i].rank;
        const points = items[i].points;
        let endRank = startRank;
        while (i + 1 < items.length && items[i + 1].points === points) {
            i++;
            endRank = items[i].rank;
        }
        const label = startRank === endRank ? `${startRank}위` : `${startRank}~${endRank}위`;
        groups.push({ key: `rank-${startRank}-${endRank}`, label, points, rankStart: startRank });
        i++;
    }
    return groups;
}

/** nativeEmbedded: 네이티브 챔피언십 상단 열에 삽입, 하단 탭과 동일 계열 이상의 글자 크기(최소 10~11px) */
const PointsInfoPanel: React.FC<{
    variant?: 'default' | 'nativeEmbedded';
    /** 챔피언십 로비 배경 위: 반투명 + 뒤쪽 블러 */
    lobbyGlass?: boolean;
    /** 모바일 전용 모달 등: 상단 h3 제목(일일 획득 가능 점수) 숨김 — 제목은 창 외부에서 처리 */
    hideHeading?: boolean;
    /** 모달 한 화면 맞춤: 경기장 탭으로 하나만 표시해 세로 스크롤 제거 */
    arenaTabs?: boolean;
}> = ({ variant = 'default', lobbyGlass = false, hideHeading = false, arenaTabs = false }) => {
    const { currentUserWithStatus } = useAppContext();
    const [selectedStage, setSelectedStage] = useState<number>(1);
    const [arenaTab, setArenaTab] = useState<number>(0);

    const embedded = variant === 'nativeEmbedded';

    const myStageForActiveArena = useMemo(() => {
        if (!currentUserWithStatus || !embedded || !arenaTabs) return null;
        const t = TOURNAMENT_ARENA_META[arenaTab]?.type;
        if (!t) return null;
        const p = normalizeDungeonProgress(currentUserWithStatus.dungeonProgress?.[t] || emptyDungeonProgress);
        return Math.min(10, Math.max(1, p.currentStage || 1));
    }, [currentUserWithStatus, arenaTab, embedded, arenaTabs]);

    useEffect(() => {
        if (embedded && arenaTabs && myStageForActiveArena != null) {
            setSelectedStage(myStageForActiveArena);
        }
    }, [embedded, arenaTabs, arenaTab, myStageForActiveArena]);

    const surfaceClass = lobbyGlass
        ? embedded
            ? 'rounded-xl border-2 border-amber-500/40 bg-gradient-to-b from-zinc-900/95 via-zinc-950/90 to-black/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-amber-100/10 backdrop-blur-xl backdrop-saturate-150 [transform:translateZ(0)]'
            : 'border border-color/45 bg-gray-900/42 backdrop-blur-xl backdrop-saturate-150 [transform:translateZ(0)]'
        : 'bg-gray-800/50';

    const arenaCardClass = embedded
        ? arenaTabs
            ? 'rounded-lg border border-amber-500/25 bg-black/35 p-1.5 ring-1 ring-inset ring-white/[0.06] sm:p-2'
            : 'rounded-lg border border-amber-500/25 bg-black/35 p-2 ring-1 ring-inset ring-white/[0.06]'
        : 'rounded-md bg-gray-900/50 shadow-inner';

    const pad = embedded && arenaTabs ? 'p-1.5' : embedded ? 'p-2' : '';

    const modalArenaTabs = embedded && arenaTabs;

    return (
        <div
            className={`flex min-h-0 flex-col ${modalArenaTabs ? 'h-auto w-full items-center' : 'h-full'} ${surfaceClass} ${embedded ? pad : 'rounded-lg p-2 sm:p-3'}`}
        >
            {!hideHeading && (
                <h3 className={`flex-shrink-0 text-center font-bold text-gray-100 ${embedded ? 'mb-2 border-b border-amber-400/25 pb-2 text-sm text-amber-100' : 'mb-3 text-base'}`}>
                    일일 획득 가능 점수
                </h3>
            )}

            <div className={`flex-shrink-0 ${embedded ? (arenaTabs ? 'mb-1.5' : 'mb-2') : 'mb-3'}`}>
                <label className={`mb-0.5 block font-medium text-amber-200/85 ${embedded ? (arenaTabs ? 'text-xs' : 'text-[11px]') : 'text-xs text-gray-300'}`}>단계 선택</label>
                <select
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(Number(e.target.value))}
                    className={
                        embedded
                            ? arenaTabs
                                ? 'w-full rounded-lg border border-amber-500/35 bg-zinc-950/80 px-2 py-1.5 text-xs text-zinc-100 focus:border-amber-400 focus:ring-amber-400/30'
                                : 'w-full rounded-lg border border-amber-500/35 bg-zinc-950/80 p-2 text-xs text-zinc-100 focus:border-amber-400 focus:ring-amber-400/30'
                            : 'w-full rounded-md border border-gray-600 bg-gray-700 p-1.5 text-xs text-gray-200 focus:border-purple-500 focus:ring-purple-500'
                    }
                    aria-label="점수표 단계 선택"
                >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((stage) => (
                        <option key={stage} value={stage}>
                            {stage}단계
                            {embedded && arenaTabs && myStageForActiveArena != null && stage === myStageForActiveArena ? ' (내 단계)' : ''}
                        </option>
                    ))}
                </select>
            </div>

            {arenaTabs && embedded && (
                <div className="mb-1.5 flex w-full max-w-full shrink-0 justify-center gap-1">
                    {TOURNAMENT_ARENA_META.map((a, i) => (
                        <button
                            key={a.arena}
                            type="button"
                            onClick={() => setArenaTab(i)}
                            className={`min-w-0 flex-1 rounded-lg border px-1 py-1.5 text-center text-[11px] font-bold leading-tight transition-colors sm:text-xs ${
                                arenaTab === i
                                    ? 'border-amber-400/60 bg-amber-950/50 text-amber-100 ring-1 ring-amber-400/30'
                                    : 'border-white/10 bg-black/30 text-zinc-400 hover:border-amber-500/35 hover:text-zinc-200'
                            }`}
                        >
                            {a.arena}
                        </button>
                    ))}
                </div>
            )}

            <div
                className={`min-h-0 flex-1 ${arenaTabs && embedded ? 'flex w-full flex-col overflow-visible' : `space-y-2 overflow-y-auto pr-0.5 sm:space-y-3 ${embedded ? '[scrollbar-width:thin]' : ''}`}`}
            >
                {(arenaTabs && embedded ? [TOURNAMENT_ARENA_META[arenaTab]] : TOURNAMENT_ARENA_META).map((arenaData) => {
                    const displayRanks = groupRanksByScore(arenaData.type, selectedStage, arenaData.maxRank);
                    const compact = arenaTabs && embedded;

                    return (
                        <div
                            key={arenaData.arena}
                            className={`${arenaCardClass} ${compact ? 'mx-auto w-full max-w-full' : ''} ${embedded && !arenaTabs ? '' : !embedded ? 'p-2' : ''}`}
                        >
                            <h4
                                className={`font-bold ${embedded ? (compact ? 'mb-1.5 border-b border-amber-400/30 pb-1 text-center text-xs font-extrabold tracking-tight text-amber-100 sm:text-sm' : 'mb-2 border-b border-amber-400/30 pb-1.5 text-center text-xs font-extrabold tracking-tight text-amber-100 sm:text-sm') : 'mb-1.5 border-b border-accent/50 pb-0.5 text-sm text-accent'}`}
                            >
                                {arenaData.title} ({selectedStage}단계)
                            </h4>
                            <div
                                className={`grid grid-cols-[minmax(0,1fr)_auto] ${embedded ? (compact ? 'gap-x-0.5 gap-y-0' : 'gap-x-2 gap-y-0') : 'gap-x-2 gap-y-0.5'} ${compact ? 'mx-auto max-w-[16.5rem]' : ''}`}
                            >
                                <div
                                    className={`col-span-2 grid grid-cols-[minmax(0,1fr)_auto] border-b border-white/10 pb-1 ${embedded ? (compact ? 'gap-x-0.5' : 'gap-x-2') : 'gap-x-2'} ${embedded ? (compact ? 'text-[10px] font-bold uppercase tracking-wide text-zinc-500 sm:text-[11px]' : 'text-[10px] font-bold uppercase tracking-wide text-zinc-500') : 'text-[10px] font-semibold text-gray-400'}`}
                                >
                                    <span className={`pl-0.5 ${compact ? 'text-center' : ''}`}>순위</span>
                                    <span className={`pr-0.5 tabular-nums ${compact ? 'text-center' : 'text-right'}`}>점수</span>
                                </div>
                                {displayRanks.map(({ key, label, points, rankStart }) => {
                                    const rankColor = rankStart === 1 ? 'text-yellow-400' : rankStart === 2 ? 'text-slate-300' : rankStart === 3 ? 'text-amber-500' : 'text-zinc-300';
                                    const rowText = compact ? `text-[12px] sm:text-[13px] ${rankColor}` : embedded ? `text-[12px] sm:text-[13px] ${rankColor}` : `text-xs ${rankColor}`;
                                    return (
                                        <React.Fragment key={key}>
                                            <span
                                                className={`min-w-0 py-0.5 pl-0.5 font-semibold leading-snug ${compact ? 'text-center' : 'truncate'} ${rowText}`}
                                            >
                                                {label}
                                            </span>
                                            <span
                                                className={`py-0.5 pr-0.5 font-mono font-bold tabular-nums leading-snug ${compact ? 'text-center' : 'text-right'} ${rowText}`}
                                            >
                                                {points.toLocaleString()}
                                                <span className="ml-0.5 font-sans font-bold">점</span>
                                            </span>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PointsInfoPanel;
