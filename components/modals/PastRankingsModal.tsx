import React, { useMemo, useState } from 'react';
import { UserWithStatus, GameMode, ChampionshipVersusSeasonHistory } from '../../types.js';
import DraggableWindow from '../DraggableWindow.js';
import { RANKING_TIERS, SPECIAL_GAME_MODES } from '../../constants';
import { getCompletedTrackedRankingSeasonsNewestFirst } from '../../utils/timeUtils.js';
import { RANKING_MODAL_SLIM_SCROLL_X, RANKING_MODAL_SLIM_SCROLL_Y } from '../../shared/constants/rankingModalScrollbar.js';
import { CHAMPIONSHIP_VERSUS_VENUE_KINDS } from '../../shared/constants/championshipVersusVenue.js';

interface PastRankingsModalProps {
    info: { user: UserWithStatus; mode: GameMode | 'strategic' | 'pair' | 'unified' };
    onClose: () => void;
    isTopmost?: boolean;
}

const EMPTY_RANKING_LABEL = '시즌 랭킹 정보 없음';

const TAB_BTN =
    'shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all duration-200 sm:px-3 sm:text-sm';

function getBestStrategicLobbyTierName(history: Partial<Record<GameMode, string>> | undefined): string | null {
    if (!history || typeof history !== 'object') return null;
    const modes = SPECIAL_GAME_MODES.map((m) => m.mode);
    const tierOrder = RANKING_TIERS.map((t) => t.name);
    let bestTier: string | null = null;
    let bestIndex = tierOrder.length;
    for (const mode of modes) {
        const t = history[mode];
        if (!t || t === '미참여') continue;
        if (!tierOrder.includes(t)) continue;
        const idx = tierOrder.indexOf(t);
        if (idx < bestIndex) {
            bestIndex = idx;
            bestTier = t;
        }
    }
    return bestTier;
}

function getBestChampionshipVersusTierName(row: ChampionshipVersusSeasonHistory | undefined): string | null {
    if (!row || typeof row !== 'object') return null;
    const tierOrder = RANKING_TIERS.map((t) => t.name);
    let bestTier: string | null = null;
    let bestIndex = tierOrder.length;
    for (const venue of CHAMPIONSHIP_VERSUS_VENUE_KINDS) {
        const t = row[venue];
        if (!t || t === '미참여') continue;
        if (!tierOrder.includes(t)) continue;
        const idx = tierOrder.indexOf(t);
        if (idx < bestIndex) {
            bestIndex = idx;
            bestTier = t;
        }
    }
    return bestTier;
}

type PastTab = 'strategic' | 'pair' | 'championship';

