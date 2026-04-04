import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { useGameRecordSaveLock } from '../../hooks/useGameRecordSaveLock.js';
import { GameMode, LiveGameSession, ServerAction, GameProps, Player, User, Point, GameStatus, AppSettings } from '../../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants';
import { canSaveStrategicPvpGameRecord, GAME_RECORD_SLOT_FULL_MESSAGE } from '../../utils/strategicPvpGameRecord.js';
import { SINGLE_PLAYER_STAGES } from '../../constants/singlePlayerConstants.js';
import Button from '../Button.js';
import Dice from '../Dice.js';
import { audioService } from '../../services/audioService.js';
import ChallengeSelectionModal from '../ChallengeSelectionModal.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { ArenaControlStrip, ArenaFixedColsGrid } from './ArenaControlStrip.js';

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
}

/** 모바일에서 아이콘을 가리지 않도록 버튼 밖 모서리(우하단)에 배치 */
const ItemCountBadge: React.FC<{ count: number; disabled?: boolean }> = ({ count, disabled = false }) => (
    <span
        className={`pointer-events-none absolute -bottom-1 -right-1 z-[3] flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-md border border-gray-900/90 bg-gray-950/95 px-1 text-[10px] font-bold leading-none text-white shadow-md tabular-nums ${disabled ? 'opacity-60' : ''}`}
    >
        {count > 99 ? '99+' : count}
    </span>
);

const CountOverlay: React.FC<{ count: number; disabled?: boolean; children: React.ReactNode }> = ({ count, disabled = false, children }) => (
    <div className="relative inline-flex shrink-0">
        {children}
        <ItemCountBadge count={count} disabled={disabled} />
    </div>
);

const ImageButton: React.FC<ImageButtonProps> = ({ src, alt, onClick, disabled = false, title, variant = 'primary', count, compact = false }) => {
    const variantClasses = variant === 'danger'
        ? 'border-red-400 shadow-red-500/40 focus:ring-red-400'
        : 'border-amber-400 shadow-amber-500/30 focus:ring-amber-300';
    const sizeClass = compact
        ? 'h-14 w-14 sm:h-[3.75rem] sm:w-[3.75rem] md:w-20 md:h-20 rounded-xl md:rounded-xl'
        : 'w-16 h-16 md:w-20 md:h-20 rounded-xl';

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled && onClick) {
            console.log('[ImageButton] Clicked', { alt, disabled, hasOnClick: !!onClick });
            onClick();
        } else {
            console.log('[ImageButton] Click ignored', { alt, disabled, hasOnClick: !!onClick });
        }
    };

    return (
        <div className="relative shrink-0">
            <button
                type="button"
                onClick={handleClick}
                disabled={disabled}
                title={title}
                className={`relative block ${sizeClass} shrink-0 overflow-hidden border-2 transition-transform duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 ${variantClasses} ${disabled ? 'cursor-not-allowed border-gray-700 opacity-40 shadow-none' : 'cursor-pointer shadow-lg hover:scale-105 active:scale-95'}`}
            >
                <img src={src} alt={alt} className="pointer-events-none h-full w-full object-contain" />
            </button>
            {count !== undefined && <ItemCountBadge count={count} disabled={disabled} />}
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
        <div className={`flex min-w-0 max-w-full flex-col items-center gap-0.5 ${compact ? '' : 'min-w-[4rem]'}`}>
            <ImageButton {...buttonProps} compact={compact} />
            <span
                className={`text-center font-semibold leading-none tracking-wide whitespace-nowrap ${compact ? 'text-[9px]' : 'text-[10px] tracking-wide'} ${disabled ? 'text-gray-500' : 'text-amber-100 drop-shadow-sm'}`}
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
    onAction: (action: ServerAction) => void;
    currentUser: GameProps['currentUser'];
    isMobile?: boolean;
}

const ACTIVE_GAME_STATUSES: GameStatus[] = [
    'playing',
    'alkkagi_playing',
    'curling_playing',
    'dice_rolling',
    'dice_placing',
    'thief_rolling',
    'thief_placing',
];

