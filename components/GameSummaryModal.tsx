import React, { useMemo, useEffect, useRef, useState } from 'react';
import { LiveGameSession, User, Player, WinReason, StatChange, AnalysisResult, GameMode, GameSummary, InventoryItem, AvatarInfo, BorderInfo, AlkkagiStone, ServerAction, AlkkagiRoundHistoryEntry } from '../types.js';
import Avatar from './Avatar.js';
import { audioService } from '../services/audioService.js';
import DraggableWindow from './DraggableWindow.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, AVATAR_POOL, BORDER_POOL, CONSUMABLE_ITEMS, EQUIPMENT_POOL, MATERIAL_ITEMS, aiUserId } from '../constants';
import { getAdventureCodexMonsterById } from '../constants/adventureMonstersCodex.js';
import { TOWER_STAGES } from '../constants/towerConstants.js';
import { resolveLiveSessionSinglePlayerStageRow } from '../shared/utils/liveSessionSinglePlayerStage.js';
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
import { ResultModalXpRewardBadge, ResultModalPetGradeUpgradeNeededSlot } from './game/ResultModalXpRewardBadge.js';
import {
    ResultModalGoldCurrencySlot,
    ResultModalItemRewardSlot,
    RESULT_MODAL_REWARDS_ROW_MIN_H_CLASS,
    RESULT_MODAL_REWARDS_ROW_MOBILE_WRAP_CLASS,
    RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS,
} from './game/ResultModalRewardSlot.js';
import { ResultModalVipRewardSlot } from './game/ResultModalVipRewardSlot.js';
import { AdventureBattleRewardRowWithReveal, AdventureResultCodexCard } from './game/adventureResultModalSections.js';
import {
    RESULT_MODAL_BODY_MOBILE_PX,
    RESULT_MODAL_SCORE_MOBILE_PX,
    RESULT_MODAL_DESKTOP_PX,
    resultModalFontPx,
} from './game/resultModalScoreTypography.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { isRewardVipActive } from '../shared/utils/rewardVip.js';
import { VIP_PLAY_REWARD_SLOT_PREVIEW_IMAGE } from '../shared/constants/vipPlayReward.js';
import { useResilientImgSrc } from '../hooks/useResilientImgSrc.js';
import { useGameResultModalLayout } from './game/useGameResultModalLayout.js';
import GameResultModalFitContent from './game/GameResultModalFitContent.js';
import { GoStoneIcon } from './game/arenaRoundEndShared.js';
import ResultAdGoldDoubleButton from './game/ResultAdGoldDoubleButton.js';
import { getEquippedPairPetInventoryRow } from '../shared/utils/pairEquippedPet.js';
import { getPairPetDefinition, getPairPetDisplayName } from '../shared/constants/petLobby.js';
import {
    isPairAiOpponentSyntheticDisplayParticipant,
    resolvePairAiOpponentPetSyntheticDisplayLevel,
} from '../shared/utils/strategicAiDifficulty.js';
import PairPetLevelUpCoreDelta from './pair/PairPetLevelUpCoreDelta.js';
import { effectivePairPetGradeFromRow, pairPetShowsGradeUpgradeNeededInsteadOfXp } from '../shared/constants/pairPetGrade.js';
import {
    ResultModalIdentityRow,
    ResultModalPetPortrait,
    resolveResultModalPortraitPx,
} from './game/ResultModalIdentityRow.js';
import { useTranslation } from 'react-i18next';
import i18n from '../shared/i18n/config.js';
import { translateGameMode } from '../shared/i18n/localizedCatalog.js';
import { isChampionshipVersusKataSummaryDescription } from '../shared/constants/championshipVersusSummary.js';
import { resolvePairPetMetaFromInventoryRow } from '../shared/utils/pairPetRoll.js';

const gs = (key: string, opts?: Record<string, unknown>) => i18n.t(`game:summary.${key}`, opts);

interface GameSummaryModalProps {
    session: LiveGameSession;
    currentUser: User;
    onConfirm: () => void;
    confirmLabel?: string;
    secondaryConfirmAction?: {
        label: string;
        onClick: () => void;
        title?: string;
    };
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
    const pairSeat = session.settings.pairGame?.turnOrder?.find((seat) => seat.participantId === currentUser.id);
    if (pairSeat) return pairSeat.player === winner;
    const isPlayer = currentUser.id === player1.id || currentUser.id === player2.id;
    if (!isPlayer) return null; // Spectators don't have a win/loss status

    return (winner === Player.Black && currentUser.id === blackPlayerId) || 
           (winner === Player.White && currentUser.id === whitePlayerId);
};

const getMannerRank = (score: number) => {
    return getMannerRankShared(score).rank;
};

/** 컬링·알까기 공통: 라벨 없이 돌 + 숫자(·)돌 + 숫자 */
const CurlingAlkkagiTotalScoreRow: React.FC<{
    blackPrimary: React.ReactNode;
    whitePrimary: React.ReactNode;
    compact?: boolean;
    isMobile?: boolean;
    mobileTextScale?: number;
    desktopTextScale?: number;
}> = ({ blackPrimary, whitePrimary, compact, isMobile = false, mobileTextScale = 1, desktopTextScale = 1 }) => {
    const dx = RESULT_MODAL_DESKTOP_PX;
    const numPx = compact
        ? isMobile
            ? resultModalFontPx(15, mobileTextScale)
            : resultModalFontPx(dx.scoreTotal, desktopTextScale)
        : isMobile
          ? resultModalFontPx(20, mobileTextScale)
          : resultModalFontPx(dx.scoreHero, desktopTextScale);
    const stoneCls = compact
        ? isMobile
            ? 'h-6 w-6 sm:h-7 sm:w-7'
            : 'h-5 w-5'
        : isMobile
          ? 'h-7 w-7 sm:h-8 sm:w-8'
          : 'h-6 w-6';
    return (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/28 bg-gradient-to-b from-slate-900/96 via-slate-950/98 to-black px-2.5 py-2 text-center shadow-[0_16px_44px_-22px_rgba(0,0,0,0.75)] ring-1 ring-inset ring-amber-500/14 sm:px-3 sm:py-2.5">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/25 to-transparent" aria-hidden />
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1.5">
                    <GoStoneIcon color="black" className={stoneCls} />
                    <span className="font-mono font-bold tabular-nums tracking-tight text-amber-50" style={{ fontSize: numPx }}>
                        {blackPrimary}
                    </span>
                </div>
                <span
                    className="select-none font-extralight text-slate-600"
                    style={{ fontSize: isMobile ? resultModalFontPx(14, mobileTextScale) : resultModalFontPx(dx.scoreColon, desktopTextScale) }}
                    aria-hidden
                >
                    ·
                </span>
                <div className="flex items-center gap-1.5">
                    <GoStoneIcon color="white" className={stoneCls} />
                    <span className="font-mono font-bold tabular-nums tracking-tight text-amber-50" style={{ fontSize: numPx }}>
                        {whitePrimary}
                    </span>
                </div>
            </div>
        </div>
    );
};

/** 경기 결과 모달: 흑·백 텍스트 대신 바둑돌 아이콘 */
const ResultModalStoneLabel: React.FC<{
    color: 'black' | 'white';
    className?: string;
}> = ({ color, className = 'h-4 w-4 sm:h-5 sm:w-5' }) => (
    <span className="inline-flex items-center justify-center">
        <GoStoneIcon color={color} className={className} />
    </span>
);

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
    const finalPercent = max > 0 ? Math.min(100, (final / max) * 100) : 0;
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
    const barCenterLabel = levelUp ? `0 +${final} / ${max} XP` : `${initial} +${xpGain} / ${max} XP`;

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
                            className="absolute left-0 top-0 z-[1] h-full rounded-l-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-[width] ease-out"
                            style={{ width: `${baseW}%`, transitionDuration: `${XP_BAR_BASE_MS}ms` }}
                        />
                        {gainPercent > 0 && (
                            <div
                                className="pointer-events-none absolute top-0 z-[2] h-full rounded-r-full bg-gradient-to-r from-green-400 to-emerald-500 transition-[width] ease-out"
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
                    {gainPercent > 0 && xpGain > 0 && (
                        <span
                            key={gainTextKey}
                            className={`shrink-0 text-xs font-bold tabular-nums whitespace-nowrap ${
                                showGainText
                                    ? 'text-green-400 animate-fade-in-xp'
                                    : 'pointer-events-none text-green-400 opacity-0'
                            }`}
                            style={{ fontSize: `${10 * mobileTextScale}px` }}
                            aria-hidden={!showGainText}
                        >
                            +{xpGain} XP
                        </span>
                    )}
                </div>
                <div className="w-full min-w-0 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
                    <p
                        className="whitespace-nowrap text-center text-[9px] font-bold tabular-nums text-slate-200"
                        style={{ fontSize: `${8 * mobileTextScale}px` }}
                    >
                        {levelUp ? (
                            <>
                                0 <span className="text-emerald-300">+{final.toLocaleString()}</span> / {max.toLocaleString()} XP
                            </>
                        ) : (
                            <>
                                {initial.toLocaleString()}{' '}
                                <span className="text-emerald-300">+{xpGain}</span> / {max.toLocaleString()} XP
                            </>
                        )}
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
                    className="absolute left-0 top-0 z-[1] h-full rounded-l-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-[width] ease-out"
                    style={{ width: `${baseW}%`, transitionDuration: `${XP_BAR_BASE_MS}ms` }}
                />
                {gainPercent > 0 && (
                    <div
                        className="absolute top-0 z-[2] h-full rounded-r-full bg-gradient-to-r from-green-400 to-emerald-500 transition-[width] ease-out pointer-events-none"
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
                    } font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]`}
                >
                    {barCenterLabel}
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
            {gainPercent > 0 && xpGain > 0 && (
                <span
                    key={gainTextKey}
                    className={`${
                        pcCompact ? 'w-[3.5rem] shrink-0 text-xs' : 'w-[4.25rem] min-[1024px]:w-20 text-sm'
                    } inline-flex shrink-0 items-center justify-end font-bold whitespace-nowrap text-green-400 ${
                        showGainText ? 'animate-fade-in-xp' : 'pointer-events-none opacity-0'
                    }`}
                    aria-hidden={!showGainText}
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

const ScoreDetailsComponent: React.FC<{ analysis: AnalysisResult, session: LiveGameSession, isMobile?: boolean, mobileTextScale?: number, desktopTextScale?: number }> = ({ analysis, isMobile = false, mobileTextScale = 1, desktopTextScale = 1 }) => {
    const { scoreDetails } = analysis;
    const mx = RESULT_MODAL_SCORE_MOBILE_PX;
    const deskPx = (base: number) => resultModalFontPx(base, desktopTextScale);
    const mobPx = (base: number) => resultModalFontPx(base, mobileTextScale);

    if (!scoreDetails) return <p className="text-center text-gray-400" style={{ fontSize: isMobile ? mobPx(mx.emptyState) : deskPx(RESULT_MODAL_DESKTOP_PX.body) }}>{gs('noScoreInfo')}</p>;

    /** 모바일: 프로필이 가로(2열)일 때 흑·백 점수 비교도 가로 2열로 맞춤 */
    const scoreGridTwoColsOnMobile = isMobile;

    const rowClass = 'flex min-w-0 justify-between gap-1.5';
    const labelClass = 'shrink-0 whitespace-nowrap text-slate-400';
    const valClass = 'tabular-nums text-right font-medium text-slate-100';

    return (
        <div className={`space-y-1 sm:space-y-1.5 ${isMobile ? 'text-sm' : ''}`}>
            <div
                className={`grid min-w-0 gap-1 sm:gap-1.5 ${scoreGridTwoColsOnMobile ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}
            >
                <div className={`space-y-0.5 bg-gray-800/50 ${isMobile ? 'p-1.5' : 'px-1.5 py-1'} rounded-md`}>
                    <div className="mb-0.5 flex justify-center">
                        <ResultModalStoneLabel color="black" className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} />
                    </div>
                    <div className={rowClass} style={{ fontSize: isMobile ? mobPx(mx.dataRow) : deskPx(RESULT_MODAL_DESKTOP_PX.scoreData) }}><span className={labelClass}>{gs('territory')}</span> <span className={valClass}>{scoreDetails.black.territory.toFixed(0)}</span></div>
                    <div className={rowClass} style={{ fontSize: isMobile ? mobPx(mx.dataRow) : deskPx(RESULT_MODAL_DESKTOP_PX.scoreData) }}><span className={labelClass}>{gs('captures')}</span> <span className={valClass}>{scoreDetails.black.liveCaptures ?? 0}</span></div>
                    <div className={rowClass} style={{ fontSize: isMobile ? mobPx(mx.dataRow) : deskPx(RESULT_MODAL_DESKTOP_PX.scoreData) }}><span className={labelClass}>{gs('deadStones')}</span> <span className={valClass}>{Math.round(Number(scoreDetails.black.deadStones ?? 0))}</span></div>
                    <div className="mt-0.5 flex min-w-0 justify-between gap-1.5 border-t border-gray-600 pt-0.5 font-bold" style={{ fontSize: isMobile ? mobPx(mx.totalRow) : deskPx(RESULT_MODAL_DESKTOP_PX.scoreTotal) }}><span className="shrink-0 whitespace-nowrap">{gs('total')}</span> <span className="tabular-nums text-yellow-300">{scoreDetails.black.total.toFixed(1)}</span></div>
                </div>
                <div className={`space-y-0.5 bg-gray-800/50 ${isMobile ? 'p-1.5' : 'px-1.5 py-1'} rounded-md`}>
                    <div className="mb-0.5 flex justify-center">
                        <ResultModalStoneLabel color="white" className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} />
                    </div>
                    <div className={rowClass} style={{ fontSize: isMobile ? mobPx(mx.dataRow) : deskPx(RESULT_MODAL_DESKTOP_PX.scoreData) }}><span className={labelClass}>{gs('territory')}</span> <span className={valClass}>{scoreDetails.white.territory.toFixed(0)}</span></div>
                    <div className={rowClass} style={{ fontSize: isMobile ? mobPx(mx.dataRow) : deskPx(RESULT_MODAL_DESKTOP_PX.scoreData) }}><span className={labelClass}>{gs('captures')}</span> <span className={valClass}>{scoreDetails.white.liveCaptures ?? 0}</span></div>
                    <div className={rowClass} style={{ fontSize: isMobile ? mobPx(mx.dataRow) : deskPx(RESULT_MODAL_DESKTOP_PX.scoreData) }}><span className={labelClass}>{gs('deadStones')}</span> <span className={valClass}>{Math.round(Number(scoreDetails.white.deadStones ?? 0))}</span></div>
                    <div className={rowClass} style={{ fontSize: isMobile ? mobPx(mx.dataRow) : deskPx(RESULT_MODAL_DESKTOP_PX.scoreData) }}><span className={labelClass}>{gs('komi')}</span> <span className={valClass}>{scoreDetails.white.komi}</span></div>
                    <div className="mt-0.5 flex min-w-0 justify-between gap-1.5 border-t border-gray-600 pt-0.5 font-bold" style={{ fontSize: isMobile ? mobPx(mx.totalRow) : deskPx(RESULT_MODAL_DESKTOP_PX.scoreTotal) }}><span className="shrink-0 whitespace-nowrap">{gs('total')}</span> <span className="tabular-nums text-yellow-300">{scoreDetails.white.total.toFixed(1)}</span></div>
                </div>
            </div>
        </div>
    );
};

