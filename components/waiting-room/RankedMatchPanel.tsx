import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GameMode, ServerAction, UserWithStatus } from '../../types.js';
import type { RankingEntry } from '../../hooks/useRanking.js';
import Button from '../Button.js';
import PairPetRankedMatchModeModal from '../pair/PairPetRankedMatchModeModal.js';
import { RANKING_TIERS, SPECIAL_GAME_MODES } from '../../constants';
import { effectiveStrategicRankedQueueApCostForUser } from '../../shared/utils/pairPetArenaApDiscount.js';
import {
    readStrategicRankedBlock,
    readStrategicNormalMatchRecord,
} from '../../shared/utils/unifiedRankedStatsMigration.js';
import { RANKED_STRATEGIC_MODES } from '../../constants/rankedGameSettings.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { useRanking } from '../../hooks/useRanking.js';
import { getCurrentSeason, getPreviousSeason } from '../../utils/timeUtils.js';
import LobbyMatchKindPicker, { type LobbyMatchKindOption } from './LobbyMatchKindPicker.js';

/** 티어 안내 모달(TierInfoModal)과 동일한 기준: 시즌 랭킹 점수·순위·대국 수로 결정 */
const getTier = (score: number, rank: number, totalGames: number) => {
    for (const tier of RANKING_TIERS) {
        if (tier.threshold(score, rank, totalGames)) return tier;
    }
    return RANKING_TIERS[RANKING_TIERS.length - 1];
};

const STRATEGIC_LOBBY_MODES: GameMode[] = SPECIAL_GAME_MODES.map((m) => m.mode);

/** seasonHistory 한 시즌 객체에서 모드 키 불일치(문자열) 대비 */
function readTierFromHistorySlice(hist: unknown, mode: GameMode): string | undefined {
    if (!hist || typeof hist !== 'object') return undefined;
    const o = hist as Record<string, unknown>;
    const key = mode as string;
    const direct = o[key];
    if (typeof direct === 'string') return direct;
    for (const k of Object.keys(o)) {
        if (k === key) {
            const v = o[k];
            return typeof v === 'string' ? v : undefined;
        }
    }
    return undefined;
}

function bestTierInHistoryObject(hist: unknown, lobbyModes: GameMode[]): string | null {
    const tierOrder = RANKING_TIERS.map((t) => t.name);
    let bestTier: string | null = null;
    let bestIndex = tierOrder.length;
    for (const mode of lobbyModes) {
        const t = readTierFromHistorySlice(hist, mode);
        if (!t || t === '미참여' || !tierOrder.includes(t)) continue;
        const idx = tierOrder.indexOf(t);
        if (idx < bestIndex) {
            bestIndex = idx;
            bestTier = t;
        }
    }
    return bestTier;
}

/** 모든 시즌 키를 훑어 역대 최고 티어 + 그 시즌 이름(랭킹 캐시와 동일 티어 문자열) */
function computeAllTimeBestSeasonRecord(
    seasonHistory: UserWithStatus['seasonHistory'],
    lobbyModes: GameMode[],
): { tierName: string; seasonName: string } | null {
    if (!seasonHistory || typeof seasonHistory !== 'object') return null;
    const tierOrder = RANKING_TIERS.map((t) => t.name);
    let best: { tierName: string; seasonName: string; idx: number } | null = null;
    for (const seasonName of Object.keys(seasonHistory)) {
        const tier = bestTierInHistoryObject(seasonHistory[seasonName], lobbyModes);
        if (!tier) continue;
        const idx = tierOrder.indexOf(tier);
        const next = { tierName: tier, seasonName, idx };
        if (!best || idx < best.idx) {
            best = next;
        } else if (idx === best.idx && seasonName > best.seasonName) {
            best = next;
        }
    }
    return best;
}

function tierMetaByName(name: string | null | undefined) {
    if (!name) return null;
    return RANKING_TIERS.find((t) => t.name === name) ?? null;
}

/** 랭킹 API에 본인이 없을 때(랭킹전 10판 미만 등) stats로 동일 산식 폴백 — rankingCache.calculateSeasonRanking 과 맞춤 */
function computeSeasonSnapshotFromUserStats(
    user: UserWithStatus,
    rankings: RankingEntry[],
): { score: number; rank: number; totalGames: number; wins: number; losses: number } {
    const blk = readStrategicRankedBlock(user.stats as Record<string, { wins?: number; losses?: number; rankingScore?: number }>);
    const wins = blk.wins;
    const losses = blk.losses;
    const totalGames = wins + losses;

    const avgScore = blk.rankingScore;
    const eligible = rankings.filter((r) => (r.totalGames ?? 0) >= 10);
    const myEntry = rankings.find((r) => r.id === user.id);
    let rank: number;
    if (myEntry) {
        const rankAmongEligible = eligible.findIndex((r) => r.id === user.id) + 1;
        rank = rankAmongEligible > 0 ? rankAmongEligible : eligible.length + 1;
    } else {
        rank = Math.max(eligible.length + 1, 500);
    }
    return { score: avgScore, rank, totalGames, wins, losses };
}

