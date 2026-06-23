import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useGameRecordSaveLock } from '../../hooks/useGameRecordSaveLock.js';
import { GameMode, LiveGameSession, ServerAction, GameProps, Player, User, Point, GameStatus, AppSettings } from '../../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, STRATEGIC_ACTION_POINT_COST, PLAYFUL_ACTION_POINT_COST } from '../../constants';
import {
    PAIR_LOBBY_FOCUS_ROOM_TAB_SESSION_KEY,
    POST_GAME_PAIR_ROOM_RESTORE_SESSION_KEY,
} from '../../shared/constants/pairArena.js';
import { arenaLobbyHashFromSession } from '../../shared/utils/arenaLobbyDestination.js';
import { aiUserId } from '../../constants/auth.js';
import { canSaveStrategicPvpGameRecord, GAME_RECORD_SLOT_FULL_MESSAGE } from '../../utils/strategicPvpGameRecord.js';
import { getSinglePlayerStages } from '../../constants/singlePlayerConstants.js';
import Button from '../Button.js';
import Dice from '../Dice.js';
import { audioService } from '../../services/audioService.js';
import ChallengeSelectionModal from '../ChallengeSelectionModal.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { ArenaControlStrip, ArenaFixedColsGrid } from './ArenaControlStrip.js';
import {
    arenaPostGameButtonClass,
    arenaPostGameButtonInRowModifier,
    arenaPostGameIngameEndedRowClass,
    arenaPostGamePanelShellClass,
    formatArenaRetryLabel,
    formatAiRematchFooterLabel,
    formatSinglePlayerNextFooterLabel,
} from './arenaPostGameButtonStyles.js';
import { MoveConfirmFooterReservePlaceholder, MoveConfirmFooterSlot } from './MoveConfirmFooterSlot.js';
import {
    arenaGameRoomControlsAdminBarClass,
    arenaGameRoomControlsDividerClass,
    arenaGameRoomControlsFooterClass,
    arenaGameRoomControlsFooterCompactClass,
    arenaGameRoomControlsInnerPanelAccentClass,
    arenaGameRoomControlsInnerPanelClass,
    arenaGameRoomControlsSectionTitleClass,
    arenaGameRoomMannerChipClass,
    arenaGameRoomSinglePlayerOuterBarClass,
    arenaGameRoomSinglePlayerSplitPanelAccentClass,
    arenaGameRoomSinglePlayerSplitPanelClass,
    onlineGameControlsCompactFooterMinHeightClass,
    pveIngameFooterReservedHeightClass,
} from './arenaGameRoomStyles.js';
import BaseGameFooterPanel, { BasePlacementControlStrip, isBaseGameFooterPhase } from './BaseGameFooterPanel.js';
import IngameMobileFooterAd from './IngameMobileFooterAd.js';
import {
    isPairClassicGame,
    isPairCooperativeTwoHumansVsAi,
    pairSeatMatchesViewerUser,
} from '../../shared/utils/pairGameTurn.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';
import { buildPveItemActionClientSync } from '../../utils/pveItemClientSync.js';
import {
    baseAiLobbyActionPointCostForModeAndSettings,
    effectiveAiLobbyApCostForUser,
    effectivePairAiLobbyApCostForUser,
    formatActionPointCostWithPetDiscount,
} from '../../shared/utils/pairPetArenaApDiscount.js';
import { formatGoldAmountKoG } from '../../shared/utils/walletAmountDisplay.js';
import { pairPetKataPhaseFromTotalPly, pairPetKataPliesRemainingInCurrentPhase } from '../../shared/constants/pairArena.js';
import { isPairHumanHumanPvpForTeamResign, modeIncludesBaseCaptureMix } from '../../shared/utils/liveSessionArenaKind.js';
import { pvpHasFixedScoringTurnLimit } from '../../shared/utils/rankedFixedTurnScoring.js';
import { getEquippedPairPetInventoryRow } from '../../shared/utils/pairEquippedPet.js';
import { getPairPetDefinition } from '../../shared/constants/petLobby.js';
import { useTranslation } from 'react-i18next';
import i18n from '../../shared/i18n/config.js';
import { tx } from '../../shared/i18n/runtimeText.js';

interface ImageButtonProps {
    src: string;
    alt: string;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
    variant?: 'primary' | 'danger';
    count?: number; // 아이템 남은 개수
    /** 모바일 푸터 한 줄 유지용 작은 크기 */
    compact?: boolean;
    /** 이미지 영역 하단에 겹쳐 표시되는 짧은 라벨(펫 힌트 등) */
    imageBottomOverlay?: string;
}

/** 모바일에서 아이콘을 가리지 않도록 버튼 밖 모서리(우하단)에 배치 */
const ItemCountBadge: React.FC<{ count: number; disabled?: boolean; compact?: boolean }> = ({ count, disabled = false, compact = false }) => (
    <span
        className={`pointer-events-none absolute z-[3] flex items-center justify-center rounded-md border border-gray-900/90 bg-gray-950/95 font-bold leading-none text-white shadow-md tabular-nums ${disabled ? 'opacity-60' : ''} ${
            compact
                ? '-bottom-0.5 -right-0.5 min-h-[0.9rem] min-w-[0.9rem] px-0.5 text-[8px]'
                : '-bottom-1 -right-1 min-h-[1.25rem] min-w-[1.25rem] px-1 text-[11px]'
        }`}
    >
        {count > 99 ? '99+' : count}
    </span>
);

const CountOverlay: React.FC<{ count: number; disabled?: boolean; compact?: boolean; children: React.ReactNode }> = ({
    count,
    disabled = false,
    compact = false,
    children,
}) => (
    <div className="relative inline-flex shrink-0">
        {children}
        <ItemCountBadge count={count} disabled={disabled} compact={compact} />
    </div>
);

function modeIncludesCaptureRule(mode: GameMode, settings: { mixedModes?: GameMode[] }): boolean {
    return mode === GameMode.Capture || (mode === GameMode.Mix && Boolean(settings.mixedModes?.includes(GameMode.Capture)));
}

const ImageButton: React.FC<ImageButtonProps> = ({
    src,
    alt,
    onClick,
    disabled = false,
    title,
    variant = 'primary',
    count,
    compact = false,
    imageBottomOverlay,
}) => {
    const [isTooltipVisible, setIsTooltipVisible] = useState(false);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressTriggeredRef = useRef(false);
    const touchHandledRef = useRef(false);
    const isTouchInteraction = compact;

    const variantClasses = variant === 'danger'
        ? 'border-red-500/55 shadow-[0_0_26px_-10px_rgba(248,113,113,0.4)] ring-1 ring-inset ring-red-400/18 focus:ring-red-400'
        : 'border-amber-400/50 shadow-[0_0_24px_-10px_rgba(251,191,36,0.28)] ring-1 ring-inset ring-amber-300/14 focus:ring-amber-300';
    const sizeClass = compact
        ? 'h-10 w-10 rounded-md sm:h-10 sm:w-10 md:h-10 md:w-10'
        : 'h-[3.65rem] w-[3.65rem] rounded-lg min-[1025px]:h-14 min-[1025px]:w-14';

    const clearLongPressTimer = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const handleUse = () => {
        if (!disabled && onClick) onClick();
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (touchHandledRef.current) {
            touchHandledRef.current = false;
            return;
        }
        handleUse();
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
        if (!isTouchInteraction || disabled || !title) return;
        e.preventDefault();
        e.stopPropagation();
        touchHandledRef.current = false;
        longPressTriggeredRef.current = false;
        clearLongPressTimer();
        longPressTimerRef.current = setTimeout(() => {
            longPressTriggeredRef.current = true;
            touchHandledRef.current = true;
            setIsTooltipVisible(true);
        }, 450);
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
        if (!isTouchInteraction) return;
        e.preventDefault();
        e.stopPropagation();
        clearLongPressTimer();
        if (longPressTriggeredRef.current) {
            setTimeout(() => setIsTooltipVisible(false), 900);
            return;
        }
        touchHandledRef.current = true;
        handleUse();
    };

    const handleTouchCancel = () => {
        clearLongPressTimer();
        if (longPressTriggeredRef.current) {
            setTimeout(() => setIsTooltipVisible(false), 200);
        }
    };

    const handleMouseEnter = () => {
        if (isTouchInteraction || !title) return;
        setIsTooltipVisible(true);
    };

    const handleMouseLeave = () => {
        if (isTouchInteraction || !title) return;
        setIsTooltipVisible(false);
    };

    useEffect(() => {
        return () => clearLongPressTimer();
    }, []);

    return (
        <div className="relative shrink-0" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            <button
                type="button"
                onClick={handleClick}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchCancel}
                disabled={disabled}
                title={title}
                className={`relative block ${sizeClass} shrink-0 overflow-hidden border-2 bg-gradient-to-b from-white/[0.07] to-black/40 transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 ${variantClasses} ${disabled ? 'cursor-not-allowed border-slate-700 opacity-40 shadow-none ring-0' : 'cursor-pointer shadow-[0_12px_32px_-14px_rgba(0,0,0,0.8)] hover:scale-[1.04] hover:brightness-[1.06] active:scale-[0.96]'}`}
            >
                <img src={src} alt={alt} className="pointer-events-none h-full w-full object-contain" />
                {imageBottomOverlay ? (
                    <span
                        className={`pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex items-end justify-center bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent pb-0.5 pt-2.5 font-bold leading-none tracking-wide text-sky-100 ring-1 ring-inset ring-sky-400/25 ${compact ? 'text-[7px]' : 'text-[8px] min-[1025px]:text-[9px]'}`}
                        aria-hidden
                    >
                        {imageBottomOverlay}
                    </span>
                ) : null}
            </button>
            {isTooltipVisible && title && !disabled && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[12.5rem] -translate-x-1/2 rounded-md border border-amber-300/45 bg-black/95 px-2.5 py-1.5 text-center text-[11px] font-semibold leading-tight text-amber-100 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.9)]">
                    {title}
                </div>
            )}
            {count !== undefined && <ItemCountBadge count={count} disabled={disabled} compact={compact} />}
        </div>
    );
};

interface LabeledControlButtonProps extends ImageButtonProps {
    label: string;
    caption?: string;
}

const LabeledControlButton: React.FC<LabeledControlButtonProps> = ({ label, caption, compact = false, ...buttonProps }) => {
    const { disabled = false } = buttonProps;
    return (
        <div className={`flex min-w-0 max-w-full flex-col items-center gap-0.5 ${compact ? '' : 'min-w-0 min-[1025px]:min-w-0'}`}>
            <ImageButton {...buttonProps} compact={compact} />
            <span
                className={`text-center font-semibold leading-none tracking-wide ${compact ? 'max-w-[3.5rem] truncate text-[8px]' : 'whitespace-nowrap text-[10px] min-[1025px]:text-[9px] tracking-wide'} ${disabled ? 'text-slate-500' : 'text-amber-100/95 drop-shadow-[0_0_10px_rgba(251,191,36,0.2)]'}`}
            >
                {label}
            </span>
            {/* caption은 제거하고 count로 대체 */}
        </div>
    );
};

interface GameControlsProps {
    session: LiveGameSession;
    isMyTurn: boolean;
    isSpectator: boolean;
    onAction: (action: ServerAction) => void | Promise<unknown>;
    setShowResultModal: (show: boolean) => void;
    setConfirmModalType: (type: 'resign' | null) => void;
    onOpenRematchSettings?: () => void;
    currentUser: GameProps['currentUser'];
    onlineUsers: GameProps['onlineUsers'];
    pendingMove: Point | null;
    onConfirmMove: () => void;
    onCancelMove: () => void;
    isMobile: boolean;
    settings: AppSettings;
    isSinglePlayer?: boolean;
    isSinglePlayerPaused?: boolean;
    // AI 게임 일시 정지 관련 props
    isPaused?: boolean;
    resumeCountdown?: number;
    pauseButtonCooldown?: number;
    onPauseToggle?: () => void;
    onOpenGameRecordList?: () => void;
    /** 경기 종료 후 푸터 「대국」 영역에 나가기/관전종료 표시 */
    onLeaveOrResign?: () => void;
    /** 모험 등 결과 모달 표시 여부(푸터 버튼 라벨·토글용) */
    showResultModal?: boolean;
    /** ended/no_contest: 결과 모달 확인 전에는 하단 재도전·나가기 등 비활성 */
    allowPostGameFooterActions?: boolean;
    /** 모험 등: 푸터에서 요약 닫을 때 Game.tsx와 동기(확인 처리) */
    onDismissGameSummary?: () => void;
    /** 전략 펫 힌트: 바둑판이 아닌 푸터 버튼 위 말풍선 */
    strategicPetHintFooterBubble?: { message: string; visible: boolean } | null;
    /** 옵션「착수 버튼」ON일 때 하단 대국 기능 열에 착수 확정 UI 표시 */
    showMoveConfirmFooter?: boolean;
    onMobileConfirmToggle?: (checked: boolean) => void;
}

