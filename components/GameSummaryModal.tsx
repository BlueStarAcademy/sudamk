import React, { useMemo, useEffect, useRef, useState } from 'react';
import { LiveGameSession, User, Player, WinReason, StatChange, AnalysisResult, GameMode, GameSummary, InventoryItem, AvatarInfo, BorderInfo, AlkkagiStone, ServerAction, AlkkagiRoundHistoryEntry } from '../types.js';
import Avatar from './Avatar.js';
import { audioService } from '../services/audioService.js';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, AVATAR_POOL, BORDER_POOL, CONSUMABLE_ITEMS, EQUIPMENT_POOL, MATERIAL_ITEMS, aiUserId } from '../constants';
import { getAdventureCodexMonsterById } from '../constants/adventureMonstersCodex.js';
import { canSaveStrategicPvpGameRecord, GAME_RECORD_SLOT_FULL_MESSAGE } from '../utils/strategicPvpGameRecord.js';
import { useGameRecordSaveLock } from '../hooks/useGameRecordSaveLock.js';
import { TOWER_STAGES } from '../constants/towerConstants.js';
import { SINGLE_PLAYER_STAGES } from '../constants/singlePlayerConstants.js';
import { getMannerRank as getMannerRankShared } from '../services/manner.js';
import {
    getGuildWarBoardMode,
    isGuildWarLiveSession,
    GUILD_WAR_STAR_CAPTURE_TIER2_MIN,
    GUILD_WAR_STAR_CAPTURE_TIER3_MIN,
    getGuildWarStarScoreTier2MinDiff,
    getGuildWarStarScoreTier3MinDiff,
} from '../shared/constants/guildConstants.js';
import { computeGuildWarAttemptMetrics } from '../shared/utils/guildWarAttemptMetrics.js';
import { arenaPostGameButtonClass, arenaPostGameButtonGridClass } from './game/arenaPostGameButtonStyles.js';
import { ResultModalXpRewardBadge } from './game/ResultModalXpRewardBadge.js';
import {
    ResultModalGoldCurrencySlot,
    ResultModalItemRewardSlot,
    RESULT_MODAL_REWARDS_ROW_MIN_H_CLASS,
    RESULT_MODAL_REWARDS_ROW_MOBILE_COMPACT_CLASS,
    RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS,
} from './game/ResultModalRewardSlot.js';
import { ResultModalVipRewardSlot } from './game/ResultModalVipRewardSlot.js';
import { AdventureBattleRewardRowWithReveal, AdventureResultCodexCard } from './game/adventureResultModalSections.js';
import { RESULT_MODAL_SCORE_MOBILE_PX } from './game/resultModalScoreTypography.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { isRewardVipActive } from '../shared/utils/rewardVip.js';
import { VIP_PLAY_REWARD_SLOT_PREVIEW_IMAGE } from '../shared/constants/vipPlayReward.js';
import { useResilientImgSrc } from '../hooks/useResilientImgSrc.js';
import { MobileGameResultTabBar, MobileResultTabPanelStack, type MobileGameResultTab } from './game/MobileGameResultTabBar.js';

interface GameSummaryModalProps {
    session: LiveGameSession;
    currentUser: User;
    onConfirm: () => void;
    /** 모험: 맵으로 돌아가며 경기장 퇴장 */
    onLeaveToAdventureMap?: () => void;
    onAction?: (action: ServerAction) => void | Promise<unknown>;
    /** 저장된 기보 목록·삭제(기보 관리) */
    onOpenGameRecordList?: () => void;
    isSpectator?: boolean;
}

const getIsWinner = (session: LiveGameSession, currentUser: User): boolean | null => {
    const { winner, blackPlayerId, whitePlayerId, player1, player2 } = session;
    if (winner === null || winner === Player.None) return null;
    const isPlayer = currentUser.id === player1.id || currentUser.id === player2.id;
    if (!isPlayer) return null; // Spectators don't have a win/loss status

    return (winner === Player.Black && currentUser.id === blackPlayerId) || 
           (winner === Player.White && currentUser.id === whitePlayerId);
};

const getMannerRank = (score: number) => {
    return getMannerRankShared(score).rank;
};


const XP_BAR_BASE_MS = 700;
const XP_BAR_GAIN_MS = 600;