const PastRankingsModal: React.FC<PastRankingsModalProps> = ({ info, onClose, isTopmost }) => {
    const { user, mode } = info;
    const history = user.seasonHistory || {};
    const versusHistory = user.championshipVersusSeasonHistory || {};
    const seasonNames = Object.keys(history).sort((a, b) => b.localeCompare(a));
    const PRIMARY_SEASON = '2025-3';
    const orderedSeasonNames = seasonNames.filter((season) => season !== PRIMARY_SEASON);
    orderedSeasonNames.unshift(PRIMARY_SEASON);

    const trackedPastSeasons = useMemo(() => getCompletedTrackedRankingSeasonsNewestFirst(), []);

    const [activeTab, setActiveTab] = useState<PastTab>(
        mode === 'unified' ? 'strategic' : mode === 'pair' ? 'pair' : 'strategic',
    );

    const pairSeasonBody = useMemo(() => {
        if (trackedPastSeasons.length === 0) {
            return <p className="py-6 text-center text-gray-500">{EMPTY_RANKING_LABEL}</p>;
        }
        return (
            <ul className="space-y-2">
                {trackedPastSeasons.map((season) => {
                    const row = history[season.name] as Record<string, string | undefined> | undefined;
                    const tierName = row?.pair;
                    const tierInfo = tierName ? RANKING_TIERS.find((t) => t.name === tierName) : undefined;
                    return (
                        <li
                            key={season.name}
                            className="flex items-center justify-between gap-3 rounded-lg bg-gray-900/50 p-3"
                        >
                            <span className="shrink-0 font-semibold text-gray-300">{season.name}</span>
                            {tierName && tierInfo ? (
                                <div className="flex min-w-0 items-center justify-end gap-2">
                                    <img src={tierInfo.icon} alt={tierName} className="h-8 w-8 shrink-0" />
                                    <span className={`truncate font-bold ${tierInfo.color}`}>{tierName}</span>
                                </div>
                            ) : (
                                <span className="text-right text-sm text-gray-500">{EMPTY_RANKING_LABEL}</span>
                            )}
                        </li>
                    );
                })}
            </ul>
        );
    }, [history, trackedPastSeasons]);

    const strategicSeasonBody = useMemo(() => {
        if (trackedPastSeasons.length === 0) {
            return <p className="py-6 text-center text-gray-500">{EMPTY_RANKING_LABEL}</p>;
        }
        return (
            <ul className="space-y-2">
                {trackedPastSeasons.map((season) => {
                    const tierName = getBestStrategicLobbyTierName(history[season.name]);
                    const tierInfo = tierName ? RANKING_TIERS.find((t) => t.name === tierName) : undefined;
                    return (
                        <li key={season.name} className="flex items-center justify-between gap-3 rounded-lg bg-gray-900/50 p-3">
                            <span className="shrink-0 font-semibold text-gray-300">{season.name}</span>
                            {tierName && tierInfo ? (
                                <div className="flex min-w-0 items-center justify-end gap-2">
                                    <img src={tierInfo.icon} alt={tierName} className="h-8 w-8 shrink-0" />
                                    <span className={`truncate font-bold ${tierInfo.color}`}>{tierName}</span>
                                </div>
                            ) : (
                                <span className="text-right text-sm text-gray-500">{EMPTY_RANKING_LABEL}</span>
                            )}
                        </li>
                    );
                })}
            </ul>
        );
    }, [history, trackedPastSeasons]);

    const championshipSeasonBody = useMemo(() => {
        if (trackedPastSeasons.length === 0) {
            return <p className="py-6 text-center text-gray-500">{EMPTY_RANKING_LABEL}</p>;
        }
        return (
            <ul className="space-y-2">
                {trackedPastSeasons.map((season) => {
                    const tierName = getBestChampionshipVersusTierName(versusHistory[season.name]);
                    const tierInfo = tierName ? RANKING_TIERS.find((t) => t.name === tierName) : undefined;
                    return (
                        <li key={season.name} className="flex items-center justify-between gap-3 rounded-lg bg-gray-900/50 p-3">
                            <span className="shrink-0 font-semibold text-gray-300">{season.name}</span>
                            {tierName && tierInfo ? (
                                <div className="flex min-w-0 items-center justify-end gap-2">
                                    <img src={tierInfo.icon} alt={tierName} className="h-8 w-8 shrink-0" />
                                    <span className={`truncate font-bold ${tierInfo.color}`}>{tierName}</span>
                                </div>
                            ) : (
                                <span className="text-right text-sm text-gray-500">{EMPTY_RANKING_LABEL}</span>
                            )}
                        </li>
                    );
                })}
            </ul>
        );
    }, [trackedPastSeasons, versusHistory]);

    const unifiedBody = (
        <>
            <div
                className={`mb-3 flex gap-1.5 overflow-x-auto border-b border-white/10 pb-3 ${RANKING_MODAL_SLIM_SCROLL_X}`}
                role="tablist"
                aria-label="지난 시즌 종류"
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'strategic'}
                    onClick={() => setActiveTab('strategic')}
                    className={`${TAB_BTN} ${
                        activeTab === 'strategic'
                            ? 'border-amber-400/50 bg-amber-500/20 text-amber-50'
                            : 'border-white/15 bg-white/5 text-zinc-300 hover:border-white/25'
                    }`}
                >
                    전략바둑
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'pair'}
                    onClick={() => setActiveTab('pair')}
                    className={`${TAB_BTN} ${
                        activeTab === 'pair'
                            ? 'border-amber-400/50 bg-amber-500/20 text-amber-50'
                            : 'border-white/15 bg-white/5 text-zinc-300 hover:border-white/25'
                    }`}
                >
                    페어 바둑
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'championship'}
                    onClick={() => setActiveTab('championship')}
                    className={`${TAB_BTN} ${
                        activeTab === 'championship'
                            ? 'border-fuchsia-400/45 bg-fuchsia-950/40 text-fuchsia-50'
                            : 'border-white/15 bg-white/5 text-zinc-300 hover:border-white/25'
                    }`}
                >
                    챔피언십
                </button>
            </div>
            {activeTab === 'strategic' && strategicSeasonBody}
            {activeTab === 'pair' && pairSeasonBody}
            {activeTab === 'championship' && (
                <>
                    <p className="mb-2 text-center text-xs text-gray-400">대전장(PVP·펫·페어) 시즌 확정 티어</p>
                    {championshipSeasonBody}
                </>
            )}
        </>
    );

    if (mode === 'unified') {
        return (
            <DraggableWindow title="지난 시즌 랭킹" onClose={onClose} windowId="past-rankings" initialWidth={480} isTopmost={isTopmost}>
                <div className={`max-h-[calc(var(--vh,1vh)*65)] overflow-y-auto pr-2 ${RANKING_MODAL_SLIM_SCROLL_Y}`}>
                    {unifiedBody}
                </div>
            </DraggableWindow>
        );
    }

    if (mode === 'strategic') {
        return (
            <DraggableWindow title="지난 시즌 랭킹" onClose={onClose} windowId="past-rankings" initialWidth={450} isTopmost={isTopmost}>
                <div className={`max-h-[calc(var(--vh,1vh)*60)] overflow-y-auto pr-2 ${RANKING_MODAL_SLIM_SCROLL_Y}`}>
                    <h3 className="mb-4 text-center text-lg font-bold">전략바둑</h3>
                    {strategicSeasonBody}
                </div>
            </DraggableWindow>
        );
    }

    if (mode === 'pair') {
        return (
            <DraggableWindow title="지난 시즌 랭킹" onClose={onClose} windowId="past-rankings" initialWidth={450} isTopmost={isTopmost}>
                <div className={`max-h-[calc(var(--vh,1vh)*60)] overflow-y-auto pr-2 ${RANKING_MODAL_SLIM_SCROLL_Y}`}>
                    <h3 className="mb-4 text-center text-lg font-bold">페어 바둑</h3>
                    {pairSeasonBody}
                </div>
            </DraggableWindow>
        );
    }

    const gameMode = mode as GameMode;

    return (
        <DraggableWindow title="지난 시즌 랭킹" onClose={onClose} windowId="past-rankings" initialWidth={450} isTopmost={isTopmost}>
            <div className={`max-h-[calc(var(--vh,1vh)*60)] overflow-y-auto pr-2 ${RANKING_MODAL_SLIM_SCROLL_Y}`}>
                <h3 className="mb-4 text-center text-lg font-bold">{mode}</h3>
                {orderedSeasonNames.length > 0 ? (
                    <ul className="space-y-2">
                        {orderedSeasonNames.map((seasonName) => {
                            const tier = history[seasonName]?.[gameMode];
                            const tierInfo = RANKING_TIERS.find((t) => t.name === tier);
                            return (
                                <li key={seasonName} className="flex items-center justify-between rounded-lg bg-gray-900/50 p-3">
                                    <span className="font-semibold text-gray-300">{seasonName}</span>
                                    {tier && tierInfo ? (
                                        <div className="flex items-center gap-2">
                                            <img src={tierInfo.icon} alt={tier} className="h-8 w-8" />
                                            <span className={`font-bold ${tierInfo.color}`}>{tier}</span>
                                        </div>
                                    ) : (
                                        <span className="text-gray-500">티어없음</span>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="text-center text-gray-500">지난 시즌 랭킹 기록이 없습니다.</p>
                )}
            </div>
        </DraggableWindow>
    );
};

export default PastRankingsModal;