const formatCooldown = (ms: number) => {
    if (ms <= 0) return 'READY';
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

interface ActionButtonsPanelProps {
    session: LiveGameSession;
    isSpectator: boolean;
    onAction: (action: ServerAction) => unknown;
    currentUser: GameProps['currentUser'];
    isMobile?: boolean;
}

const ACTIVE_GAME_STATUSES: GameStatus[] = [
    'playing',
    'alkkagi_playing',
    'curling_playing',
    'curling_tiebreaker_playing',
    'dice_rolling',
    'dice_placing',
    'thief_rolling',
    'thief_placing',
];

const ActionButtonsPanel: React.FC<ActionButtonsPanelProps> = ({ session, isSpectator, onAction, currentUser, isMobile = false }) => {
    const [cooldownTime, setCooldownTime] = useState('00:00');
    const [actionButtonBusy, setActionButtonBusy] = useState(false);
    const { id: gameId, mode, gameStatus } = session;

    useEffect(() => {
        const deadline = session.actionButtonCooldownDeadline?.[currentUser.id];
        if (!deadline) {
            setCooldownTime('READY');
            return;
        }

        const update = () => {
            const remaining = deadline - Date.now();
            setCooldownTime(formatCooldown(remaining));
        };

        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [session.actionButtonCooldownDeadline, currentUser.id]);

    const isGameEnded = ['ended', 'no_contest', 'rematch_pending'].includes(gameStatus);
    const canUseActions = SPECIAL_GAME_MODES.some(m => m.mode === mode) || PLAYFUL_GAME_MODES.some(m => m.mode === mode);

    if (isGameEnded || isSpectator || !canUseActions) {
        return null;
    }

    const myActionButtons = session.currentActionButtons?.[currentUser.id];
    const hasButtons = myActionButtons && myActionButtons.length > 0;
    const isGameActive = ACTIVE_GAME_STATUSES.includes(gameStatus);
    const hasUsedThisCycle = session.actionButtonUsedThisCycle?.[currentUser.id];
    const isReady = cooldownTime === 'READY';
    const handleUseActionButton = async (buttonName: string) => {
        if (isSpectator || !isGameActive || actionButtonBusy) return;
        setActionButtonBusy(true);
        try {
            const result = await Promise.resolve(onAction({ type: 'USE_ACTION_BUTTON', payload: { gameId, buttonName } }));
            const err = (result as { error?: string } | null | undefined)?.error;
            if (err) window.alert(err);
        } catch (error) {
            console.error('[GameControls] USE_ACTION_BUTTON failed:', error);
            window.alert(i18n.t('game:controls.mannerActionError'));
        } finally {
            setActionButtonBusy(false);
        }
    };

    const isWaitingForNextAction = !hasButtons || hasUsedThisCycle;

    if (isWaitingForNextAction) {
        return (
            <div className={`flex w-full min-w-0 flex-col items-center justify-center ${isMobile ? 'py-0.5' : 'py-0.5'}`}>
                <span
                    className={`font-mono font-semibold tabular-nums ${isMobile ? 'text-sm' : 'text-base min-[1025px]:text-[15px]'} ${isReady ? 'text-emerald-400' : 'text-slate-300'}`}
                >
                    {cooldownTime}
                </span>
                <span className={`text-slate-500 ${isMobile ? 'text-[8px]' : 'text-[10px] min-[1025px]:text-[9px]'}`}>{i18n.t('game:controls.waitingNextAction')}</span>
            </div>
        );
    }

    return (
        <div className={`flex w-full min-w-0 items-center justify-center ${isMobile ? 'py-0.5' : 'py-0.5'}`}>
            <ArenaControlStrip layout="cluster" className="min-w-0 max-w-full" gapClass={isMobile ? 'gap-1' : 'gap-2'}>
                {myActionButtons.map((button) => (
                    <Button
                        key={button.name}
                        bare
                        onClick={() => void handleUseActionButton(button.name)}
                        colorScheme="none"
                        className={arenaGameRoomMannerChipClass(isMobile, button.type === 'manner' ? 'manner' : 'other')}
                        title={button.message}
                        disabled={isSpectator || !isGameActive || actionButtonBusy}
                    >
                        {button.name}
                    </Button>
                ))}
            </ArenaControlStrip>
        </div>
    );
};


const DICE_ROLL_ANIMATION_MS = 1500;
const DICE_ROLL_LOCAL_EVENT = 'dice-go-local-roll-start';

export type DiceGoPanelItemKind = 'odd' | 'even' | 'low' | 'high';

/** 주사위 바둑 특수주사위 아이템 — ImageButton(w-16 md:w-20) 풋프린트 */
const DiceGoLuxuryItemCard: React.FC<{
    kind: DiceGoPanelItemKind;
    count: number;
    usable: boolean;
    onUse: () => void;
    compact?: boolean;
}> = ({ kind, count, usable, onUse, compact = false }) => {
    const [diceSize, setDiceSize] = React.useState(54);
    React.useEffect(() => {
        if (compact) return;
        const q = window.matchMedia('(min-width: 1025px)');
        const sync = () => setDiceSize(q.matches ? 56 : 54);
        sync();
        q.addEventListener('change', sync);
        return () => q.removeEventListener('change', sync);
    }, [compact]);

    const meta = (() => {
        switch (kind) {
            case 'odd':
                return {
                    ariaLabel: tx('game:controls.oddDiceAria', { count }),
                    title: tx('game:controls.oddDiceTitle', { count }),
                    displayText: '1·3·5',
                    diceColor: 'luxuryOdd' as const,
                    outerGrad: 'from-cyan-400/35 via-slate-600/25 to-indigo-500/25',
                    hoverOuter: 'hover:from-cyan-300/50 hover:via-slate-500/30 hover:shadow-[0_0_24px_-8px_rgba(34,211,238,0.38)]',
                    innerActive:
                        'border-cyan-400/45 shadow-[0_0_28px_-10px_rgba(34,211,238,0.35),inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-cyan-300/28',
                    innerInactive: 'border-cyan-900/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] opacity-[0.78]',
                    innerBg: 'from-slate-950 via-[#0a1628] to-slate-950',
                    glow: 'bg-cyan-400',
                };
            case 'even':
                return {
                    ariaLabel: tx('game:controls.evenDiceAria', { count }),
                    title: tx('game:controls.evenDiceTitle', { count }),
                    displayText: '2·4·6',
                    diceColor: 'luxuryEven' as const,
                    outerGrad: 'from-amber-400/40 via-amber-900/20 to-orange-950/35',
                    hoverOuter: 'hover:from-amber-300/55 hover:via-amber-900/25 hover:shadow-[0_0_24px_-8px_rgba(251,191,36,0.36)]',
                    innerActive:
                        'border-amber-400/48 shadow-[0_0_28px_-10px_rgba(251,191,36,0.33),inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-amber-300/25',
                    innerInactive: 'border-amber-950/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] opacity-[0.78]',
                    innerBg: 'from-zinc-950 via-[#1a1208] to-zinc-950',
                    glow: 'bg-amber-400',
                };
            case 'low':
                return {
                    ariaLabel: tx('game:controls.lowDiceAria', { count }),
                    title: tx('game:controls.lowDiceTitle', { count }),
                    displayText: '1·2·3',
                    diceColor: 'luxuryLow' as const,
                    outerGrad: 'from-violet-400/40 via-slate-600/25 to-indigo-600/30',
                    hoverOuter: 'hover:from-violet-300/50 hover:via-slate-500/30 hover:shadow-[0_0_24px_-8px_rgba(167,139,250,0.38)]',
                    innerActive:
                        'border-violet-400/50 shadow-[0_0_28px_-10px_rgba(167,139,250,0.33),inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-violet-300/28',
                    innerInactive: 'border-violet-950/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] opacity-[0.78]',
                    innerBg: 'from-slate-950 via-[#140a22] to-slate-950',
                    glow: 'bg-violet-400',
                };
            case 'high':
                return {
                    ariaLabel: tx('game:controls.highDiceAria', { count }),
                    title: tx('game:controls.highDiceTitle', { count }),
                    displayText: '4·5·6',
                    diceColor: 'luxuryHigh' as const,
                    outerGrad: 'from-rose-400/40 via-red-950/25 to-orange-950/35',
                    hoverOuter: 'hover:from-rose-300/55 hover:via-red-950/30 hover:shadow-[0_0_24px_-8px_rgba(251,113,133,0.36)]',
                    innerActive:
                        'border-rose-400/50 shadow-[0_0_28px_-10px_rgba(251,113,133,0.32),inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-rose-300/28',
                    innerInactive: 'border-rose-950/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] opacity-[0.78]',
                    innerBg: 'from-zinc-950 via-[#1a080c] to-zinc-950',
                    glow: 'bg-rose-400',
                };
        }
    })();

    const innerFrame = usable ? meta.innerActive : meta.innerInactive;
    const effectiveDiceSize = compact ? 22 : diceSize;
    const outerSizeClass = compact
        ? 'aspect-square w-full max-w-[min(100%,2.35rem)] min-h-0 shrink rounded-md'
        : 'h-[4.25rem] w-[4.25rem] rounded-xl min-[1025px]:h-16 min-[1025px]:w-16';

    return (
        <div
            title={meta.title}
            className={`group relative ${outerSizeClass} ${compact ? '' : 'shrink-0'} select-none p-[1px] transition-all duration-300 bg-gradient-to-b ${meta.outerGrad} ${usable ? meta.hoverOuter : ''}`}
            role="group"
            aria-label={meta.ariaLabel}
        >
            <div
                className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-[0.65rem] border backdrop-blur-md transition-all duration-300 ${innerFrame} bg-gradient-to-b ${meta.innerBg}`}
            >
                <div
                    className={`pointer-events-none absolute -left-1/4 -top-1/3 h-full w-2/3 -skew-x-12 rounded-full blur-xl opacity-20 ${meta.glow}`}
                    aria-hidden
                />
                <div
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_0%,rgba(255,255,255,0.07),transparent_55%)]"
                    aria-hidden
                />

                <div className="relative z-[1] flex items-center justify-center p-0.5">
                    <CountOverlay count={count} disabled={!usable} compact={compact}>
                        <Dice
                            displayText={meta.displayText}
                            color={meta.diceColor}
                            value={null}
                            isRolling={false}
                            size={effectiveDiceSize}
                            onClick={onUse}
                            disabled={!usable}
                            outerClassName="!shadow-md rounded-xl !p-0.5"
                        />
                    </CountOverlay>
                </div>
            </div>
        </div>
    );
};

const LabeledDiceGoItem: React.FC<{
    label: string;
    disabled: boolean;
    children: React.ReactNode;
    compact?: boolean;
}> = ({ label, disabled, children, compact = false }) => (
    <div className={`flex min-w-0 max-w-full flex-col items-center gap-0.5 ${compact ? '' : 'min-w-[3.25rem] sm:min-w-[4rem]'}`}>
        {children}
        <span
            className={`max-w-full truncate text-center font-semibold leading-none tracking-wide ${compact ? 'text-[8px]' : 'text-[11px] whitespace-nowrap'} ${
                disabled ? 'text-gray-500' : 'text-amber-100 drop-shadow-sm'
            }`}
        >
            {label}
        </span>
    </div>
);

export type DicePanelVariant = 'all' | 'mainOnly' | 'itemsOnly';

export const DicePanel: React.FC<{
    session: LiveGameSession;
    isMyTurn: boolean;
    onAction: (a: ServerAction) => void;
    currentUser: User;
    /** all: 기본(주+홀+짝) · mainOnly: 일반 주사위만(판 옆) · itemsOnly: 홀·짝만(놀이 기능) */
    variant?: DicePanelVariant;
    /** 모바일 경기장 하단 푸터 한 줄 유지 */
    footerCompact?: boolean;
    /** 주사위바둑 판 옆/하단 큰 패널만 좁은 화면에서 축소 */
    compactMain?: boolean;
}> = ({ session, isMyTurn, onAction, currentUser, variant = 'all', footerCompact = false, compactMain = false }) => {
    const { t } = useTranslation(['common', 'game']);
    const { id: gameId, gameStatus } = session;
    const [localRollEndTime, setLocalRollEndTime] = React.useState<number>(0);
    const [itemConfirm, setItemConfirm] = React.useState<DiceGoPanelItemKind | null>(null);
    useEffect(() => {
        const handler = (ev: Event) => {
            const custom = ev as CustomEvent<{ gameId?: string; endTime?: number }>;
            const incomingGameId = custom.detail?.gameId;
            const endTime = custom.detail?.endTime;
            if (incomingGameId !== gameId || !endTime) return;
            setLocalRollEndTime((prev) => Math.max(prev, endTime));
        };
        window.addEventListener(DICE_ROLL_LOCAL_EVENT, handler as EventListener);
        return () => window.removeEventListener(DICE_ROLL_LOCAL_EVENT, handler as EventListener);
    }, [gameId]);

    /** 서버 애니 종료 시각을 클라에서도 맞추기 위해(소켓만으로는 1.5초 중 재렌더가 없을 수 있음) */
    const [, setAnimTick] = React.useState(0);

    const diceAnimation =
        session.animation?.type === 'dice_roll_main' && gameStatus === 'dice_rolling_animating' ? session.animation : null;
    const serverAnimEnd = diceAnimation ? diceAnimation.startTime + diceAnimation.duration : 0;
    /** 서버 startTime과 클라 Date.now() 시차로 굴림이 너무 빨리 끝나면 잘못된 눈이 잠깐 보임 → 수신 기준 최소 굴림 길이 보장 */
    const clientDiceRollEndRef = useRef(0);
    useLayoutEffect(() => {
        if (!diceAnimation) {
            clientDiceRollEndRef.current = 0;
            return;
        }
        clientDiceRollEndRef.current = Date.now() + (diceAnimation.duration || DICE_ROLL_ANIMATION_MS);
    }, [diceAnimation?.startTime, diceAnimation?.duration]);
    /** animation 필드가 턴 전환 후에도 잠깐 남으면 내 차례(dice_rolling)에서 '혼자 굴러가는' 것처럼 보이는 버그 방지 */
    const isRollingByServerAnim =
        gameStatus === 'dice_rolling_animating' &&
        !!diceAnimation &&
        Date.now() < Math.max(serverAnimEnd, clientDiceRollEndRef.current);
    React.useEffect(() => {
        if (!diceAnimation) return;
        const end = Math.max(serverAnimEnd, clientDiceRollEndRef.current);
        if (Date.now() >= end) return;
        const id = window.setInterval(() => setAnimTick((n) => n + 1), 100);
        return () => clearInterval(id);
    }, [diceAnimation?.startTime, diceAnimation?.duration, serverAnimEnd]);

    // 응답 전 짧은 구간만 로컬 타이머(서버 animation 아직 없을 때)
    const isRollingByLocal =
        gameStatus === 'dice_rolling' &&
        localRollEndTime > 0 &&
        Date.now() < localRollEndTime &&
        !diceAnimation;
    const isRolling = isRollingByServerAnim || isRollingByLocal;
    const [lastStableDiceValue, setLastStableDiceValue] = React.useState<number | null>(session.dice?.dice1 ?? null);

    React.useEffect(() => {
        if (localRollEndTime <= 0) return;
        const t = setTimeout(() => setLocalRollEndTime(0), Math.max(0, localRollEndTime - Date.now()));
        return () => clearTimeout(t);
    }, [localRollEndTime]);

    React.useEffect(() => {
        if (gameStatus !== 'dice_rolling') setItemConfirm(null);
    }, [gameStatus]);

    // 애니메이션 종료 직후 session.dice가 잠깐 비어도 마지막 확정 눈금을 유지
    React.useEffect(() => {
        const animDice = diceAnimation?.dice?.dice1;
        const stableDice = session.dice?.dice1;
        const candidate = animDice ?? stableDice;
        if (candidate != null && candidate >= 1 && candidate <= 6) {
            setLastStableDiceValue(candidate);
        }
    }, [diceAnimation?.dice?.dice1, session.dice?.dice1]);

    const lastDiceRollRequestRef = useRef(0);
    React.useEffect(() => {
        lastDiceRollRequestRef.current = 0;
    }, [gameId]);

    const handleRoll = (itemType?: DiceGoPanelItemKind) => {
        if (!(isMyTurn && gameStatus === 'dice_rolling')) return;
        if (isRolling) return;
        const t = Date.now();
        if (t - lastDiceRollRequestRef.current < 700) return;
        if (itemType === 'odd' || itemType === 'even' || itemType === 'low' || itemType === 'high') {
            setItemConfirm(itemType);
            return;
        }
        lastDiceRollRequestRef.current = t;
        audioService.rollDice(1);
        const endTime = Date.now() + DICE_ROLL_ANIMATION_MS;
        setLocalRollEndTime(endTime);
        window.dispatchEvent(new CustomEvent(DICE_ROLL_LOCAL_EVENT, { detail: { gameId, endTime } }));
        onAction({ type: 'DICE_ROLL', payload: { gameId, itemType } });
    };

    const confirmItemRoll = () => {
        if (!itemConfirm || !(isMyTurn && gameStatus === 'dice_rolling')) {
            setItemConfirm(null);
            return;
        }
        if (isRolling) return;
        const t = Date.now();
        if (t - lastDiceRollRequestRef.current < 700) return;
        lastDiceRollRequestRef.current = t;
        audioService.rollDice(1);
        const endTime = Date.now() + DICE_ROLL_ANIMATION_MS;
        setLocalRollEndTime(endTime);
        window.dispatchEvent(new CustomEvent(DICE_ROLL_LOCAL_EVENT, { detail: { gameId, endTime } }));
        onAction({ type: 'DICE_ROLL', payload: { gameId, itemType: itemConfirm } });
        setItemConfirm(null);
    };

    const myItemUses = session.diceGoItemUses?.[currentUser.id];
    const oddCount = myItemUses?.odd ?? 0;
    const evenCount = myItemUses?.even ?? 0;
    const lowCount = myItemUses?.low ?? 0;
    const highCount = myItemUses?.high ?? 0;
    const canRoll = isMyTurn && gameStatus === 'dice_rolling';
    const oddItemUsable = canRoll && oddCount > 0 && !isRolling;
    const evenItemUsable = canRoll && evenCount > 0 && !isRolling;
    const lowItemUsable = canRoll && lowCount > 0 && !isRolling;
    const highItemUsable = canRoll && highCount > 0 && !isRolling;

    // ThiefPanel과 동일: 굴림 중에도 서버가 준 dice1을 표시하면 숫자가 안 바뀐다(무작위 면 → 실제 값 혼동 방지)
    const diceValue = diceAnimation?.dice?.dice1 ?? session.dice?.dice1 ?? lastStableDiceValue ?? null;

    const showMain = variant === 'all' || variant === 'mainOnly';
    const showItems = variant === 'all' || variant === 'itemsOnly';
    const showItemModal = showItems;

    const mainDice = showMain ? (
        variant === 'mainOnly' ? (
            <div
                className={`flex max-w-full min-w-0 flex-col items-center rounded-2xl border bg-gradient-to-b from-slate-900/96 via-gray-950/92 to-black/92 shadow-[0_0_36px_-10px_rgba(251,191,36,0.45),inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition-shadow duration-300 ${
                    compactMain ? 'gap-1.5 px-3 py-3' : 'gap-2 px-4 py-4'
                } ${canRoll ? 'dice-panel-turn-glow border-amber-300/70 ring-2 ring-amber-300/25' : 'border-amber-400/35'}`}
            >
                <span className={`font-bold uppercase tracking-[0.2em] text-amber-200/90 ${compactMain ? 'text-[9px]' : 'text-[10px]'}`}>{t('game:controls.dice')}</span>
                <Dice
                    value={diceValue ?? null}
                    isRolling={isRolling}
                    size={compactMain ? 52 : 64}
                    onClick={() => handleRoll()}
                    disabled={!canRoll}
                />
            </div>
        ) : (
            <div className="flex flex-col items-center">
                <Dice
                    value={diceValue ?? null}
                    isRolling={isRolling}
                    size={52}
                    onClick={() => handleRoll()}
                    disabled={!canRoll}
                />
            </div>
        )
    ) : null;

    const diceGoConfirmCopy = (k: DiceGoPanelItemKind) => {
        switch (k) {
            case 'odd':
                return {
                    title: t('controls.oddDiceUseTitle'),
                    body: t('controls.oddDiceUseBody'),
                };
            case 'even':
                return {
                    title: t('controls.evenDiceUseTitle'),
                    body: t('controls.evenDiceUseBody'),
                };
            case 'low':
                return {
                    title: t('controls.lowDiceUseTitle'),
                    body: t('controls.lowDiceUseBody'),
                };
            case 'high':
                return {
                    title: t('controls.highDiceUseTitle'),
                    body: t('controls.highDiceUseBody'),
                };
        }
    };

    const diceGoItemsRow = showItems ? (
        <ArenaFixedColsGrid
            cols={4}
            gapClass={footerCompact ? 'gap-x-0.5 gap-y-1 sm:gap-x-1.5' : 'gap-x-5 gap-y-2.5'}
            className={footerCompact ? 'min-w-0 max-w-full' : ''}
        >
            <LabeledDiceGoItem label={t('game:controls.odd')} disabled={!oddItemUsable} compact={footerCompact}>
                <DiceGoLuxuryItemCard kind="odd" count={oddCount} usable={oddItemUsable} onUse={() => handleRoll('odd')} compact={footerCompact} />
            </LabeledDiceGoItem>
            <LabeledDiceGoItem label={t('game:controls.even')} disabled={!evenItemUsable} compact={footerCompact}>
                <DiceGoLuxuryItemCard kind="even" count={evenCount} usable={evenItemUsable} onUse={() => handleRoll('even')} compact={footerCompact} />
            </LabeledDiceGoItem>
            <LabeledDiceGoItem label={t('game:controls.lowShort')} disabled={!lowItemUsable} compact={footerCompact}>
                <DiceGoLuxuryItemCard kind="low" count={lowCount} usable={lowItemUsable} onUse={() => handleRoll('low')} compact={footerCompact} />
            </LabeledDiceGoItem>
            <LabeledDiceGoItem label={t('game:controls.highShort')} disabled={!highItemUsable} compact={footerCompact}>
                <DiceGoLuxuryItemCard kind="high" count={highCount} usable={highItemUsable} onUse={() => handleRoll('high')} compact={footerCompact} />
            </LabeledDiceGoItem>
        </ArenaFixedColsGrid>
    ) : null;

    return (
        <>
            {showItemModal && itemConfirm && (
                <div
                    className="sudamr-modal-overlay z-[200]"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="dice-item-confirm-title"
                    onClick={() => setItemConfirm(null)}
                >
                    <div
                        className="sudamr-modal-panel max-w-sm space-y-4 border border-amber-400/35 p-5 shadow-[0_0_40px_-12px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/15"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 id="dice-item-confirm-title" className="text-lg font-bold tracking-tight text-highlight">
                            {diceGoConfirmCopy(itemConfirm).title}
                        </h2>
                        <p className="text-sm leading-relaxed text-secondary">{diceGoConfirmCopy(itemConfirm).body}</p>
                        <div className="flex gap-2 justify-end">
                            <Button type="button" colorScheme="none" className="!px-4 !py-2 rounded-lg border border-gray-600 text-gray-200" onClick={() => setItemConfirm(null)}>
                                {t('common:actions.cancel')}
                            </Button>
                            <Button type="button" colorScheme="none" className="!px-4 !py-2 rounded-lg border border-amber-400/60 bg-amber-600/90 text-slate-900 font-semibold" onClick={confirmItemRoll}>
                                {t('common:actions.use')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            <div
                className={
                    footerCompact
                        ? variant === 'all'
                            ? 'grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-0 p-0'
                            : 'w-full min-w-0 border-0 p-0'
                        : 'flex flex-row flex-wrap items-center justify-center gap-3 border-0 p-0 transition-all'
                }
            >
                {variant === 'all' ? (
                    <>
                        <div
                            className={`flex shrink-0 flex-col items-center ${canRoll ? 'dice-panel-turn-glow rounded-xl border border-amber-400/30 p-2' : 'rounded-lg border-2 border-transparent p-2'}`}
                        >
                            {mainDice}
                        </div>
                        {diceGoItemsRow}
                    </>
                ) : variant === 'mainOnly' ? (
                    mainDice
                ) : (
                    diceGoItemsRow
                )}
            </div>
        </>
    );
};

const AlkkagiItemPanel: React.FC<{
    session: LiveGameSession;
    isMyTurn: boolean;
    onAction: (a: ServerAction) => void;
    currentUser: User;
    compact?: boolean;
}> = ({ session, isMyTurn, onAction, currentUser, compact = false }) => {
    const { id: gameId, gameStatus, activeAlkkagiItems } = session;
    const myItems = session.alkkagiItemUses?.[currentUser.id];
    const slowCount = myItems?.slow ?? session.settings.alkkagiSlowItemCount ?? 0;
    const aimCount = myItems?.aimingLine ?? session.settings.alkkagiAimingLineItemCount ?? 0;
    const myActiveItems = activeAlkkagiItems?.[currentUser.id] || [];

    const useItem = (itemType: 'slow' | 'aimingLine') => {
        onAction({ type: 'USE_ALKKAGI_ITEM', payload: { gameId, itemType } });
    };

    const isSlowActive = myActiveItems.includes('slow');
    const isAimActive = myActiveItems.includes('aimingLine');
    const canUse = isMyTurn && gameStatus === 'alkkagi_playing';

    const totalRounds = session.settings.alkkagiRounds || 1;

    if (totalRounds <= 1) {
        return (
            <ArenaFixedColsGrid cols={2} gapClass={compact ? 'gap-1.5' : 'gap-5'} className={compact ? 'min-w-0' : ''}>
                <LabeledControlButton
                    src="/images/button/slow.webp"
                    alt={tx('game:controls.slow')}
                    label={tx('game:controls.slow')}
                    count={slowCount}
                    caption={isSlowActive ? tx('game:controls.inUse') : undefined}
                    onClick={() => useItem('slow')}
                    disabled={!canUse || slowCount <= 0 || isSlowActive}
                    title={tx('game:controls.slowTitle', { count: slowCount })}
                    compact={compact}
                />
                <LabeledControlButton
                    src="/images/button/target.webp"
                    alt={tx('game:controls.aimingLine')}
                    label={tx('game:controls.aimingLine')}
                    count={aimCount}
                    caption={isAimActive ? tx('game:controls.inUse') : undefined}
                    onClick={() => useItem('aimingLine')}
                    disabled={!canUse || aimCount <= 0 || isAimActive}
                    title={tx('game:controls.aimTitle', { count: aimCount })}
                    compact={compact}
                />
            </ArenaFixedColsGrid>
        );
    }
    
    return (
        <ArenaFixedColsGrid cols={2} gapClass={compact ? 'gap-1.5' : 'gap-5'} className="min-w-0">
            <LabeledControlButton
                src="/images/button/slow.webp"
                alt={tx('game:controls.slow')}
                label={tx('game:controls.slow')}
                count={slowCount}
                caption={isSlowActive ? tx('game:controls.inUse') : undefined}
                onClick={() => useItem('slow')}
                disabled={!canUse || slowCount <= 0 || isSlowActive}
                title={tx('game:controls.slowTitle', { count: slowCount })}
                compact={compact}
            />
            <LabeledControlButton
                src="/images/button/target.webp"
                alt={tx('game:controls.aimingLine')}
                label={tx('game:controls.aimingLine')}
                count={aimCount}
                caption={isAimActive ? tx('game:controls.inUse') : undefined}
                onClick={() => useItem('aimingLine')}
                disabled={!canUse || aimCount <= 0 || isAimActive}
                title={tx('game:controls.aimTitle', { count: aimCount })}
                compact={compact}
            />
        </ArenaFixedColsGrid>
    );
};


const PlayfulStonesPanel: React.FC<{ session: LiveGameSession, currentUser: GameProps['currentUser'] }> = ({ session, currentUser }) => {
    // This panel is now a fallback for playful modes without special item controls.
    // Currently, it displays nothing for Omok/Ttamok, which is acceptable.
    // A potential future implementation for Ttamok capture count could go here.
    return null;
};

export type ThiefGoPanelItemKind = 'high36' | 'noOne';

const ThiefGoLuxuryItemCard: React.FC<{
    kind: ThiefGoPanelItemKind;
    count: number;
    usable: boolean;
    onUse: () => void;
    compact?: boolean;
}> = ({ kind, count, usable, onUse, compact = false }) => {
    const [diceSize, setDiceSize] = React.useState(54);
    React.useEffect(() => {
        if (compact) return;
        const q = window.matchMedia('(min-width: 1025px)');
        const sync = () => setDiceSize(q.matches ? 56 : 54);
        sync();
        q.addEventListener('change', sync);
        return () => q.removeEventListener('change', sync);
    }, [compact]);

    const meta = (() => {
        switch (kind) {
            case 'high36':
                return {
                    ariaLabel: tx('game:controls.thiefHigh36Aria', { count }),
                    title: tx('game:controls.thiefHigh36Title', { count }),
                    displayText: '3·4·5·6',
                    diceColor: 'luxuryThiefHigh36' as const,
                    outerGrad: 'from-emerald-400/38 via-teal-900/22 to-green-950/35',
                    hoverOuter: 'hover:from-emerald-300/52 hover:via-teal-900/28 hover:shadow-[0_0_24px_-8px_rgba(52,211,153,0.34)]',
                    innerActive:
                        'border-emerald-400/48 shadow-[0_0_28px_-10px_rgba(52,211,153,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-emerald-300/25',
                    innerInactive: 'border-emerald-950/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] opacity-[0.78]',
                    innerBg: 'from-zinc-950 via-[#0a1812] to-zinc-950',
                    glow: 'bg-emerald-400',
                };
            case 'noOne':
                return {
                    ariaLabel: tx('game:controls.thiefNoOneAria', { count }),
                    title: tx('game:controls.thiefNoOneTitle', { count }),
                    displayText: '2·3·4·5',
                    diceColor: 'luxuryThiefNoOne' as const,
                    outerGrad: 'from-sky-400/38 via-slate-700/22 to-blue-950/35',
                    hoverOuter: 'hover:from-sky-300/50 hover:via-slate-600/28 hover:shadow-[0_0_24px_-8px_rgba(56,189,248,0.34)]',
                    innerActive:
                        'border-sky-400/48 shadow-[0_0_28px_-10px_rgba(56,189,248,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-sky-300/25',
                    innerInactive: 'border-sky-950/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] opacity-[0.78]',
                    innerBg: 'from-slate-950 via-[#0a1420] to-slate-950',
                    glow: 'bg-sky-400',
                };
        }
    })();

    const innerFrame = usable ? meta.innerActive : meta.innerInactive;
    const effectiveDiceSize = compact ? 22 : diceSize;
    const outerSizeClass = compact
        ? 'aspect-square w-full max-w-[min(100%,2.35rem)] min-h-0 shrink rounded-md'
        : 'h-[4.25rem] w-[4.25rem] rounded-xl min-[1025px]:h-16 min-[1025px]:w-16';

    return (
        <div
            title={meta.title}
            className={`group relative ${outerSizeClass} ${compact ? '' : 'shrink-0'} select-none p-[1px] transition-all duration-300 bg-gradient-to-b ${meta.outerGrad} ${usable ? meta.hoverOuter : ''}`}
            role="group"
            aria-label={meta.ariaLabel}
        >
            <div
                className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-[0.65rem] border backdrop-blur-md transition-all duration-300 ${innerFrame} bg-gradient-to-b ${meta.innerBg}`}
            >
                <div className={`pointer-events-none absolute -left-1/4 -top-1/3 h-full w-2/3 -skew-x-12 rounded-full blur-xl opacity-20 ${meta.glow}`} aria-hidden />
                <div
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_0%,rgba(255,255,255,0.07),transparent_55%)]"
                    aria-hidden
                />
                <div className="relative z-[1] flex items-center justify-center p-0.5">
                    <CountOverlay count={count} disabled={!usable} compact={compact}>
                        <Dice
                            displayText={meta.displayText}
                            color={meta.diceColor}
                            value={null}
                            isRolling={false}
                            size={effectiveDiceSize}
                            onClick={onUse}
                            disabled={!usable}
                            outerClassName="!shadow-md rounded-xl !p-0.5"
                        />
                    </CountOverlay>
                </div>
            </div>
        </div>
    );
};

