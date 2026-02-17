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
    /** 최고 시즌이 현재 시즌과 같을 때(첫 시즌이거나 역대 최고가 없을 때) 현재 시즌과 동일한 내용 표시 */
    const bestSeasonSameAsCurrent = isFirstSeason || !previousBestTier;

    return (
        <>
            <div className="p-3 lg:p-4 flex flex-col h-full min-h-0 text-on-panel relative">
                {/* 배경 그라데이션 효과 */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-purple-900/5 to-blue-900/10 pointer-events-none rounded-lg"></div>
                
                {/* 헤더 */}
                <div className="relative z-10 flex items-center gap-3 mb-4 pb-3 border-b-2 border-gradient-to-r from-transparent via-indigo-500/30 to-transparent flex-shrink-0">
                    <div className="w-1 h-8 bg-gradient-to-b from-yellow-400 via-amber-500 to-yellow-400 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.5)]"></div>
                    <h2 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-white via-yellow-200 to-white bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                        랭킹전
                    </h2>
                </div>
                
                {!isMatching ? (
                    <>
                        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-1">
                            {/* 현재 시즌 / 최고 시즌 2단 구성 */}
                            <div className="grid grid-cols-2 gap-3 flex-shrink-0">
                                {/* 현재 시즌 */}
                                <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-900/40 via-indigo-900/30 to-purple-900/40 border-2 border-blue-500/50 p-3 shadow-[0_4px_20px_rgba(59,130,246,0.3)] hover:border-blue-400/70 hover:shadow-[0_6px_24px_rgba(59,130,246,0.4)] transition-all duration-300">
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                    <div className="relative z-10 flex flex-col gap-2.5">
                                        <div className="flex items-center justify-between pb-2 border-b border-blue-400/30">
                                            <p className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">현재 시즌</p>
                                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
                                        </div>
                                        {currentSeasonTierAndScore ? (
                                            <>
                                                <div className="flex items-center gap-2.5">
                                                    <div className="relative">
                                                        <img 
                                                            src={currentSeasonTierAndScore.tier.icon} 
                                                            alt="" 
                                                            className="w-10 h-10 flex-shrink-0 object-contain drop-shadow-[0_2px_8px_rgba(59,130,246,0.5)] group-hover:scale-110 transition-transform duration-300" 
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-transparent rounded-lg blur-sm"></div>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`text-sm font-bold truncate ${currentSeasonTierAndScore.tier.color} drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]`}>
                                                            {currentSeasonTierAndScore.tier.name}
                                                        </p>
                                                        <p className="text-[10px] text-blue-300/80 truncate font-medium">
                                                            {currentSeasonName}{isFirstSeason ? ' (첫 시즌)' : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="bg-gradient-to-r from-blue-900/50 to-indigo-900/50 rounded-lg p-2 border border-blue-500/30">
                                                    <div className="flex justify-between items-baseline mb-1">
                                                        <span className="text-[10px] text-blue-300/80 font-medium">현재 점수</span>
                                                        <span className="font-mono font-bold text-white text-base drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                                                            {(currentSeasonTierAndScore.score ?? 0).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    {(currentSeasonTierAndScore.wins + currentSeasonTierAndScore.losses) > 0 && (
                                                        <div className="text-[10px] text-blue-300/70 pt-1.5 border-t border-blue-400/20">
                                                            {currentSeasonTierAndScore.wins}승 {currentSeasonTierAndScore.losses}패 · 승률{' '}
                                                            <span className="font-bold text-blue-200">
                                                                {((currentSeasonTierAndScore.wins / (currentSeasonTierAndScore.wins + currentSeasonTierAndScore.losses)) * 100).toFixed(0)}%
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] pt-1">
                                                    <span className="text-blue-300/70 font-medium">시즌 최고</span>
                                                    <span className="font-mono font-semibold text-blue-200">
                                                        {currentSeasonTierAndScore.score.toLocaleString()}점{isFirstSeason ? ' (동일)' : ''}
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2.5">
                                                    <img 
                                                        src={RANKING_TIERS[RANKING_TIERS.length - 1].icon} 
                                                        alt="" 
                                                        className="w-10 h-10 flex-shrink-0 object-contain opacity-50" 
                                                    />
                                                    <p className="text-sm text-blue-300/70">미집계</p>
                                                </div>
                                                <p className="text-[10px] text-blue-300/60">{currentSeasonName}</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {/* 최고 시즌: 현재 시즌과 같으면 등급·점수·승패만, 아니면 역대 최고 등급만 */}
                                <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-900/40 via-yellow-900/30 to-orange-900/40 border-2 border-amber-500/50 p-3 shadow-[0_4px_20px_rgba(251,191,36,0.3)] hover:border-amber-400/70 hover:shadow-[0_6px_24px_rgba(251,191,36,0.4)] transition-all duration-300">
                                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                    <div className="relative z-10 flex flex-col gap-2.5">
                                        <div className="flex items-center justify-between pb-2 border-b border-amber-400/30">
                                            <p className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">최고 시즌</p>
                                            <span className="text-xs">⭐</span>
                                        </div>
                                        {bestSeasonSameAsCurrent && currentSeasonTierAndScore ? (
                                            <>
                                                <div className="flex items-center gap-2.5">
                                                    <div className="relative">
                                                        <img 
                                                            src={currentSeasonTierAndScore.tier.icon} 
                                                            alt="" 
                                                            className="w-10 h-10 flex-shrink-0 object-contain drop-shadow-[0_2px_8px_rgba(251,191,36,0.5)] group-hover:scale-110 transition-transform duration-300" 
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 to-transparent rounded-lg blur-sm"></div>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`text-sm font-bold truncate ${currentSeasonTierAndScore.tier.color} drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]`}>
                                                            {currentSeasonTierAndScore.tier.name}
                                                        </p>
                                                        <p className="text-[10px] text-amber-300/80 truncate font-medium">
                                                            {currentSeasonName}{isFirstSeason ? ' (첫 시즌)' : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="bg-gradient-to-r from-amber-900/50 to-yellow-900/50 rounded-lg p-2 border border-amber-500/30">
                                                    <p className="font-mono font-bold text-white text-base text-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                                                        {(currentSeasonTierAndScore.score ?? 0).toLocaleString()}점
                                                    </p>
                                                    {(currentSeasonTierAndScore.wins + currentSeasonTierAndScore.losses) > 0 && (
                                                        <p className="text-[10px] text-amber-300/70 pt-1.5 border-t border-amber-400/20 text-center">
                                                            {currentSeasonTierAndScore.wins}승 {currentSeasonTierAndScore.losses}패 · 승률{' '}
                                                            <span className="font-bold text-amber-200">
                                                                {((currentSeasonTierAndScore.wins / (currentSeasonTierAndScore.wins + currentSeasonTierAndScore.losses)) * 100).toFixed(0)}%
                                                            </span>
                                                        </p>
                                                    )}
                                                </div>
                                            </>
                                        ) : bestSeasonSameAsCurrent ? (
                                            <div className="flex-1 flex flex-col justify-center py-4">
                                                <p className="text-sm text-amber-300/70 text-center">첫 시즌 (없음)</p>
                                                <p className="text-[10px] text-amber-300/60 mt-1 text-center">{currentSeasonName}</p>
                                            </div>
                                        ) : previousBestTier ? (
                                            <>
                                                <div className="flex-1 flex flex-col justify-center py-4">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <p className={`text-lg font-bold ${RANKING_TIERS.find(t => t.name === previousBestTier)?.color ?? 'text-highlight'} drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]`}>
                                                            {previousBestTier}
                                                        </p>
                                                        <div className="w-12 h-0.5 bg-gradient-to-r from-transparent via-amber-400/50 to-transparent"></div>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-amber-300/70 pt-1 border-t border-amber-400/20 text-center">역대 최고 등급</p>
                                            </>
                                        ) : (
                                            <div className="flex-1 flex flex-col justify-center py-4">
                                                <p className="text-sm text-amber-300/70 text-center">-</p>
                                                <p className="text-[10px] text-amber-300/60 mt-1 text-center">역대 최고 등급</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="relative z-10 flex-shrink-0 mt-3">
                            <Button
                                onClick={() => setIsModalOpen(true)}
                                colorScheme="none"
                                className="w-full !py-3 !text-sm font-bold bg-gradient-to-r from-green-600/90 via-emerald-600/90 to-green-600/90 hover:from-green-500 hover:via-emerald-500 hover:to-green-500 text-white rounded-xl shadow-[0_4px_16px_rgba(34,197,94,0.4)] hover:shadow-[0_6px_20px_rgba(34,197,94,0.5)] transition-all duration-200 border-2 border-green-400/30 hover:border-green-300/50"
                            >
                                <span className="flex items-center justify-center gap-2">
                                    <span className="text-lg">⚔️</span>
                                    <span>랭킹전 시작</span>
                                </span>
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="relative z-10 flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
                        <div className="relative overflow-hidden bg-gradient-to-br from-yellow-900/50 via-amber-900/40 to-yellow-900/50 border-2 border-yellow-500/60 rounded-xl p-4 shadow-[0_8px_32px_rgba(234,179,8,0.4)] flex-shrink-0">
                            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-transparent to-yellow-500/20 animate-pulse"></div>
                            <div className="relative z-10 flex flex-col gap-4">
                                <div className="flex items-center justify-center gap-3">
                                    <div className="relative w-14 h-14">
                                        <div className="absolute inset-0 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                                        <div className="absolute inset-2 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                                    </div>
                                    <span className="text-xl font-bold text-yellow-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                                        매칭 중...
                                    </span>
                                </div>
                                <div className="bg-gradient-to-r from-yellow-900/60 to-amber-900/60 rounded-lg p-3 border border-yellow-400/30">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-yellow-200 font-medium">대기 시간</span>
                                        <span className="text-2xl text-yellow-100 font-mono font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                                            {formatTime(elapsedTime)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <Button
                            onClick={handleCancelMatching}
                            colorScheme="none"
                            className="w-full !py-3 !text-sm font-bold bg-gradient-to-r from-red-600/90 via-rose-600/90 to-red-600/90 hover:from-red-500 hover:via-rose-500 hover:to-red-500 text-white rounded-xl shadow-[0_4px_16px_rgba(220,38,38,0.4)] hover:shadow-[0_6px_20px_rgba(220,38,38,0.5)] transition-all duration-200 border-2 border-red-400/30 hover:border-red-300/50"
                        >
                            <span className="flex items-center justify-center gap-2">
                                <span className="text-lg">✕</span>
                                <span>매칭 취소</span>
                            </span>
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