const XpBar: React.FC<{
    initial: number;
    final: number;
    max: number;
    levelUp: boolean;
    xpGain: number;
    finalLevel: number;
    isMobile?: boolean;
    mobileTextScale?: number;
    /** 세로 공간 절약(대국 결과 우측 패널 등) */
    compact?: boolean;
    /** 프로필 등 다른 곳에 Lv를 표시할 때 바 옆 숫자 생략 */
    omitLevelColumn?: boolean;
}> = ({ initial, final, max, levelUp, xpGain, finalLevel, isMobile = false, mobileTextScale = 1, compact = false, omitLevelColumn = false }) => {
    /** 기존 XP 구간(노랑) — 먼저 0에서 initialPercent까지 채움 */
    const [baseW, setBaseW] = useState(0);
    /** 이번 대국 획득 구간(초록) — 기존 채움 후에 이어서 표시, 애니메이션 후에도 유지 */
    const [gainW, setGainW] = useState(0);
    const [showGainText, setShowGainText] = useState(false);

    const initialPercent = max > 0 ? (initial / max) * 100 : 0;
    const finalPercent = max > 0 ? (levelUp ? 100 : (final / max) * 100) : 0;
    const gainPercent = Math.max(0, finalPercent - initialPercent);

    useEffect(() => {
        let cancelled = false;
        setBaseW(0);
        setGainW(0);
        setShowGainText(false);

        const startTimer = setTimeout(() => {
            if (cancelled) return;
            requestAnimationFrame(() => {
                if (cancelled) return;
                requestAnimationFrame(() => {
                    if (!cancelled) setBaseW(initialPercent);
                });
            });
        }, 150);

        const gainTimer =
            gainPercent > 0
                ? setTimeout(() => {
                      if (cancelled) return;
                      requestAnimationFrame(() => {
                          if (cancelled) return;
                          requestAnimationFrame(() => {
                              if (cancelled) return;
                              setGainW(gainPercent);
                              if (xpGain > 0) setShowGainText(true);
                          });
                      });
                  }, 150 + XP_BAR_BASE_MS)
                : null;

        return () => {
            cancelled = true;
            clearTimeout(startTimer);
            if (gainTimer) clearTimeout(gainTimer);
        };
    }, [initial, final, max, levelUp, initialPercent, finalPercent, gainPercent, xpGain]);
    
    const gainTextKey = `${xpGain}-${initial}`;

    const pcCompact = compact && !isMobile;

    if (isMobile) {
        return (
            <div className="flex w-full min-w-0 flex-col gap-1">
                <div className="flex w-full min-w-0 items-center gap-1.5">
                    {!omitLevelColumn && (
                        <span
                            className="w-11 shrink-0 text-right text-xs font-bold tabular-nums"
                            style={{ fontSize: `${10 * mobileTextScale}px` }}
                        >
                            Lv.{finalLevel}
                        </span>
                    )}
                    <div className="relative h-3 min-w-0 flex-1 overflow-hidden rounded-full border border-gray-900/50 bg-gray-700/50">
                        <div
                            className="absolute left-0 top-0 z-[1] h-full rounded-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-[width] ease-out"
                            style={{ width: `${baseW}%`, transitionDuration: `${XP_BAR_BASE_MS}ms` }}
                        />
                        {gainPercent > 0 && (
                            <div
                                className="pointer-events-none absolute top-0 z-[2] h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-[width] ease-out"
                                style={{
                                    left: `${initialPercent}%`,
                                    width: `${gainW}%`,
                                    transitionDuration: `${XP_BAR_GAIN_MS}ms`,
                                }}
                            />
                        )}
                        {levelUp && (
                            <span
                                className="absolute inset-0 z-[11] flex items-center justify-center text-[8px] font-bold text-white animate-pulse"
                                style={{
                                    textShadow: '0 0 5px black',
                                    fontSize: `${8 * mobileTextScale}px`,
                                }}
                            >
                                LEVEL UP!
                            </span>
                        )}
                    </div>
                    {showGainText && xpGain > 0 && (
                        <span
                            key={gainTextKey}
                            className="shrink-0 text-xs font-bold tabular-nums text-green-400 whitespace-nowrap animate-fade-in-xp"
                            style={{ fontSize: `${10 * mobileTextScale}px` }}
                        >
                            +{xpGain} XP
                        </span>
                    )}
                </div>
                <div className="w-full min-w-0 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
                    <p
                        className="whitespace-nowrap text-center text-[9px] font-bold tabular-nums text-slate-600"
                        style={{ fontSize: `${8 * mobileTextScale}px` }}
                    >
                        {initial.toLocaleString()}{' '}
                        <span className="text-emerald-700">+{xpGain}</span> / {max.toLocaleString()} XP
                    </p>
                </div>
                <style>{`
                @keyframes fadeInXp {
                    from { opacity: 0; transform: scale(0.8); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in-xp {
                    animation: fadeInXp 0.5s ease-out forwards;
                }
            `}</style>
            </div>
        );
    }

    return (
        <div className={`flex items-center ${pcCompact ? 'gap-1.5 min-w-0 flex-1' : 'gap-2 min-[1024px]:gap-2.5'}`}>
            {!omitLevelColumn && (
             <span
                className={`${
                    pcCompact
                          ? 'w-11 shrink-0 text-xs tabular-nums'
                          : 'w-14 min-[1024px]:w-16 text-sm tabular-nums'
                } font-bold text-right`}
            >
                Lv.{finalLevel}
            </span>
            )}
            <div
                className={`relative w-full min-w-0 overflow-hidden rounded-full border border-gray-900/50 bg-gray-700/50 ${pcCompact ? 'h-3' : 'h-4 min-[1024px]:h-[18px]'}`}
            >
                <div
                    className="absolute left-0 top-0 z-[1] h-full rounded-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-[width] ease-out"
                    style={{ width: `${baseW}%`, transitionDuration: `${XP_BAR_BASE_MS}ms` }}
                />
                {gainPercent > 0 && (
                    <div
                        className="absolute top-0 z-[2] h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-[width] ease-out pointer-events-none"
                        style={{
                            left: `${initialPercent}%`,
                            width: `${gainW}%`,
                            transitionDuration: `${XP_BAR_GAIN_MS}ms`,
                        }}
                    />
                )}

                <span
                    className={`absolute inset-0 z-[10] flex items-center justify-center ${
                        pcCompact ? 'text-[10px]' : 'text-xs min-[1024px]:text-sm'
                    } font-bold text-black/80 drop-shadow-sm`}
                >
                   {initial} +{xpGain} / {max} XP
                </span>

                {levelUp && (
                    <span
                        className={`absolute inset-0 z-[11] flex items-center justify-center ${
                            pcCompact ? 'text-[10px]' : 'text-xs min-[1024px]:text-sm'
                        } font-bold text-white animate-pulse`}
                        style={{ textShadow: '0 0 5px black' }}
                    >
                        LEVEL UP!
                    </span>
                )}
            </div>
             {showGainText && xpGain > 0 && (
                <span
                    key={gainTextKey}
                    className={`${
                        pcCompact ? 'w-[3.5rem] shrink-0 text-xs' : 'w-[4.25rem] min-[1024px]:w-20 text-sm'
                    } font-bold text-green-400 whitespace-nowrap animate-fade-in-xp`}
                >
                    +{xpGain} XP
                </span>
             )}
             <style>{`
                @keyframes fadeInXp {
                    from { opacity: 0; transform: scale(0.8); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in-xp {
                    animation: fadeInXp 0.5s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

const ScoreDetailsComponent: React.FC<{ analysis: AnalysisResult, session: LiveGameSession, isMobile?: boolean, mobileTextScale?: number }> = ({ analysis, session, isMobile = false, mobileTextScale = 1 }) => {
    const { scoreDetails } = analysis;
    const { mode, settings } = session;
    const mx = RESULT_MODAL_SCORE_MOBILE_PX;

    if (!scoreDetails) return <p className={`text-center text-gray-400 ${isMobile ? 'text-sm' : ''}`} style={{ fontSize: isMobile ? `${mx.emptyState * mobileTextScale}px` : undefined }}>점수 정보가 없습니다.</p>;
    
    const isSpeedMode = mode === GameMode.Speed || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Speed));
    const isBaseMode = mode === GameMode.Base || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Base));
    const isHiddenMode = mode === GameMode.Hidden || (mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Hidden));
    /** 모바일: 프로필이 가로(2열)일 때 흑·백 점수 비교도 가로 2열로 맞춤 */
    const scoreGridTwoColsOnMobile = isMobile;

    const rowClass = `flex min-w-0 justify-between gap-2 ${isMobile ? 'text-sm' : 'text-xs min-[1024px]:text-[0.8125rem]'}`;
    const labelClass = 'shrink-0 whitespace-nowrap text-slate-400';
    const valClass = 'tabular-nums text-right font-medium text-slate-100';

    return (
        <div className={`space-y-1.5 sm:space-y-2 ${isMobile ? 'text-sm' : ''}`}>
            <div
                className={`grid min-w-0 gap-1.5 sm:gap-2 ${scoreGridTwoColsOnMobile ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}
            >
                <div className={`space-y-0.5 bg-gray-800/50 ${isMobile ? 'p-1.5' : 'px-2 py-1.5'} rounded-md`}>
                    <h3 className={`font-bold text-center mb-0.5 ${isMobile ? 'text-sm' : 'text-[0.7rem] min-[1024px]:text-xs'}`} style={{ fontSize: isMobile ? `${mx.columnHead * mobileTextScale}px` : undefined }}>흑</h3>
                    <div className={rowClass} style={{ fontSize: isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined }}><span className={labelClass}>영토</span> <span className={valClass}>{scoreDetails.black.territory.toFixed(0)}</span></div>
                    <div className={rowClass} style={{ fontSize: isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined }}><span className={labelClass}>따낸 돌</span> <span className={valClass}>{scoreDetails.black.liveCaptures ?? 0}</span></div>
                    <div className={rowClass} style={{ fontSize: isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined }}><span className={labelClass}>사석</span> <span className={valClass}>{Math.round(Number(scoreDetails.black.deadStones ?? 0))}</span></div>
                    {isBaseMode && <div className={`${rowClass} text-blue-300`} style={{ fontSize: isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined }}><span className={`${labelClass} text-blue-300/90`}>베이스</span> <span className="tabular-nums text-right font-medium">{scoreDetails.black.baseStoneBonus}</span></div>}
                    {isHiddenMode && <div className={`${rowClass} text-purple-300`} style={{ fontSize: isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined }}><span className={`${labelClass} text-purple-300/90`}>히든</span> <span className="tabular-nums text-right font-medium">{scoreDetails.black.hiddenStoneBonus}</span></div>}
                    {isSpeedMode && <div className={`${rowClass} text-green-300`} style={{ fontSize: isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined }}><span className={`${labelClass} text-green-300/90`}>시간</span> <span className="tabular-nums text-right font-medium">{Math.trunc(Number(scoreDetails.black.timeBonus ?? 0))}</span></div>}
                    <div className="flex min-w-0 justify-between gap-2 border-t border-gray-600 pt-1 mt-0.5 text-sm font-bold" style={{ fontSize: isMobile ? `${mx.totalRow * mobileTextScale}px` : undefined }}><span className="shrink-0 whitespace-nowrap">총점</span> <span className="tabular-nums text-yellow-300">{scoreDetails.black.total.toFixed(1)}</span></div>
                </div>
                <div className={`space-y-0.5 bg-gray-800/50 ${isMobile ? 'p-1.5' : 'px-2 py-1.5'} rounded-md`}>
                    <h3 className={`font-bold text-center mb-0.5 ${isMobile ? 'text-sm' : 'text-[0.7rem] min-[1024px]:text-xs'}`} style={{ fontSize: isMobile ? `${mx.columnHead * mobileTextScale}px` : undefined }}>백</h3>
                    <div className={rowClass} style={{ fontSize: isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined }}><span className={labelClass}>영토</span> <span className={valClass}>{scoreDetails.white.territory.toFixed(0)}</span></div>
                    <div className={rowClass} style={{ fontSize: isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined }}><span className={labelClass}>따낸 돌</span> <span className={valClass}>{scoreDetails.white.liveCaptures ?? 0}</span></div>
                    <div className={rowClass} style={{ fontSize: isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined }}><span className={labelClass}>사석</span> <span className={valClass}>{Math.round(Number(scoreDetails.white.deadStones ?? 0))}</span></div>
                    <div className={rowClass} style={{ fontSize: isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined }}><span className={labelClass}>덤</span> <span className={valClass}>{scoreDetails.white.komi}</span></div>
                    {isBaseMode && <div className={`${rowClass} text-blue-300`} style={{ fontSize: isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined }}><span className={`${labelClass} text-blue-300/90`}>베이스</span> <span className="tabular-nums text-right font-medium">{scoreDetails.white.baseStoneBonus}</span></div>}
                    {isHiddenMode && <div className={`${rowClass} text-purple-300`} style={{ fontSize: isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined }}><span className={`${labelClass} text-purple-300/90`}>히든</span> <span className="tabular-nums text-right font-medium">{scoreDetails.white.hiddenStoneBonus}</span></div>}
                    {isSpeedMode && <div className={`${rowClass} text-green-300`} style={{ fontSize: isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined }}><span className={`${labelClass} text-green-300/90`}>시간</span> <span className="tabular-nums text-right font-medium">{Math.trunc(Number(scoreDetails.white.timeBonus ?? 0))}</span></div>}
                    <div className="flex min-w-0 justify-between gap-2 border-t border-gray-600 pt-1 mt-0.5 text-sm font-bold" style={{ fontSize: isMobile ? `${mx.totalRow * mobileTextScale}px` : undefined }}><span className="shrink-0 whitespace-nowrap">총점</span> <span className="tabular-nums text-yellow-300">{scoreDetails.white.total.toFixed(1)}</span></div>
                </div>
            </div>
        </div>
    );
};

const PlayfulScoreDetailsComponent: React.FC<{ gameSession: LiveGameSession, isMobile?: boolean, mobileTextScale?: number }> = ({ gameSession, isMobile = false, mobileTextScale = 1 }) => {
    const mx = RESULT_MODAL_SCORE_MOBILE_PX;
    const { scores, player1, player2, diceGoBonuses } = gameSession;
    const p1Id = player1.id;
    const p2Id = player2.id;

    const p1TotalScore = scores[p1Id] || 0;
    const p2TotalScore = scores[p2Id] || 0;

    const p1Bonus = diceGoBonuses?.[p1Id] || 0;
    const p2Bonus = diceGoBonuses?.[p2Id] || 0;

    const p1CaptureScore = p1TotalScore - p1Bonus;
    const p2CaptureScore = p2TotalScore - p2Bonus;

    const hasBonus = p1Bonus > 0 || p2Bonus > 0;

    if (!hasBonus) {
        return (
            <div className="text-center">
                <p className={`text-gray-300 ${isMobile ? 'text-sm' : 'text-base lg:text-lg'}`} style={{ fontSize: isMobile ? `${mx.columnHead * mobileTextScale}px` : undefined }}>최종 점수</p>
                <p className={`${isMobile ? 'text-3xl' : 'text-5xl lg:text-6xl xl:text-7xl'} font-mono my-2`} style={{ fontSize: isMobile ? `${28 * mobileTextScale}px` : undefined }}>{p1TotalScore} : {p2TotalScore}</p>
            </div>
        );
    }
    
    return (
        <div className={`mx-auto w-full max-w-md space-y-2 sm:space-y-3 ${isMobile ? 'text-sm' : 'text-sm md:text-base lg:text-lg'}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div className={`space-y-0.5 sm:space-y-1 bg-gray-800/50 ${isMobile ? 'p-1.5' : 'p-2'} rounded-md`}>
                    <h3 className={`font-bold text-center mb-0.5 sm:mb-1 ${isMobile ? 'text-sm' : ''}`} style={{ fontSize: isMobile ? `${mx.columnHead * mobileTextScale}px` : undefined }}>{player1.nickname}</h3>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined }}><span>포획 점수:</span> <span>{p1CaptureScore}</span></div>
                    {p1Bonus > 0 && <div className="flex justify-between" style={{ fontSize: isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined }}><span>마지막 더미 보너스:</span> <span className="text-green-400">+{p1Bonus}</span></div>}
                    <div className={`flex justify-between border-t border-gray-600 pt-0.5 sm:pt-1 mt-0.5 sm:mt-1 font-bold ${isMobile ? 'text-sm' : 'text-base'}`} style={{ fontSize: isMobile ? `${mx.totalRow * mobileTextScale}px` : undefined }}>
                        <span>총점:</span> <span className="text-yellow-300">{p1TotalScore}</span>
                    </div>
                </div>
                <div className={`space-y-0.5 sm:space-y-1 bg-gray-800/50 ${isMobile ? 'p-1.5' : 'p-2'} rounded-md`}>
                    <h3 className={`font-bold text-center mb-0.5 sm:mb-1 ${isMobile ? 'text-sm' : ''}`} style={{ fontSize: isMobile ? `${mx.columnHead * mobileTextScale}px` : undefined }}>{player2.nickname}</h3>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined }}><span>포획 점수:</span> <span>{p2CaptureScore}</span></div>
                    {p2Bonus > 0 && <div className="flex justify-between" style={{ fontSize: isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined }}><span>마지막 더미 보너스:</span> <span className="text-green-400">+{p2Bonus}</span></div>}
                    <div className={`flex justify-between border-t border-gray-600 pt-0.5 sm:pt-1 mt-0.5 sm:mt-1 font-bold ${isMobile ? 'text-sm' : 'text-base'}`} style={{ fontSize: isMobile ? `${mx.totalRow * mobileTextScale}px` : undefined }}>
                        <span>총점:</span> <span className="text-yellow-300">{p2TotalScore}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CaptureScoreDetailsComponent: React.FC<{
    session: LiveGameSession;
    isMobile?: boolean;
    mobileTextScale?: number;
    /** 길드전 따내기: 획득 집점수(집) — 최종 스코어 블록 안에 표시 */
    guildWarHouseScore?: number;
}> = ({ session, isMobile = false, mobileTextScale = 1, guildWarHouseScore }) => {
    const mx = RESULT_MODAL_SCORE_MOBILE_PX;
    const { captures, blackPlayerId, whitePlayerId, player1, player2, winner } = session;
    const blackCaptures = captures[Player.Black] || 0;
    const whiteCaptures = captures[Player.White] || 0;
    
    const blackPlayer = blackPlayerId === player1.id ? player1 : player2;
    const whitePlayer = whitePlayerId === player1.id ? player1 : player2;
    
    const blackWon = winner === Player.Black;
    const whiteWon = winner === Player.White;
    
    return (
        <div className="text-center space-y-3 sm:space-y-4">
            <p
                className={`text-gray-300 mb-2 sm:mb-4 ${isMobile ? 'text-sm' : 'text-base'}`}
                style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}
            >
                최종 스코어
            </p>
                <div className="flex flex-wrap items-end justify-center gap-x-2 gap-y-1 sm:gap-x-4">
                <div className="flex flex-col items-center gap-0.5">
                    <span
                        className="font-bold uppercase tracking-wider text-stone-400 text-xs"
                        style={{ fontSize: isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined }}
                    >
                        흑
                    </span>
                    <span
                        className={`font-mono font-bold ${
                            isMobile ? 'text-3xl' : 'text-5xl lg:text-6xl xl:text-7xl'
                        } ${blackWon ? 'text-green-400' : 'text-white'}`}
                        style={{ fontSize: isMobile ? `${26 * mobileTextScale}px` : undefined }}
                    >
                        {blackCaptures}
                    </span>
                </div>
                <span
                    className={`${isMobile ? 'text-2xl' : 'text-4xl lg:text-5xl'} font-bold text-gray-400 pb-0.5 sm:pb-1`}
                    style={{ fontSize: isMobile ? `${22 * mobileTextScale}px` : undefined }}
                >
                    :
                </span>
                <div className="flex flex-col items-center gap-0.5">
                    <span
                        className="font-bold uppercase tracking-wider text-stone-400 text-xs"
                        style={{ fontSize: isMobile ? `${mx.dataRow * mobileTextScale}px` : undefined }}
                    >
                        백
                    </span>
                    <span
                        className={`font-mono font-bold ${
                            isMobile ? 'text-3xl' : 'text-5xl lg:text-6xl xl:text-7xl'
                        } ${whiteWon ? 'text-green-400' : 'text-white'}`}
                        style={{ fontSize: isMobile ? `${26 * mobileTextScale}px` : undefined }}
                    >
                        {whiteCaptures}
                    </span>
                </div>
            </div>
            {typeof guildWarHouseScore === 'number' && !Number.isNaN(guildWarHouseScore) && (
                <p
                    className={`mt-1.5 text-center font-semibold text-cyan-200/95 tabular-nums ${isMobile ? 'text-sm' : 'text-base sm:text-lg'}`}
                    style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}
                >
                    획득 집점수{' '}
                    <span className="font-black text-cyan-100/95">
                        {Number.isInteger(guildWarHouseScore) ? guildWarHouseScore : guildWarHouseScore.toFixed(1)}집
                    </span>
                </p>
            )}
            {blackWon && (
                <p
                    className={`${isMobile ? 'text-base' : 'text-xl'} font-bold text-green-400`}
                    style={{ fontSize: isMobile ? `${14 * mobileTextScale}px` : undefined }}
                >
                    {blackPlayer.nickname} 승리!
                </p>
            )}
            {whiteWon && (
                <p
                    className={`${isMobile ? 'text-base' : 'text-xl'} font-bold text-green-400`}
                    style={{ fontSize: isMobile ? `${14 * mobileTextScale}px` : undefined }}
                >
                    {whitePlayer.nickname} 승리!
                </p>
            )}
        </div>
    );
};

const CurlingScoreDetailsComponent: React.FC<{ gameSession: LiveGameSession, isMobile?: boolean, mobileTextScale?: number, mobileImageScale?: number }> = ({
    gameSession,
    isMobile = false,
    mobileTextScale = 1,
    mobileImageScale: _mobileImageScale = 1,
}) => {
    const mx = RESULT_MODAL_SCORE_MOBILE_PX;
    const { curlingScores, player1, player2, blackPlayerId, whitePlayerId } = gameSession;
    if (!curlingScores) return <p className={`text-center text-gray-400 ${isMobile ? 'text-sm' : ''}`} style={{ fontSize: isMobile ? `${mx.emptyState * mobileTextScale}px` : undefined }}>점수 정보가 없습니다.</p>;

    const blackPlayer = blackPlayerId === player1.id ? player1 : player2;
    const whitePlayer = whitePlayerId === player1.id ? player1 : player2;
    
    const blackScore = curlingScores[Player.Black] || 0;
    const whiteScore = curlingScores[Player.White] || 0;

    // 라운드별 점수 히스토리 가져오기
    const roundHistory = (gameSession as any).curlingRoundHistory || [];
    const totalRounds = gameSession.settings?.curlingRounds || 3;
    const roundNums = Array.from({ length: totalRounds }, (_, i) => i + 1);

    /** 상단 MatchPlayersRoster와 중복되지 않도록 아바타 없이 누적 점수만 고급스럽게 표시 */
    const curlingScoreStrip = (
        <div
            className={`relative mx-auto w-full overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#12151f] via-[#0b0e14] to-[#06080c] shadow-[0_12px_40px_-18px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-inset ring-amber-400/12 ${isMobile ? 'max-w-md px-3 py-3' : 'max-w-lg px-5 py-4'}`}
        >
            <div
                className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent"
                aria-hidden
            />
            <div className="pointer-events-none absolute -left-16 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-cyan-500/[0.06] blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -right-16 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-amber-400/[0.07] blur-3xl" aria-hidden />
            <div className={`relative flex items-stretch justify-between gap-2 ${isMobile ? 'min-h-[4.25rem]' : 'min-h-[5rem]'}`}>
                <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-center">
                    <span
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-stone-600/60 bg-gradient-to-b from-zinc-800 to-black text-[11px] font-black text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-black/40 sm:h-9 sm:w-9"
                        aria-hidden
                    >
                        흑
                    </span>
                    <span className="max-w-full truncate px-0.5 text-[10px] font-medium text-slate-500 sm:text-xs" title={blackPlayer.nickname}>
                        {blackPlayer.nickname}
                    </span>
                </div>
                <div className="mx-1 flex w-px shrink-0 self-stretch bg-gradient-to-b from-transparent via-amber-500/25 to-transparent sm:mx-2" aria-hidden />
                <div
                    className={`flex shrink-0 items-center justify-center gap-1 font-mono tabular-nums tracking-tight ${isMobile ? 'text-[1.65rem] leading-none' : 'text-4xl sm:text-5xl'}`}
                    style={isMobile ? { fontSize: `${26 * mobileTextScale}px` } : undefined}
                >
                    <span className="bg-gradient-to-b from-white via-amber-50 to-amber-200/90 bg-clip-text font-black text-transparent drop-shadow-[0_2px_18px_rgba(251,191,36,0.22)]">
                        {blackScore}
                    </span>
                    <span className="px-1 text-lg font-extralight text-slate-600 sm:text-2xl" aria-hidden>
                        :
                    </span>
                    <span className="bg-gradient-to-b from-white via-amber-50 to-amber-200/90 bg-clip-text font-black text-transparent drop-shadow-[0_2px_18px_rgba(251,191,36,0.22)]">
                        {whiteScore}
                    </span>
                </div>
                <div className="mx-1 flex w-px shrink-0 self-stretch bg-gradient-to-b from-transparent via-amber-500/25 to-transparent sm:mx-2" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-center">
                    <span
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-400/55 bg-gradient-to-b from-slate-100 to-slate-300 text-[11px] font-black text-slate-900 shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)] ring-1 ring-white/30 sm:h-9 sm:w-9"
                        aria-hidden
                    >
                        백
                    </span>
                    <span className="max-w-full truncate px-0.5 text-[10px] font-medium text-slate-500 sm:text-xs" title={whitePlayer.nickname}>
                        {whitePlayer.nickname}
                    </span>
                </div>
            </div>
            <p className="relative mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/40">누적 점수</p>
        </div>
    );

    if (isMobile) {
        return (
            <div className="mx-auto w-full max-w-md space-y-3 text-left sm:space-y-4">
                <div className="text-center">{curlingScoreStrip}</div>
                <p className="text-center text-sm font-bold text-amber-200/95" style={{ fontSize: `${13 * mobileTextScale}px` }}>
                    라운드별 점수
                </p>
                <div className="flex flex-col gap-2">
                    {roundNums.map((roundNum) => {
                        const roundData = roundHistory.find((r: any) => r.round === roundNum);
                        const blackHouse = roundData ? roundData.black.houseScore : 0;
                        const blackKnockout = roundData ? roundData.black.knockoutScore : 0;
                        const blackPreviousKnockout = roundData?.black?.previousKnockoutScore ?? 0;
                        const whiteHouse = roundData ? roundData.white.houseScore : 0;
                        const whiteKnockout = roundData ? roundData.white.knockoutScore : 0;
                        const whitePreviousKnockout = roundData?.white?.previousKnockoutScore ?? 0;
                        return (
                            <div
                                key={roundNum}
                                className="rounded-xl border border-slate-600/45 bg-slate-900/88 px-3 py-2.5 ring-1 ring-inset ring-white/[0.05]"
                            >
                                <div className="mb-2 text-center text-xs font-bold text-slate-200" style={{ fontSize: `${12 * mobileTextScale}px` }}>
                                    {roundNum}라운드
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="min-w-0 rounded-lg border border-stone-600/35 bg-black/25 px-2 py-2">
                                        <p className="text-[11px] font-bold tracking-wide text-stone-200">흑</p>
                                        <p className="mt-1 text-xs text-slate-200" style={{ fontSize: `${12 * mobileTextScale}px` }}>
                                            하우스 <span className="font-mono font-bold tabular-nums">{blackHouse}</span>
                                        </p>
                                        <p className="text-xs text-slate-200" style={{ fontSize: `${12 * mobileTextScale}px` }}>
                                            넉아웃 <span className="font-mono font-bold tabular-nums">{blackKnockout}</span>
                                            {blackPreviousKnockout > 0 && (
                                                <span className="block text-[10px] text-slate-500">(이전 {blackPreviousKnockout})</span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="min-w-0 rounded-lg border border-slate-500/35 bg-slate-950/50 px-2 py-2">
                                        <p className="text-[11px] font-bold tracking-wide text-slate-100">백</p>
                                        <p className="mt-1 text-xs text-slate-200" style={{ fontSize: `${12 * mobileTextScale}px` }}>
                                            하우스 <span className="font-mono font-bold tabular-nums">{whiteHouse}</span>
                                        </p>
                                        <p className="text-xs text-slate-200" style={{ fontSize: `${12 * mobileTextScale}px` }}>
                                            넉아웃 <span className="font-mono font-bold tabular-nums">{whiteKnockout}</span>
                                            {whitePreviousKnockout > 0 && (
                                                <span className="block text-[10px] text-slate-500">(이전 {whitePreviousKnockout})</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="rounded-xl border-2 border-amber-500/35 bg-slate-900/90 px-3 py-2 text-center text-sm font-bold tabular-nums text-amber-100">
                    합계 흑 {blackScore} · 백 {whiteScore}
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-lg space-y-3 text-center sm:space-y-4">
            {curlingScoreStrip}

            {/* 상세 점수 내역 표 */}
            <div className="mt-1 rounded-xl border border-slate-600/40 bg-slate-950/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-inset ring-white/[0.04] sm:p-4">
                <h3 className="mb-2.5 text-center text-sm font-bold tracking-wide text-amber-100/90 sm:text-base">상세 점수 내역</h3>
                <div className="overflow-x-auto text-xs lg:text-sm">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b-2 border-gray-600">
                                <th className={`text-left ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-800/50`}>라운드</th>
                                <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/50 border-l-2 border-gray-600`} colSpan={2}>
                                    흑
                                </th>
                                <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/50 border-l-2 border-gray-600`} colSpan={2}>
                                    백
                                </th>
                            </tr>
                            <tr className="border-b border-gray-600">
                                <th className={`text-left ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-800/50`}></th>
                                <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} text-gray-400 bg-gray-700/30 border-l-2 border-gray-600`}>하우스</th>
                                <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} text-gray-400 bg-gray-700/30`}>넉아웃</th>
                                <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} text-gray-400 bg-gray-700/30 border-l-2 border-gray-600`}>하우스</th>
                                <th className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} text-gray-400 bg-gray-700/30`}>넉아웃</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: totalRounds }, (_, i) => i + 1).map(roundNum => {
                                const roundData = roundHistory.find((r: any) => r.round === roundNum);
                                const blackHouse = roundData ? roundData.black.houseScore : 0;
                                const blackKnockout = roundData ? roundData.black.knockoutScore : 0;
                                const blackPreviousKnockout = roundData?.black?.previousKnockoutScore ?? 0;
                                const blackTotal = roundData ? roundData.black.total : 0;
                                const whiteHouse = roundData ? roundData.white.houseScore : 0;
                                const whiteKnockout = roundData ? roundData.white.knockoutScore : 0;
                                const whitePreviousKnockout = roundData?.white?.previousKnockoutScore ?? 0;
                                const whiteTotal = roundData ? roundData.white.total : 0;
                                
                                return (
                                    <tr key={roundNum} className="border-b border-gray-700/50">
                                        <td className={`font-semibold ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-800/30`}>{roundNum}라운드</td>
                                        <td className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/20 border-l-2 border-gray-600`}>{blackHouse}</td>
                                        <td className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/20`}>
                                            <div className="flex flex-col items-center">
                                                <span className="font-semibold">{blackKnockout}</span>
                                                {blackPreviousKnockout > 0 && (
                                                    <span className={`text-gray-400 ${isMobile ? 'text-xs' : 'text-[9px]'}`} style={{ fontSize: isMobile ? `${mx.emptyState * mobileTextScale}px` : undefined }}>
                                                        (이전: {blackPreviousKnockout})
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/20 border-l-2 border-gray-600`}>{whiteHouse}</td>
                                        <td className={`text-center ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/20`}>
                                            <div className="flex flex-col items-center">
                                                <span className="font-semibold">{whiteKnockout}</span>
                                                {whitePreviousKnockout > 0 && (
                                                    <span className={`text-gray-400 ${isMobile ? 'text-xs' : 'text-[9px]'}`} style={{ fontSize: isMobile ? `${mx.emptyState * mobileTextScale}px` : undefined }}>
                                                        (이전: {whitePreviousKnockout})
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr className="border-t-2 border-gray-500 font-bold">
                                <td className={`${isMobile ? 'p-1.5' : 'p-2'} bg-gray-800/50`}>합계</td>
                                <td className={`text-center text-yellow-300 ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/30 border-l-2 border-gray-600`} colSpan={2}>{blackScore}</td>
                                <td className={`text-center text-yellow-300 ${isMobile ? 'p-1.5' : 'p-2'} bg-gray-700/30 border-l-2 border-gray-600`} colSpan={2}>{whiteScore}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const AlkkagiScoreDetailsComponent: React.FC<{ gameSession: LiveGameSession; isMobile?: boolean; mobileTextScale?: number }> = ({ gameSession, isMobile = false, mobileTextScale = 1 }) => {
    const { player1, player2, blackPlayerId, whitePlayerId, winner, alkkagiRoundHistory, settings } = gameSession;
    const blackPlayer = blackPlayerId === player1.id ? player1 : player2;
    const whitePlayer = whitePlayerId === player1.id ? player1 : player2;
    const totalRounds = settings?.alkkagiRounds || 1;
    const history: AlkkagiRoundHistoryEntry[] = alkkagiRoundHistory || [];
    const blackWins = history.filter((r: AlkkagiRoundHistoryEntry) => r.winnerId === blackPlayerId).length;
    const whiteWins = history.filter((r: AlkkagiRoundHistoryEntry) => r.winnerId === whitePlayerId).length;
    const roundNums = Array.from({ length: totalRounds }, (_, i) => i + 1);

    if (isMobile) {
        const nickLine = (nickname: string, stone: string, light: 'stone' | 'slate') => (
            <div
                className="max-w-full overflow-x-auto overflow-y-hidden whitespace-nowrap [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
                title={`${nickname} (${stone})`}
            >
                <span
                    className={`inline font-semibold ${light === 'stone' ? 'text-stone-200' : 'text-slate-100'}`}
                    style={{ fontSize: `${10 * mobileTextScale}px` }}
                >
                    {nickname}
                </span>
                <span className={`inline font-normal ${light === 'stone' ? 'text-stone-500' : 'text-slate-500'}`} style={{ fontSize: `${10 * mobileTextScale}px` }}>
                    {' '}
                    {stone}
                </span>
            </div>
        );
        return (
            <div className="mx-auto w-full max-w-md space-y-1.5 text-left">
                <p
                    className="text-center text-xs font-bold leading-none text-amber-200/95"
                    style={{ fontSize: `${12 * mobileTextScale}px` }}
                >
                    라운드별 결과
                </p>
                <div className="flex flex-col gap-1.5">
                    {roundNums.map((roundNum) => {
                        const roundData = history.find((r: AlkkagiRoundHistoryEntry) => r.round === roundNum);
                        const blackWin = roundData ? roundData.winnerId === blackPlayerId : false;
                        const whiteWin = roundData ? roundData.winnerId === whitePlayerId : false;
                        const blackKnockout = roundData?.blackKnockout ?? 0;
                        const whiteKnockout = roundData?.whiteKnockout ?? 0;
                        return (
                            <div
                                key={roundNum}
                                className="rounded-lg border border-slate-600/45 bg-slate-900/88 px-2 py-1.5 shadow-inner ring-1 ring-inset ring-white/[0.05]"
                            >
                                <div
                                    className="mb-1 text-center text-[11px] font-bold leading-none text-slate-200"
                                    style={{ fontSize: `${11 * mobileTextScale}px` }}
                                >
                                    라운드 {roundNum}
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                    <div className="min-w-0 rounded-md border border-stone-600/35 bg-black/25 px-1.5 py-1">
                                        {nickLine(blackPlayer.nickname, '흑', 'stone')}
                                        <p
                                            className="mt-1 flex min-w-0 items-baseline justify-between gap-1 text-[9px] font-medium leading-none text-slate-200"
                                            style={{ fontSize: `${9 * mobileTextScale}px` }}
                                        >
                                            <span className="shrink-0 text-slate-400">넉아웃</span>
                                            <span className="font-mono font-bold tabular-nums text-amber-100">{blackKnockout}</span>
                                        </p>
                                        <p
                                            className="mt-0.5 flex min-w-0 items-baseline justify-between gap-1 text-[9px] font-medium leading-none text-slate-200"
                                            style={{ fontSize: `${9 * mobileTextScale}px` }}
                                        >
                                            <span className="shrink-0 text-slate-400">라운드</span>
                                            <span className="font-mono font-bold tabular-nums text-amber-200">{blackWin ? 1 : 0}</span>
                                        </p>
                                    </div>
                                    <div className="min-w-0 rounded-md border border-slate-500/35 bg-slate-950/50 px-1.5 py-1">
                                        {nickLine(whitePlayer.nickname, '백', 'slate')}
                                        <p
                                            className="mt-1 flex min-w-0 items-baseline justify-between gap-1 text-[9px] font-medium leading-none text-slate-200"
                                            style={{ fontSize: `${9 * mobileTextScale}px` }}
                                        >
                                            <span className="shrink-0 text-slate-400">넉아웃</span>
                                            <span className="font-mono font-bold tabular-nums text-amber-100">{whiteKnockout}</span>
                                        </p>
                                        <p
                                            className="mt-0.5 flex min-w-0 items-baseline justify-between gap-1 text-[9px] font-medium leading-none text-slate-200"
                                            style={{ fontSize: `${9 * mobileTextScale}px` }}
                                        >
                                            <span className="shrink-0 text-slate-400">라운드</span>
                                            <span className="font-mono font-bold tabular-nums text-amber-200">{whiteWin ? 1 : 0}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="rounded-lg border-2 border-amber-500/40 bg-gradient-to-b from-amber-950/30 to-slate-950/90 px-2 py-2 text-center">
                    <p className="text-[11px] font-semibold leading-none text-slate-400" style={{ fontSize: `${10 * mobileTextScale}px` }}>
                        최종 세트 전적
                    </p>
                    <p
                        className="mt-1 text-sm font-bold tabular-nums leading-none text-amber-100"
                        style={{ fontSize: `${13 * mobileTextScale}px` }}
                    >
                        흑 {blackWins}승 · 백 {whiteWins}승
                    </p>
                    {winner !== null && winner !== Player.None && (
                        <div
                            className="mt-1.5 min-w-0 px-0.5 text-center text-[11px] font-bold leading-tight text-green-400"
                            style={{ fontSize: `${11 * mobileTextScale}px` }}
                        >
                            <div
                                className="mx-auto max-w-full overflow-x-auto overflow-y-hidden whitespace-nowrap [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
                                title={`${winner === Player.Black ? blackPlayer.nickname : whitePlayer.nickname} 최종 승리`}
                            >
                                {winner === Player.Black ? blackPlayer.nickname : whitePlayer.nickname}
                            </div>
                            <span className="mt-0.5 block whitespace-nowrap text-[0.72em] font-semibold text-emerald-300/95">최종 승리</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-lg space-y-2 text-center sm:space-y-3">
            <div className={`overflow-x-auto text-xs lg:text-sm`}>
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b-2 border-gray-600">
                            <th className={`text-center p-2 bg-gray-800/50`}>라운드</th>
                            <th className={`text-center p-2 bg-gray-700/50 border-l-2 border-gray-600`} colSpan={3}>{blackPlayer.nickname} (흑)</th>
                            <th className={`text-center p-2 bg-gray-700/50 border-l-2 border-gray-600`} colSpan={3}>{whitePlayer.nickname} (백)</th>
                        </tr>
                        <tr className="border-b border-gray-600">
                            <th className={`text-center p-2 bg-gray-800/50`}></th>
                            <th className={`text-center p-2 text-gray-400 bg-gray-700/30 border-l-2 border-gray-600`}>공격성공</th>
                            <th className={`text-center p-2 text-gray-400 bg-gray-700/30`}>넉아웃</th>
                            <th className={`text-center p-2 text-gray-400 bg-gray-700/30`}>점수</th>
                            <th className={`text-center p-2 text-gray-400 bg-gray-700/30 border-l-2 border-gray-600`}>공격성공</th>
                            <th className={`text-center p-2 text-gray-400 bg-gray-700/30`}>넉아웃</th>
                            <th className={`text-center p-2 text-gray-400 bg-gray-700/30`}>점수</th>
                        </tr>
                    </thead>
                    <tbody>
                        {roundNums.map(roundNum => {
                            const roundData = history.find((r: AlkkagiRoundHistoryEntry) => r.round === roundNum);
                            const blackWin = roundData ? roundData.winnerId === blackPlayerId : false;
                            const whiteWin = roundData ? roundData.winnerId === whitePlayerId : false;
                            const blackKnockout = roundData?.blackKnockout ?? 0;
                            const whiteKnockout = roundData?.whiteKnockout ?? 0;
                            return (
                                <tr key={roundNum} className="border-b border-gray-700/50">
                                    <td className={`text-center font-semibold p-2 bg-gray-800/30`}>{roundNum}R</td>
                                    <td className={`text-center p-2 bg-gray-700/20 border-l-2 border-gray-600 text-gray-500`}>-</td>
                                    <td className={`text-center p-2 bg-gray-700/20`}>{blackKnockout}</td>
                                    <td className={`text-center p-2 bg-gray-700/20`}>{blackWin ? 1 : 0}</td>
                                    <td className={`text-center p-2 bg-gray-700/20 border-l-2 border-gray-600 text-gray-500`}>-</td>
                                    <td className={`text-center p-2 bg-gray-700/20`}>{whiteKnockout}</td>
                                    <td className={`text-center p-2 bg-gray-700/20`}>{whiteWin ? 1 : 0}</td>
                                </tr>
                            );
                        })}
                        <tr className="border-t-2 border-gray-500 font-bold">
                            <td className={`text-center p-2 bg-gray-800/50`}>최종</td>
                            <td className={`text-center p-2 bg-gray-700/30 border-l-2 border-gray-600 text-gray-500`} colSpan={2}>-</td>
                            <td className={`text-center text-yellow-300 p-2 bg-gray-700/30`}>{blackWins}승</td>
                            <td className={`text-center p-2 bg-gray-700/30 border-l-2 border-gray-600 text-gray-500`} colSpan={2}>-</td>
                            <td className={`text-center text-yellow-300 p-2 bg-gray-700/30`}>{whiteWins}승</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            {winner !== null && winner !== Player.None && (
                <p className={`text-base font-bold text-green-400`}>
                    {winner === Player.Black ? blackPlayer.nickname : whitePlayer.nickname} 승리!
                </p>
            )}
        </div>
    );
};

function normalizeRewardImagePath(src: string | undefined | null): string | null {
    if (!src) return null;
    return src.startsWith('/') ? src : `/${src}`;
}

/** 경기 내용 상단: 흑·백 대국자 프로필, 닉네임, 모드별 레벨 — 모험은 AI 측에 출현 몬스터 도감 표시 */
const MatchPlayersRoster: React.FC<{
    blackPlayer: User;
    whitePlayer: User;
    isPlayful: boolean;
    isMobile: boolean;
    mobileTextScale: number;
    mobileImageScale: number;
    mobileCompactRoster?: boolean;
    session?: LiveGameSession;
}> = ({
    blackPlayer,
    whitePlayer,
    isPlayful,
    isMobile,
    mobileTextScale,
    mobileImageScale,
    mobileCompactRoster = false,
    session,
}) => {
    const mx = RESULT_MODAL_SCORE_MOBILE_PX;
    const adventureMonster = useMemo(() => {
        if (!session || session.gameCategory !== 'adventure' || !session.adventureMonsterCodexId) return null;
        const e = getAdventureCodexMonsterById(session.adventureMonsterCodexId);
        if (!e) return null;
        return { imageWebp: e.imageWebp, name: e.name, level: Math.max(1, session.adventureMonsterLevel ?? 1) };
    }, [session]);
    const monsterPortrait = useResilientImgSrc(adventureMonster?.imageWebp);

    const blackAvatarUrl = AVATAR_POOL.find((a: AvatarInfo) => a.id === blackPlayer.avatarId)?.url;
    const blackBorderUrl = BORDER_POOL.find((b: BorderInfo) => b.id === blackPlayer.borderId)?.url;
    const whiteAvatarUrl = AVATAR_POOL.find((a: AvatarInfo) => a.id === whitePlayer.avatarId)?.url;
    const whiteBorderUrl = BORDER_POOL.find((b: BorderInfo) => b.id === whitePlayer.borderId)?.url;
    const blackLv = isPlayful ? blackPlayer.playfulLevel : blackPlayer.strategyLevel;
    const whiteLv = isPlayful ? whitePlayer.playfulLevel : whitePlayer.strategyLevel;
    const modeTag = isPlayful ? '놀이' : '전략';
    const avatarPx = isMobile ? Math.round(44 * mobileImageScale) : 52;
    const avatarPxAlk = isMobile ? Math.round(34 * mobileImageScale) : 52;

    const blackIsMonster = !!(adventureMonster && blackPlayer.id === aiUserId);
    const whiteIsMonster = !!(adventureMonster && whitePlayer.id === aiUserId);

    const blackMonsterFrame = isPlayful
        ? 'border-sky-400/45 bg-gradient-to-br from-sky-800/50 via-violet-950/88 to-black/85 ring-1 ring-inset ring-sky-400/22'
        : 'border-emerald-400/45 bg-gradient-to-br from-emerald-800/50 via-emerald-950/88 to-black/85 ring-1 ring-inset ring-emerald-400/22';
    const whiteMonsterFrame = isPlayful
        ? 'border-indigo-400/40 bg-gradient-to-br from-indigo-900/48 via-violet-900/65 to-black/85 ring-1 ring-inset ring-indigo-400/18'
        : 'border-teal-400/38 bg-gradient-to-br from-teal-900/48 via-slate-900/82 to-black/85 ring-1 ring-inset ring-teal-400/18';

    if (mobileCompactRoster) {
        const nickRowHuman = (nickname: string, stone: '흑' | '백', lv: number) => (
            <div className="min-w-0 max-w-full">
                <div
                    className="max-w-full overflow-x-auto overflow-y-hidden whitespace-nowrap [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
                    title={nickname}
                >
                    <span className="inline-block min-w-0 pr-1 text-sm font-bold leading-none text-white" style={{ fontSize: `${mx.columnHead * mobileTextScale}px` }}>
                        {nickname}
                    </span>
                </div>
                <span className="mt-0.5 inline-block text-xs font-semibold text-slate-500 whitespace-nowrap" style={{ fontSize: `${mx.emptyState * mobileTextScale}px` }}>
                    {stone} · {modeTag} Lv.{lv}
                </span>
            </div>
        );
        const nickRowMonster = (stone: '흑' | '백') =>
            adventureMonster ? (
                <div className="min-w-0 max-w-full">
                    <div
                        className="max-w-full overflow-x-auto overflow-y-hidden whitespace-nowrap [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
                        title={adventureMonster.name}
                    >
                        <span className="inline-block min-w-0 pr-1 text-sm font-bold leading-none text-white" style={{ fontSize: `${mx.columnHead * mobileTextScale}px` }}>
                            {adventureMonster.name}
                        </span>
                    </div>
                    <span className="mt-0.5 inline-block text-xs font-semibold text-slate-500 whitespace-nowrap" style={{ fontSize: `${mx.emptyState * mobileTextScale}px` }}>
                        {stone} · Lv.{adventureMonster.level}
                    </span>
                </div>
            ) : null;

        return (
            <div className="mb-1.5 grid w-full grid-cols-2 gap-1.5">
                <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-stone-600/40 bg-black/35 px-1.5 py-1.5 ring-1 ring-stone-500/10">
                    {blackIsMonster && adventureMonster ? (
                        <div
                            className={`shrink-0 overflow-hidden rounded-md ${blackMonsterFrame}`}
                            style={{ width: avatarPxAlk, height: avatarPxAlk }}
                        >
                            <img
                                src={monsterPortrait.src}
                                alt=""
                                className="h-full w-full object-contain"
                                draggable={false}
                                loading="eager"
                                decoding="async"
                                onError={monsterPortrait.onError}
                            />
                        </div>
                    ) : (
                        <Avatar
                            userId={blackPlayer.id}
                            userName={blackPlayer.nickname}
                            size={avatarPxAlk}
                            avatarUrl={blackAvatarUrl}
                            borderUrl={blackBorderUrl}
                        />
                    )}
                    {blackIsMonster && adventureMonster ? nickRowMonster('흑') : nickRowHuman(blackPlayer.nickname, '흑', blackLv)}
                </div>
                <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-slate-500/35 bg-slate-950/55 px-1.5 py-1.5 ring-1 ring-slate-400/12">
                    {whiteIsMonster && adventureMonster ? (
                        <div
                            className={`shrink-0 overflow-hidden rounded-md ${whiteMonsterFrame}`}
                            style={{ width: avatarPxAlk, height: avatarPxAlk }}
                        >
                            <img
                                src={monsterPortrait.src}
                                alt=""
                                className="h-full w-full object-contain"
                                draggable={false}
                                loading="eager"
                                decoding="async"
                                onError={monsterPortrait.onError}
                            />
                        </div>
                    ) : (
                        <Avatar
                            userId={whitePlayer.id}
                            userName={whitePlayer.nickname}
                            size={avatarPxAlk}
                            avatarUrl={whiteAvatarUrl}
                            borderUrl={whiteBorderUrl}
                        />
                    )}
                    {whiteIsMonster && adventureMonster ? nickRowMonster('백') : nickRowHuman(whitePlayer.nickname, '백', whiteLv)}
                </div>
            </div>
        );
    }

    return (
        <div className="mb-2 grid w-full grid-cols-2 gap-2 sm:gap-2.5">
            <div className="relative overflow-hidden rounded-xl border border-stone-600/35 bg-gradient-to-br from-zinc-950 via-[#141016] to-black p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_14px_44px_-22px_rgba(0,0,0,0.85)] ring-1 ring-stone-500/15">
                <div className="pointer-events-none absolute -right-8 -top-10 h-20 w-20 rounded-full bg-stone-400/[0.06] blur-2xl" aria-hidden />
                <div className="relative flex items-center gap-2.5">
                    {blackIsMonster && adventureMonster ? (
                        <div
                            className={`shrink-0 overflow-hidden rounded-lg ${blackMonsterFrame}`}
                            style={{ width: avatarPx, height: avatarPx }}
                        >
                            <img
                                src={monsterPortrait.src}
                                alt=""
                                className="h-full w-full object-contain"
                                draggable={false}
                                loading="eager"
                                decoding="async"
                                onError={monsterPortrait.onError}
                            />
                        </div>
                    ) : (
                        <Avatar
                            userId={blackPlayer.id}
                            userName={blackPlayer.nickname}
                            size={avatarPx}
                            avatarUrl={blackAvatarUrl}
                            borderUrl={blackBorderUrl}
                        />
                    )}
                    <div className="min-w-0 flex-1">
                        <span className="inline-flex rounded-md border border-stone-500/45 bg-black/50 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-stone-200/90">
                            흑
                        </span>
                        <p
                            className={`mt-1 min-w-0 font-bold leading-snug text-white ${isMobile ? 'truncate' : 'break-words'} ${!isMobile ? 'text-sm min-[1024px]:text-base' : ''}`}
                            style={{
                                fontSize: isMobile ? `${mx.columnHead * mobileTextScale}px` : undefined,
                                wordBreak: isMobile ? undefined : 'break-word',
                            }}
                            title={blackIsMonster && adventureMonster ? adventureMonster.name : blackPlayer.nickname}
                        >
                            {blackIsMonster && adventureMonster ? adventureMonster.name : blackPlayer.nickname}
                        </p>
                        <p
                            className={`font-medium text-stone-400 ${!isMobile ? 'text-sm lg:text-base' : 'text-sm'}`}
                            style={{ fontSize: isMobile ? `${mx.emptyState * mobileTextScale}px` : undefined }}
                        >
                            {blackIsMonster && adventureMonster ? `Lv.${adventureMonster.level}` : `${modeTag} Lv.${blackLv}`}
                        </p>
                    </div>
                </div>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-slate-400/25 bg-gradient-to-br from-slate-900/98 via-[#17161f] to-[#0b0a10] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_14px_44px_-22px_rgba(148,163,184,0.12)] ring-1 ring-slate-400/18">
                <div className="pointer-events-none absolute -left-6 -bottom-8 h-20 w-20 rounded-full bg-slate-300/[0.07] blur-2xl" aria-hidden />
                <div className="relative flex items-center gap-2.5">
                    {whiteIsMonster && adventureMonster ? (
                        <div
                            className={`shrink-0 overflow-hidden rounded-lg ${whiteMonsterFrame}`}
                            style={{ width: avatarPx, height: avatarPx }}
                        >
                            <img
                                src={monsterPortrait.src}
                                alt=""
                                className="h-full w-full object-contain"
                                draggable={false}
                                loading="eager"
                                decoding="async"
                                onError={monsterPortrait.onError}
                            />
                        </div>
                    ) : (
                        <Avatar
                            userId={whitePlayer.id}
                            userName={whitePlayer.nickname}
                            size={avatarPx}
                            avatarUrl={whiteAvatarUrl}
                            borderUrl={whiteBorderUrl}
                        />
                    )}
                    <div className="min-w-0 flex-1">
                        <span className="inline-flex rounded-md border border-slate-400/40 bg-white/[0.06] px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-slate-100/95">
                            백
                        </span>
                        <p
                            className={`mt-1 min-w-0 font-bold leading-snug text-white ${isMobile ? 'truncate' : 'break-words'} ${!isMobile ? 'text-sm min-[1024px]:text-base' : ''}`}
                            style={{
                                fontSize: isMobile ? `${mx.columnHead * mobileTextScale}px` : undefined,
                                wordBreak: isMobile ? undefined : 'break-word',
                            }}
                            title={whiteIsMonster && adventureMonster ? adventureMonster.name : whitePlayer.nickname}
                        >
                            {whiteIsMonster && adventureMonster ? adventureMonster.name : whitePlayer.nickname}
                        </p>
                        <p
                            className={`font-medium text-slate-300/90 ${!isMobile ? 'text-sm lg:text-base' : 'text-sm'}`}
                            style={{ fontSize: isMobile ? `${mx.emptyState * mobileTextScale}px` : undefined }}
                        >
                            {whiteIsMonster && adventureMonster ? `Lv.${adventureMonster.level}` : `${modeTag} Lv.${whiteLv}`}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const GameSummaryModal: React.FC<GameSummaryModalProps> = ({
    session,
    currentUser,
    onConfirm,
    onLeaveToAdventureMap,
    onAction,
    onOpenGameRecordList,
    isSpectator = false,
}) => {
    const { winner, player1, player2, blackPlayerId, whitePlayerId, winReason } = session;
    const soundPlayed = useRef(false);
    const isCompactViewport = useIsHandheldDevice(1025);
    const { isNativeMobile } = useNativeMobileShell();
    /** 좁은 뷰포트·네이티브 앱에서만 컴팩트 타이포(한 화면 우선). PC·캔버스 넓은 창은 큰 글자 유지 */
    const isMobile = isCompactViewport || isNativeMobile;
    const { modalLayerUsesDesignPixels, handlers } = useAppContext();
    /** 보드 프레임(설계 픽셀) 안에서는 결과 보상 슬롯도 컴팩트로 눌러 상하 잘림을 방지 */
    const useCompactRewardSlots = isMobile || modalLayerUsesDesignPixels;
    /** DraggableWindow `mobileViewportFit` 본문 스크롤 시: 루트를 뷰 높이에 늘리지 않고 콘텐츠만큼 키워 하단 버튼·푸터가 잘리지 않게 함 */
    const useBodyScrollSizing = modalLayerUsesDesignPixels || isMobile;

    const isWinner = getIsWinner(session, currentUser);
    const mySummary = session.summary?.[currentUser.id];
    const isAdventureGame = session.gameCategory === 'adventure';
    const sessionShowsVipPlayRewardSlot = useMemo(() => {
        if (isSpectator) return false;
        const cat = session.gameCategory as string | undefined;
        if (cat === 'guildwar') return true;
        if (session.isSinglePlayer || cat === 'tower' || cat === 'singleplayer') return false;
        if (cat === 'adventure') return true;
        return SPECIAL_GAME_MODES.some((m) => m.mode === session.mode) || PLAYFUL_GAME_MODES.some((m) => m.mode === session.mode);
    }, [isSpectator, session.gameCategory, session.isSinglePlayer, session.mode]);

    const vipSlotEffective = useMemo(() => {
        if (!sessionShowsVipPlayRewardSlot) return undefined;
        return (
            mySummary?.vipPlayRewardSlot ?? {
                locked: !isRewardVipActive(currentUser),
            }
        );
    }, [sessionShowsVipPlayRewardSlot, mySummary?.vipPlayRewardSlot, currentUser]);
    const vipRewardPreviewImage = useMemo(() => {
        const raw = VIP_PLAY_REWARD_SLOT_PREVIEW_IMAGE;
        return raw.startsWith('/') ? raw : `/${raw}`;
    }, []);
    const [vipUnlockRouletteActive, setVipUnlockRouletteActive] = useState(false);
    const [vipUnlockGranted, setVipUnlockGranted] = useState(false);
    const prevVipLockedRef = useRef<boolean | null>(null);

    useEffect(() => {
        setVipUnlockRouletteActive(false);
        setVipUnlockGranted(false);
        prevVipLockedRef.current = null;
    }, [session.id]);

    useEffect(() => {
        const lockedNow = vipSlotEffective?.locked;
        if (lockedNow == null) {
            prevVipLockedRef.current = null;
            return;
        }
        const prev = prevVipLockedRef.current;
        const unlockedJustNow =
            prev === true &&
            lockedNow === false &&
            !mySummary?.vipPlayRewardSlot?.grantedItem;
        if (unlockedJustNow) {
            setVipUnlockGranted(true);
            setVipUnlockRouletteActive(true);
            const t = setTimeout(() => setVipUnlockRouletteActive(false), 1400);
            prevVipLockedRef.current = lockedNow;
            return () => clearTimeout(t);
        }
        prevVipLockedRef.current = lockedNow;
    }, [vipSlotEffective?.locked, mySummary?.vipPlayRewardSlot?.grantedItem]);

    const vipSlotForRender = useMemo(() => {
        if (!vipSlotEffective) return undefined;
        if (vipSlotEffective.locked) return vipSlotEffective;
        if (vipSlotEffective.grantedItem) return vipSlotEffective;
        if (!vipUnlockGranted) return vipSlotEffective;
        return {
            ...vipSlotEffective,
            grantedItem: {
                name: 'VIP 슬롯 보상',
                quantity: 1,
                image: vipRewardPreviewImage,
            },
        };
    }, [vipSlotEffective, vipUnlockGranted, vipRewardPreviewImage]);

    const hasPvpRewardSlots = useMemo(() => {
        if (!mySummary) return false;
        if (sessionShowsVipPlayRewardSlot && vipSlotEffective) return true;
        if (isAdventureGame) {
            return !!mySummary.adventureRewardSlots;
        }
        return (
            (mySummary.gold ?? 0) > 0 ||
            (mySummary.xp?.change ?? 0) > 0 ||
            (mySummary.items?.length ?? 0) > 0
        );
    }, [mySummary, isAdventureGame, sessionShowsVipPlayRewardSlot, vipSlotEffective]);
    const isGuildWar = isGuildWarLiveSession(session as any);
    const guildWarStars = mySummary?.guildWarStars ?? 0;
    const guildWarHouseScore = useMemo(() => {
        if (!isGuildWar) return undefined;
        const humanEnum = currentUser.id === blackPlayerId ? Player.Black : Player.White;
        const s = computeGuildWarAttemptMetrics(session as any, humanEnum, isWinner === true).score;
        return typeof s === 'number' && !Number.isNaN(s) ? s : undefined;
    }, [isGuildWar, currentUser.id, blackPlayerId, session, isWinner]);
    const blackTurnLimit = Number((session.settings as any)?.blackTurnLimit ?? 0);
    const blackMoves = (session.moveHistory || []).filter(m => m.player === Player.Black && m.x !== -1 && m.y !== -1).length;
    const isGuildWarCaptureTurnLimitLoss =
        isGuildWar &&
        session.mode === GameMode.Capture &&
        blackTurnLimit > 0 &&
        blackMoves >= blackTurnLimit &&
        winner === Player.White;
    const isPlayful = PLAYFUL_GAME_MODES.some((m: {mode: GameMode}) => m.mode === session.mode);
    const blackPlayer = player1.id === blackPlayerId ? player1 : player2;
    const whitePlayer = player1.id === whitePlayerId ? player1 : player2;
    const canUseGameRecordUi = canSaveStrategicPvpGameRecord(session) && !isSpectator;
    const { recordAlreadySaved, setSavedOptimistic } = useGameRecordSaveLock(session.id, currentUser.savedGameRecords);
    const recordCount = currentUser.savedGameRecords?.length ?? 0;
    const [savingRecord, setSavingRecord] = useState(false);
    const [mobileResultTab, setMobileResultTab] = useState<MobileGameResultTab>('match');

    const avatarUrl = useMemo(() => AVATAR_POOL.find((a: AvatarInfo) => a.id === currentUser.avatarId)?.url, [currentUser.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find((b: BorderInfo) => b.id === currentUser.borderId)?.url, [currentUser.borderId]);
    
    // 모바일 텍스트 크기 조정
    const mobileTextScale = 1;
    const mobileImageScale = 1;

    useEffect(() => {
        if (soundPlayed.current) return;
        
        if (isWinner === true) audioService.gameWin();
        else if (isWinner === false) audioService.gameLose();
        
        if (mySummary) {
            if (mySummary.level && mySummary.level.initial < mySummary.level.final) {
                setTimeout(() => audioService.levelUp(), 800);
            }
            if (mySummary.manner && getMannerRank(mySummary.manner.initial) !== getMannerRank(mySummary.manner.final)) {
                 setTimeout(() => audioService.levelUp(), 900);
            }
        }
        
        soundPlayed.current = true;
    }, [isWinner, mySummary]);

    useEffect(() => {
        setMobileResultTab('match');
    }, [session.id]);
    
    const isDraw = winner === Player.None;
    const winnerUser = winner === Player.Black 
        ? (player1.id === blackPlayerId ? player1 : player2)
        : (winner === Player.White ? (player1.id === whitePlayerId ? player1 : player2) : null);

    const { title, color } = useMemo(() => {
        if (isDraw) return { title: "무승부", color: 'text-yellow-400' };

        // For spectators or when winner info is not yet available
        if (isWinner === null) {
            if (winnerUser) {
                return { title: `${winnerUser.nickname} 승리`, color: "text-gray-300" };
            }
            return { title: "게임 종료", color: 'text-gray-300' };
        }

        // For players
        if (isWinner) {
            let title = '승리';
            if (winReason === 'resign') title = '기권승';
            if (winReason === 'capture_limit' && isGuildWarCaptureTurnLimitLoss) title = '턴승';
            if (winReason === 'timeout') title = isGuildWarCaptureTurnLimitLoss ? '턴승' : '시간승';
            return { title, color: 'text-green-400' };
        } else {
            let title = '패배';
            if (winReason === 'resign') title = '기권패';
            if (winReason === 'capture_limit' && isGuildWarCaptureTurnLimitLoss) title = '턴패';
            if (winReason === 'timeout') {
                title = isGuildWarCaptureTurnLimitLoss ? '턴패' : isAdventureGame ? '패배' : '시간패';
            }
            return { title, color: 'text-red-400' };
        }
    }, [isWinner, isDraw, winReason, winnerUser, isGuildWarCaptureTurnLimitLoss, isAdventureGame]);
    
    const analysisResult = session.analysisResult?.['system']; // System analysis is used for final scores

    // 경기 결과 모달이 열린 뒤에는 경기장 쪽 시간 초기화나 상태 변경이 있더라도
    // "경기 시간/소요 시간"이 변하지 않도록, 처음 계산한 값을 ref에 고정한다.
    const gameDurationRef = useRef<string | null>(null);
    if (gameDurationRef.current === null) {
        const startTime = session.gameStartTime ?? (session as any).startTime ?? session.createdAt;
        const inferredEndTime = (session.gameStatus === 'ended' || session.gameStatus === 'no_contest')
            ? ((session as any).endTime ?? session.turnStartTime ?? Date.now())
            : Date.now();
        const elapsedMs = Math.max(0, inferredEndTime - startTime);
        const totalSeconds = Math.floor(elapsedMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        gameDurationRef.current = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    const renderGameContent = () => {
        const totalMoves = session.moveHistory?.length ?? 0;
        const formattedElapsed = gameDurationRef.current!;
        const isAiOrPve = !!session.isAiGame || !!session.isSinglePlayer || session.gameCategory === 'tower' || session.gameCategory === 'singleplayer';
        const timeLabel = isAiOrPve ? '소요 시간' : '경기 시간';
        if (isAdventureGame && winReason === 'adventure_monster_fled') {
            const msg =
                isWinner === false
                    ? '몬스터가 도망쳤습니다.'
                    : isWinner === true
                      ? '제한 시간이 지나 대국이 종료되었습니다.'
                      : '제한 시간이 지나 몬스터가 도망갔습니다.';
            return (
                <p
                    className={`text-center ${isMobile ? 'text-sm' : 'text-lg min-[1024px]:text-xl min-[1280px]:text-2xl'} ${isWinner === false ? 'text-red-400' : 'text-slate-200'}`}
                    style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}
                >
                    {msg}
                </p>
            );
        }
        if (isPlayful && winReason === 'resign') {
            const message = isWinner ? "상대방의 기권으로 승리했습니다." : "기권 패배했습니다.";
            return <p className={`text-center ${isMobile ? 'text-sm' : 'text-lg min-[1024px]:text-xl min-[1280px]:text-2xl'}`} style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}>{message}</p>;
        }

        if (winReason === 'capture_limit' && isGuildWarCaptureTurnLimitLoss) {
            if (isWinner) {
                return <p className={`text-center ${isMobile ? 'text-sm' : 'text-lg min-[1024px]:text-xl min-[1280px]:text-2xl'} text-green-400`} style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}>상대방의 제한 턴이 모두 소진되어 승리했습니다.</p>;
            }
            return <p className={`text-center ${isMobile ? 'text-sm' : 'text-lg min-[1024px]:text-xl min-[1280px]:text-2xl'} text-red-400`} style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}>제한 턴이 다 되어 패배했습니다.</p>;
        }
        
        // 시간 패배/승리 처리
        if (winReason === 'timeout') {
            if (!isWinner) {
                if (isGuildWarCaptureTurnLimitLoss) {
                    return <p className={`text-center ${isMobile ? 'text-sm' : 'text-lg min-[1024px]:text-xl min-[1280px]:text-2xl'} text-red-400`} style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}>제한 턴이 다 되어 패배했습니다.</p>;
                }
                // 패배한 경우
                if (session.stageId) {
                    // stageId가 있으면 제한 턴 체크
                    const isTower = session.gameCategory === 'tower';
                    if (isTower) {
                        try {
                            const currentStage = TOWER_STAGES.find((s: any) => s.id === session.stageId);
                            if (currentStage?.blackTurnLimit) {
                                return <p className={`text-center ${isMobile ? 'text-sm' : 'text-lg min-[1024px]:text-xl min-[1280px]:text-2xl'} text-red-400`} style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}>제한 턴이 다 되어 패배했습니다.</p>;
                            }
                        } catch (e) {
                            console.error('[GameSummaryModal] Error loading TOWER_STAGES:', e);
                        }
                    } else if (session.isSinglePlayer) {
                        try {
                            const currentStage = SINGLE_PLAYER_STAGES.find((s: any) => s.id === session.stageId);
                            if (currentStage?.blackTurnLimit) {
                                return <p className={`text-center ${isMobile ? 'text-sm' : 'text-lg min-[1024px]:text-xl min-[1280px]:text-2xl'} text-red-400`} style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}>제한 턴이 다 되어 패배했습니다.</p>;
                            }
                        } catch (e) {
                            console.error('[GameSummaryModal] Error loading SINGLE_PLAYER_STAGES:', e);
                        }
                    }
                }
                if (isAdventureGame) {
                    return (
                        <p
                            className={`text-center ${isMobile ? 'text-sm' : 'text-lg min-[1024px]:text-xl min-[1280px]:text-2xl'} text-red-400`}
                            style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}
                        >
                            몬스터가 도망쳤습니다.
                        </p>
                    );
                }
                // 일반 게임에서 시간 패배한 경우
                return <p className={`text-center ${isMobile ? 'text-sm' : 'text-lg min-[1024px]:text-xl min-[1280px]:text-2xl'} text-red-400`} style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}>시간이 다 되어 패배했습니다.</p>;
            } else {
                if (isGuildWarCaptureTurnLimitLoss) {
                    return <p className={`text-center ${isMobile ? 'text-sm' : 'text-lg min-[1024px]:text-xl min-[1280px]:text-2xl'} text-green-400`} style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}>상대방의 제한 턴이 모두 소진되어 승리했습니다.</p>;
                }
                // 승리한 경우
                return <p className={`text-center ${isMobile ? 'text-sm' : 'text-lg min-[1024px]:text-xl min-[1280px]:text-2xl'} text-green-400`} style={{ fontSize: isMobile ? `${12 * mobileTextScale}px` : undefined }}>상대방의 시간이 다 되어 승리했습니다.</p>;
            }
        }
        
        // 따내기 바둑: 따낸 점수를 이미지로 표시
        const isCaptureMode = session.mode === GameMode.Capture;
        const isMixWithCapture = session.mode === GameMode.Mix && session.settings.mixedModes && 
            session.settings.mixedModes.includes(GameMode.Capture);
        
        if (isCaptureMode || isMixWithCapture) {
            return (
                <CaptureScoreDetailsComponent
                    session={session}
                    isMobile={isMobile}
                    mobileTextScale={mobileTextScale}
                    guildWarHouseScore={isGuildWar && isCaptureMode ? guildWarHouseScore : undefined}
                />
            );
        }
        
        // 스피드 바둑, 베이스 바둑, 히든 바둑, 미사일 바둑, 믹스룰 바둑: 계가 결과 표시
        const strategicModesWithScoring = [GameMode.Speed, GameMode.Base, GameMode.Hidden, GameMode.Missile];
        const isMixWithStrategic = session.mode === GameMode.Mix && session.settings.mixedModes && 
            session.settings.mixedModes.some((m: GameMode) => strategicModesWithScoring.includes(m));
        
        if (strategicModesWithScoring.includes(session.mode) || isMixWithStrategic || session.mode === GameMode.Mix) {
            if (winReason === 'score' && analysisResult) {
                return (
                    <div className="mx-auto w-full max-w-md">
                        <ScoreDetailsComponent analysis={analysisResult} session={session} isMobile={isMobile} mobileTextScale={mobileTextScale} />
                    </div>
                );
            }
            if (winReason === 'score') {
                return <p className={`text-center text-gray-400 animate-pulse ${isMobile ? 'text-xs' : ''}`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>점수 계산 중...</p>;
            }
        }
        
        if (winReason === 'score') {
            if (analysisResult) {
                return (
                    <div className="mx-auto w-full max-w-md">
                        <ScoreDetailsComponent analysis={analysisResult} session={session} isMobile={isMobile} mobileTextScale={mobileTextScale} />
                    </div>
                );
            }
            return <p className={`text-center text-gray-400 animate-pulse ${isMobile ? 'text-xs' : ''}`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>점수 계산 중...</p>;
        }
        if (session.mode === GameMode.Dice || session.mode === GameMode.Thief) return <PlayfulScoreDetailsComponent gameSession={session} isMobile={isMobile} mobileTextScale={mobileTextScale} />;
        if (session.mode === GameMode.Curling) return <CurlingScoreDetailsComponent gameSession={session} isMobile={isMobile} mobileTextScale={mobileTextScale} mobileImageScale={mobileImageScale} />;
        if (session.mode === GameMode.Omok || session.mode === GameMode.Ttamok) {
            let message = '';
            if (winReason === 'omok_win') {
                message = isWinner ? '오목 완성' : '상대방 오목 완성';
            } else if (winReason === 'capture_limit') {
                message = isWinner ? '목표 따내기 완료' : '상대방 목표 따내기 완료';
            }
            if (message) {
                return <p className={`text-center ${isMobile ? 'text-lg' : 'text-2xl min-[1024px]:text-3xl min-[1280px]:text-4xl'} font-bold`} style={{ fontSize: isMobile ? `${16 * mobileTextScale}px` : undefined }}>{message}</p>;
            }
        }
        if (session.mode === GameMode.Alkkagi) {
            return <AlkkagiScoreDetailsComponent gameSession={session} isMobile={isMobile} mobileTextScale={mobileTextScale} />;
        }
        return (
            <div className="mx-auto flex w-full max-w-md flex-col gap-2 sm:gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2 text-sm sm:text-base min-[1024px]:text-lg min-[1024px]:gap-3">
                    <div className="bg-gray-800/40 rounded-md px-2 py-1.5 flex justify-between items-center">
                        <span className="text-gray-300" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}>흑</span>
                        <span className="font-semibold" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}>{blackPlayer.nickname}</span>
                    </div>
                    <div className="bg-gray-800/40 rounded-md px-2 py-1.5 flex justify-between items-center">
                        <span className="text-gray-300" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}>백</span>
                        <span className="font-semibold" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}>{whitePlayer.nickname}</span>
                    </div>
                    <div className="bg-gray-800/40 rounded-md px-2 py-1.5 flex justify-between items-center">
                        <span className="text-gray-300" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}>총 수순</span>
                        <span className="font-semibold" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}>{totalMoves}수</span>
                    </div>
                    <div className="bg-gray-800/40 rounded-md px-2 py-1.5 flex justify-between items-center">
                        <span className="text-gray-300" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}>{timeLabel}</span>
                        <span className="font-semibold" style={{ fontSize: isMobile ? `${9 * mobileTextScale}px` : undefined }}>{formattedElapsed}</span>
                    </div>
                </div>
                <p className={`text-center text-gray-400 ${isMobile ? 'text-xs' : ''}`} style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}>
                    특별한 경기 내용이 없습니다.
                </p>
            </div>
        );
    }

    const renderGuildWarStarConditions = () => {
        if (!isGuildWar) return null;
        const boardId = (session as any).guildWarBoardId as string | undefined;
        const mode = getGuildWarBoardMode(boardId ?? 'top-left');
        const humanWon = isWinner === true;
        const humanEnum = currentUser.id === blackPlayerId ? Player.Black : Player.White;
        const metrics = computeGuildWarAttemptMetrics(session as any, humanEnum as any, humanWon);
        const maxSingleCapture = metrics.maxSingleCapture ?? 0;
        const scoreDiff = metrics.scoreDiff ?? 0;
        const scoreT2 = getGuildWarStarScoreTier2MinDiff(boardId);
        const scoreT3 = getGuildWarStarScoreTier3MinDiff(boardId);

        const rows =
            mode === 'capture'
                ? [
                    { label: '승리', ok: humanWon },
                    { label: `한 번에 ${GUILD_WAR_STAR_CAPTURE_TIER2_MIN}점 획득`, ok: maxSingleCapture >= GUILD_WAR_STAR_CAPTURE_TIER2_MIN },
                    { label: `한 번에 ${GUILD_WAR_STAR_CAPTURE_TIER3_MIN}점 획득`, ok: maxSingleCapture >= GUILD_WAR_STAR_CAPTURE_TIER3_MIN },
                ]
                : [
                    { label: '승리', ok: humanWon },
                    { label: `집차이 ${scoreT2}집 이상`, ok: humanWon && scoreDiff >= scoreT2 },
                    { label: `집차이 ${scoreT3}집 이상`, ok: humanWon && scoreDiff >= scoreT3 },
                ];

        return (
            <div
                className={
                    isMobile
                        ? 'mt-1 w-full rounded-md border border-amber-500/35 bg-amber-900/10 p-1 text-center'
                        : 'mt-1.5 w-full rounded-md border border-amber-500/35 bg-amber-900/10 p-2 text-center lg:mt-2 lg:p-3'
                }
            >
                <p
                    className={
                        isMobile
                            ? 'mb-0.5 text-[0.65rem] font-semibold leading-tight text-amber-200/90'
                            : 'mb-1 text-sm font-semibold text-amber-200/90 lg:text-base'
                    }
                >
                    별 달성 조건
                </p>
                <div className={isMobile ? 'space-y-0' : 'space-y-1'}>
                    {rows.map((row) => (
                        <div
                            key={row.label}
                            className={
                                isMobile
                                    ? 'flex items-center justify-center gap-1.5 text-[0.65rem] leading-tight'
                                    : 'flex items-center justify-center gap-2 text-sm lg:text-base'
                            }
                        >
                            <span className="min-w-0 flex-1 text-right text-gray-200">{row.label}</span>
                            <img
                                src={row.ok ? '/images/guild/guildwar/clearstar.png' : '/images/guild/guildwar/emptystar.png'}
                                alt=""
                                className={
                                    isMobile
                                        ? 'h-4 w-4 shrink-0 object-contain opacity-95'
                                        : 'h-6 w-6 shrink-0 object-contain opacity-95 sm:h-7 sm:w-7'
                                }
                                aria-hidden
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const initialMannerRank = mySummary ? getMannerRank(mySummary.manner.initial) : '';
    const finalMannerRank = mySummary ? getMannerRank(mySummary.manner.final) : '';

    const statCardClass = isMobile
        ? 'flex min-h-[2.75rem] flex-col gap-0.5 rounded-md border border-amber-500/20 bg-gradient-to-br from-slate-900/95 via-[#13141c] to-[#0a0a0f] px-1 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-inset ring-amber-500/10'
        : 'flex min-h-[4.75rem] flex-col gap-1 rounded-md border border-amber-500/20 bg-gradient-to-br from-slate-900/95 via-[#13141c] to-[#0a0a0f] px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-inset ring-amber-500/10 sm:min-h-[5.1rem] sm:px-2 sm:py-1.5 min-[1024px]:min-h-[5.35rem] min-[1024px]:rounded-lg';
    const statLabelClass = isMobile
        ? 'shrink-0 text-[0.55rem] font-bold uppercase tracking-[0.08em] text-slate-400'
        : 'shrink-0 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-slate-400 min-[1024px]:text-[0.65rem]';
    /** 라벨 아래 값 영역 — 네 박스 높이 맞춤 */
    const statCardBodyClass = isMobile
        ? 'flex min-h-[1.25rem] flex-1 flex-wrap content-center items-center justify-center gap-x-1 gap-y-0'
        : 'flex min-h-[2.2rem] flex-1 flex-wrap content-center items-center justify-center gap-x-1.5 gap-y-0';
    const statValueMainClass = isMobile
        ? 'text-sm font-black tabular-nums tracking-tight text-white'
        : 'text-lg font-black tabular-nums tracking-tight text-white min-[1024px]:text-xl';
    const statValueMannerClass = isMobile
        ? 'text-sm font-black tabular-nums text-slate-100'
        : 'text-lg font-black tabular-nums text-slate-100 min-[1024px]:text-xl';
    const statOverallClass = isMobile
        ? 'flex items-baseline justify-center gap-0.5 text-sm font-black tabular-nums text-white'
        : 'flex items-baseline justify-center gap-0.5 text-base font-black tabular-nums text-white min-[1024px]:text-lg';

    const pvpRewardsSection = (
        <div
            className={`relative z-10 flex-shrink-0 space-y-1 rounded-xl border border-amber-500/20 bg-gradient-to-b from-[#1a1510]/95 via-[#12100c] to-[#0a0908] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-inset ring-amber-500/10 sm:p-2.5 ${isMobile ? '!p-1.5' : ''}`}
        >
            <h2
                className={`mb-0 border-b border-amber-500/25 pb-1 text-center font-bold uppercase tracking-[0.12em] text-amber-200/85 ${
                    isMobile ? 'text-xs' : 'text-[0.65rem] sm:text-xs min-[1024px]:text-sm'
                }`}
                style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}
            >
                {isGuildWar ? '길드 전쟁 보상' : '획득 보상'}
            </h2>
            <div
                className={
                    isMobile
                        ? RESULT_MODAL_REWARDS_ROW_MOBILE_COMPACT_CLASS
                        : `flex ${
                              useCompactRewardSlots ? 'min-h-[5.25rem]' : RESULT_MODAL_REWARDS_ROW_MIN_H_CLASS
                          } flex-wrap content-center items-center justify-center gap-2 sm:gap-2.5`
                }
            >
                {!mySummary ? (
                    <p
                        className="px-2 text-center text-slate-500"
                        style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}
                    >
                        보상 정보가 없습니다.
                    </p>
                ) : !hasPvpRewardSlots ? (
                    <p
                        className="px-2 text-center text-slate-500"
                        style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}
                    >
                        보상이 없습니다.
                    </p>
                ) : (
                    <>
                        {isAdventureGame && mySummary.adventureRewardSlots ? (
                            <AdventureBattleRewardRowWithReveal
                                slots={mySummary.adventureRewardSlots}
                                xpChange={mySummary.xp?.change ?? 0}
                                isPlayful={isPlayful}
                                compact={useCompactRewardSlots}
                                vipPlayRewardSlot={vipSlotForRender}
                                onVipLockedClick={() => handlers.openShop('vip')}
                            />
                        ) : (
                            <>
                        {(mySummary.gold ?? 0) > 0 && (
                            <ResultModalGoldCurrencySlot
                                amount={mySummary.gold ?? 0}
                                compact={useCompactRewardSlots}
                                understandingBonus={mySummary.adventureGoldUnderstandingBonus}
                            />
                        )}
                        {(mySummary.xp?.change ?? 0) > 0 && (
                            <div className="flex shrink-0 flex-col items-center justify-center">
                                <ResultModalXpRewardBadge
                                    variant={isPlayful ? 'playful' : 'strategy'}
                                    amount={mySummary.xp!.change}
                                    density={useCompactRewardSlots ? 'compact' : 'comfortable'}
                                />
                            </div>
                        )}
                        {mySummary.items &&
                            mySummary.items.length > 0 &&
                            mySummary.items.slice(0, 3).map((item: InventoryItem, idx: number) => {
                                const displayName = item.name;
                                const nameWithSpace = displayName.includes('골드꾸러미')
                                    ? displayName.replace('골드꾸러미', '골드 꾸러미')
                                    : displayName;
                                const nameWithoutSpace = displayName.includes('골드 꾸러미')
                                    ? displayName.replace('골드 꾸러미', '골드꾸러미')
                                    : displayName;
                                const rawPath =
                                    (item as { image?: string }).image ||
                                    CONSUMABLE_ITEMS.find(
                                        (ci: { name: string }) =>
                                            ci.name === displayName ||
                                            ci.name === nameWithSpace ||
                                            ci.name === nameWithoutSpace
                                    )?.image ||
                                    MATERIAL_ITEMS[displayName]?.image ||
                                    MATERIAL_ITEMS[nameWithSpace]?.image ||
                                    MATERIAL_ITEMS[nameWithoutSpace]?.image ||
                                    EQUIPMENT_POOL.find(
                                        (e) =>
                                            e.name === displayName ||
                                            e.name === nameWithSpace ||
                                            e.name === nameWithoutSpace
                                    )?.image;
                                const imagePath = normalizeRewardImagePath(rawPath);
                                return (
                                    <ResultModalItemRewardSlot
                                        key={item.id || idx}
                                        imageSrc={imagePath}
                                        name={displayName}
                                        quantity={item.quantity}
                                        compact={useCompactRewardSlots}
                                        onImageError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                );
                            })}
                        {mySummary.items && mySummary.items.length > 3 && (
                            <div className="flex shrink-0 flex-col items-center justify-center gap-0.5">
                                <div
                                    className={`flex flex-shrink-0 items-center justify-center rounded-lg border-2 border-white/25 bg-slate-950/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-white/10 ${
                                        useCompactRewardSlots
                                            ? RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS
                                            : 'h-14 w-14 min-[1024px]:h-[4.75rem] min-[1024px]:w-[4.75rem]'
                                    }`}
                                >
                                    <span className="text-center text-[0.65rem] font-bold tabular-nums text-slate-400 min-[400px]:text-xs min-[1024px]:text-sm">
                                        +{mySummary.items.length - 3}
                                    </span>
                                </div>
                            </div>
                        )}
                        {vipSlotForRender ? (
                            <ResultModalVipRewardSlot
                                slot={vipSlotForRender}
                                compact={useCompactRewardSlots}
                                rouletteActive={vipUnlockRouletteActive}
                                onLockedClick={vipSlotForRender.locked ? () => handlers.openShop('vip') : undefined}
                            />
                        ) : null}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );

    const adventureResultChrome = isAdventureGame && !isSpectator && onLeaveToAdventureMap;

    return (
        <DraggableWindow
            title={isGuildWar ? '길드 전쟁 결과' : '대국 결과'}
            onClose={onConfirm}
            initialWidth={1000}
            initialHeight={isMobile ? 900 : 720}
            pcViewportMaxHeightCss="min(92vh, 840px)"
            uniformPcScale={false}
            mobileViewportFit
            mobileLockViewportHeight={isMobile}
            mobileViewportMaxHeightVh={isMobile ? 96 : 86}
            windowId="game-summary"
            variant="store"
            modalBackdrop={!adventureResultChrome}
            closeOnOutsideClick={!adventureResultChrome}
            bodyPaddingClassName={
                isMobile
                    ? '!p-1.5 !pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] min-[390px]:!p-2'
                    : '!p-3 sm:!p-4'
            }
        >
            <>
            <div
                className={`relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-amber-500/35 bg-gradient-to-b from-[#141a28] via-[#0d111c] to-[#080b12] shadow-[0_0_0_1px_rgba(251,191,36,0.08),0_24px_48px_-20px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]${isMobile ? ' h-0 min-h-0 flex-1' : ''}`}
            >
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.12]"
                    style={{
                        background:
                            'radial-gradient(ellipse 85% 55% at 50% -5%, rgba(251, 191, 36, 0.45), transparent 58%), radial-gradient(ellipse 70% 45% at 50% 100%, rgba(34, 211, 238, 0.12), transparent 55%)',
                    }}
                    aria-hidden
                />
            <div
                className={`relative flex min-h-0 flex-col text-on-panel antialiased ${
                    useBodyScrollSizing ? 'w-full overflow-x-hidden' : 'w-full overflow-x-hidden overflow-y-visible'
                } ${isMobile ? 'h-0 min-h-0 flex-1 p-1.5 text-xs sm:text-sm min-[390px]:p-2' : 'p-2.5 text-[0.9375rem] min-[1024px]:p-3 min-[1024px]:text-[1rem] min-[1280px]:text-[1.0625rem]'}`}
            >
                {!isMobile && (
                <h1
                    className={`mb-1.5 flex-shrink-0 text-center text-2xl font-black tracking-[0.14em] drop-shadow-[0_2px_14px_rgba(0,0,0,0.55)] sm:mb-2 min-[1024px]:text-3xl min-[1280px]:text-[2.15rem] ${color}`}
                >
                    {title}
                </h1>
                )}
                {isMobile ? (
                    <>
                        <MobileGameResultTabBar
                            active={mobileResultTab}
                            onChange={setMobileResultTab}
                            recordLabel={isGuildWar ? '보상·기록' : '대국 결과'}
                        />
                        <div className="flex h-0 min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                            <div className="h-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [scrollbar-gutter:auto] [scrollbar-width:thin]">
                                <MobileResultTabPanelStack
                                    className="min-h-0"
                                    active={mobileResultTab}
                                    matchPanel={
                                    <div className="flex flex-col items-center rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900/90 via-[#121318] to-[#0a0a0e] p-1.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-500/10">
                                        <h2
                                            className="mb-0 w-full flex-shrink-0 border-b border-amber-500/25 pb-1 text-center text-xs font-bold uppercase tracking-[0.12em] text-amber-200/85"
                                            style={{ fontSize: `${10 * mobileTextScale}px` }}
                                        >
                                            경기 내용
                                        </h2>
                                        {isGuildWar ? (
                                            <div
                                                className="mb-1 mt-1 flex flex-shrink-0 flex-col items-center gap-0.5"
                                                aria-label={`획득 별 ${guildWarStars}개`}
                                            >
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <span
                                                        className="text-[0.58rem] font-semibold uppercase tracking-wider text-slate-400"
                                                        style={{ fontSize: `${8 * mobileTextScale}px` }}
                                                    >
                                                        획득 별
                                                    </span>
                                                    {[0, 1, 2].map((i) => (
                                                        <img
                                                            key={i}
                                                            src={
                                                                i < guildWarStars
                                                                    ? '/images/guild/guildwar/clearstar.png'
                                                                    : '/images/guild/guildwar/emptystar.png'
                                                            }
                                                            alt=""
                                                            className="h-5 w-5 object-contain drop-shadow sm:h-6 sm:w-6"
                                                        />
                                                    ))}
                                                    <span
                                                        className="text-xs font-bold tabular-nums text-amber-100/95"
                                                        style={{ fontSize: `${10 * mobileTextScale}px` }}
                                                    >
                                                        {guildWarStars}/3
                                                    </span>
                                                </div>
                                            </div>
                                        ) : null}
                                        <MatchPlayersRoster
                                            session={session}
                                            blackPlayer={blackPlayer}
                                            whitePlayer={whitePlayer}
                                            isPlayful={isPlayful}
                                            isMobile={isMobile}
                                            mobileTextScale={mobileTextScale}
                                            mobileImageScale={mobileImageScale}
                                            mobileCompactRoster
                                        />
                                        <div className="mt-1 flex w-full flex-col items-center overflow-x-hidden overflow-y-visible">
                                            {renderGameContent()}
                                        </div>
                                    </div>
                                    }
                                    recordPanel={
                                    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900/92 via-[#121318] to-[#0a0a0e] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-500/10">
                                        <h2
                                            className="mb-0 flex-shrink-0 border-b border-violet-500/25 pb-0.5 text-center text-xs font-bold uppercase tracking-[0.12em] text-violet-200/85"
                                            style={{ fontSize: `${10 * mobileTextScale}px` }}
                                        >
                                            {isGuildWar ? '보상·기록' : '대국 결과'}
                                        </h2>
                                        <div className="flex-shrink-0 rounded-lg border border-amber-500/20 bg-gradient-to-r from-slate-950/80 via-[#15151c] to-slate-950/80 p-1 ring-1 ring-inset ring-amber-500/10 sm:p-2">
                                            <div className="flex items-center gap-1.5">
                                                <Avatar
                                                    userId={currentUser.id}
                                                    userName={currentUser.nickname}
                                                    size={Math.round(24 * mobileImageScale)}
                                                    avatarUrl={avatarUrl}
                                                    borderUrl={borderUrl}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div
                                                        className="max-w-full overflow-x-auto overflow-y-hidden whitespace-nowrap [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
                                                        title={currentUser.nickname}
                                                    >
                                                        <p
                                                            className="inline-block min-w-0 whitespace-nowrap pr-1 font-bold leading-snug text-white"
                                                            style={{ fontSize: `${10 * mobileTextScale}px` }}
                                                        >
                                                            {currentUser.nickname}
                                                        </p>
                                                    </div>
                                                    <p
                                                        className="font-medium text-slate-400 text-[0.7rem] sm:text-sm"
                                                        style={{ fontSize: `${8 * mobileTextScale}px` }}
                                                    >
                                                        {isPlayful ? '놀이' : '전략'} Lv.
                                                        {mySummary?.level ? mySummary.level.final : isPlayful ? currentUser.playfulLevel : currentUser.strategyLevel}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        {mySummary?.level ? (
                                            <div className="flex min-h-[2rem] flex-shrink-0 flex-col justify-center">
                                                <XpBar
                                                    initial={mySummary.level.progress.initial}
                                                    final={mySummary.level.progress.final}
                                                    max={mySummary.level.progress.max}
                                                    levelUp={mySummary.level.initial < mySummary.level.final}
                                                    xpGain={mySummary.xp?.change ?? 0}
                                                    finalLevel={mySummary.level.final}
                                                    isMobile={isMobile}
                                                    mobileTextScale={mobileTextScale}
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex min-h-[2rem] flex-shrink-0 flex-col justify-center">
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className="w-12 text-xs font-bold text-right text-slate-400"
                                                        style={{ fontSize: `${10 * mobileTextScale}px` }}
                                                    >
                                                        경험치
                                                    </span>
                                                    <div className="relative flex h-3 w-full items-center justify-center overflow-hidden rounded-full border border-white/10 bg-slate-950/80">
                                                        <span
                                                            className="text-[9px] font-bold text-slate-500"
                                                            style={{ fontSize: `${8 * mobileTextScale}px` }}
                                                        >
                                                            0 XP
                                                        </span>
                                                    </div>
                                                    <span
                                                        className="w-14 whitespace-nowrap text-xs font-bold text-slate-500"
                                                        style={{ fontSize: `${10 * mobileTextScale}px` }}
                                                    >
                                                        +0 XP
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {isAdventureGame && mySummary?.adventureCodexDelta ? (
                                            <AdventureResultCodexCard
                                                codexDelta={mySummary.adventureCodexDelta}
                                                understandingDelta={mySummary.adventureUnderstandingDelta}
                                                compact={isMobile}
                                                mobileTextScale={mobileTextScale}
                                            />
                                        ) : null}
                                        {isGuildWar ? (
                                            renderGuildWarStarConditions()
                                        ) : isAdventureGame && mySummary ? null : mySummary ? (
                                            <div className="min-w-0 overflow-x-hidden overflow-y-visible">
                                                <div className="grid grid-cols-2 gap-0.5">
                                                    <div className={`${statCardClass} text-center`}>
                                                        <p className={statLabelClass}>랭킹 점수</p>
                                                        <div className={statCardBodyClass}>
                                                            <span className={statValueMainClass}>{mySummary.rating.final}</span>
                                                            <span
                                                                className={`rounded-full border px-1.5 py-px text-[0.6rem] font-bold tabular-nums leading-none min-[1024px]:text-[0.65rem] ${
                                                                    mySummary.rating.change >= 0
                                                                        ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
                                                                        : 'border-rose-400/35 bg-rose-500/15 text-rose-200'
                                                                }`}
                                                            >
                                                                {mySummary.rating.change > 0 ? '+' : ''}
                                                                {mySummary.rating.change}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className={`${statCardClass} text-center`}>
                                                        <p className={statLabelClass}>매너 점수</p>
                                                        <div className={statCardBodyClass}>
                                                            <span className={statValueMannerClass}>{mySummary.manner.final}</span>
                                                            {mySummary.manner.change === 0 ? (
                                                                <span className="text-[0.6rem] font-semibold text-slate-500 min-[1024px]:text-[0.65rem]">
                                                                    변동 없음
                                                                </span>
                                                            ) : (
                                                                <span
                                                                    className={`inline-flex items-center gap-0.5 text-[0.6rem] font-bold tabular-nums min-[1024px]:text-[0.65rem] ${
                                                                        mySummary.manner.change > 0 ? 'text-emerald-300' : 'text-rose-300'
                                                                    }`}
                                                                >
                                                                    <span aria-hidden>{mySummary.manner.change > 0 ? '↑' : '↓'}</span>
                                                                    <span>
                                                                        {mySummary.manner.change > 0
                                                                            ? mySummary.manner.change
                                                                            : Math.abs(mySummary.manner.change)}
                                                                        점
                                                                    </span>
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className={`${statCardClass} text-center`}>
                                                        <p className={statLabelClass}>통산 전적</p>
                                                        <div className={statCardBodyClass}>
                                                            {mySummary.overallRecord != null ? (
                                                                <span className={statOverallClass}>
                                                                    <span className="text-amber-200">{mySummary.overallRecord.wins}</span>
                                                                    <span className="text-[0.65rem] font-bold text-slate-500">승</span>
                                                                    <span className="text-slate-200">{mySummary.overallRecord.losses}</span>
                                                                    <span className="text-[0.65rem] font-bold text-slate-500">패</span>
                                                                </span>
                                                            ) : (
                                                                <span className="text-sm font-bold text-slate-500">-</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className={`${statCardClass} text-center`}>
                                                        <p className={statLabelClass}>매너 등급</p>
                                                        <div className={statCardBodyClass}>
                                                            <span className="flex flex-wrap items-center justify-center gap-0.5 text-[0.65rem] font-bold text-violet-200/95 min-[1024px]:text-xs">
                                                                <span className="rounded border border-violet-400/25 bg-violet-950/40 px-1 py-px">{initialMannerRank}</span>
                                                                <span className="text-slate-500">→</span>
                                                                <span className="rounded border border-violet-400/35 bg-violet-900/35 px-1 py-px">{finalMannerRank}</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : !isAdventureGame ? (
                                            <div className="min-w-0 overflow-x-hidden overflow-y-visible">
                                                <div className="grid grid-cols-2 gap-0.5 opacity-80">
                                                    <div className={`${statCardClass} text-center`}>
                                                        <p className={statLabelClass}>랭킹 점수</p>
                                                        <div className={statCardBodyClass}>
                                                            <span className="text-sm font-bold text-slate-500">-</span>
                                                        </div>
                                                    </div>
                                                    <div className={`${statCardClass} text-center`}>
                                                        <p className={statLabelClass}>매너 점수</p>
                                                        <div className={statCardBodyClass}>
                                                            <span className="text-sm font-bold text-slate-500">-</span>
                                                        </div>
                                                    </div>
                                                    <div className={`${statCardClass} text-center`}>
                                                        <p className={statLabelClass}>통산 전적</p>
                                                        <div className={statCardBodyClass}>
                                                            <span className="text-sm font-bold text-slate-500">-</span>
                                                        </div>
                                                    </div>
                                                    <div className={`${statCardClass} text-center`}>
                                                        <p className={statLabelClass}>매너 등급</p>
                                                        <div className={statCardBodyClass}>
                                                            <span className="text-sm font-bold text-slate-500">-</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                    }
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex min-h-0 flex-row items-stretch gap-2 overflow-visible sm:gap-3">
                        <div className="flex min-h-0 w-1/2 min-w-0 shrink-0 flex-col items-center overflow-visible rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900/90 via-[#121318] to-[#0a0a0e] p-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-500/10 sm:p-3">
                            <h2 className="mb-0 w-full flex-shrink-0 border-b border-amber-500/20 pb-1 text-center text-[0.65rem] font-bold uppercase tracking-[0.12em] text-amber-200/85 sm:text-xs min-[1024px]:text-sm">
                                경기 내용
                            </h2>
                            {isGuildWar ? (
                                <div className="mb-2 mt-1.5 flex flex-shrink-0 flex-col items-center gap-0.5" aria-label={`획득 별 ${guildWarStars}개`}>
                                    <div className="flex items-center justify-center gap-1.5">
                                        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400 min-[1024px]:text-xs">
                                            획득 별
                                        </span>
                                        {[0, 1, 2].map((i) => (
                                            <img
                                                key={i}
                                                src={
                                                    i < guildWarStars
                                                        ? '/images/guild/guildwar/clearstar.png'
                                                        : '/images/guild/guildwar/emptystar.png'
                                                }
                                                alt=""
                                                className="h-7 w-7 object-contain drop-shadow min-[1024px]:h-8 min-[1024px]:w-8"
                                            />
                                        ))}
                                        <span className="text-sm font-bold tabular-nums text-amber-100/95 min-[1024px]:text-base">
                                            {guildWarStars}/3
                                        </span>
                                    </div>
                                </div>
                            ) : null}
                            <MatchPlayersRoster
                                session={session}
                                blackPlayer={blackPlayer}
                                whitePlayer={whitePlayer}
                                isPlayful={isPlayful}
                                isMobile={false}
                                mobileTextScale={mobileTextScale}
                                mobileImageScale={mobileImageScale}
                            />
                            <div className="flex w-full flex-col items-center overflow-visible">
                                {renderGameContent()}
                            </div>
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-visible sm:gap-2">
                            <div className="flex min-h-0 min-w-0 flex-col gap-1.5 overflow-visible rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900/92 via-[#121318] to-[#0a0a0e] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-500/10 sm:p-2.5">
                                <h2 className="mb-0 flex-shrink-0 border-b border-violet-500/25 pb-1 text-center text-[0.65rem] font-bold uppercase tracking-[0.12em] text-violet-200/85 sm:text-xs min-[1024px]:text-sm">
                                    {isGuildWar ? '보상·기록' : '대국 결과'}
                                </h2>
                                <div className="flex-shrink-0 rounded-lg border border-amber-500/20 bg-gradient-to-r from-slate-950/80 via-[#15151c] to-slate-950/80 p-1.5 ring-1 ring-inset ring-amber-500/10 sm:p-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <Avatar
                                            userId={currentUser.id}
                                            userName={currentUser.nickname}
                                            size={40}
                                            avatarUrl={avatarUrl}
                                            borderUrl={borderUrl}
                                        />
                                        <div className="min-w-0 shrink">
                                            <p
                                                className="min-w-0 break-words text-sm font-bold leading-tight text-white min-[1024px]:text-[0.9rem]"
                                                style={{ wordBreak: 'break-word' }}
                                                title={currentUser.nickname}
                                            >
                                                {currentUser.nickname}
                                            </p>
                                            <p className="text-[0.65rem] font-medium leading-none text-slate-400 min-[1024px]:text-xs">
                                                {isPlayful ? '놀이' : '전략'} Lv.
                                                {mySummary?.level ? mySummary.level.final : isPlayful ? currentUser.playfulLevel : currentUser.strategyLevel}
                                            </p>
                                        </div>
                                        <div className="min-w-0 flex-1 self-center">
                                            {mySummary?.level ? (
                                                <XpBar
                                                    initial={mySummary.level.progress.initial}
                                                    final={mySummary.level.progress.final}
                                                    max={mySummary.level.progress.max}
                                                    levelUp={mySummary.level.initial < mySummary.level.final}
                                                    xpGain={mySummary.xp?.change ?? 0}
                                                    finalLevel={mySummary.level.final}
                                                    isMobile={false}
                                                    mobileTextScale={mobileTextScale}
                                                    compact
                                                    omitLevelColumn
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className="w-14 shrink-0 text-right text-xs font-bold text-slate-400">경험치</span>
                                                    <div className="relative flex h-3 w-full min-w-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-slate-950/80">
                                                        <span className="text-[10px] font-bold text-slate-500">0 XP</span>
                                                    </div>
                                                    <span className="w-14 shrink-0 whitespace-nowrap text-xs font-bold text-slate-500">+0 XP</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {isAdventureGame && mySummary?.adventureCodexDelta ? (
                                    <AdventureResultCodexCard
                                        codexDelta={mySummary.adventureCodexDelta}
                                        understandingDelta={mySummary.adventureUnderstandingDelta}
                                        compact={false}
                                        mobileTextScale={mobileTextScale}
                                    />
                                ) : null}
                                {isGuildWar ? (
                                    renderGuildWarStarConditions()
                                ) : isAdventureGame && mySummary ? null : mySummary ? (
                                    <div className={`${isAdventureGame ? 'min-h-0' : 'min-h-[10.5rem]'} min-w-0 flex-1 overflow-x-hidden overflow-y-visible`}>
                                        <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
                                            <div className={`${statCardClass} text-center`}>
                                                <p className={statLabelClass}>랭킹 점수</p>
                                                <div className={statCardBodyClass}>
                                                    <span className={statValueMainClass}>{mySummary.rating.final}</span>
                                                    <span
                                                        className={`rounded-full border px-1.5 py-px text-[0.6rem] font-bold tabular-nums leading-none min-[1024px]:text-[0.65rem] ${
                                                            mySummary.rating.change >= 0
                                                                ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
                                                                : 'border-rose-400/35 bg-rose-500/15 text-rose-200'
                                                        }`}
                                                    >
                                                        {mySummary.rating.change > 0 ? '+' : ''}
                                                        {mySummary.rating.change}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={`${statCardClass} text-center`}>
                                                <p className={statLabelClass}>매너 점수</p>
                                                <div className={statCardBodyClass}>
                                                    <span className={statValueMannerClass}>{mySummary.manner.final}</span>
                                                    {mySummary.manner.change === 0 ? (
                                                        <span className="text-[0.6rem] font-semibold text-slate-500 min-[1024px]:text-[0.65rem]">변동 없음</span>
                                                    ) : (
                                                        <span
                                                            className={`inline-flex items-center gap-0.5 text-[0.6rem] font-bold tabular-nums min-[1024px]:text-[0.65rem] ${
                                                                mySummary.manner.change > 0 ? 'text-emerald-300' : 'text-rose-300'
                                                            }`}
                                                        >
                                                            <span aria-hidden>{mySummary.manner.change > 0 ? '↑' : '↓'}</span>
                                                            <span>
                                                                {mySummary.manner.change > 0
                                                                    ? mySummary.manner.change
                                                                    : Math.abs(mySummary.manner.change)}
                                                                점
                                                            </span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={`${statCardClass} text-center`}>
                                                <p className={statLabelClass}>통산 전적</p>
                                                <div className={statCardBodyClass}>
                                                    {mySummary.overallRecord != null ? (
                                                        <span className={statOverallClass}>
                                                            <span className="text-amber-200">{mySummary.overallRecord.wins}</span>
                                                            <span className="text-[0.65rem] font-bold text-slate-500">승</span>
                                                            <span className="text-slate-200">{mySummary.overallRecord.losses}</span>
                                                            <span className="text-[0.65rem] font-bold text-slate-500">패</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm font-bold text-slate-500">-</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={`${statCardClass} text-center`}>
                                                <p className={statLabelClass}>매너 등급</p>
                                                <div className={statCardBodyClass}>
                                                    <span className="flex flex-wrap items-center justify-center gap-0.5 text-[0.65rem] font-bold text-violet-200/95 min-[1024px]:text-xs">
                                                        <span className="rounded border border-violet-400/25 bg-violet-950/40 px-1 py-px">{initialMannerRank}</span>
                                                        <span className="text-slate-500">→</span>
                                                        <span className="rounded border border-violet-400/35 bg-violet-900/35 px-1 py-px">{finalMannerRank}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : !isAdventureGame ? (
                                    <div className="overflow-visible">
                                        <div className="grid grid-cols-2 gap-1 opacity-80 sm:gap-1.5">
                                            <div className={`${statCardClass} text-center`}>
                                                <p className={statLabelClass}>랭킹 점수</p>
                                                <div className={statCardBodyClass}>
                                                    <span className="text-sm font-bold text-slate-500">-</span>
                                                </div>
                                            </div>
                                            <div className={`${statCardClass} text-center`}>
                                                <p className={statLabelClass}>매너 점수</p>
                                                <div className={statCardBodyClass}>
                                                    <span className="text-sm font-bold text-slate-500">-</span>
                                                </div>
                                            </div>
                                            <div className={`${statCardClass} text-center`}>
                                                <p className={statLabelClass}>통산 전적</p>
                                                <div className={statCardBodyClass}>
                                                    <span className="text-sm font-bold text-slate-500">-</span>
                                                </div>
                                            </div>
                                            <div className={`${statCardClass} text-center`}>
                                                <p className={statLabelClass}>매너 등급</p>
                                                <div className={statCardBodyClass}>
                                                    <span className="text-sm font-bold text-slate-500">-</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                            {pvpRewardsSection}
                        </div>
                    </div>
                )}
            </div>
            </div>
                <div
                    className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} flex flex-col ${isMobile ? 'mt-1 gap-1 pt-1.5' : 'mt-3 gap-1.5 pt-2.5'} flex-shrink-0 border-t border-amber-500/20 bg-gradient-to-t from-zinc-950/95 via-zinc-900/90 to-transparent px-1 pb-1 sm:px-2 sm:pb-1.5`}
                >
                    {isMobile ? <div className="min-w-0 w-full shrink-0">{pvpRewardsSection}</div> : null}
                    <div className={`${arenaPostGameButtonGridClass} min-w-0 shrink-0`}>
                    {canUseGameRecordUi && onAction && (
                        <button
                            type="button"
                            className={arenaPostGameButtonClass('neutral', isMobile, 'modal')}
                            style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}
                            disabled={savingRecord || recordAlreadySaved}
                            onClick={async () => {
                                if (savingRecord || recordAlreadySaved) return;
                                if (recordCount >= 10) {
                                    alert(GAME_RECORD_SLOT_FULL_MESSAGE);
                                    return;
                                }
                                setSavingRecord(true);
                                try {
                                    const out = await onAction({ type: 'SAVE_GAME_RECORD', payload: { gameId: session.id } });
                                    if (out && typeof out === 'object' && 'error' in out && (out as { error?: string }).error) {
                                        alert((out as { error?: string }).error);
                                        return;
                                    }
                                    setSavedOptimistic(true);
                                } catch (error) {
                                    console.error('Failed to save game record:', error);
                                } finally {
                                    setSavingRecord(false);
                                }
                            }}
                        >
                            {savingRecord ? '저장 중...' : recordAlreadySaved ? '이미 저장됨' : '기보 저장'}
                        </button>
                    )}
                    {canUseGameRecordUi && onOpenGameRecordList && (
                        <button
                            type="button"
                            className={arenaPostGameButtonClass('neutral', isMobile, 'modal')}
                            style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}
                            onClick={() => onOpenGameRecordList()}
                        >
                            기보 관리
                        </button>
                    )}
                    {adventureResultChrome ? (
                        <>
                            <button
                                type="button"
                                className={arenaPostGameButtonClass('neutral', isMobile, 'modal')}
                                style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}
                                onClick={onConfirm}
                            >
                                확인
                            </button>
                            <button
                                type="button"
                                className={arenaPostGameButtonClass('neutral', isMobile, 'modal')}
                                style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}
                                onClick={onLeaveToAdventureMap}
                            >
                                맵으로 이동
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            className={arenaPostGameButtonClass('neutral', isMobile, 'modal')}
                            style={{ fontSize: isMobile ? `${10 * mobileTextScale}px` : undefined }}
                            onClick={onConfirm}
                        >
                            확인
                        </button>
                    )}
                    </div>
                </div>
            </>
        </DraggableWindow>
    );
};

export default GameSummaryModal;