export type ThiefPanelVariant = 'all' | 'mainOnly' | 'itemsOnly';

interface ThiefPanelProps {
    session: LiveGameSession;
    isMyTurn: boolean;
    onAction: (a: ServerAction) => void;
    currentUser: User;
    variant?: ThiefPanelVariant;
    footerCompact?: boolean;
}

export const ThiefPanel: React.FC<ThiefPanelProps> = ({ session, isMyTurn, onAction, currentUser, variant = 'all', footerCompact = false }) => {
    const { t } = useTranslation(['common', 'game']);
    const { id: gameId, gameStatus, animation, currentPlayer, blackPlayerId, whitePlayerId, thiefPlayerId } = session;

    const [localRollEndTime, setLocalRollEndTime] = React.useState<number>(0);
    const [itemConfirm, setItemConfirm] = React.useState<ThiefGoPanelItemKind | null>(null);
    useEffect(() => {
        const handler = (ev: Event) => {
            const custom = ev as CustomEvent<{ gameId?: string; endTime?: number }>;
            const incomingGameId = custom.detail?.gameId;
            const endTime = custom.detail?.endTime;
            if (incomingGameId !== gameId || !endTime) return;
            setLocalRollEndTime((prev) => Math.max(prev, endTime));
        };
        window.addEventListener(DICE_ROLL_LOCAL_EVENT, handler as EventListener);
        return () => window.removeEventListener(DICE_ROLL_LOCAL_EVENT, handler as EventListener);
    }, [gameId]);

    const [, setAnimTick] = React.useState(0);
    const diceAnimation =
        animation?.type === 'dice_roll_main' && gameStatus === 'thief_rolling_animating' ? animation : null;
    const serverAnimEnd = diceAnimation ? diceAnimation.startTime + diceAnimation.duration : 0;
    const clientThiefRollEndRef = useRef(0);
    useLayoutEffect(() => {
        if (!diceAnimation) {
            clientThiefRollEndRef.current = 0;
            return;
        }
        clientThiefRollEndRef.current = Date.now() + (diceAnimation.duration || DICE_ROLL_ANIMATION_MS);
    }, [diceAnimation?.startTime, diceAnimation?.duration]);
    const isRollingByServerAnim =
        gameStatus === 'thief_rolling_animating' &&
        !!diceAnimation &&
        Date.now() < Math.max(serverAnimEnd, clientThiefRollEndRef.current);
    React.useEffect(() => {
        if (!diceAnimation) return;
        const end = Math.max(serverAnimEnd, clientThiefRollEndRef.current);
        if (Date.now() >= end) return;
        const id = window.setInterval(() => setAnimTick((n) => n + 1), 100);
        return () => clearInterval(id);
    }, [diceAnimation?.startTime, diceAnimation?.duration, serverAnimEnd]);

    const isRollingByLocal =
        gameStatus === 'thief_rolling' &&
        localRollEndTime > 0 &&
        Date.now() < localRollEndTime &&
        !diceAnimation;
    const isRolling = isRollingByServerAnim || isRollingByLocal;

    const currentPlayerId = currentPlayer === Player.Black ? blackPlayerId : whitePlayerId;
    const currentPlayerRole = currentPlayerId === thiefPlayerId ? 'thief' : 'police';
    // 도둑/경찰은 롤링 애니 중 currentPlayer 패킷이 먼저 바뀌어도, 굴린 주사위 개수는 animation.dice 기준으로 고정한다.
    const rollingDiceCount =
        diceAnimation != null ? ((Number(diceAnimation.dice?.dice2) || 0) > 0 ? 2 : 1) : null;
    const diceCount = rollingDiceCount ?? (currentPlayerRole === 'thief' ? 1 : 2);

    const [lastStableDice1, setLastStableDice1] = React.useState<number | null>(session.dice?.dice1 ?? null);
    const [lastStableDice2, setLastStableDice2] = React.useState<number | null>(
        diceCount === 2 ? (session.dice?.dice2 ?? null) : null
    );

    React.useEffect(() => {
        if (localRollEndTime <= 0) return;
        const t = setTimeout(() => setLocalRollEndTime(0), Math.max(0, localRollEndTime - Date.now()));
        return () => clearTimeout(t);
    }, [localRollEndTime]);

    React.useEffect(() => {
        if (gameStatus !== 'thief_rolling') setItemConfirm(null);
    }, [gameStatus]);

    React.useEffect(() => {
        const a1 = diceAnimation?.dice?.dice1;
        const a2 = diceAnimation?.dice?.dice2;
        const s1 = session.dice?.dice1;
        const s2 = session.dice?.dice2;
        const c1 = a1 ?? s1;
        if (c1 != null && c1 >= 1 && c1 <= 6) setLastStableDice1(c1);
        const c2 = a2 ?? s2;
        if (diceCount === 2 && c2 != null && c2 >= 1 && c2 <= 6) setLastStableDice2(c2);
    }, [diceAnimation?.dice?.dice1, diceAnimation?.dice?.dice2, session.dice?.dice1, session.dice?.dice2, diceCount]);

    const canRoll = isMyTurn && gameStatus === 'thief_rolling';
    const myUses = session.thiefGoItemUses?.[currentUser.id];
    const high36Count = myUses?.high36 ?? 0;
    const noOneCount = myUses?.noOne ?? 0;
    const high36Usable = canRoll && high36Count > 0 && !isRolling;
    const noOneUsable = canRoll && noOneCount > 0 && !isRolling;

    const lastThiefRollRequestRef = useRef(0);
    React.useEffect(() => {
        lastThiefRollRequestRef.current = 0;
    }, [gameId]);

    const handleRoll = (itemType?: ThiefGoPanelItemKind) => {
        if (!canRoll) return;
        if (isRolling) return;
        const nowTs = Date.now();
        if (nowTs - lastThiefRollRequestRef.current < 700) return;
        if (itemType === 'high36' || itemType === 'noOne') {
            setItemConfirm(itemType);
            return;
        }
        lastThiefRollRequestRef.current = nowTs;
        audioService.rollDice(diceCount);
        const endTime = Date.now() + DICE_ROLL_ANIMATION_MS;
        setLocalRollEndTime(endTime);
        window.dispatchEvent(new CustomEvent(DICE_ROLL_LOCAL_EVENT, { detail: { gameId, endTime } }));
        onAction({ type: 'THIEF_ROLL_DICE', payload: { gameId } });
    };

    const confirmItemRoll = () => {
        if (!itemConfirm || !canRoll) {
            setItemConfirm(null);
            return;
        }
        if (isRolling) return;
        const nowTs = Date.now();
        if (nowTs - lastThiefRollRequestRef.current < 700) return;
        lastThiefRollRequestRef.current = nowTs;
        audioService.rollDice(diceCount);
        const endTime = Date.now() + DICE_ROLL_ANIMATION_MS;
        setLocalRollEndTime(endTime);
        window.dispatchEvent(new CustomEvent(DICE_ROLL_LOCAL_EVENT, { detail: { gameId, endTime } }));
        onAction({ type: 'THIEF_ROLL_DICE', payload: { gameId, itemType: itemConfirm } });
        setItemConfirm(null);
    };

    const diceValue1 = diceAnimation?.dice?.dice1 ?? session.dice?.dice1 ?? lastStableDice1 ?? null;
    const diceValue2 = diceCount === 2 ? (diceAnimation?.dice?.dice2 ?? session.dice?.dice2 ?? lastStableDice2 ?? null) : null;

    const showMain = variant === 'all' || variant === 'mainOnly';
    const showItems = variant === 'all' || variant === 'itemsOnly';

    const mainDice = showMain ? (
        variant === 'mainOnly' ? (
            <div
                className={`flex flex-col items-center gap-2 rounded-2xl border bg-gradient-to-b from-gray-900/95 via-gray-950/90 to-black/90 px-4 py-4 shadow-[0_0_36px_-10px_rgba(251,191,36,0.45),inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition-shadow duration-300 ${
                    canRoll ? 'dice-panel-turn-glow border-amber-300/70 ring-2 ring-amber-300/25' : 'border-amber-400/35'
                }`}
            >
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/85">{tx('game:controls.dice')}</span>
                <div className="flex items-center justify-center gap-2">
                    <Dice
                        value={diceValue1}
                        isRolling={isRolling}
                        size={64}
                        onClick={() => handleRoll()}
                        disabled={!canRoll}
                    />
                    {diceCount === 2 && (
                        <Dice value={diceValue2} isRolling={isRolling} size={64} onClick={() => handleRoll()} disabled={!canRoll} />
                    )}
                </div>
            </div>
        ) : (
            <div className="flex items-center justify-center gap-2">
                <Dice value={diceValue1} isRolling={isRolling} size={52} onClick={() => handleRoll()} disabled={!canRoll} />
                {diceCount === 2 && (
                    <Dice value={diceValue2} isRolling={isRolling} size={52} onClick={() => handleRoll()} disabled={!canRoll} />
                )}
            </div>
        )
    ) : null;

    const thiefConfirmCopy = (k: ThiefGoPanelItemKind) => {
        switch (k) {
            case 'high36':
                return {
                    title: tx('game:controls.thiefHigh36UseTitle'),
                    body: tx('game:controls.thiefHigh36UseBody'),
                };
            case 'noOne':
                return {
                    title: tx('game:controls.thiefNoOneUseTitle'),
                    body: tx('game:controls.thiefNoOneUseBody'),
                };
        }
    };

    const thiefItemsRow = showItems ? (
        <ArenaFixedColsGrid cols={2} gapClass={footerCompact ? 'gap-x-0.5 gap-y-1 sm:gap-x-1.5' : 'gap-x-5 gap-y-2.5'} className={footerCompact ? 'min-w-0 max-w-full' : ''}>
            <LabeledDiceGoItem label={tx('game:controls.highShort')} disabled={!high36Usable} compact={footerCompact}>
                <ThiefGoLuxuryItemCard kind="high36" count={high36Count} usable={high36Usable} onUse={() => handleRoll('high36')} compact={footerCompact} />
            </LabeledDiceGoItem>
            <LabeledDiceGoItem label={tx('game:controls.noOneShort')} disabled={!noOneUsable} compact={footerCompact}>
                <ThiefGoLuxuryItemCard kind="noOne" count={noOneCount} usable={noOneUsable} onUse={() => handleRoll('noOne')} compact={footerCompact} />
            </LabeledDiceGoItem>
        </ArenaFixedColsGrid>
    ) : null;

    return (
        <>
            {showItems && itemConfirm && (
                <div
                    className="sudamr-modal-overlay z-[200]"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="thief-item-confirm-title"
                    onClick={() => setItemConfirm(null)}
                >
                    <div
                        className="sudamr-modal-panel max-w-sm space-y-4 border border-amber-400/35 p-5 shadow-[0_0_40px_-12px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/15"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 id="thief-item-confirm-title" className="text-lg font-bold tracking-tight text-highlight">
                            {thiefConfirmCopy(itemConfirm).title}
                        </h2>
                        <p className="text-sm leading-relaxed text-secondary">{thiefConfirmCopy(itemConfirm).body}</p>
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                colorScheme="none"
                                className="!px-4 !py-2 rounded-lg border border-gray-600 text-gray-200"
                                onClick={() => setItemConfirm(null)}
                            >
                                {t('common:actions.cancel')}
                            </Button>
                            <Button
                                type="button"
                                colorScheme="none"
                                className="!px-4 !py-2 rounded-lg border border-amber-400/60 bg-amber-600/90 font-semibold text-slate-900"
                                onClick={confirmItemRoll}
                            >
                                {t('common:actions.use')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            <div
                className={
                    footerCompact
                        ? variant === 'all'
                            ? 'grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-0 p-0'
                            : 'w-full min-w-0 border-0 p-0'
                        : 'flex flex-row flex-wrap items-center justify-center gap-3 border-0 p-0 transition-all'
                }
            >
                {variant === 'all' ? (
                    <>
                        <div className={`flex shrink-0 flex-col items-center ${canRoll ? 'dice-panel-turn-glow rounded-xl border border-amber-400/30 p-2' : 'rounded-lg border-2 border-transparent p-2'}`}>
                            {mainDice}
                        </div>
                        {thiefItemsRow}
                    </>
                ) : variant === 'mainOnly' ? (
                    mainDice
                ) : (
                    thiefItemsRow
                )}
            </div>
        </>
    );
};

const CurlingItemPanel: React.FC<{
    session: LiveGameSession;
    isMyTurn: boolean;
    onAction: (a: ServerAction) => void;
    currentUser: User;
    compact?: boolean;
}> = ({ session, isMyTurn, onAction, currentUser, compact = false }) => {
    const { id: gameId, gameStatus, activeCurlingItems } = session;
    const myItems = session.curlingItemUses?.[currentUser.id];
    const slowCount = myItems?.slow ?? session.settings.curlingSlowItemCount ?? 0;
    const aimCount = myItems?.aimingLine ?? session.settings.curlingAimingLineItemCount ?? 0;
    const myActiveItems = activeCurlingItems?.[currentUser.id] || [];


    const useItem = (itemType: 'slow' | 'aimingLine') => {
        onAction({ type: 'USE_CURLING_ITEM', payload: { gameId, itemType } });
    };

    const isSlowActive = myActiveItems.includes('slow');
    const isAimActive = myActiveItems.includes('aimingLine');
    const canUse = isMyTurn && (gameStatus === 'curling_playing' || gameStatus === 'curling_tiebreaker_playing');
    return (
        <ArenaFixedColsGrid cols={2} gapClass={compact ? 'gap-1.5' : 'gap-5'} className={compact ? 'min-w-0' : ''}>
            <LabeledControlButton
                src="/images/button/slow.webp"
                alt={tx('game:controls.slow')}
                label={tx('game:controls.slow')}
                count={slowCount}
                onClick={() => useItem('slow')}
                disabled={!canUse || slowCount <= 0 || isSlowActive}
                title={tx('game:controls.slowTitle', { count: slowCount })}
                compact={compact}
            />
            <LabeledControlButton
                src="/images/button/target.webp"
                alt={tx('game:controls.aimingLine')}
                label={tx('game:controls.aimingLine')}
                count={aimCount}
                onClick={() => useItem('aimingLine')}
                disabled={!canUse || aimCount <= 0 || isAimActive}
                title={tx('game:controls.aimTitle', { count: aimCount })}
                compact={compact}
            />
        </ArenaFixedColsGrid>
    );
};


const GameControls: React.FC<GameControlsProps> = (props) => {
    const { t } = useTranslation(['common', 'game']);
    const {
        session,
        isMyTurn,
        isSpectator,
        onAction,
        setShowResultModal,
        setConfirmModalType,
        onOpenRematchSettings,
        currentUser,
        onlineUsers,
        pendingMove,
        onConfirmMove,
        onCancelMove,
        isMobile,
        settings,
        isSinglePlayer,
        isSinglePlayerPaused = false,
        isPaused = false,
        resumeCountdown = 0,
        pauseButtonCooldown = 0,
        onPauseToggle,
        onOpenGameRecordList,
        onLeaveOrResign,
        showResultModal = false,
        allowPostGameFooterActions = true,
        onDismissGameSummary,
        strategicPetHintFooterBubble = null,
        showMoveConfirmFooter = false,
        onMobileConfirmToggle,
    } = props;
    const { negotiations } = useAppContext();
    const { id: gameId, mode, gameStatus, blackPlayerId, whitePlayerId, player1, player2 } = session;
    const isMixMode = mode === GameMode.Mix;
    const isGameEnded = ['ended', 'no_contest', 'rematch_pending'].includes(gameStatus);
    const blockPostGameFooter = allowPostGameFooterActions === false;
    const showBaseGameFooterStrip = isBaseGameFooterPhase(session) && !isGameEnded;
    /** 모험 몬스터 베이스: 싱글과 동일 앰버 톤의 베이스 전·덤 푸터 */
    const basePregameSpStyleChrome =
        Boolean(isSinglePlayer) || String(session.gameCategory ?? '') === 'adventure';
    const isGameActive = ACTIVE_GAME_STATUSES.includes(gameStatus);
    const isPreGame = !isGameActive && !isGameEnded;
    const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === mode);
    const hasCaptureRule = modeIncludesCaptureRule(mode, session.settings);
    const isPairGame = Boolean(session.settings.pairGame?.turnOrder?.length);
    /** 페어 4인 유저 PVP에서만 통과 버튼 노출 */
    const isPairHumanPvp = isPairHumanHumanPvpForTeamResign(session);
    /** 펫·2인 페어 AI전: `isAiGame`이 false일 수 있어 `pairMode === 'ai'`로 구분 (summaryService와 동일) */
    const isPairAiAutoScoringMatch = Boolean(isPairGame && session.settings?.pairGame?.pairMode === 'ai');
    const hidePassForFixedScoringTurnLimit = pvpHasFixedScoringTurnLimit(session);
    const isMobilePairGame = Boolean(isMobile && isPairGame);
    const pairCoopTwoHumansVsAi = isPairCooperativeTwoHumansVsAi(session.settings);
    const hideMannerRowForBaseCaptureBid =
        gameStatus === 'capture_bidding' && modeIncludesBaseCaptureMix(mode, session.settings);
    const showMannerActionRow = !isSinglePlayer && !session.isAiGame && !pairCoopTwoHumansVsAi && !hideMannerRowForBaseCaptureBid;
    const showMannerAiLobbyHintRow = !isSinglePlayer && session.isAiGame && !pairCoopTwoHumansVsAi;
    const aiLobbyRematchActionPointCostLabel = useMemo(() => {
        const aiSettings = {
            kataServerLevel: session.settings?.kataServerLevel,
            goAiBotLevel: session.settings?.goAiBotLevel,
            aiDifficulty: session.settings?.aiDifficulty,
        };
        const base = baseAiLobbyActionPointCostForModeAndSettings(mode, aiSettings);
        if (!currentUser) return String(base);
        const eff = isPairAiAutoScoringMatch
            ? effectivePairAiLobbyApCostForUser(currentUser as User, mode, aiSettings, {
                  lobbyChannel: session.settings?.pairGame?.lobbyChannel ?? 'pair',
              })
            : effectiveAiLobbyApCostForUser(currentUser as User, mode, aiSettings);
        return formatActionPointCostWithPetDiscount(base, eff);
    }, [
        mode,
        currentUser,
        isPairAiAutoScoringMatch,
        session.settings?.kataServerLevel,
        session.settings?.goAiBotLevel,
        session.settings?.aiDifficulty,
        session.settings?.pairGame?.lobbyChannel,
    ]);
    const isAiLobbyGame =
        session.isAiGame &&
        !session.isSinglePlayer &&
        session.gameCategory !== 'tower' &&
        session.gameCategory !== 'singleplayer' &&
        session.gameCategory !== 'guildwar' &&
        session.gameCategory !== 'adventure';
    const showAiLobbyRematchButton = Boolean(
        (isAiLobbyGame || isPairAiAutoScoringMatch) && onOpenRematchSettings,
    );
    const isPvpRematchEligible =
        isGameEnded &&
        !session.isSinglePlayer &&
        !session.isAiGame &&
        session.gameCategory !== 'tower' &&
        session.gameCategory !== 'singleplayer' &&
        session.gameCategory !== 'guildwar';
    const rematchRequested = gameStatus === 'rematch_pending';
    const [isRematchModalOpen, setIsRematchModalOpen] = useState(false);
    const [petHintBusy, setPetHintBusy] = useState(false);
    const rematchTarget = useMemo(() => {
        const opponentId = currentUser.id === player1.id ? player2.id : player1.id;
        const online = onlineUsers.find(u => u.id === opponentId);
        if (online) return online;
        const fallback = player1.id === opponentId ? player1 : player2;
        return { ...(fallback as any), status: 'online' };
    }, [currentUser.id, onlineUsers, player1, player2]);
    const [savingGameRecord, setSavingGameRecord] = useState(false);
    const { recordAlreadySaved, setSavedOptimistic } = useGameRecordSaveLock(gameId, currentUser.savedGameRecords);
    const savedRecordCount = currentUser.savedGameRecords?.length ?? 0;
    const showStrategicGameRecordActions =
        !isSpectator &&
        canSaveStrategicPvpGameRecord(session);
    // 일반 AI 대국(대기실 'AI와 대결하기')에서만 사용되는 수동 일시정지/재개 플래그
    const isPausableAiGame =
        session.isAiGame &&
        !session.isSinglePlayer &&
        session.gameCategory !== 'tower' &&
        session.gameCategory !== 'singleplayer' &&
        session.gameCategory !== 'adventure';
    // 클라이언트 일시 정지 상태 사용 (싱글플레이어와 동일한 방식)
    const isClientPaused = isPausableAiGame ? isPaused : false;
    const handlePass = () => { 
        console.log('[GameControls] handlePass called', { isMyTurn, isSpectator, gameStatus, gameId });
        if (!isMyTurn) {
            console.log('[GameControls] handlePass: Not my turn');
            return;
        }
        if (isSpectator) {
            console.log('[GameControls] handlePass: Is spectator');
            return;
        }
        if (gameStatus !== 'playing') {
            console.log('[GameControls] handlePass: Game status is not playing', gameStatus);
            return;
        }
        
        // PVE(싱글/타워)만 클라이언트에서 처리, 그 외(일반/AI)는 서버로 전송
        const isPVEGame = session.isSinglePlayer || session.gameCategory === 'tower' || session.gameCategory === 'singleplayer';
        if (isPVEGame) {
            // PVE 게임: 클라이언트에서 패스 처리 및 계가 요청
            const currentPassCount = (session.passCount || 0) + 1;
            if (currentPassCount >= 2) {
                const scoringBoardSnapshot = Array.isArray(session.boardState)
                    ? session.boardState.map((row: number[]) => [...row])
                    : [];
                const scoringMoveHistorySnapshot = Array.isArray(session.moveHistory)
                    ? session.moveHistory.map((move: any) => ({ ...move }))
                    : [];
                const scoringSettingsSnapshot = session.settings
                    ? { ...session.settings }
                    : undefined;
                // 두 번 연속 패스 시 계가 요청
                console.log('[GameControls] handlePass: Requesting scoring (2 passes)');
                onAction({ 
                    type: 'REQUEST_SCORING', 
                    payload: { 
                        gameId, 
                        boardState: scoringBoardSnapshot, 
                        moveHistory: scoringMoveHistorySnapshot, 
                        settings: scoringSettingsSnapshot,
                    } 
                } as any);
            } else {
                // 첫 번째 패스: 클라이언트에서 처리
                console.log('[GameControls] handlePass: First pass (PVE)');
                onAction({ 
                    type: session.gameCategory === 'tower' ? 'TOWER_CLIENT_MOVE' : 'SINGLE_PLAYER_CLIENT_MOVE',
                    payload: {
                        gameId,
                        x: -1,
                        y: -1,
                        newBoardState: session.boardState,
                        capturedStones: [],
                        newKoInfo: session.koInfo,
                        isPass: true
                    }
                } as any);
            }
        } else {
            // PVP 게임: 서버로 전송
            console.log('[GameControls] handlePass: Sending PASS_TURN to server');
            onAction({ type: 'PASS_TURN', payload: { gameId } }); 
        }
    };
    const handleResign = () => { 
        console.log('[GameControls] handleResign called', { isSpectator, isAiGame: session.isAiGame, isGameActive, gameStatus });
        if (isSpectator) {
            console.log('[GameControls] handleResign: Is spectator');
            return;
        }
        // 기권은 본인의 차례가 아니더라도 사용 가능하도록 변경
        // 게임이 종료되지 않았고, pending 상태가 아니면 기권 가능 (AI 게임 포함)
        if (gameStatus === 'ended' || gameStatus === 'no_contest' || gameStatus === 'pending' || gameStatus === 'scoring') {
            console.log('[GameControls] handleResign: Game is not in a resignable state', gameStatus);
            return;
        }
        console.log('[GameControls] handleResign: Opening confirm modal');
        setConfirmModalType('resign'); 
    };
    const handleUseItem = (item: 'hidden' | 'scan' | 'missile') => { 
        console.log('[GameControls] handleUseItem called', { item, gameStatus, gameId });
        if (gameStatus !== 'playing') {
            console.log('[GameControls] handleUseItem: Game status is not playing', gameStatus);
            return;
        }
        const actionType = item === 'hidden' ? 'START_HIDDEN_PLACEMENT' : (item === 'scan' ? 'START_SCANNING' : 'START_MISSILE_SELECTION');
        console.log('[GameControls] handleUseItem: Sending action', actionType);
        const policy = resolveArenaSessionPolicy(session as LiveGameSession);
        const clientSync = policy.requiresClientSyncBeforeAction
            ? buildPveItemActionClientSync(session)
            : undefined;
        onAction({
            type: actionType,
            payload: { gameId, ...(clientSync ? { clientSync } : {}) },
        });
    };

    const pairTurnOrder = session.settings.pairGame?.turnOrder;
    const pairSeatForViewer =
        isPairClassicGame(session.settings, mode) && Array.isArray(pairTurnOrder) && pairTurnOrder.length > 0
            ? pairTurnOrder.find((seat) => pairSeatMatchesViewerUser(seat, currentUser.id))
            : undefined;
    const myPlayerEnum =
        currentUser.id === blackPlayerId
            ? Player.Black
            : currentUser.id === whitePlayerId
              ? Player.White
              : pairSeatForViewer
                ? pairSeatForViewer.player
                : (mode === GameMode.Base || (mode === GameMode.Mix && session.settings.mixedModes?.includes(GameMode.Base))) &&
                    gameStatus === 'base_placement'
                  ? currentUser.id === player1.id
                      ? Player.Black
                      : Player.White
                  : Player.None;
    const opponentPlayerEnum = myPlayerEnum === Player.Black ? Player.White : Player.Black;

    const renderStrategicPetHintSlot = (): React.ReactNode | null => {
        if (isSpectator || !isStrategic || isPairGame) return null;
        const cat = String(session.gameCategory ?? '');
        if (session.isSinglePlayer || cat === 'tower' || cat === 'singleplayer') {
            return null;
        }
        if (isGameEnded) return null;

        const petRow = getEquippedPairPetInventoryRow(currentUser);
        const bs = session.settings.boardSize || 19;
        const totalPly =
            (session.moveHistory || []).filter((m) => m && m.x !== -1 && m.y !== -1).length + 1;
        const phase = pairPetKataPhaseFromTotalPly(bs, totalPly);
        const { remaining: phasePlyRemaining } = pairPetKataPliesRemainingInCurrentPhase(bs, totalPly);
        const used = ((session.settings as { strategicPetHintByUserId?: Record<string, Partial<Record<string, boolean>>> })
            .strategicPetHintByUserId?.[currentUser.id] ?? {}) as Record<string, boolean>;
        const phaseLabel = phase === 'opening' ? t('controls.phaseOpening') : phase === 'midgame' ? t('controls.phaseMidgame') : t('controls.phaseEndgame');
        const phaseCountdownLabel =
            phasePlyRemaining == null ? t('controls.phaseEndgame') : t('controls.phaseMovesLeft', { phase: phaseLabel, count: phasePlyRemaining });

        const canAttempt =
            gameStatus === 'playing' &&
            isMyTurn &&
            myPlayerEnum !== Player.None &&
            !!petRow &&
            !used[phase];

        let titleBody = t('controls.petHintPhaseOnce', { phase: phaseLabel });
        if (!petRow) {
            titleBody = t('controls.petHintEquipPet');
        } else if (gameStatus !== 'playing') {
            titleBody = t('controls.petHintDuringGame');
        } else if (!isMyTurn || myPlayerEnum === Player.None) {
            titleBody = t('controls.petHintMyTurnOnly');
        } else if (used[phase]) {
            titleBody = t('controls.petHintPhaseUsed', { phase: phaseLabel });
        }
        const title =
            phasePlyRemaining != null
                ? t('controls.petHintPhaseRemaining', { phase: phaseLabel, count: phasePlyRemaining, body: titleBody })
                : `${phaseLabel} — ${titleBody}`;

        const img = petRow
            ? ((petRow as { image?: string }).image ??
                  (petRow.templateId ? getPairPetDefinition(petRow.templateId)?.image : null) ??
                  '/images/button/hidden.webp')
            : null;

        const bubble = strategicPetHintFooterBubble;
        const showBubble = Boolean(bubble?.visible && bubble?.message);

        const emptySlotSize = isMobile
            ? 'h-10 w-10 rounded-md'
            : 'h-[3.65rem] w-[3.65rem] rounded-lg min-[1025px]:h-14 min-[1025px]:w-14';

        return (
            <div
                key="pet-hint-slot"
                className={`relative flex shrink-0 flex-col items-center overflow-visible ${isMobile ? 'z-[80]' : 'z-[45]'}`}
            >
                {showBubble && bubble?.message ? (
                    <div
                        className="pointer-events-none absolute bottom-full left-0 z-[81] mb-2"
                        role="status"
                        aria-live="polite"
                    >
                        <div className="relative rounded-xl border border-white/20 bg-black px-3 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.75)] ring-1 ring-white/10 sm:px-4 sm:py-3">
                            <p className="whitespace-nowrap text-sm font-semibold leading-none text-white sm:text-base">
                                {bubble.message}
                            </p>
                            <div
                                className={`absolute top-full -mt-px h-0 w-0 border-x-[7px] border-x-transparent border-t-[8px] border-t-black ${isMobile ? 'left-5' : 'left-7 min-[1025px]:left-7'}`}
                                aria-hidden
                            />
                        </div>
                    </div>
                ) : null}
                {petRow && img ? (
                    <LabeledControlButton
                        key="pet-hint-btn"
                        src={img}
                        alt={t('controls.hint')}
                        imageBottomOverlay={t('controls.hint')}
                        label={phaseCountdownLabel}
                        onClick={() => {
                            if (!canAttempt || petHintBusy) return;
                            setPetHintBusy(true);
                            void Promise.resolve(onAction({ type: 'REQUEST_STRATEGIC_PET_HINT', payload: { gameId } })).finally(() =>
                                setPetHintBusy(false),
                            );
                        }}
                        disabled={!canAttempt || petHintBusy}
                        title={title}
                        compact={isMobile}
                    />
                ) : (
                    <div className={`flex min-w-0 max-w-full flex-col items-center gap-0.5 ${isMobile ? '' : 'min-w-0'}`}>
                        <button
                            type="button"
                            disabled
                            className={`relative flex shrink-0 items-center justify-center border-2 border-dashed border-slate-500/55 bg-slate-950/55 ring-1 ring-inset ring-slate-600/20 ${emptySlotSize}`}
                            title={title}
                            aria-label={t('controls.petHintAriaNoPet', { label: phaseCountdownLabel })}
                        />
                        <span
                            className={`text-center font-semibold leading-none tracking-wide text-slate-500 ${
                                isMobile ? 'max-w-[3.5rem] truncate text-[8px]' : 'whitespace-nowrap text-[10px] min-[1025px]:text-[9px]'
                            }`}
                        >
                            {phaseCountdownLabel}
                        </span>
                    </div>
                )}
            </div>
        );
    };

    // 서버 hasOpponentHiddenScanTargets와 동일: 미공개 히든이 수순에 있고, 영구 공개 전이며, 보드에 상대 돌로 남아 있을 때만 스캔 가능.
    // (aiHiddenItemUsed만으로 true를 주면 전체 공개 후에도 스캔이 켜지는 버그가 난다)
    const canScan = useMemo(() => {
        const board = session.boardState;
        const boardOk =
            Array.isArray(board) &&
            board.length > 0 &&
            board[0] &&
            Array.isArray(board[0]) &&
            board[0].length > 0;

        const isPairHiddenBoard =
            Boolean(session.settings.pairGame?.turnOrder?.length) &&
            (mode === GameMode.Hidden || (mode === GameMode.Mix && (session.settings.mixedModes || []).includes(GameMode.Hidden)));

        const myRevealed = session.revealedHiddenMoves?.[currentUser.id];
        const fromHistory =
            session.hiddenMoves &&
            session.moveHistory &&
            Object.entries(session.hiddenMoves).some(([moveIndexStr, isHidden]) => {
                if (!isHidden) return false;
                const idx = parseInt(moveIndexStr, 10);
                if (myRevealed?.includes(idx)) return false;
                const move = session.moveHistory![idx];
                if (!move || move.player !== opponentPlayerEnum || move.x < 0 || move.y < 0) {
                    return false;
                }
                const { x, y } = move;
                const isPermanentlyRevealed = session.permanentlyRevealedStones?.some((p) => p.x === x && p.y === y);
                if (isPermanentlyRevealed) return false;
                if (boardOk) {
                    const row = board[y];
                    if (!row || x < 0 || x >= row.length) return false;
                    const cell = row[x];
                    if (cell === opponentPlayerEnum) return true;
                    // 페어 히든: 클라가 미공개 히든을 빈칸으로만 받는 경우에도 서버 START_SCANNING과 맞춘다.
                    if (isPairHiddenBoard && cell === Player.None) return true;
                    return false;
                }
                return true;
            });
        if (fromHistory) return true;

        const aiPt = (session as { aiInitialHiddenStone?: { x: number; y: number } }).aiInitialHiddenStone;
        const scannedAiInitialByMe = !!(session as any).scannedAiInitialHiddenByUser?.[currentUser.id];
        if (
            aiPt &&
            typeof aiPt.x === 'number' &&
            typeof aiPt.y === 'number' &&
            aiPt.x >= 0 &&
            aiPt.y >= 0 &&
            (session.isAiGame || session.gameCategory === 'adventure' || session.isSinglePlayer || session.gameCategory === 'tower')
        ) {
            const revealed = session.permanentlyRevealedStones?.some((p) => p.x === aiPt.x && p.y === aiPt.y);
            if (revealed || scannedAiInitialByMe) return false;
            if (boardOk) {
                const row = board[aiPt.y];
                if (!row || aiPt.x < 0 || aiPt.x >= row.length) return false;
                const cell = row[aiPt.x];
                if (cell === opponentPlayerEnum) return true;
                if (isPairHiddenBoard && cell === Player.None) return true;
                return false;
            }
            return true;
        }
        return false;
    }, [
        session.boardState,
        session.hiddenMoves,
        session.moveHistory,
        session.permanentlyRevealedStones,
        session.revealedHiddenMoves,
        session.gameCategory,
        session.isSinglePlayer,
        session.blackPlayerId,
        session.whitePlayerId,
        session.isAiGame,
        session.settings.pairGame,
        session.settings.mixedModes,
        mode,
        opponentPlayerEnum,
        currentUser.id,
        (session as any).scannedAiInitialHiddenByUser,
        (session as { aiInitialHiddenStone?: { x: number; y: number } }).aiInitialHiddenStone,
    ]);
    
    const getLuxuryButtonClasses = (_variant?: 'primary' | 'danger' | 'neutral' | 'accent' | 'success') =>
        arenaPostGameButtonClass('neutral', isMobile, 'strip');
    const endedIngameRowBtn = (extra?: string) =>
        `${getLuxuryButtonClasses()} ${arenaPostGameButtonInRowModifier}${extra ? ` ${extra}` : ''}`;
    /** 대기실·관전 종료 등 퇴장 버튼 */
    const endedIngameLobbyLeaveRowBtn = (extra?: string) =>
        `${arenaPostGameButtonClass('danger', isMobile, 'strip')} ${arenaPostGameButtonInRowModifier}${extra ? ` ${extra}` : ''}`;

    // 아이템 설정값 (함수 외부에서 선언하여 재사용)
    const hiddenCountSetting = session.settings.hiddenStoneCount ?? 0;
    const scanCountSetting = session.settings.scanCount ?? 0;
    const missileCountSetting = session.settings.missileCount ?? 0;

    const renderItemButtons = () => {
        const isHiddenMode = (mode === GameMode.Hidden || (mode === GameMode.Mix && (session.settings.mixedModes || []).includes(GameMode.Hidden))) || (session.isSinglePlayer && hiddenCountSetting > 0);
        // 미사일 모드: 게임 모드가 Missile이거나, 싱글플레이에서 missileCount가 설정된 경우
        const isMissileMode = (mode === GameMode.Missile || (mode === GameMode.Mix && (session.settings.mixedModes || []).includes(GameMode.Missile))) || (session.isSinglePlayer && (missileCountSetting > 0 || (session.settings as any)?.missileCount > 0));
        // 서버 hidden/missile.ts: 흑=p1, 백=p2 (player1/player2와 무관). 페어는 turnOrder로 본인 색을 맞춘다.
        const hiddenLeft =
            myPlayerEnum === Player.Black
                ? (session.hidden_stones_p1 ?? hiddenCountSetting)
                : myPlayerEnum === Player.White
                  ? (session.hidden_stones_p2 ?? hiddenCountSetting)
                  : 0;
        const myScansLeft =
            myPlayerEnum === Player.Black
                ? (session.scans_p1 ?? scanCountSetting)
                : myPlayerEnum === Player.White
                  ? (session.scans_p2 ?? scanCountSetting)
                  : 0;
        const myMissilesLeft =
            myPlayerEnum === Player.Black
                ? (session.missiles_p1 ?? missileCountSetting)
                : myPlayerEnum === Player.White
                  ? (session.missiles_p2 ?? missileCountSetting)
                  : 0;

        const buttons: React.ReactNode[] = [];

        if (isHiddenMode) {
            const hiddenDisabled = !isMyTurn || isSpectator || gameStatus !== 'playing' || hiddenLeft <= 0;
            buttons.push(
                <LabeledControlButton
                    key="hidden"
                    src="/images/button/hidden.webp"
                    alt={t('controls.hidden')}
                    label={t('controls.hidden')}
                    onClick={() => handleUseItem('hidden')}
                    disabled={hiddenDisabled}
                    title={t('controls.hiddenTitle')}
                    count={hiddenLeft}
                    compact={isMobile}
                />
            );

            const scansLeft = myScansLeft ?? 0;
            const scanDisabled = !isMyTurn || isSpectator || gameStatus !== 'playing' || scansLeft <= 0 || !canScan;
            const scanHighlightAdventure = session.gameCategory === 'adventure' && !scanDisabled;
            buttons.push(
                <div
                    key="scan-wrap"
                    className={
                        scanHighlightAdventure
                            ? 'rounded-md p-px ring-2 ring-cyan-400/80 shadow-[0_0_14px_rgba(34,211,238,0.35)] animate-pulse'
                            : undefined
                    }
                >
                    <LabeledControlButton
                        key="scan"
                        src="/images/button/scan.webp"
                        alt={t('controls.scan')}
                        label={t('controls.scan')}
                        onClick={() => handleUseItem('scan')}
                        disabled={scanDisabled}
                        title={t('controls.scanTitle')}
                        count={scansLeft}
                        compact={isMobile}
                    />
                </div>
            );
        }

        if (isMissileMode) {
            const missilesLeft = myMissilesLeft ?? 0;
            const missileDisabled = !isMyTurn || isSpectator || gameStatus !== 'playing' || missilesLeft <= 0;
            buttons.push(
                <LabeledControlButton
                    key="missile"
                    src="/images/button/missile.webp"
                    alt={t('controls.missile')}
                    label={t('controls.missile')}
                    onClick={() => handleUseItem('missile')}
                    disabled={missileDisabled}
                    title={t('controls.missileTitle')}
                    count={missilesLeft}
                    compact={isMobile}
                />
            );
        }

        return buttons;
    };

    // 싱글플레이어에서도 아이템이 있는지 확인
    const hasSinglePlayerItems = session.isSinglePlayer && (hiddenCountSetting > 0 || scanCountSetting > 0 || missileCountSetting > 0);
    
    const hasItems = (mode === GameMode.Hidden || mode === GameMode.Missile) || 
                     (mode === GameMode.Mix && (session.settings.mixedModes || []).some(m => [GameMode.Hidden, GameMode.Missile].includes(m))) ||
                     hasSinglePlayerItems;
    if (isSpectator && !currentUser.isAdmin) return null;

    const usesLeft = (session.maxActionButtonUses ?? 0) - (session.actionButtonUses?.[currentUser.id] ?? 0);
    const maxUses = session.maxActionButtonUses;
    const usesLeftText = (typeof usesLeft === 'number' && typeof maxUses === 'number') ? `(${usesLeft})` : '';
    
    const isRequestingAnalysis = session.isAnalyzing;

    if (isSinglePlayer) {
        const stageId = session.stageId;
        const stagesList = getSinglePlayerStages();
        const currentStageIndex = stageId ? stagesList.findIndex(s => s.id === stageId) : -1;
        const currentStage = stageId ? stagesList.find(s => s.id === stageId) : undefined;
        const nextStage = currentStageIndex >= 0 ? stagesList[currentStageIndex + 1] : undefined;
        /** 베이스/덤 결정 후 유저가 백이 될 수 있다 — 흑=유저 가정 대신 좌석 ID로 본인 색을 판단해 승패를 결정한다. */
        const myUserId = currentUser?.id;
        const myPlayerEnumForWin: Player =
            myUserId && session.blackPlayerId === myUserId
                ? Player.Black
                : myUserId && session.whitePlayerId === myUserId
                  ? Player.White
                  : Player.Black;
        const isWinner = session.winner === myPlayerEnumForWin;
        const clearedStages = (currentUser as { clearedSinglePlayerStages?: string[] }).clearedSinglePlayerStages || [];
        const singlePlayerProgress = (currentUser as { singlePlayerProgress?: number }).singlePlayerProgress ?? 0;
        const isCurrentStageAlreadyCleared =
            currentStageIndex >= 0 &&
            !!stageId &&
            (clearedStages.includes(stageId) || singlePlayerProgress > currentStageIndex);
        const canTryNextStage = !!nextStage && (isWinner || isCurrentStageAlreadyCleared);
        const inferredRetryAp =
            isCurrentStageAlreadyCleared || isWinner ? 0 : (currentStage?.actionPointCost ?? 0);
        const retryActionPointCost =
            session.singlePlayerStartActionPointCost === 0 ? 0 : inferredRetryAp;
        const nextStageIndex = currentStageIndex + 1;
        const isNextStageAlreadyCleared =
            !!nextStage &&
            (clearedStages.includes(nextStage.id) || singlePlayerProgress > nextStageIndex);
        const nextStageActionPointCost = isNextStageAlreadyCleared ? 0 : (nextStage?.actionPointCost ?? 0);

        const refreshCosts = [0, 50, 75, 100, 200];
        const refreshesUsed = session.singlePlayerPlacementRefreshesUsed ?? 0;
        const remainingRefreshes = Math.max(0, 5 - refreshesUsed);
        const costIndex = Math.min(refreshesUsed, refreshCosts.length - 1);
        const nextCost = refreshCosts[costIndex] ?? refreshCosts[refreshCosts.length - 1];
        const moveCount = session.moveHistory?.length ?? 0;
        const isPlayingState = gameStatus === 'playing';
        const currentGold = currentUser.gold ?? 0;
        const placementRefreshAllowed =
            (session.settings as { singlePlayerPlacementRefreshAllowed?: boolean }).singlePlayerPlacementRefreshAllowed !== false &&
            currentStage?.allowPlacementRefresh !== false;
        const canRefreshNow = placementRefreshAllowed && !isGameEnded && isPlayingState && moveCount === 0 && remainingRefreshes > 0;
        const canAffordRefresh = currentGold >= nextCost;
        const isPaused = isSinglePlayerPaused;
        // 미사일 바둑에서 첫 턴에 미사일을 사용한 경우에만 배치변경 비활성화
        const isMissileOnlyMode = missileCountSetting > 0 && hiddenCountSetting === 0 && scanCountSetting === 0;
        const myMissilesLeftForRefresh = session.missiles_p1 ?? missileCountSetting;
        const usedMissileBeforeFirstMove = isMissileOnlyMode && moveCount === 0 && (missileCountSetting - myMissilesLeftForRefresh) > 0;
        const refreshDisabled = !canRefreshNow || !canAffordRefresh || isPaused || usedMissileBeforeFirstMove;

        let refreshHelperMessage = '';
        if (!placementRefreshAllowed) {
            refreshHelperMessage = t('placementRefresh.notAllowedStage');
        } else if (usedMissileBeforeFirstMove) {
            refreshHelperMessage = t('placementRefresh.missileFirstTurn');
        } else if (remainingRefreshes <= 0) {
            refreshHelperMessage = t('placementRefresh.noRefreshesLeft');
        } else if (!isPlayingState) {
            refreshHelperMessage = t('placementRefresh.waitForStart');
        } else if (moveCount > 0) {
            refreshHelperMessage = t('placementRefresh.beforeFirstMove');
        } else if (!canAffordRefresh) {
            refreshHelperMessage = t('placementRefresh.insufficientGold');
        } else if (isPaused) {
            refreshHelperMessage = t('placementRefresh.paused');
        }

        const handleRefreshClick = () => {
            if (refreshDisabled) {
                if (refreshHelperMessage) window.alert(refreshHelperMessage);
                return;
            }
            const confirmationMessage = nextCost > 0
                ? t('placementRefresh.confirmPaid', { gold: formatGoldAmountKoG(nextCost), remaining: remainingRefreshes })
                : t('placementRefresh.confirmFree');
            if (window.confirm(confirmationMessage)) {
                onAction({ type: 'SINGLE_PLAYER_REFRESH_PLACEMENT', payload: { gameId } } as ServerAction);
            }
        };

        const canResign = isGameActive && !isSpectator && !isGameEnded && !isPaused;
        const handleResignClick = () => {
            if (gameStatus === 'scoring') {
                window.alert(t('controls.cannotResignDuringScoring'));
                return;
            }
            if (!canResign) {
                if (isPaused) {
                    window.alert(t('controls.cannotResignWhilePaused'));
                } else if (!isGameActive && !isGameEnded) {
                    window.alert(t('controls.cannotResignBeforeStart'));
                }
                return;
            }
            const pairHumanResign = isPairHumanHumanPvpForTeamResign(session);
            const confirmMsg = pairHumanResign
                ? t('controls.confirmPairTeamResign')
                : t('controls.confirmResign');
            if (window.confirm(confirmMsg)) {
                onAction(
                    pairHumanResign
                        ? ({ type: 'REQUEST_PAIR_TEAM_RESIGN', payload: { gameId } } as ServerAction)
                        : ({ type: 'RESIGN_GAME', payload: { gameId } } as ServerAction),
                );
            }
        };

        const handleRetry = () => {
            if (stageId) {
                onAction({ type: 'START_SINGLE_PLAYER_GAME', payload: { stageId } });
            }
        };

        const handleNextStage = () => {
            if (canTryNextStage && nextStage) {
                onAction({ type: 'START_SINGLE_PLAYER_GAME', payload: { stageId: nextStage.id } });
            }
        };

        const handleCloseResults = () => {
            onDismissGameSummary?.();
            setShowResultModal(false);

            // 게임 종류에 따라 적절한 로비/대기실로 라우팅 (전략/놀이 대기실 AI를 먼저 판별해 싱글·탑으로 잘못 나가는 버그 방지)
            let redirectHash: string | null = null;

            if (session.gameCategory === 'guildwar') {
                redirectHash = '#/guildwar';
            } else if (session.gameCategory === 'tower') {
                redirectHash = '#/tower';
            } else if (session.settings?.pairGame) {
                redirectHash = arenaLobbyHashFromSession(session);
                const rid = session.settings.pairGame?.roomId;
                if (rid) {
                    try {
                        sessionStorage.setItem(POST_GAME_PAIR_ROOM_RESTORE_SESSION_KEY, rid);
                        sessionStorage.setItem(PAIR_LOBBY_FOCUS_ROOM_TAB_SESSION_KEY, '1');
                    } catch {
                        /* ignore */
                    }
                }
            } else if (session.isAiGame && (SPECIAL_GAME_MODES.some(m => m.mode === session.mode) || PLAYFUL_GAME_MODES.some(m => m.mode === session.mode))) {
                redirectHash = arenaLobbyHashFromSession(session);
            } else if (session.gameCategory === 'singleplayer' || session.isSinglePlayer) {
                redirectHash = '#/singleplayer';
            } else {
                redirectHash = arenaLobbyHashFromSession(session);
            }

            if (redirectHash) {
                sessionStorage.setItem('postGameRedirect', redirectHash);
            }

            const actionType = session.isAiGame ? 'LEAVE_AI_GAME' : 'LEAVE_GAME_ROOM';
            onAction({ type: actionType as any, payload: { gameId } });
        };

        if (isGameEnded) {
            const handleShowResults = () => {
                setShowResultModal(true);
            };

            return (
                <>
                <footer className={`${arenaGameRoomControlsFooterClass} ${pveIngameFooterReservedHeightClass(!!isMobile)}`}>
                    <div className={arenaPostGamePanelShellClass}>
                        <div className={arenaPostGameIngameEndedRowClass}>
                        <Button
                            bare
                            onClick={handleShowResults}
                            colorScheme="none"
                            className={endedIngameRowBtn()}
                            disabled={blockPostGameFooter && showResultModal}
                        >
                            결과 보기
                        </Button>
                        <Button
                            bare
                            onClick={handleNextStage}
                            colorScheme="none"
                            className={endedIngameRowBtn('min-w-0 truncate')}
                            disabled={blockPostGameFooter || !canTryNextStage}
                        >
                            {formatSinglePlayerNextFooterLabel(nextStage, canTryNextStage, nextStageActionPointCost)}
                        </Button>
                        <Button bare onClick={handleRetry} colorScheme="none" className={endedIngameRowBtn()} disabled={blockPostGameFooter}>
                            {formatArenaRetryLabel(retryActionPointCost)}
                        </Button>
                        {isPvpRematchEligible && (
                            <Button
                                bare
                                onClick={() => {
                                    setIsRematchModalOpen(true);
                                    if (!rematchRequested) {
                                        void Promise.resolve(
                                            onAction({
                                                type: 'REQUEST_REMATCH',
                                                payload: { opponentId: rematchTarget.id, originalGameId: session.id },
                                            } as any)
                                        );
                                    }
                                }}
                                disabled={blockPostGameFooter || rematchRequested}
                                colorScheme="none"
                                className={endedIngameRowBtn()}
                            >
                                {rematchRequested ? t('controls.rematchApplying') : t('controls.rematch')}
                            </Button>
                        )}
                        {showAiLobbyRematchButton && (
                            <Button
                                bare
                                onClick={onOpenRematchSettings}
                                colorScheme="none"
                                className={endedIngameRowBtn()}
                                disabled={blockPostGameFooter}
                            >
                                {formatAiRematchFooterLabel(aiLobbyRematchActionPointCostLabel)}
                            </Button>
                        )}
                        <Button bare onClick={handleCloseResults} colorScheme="none" className={endedIngameLobbyLeaveRowBtn()} disabled={blockPostGameFooter}>
                            대기실로
                        </Button>
                        </div>
                    </div>
                </footer>
                {isRematchModalOpen && isPvpRematchEligible && rematchTarget && (
                    <ChallengeSelectionModal
                        opponent={rematchTarget as any}
                        onClose={() => setIsRematchModalOpen(false)}
                        negotiations={Object.values(negotiations)}
                        currentUser={currentUser as any}
                        lobbyType={SPECIAL_GAME_MODES.some(m => m.mode === session.mode) ? 'strategic' : 'playful'}
                        onChallenge={async (_gameMode, rematchSettings) => {
                            try {
                                const findDraft = () =>
                                    Object.values(negotiations || {}).find((n: any) =>
                                        n?.challenger?.id === currentUser.id &&
                                        n?.opponent?.id === rematchTarget.id &&
                                        n?.status === 'draft' &&
                                        n?.rematchOfGameId === session.id
                                    ) as any;
                                const draftNow = findDraft();
                                if (draftNow?.id) {
                                    await Promise.resolve(onAction({ type: 'SEND_CHALLENGE', payload: { negotiationId: draftNow.id, settings: rematchSettings } } as any));
                                    return;
                                }
                                await Promise.resolve(onAction({ type: 'REQUEST_REMATCH', payload: { opponentId: rematchTarget.id, originalGameId: session.id } } as any));
                                setTimeout(() => {
                                    const draft = findDraft();
                                    if (draft?.id) {
                                        void Promise.resolve(onAction({ type: 'SEND_CHALLENGE', payload: { negotiationId: draft.id, settings: rematchSettings } } as any));
                                    }
                                }, 300);
                            } catch (err) {
                                console.error('[GameControls] Rematch challenge failed:', err);
                            }
                        }}
                    />
                )}
                </>
            );
        }

        // 싱글플레이어 아이템 로직
        const isHiddenMode = session.isSinglePlayer && hiddenCountSetting > 0;
        const isMissileMode = session.isSinglePlayer && missileCountSetting > 0;
        const p1Id = session.player1.id;
        // 히든 아이템 (스캔 아이템처럼 개수 기반)
        const hiddenLeft = currentUser.id === p1Id 
            ? (session.hidden_stones_p1 ?? hiddenCountSetting)
            : (session.hidden_stones_p2 ?? hiddenCountSetting);
        const myScansLeft = currentUser.id === p1Id ? (session.scans_p1 ?? scanCountSetting) : (session.scans_p2 ?? scanCountSetting);
        const myMissilesLeft = currentUser.id === p1Id ? (session.missiles_p1 ?? missileCountSetting) : (session.missiles_p2 ?? missileCountSetting);

        const itemColClass = isMobile ? 'flex flex-col items-center gap-1 shrink-0' : 'flex flex-col items-center gap-2';
        const labelClass = isMobile ? 'text-[10px] text-amber-200 font-semibold tracking-wide' : 'text-[11px] text-amber-200 font-semibold tracking-wide';

        const coreControls = (
            <>
                <div className={itemColClass}>
                    <ImageButton
                        src="/images/button/giveup.webp"
                        alt={t('controls.resignAlt')}
                        title={gameStatus === 'scoring' ? t('controls.cannotResignDuringScoring') : t('controls.resignTitle')}
                        onClick={handleResignClick}
                        disabled={!canResign || gameStatus === 'scoring'}
                        variant="danger"
                        compact={isMobile}
                    />
                    <span className={`${isMobile ? 'text-[10px]' : 'text-[11px]'} text-red-300 font-semibold tracking-wide`}>{t('controls.resign')}</span>
                </div>
                <div className={itemColClass}>
                    <ImageButton
                        src="/images/button/reflesh.webp"
                        alt={t('controls.stoneRefreshTitle')}
                        title={placementRefreshAllowed ? t('controls.stoneRefreshTitle') : t('placementRefresh.notAllowedStage')}
                        onClick={handleRefreshClick}
                        disabled={refreshDisabled}
                        compact={isMobile}
                    />
                    <span className={`${labelClass} flex items-center gap-0.5 justify-center whitespace-nowrap`}>
                        {remainingRefreshes}/5
                        {nextCost > 0 && (
                            <>
                                <span>·</span>
                                <img src="/images/icon/Gold.webp" alt={t('controls.goldAlt')} className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                                <span>{formatGoldAmountKoG(nextCost)}</span>
                            </>
                        )}
                        {nextCost === 0 && <span>· {t('lobby:adventure.free')}</span>}
                    </span>
                </div>
            </>
        );

        const itemControls = (
            <>
                {isHiddenMode && (
                    <div className={itemColClass}>
                        <ImageButton
                            src="/images/button/hidden.webp"
                            alt={t('controls.hidden')}
                            title={t('controls.hiddenPlaceTitle')}
                            onClick={() => handleUseItem('hidden')}
                            disabled={!isMyTurn || gameStatus !== 'playing' || hiddenLeft <= 0}
                            count={hiddenLeft > 0 ? hiddenLeft : undefined}
                            compact={isMobile}
                        />
                        <span className={labelClass}>{t('controls.hidden')}</span>
                    </div>
                )}
                {isHiddenMode && (
                    <div className={itemColClass}>
                        <ImageButton
                            src="/images/button/scan.webp"
                            alt={t('controls.scan')}
                            title={t('controls.scanDetectTitle')}
                            onClick={() => handleUseItem('scan')}
                            disabled={!isMyTurn || gameStatus !== 'playing' || myScansLeft <= 0 || !canScan}
                            count={myScansLeft > 0 ? myScansLeft : undefined}
                            compact={isMobile}
                        />
                        <span className={labelClass}>{t('controls.scan')}</span>
                    </div>
                )}
                {isMissileMode && (
                    <div className={itemColClass}>
                        <ImageButton
                            src="/images/button/missile.webp"
                            alt={t('controls.missile')}
                            title={t('controls.missileLaunchTitle')}
                            onClick={() => handleUseItem('missile')}
                            disabled={!isMyTurn || gameStatus !== 'playing' || myMissilesLeft <= 0}
                            count={myMissilesLeft > 0 ? myMissilesLeft : undefined}
                            compact={isMobile}
                        />
                        <span className={labelClass}>{t('controls.missile')}</span>
                    </div>
                )}
            </>
        );

        return (
            <footer className={`${arenaGameRoomControlsFooterClass} ${pveIngameFooterReservedHeightClass(!!isMobile)}`}>
                <div
                    className={`${arenaGameRoomSinglePlayerOuterBarClass} w-full ${
                        isMobile && (isHiddenMode || isMissileMode)
                            ? 'flex min-w-0 flex-row items-stretch gap-1.5 px-2 py-2'
                            : isMobile
                              ? 'px-2 py-2'
                              : 'flex min-w-0 flex-row items-center gap-5 px-3 py-2 min-[1025px]:gap-6 min-[1025px]:px-2.5 min-[1025px]:py-1.5'
                    }`}
                >
                    {isMobile && (isHiddenMode || isMissileMode) ? (
                        <>
                            <div className={arenaGameRoomSinglePlayerSplitPanelClass}>
                                <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                                    <ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-2.5">
                                        {coreControls}
                                    </ArenaControlStrip>
                                </div>
                            </div>
                            <div className={`${arenaGameRoomControlsDividerClass} mx-1 w-0.5`} aria-hidden />
                            <div className={arenaGameRoomSinglePlayerSplitPanelAccentClass}>
                                <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                                    <ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-2.5">
                                        {itemControls}
                                    </ArenaControlStrip>
                                </div>
                            </div>
                        </>
                    ) : isMobile ? (
                        <div className="flex w-full min-w-0 justify-center">
                            <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-4">
                                {coreControls}
                            </ArenaControlStrip>
                        </div>
                    ) : (
                        <>
                            <div
                                className={`flex min-w-0 items-center justify-center ${isHiddenMode || isMissileMode ? 'flex-1' : 'w-full'}`}
                            >
                                <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-5 min-[1025px]:gap-6">
                                    {coreControls}
                                </ArenaControlStrip>
                            </div>
                            {(isHiddenMode || isMissileMode) && (
                                <>
                                    <div className={`${arenaGameRoomControlsDividerClass} h-12 w-px min-[1025px]:h-9`} />
                                    <div className="flex min-w-0 flex-1 items-center justify-center">
                                        <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-4 min-[1025px]:gap-5">
                                            {itemControls}
                                        </ArenaControlStrip>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </footer>
        );
    }

    const isAdventureGame = session.gameCategory === 'adventure';

    const dockMoveConfirmFooter = !isGameEnded && showMoveConfirmFooter && !isSpectator && !!onMobileConfirmToggle;
    /** 계가·대기 등에서 슬롯 UI는 숨기되, 진행 중과 동일한 중앙 폭을 유지해 바둑판 가로 배분이 변하지 않게 함 */
    const isPlayfulModeFooter = PLAYFUL_GAME_MODES.some((m) => m.mode === mode);
    const footerStatusesHideMoveReserve: GameStatus[] = ['ended', 'no_contest', 'rematch_pending', 'disconnected', 'chess_piece_placement'];
    const reserveMoveConfirmFooterColumn =
        settings.features.moveConfirmButtonBox &&
        !!onMobileConfirmToggle &&
        !isSpectator &&
        !isPlayfulModeFooter &&
        !footerStatusesHideMoveReserve.includes(gameStatus);

    const primaryControlsInner = (
        <>
            {isGameEnded ? (
                isAdventureGame ? (
                    <>
                        <Button
                            bare
                            onClick={() => {
                                if (showResultModal) {
                                    onDismissGameSummary?.();
                                } else {
                                    setShowResultModal(true);
                                }
                            }}
                            colorScheme="none"
                            className={endedIngameRowBtn()}
                            disabled={blockPostGameFooter && showResultModal}
                        >
                            {showResultModal ? t('common:actions.confirm') : t('controls.viewResult')}
                        </Button>
                        {onLeaveOrResign && (
                            <Button
                                bare
                                onClick={onLeaveOrResign}
                                colorScheme="none"
                                className={endedIngameLobbyLeaveRowBtn()}
                                disabled={blockPostGameFooter}
                            >
                                {t('controls.goToMap')}
                            </Button>
                        )}
                        {showStrategicGameRecordActions && (
                            <>
                                {onAction && (
                                    <Button
                                        bare
                                        onClick={async () => {
                                            if (savingGameRecord || recordAlreadySaved) return;
                                            if (savedRecordCount >= 10) {
                                                alert(GAME_RECORD_SLOT_FULL_MESSAGE);
                                                return;
                                            }
                                            setSavingGameRecord(true);
                                            try {
                                                const out = await onAction({
                                                    type: 'SAVE_GAME_RECORD',
                                                    payload: { gameId, sessionSnapshot: session },
                                                });
                                                const saveErr =
                                                    out && typeof out === 'object' && 'error' in out
                                                        ? (out as { error?: string }).error
                                                        : undefined;
                                                if (saveErr) {
                                                    alert(saveErr);
                                                    return;
                                                }
                                                setSavedOptimistic(true);
                                            } catch (e) {
                                                console.error(e);
                                            } finally {
                                                setSavingGameRecord(false);
                                            }
                                        }}
                                        disabled={blockPostGameFooter || savingGameRecord || recordAlreadySaved}
                                        colorScheme="none"
                                        className={`${endedIngameRowBtn()} ${recordAlreadySaved ? 'opacity-50' : ''}`}
                                    >
                                        {savingGameRecord ? t('controls.savingRecord') : recordAlreadySaved ? t('controls.recordAlreadySaved') : t('controls.saveRecord')}
                                    </Button>
                                )}
                                {onOpenGameRecordList && (
                                    <Button
                                        bare
                                        onClick={() => onOpenGameRecordList()}
                                        colorScheme="none"
                                        className={endedIngameRowBtn()}
                                        disabled={blockPostGameFooter}
                                    >
                                        {t('controls.manageRecords')}
                                    </Button>
                                )}
                            </>
                        )}
                    </>
                ) : (
                <>
                    <Button
                        bare
                        onClick={() => setShowResultModal(true)}
                        colorScheme="none"
                        className={endedIngameRowBtn()}
                        disabled={blockPostGameFooter && showResultModal}
                    >
                        결과 보기
                    </Button>
                    {showAiLobbyRematchButton && (
                        <Button
                            bare
                            onClick={onOpenRematchSettings}
                            colorScheme="none"
                            className={endedIngameRowBtn()}
                            disabled={blockPostGameFooter}
                        >
                            {formatAiRematchFooterLabel(aiLobbyRematchActionPointCostLabel)}
                        </Button>
                    )}
                    {onLeaveOrResign && (
                        <Button
                            bare
                            onClick={onLeaveOrResign}
                            colorScheme="none"
                            className={endedIngameLobbyLeaveRowBtn()}
                            disabled={blockPostGameFooter}
                        >
                            {isSpectator ? t('controls.endSpectating') : t('controls.returnToLobby')}
                        </Button>
                    )}
                    {showStrategicGameRecordActions && (
                        <>
                            {onAction && (
                                <Button
                                    bare
                                    onClick={async () => {
                                        if (savingGameRecord || recordAlreadySaved) return;
                                        if (savedRecordCount >= 10) {
                                            alert(GAME_RECORD_SLOT_FULL_MESSAGE);
                                            return;
                                        }
                                        setSavingGameRecord(true);
                                        try {
                                            const out = await onAction({
                                                type: 'SAVE_GAME_RECORD',
                                                payload: { gameId, sessionSnapshot: session },
                                            });
                                            const saveErr =
                                                out && typeof out === 'object' && 'error' in out
                                                    ? (out as { error?: string }).error
                                                    : undefined;
                                            if (saveErr) {
                                                alert(saveErr);
                                                return;
                                            }
                                            setSavedOptimistic(true);
                                        } catch (e) {
                                            console.error(e);
                                        } finally {
                                            setSavingGameRecord(false);
                                        }
                                    }}
                                    disabled={blockPostGameFooter || savingGameRecord || recordAlreadySaved}
                                    colorScheme="none"
                                    className={`${endedIngameRowBtn()} ${recordAlreadySaved ? 'opacity-50' : ''}`}
                                >
                                    {savingGameRecord ? t('controls.savingRecord') : recordAlreadySaved ? t('controls.recordAlreadySaved') : t('controls.saveRecord')}
                                </Button>
                            )}
                            {onOpenGameRecordList && (
                                <Button
                                    bare
                                    onClick={() => onOpenGameRecordList()}
                                    colorScheme="none"
                                    className={endedIngameRowBtn()}
                                    disabled={blockPostGameFooter}
                                >
                                    기보 관리
                                </Button>
                            )}
                        </>
                    )}
                </>
                )
            ) : (
                <>
                    {isStrategic &&
                        !hasCaptureRule &&
                        session.mode !== GameMode.Castle &&
                        (!isAiLobbyGame || isPairHumanPvp) &&
                        !isPairAiAutoScoringMatch &&
                        (!isPairGame || isPairHumanPvp) &&
                        !hidePassForFixedScoringTurnLimit &&
                        session.gameCategory !== 'adventure' && (
                        <LabeledControlButton
                            key="pass"
                            src="/images/button/pass.webp"
                            alt={t('controls.passLabel')}
                            label={t('controls.passLabel')}
                            onClick={handlePass}
                            disabled={!isMyTurn || isSpectator || isPreGame}
                            title={t('controls.passTitle')}
                            compact={isMobile}
                        />
                    )}
                    {renderStrategicPetHintSlot()}
                    <LabeledControlButton
                        key="resign"
                        src="/images/button/giveup.webp"
                        alt={t('resign')}
                        label={t('resign')}
                        onClick={handleResign}
                        disabled={isSpectator || isGameEnded || gameStatus === 'pending' || gameStatus === 'scoring'}
                        title={gameStatus === 'scoring' ? t('controls.cannotResignDuringScoring') : t('controls.resignTitle')}
                        variant="danger"
                        compact={isMobile}
                    />
                </>
            )}
        </>
    );

    const moveConfirmCenterBody =
        reserveMoveConfirmFooterColumn && onMobileConfirmToggle ? (
            dockMoveConfirmFooter ? (
                <MoveConfirmFooterSlot
                    key="move-confirm-footer"
                    layout="online"
                    compact={!!isMobile}
                    withCenterPanel
                    pendingMove={pendingMove}
                    mobileConfirm={settings.features.mobileConfirm}
                    onConfirmMove={onConfirmMove}
                    onMobileConfirmToggle={onMobileConfirmToggle}
                />
            ) : (
                <MoveConfirmFooterReservePlaceholder
                    key="move-confirm-reserve"
                    layout="online"
                    compact={!!isMobile}
                    withCenterPanel
                />
            )
        ) : null;

    const specialControlsInner = isGameEnded
        ? null
        : isStrategic
          ? (() => {
                const itemButtons = renderItemButtons();
                if (!hasItems) return null;
                if (itemButtons.length === 0) {
                    return <span className={`text-slate-500 ${isMobile ? 'text-[9px] shrink-0' : 'text-[10px]'}`}>{t('controls.noFeaturesAvailable')}</span>;
                }
                return itemButtons;
            })()
          : mode === GameMode.Dice
            ? (
                  <DicePanel session={session} isMyTurn={isMyTurn} onAction={onAction} currentUser={currentUser} variant="itemsOnly" footerCompact={isMobile} />
              )
            : mode === GameMode.Thief
              ? (
                    <ThiefPanel session={session} isMyTurn={isMyTurn} onAction={onAction} currentUser={currentUser} variant="itemsOnly" footerCompact={isMobile} />
                )
              : mode === GameMode.Curling
                ? <CurlingItemPanel session={session} isMyTurn={isMyTurn} onAction={onAction} currentUser={currentUser} compact={isMobile} />
                : mode === GameMode.Alkkagi
                  ? <AlkkagiItemPanel session={session} isMyTurn={isMyTurn} onAction={onAction} currentUser={currentUser} compact={isMobile} />
                  : (
                        <PlayfulStonesPanel session={session} currentUser={currentUser} />
                    );

    return (
        <footer
            className={`${arenaGameRoomControlsFooterCompactClass} ${isMobile ? '!gap-0.5 !p-0.5' : ''} ${isMobilePairGame ? '' : onlineGameControlsCompactFooterMinHeightClass(!!isMobile)}`}
        >
            {/* Row 1: 매너 액션 — 팀 간 경쟁(PvP)에서만. 2인 페어 AI 협동전에서는 비표시(모바일도 동일). */}
            {showMannerActionRow ? (
                <div
                    className={`flex w-full min-w-0 min-h-[2.2rem] flex-row items-center py-0.5 ${arenaGameRoomControlsInnerPanelClass} ${
                        isMobile ? 'gap-1 sm:min-h-[2.35rem]' : 'gap-2 min-[1025px]:gap-1.5 min-[1025px]:min-h-[2.35rem]'
                    }`}
                >
                    <h3 className={`shrink-0 font-bold whitespace-nowrap text-slate-400 ${isMobile ? 'text-[8px]' : 'text-[11px] min-[1025px]:text-[10px]'}`}>
                        {t('controls.mannerAction')} {usesLeftText}
                    </h3>
                    <div className="min-w-0 flex-1">
                        <ActionButtonsPanel session={session} isSpectator={isSpectator} onAction={onAction} currentUser={currentUser} isMobile={isMobile} />
                    </div>
                </div>
            ) : showMannerAiLobbyHintRow ? (
                <div className={`${arenaGameRoomControlsInnerPanelClass} flex flex-row items-center justify-center gap-3 w-full min-w-0 min-[1025px]:py-0.5 min-[1025px]:px-1`}>
                    <p className="text-[11px] min-[1025px]:text-[10px] text-slate-500 italic whitespace-nowrap truncate">{t('controls.mannerActionPvpOnly')}</p>
                </div>
            ) : null}

            {/* Row 2: Game and Special/Playful Functions */}
            {showBaseGameFooterStrip ? (
                <div className={`flex w-full min-w-0 flex-col gap-0.5 py-0.5 ${arenaGameRoomControlsInnerPanelClass}`}>
                    {gameStatus === 'base_placement' && !isSpectator ? (
                        <div className="flex w-full min-w-0 min-h-[2.35rem] flex-row items-center justify-center px-1 min-[1025px]:min-h-[2.1rem] min-[1025px]:px-1.5">
                            <ArenaControlStrip layout="cluster" className="max-w-full min-w-0" gapClass="gap-1 min-[1025px]:gap-2">
                                <BasePlacementControlStrip
                                    session={session}
                                    currentUser={currentUser}
                                    onAction={onAction}
                                    isMobile={isMobile}
                                    isSinglePlayer={basePregameSpStyleChrome}
                                />
                            </ArenaControlStrip>
                        </div>
                    ) : null}
                    <BaseGameFooterPanel
                        session={session}
                        currentUser={currentUser}
                        onAction={onAction}
                        isMobile={isMobile}
                        isSinglePlayer={basePregameSpStyleChrome}
                        hideBasePlacementActions={gameStatus === 'base_placement' && !isSpectator}
                    />
                </div>
            ) : isMobile ? (
                isGameEnded ? (
                    <div
                        className={`flex ${isMobilePairGame ? 'min-h-[2.35rem]' : 'min-h-[3.5rem]'} w-full min-w-0 items-center justify-center ${arenaGameRoomControlsInnerPanelClass}`}
                    >
                        <div className={`${arenaPostGameIngameEndedRowClass} max-w-full`}>{primaryControlsInner}</div>
                    </div>
                ) : (
                    <>
                    {/* overflow-visible: 펫 힌트 말풍선(bottom-full)이 위로 나가도 잘리지 않게 함(모바일) */}
                    <div className={`flex w-full min-w-0 max-w-full overflow-visible ${isMobilePairGame ? 'gap-1' : 'gap-2'}`}>
                        <div className={`flex ${isMobilePairGame ? 'min-h-[2.35rem] !p-0.5' : 'min-h-[3.5rem]'} min-w-0 flex-1 flex-col justify-center overflow-visible ${arenaGameRoomControlsInnerPanelClass}`}>
                            <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-visible">
                                <ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass={isMobilePairGame ? 'gap-1' : 'gap-1.5 sm:gap-2'}>
                                    {primaryControlsInner}
                                </ArenaControlStrip>
                            </div>
                        </div>
                        {moveConfirmCenterBody ? (
                            <>
                                <div className={`${arenaGameRoomControlsDividerClass} w-0.5 shrink-0`} aria-hidden />
                                <div className="flex shrink-0 flex-col justify-center self-stretch overflow-visible px-0.5">
                                    {moveConfirmCenterBody}
                                </div>
                            </>
                        ) : null}
                        <div className={`${arenaGameRoomControlsDividerClass} w-0.5 shrink-0`} aria-hidden />
                        <div className={`flex ${isMobilePairGame ? 'min-h-[2.35rem] !p-0.5' : 'min-h-[3.5rem]'} min-w-0 flex-1 flex-col justify-center overflow-visible ${arenaGameRoomControlsInnerPanelAccentClass}`}>
                            <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-visible">
                                <ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass={isMobilePairGame ? 'gap-1' : 'gap-1.5 sm:gap-2'}>
                                    {specialControlsInner}
                                </ArenaControlStrip>
                            </div>
                        </div>
                    </div>
                    </>
                )
            ) : isGameEnded ? (
                <div
                    className={`flex min-h-[3.85rem] w-full min-w-0 items-center justify-center ${arenaGameRoomControlsInnerPanelClass}`}
                >
                    <div className={`${arenaPostGameIngameEndedRowClass} max-w-full`}>{primaryControlsInner}</div>
                </div>
            ) : (
                <div className="flex w-full min-w-0 flex-row gap-1.5 min-[1025px]:gap-1">
                    <div className={`flex min-w-0 flex-1 flex-col gap-0.5 min-[1025px]:gap-0 ${arenaGameRoomControlsInnerPanelClass} min-[1025px]:!p-1`}>
                        <h3 className={`${arenaGameRoomControlsSectionTitleClass} min-[1025px]:text-[9px] leading-none`}>{t('controls.gameFeatures')}</h3>
                        <div className="flex min-h-[2.65rem] w-full min-w-0 flex-1 items-center justify-center min-[1025px]:min-h-[2.1rem]">
                            <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-4 min-[1025px]:gap-5">
                                {primaryControlsInner}
                            </ArenaControlStrip>
                        </div>
                    </div>
                    {moveConfirmCenterBody ? (
                        <>
                            <div className={`${arenaGameRoomControlsDividerClass} w-0.5 shrink-0 self-stretch`} aria-hidden />
                            <div className="flex min-w-0 shrink-0 flex-col items-stretch justify-center gap-0.5 self-stretch min-[1025px]:px-0.5">
                                <h3
                                    className={`${arenaGameRoomControlsSectionTitleClass} min-[1025px]:text-[9px] leading-none text-emerald-200/90 ${
                                        dockMoveConfirmFooter ? '' : 'invisible'
                                    }`}
                                >
                                    {t('confirmMove')}
                                </h3>
                                <div className="flex min-h-[2.65rem] flex-1 items-center justify-center min-[1025px]:min-h-[2.1rem]">
                                    {moveConfirmCenterBody}
                                </div>
                            </div>
                            <div className={`${arenaGameRoomControlsDividerClass} w-0.5 shrink-0 self-stretch`} aria-hidden />
                        </>
                    ) : null}
                    <div className={`flex min-w-0 flex-1 flex-col gap-0.5 min-[1025px]:gap-0 ${arenaGameRoomControlsInnerPanelAccentClass} min-[1025px]:!p-1`}>
                        <h3 className={`${arenaGameRoomControlsSectionTitleClass} min-[1025px]:text-[9px] leading-none`}>{isStrategic ? t('controls.specialFeatures') : t('controls.playfulFeatures')}</h3>
                        <div className="flex min-h-[2.65rem] w-full min-w-0 flex-1 items-center justify-center min-[1025px]:min-h-[2.1rem]">
                            <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-4 min-[1025px]:gap-5">
                                {specialControlsInner}
                            </ArenaControlStrip>
                        </div>
                    </div>
                </div>
            )}
             {/* Admin Controls */}
            {isSpectator && currentUser.isAdmin && isGameActive && (
                <div className={arenaGameRoomControlsAdminBarClass}>
                    <h3 className="shrink-0 whitespace-nowrap text-xs font-bold text-violet-300/95 tracking-wide">{t('controls.adminFeatures')}</h3>
                    <div className="flex min-w-0 flex-1 items-center justify-center">
                        <ArenaControlStrip layout="cluster" gapClass={isMobile ? 'gap-2' : 'gap-2.5'}>
                        <Button
                            bare
                            onClick={() => {
                                if (window.confirm(t('controls.adminForceResignConfirm', { name: player1.nickname }))) {
                                    onAction({ type: 'ADMIN_FORCE_WIN', payload: { gameId, winnerId: player1.id } })
                                }
                            }}
                            colorScheme="none"
                            className={getLuxuryButtonClasses('primary')}
                        >
                            {t('controls.adminForceResign', { name: player1.nickname })}
                        </Button>
                        <Button
                            bare
                            onClick={() => {
                                 if (window.confirm(t('controls.adminForceResignConfirm', { name: player2.nickname }))) {
                                    onAction({ type: 'ADMIN_FORCE_WIN', payload: { gameId, winnerId: player2.id } })
                                 }
                            }}
                            colorScheme="none"
                            className={getLuxuryButtonClasses('primary')}
                        >
                            {t('controls.adminForceResign', { name: player2.nickname })}
                        </Button>
                        </ArenaControlStrip>
                    </div>
                </div>
            )}
            <IngameMobileFooterAd isMobile={!!isMobile} />
        </footer>
    );
};

export default GameControls;