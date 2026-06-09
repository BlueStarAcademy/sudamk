import React, { useMemo } from 'react';
import { UserWithStatus, GameMode } from '../../types.js';
import DraggableWindow from '../DraggableWindow.js';
import { RANKING_TIERS, SPECIAL_GAME_MODES } from '../../constants';
import { getCompletedTrackedRankingSeasonsNewestFirst } from '../../utils/timeUtils.js';
import { RANKING_MODAL_SLIM_SCROLL_Y } from '../../shared/constants/rankingModalScrollbar.js';
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../../shared/constants/pcShellLayout.js';

interface PastRankingsModalProps {
    info: { user: UserWithStatus; mode: GameMode | 'strategic' | 'pair' | 'unified' };
    onClose: () => void;
    isTopmost?: boolean;
    embedded?: boolean;
}

const EMPTY_RANKING_LABEL = '시즌 랭킹 정보 없음';

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

const PastRankingsModal: React.FC<PastRankingsModalProps> = ({ info, onClose, isTopmost, embedded = false }) => {
    const { user, mode } = info;
    const wrapWindow = (content: React.ReactNode) =>
        embedded ? (
            <div className={PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS}>{content}</div>
        ) : (
            <DraggableWindow title="지난 시즌 랭킹" onClose={onClose} windowId="past-rankings" initialWidth={450} isTopmost={isTopmost}>
                {content}
            </DraggableWindow>
        );
    const history = user.seasonHistory || {};
    const seasonNames = Object.keys(history).sort((a, b) => b.localeCompare(a));
    const PRIMARY_SEASON = '2025-3';
    const orderedSeasonNames = seasonNames.filter(season => season !== PRIMARY_SEASON);
    orderedSeasonNames.unshift(PRIMARY_SEASON);

    const trackedPastSeasons = useMemo(() => getCompletedTrackedRankingSeasonsNewestFirst(), []);

    const pairSeasonBody = useMemo(() => {
        if (mode !== 'pair') return null;
        if (trackedPastSeasons.length === 0) {
            return <p className="text-center text-gray-500 py-6">{EMPTY_RANKING_LABEL}</p>;
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
    }, [history, mode, trackedPastSeasons]);

    const strategicSeasonBody = useMemo(() => {
        if (mode !== 'strategic') return null;
        if (trackedPastSeasons.length === 0) {
            return (
                <p className="text-center text-gray-500 py-6">{EMPTY_RANKING_LABEL}</p>
            );
        }
        return (
            <ul className="space-y-2">
                {trackedPastSeasons.map((season) => {
                    const tierName = getBestStrategicLobbyTierName(history[season.name]);
                    const tierInfo = tierName ? RANKING_TIERS.find((t) => t.name === tierName) : undefined;
                    return (
                        <li
                            key={season.name}
                            className="flex items-center justify-between gap-3 p-3 bg-gray-900/50 rounded-lg"
                        >
                            <span className="font-semibold text-gray-300 shrink-0">{season.name}</span>
                            {tierName && tierInfo ? (
                                <div className="flex items-center gap-2 min-w-0 justify-end">
                                    <img src={tierInfo.icon} alt={tierName} className="w-8 h-8 shrink-0" />
                                    <span className={`font-bold truncate ${tierInfo.color}`}>{tierName}</span>
                                </div>
                            ) : (
                                <span className="text-gray-500 text-sm text-right">{EMPTY_RANKING_LABEL}</span>
                            )}
                        </li>
                    );
                })}
            </ul>
        );
    }, [history, mode, trackedPastSeasons]);

    // 전략 로비(통합) 기준 시즌별 최고 티어 — 놀이바둑 시즌 랭킹은 폐지됨
    if (mode === 'strategic') {
        return wrapWindow(
            <div className={`max-h-[calc(var(--vh,1vh)*60)] overflow-y-auto pr-2 ${RANKING_MODAL_SLIM_SCROLL_Y}`}>
                <h3 className="text-lg font-bold text-center mb-4">전략바둑</h3>
                {strategicSeasonBody}
            </div>,
        );
    }

    if (mode === 'pair') {
        return wrapWindow(
            <div className={`max-h-[calc(var(--vh,1vh)*60)] overflow-y-auto pr-2 ${RANKING_MODAL_SLIM_SCROLL_Y}`}>
                <h3 className="mb-4 text-center text-lg font-bold">페어 바둑</h3>
                {pairSeasonBody}
            </div>,
        );
    }

    // GameMode인 경우에만 seasonHistory에서 랭킹 정보를 가져올 수 있음
    const gameMode = mode as GameMode;

    return wrapWindow(
        <div className={`max-h-[calc(var(--vh,1vh)*60)] overflow-y-auto pr-2 ${RANKING_MODAL_SLIM_SCROLL_Y}`}>
            <h3 className="text-lg font-bold text-center mb-4">{mode}</h3>
            {orderedSeasonNames.length > 0 ? (
                <ul className="space-y-2">
                    {orderedSeasonNames.map(seasonName => {
                        const tier = history[seasonName]?.[gameMode];
                        const tierInfo = RANKING_TIERS.find(t => t.name === tier);
                        return (
                            <li key={seasonName} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                                <span className="font-semibold text-gray-300">{seasonName}</span>
                                {tier && tierInfo ? (
                                    <div className="flex items-center gap-2">
                                        <img src={tierInfo.icon} alt={tier} className="w-8 h-8" />
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
        </div>,
    );
};

export default PastRankingsModal;
