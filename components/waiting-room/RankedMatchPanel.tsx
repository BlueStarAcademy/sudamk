import React, { useState, useEffect, useMemo } from 'react';
import { GameMode, ServerAction, UserWithStatus } from '../../types.js';
import Button from '../Button.js';
import RankedMatchSelectionModal from './RankedMatchSelectionModal.js';
import { RANKING_TIERS, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants';
import { useRanking } from '../../hooks/useRanking.js';
import { getCurrentSeason, getPreviousSeason } from '../../utils/timeUtils.js';

/** 티어 안내 모달(TierInfoModal)과 동일한 기준: 시즌 랭킹 점수·순위·대국 수로 결정 */
const getTier = (score: number, rank: number, totalGames: number) => {
    for (const tier of RANKING_TIERS) {
        if (tier.threshold(score, rank, totalGames)) return tier;
    }
    return RANKING_TIERS[RANKING_TIERS.length - 1];
};

interface RankedMatchPanelProps {
    lobbyType: 'strategic' | 'playful';
    currentUser: UserWithStatus;
    onAction: (action: ServerAction) => Promise<any>;
    isMatching?: boolean;
    matchingStartTime?: number;
    onCancelMatching?: () => void;
    onMatchingStateChange?: (isMatching: boolean, startTime: number) => void;
}

const RankedMatchPanel: React.FC<RankedMatchPanelProps> = ({ 
    lobbyType, 
    currentUser, 
    onAction,
    isMatching = false,
    matchingStartTime = 0,
    onCancelMatching,
    onMatchingStateChange
}) => {
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const rankingType = lobbyType === 'strategic' ? 'strategic' : 'playful';
    const { rankings } = useRanking(rankingType, undefined, undefined, true);

    const currentSeasonTierAndScore = useMemo(() => {
        const eligible = rankings.filter((r) => (r.totalGames ?? 0) >= 10);
        const myEntry = rankings.find((r) => r.id === currentUser.id);
        if (!myEntry) return null;
        const rankAmongEligible = eligible.findIndex((r) => r.id === currentUser.id) + 1;
        const rank = rankAmongEligible > 0 ? rankAmongEligible : eligible.length + 1;
        const score = myEntry.score ?? 0;
        const totalGames = myEntry.totalGames ?? 0;
        const wins = myEntry.wins ?? 0;
        const losses = myEntry.losses ?? 0;
        const tier = getTier(score, rank, totalGames);
        return { tier, score, rank, totalGames, wins, losses };
    }, [rankings, currentUser.id]);

    const isFirstSeason = useMemo(() => {
        const prevSeason = getPreviousSeason();
        const history = currentUser.seasonHistory?.[prevSeason.name];
        const hasPrevData = history && typeof history === 'object' && Object.keys(history).length > 0;
        return !hasPrevData && !currentUser.previousSeasonTier;
    }, [currentUser.seasonHistory, currentUser.previousSeasonTier]);

    const previousBestTier = useMemo(() => {
        const prevSeason = getPreviousSeason();
        const history = currentUser.seasonHistory?.[prevSeason.name];
        if (!history || typeof history !== 'object') {
            return currentUser.previousSeasonTier ?? null;
        }
        const lobbyModes = lobbyType === 'strategic'
            ? SPECIAL_GAME_MODES.map((m) => m.mode)
            : PLAYFUL_GAME_MODES.map((m) => m.mode);
        const tierOrder = RANKING_TIERS.map((t) => t.name);
        let bestTier: string | null = null;
        let bestIndex = tierOrder.length;
        for (const mode of lobbyModes) {
            const t = (history as Record<string, string>)[mode];
            if (t && tierOrder.includes(t)) {
                const idx = tierOrder.indexOf(t);
                if (idx < bestIndex) {
                    bestIndex = idx;
                    bestTier = t;
                }
            }
        }
        return bestTier ?? currentUser.previousSeasonTier ?? null;
    }, [currentUser.seasonHistory, currentUser.previousSeasonTier, lobbyType]);

    // 매칭 중일 때 경과 시간 업데이트
    useEffect(() => {
        if (!isMatching || !matchingStartTime) {
            setElapsedTime(0);
            return;
        }

        const interval = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - matchingStartTime) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [isMatching, matchingStartTime]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStartMatching = async (selectedModes: GameMode[]) => {
        try {
            const result: any = await onAction({
                type: 'START_RANKED_MATCHING',
                payload: { lobbyType, selectedModes }
            });
            setIsModalOpen(false);
            
            // HTTP 응답에서 매칭 정보 확인하여 즉시 상태 업데이트
            // handleAction은 result 객체를 반환하거나, clientResponse를 포함할 수 있음
            const matchingInfo = result?.matchingInfo || result?.clientResponse?.matchingInfo;
            if (matchingInfo && onMatchingStateChange) {
                console.log('[RankedMatchPanel] Matching started, updating state:', matchingInfo);
                onMatchingStateChange(true, matchingInfo.startTime || Date.now());
            } else {
                // 매칭 정보가 없으면 현재 시간을 시작 시간으로 사용 (WebSocket 메시지 대기)
                console.log('[RankedMatchPanel] No matchingInfo in response, using current time');
                if (onMatchingStateChange) {
                    onMatchingStateChange(true, Date.now());
                }
            }
        } catch (error) {
            console.error('Failed to start ranked matching:', error);
        }
    };

    const handleCancelMatching = async () => {
        try {
            await onAction({ type: 'CANCEL_RANKED_MATCHING' });
            if (onMatchingStateChange) {
                onMatchingStateChange(false, 0);
            }
            if (onCancelMatching) {
                onCancelMatching();
            }
        } catch (error) {
            console.error('Failed to cancel ranked matching:', error);
        }
    };

    const currentSeasonName = getCurrentSeason().name;

    return (
        <>
            <div className="p-2.5 flex flex-col h-full min-h-0 text-on-panel">
                <h2 className="text-lg font-semibold border-b border-color pb-1.5 flex-shrink-0 mb-2">
                    랭킹전
                </h2>
                
                {!isMatching ? (
                    <>
                        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pr-0.5">
                            {/* 현재 시즌 / 최고 시즌 2단 구성 */}
                            <div className="grid grid-cols-2 gap-2 flex-shrink-0">
                                {/* 현재 시즌 */}
                                <div className="rounded-lg bg-panel/60 border border-color p-2 flex flex-col gap-1.5">
                                    <p className="text-[10px] font-bold text-tertiary uppercase tracking-wide border-b border-color/50 pb-1">현재 시즌</p>
                                    {currentSeasonTierAndScore ? (
                                        <>
                                            <div className="flex items-center gap-1.5">
                                                <img src={currentSeasonTierAndScore.tier.icon} alt="" className="w-7 h-7 flex-shrink-0 object-contain" />
                                                <div className="min-w-0">
                                                    <p className={`text-xs font-semibold truncate ${currentSeasonTierAndScore.tier.color}`}>{currentSeasonTierAndScore.tier.name}</p>
                                                    <p className="text-[10px] text-tertiary truncate">{currentSeasonName}{isFirstSeason ? ' (첫 시즌)' : ''}</p>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-baseline text-[10px]">
                                                <span className="text-tertiary">현재점수</span>
                                                <span className="font-mono font-bold text-on-panel">{(currentSeasonTierAndScore.score ?? 0).toLocaleString()}</span>
                                            </div>
                                            {(currentSeasonTierAndScore.wins + currentSeasonTierAndScore.losses) > 0 && (
                                                <div className="text-[10px] text-tertiary pt-0.5 border-t border-color/50">
                                                    {currentSeasonTierAndScore.wins}승 {currentSeasonTierAndScore.losses}패 · 승률 {((currentSeasonTierAndScore.wins / (currentSeasonTierAndScore.wins + currentSeasonTierAndScore.losses)) * 100).toFixed(0)}%
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center text-[10px] pt-0.5">
                                                <span className="text-tertiary">시즌 최고</span>
                                                <span className="font-mono font-semibold">{currentSeasonTierAndScore.score.toLocaleString()}점{isFirstSeason ? ' (동일)' : ''}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-1.5">
                                                <img src={RANKING_TIERS[RANKING_TIERS.length - 1].icon} alt="" className="w-7 h-7 flex-shrink-0 object-contain" />
                                                <p className="text-xs text-tertiary">미집계</p>
                                            </div>
                                            <p className="text-[10px] text-tertiary">{currentSeasonName}</p>
                                        </>
                                    )}
                                </div>
                                {/* 최고 시즌 (역대) */}
                                <div className="rounded-lg bg-panel/60 border border-color p-2 flex flex-col gap-1.5">
                                    <p className="text-[10px] font-bold text-tertiary uppercase tracking-wide border-b border-color/50 pb-1">최고 시즌</p>
                                    <div className="flex-1 flex flex-col justify-center">
                                        {previousBestTier ? (
                                            <p className={`text-sm font-bold text-highlight`}>{previousBestTier}</p>
                                        ) : isFirstSeason ? (
                                            <p className="text-xs text-tertiary">첫 시즌 (없음)</p>
                                        ) : (
                                            <p className="text-xs text-tertiary">-</p>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-tertiary">역대 최고 등급</p>
                                </div>
                            </div>
                        </div>
                        <Button
                            onClick={() => setIsModalOpen(true)}
                            colorScheme="green"
                            className="w-full !py-2 !text-sm font-bold flex-shrink-0 mt-2"
                        >
                            랭킹전 시작
                        </Button>
                    </>
                ) : (
                    <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-hidden">
                        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3 flex-shrink-0">
                            <div className="flex items-center justify-center mb-3">
                                <div className="relative w-12 h-12">
                                    <div className="absolute inset-0 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                                <span className="ml-3 text-lg font-bold text-yellow-300">매칭 중...</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-yellow-200">대기 시간</span>
                                <span className="text-lg text-yellow-300 font-mono font-bold">{formatTime(elapsedTime)}</span>
                            </div>
                        </div>
                        <Button
                            onClick={handleCancelMatching}
                            colorScheme="red"
                            className="w-full !py-2 !text-sm font-bold flex-shrink-0"
                        >
                            매칭 취소
                        </Button>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <RankedMatchSelectionModal
                    lobbyType={lobbyType}
                    onClose={() => setIsModalOpen(false)}
                    onStartMatching={handleStartMatching}
                />
            )}
        </>
    );
};

export default RankedMatchPanel;