const ActionButtonsPanel: React.FC<ActionButtonsPanelProps> = ({ session, isSpectator, onAction, currentUser, isMobile = false }) => {
    const [cooldownTime, setCooldownTime] = useState('00:00');
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

    const actionNodes =
        hasButtons && !hasUsedThisCycle
            ? myActionButtons.map((button) => (
                  <Button
                      key={button.name}
                      onClick={() => onAction({ type: 'USE_ACTION_BUTTON', payload: { gameId, buttonName: button.name } })}
                      colorScheme={button.type === 'manner' ? 'green' : 'orange'}
                      className={`min-w-0 max-w-full shrink whitespace-nowrap ${
                          isMobile
                              ? 'text-[0.62rem] leading-tight px-1.5 py-0.5'
                              : 'text-[clamp(0.5rem,1.8vmin,0.75rem)] px-[clamp(0.3rem,1.5vmin,0.5rem)] py-[clamp(0.15rem,1vmin,0.25rem)]'
                      }`}
                      title={button.message}
                      disabled={isSpectator || !isGameActive}
                  >
                      {button.name}
                  </Button>
              ))
            : [<span key="wait" className={`shrink-0 text-gray-400 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>다음 액션 대기중...</span>];

    return (
        <div className={`flex min-w-0 items-center gap-2 ${isMobile ? 'w-full py-0.5' : ''}`}>
            <ArenaControlStrip className="min-w-0 flex-1" gapClass={isMobile ? 'gap-1' : 'gap-2'}>
                {actionNodes}
            </ArenaControlStrip>
            <span
                className={`shrink-0 font-mono tabular-nums ${isMobile ? 'text-[10px]' : 'text-xs'} ${isReady && !hasUsedThisCycle ? 'text-green-400' : 'text-gray-400'}`}
            >
                {cooldownTime}
            </span>
        </div>
    );
};


const DICE_ROLL_ANIMATION_MS = 1500;
const DICE_ROLL_LOCAL_EVENT = 'dice-go-local-roll-start';

export type DiceGoPanelItemKind = 'odd' | 'even' | 'low' | 'high';

/** 주사위 바둑 특수 주사위 아이템 — ImageButton(w-16 md:w-20) 풋프린트 */
const DiceGoLuxuryItemCard: React.FC<{
    kind: DiceGoPanelItemKind;
    count: number;
    usable: boolean;
    onUse: () => void;
    compact?: boolean;
}> = ({ kind, count, usable, onUse, compact = false }) => {
    const [diceSize, setDiceSize] = React.useState(48);
    React.useEffect(() => {
        if (compact) return;
        const q = window.matchMedia('(min-width: 768px)');
        const sync = () => setDiceSize(q.matches ? 62 : 48);
        sync();
        q.addEventListener('change', sync);
        return () => q.removeEventListener('change', sync);
    }, [compact]);

    const meta = (() => {
        switch (kind) {
            case 'odd':
                return {
                    ariaLabel: `홀수 주사위 아이템, 남은 개수 ${count}`,
                    title: `홀수(1·3·5) 주사위 아이템. 남은 개수 ${count}`,
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
                    ariaLabel: `짝수 주사위 아이템, 남은 개수 ${count}`,
                    title: `짝수(2·4·6) 주사위 아이템. 남은 개수 ${count}`,
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
                    ariaLabel: `낮은 수 주사위 아이템, 남은 개수 ${count}`,
                    title: `낮은 수(1·2·3) 주사위 아이템. 남은 개수 ${count}`,
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
                    ariaLabel: `높은 수 주사위 아이템, 남은 개수 ${count}`,
                    title: `높은 수(4·5·6) 주사위 아이템. 남은 개수 ${count}`,
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
    const effectiveDiceSize = compact ? 40 : diceSize;
    const outerSizeClass = compact ? 'h-[3.5rem] w-[3.5rem] rounded-xl' : 'h-16 w-16 rounded-xl md:h-20 md:w-20';

    return (
        <div
            title={meta.title}
            className={`group relative ${outerSizeClass} shrink-0 select-none p-[1px] transition-all duration-300 bg-gradient-to-b ${meta.outerGrad} ${usable ? meta.hoverOuter : ''}`}
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
                    <CountOverlay count={count} disabled={!usable}>
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
            className={`text-center font-semibold leading-none tracking-wide whitespace-nowrap ${compact ? 'text-[8px]' : 'text-[10px]'} ${
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
}> = ({ session, isMyTurn, onAction, currentUser, variant = 'all', footerCompact = false }) => {
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

    const diceAnimation = session.animation?.type === 'dice_roll_main' ? session.animation : null;
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
                className={`flex flex-col items-center gap-2 rounded-2xl border bg-gradient-to-b from-gray-900/95 via-gray-950/90 to-black/90 px-4 py-4 shadow-[0_0_36px_-10px_rgba(251,191,36,0.45),inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition-shadow duration-300 ${
                    canRoll ? 'border-amber-400/55 ring-2 ring-amber-400/20' : 'border-amber-400/35'
                }`}
            >
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/85">주사위</span>
                <Dice
                    value={diceValue ?? null}
                    isRolling={isRolling}
                    size={64}
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
                    title: '홀수 주사위 사용',
                    body: '홀수(1·3·5)만 나오는 주사위 아이템을 1개 사용합니다. 계속하시겠습니까?',
                };
            case 'even':
                return {
                    title: '짝수 주사위 사용',
                    body: '짝수(2·4·6)만 나오는 주사위 아이템을 1개 사용합니다. 계속하시겠습니까?',
                };
            case 'low':
                return {
                    title: '낮은 수 주사위 사용',
                    body: '낮은 수(1·2·3)만 나오는 주사위 아이템을 1개 사용합니다. 계속하시겠습니까?',
                };
            case 'high':
                return {
                    title: '높은 수 주사위 사용',
                    body: '높은 수(4·5·6)만 나오는 주사위 아이템을 1개 사용합니다. 계속하시겠습니까?',
                };
        }
    };

    const diceGoItemsRow = showItems ? (
        <ArenaFixedColsGrid
            cols={4}
            gapClass={footerCompact ? 'gap-x-0.5 sm:gap-x-1' : 'gap-x-3 gap-y-2'}
            className={footerCompact ? 'min-w-0' : ''}
        >
            <LabeledDiceGoItem label="홀수" disabled={!oddItemUsable} compact={footerCompact}>
                <DiceGoLuxuryItemCard kind="odd" count={oddCount} usable={oddItemUsable} onUse={() => handleRoll('odd')} compact={footerCompact} />
            </LabeledDiceGoItem>
            <LabeledDiceGoItem label="짝수" disabled={!evenItemUsable} compact={footerCompact}>
                <DiceGoLuxuryItemCard kind="even" count={evenCount} usable={evenItemUsable} onUse={() => handleRoll('even')} compact={footerCompact} />
            </LabeledDiceGoItem>
            <LabeledDiceGoItem label="낮은수" disabled={!lowItemUsable} compact={footerCompact}>
                <DiceGoLuxuryItemCard kind="low" count={lowCount} usable={lowItemUsable} onUse={() => handleRoll('low')} compact={footerCompact} />
            </LabeledDiceGoItem>
            <LabeledDiceGoItem label="높은수" disabled={!highItemUsable} compact={footerCompact}>
                <DiceGoLuxuryItemCard kind="high" count={highCount} usable={highItemUsable} onUse={() => handleRoll('high')} compact={footerCompact} />
            </LabeledDiceGoItem>
        </ArenaFixedColsGrid>
    ) : null;

    return (
        <>
            {showItemModal && itemConfirm && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="dice-item-confirm-title"
                    onClick={() => setItemConfirm(null)}
                >
                    <div
                        className="bg-gray-900 border border-amber-500/40 rounded-xl shadow-2xl max-w-sm w-full p-5 space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 id="dice-item-confirm-title" className="text-lg font-bold text-amber-100">
                            {diceGoConfirmCopy(itemConfirm).title}
                        </h2>
                        <p className="text-sm text-gray-300 leading-relaxed">{diceGoConfirmCopy(itemConfirm).body}</p>
                        <div className="flex gap-2 justify-end">
                            <Button type="button" colorScheme="none" className="!px-4 !py-2 rounded-lg border border-gray-600 text-gray-200" onClick={() => setItemConfirm(null)}>
                                취소
                            </Button>
                            <Button type="button" colorScheme="none" className="!px-4 !py-2 rounded-lg border border-amber-400/60 bg-amber-600/90 text-slate-900 font-semibold" onClick={confirmItemRoll}>
                                사용
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
                            className={`flex shrink-0 flex-col items-center ${canRoll ? 'animate-pulse-border-yellow' : 'rounded-lg border-2 border-transparent p-2'}`}
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
            <ArenaFixedColsGrid cols={2} gapClass={compact ? 'gap-2' : 'gap-3'} className={compact ? 'min-w-0' : ''}>
                <LabeledControlButton
                    src="/images/button/slow.png"
                    alt="슬로우"
                    label="슬로우"
                    count={slowCount}
                    caption={isSlowActive ? '사용중' : undefined}
                    onClick={() => useItem('slow')}
                    disabled={!canUse || slowCount <= 0 || isSlowActive}
                    title={`파워 게이지 속도를 50% 감소시킵니다. 남은 개수: ${slowCount}`}
                    compact={compact}
                />
                <LabeledControlButton
                    src="/images/button/target.png"
                    alt="조준선"
                    label="조준선"
                    count={aimCount}
                    caption={isAimActive ? '사용중' : undefined}
                    onClick={() => useItem('aimingLine')}
                    disabled={!canUse || aimCount <= 0 || isAimActive}
                    title={`조준선 길이를 1000% 증가시킵니다. 남은 개수: ${aimCount}`}
                    compact={compact}
                />
            </ArenaFixedColsGrid>
        );
    }
    
    const maxRefills = totalRounds - 1;
    const myRefillsUsed = session.alkkagiRefillsUsed?.[currentUser.id] || 0;
    const myRefillsLeft = maxRefills - myRefillsUsed;

    return (
        <div
            className={
                compact
                    ? 'grid w-full min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2'
                    : 'flex items-center justify-center gap-3'
            }
        >
            <div className={`flex shrink-0 flex-col text-center font-semibold text-yellow-300 ${compact ? 'text-[9px]' : 'text-xs'}`}>
                <span className="whitespace-nowrap">
                    리필: {myRefillsLeft} / {maxRefills}
                </span>
            </div>
            <div className={`h-8 w-px shrink-0 bg-gray-600 ${compact ? 'mx-0' : 'mx-2'}`} />
            <ArenaFixedColsGrid cols={2} gapClass={compact ? 'gap-2' : 'gap-3'} className="min-w-0">
                <LabeledControlButton
                    src="/images/button/slow.png"
                    alt="슬로우"
                    label="슬로우"
                    count={slowCount}
                    caption={isSlowActive ? '사용중' : undefined}
                    onClick={() => useItem('slow')}
                    disabled={!canUse || slowCount <= 0 || isSlowActive}
                    title={`파워 게이지 속도를 50% 감소시킵니다. 남은 개수: ${slowCount}`}
                    compact={compact}
                />
                <LabeledControlButton
                    src="/images/button/target.png"
                    alt="조준선"
                    label="조준선"
                    count={aimCount}
                    caption={isAimActive ? '사용중' : undefined}
                    onClick={() => useItem('aimingLine')}
                    disabled={!canUse || aimCount <= 0 || isAimActive}
                    title={`조준선 길이를 1000% 증가시킵니다. 남은 개수: ${aimCount}`}
                    compact={compact}
                />
            </ArenaFixedColsGrid>
        </div>
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
    const [diceSize, setDiceSize] = React.useState(48);
    React.useEffect(() => {
        if (compact) return;
        const q = window.matchMedia('(min-width: 768px)');
        const sync = () => setDiceSize(q.matches ? 62 : 48);
        sync();
        q.addEventListener('change', sync);
        return () => q.removeEventListener('change', sync);
    }, [compact]);

    const meta = (() => {
        switch (kind) {
            case 'high36':
                return {
                    ariaLabel: `높은 수(3~6) 주사위 아이템, 남은 개수 ${count}`,
                    title: `높은 수(3·4·5·6)만 나오는 주사위. 남은 개수 ${count}`,
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
                    ariaLabel: `1방지(2~5) 주사위 아이템, 남은 개수 ${count}`,
                    title: `1이 나오지 않는 주사위(2·3·4·5). 남은 개수 ${count}`,
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
    const effectiveDiceSize = compact ? 40 : diceSize;
    const outerSizeClass = compact ? 'h-[3.5rem] w-[3.5rem] rounded-xl' : 'h-16 w-16 rounded-xl md:h-20 md:w-20';

    return (
        <div
            title={meta.title}
            className={`group relative ${outerSizeClass} shrink-0 select-none p-[1px] transition-all duration-300 bg-gradient-to-b ${meta.outerGrad} ${usable ? meta.hoverOuter : ''}`}
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
                    <CountOverlay count={count} disabled={!usable}>
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
    const diceAnimation = animation?.type === 'dice_roll_main' ? animation : null;
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
    const diceCount = currentPlayerRole === 'thief' ? 1 : 2;

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
                    canRoll ? 'border-amber-400/55 ring-2 ring-amber-400/20' : 'border-amber-400/35'
                }`}
            >
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/85">주사위</span>
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
                    title: '높은 수(3~6) 주사위 사용',
                    body: '3·4·5·6만 나오는 주사위 아이템을 1개 사용합니다. 경찰 턴이면 두 주사위 모두 이 범위입니다. 계속하시겠습니까?',
                };
            case 'noOne':
                return {
                    title: '1방지 주사위 사용',
                    body: '2·3·4·5만 나오는 주사위(1 불가) 아이템을 1개 사용합니다. 경찰 턴이면 두 주사위 모두 이 범위입니다. 계속하시겠습니까?',
                };
        }
    };

    const thiefItemsRow = showItems ? (
        <ArenaFixedColsGrid cols={2} gapClass={footerCompact ? 'gap-x-0.5 sm:gap-x-1' : 'gap-x-3 gap-y-2'} className={footerCompact ? 'min-w-0' : ''}>
            <LabeledDiceGoItem label="높은수" disabled={!high36Usable} compact={footerCompact}>
                <ThiefGoLuxuryItemCard kind="high36" count={high36Count} usable={high36Usable} onUse={() => handleRoll('high36')} compact={footerCompact} />
            </LabeledDiceGoItem>
            <LabeledDiceGoItem label="1방지" disabled={!noOneUsable} compact={footerCompact}>
                <ThiefGoLuxuryItemCard kind="noOne" count={noOneCount} usable={noOneUsable} onUse={() => handleRoll('noOne')} compact={footerCompact} />
            </LabeledDiceGoItem>
        </ArenaFixedColsGrid>
    ) : null;

    return (
        <>
            {showItems && itemConfirm && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="thief-item-confirm-title"
                    onClick={() => setItemConfirm(null)}
                >
                    <div
                        className="w-full max-w-sm space-y-4 rounded-xl border border-amber-500/40 bg-gray-900 p-5 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 id="thief-item-confirm-title" className="text-lg font-bold text-amber-100">
                            {thiefConfirmCopy(itemConfirm).title}
                        </h2>
                        <p className="text-sm leading-relaxed text-gray-300">{thiefConfirmCopy(itemConfirm).body}</p>
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                colorScheme="none"
                                className="!px-4 !py-2 rounded-lg border border-gray-600 text-gray-200"
                                onClick={() => setItemConfirm(null)}
                            >
                                취소
                            </Button>
                            <Button
                                type="button"
                                colorScheme="none"
                                className="!px-4 !py-2 rounded-lg border border-amber-400/60 bg-amber-600/90 font-semibold text-slate-900"
                                onClick={confirmItemRoll}
                            >
                                사용
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
                        <div className={`flex shrink-0 flex-col items-center ${canRoll ? 'animate-pulse-border-yellow' : 'rounded-lg border-2 border-transparent p-2'}`}>
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
    const canUse = isMyTurn && gameStatus === 'curling_playing';
    return (
        <ArenaFixedColsGrid cols={2} gapClass={compact ? 'gap-2' : 'gap-3'} className={compact ? 'min-w-0' : ''}>
            <LabeledControlButton
                src="/images/button/slow.png"
                alt="슬로우"
                label="슬로우"
                count={slowCount}
                onClick={() => useItem('slow')}
                disabled={!canUse || slowCount <= 0 || isSlowActive}
                title={`파워 게이지 속도를 50% 감소시킵니다. 남은 개수: ${slowCount}`}
                compact={compact}
            />
            <LabeledControlButton
                src="/images/button/target.png"
                alt="조준선"
                label="조준선"
                count={aimCount}
                onClick={() => useItem('aimingLine')}
                disabled={!canUse || aimCount <= 0 || isAimActive}
                title={`조준선 길이를 1000% 증가시킵니다. 남은 개수: ${aimCount}`}
                compact={compact}
            />
        </ArenaFixedColsGrid>
    );
};


const GameControls: React.FC<GameControlsProps> = (props) => {
    const { session, isMyTurn, isSpectator, onAction, setShowResultModal, setConfirmModalType, onOpenRematchSettings, currentUser, onlineUsers, pendingMove, onConfirmMove, onCancelMove, isMobile, settings, isSinglePlayer, isSinglePlayerPaused = false, isPaused = false, resumeCountdown = 0, pauseButtonCooldown = 0, onPauseToggle, onOpenGameRecordList, onLeaveOrResign } = props;
    const { negotiations } = useAppContext();
    const { id: gameId, mode, gameStatus, blackPlayerId, whitePlayerId, player1, player2 } = session;
    const isMixMode = mode === GameMode.Mix;
    const isGameEnded = ['ended', 'no_contest', 'rematch_pending'].includes(gameStatus);
    const isGameActive = ACTIVE_GAME_STATUSES.includes(gameStatus);
    const isPreGame = !isGameActive && !isGameEnded;
    const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === mode);
    const isAiLobbyGame = session.isAiGame && !session.isSinglePlayer && session.gameCategory !== 'tower' && session.gameCategory !== 'singleplayer' && session.gameCategory !== 'guildwar';
    const isPvpRematchEligible =
        isGameEnded &&
        !session.isSinglePlayer &&
        !session.isAiGame &&
        session.gameCategory !== 'tower' &&
        session.gameCategory !== 'singleplayer' &&
        session.gameCategory !== 'guildwar';
    const rematchRequested = gameStatus === 'rematch_pending';
    const [isRematchModalOpen, setIsRematchModalOpen] = useState(false);
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
    const isPausableAiGame = session.isAiGame && !session.isSinglePlayer && session.gameCategory !== 'tower' && session.gameCategory !== 'singleplayer';
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
                // 두 번 연속 패스 시 계가 요청
                console.log('[GameControls] handlePass: Requesting scoring (2 passes)');
                onAction({ 
                    type: 'REQUEST_SCORING', 
                    payload: { 
                        gameId, 
                        boardState: session.boardState, 
                        moveHistory: session.moveHistory || [], 
                        settings: session.settings 
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
        if (gameStatus === 'ended' || gameStatus === 'no_contest' || gameStatus === 'pending') {
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
        onAction({ type: actionType, payload: { gameId } }); 
    };

    const myPlayerEnum = currentUser.id === blackPlayerId ? Player.Black : (currentUser.id === whitePlayerId ? Player.White : Player.None);
    const opponentPlayerEnum = myPlayerEnum === Player.Black ? Player.White : Player.Black;

    // 서버 START_SCANNING과 동일: 상대 히든 수가 수순에 있고 아직 영구 공개되지 않았으면 스캔 가능.
    // (온라인 브로드캐스트에 boardState가 없을 때 로컬 보드가 비어 있어 스캔이 막히는 문제 방지)
    const canScan = useMemo(() => {
        if (!session.hiddenMoves || !session.moveHistory) {
            return false;
        }
        return Object.entries(session.hiddenMoves).some(([moveIndexStr, isHidden]) => {
            if (!isHidden) return false;
            const move = session.moveHistory[parseInt(moveIndexStr, 10)];
            if (!move || move.player !== opponentPlayerEnum || move.x < 0 || move.y < 0) {
                return false;
            }
            const { x, y } = move;
            const isPermanentlyRevealed = session.permanentlyRevealedStones?.some((p) => p.x === x && p.y === y);
            return !isPermanentlyRevealed;
        });
    }, [session.hiddenMoves, session.moveHistory, session.permanentlyRevealedStones, opponentPlayerEnum]);
    
    const luxuryButtonBase = isMobile
        ? 'relative overflow-hidden whitespace-nowrap break-keep text-[0.62rem] leading-tight px-1.5 py-1 rounded-lg backdrop-blur-sm font-semibold tracking-tight transition-all duration-200 flex items-center justify-center gap-0.5 min-h-0 min-w-0 shrink'
        : 'relative overflow-hidden whitespace-normal break-keep text-[clamp(0.6rem,2vmin,0.85rem)] px-[clamp(0.45rem,1.6vmin,0.85rem)] py-[clamp(0.32rem,1.1vmin,0.6rem)] rounded-xl backdrop-blur-sm font-semibold tracking-wide transition-all duration-200 flex items-center justify-center gap-1';

    const getLuxuryButtonClasses = (variant: 'primary' | 'danger' | 'neutral' | 'accent' | 'success' = 'primary') => {
        const variants: Record<typeof variant, string> = {
            primary: `${luxuryButtonBase} border border-cyan-200/40 bg-gradient-to-br from-cyan-500/85 via-sky-500/80 to-indigo-500/80 text-white shadow-[0_18px_34px_-18px_rgba(59,130,246,0.55)] hover:-translate-y-0.5 hover:shadow-[0_24px_40px_-18px_rgba(96,165,250,0.6)]`,
            danger: `${luxuryButtonBase} border border-rose-300/45 bg-gradient-to-br from-rose-600/90 via-red-500/85 to-amber-400/80 text-white shadow-[0_18px_36px_-16px_rgba(248,113,113,0.55)] hover:-translate-y-0.5 hover:shadow-[0_24px_42px_-18px_rgba(248,113,113,0.65)]`,
            neutral: `${luxuryButtonBase} border border-slate-400/35 bg-gradient-to-br from-slate-800/85 via-slate-900/80 to-black/70 text-slate-100 shadow-[0_16px_32px_-20px_rgba(148,163,184,0.5)] hover:-translate-y-0.5 hover:shadow-[0_22px_40px_-18px_rgba(203,213,225,0.55)]`,
            accent: `${luxuryButtonBase} border border-amber-300/55 bg-gradient-to-br from-amber-400/85 via-yellow-400/75 to-orange-400/80 text-slate-900 shadow-[0_18px_36px_-18px_rgba(251,191,36,0.5)] hover:-translate-y-0.5 hover:shadow-[0_24px_44px_-18px_rgba(251,191,36,0.6)]`,
            success: `${luxuryButtonBase} border border-emerald-300/55 bg-gradient-to-br from-emerald-500/85 via-lime-500/75 to-green-500/80 text-slate-900 shadow-[0_18px_34px_-18px_rgba(74,222,128,0.45)] hover:-translate-y-0.5 hover:shadow-[0_24px_44px_-18px_rgba(74,222,128,0.6)]`,
        };
        return variants[variant];
    };

    // 아이템 설정값 (함수 외부에서 선언하여 재사용)
    const hiddenCountSetting = session.settings.hiddenStoneCount ?? 0;
    const scanCountSetting = session.settings.scanCount ?? 0;
    const missileCountSetting = session.settings.missileCount ?? 0;

    const renderItemButtons = () => {
        const isHiddenMode = (mode === GameMode.Hidden || (mode === GameMode.Mix && (session.settings.mixedModes || []).includes(GameMode.Hidden))) || (session.isSinglePlayer && hiddenCountSetting > 0);
        // 미사일 모드: 게임 모드가 Missile이거나, 싱글플레이에서 missileCount가 설정된 경우
        const isMissileMode = (mode === GameMode.Missile || (mode === GameMode.Mix && (session.settings.mixedModes || []).includes(GameMode.Missile))) || (session.isSinglePlayer && (missileCountSetting > 0 || (session.settings as any)?.missileCount > 0));
        const p1Id = session.player1.id;
        // 히든 아이템 (스캔 아이템처럼 개수 기반)
        const hiddenLeft = currentUser.id === p1Id 
            ? (session.hidden_stones_p1 ?? hiddenCountSetting)
            : (session.hidden_stones_p2 ?? hiddenCountSetting);
        const myScansLeft = currentUser.id === p1Id
            ? (session.scans_p1 ?? scanCountSetting)
            : (session.scans_p2 ?? scanCountSetting);
        const myMissilesLeft = currentUser.id === p1Id
            ? (session.missiles_p1 ?? missileCountSetting)
            : (session.missiles_p2 ?? missileCountSetting);

        const buttons: React.ReactNode[] = [];

        if (isHiddenMode) {
            const hiddenDisabled = !isMyTurn || isSpectator || gameStatus !== 'playing' || hiddenLeft <= 0;
            buttons.push(
                <LabeledControlButton
                    key="hidden"
                    src="/images/button/hidden.png"
                    alt="히든"
                    label="히든"
                    onClick={() => handleUseItem('hidden')}
                    disabled={hiddenDisabled}
                    title="히든 스톤 배치"
                    count={hiddenLeft}
                    compact={isMobile}
                />
            );

            const scansLeft = myScansLeft ?? 0;
            const scanDisabled = !isMyTurn || isSpectator || gameStatus !== 'playing' || scansLeft <= 0 || !canScan;
            buttons.push(
                <LabeledControlButton
                    key="scan"
                    src="/images/button/scan.png"
                    alt="스캔"
                    label="스캔"
                    onClick={() => handleUseItem('scan')}
                    disabled={scanDisabled}
                    title="상대 히든 스톤 탐지"
                    count={scansLeft}
                    compact={isMobile}
                />
            );
        }

        if (isMissileMode) {
            const missilesLeft = myMissilesLeft ?? 0;
            const missileDisabled = !isMyTurn || isSpectator || gameStatus !== 'playing' || missilesLeft <= 0;
            buttons.push(
                <LabeledControlButton
                    key="missile"
                    src="/images/button/missile.png"
                    alt="미사일"
                    label="미사일"
                    onClick={() => handleUseItem('missile')}
                    disabled={missileDisabled}
                    title="미사일 발사"
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
        const currentStageIndex = stageId ? SINGLE_PLAYER_STAGES.findIndex(s => s.id === stageId) : -1;
        const currentStage = stageId ? SINGLE_PLAYER_STAGES.find(s => s.id === stageId) : undefined;
        const nextStage = currentStageIndex >= 0 ? SINGLE_PLAYER_STAGES[currentStageIndex + 1] : undefined;
        const isWinner = session.winner === Player.Black;
        // 클리어 직후에는 singlePlayerProgress가 아직 반영되지 않았을 수 있으므로, 이번 게임에서 이겼으면 다음 단계 허용
        const canTryNextStage = !!nextStage && isWinner;
        
        const retryActionPointCost = currentStage?.actionPointCost ?? 0;
        const nextStageActionPointCost = nextStage?.actionPointCost ?? 0;

        const refreshCosts = [0, 50, 75, 100, 200];
        const refreshesUsed = session.singlePlayerPlacementRefreshesUsed ?? 0;
        const remainingRefreshes = Math.max(0, 5 - refreshesUsed);
        const costIndex = Math.min(refreshesUsed, refreshCosts.length - 1);
        const nextCost = refreshCosts[costIndex] ?? refreshCosts[refreshCosts.length - 1];
        const moveCount = session.moveHistory?.length ?? 0;
        const isPlayingState = gameStatus === 'playing';
        const currentGold = currentUser.gold ?? 0;
        const canRefreshNow = !isGameEnded && isPlayingState && moveCount === 0 && remainingRefreshes > 0;
        const canAffordRefresh = currentGold >= nextCost;
        const isPaused = isSinglePlayerPaused;
        // 미사일 바둑에서 첫 턴에 미사일을 사용한 경우에만 배치변경 비활성화
        const isMissileOnlyMode = missileCountSetting > 0 && hiddenCountSetting === 0 && scanCountSetting === 0;
        const myMissilesLeftForRefresh = session.missiles_p1 ?? missileCountSetting;
        const usedMissileBeforeFirstMove = isMissileOnlyMode && moveCount === 0 && (missileCountSetting - myMissilesLeftForRefresh) > 0;
        const refreshDisabled = !canRefreshNow || !canAffordRefresh || isPaused || usedMissileBeforeFirstMove;

        let refreshHelperMessage = '';
        if (usedMissileBeforeFirstMove) {
            refreshHelperMessage = '첫 턴에 미사일을 사용하면 배치변경을 사용할 수 없습니다.';
        } else if (remainingRefreshes <= 0) {
            refreshHelperMessage = '재배치 횟수를 모두 사용했습니다.';
        } else if (!isPlayingState) {
            refreshHelperMessage = '게임이 시작되면 재배치할 수 있습니다.';
        } else if (moveCount > 0) {
            refreshHelperMessage = '첫 수를 두기 전에만 재배치할 수 있습니다.';
        } else if (!canAffordRefresh) {
            refreshHelperMessage = '골드가 부족합니다.';
        } else if (isPaused) {
            refreshHelperMessage = '일시 정지 상태에서는 재배치할 수 없습니다.';
        }

        const handleRefreshClick = () => {
            if (refreshDisabled) {
                if (refreshHelperMessage) window.alert(refreshHelperMessage);
                return;
            }
            const confirmationMessage = nextCost > 0
                ? `${nextCost.toLocaleString()} 골드를 사용하여 배치를 다시 섞으시겠습니까? (남은 재배치 ${remainingRefreshes}/5)`
                : '첫 재배치는 무료입니다. 배치를 다시 섞으시겠습니까?';
            if (window.confirm(confirmationMessage)) {
                onAction({ type: 'SINGLE_PLAYER_REFRESH_PLACEMENT', payload: { gameId } } as ServerAction);
            }
        };

        const canResign = isGameActive && !isSpectator && !isGameEnded && !isPaused;
        const handleResignClick = () => {
            if (!canResign) {
                if (isPaused) {
                    window.alert('일시 정지 상태에서는 기권할 수 없습니다.');
                } else if (!isGameActive && !isGameEnded) {
                    window.alert('게임이 시작된 후에만 기권할 수 있습니다.');
                }
                return;
            }
            if (window.confirm('경기를 포기하시겠습니까?')) {
                onAction({ type: 'RESIGN_GAME', payload: { gameId } } as ServerAction);
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
            setShowResultModal(false);

            // 게임 종류에 따라 적절한 로비/대기실로 라우팅 (전략/놀이 대기실 AI를 먼저 판별해 싱글·탑으로 잘못 나가는 버그 방지)
            let redirectHash: string | null = null;

            if (session.gameCategory === 'guildwar') {
                redirectHash = '#/guildwar';
            } else if (session.gameCategory === 'tower') {
                redirectHash = '#/tower';
            } else if (session.isAiGame && (SPECIAL_GAME_MODES.some(m => m.mode === session.mode) || PLAYFUL_GAME_MODES.some(m => m.mode === session.mode))) {
                const waitingRoomMode = SPECIAL_GAME_MODES.some(m => m.mode === session.mode) ? 'strategic' as const : 'playful' as const;
                redirectHash = `#/waiting/${waitingRoomMode}`;
            } else if (session.gameCategory === 'singleplayer' || session.isSinglePlayer) {
                redirectHash = '#/singleplayer';
            } else {
                let waitingRoomMode: 'strategic' | 'playful' | null = null;
                if (SPECIAL_GAME_MODES.some(m => m.mode === session.mode)) {
                    waitingRoomMode = 'strategic';
                } else if (PLAYFUL_GAME_MODES.some(m => m.mode === session.mode)) {
                    waitingRoomMode = 'playful';
                }
                if (waitingRoomMode) {
                    redirectHash = `#/waiting/${waitingRoomMode}`;
                }
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
                <footer className="responsive-controls flex-shrink-0 bg-gray-800 rounded-lg p-2 flex flex-col items-stretch justify-center gap-2 w-full h-[136px]">
                    <div className="min-w-0 rounded-xl border border-stone-700 bg-gray-900/70 px-2 py-3 sm:px-4">
                        <ArenaControlStrip layout="cluster" gapClass={isMobile ? 'gap-1.5' : 'gap-2'}>
                        <Button onClick={handleShowResults} colorScheme="none" className={`justify-center rounded-xl border border-indigo-400/50 bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 text-white shadow-[0_12px_32px_-18px_rgba(99,102,241,0.85)] hover:from-indigo-400 hover:to-pink-400 whitespace-nowrap shrink-0 ${isMobile ? '!py-1 !px-2 !text-[0.65rem]' : '!py-1.5 !px-4 !text-sm'}`}>
                            결과 확인
                        </Button>
                        <Button onClick={handleCloseResults} colorScheme="none" className={`justify-center rounded-xl border border-red-400/50 bg-gradient-to-r from-red-500/90 via-red-600/90 to-rose-600/90 text-white shadow-[0_12px_32px_-18px_rgba(239,68,68,0.85)] hover:from-red-400 hover:to-rose-500 whitespace-nowrap shrink-0 ${isMobile ? '!py-1 !px-2 !text-[0.65rem]' : '!py-1.5 !px-4 !text-sm'}`}>
                            나가기
                        </Button>
                        {isPvpRematchEligible && (
                            <Button
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
                                disabled={rematchRequested}
                                colorScheme="none"
                                className={`justify-center rounded-xl border border-emerald-400/50 bg-gradient-to-r from-emerald-500/90 via-lime-400/85 to-green-500/90 text-slate-900 shadow-[0_12px_32px_-18px_rgba(74,222,128,0.75)] hover:from-emerald-300 hover:to-green-500 whitespace-nowrap disabled:opacity-60 shrink-0 ${isMobile ? '!py-1 !px-2 !text-[0.65rem]' : '!py-1.5 !px-4 !text-sm'}`}
                            >
                                {rematchRequested ? '신청중' : '재대결'}
                            </Button>
                        )}
                        {isAiLobbyGame && onOpenRematchSettings && (
                            <Button
                                onClick={onOpenRematchSettings}
                                colorScheme="none"
                                className={`justify-center rounded-xl border border-emerald-400/50 bg-gradient-to-r from-emerald-500/90 via-lime-400/85 to-green-500/90 text-slate-900 shadow-[0_12px_32px_-18px_rgba(74,222,128,0.75)] hover:from-emerald-300 hover:to-green-500 whitespace-nowrap shrink-0 ${isMobile ? '!py-1 !px-2 !text-[0.65rem]' : '!py-1.5 !px-4 !text-sm'}`}
                            >
                                재대결
                            </Button>
                        )}
                        <Button onClick={handleNextStage} colorScheme="none" className={`justify-center rounded-xl border border-cyan-400/50 bg-gradient-to-r from-cyan-500/90 via-sky-500/90 to-blue-500/90 text-white shadow-[0_12px_32px_-18px_rgba(56,189,248,0.85)] hover:from-cyan-300 hover:to-blue-500 whitespace-nowrap shrink-0 max-w-[46vw] truncate ${isMobile ? '!py-1 !px-2 !text-[0.65rem]' : '!py-1.5 !px-4 !text-sm'}`} disabled={!canTryNextStage}>
                            다음 단계{canTryNextStage && nextStage ? `: ${nextStage.name}` : ''}{nextStageActionPointCost > 0 && ` (⚡${nextStageActionPointCost})`}
                        </Button>
                        <Button onClick={handleRetry} colorScheme="none" className={`justify-center rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-500/90 via-amber-300/90 to-amber-500/90 text-slate-900 shadow-[0_12px_32px_-18px_rgba(251,191,36,0.85)] hover:from-amber-300 hover:to-amber-500 whitespace-nowrap shrink-0 ${isMobile ? '!py-1 !px-2 !text-[0.65rem]' : '!py-1.5 !px-4 !text-sm'}`}>
                            재도전 {retryActionPointCost > 0 && `(⚡${retryActionPointCost})`}
                        </Button>
                        </ArenaControlStrip>
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

        const itemColClass = isMobile ? 'flex flex-col items-center gap-0.5 shrink-0' : 'flex flex-col items-center gap-2';
        const labelClass = isMobile ? 'text-[9px] text-amber-200 font-semibold tracking-wide' : 'text-[10px] text-amber-200 font-semibold tracking-wide';

        const coreControls = (
            <>
                <div className={itemColClass}>
                    <ImageButton
                        src="/images/button/giveup.png"
                        alt="기권"
                        title="기권하기"
                        onClick={handleResignClick}
                        disabled={!canResign}
                        variant="danger"
                        compact={isMobile}
                    />
                    <span className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} text-red-300 font-semibold tracking-wide`}>기권</span>
                </div>
                <div className={itemColClass}>
                    <ImageButton
                        src="/images/button/reflesh.png"
                        alt="돌 재배치"
                        title="돌 재배치"
                        onClick={handleRefreshClick}
                        disabled={refreshDisabled}
                        compact={isMobile}
                    />
                    <span className={`${labelClass} flex items-center gap-0.5 justify-center whitespace-nowrap`}>
                        {remainingRefreshes}/5
                        {nextCost > 0 && (
                            <>
                                <span>·</span>
                                <img src="/images/icon/Gold.png" alt="골드" className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                                <span>{nextCost.toLocaleString()}</span>
                            </>
                        )}
                        {nextCost === 0 && <span>· 무료</span>}
                    </span>
                </div>
            </>
        );

        const itemControls = (
            <>
                {isHiddenMode && (
                    <div className={itemColClass}>
                        <ImageButton
                            src="/images/button/hidden.png"
                            alt="히든"
                            title="히든 스톤 배치"
                            onClick={() => handleUseItem('hidden')}
                            disabled={!isMyTurn || gameStatus !== 'playing' || hiddenLeft <= 0}
                            count={hiddenLeft > 0 ? hiddenLeft : undefined}
                            compact={isMobile}
                        />
                        <span className={labelClass}>히든</span>
                    </div>
                )}
                {isHiddenMode && (
                    <div className={itemColClass}>
                        <ImageButton
                            src="/images/button/scan.png"
                            alt="스캔"
                            title="상대 히든 스톤 탐지"
                            onClick={() => handleUseItem('scan')}
                            disabled={!isMyTurn || gameStatus !== 'playing' || myScansLeft <= 0 || !canScan}
                            count={myScansLeft > 0 ? myScansLeft : undefined}
                            compact={isMobile}
                        />
                        <span className={labelClass}>스캔</span>
                    </div>
                )}
                {isMissileMode && (
                    <div className={itemColClass}>
                        <ImageButton
                            src="/images/button/missile.png"
                            alt="미사일"
                            title="미사일 발사"
                            onClick={() => handleUseItem('missile')}
                            disabled={!isMyTurn || gameStatus !== 'playing' || myMissilesLeft <= 0}
                            count={myMissilesLeft > 0 ? myMissilesLeft : undefined}
                            compact={isMobile}
                        />
                        <span className={labelClass}>미사일</span>
                    </div>
                )}
            </>
        );

        return (
            <footer className="responsive-controls flex-shrink-0 bg-gray-800 rounded-lg p-2 flex flex-col items-stretch justify-center gap-2 w-full min-h-[136px]">
                <div
                    className={`bg-gray-900/60 border border-stone-700 rounded-xl w-full ${
                        isMobile && (isHiddenMode || isMissileMode)
                            ? 'flex min-w-0 flex-row items-stretch gap-0 px-2 py-2'
                            : isMobile
                              ? 'px-2 py-2'
                              : 'flex min-w-0 flex-row items-center gap-4 px-4 py-3'
                    }`}
                >
                    {isMobile && (isHiddenMode || isMissileMode) ? (
                        <>
                            <div className="flex min-h-[2.75rem] min-w-0 flex-1 flex-col justify-center rounded-lg border border-stone-600/40 bg-black/15 px-1 py-1">
                                <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                                    <ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-1">
                                        {coreControls}
                                    </ArenaControlStrip>
                                </div>
                            </div>
                            <div className="mx-1 w-0.5 shrink-0 self-stretch rounded-full bg-gradient-to-b from-stone-600/20 via-stone-500/50 to-stone-600/20" aria-hidden />
                            <div className="flex min-h-[2.75rem] min-w-0 flex-1 flex-col justify-center rounded-lg border border-amber-900/30 bg-amber-950/10 px-1 py-1">
                                <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                                    <ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-1">
                                        {itemControls}
                                    </ArenaControlStrip>
                                </div>
                            </div>
                        </>
                    ) : isMobile ? (
                        <div className="flex w-full min-w-0 justify-center">
                            <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-2">
                                {coreControls}
                            </ArenaControlStrip>
                        </div>
                    ) : (
                        <>
                            <div
                                className={`flex min-w-0 items-center justify-center ${isHiddenMode || isMissileMode ? 'flex-1' : 'w-full'}`}
                            >
                                <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-4">
                                    {coreControls}
                                </ArenaControlStrip>
                            </div>
                            {(isHiddenMode || isMissileMode) && (
                                <>
                                    <div className="h-12 w-px shrink-0 self-stretch bg-stone-600/50" />
                                    <div className="flex min-w-0 flex-1 items-center justify-center">
                                        <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-4">
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

    const primaryControlsInner = (
        <>
            {isGameEnded ? (
                <>
                    <Button onClick={() => setShowResultModal(true)} colorScheme="none" className={getLuxuryButtonClasses('accent')}>
                        결과 보기
                    </Button>
                    {onLeaveOrResign && (
                        <Button onClick={onLeaveOrResign} colorScheme="none" className={getLuxuryButtonClasses('danger')}>
                            {isSpectator ? '관전종료' : '나가기'}
                        </Button>
                    )}
                    {isAiLobbyGame && onOpenRematchSettings && (
                        <Button onClick={onOpenRematchSettings} colorScheme="none" className={getLuxuryButtonClasses('success')}>
                            재대결
                        </Button>
                    )}
                    {showStrategicGameRecordActions && (onAction || onOpenGameRecordList) && (
                        <>
                            {onAction && (
                                <Button
                                    onClick={async () => {
                                        if (savingGameRecord || recordAlreadySaved) return;
                                        if (savedRecordCount >= 10) {
                                            alert(GAME_RECORD_SLOT_FULL_MESSAGE);
                                            return;
                                        }
                                        setSavingGameRecord(true);
                                        try {
                                            const out = await onAction({ type: 'SAVE_GAME_RECORD', payload: { gameId } });
                                            if (out && typeof out === 'object' && 'error' in out && (out as { error?: string }).error) return;
                                            setSavedOptimistic(true);
                                        } catch (e) {
                                            console.error(e);
                                        } finally {
                                            setSavingGameRecord(false);
                                        }
                                    }}
                                    disabled={savingGameRecord || recordAlreadySaved}
                                    colorScheme="none"
                                    className={`${getLuxuryButtonClasses('accent')} ${recordAlreadySaved ? 'opacity-50' : ''}`}
                                >
                                    {savingGameRecord ? '저장 중...' : recordAlreadySaved ? '이미 저장됨' : '기보 저장'}
                                </Button>
                            )}
                            {onOpenGameRecordList && (
                                <Button onClick={() => onOpenGameRecordList()} colorScheme="none" className={getLuxuryButtonClasses('neutral')}>
                                    기보 관리
                                </Button>
                            )}
                        </>
                    )}
                </>
            ) : (
                <>
                    {isStrategic && mode !== GameMode.Capture && !isAiLobbyGame && (
                        <LabeledControlButton
                            key="pass"
                            src="/images/button/pass.png"
                            alt="통과"
                            label="통과"
                            onClick={handlePass}
                            disabled={!isMyTurn || isSpectator || isPreGame}
                            title="한 수 쉬기"
                            compact={isMobile}
                        />
                    )}
                    <LabeledControlButton
                        key="resign"
                        src="/images/button/giveup.png"
                        alt="기권"
                        label="기권"
                        onClick={handleResign}
                        disabled={isSpectator || isGameEnded || gameStatus === 'pending'}
                        title="기권하기"
                        variant="danger"
                        compact={isMobile}
                    />
                </>
            )}
        </>
    );

    const specialControlsInner = isStrategic ? (
        (() => {
            if (isGameEnded || !hasItems) return null;
            const itemButtons = renderItemButtons();
            if (itemButtons.length === 0) {
                return <span className={`text-gray-400 ${isMobile ? 'text-[9px] shrink-0' : 'text-[10px]'}`}>사용 가능한 기능 없음</span>;
            }
            return itemButtons;
        })()
    ) : mode === GameMode.Dice ? (
        <DicePanel session={session} isMyTurn={isMyTurn} onAction={onAction} currentUser={currentUser} variant="itemsOnly" footerCompact={isMobile} />
    ) : mode === GameMode.Thief ? (
        <ThiefPanel session={session} isMyTurn={isMyTurn} onAction={onAction} currentUser={currentUser} variant="itemsOnly" footerCompact={isMobile} />
    ) : mode === GameMode.Curling ? (
        <CurlingItemPanel session={session} isMyTurn={isMyTurn} onAction={onAction} currentUser={currentUser} compact={isMobile} />
    ) : mode === GameMode.Alkkagi ? (
        <AlkkagiItemPanel session={session} isMyTurn={isMyTurn} onAction={onAction} currentUser={currentUser} compact={isMobile} />
    ) : (
        <PlayfulStonesPanel session={session} currentUser={currentUser} />
    );

    return (
        <footer className="responsive-controls flex-shrink-0 bg-gray-800 rounded-lg p-1 flex flex-col items-stretch justify-center gap-1 w-full">
            {/* Row 1: Manner Actions - PVP 모드에서만 표시 */}
            {!isSinglePlayer && !session.isAiGame ? (
                <div
                    className={`flex w-full min-w-0 flex-row items-center rounded-md bg-gray-900/50 ${
                        isMobile ? 'gap-2 p-1.5' : 'gap-4 p-2'
                    }`}
                >
                    <h3 className={`shrink-0 font-bold whitespace-nowrap text-gray-300 ${isMobile ? 'text-[9px]' : 'text-xs'}`}>
                        매너 액션 {usesLeftText}
                    </h3>
                    <div className="min-w-0 flex-1">
                        <ActionButtonsPanel session={session} isSpectator={isSpectator} onAction={onAction} currentUser={currentUser} isMobile={isMobile} />
                    </div>
                </div>
            ) : !isSinglePlayer && session.isAiGame ? (
                <div className="bg-gray-900/50 rounded-md p-2 flex flex-row items-center justify-center gap-4 w-full min-w-0">
                    <p className="text-xs text-gray-400 italic whitespace-nowrap truncate">매너 액션 버튼은 PVP모드에서만 생성됩니다.</p>
                </div>
            ) : null}

            {/* Row 2: Game and Special/Playful Functions */}
            {isMobile ? (
                <div className="flex w-full min-w-0 gap-2">
                    <div className="flex min-h-[4.75rem] min-w-0 flex-1 flex-col justify-center rounded-lg border border-stone-600/45 bg-gray-900/55 p-2">
                        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
                            <ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-2">
                                {primaryControlsInner}
                            </ArenaControlStrip>
                        </div>
                    </div>
                    <div
                        className="w-0.5 shrink-0 self-stretch rounded-full bg-gradient-to-b from-stone-500/15 via-stone-500/50 to-stone-500/15"
                        aria-hidden
                    />
                    <div className="flex min-h-[4.75rem] min-w-0 flex-1 flex-col justify-center rounded-lg border border-amber-900/35 bg-gray-900/55 p-2">
                        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
                            <ArenaControlStrip layout="cluster" className="max-w-full min-h-0" gapClass="gap-2">
                                {specialControlsInner}
                            </ArenaControlStrip>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex w-full min-w-0 flex-row gap-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-md bg-gray-900/50 p-2">
                        <h3 className="text-center text-xs font-bold text-gray-300">대국 기능</h3>
                        <div className="flex min-h-[3.5rem] w-full min-w-0 flex-1 items-center justify-center">
                            <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-3">
                                {primaryControlsInner}
                            </ArenaControlStrip>
                        </div>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-md bg-gray-900/50 p-2">
                        <h3 className="text-center text-xs font-bold text-gray-300">{isStrategic ? '특수 기능' : '놀이 기능'}</h3>
                        <div className="flex min-h-[3.5rem] w-full min-w-0 flex-1 items-center justify-center">
                            <ArenaControlStrip layout="cluster" className="max-w-full" gapClass="gap-3">
                                {specialControlsInner}
                            </ArenaControlStrip>
                        </div>
                    </div>
                </div>
            )}
             {/* Admin Controls */}
            {isSpectator && currentUser.isAdmin && isGameActive && (
                <div className="mt-1 flex w-full min-w-0 flex-row items-center gap-4 rounded-md bg-purple-900/50 p-2">
                    <h3 className="shrink-0 whitespace-nowrap text-xs font-bold text-purple-300">관리자 기능</h3>
                    <div className="flex min-w-0 flex-1 items-center justify-center">
                        <ArenaControlStrip layout="cluster" gapClass={isMobile ? 'gap-1.5' : 'gap-2'}>
                        <Button
                            onClick={() => {
                                if (window.confirm(`${player1.nickname}님을 기권승 처리하시겠습니까?`)) {
                                    onAction({ type: 'ADMIN_FORCE_WIN', payload: { gameId, winnerId: player1.id } })
                                }
                            }}
                            colorScheme="none"
                            className={getLuxuryButtonClasses('primary')}
                        >
                            {player1.nickname} 기권승
                        </Button>
                        <Button
                            onClick={() => {
                                 if (window.confirm(`${player2.nickname}님을 기권승 처리하시겠습니까?`)) {
                                    onAction({ type: 'ADMIN_FORCE_WIN', payload: { gameId, winnerId: player2.id } })
                                 }
                            }}
                            colorScheme="none"
                            className={getLuxuryButtonClasses('primary')}
                        >
                            {player2.nickname} 기권승
                        </Button>
                        </ArenaControlStrip>
                    </div>
                </div>
            )}
        </footer>
    );
};

export default GameControls;