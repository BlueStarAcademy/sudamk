import React, { useMemo } from 'react';
import { UserWithStatus, GameMode } from '../../types.js';
import DraggableWindow from '../DraggableWindow.js';
import { RANKING_TIERS, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants';
import { getCompletedTrackedRankingSeasonsNewestFirst } from '../../utils/timeUtils.js';

interface PastRankingsModalProps {
    info: { user: UserWithStatus; mode: GameMode | 'strategic' | 'playful'; };
    onClose: () => void;
    isTopmost?: boolean;
}

const EMPTY_RANKING_LABEL = '시즌 랭킹 정보 없음';

function getBestLobbyTierName(
    history: Partial<Record<GameMode, string>> | undefined,
    lobbyType: 'strategic' | 'playful'
): string | null {
    if (!history || typeof history !== 'object') return null;
    const modes = lobbyType === 'strategic'
        ? SPECIAL_GAME_MODES.map((m) => m.mode)
        : PLAYFUL_GAME_MODES.map((m) => m.mode);
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

const PastRankingsModal: React.FC<PastRankingsModalProps> = ({ info, onClose, isTopmost }) => {
    const { user, mode } = info;
    const history = user.seasonHistory || {};
    const seasonNames = Object.keys(history).sort((a, b) => b.localeCompare(a));
    const PRIMARY_SEASON = '2025-3';
    const orderedSeasonNames = seasonNames.filter(season => season !== PRIMARY_SEASON);
    orderedSeasonNames.unshift(PRIMARY_SEASON);

    const trackedPastSeasons = useMemo(() => getCompletedTrackedRankingSeasonsNewestFirst(), []);

    const strategicOrPlayfulBody = useMemo(() => {
        if (mode !== 'strategic' && mode !== 'playful') return null;
        if (trackedPastSeasons.length === 0) {
            return (
                <p className="text-center text-gray-500 py-6">{EMPTY_RANKING_LABEL}</p>
            );
        }
        return (
            <ul className="space-y-2">
                {trackedPastSeasons.map((season) => {
                    const tierName = getBestLobbyTierName(history[season.name], mode);
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

    // strategic/playful 모드: 로비(통합) 기준 시즌별 최고 티어
    if (mode === 'strategic' || mode === 'playful') {
        const lobbyTitle = mode === 'strategic' ? '전략바둑' : '놀이바둑';
        return (
            <DraggableWindow title="지난 시즌 랭킹" onClose={onClose} windowId="past-rankings" initialWidth={450} isTopmost={isTopmost}>
                <div className="max-h-[calc(var(--vh,1vh)*60)] overflow-y-auto pr-2">
                    <h3 className="text-lg font-bold text-center mb-4">{lobbyTitle}</h3>
                    {strategicOrPlayfulBody}
                </div>
            </DraggableWindow>
        );
    }

    // GameMode인 경우에만 seasonHistory에서 랭킹 정보를 가져올 수 있음
    const gameMode = mode as GameMode;

    return (
        <DraggableWindow title="지난 시즌 랭킹" onClose={onClose} windowId="past-rankings" initialWidth={450} isTopmost={isTopmost}>
            <div className="max-h-[calc(var(--vh,1vh)*60)] overflow-y-auto pr-2">
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
            </div>
        </DraggableWindow>
    );
};

export default PastRankingsModal;