interface RankedMatchPanelProps {
    currentUser: UserWithStatus;
    onAction: (action: ServerAction) => Promise<any>;
    isMatching?: boolean;
    matchingStartTime?: number;
    onCancelMatching?: () => void;
    onMatchingStateChange?: (isMatching: boolean, startTime: number) => void;
    /** 네이티브 대기실: 유저 목록 우측 좁은 열 — 현재/최고 시즌 카드를 세로로만 배치 */
    variant?: 'default' | 'nativeNarrow';
    /** PC 집계 대기실 좌열: 패널 높이를 본문에 맞춤(남는 세로 공간을 늘리지 않음) */
    shrinkToContent?: boolean;
    /** 랭크전(기본) / 일반전 매칭 큐 */
    queueKind?: 'ranked' | 'normal';
    /** 제공 시 시즌 영역 상단에 랭킹전/일반전 탭 표시 */
    onSelectQueueKind?: (queue: 'ranked' | 'normal') => void;
    /**
     * `dedicated`: 홈→랭킹전 — 상단 모드 선택, 좌 시즌 / 우 설명·설정·매칭.
     * 시작 버튼/모달 없이 바로 큐잉.
     */
    layout?: 'panel' | 'dedicated';
}

const RankedMatchPanel: React.FC<RankedMatchPanelProps> = ({ 
    currentUser, 
    onAction,
    isMatching = false,
    matchingStartTime = 0,
    onCancelMatching,
    onMatchingStateChange,
    variant = 'default',
    shrinkToContent = false,
    queueKind = 'ranked',
    onSelectQueueKind,
    layout = 'panel',
}) => {
    const { t } = useTranslation('lobby');
    const { t: tCommon } = useTranslation('common');
    const nativeNarrow = variant === 'nativeNarrow';
    const dedicated = layout === 'dedicated';
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { rankings } = useRanking('strategic', undefined, undefined, true);
    const { rankedMatchingQueue } = useAppContext();

    const strategicRankedQueueCountsByMode = useMemo(() => {
        const counts: Partial<Record<GameMode, number>> = {};
        for (const m of RANKED_STRATEGIC_MODES) counts[m] = 0;
        const qKey = queueKind === 'normal' ? 'normal' : 'strategic';
        const q = rankedMatchingQueue?.[qKey] as Record<string, { selectedModes?: GameMode[] }> | undefined;
        if (!q || typeof q !== 'object') return counts;
        for (const entry of Object.values(q)) {
            const modes = entry?.selectedModes;
            if (!Array.isArray(modes)) continue;
            for (const mode of modes) {
                if (RANKED_STRATEGIC_MODES.includes(mode)) counts[mode] = (counts[mode] ?? 0) + 1;
            }
        }
        return counts;
    }, [rankedMatchingQueue, queueKind]);

    const rankedActionPointCost = useMemo(
        () => effectiveStrategicRankedQueueApCostForUser(currentUser),
        [currentUser],
    );

    const normalMatchRecord = useMemo(
        () => readStrategicNormalMatchRecord(currentUser.stats as Record<string, unknown>),
        [currentUser.stats],
    );

    const currentSeasonTierAndScore = useMemo(() => {
        const eligible = rankings.filter((r) => (r.totalGames ?? 0) >= 10);
        const myEntry = rankings.find((r) => r.id === currentUser.id);
        const fromApi = myEntry
            ? (() => {
                  const rankAmongEligible = eligible.findIndex((r) => r.id === currentUser.id) + 1;
                  const rank = rankAmongEligible > 0 ? rankAmongEligible : eligible.length + 1;
                  return {
                      score: myEntry.score ?? 0,
                      rank,
                      totalGames: myEntry.totalGames ?? 0,
                      wins: myEntry.wins ?? 0,
                      losses: myEntry.losses ?? 0,
                  };
              })()
            : computeSeasonSnapshotFromUserStats(currentUser, rankings);
        /** 랭킹 API 캐시·구 스키마와 무관하게, 본인 `stats`의 랭킹전 전용 전적이 단일 출처 */
        const statBlk = readStrategicRankedBlock(currentUser.stats as Record<string, { wins?: number; losses?: number; rankingScore?: number }>);
        const merged = {
            ...fromApi,
            wins: statBlk.wins,
            losses: statBlk.losses,
            totalGames: statBlk.wins + statBlk.losses,
        };
        const tier = getTier(merged.score, merged.rank, merged.totalGames);
        return { tier, ...merged };
    }, [rankings, currentUser]);

    const isFirstSeason = useMemo(() => {
        const prevSeason = getPreviousSeason();
        const history = currentUser.seasonHistory?.[prevSeason.name];
        const hasPrevData = history && typeof history === 'object' && Object.keys(history).length > 0;
        return !hasPrevData && !currentUser.previousSeasonTier;
    }, [currentUser.seasonHistory, currentUser.previousSeasonTier]);

    /** 역대 최고 티어 + 달성 시즌명(시즌 히스토리 전체 스캔, 없으면 서버 previousSeasonTier + 직전 시즌) */
    const allTimeBestSeason = useMemo(() => {
        const fromHistory = computeAllTimeBestSeasonRecord(currentUser.seasonHistory, STRATEGIC_LOBBY_MODES);
        if (fromHistory) return fromHistory;
        const pt = currentUser.previousSeasonTier;
        if (pt && RANKING_TIERS.some((t) => t.name === pt)) {
            return { tierName: pt, seasonName: getPreviousSeason().name };
        }
        return null;
    }, [currentUser.seasonHistory, currentUser.previousSeasonTier]);

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

    const startStrategicRankedMatching = async (selectedModes: GameMode[]) => {
        try {
            const result: any = await onAction({
                type: 'START_RANKED_MATCHING',
                payload: { lobbyType: 'strategic', selectedModes, queueKind }
            });
            setIsModalOpen(false);
            
            // HTTP 응답에서 매칭 정보 확인하여 즉시 상태 업데이트
            // handleAction은 result 객체를 반환하거나, clientResponse를 포함할 수 있음
            const matchingInfo = result?.matchingInfo || result?.clientResponse?.matchingInfo;
            if (matchingInfo && onMatchingStateChange) {
                onMatchingStateChange(true, matchingInfo.startTime || Date.now());
            } else if (onMatchingStateChange) {
                onMatchingStateChange(true, Date.now());
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

    /** 최고 시즌 카드 = 현재 시즌 카드 복제: 첫 시즌·역대 기록 없음·(히스토리상) 현재 시즌 키와 동일할 때만 */
    const bestSeasonSameAsCurrent = useMemo(() => {
        if (isFirstSeason) return true;
        if (!allTimeBestSeason) return true;
        if (allTimeBestSeason.seasonName === currentSeasonName) return true;
        return false;
    }, [isFirstSeason, allTimeBestSeason, currentSeasonName]);

    const queueKindOptions = useMemo<LobbyMatchKindOption<'ranked' | 'normal'>[]>(
        () => [
            {
                value: 'ranked',
                label: t('arenaLobby.queueRanked', '랭킹전'),
                tone: 'amber',
            },
            {
                value: 'normal',
                label: t('arenaLobby.queueNormal', '일반전'),
                tone: 'cyan',
            },
        ],
        [t],
    );

    const queueKindTabs =
        typeof onSelectQueueKind === 'function' ? (
            <LobbyMatchKindPicker
                layout="row"
                ariaLabel={t('arenaLobby.matchTypeTitle', '경기 종류')}
                options={queueKindOptions}
                value={queueKind}
                defaultTone="amber"
                onChange={onSelectQueueKind}
            />
        ) : null;

    return (
        <>
            <div
                className={`flex min-h-0 flex-col text-on-panel relative ${
                    dedicated
                        ? 'h-full min-h-0 overflow-hidden p-2 sm:p-3'
                        : shrinkToContent
                          ? 'h-auto flex-none overflow-x-hidden overflow-y-visible'
                          : 'h-full'
                } ${
                    dedicated
                        ? ''
                        : nativeNarrow
                          ? 'overflow-y-auto overflow-x-hidden p-2'
                          : shrinkToContent
                            ? 'p-3 sm:p-3.5'
                            : 'overflow-x-auto p-3 sm:p-3.5 lg:p-4'
                }`}
            >
                {/* 배경 그라데이션 효과 */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-900/15 via-zinc-950/40 to-cyan-950/20 pointer-events-none rounded-lg"></div>
                
                {/* 헤더: 타이틀 + 랭킹전 시작/취소 버튼 */}
                <div
                    className={`relative z-10 mb-2 flex-shrink-0 border-b-2 border-gradient-to-r from-transparent via-indigo-500/30 to-transparent pb-2 ${
                        nativeNarrow
                            ? 'flex flex-row flex-nowrap items-center justify-between gap-1'
                            : 'mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-3'
                    }`}
                >
                    <div className={`flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2 ${nativeNarrow ? '' : 'gap-3'}`}>
                        <div className="h-6 w-1 flex-shrink-0 rounded-full bg-gradient-to-b from-yellow-400 via-amber-500 to-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.5)] sm:h-8"></div>
                        <h2
                            className={`min-w-0 truncate font-bold bg-gradient-to-r from-white via-yellow-200 to-white bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${
                                dedicated
                                    ? 'text-lg sm:text-xl lg:text-2xl'
                                    : nativeNarrow
                                      ? 'text-sm leading-tight'
                                      : 'whitespace-nowrap text-xl lg:text-2xl'
                            }`}
                        >
                            {queueKind === 'normal'
                                ? t('ranked.normalPanelTitle', '일반전')
                                : t('ranked.panelTitle', '랭킹전')}
                        </h2>
                    </div>
                    {dedicated ? (
                        isMatching ? (
                            <span className="shrink-0 text-[11px] font-semibold text-amber-200/70 sm:text-xs">
                                {t('ranked.matching')}
                            </span>
                        ) : null
                    ) : !isMatching ? (
                        <Button
                            onClick={() => setIsModalOpen(true)}
                            colorScheme="none"
                            className={`shrink-0 font-bold text-white transition-all duration-200 ${
                                nativeNarrow
                                    ? '!w-auto !py-1 !px-1.5 !text-[0.65rem] sm:!text-xs bg-gradient-to-r from-green-600/90 via-emerald-600/90 to-green-600/90 hover:from-green-500 hover:via-emerald-500 hover:to-green-500 rounded-md border border-green-400/30 shadow-sm'
                                    : '!flex-shrink-0 !py-2 !px-3 !text-xs bg-gradient-to-r from-green-600/90 via-emerald-600/90 to-green-600/90 hover:from-green-500 hover:via-emerald-500 hover:to-green-500 rounded-lg shadow-[0_2px_12px_rgba(34,197,94,0.4)] hover:shadow-[0_4px_16px_rgba(34,197,94,0.5)] border border-green-400/30 hover:border-green-300/50'
                            }`}
                        >
                            <span className={`flex items-center justify-center gap-0.5 ${nativeNarrow ? '' : 'gap-1.5'}`}>
                                <span className={nativeNarrow ? 'text-[0.65rem] sm:text-xs' : ''}>⚔️</span>
                                <span className={nativeNarrow ? 'text-[0.65rem] sm:text-xs' : ''}>
                                    {queueKind === 'normal'
                                        ? nativeNarrow
                                            ? t('ranked.startNormalShort', '시작')
                                            : t('ranked.startNormal', '일반전 시작')
                                        : nativeNarrow
                                          ? t('ranked.startShort')
                                          : t('ranked.start')}{' '}
                                    (⚡{rankedActionPointCost})
                                </span>
                            </span>
                        </Button>
                    ) : (
                        <Button
                            onClick={handleCancelMatching}
                            colorScheme="none"
                            className={`shrink-0 font-bold text-white transition-all duration-200 ${
                                nativeNarrow
                                    ? '!w-auto !py-1 !px-1.5 !text-[0.65rem] sm:!text-xs bg-gradient-to-r from-red-600/90 via-rose-600/90 to-red-600/90 hover:from-red-500 hover:via-rose-500 hover:to-red-500 rounded-md border border-red-400/30 shadow-sm'
                                    : '!flex-shrink-0 !py-2 !px-3 !text-xs bg-gradient-to-r from-red-600/90 via-rose-600/90 to-red-600/90 hover:from-red-500 hover:via-rose-500 hover:to-red-500 rounded-lg shadow-[0_2px_12px_rgba(220,38,38,0.4)] hover:shadow-[0_4px_16px_rgba(220,38,38,0.5)] border border-red-400/30 hover:border-red-300/50'
                            }`}
                        >
                            <span className="flex items-center justify-center gap-1">
                                <span>✕</span>
                                <span>{tCommon('actions.cancel')}</span>
                            </span>
                        </Button>
                    )}
                </div>
                
                {(dedicated || !isMatching) ? (
                    <>
                        {dedicated ? (
                            <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                                <PairPetRankedMatchModeModal
                                    presentation="dedicatedHome"
                                    variant="strategic_arena"
                                    initialMode={GameMode.Standard}
                                    queueCountByMode={strategicRankedQueueCountsByMode}
                                    currentUser={currentUser}
                                    isBusy={false}
                                    isMatching={isMatching}
                                    matchingElapsedSeconds={elapsedTime}
                                    onCancelMatching={() => void handleCancelMatching()}
                                    onClose={() => undefined}
                                    onQueue={(mode) => void startStrategicRankedMatching([mode])}
                                    seasonColumnHeader={queueKindTabs}
                                    currentSeasonPanel={
                                        queueKind === 'normal' ? (
                                <div className="flex-shrink-0 rounded-lg border border-cyan-500/40 bg-gradient-to-br from-cyan-950/50 via-slate-900/40 to-teal-950/40 p-2.5 sm:p-3">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-300 sm:text-xs">
                                        {t('ranked.normalPanelTitle', '일반전')}
                                    </p>
                                    <p className="mt-1.5 text-sm font-semibold leading-snug text-cyan-50/90">
                                        {t('ranked.winsLossesWinRate', {
                                            wins: normalMatchRecord.wins,
                                            losses: normalMatchRecord.losses,
                                        })}{' '}
                                        <span className="font-bold text-cyan-100">
                                            {(() => {
                                                const g = normalMatchRecord.wins + normalMatchRecord.losses;
                                                return g > 0
                                                    ? ((normalMatchRecord.wins / g) * 100).toFixed(0)
                                                    : '0';
                                            })()}
                                            %
                                        </span>
                                    </p>
                                </div>
                                        ) : (
                                <div className="group relative overflow-hidden rounded-lg bg-gradient-to-br from-blue-900/40 via-indigo-900/30 to-purple-900/40 border-2 border-blue-500/50 p-2.5 sm:p-3 shadow-[0_4px_20px_rgba(59,130,246,0.3)] hover:border-blue-400/70 hover:shadow-[0_6px_24px_rgba(59,130,246,0.4)] transition-all duration-300">
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                    <div className="relative z-10 flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between pb-1.5 border-b border-blue-400/30 gap-1">
                                            <p className="text-[11px] sm:text-xs font-bold text-blue-300 uppercase tracking-wide leading-tight">{t('ranked.currentSeason')}</p>
                                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
                                        </div>
                                        {currentSeasonTierAndScore ? (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        <img 
                                                            src={currentSeasonTierAndScore.tier.icon} 
                                                            alt="" 
                                                            className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 object-contain drop-shadow-[0_2px_8px_rgba(59,130,246,0.5)] group-hover:scale-110 transition-transform duration-300" 
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-transparent rounded-lg blur-sm"></div>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`text-sm font-bold break-words leading-snug ${currentSeasonTierAndScore.tier.color} drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]`}>
                                                            {currentSeasonTierAndScore.tier.name}
                                                        </p>
                                                        <p className="text-[10px] sm:text-xs text-blue-300/90 font-medium leading-snug mt-0.5">
                                                            {currentSeasonName}{isFirstSeason ? t('ranked.firstSeason') : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="bg-gradient-to-r from-blue-900/50 to-indigo-900/50 rounded-md p-2 border border-blue-500/30">
                                                    <div className="flex justify-between items-baseline gap-2">
                                                        <span className="text-[10px] sm:text-xs text-blue-300/90 font-medium shrink-0">{t('ranked.currentScore')}</span>
                                                        <span className="font-mono font-bold text-white text-base sm:text-lg tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] text-right">
                                                            {(currentSeasonTierAndScore.score ?? 0).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] sm:text-xs text-blue-300/80 pt-1.5 border-t border-blue-400/20 leading-snug">
                                                        {t('ranked.winsLossesWinRate', { wins: currentSeasonTierAndScore.wins, losses: currentSeasonTierAndScore.losses })}{' '}
                                                        <span className="font-bold text-blue-200">
                                                            {(() => {
                                                                const g =
                                                                    currentSeasonTierAndScore.wins +
                                                                    currentSeasonTierAndScore.losses;
                                                                return g > 0
                                                                    ? ((currentSeasonTierAndScore.wins / g) * 100).toFixed(0)
                                                                    : '0';
                                                            })()}
                                                            %
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center gap-2 text-[10px] sm:text-xs pt-0.5">
                                                    <span className="text-blue-300/80 font-medium shrink-0">{t('ranked.seasonBest')}</span>
                                                    <span className="font-mono font-semibold text-blue-200 tabular-nums text-right break-all">
                                                        {t('ranked.scorePoints', { score: currentSeasonTierAndScore.score.toLocaleString() })}{isFirstSeason ? t('ranked.sameScore') : ''}
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <img 
                                                        src={RANKING_TIERS[RANKING_TIERS.length - 1].icon} 
                                                        alt="" 
                                                        className="w-8 h-8 flex-shrink-0 object-contain opacity-50" 
                                                    />
                                                    <p className="text-sm text-blue-300/80">{t('ranked.notAggregated')}</p>
                                                </div>
                                                <p className="text-[10px] sm:text-xs text-blue-300/70">{currentSeasonName}</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                                        )
                                    }
                                    bestSeasonPanel={
                                        queueKind === 'normal' ? null : (
                                <div className="group relative overflow-hidden rounded-lg bg-gradient-to-br from-amber-900/40 via-yellow-900/30 to-orange-900/40 border-2 border-amber-500/50 p-2.5 sm:p-3 shadow-[0_4px_20px_rgba(251,191,36,0.3)] hover:border-amber-400/70 hover:shadow-[0_6px_24px_rgba(251,191,36,0.4)] transition-all duration-300">
                                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                    <div className="relative z-10 flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between pb-1.5 border-b border-amber-400/30 gap-1">
                                            <p className="text-[11px] sm:text-xs font-bold text-amber-300 uppercase tracking-wide leading-tight">{t('ranked.bestSeason')}</p>
                                            <span className="text-xs">⭐</span>
                                        </div>
                                        {bestSeasonSameAsCurrent && currentSeasonTierAndScore ? (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        <img 
                                                            src={currentSeasonTierAndScore.tier.icon} 
                                                            alt="" 
                                                            className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 object-contain drop-shadow-[0_2px_8px_rgba(251,191,36,0.5)] group-hover:scale-110 transition-transform duration-300" 
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 to-transparent rounded-lg blur-sm"></div>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`text-sm font-bold break-words leading-snug ${currentSeasonTierAndScore.tier.color} drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]`}>
                                                            {currentSeasonTierAndScore.tier.name}
                                                        </p>
                                                        <p className="text-[10px] sm:text-xs text-amber-300/90 font-medium leading-snug mt-0.5">
                                                            {currentSeasonName}{isFirstSeason ? t('ranked.firstSeason') : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="bg-gradient-to-r from-amber-900/50 to-yellow-900/50 rounded-md p-2 border border-amber-500/30">
                                                    <p className="font-mono font-bold text-white text-base sm:text-lg text-center tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                                                        {t('ranked.scorePoints', { score: (currentSeasonTierAndScore.score ?? 0).toLocaleString() })}
                                                    </p>
                                                    <p className="text-[10px] sm:text-xs text-amber-300/80 pt-1.5 border-t border-amber-400/20 text-center leading-snug">
                                                        {t('ranked.winsLossesWinRate', { wins: currentSeasonTierAndScore.wins, losses: currentSeasonTierAndScore.losses })}{' '}
                                                        <span className="font-bold text-amber-200">
                                                            {(() => {
                                                                const g =
                                                                    currentSeasonTierAndScore.wins +
                                                                    currentSeasonTierAndScore.losses;
                                                                return g > 0
                                                                    ? ((currentSeasonTierAndScore.wins / g) * 100).toFixed(0)
                                                                    : '0';
                                                            })()}
                                                            %
                                                        </span>
                                                    </p>
                                                </div>
                                            </>
                                        ) : bestSeasonSameAsCurrent ? (
                                            <div className="flex-1 flex flex-col justify-center py-2">
                                                <p className="text-xs text-amber-300/70 text-center">{t('ranked.firstSeasonNone')}</p>
                                                <p className="text-[10px] sm:text-xs text-amber-300/70 mt-0.5 text-center">{currentSeasonName}</p>
                                            </div>
                                        ) : allTimeBestSeason ? (
                                            <>
                                                <div className="flex items-center gap-2 py-1">
                                                    <div className="relative shrink-0">
                                                        <img
                                                            src={
                                                                tierMetaByName(allTimeBestSeason.tierName)?.icon ??
                                                                RANKING_TIERS[RANKING_TIERS.length - 1].icon
                                                            }
                                                            alt=""
                                                            className="h-9 w-9 object-contain drop-shadow-[0_2px_8px_rgba(251,191,36,0.45)] sm:h-10 sm:w-10"
                                                        />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p
                                                            className={`text-sm font-bold leading-snug break-words ${
                                                                tierMetaByName(allTimeBestSeason.tierName)?.color ?? 'text-amber-200'
                                                            } drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]`}
                                                        >
                                                            {allTimeBestSeason.tierName}
                                                        </p>
                                                        <p className="mt-0.5 whitespace-nowrap text-[10px] font-semibold text-amber-200/90 sm:text-xs">
                                                            {allTimeBestSeason.seasonName}
                                                        </p>
                                                    </div>
                                                </div>
                                                <p className="border-t border-amber-400/20 pt-1 text-center text-[10px] text-amber-300/80 sm:text-xs">
                                                    {t('ranked.allTimeBestTier')}
                                                </p>
                                            </>
                                        ) : (
                                            <div className="flex-1 flex flex-col justify-center py-2">
                                                <p className="text-xs text-amber-300/70 text-center">-</p>
                                                <p className="text-[10px] sm:text-xs text-amber-300/70 mt-0.5 text-center">{t('ranked.allTimeBestTier')}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                        )
                                    }
                                />
                            </div>
                        ) : null}
                        {!dedicated ? (
                        <div className="relative z-10 flex flex-shrink-0 flex-col gap-2 overflow-visible">
                            {queueKindTabs}
                            {queueKind === 'normal' ? (
                                <div className="flex-shrink-0 rounded-lg border border-cyan-500/40 bg-gradient-to-br from-cyan-950/50 via-slate-900/40 to-teal-950/40 p-2.5 sm:p-3">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-300 sm:text-xs">
                                        {t('ranked.normalPanelTitle', '일반전')}
                                    </p>
                                    <p className="mt-1.5 text-sm font-semibold leading-snug text-cyan-50/90">
                                        {t('ranked.winsLossesWinRate', {
                                            wins: normalMatchRecord.wins,
                                            losses: normalMatchRecord.losses,
                                        })}{' '}
                                        <span className="font-bold text-cyan-100">
                                            {(() => {
                                                const g = normalMatchRecord.wins + normalMatchRecord.losses;
                                                return g > 0
                                                    ? ((normalMatchRecord.wins / g) * 100).toFixed(0)
                                                    : '0';
                                            })()}
                                            %
                                        </span>
                                    </p>
                                </div>
                            ) : null}
                            <div
                                className={`flex-shrink-0 ${
                                    queueKind === 'normal'
                                        ? 'hidden'
                                        : nativeNarrow
                                          ? 'flex min-w-0 flex-col gap-2'
                                          : 'grid min-w-[16rem] grid-cols-2 gap-2.5 sm:gap-3'
                                }`}
                            >
                                {/* 현재 시즌 */}
                                <div className="group relative overflow-hidden rounded-lg bg-gradient-to-br from-blue-900/40 via-indigo-900/30 to-purple-900/40 border-2 border-blue-500/50 p-2.5 sm:p-3 shadow-[0_4px_20px_rgba(59,130,246,0.3)] hover:border-blue-400/70 hover:shadow-[0_6px_24px_rgba(59,130,246,0.4)] transition-all duration-300">
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                    <div className="relative z-10 flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between pb-1.5 border-b border-blue-400/30 gap-1">
                                            <p className="text-[11px] sm:text-xs font-bold text-blue-300 uppercase tracking-wide leading-tight">{t('ranked.currentSeason')}</p>
                                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
                                        </div>
                                        {currentSeasonTierAndScore ? (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        <img 
                                                            src={currentSeasonTierAndScore.tier.icon} 
                                                            alt="" 
                                                            className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 object-contain drop-shadow-[0_2px_8px_rgba(59,130,246,0.5)] group-hover:scale-110 transition-transform duration-300" 
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 to-transparent rounded-lg blur-sm"></div>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`text-sm font-bold break-words leading-snug ${currentSeasonTierAndScore.tier.color} drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]`}>
                                                            {currentSeasonTierAndScore.tier.name}
                                                        </p>
                                                        <p className="text-[10px] sm:text-xs text-blue-300/90 font-medium leading-snug mt-0.5">
                                                            {currentSeasonName}{isFirstSeason ? t('ranked.firstSeason') : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="bg-gradient-to-r from-blue-900/50 to-indigo-900/50 rounded-md p-2 border border-blue-500/30">
                                                    <div className="flex justify-between items-baseline gap-2">
                                                        <span className="text-[10px] sm:text-xs text-blue-300/90 font-medium shrink-0">{t('ranked.currentScore')}</span>
                                                        <span className="font-mono font-bold text-white text-base sm:text-lg tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] text-right">
                                                            {(currentSeasonTierAndScore.score ?? 0).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] sm:text-xs text-blue-300/80 pt-1.5 border-t border-blue-400/20 leading-snug">
                                                        {t('ranked.winsLossesWinRate', { wins: currentSeasonTierAndScore.wins, losses: currentSeasonTierAndScore.losses })}{' '}
                                                        <span className="font-bold text-blue-200">
                                                            {(() => {
                                                                const g =
                                                                    currentSeasonTierAndScore.wins +
                                                                    currentSeasonTierAndScore.losses;
                                                                return g > 0
                                                                    ? ((currentSeasonTierAndScore.wins / g) * 100).toFixed(0)
                                                                    : '0';
                                                            })()}
                                                            %
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center gap-2 text-[10px] sm:text-xs pt-0.5">
                                                    <span className="text-blue-300/80 font-medium shrink-0">{t('ranked.seasonBest')}</span>
                                                    <span className="font-mono font-semibold text-blue-200 tabular-nums text-right break-all">
                                                        {t('ranked.scorePoints', { score: currentSeasonTierAndScore.score.toLocaleString() })}{isFirstSeason ? t('ranked.sameScore') : ''}
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <img 
                                                        src={RANKING_TIERS[RANKING_TIERS.length - 1].icon} 
                                                        alt="" 
                                                        className="w-8 h-8 flex-shrink-0 object-contain opacity-50" 
                                                    />
                                                    <p className="text-sm text-blue-300/80">{t('ranked.notAggregated')}</p>
                                                </div>
                                                <p className="text-[10px] sm:text-xs text-blue-300/70">{currentSeasonName}</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="group relative overflow-hidden rounded-lg bg-gradient-to-br from-amber-900/40 via-yellow-900/30 to-orange-900/40 border-2 border-amber-500/50 p-2.5 sm:p-3 shadow-[0_4px_20px_rgba(251,191,36,0.3)] hover:border-amber-400/70 hover:shadow-[0_6px_24px_rgba(251,191,36,0.4)] transition-all duration-300">
                                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                    <div className="relative z-10 flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between pb-1.5 border-b border-amber-400/30 gap-1">
                                            <p className="text-[11px] sm:text-xs font-bold text-amber-300 uppercase tracking-wide leading-tight">{t('ranked.bestSeason')}</p>
                                            <span className="text-xs">⭐</span>
                                        </div>
                                        {bestSeasonSameAsCurrent && currentSeasonTierAndScore ? (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        <img 
                                                            src={currentSeasonTierAndScore.tier.icon} 
                                                            alt="" 
                                                            className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 object-contain drop-shadow-[0_2px_8px_rgba(251,191,36,0.5)] group-hover:scale-110 transition-transform duration-300" 
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 to-transparent rounded-lg blur-sm"></div>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`text-sm font-bold break-words leading-snug ${currentSeasonTierAndScore.tier.color} drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]`}>
                                                            {currentSeasonTierAndScore.tier.name}
                                                        </p>
                                                        <p className="text-[10px] sm:text-xs text-amber-300/90 font-medium leading-snug mt-0.5">
                                                            {currentSeasonName}{isFirstSeason ? t('ranked.firstSeason') : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="bg-gradient-to-r from-amber-900/50 to-yellow-900/50 rounded-md p-2 border border-amber-500/30">
                                                    <p className="font-mono font-bold text-white text-base sm:text-lg text-center tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                                                        {t('ranked.scorePoints', { score: (currentSeasonTierAndScore.score ?? 0).toLocaleString() })}
                                                    </p>
                                                    <p className="text-[10px] sm:text-xs text-amber-300/80 pt-1.5 border-t border-amber-400/20 text-center leading-snug">
                                                        {t('ranked.winsLossesWinRate', { wins: currentSeasonTierAndScore.wins, losses: currentSeasonTierAndScore.losses })}{' '}
                                                        <span className="font-bold text-amber-200">
                                                            {(() => {
                                                                const g =
                                                                    currentSeasonTierAndScore.wins +
                                                                    currentSeasonTierAndScore.losses;
                                                                return g > 0
                                                                    ? ((currentSeasonTierAndScore.wins / g) * 100).toFixed(0)
                                                                    : '0';
                                                            })()}
                                                            %
                                                        </span>
                                                    </p>
                                                </div>
                                            </>
                                        ) : bestSeasonSameAsCurrent ? (
                                            <div className="flex-1 flex flex-col justify-center py-2">
                                                <p className="text-xs text-amber-300/70 text-center">{t('ranked.firstSeasonNone')}</p>
                                                <p className="text-[10px] sm:text-xs text-amber-300/70 mt-0.5 text-center">{currentSeasonName}</p>
                                            </div>
                                        ) : allTimeBestSeason ? (
                                            <>
                                                <div className="flex items-center gap-2 py-1">
                                                    <div className="relative shrink-0">
                                                        <img
                                                            src={
                                                                tierMetaByName(allTimeBestSeason.tierName)?.icon ??
                                                                RANKING_TIERS[RANKING_TIERS.length - 1].icon
                                                            }
                                                            alt=""
                                                            className="h-9 w-9 object-contain drop-shadow-[0_2px_8px_rgba(251,191,36,0.45)] sm:h-10 sm:w-10"
                                                        />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p
                                                            className={`text-sm font-bold leading-snug break-words ${
                                                                tierMetaByName(allTimeBestSeason.tierName)?.color ?? 'text-amber-200'
                                                            } drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]`}
                                                        >
                                                            {allTimeBestSeason.tierName}
                                                        </p>
                                                        <p className="mt-0.5 whitespace-nowrap text-[10px] font-semibold text-amber-200/90 sm:text-xs">
                                                            {allTimeBestSeason.seasonName}
                                                        </p>
                                                    </div>
                                                </div>
                                                <p className="border-t border-amber-400/20 pt-1 text-center text-[10px] text-amber-300/80 sm:text-xs">
                                                    {t('ranked.allTimeBestTier')}
                                                </p>
                                            </>
                                        ) : (
                                            <div className="flex-1 flex flex-col justify-center py-2">
                                                <p className="text-xs text-amber-300/70 text-center">-</p>
                                                <p className="text-[10px] sm:text-xs text-amber-300/70 mt-0.5 text-center">{t('ranked.allTimeBestTier')}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        ) : null}
                    </>
                ) : null}
                {!dedicated && isMatching ? (
                    <div
                        className={`relative z-10 flex flex-col gap-3 overflow-hidden ${
                            !shrinkToContent ? 'min-h-0 flex-1' : 'flex-shrink-0'
                        }`}
                    >
                        <div
                            className={`relative flex-shrink-0 overflow-hidden rounded-xl border-2 border-yellow-500/60 bg-gradient-to-br from-yellow-900/50 via-amber-900/40 to-yellow-900/50 shadow-[0_8px_32px_rgba(234,179,8,0.4)] ${
                                nativeNarrow ? 'p-2' : 'p-4'
                            }`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-transparent to-yellow-500/20 animate-pulse"></div>
                            <div className={`relative z-10 flex flex-col ${nativeNarrow ? 'gap-2' : 'gap-4'}`}>
                                <div className={`flex items-center justify-center ${nativeNarrow ? 'gap-2' : 'gap-3'}`}>
                                    <div className={`relative ${nativeNarrow ? 'h-10 w-10' : 'h-14 w-14'}`}>
                                        <div className="absolute inset-0 rounded-full border-4 border-yellow-400 border-t-transparent animate-spin"></div>
                                        <div
                                            className="absolute inset-2 rounded-full border-4 border-amber-400 border-t-transparent animate-spin"
                                            style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
                                        ></div>
                                    </div>
                                    <span
                                        className={`font-bold text-yellow-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${
                                            nativeNarrow ? 'text-sm whitespace-nowrap' : 'text-xl'
                                        }`}
                                    >
                                        {t('ranked.matching')}
                                    </span>
                                </div>
                                <div
                                    className={`rounded-lg border border-yellow-400/30 bg-gradient-to-r from-yellow-900/60 to-amber-900/60 ${
                                        nativeNarrow ? 'px-2 py-1.5' : 'p-3'
                                    }`}
                                >
                                    <div className="flex min-w-0 flex-nowrap items-center justify-between gap-2">
                                        <span
                                            className={`shrink-0 font-medium whitespace-nowrap text-yellow-200 ${
                                                nativeNarrow ? 'text-[10px]' : 'text-sm'
                                            }`}
                                        >
                                            {t('ranked.waitTime')}
                                        </span>
                                        <span
                                            className={`shrink-0 font-mono font-bold tabular-nums whitespace-nowrap text-yellow-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${
                                                nativeNarrow ? 'text-base' : 'text-2xl'
                                            }`}
                                        >
                                            {formatTime(elapsedTime)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>

            {!dedicated && isModalOpen ? (
                <PairPetRankedMatchModeModal
                    variant="strategic_arena"
                    initialMode={GameMode.Standard}
                    queueCountByMode={strategicRankedQueueCountsByMode}
                    currentUser={currentUser}
                    isBusy={false}
                    onClose={() => setIsModalOpen(false)}
                    onQueue={(mode) => void startStrategicRankedMatching([mode])}
                />
            ) : null}
        </>
    );
};

export default RankedMatchPanel;