const PlayfulScoreDetailsComponent: React.FC<{ gameSession: LiveGameSession, isMobile?: boolean, mobileTextScale?: number, desktopTextScale?: number }> = ({ gameSession, isMobile = false, mobileTextScale = 1, desktopTextScale = 1 }) => {
    const mx = RESULT_MODAL_SCORE_MOBILE_PX;
    const dx = RESULT_MODAL_DESKTOP_PX;
    const mobPx = (base: number) => resultModalFontPx(base, mobileTextScale);
    const deskPx = (base: number) => resultModalFontPx(base, desktopTextScale);
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

    if (gameSession.mode === GameMode.Thief) {
        type ThiefRoundRow = {
            round: number;
            p1: { escaped: number; captured: number; total: number };
            p2: { escaped: number; captured: number; total: number };
        };
        const explicitHistory = (gameSession.thiefRoundHistory ?? [])
            .slice()
            .sort((a, b) => a.round - b.round)
            .map<ThiefRoundRow>((h) => ({
                round: h.round,
                p1: {
                    escaped: Math.max(0, Number(h.player1.escapedStones) || 0),
                    captured: Math.max(0, Number(h.player1.capturedStones) || 0),
                    total: Math.max(0, Number(h.player1.roundScore) || 0),
                },
                p2: {
                    escaped: Math.max(0, Number(h.player2.escapedStones) || 0),
                    captured: Math.max(0, Number(h.player2.capturedStones) || 0),
                    total: Math.max(0, Number(h.player2.roundScore) || 0),
                },
            }));
        const rows: ThiefRoundRow[] = explicitHistory.length > 0
            ? explicitHistory
            : (() => {
                  const rs = gameSession.thiefRoundSummary;
                  if (!rs) return [];
                  const r2p1 = Math.max(0, Number(rs.player1.roundScore) || 0);
                  const r2p2 = Math.max(0, Number(rs.player2.roundScore) || 0);
                  const c1 = Math.max(0, Number(rs.player1.cumulativeScore) || 0);
                  const c2 = Math.max(0, Number(rs.player2.cumulativeScore) || 0);
                  const out: ThiefRoundRow[] = [];
                  if (rs.round >= 2) {
                      out.push({
                          round: 1,
                          p1: { escaped: 0, captured: 0, total: Math.max(0, c1 - r2p1) },
                          p2: { escaped: 0, captured: 0, total: Math.max(0, c2 - r2p2) },
                      });
                  }
                  out.push({
                      round: rs.round,
                      p1: { escaped: 0, captured: 0, total: r2p1 },
                      p2: { escaped: 0, captured: 0, total: r2p2 },
                  });
                  return out;
              })();

        return (
            <div className={`mx-auto w-full max-w-[32rem] ${isMobile ? 'space-y-1.5' : 'space-y-2'}`}>
                <div className="rounded-lg border border-amber-500/20 bg-gray-900/55 p-1.5 sm:p-2">
                    <table className="w-full table-fixed border-separate border-spacing-y-1 text-center">
                        <thead>
                            <tr className="text-[10px] uppercase tracking-wide text-amber-200/90 sm:text-xs">
                                <th className="w-[16%]">{gs("round")}</th>
                                <th className="w-[28%]">{player1.nickname}</th>
                                <th className="w-[28%]">{player2.nickname}</th>
                                <th className="w-[28%]">{gs("totalScore")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => {
                                const p1Round = row.p1.total;
                                const p2Round = row.p2.total;
                                return (
                                    <tr key={`thief-round-${row.round}`} className="text-[11px] sm:text-xs">
                                        <td className="rounded-md bg-black/25 px-1 py-1 font-bold text-zinc-200">{row.round}R</td>
                                        <td className="rounded-md bg-black/20 px-1 py-1 text-zinc-100">
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="text-zinc-300">{gs("escaped")}</span>
                                                <span className="font-mono tabular-nums">{row.p1.escaped}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="text-zinc-300">{gs("capturedStones")}</span>
                                                <span className="font-mono tabular-nums">{row.p1.captured}</span>
                                            </div>
                                        </td>
                                        <td className="rounded-md bg-black/20 px-1 py-1 text-zinc-100">
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="text-zinc-300">{gs("escaped")}</span>
                                                <span className="font-mono tabular-nums">{row.p2.escaped}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="text-zinc-300">{gs("capturedStones")}</span>
                                                <span className="font-mono tabular-nums">{row.p2.captured}</span>
                                            </div>
                                        </td>
                                        <td className="rounded-md bg-black/20 px-1 py-1">
                                            <div className="flex items-center justify-between gap-1 text-zinc-100">
                                                <span className="text-zinc-300">P1</span>
                                                <span className="font-mono tabular-nums">{p1Round}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-1 text-zinc-100">
                                                <span className="text-zinc-300">P2</span>
                                                <span className="font-mono tabular-nums">{p2Round}</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="rounded-lg border border-amber-500/30 bg-gradient-to-b from-gray-900/75 to-black/70 px-2 py-1.5 text-center">
                    <p className="text-gray-300" style={{ fontSize: isMobile ? mobPx(mx.sectionLabel) : deskPx(dx.body) }}>{gs('finalScore')}</p>
                    <p className="font-mono font-bold tabular-nums text-amber-100" style={{ fontSize: isMobile ? mobPx(22) : deskPx(dx.scoreHero) }}>
                        {p1TotalScore} : {p2TotalScore}
                    </p>
                </div>
            </div>
        );
    }

    if (!hasBonus) {
        return (
            <div className="text-center">
                <p className="text-gray-300" style={{ fontSize: isMobile ? mobPx(mx.columnHead) : deskPx(dx.body) }}>{gs("finalScore")}</p>
                <p className="my-1 font-mono font-bold" style={{ fontSize: isMobile ? mobPx(22) : deskPx(dx.scoreHero) }}>{p1TotalScore} : {p2TotalScore}</p>
            </div>
        );
    }
    
    return (
        <div className={`mx-auto w-full max-w-md space-y-2 sm:space-y-3`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div className={`space-y-0.5 sm:space-y-1 bg-gray-800/50 ${isMobile ? 'p-1.5' : 'p-1.5'} rounded-md`}>
                    <h3 className="font-bold text-center mb-0.5 sm:mb-1" style={{ fontSize: isMobile ? mobPx(mx.columnHead) : deskPx(dx.scoreHead) }}>{player1.nickname}</h3>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? mobPx(mx.dataRow) : deskPx(dx.scoreData) }}><span>{gs('captureScore')}</span> <span>{p1CaptureScore}</span></div>
                    {p1Bonus > 0 && <div className="flex justify-between" style={{ fontSize: isMobile ? mobPx(mx.dataRow) : deskPx(dx.scoreData) }}><span>{gs('lastPileBonus')}</span> <span className="text-green-400">+{p1Bonus}</span></div>}
                    <div className="flex justify-between border-t border-gray-600 pt-0.5 sm:pt-1 mt-0.5 sm:mt-1 font-bold" style={{ fontSize: isMobile ? mobPx(mx.totalRow) : deskPx(dx.scoreTotal) }}>
                        <span>{gs('total')}:</span> <span className="text-yellow-300">{p1TotalScore}</span>
                    </div>
                </div>
                <div className={`space-y-0.5 sm:space-y-1 bg-gray-800/50 ${isMobile ? 'p-1.5' : 'p-1.5'} rounded-md`}>
                    <h3 className="font-bold text-center mb-0.5 sm:mb-1" style={{ fontSize: isMobile ? mobPx(mx.columnHead) : deskPx(dx.scoreHead) }}>{player2.nickname}</h3>
                    <div className="flex justify-between" style={{ fontSize: isMobile ? mobPx(mx.dataRow) : deskPx(dx.scoreData) }}><span>{gs('captureScore')}</span> <span>{p2CaptureScore}</span></div>
                    {p2Bonus > 0 && <div className="flex justify-between" style={{ fontSize: isMobile ? mobPx(mx.dataRow) : deskPx(dx.scoreData) }}><span>{gs('lastPileBonus')}</span> <span className="text-green-400">+{p2Bonus}</span></div>}
                    <div className="flex justify-between border-t border-gray-600 pt-0.5 sm:pt-1 mt-0.5 sm:mt-1 font-bold" style={{ fontSize: isMobile ? mobPx(mx.totalRow) : deskPx(dx.scoreTotal) }}>
                        <span>{gs('total')}:</span> <span className="text-yellow-300">{p2TotalScore}</span>
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
    desktopTextScale?: number;
    /** 길드전 따내기: 획득 집점수(집) — 최종 스코어 블록 안에 표시 */
    guildWarHouseScore?: number;
}> = ({ session, isMobile = false, mobileTextScale = 1, desktopTextScale = 1, guildWarHouseScore }) => {
    const mx = RESULT_MODAL_SCORE_MOBILE_PX;
    const dx = RESULT_MODAL_DESKTOP_PX;
    const mobPx = (base: number) => resultModalFontPx(base, mobileTextScale);
    const deskPx = (base: number) => resultModalFontPx(base, desktopTextScale);
    const { captures, blackPlayerId, whitePlayerId, player1, player2, winner } = session;
    const blackCaptures = captures[Player.Black] || 0;
    const whiteCaptures = captures[Player.White] || 0;
    
    const blackPlayer = blackPlayerId === player1.id ? player1 : player2;
    const whitePlayer = whitePlayerId === player1.id ? player1 : player2;
    
    const blackWon = winner === Player.Black;
    const whiteWon = winner === Player.White;
    
    return (
        <div className="space-y-1.5 text-center sm:space-y-2">
            <p
                className="mb-1 text-gray-300"
                style={{ fontSize: isMobile ? mobPx(mx.sectionLabel) : deskPx(dx.body) }}
            >
                {gs('finalScoreLabel')}
            </p>
                <div className="flex flex-wrap items-end justify-center gap-x-2 gap-y-0.5 sm:gap-x-3">
                <div className="flex flex-col items-center gap-0.5">
                    <ResultModalStoneLabel
                        color="black"
                        className={isMobile ? 'h-5 w-5' : 'h-6 w-6'}
                    />
                    <span
                        className={`font-mono font-bold ${blackWon ? 'text-green-400' : 'text-white'}`}
                        style={{ fontSize: isMobile ? mobPx(22) : deskPx(dx.scoreHero) }}
                    >
                        {blackCaptures}
                    </span>
                </div>
                <span
                    className="pb-0.5 font-bold text-gray-400"
                    style={{ fontSize: isMobile ? mobPx(18) : deskPx(dx.scoreColon) }}
                >
                    :
                </span>
                <div className="flex flex-col items-center gap-0.5">
                    <ResultModalStoneLabel
                        color="white"
                        className={isMobile ? 'h-5 w-5' : 'h-6 w-6'}
                    />
                    <span
                        className={`font-mono font-bold ${whiteWon ? 'text-green-400' : 'text-white'}`}
                        style={{ fontSize: isMobile ? mobPx(22) : deskPx(dx.scoreHero) }}
                    >
                        {whiteCaptures}
                    </span>
                </div>
            </div>
            {typeof guildWarHouseScore === 'number' && !Number.isNaN(guildWarHouseScore) && (
                <p
                    className="mt-1 text-center font-semibold tabular-nums text-cyan-200/95"
                    style={{ fontSize: isMobile ? mobPx(mx.sectionLabel) : deskPx(dx.body) }}
                >
                    {gs('houseScoreGain')}{' '}
                    <span className="font-black text-cyan-100/95">
                        {Number.isInteger(guildWarHouseScore) ? guildWarHouseScore : guildWarHouseScore.toFixed(1)}{gs('houseUnit')}
                    </span>
                </p>
            )}
            {blackWon && (
                <p
                    className="font-bold text-green-400"
                    style={{ fontSize: isMobile ? mobPx(mx.columnHead) : deskPx(dx.winBanner) }}
                >
                    {gs('playerWins', { name: blackPlayer.nickname })}
                </p>
            )}
            {whiteWon && (
                <p
                    className="font-bold text-green-400"
                    style={{ fontSize: isMobile ? mobPx(mx.columnHead) : deskPx(dx.winBanner) }}
                >
                    {gs('playerWins', { name: whitePlayer.nickname })}
                </p>
            )}
        </div>
    );
};

const CurlingScoreDetailsComponent: React.FC<{ gameSession: LiveGameSession, isMobile?: boolean, mobileTextScale?: number, mobileImageScale?: number, desktopTextScale?: number }> = ({
    gameSession,
    isMobile = false,
    mobileTextScale = 1,
    mobileImageScale: _mobileImageScale = 1,
    desktopTextScale = 1,
}) => {
    const mx = RESULT_MODAL_SCORE_MOBILE_PX;
    const dx = RESULT_MODAL_DESKTOP_PX;
    const mobPx = (base: number) => resultModalFontPx(base, mobileTextScale);
    const deskPx = (base: number) => resultModalFontPx(base, desktopTextScale);
    const { curlingScores, player1, player2, blackPlayerId, whitePlayerId } = gameSession;
    if (!curlingScores) return <p className={`text-center text-gray-400 ${isMobile ? 'text-sm' : ''}`} style={{ fontSize: isMobile ? `${mx.emptyState * mobileTextScale}px` : undefined }}>{gs("noScoreInfo")}</p>;

    const blackPlayer = blackPlayerId === player1.id ? player1 : player2;
    const whitePlayer = whitePlayerId === player1.id ? player1 : player2;
    
    const blackScore = curlingScores[Player.Black] || 0;
    const whiteScore = curlingScores[Player.White] || 0;

    // 라운드별 점수 히스토리 — 표시 행은 최소 3라운드(미진행은 "-"), 설정이 3보다 크면 그만큼 표시
    const roundHistory = (gameSession as any).curlingRoundHistory || [];
    const configuredCurlingRounds = Math.max(1, Number(gameSession.settings?.curlingRounds) || 3);
    const displayRoundCount = Math.max(3, configuredCurlingRounds);
    const roundNums = Array.from({ length: displayRoundCount }, (_, i) => i + 1);
    const curlingRoundAt = (roundNum: number) => roundHistory.find((r: any) => r.round === roundNum);

    /** 상단 MatchPlayersRoster와 중복되지 않도록 아바타 없이 누적 점수만 고급스럽게 표시 */
    const curlingScoreStrip = (
        <div
            className={`relative mx-auto w-full overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#12151f] via-[#0b0e14] to-[#06080c] shadow-[0_12px_40px_-18px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-inset ring-amber-400/12 ${isMobile ? 'max-w-md px-3 py-2' : 'max-w-lg px-4 py-2.5'}`}
        >
            <div
                className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent"
                aria-hidden
            />
            <div className="pointer-events-none absolute -left-16 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-cyan-500/[0.06] blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -right-16 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-amber-400/[0.07] blur-3xl" aria-hidden />
            <div className={`relative flex items-stretch justify-between gap-2 ${isMobile ? 'min-h-[3.5rem]' : 'min-h-[3.25rem]'}`}>
                <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-center">
                    <GoStoneIcon color="black" className={isMobile ? 'h-8 w-8 sm:h-9 sm:w-9' : 'h-7 w-7 sm:h-8 sm:w-8'} />
                    <span className="max-w-full truncate px-0.5 text-[10px] font-medium text-slate-500 sm:text-xs" title={blackPlayer.nickname}>
                        {blackPlayer.nickname}
                    </span>
                </div>
                <div className="mx-1 flex w-px shrink-0 self-stretch bg-gradient-to-b from-transparent via-amber-500/25 to-transparent sm:mx-2" aria-hidden />
                <div
                    className={`flex shrink-0 items-center justify-center gap-0.5 font-mono tabular-nums tracking-tight leading-none`}
                    style={{ fontSize: isMobile ? mobPx(22) : deskPx(dx.scoreHero) }}
                >
                    <span className="bg-gradient-to-b from-white via-amber-50 to-amber-200/90 bg-clip-text font-black text-transparent drop-shadow-[0_2px_18px_rgba(251,191,36,0.22)]">
                        {blackScore}
                    </span>
                    <span
                        className="font-extralight text-slate-600"
                        style={{ fontSize: isMobile ? mobPx(16) : deskPx(dx.scoreColon) }}
                        aria-hidden
                    >
                        :
                    </span>
                    <span className="bg-gradient-to-b from-white via-amber-50 to-amber-200/90 bg-clip-text font-black text-transparent drop-shadow-[0_2px_18px_rgba(251,191,36,0.22)]">
                        {whiteScore}
                    </span>
                </div>
                <div className="mx-1 flex w-px shrink-0 self-stretch bg-gradient-to-b from-transparent via-amber-500/25 to-transparent sm:mx-2" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-center">
                    <GoStoneIcon color="white" className={isMobile ? 'h-8 w-8 sm:h-9 sm:w-9' : 'h-7 w-7 sm:h-8 sm:w-8'} />
                    <span className="max-w-full truncate px-0.5 text-[10px] font-medium text-slate-500 sm:text-xs" title={whitePlayer.nickname}>
                        {whitePlayer.nickname}
                    </span>
                </div>
            </div>
            <p className="relative mt-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/40">{gs("cumulativeScore")}</p>
        </div>
    );

    if (isMobile) {
        return (
            <div className="mx-auto w-full max-w-md space-y-2 text-left sm:space-y-2.5">
                <div className="text-center">{curlingScoreStrip}</div>
                <p className="text-center text-sm font-bold text-amber-200/95" style={{ fontSize: `${13 * mobileTextScale}px` }}>
                    {gs('roundScores')}
                </p>
                <div className="overflow-hidden rounded-xl border border-amber-500/25 bg-gradient-to-br from-slate-900/92 via-slate-950/90 to-zinc-950/95 ring-1 ring-inset ring-white/[0.06]">
                    <div className="grid grid-cols-[0.95fr_1.05fr] items-center border-b border-amber-500/15 bg-black/35 px-2.5 py-1.5">
                        <span
                            className="text-left text-[10px] font-bold uppercase tracking-[0.1em] text-amber-100/90"
                            style={{ fontSize: `${10 * mobileTextScale}px` }}
                        >
                            {gs('round')}
                        </span>
                        <span
                            className="text-right text-[10px] font-bold uppercase tracking-[0.1em] text-amber-100/90"
                            style={{ fontSize: `${10 * mobileTextScale}px` }}
                        >
                            {gs('roundScoreBlackWhite')}
                        </span>
                    </div>
                    {roundNums.map((roundNum) => {
                        const roundData = curlingRoundAt(roundNum);
                        const played = Boolean(roundData);
                        const blackRoundScore = played ? roundData!.black.total : null;
                        const whiteRoundScore = played ? roundData!.white.total : null;
                        return (
                            <div
                                key={roundNum}
                                className={`grid grid-cols-[0.95fr_1.05fr] items-center px-2.5 py-2 ${
                                    roundNum < displayRoundCount ? 'border-b border-white/[0.05]' : ''
                                } ${played ? 'bg-transparent' : 'bg-slate-950/40'}`}
                            >
                                <div
                                    className="text-left font-mono text-xs font-bold tabular-nums text-amber-200/95"
                                    style={{ fontSize: `${11 * mobileTextScale}px` }}
                                >
                                    {roundNum}R
                                </div>
                                <div
                                    className="text-right font-mono text-sm font-bold tabular-nums text-slate-100"
                                    style={{ fontSize: `${12 * mobileTextScale}px` }}
                                >
                                    {played ? (
                                        <>
                                            <span className="text-amber-100/95">{blackRoundScore}</span>
                                            <span className="px-1 text-slate-500">:</span>
                                            <span className="text-slate-50">{whiteRoundScore}</span>
                                        </>
                                    ) : (
                                        <span className="font-medium text-slate-500">-</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <CurlingAlkkagiTotalScoreRow
                    compact
                    blackPrimary={blackScore}
                    whitePrimary={whiteScore}
                    isMobile={isMobile}
                    mobileTextScale={mobileTextScale}
                    desktopTextScale={desktopTextScale}
                />
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-lg space-y-1.5 text-center sm:space-y-2">
            <div className="relative mt-0.5 overflow-hidden rounded-2xl border border-amber-500/22 bg-gradient-to-b from-slate-900/[0.97] via-slate-950/95 to-zinc-950 shadow-[0_22px_55px_-28px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-inset ring-white/[0.05]">
                <div
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_95%_48%_at_50%_-18%,rgba(251,191,36,0.1),transparent_58%)]"
                    aria-hidden
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/35 to-transparent" aria-hidden />
                <div className="relative p-2 sm:p-2.5">
                    <div className="overflow-hidden rounded-xl ring-1 ring-inset ring-white/[0.05]">
                        <table className="w-full table-fixed border-collapse leading-tight" style={{ fontSize: deskPx(dx.scoreData) }}>
                            <thead>
                                <tr className="border-b border-amber-500/12 bg-gradient-to-b from-zinc-800/95 to-zinc-900/98">
                                    <th className="w-[14%] bg-zinc-900/60 px-0.5 py-1" aria-hidden />
                                    <th
                                        className="border-l border-amber-500/18 bg-black/25 px-1 py-1 text-center text-[10px] font-bold tracking-wide text-stone-100 sm:text-[11px]"
                                        colSpan={2}
                                    >
                                        <span className="inline-flex items-center justify-center">
                                            <GoStoneIcon color="black" className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </span>
                                    </th>
                                    <th
                                        className="border-l border-amber-500/18 bg-slate-800/35 px-1 py-1 text-center text-[10px] font-bold tracking-wide text-slate-50 sm:text-[11px]"
                                        colSpan={2}
                                    >
                                        <span className="inline-flex items-center justify-center">
                                            <GoStoneIcon color="white" className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </span>
                                    </th>
                                </tr>
                                <tr className="border-b border-amber-500/12 bg-black/40">
                                    <th className="px-1 py-0.5 text-center text-[9px] font-bold uppercase tracking-[0.1em] text-amber-100/90 sm:text-[10px]">
                                        {gs('round')}
                                    </th>
                                    <th className="border-l border-amber-500/12 px-0.5 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[10px]">
                                        {gs('house')}
                                    </th>
                                    <th className="px-0.5 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[10px]">
                                        {gs('knockout')}
                                    </th>
                                    <th className="border-l border-amber-500/12 px-0.5 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[10px]">
                                        {gs('house')}
                                    </th>
                                    <th className="px-0.5 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[10px]">
                                        {gs('knockout')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {roundNums.map((roundNum) => {
                                    const roundData = curlingRoundAt(roundNum);
                                    const played = Boolean(roundData);
                                    const blackHouse = played ? roundData!.black.houseScore : null;
                                    const blackKnockout = played ? roundData!.black.knockoutScore : null;
                                    const blackPreviousKnockout = played ? (roundData!.black?.previousKnockoutScore ?? 0) : 0;
                                    const whiteHouse = played ? roundData!.white.houseScore : null;
                                    const whiteKnockout = played ? roundData!.white.knockoutScore : null;
                                    const whitePreviousKnockout = played ? (roundData!.white?.previousKnockoutScore ?? 0) : 0;
                                    const rowBg = played ? 'bg-transparent' : 'bg-slate-950/45';
                                    return (
                                        <tr key={roundNum} className={`border-b border-white/[0.05] last:border-b-0 ${rowBg}`}>
                                            <td className="align-middle px-1 py-1 text-center">
                                                <span className="font-mono text-xs font-bold tabular-nums text-amber-200/95 sm:text-sm">
                                                    {roundNum}R
                                                </span>
                                            </td>
                                            <td className="border-l border-amber-500/10 px-0.5 py-1 text-center align-middle font-mono tabular-nums text-slate-100">
                                                {played ? (
                                                    <span className="text-xs font-semibold text-stone-100 sm:text-sm">{blackHouse}</span>
                                                ) : (
                                                    <span className="text-sm font-medium text-slate-500 sm:text-base">-</span>
                                                )}
                                            </td>
                                            <td className="px-0.5 py-1 text-center align-middle font-mono tabular-nums text-slate-100">
                                                {played ? (
                                                    <div className="flex flex-col items-center justify-center gap-0 leading-none">
                                                        <span className="text-xs font-semibold text-stone-100 sm:text-sm">{blackKnockout}</span>
                                                        {blackPreviousKnockout > 0 && (
                                                            <span className="max-w-[5rem] text-[8px] font-medium leading-tight text-slate-500">{gs("previousKnockout", { count: blackPreviousKnockout })}</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm font-medium text-slate-500 sm:text-base">-</span>
                                                )}
                                            </td>
                                            <td className="border-l border-amber-500/10 px-0.5 py-1 text-center align-middle font-mono tabular-nums text-slate-100">
                                                {played ? (
                                                    <span className="text-xs font-semibold text-slate-50 sm:text-sm">{whiteHouse}</span>
                                                ) : (
                                                    <span className="text-sm font-medium text-slate-500 sm:text-base">-</span>
                                                )}
                                            </td>
                                            <td className="px-0.5 py-1 text-center align-middle font-mono tabular-nums text-slate-100">
                                                {played ? (
                                                    <div className="flex flex-col items-center justify-center gap-0 leading-none">
                                                        <span className="text-xs font-semibold text-slate-50 sm:text-sm">{whiteKnockout}</span>
                                                        {whitePreviousKnockout > 0 && (
                                                            <span className="max-w-[5rem] text-[8px] font-medium leading-tight text-slate-500">{gs("previousKnockout", { count: whitePreviousKnockout })}</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm font-medium text-slate-500 sm:text-base">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <CurlingAlkkagiTotalScoreRow
                compact
                blackPrimary={blackScore}
                whitePrimary={whiteScore}
                isMobile={false}
                mobileTextScale={mobileTextScale}
                desktopTextScale={desktopTextScale}
            />
        </div>
    );
};

const AlkkagiScoreDetailsComponent: React.FC<{ gameSession: LiveGameSession; isMobile?: boolean; mobileTextScale?: number; desktopTextScale?: number }> = ({ gameSession, isMobile = false, mobileTextScale = 1, desktopTextScale = 1 }) => {
    const dx = RESULT_MODAL_DESKTOP_PX;
    const deskPx = (base: number) => resultModalFontPx(base, desktopTextScale);
    const { player1, player2, blackPlayerId, whitePlayerId, winner, alkkagiRoundHistory, settings } = gameSession;
    const blackPlayer = blackPlayerId === player1.id ? player1 : player2;
    const whitePlayer = whitePlayerId === player1.id ? player1 : player2;
    const totalRounds = settings?.alkkagiRounds || 1;
    const history: AlkkagiRoundHistoryEntry[] = alkkagiRoundHistory || [];
    const blackTotalScore = history.reduce((sum, r) => sum + Math.max(0, Number(r.blackKnockout ?? 0)), 0);
    const whiteTotalScore = history.reduce((sum, r) => sum + Math.max(0, Number(r.whiteKnockout ?? 0)), 0);
    const displayRoundCount = Math.max(3, totalRounds);
    const roundNums = Array.from({ length: displayRoundCount }, (_, i) => i + 1);
    const alkkagiRoundAt = (roundNum: number) => history.find((r: AlkkagiRoundHistoryEntry) => r.round === roundNum);
    if (isMobile) {
        return (
            <div className="mx-auto w-full max-w-md space-y-1 text-left">
                <p
                    className="text-center text-xs font-bold leading-none text-amber-200/95"
                    style={{ fontSize: `${12 * mobileTextScale}px` }}
                >
                    {gs('roundResults')}
                </p>
                <div className="flex flex-col gap-1">
                    {roundNums.map((roundNum) => {
                        const roundData = alkkagiRoundAt(roundNum);
                        const played = Boolean(roundData);
                        const blackFor = played ? (roundData!.blackKnockout ?? 0) : null;
                        const blackAgainst = played ? (roundData!.whiteKnockout ?? 0) : null;
                        const whiteFor = played ? (roundData!.whiteKnockout ?? 0) : null;
                        const whiteAgainst = played ? (roundData!.blackKnockout ?? 0) : null;
                        return (
                            <div
                                key={roundNum}
                                className={`relative overflow-hidden rounded-xl border px-2 py-1 shadow-inner ring-1 ring-inset ring-white/[0.06] ${
                                    played
                                        ? 'border-amber-500/25 bg-gradient-to-br from-slate-900/92 via-slate-950/90 to-zinc-950/95'
                                        : 'border-slate-600/35 bg-slate-950/55'
                                }`}
                            >
                                <div
                                    className="mb-1 text-center font-mono text-sm font-bold tabular-nums text-amber-200/95"
                                    style={{ fontSize: `${14 * mobileTextScale}px` }}
                                >
                                    {roundNum}R
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                    <div className="min-w-0 rounded-md border border-stone-600/40 bg-black/30 px-1.5 py-1 ring-1 ring-inset ring-stone-500/10">
                                        <div className="flex min-w-0 items-center gap-1.5">
                                            <GoStoneIcon color="black" className="h-4 w-4 shrink-0" />
                                        </div>
                                        <p
                                            className="mt-1 flex min-w-0 items-baseline justify-between gap-1 text-[9px] font-medium leading-none text-slate-200"
                                            style={{ fontSize: `${9 * mobileTextScale}px` }}
                                        >
                                            <span className="shrink-0 text-slate-400">{gs("scored")}</span>
                                            <span className="font-mono font-bold tabular-nums text-amber-100">
                                                {played ? blackFor : <span className="font-medium text-slate-500">-</span>}
                                            </span>
                                        </p>
                                        <p
                                            className="mt-0.5 flex min-w-0 items-baseline justify-between gap-1 text-[9px] font-medium leading-none text-slate-200"
                                            style={{ fontSize: `${9 * mobileTextScale}px` }}
                                        >
                                            <span className="shrink-0 text-slate-400">{gs("conceded")}</span>
                                            <span className="font-mono font-bold tabular-nums text-rose-200">
                                                {played ? blackAgainst : <span className="font-medium text-slate-500">-</span>}
                                            </span>
                                        </p>
                                    </div>
                                    <div className="min-w-0 rounded-md border border-slate-500/40 bg-slate-950/55 px-1.5 py-1 ring-1 ring-inset ring-slate-400/10">
                                        <div className="flex min-w-0 items-center gap-1.5">
                                            <GoStoneIcon color="white" className="h-4 w-4 shrink-0" />
                                        </div>
                                        <p
                                            className="mt-1 flex min-w-0 items-baseline justify-between gap-1 text-[9px] font-medium leading-none text-slate-200"
                                            style={{ fontSize: `${9 * mobileTextScale}px` }}
                                        >
                                            <span className="shrink-0 text-slate-400">{gs("scored")}</span>
                                            <span className="font-mono font-bold tabular-nums text-amber-100">
                                                {played ? whiteFor : <span className="font-medium text-slate-500">-</span>}
                                            </span>
                                        </p>
                                        <p
                                            className="mt-0.5 flex min-w-0 items-baseline justify-between gap-1 text-[9px] font-medium leading-none text-slate-200"
                                            style={{ fontSize: `${9 * mobileTextScale}px` }}
                                        >
                                            <span className="shrink-0 text-slate-400">{gs("conceded")}</span>
                                            <span className="font-mono font-bold tabular-nums text-rose-200">
                                                {played ? whiteAgainst : <span className="font-medium text-slate-500">-</span>}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <CurlingAlkkagiTotalScoreRow
                    compact
                    isMobile
                    mobileTextScale={mobileTextScale}
                    desktopTextScale={desktopTextScale}
                    blackPrimary={
                        <>
                            {blackTotalScore}
                            <span className="ml-0.5 font-semibold text-amber-200/90" style={{ fontSize: resultModalFontPx(10, mobileTextScale) }}>{gs("pointsUnit")}</span>
                        </>
                    }
                    whitePrimary={
                        <>
                            {whiteTotalScore}
                            <span className="ml-0.5 font-semibold text-amber-200/90" style={{ fontSize: resultModalFontPx(10, mobileTextScale) }}>{gs("pointsUnit")}</span>
                        </>
                    }
                />
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-lg space-y-1 text-center sm:space-y-1.5">
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/22 bg-gradient-to-b from-slate-900/[0.97] via-slate-950/95 to-zinc-950 shadow-[0_22px_55px_-28px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-inset ring-white/[0.05]">
                <div
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_95%_48%_at_50%_-18%,rgba(251,191,36,0.09),transparent_58%)]"
                    aria-hidden
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/35 to-transparent" aria-hidden />
                <div className="relative p-1.5 sm:p-2">
                    <div className="overflow-hidden rounded-xl ring-1 ring-inset ring-white/[0.05]">
                        <div className="leading-tight" style={{ fontSize: deskPx(dx.scoreData) }}>
                            <table className="w-full table-fixed border-collapse">
                                <thead>
                                    <tr className="border-b border-amber-500/12 bg-gradient-to-b from-zinc-800/95 to-zinc-900/98">
                                        <th className="w-[14%] bg-zinc-900/60 px-1 py-1 sm:py-1.5" aria-hidden />
                                        <th className="border-l border-amber-500/18 bg-black/25 px-1 py-1 text-center sm:px-2 sm:py-1.5" colSpan={2}>
                                            <div className="flex flex-col items-center justify-center gap-1">
                                                <div className="flex items-center justify-center">
                                                    <GoStoneIcon color="black" className="h-5 w-5 sm:h-6 sm:w-6" />
                                                </div>
                                            </div>
                                        </th>
                                        <th className="border-l border-amber-500/18 bg-slate-800/35 px-1 py-1 text-center sm:px-2 sm:py-1.5" colSpan={2}>
                                            <div className="flex flex-col items-center justify-center gap-1">
                                                <div className="flex items-center justify-center">
                                                    <GoStoneIcon color="white" className="h-5 w-5 sm:h-6 sm:w-6" />
                                                </div>
                                            </div>
                                        </th>
                                    </tr>
                                    <tr className="border-b border-amber-500/12 bg-black/40">
                                        <th className="px-1 py-0.5 text-center text-[9px] font-bold uppercase tracking-[0.1em] text-amber-100/90 sm:text-[10px]">
                                            {gs('round')}
                                        </th>
                                        <th className="border-l border-amber-500/12 px-0.5 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[10px]">
                                            {gs('scored')}
                                        </th>
                                        <th className="px-0.5 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[10px]">
                                            {gs('conceded')}
                                        </th>
                                        <th className="border-l border-amber-500/12 px-0.5 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[10px]">
                                            {gs('scored')}
                                        </th>
                                        <th className="px-0.5 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[10px]">
                                            {gs('conceded')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {roundNums.map((roundNum) => {
                                        const roundData = alkkagiRoundAt(roundNum);
                                        const played = Boolean(roundData);
                                        const blackFor = played ? (roundData!.blackKnockout ?? 0) : null;
                                        const blackAgainst = played ? (roundData!.whiteKnockout ?? 0) : null;
                                        const whiteFor = played ? (roundData!.whiteKnockout ?? 0) : null;
                                        const whiteAgainst = played ? (roundData!.blackKnockout ?? 0) : null;
                                        const rowBg = played ? 'bg-transparent' : 'bg-slate-950/45';
                                        return (
                                            <tr key={roundNum} className={`border-b border-white/[0.05] last:border-b-0 ${rowBg}`}>
                                                <td className="align-middle px-1 py-1 text-center sm:py-1.5">
                                                    <span className="font-mono text-sm font-bold tabular-nums text-amber-200/95 sm:text-base">
                                                        {roundNum}R
                                                    </span>
                                                </td>
                                                <td className="border-l border-amber-500/10 px-0.5 py-1 text-center align-middle font-mono tabular-nums text-slate-100 sm:py-1.5">
                                                    {played ? (
                                                        <span className="text-sm font-semibold sm:text-base">{blackFor}</span>
                                                    ) : (
                                                        <span className="text-lg font-medium text-slate-500 sm:text-xl">-</span>
                                                    )}
                                                </td>
                                                <td className="px-0.5 py-1 text-center align-middle font-mono tabular-nums text-slate-100 sm:py-1.5">
                                                    {played ? (
                                                        <span className="text-sm font-semibold text-rose-200 sm:text-base">{blackAgainst}</span>
                                                    ) : (
                                                        <span className="text-lg font-medium text-slate-500 sm:text-xl">-</span>
                                                    )}
                                                </td>
                                                <td className="border-l border-amber-500/10 px-0.5 py-1 text-center align-middle font-mono tabular-nums text-slate-100 sm:py-1.5">
                                                    {played ? (
                                                        <span className="text-sm font-semibold sm:text-base">{whiteFor}</span>
                                                    ) : (
                                                        <span className="text-lg font-medium text-slate-500 sm:text-xl">-</span>
                                                    )}
                                                </td>
                                                <td className="px-0.5 py-1 text-center align-middle font-mono tabular-nums text-slate-100 sm:py-1.5">
                                                    {played ? (
                                                        <span className="text-sm font-semibold text-rose-200 sm:text-base">{whiteAgainst}</span>
                                                    ) : (
                                                        <span className="text-lg font-medium text-slate-500 sm:text-xl">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            <CurlingAlkkagiTotalScoreRow
                isMobile={false}
                mobileTextScale={mobileTextScale}
                desktopTextScale={desktopTextScale}
                blackPrimary={
                    <>
                        {blackTotalScore}
                        <span className="ml-0.5 font-semibold text-amber-200/90" style={{ fontSize: deskPx(dx.label) }}>{gs("pointsUnit")}</span>
                    </>
                }
                whitePrimary={
                    <>
                        {whiteTotalScore}
                        <span className="ml-0.5 font-semibold text-amber-200/90" style={{ fontSize: deskPx(dx.label) }}>{gs("pointsUnit")}</span>
                    </>
                }
            />
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
    desktopTextScale?: number;
    mobileCompactRoster?: boolean;
    session?: LiveGameSession;
}> = ({
    blackPlayer,
    whitePlayer,
    isPlayful,
    isMobile,
    mobileTextScale,
    mobileImageScale,
    desktopTextScale = 1,
    mobileCompactRoster = false,
    session,
}) => {
    const mx = RESULT_MODAL_SCORE_MOBILE_PX;
    const dx = RESULT_MODAL_DESKTOP_PX;
    const mobPx = (base: number) => resultModalFontPx(base, mobileTextScale);
    const deskPx = (base: number) => resultModalFontPx(base, desktopTextScale);
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
    const blackLv = blackPlayer.userLevel;
    const whiteLv = whitePlayer.userLevel;
    const avatarPx = isMobile ? Math.round(40 * mobileImageScale) : Math.round(34 * desktopTextScale);
    const avatarPxAlk = isMobile ? Math.round(32 * mobileImageScale) : Math.round(30 * desktopTextScale);

    const blackIsMonster = !!(adventureMonster && blackPlayer.id === aiUserId);
    const whiteIsMonster = !!(adventureMonster && whitePlayer.id === aiUserId);
    const winnerEnum = session && (session.winner === Player.Black || session.winner === Player.White) ? session.winner : null;
    const showWinLoseBadge = !!session && PLAYFUL_GAME_MODES.some((m) => m.mode === session.mode) && winnerEnum != null;
    const winLoseRibbonContentClass =
        'w-full rounded-b-md py-[2px] text-center text-[10px] font-black leading-none text-white shadow-[0_-1px_10px_rgba(0,0,0,0.55)] ring-1 ring-black/50';
    const winLoseRibbonSiblingClass =
        'pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex justify-center';
    const winLoseBottomOverlay = (stone: Player.Black | Player.White) => {
        if (!showWinLoseBadge || winnerEnum == null) return undefined;
        const isWin = winnerEnum === stone;
        return (
            <span className={`${winLoseRibbonContentClass} ${isWin ? 'bg-blue-600/95' : 'bg-red-600/95'}`}>
                {isWin ? gs('winShort') : gs('loseShort')}
            </span>
        );
    };

    const pairTeams = useMemo(() => {
        const pairGame = session?.settings?.pairGame;
        const order = pairGame?.turnOrder ?? [];
        if (!session || !pairGame || order.length === 0) return null;
        const userById = new Map<string, User>([
            [session.player1.id, session.player1],
            [session.player2.id, session.player2],
        ]);
        const avatarForParticipant = (participantId: string, kind: string): { src: string | null; user?: User } => {
            const directUser = userById.get(participantId);
            if (directUser) {
                return {
                    src: AVATAR_POOL.find((a: AvatarInfo) => a.id === directUser.avatarId)?.url ?? null,
                    user: directUser,
                };
            }
            if (participantId.startsWith('pet-ai-')) {
                const owner = userById.get(participantId.slice('pet-ai-'.length));
                if (owner) {
                    const row = getEquippedPairPetInventoryRow(owner);
                    const tid = row?.templateId ?? owner.equippedPairPetTemplateId ?? undefined;
                    return {
                        src: row?.image ?? (tid ? getPairPetDefinition(tid)?.image ?? null : null),
                        user: owner,
                    };
                }
            }
            if (isPairAiOpponentSyntheticDisplayParticipant(participantId) || kind === 'pet') {
                const fallbackIndex = participantId === 'pair-opponent-pet' ? 1 : 0;
                return { src: getPairPetDefinition(`pair-pet-${fallbackIndex + 1}`)?.image ?? '/images/pets/pet1.webp' };
            }
            return { src: null };
        };
        const toTeam = (player: Player.Black | Player.White) =>
            order
                .filter((seat) => seat.player === player)
                .sort((a, b) => a.order - b.order)
                .map((seat) => {
                    const summarySeatName = isPairAiOpponentSyntheticDisplayParticipant(seat.participantId)
                        ? (() => {
                              const lv = resolvePairAiOpponentPetSyntheticDisplayLevel(
                                  session.id,
                                  session.settings,
                                  seat.participantId,
                              );
                              const def = getPairPetDefinition(
                                  seat.participantId === 'pair-opponent-pet' ? 'pair-pet-2' : 'pair-pet-1',
                              );
                              return `Lv.${lv} ${def?.displayName ?? seat.name}`;
                          })()
                        : seat.name;
                    return { ...seat, summarySeatName, avatar: avatarForParticipant(seat.participantId, seat.kind) };
                });
        return {
            black: toTeam(Player.Black),
            white: toTeam(Player.White),
        };
    }, [session]);

    const blackMonsterFrame = isPlayful
        ? 'border-sky-400/45 bg-gradient-to-br from-sky-800/50 via-violet-950/88 to-black/85 ring-1 ring-inset ring-sky-400/22'
        : 'border-emerald-400/45 bg-gradient-to-br from-emerald-800/50 via-emerald-950/88 to-black/85 ring-1 ring-inset ring-emerald-400/22';
    const whiteMonsterFrame = isPlayful
        ? 'border-indigo-400/40 bg-gradient-to-br from-indigo-900/48 via-violet-900/65 to-black/85 ring-1 ring-inset ring-indigo-400/18'
        : 'border-teal-400/38 bg-gradient-to-br from-teal-900/48 via-slate-900/82 to-black/85 ring-1 ring-inset ring-teal-400/18';

    if (pairTeams) {
        const teamAvatarSize = mobileCompactRoster ? Math.round(34 * mobileImageScale) : avatarPx;
        const renderTeam = (color: 'black' | 'white', team: NonNullable<typeof pairTeams>['black'], dark: boolean) => (
            <div
                className={`relative overflow-hidden rounded-xl border px-2 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ${
                    dark
                        ? 'border-stone-600/35 bg-gradient-to-br from-zinc-950 via-[#141016] to-black ring-1 ring-stone-500/15'
                        : 'border-slate-400/25 bg-gradient-to-br from-slate-900/98 via-[#17161f] to-[#0b0a10] ring-1 ring-slate-400/18'
                }`}
            >
                <div className="flex justify-center">
                    <ResultModalStoneLabel color={color} className="h-5 w-5" />
                </div>
                <div className="mt-2 flex justify-center -space-x-2">
                    {team.map((seat) => (
                        <div key={seat.seatId} className="rounded-full ring-2 ring-black/70">
                            {seat.avatar.user ? (
                                <Avatar
                                    userId={seat.participantId}
                                    userName={seat.summarySeatName}
                                    size={teamAvatarSize}
                                    avatarUrl={seat.avatar.src ?? undefined}
                                    borderUrl={
                                        seat.avatar.user
                                            ? BORDER_POOL.find((b: BorderInfo) => b.id === seat.avatar.user?.borderId)?.url
                                            : undefined
                                    }
                                />
                            ) : (
                                <div
                                    className="flex items-center justify-center overflow-hidden rounded-full border border-white/20 bg-black/45"
                                    style={{ width: teamAvatarSize, height: teamAvatarSize }}
                                >
                                    {seat.avatar.src ? (
                                        <img src={seat.avatar.src} alt="" className="h-full w-full object-contain p-0.5" loading="lazy" />
                                    ) : (
                                        <span className="text-xs font-black text-slate-400">AI</span>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
        return (
            <div className={`${mobileCompactRoster ? 'mb-1.5 gap-1.5' : 'mb-2 gap-2 sm:gap-2.5'} grid w-full grid-cols-2`}>
                {renderTeam('black', pairTeams.black, true)}
                {renderTeam('white', pairTeams.white, false)}
            </div>
        );
    }

    if (mobileCompactRoster) {
        const nickRowHuman = (nickname: string, stone: 'black' | 'white', lv: number) => {
            return (
            <div className="min-w-0 max-w-full">
                <div
                    className="max-w-full overflow-x-auto overflow-y-hidden whitespace-nowrap [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]"
                    title={nickname}
                >
                    <span className="inline-block min-w-0 pr-1 text-sm font-bold leading-none text-white" style={{ fontSize: `${mx.columnHead * mobileTextScale}px` }}>
                        {nickname}
                    </span>
                </div>
                <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 whitespace-nowrap" style={{ fontSize: `${mx.emptyState * mobileTextScale}px` }}>
                    <ResultModalStoneLabel color={stone} className="h-3.5 w-3.5" />
                    <span>Lv.{lv}</span>
                </span>
            </div>
        );
        };
        const nickRowMonster = (stone: 'black' | 'white') =>
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
                    <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 whitespace-nowrap" style={{ fontSize: `${mx.emptyState * mobileTextScale}px` }}>
                        <ResultModalStoneLabel color={stone} className="h-3.5 w-3.5" />
                        <span>Lv.{adventureMonster.level}</span>
                    </span>
                </div>
            ) : null;

        return (
            <div className="mb-1.5 grid w-full grid-cols-2 gap-1.5">
                <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-stone-600/40 bg-black/35 px-1.5 py-1.5 ring-1 ring-stone-500/10">
                    <div className="relative shrink-0">
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
                                bottomOverlay={winLoseBottomOverlay(Player.Black)}
                            />
                        )}
                        {showWinLoseBadge && blackIsMonster && adventureMonster && (
                            <span className={winLoseRibbonSiblingClass}>
                                {winLoseBottomOverlay(Player.Black)}
                            </span>
                        )}
                    </div>
                    {blackIsMonster && adventureMonster ? nickRowMonster('black') : nickRowHuman(blackPlayer.nickname, 'black', blackLv)}
                </div>
                <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-slate-500/35 bg-slate-950/55 px-1.5 py-1.5 ring-1 ring-slate-400/12">
                    <div className="relative shrink-0">
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
                                bottomOverlay={winLoseBottomOverlay(Player.White)}
                            />
                        )}
                        {showWinLoseBadge && whiteIsMonster && adventureMonster && (
                            <span className={winLoseRibbonSiblingClass}>
                                {winLoseBottomOverlay(Player.White)}
                            </span>
                        )}
                    </div>
                    {whiteIsMonster && adventureMonster ? nickRowMonster('white') : nickRowHuman(whitePlayer.nickname, 'white', whiteLv)}
                </div>
            </div>
        );
    }

    return (
        <div className="mb-1.5 grid w-full grid-cols-2 gap-1.5 sm:gap-2">
            <div className="relative overflow-hidden rounded-xl border border-stone-600/35 bg-gradient-to-br from-zinc-950 via-[#141016] to-black p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_14px_44px_-22px_rgba(0,0,0,0.85)] ring-1 ring-stone-500/15 sm:p-2">
                <div className="pointer-events-none absolute -right-8 -top-10 h-20 w-20 rounded-full bg-stone-400/[0.06] blur-2xl" aria-hidden />
                <div className="relative flex items-center gap-1.5 sm:gap-2">
                    <div className="relative shrink-0">
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
                                bottomOverlay={winLoseBottomOverlay(Player.Black)}
                            />
                        )}
                        {showWinLoseBadge && blackIsMonster && adventureMonster && (
                            <span className={winLoseRibbonSiblingClass}>
                                {winLoseBottomOverlay(Player.Black)}
                            </span>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <ResultModalStoneLabel
                            color="black"
                            className={isMobile ? 'h-4 w-4' : 'h-5 w-5'}
                        />
                        <p
                            className={`mt-0.5 min-w-0 font-bold leading-snug text-white ${isMobile ? 'truncate' : 'break-words'}`}
                            style={{
                                fontSize: isMobile ? mobPx(mx.columnHead) : deskPx(dx.nickname),
                                wordBreak: isMobile ? undefined : 'break-word',
                            }}
                            title={blackIsMonster && adventureMonster ? adventureMonster.name : blackPlayer.nickname}
                        >
                            {blackIsMonster && adventureMonster ? adventureMonster.name : blackPlayer.nickname}
                        </p>
                        <p
                            className="font-medium text-stone-400"
                            style={{ fontSize: isMobile ? mobPx(mx.emptyState) : deskPx(dx.level) }}
                        >
                            {blackIsMonster && adventureMonster ? `Lv.${adventureMonster.level}` : `Lv.${blackLv}`}
                        </p>
                    </div>
                </div>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-slate-400/25 bg-gradient-to-br from-slate-900/98 via-[#17161f] to-[#0b0a10] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_14px_44px_-22px_rgba(148,163,184,0.12)] ring-1 ring-slate-400/18 sm:p-2">
                <div className="pointer-events-none absolute -left-6 -bottom-8 h-20 w-20 rounded-full bg-slate-300/[0.07] blur-2xl" aria-hidden />
                <div className="relative flex items-center gap-1.5 sm:gap-2">
                    <div className="relative shrink-0">
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
                                bottomOverlay={winLoseBottomOverlay(Player.White)}
                            />
                        )}
                        {showWinLoseBadge && whiteIsMonster && adventureMonster && (
                            <span className={winLoseRibbonSiblingClass}>
                                {winLoseBottomOverlay(Player.White)}
                            </span>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <ResultModalStoneLabel
                            color="white"
                            className={isMobile ? 'h-4 w-4' : 'h-5 w-5'}
                        />
                        <p
                            className={`mt-0.5 min-w-0 font-bold leading-snug text-white ${isMobile ? 'truncate' : 'break-words'}`}
                            style={{
                                fontSize: isMobile ? mobPx(mx.columnHead) : deskPx(dx.nickname),
                                wordBreak: isMobile ? undefined : 'break-word',
                            }}
                            title={whiteIsMonster && adventureMonster ? adventureMonster.name : whitePlayer.nickname}
                        >
                            {whiteIsMonster && adventureMonster ? adventureMonster.name : whitePlayer.nickname}
                        </p>
                        <p
                            className="font-medium text-slate-300/90"
                            style={{ fontSize: isMobile ? mobPx(mx.emptyState) : deskPx(dx.level) }}
                        >
                            {whiteIsMonster && adventureMonster ? `Lv.${adventureMonster.level}` : `Lv.${whiteLv}`}
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
    secondaryConfirmAction: _secondaryConfirmAction,
    onLeaveToAdventureMap,
    onAction,
    isSpectator = false,
}) => {
    const { t } = useTranslation('game');
    const { winner, player1, player2, blackPlayerId, whitePlayerId, winReason } = session;
    const soundPlayed = useRef(false);
    const isCompactViewport = useIsHandheldDevice(900);
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
    const isPlayful = useMemo(() => PLAYFUL_GAME_MODES.some((m) => m.mode === session.mode), [session.mode]);
    const isPairGoSession = useMemo(
        () => Boolean(session.settings?.pairGame?.turnOrder?.length),
        [session.settings?.pairGame?.turnOrder],
    );
    const equippedPairPetRow = useMemo(() => getEquippedPairPetInventoryRow(currentUser), [currentUser]);
    const pairPetPortraitUrl = useMemo(() => {
        const row = equippedPairPetRow;
        if (!row) return null;
        const img = (row as { image?: string }).image;
        return img ?? (row.templateId ? getPairPetDefinition(row.templateId)?.image : null) ?? null;
    }, [equippedPairPetRow]);
    const pairPetDisplayName = useMemo(() => {
        if (!equippedPairPetRow) return '';
        return getPairPetDisplayName(equippedPairPetRow);
    }, [equippedPairPetRow]);
    const equippedPetMetaLevel = useMemo(
        () => (equippedPairPetRow ? resolvePairPetMetaFromInventoryRow(equippedPairPetRow).level : undefined),
        [equippedPairPetRow],
    );
    const pairPetSummaryReady =
        mySummary != null &&
        mySummary.pairPetLevel != null &&
        mySummary.pairPetXp != null;
    const isStrategicMode = useMemo(() => SPECIAL_GAME_MODES.some((m) => m.mode === session.mode), [session.mode]);
    const showPairPetProfileAside =
        (isPairGoSession || (!isPlayful && isStrategicMode)) && (!!pairPetPortraitUrl || pairPetSummaryReady);
    /** 대국 결과 패널: 프로필 카드 우측에 붙는 경험치 바(레벨은 바에만 표시해 중복 제거). 놀이바둑은 EXP 없음 */
    const userLevelXpAside = mySummary?.level;
    const showUserXpAside = Boolean(userLevelXpAside && !isPlayful);
    const pairPetXpAside =
        mySummary?.pairPetLevel && mySummary?.pairPetXp != null
            ? { level: mySummary.pairPetLevel, xp: mySummary.pairPetXp }
            : null;
    const showPetXpAside = Boolean(pairPetXpAside);
    const equippedPetGrade = useMemo(
        () => (equippedPairPetRow ? effectivePairPetGradeFromRow(equippedPairPetRow) : undefined),
        [equippedPairPetRow],
    );
    const showPetGradeUpgradeInsteadOfXp = useMemo(
        () =>
            pairPetShowsGradeUpgradeNeededInsteadOfXp({
                grade: equippedPetGrade,
                petFinalLevel: mySummary?.pairPetLevel?.final,
                xpChange: mySummary?.pairPetXp?.change,
            }),
        [equippedPetGrade, mySummary?.pairPetLevel?.final, mySummary?.pairPetXp?.change],
    );
    /** 등급 강화 필요 시 결과 모달에서 펫 XP 바·배지 대신 안내 */
    const showPetXpBarAside = showPetXpAside && !showPetGradeUpgradeInsteadOfXp;
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
    const [localAdGoldBonus, setLocalAdGoldBonus] = useState(0);
    const prevVipLockedRef = useRef<boolean | null>(null);

    useEffect(() => {
        setVipUnlockRouletteActive(false);
        setVipUnlockGranted(false);
        setLocalAdGoldBonus(0);
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
                name: gs('vipSlotReward'),
                quantity: 1,
                image: vipRewardPreviewImage,
            },
        };
    }, [vipSlotEffective, vipUnlockGranted, vipRewardPreviewImage]);

    const hasPvpRewardSlots = useMemo(() => {
        if (!mySummary) return false;
        if (sessionShowsVipPlayRewardSlot && vipSlotEffective) return true;
        if (isAdventureGame) {
            return (
                !!mySummary.adventureRewardSlots ||
                (mySummary.gold ?? 0) > 0 ||
                (!isPlayful && (mySummary.xp?.change ?? 0) > 0) ||
                (!isPlayful && (mySummary.pairPetXp?.change ?? 0) > 0)
            );
        }
        const xpSlotCounts = !isPlayful && (mySummary.xp?.change ?? 0) > 0;
        return (
            (mySummary.gold ?? 0) > 0 ||
            xpSlotCounts ||
            (mySummary.pairPetXp?.change ?? 0) > 0 ||
            mySummary.pairPetXp != null ||
            (mySummary.items?.length ?? 0) > 0
        );
    }, [mySummary, isAdventureGame, sessionShowsVipPlayRewardSlot, vipSlotEffective, isPlayful]);

    const displayedMatchGold = useMemo(() => {
        if (!mySummary) return 0;
        if (typeof mySummary.matchGold === 'number' && Number.isFinite(mySummary.matchGold) && mySummary.matchGold > 0) {
            return mySummary.matchGold;
        }
        const totalGold = Math.max(0, Number(mySummary.gold ?? 0));
        const vipBonus = Math.max(0, Number(mySummary.vipGoldBonus ?? 0));
        if (totalGold > 0 && vipBonus > 0) {
            return Math.max(0, totalGold - vipBonus);
        }
        return totalGold;
    }, [mySummary]);
    const optimisticAdGoldBonus = (mySummary?.adGoldBonus ?? 0) > 0 ? 0 : localAdGoldBonus;
    const displayedMatchGoldWithAdBonus = displayedMatchGold + optimisticAdGoldBonus;
    const adventureRewardSlotsForRender = useMemo(() => {
        if (!mySummary?.adventureRewardSlots || optimisticAdGoldBonus <= 0) return mySummary?.adventureRewardSlots;
        return {
            ...mySummary.adventureRewardSlots,
            gold: {
                ...mySummary.adventureRewardSlots.gold,
                amount: Math.max(0, Number(mySummary.adventureRewardSlots.gold.amount ?? 0)) + optimisticAdGoldBonus,
            },
        };
    }, [mySummary?.adventureRewardSlots, optimisticAdGoldBonus]);
    const isGuildWar = isGuildWarLiveSession(session as any);
    const isChampionshipVersusSummary = typeof session.description === 'string' && isChampionshipVersusKataSummaryDescription(session.description);
    const showMannerPostGameStats = !isChampionshipVersusSummary;
    /** 랭킹·매너 등 실제 정산이 있는 대국에서만 통계 카드 표시 (친선·AI 등에서는 숨김) */
    const showPostGameRatingMannerStats = useMemo(() => {
        if (!mySummary || isSpectator) return false;
        if (isAdventureGame) return false;
        if (isGuildWar) return false;
        const rankedHuman = session.isRankedGame === true && session.isAiGame !== true;
        const ratingDelta = mySummary.rating?.change ?? 0;
        const mannerDelta = mySummary.manner?.change ?? 0;
        return rankedHuman || ratingDelta !== 0 || mannerDelta !== 0;
    }, [mySummary, isSpectator, isAdventureGame, isGuildWar, session.isRankedGame, session.isAiGame]);
    /** 랭킹·매너 통계 그리드용 — TS가 JSX 삼항 안에서 mySummary를 좁히도록 */
    const postGameStatsSummary: GameSummary | undefined =
        mySummary && showPostGameRatingMannerStats ? mySummary : undefined;
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
    const blackPlayer = player1.id === blackPlayerId ? player1 : player2;
    const whitePlayer = player1.id === whitePlayerId ? player1 : player2;

    const avatarUrl = useMemo(() => AVATAR_POOL.find((a: AvatarInfo) => a.id === currentUser.avatarId)?.url, [currentUser.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find((b: BorderInfo) => b.id === currentUser.borderId)?.url, [currentUser.borderId]);
    
    // 모바일 텍스트 크기 조정
    const {
        desktopTextScale,
        mobileTextScale,
        mobileImageScale,
        commonWindowProps: commonResultWindowProps,
    } = useGameResultModalLayout({
        isMobile,
        designWidth: isMobile ? 1080 : 1180,
        designHeight: isMobile ? 1040 : 940,
        minUniformScale: 0.58,
    });

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

    const isDraw = winner === Player.None;
    const winnerUser = winner === Player.Black 
        ? (player1.id === blackPlayerId ? player1 : player2)
        : (winner === Player.White ? (player1.id === whitePlayerId ? player1 : player2) : null);

    const { title, color } = useMemo(() => {
        if (isDraw) return { title: t('draw'), color: 'text-yellow-400' };

        if (isWinner === null) {
            if (winnerUser) {
                return { title: t('summary.playerWinsTitle', { name: winnerUser.nickname }), color: "text-gray-300" };
            }
            return { title: t('summary.gameEnded'), color: 'text-gray-300' };
        }

        if (isWinner) {
            let title = t('win');
            if (winReason === 'resign') title = t('summary.resignWin');
            if (winReason === 'castle_capture') title = t('summary.captureWin');
            if (winReason === 'chess_checkmate') title = t('summary.checkmateWin');
            if (winReason === 'capture_limit' && isGuildWarCaptureTurnLimitLoss) title = t('summary.turnWin');
            if (winReason === 'timeout') title = isGuildWarCaptureTurnLimitLoss ? t('summary.turnWin') : t('summary.timeWin');
            return { title, color: 'text-green-400' };
        } else {
            let title = t('lose');
            if (winReason === 'resign') title = t('summary.resignLoss');
            if (winReason === 'castle_capture') title = t('summary.captureLoss');
            if (winReason === 'chess_checkmate') title = t('summary.checkmateLoss');
            if (winReason === 'capture_limit' && isGuildWarCaptureTurnLimitLoss) title = t('summary.turnLoss');
            if (winReason === 'timeout') {
                title = isGuildWarCaptureTurnLimitLoss ? t('summary.turnLoss') : isAdventureGame ? t('lose') : t('summary.timeLoss');
            }
            return { title, color: 'text-red-400' };
        }
    }, [isWinner, isDraw, winReason, winnerUser, isGuildWarCaptureTurnLimitLoss, isAdventureGame, t]);
    
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

    const contentMsgStyle: React.CSSProperties = {
        fontSize: isMobile
            ? resultModalFontPx(14, mobileTextScale)
            : resultModalFontPx(RESULT_MODAL_DESKTOP_PX.message, desktopTextScale),
    };
    const contentMetaStyle: React.CSSProperties = {
        fontSize: isMobile
            ? resultModalFontPx(RESULT_MODAL_BODY_MOBILE_PX.meta, mobileTextScale)
            : resultModalFontPx(RESULT_MODAL_DESKTOP_PX.body, desktopTextScale),
    };
    const desktopSectionHeadStyle: React.CSSProperties = {
        fontSize: resultModalFontPx(12, desktopTextScale),
    };
    const mobileSectionTitleStyle: React.CSSProperties = {
        fontSize: resultModalFontPx(RESULT_MODAL_BODY_MOBILE_PX.sectionTitle, mobileTextScale),
    };
    const mobileBodyTextStyle: React.CSSProperties = {
        fontSize: resultModalFontPx(RESULT_MODAL_BODY_MOBILE_PX.body, mobileTextScale),
    };
    const mobileMetaTextStyle: React.CSSProperties = {
        fontSize: resultModalFontPx(RESULT_MODAL_BODY_MOBILE_PX.meta, mobileTextScale),
    };

    const recordPortraitPx = resolveResultModalPortraitPx(isMobile, mobileImageScale, desktopTextScale);

    const renderUserXpAside = () => {
        if (showUserXpAside && userLevelXpAside) {
            return (
                <XpBar
                    initial={userLevelXpAside.progress.initial}
                    final={userLevelXpAside.progress.final}
                    max={userLevelXpAside.progress.max}
                    levelUp={userLevelXpAside.initial < userLevelXpAside.final}
                    xpGain={mySummary?.xp?.change ?? 0}
                    finalLevel={userLevelXpAside.final}
                    isMobile={isMobile}
                    mobileTextScale={mobileTextScale}
                    compact={!isMobile}
                />
            );
        }
        if (!showUserXpAside && (!mySummary || !isPlayful)) {
            return (
                <div className="flex w-full min-w-0 items-center gap-1.5">
                    <div className="relative flex h-3.5 w-full min-w-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-slate-950/80">
                        <span className="text-[10px] font-bold text-slate-300" style={mobileMetaTextStyle}>
                            0 XP
                        </span>
                    </div>
                    <span
                        className="w-14 shrink-0 whitespace-nowrap text-xs font-bold text-slate-300"
                        style={mobileBodyTextStyle}
                    >
                        +0 XP
                    </span>
                </div>
            );
        }
        return undefined;
    };

    const renderPetXpAside = () => {
        if (!pairPetXpAside) return undefined;
        if (showPetGradeUpgradeInsteadOfXp) {
            return (
                <div className="flex min-h-[2rem] w-full items-center justify-center rounded-md border border-fuchsia-400/40 bg-fuchsia-950/35 px-1.5 py-1 sm:min-h-[2.25rem]">
                    <span
                        className="text-center text-[0.62rem] font-extrabold leading-tight text-fuchsia-100 sm:text-xs"
                        title={t('summary.petGradeUpgradeNeeded')}
                    >
                        {t('summary.petGradeUpgradeNeeded')}
                    </span>
                </div>
            );
        }
        return (
            <XpBar
                initial={pairPetXpAside.level.progress.initial}
                final={pairPetXpAside.level.progress.final}
                max={Math.max(1, pairPetXpAside.level.progress.max)}
                levelUp={pairPetXpAside.level.initial < pairPetXpAside.level.final}
                xpGain={pairPetXpAside.xp.change}
                finalLevel={pairPetXpAside.level.final}
                isMobile={isMobile}
                mobileTextScale={mobileTextScale}
                compact={!isMobile}
            />
        );
    };

    const renderRecordIdentityPanels = () => {
        const alignXpColumns = showPairPetProfileAside;
        return (
        <div className="flex flex-col gap-1.5">
            <ResultModalIdentityRow
                displayName={currentUser.nickname}
                level={mySummary?.level?.final ?? currentUser.userLevel}
                hideLevelLine={showUserXpAside}
                portrait={
                    <Avatar
                        userId={currentUser.id}
                        userName={currentUser.nickname}
                        size={recordPortraitPx}
                        avatarUrl={avatarUrl}
                        borderUrl={borderUrl}
                    />
                }
                xpAside={renderUserXpAside()}
                xpColumnReserved={alignXpColumns}
                isMobile={isMobile}
                mobileTextScale={mobileTextScale}
                desktopTextScale={desktopTextScale}
            />
            {showPairPetProfileAside ? (
                <ResultModalIdentityRow
                    tone="pet"
                    displayName={pairPetDisplayName || '—'}
                    level={mySummary?.pairPetLevel?.final ?? equippedPetMetaLevel ?? '—'}
                    hideLevelLine={showPetXpBarAside}
                    portrait={
                        <ResultModalPetPortrait
                            imageSrc={pairPetPortraitUrl}
                            sizePx={recordPortraitPx}
                            alt={t('summary.representativePet')}
                        />
                    }
                    xpAside={renderPetXpAside()}
                    xpColumnReserved={alignXpColumns}
                    footer={
                        showPetXpBarAside && mySummary ? (
                            <PairPetLevelUpCoreDelta
                                delta={mySummary.pairPetLevelUpCoreBonuses}
                                title={t('summary.addedStats')}
                                compact
                            />
                        ) : undefined
                    }
                    isMobile={isMobile}
                    mobileTextScale={mobileTextScale}
                    desktopTextScale={desktopTextScale}
                />
            ) : null}
        </div>
        );
    };

    const renderGameContent = () => {
        const totalMoves = session.moveHistory?.length ?? 0;
        const formattedElapsed = gameDurationRef.current!;
        const isAiOrPve = !!session.isAiGame || !!session.isSinglePlayer || session.gameCategory === 'tower' || session.gameCategory === 'singleplayer';
        const timeLabel = isAiOrPve ? t('summary.elapsedTime') : t('summary.matchTime');
        if (isAdventureGame && winReason === 'adventure_monster_fled') {
            const msg =
                isWinner === false
                    ? t('summary.monsterFledLoss')
                    : isWinner === true
                      ? t('summary.monsterFledWin')
                      : t('summary.monsterFledDraw');
            return (
                <p
                    className={`text-center ${isWinner === false ? 'text-red-400' : 'text-slate-200'}`}
                    style={contentMsgStyle}
                >
                    {msg}
                </p>
            );
        }
        if (isPlayful && winReason === 'resign') {
            const message = isWinner ? t('summary.resignWinMsg') : t('summary.resignLossMsg');
            return <p className="text-center" style={contentMsgStyle}>{message}</p>;
        }

        if (winReason === 'capture_limit' && isGuildWarCaptureTurnLimitLoss) {
            if (isWinner) {
                return <p className="text-center text-green-400" style={contentMsgStyle}>{t('summary.turnLimitWinMsg')}</p>;
            }
            return <p className="text-center text-red-400" style={contentMsgStyle}>{t('summary.turnLimitLossMsg')}</p>;
        }

        if (winReason === 'castle_capture') {
            const message = isWinner ? t('summary.castleWinMsg') : t('summary.castleLossMsg');
            return <p className="text-center" style={contentMsgStyle}>{message}</p>;
        }

        if (winReason === 'chess_checkmate') {
            const message = isWinner ? t('summary.checkmateWinMsg') : t('summary.checkmateLossMsg');
            return <p className="text-center" style={contentMsgStyle}>{message}</p>;
        }
        
        if (winReason === 'timeout') {
            if (!isWinner) {
                if (isGuildWarCaptureTurnLimitLoss) {
                    return <p className="text-center text-red-400" style={contentMsgStyle}>{t('summary.turnLimitLossMsg')}</p>;
                }
                // 패배한 경우
                if (session.stageId) {
                    // stageId가 있으면 제한 턴 체크
                    const isTower = session.gameCategory === 'tower';
                    if (isTower) {
                        try {
                            const currentStage = TOWER_STAGES.find((s: any) => s.id === session.stageId);
                            if (currentStage?.blackTurnLimit) {
                                return <p className="text-center text-red-400" style={contentMsgStyle}>{t('summary.turnLimitLossMsg')}</p>;
                            }
                        } catch (e) {
                            console.error('[GameSummaryModal] Error loading TOWER_STAGES:', e);
                        }
                    } else if (session.isSinglePlayer) {
                        try {
                            const currentStage = resolveLiveSessionSinglePlayerStageRow(session);
                            const bt = (session.settings as any)?.blackTurnLimit ?? currentStage?.blackTurnLimit;
                            if (bt) {
                                return <p className="text-center text-red-400" style={contentMsgStyle}>{t('summary.turnLimitLossMsg')}</p>;
                            }
                        } catch (e) {
                            console.error('[GameSummaryModal] Error resolving single-player stage:', e);
                        }
                    }
                }
                if (isAdventureGame) {
                    return (
                        <p className="text-center text-red-400" style={contentMsgStyle}>
                            {t('summary.monsterFledLoss')}
                        </p>
                    );
                }
                // 일반 게임에서 시간 패배한 경우
                return <p className="text-center text-red-400" style={contentMsgStyle}>{t('summary.timeLossMsg')}</p>;
            } else {
                if (isGuildWarCaptureTurnLimitLoss) {
                    return <p className="text-center text-green-400" style={contentMsgStyle}>{t('summary.turnLimitWinMsg')}</p>;
                }
                return <p className="text-center text-green-400" style={contentMsgStyle}>{t('summary.timeWinMsg')}</p>;
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
                    desktopTextScale={desktopTextScale}
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
                        <ScoreDetailsComponent analysis={analysisResult} session={session} isMobile={isMobile} mobileTextScale={mobileTextScale} desktopTextScale={desktopTextScale} />
                    </div>
                );
            }
            if (winReason === 'score') {
                return <p className="text-center text-gray-400 animate-pulse" style={contentMetaStyle}>{t('summary.calculatingScore')}</p>;
            }
        }
        
        if (winReason === 'score') {
            if (analysisResult) {
                return (
                    <div className="mx-auto w-full max-w-md">
                        <ScoreDetailsComponent analysis={analysisResult} session={session} isMobile={isMobile} mobileTextScale={mobileTextScale} desktopTextScale={desktopTextScale} />
                    </div>
                );
            }
            return <p className="text-center text-gray-400 animate-pulse" style={contentMetaStyle}>{gs("calculatingScore")}</p>;
        }
        if (session.mode === GameMode.Dice || session.mode === GameMode.Thief) return <PlayfulScoreDetailsComponent gameSession={session} isMobile={isMobile} mobileTextScale={mobileTextScale} desktopTextScale={desktopTextScale} />;
        if (session.mode === GameMode.Curling) return <CurlingScoreDetailsComponent gameSession={session} isMobile={isMobile} mobileTextScale={mobileTextScale} mobileImageScale={mobileImageScale} desktopTextScale={desktopTextScale} />;
        if (session.mode === GameMode.Omok || session.mode === GameMode.Ttamok) {
            let message = '';
            if (winReason === 'omok_win') {
                message = isWinner ? t('summary.omokWin') : t('summary.omokLoss');
            } else if (winReason === 'capture_limit') {
                message = isWinner ? t('summary.captureGoalWin') : t('summary.captureGoalLoss');
            }
            if (message) {
                return (
                    <p
                        className="text-center font-bold"
                        style={{
                            fontSize: isMobile
                                ? resultModalFontPx(16, mobileTextScale)
                                : resultModalFontPx(RESULT_MODAL_DESKTOP_PX.winBanner, desktopTextScale),
                        }}
                    >
                        {message}
                    </p>
                );
            }
        }
        if (session.mode === GameMode.Alkkagi) {
            return <AlkkagiScoreDetailsComponent gameSession={session} isMobile={isMobile} mobileTextScale={mobileTextScale} desktopTextScale={desktopTextScale} />;
        }
        return (
            <div className="mx-auto flex w-full max-w-md flex-col gap-2 sm:gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2 min-[1024px]:gap-3">
                    <div className="bg-gray-800/40 rounded-md px-2 py-1.5 flex justify-between items-center gap-2">
                        <ResultModalStoneLabel color="black" className="h-4 w-4 shrink-0" />
                        <span className="font-semibold truncate" style={contentMetaStyle}>{blackPlayer.nickname}</span>
                    </div>
                    <div className="bg-gray-800/40 rounded-md px-2 py-1.5 flex justify-between items-center gap-2">
                        <ResultModalStoneLabel color="white" className="h-4 w-4 shrink-0" />
                        <span className="font-semibold truncate" style={contentMetaStyle}>{whitePlayer.nickname}</span>
                    </div>
                    <div className="bg-gray-800/40 rounded-md px-2 py-1.5 flex justify-between items-center">
                        <span className="text-gray-300" style={contentMetaStyle}>{t('summary.totalMoves')}</span>
                        <span className="font-semibold" style={contentMetaStyle}>{totalMoves}{t('summary.movesUnit')}</span>
                    </div>
                    <div className="bg-gray-800/40 rounded-md px-2 py-1.5 flex justify-between items-center">
                        <span className="text-gray-300" style={contentMetaStyle}>{timeLabel}</span>
                        <span className="font-semibold" style={contentMetaStyle}>{formattedElapsed}</span>
                    </div>
                </div>
                <p className="text-center text-gray-400" style={contentMetaStyle}>
                    {t('summary.noSpecialContent')}
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
                    { label: t('summary.winCondition'), ok: humanWon },
                    { label: gs("captureTier2", { min: GUILD_WAR_STAR_CAPTURE_TIER2_MIN }), ok: maxSingleCapture >= GUILD_WAR_STAR_CAPTURE_TIER2_MIN },
                    { label: gs("captureTier3", { min: GUILD_WAR_STAR_CAPTURE_TIER3_MIN }), ok: maxSingleCapture >= GUILD_WAR_STAR_CAPTURE_TIER3_MIN },
                ]
                : [
                    { label: t('summary.winCondition'), ok: humanWon },
                    { label: gs("scoreDiffTier", { diff: scoreT2 }), ok: humanWon && scoreDiff >= scoreT2 },
                    { label: gs("scoreDiffTier", { diff: scoreT3 }), ok: humanWon && scoreDiff >= scoreT3 },
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
                    {gs('starConditions')}
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
                                src={row.ok ? '/images/guild/guildwar/clearstar.webp' : '/images/guild/guildwar/emptystar.webp'}
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
        ? 'flex min-h-[3.35rem] flex-col gap-1 rounded-md border border-amber-500/20 bg-gradient-to-br from-slate-900/95 via-[#13141c] to-[#0a0a0f] px-2 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-inset ring-amber-500/10'
        : 'flex min-h-[3.75rem] flex-col gap-1 rounded-md border border-amber-500/20 bg-gradient-to-br from-slate-900/95 via-[#13141c] to-[#0a0a0f] px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-inset ring-amber-500/10 sm:min-h-[4rem]';
    const statLabelClass = isMobile
        ? 'shrink-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-amber-100/90'
        : 'shrink-0 text-[0.75rem] font-bold uppercase tracking-[0.1em] text-amber-100/90';
    /** 라벨 아래 값 영역 — 네 박스 높이 맞춤 */
    const statCardBodyClass = isMobile
        ? 'flex min-h-[1.55rem] flex-1 flex-wrap content-center items-center justify-center gap-x-1.5 gap-y-0.5'
        : 'flex min-h-[1.85rem] flex-1 flex-wrap content-center items-center justify-center gap-x-1.5 gap-y-0.5';
    const statValueMainClass = isMobile
        ? 'text-base font-black tabular-nums tracking-tight text-white'
        : 'text-lg font-black tabular-nums tracking-tight text-white';
    const statValueMannerClass = isMobile
        ? 'text-base font-black tabular-nums text-slate-100'
        : 'text-lg font-black tabular-nums text-slate-100';
    const statOverallClass = isMobile
        ? 'flex items-baseline justify-center gap-1 text-base font-black tabular-nums text-white'
        : 'flex items-baseline justify-center gap-1 text-base font-black tabular-nums text-white';

    const pvpRewardsSection = (
        <div
            className={`relative z-10 flex-shrink-0 space-y-1 rounded-xl border border-amber-500/20 bg-gradient-to-b from-[#1a1510]/95 via-[#12100c] to-[#0a0908] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-inset ring-amber-500/10 sm:p-2.5 ${isMobile ? '!p-2' : ''}`}
        >
            <h2
                className={`mb-0 border-b border-amber-500/25 pb-1 text-center font-bold uppercase tracking-[0.12em] text-amber-100 ${
                    isMobile ? 'text-xs' : 'text-[0.7rem] sm:text-[0.75rem]'
                }`}
                style={
                    isMobile
                        ? mobileSectionTitleStyle
                        : { fontSize: resultModalFontPx(11.5, desktopTextScale) }
                }
            >
                {isGuildWar ? gs("guildWarRewards") : gs("rewardsEarned")}
            </h2>
            <div
                className={
                    isMobile
                        ? RESULT_MODAL_REWARDS_ROW_MOBILE_WRAP_CLASS
                        : `flex ${
                              useCompactRewardSlots ? 'min-h-[5.25rem]' : RESULT_MODAL_REWARDS_ROW_MIN_H_CLASS
                          } flex-wrap content-center items-center justify-center gap-2 sm:gap-2.5`
                }
            >
                {!mySummary ? (
                    <p
                        className="px-2 text-center font-medium text-slate-200"
                        style={{ fontSize: isMobile ? resultModalFontPx(RESULT_MODAL_SCORE_MOBILE_PX.emptyState, mobileTextScale) : undefined }}
                    >
                        {gs('noRewardInfo')}
                    </p>
                ) : !hasPvpRewardSlots ? (
                    <p
                        className="px-2 text-center font-medium text-slate-200"
                        style={{ fontSize: isMobile ? resultModalFontPx(RESULT_MODAL_SCORE_MOBILE_PX.emptyState, mobileTextScale) : undefined }}
                    >
                        {gs('noRewardsEmpty')}
                    </p>
                ) : (
                    <>
                        {isAdventureGame && adventureRewardSlotsForRender ? (
                            <div className="min-w-0 w-full max-w-full">
                                <AdventureBattleRewardRowWithReveal
                                    slots={adventureRewardSlotsForRender}
                                    xpChange={mySummary.xp?.change ?? 0}
                                    pairPetXpChange={mySummary.pairPetXp?.change ?? 0}
                                    isPlayful={isPlayful}
                                    compact={useCompactRewardSlots}
                                    vipPlayRewardSlot={vipSlotForRender}
                                    onVipLockedClick={() => handlers.openShop('vip', { modal: true })}
                                    pairPetGradeUpgradeNeeded={showPetGradeUpgradeInsteadOfXp && !isPlayful}
                                />
                            </div>
                        ) : (
                            <>
                        {displayedMatchGoldWithAdBonus > 0 && (
                            <ResultModalGoldCurrencySlot
                                amount={displayedMatchGoldWithAdBonus}
                                compact={useCompactRewardSlots}
                                understandingBonus={mySummary.adventureGoldUnderstandingBonus}
                            />
                        )}
                        {!isPlayful && (mySummary.xp?.change ?? 0) > 0 && (
                            <div className="flex shrink-0 flex-col items-center justify-center">
                                <ResultModalXpRewardBadge
                                    variant="strategy"
                                    amount={mySummary.xp!.change}
                                    density={useCompactRewardSlots ? 'compact' : 'comfortable'}
                                />
                            </div>
                        )}
                        {mySummary.pairPetXp != null && (
                            <div className="flex shrink-0 flex-col items-center justify-center">
                                {showPetGradeUpgradeInsteadOfXp ? (
                                    <ResultModalPetGradeUpgradeNeededSlot
                                        density={useCompactRewardSlots ? 'compact' : 'comfortable'}
                                    />
                                ) : (
                                    <ResultModalXpRewardBadge
                                        variant="pet"
                                        amount={mySummary.pairPetXp.change}
                                        density={useCompactRewardSlots ? 'compact' : 'comfortable'}
                                        title={
                                            mySummary.pairPetXp.change > 0
                                                ? `EXP +${mySummary.pairPetXp.change.toLocaleString()}`
                                                : gs("noChange")
                                        }
                                        allowZeroDisplay={isPairGoSession}
                                    />
                                )}
                            </div>
                        )}
                        {mySummary.items &&
                            mySummary.items.length > 0 &&
                            mySummary.items.slice(0, 3).map((item: InventoryItem, idx: number) => {
                                const displayName = item.name;
                                const nameWithSpace = displayName.includes(gs('goldBundleCompact'))
                                    ? displayName.replace(gs('goldBundleCompact'), gs('goldBundleSpaced'))
                                    : displayName;
                                const nameWithoutSpace = displayName.includes(gs('goldBundleSpaced'))
                                    ? displayName.replace(gs('goldBundleSpaced'), gs('goldBundleCompact'))
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
                                onLockedClick={vipSlotForRender.locked ? () => handlers.openShop('vip', { modal: true }) : undefined}
                            />
                        ) : null}
                            </>
                        )}
                    </>
                )}
            </div>
            {!isSpectator && mySummary ? (
                <ResultAdGoldDoubleButton
                    session={session}
                    summary={mySummary}
                    isWinner={isWinner === true}
                    onAction={onAction}
                    onClaimed={(amount) => setLocalAdGoldBonus((prev) => prev + amount)}
                    className="pt-1"
                />
            ) : null}
        </div>
    );

    const adventureResultChrome = isAdventureGame && !isSpectator && onLeaveToAdventureMap;

    return (
        <DraggableWindow
            title={isGuildWar ? t('summary.guildWarTitle') : t('summary.title')}
            onClose={onConfirm}
            /** 전역 레벨업·콘텐츠 해금 등(document.body)과 같은 z 스택에서 겹치게 — 스케일 캔버스 내부 modal-root에만 두면 가려질 수 있음 */
            viewportPortal
            {...commonResultWindowProps}
            bodyShrinkToContent={!isMobile}
            bodyAvoidVerticalStretch={!isMobile}
            hideFooter={isMobile}
            windowId="game-summary"
            variant="store"
            modalBackdrop={isMobile && !adventureResultChrome}
            closeOnOutsideClick={!adventureResultChrome}
            bodyPaddingClassName={
                isMobile
                    ? `!p-2 !pt-[max(0.65rem,env(safe-area-inset-top,0px))] !pb-[max(0.65rem,env(safe-area-inset-bottom,0px))] min-[390px]:!p-2.5 min-[390px]:!pt-[max(0.65rem,env(safe-area-inset-top,0px))] min-[390px]:!pb-[max(0.65rem,env(safe-area-inset-bottom,0px))]`
                    : '!p-3.5 sm:!p-4'
            }
        >
            <div
                className={`relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-amber-500/35 bg-gradient-to-b from-[#141a28] via-[#0d111c] to-[#080b12] shadow-[0_0_0_1px_rgba(251,191,36,0.08),0_24px_48px_-20px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]${isMobile ? ' h-full min-h-0 flex-1' : ''}`}
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
                } ${isMobile ? 'min-h-0 flex-1 basis-0 p-2 text-sm min-[390px]:p-2.5' : 'p-2.5 text-[0.875rem]'}`}
                style={!isMobile ? { fontSize: resultModalFontPx(12.5, desktopTextScale) } : undefined}
            >
                {!isMobile && (
                <h1
                    className={`mb-1.5 flex-shrink-0 text-center font-black tracking-[0.12em] drop-shadow-[0_2px_14px_rgba(0,0,0,0.55)] sm:mb-2 ${color}`}
                    style={{ fontSize: resultModalFontPx(19, desktopTextScale) }}
                >
                    {title}
                </h1>
                )}
                {isMobile ? (
                    <div
                        className={`mb-1.5 flex-shrink-0 rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-950/45 via-slate-900/90 to-slate-950/95 px-2 py-1.5 text-center shadow-[0_0_24px_-12px_rgba(251,191,36,0.35)] ring-1 ring-inset ring-amber-500/15 min-[390px]:px-2.5 min-[390px]:py-2`}
                    >
                        <h1
                            className={`font-black tracking-[0.1em] ${color}`}
                            style={{ fontSize: resultModalFontPx(17, mobileTextScale) }}
                        >
                            {title}
                        </h1>
                    </div>
                ) : null}
                {isMobile ? (
                    <GameResultModalFitContent className="flex-1 basis-0" enabled={false}>
                    <div className="flex flex-col gap-2 overflow-x-hidden min-[390px]:gap-2.5">
                                    <div className="flex flex-col items-center rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900/90 via-[#121318] to-[#0a0a0e] p-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-500/10 min-[390px]:p-2.5">
                                        <h2
                                            className="mb-0 w-full flex-shrink-0 border-b border-amber-500/25 pb-1.5 text-center text-xs font-bold uppercase tracking-[0.12em] text-amber-200/85"
                                            style={mobileSectionTitleStyle}
                            >
                                {t('summary.gameContent')}
                            </h2>
                            {!isChampionshipVersusSummary ? (
                                <>
                                    <p
                                        className="mb-1.5 w-full flex-shrink-0 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400/90 min-[1024px]:text-xs"
                                        style={desktopSectionHeadStyle}
                                    >
                                        {translateGameMode(session.mode)}
                                    </p>
                                    <p
                                        className="mb-1 w-full flex-shrink-0 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400/90"
                                        style={mobileSectionTitleStyle}
                                    >
                                        {translateGameMode(session.mode)}
                                    </p>
                                </>
                            ) : null}
                                        {isGuildWar ? (
                                            <div
                                                className="mb-1 mt-1 flex flex-shrink-0 flex-col items-center gap-0.5"
                                                aria-label={t('summary.starsEarnedAria', { count: guildWarStars })}
                                            >
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <span
                                                        className="text-[0.58rem] font-semibold uppercase tracking-wider text-slate-400"
                                                        style={{ fontSize: `${8 * mobileTextScale}px` }}
                                                    >
                                                        {t('summary.starsEarned')}
                                                    </span>
                                                    {[0, 1, 2].map((i) => (
                                                        <img
                                                            key={i}
                                                            src={
                                                                i < guildWarStars
                                                                    ? '/images/guild/guildwar/clearstar.webp'
                                                                    : '/images/guild/guildwar/emptystar.webp'
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
                                        <div className="mt-2 flex w-full flex-col items-center overflow-x-hidden overflow-y-visible">
                                            {renderGameContent()}
                                        </div>
                                    </div>
                                    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900/92 via-[#121318] to-[#0a0a0e] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-500/10 min-[390px]:p-2.5">
                                        <h2
                                            className="mb-0 flex-shrink-0 border-b border-violet-500/25 pb-1.5 text-center text-xs font-bold uppercase tracking-[0.12em] text-amber-100 sm:text-sm"
                                            style={mobileSectionTitleStyle}
                                        >
                                            {isGuildWar ? t('summary.rewardsSection') : t('summary.resultSection')}
                                        </h2>
                                        {renderRecordIdentityPanels()}
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
                                        ) : postGameStatsSummary ? (
                                            <div className="min-w-0 overflow-x-hidden overflow-y-visible">
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    <div className={`${statCardClass} text-center`}>
                                                        <p className={statLabelClass}>{t('summary.rankingScore')}</p>
                                                        <div className={statCardBodyClass}>
                                                            <span className={statValueMainClass}>{postGameStatsSummary.rating.final}</span>
                                                            <span
                                                                className={`rounded-full border px-1.5 py-px text-[0.6rem] font-bold tabular-nums leading-none min-[1024px]:text-[0.65rem] ${
                                                                    postGameStatsSummary.rating.change >= 0
                                                                        ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
                                                                        : 'border-rose-400/35 bg-rose-500/15 text-rose-200'
                                                                }`}
                                                            >
                                                                {postGameStatsSummary.rating.change > 0 ? '+' : ''}
                                                                {postGameStatsSummary.rating.change}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {showMannerPostGameStats ? (
                                                        <div className={`${statCardClass} text-center`}>
                                                            <p className={statLabelClass}>{t('summary.mannerScore')}</p>
                                                            <div className={statCardBodyClass}>
                                                                <span className={statValueMannerClass}>{postGameStatsSummary.manner.final}</span>
                                                                {postGameStatsSummary.manner.change === 0 ? (
                                                                    <span className="text-[0.6rem] font-semibold text-slate-500 min-[1024px]:text-[0.65rem]">
                                                                        {t('summary.noChange')}
                                                                    </span>
                                                                ) : (
                                                                    <span
                                                                        className={`inline-flex items-center gap-0.5 text-[0.6rem] font-bold tabular-nums min-[1024px]:text-[0.65rem] ${
                                                                            postGameStatsSummary.manner.change > 0 ? 'text-emerald-300' : 'text-rose-300'
                                                                        }`}
                                                                    >
                                                                        <span aria-hidden>{postGameStatsSummary.manner.change > 0 ? '↑' : '↓'}</span>
                                                                        <span>
                                                                            {postGameStatsSummary.manner.change > 0
                                                                                ? postGameStatsSummary.manner.change
                                                                                : Math.abs(postGameStatsSummary.manner.change)}
                                                                            {t('summary.pointsDelta')}
                                                                        </span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                    <div className={`${statCardClass} text-center`}>
                                                        <p className={statLabelClass}>{t('summary.overallRecord')}</p>
                                                        <div className={statCardBodyClass}>
                                                            {postGameStatsSummary.overallRecord != null ? (
                                                                <span className={statOverallClass}>
                                                                    <span className="text-amber-200">{postGameStatsSummary.overallRecord.wins}</span>
                                                                    <span className="text-[0.7rem] font-bold text-slate-300">{t('summary.winShort')}</span>
                                                                    <span className="text-slate-100">{postGameStatsSummary.overallRecord.losses}</span>
                                                                    <span className="text-[0.7rem] font-bold text-slate-300">{t('summary.loseShort')}</span>
                                                                </span>
                                                            ) : (
                                                                <span className="text-sm font-bold text-slate-500">-</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {showMannerPostGameStats ? (
                                                        <div className={`${statCardClass} text-center`}>
                                                            <p className={statLabelClass}>{t('summary.mannerRank')}</p>
                                                            <div className={statCardBodyClass}>
                                                                <span className="flex flex-wrap items-center justify-center gap-0.5 text-[0.65rem] font-bold text-violet-200/95 min-[1024px]:text-xs">
                                                                    <span className="rounded border border-violet-400/25 bg-violet-950/40 px-1 py-px">{initialMannerRank}</span>
                                                                    <span className="text-slate-500">→</span>
                                                                    <span className="rounded border border-violet-400/35 bg-violet-900/35 px-1 py-px">{finalMannerRank}</span>
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                        {pvpRewardsSection}
                    </div>
                    </GameResultModalFitContent>
                ) : (
                    <GameResultModalFitContent className="min-h-0 flex-1">
                    <div className="flex min-h-0 flex-col gap-2 overflow-x-hidden sm:gap-2.5">
                        <div className="flex shrink-0 flex-col items-center overflow-visible rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900/90 via-[#121318] to-[#0a0a0e] p-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-500/10">
                            <h2
                                className="mb-0 w-full flex-shrink-0 border-b border-amber-500/20 pb-1 text-center font-bold uppercase tracking-[0.12em] text-amber-200/85"
                                style={desktopSectionHeadStyle}
                            >
                                {t('summary.gameContent')}
                            </h2>
                            {!isChampionshipVersusSummary ? (
                                <p
                                    className="mb-1.5 w-full flex-shrink-0 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400/90 min-[1024px]:text-xs"
                                    style={desktopSectionHeadStyle}
                                >
                                    {translateGameMode(session.mode)}
                                </p>
                            ) : null}
                            {isGuildWar ? (
                                <div className="mb-2 mt-1.5 flex flex-shrink-0 flex-col items-center gap-0.5" aria-label={t('summary.starsEarnedAria', { count: guildWarStars })}>
                                    <div className="flex items-center justify-center gap-1.5">
                                        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-400 min-[1024px]:text-xs">
                                            {t('summary.starsEarned')}
                                        </span>
                                        {[0, 1, 2].map((i) => (
                                            <img
                                                key={i}
                                                src={
                                                    i < guildWarStars
                                                        ? '/images/guild/guildwar/clearstar.webp'
                                                        : '/images/guild/guildwar/emptystar.webp'
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
                                desktopTextScale={desktopTextScale}
                            />
                            <div className="flex w-full min-h-0 flex-col items-center overflow-x-hidden overflow-y-visible pr-0.5">
                                {renderGameContent()}
                            </div>
                        </div>
                        <div className="flex min-h-0 min-w-0 shrink-0 flex-col gap-2 overflow-visible rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900/92 via-[#121318] to-[#0a0a0e] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-500/10">
                                <h2
                                    className="mb-0 flex-shrink-0 border-b border-violet-500/25 pb-1 text-center font-bold uppercase tracking-[0.12em] text-violet-200/85"
                                    style={desktopSectionHeadStyle}
                                >
                                    {isGuildWar ? t('summary.rewardsSection') : t('summary.resultSection')}
                                </h2>
                                {renderRecordIdentityPanels()}
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
                                ) : postGameStatsSummary ? (
                                    <div className={`${isAdventureGame ? 'min-h-0' : 'min-h-0'} min-w-0 flex-1 overflow-x-hidden overflow-y-visible`}>
                                        <div className="grid grid-cols-2 gap-0.5 sm:gap-1">
                                            <div className={`${statCardClass} text-center`}>
                                                <p className={statLabelClass}>{gs('rankingScore')}</p>
                                                <div className={statCardBodyClass}>
                                                    <span className={statValueMainClass}>{postGameStatsSummary.rating.final}</span>
                                                    <span
                                                        className={`rounded-full border px-1.5 py-px text-[0.6rem] font-bold tabular-nums leading-none min-[1024px]:text-[0.65rem] ${
                                                            postGameStatsSummary.rating.change >= 0
                                                                ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
                                                                : 'border-rose-400/35 bg-rose-500/15 text-rose-200'
                                                        }`}
                                                    >
                                                        {postGameStatsSummary.rating.change > 0 ? '+' : ''}
                                                        {postGameStatsSummary.rating.change}
                                                    </span>
                                                </div>
                                            </div>
                                            {showMannerPostGameStats ? (
                                                <div className={`${statCardClass} text-center`}>
                                                    <p className={statLabelClass}>{gs('mannerScore')}</p>
                                                    <div className={statCardBodyClass}>
                                                        <span className={statValueMannerClass}>{postGameStatsSummary.manner.final}</span>
                                                        {postGameStatsSummary.manner.change === 0 ? (
                                                            <span className="text-[0.6rem] font-semibold text-slate-500 min-[1024px]:text-[0.65rem]">{gs("noChange")}</span>
                                                        ) : (
                                                            <span
                                                                className={`inline-flex items-center gap-0.5 text-[0.6rem] font-bold tabular-nums min-[1024px]:text-[0.65rem] ${
                                                                    postGameStatsSummary.manner.change > 0 ? 'text-emerald-300' : 'text-rose-300'
                                                                }`}
                                                            >
                                                                <span aria-hidden>{postGameStatsSummary.manner.change > 0 ? '↑' : '↓'}</span>
                                                                <span>
                                                                    {postGameStatsSummary.manner.change > 0
                                                                        ? postGameStatsSummary.manner.change
                                                                        : Math.abs(postGameStatsSummary.manner.change)}
                                                                    {gs('pointsDelta')}
                                                                </span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : null}
                                            <div className={`${statCardClass} text-center`}>
                                                <p className={statLabelClass}>{gs('overallRecord')}</p>
                                                <div className={statCardBodyClass}>
                                                    {postGameStatsSummary.overallRecord != null ? (
                                                        <span className={statOverallClass}>
                                                            <span className="text-amber-200">{postGameStatsSummary.overallRecord.wins}</span>
                                                            <span className="text-[0.65rem] font-bold text-slate-500">{gs("winShort")}</span>
                                                            <span className="text-slate-200">{postGameStatsSummary.overallRecord.losses}</span>
                                                            <span className="text-[0.65rem] font-bold text-slate-500">{gs("loseShort")}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm font-bold text-slate-500">-</span>
                                                    )}
                                                </div>
                                            </div>
                                            {showMannerPostGameStats ? (
                                                <div className={`${statCardClass} text-center`}>
                                                    <p className={statLabelClass}>{gs('mannerRank')}</p>
                                                    <div className={statCardBodyClass}>
                                                        <span className="flex flex-wrap items-center justify-center gap-0.5 text-[0.65rem] font-bold text-violet-200/95 min-[1024px]:text-xs">
                                                            <span className="rounded border border-violet-400/25 bg-violet-950/40 px-1 py-px">{initialMannerRank}</span>
                                                            <span className="text-slate-500">→</span>
                                                            <span className="rounded border border-violet-400/35 bg-violet-900/35 px-1 py-px">{finalMannerRank}</span>
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                ) : null}
                        </div>
                        {pvpRewardsSection}
                    </div>
                    </GameResultModalFitContent>
                )}
            </div>
            </div>
        </DraggableWindow>
    );
};

export default GameSummaryModal;
