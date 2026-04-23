import React, { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
// FIX: Import missing types from the centralized types file.
import { Player, GameProps, GameMode, User, AlkkagiPlacementType, GameSettings, GameStatus, UserWithStatus } from '../../types/index.js';
import Avatar from '../Avatar.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, ALKKAGI_TURN_TIME_LIMIT, CURLING_TURN_TIME_LIMIT, DICE_GO_MAIN_PLACE_TIME, DICE_GO_MAIN_ROLL_TIME, ALKKAGI_PLACEMENT_TIME_LIMIT, ALKKAGI_SIMULTANEOUS_PLACEMENT_TIME_LIMIT, aiUserId, AVATAR_POOL, BORDER_POOL, PLAYFUL_MODE_FOUL_LIMIT, THIEF_NIGHTS_PER_SEGMENT } from '../../constants';
import { SINGLE_PLAYER_STAGES } from '../../constants/singlePlayerConstants.js';
import { TOWER_AI_BOT_DISPLAY_NAME, TOWER_STAGES } from '../../constants/towerConstants.js';
import {
    resolveAiLobbyProfileStepFromSettings,
    strategicAiDisplayLevelFromProfileStep,
} from '../../shared/utils/strategicAiDifficulty.js';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';
import { mergeStaffNicknameDisplayClass } from '../../shared/utils/staffNicknameDisplay.js';
import { getAdventureCodexMonsterById } from '../../constants/adventureMonstersCodex.js';
import { adventureEncounterCountdownUiActive } from '../../shared/utils/adventureEncounterUi.js';
import { getAdventureEncounterCountdownMinutes } from '../../shared/utils/adventureBattleBoard.js';
import { isIntro11IngameStepRead, isIntro11TutorialActiveForGame, markIntro11IngameStepRead } from '../../utils/singlePlayerIntro11Tutorial.js';
import {
    ONBOARDING_SPOTLIGHT_DIM_LAYER_CLASS,
    spotlightDimClipPathFromPxRect,
} from '../../utils/onboardingSpotlightDimClipPath.js';

const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const total = Math.floor(seconds);
    const hrs = Math.floor(total / 3600);
    const min = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    return `${String(hrs).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

/** 모험 인카운터 등: 99분 미만은 MM:SS */
const formatTimeMmSs = (totalSeconds: number) => {
    const s = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

type CurlingScoreBoxMeta = {
    round: number;
    totalRounds: number;
    stonesLeft: number;
    totalStones: number;
};

const CapturedStones: React.FC<{
    count: number;
    target?: number;
    panelType: 'black' | 'white' | 'neutral';
    mode: GameMode;
    isMobile?: boolean;
    /** 컬링: 라운드·남은 스톤을 점수 박스 안에 함께 표시 */
    curlingMeta?: CurlingScoreBoxMeta;
    /** false: 상단 패널 세로 스택 등 — 부모 높이를 채우지 않아 겹침 방지 */
    fillStretchHeight?: boolean;
    /** 모험 지역 이해도 시작 가산 — 따낸 숫자 옆 작은 `(+N)` */
    inlineHeadStartBonus?: number;
}> = ({ count, target, panelType, mode, isMobile = false, curlingMeta, fillStretchHeight = true, inlineHeadStartBonus }) => {
    /** 주사위 전용 */
    const displayCount = typeof target === 'number' && target > 0 ? `${count}/${target}` : `${count}`;
    const isDiceGo = mode === GameMode.Dice;
    const isCurling = mode === GameMode.Curling && curlingMeta != null;

    let label = '따낸 돌';
    if (isDiceGo) {
        label = '포획 점수';
    } else if ([GameMode.Thief, GameMode.Curling].includes(mode)) {
        label = '점수';
    }

    const widthClass =
        isMobile && isCurling ? 'w-[5.35rem] min-w-[5.35rem]' : isMobile ? 'w-[4.25rem]' : isCurling ? 'w-[clamp(5rem,17vmin,6.5rem)]' : 'w-[clamp(4.5rem,16vmin,6rem)]';
    const paddingClass = isCurling ? (isMobile ? 'px-1 py-1.5' : 'px-1.5 py-1.5') : isMobile ? 'p-1' : 'p-1';
    const labelSize = isMobile ? 'text-[0.65rem]' : 'text-[clamp(0.6rem,2vmin,0.75rem)]';
    const countSize = isMobile && isCurling ? 'text-base' : isMobile ? 'text-sm' : 'text-[clamp(1rem,5vmin,2rem)]';
    const diceSize = isMobile ? 'h-2.5 w-2.5' : 'w-[clamp(0.8rem,3vmin,1rem)] h-[clamp(0.8rem,3vmin,1rem)]';
    const marginClass = isCurling ? 'my-0' : isMobile ? 'my-0.5' : 'my-1';

    const heightStretchClass = isCurling ? 'min-h-0 self-stretch' : fillStretchHeight ? 'h-full' : 'h-auto min-h-0';
    const baseClasses = `flex shrink-0 flex-col items-center justify-center ${widthClass} rounded-lg shadow-lg border-2 ${paddingClass} text-center ${heightStretchClass}`;
    let colorClasses = '';
    let labelColor = 'text-gray-300';
    let countColor = 'text-white';

    if (panelType === 'white') {
        colorClasses = 'bg-gradient-to-br from-slate-100 to-slate-300/95 border-slate-500/90 shadow-sm';
        labelColor = 'text-slate-800';
        countColor = 'text-slate-950';
    } else { // black or neutral
        colorClasses = 'bg-gradient-to-br from-gray-800 to-black border-gray-600';
    }

    const metaMuted =
        panelType === 'white' ? 'text-slate-700 border-slate-500/50' : 'text-gray-400 border-white/10';

    return (
        <div className={`${baseClasses} ${colorClasses}`}>
            <span className={`${labelColor} ${labelSize} font-semibold leading-none`}>{label}</span>
            {isDiceGo ? (
                <div className={`font-mono font-bold ${countSize} tracking-tighter ${marginClass} ${countColor} flex items-center justify-center gap-0.5`}>
                    <div className={`${diceSize} rounded-full bg-white border border-black inline-block flex-shrink-0`}></div>
                    <span>{displayCount}</span>
                </div>
            ) : (
                <div
                    className={`font-mono font-bold ${countSize} tabular-nums leading-none ${marginClass} ${countColor} flex flex-wrap items-baseline justify-center gap-x-0.5`}
                >
                    <span>{count}</span>
                    {inlineHeadStartBonus != null && inlineHeadStartBonus > 0 ? (
                        <span
                            className={`font-semibold leading-none ${isMobile ? 'text-[0.58rem]' : 'text-[clamp(0.58rem,2.2vmin,0.72rem)]'} ${
                                panelType === 'white' ? 'text-slate-600' : 'text-amber-200/95'
                            }`}
                        >
                            (+{inlineHeadStartBonus})
                        </span>
                    ) : null}
                    {typeof target === 'number' && target > 0 ? (
                        <span className={`font-bold ${isMobile ? 'text-sm' : 'text-[clamp(0.85rem,3.5vmin,1.35rem)]'} opacity-95`}>
                            /{target}
                        </span>
                    ) : null}
                </div>
            )}
            {isCurling && curlingMeta && (
                <div className={`mt-1.5 w-full border-t pt-1.5 ${metaMuted}`}>
                    <div className={`flex flex-col gap-0.5 ${labelSize} font-semibold tabular-nums leading-tight`}>
                        <span>
                            라운드 {curlingMeta.round}/{curlingMeta.totalRounds}
                        </span>
                        <span>
                            스톤 {curlingMeta.stonesLeft}/{curlingMeta.totalStones}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};


const TimeBar: React.FC<{
    timeLeft: number;
    totalTime: number;
    byoyomiTime: number;
    byoyomiPeriods: number;
    totalByoyomi: number;
    isActive: boolean;
    isInByoyomi: boolean;
    isFoulMode?: boolean;
    isMobile?: boolean;
    /** 백 패널 등 밝은 배경 위에서 막대 대비 강화 */
    lightSurface?: boolean;
}> = ({ timeLeft, totalTime, byoyomiTime, byoyomiPeriods, totalByoyomi, isActive, isInByoyomi, isFoulMode = false, isMobile = false, lightSurface = false }) => {
    const percent = useMemo(() => {
        if (isFoulMode) {
             const turnTime = totalTime > 0 ? totalTime : byoyomiTime;
             return turnTime > 0 ? (timeLeft / turnTime) * 100 : 0;
        }
        if (isInByoyomi) {
            if (!isActive) return 100;
            return byoyomiTime > 0 ? (timeLeft / byoyomiTime) * 100 : 0;
        }
        return totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
    }, [timeLeft, totalTime, byoyomiTime, isInByoyomi, isFoulMode, isActive]);

    const clampedPercent = Math.max(0, Math.min(100, percent));

    const barH = isMobile ? 'h-2' : 'h-1.5';
    const trackClass =
        isInByoyomi || isFoulMode
            ? 'bg-red-900/75'
            : lightSurface
              ? 'bg-slate-600/90 ring-1 ring-inset ring-slate-900/15'
              : 'bg-gray-700';
    const fillClass =
        isInByoyomi || isFoulMode ? 'bg-red-600' : lightSurface ? 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.45)]' : 'bg-blue-500';
    return (
        <div className="w-full relative">
            {/* The bar track */}
            <div className={`w-full ${barH} rounded-full transition-colors ${trackClass}`}>
                {/* The bar fill */}
                <div
                    className={`${barH} rounded-full ${fillClass} ${isActive && timeLeft < 5 ? 'animate-pulse' : ''}`}
                    style={{ width: `${clampedPercent}%`, transition: 'width 0.2s linear' }}
                />
            </div>
        </div>
    );
};

/** 시간 제어 표시: PVP 기본 + 길드전 AI 대국(유저만 시간제어 표시) */
const showTimeControl = (session: GameProps['session']): boolean => {
    if (!session) return false;
    if (session.gameCategory === 'guildwar' && session.isAiGame) return true;
    return !!(!session.isAiGame && !session.isSinglePlayer && session.gameCategory !== 'tower' && session.gameCategory !== 'singleplayer');
};

interface SinglePlayerPanelProps {
    user: User; playerEnum: Player; score: number; isActive: boolean;
    timeLeft: number; totalTime: number; mainTimeLeft: number; byoyomiPeriodsLeft: number;
    totalByoyomi: number; byoyomiTime: number; isLeft: boolean; session: GameProps['session'];
    captureTarget?: number; role?: '도둑' | '경찰';
    isAiPlayer?: boolean;
    mode: GameMode;
    // FIX: Add isSinglePlayer prop to handle different UI themes
    isSinglePlayer?: boolean;
    isMobile?: boolean;
    /** AI/싱글/탑: 제한시간 대신 경과 시간만 표시 (카운트다운/초읽기 숨김) */
    showElapsedOnly?: boolean;
    /** 경과 시간을 표시할지 여부 (유저 패널에만 true로 전달) */
    isCurrentUser?: boolean;
    /** 네이티브 모바일·좁은 뷰포트 상단 바: 말줄임 대신 줄바꿈·가변 글자로 전체 표시 */
    fluidTextLayout?: boolean;
    /** 모험 경기장: TimeBar용 전체 제한 시간 남은 초(양쪽 패널 동일) */
    adventureMatchCountdownSec?: number | null;
    adventureMatchTotalSec?: number | null;
    /** 싱글 인게임 온보딩: 스포트라이트·링 타깃(실제 패널 카드) */
    spIngameOnboardingUserTarget?: boolean;
    /** 모험 AI 상대: 도감 초상·이름·레벨 표시 */
    opponentMonsterDisplay?: { portraitUrl: string; displayName: string; level: number };
    /** 모험 지역 이해도 시작 가산 — 따낸 숫자 옆 `(+N)` */
    captureHeadStartFlatBonus?: number;
}

const SinglePlayerPanel: React.FC<SinglePlayerPanelProps> = (props) => {
    const {
        user,
        playerEnum,
        score,
        isActive,
        timeLeft,
        totalTime,
        mainTimeLeft,
        byoyomiPeriodsLeft,
        totalByoyomi,
        byoyomiTime,
        isLeft,
        session,
        captureTarget,
        role,
        isAiPlayer,
        mode,
        isSinglePlayer,
        isMobile = false,
        showElapsedOnly = false,
        isCurrentUser = false,
        fluidTextLayout = false,
        opponentMonsterDisplay,
        adventureMatchCountdownSec = null,
        adventureMatchTotalSec = null,
        spIngameOnboardingUserTarget = false,
        captureHeadStartFlatBonus,
    } = props;
    const { gameStatus, winner, blackPlayerId, whitePlayerId } = session;

    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === user.avatarId)?.url, [user.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === user.borderId)?.url, [user.borderId]);

    const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === mode);
    const isFoulMode = PLAYFUL_GAME_MODES.some(m => m.mode === mode) && ![GameMode.Omok, GameMode.Ttamok].includes(mode);
    const isCurling = mode === GameMode.Curling;
    
    const foulLimit = PLAYFUL_MODE_FOUL_LIMIT;
    const safeTotalByoyomi = typeof totalByoyomi === 'number' ? totalByoyomi : (session.settings.byoyomiCount ?? 0);
    const safeByoyomiPeriodsLeft = typeof byoyomiPeriodsLeft === 'number' ? byoyomiPeriodsLeft : (session.settings.byoyomiCount ?? 0);
    const effectiveByoyomiTime = isFoulMode ? totalTime : (byoyomiTime ?? 0);
    const effectiveTotalByoyomi = isFoulMode ? foulLimit : safeTotalByoyomi;
    const effectiveByoyomiPeriodsLeft = Math.max(0, isFoulMode ? (foulLimit - (session.timeoutFouls?.[user.id] || 0)) : safeByoyomiPeriodsLeft);
    const showByoyomiStatus = isFoulMode ? true : (effectiveTotalByoyomi > 0);

    const levelToDisplay = isStrategic ? user.strategyLevel : user.playfulLevel;
    const levelLabel = isStrategic ? '전략' : '놀이';
    let levelText = `${levelLabel} Lv.${levelToDisplay}`;

    // 전략바둑 AI 대국: 상단 패널에서 봇 이름 옆에 AI 난이도(단계 1~10 → 표시 레벨 1,3,5,…,50)
    const isStrategicAiGame = session.isAiGame && isStrategic && !session.isSinglePlayer && session.gameCategory !== 'tower' && session.gameCategory !== 'singleplayer';
    if (opponentMonsterDisplay) {
        levelText = `Lv.${opponentMonsterDisplay.level}`;
    } else if (isStrategicAiGame && isAiPlayer) {
        const profileStep = resolveAiLobbyProfileStepFromSettings(session.settings as GameSettings);
        const displayAiLevel = strategicAiDisplayLevelFromProfileStep(profileStep);
        levelText = `${levelText} · AI Lv.${displayAiLevel}`;
    }

    const orderClass = isLeft ? 'flex-row' : 'flex-row-reverse';
    const textAlignClass = isLeft ? 'text-left' : 'text-right';
    const justifyClass = isLeft ? 'justify-start' : 'justify-end';
    
    const isGameEnded = ['ended', 'no_contest', 'rematch_pending'].includes(gameStatus);
    const isWinner = (winner === Player.Black && blackPlayerId === user.id) || (winner === Player.White && whitePlayerId === user.id);
    const isLoser = (winner === Player.Black || winner === Player.White) && !isWinner;
    
    const isInByoyomi = !isFoulMode && mainTimeLeft <= 0 && totalByoyomi > 0;

    const useAdventureMatchCountdown =
        adventureEncounterCountdownUiActive(session.gameCategory, session.gameStatus) &&
        adventureMatchCountdownSec != null &&
        adventureMatchTotalSec != null &&
        adventureMatchTotalSec > 0;

    const adventureHumanEnumForPanel =
        session.blackPlayerId === aiUserId
            ? Player.White
            : session.whitePlayerId === aiUserId
              ? Player.Black
              : Player.Black;
    const adventureMonsterTurnPanel =
        session.gameCategory === 'adventure' &&
        useAdventureMatchCountdown &&
        session.currentPlayer !== Player.None &&
        session.currentPlayer !== adventureHumanEnumForPanel;

    const isDiceGo = mode === GameMode.Dice;
    const isBlackPanel = isDiceGo || playerEnum === Player.Black;
    const isWhitePanel = !isDiceGo && playerEnum === Player.White;

    const panelType = isBlackPanel ? 'black' : isWhitePanel ? 'white' : 'neutral';

    let panelColorClasses = '';
    let nameTextClasses = '';
    let levelTextClasses = '';
    let timeTextClasses = '';

    // FIX: Apply single-player specific styling
    if (isSinglePlayer) {
        panelColorClasses = isActive && !isGameEnded
            ? 'bg-stone-800 ring-2 ring-amber-300/90 border-amber-300/80 shadow-[0_0_0_1px_rgba(252,211,77,0.35),0_0_24px_-8px_rgba(252,211,77,0.85)]'
            : 'bg-stone-900/50 border-stone-700';
        nameTextClasses = 'text-stone-100';
        levelTextClasses = 'text-stone-400';
        timeTextClasses = 'text-stone-200';
    } else {
        if (panelType === 'black') {
            panelColorClasses = isActive && !isGameEnded
                ? 'bg-gray-800 ring-2 ring-cyan-300/90 border-cyan-300/80 shadow-[0_0_0_1px_rgba(103,232,249,0.35),0_0_24px_-8px_rgba(34,211,238,0.85)]'
                : 'bg-black/50 border-gray-700';
            nameTextClasses = 'text-white';
            levelTextClasses = 'text-gray-400';
            timeTextClasses = 'text-gray-200';
        } else if (panelType === 'white') {
            panelColorClasses = isActive && !isGameEnded
                ? 'bg-gradient-to-br from-white via-sky-50 to-blue-100/95 ring-2 ring-blue-600/90 border-blue-600 shadow-[0_0_0_1px_rgba(37,99,235,0.35),0_0_22px_-8px_rgba(37,99,235,0.45)]'
                : 'bg-gradient-to-br from-slate-100 to-slate-300/95 border-slate-500/90 shadow-sm';
            nameTextClasses = 'text-slate-950 font-bold';
            levelTextClasses = 'text-slate-800';
            timeTextClasses = 'text-slate-950';
        } else { // Neutral/unassigned
            panelColorClasses = isActive && !isGameEnded
                ? 'bg-blue-900/50 ring-2 ring-blue-400/90 border-blue-300/70 shadow-[0_0_18px_-8px_rgba(96,165,250,0.85)]'
                : 'bg-gray-800/30';
            nameTextClasses = 'text-white';
            levelTextClasses = 'text-gray-400';
            timeTextClasses = 'text-gray-200';
        }
    }
    
    const winnerColor = isSinglePlayer ? 'text-amber-300' : (isBlackPanel ? 'text-yellow-300' : 'text-amber-800');
    const loserColor = isSinglePlayer ? 'text-stone-500' : (isWhitePanel ? 'text-slate-600' : 'text-gray-500');
    const finalNameClass = isWinner ? winnerColor : isLoser ? loserColor : nameTextClasses;
    const showActiveBorderPulse = isActive && !isGameEnded;
    const activeBorderPulseClass = isSinglePlayer
        ? 'border-amber-300/90 shadow-[0_0_0_1px_rgba(252,211,77,0.45),0_0_22px_-6px_rgba(252,211,77,0.85)]'
        : (panelType === 'black'
            ? 'border-cyan-300/90 shadow-[0_0_0_1px_rgba(103,232,249,0.45),0_0_22px_-6px_rgba(34,211,238,0.85)]'
            : (panelType === 'white'
                ? 'border-blue-600/95 shadow-[0_0_0_1px_rgba(29,78,216,0.45),0_0_22px_-6px_rgba(37,99,235,0.55)]'
                : 'border-blue-300/85 shadow-[0_0_18px_-8px_rgba(96,165,250,0.85)]'));

    const totalStones = session.settings.curlingStoneCount || 5;
    const stonesThrown = session.stonesThrownThisRound?.[user.id] || 0;
    const stonesLeft = totalStones - stonesThrown;

    const avatarSize = isMobile ? 40 : 48;
    const nameTextSize = fluidTextLayout
        ? 'text-[clamp(0.5625rem,2.35vmin,0.8125rem)] min-[380px]:text-[clamp(0.625rem,2.15vmin,0.875rem)]'
        : isMobile
          ? 'text-sm'
          : 'text-[clamp(0.8rem,3vmin,1.125rem)]';
    const levelTextSize = fluidTextLayout
        ? 'text-[clamp(0.5rem,2.05vmin,0.6875rem)] min-[380px]:text-[clamp(0.5625rem,1.9vmin,0.75rem)]'
        : isMobile
          ? 'text-xs'
          : 'text-[clamp(0.6rem,2vmin,0.75rem)]';
    const timeTextSize = isMobile ? 'text-base' : 'text-[clamp(1rem,3.5vmin,1.25rem)]';
    /** 좁은 상단 바: 타이머·승패가 닉네임과 겹치지 않도록 더 작게 */
    const displayTimeTextSize =
        fluidTextLayout && isMobile ? 'text-[clamp(0.625rem,2.35vmin,0.8125rem)]' : timeTextSize;
    const winLoseTextSize = isMobile ? 'text-xl' : 'text-2xl';
    const displayWinLoseTextSize =
        fluidTextLayout && isMobile ? 'text-base font-black' : `${winLoseTextSize} font-black`;
    /** 모바일: 이름 옆 승·패가 flex-1 닉네임과 경쟁해 말줄임 발생 → 아바타 위 오버레이만 사용 */
    const showWinLoseAvatarOverlay = isMobile && isGameEnded && (isWinner || isLoser);
    const winLoseAvatarRibbonClass =
        'pointer-events-none absolute inset-x-0 bottom-0 flex justify-center rounded-b-md py-[2px] text-[10px] font-black leading-none text-white shadow-[0_-1px_6px_rgba(0,0,0,0.45)]';
    const winLoseAvatarRibbon =
        showWinLoseAvatarOverlay && isWinner ? (
            <span className={`${winLoseAvatarRibbonClass} bg-blue-600/95`} aria-hidden>
                승
            </span>
        ) : showWinLoseAvatarOverlay && isLoser ? (
            <span className={`${winLoseAvatarRibbonClass} bg-red-600/95`} aria-hidden>
                패
            </span>
        ) : null;
    const padding = isMobile ? 'p-1.5' : 'p-1';
    const gap = isMobile ? 'gap-1.5' : 'gap-2';

    const displayNickname = opponentMonsterDisplay?.displayName ?? user.nickname;
    const nameTitle = `${displayNickname}${isAiPlayer && !opponentMonsterDisplay ? ' 🤖' : ''}${role ? ` (${role})` : ''}`;

    const ingameOnboardingUserAttrs = spIngameOnboardingUserTarget
        ? ({ 'data-onboarding-target': 'onboarding-sp-ingame-user-panel' } as const)
        : {};

    /** 모바일·PC 동일: 따낸 돌 패널을 대국자 블록 옆(가로)에 배치 */
    const rootLayoutClass = `items-stretch ${gap} ${orderClass}`;

    const capturedStonesEl = (
        <CapturedStones
            count={score}
            target={captureTarget}
            panelType={panelType}
            mode={mode}
            isMobile={isMobile}
            fillStretchHeight={!fluidTextLayout || isCurling}
            curlingMeta={
                isCurling
                    ? {
                          round: session.curlingRound || 1,
                          totalRounds: session.settings.curlingRounds || 3,
                          stonesLeft,
                          totalStones,
                      }
                    : undefined
            }
            inlineHeadStartBonus={captureHeadStartFlatBonus}
        />
    );

    const compactMainColClass = fluidTextLayout ? 'justify-center gap-0.5' : 'justify-between';

    return (
        <div
            className={`relative flex h-full min-h-0 min-w-0 flex-1 ${rootLayoutClass} ${padding} rounded-lg transition-all duration-300 border ${panelColorClasses} ${fluidTextLayout ? 'max-h-full overflow-hidden' : ''}`}
            {...ingameOnboardingUserAttrs}
        >
            {showActiveBorderPulse && (
                <div className={`pointer-events-none absolute inset-0 rounded-lg border-2 animate-pulse ${activeBorderPulseClass}`} />
            )}
            <div className={`flex min-w-0 flex-1 basis-0 flex-col ${compactMainColClass} ${textAlignClass}`}>
                <div
                    className={`flex min-w-0 shrink-0 ${fluidTextLayout ? 'items-start' : 'items-center'} ${gap} ${isLeft ? '' : 'flex-row-reverse'}`}
                >
                    {opponentMonsterDisplay ? (
                        <div className="relative shrink-0" style={{ width: avatarSize, height: avatarSize }}>
                            <div
                                className="h-full w-full overflow-hidden rounded-md border border-white/20 bg-black/50"
                            >
                                <img
                                    src={opponentMonsterDisplay.portraitUrl}
                                    alt=""
                                    draggable={false}
                                    className="h-full w-full object-contain object-center"
                                />
                            </div>
                            {winLoseAvatarRibbon}
                        </div>
                    ) : (
                        <div className="relative shrink-0 self-center">
                            <Avatar userId={user.id} userName={user.nickname} size={avatarSize} avatarUrl={avatarUrl} borderUrl={borderUrl} />
                            {winLoseAvatarRibbon}
                        </div>
                    )}
                    <div className="min-w-0 w-full flex-1 basis-0">
                        <div
                            className={`flex w-full min-w-0 ${fluidTextLayout ? `flex-nowrap items-baseline gap-x-1 ${justifyClass}` : `items-baseline ${gap} ${justifyClass}`}`}
                        >
                            {!isLeft && isGameEnded && isWinner && !showWinLoseAvatarOverlay && (
                                <span className={`shrink-0 ${displayWinLoseTextSize} text-blue-400`}>승</span>
                            )}
                            {!isLeft && isGameEnded && isLoser && !showWinLoseAvatarOverlay && (
                                <span className={`shrink-0 ${displayWinLoseTextSize} text-red-400`}>패</span>
                            )}
                            <h2
                                className={`min-w-0 max-w-full flex-1 truncate font-bold leading-snug [writing-mode:horizontal-tb] break-words break-keep ${nameTextSize} ${finalNameClass}`}
                                title={nameTitle}
                            >
                                {opponentMonsterDisplay ? (
                                    <span>{opponentMonsterDisplay.displayName}</span>
                                ) : (
                                    <>
                                        <span
                                            className={mergeStaffNicknameDisplayClass(
                                                {
                                                    nickname: user.nickname,
                                                    isAdmin: user.isAdmin,
                                                    staffNicknameDisplayEligibility: user.staffNicknameDisplayEligibility,
                                                },
                                                'inline',
                                            )}
                                        >
                                            {user.nickname}
                                        </span>
                                        {isAiPlayer ? ' 🤖' : ''}
                                    </>
                                )}
                                {role ? ` (${role})` : ''}
                            </h2>
                            {isLeft && isGameEnded && isWinner && !showWinLoseAvatarOverlay && (
                                <span className={`shrink-0 ${displayWinLoseTextSize} text-blue-400`}>승</span>
                            )}
                            {isLeft && isGameEnded && isLoser && !showWinLoseAvatarOverlay && (
                                <span className={`shrink-0 ${displayWinLoseTextSize} text-red-400`}>패</span>
                            )}
                        </div>
                        <p
                            className={`${fluidTextLayout ? 'mt-0' : 'mt-0.5'} max-w-full truncate leading-snug [writing-mode:horizontal-tb] break-words break-keep ${levelTextSize} ${levelTextClasses}`}
                            title={levelText}
                        >
                            {levelText}
                        </p>
                    </div>
                </div>
                <div className={`shrink-0 min-w-0 w-full ${fluidTextLayout ? 'mt-0' : isMobile ? 'mt-0.5' : 'mt-1'}`}>
                    {useAdventureMatchCountdown && !isGameEnded && (
                        <>
                            <TimeBar
                                timeLeft={adventureMatchCountdownSec!}
                                totalTime={adventureMatchTotalSec!}
                                byoyomiTime={effectiveByoyomiTime}
                                byoyomiPeriods={0}
                                totalByoyomi={0}
                                isActive={!adventureMonsterTurnPanel}
                                isInByoyomi={false}
                                isFoulMode={false}
                                isMobile={isMobile}
                                lightSurface={panelType === 'white'}
                            />
                            <div className={`mt-0.5 flex ${justifyClass}`}>
                                <span
                                    className={`font-mono text-xs font-semibold tabular-nums tracking-wide ${
                                        panelType === 'white' ? 'text-slate-800' : 'text-stone-200'
                                    }`}
                                >
                                    {formatTimeMmSs(adventureMatchCountdownSec ?? 0)}
                                </span>
                            </div>
                        </>
                    )}
                    {!useAdventureMatchCountdown && !showElapsedOnly && (
                        <TimeBar
                            timeLeft={timeLeft}
                            totalTime={totalTime}
                            byoyomiTime={effectiveByoyomiTime}
                            byoyomiPeriods={effectiveByoyomiPeriodsLeft}
                            totalByoyomi={effectiveTotalByoyomi}
                            isActive={isActive && !isGameEnded}
                            isInByoyomi={isInByoyomi}
                            isFoulMode={isFoulMode}
                            isMobile={isMobile}
                            lightSurface={panelType === 'white'}
                        />
                    )}
                    {(!useAdventureMatchCountdown && (showElapsedOnly ? isCurrentUser : true)) && (
                    <div className={`flex flex-wrap items-center ${isMobile ? 'mt-0' : 'mt-0.5'} ${justifyClass} gap-x-1 gap-y-0.5`}>
                        {showElapsedOnly ? (
                            <span className={`font-mono font-bold ${timeTextClasses} ${displayTimeTextSize}`}>{formatTime(timeLeft)}</span>
                        ) : (
                            <>
                                <span
                                    className={`min-w-0 font-mono font-bold ${
                                        isInByoyomi || (isFoulMode && timeLeft < 10)
                                            ? panelType === 'white'
                                                ? 'text-red-800'
                                                : 'text-red-400'
                                            : timeTextClasses
                                    } ${displayTimeTextSize}`}
                                >
                                    {formatTime(timeLeft)}
                                </span>
                                {showByoyomiStatus && (
                                    <div
                                        className={`flex shrink-0 items-center gap-1 ${isFoulMode ? 'text-red-300' : 'text-yellow-300'}`}
                                        title={isFoulMode ? `남은 기회 ${effectiveByoyomiPeriodsLeft}회` : undefined}
                                    >
                                        <img
                                            src="/images/icon/timer.png"
                                            alt={isFoulMode ? '남은 기회' : '초읽기'}
                                            className={`object-contain ${fluidTextLayout && isMobile ? 'h-4 w-4' : isMobile ? 'h-5 w-5' : 'h-4 w-4'}`}
                                        />
                                        <span
                                            className={`font-semibold tabular-nums ${fluidTextLayout && isMobile ? 'text-[11px]' : isMobile ? 'text-sm' : 'text-xs'}`}
                                        >
                                            {effectiveByoyomiPeriodsLeft}
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    )}
                </div>
            </div>
            {capturedStonesEl}
        </div>
    );
};

interface PlayerPanelProps extends GameProps {
  clientTimes: { black: number; white: number; };
  // FIX: Add isSinglePlayer prop to handle different UI themes
  isSinglePlayer?: boolean;
  isMobile?: boolean;
  /** 온보딩 phase 6: 유저 패널만 / 점수·턴 줄 전체 스포트라이트 */
  singlePlayerOnboardingBarHighlight?: 'user-panel' | 'scores-bar' | null;
}

const getTurnDuration = (mode: GameMode, gameStatus: GameStatus, settings: GameSettings): number => {
    const isFoulMode = PLAYFUL_GAME_MODES.some(m => m.mode === mode) && ![GameMode.Omok, GameMode.Ttamok].includes(mode);
    if (!isFoulMode) {
        return settings.timeLimit * 60;
    }

    switch (mode) {
        case GameMode.Alkkagi:
            if (gameStatus === 'alkkagi_placement') {
                return ALKKAGI_PLACEMENT_TIME_LIMIT;
            }
            if (gameStatus === 'alkkagi_simultaneous_placement') {
                return ALKKAGI_SIMULTANEOUS_PLACEMENT_TIME_LIMIT;
            }
            return ALKKAGI_TURN_TIME_LIMIT;
        case GameMode.Curling:
            return CURLING_TURN_TIME_LIMIT;
        case GameMode.Dice:
            if (gameStatus === 'dice_rolling') return DICE_GO_MAIN_ROLL_TIME;
            if (gameStatus === 'dice_placing') return DICE_GO_MAIN_PLACE_TIME;
            return DICE_GO_MAIN_ROLL_TIME; // Default for dice
        case GameMode.Thief:
             if (gameStatus === 'thief_rolling') return DICE_GO_MAIN_ROLL_TIME;
             if (gameStatus === 'thief_placing') return DICE_GO_MAIN_PLACE_TIME;
             return DICE_GO_MAIN_ROLL_TIME; // Default for thief
        default:
            return settings.timeLimit * 60;
    }
};


const PlayerPanel: React.FC<PlayerPanelProps> = (props) => {
    const { session, clientTimes, isSinglePlayer, isMobile = false, currentUser, singlePlayerOnboardingBarHighlight = null } = props;
    /** PC 창을 좁혔거나 태블릿 폭: 네이티브 모바일이 아니어도 상단 바가 같은 폭 제약을 받음 */
    const isHandheldViewport = useIsHandheldDevice(1025);
    const compactPlayerBar = isMobile || isHandheldViewport;
    const { player1, player2, blackPlayerId, whitePlayerId, captures, mode, settings, effectiveCaptureTargets, scores, currentPlayer } = session;

    const enforceTime = showTimeControl(session);
    const isBaseRules =
        mode === GameMode.Base || (mode === GameMode.Mix && Boolean(session.settings.mixedModes?.includes(GameMode.Base)));
    const basePrePlayFreezeStatuses: GameStatus[] = [
        'base_placement',
        'komi_bidding',
        'komi_bid_reveal',
        'base_color_roulette',
        'base_komi_result',
        'base_game_start_confirmation',
    ];
    const freezeElapsedForBaseSetup = isBaseRules && basePrePlayFreezeStatuses.includes(session.gameStatus);
    // 경기는 '게임 시작' 버튼을 누른 뒤(playing 등)부터만 경과 시간 산정. pending·베이스 준비 단계에서는 0으로 표시
    const gameStart =
        session.gameStatus === 'pending' || freezeElapsedForBaseSetup
            ? undefined
            : (session.gameStartTime ?? (session as any).startTime ?? session.createdAt);
    const [elapsedSec, setElapsedSec] = useState(0);
    const isEnded = session.gameStatus === 'ended' || session.gameStatus === 'no_contest';
    const isScoring = session.gameStatus === 'scoring';
    const scoringEndTime = isScoring ? (session as { endTime?: number }).endTime : undefined;
    /** 놀이바둑 AI 대국: 경과시간 표시가 벽시계만 쓰이면 AI 생각 중에도 올라가므로, 가상 origin으로 유저 턴에만 흐르게 함 */
    const elapsedClockSessionIdRef = useRef<string | null>(null);
    const displayElapsedOriginMs = useRef<number | undefined>(undefined);
    const playfulAiPauseActiveRef = useRef(false);
    const playfulAiPauseHeldSecRef = useRef<number | null>(null);

    useEffect(() => {
        if (enforceTime) return;
        if (elapsedClockSessionIdRef.current !== session.id) {
            elapsedClockSessionIdRef.current = session.id;
            displayElapsedOriginMs.current = undefined;
            playfulAiPauseActiveRef.current = false;
            playfulAiPauseHeldSecRef.current = null;
        }
        if (!gameStart) {
            setElapsedSec(0);
            displayElapsedOriginMs.current = undefined;
            playfulAiPauseActiveRef.current = false;
            playfulAiPauseHeldSecRef.current = null;
            return;
        }
        // 계가 중이면 타이머 정지: 서버에서 내려준 endTime 기준으로만 표시
        if (isEnded || (isScoring && scoringEndTime != null)) {
            const endMs = isEnded ? (session.turnStartTime ?? Date.now()) : scoringEndTime!;
            setElapsedSec(Math.max(0, Math.floor((endMs - gameStart) / 1000)));
            displayElapsedOriginMs.current = undefined;
            playfulAiPauseActiveRef.current = false;
            playfulAiPauseHeldSecRef.current = null;
            return;
        }

        const isPlayfulMode = PLAYFUL_GAME_MODES.some((m) => m.mode === mode);
        const hasAiSeat = session.blackPlayerId === aiUserId || session.whitePlayerId === aiUserId;
        const isAiTurnNow =
            hasAiSeat &&
            ((session.currentPlayer === Player.Black && session.blackPlayerId === aiUserId) ||
                (session.currentPlayer === Player.White && session.whitePlayerId === aiUserId));
        const pausePlayfulElapsedForAiTurn =
            session.isAiGame && isPlayfulMode && hasAiSeat && isAiTurnNow;

        if (pausePlayfulElapsedForAiTurn) {
            if (!playfulAiPauseActiveRef.current) {
                const originMs = displayElapsedOriginMs.current ?? gameStart;
                displayElapsedOriginMs.current = originMs;
                const snap = Math.max(0, Math.floor((Date.now() - originMs) / 1000));
                playfulAiPauseHeldSecRef.current = snap;
                setElapsedSec(snap);
                playfulAiPauseActiveRef.current = true;
            } else if (playfulAiPauseHeldSecRef.current != null) {
                setElapsedSec(playfulAiPauseHeldSecRef.current);
            }
            return;
        }

        playfulAiPauseActiveRef.current = false;

        if (playfulAiPauseHeldSecRef.current != null) {
            const held = playfulAiPauseHeldSecRef.current;
            playfulAiPauseHeldSecRef.current = null;
            displayElapsedOriginMs.current = Date.now() - held * 1000;
        } else if (displayElapsedOriginMs.current === undefined) {
            displayElapsedOriginMs.current = gameStart;
        }

        const runTick = () =>
            setElapsedSec(Math.max(0, Math.floor((Date.now() - displayElapsedOriginMs.current!) / 1000)));
        runTick();
        const id = setInterval(runTick, 1000);
        return () => clearInterval(id);
    }, [
        enforceTime,
        gameStart,
        session.id,
        session.gameStatus,
        isEnded,
        isScoring,
        scoringEndTime,
        session.turnStartTime,
        mode,
        session.isAiGame,
        session.blackPlayerId,
        session.whitePlayerId,
        session.currentPlayer,
    ]);

    const isScoreMode = [GameMode.Dice, GameMode.Thief, GameMode.Curling].includes(mode);

    const adventureRegionalFlatBonus =
        session.gameCategory === 'adventure' &&
        typeof (session as { adventureRegionalHumanFlatScoreBonus?: number }).adventureRegionalHumanFlatScoreBonus ===
            'number'
            ? Math.max(0, Math.floor(Number((session as { adventureRegionalHumanFlatScoreBonus?: number }).adventureRegionalHumanFlatScoreBonus)))
            : 0;

    const leftPlayerUser = player1;
    const rightPlayerUser = player2;
    const towerOpponentPanelUser =
        session.gameCategory === 'tower' && rightPlayerUser.id === aiUserId
            ? { ...rightPlayerUser, nickname: TOWER_AI_BOT_DISPLAY_NAME }
            : rightPlayerUser;
    
    const leftPlayerEnum = leftPlayerUser.id === blackPlayerId ? Player.Black : (leftPlayerUser.id === whitePlayerId ? Player.White : Player.None);
    const rightPlayerEnum = rightPlayerUser.id === blackPlayerId ? Player.Black : (rightPlayerUser.id === whitePlayerId ? Player.White : Player.None);
    
    const isLeftPlayerActive = currentPlayer === leftPlayerEnum && leftPlayerEnum !== Player.None;
    const isRightPlayerActive = currentPlayer === rightPlayerEnum && rightPlayerEnum !== Player.None;

    const leftPlayerScore = mode === GameMode.Curling 
    ? (session.curlingScores?.[leftPlayerEnum] ?? 0) 
    : isScoreMode 
        ? (scores?.[leftPlayerUser.id] ?? 0) 
        : captures[leftPlayerEnum];

    const rightPlayerScore = mode === GameMode.Curling
        ? (session.curlingScores?.[rightPlayerEnum] ?? 0)
        : isScoreMode
            ? (scores?.[rightPlayerUser.id] ?? 0)
            : captures[rightPlayerEnum];


    const leftPlayerTime = enforceTime
        ? (leftPlayerEnum === Player.Black ? clientTimes.black : (leftPlayerEnum === Player.White ? clientTimes.white : (settings.timeLimit * 60)))
        : elapsedSec;
    const rightPlayerTime = enforceTime
        ? (rightPlayerEnum === Player.Black ? clientTimes.black : (rightPlayerEnum === Player.White ? clientTimes.white : (settings.timeLimit * 60)))
        : elapsedSec;

    const leftPlayerMainTime = leftPlayerEnum === Player.Black ? session.blackTimeLeft : (leftPlayerEnum === Player.White ? session.whiteTimeLeft : (settings.timeLimit * 60));
    const rightPlayerMainTime = rightPlayerEnum === Player.Black ? session.blackTimeLeft : (rightPlayerEnum === Player.White ? session.whiteTimeLeft : (settings.timeLimit * 60));

    const leftPlayerByoyomi = leftPlayerEnum === Player.Black ? session.blackByoyomiPeriodsLeft : (leftPlayerEnum === Player.White ? session.whiteByoyomiPeriodsLeft : settings.byoyomiCount);
    const rightPlayerByoyomi = rightPlayerEnum === Player.Black ? session.blackByoyomiPeriodsLeft : (rightPlayerEnum === Player.White ? session.whiteByoyomiPeriodsLeft : settings.byoyomiCount);
    
    const leftPlayerRole = mode === GameMode.Thief ? (leftPlayerUser.id === session.thiefPlayerId ? '도둑' : '경찰') : undefined;
    const rightPlayerRole = mode === GameMode.Thief ? (rightPlayerUser.id === session.thiefPlayerId ? '도둑' : '경찰') : undefined;
    
    const getCaptureTargetForPlayer = (playerEnum: Player) => {
        if (session.isSinglePlayer || mode === GameMode.Capture) {
            const isSurvivalMode = (session.settings as any)?.isSurvivalMode === true;
            // 살리기 바둑 모드: 흑(유저)은 목표점수 없음, 백(봇)만 목표점수 표시
            if (isSurvivalMode && playerEnum === Player.Black) {
                return undefined;
            }
            const target = effectiveCaptureTargets?.[playerEnum];
            // 999는 목표점수가 없음을 의미하므로 undefined 반환
            return target === 999 ? undefined : target;
        }
        if (mode === GameMode.Ttamok) {
            return settings.captureTarget;
        }
        return undefined;
    };

    const isLeftAi = session.isAiGame && leftPlayerUser.id === aiUserId;
    const isRightAi = session.isAiGame && rightPlayerUser.id === aiUserId;

    const leftCaptureHeadStartFlatBonus =
        !isScoreMode && mode !== GameMode.Curling && session.gameCategory === 'adventure' && !isLeftAi && adventureRegionalFlatBonus > 0
            ? adventureRegionalFlatBonus
            : undefined;
    const rightCaptureHeadStartFlatBonus =
        !isScoreMode && mode !== GameMode.Curling && session.gameCategory === 'adventure' && !isRightAi && adventureRegionalFlatBonus > 0
            ? adventureRegionalFlatBonus
            : undefined;
    const leftPanelStoneCaptureDisplay =
        leftCaptureHeadStartFlatBonus != null
            ? Math.max(0, (captures[leftPlayerEnum] ?? 0) - leftCaptureHeadStartFlatBonus)
            : leftPlayerScore;
    const rightPanelStoneCaptureDisplay =
        rightCaptureHeadStartFlatBonus != null
            ? Math.max(0, (captures[rightPlayerEnum] ?? 0) - rightCaptureHeadStartFlatBonus)
            : rightPlayerScore;
    const adventureMonsterPanel =
        session.gameCategory === 'adventure' && session.adventureMonsterCodexId
            ? (() => {
                  const m = getAdventureCodexMonsterById(session.adventureMonsterCodexId);
                  if (!m) return undefined;
                  return {
                      portraitUrl: m.imageWebp,
                      displayName: m.name,
                      level: Math.max(1, session.adventureMonsterLevel ?? 1),
                  };
              })()
            : undefined;

    const advDeadlineMs = session.adventureEncounterDeadlineMs;
    const adventureCountdownLive =
        adventureEncounterCountdownUiActive(session.gameCategory, session.gameStatus) &&
        typeof advDeadlineMs === 'number';
    const adventureHumanPlayerEnum =
        session.blackPlayerId === aiUserId
            ? Player.White
            : session.whitePlayerId === aiUserId
              ? Player.Black
              : Player.Black;
    const adventureMonsterTurn =
        session.gameCategory === 'adventure' &&
        adventureCountdownLive &&
        session.currentPlayer !== Player.None &&
        session.currentPlayer !== adventureHumanPlayerEnum;
    const [adventureRemSec, setAdventureRemSec] = useState(0);
    useEffect(() => {
        if (!adventureCountdownLive) {
            setAdventureRemSec(0);
            return;
        }
        const tick = () => {
            if (adventureMonsterTurn) return;
            setAdventureRemSec(Math.max(0, Math.ceil((advDeadlineMs - Date.now()) / 1000)));
        };
        tick();
        const id = setInterval(tick, 250);
        return () => clearInterval(id);
    }, [adventureCountdownLive, advDeadlineMs, session.id, adventureMonsterTurn]);
    const advBoardSize = session.settings?.boardSize ?? (session as { adventureBoardSize?: number }).adventureBoardSize ?? 9;
    const adventureTotalSec = Math.max(1, getAdventureEncounterCountdownMinutes(advBoardSize) * 60);
    const adventureCdProps =
        adventureCountdownLive
            ? { adventureMatchCountdownSec: adventureRemSec, adventureMatchTotalSec: adventureTotalSec }
            : { adventureMatchCountdownSec: null, adventureMatchTotalSec: null };
    const emptyAdventureCdProps = { adventureMatchCountdownSec: null as number | null, adventureMatchTotalSec: null as number | null };
    const leftAdventureCdProps =
        session.gameCategory === 'adventure' && isLeftAi ? emptyAdventureCdProps : adventureCdProps;
    const rightAdventureCdProps =
        session.gameCategory === 'adventure' && isRightAi ? emptyAdventureCdProps : adventureCdProps;
    const isGuildWarAi = session.gameCategory === 'guildwar' && session.isAiGame;
    const leftShowElapsedOnly = isGuildWarAi ? isLeftAi : session.gameCategory === 'adventure' ? isLeftAi : !enforceTime;
    const rightShowElapsedOnly = isGuildWarAi ? isRightAi : session.gameCategory === 'adventure' ? isRightAi : !enforceTime;
    
    const turnDuration = getTurnDuration(mode, session.gameStatus, settings);

    // 전략바둑 로비(대국실) 턴 표시: 제한 없음 → N수, 제한 있음 → 0/N ~ N/N
    const isStrategicMode = SPECIAL_GAME_MODES.some(m => m.mode === mode);
    const strategicLobbyTurnInfo = useMemo(() => {
        if (!isStrategicMode || isSinglePlayer || session.gameCategory === 'tower') return null;
        // 모험 스테이지는 stageId가 있어도 상단 수순 박스를 표시(도감 스테이지 id와 전략 로비 수순 표시가 겹치지 않음)
        if (session.stageId && session.gameCategory !== 'adventure') return null;
        const moveHistory = session.moveHistory ?? [];
        // scoringTurnLimit 기준 "턴"은 PASS(-1,-1)도 포함해서 카운트한다.
        const turnCountFromHistory = moveHistory.length;
        const validMovesOnly = moveHistory.filter((m) => m.x !== -1 && m.y !== -1).length;
        // 새로고침 직후 moveHistory가 비어 있을 수 있으므로 totalTurns로 대체 (수순 0/N 되는 버그 방지)
        const current =
            session.gameCategory === 'adventure'
                ? (validMovesOnly > 0 ? validMovesOnly : (session.totalTurns ?? 0))
                : turnCountFromHistory > 0
                  ? turnCountFromHistory
                  : (session.totalTurns ?? 0);
        const blackMoves = moveHistory.filter(m => m.player === Player.Black && m.x !== -1 && m.y !== -1).length;
        const blackTurnLimit = (session.settings as any)?.blackTurnLimit as number | undefined;
        if (session.gameCategory === 'guildwar' && mode === GameMode.Capture && blackTurnLimit != null && blackTurnLimit > 0) {
            const remaining = Math.max(0, blackTurnLimit - blackMoves);
            return { type: 'capture_limit' as const, label: '흑 남은 턴', current: remaining, total: blackTurnLimit };
        }
        if (mode === GameMode.Capture) {
            return { type: 'moves_only' as const, label: '수순', current };
        }
        const limit = settings.scoringTurnLimit;
        if (limit != null && limit > 0) {
            return { type: 'scoring_limit' as const, label: '수순', current, total: limit };
        }
        return { type: 'moves_only' as const, label: '수순', current };
    }, [
        isStrategicMode,
        isSinglePlayer,
        session.gameCategory,
        session.stageId,
        settings.scoringTurnLimit,
        session.moveHistory,
        session.totalTurns,
        mode,
        session.settings,
    ]);

    // 싱글플레이/도전의 탑 턴 안내 패널 계산
    const turnInfo = useMemo(() => {
        // 모험은 adventureStageId만 쓰며 stageId가 다른 모드와 겹칠 수 있어 싱글/탑 턴 박스 비표시
        if (session.gameCategory === 'adventure') return null;
        // 초기 동기화 payload에서 moveHistory가 생략될 수 있으므로 방어
        const moveHistory = session.moveHistory ?? [];
        const isTower = session.gameCategory === 'tower';
        if ((!isSinglePlayer && !isTower) || !session.stageId) return null;
        
        // 도전의 탑이면 TOWER_STAGES에서, 싱글플레이면 SINGLE_PLAYER_STAGES에서 스테이지 찾기
        const stage = isTower 
            ? TOWER_STAGES.find(s => s.id === session.stageId)
            : SINGLE_PLAYER_STAGES.find(s => s.id === session.stageId);
        if (!stage) return null;
        
        // 따내기바둑: 흑의 남은 턴 (blackTurnLimit이 있는 경우)
        if (stage.blackTurnLimit) {
            const blackMovesCount = moveHistory.filter(m => m.player === Player.Black && m.x !== -1).length;
            // 도전의 탑에서 턴 추가 아이템으로 증가한 턴을 반영
            const blackTurnLimitBonus = (session as any).blackTurnLimitBonus || 0;
            const effectiveBlackTurnLimit = stage.blackTurnLimit + blackTurnLimitBonus;
            const remainingTurns = Math.max(0, effectiveBlackTurnLimit - blackMovesCount);
            return {
                type: 'capture' as const,
                label: '흑 남은 턴',
                remaining: remainingTurns,
                total: effectiveBlackTurnLimit
            };
        }
        
        // 살리기바둑: 백의 남은 턴
        if (stage.survivalTurns) {
            // 서버 승패 판정과 동일하게 whiteTurnsPlayed를 우선 사용한다.
            const whiteTurnsPlayedRaw = (session as any).whiteTurnsPlayed;
            const whiteTurnsPlayed =
                typeof whiteTurnsPlayedRaw === 'number'
                    ? Math.max(0, Math.floor(whiteTurnsPlayedRaw))
                    : moveHistory.filter(m => m.player === Player.White && m.x !== -1).length;
            const remainingTurns = Math.max(0, stage.survivalTurns - whiteTurnsPlayed);
            return {
                type: 'survival' as const,
                label: '백 남은 턴',
                remaining: remainingTurns,
                total: stage.survivalTurns
            };
        }
        
        // 자동계가: 카운트다운 형태(남은 턴). 0이 되면 자동계가 진행 (유효 수만 카운트, 서버와 동일: x/y !== -1)
        // totalTurns가 0이거나 없으면 moveHistory 기준으로 계산 (한 수 둔 뒤 턴이 Max로 돌아가는 버그 방지)
        if (stage.autoScoringTurns) {
            const validMovesCount = moveHistory.filter(m => m.x !== -1 && m.y !== -1).length;
            const totalTurns = validMovesCount;
            const remainingTurns = Math.max(0, stage.autoScoringTurns - totalTurns);
            return {
                type: 'auto_scoring' as const,
                label: '남은 턴',
                remaining: remainingTurns,
                total: stage.autoScoringTurns
            };
        }
        
        // 기본: 현재 턴 표시 (다른 조건이 없는 경우)
        // 이 경우에는 턴 정보를 표시하지 않음
        return null;
    }, [
        isSinglePlayer,
        session.stageId,
        session.moveHistory,
        session.totalTurns,
        session.settings,
        session.gameCategory,
        (session as any).blackTurnLimitBonus,
    ]);
    
    /** 컴팩트 바: 행(stretch) 높이에 맞춤 — 대국자 패널과 동일 높이 */
    const turnInfoShellClass = compactPlayerBar
        ? 'flex w-[5.25rem] shrink-0 self-stretch min-h-0 flex-col'
        : 'flex h-[5.25rem] w-[5.25rem] shrink-0 flex-col items-center justify-center md:h-24 md:w-24';
    const turnInfoLabelSize = compactPlayerBar ? 'text-xs' : 'text-[11px] md:text-xs';
    const turnInfoValueSize = compactPlayerBar ? 'text-2xl' : 'text-2xl md:text-3xl';
    const turnInfoTotalSize = compactPlayerBar ? 'text-sm' : 'text-sm md:text-base';

    const showStrategicTurnBox = strategicLobbyTurnInfo != null;

    const isPlayfulDiceStonesBoxPhase =
        (mode === GameMode.Dice && ['dice_rolling', 'dice_rolling_animating', 'dice_placing'].includes(session.gameStatus)) ||
        (mode === GameMode.Thief && ['thief_rolling', 'thief_rolling_animating', 'thief_placing'].includes(session.gameStatus));
    const showPlayfulStonesBox = isPlayfulDiceStonesBoxPhase;
    /** 주사위바둑·도둑/경찰: 메인 주사위 굴림 애니 중에는 stonesToPlace 숫자를 숨김(애니 종료 후 표시, UX 통일) */
    const hidePlayfulStonesCountDuringRollAnim =
        (mode === GameMode.Dice && session.gameStatus === 'dice_rolling_animating') ||
        (mode === GameMode.Thief && session.gameStatus === 'thief_rolling_animating');
    const playfulRollAnimAriaHint = '주사위 굴림 중. 남은 돌 수는 굴림이 끝난 뒤 표시됩니다.';
    /** 도둑 1턴+경찰 1턴=1라운드. turnInRound는 턴 종료 시마다 +1 */
    const thiefUiRound =
        mode === GameMode.Thief
            ? Math.min(THIEF_NIGHTS_PER_SEGMENT, Math.ceil((session.turnInRound ?? 1) / 2))
            : null;
    const playfulStonesCountDisplay = Math.max(
        0,
        typeof session.stonesToPlace === 'number' ? session.stonesToPlace : 0,
    );
    const playfulStonesBoxSize =
        mode === GameMode.Thief
            ? compactPlayerBar
                ? 'h-full min-h-0 w-[5rem]'
                : 'w-[5.25rem] sm:w-[5.5rem] md:w-24 min-h-[5rem]'
            : compactPlayerBar
              ? 'h-full min-h-0 w-[4.25rem]'
              : 'w-[4.5rem] sm:w-[4.75rem] md:w-[5.25rem] min-h-[4.25rem]';

    /** 컴팩트 바 행 높이: 중앙 수순·남은 돌 박스와 동일하게 고정해 양쪽 대국자 패널이 세로로 늘어나지 않게 함 */
    const compactBarFixedHeightClass = !compactPlayerBar
        ? ''
        : showPlayfulStonesBox
          ? mode === GameMode.Thief
              ? 'h-[5.75rem] min-h-[5.75rem] max-h-[5.75rem]'
              : 'h-[5rem] min-h-[5rem] max-h-[5rem]'
          : mode === GameMode.Curling && isMobile
            ? 'min-h-[5.5rem] max-h-[7rem]'
            : 'h-[4.5rem] min-h-[4.5rem] max-h-[4.5rem]';

    /** 컴팩트 바(모바일·좁은 창): 한 행에서 수순 박스·대국자 패널 높이 동일 */
    const playerColClass = compactPlayerBar
        ? 'flex min-h-0 min-w-0 flex-1 items-stretch'
        : 'flex min-h-[5.5rem] min-w-0 flex-1 sm:min-h-[4.5rem]';
    const compactBarRowClass = compactPlayerBar
        ? `${compactBarFixedHeightClass} items-stretch justify-between gap-1.5 overflow-hidden`
        : 'h-full items-stretch gap-2 min-[1025px]:gap-1.5';

    const adventurePregameColorReveal =
        session.gameCategory === 'adventure' &&
        ['nigiri_reveal', 'color_start_confirmation', 'nigiri_choosing', 'nigiri_guessing'].includes(session.gameStatus);

    const barHighlightAttrs =
        singlePlayerOnboardingBarHighlight === 'scores-bar'
            ? ({ 'data-onboarding-target': 'onboarding-sp-ingame-scores-bar' } as const)
            : {};
    const userPanelOnboardingTarget =
        singlePlayerOnboardingBarHighlight === 'user-panel' && currentUser?.id === leftPlayerUser.id;
    const [intro11IngameTutorialOpen, setIntro11IngameTutorialOpen] = useState(false);
    const intro11RootRef = useRef<HTMLDivElement | null>(null);
    const intro11TargetRef = useRef<HTMLDivElement | null>(null);
    const [intro11SpotlightRect, setIntro11SpotlightRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

    useEffect(() => {
        const shouldOpen =
            session.stageId === '입문-11' &&
            session.gameCategory === 'singleplayer' &&
            session.gameStatus === 'playing' &&
            isIntro11TutorialActiveForGame(session.id) &&
            !isIntro11IngameStepRead(session.id);
        setIntro11IngameTutorialOpen(shouldOpen);
    }, [session.id, session.stageId, session.gameCategory, session.gameStatus]);

    useLayoutEffect(() => {
        if (!intro11IngameTutorialOpen) {
            setIntro11SpotlightRect(null);
            return;
        }
        const mountRoot = typeof document !== 'undefined' ? document.getElementById('sudamr-onboarding-root') ?? document.body : null;
        const root = mountRoot;
        const target = intro11TargetRef.current;
        if (!root || !target) {
            setIntro11SpotlightRect(null);
            return;
        }
        const rr = root.getBoundingClientRect();
        const tr = target.getBoundingClientRect();
        const pad = 10;
        const left = tr.left - rr.left;
        const top = tr.top - rr.top;
        const right = tr.right - rr.left;
        const bottom = tr.bottom - rr.top;
        const x1 = Math.max(0, left - pad);
        const y1 = Math.max(0, top - pad);
        const x2 = Math.min(rr.width, right + pad);
        const y2 = Math.min(rr.height, bottom + pad);
        setIntro11SpotlightRect({
            top: y1,
            left: x1,
            width: Math.max(0, x2 - x1),
            height: Math.max(0, y2 - y1),
        });
    }, [intro11IngameTutorialOpen, compactBarRowClass]);

    const intro11SpotlightCenterY =
        intro11SpotlightRect != null
            ? intro11SpotlightRect.top + intro11SpotlightRect.height / 2
            : null;
    const intro11PanelPlacementTop =
        intro11SpotlightCenterY == null
            ? false
            : intro11SpotlightCenterY > (typeof window !== 'undefined' ? window.innerHeight : 0) * 0.5;
    const intro11PortalMount =
        typeof document !== 'undefined' ? document.getElementById('sudamr-onboarding-root') ?? document.body : null;

    if (adventurePregameColorReveal) {
        return (
            <div
                className={`flex w-full ${compactBarRowClass} flex-shrink-0`}
            >
                <div className={`${playerColClass} rounded-lg border border-stone-600/25 bg-zinc-950/35`} aria-hidden />
                <div className={`${playerColClass} rounded-lg border border-stone-600/25 bg-zinc-950/35`} aria-hidden />
            </div>
        );
    }

    return (
        <div ref={intro11RootRef} className="relative">
        <div
            ref={intro11TargetRef}
            className={`flex w-full ${compactBarRowClass} flex-shrink-0`}
            {...barHighlightAttrs}
        >
            <div className={playerColClass}>
                <SinglePlayerPanel
                    user={leftPlayerUser}
                    playerEnum={leftPlayerEnum}
                    score={leftPanelStoneCaptureDisplay}
                    isActive={isLeftPlayerActive}
                    timeLeft={leftPlayerTime}
                    totalTime={turnDuration}
                    mainTimeLeft={leftPlayerMainTime}
                    byoyomiPeriodsLeft={leftPlayerByoyomi}
                    totalByoyomi={settings.byoyomiCount}
                    byoyomiTime={settings.byoyomiTime}
                    isLeft={true}
                    session={session}
                    captureTarget={getCaptureTargetForPlayer(leftPlayerEnum)}
                    role={leftPlayerRole}
                    isAiPlayer={isLeftAi}
                    mode={mode}
                    isSinglePlayer={isSinglePlayer}
                    isMobile={isMobile}
                    fluidTextLayout={compactPlayerBar}
                    showElapsedOnly={leftShowElapsedOnly}
                    isCurrentUser={leftPlayerUser.id === currentUser?.id}
                    opponentMonsterDisplay={isLeftAi ? adventureMonsterPanel : undefined}
                    spIngameOnboardingUserTarget={userPanelOnboardingTarget}
                    captureHeadStartFlatBonus={leftCaptureHeadStartFlatBonus}
                    {...leftAdventureCdProps}
                />
            </div>
            {((isSinglePlayer || session.gameCategory === 'tower') && turnInfo) && (
                <div className={`${turnInfoShellClass} bg-stone-800/95 rounded-lg border-2 border-stone-500 shadow-xl`}>
                    <div
                        className={`flex w-full flex-col items-center justify-center px-1 text-center ${
                            compactPlayerBar ? 'min-h-0 flex-1' : ''
                        }`}
                    >
                        <span className={`${turnInfoLabelSize} text-stone-300 ${compactPlayerBar ? 'mb-0.5' : 'mb-1'} leading-tight font-semibold`}>{turnInfo.label}</span>
                        <div className="flex items-baseline justify-center gap-0.5">
                            <span className={`${turnInfoValueSize} font-bold text-amber-300`}>{turnInfo.remaining}</span>
                            <span className={`${turnInfoTotalSize} text-stone-400`}>/{turnInfo.total}</span>
                        </div>
                    </div>
                </div>
            )}
            {showStrategicTurnBox && strategicLobbyTurnInfo && (
                <div className={`${turnInfoShellClass} bg-gray-800/95 rounded-lg border-2 border-gray-500 shadow-xl`}>
                    <div
                        className={`flex w-full flex-col items-center justify-center px-1 text-center ${
                            compactPlayerBar ? 'min-h-0 flex-1' : ''
                        }`}
                    >
                        <span className={`${turnInfoLabelSize} text-gray-300 ${compactPlayerBar ? 'mb-0.5' : 'mb-1'} leading-tight font-semibold`}>{strategicLobbyTurnInfo.label}</span>
                        {strategicLobbyTurnInfo.type === 'moves_only' ? (
                            <span className={`${turnInfoValueSize} font-bold text-amber-300`}>{strategicLobbyTurnInfo.current}수</span>
                        ) : (
                            <div className="flex items-baseline justify-center gap-0.5">
                                <span className={`${turnInfoValueSize} font-bold text-amber-300`}>{strategicLobbyTurnInfo.current}</span>
                                <span className={`${turnInfoTotalSize} text-gray-400`}>/ {strategicLobbyTurnInfo.total}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {showPlayfulStonesBox && (
                <div
                    className={`flex flex-col items-center justify-center ${playfulStonesBoxSize} flex-shrink-0 self-stretch rounded-lg border-2 border-amber-400/55 bg-gradient-to-b from-gray-900/95 to-black/90 shadow-xl px-1 py-1`}
                    role="status"
                    aria-live="polite"
                    aria-label={
                        hidePlayfulStonesCountDuringRollAnim
                            ? thiefUiRound != null
                                ? `라운드 ${thiefUiRound} / ${THIEF_NIGHTS_PER_SEGMENT}. ${playfulRollAnimAriaHint}`
                                : playfulRollAnimAriaHint
                            : thiefUiRound != null
                              ? `라운드 ${thiefUiRound} / ${THIEF_NIGHTS_PER_SEGMENT}, 남은 착수 ${playfulStonesCountDisplay}개`
                              : `남은 착수 ${playfulStonesCountDisplay}개`
                    }
                >
                    {thiefUiRound != null && (
                        <span
                            className={`${compactPlayerBar ? 'text-[0.65rem]' : 'text-[clamp(0.55rem,1.8vmin,0.72rem)]'} mb-0.5 text-center font-bold tabular-nums leading-none text-amber-100/95`}
                        >
                            라운드 {thiefUiRound}/{THIEF_NIGHTS_PER_SEGMENT}
                        </span>
                    )}
                    <span
                        className={`${compactPlayerBar ? 'text-xs' : 'text-[clamp(0.55rem,1.8vmin,0.7rem)]'} text-center font-semibold leading-tight whitespace-nowrap text-amber-200/85`}
                    >
                        남은 돌
                    </span>
                    <span
                        className={`font-mono font-bold tabular-nums text-amber-300 ${compactPlayerBar ? 'text-3xl' : 'text-3xl md:text-4xl'} mt-0.5 leading-none min-w-[1.25em] text-center`}
                    >
                        {hidePlayfulStonesCountDuringRollAnim ? (
                            <span className="inline-block text-amber-200/25 select-none" aria-hidden>
                                —
                            </span>
                        ) : (
                            playfulStonesCountDisplay
                        )}
                    </span>
                </div>
            )}
            <div className={playerColClass}>
            <SinglePlayerPanel
                user={towerOpponentPanelUser}
                playerEnum={rightPlayerEnum}
                score={rightPanelStoneCaptureDisplay}
                isActive={isRightPlayerActive}
                timeLeft={rightPlayerTime}
                totalTime={turnDuration}
                mainTimeLeft={rightPlayerMainTime}
                byoyomiPeriodsLeft={rightPlayerByoyomi}
                totalByoyomi={settings.byoyomiCount}
                byoyomiTime={settings.byoyomiTime}
                isLeft={false}
                session={session}
                captureTarget={getCaptureTargetForPlayer(rightPlayerEnum)}
                role={rightPlayerRole}
                isAiPlayer={isRightAi}
                mode={mode}
                isSinglePlayer={isSinglePlayer}
                isMobile={isMobile}
                fluidTextLayout={compactPlayerBar}
                showElapsedOnly={rightShowElapsedOnly}
                isCurrentUser={rightPlayerUser.id === currentUser?.id}
                opponentMonsterDisplay={isRightAi ? adventureMonsterPanel : undefined}
                spIngameOnboardingUserTarget={
                    singlePlayerOnboardingBarHighlight === 'user-panel' && currentUser?.id === rightPlayerUser.id
                }
                captureHeadStartFlatBonus={rightCaptureHeadStartFlatBonus}
                {...rightAdventureCdProps}
            />
            </div>
        </div>
        {intro11IngameTutorialOpen && intro11PortalMount && createPortal(
            <>
                {intro11SpotlightRect && (
                    <div className="pointer-events-none absolute inset-0 z-[280]" aria-hidden>
                        <div
                            className={ONBOARDING_SPOTLIGHT_DIM_LAYER_CLASS}
                            style={{
                                WebkitClipPath: spotlightDimClipPathFromPxRect(intro11SpotlightRect),
                                clipPath: spotlightDimClipPathFromPxRect(intro11SpotlightRect),
                            }}
                        />
                    </div>
                )}
                <div className="pointer-events-none absolute inset-0 z-[281] px-3 pt-2 sm:px-5 sm:pt-3">
                <div
                    className="pointer-events-auto absolute left-1/2 w-[min(100%,32rem)] -translate-x-1/2 rounded-2xl border border-white/18 bg-slate-950/55 p-3.5 shadow-[0_8px_40px_rgba(0,0,0,0.55)] backdrop-blur-md ring-1 ring-inset ring-white/10 sm:p-5"
                    style={intro11PanelPlacementTop ? { top: '0.75rem' } : { bottom: '0.75rem' }}
                >
                    <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/90">살기기 바둑</p>
                    <p className="mt-2 text-left text-sm leading-relaxed text-stone-200/95 sm:text-[15px]">
                        3턴동안 백의 공격을 피해 1점을 빼앗기지 않도록 피해보세요. 돌을 연결하고 넓은 공간으로 나가면 잡히지 않을겁니다.
                    </p>
                    <div className="mt-3 flex justify-end gap-2 border-t border-white/10 pt-3 sm:mt-4 sm:pt-4">
                        <button
                            type="button"
                            className="min-h-9 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-black hover:bg-amber-400"
                            onClick={() => {
                                markIntro11IngameStepRead(session.id);
                                setIntro11IngameTutorialOpen(false);
                            }}
                        >
                            다음
                        </button>
                    </div>
                </div>
                </div>
            </>
            ,
            intro11PortalMount,
        )}
        </div>
    );
};

export default PlayerPanel;