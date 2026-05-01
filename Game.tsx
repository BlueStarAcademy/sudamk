import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
// FIX: Import types from the new centralized types barrel file
import {
    Player,
    GameMode,
    GameStatus,
    Point,
    GameProps,
    LiveGameSession,
    ServerAction,
    FeatureSettings,
} from './types/index.js';
import GameArena from './components/GameArena.js';
import Avatar from './components/Avatar.js';
import Header from './components/Header.js';
import Sidebar from './components/game/Sidebar.js';
import PlayerPanel from './components/game/PlayerPanel.js';
import GameModals from './components/game/GameModals.js';
import TurnDisplay from './components/game/TurnDisplay.js';
import { audioService } from './services/audioService.js';
import { TerritoryAnalysisWindow, HintWindow } from './components/game/AnalysisWindows.js';
import GameControls from './components/game/GameControls.js';
import { AVATAR_POOL, BORDER_POOL, PLAYFUL_GAME_MODES, SPECIAL_GAME_MODES, aiUserId } from './constants.js';
import { useAppContext } from './hooks/useAppContext.js';
import DisconnectionModal from './components/DisconnectionModal.js';
// FIX: Import TimeoutFoulModal component to resolve 'Cannot find name' error.
import TimeoutFoulModal from './components/TimeoutFoulModal.js';
import AiChallengeModal from './components/waiting-room/AiChallengeModal.js';
import SinglePlayerControls from './components/game/SinglePlayerControls.js';
import SinglePlayerInfoPanel from './components/game/SinglePlayerInfoPanel.js';
import SinglePlayerGameDescriptionModal from './components/SinglePlayerGameDescriptionModal.js';
import SinglePlayerSidebar from './components/game/SinglePlayerSidebar.js';
import TowerControls from './components/game/TowerControls.js';
import TowerSidebar from './components/game/TowerSidebar.js';
import GuildWarMissileTowerControls from './components/game/GuildWarMissileTowerControls.js';
import GuildWarHiddenTowerControls from './components/game/GuildWarHiddenTowerControls.js';
import GuildWarTowerSidebar from './components/game/GuildWarTowerSidebar.js';
import { ScoringOverlay } from './components/game/ScoringOverlay.js';
import { useClientTimer } from './hooks/useClientTimer.js';
import { useIsHandheldDevice } from './hooks/useIsMobileLayout.js';
import { calculateSimpleAiMove } from './client/goAiBotClient.js';
import { processMoveClient } from './client/goLogicClient.js';
import { isDiceGoLibertyPlacement, isThiefGoValidPlacement } from './client/logic/goLogic.js';
import Button from './components/Button.js';
import ToggleSwitch from './components/ui/ToggleSwitch.js';
import { DraggableMoveConfirmPanel } from './components/game/DraggableMoveConfirmPanel.js';
import { buildPveItemActionClientSync } from './utils/pveItemClientSync.js';
import { replaceAppHash } from './utils/appUtils.js';
import { getAdventureMapWebpPath } from './constants/adventureConstants.js';
import { InGameModalLayoutProvider } from './contexts/InGameModalLayoutContext.js';
import { getCurrentPairTurnSeat, PAIR_TURN_SEAT_IDS } from './shared/utils/pairGameTurn.js';
import { getPairPetDefinition } from './shared/constants/petLobby.js';
import { getEquippedPairPetInventoryRow } from './shared/utils/pairEquippedPet.js';
import { resolvePairPetMetaFromInventoryRow } from './shared/utils/pairPetRoll.js';
import {
    isOnboardingTutorialActive,
    ONBOARDING_INGAME_SP_STEP_EVENT,
    ONBOARDING_INGAME_SP_INTRO1_DEMO_DONE_EVENT,
    ONBOARDING_INTRO1_FORCED_CAPTURE_POINT,
    shouldRestrictIntro1OnboardingFirstMove,
} from './shared/constants/onboardingTutorial.js';
// AI 유저 ID (싱글플레이에서 AI 차례 판단용)
const AI_USER_ID = aiUserId;

/** 따내기 한도로 종료 시 점수 플로트와 동기(GoBoard `DEBOUNCE_MS` / 히든 시 추가 지연 / `index.css` 2.85s). 애니 직후 추가 대기 없음 */
const CAPTURE_WIN_SCORE_DEBOUNCE_MS = 48;
const CAPTURE_WIN_HIDDEN_FLOAT_LAG_MS = 450;
const CAPTURE_WIN_SCORE_FLOAT_CSS_MS = 2850;

/** 로비 Kata AI·모험·길드전 등 서버 전략바둑 AI 대국 (타워/싱글플 제외) */
const KATA_STYLE_AI_GO_MODES = new Set<GameMode>([
    GameMode.Standard,
    GameMode.Capture,
    GameMode.Speed,
    GameMode.Base,
    GameMode.Hidden,
    GameMode.Missile,
    GameMode.Mix,
]);

/** 서버 전략바둑 AI / 클라이언트 AI 공통: AI 턴 멈춤 복구 타이머 (히든 초기 배치·공개/스캔 연출 포함) */
const STRATEGIC_AI_STUCK_RECOVERABLE_STATUSES = new Set<GameStatus>([
    'playing',
    'hidden_placing',
    'hidden_reveal_animating',
    'scanning_animating',
]);

/** 모바일 우측 패널: 100vh 대신 dvh + 노치/홈바로 하단 잘림 방지 */
const mobileGameSidebarDrawerStyle: React.CSSProperties = {
    paddingTop: 'env(safe-area-inset-top, 0px)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
};

const KO_RULE_FLASH_MESSAGE = '패 모양(단순 코)입니다. 바로 다시 따낼 수 없습니다.';

interface MoveConfirmDraggableProps {
    layoutMode: 'mobile' | 'desktop';
    pendingMove: Point | null;
    handleConfirmMove: () => void;
    mobileConfirm: boolean;
    updateFeatureSetting: <K extends keyof FeatureSettings>(key: K, value: FeatureSettings[K]) => void;
    setPendingMove: (p: Point | null) => void;
}

const MoveConfirmDraggable: React.FC<MoveConfirmDraggableProps> = ({
    layoutMode,
    pendingMove,
    handleConfirmMove,
    mobileConfirm,
    updateFeatureSetting,
    setPendingMove,
}) => (
    <DraggableMoveConfirmPanel layoutMode={layoutMode}>
        <Button
            onClick={pendingMove ? handleConfirmMove : undefined}
            disabled={!pendingMove || !mobileConfirm}
            colorScheme="none"
            className={`w-full !py-2.5 rounded-xl border border-emerald-400/45 bg-gradient-to-b from-emerald-400/95 via-emerald-600/90 to-emerald-950/95 text-slate-950 font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_28px_-12px_rgba(16,185,129,0.45)] ring-1 ring-inset ring-white/10 ${!pendingMove || !mobileConfirm ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-[1.05] active:scale-[0.99]'}`}
            title={!mobileConfirm ? '착수 버튼 모드가 OFF입니다.' : pendingMove ? '착수 확정' : '바둑판을 클릭해 착점을 선택하세요'}
        >
            착수
        </Button>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-600/50 to-transparent" />
        <div className="flex w-full items-center justify-between gap-2">
            <span className="whitespace-nowrap text-[10px] text-gray-300">착수 버튼</span>
            <ToggleSwitch
                checked={mobileConfirm}
                onChange={(checked) => {
                    updateFeatureSetting('mobileConfirm', checked);
                    if (!checked) setPendingMove(null);
                }}
            />
        </div>
    </DraggableMoveConfirmPanel>
);

type PairSeat = NonNullable<NonNullable<LiveGameSession['settings']['pairGame']>['turnOrder']>[number];
type PairClientTimes = { black: number; white: number };

function sortPairSeatsBySeatId(seats: PairSeat[]): PairSeat[] {
    return [...seats].sort((a, b) => PAIR_TURN_SEAT_IDS.indexOf(a.seatId) - PAIR_TURN_SEAT_IDS.indexOf(b.seatId));
}

const pairSeatShortLabel = (seatId: string): string =>
    seatId === 'black1' ? '흑1' : seatId === 'black2' ? '흑2' : seatId === 'white1' ? '백1' : seatId === 'white2' ? '백2' : seatId;

function pairSeatOwnerUser(session: LiveGameSession, seat: PairSeat) {
    const directUser = session.player1.id === seat.participantId ? session.player1 : session.player2.id === seat.participantId ? session.player2 : null;
    if (directUser) return directUser;
    if (seat.participantId.startsWith('pet-ai-')) {
        const uid = seat.participantId.slice('pet-ai-'.length);
        return session.player1.id === uid ? session.player1 : session.player2.id === uid ? session.player2 : null;
    }
    return null;
}

function pairSeatDisplayInfo(session: LiveGameSession, seat: PairSeat): { name: string; avatarUrl: string | null; borderUrl: string | null } {
    const owner = pairSeatOwnerUser(session, seat);
    if (seat.kind === 'user') {
        const level = Math.max(1, Number(owner?.strategyLevel ?? 1) || 1);
        return {
            name: `Lv.${level} ${owner?.nickname ?? seat.name}`,
            avatarUrl: owner ? AVATAR_POOL.find((a) => a.id === owner.avatarId)?.url ?? null : null,
            borderUrl: owner ? BORDER_POOL.find((b) => b.id === owner.borderId)?.url ?? null : null,
        };
    }

    if (owner) {
        const row = getEquippedPairPetInventoryRow(owner);
        const tid = row?.templateId ?? owner.equippedPairPetTemplateId ?? undefined;
        const def = tid ? getPairPetDefinition(tid) : null;
        const meta = row ? resolvePairPetMetaFromInventoryRow(row) : null;
        const level = Math.max(1, Number(meta?.level ?? 1) || 1);
        return {
            name: `Lv.${level} ${def?.displayName ?? row?.name ?? seat.name}`,
            avatarUrl: row?.image ?? def?.image ?? null,
            borderUrl: null,
        };
    }

    const fallbackIndex = seat.participantId === 'pair-opponent-pet' ? 1 : 0;
    const fallbackDef = getPairPetDefinition(`pair-pet-${fallbackIndex + 1}`);
    return {
        name: `Lv.1 ${fallbackDef?.displayName ?? seat.name}`,
        avatarUrl: fallbackDef?.image ?? '/images/pets/pet1.webp',
        borderUrl: null,
    };
}

const formatPairClock = (seconds: number): string => {
    const total = Math.max(0, Math.floor(seconds));
    const hrs = Math.floor(total / 3600);
    const min = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    return hrs > 0
        ? `${String(hrs).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
        : `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const PairIngamePlayerCard: React.FC<{ session: LiveGameSession; seat: PairSeat; compact?: boolean; mirror?: boolean }> = ({ session, seat, compact = false, mirror = false }) => {
    const currentSeat = getCurrentPairTurnSeat(session.settings);
    const active = currentSeat?.seatId === seat.seatId && session.gameStatus === 'playing';
    const black = seat.player === Player.Black;
    const passed = session.settings.pairGame?.passSeatIds?.includes(seat.seatId);
    const display = pairSeatDisplayInfo(session, seat);
    const seatNumber = pairSeatShortLabel(seat.seatId).replace(/\D/g, '');
    const nameMatch = /^Lv\.(\d+)\s+(.+)$/.exec(display.name);
    const levelText = nameMatch ? `Lv.${nameMatch[1]}` : '';
    const nickname = nameMatch ? nameMatch[2] : display.name;
    return (
        <div
            className={`relative min-w-0 overflow-hidden rounded-xl border shadow-xl ${
                compact ? 'px-2 py-2' : 'px-3 py-3'
            } ${
                active
                    ? 'border-amber-300/85 bg-gradient-to-br from-amber-700 via-stone-950 to-black text-amber-50 shadow-[0_0_24px_rgba(251,191,36,0.30)]'
                    : black
                      ? 'border-slate-500/55 bg-gradient-to-br from-slate-900 via-slate-950 to-black text-slate-100'
                      : 'border-amber-200/75 bg-gradient-to-br from-amber-50 via-stone-100 to-white text-slate-950'
            }`}
        >
            {seatNumber ? (
                <span className={`absolute left-2 top-2 z-[1] flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-black ${black ? 'bg-black/75 text-slate-100' : 'bg-white/85 text-slate-950'}`}>
                    {seatNumber}
                </span>
            ) : null}
            {passed ? (
                <span className={`absolute right-2 top-2 z-[1] text-[10px] font-black ${black ? 'text-sky-200' : 'text-sky-700'}`}>통과</span>
            ) : null}
            <div className="flex h-full min-w-0 items-center justify-center gap-2 text-center">
                <Avatar
                    userId={seat.participantId}
                    userName={display.name}
                    avatarUrl={display.avatarUrl || (seat.kind === 'pet' ? '/images/pets/pet1.webp' : '/images/profiles/profile1.png')}
                    borderUrl={display.borderUrl}
                    size={compact ? 42 : 48}
                />
                <div className="flex min-w-0 items-center justify-center gap-1.5">
                    {levelText ? (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${black ? 'bg-slate-100/12 text-amber-100' : 'bg-slate-900/10 text-slate-700'}`}>
                            {levelText}
                        </span>
                    ) : null}
                    <span className={`${compact ? 'text-xs' : 'text-sm'} min-w-0 truncate font-black`} title={nickname}>
                        {nickname}
                    </span>
                </div>
            </div>
            {active ? <div className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-amber-300" aria-hidden /> : null}
        </div>
    );
};

const PairTeamSummaryPanel: React.FC<{ session: LiveGameSession; player: Player.Black | Player.White; clientTimes: PairClientTimes; mirror?: boolean; compact?: boolean }> = ({ session, player, clientTimes, mirror = false, compact = false }) => {
    const black = player === Player.Black;
    const colorTime = black ? clientTimes.black : clientTimes.white;
    const mainTime = black ? session.blackTimeLeft : session.whiteTimeLeft;
    const byoyomiPeriods = black ? session.blackByoyomiPeriodsLeft : session.whiteByoyomiPeriodsLeft;
    const byoyomiTime = Math.max(1, Number(session.settings.byoyomiTime ?? 0));
    const mainTimeTotal = Math.max(1, Number(session.settings.timeLimit ?? 0) * 60);
    const inByoyomi = Number(mainTime ?? 0) <= 0 && byoyomiTime > 0;
    const timerDenominator = inByoyomi ? byoyomiTime : mainTimeTotal;
    const timerPercent = Math.max(0, Math.min(100, (colorTime / timerDenominator) * 100));
    const score = session.captures?.[player] ?? 0;
    const scoreBox = (
        <div className={`min-w-[5.25rem] rounded-xl border ${compact ? 'px-4 py-2.5' : 'px-5 py-3'} text-center ${black ? 'border-slate-600 bg-black' : 'border-amber-300 bg-white'}`}>
            <div className="text-xs font-black opacity-70">점수</div>
            <div className={`font-mono ${compact ? 'text-4xl' : 'text-5xl'} font-black leading-none tabular-nums`}>{score}</div>
        </div>
    );
    const timerBox = (
        <div className="min-w-0 flex-1">
            <div className={`flex items-center gap-2 ${mirror ? 'justify-end text-right' : ''}`}>
                <span className="font-mono text-lg font-black tabular-nums">{formatPairClock(colorTime)}</span>
                <span className={`flex items-center gap-1 font-mono text-sm font-black tabular-nums ${inByoyomi ? 'text-red-400' : ''}`}>
                    <img src="/images/timer.webp" alt="초읽기" className="h-5 w-5 object-contain" />
                    {Math.max(0, Number(byoyomiPeriods ?? session.settings.byoyomiCount ?? 0))}
                </span>
            </div>
            <div className={`mt-1.5 h-2.5 w-full overflow-hidden rounded-full ${black ? 'bg-slate-700' : 'bg-amber-200'}`}>
                <div
                    className={`h-full rounded-full ${inByoyomi ? 'bg-red-500' : black ? 'bg-sky-400' : 'bg-amber-500'}`}
                    style={{ width: `${timerPercent}%` }}
                />
            </div>
        </div>
    );
    return (
        <div className={`rounded-xl border p-2 shadow-xl ${compact ? 'min-w-[18rem]' : ''} ${black ? 'border-slate-500/65 bg-slate-950 text-slate-100' : 'border-amber-200/85 bg-amber-50 text-slate-950'}`}>
            <div className="flex items-center gap-2">
                {mirror ? <>{scoreBox}{timerBox}</> : <>{timerBox}{scoreBox}</>}
            </div>
        </div>
    );
};

const PairMoveCountBox: React.FC<{ session: LiveGameSession }> = ({ session }) => {
    const moveCount = session.moveHistory?.length ?? 0;
    return (
        <div className="flex h-full min-w-[5.25rem] flex-col items-center justify-center rounded-2xl border border-amber-300/60 bg-black/75 px-3 py-2 text-center text-amber-50 shadow-xl ring-1 ring-amber-400/20">
            <div className="text-[11px] font-black tracking-[0.22em] text-amber-200/85">수순</div>
            <div className="font-mono text-3xl font-black leading-none tabular-nums">{moveCount}</div>
        </div>
    );
};

const PairMobileTeamPanel: React.FC<{
    session: LiveGameSession;
    clientTimes: PairClientTimes;
    player: Player.Black | Player.White;
}> = ({ session, clientTimes, player }) => {
    const black = player === Player.Black;
    const seats = sortPairSeatsBySeatId((session.settings.pairGame?.turnOrder ?? []).filter((seat) => seat.player === player));
    const colorTime = black ? clientTimes.black : clientTimes.white;
    const score = session.captures?.[player] ?? 0;

    return (
        <div className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border px-1.5 py-1 shadow-lg ${black ? 'border-slate-500/65 bg-slate-950 text-slate-100' : 'border-amber-200/85 bg-amber-50 text-slate-950'}`}>
            <div className="flex shrink-0 -space-x-2">
                {seats.map((seat) => {
                    const display = pairSeatDisplayInfo(session, seat);
                    return (
                        <div key={seat.seatId} className={`rounded-full ring-2 ${black ? 'ring-slate-950' : 'ring-amber-50'}`}>
                            <Avatar
                                userId={seat.participantId}
                                userName={display.name}
                                avatarUrl={display.avatarUrl || (seat.kind === 'pet' ? '/images/pets/pet1.webp' : '/images/profiles/profile1.png')}
                                borderUrl={display.borderUrl}
                                size={28}
                            />
                        </div>
                    );
                })}
            </div>
            <div className={`min-w-0 flex-1 ${black ? 'text-left' : 'text-right'}`}>
                <div className="truncate font-mono text-[12px] font-black leading-none tabular-nums">
                    {formatPairClock(colorTime)}
                </div>
                <div className={`mt-0.5 flex items-baseline gap-1 ${black ? 'justify-start' : 'justify-end'}`}>
                    <span className="text-[9px] font-black opacity-70">점수</span>
                    <span className="font-mono text-lg font-black leading-none tabular-nums">{score}</span>
                </div>
            </div>
        </div>
    );
};

const PairMobileMoveCountBox: React.FC<{ session: LiveGameSession }> = ({ session }) => {
    const moveCount = session.moveHistory?.length ?? 0;
    return (
        <div className="flex min-w-[3.6rem] flex-col items-center justify-center rounded-xl border border-amber-300/55 bg-black/75 px-2 py-1 text-center text-amber-50 shadow-lg ring-1 ring-amber-400/15">
            <div className="text-[9px] font-black tracking-[0.16em] text-amber-200/85">수순</div>
            <div className="font-mono text-xl font-black leading-none tabular-nums">{moveCount}</div>
        </div>
    );
};

const PairIngameTeamGroup: React.FC<{
    session: LiveGameSession;
    clientTimes: PairClientTimes;
    player: Player.Black | Player.White;
}> = ({ session, clientTimes, player }) => {
    const all = session.settings.pairGame?.turnOrder ?? [];
    const seats = sortPairSeatsBySeatId(all.filter((seat) => seat.player === player));
    const black = player === Player.Black;
    const mirror = !black;

    if (!seats.length) return null;

    return (
        <div className={`flex min-w-0 flex-1 items-stretch gap-2 ${mirror ? 'flex-row-reverse justify-start' : 'justify-end'}`}>
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                {seats.map((seat) => (
                    <PairIngamePlayerCard key={seat.seatId} session={session} seat={seat} compact mirror={mirror} />
                ))}
            </div>
            <PairTeamSummaryPanel session={session} player={player} clientTimes={clientTimes} mirror={mirror} compact />
        </div>
    );
};

const PairIngameTopPanel: React.FC<{ session: LiveGameSession; clientTimes: PairClientTimes; mobile?: boolean }> = ({
    session,
    clientTimes,
    mobile = false,
}) => {
    if (mobile) {
        return (
            <div className="flex w-full shrink-0 items-stretch gap-1 px-1 pb-1">
                <PairMobileTeamPanel session={session} player={Player.Black} clientTimes={clientTimes} />
                <PairMobileMoveCountBox session={session} />
                <PairMobileTeamPanel session={session} player={Player.White} clientTimes={clientTimes} />
            </div>
        );
    }

    return (
        <div className="flex w-full shrink-0 flex-col gap-2 px-1 pb-2 lg:flex-row lg:items-stretch">
            <PairIngameTeamGroup session={session} player={Player.Black} clientTimes={clientTimes} />
            <PairMoveCountBox session={session} />
            <PairIngameTeamGroup session={session} player={Player.White} clientTimes={clientTimes} />
        </div>
    );
};

const isSamePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

const isUnrevealedUserHiddenStoneAt = (game: LiveGameSession, x: number, y: number): boolean => {
    if (!game.moveHistory || !game.hiddenMoves) return false;

    for (let i = game.moveHistory.length - 1; i >= 0; i--) {
        const move = game.moveHistory[i];
        if (move.x !== x || move.y !== y) continue;
        if (move.player !== Player.Black) return false;
        if (!game.hiddenMoves[i]) return false;
        return !(game.permanentlyRevealedStones || []).some(point => isSamePoint(point, { x, y }));
    }

    return false;
};

const getMaskedBoardForHiddenAi = (game: LiveGameSession, boardState: Player[][]): Player[][] => {
    const maskedBoard = boardState.map(row => [...row]);
    if (!game.moveHistory || !game.hiddenMoves) {
        return maskedBoard;
    }

    for (let i = 0; i < game.moveHistory.length; i++) {
        const move = game.moveHistory[i];
        if (move.player !== Player.Black || !game.hiddenMoves[i]) continue;
        if ((game.permanentlyRevealedStones || []).some(point => isSamePoint(point, { x: move.x, y: move.y }))) continue;
        if (maskedBoard[move.y]?.[move.x] === Player.Black) {
            maskedBoard[move.y][move.x] = Player.None;
        }
    }

    return maskedBoard;
};

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

interface GameComponentProps {
    session: LiveGameSession;
}

const Game: React.FC<GameComponentProps> = ({ session }) => {
    const {
        currentUser,
        currentUserWithStatus,
        handlers,
        onlineUsers,
        waitingRoomChats,
        gameChats,
        negotiations,
        activeNegotiation,
        settings,
        updateFeatureSetting,
        isNativeMobile,
    } = useAppContext();
    const { id: gameId, currentPlayer, gameStatus, player1, player2, mode, blackPlayerId, whitePlayerId } = session;

    if (!player1?.id || !player2?.id || !currentUser || !currentUserWithStatus) {
        return <div className="flex items-center justify-center min-h-screen">플레이어 정보를 불러오는 중...</div>;
    }

    const [confirmModalType, setConfirmModalType] = useState<'resign' | null>(null);
    const [showResultModal, setShowResultModal] = useState(false);
    const delayedResultModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [showFinalTerritory, setShowFinalTerritory] = useState(false);
    const [justScanned, setJustScanned] = useState(false);
    const [pendingMove, setPendingMove] = useState<Point | null>(null);
    useEffect(() => {
        if (!settings.features.moveConfirmButtonBox) setPendingMove(null);
    }, [settings.features.moveConfirmButtonBox]);
    const [isAnalysisActive, setIsAnalysisActive] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [spIngameOnboardingStep, setSpIngameOnboardingStep] = useState(-1);
    const [intro1DemoMoveDone, setIntro1DemoMoveDone] = useState(false);

    useEffect(() => {
        const handler = (e: Event) => {
            const d = (e as CustomEvent<number>).detail;
            if (typeof d === 'number') setSpIngameOnboardingStep(d);
        };
        window.addEventListener(ONBOARDING_INGAME_SP_STEP_EVENT, handler as EventListener);
        return () => window.removeEventListener(ONBOARDING_INGAME_SP_STEP_EVENT, handler as EventListener);
    }, []);

    useEffect(() => {
        setIntro1DemoMoveDone(false);
    }, [session.id]);
    const [resumeCountdown, setResumeCountdown] = useState(0);
    const pauseStartedAtRef = useRef<number | null>(null);
    const pauseCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [pauseButtonCooldown, setPauseButtonCooldown] = useState(0);
    // 연속 클릭 방지: 수 처리 중에는 추가 클릭 무시
    const [isMoveInFlight, setIsMoveInFlight] = useState(false);
    /** 싱글/타워: 클라 착수는 setState 전에 동기적으로 막아야 같은 틱·연속 클릭으로 수순이 두 번 밀리지 않음 */
    const pveLocalStonePlacementLockRef = useRef(false);
    /** 전략·모험·길드전 등 온라인 AI 대국: 낙관적 착수~서버 PLACE_STONE 완료까지 동기적으로 중복 클릭 차단 */
    const strategicAiStoneLockRef = useRef(false);
    const [boardRuleFlashMessage, setBoardRuleFlashMessage] = useState<string | null>(null);
    const boardRuleFlashClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isPausableAiGameForTimer =
        session.isAiGame &&
        !session.isSinglePlayer &&
        session.gameCategory !== 'tower' &&
        session.gameCategory !== 'singleplayer' &&
        session.gameCategory !== 'guildwar' &&
        session.gameCategory !== 'adventure';
    const clientTimes = useClientTimer(
        session,
        session.isSinglePlayer ||
            session.gameCategory === 'tower' ||
            session.gameCategory === 'adventure' ||
            isPausableAiGameForTimer
            ? { isPaused }
            : {}
    );
    const [isAiRematchModalOpen, setIsAiRematchModalOpen] = useState(false);
    // 싱글플레이 고급 히든: AI 히든 아이템 연출 종료 시각 (이 시각까지 바둑판 패널 테두리만 빛남)
    const [aiHiddenItemEffectEndTime, setAiHiddenItemEffectEndTime] = useState<number | null>(null);
    const aiHiddenMoveExecutedRef = useRef(false);
    /** 탑·싱글: 서버 ai_thinking 만료 후 REQUEST_SERVER_AI_MOVE를 이미 보낸 경우 `${gameId}:${endTime}` */
    const pveAiHiddenPostAnimRequestDoneRef = useRef<string | null>(null);
    const sessionRefForPveAiHiddenFollowup = useRef(session);
    sessionRefForPveAiHiddenFollowup.current = session;
    // 연출 중 시간 경과로 빛/일시정지 갱신용 (0.5초마다)
    const [effectTick, setEffectTick] = useState(0);

    // 보드 잠금 메커니즘: AI가 돌을 둔 직후 최신 serverRevision을 받을 때까지 보드 잠금
    const [lastReceivedServerRevision, setLastReceivedServerRevision] = useState<number>(session.serverRevision ?? 0);
    const [isBoardLocked, setIsBoardLocked] = useState(false);
    
    // isSpectator를 먼저 선언 (isBoardRotated 초기화에서 사용)
    const isSpectator = useMemo(() => currentUserWithStatus?.status === 'spectating', [currentUserWithStatus]);
    
    // 바둑판 회전: 백 진영만 기본 회전(AI 대국도 흑/백 좌석으로만 결정). 새로고침 시 currentPlayer에 따른 분기는 180° 뒤집힘을 유발하므로 제외.
    const [isBoardRotated, setIsBoardRotated] = useState(() => {
        try {
            if (typeof sessionStorage !== 'undefined') {
                const storedState = sessionStorage.getItem(`gameState_${gameId}`);
                if (storedState) {
                    const parsed = JSON.parse(storedState);
                    if (parsed.gameId === gameId && typeof parsed.isBoardRotated === 'boolean') {
                        return parsed.isBoardRotated;
                    }
                }
            }
        } catch {
            /* ignore */
        }
        if (isSpectator) return false;
        return whitePlayerId === currentUser.id;
    });
    
    const prevGameStatus = usePrevious(gameStatus);
    const prevCurrentPlayer = usePrevious(currentPlayer);
    const prevCaptures = usePrevious(session.captures);
    const prevAnimationType = usePrevious(session.animation?.type);
    const warningSoundPlayedForTurn = useRef(false);
    /** 주사위/도둑: lastMove·moveHistory 보강 이펙트가 같은 착점에서 placeStone을 두 번 재생하지 않도록 */
    const lastDiceThiefPlaceSoundKeyRef = useRef<string>('');
    /** 전략바둑·오목류: lastMove만으로는 낙관적/모바일 확정 경로에서 갱신이 빠져 소리가 안 날 수 있어 moveHistory 꼬리로 통일 */
    const strategicPlaceSoundKeyRef = useRef<string>('');
    /** 수순이 짧아지는 재동기화(히든 공개 후 턴 유지 등)에서 꼬리만 바뀌며 착점 소리가 나는 오탐 방지 */
    const strategicPlaceSoundGameIdRef = useRef<string>('');
    const strategicPlaceHistoryLenRef = useRef<number | undefined>(undefined);
    const prevMoveCount = usePrevious(session.moveHistory?.length);
    const myBaseStoneCountForUnlock = useMemo(() => {
        if (gameStatus !== 'base_placement') return undefined;
        const stones = currentUser.id === player1.id ? session.baseStones_p1 : session.baseStones_p2;
        return stones?.length ?? 0;
    }, [gameStatus, currentUser.id, player1.id, session.baseStones_p1, session.baseStones_p2]);
    const prevMyBaseStoneCountForUnlock = usePrevious(myBaseStoneCountForUnlock);
    const prevAnalysisResult = usePrevious(session.analysisResult?.['system']);
    const isSinglePlayer = session.isSinglePlayer;
    const onboardingUserPhase = currentUserWithStatus.onboardingTutorialPhase ?? -1;
    const isIntro1SpOnboardingUi =
        isSinglePlayer &&
        session.stageId === '입문-1' &&
        gameStatus === 'playing' &&
        isOnboardingTutorialActive(currentUserWithStatus) &&
        onboardingUserPhase === 6;

    /** 오버레이 이벤트 순서/USER_UPDATE 지연 시에도 스텝 0이 잡히도록 data-onboarding-target 동기화 */
    useEffect(() => {
        if (!session.isSinglePlayer || session.stageId !== '입문-1' || gameStatus !== 'playing') {
            setSpIngameOnboardingStep(-1);
            return;
        }
        if (!isOnboardingTutorialActive(currentUserWithStatus)) return;
        if (onboardingUserPhase !== 6) return;
        setSpIngameOnboardingStep((s) => (s < 0 ? 0 : s));
    }, [
        session.isSinglePlayer,
        session.stageId,
        gameStatus,
        currentUserWithStatus,
        onboardingUserPhase,
    ]);

    const restrictIntro1OnboardingMove = shouldRestrictIntro1OnboardingFirstMove({
        stageId: session.stageId,
        gameStatus,
        userPhase: onboardingUserPhase,
        ingameSubStep: spIngameOnboardingStep,
        demoMoveDone: intro1DemoMoveDone,
        moveHistoryLength: session.moveHistory?.length ?? 0,
    });
    const singlePlayerOnboardingBarHighlight =
        isIntro1SpOnboardingUi && spIngameOnboardingStep === 0
            ? ('user-panel' as const)
            : isIntro1SpOnboardingUi && spIngameOnboardingStep === 1
              ? ('scores-bar' as const)
              : null;
    const intro1OnboardingDemoPoint = restrictIntro1OnboardingMove ? ONBOARDING_INTRO1_FORCED_CAPTURE_POINT : null;
    const isTower = session.gameCategory === 'tower';
    const isAdventureGame = session.gameCategory === 'adventure';
    const isGuildWarGame = session.gameCategory === 'guildwar';
    const adventureBackgroundImage =
        isAdventureGame && session.adventureStageId ? getAdventureMapWebpPath(session.adventureStageId) : null;
    const isGuildWarTowerStyleUi =
        isGuildWarGame && (mode === GameMode.Missile || mode === GameMode.Hidden);
    const isPlayfulMode = PLAYFUL_GAME_MODES.some(m => m.mode === mode);
    /** 종료·계가·재대결 대기 등에서는 착수 패널이 뷰포트/사이드바를 가리지 않도록 숨김 */
    const hideMoveConfirmForStatus: GameStatus[] = ['ended', 'no_contest', 'scoring', 'rematch_pending', 'disconnected'];
    const showMoveConfirmPanel =
        !isPlayfulMode && settings.features.moveConfirmButtonBox && !hideMoveConfirmForStatus.includes(gameStatus);
    const aiHiddenTurnsFromSession = (session as any).aiHiddenItemTurns;
    const plannedAiHiddenTurns = Array.isArray(aiHiddenTurnsFromSession)
        ? aiHiddenTurnsFromSession
            .map((turn: unknown) => Number(turn))
            .filter((turn: number) => Number.isInteger(turn) && turn > 0)
            .sort((a: number, b: number) => a - b)
        : (() => {
            const legacyTurn = Number((session as any).aiHiddenItemTurn ?? 0);
            return Number.isInteger(legacyTurn) && legacyTurn > 0 ? [legacyTurn] : [];
        })();
    const aiHiddenItemsUsedCount = Math.max(
        0,
        Number(
            (session as any).aiHiddenItemsUsedCount ??
            ((session as any).aiHiddenItemUsed ? (plannedAiHiddenTurns.length || 1) : 0)
        )
    );
    const nextAiHiddenItemTurn = plannedAiHiddenTurns[aiHiddenItemsUsedCount];
    const isTowerHiddenStage = isTower && (session.towerFloor ?? 0) >= 21 && plannedAiHiddenTurns.length > 0;
    const isGuildWarHiddenPresentation =
        isGuildWarGame && mode === GameMode.Hidden && ((session.settings?.hiddenStoneCount ?? 0) > 0);
    const isAiHiddenPresentationStage =
        (isSinglePlayer && ((session.settings?.hiddenStoneCount ?? 0) > 0)) ||
        isTowerHiddenStage ||
        isGuildWarHiddenPresentation;
    /** 온라인 대기실 히든/믹스(히든): 스캔 연출 후 서버 WS가 늦을 때 로컬에서 playing 복귀 */
    const isOnlineHiddenStrategic =
        !isSinglePlayer &&
        !isTower &&
        !isGuildWarGame &&
        (mode === GameMode.Hidden ||
            (mode === GameMode.Mix && !!session.settings?.mixedModes?.includes?.(GameMode.Hidden)) ||
            ((session.settings as { hiddenStoneCount?: number })?.hiddenStoneCount ?? 0) > 0);
    // 전략바둑 AI/PVP 수순 제한: 새로고침 후 totalTurns·moveHistory 복원/저장에 포함
    const hasStrategicTurnLimit =
        mode !== GameMode.Capture &&
        ((session.settings?.scoringTurnLimit ?? 0) > 0 || ((session.settings as any)?.autoScoringTurns ?? 0) > 0);
    /** 모험 포함: 새로고침 시 sessionStorage와 병합해 남은 턴·경과 시간이 초기화되지 않게 함 */
    const useRefreshSessionStorageMerge =
        isAdventureGame || isSinglePlayer || isTower || hasStrategicTurnLimit;

    // 클라이언트에서 게임 상태 저장/복원 (새로고침 시 바둑판 복원)
    const GAME_STATE_STORAGE_KEY = `gameState_${gameId}`;
    
    // 게임 상태를 sessionStorage에서 복원 (종료 후에도 결과 모달 동안 종료된 화면 유지를 위해 ended/scoring에서도 복원 허용)
    const restoredBoardState = useMemo(() => {
        // PVE(싱글/탑/모험)는 서버 보드 동기화를 절대 우선한다.
        // sessionStorage 복원 보드를 우선하면 히든/포획/애니메이션 경합에서 돌 소실이 발생할 수 있다.
        if ((isSinglePlayer || isTower || isAdventureGame) && session.boardState && Array.isArray(session.boardState) && session.boardState.length > 0) {
            return session.boardState;
        }
        try {
            const storedState = sessionStorage.getItem(GAME_STATE_STORAGE_KEY);
            if (storedState) {
                const parsed = JSON.parse(storedState);
                    if (parsed.gameId === gameId && parsed.boardState && Array.isArray(parsed.boardState) && parsed.boardState.length > 0) {
                    const serverRound = session.round ?? 1;
                    const storedRound = typeof parsed.round === 'number' ? parsed.round : 1;
                    // 라운드가 바뀌면 sessionStorage의 온 판·수순은 무효. 서버가 클리어 후 새 백돌 배치를 내도
                    // moveHistory 길이 비교만으로는 서버를 택하지 못해 2라운드에서 1라운드 판에 멈춘다.
                    if (serverRound !== storedRound) {
                        // 주사위/도둑: 라운드가 바뀌면 sessionStorage 판을 절대 쓰지 않음(아래 분기에서 온 판이 덮어씌워져 빈 판 고착)
                        if (session.mode === GameMode.Dice || session.mode === GameMode.Thief) {
                            return session.boardState;
                        }
                        if (
                            session.boardState &&
                            Array.isArray(session.boardState) &&
                            session.boardState.length > 0
                        ) {
                            return session.boardState;
                        }
                    }
                    // 도둑/주사위: 서버가 라운드·역할 전환으로 기보를 비웠는데 sessionStorage에는 예전 수순이 남아 있으면 온 판을 쓰면 2라운드에도 1라운드 돌이 보임
                    if (
                        (session.mode === GameMode.Thief || session.mode === GameMode.Dice) &&
                        (session.moveHistory?.length ?? 0) === 0 &&
                        Array.isArray(parsed.moveHistory) &&
                        parsed.moveHistory.length > 0
                    ) {
                        if (session.boardState && Array.isArray(session.boardState) && session.boardState.length > 0) {
                            const hasStone = session.boardState.some((row: Player[]) =>
                                row.some((c) => c !== Player.None)
                            );
                            if (!hasStone) return session.boardState;
                        }
                        const bs = session.settings.boardSize;
                        return Array(bs)
                            .fill(null)
                            .map(() => Array(bs).fill(Player.None));
                    }
                    // 서버 moveHistory가 더 길면 서버가 최신(AI 수 등) → 서버 boardState 또는 moveHistory 복원 (AI가 둔 수가 사라지는 버그 방지)
                    const serverMoveCount = session.moveHistory?.length ?? 0;
                    const storedMoveCount = parsed.moveHistory?.length ?? 0;
                    if (serverMoveCount > storedMoveCount) {
                        if (session.boardState && Array.isArray(session.boardState) && session.boardState.length > 0) {
                            console.log(`[Game] Using server boardState (server moves: ${serverMoveCount}, stored: ${storedMoveCount}) for game ${gameId}`);
                            return session.boardState;
                        }
                        // IMPORTANT: moveHistory 기반 단순 복원은 포획을 반영하지 못해 "없던 돌이 생김" 버그를 만든다.
                        // 서버 boardState가 비어 있으면, 일단 저장된 boardState(포획 반영)를 유지한다.
                        console.warn(`[Game] Server has more moves but no boardState; keeping stored boardState to avoid capture desync (server moves: ${serverMoveCount}, stored: ${storedMoveCount}) for game ${gameId}`);
                        return parsed.boardState;
                    }
                    // 아직 한 수도 두지 않았을 때(배치변경 직후 등)는 서버 boardState 우선 → 새로 랜덤 배치가 바로 반영되도록
                    if (serverMoveCount === 0 && storedMoveCount === 0 && session.boardState && Array.isArray(session.boardState) && session.boardState.length > 0) {
                        return session.boardState;
                    }
                    // 주사위/도둑: 한 턴에 여러 돌 — 클라는 moveHistory를 늘리지 않고 boardState·stonesPlacedThisTurn만 낙관 갱신한다.
                    // moveHistory 길이가 같으면 아래에서 sessionStorage 보드를 쓰게 되는데, 저장 useEffect가 한 틱 늦어
                    // 옛 판이 덮여 "주사위 수만큼 클릭해야 돌이 한꺼번에 보이는" 현상이 난다.
                    const isMultiStonePlacingTurn =
                        gameStatus === 'dice_placing' || gameStatus === 'thief_placing';
                    if (
                        isMultiStonePlacingTurn &&
                        session.boardState &&
                        Array.isArray(session.boardState) &&
                        session.boardState.length > 0
                    ) {
                        const optimisticN = (session as LiveGameSession).stonesPlacedThisTurn?.length ?? 0;
                        if (optimisticN > 0) {
                            return session.boardState;
                        }
                        const countColor = (board: Player[][], color: Player) =>
                            board.reduce((n, row) => n + row.filter((c) => c === color).length, 0);
                        const sB = countColor(session.boardState, Player.Black);
                        const pB = countColor(parsed.boardState, Player.Black);
                        const sW = countColor(session.boardState, Player.White);
                        const pW = countColor(parsed.boardState, Player.White);
                        if (sB > pB || sW < pW) {
                            return session.boardState;
                        }
                    }
                    // 미사일: moveHistory 길이는 그대로인데 서버 보드만 돌 위치가 바뀌므로, 저장된 구판이 애니 종료 직후 잔상을 남긴다.
                    if (
                        session.boardState &&
                        Array.isArray(session.boardState) &&
                        session.boardState.length > 0 &&
                        (session.gameStatus === 'missile_animating' ||
                            (session.animation &&
                                (session.animation.type === 'missile' || session.animation.type === 'hidden_missile')))
                    ) {
                        return session.boardState;
                    }
                    // 미사일 좌표 선반영 직후 빠르게 종료/계가로 넘어가면, 저장소(gameState_*)는 직전 판일 수 있다.
                    // 이 경우에는 서버/세션의 최신 boardState를 우선해 결과 화면에서 돌 소실을 막는다.
                    const storedMissileTransition =
                        parsed.gameStatus === 'missile_animating' ||
                        parsed.gameStatus === 'missile_selecting' ||
                        (parsed.animation &&
                            (parsed.animation.type === 'missile' || parsed.animation.type === 'hidden_missile'));
                    if (
                        session.boardState &&
                        Array.isArray(session.boardState) &&
                        session.boardState.length > 0 &&
                        serverMoveCount === storedMoveCount &&
                        ['scoring', 'ended', 'no_contest', 'rematch_pending'].includes(gameStatus) &&
                        storedMissileTransition
                    ) {
                        return session.boardState;
                    }
                    // 싱글/탑: 수순 길이가 같을 때는 서버 보드가 최종(포획·미사일 반영)인 경우가 많다.
                    // 계가/종료 직후에는 sessionStorage를 더 이상 덮어쓰지 않아(아래 useEffect), 저장분이 마지막 playing의 포획 반영 판이고
                    // 서버가 포석+수순만으로 재구성한 보드면 따낸 돌이 다시 보인다(튜토리얼 USER_UPDATE 등 한 번 더 동기화될 때 포함).
                    if (
                        (isSinglePlayer || isTower) &&
                        serverMoveCount === storedMoveCount &&
                        session.boardState &&
                        Array.isArray(session.boardState) &&
                        session.boardState.length > 0 &&
                        !['scoring', 'ended', 'no_contest', 'rematch_pending'].includes(gameStatus)
                    ) {
                        return session.boardState;
                    }
                    // 진행 중이거나 종료/계가 중일 때 모두 sessionStorage 보드 사용 → 결과 모달 시에도 바둑판 유지
                    console.log(`[Game] Restored boardState from sessionStorage for game ${gameId} (gameStatus: ${gameStatus})`);
                    return parsed.boardState;
                }
            }
        } catch (e) {
            console.error(`[Game] Failed to restore game state from sessionStorage:`, e);
        }
        
        // sessionStorage에 없으면 서버에서 받은 boardState 사용
        if (session.boardState && Array.isArray(session.boardState) && session.boardState.length > 0) {
            return session.boardState;
        }
        
        // 싱글플레이어 게임과 도전의 탑 게임의 경우 blackPatternStones와 whitePatternStones로부터 복원
        if ((isSinglePlayer || isTower) && (session.blackPatternStones || session.whitePatternStones)) {
            const boardSize = session.settings.boardSize;
            const restored = Array(boardSize).fill(null).map(() => Array(boardSize).fill(Player.None));
            
            // blackPatternStones 복원
            if (session.blackPatternStones && Array.isArray(session.blackPatternStones)) {
                for (const stone of session.blackPatternStones) {
                    if (stone.x >= 0 && stone.x < boardSize && stone.y >= 0 && stone.y < boardSize) {
                        restored[stone.y][stone.x] = Player.Black;
                    }
                }
            }
            
            // whitePatternStones 복원
            if (session.whitePatternStones && Array.isArray(session.whitePatternStones)) {
                for (const stone of session.whitePatternStones) {
                    if (stone.x >= 0 && stone.x < boardSize && stone.y >= 0 && stone.y < boardSize) {
                        restored[stone.y][stone.x] = Player.White;
                    }
                }
            }
            
            // moveHistory를 통해 이후의 수를 복원
            if (session.moveHistory && Array.isArray(session.moveHistory)) {
                for (const move of session.moveHistory) {
                    if (move.x >= 0 && move.x < boardSize && move.y >= 0 && move.y < boardSize) {
                        restored[move.y][move.x] = move.player;
                    }
                }
            }
            
            return restored;
        }
        
        return session.boardState;
    }, [
        isSinglePlayer,
        isTower,
        session.boardState,
        session.blackPatternStones,
        session.whitePatternStones,
        session.moveHistory?.length,
        session.settings.boardSize,
        gameId,
        gameStatus,
        session.round,
        session.mode,
        session.stonesPlacedThisTurn?.length,
        session.stonesToPlace,
    ]);
    
    // 게임 상태를 sessionStorage에 저장 (매 수마다).
    // 종료 직전 마지막 착수(문양 소모/재착수 포함)도 결과창에서 일치하도록 종료 상태에서도 최신 스냅샷을 저장한다.
    useEffect(() => {
        if (restoredBoardState && Array.isArray(restoredBoardState) && restoredBoardState.length > 0) {
            try {
                // totalTurns: 서버가 비워 보낸 경우(새로고침 직후) 기존 sessionStorage 값 유지 (자동계가까지 남은 턴이 Max로 초기화되는 버그 방지)
                let totalTurnsToSave = session.totalTurns;
                if ((totalTurnsToSave == null || totalTurnsToSave === 0) && useRefreshSessionStorageMerge) {
                    try {
                        const stored = sessionStorage.getItem(GAME_STATE_STORAGE_KEY);
                        if (stored) {
                            const parsed = JSON.parse(stored);
                            if (parsed.gameId === gameId && typeof parsed.totalTurns === 'number' && parsed.totalTurns > 0) {
                                totalTurnsToSave = parsed.totalTurns;
                            }
                        }
                    } catch { /* ignore */ }
                    if (totalTurnsToSave == null || totalTurnsToSave === 0) {
                        const validCount = (session.moveHistory || []).filter((m: { x: number; y: number }) => m.x !== -1 && m.y !== -1).length;
                        if (validCount > 0) totalTurnsToSave = validCount;
                    }
                }
                const gameStateToSave = {
                    gameId,
                    round: session.round ?? 1,
                    isBoardRotated,
                    boardState: restoredBoardState,
                    moveHistory: session.moveHistory || [],
                    captures: session.captures || { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
                    gameStatus: session.gameStatus,
                    currentPlayer: session.currentPlayer,
                    itemUseDeadline: session.itemUseDeadline,
                    pausedTurnTimeLeft: session.pausedTurnTimeLeft,
                    turnDeadline: session.turnDeadline,
                    turnStartTime: session.turnStartTime,
                    revealAnimationEndTime: session.revealAnimationEndTime,
                    animation: session.animation,
                    ...((session as any).aiHiddenItemAnimationEndTime != null
                        ? { aiHiddenItemAnimationEndTime: (session as any).aiHiddenItemAnimationEndTime }
                        : {}),
                    pendingCapture: session.pendingCapture,
                    newlyRevealed: session.newlyRevealed || [],
                    revealedHiddenMoves: session.revealedHiddenMoves || {},
                    baseStoneCaptures: session.baseStoneCaptures,
                    hiddenStoneCaptures: session.hiddenStoneCaptures,
                    permanentlyRevealedStones: session.permanentlyRevealedStones || [],
                    blackPatternStones: session.blackPatternStones,
                    whitePatternStones: session.whitePatternStones,
                    consumedPatternIntersections: (session as any).consumedPatternIntersections,
                    hiddenMoves: session.hiddenMoves || {},
                    hidden_stones_p1: (session as any).hidden_stones_p1,
                    hidden_stones_p2: (session as any).hidden_stones_p2,
                    aiInitialHiddenStone: (session as any).aiInitialHiddenStone,
                    aiInitialHiddenStoneIsPrePlaced: (session as any).aiInitialHiddenStoneIsPrePlaced,
                    totalTurns: totalTurnsToSave,
                    gameStartTime: session.gameStartTime,
                    blackTimeLeft: session.blackTimeLeft,
                    whiteTimeLeft: session.whiteTimeLeft,
                    adventureEncounterDeadlineMs: (session as any).adventureEncounterDeadlineMs,
                    adventureEncounterFrozenHumanMsRemaining: (session as any).adventureEncounterFrozenHumanMsRemaining,
                    ...(session.gameCategory === 'tower' && (session as any).blackTurnLimitBonus != null
                        ? { blackTurnLimitBonus: Number((session as any).blackTurnLimitBonus) || 0 }
                        : {}),
                    timestamp: Date.now()
                };
                sessionStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(gameStateToSave));
            } catch (e) {
                console.error(`[Game] Failed to save game state to sessionStorage:`, e);
            }
        }
    }, [restoredBoardState, session.moveHistory, session.captures, session.gameStatus, session.currentPlayer, session.itemUseDeadline, session.pausedTurnTimeLeft, session.turnDeadline, session.turnStartTime, session.revealAnimationEndTime, session.animation, (session as any).aiHiddenItemAnimationEndTime, session.pendingCapture, session.newlyRevealed, session.revealedHiddenMoves, session.baseStoneCaptures, session.hiddenStoneCaptures, session.permanentlyRevealedStones, session.blackPatternStones, session.whitePatternStones, (session as any).consumedPatternIntersections, session.hiddenMoves, session.totalTurns, session.round, gameId, gameStatus, isSinglePlayer, session.gameCategory, useRefreshSessionStorageMerge, session.gameStartTime, session.blackTimeLeft, session.whiteTimeLeft, (session as any).adventureEncounterDeadlineMs, (session as any).adventureEncounterFrozenHumanMsRemaining, (session as any).hidden_stones_p1, (session as any).hidden_stones_p2, (session as any).aiInitialHiddenStone, (session as any).aiInitialHiddenStoneIsPrePlaced, (session as any).blackTurnLimitBonus, isBoardRotated]);
    
    // 도전의 탑/싱글/전략바둑 수순 제한: 새로고침 후 서버 페이로드에 문양돌·totalTurns·moveHistory가 없을 수 있으므로 sessionStorage에서 복원해 표시
    const sessionWithRestoredPatternStones = useMemo(() => {
        if (!useRefreshSessionStorageMerge) return session;
        let next = session;
        try {
            const stored = sessionStorage.getItem(GAME_STATE_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.gameId === gameId) {
                    const storedMoveCount = Array.isArray(parsed.moveHistory) ? parsed.moveHistory.length : 0;
                    const serverMoveCount = Array.isArray(next.moveHistory) ? next.moveHistory.length : 0;
                    const canPreferStoredVisualState = storedMoveCount >= serverMoveCount;
                    // 스토리지는 useEffect 저장보다 한 틱 늦게 갱신될 수 있음. scanning_animating·missile_animating을 여기 넣으면
                    // 서버가 이미 playing인데 저장분이 애니메이션 상태라 본경기를 덮어 "스캔 연속 사용 후 재개 불가"가 된다.
                    const storedItemModeRecoveryStatuses: GameStatus[] = [
                        'hidden_placing',
                        'scanning',
                        'hidden_reveal_animating',
                        'hidden_final_reveal',
                        'missile_selecting',
                    ];
                    // sessionStorage는 useEffect보다 한 틱 늦게 갱신될 수 있음. 서버/세션이 이미 playing·스캔 연출 종료 등으로
                    // 앞서 나간 경우 저장된 scanning 등으로 덮으면 스캔 후 본경기로 복귀하지 못한다.
                    const serverDismissesStoredItemModeRecovery = [
                        'playing',
                        'scanning_animating',
                        'missile_animating',
                        'hidden_reveal_animating',
                        'hidden_final_reveal',
                        'scoring',
                        'ended',
                        'no_contest',
                    ].includes(next.gameStatus);
                    if (
                        !serverDismissesStoredItemModeRecovery &&
                        storedItemModeRecoveryStatuses.includes(parsed.gameStatus) &&
                        !storedItemModeRecoveryStatuses.includes(next.gameStatus)
                    ) {
                        next = {
                            ...next,
                            gameStatus: parsed.gameStatus,
                            currentPlayer: parsed.currentPlayer ?? next.currentPlayer,
                            itemUseDeadline: parsed.itemUseDeadline ?? next.itemUseDeadline,
                            pausedTurnTimeLeft: parsed.pausedTurnTimeLeft ?? next.pausedTurnTimeLeft,
                            turnDeadline: parsed.turnDeadline ?? next.turnDeadline,
                            turnStartTime: parsed.turnStartTime ?? next.turnStartTime,
                            revealAnimationEndTime: parsed.revealAnimationEndTime ?? next.revealAnimationEndTime,
                            animation: parsed.animation ?? next.animation,
                            pendingCapture: parsed.pendingCapture ?? next.pendingCapture,
                            newlyRevealed: Array.isArray(parsed.newlyRevealed) ? parsed.newlyRevealed : next.newlyRevealed,
                        };
                    }
                    const hasPattern = (session.blackPatternStones?.length ?? 0) > 0 || (session.whitePatternStones?.length ?? 0) > 0;
                    const serverHasPatternField =
                        Array.isArray(next.blackPatternStones) || Array.isArray(next.whitePatternStones);
                    const isFinalizedStatus = ['ended', 'no_contest', 'scoring'].includes(next.gameStatus);
                    // 종료/결과 상태에서는 오래된 sessionStorage 문양 좌표를 우선하면
                    // 따낸 뒤 재착수한 돌이 다시 문양으로 보일 수 있으므로 복원을 비활성화한다.
                    if (!isFinalizedStatus && (!hasPattern || canPreferStoredVisualState) && !serverHasPatternField) {
                        const storedBlack = Array.isArray(parsed.blackPatternStones) ? parsed.blackPatternStones : null;
                        const storedWhite = Array.isArray(parsed.whitePatternStones) ? parsed.whitePatternStones : null;
                        if (storedBlack || storedWhite) {
                            next = { ...next, blackPatternStones: storedBlack ?? next.blackPatternStones, whitePatternStones: storedWhite ?? next.whitePatternStones };
                        }
                    }
                    if (
                        !Array.isArray((next as any).consumedPatternIntersections) &&
                        Array.isArray(parsed.consumedPatternIntersections)
                    ) {
                        next = { ...next, consumedPatternIntersections: parsed.consumedPatternIntersections } as any;
                    }
                    // 턴 제한 경기: totalTurns가 없거나 0이면 sessionStorage 값으로 복원 (남은 턴이 Max로 초기화되는 현상 방지)
                    const serverTotalTurns = next.totalTurns;
                    if ((serverTotalTurns === undefined || serverTotalTurns === null || serverTotalTurns === 0) && typeof parsed.totalTurns === 'number' && parsed.totalTurns > 0) {
                        next = { ...next, totalTurns: parsed.totalTurns };
                    }
                    const storedTurns = typeof parsed.totalTurns === 'number' ? parsed.totalTurns : 0;
                    const srvTurns = Number(serverTotalTurns ?? 0);
                    if (storedTurns > srvTurns && storedTurns > 0) {
                        next = { ...next, totalTurns: storedTurns };
                    }
                    if (isAdventureGame || hasStrategicTurnLimit) {
                        if (
                            typeof parsed.gameStartTime === 'number' &&
                            parsed.gameStartTime > 0 &&
                            (!(next as any).gameStartTime || (next as any).gameStartTime <= 0)
                        ) {
                            next = { ...next, gameStartTime: parsed.gameStartTime } as any;
                        }
                        const pAdv = (parsed as any).adventureEncounterDeadlineMs;
                        const nAdv = (next as any).adventureEncounterDeadlineMs;
                        if (typeof pAdv === 'number' && pAdv > Date.now() && (typeof nAdv !== 'number' || nAdv < Date.now())) {
                            (next as any).adventureEncounterDeadlineMs = pAdv;
                        }
                        const pFr = (parsed as any).adventureEncounterFrozenHumanMsRemaining;
                        if (
                            typeof pFr === 'number' &&
                            pFr > 0 &&
                            ((next as any).adventureEncounterFrozenHumanMsRemaining == null ||
                                (next as any).adventureEncounterFrozenHumanMsRemaining <= 0)
                        ) {
                            (next as any).adventureEncounterFrozenHumanMsRemaining = pFr;
                        }
                    }
                    // INITIAL_STATE 등에서 moveHistory가 생략된 경우 복원 (남은 턴 계산에 사용)
                    const restoredServerMoveCount = next.moveHistory?.filter((m: { x: number; y: number }) => m.x !== -1 && m.y !== -1).length ?? 0;
                    if (restoredServerMoveCount === 0 && Array.isArray(parsed.moveHistory) && parsed.moveHistory.length > 0) {
                        next = { ...next, moveHistory: parsed.moveHistory };
                    }
                    // 히든 영구 공개 목록: 서버에 없거나 비어있으면 sessionStorage에서 복원 (따냄/따임·상대 착수 시도 후 새로고침 시 반영)
                    const serverRevealed = next.permanentlyRevealedStones?.length ?? 0;
                    if ((serverRevealed === 0 || canPreferStoredVisualState) && Array.isArray(parsed.permanentlyRevealedStones) && parsed.permanentlyRevealedStones.length > 0) {
                        next = { ...next, permanentlyRevealedStones: parsed.permanentlyRevealedStones };
                    }
                    // 히든 착수 정보: moveHistory 길이가 맞을 때만 복원 (서버가 한 수 앞서 있는데 저장분 hiddenMoves를 얹으면 인덱스가 밀려 유저 착수에 히든 문양이 붙는 버그)
                    const hasServerHiddenMoves = next.hiddenMoves && Object.keys(next.hiddenMoves).length > 0;
                    const hiddenMovesStorageAligned = storedMoveCount === serverMoveCount;
                    if (
                        hiddenMovesStorageAligned &&
                        parsed.hiddenMoves &&
                        Object.keys(parsed.hiddenMoves).length > 0 &&
                        (!hasServerHiddenMoves || canPreferStoredVisualState)
                    ) {
                        next = { ...next, hiddenMoves: parsed.hiddenMoves };
                    }
                    if ((canPreferStoredVisualState || !next.revealedHiddenMoves) && parsed.revealedHiddenMoves && typeof parsed.revealedHiddenMoves === 'object') {
                        next = { ...next, revealedHiddenMoves: parsed.revealedHiddenMoves };
                    }
                    // AI 히든 아이템 연출 중 새로고침: 서버 페이로드에 연출 필드가 빠진 첫 틱에 sessionStorage로 복원
                    const storedAiHiddenEnd = (parsed as any).aiHiddenItemAnimationEndTime as number | undefined;
                    const serverAiHiddenEnd = (next as any).aiHiddenItemAnimationEndTime as number | undefined;
                    if (
                        typeof storedAiHiddenEnd === 'number' &&
                        storedAiHiddenEnd > Date.now() &&
                        (parsed as any).animation?.type === 'ai_thinking' &&
                        (next.animation?.type !== 'ai_thinking' ||
                            typeof serverAiHiddenEnd !== 'number' ||
                            serverAiHiddenEnd <= Date.now())
                    ) {
                        next = {
                            ...next,
                            animation: (parsed as any).animation,
                            aiHiddenItemAnimationEndTime: storedAiHiddenEnd,
                        } as any;
                    }
                    if (canPreferStoredVisualState) {
                        next = {
                            ...next,
                            captures: parsed.captures ?? next.captures,
                            baseStoneCaptures: parsed.baseStoneCaptures ?? next.baseStoneCaptures,
                            hiddenStoneCaptures: parsed.hiddenStoneCaptures ?? next.hiddenStoneCaptures,
                            ...(parsed.aiInitialHiddenStone !== undefined ? { aiInitialHiddenStone: parsed.aiInitialHiddenStone } as any : {}),
                            ...(parsed.aiInitialHiddenStoneIsPrePlaced !== undefined ? { aiInitialHiddenStoneIsPrePlaced: parsed.aiInitialHiddenStoneIsPrePlaced } as any : {}),
                        };
                    }
                    // 히든 아이템 개수: 서버에 없으면 sessionStorage 값 사용
                    if ((next as any).hidden_stones_p1 == null && typeof parsed.hidden_stones_p1 === 'number') {
                        next = { ...next, hidden_stones_p1: parsed.hidden_stones_p1 } as any;
                    }
                    if ((next as any).hidden_stones_p2 == null && typeof parsed.hidden_stones_p2 === 'number') {
                        next = { ...next, hidden_stones_p2: parsed.hidden_stones_p2 } as any;
                    }
                    // 도전의 탑: 턴 추가 보너스 — towerGames 세션이 있으면 우선(낙관+스토리지 max로 UI만 +6 되는 것 방지). 없을 때만 스토리지.
                    if (isTower) {
                        const rawNext = (next as any).blackTurnLimitBonus;
                        const sessionHasBonus = rawNext !== undefined && rawNext !== null && String(rawNext) !== '';
                        const nb = sessionHasBonus ? Number(rawNext) : NaN;
                        const pb = Number(parsed.blackTurnLimitBonus);
                        const merged =
                            sessionHasBonus && Number.isFinite(nb)
                                ? nb
                                : Number.isFinite(pb)
                                  ? pb
                                  : 0;
                        if (sessionHasBonus || Number.isFinite(pb)) {
                            next = { ...next, blackTurnLimitBonus: merged } as any;
                        }
                    }
                }
            }
            // totalTurns가 0이거나 없는데 moveHistory에 유효 수가 있으면 moveHistory 기준으로 설정 (sessionStorage 유무와 관계없이, 한 수 둔 뒤 턴이 Max로 돌아가는 버그 방지)
            const validCount = next.moveHistory?.filter((m: { x: number; y: number }) => m.x !== -1 && m.y !== -1).length ?? 0;
            if (validCount > 0 && (next.totalTurns === undefined || next.totalTurns === null || next.totalTurns === 0)) {
                next = { ...next, totalTurns: validCount };
            }
            return next;
        } catch {
            return session;
        }
    }, [session, isSinglePlayer, isTower, hasStrategicTurnLimit, isAdventureGame, useRefreshSessionStorageMerge, gameId, (session as any).blackTurnLimitBonus]);

    /** 온라인 AI 대국: 전광판은 WS 세션의 턴·연출 필드를 그대로 써야 저장소 복원분과 어긋나지 않음 */
    const turnDisplaySession = useMemo(() => {
        if (isSinglePlayer || isTower) return sessionWithRestoredPatternStones;
        if (!session.isAiGame) return sessionWithRestoredPatternStones;
        return {
            ...sessionWithRestoredPatternStones,
            currentPlayer: session.currentPlayer,
            gameStatus: session.gameStatus,
            animation: session.animation,
            foulInfo: session.foulInfo,
            itemUseDeadline: session.itemUseDeadline,
            ...((session as any).aiHiddenItemAnimationEndTime != null
                ? { aiHiddenItemAnimationEndTime: (session as any).aiHiddenItemAnimationEndTime }
                : {}),
        };
    }, [session, sessionWithRestoredPatternStones, isSinglePlayer, isTower]);
    
    // --- UI State ---
    // 스케일 셸(PC동일): 항상 PC 레이아웃. 네이티브 모바일: 드로어/슬라이드 분기 사용.
    const isHandheld = useIsHandheldDevice(1025);
    const isMobile = isNativeMobile;
    const isMobileSafeArea = isHandheld;
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [hasNewMessage, setHasNewMessage] = useState(false);
    // 우측 사이드바 접기/펼치기 (전략·놀이바둑 경기장)
    const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);
    const gameChat = useMemo(() => gameChats[session.id] || [], [gameChats, session.id]);
    const prevChatLength = usePrevious(gameChat.length);

    useEffect(() => {
        if (!isMobileSidebarOpen && prevChatLength !== undefined && gameChat.length > prevChatLength) {
            setHasNewMessage(true);
        }
    }, [gameChat.length, prevChatLength, isMobileSidebarOpen]);

    const openMobileSidebar = () => {
        setIsMobileSidebarOpen(true);
        setHasNewMessage(false);
    };

    useEffect(() => {
        const gameHasJustEnded =
            (gameStatus === 'ended' || gameStatus === 'no_contest') &&
            prevGameStatus !== 'ended' &&
            prevGameStatus !== 'no_contest' &&
            prevGameStatus !== 'rematch_pending';

        // 분석 결과가 도착했을 때만 모달 표시 (바둑판 초기화 방지)
        // scoring 상태에서는 반드시 ScoringOverlay를 먼저 보여주고, ended 전환 후에만 결과 모달을 연다.
        // 기권/접속 끊김 등 즉시 종료되는 경우에는 analysisResult 없이도 모달 표시
        const currentAnalysisResult = session.analysisResult?.['system'];
        const analysisResultJustArrived = currentAnalysisResult && !prevAnalysisResult;
        const isImmediateEnd = gameHasJustEnded && (session.winReason === 'resign' || session.winReason === 'disconnect' || session.winReason === 'timeout');
        // 싱글: ended 직후 결과 모달(입문 등 analysisResult 지연 시 빈 화면 방지).
        // scoring 진입 시에는 모달을 절대 열지 않음 — ScoringOverlay 연출을 완료한 뒤 ended에서 모달 표시.
        // 도전의 탑: 따내기 승·패 등 analysisResult 없이 ended 되는 경우가 많아 종료 직후 바로 결과 모달을 연다.
        const pveAutoResultModal =
            isImmediateEnd ||
            (isTower && gameHasJustEnded) ||
            (isSinglePlayer && gameHasJustEnded) ||
            (gameStatus === 'ended' && currentAnalysisResult && prevGameStatus !== 'ended');
        const shouldShowModal = (isSinglePlayer || isTower)
            ? pveAutoResultModal
            : gameHasJustEnded ||
              (gameStatus === 'ended' && currentAnalysisResult && prevGameStatus !== 'ended');

        const shouldDelayCaptureResultModal =
            gameHasJustEnded &&
            prevGameStatus === 'playing' &&
            session.winReason === 'capture_limit';

        if (shouldShowModal) {
            if (shouldDelayCaptureResultModal) {
                const jc = session.justCaptured;
                const hiddenFloatLag =
                    Array.isArray(jc) && jc.some((e) => e.wasHidden) ? CAPTURE_WIN_HIDDEN_FLOAT_LAG_MS : 0;
                const captureWinResultModalDelayMs =
                    CAPTURE_WIN_SCORE_DEBOUNCE_MS + hiddenFloatLag + CAPTURE_WIN_SCORE_FLOAT_CSS_MS;
                delayedResultModalTimerRef.current = setTimeout(() => {
                    setShowResultModal(true);
                    delayedResultModalTimerRef.current = null;
                }, captureWinResultModalDelayMs);
            } else {
                setShowResultModal(true);
            }
            if (gameStatus === 'ended') {
                setShowFinalTerritory(true);
            }
        }
        
        // 계가가 완료되었을 때(analysisResult가 있을 때) 영토 표시 활성화
        if (gameStatus === 'ended' || gameStatus === 'scoring') {
            if (currentAnalysisResult) {
                setShowFinalTerritory(true);
            }
        }
    }, [
        gameStatus,
        prevGameStatus,
        session.analysisResult,
        prevAnalysisResult,
        isSinglePlayer,
        isTower,
        session.winReason,
        session.justCaptured,
    ]);

    /** 다른 대국으로 바뀌거나 화면을 떠날 때만 지연 모달 타이머 정리 (이펙트 재실행마다 지우면 모달이 영원히 안 뜸) */
    useEffect(() => {
        return () => {
            if (delayedResultModalTimerRef.current) {
                clearTimeout(delayedResultModalTimerRef.current);
                delayedResultModalTimerRef.current = null;
            }
        };
    }, [session.id]);
    
    const myPlayerEnum = useMemo(() => {
        if (isSpectator) {
            // 놀이바둑 관전 시 흑 유저 입장 화면으로 통일 (알까기/컬링 등 좌표 겹침 방지)
            if (PLAYFUL_GAME_MODES.some(m => m.mode === mode)) return Player.Black;
            return Player.None;
        }
        const pairSeat = session.settings.pairGame?.turnOrder?.find((seat) => seat.participantId === currentUser.id);
        if (pairSeat) return pairSeat.player;
        if (blackPlayerId === currentUser.id) return Player.Black;
        if (whitePlayerId === currentUser.id) return Player.White;
        if ((mode === GameMode.Base || (mode === GameMode.Mix && session.settings.mixedModes?.includes(GameMode.Base))) && gameStatus === 'base_placement') {
             return currentUser.id === player1.id ? Player.Black : Player.White;
        }
        return Player.None;
    }, [currentUser.id, blackPlayerId, whitePlayerId, isSpectator, mode, gameStatus, player1.id, player2.id, session.settings.mixedModes, session.settings.pairGame?.turnOrder]);

    const pendingMoveForBoard = useMemo(() => {
        if (!settings.features.moveConfirmButtonBox || !settings.features.mobileConfirm || !pendingMove) return null;
        if (myPlayerEnum === Player.None) return null;
        return { x: pendingMove.x, y: pendingMove.y, player: myPlayerEnum };
    }, [settings.features.moveConfirmButtonBox, settings.features.mobileConfirm, pendingMove, myPlayerEnum]);
    
    const isMyTurn = useMemo(() => {
        if (isSpectator) return false;
        const pairCurrentSeat = getCurrentPairTurnSeat(session.settings);
        if (gameStatus === 'alkkagi_simultaneous_placement' && session.settings.alkkagiPlacementType === '일괄 배치') {
            const myStonesOnBoard = (session.alkkagiStones || []).filter(s => s.player === myPlayerEnum).length;
            const myStonesInPlacement = (currentUser.id === player1.id ? session.alkkagiStones_p1 : session.alkkagiStones_p2)?.length || 0;
            return (myStonesOnBoard + myStonesInPlacement) < (session.settings.alkkagiStoneCount || 5);
        }
        switch (gameStatus) {
            case 'dice_turn_rolling': return session.turnOrderRolls?.[currentUser.id] === null;
            case 'dice_turn_choice': return session.turnChooserId === currentUser.id;
            case 'scanning': {
                if (myPlayerEnum === Player.None) return false;
                if (myPlayerEnum === currentPlayer) return true;
                // 싱글플레이: 내 착수 직후 턴은 AI로 넘어갔지만 START_SCANNING 허용 — 스캔 좌표 클릭도 동일하게 허용 (도전의 탑은 AI 턴에 스캔 불가)
                if (session.isSinglePlayer && !isTower && session.moveHistory?.length) {
                    const last = session.moveHistory[session.moveHistory.length - 1];
                    if (last && last.player === myPlayerEnum) return true;
                }
                return false;
            }
            case 'missile_selecting': {
                if (myPlayerEnum === Player.None) return false;
                if (myPlayerEnum === currentPlayer) return true;
                // 싱글플레이: 내 착수 직후(turn은 AI로 넘어갔지만) START_MISSILE_SELECTION 허용 구간이 있으므로,
                // 미사일 선택/발사도 동일하게 허용한다.
                if (session.isSinglePlayer && !isTower && session.moveHistory?.length) {
                    const last = session.moveHistory[session.moveHistory.length - 1];
                    if (last && last.player === myPlayerEnum) return true;
                }
                return false;
            }
            case 'playing': case 'hidden_placing': 
                if (pairCurrentSeat) return pairCurrentSeat.participantId === currentUser.id;
                return myPlayerEnum !== Player.None && myPlayerEnum === currentPlayer;
            case 'alkkagi_placement': case 'alkkagi_playing': case 'curling_playing': case 'curling_tiebreaker_playing':
            case 'dice_rolling':
            case 'dice_rolling_animating':
            case 'dice_placing':
            case 'thief_rolling':
            case 'thief_rolling_animating':
            case 'thief_placing':
                return myPlayerEnum !== Player.None && myPlayerEnum === currentPlayer;
            case 'base_placement': {
                 const myStones = currentUser.id === player1.id ? session.baseStones_p1 : session.baseStones_p2;
                 return (myStones?.length || 0) < (session.settings.baseStones || 4);
            }
            default: return false;
        }
    }, [myPlayerEnum, currentPlayer, gameStatus, isSpectator, session, currentUser.id, player1.id, session.settings, isTower]);
    
    // --- Sound Effects ---
    const prevIsMyTurn = usePrevious(isMyTurn);
    useEffect(() => {
        if (isMyTurn && !prevIsMyTurn) {
            const isPlayfulTurnSoundMode = [ GameMode.Dice, GameMode.Thief, GameMode.Alkkagi, GameMode.Curling, ].includes(session.mode);
            // 알까기 교차 배치: 턴이 넘어올 때 턴 소리 대신 돌 두는 소리
            if (session.mode === GameMode.Alkkagi && (gameStatus === 'alkkagi_placement' || gameStatus === 'alkkagi_simultaneous_placement')) {
                audioService.placeStone();
            } else if (isPlayfulTurnSoundMode) {
                audioService.myTurn();
            }
        }
    }, [isMyTurn, prevIsMyTurn, session.mode, gameStatus]);

    const moveHistoryTail = useMemo(() => {
        const h = session.moveHistory;
        if (!h?.length) return undefined;
        const tailIndex = h.length - 1;
        const t = h[tailIndex];
        if (t.x < 0 || t.y < 0) return undefined;
        return {
            x: t.x,
            y: t.y,
            player: t.player,
            isHidden: !!session.hiddenMoves?.[tailIndex],
        };
    }, [session.moveHistory, session.hiddenMoves]);
    const prevMoveHistoryTail = usePrevious(moveHistoryTail);

    // 전략바둑·오목·따목: 착점 소리는 moveHistory 꼬리 변화 기준 (낙관적 갱신·모바일 확정·서버 응답 모두 커버)
    useEffect(() => {
        if (session.mode === GameMode.Dice || session.mode === GameMode.Thief) return;
        const isStrategicLike =
            SPECIAL_GAME_MODES.some(m => m.mode === session.mode) ||
            session.mode === GameMode.Omok ||
            session.mode === GameMode.Ttamok;
        if (!isStrategicLike) return;
        // playing→scoring 한 번에 오는 경우(자동 계가 직전 AI 수)에도 착점음이 나도록 scoring 직후 한 틱 허용
        // playing→ended: 따내기 미션 완료 등 한 수에 종료될 때도 마지막 착수음이 나도록 허용
        const stoneSoundOkStatus =
            ['playing', 'hidden_placing'].includes(gameStatus) ||
            (gameStatus === 'scoring' && prevGameStatus === 'playing') ||
            (gameStatus === 'ended' && prevGameStatus === 'playing');
        if (!stoneSoundOkStatus) return;

        if (strategicPlaceSoundGameIdRef.current !== gameId) {
            strategicPlaceSoundGameIdRef.current = gameId;
            strategicPlaceHistoryLenRef.current = undefined;
            strategicPlaceSoundKeyRef.current = '';
        }

        const len = session.moveHistory?.length ?? 0;
        const prevTrackedLen = strategicPlaceHistoryLenRef.current;

        if (!moveHistoryTail) {
            strategicPlaceHistoryLenRef.current = len;
            return;
        }

        // 수순 길이가 줄면 "새로 착수"가 아니라 되돌림/재동기화로 꼬리만 바뀐 경우가 많음 → 착점 소리 생략
        if (prevTrackedLen !== undefined && len < prevTrackedLen) {
            strategicPlaceSoundKeyRef.current = `${len}:${moveHistoryTail.x},${moveHistoryTail.y}`;
            strategicPlaceHistoryLenRef.current = len;
            return;
        }

        if (prevMoveHistoryTail === undefined) {
            if (len !== 1) {
                strategicPlaceHistoryLenRef.current = len;
                return;
            }
        } else if (JSON.stringify(moveHistoryTail) === JSON.stringify(prevMoveHistoryTail)) {
            strategicPlaceHistoryLenRef.current = len;
            return;
        }
        // len 기반 키는 히든 모드에서 낙관적/서버 동기화 순서 차이로 같은 착점을 다른 수로 오인할 수 있다.
        // 좌표+착수자+히든 여부 기준 fingerprint로 중복음을 차단한다.
        const key = `${moveHistoryTail.x},${moveHistoryTail.y}:${moveHistoryTail.player}:${moveHistoryTail.isHidden ? 1 : 0}`;
        if (strategicPlaceSoundKeyRef.current === key) {
            strategicPlaceHistoryLenRef.current = len;
            return;
        }
        strategicPlaceSoundKeyRef.current = key;
        strategicPlaceHistoryLenRef.current = len;
        void audioService.initialize();
        audioService.placeStone();
    }, [
        gameId,
        session.mode,
        gameStatus,
        prevGameStatus,
        moveHistoryTail,
        prevMoveHistoryTail,
        session.moveHistory?.length,
    ]);

    // 주사위/도둑: 한 턴에 여러 돌 — 클라 낙관은 moveHistory를 늘리지 않고, 도둑 모드는 서버도 moveHistory에 착수를 쌓지 않아
    // moveHistory 꼬리만으로는 마지막 착점(또는 턴 종료 시점)에만 소리가 난다. stonesPlacedThisTurn·lastMove로 매 돌마다 1회 재생.
    const diceThiefPlacedSignature = useMemo(() => {
        if (session.mode !== GameMode.Dice && session.mode !== GameMode.Thief) return '';
        const pts = session.stonesPlacedThisTurn;
        if (!pts?.length) return '';
        return `${pts.length}:${pts.map((p) => `${p.x},${p.y}`).join('|')}`;
    }, [session.mode, session.stonesPlacedThisTurn]);
    useEffect(() => {
        if (session.mode !== GameMode.Dice && session.mode !== GameMode.Thief) return;
        if (session.gameStatus !== 'dice_placing' && session.gameStatus !== 'thief_placing') return;
        const lm = session.lastMove;
        if (!lm || lm.x < 0 || lm.y < 0) return;
        const n = session.stonesPlacedThisTurn?.length ?? 0;
        if (n <= 0) return;
        const key = `${diceThiefPlacedSignature}:${lm.x},${lm.y}`;
        if (lastDiceThiefPlaceSoundKeyRef.current === key) return;
        lastDiceThiefPlaceSoundKeyRef.current = key;
        void audioService.initialize();
        audioService.placeStone();
    }, [session.mode, session.gameStatus, session.lastMove, diceThiefPlacedSignature]);
    
    useEffect(() => { if (prevCaptures) { /* Capture sounds removed */ } }, [session.captures, prevCaptures, session.justCaptured, session.blackPlayerId, currentUser.id]);

    useEffect(() => {
        if (gameStatus === 'scanning' && prevGameStatus !== 'scanning') audioService.playScanBgm();
        else if (gameStatus !== 'scanning' && prevGameStatus === 'scanning') audioService.stopScanBgm();
        return () => { if (gameStatus === 'scanning') audioService.stopScanBgm(); };
    }, [gameStatus, prevGameStatus]);

    useEffect(() => {
        const anim = session.animation;
        const skipSound = ['scoring', 'ended', 'no_contest'].includes(session.gameStatus ?? '');
        if (anim && anim.type !== prevAnimationType) { 
            switch(anim.type) {
                case 'missile': case 'hidden_missile': if (!skipSound) audioService.launchMissile(); break;
                case 'hidden_reveal': if (!justScanned) audioService.revealHiddenStone(); break;
                case 'scan':
                    setJustScanned(true); setTimeout(() => setJustScanned(false), 1000);
                    if (anim.success) audioService.scanSuccess(); else audioService.scanFail();
                    break;
                case 'dice_roll_main': {
                    // 상대(AI) 굴림: 본인 클릭 시 GameControls에서 이미 재생함
                    const isDiceOrThief = session.mode === GameMode.Dice || session.mode === GameMode.Thief;
                    if (!skipSound && isDiceOrThief && !isMyTurn) {
                        const diceCount =
                            session.mode === GameMode.Thief
                                ? session.currentPlayer === Player.Black
                                    ? 1
                                    : 2
                                : 1;
                        audioService.rollDice(diceCount);
                    }
                    break;
                }
            }
        }
    }, [session.animation, session.gameStatus, session.mode, prevAnimationType, justScanned, isMyTurn]);

    useEffect(() => {
        const activeStartStatuses: GameStatus[] = [ 'playing', 'alkkagi_placement', 'alkkagi_simultaneous_placement', 'curling_playing', 'dice_rolling', 'thief_rolling' ];
        if (activeStartStatuses.includes(gameStatus) && (prevGameStatus === undefined || !activeStartStatuses.includes(prevGameStatus))) audioService.gameStart();
    }, [gameStatus, prevGameStatus]);

    useEffect(() => { return () => audioService.stopScanBgm(); }, []);

    // AI 히든 연출 중 0.5초마다 갱신 (테두리 빛 표시)
    useEffect(() => {
        const serverEnd = (session as any).aiHiddenItemAnimationEndTime as number | undefined;
        const serverDrivenHiddenWait =
            session.animation?.type === 'ai_thinking' && serverEnd != null;
        if (aiHiddenItemEffectEndTime == null && !serverDrivenHiddenWait) return;
        const id = setInterval(() => setEffectTick((t) => t + 1), 500);
        return () => clearInterval(id);
    }, [aiHiddenItemEffectEndTime, session.animation?.type, (session as any).aiHiddenItemAnimationEndTime]);

    const isGuildWarHiddenClientEffects =
        session.gameCategory === 'guildwar' && mode === GameMode.Hidden;

    const useScanAnimationFallback =
        isSinglePlayer || isTower || isGuildWarHiddenClientEffects || isOnlineHiddenStrategic;

    useEffect(() => {
        if (!(isSinglePlayer || isTower || isGuildWarHiddenClientEffects)) return;
        const revealEndTime = session.revealAnimationEndTime;
        const hasRevealToFinalize =
            typeof revealEndTime === 'number' &&
            revealEndTime > 0 &&
            (session.gameStatus === 'hidden_reveal_animating' || !!session.pendingCapture);
        if (!hasRevealToFinalize) return;

        const remaining = Math.max(0, revealEndTime - Date.now());
        const id = window.setTimeout(() => {
            handlers.handleAction({
                type: 'LOCAL_HIDDEN_REVEAL_COMPLETE',
                payload: {
                    gameId: session.id,
                    gameType: isTower ? 'tower' : isGuildWarHiddenClientEffects ? 'guildwar' : 'singleplayer'
                }
            } as any);
        }, remaining + 50);

        return () => window.clearTimeout(id);
    }, [session.gameStatus, session.revealAnimationEndTime, session.pendingCapture, session.id, isSinglePlayer, isTower, isGuildWarHiddenClientEffects, handlers.handleAction]);

    // 스캔 결과 애니메이션 종료 시 본경기(playing) 복귀 — 서버 updateGameStates/WS가 늦어도 착수 가능 (PVE + 온라인 히든)
    useEffect(() => {
        if (!useScanAnimationFallback) return;
        if (session.gameStatus !== 'scanning_animating') return;
        const anim = session.animation as { type?: string; startTime?: number; duration?: number } | null | undefined;
        const scanAnimGameType: 'tower' | 'singleplayer' | 'guildwar' | 'normal' = isTower
            ? 'tower'
            : isGuildWarHiddenClientEffects
              ? 'guildwar'
              : isSinglePlayer
                ? 'singleplayer'
                : 'normal';
        const finish = () => {
            handlers.handleAction({
                type: 'LOCAL_PVE_SCAN_ANIMATION_COMPLETE',
                payload: {
                    gameId: session.id,
                    gameType: scanAnimGameType,
                },
            } as any);
        };
        if (!anim || anim.type !== 'scan') {
            const id = window.setTimeout(finish, 50);
            return () => window.clearTimeout(id);
        }
        const end = (anim.startTime ?? 0) + (anim.duration ?? 2000);
        const remaining = Math.max(0, end - Date.now());
        const id = window.setTimeout(finish, remaining + 50);
        return () => window.clearTimeout(id);
    }, [useScanAnimationFallback, session.id, session.gameStatus, session.animation, handlers.handleAction, isTower, isGuildWarHiddenClientEffects, isSinglePlayer]);

    // 계가 턴 히든 공개(hidden_final_reveal) 애니메이션 종료 시 로컬에서 즉시 scoring으로 전환 → 계가 연출(ScoringOverlay) 표시
    useEffect(() => {
        if (!(isSinglePlayer || isTower || isGuildWarHiddenClientEffects)) return;
        if (session.gameStatus !== 'hidden_final_reveal' || !session.revealAnimationEndTime) return;
        const remaining = Math.max(0, session.revealAnimationEndTime - Date.now());
        const id = window.setTimeout(() => {
            handlers.handleAction({
                type: 'LOCAL_HIDDEN_FINAL_REVEAL_COMPLETE',
                payload: {
                    gameId: session.id,
                    gameType: isTower ? 'tower' : isGuildWarHiddenClientEffects ? 'guildwar' : 'singleplayer',
                }
            } as any);
        }, remaining + 50);
        return () => window.clearTimeout(id);
    }, [session.gameStatus, session.revealAnimationEndTime, session.id, isSinglePlayer, isTower, isGuildWarHiddenClientEffects, handlers.handleAction]);

    useEffect(() => {
        const revealedToPlaying = prevGameStatus === 'hidden_reveal_animating' && gameStatus === 'playing';
        if (!revealedToPlaying) return;
        lastAiMoveRef.current = null;

        const isPveLikeGame =
            session.gameCategory === 'tower' ||
            session.gameCategory === 'singleplayer' ||
            session.gameCategory === 'guildwar' ||
            session.gameCategory === 'adventure' ||
            session.isSinglePlayer;
        if (!isPveLikeGame) return;
        if (currentPlayer !== Player.White && currentPlayer !== Player.Black) return;
        const aiSeatId = currentPlayer === Player.Black ? session.blackPlayerId : session.whitePlayerId;
        const isAiTurn =
            aiSeatId === AI_USER_ID ||
            (session.isAiGame && aiSeatId === 'ai-player-01') ||
            (!!aiSeatId && String(aiSeatId).startsWith('dungeon-bot-'));
        if (!isAiTurn) return;

        // 히든 공개 애니 직후에는 클라/서버 상태 반영 타이밍 경합이 있어 AI 착수가 누락될 수 있음.
        // 애니 종료→playing 전환 순간에 1회 kick을 보내 멈춤을 방지한다.
        const kickTimer = window.setTimeout(() => {
            const latestSession = sessionRefForPveAiHiddenFollowup.current;
            const clientSync = buildPveItemActionClientSync(latestSession);
            void handleActionRef.current({
                type: 'REQUEST_SERVER_AI_MOVE',
                payload: clientSync
                    ? { gameId: latestSession.id, clientSync }
                    : { gameId: latestSession.id },
            } as ServerAction);
        }, 120);

        return () => window.clearTimeout(kickTimer);
    }, [
        prevGameStatus,
        gameStatus,
        currentPlayer,
        session.id,
        session.gameCategory,
        session.isSinglePlayer,
        session.isAiGame,
        session.blackPlayerId,
        session.whitePlayerId,
    ]);

    // 게임이 바뀌면 히든 연출 실행 여부 ref 초기화 (새 게임에서 1회 히든 턴이 동작하도록)
    useEffect(() => {
        aiHiddenMoveExecutedRef.current = false;
        pveAiHiddenPostAnimRequestDoneRef.current = null;
    }, [session.id]);

    // 길드전 히든: 6초 연출(클라 타이머) 종료 시 휴리스틱으로 AI 히든 착수 (한 번만)
    useEffect(() => {
        if (aiHiddenItemEffectEndTime == null) return;
        if (Date.now() < aiHiddenItemEffectEndTime) return;
        if (aiHiddenMoveExecutedRef.current) {
            setAiHiddenItemEffectEndTime(null);
            return;
        }
        if (!isGuildWarGame) {
            setAiHiddenItemEffectEndTime(null);
            return;
        }
        aiHiddenMoveExecutedRef.current = true;
        setAiHiddenItemEffectEndTime(null);
        const boardStateToUse = restoredBoardState || session.boardState;
        const moveHistoryLength = session.moveHistory?.length ?? 0;
        if (!boardStateToUse?.length || !session.id || session.gameStatus !== 'playing') return;

        const aiPlayerEnum = session.currentPlayer;
        if (aiPlayerEnum !== Player.Black && aiPlayerEnum !== Player.White) return;
        const opponentPlayerEnum = aiPlayerEnum === Player.Black ? Player.White : Player.Black;

        const maskedBoardState = getMaskedBoardForHiddenAi(session, boardStateToUse);
        const koInfoAtCalculation = session.koInfo ? JSON.parse(JSON.stringify(session.koInfo)) : null;
        const aiMove = calculateSimpleAiMove(
            JSON.parse(JSON.stringify(maskedBoardState)),
            aiPlayerEnum,
            opponentPlayerEnum,
            koInfoAtCalculation,
            moveHistoryLength,
            session.settings?.aiDifficulty ?? 1
        );
        if (!aiMove) return;
        if (isUnrevealedUserHiddenStoneAt(session, aiMove.x, aiMove.y)) {
            lastAiMoveRef.current = {
                gameId: session.id,
                moveHistoryLength,
                player: aiPlayerEnum,
                timestamp: Date.now(),
                revealSig: session.permanentlyRevealedStones?.length ?? 0,
            };
            handlers.handleAction({
                type: 'LOCAL_HIDDEN_REVEAL_TRIGGER',
                payload: {
                    gameId: session.id,
                    gameType: 'guildwar',
                    point: { x: aiMove.x, y: aiMove.y },
                    player: opponentPlayerEnum,
                    keepTurn: true,
                },
            } as any);
            return;
        }
        const aiMoveResult = processMoveClient(
            boardStateToUse,
            { x: aiMove.x, y: aiMove.y, player: aiPlayerEnum },
            session.koInfo,
            moveHistoryLength
        );
        if (!aiMoveResult.isValid) return;
        lastAiMoveRef.current = {
            gameId: session.id,
            moveHistoryLength,
            player: aiPlayerEnum,
            timestamp: Date.now(),
            revealSig: session.permanentlyRevealedStones?.length ?? 0,
        };
        handlers.handleAction({
            type: 'PLACE_STONE',
            payload: {
                gameId: session.id,
                x: aiMove.x,
                y: aiMove.y,
                isClientAiMove: true,
                isHidden: true,
            },
        } as ServerAction);
    }, [
        aiHiddenItemEffectEndTime,
        effectTick,
        session.id,
        session.gameStatus,
        session.currentPlayer,
        session.moveHistory?.length,
        session.koInfo,
        session.settings?.aiDifficulty,
        restoredBoardState,
        session.boardState,
        handlers.handleAction,
        isGuildWarGame,
        session.gameCategory,
    ]);

    // 도전의 탑·싱글: 서버 6초 생각 연출 종료 직후 Kata 착수를 위해 REQUEST_SERVER_AI_MOVE 1회
    useEffect(() => {
        if (!isTower && !session.isSinglePlayer) return;
        if (session.gameStatus !== 'playing') return;
        const anim = session.animation as { type?: string; startTime?: number } | undefined;
        if (anim?.type !== 'ai_thinking') return;
        const endFromServer = (session as any).aiHiddenItemAnimationEndTime as number | undefined;
        const startAt = Number(anim.startTime ?? 0);
        // 서버가 endTime을 누락하는 케이스 대비: startTime 기준 6초(+buffer)로 만료 시각을 보정
        const fallbackEnd = Number.isFinite(startAt) && startAt > 0 ? startAt + 6050 : Date.now();
        const end = Number.isFinite(endFromServer as number) ? Number(endFromServer) : fallbackEnd;

        const sid = String(session.id ?? '');
        const followKey = `${sid}:${end}:${anim.startTime ?? 0}`;
        if (pveAiHiddenPostAnimRequestDoneRef.current === followKey) return;

        const scheduleMs = Math.max(0, end - Date.now()) + 50;
        const tid = window.setTimeout(() => {
            if (pveAiHiddenPostAnimRequestDoneRef.current === followKey) return;
            const s = sessionRefForPveAiHiddenFollowup.current;
            const animNow = s.animation as { type?: string } | undefined;
            const endNowFromServer = (s as any).aiHiddenItemAnimationEndTime as number | undefined;
            const startNow = Number((s.animation as { startTime?: number } | undefined)?.startTime ?? 0);
            const fallbackEndNow = Number.isFinite(startNow) && startNow > 0 ? startNow + 6050 : Date.now();
            const endNow = Number.isFinite(endNowFromServer as number) ? Number(endNowFromServer) : fallbackEndNow;
            if (animNow?.type !== 'ai_thinking' || endNow < Date.now() || s.gameStatus !== 'playing') return;
            const aiPlayerId = s.currentPlayer === Player.Black ? s.blackPlayerId : s.whitePlayerId;
            const isAiTurnNow =
                aiPlayerId === AI_USER_ID || (s.isAiGame && aiPlayerId === 'ai-player-01');
            if (!isAiTurnNow) return;

            pveAiHiddenPostAnimRequestDoneRef.current = followKey;
            const clientSync = buildPveItemActionClientSync(s);
            if (!clientSync) {
                pveAiHiddenPostAnimRequestDoneRef.current = null;
                return;
            }
            void handlers
                .handleAction({
                    type: 'REQUEST_SERVER_AI_MOVE',
                    payload: { gameId: sid, clientSync },
                } as ServerAction)
                .catch((err) => {
                    console.error('[Game] PVE post ai_thinking REQUEST_SERVER_AI_MOVE failed:', err);
                    pveAiHiddenPostAnimRequestDoneRef.current = null;
                });
        }, scheduleMs);
        return () => window.clearTimeout(tid);
    }, [
        isTower,
        session.isSinglePlayer,
        session.id,
        session.gameStatus,
        session.animation?.type,
        (session.animation as { startTime?: number } | undefined)?.startTime,
        (session as any).aiHiddenItemAnimationEndTime,
        session.currentPlayer,
        session.blackPlayerId,
        session.whitePlayerId,
        session.isAiGame,
        handlers.handleAction,
    ]);

    useEffect(() => {
        const isGameOver = ['ended', 'no_contest', 'scoring'].includes(gameStatus);
        const hasTurnChanged = prevMoveCount !== undefined && session.moveHistory && session.moveHistory.length > prevMoveCount;
    
        if (!isMyTurn || hasTurnChanged || isGameOver) {
            if (warningSoundPlayedForTurn.current) {
                audioService.stopTimerWarning();
                warningSoundPlayedForTurn.current = false;
            }
        }
        
        if (isMyTurn && !isGameOver) {
            const hasTimeControl = (session.settings?.timeLimit ?? 0) > 0 || ((session.settings?.byoyomiCount ?? 0) > 0 && (session.settings?.byoyomiTime ?? 0) > 0);
            const noCountdownSound = !hasTimeControl || session.isAiGame; // 싱글/AI 대국: 초읽기 소리 없음
            if (noCountdownSound) return;
            const myTime = myPlayerEnum === Player.Black ? clientTimes.clientTimes.black : clientTimes.clientTimes.white;
            if (myTime <= 10 && myTime > 0 && !warningSoundPlayedForTurn.current) {
                audioService.timerWarning();
                warningSoundPlayedForTurn.current = true;
            }
        }
    }, [isMyTurn, clientTimes.clientTimes, myPlayerEnum, session.moveHistory, prevMoveCount, gameStatus]);

    // 한 수가 실제로 반영되었거나 상태가 바뀌면 클릭 잠금 해제
    useEffect(() => {
        if (!isMoveInFlight) return;
        const currentMoveCount = session.moveHistory?.length ?? 0;
        const moveIncreased = prevMoveCount !== undefined && currentMoveCount > prevMoveCount;
        const statusChanged = prevGameStatus !== undefined && prevGameStatus !== gameStatus;
        // 베이스돌 배치: moveHistory/phase가 안 바뀌어도 서버가 baseStones_p1/p2를 갱신하므로 그때 잠금 해제
        const basePlacementAck =
            gameStatus === 'base_placement' &&
            myBaseStoneCountForUnlock !== undefined &&
            prevMyBaseStoneCountForUnlock !== undefined &&
            myBaseStoneCountForUnlock > prevMyBaseStoneCountForUnlock;
        if (moveIncreased || statusChanged || basePlacementAck) {
            setIsMoveInFlight(false);
        }
    }, [isMoveInFlight, session.moveHistory?.length, prevMoveCount, gameStatus, prevGameStatus, myBaseStoneCountForUnlock, prevMyBaseStoneCountForUnlock]);

    // 싱글/타워 클라 착수 직후: 실제로 내 턴이 돌아오기 전까지 빠른 연타를 막는다.
    useEffect(() => {
        if (!pveLocalStonePlacementLockRef.current) return;
        const isGameOver = ['ended', 'no_contest', 'scoring'].includes(gameStatus);
        if (!isMyTurn && !isGameOver) return;
        pveLocalStonePlacementLockRef.current = false;
    }, [isMyTurn, gameStatus, session.id]);

    // 온라인 AI 대국 낙관적 착수도 서버 요청 완료가 아니라 턴 사이클 완료 기준으로 잠금을 푼다.
    useEffect(() => {
        if (!strategicAiStoneLockRef.current) return;
        const isGameOver = ['ended', 'no_contest', 'scoring'].includes(gameStatus);
        if (!isMyTurn && !isGameOver) return;
        strategicAiStoneLockRef.current = false;
    }, [isMyTurn, gameStatus, session.id]);

    const flashBoardRuleMessage = useCallback((message: string, durationMs = 3500) => {
        if (boardRuleFlashClearRef.current) clearTimeout(boardRuleFlashClearRef.current);
        setBoardRuleFlashMessage(message);
        boardRuleFlashClearRef.current = setTimeout(() => {
            setBoardRuleFlashMessage(null);
            boardRuleFlashClearRef.current = null;
        }, durationMs);
    }, []);

    const showKoRuleFlash = useCallback(() => {
        flashBoardRuleMessage(KO_RULE_FLASH_MESSAGE, 5000);
    }, [flashBoardRuleMessage]);

    const applyOptimisticAiUserMove = useCallback((x: number, y: number): boolean => {
        // sessionStorage 복원판은 수순이 느릴 때 서버보다 뒤처져 빈 칸으로 보이는 경우가 있어, 낙관적 착수는 서버 판 우선
        const boardStateToUse =
            session.boardState && Array.isArray(session.boardState) && session.boardState.length > 0
                ? session.boardState
                : restoredBoardState || session.boardState;
        if (!boardStateToUse || !Array.isArray(boardStateToUse) || boardStateToUse.length === 0) return false;
        const stoneHere = boardStateToUse[y]?.[x];
        if (stoneHere !== Player.None) return false;
        try {
            const moveResult = processMoveClient(
                boardStateToUse,
                { x, y, player: myPlayerEnum },
                session.koInfo,
                session.moveHistory?.length || 0
            );
            if (!moveResult.isValid) return false;
            handlers.handleAction({
                type: 'AI_GAME_CLIENT_MOVE',
                payload: {
                    gameId,
                    x,
                    y,
                    newBoardState: moveResult.newBoardState,
                    capturedStones: moveResult.capturedStones,
                    newKoInfo: moveResult.newKoInfo,
                    movePlayer: myPlayerEnum,
                }
            } as any);
            return true;
        } catch (e) {
            console.warn('[Game] AI_GAME_CLIENT_MOVE optimistic update skipped:', e);
            return false;
        }
    }, [
        gameId,
        handlers,
        myPlayerEnum,
        restoredBoardState,
        session.boardState,
        session.koInfo,
        session.moveHistory?.length,
    ]);

    useEffect(() => () => {
        if (boardRuleFlashClearRef.current) clearTimeout(boardRuleFlashClearRef.current);
    }, []);

    const isItemModeActive = ['hidden_placing', 'scanning', 'missile_selecting', 'missile_animating', 'scanning_animating'].includes(gameStatus);

    const handleBoardClick = useCallback((x: number, y: number) => {
        audioService.unlockFromUserGesture();
        audioService.stopTimerWarning();
        if (isSpectator || gameStatus === 'missile_animating') return;
        if (gameStatus === 'ended' || gameStatus === 'no_contest' || gameStatus === 'scoring') {
            setPendingMove(null);
            return;
        }
        const isPausableAiGame =
            session.isAiGame &&
            !session.isSinglePlayer &&
            session.gameCategory !== 'tower' &&
            session.gameCategory !== 'singleplayer';
        if ((session.isSinglePlayer || isTower || isPausableAiGame) && isPaused) return;
        if ((session.isSinglePlayer || isTower) && isBoardLocked) {
            console.log('[Game] Board is locked, ignoring click', { isBoardLocked, serverRevision: session.serverRevision });
            return;
        }

        // 새로고침 직후: 서버에서 아직 boardState가 동기화되지 않은 상태에서는 클릭을 막아
        // "빈 판에서 클릭 후 돌이 한꺼번에 보이는" 현상을 방지
        const effectiveBoard = restoredBoardState || session.boardState;
        const moveCount = session.moveHistory?.length ?? 0;
        if (!isSinglePlayer && !isTower && moveCount > 0) {
            const hasValidBoard =
                effectiveBoard &&
                Array.isArray(effectiveBoard) &&
                effectiveBoard.length > 0 &&
                effectiveBoard.some(
                    (row: Player[]) =>
                        row &&
                        Array.isArray(row) &&
                        row.some((cell: Player) => cell !== Player.None && cell != null)
                );
            if (!hasValidBoard) {
                console.log('[Game] Board state not yet synced from server; ignoring click to avoid desync', {
                    gameId,
                    moveCount,
                    hasBoardState: !!session.boardState
                });
                return;
            }
        }

        // 이미 한 수가 처리 중이면 추가 클릭 무시 (온라인: isMoveInFlight / 싱글·타워: 동기 ref / 전략AI: 낙관적 착수 동기 ref)
        if (isMoveInFlight || pveLocalStonePlacementLockRef.current || strategicAiStoneLockRef.current) {
            console.log('[Game] Move in flight or placement lock, ignoring additional click');
            return;
        }

        // 착수 버튼 모드(ON)면 PC/모바일 모두 pendingMove로 확정 처리
        if (
            settings.features.moveConfirmButtonBox &&
            settings.features.mobileConfirm &&
            isMyTurn &&
            !isItemModeActive
        ) {
            if (
                mode === GameMode.Dice &&
                gameStatus === 'dice_placing' &&
                (session.stonesToPlace ?? 0) <= 0
            ) {
                return;
            }
            if (
                mode === GameMode.Thief &&
                gameStatus === 'thief_placing' &&
                (session.stonesToPlace ?? 0) <= 0
            ) {
                return;
            }
            if (mode === GameMode.Dice && gameStatus === 'dice_placing' && (session.stonesToPlace ?? 0) > 0) {
                if (!isDiceGoLibertyPlacement(session, x, y)) return;
            }
            if (mode === GameMode.Thief && gameStatus === 'thief_placing' && (session.stonesToPlace ?? 0) > 0) {
                if (!isThiefGoValidPlacement(session, x, y, currentUser.id)) return;
            }
            if (pendingMove && pendingMove.x === x && pendingMove.y === y) return;
            setPendingMove({ x, y });
            return;
        }
        
        let actionType: ServerAction['type'] | null = null;
        let payload: any = { gameId, x, y };

        if ((mode === GameMode.Omok || mode === GameMode.Ttamok) && gameStatus === 'playing' && isMyTurn) {
            actionType = 'OMOK_PLACE_STONE';
        } else if (gameStatus === 'scanning' && isMyTurn) {
            audioService.stopScanBgm();
            actionType = 'SCAN_BOARD';
        } else if (gameStatus === 'base_placement') {
            const myStones = currentUser.id === player1.id ? session.baseStones_p1 : session.baseStones_p2;
            if ((myStones?.length || 0) < (session.settings.baseStones || 4)) actionType = 'PLACE_BASE_STONE';
        } else if (mode === GameMode.Dice && gameStatus === 'dice_placing' && isMyTurn && (session.stonesToPlace ?? 0) > 0) {
            if (!isDiceGoLibertyPlacement(session, x, y)) return;
            actionType = 'DICE_PLACE_STONE';
            payload = { gameId, x, y };
        } else if (mode === GameMode.Thief && gameStatus === 'thief_placing' && isMyTurn && (session.stonesToPlace ?? 0) > 0) {
            if (!isThiefGoValidPlacement(session, x, y, currentUser.id)) return;
            actionType = 'THIEF_PLACE_STONE';
            payload = { gameId, x, y };
        } else if (['playing', 'hidden_placing'].includes(gameStatus) && isMyTurn) {
            // 도전의 탑 21층+ 히든 아이템: 서버에 PLACE_STONE(isHidden) 전송 후 로컬에도 반영 (전략바둑 히든과 동일)
            if (isTower && gameStatus === 'hidden_placing') {
                const boardStateToUse = restoredBoardState || session.boardState;
                if (!boardStateToUse || !Array.isArray(boardStateToUse) || boardStateToUse.length === 0) return;
                if (x === -1 || y === -1) return;
                const boardSize = session.settings.boardSize;
                if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) return;
                const opponentPlayerEnum = myPlayerEnum === Player.Black ? Player.White : Player.Black;
                const stoneAtTarget = boardStateToUse[y][x];
                const moveIndexAtTarget = (session.moveHistory || []).findIndex(m => m.x === x && m.y === y);
                const isHiddenTarget = stoneAtTarget === opponentPlayerEnum &&
                    moveIndexAtTarget !== -1 &&
                    !!session.hiddenMoves?.[moveIndexAtTarget] &&
                    !(session.permanentlyRevealedStones || []).some(point => point.x === x && point.y === y);
                if (stoneAtTarget === opponentPlayerEnum && !isHiddenTarget) return;
                if (stoneAtTarget === opponentPlayerEnum && isHiddenTarget) {
                    handlers.handleAction({
                        type: 'PLACE_STONE',
                        payload: {
                            gameId,
                            x,
                            y,
                            isHidden: true,
                            boardState: boardStateToUse,
                            moveHistory: session.moveHistory || [],
                        }
                    } as ServerAction);
                    if (gameStatus === 'hidden_placing') audioService.stopScanBgm();
                    return;
                }
                let moveResult;
                try {
                    moveResult = processMoveClient(
                        boardStateToUse,
                        { x, y, player: myPlayerEnum },
                        session.koInfo,
                        session.moveHistory?.length || 0,
                        { ignoreSuicide: false, isSinglePlayer: true, opponentPlayer: opponentPlayerEnum }
                    );
                } catch (e) {
                    console.error('[Game] Tower hidden placement processMoveClient error:', e);
                    return;
                }
                if (!moveResult.isValid) {
                    if (moveResult.reason === 'ko') showKoRuleFlash();
                    return;
                }
                // 로컬 즉시 반영 (히든 표시 및 playing 전환)
                handlers.handleAction({
                    type: 'TOWER_CLIENT_MOVE',
                    payload: {
                        gameId,
                        x,
                        y,
                        newBoardState: moveResult.newBoardState,
                        capturedStones: moveResult.capturedStones,
                        newKoInfo: moveResult.newKoInfo,
                        isHidden: true,
                    }
                } as any);
                // 서버에 히든 착수 전송 (서버가 hiddenMoves 기록·AI에 비공개)
                handlers.handleAction({
                    type: 'PLACE_STONE',
                    payload: {
                        gameId,
                        x,
                        y,
                        isHidden: true,
                        boardState: boardStateToUse,
                        moveHistory: session.moveHistory || [],
                    }
                } as ServerAction);
                if (gameStatus === 'hidden_placing') audioService.stopScanBgm();
                return;
            }
            // 온라인 전략바둑(대기실·PVP·AI 로비): 상대 히든 칸은 탑과 같이 PLACE_STONE(isHidden)로 공개 요청 (itemUseDeadline만으로 isHidden을 켜면 공개 클릭이 일반 착수로 감)
            if (isOnlineHiddenStrategic && gameStatus === 'hidden_placing') {
                const boardStateToUse = restoredBoardState || session.boardState;
                if (!boardStateToUse || !Array.isArray(boardStateToUse) || boardStateToUse.length === 0) return;
                if (x === -1 || y === -1) return;
                const boardSize = session.settings.boardSize;
                if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) return;
                const opponentPlayerEnum = myPlayerEnum === Player.Black ? Player.White : Player.Black;
                const stoneAtTarget = boardStateToUse[y][x];
                const moveIndexAtTarget = (session.moveHistory || []).findIndex(m => m.x === x && m.y === y);
                const isHiddenTarget =
                    stoneAtTarget === opponentPlayerEnum &&
                    moveIndexAtTarget !== -1 &&
                    !!session.hiddenMoves?.[moveIndexAtTarget] &&
                    !(session.permanentlyRevealedStones || []).some(point => point.x === x && point.y === y);
                if (stoneAtTarget === opponentPlayerEnum && !isHiddenTarget) return;
                if (stoneAtTarget === opponentPlayerEnum && isHiddenTarget) {
                    handlers.handleAction({
                        type: 'PLACE_STONE',
                        payload: {
                            gameId,
                            x,
                            y,
                            isHidden: true,
                            boardState: boardStateToUse,
                            moveHistory: session.moveHistory || [],
                        },
                    } as ServerAction);
                    if (gameStatus === 'hidden_placing') audioService.stopScanBgm();
                    return;
                }
            }
            // 싱글플레이 히든 아이템 착수: 클라이언트에 히든 반영 후 서버로 PLACE_STONE(isHidden) 전송
            if (isSinglePlayer && gameStatus === 'hidden_placing') {
                const boardStateToUse = restoredBoardState || session.boardState;
                if (!boardStateToUse || !Array.isArray(boardStateToUse) || boardStateToUse.length === 0) return;
                if (x === -1 || y === -1) return;
                const boardSize = session.settings.boardSize;
                if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) return;
                const opponentPlayerEnum = myPlayerEnum === Player.Black ? Player.White : Player.Black;
                const stoneAtTarget = boardStateToUse[y][x];
                const moveIndexAtTarget = (session.moveHistory || []).findIndex(m => m.x === x && m.y === y);
                const isHiddenTarget = stoneAtTarget === opponentPlayerEnum &&
                    moveIndexAtTarget !== -1 &&
                    !!session.hiddenMoves?.[moveIndexAtTarget] &&
                    !(session.permanentlyRevealedStones || []).some(point => point.x === x && point.y === y);
                if (stoneAtTarget === opponentPlayerEnum && !isHiddenTarget) return;
                if (stoneAtTarget === opponentPlayerEnum && isHiddenTarget) {
                    handlers.handleAction({
                        type: 'PLACE_STONE',
                        payload: {
                            gameId,
                            x,
                            y,
                            isHidden: true,
                            boardState: boardStateToUse,
                            moveHistory: session.moveHistory || [],
                        }
                    } as ServerAction);
                    if (gameStatus === 'hidden_placing') audioService.stopScanBgm();
                    return;
                }
                let moveResult;
                try {
                    moveResult = processMoveClient(
                        boardStateToUse,
                        { x, y, player: myPlayerEnum },
                        session.koInfo,
                        session.moveHistory?.length || 0,
                        { ignoreSuicide: false, isSinglePlayer: true, opponentPlayer: opponentPlayerEnum }
                    );
                } catch (e) {
                    console.error('[Game] Single player hidden placement processMoveClient error:', e);
                    return;
                }
                if (!moveResult.isValid) {
                    if (moveResult.reason === 'ko') showKoRuleFlash();
                    return;
                }
                handlers.handleAction({
                    type: 'SINGLE_PLAYER_CLIENT_MOVE',
                    payload: {
                        gameId,
                        x,
                        y,
                        newBoardState: moveResult.newBoardState,
                        capturedStones: moveResult.capturedStones,
                        newKoInfo: moveResult.newKoInfo,
                        movePlayer: myPlayerEnum,
                        isHidden: true,
                    }
                } as any);
                handlers.handleAction({
                    type: 'PLACE_STONE',
                    payload: {
                        gameId,
                        x,
                        y,
                        isHidden: true,
                        boardState: moveResult.newBoardState,
                        moveHistory: [...(session.moveHistory || []), { x, y, player: myPlayerEnum }],
                    }
                } as ServerAction);
                if (gameStatus === 'hidden_placing') audioService.stopScanBgm();
                return;
            }
            // 도전의 탑·싱글플레이 일반 착수: 클라이언트에서만 처리 (서버로 전송하지 않음)
            if (isTower || isSinglePlayer) {
                pveLocalStonePlacementLockRef.current = true;
                // 클라이언트에서 직접 게임 상태 업데이트 (검증 없이 무조건 실행)
                console.log(`[Game] ${isTower ? 'Tower' : 'Single player'} game - processing move client-side (no validation):`, { x, y, gameId, currentPlayer: myPlayerEnum });
                
                // boardState가 유효한지 확인 (복원된 boardState 사용)
                const boardStateToUse = restoredBoardState || session.boardState;
                if (!boardStateToUse || !Array.isArray(boardStateToUse) || boardStateToUse.length === 0) {
                    console.error(`[Game] ${isTower ? 'Tower' : 'Single player'} game - boardState is invalid, cannot process move`);
                    pveLocalStonePlacementLockRef.current = false;
                    return;
                }
                
                // 치명적 버그 방지: 패 위치(-1, -1)에 돌을 놓으려는 시도 차단
                if (x === -1 || y === -1) {
                    console.error(`[Game] ${isTower ? 'Tower' : 'Single player'} game - CRITICAL BUG PREVENTION: Attempted to place stone at pass position (${x}, ${y})`);
                    // TODO: 에러 메시지를 사용자에게 표시
                    pveLocalStonePlacementLockRef.current = false;
                    return;
                }

                // 치명적 버그 방지: 보드 범위를 벗어나는 위치에 돌을 놓으려는 시도 차단
                const boardSize = session.settings.boardSize;
                if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) {
                    console.error(`[Game] ${isTower ? 'Tower' : 'Single player'} game - CRITICAL BUG PREVENTION: Attempted to place stone out of bounds (${x}, ${y}), boardSize=${boardSize}`);
                    // TODO: 에러 메시지를 사용자에게 표시
                    pveLocalStonePlacementLockRef.current = false;
                    return;
                }

                // 싱글플레이/도전의 탑에서 AI 돌 위에 착점하는 것 차단
                const opponentPlayerEnum = myPlayerEnum === Player.Black ? Player.White : Player.Black;
                const stoneAtTarget = boardStateToUse[y][x];
                const moveIndexAtTarget = (session.moveHistory || []).findIndex(m => m.x === x && m.y === y);
                const isHiddenTarget = stoneAtTarget === opponentPlayerEnum &&
                    moveIndexAtTarget !== -1 &&
                    !!session.hiddenMoves?.[moveIndexAtTarget] &&
                    !(session.permanentlyRevealedStones || []).some(point => point.x === x && point.y === y);
                if ((isSinglePlayer || isTower) && stoneAtTarget === opponentPlayerEnum && isHiddenTarget) {
                    handlers.handleAction({
                        type: 'LOCAL_HIDDEN_REVEAL_TRIGGER',
                        payload: {
                            gameId,
                            gameType: isTower ? 'tower' : 'singleplayer',
                            point: { x, y },
                            player: opponentPlayerEnum,
                            keepTurn: true
                        }
                    } as any);
                    pveLocalStonePlacementLockRef.current = false;
                    return;
                }
                if ((isSinglePlayer || isTower) && stoneAtTarget === opponentPlayerEnum) {
                    console.error(`[Game] ${isTower ? 'Tower' : 'Single player'} game - CRITICAL BUG PREVENTION: Attempted to place stone on AI stone at (${x}, ${y})`);
                    // TODO: 에러 메시지를 사용자에게 표시
                    pveLocalStonePlacementLockRef.current = false;
                    return;
                }

                if (restrictIntro1OnboardingMove && isSinglePlayer) {
                    if (x !== ONBOARDING_INTRO1_FORCED_CAPTURE_POINT.x || y !== ONBOARDING_INTRO1_FORCED_CAPTURE_POINT.y) {
                        flashBoardRuleMessage('튜토리얼: 표시된 자리에 두세요.');
                        pveLocalStonePlacementLockRef.current = false;
                        return;
                    }
                }

                // 클라이언트에서 move 처리 (바둑 규칙 검증 적용)
                let moveResult;
                try {
                    moveResult = processMoveClient(
                        boardStateToUse,
                        { x, y, player: myPlayerEnum },
                        session.koInfo,
                        session.moveHistory?.length || 0,
                        {
                            ignoreSuicide: false,
                            isSinglePlayer: isSinglePlayer || isTower,
                            opponentPlayer: (isSinglePlayer || isTower) ? opponentPlayerEnum : undefined
                        }
                    );
                } catch (e) {
                    console.error(`[Game] ${isTower ? 'Tower' : 'Single player'} game - processMoveClient error:`, e);
                    // TODO: 에러 메시지를 사용자에게 표시
                    pveLocalStonePlacementLockRef.current = false;
                    return;
                }
                
                // 검증 실패 시 돌을 놓지 않음 (바둑 규칙 준수)
                if (!moveResult.isValid) {
                    console.error(`[Game] ${isTower ? 'Tower' : 'Single player'} game - Invalid move blocked:`, moveResult.reason);
                    if (moveResult.reason === 'ko') showKoRuleFlash();
                    pveLocalStonePlacementLockRef.current = false;
                    return;
                }

                if (
                    restrictIntro1OnboardingMove &&
                    isSinglePlayer &&
                    x === ONBOARDING_INTRO1_FORCED_CAPTURE_POINT.x &&
                    y === ONBOARDING_INTRO1_FORCED_CAPTURE_POINT.y
                ) {
                    setIntro1DemoMoveDone(true);
                    window.dispatchEvent(new CustomEvent(ONBOARDING_INGAME_SP_INTRO1_DEMO_DONE_EVENT));
                }

                // 게임 상태 업데이트 (handlers를 통해, 서버로 전송하지 않음)
                handlers.handleAction({
                    type: isTower ? 'TOWER_CLIENT_MOVE' : 'SINGLE_PLAYER_CLIENT_MOVE',
                    payload: {
                        gameId,
                        x,
                        y,
                        newBoardState: moveResult.newBoardState,
                        capturedStones: moveResult.capturedStones,
                        newKoInfo: moveResult.newKoInfo,
                        movePlayer: myPlayerEnum,
                    }
                } as any);
                return;
            }
            // 전략바둑 AI 대국 포함: 모든 온라인 게임은 서버에서만 검증/반영
            actionType = 'PLACE_STONE';
            const boardStateForOnline = restoredBoardState || session.boardState;
            const opponentEnumOnline = myPlayerEnum === Player.Black ? Player.White : Player.Black;
            let isOpponentHiddenRevealOnline = false;
            if (gameStatus === 'hidden_placing' && boardStateForOnline && session.moveHistory) {
                const st = boardStateForOnline[y][x];
                const mi = session.moveHistory.findIndex(m => m.x === x && m.y === y);
                isOpponentHiddenRevealOnline =
                    st === opponentEnumOnline &&
                    mi !== -1 &&
                    !!session.hiddenMoves?.[mi] &&
                    !(session.permanentlyRevealedStones || []).some(point => point.x === x && point.y === y);
            }
            const activeHiddenPlacement =
                gameStatus === 'hidden_placing' &&
                typeof session.itemUseDeadline === 'number' &&
                session.itemUseDeadline > Date.now();
            payload.isHidden = isOpponentHiddenRevealOnline || activeHiddenPlacement;
            payload.boardState = boardStateForOnline;
            payload.moveHistory = session.moveHistory || [];
            if (payload.isHidden) audioService.stopScanBgm();
        }

        if (actionType === 'SCAN_BOARD' && (isTower || isSinglePlayer || isGuildWarGame)) {
            const sync = buildPveItemActionClientSync(session);
            if (sync) payload.clientSync = sync;
        }

        if (actionType) {
            console.log('[Game] Sending action:', { actionType, payload, isMyTurn, myPlayerEnum, currentPlayer, gameStatus });
            const optimisticAiStonePlace =
                actionType === 'PLACE_STONE' &&
                session.isAiGame &&
                !session.isSinglePlayer &&
                session.gameCategory !== 'tower' &&
                gameStatus === 'playing' &&
                x >= 0 &&
                y >= 0;
            // 전략/모험/길드전 등 온라인 AI 대국: 빈 교차점일 때만 낙관적 반영(상대 돌 위 클릭·판 불일치 시 processMoveClient PVP 차단 로그 방지)
            const boardForOptimistic =
                session.boardState && Array.isArray(session.boardState) && session.boardState.length > 0
                    ? session.boardState
                    : restoredBoardState || session.boardState;
            const canOptimisticAiPlace =
                optimisticAiStonePlace &&
                boardForOptimistic &&
                boardForOptimistic[y]?.[x] === Player.None;
            if (canOptimisticAiPlace && applyOptimisticAiUserMove(x, y)) {
                strategicAiStoneLockRef.current = true;
            }
            setIsMoveInFlight(true);
            void Promise.resolve(handlers.handleAction({ type: actionType, payload } as ServerAction))
                .then((res) => {
                    const hasErr = res && typeof res === 'object' && 'error' in res && (res as { error?: string }).error;
                    if (hasErr) {
                        setIsMoveInFlight(false);
                        if (actionType === 'PLACE_STONE') strategicAiStoneLockRef.current = false;
                        const err = String((res as { error: string }).error);
                        if (actionType === 'PLACE_STONE' && (err.includes('패 모양') || err.includes('코 금지') || (err.includes('바로') && err.includes('따낼')))) {
                            showKoRuleFlash();
                        }
                    } else if (actionType === 'DICE_PLACE_STONE' || actionType === 'THIEF_PLACE_STONE') {
                        // 주사위/도둑: 낙관적 갱신은 moveHistory를 늘리지 않아 moveHistory 기반 잠금 해제가 되지 않음 → 매 수마다 해제
                        setIsMoveInFlight(false);
                    }
                })
                .finally(() => {
                    // 성공 경로에서는 AI 응답 후 내 턴이 돌아올 때 effect에서 해제한다.
                });
        } else {
            console.log('[Game] No action type determined', { 
                isMyTurn, 
                myPlayerEnum, 
                currentPlayer, 
                gameStatus,
                mode,
                blackPlayerId: session.blackPlayerId,
                whitePlayerId: session.whitePlayerId,
                currentUser: currentUser.id
            });
        }
    }, [
        isSpectator,
        gameStatus,
        isMyTurn,
        gameId,
        handlers.handleAction,
        currentUser.id,
        player1.id,
        session.baseStones_p1,
        session.baseStones_p2,
        session.settings.baseStones,
        mode,
        isMobile,
        settings.features.moveConfirmButtonBox,
        settings.features.mobileConfirm,
        pendingMove,
        isItemModeActive,
        session.isSinglePlayer,
        session.isAiGame,
        session.gameCategory,
        isPaused,
        isBoardLocked,
        restoredBoardState,
        session.boardState,
        session.moveHistory,
        session.stonesToPlace,
        isMoveInFlight,
        isTower,
        isSinglePlayer,
        isGuildWarGame,
        isOnlineHiddenStrategic,
        showKoRuleFlash,
        myPlayerEnum,
        applyOptimisticAiUserMove,
        restrictIntro1OnboardingMove,
        flashBoardRuleMessage,
        session.stageId,
        session.hiddenMoves,
        session.permanentlyRevealedStones,
        session.itemUseDeadline,
    ]);

    const handleConfirmMove = useCallback(() => {
        audioService.stopTimerWarning();
        if (!pendingMove) return;
        if (gameStatus === 'ended' || gameStatus === 'no_contest' || gameStatus === 'scoring') {
            setPendingMove(null);
            return;
        }
        const x = pendingMove.x;
        const y = pendingMove.y;

        // 이미 한 수가 처리 중이면 추가 확정 무시
        if (isMoveInFlight || pveLocalStonePlacementLockRef.current || strategicAiStoneLockRef.current) {
            console.log('[Game] Move in flight or placement lock, ignoring confirm');
            return;
        }

        const isTower = session.gameCategory === 'tower';
        const isPVEGame = session.isSinglePlayer || isTower || session.gameCategory === 'singleplayer';

        let actionType: ServerAction['type'] | null = null;
        let payload: any = { gameId, x, y };

        if ((mode === GameMode.Omok || mode === GameMode.Ttamok) && gameStatus === 'playing' && isMyTurn) {
            actionType = 'OMOK_PLACE_STONE';
        } else if (mode === GameMode.Dice && gameStatus === 'dice_placing' && isMyTurn && (session.stonesToPlace ?? 0) > 0) {
            if (!isDiceGoLibertyPlacement(session, x, y)) {
                setPendingMove(null);
                return;
            }
            actionType = 'DICE_PLACE_STONE';
            payload = { gameId, x, y };
        } else if (mode === GameMode.Thief && gameStatus === 'thief_placing' && isMyTurn && (session.stonesToPlace ?? 0) > 0) {
            if (!isThiefGoValidPlacement(session, x, y, currentUser.id)) {
                setPendingMove(null);
                return;
            }
            actionType = 'THIEF_PLACE_STONE';
            payload = { gameId, x, y };
        } else if (['playing', 'hidden_placing'].includes(gameStatus) && isMyTurn) {
            // PVE(싱글/타워): 클라이언트에서 즉시 반영
            if (isPVEGame) {
                pveLocalStonePlacementLockRef.current = true;
                const boardStateToUse = restoredBoardState || session.boardState;
                if (!boardStateToUse || !Array.isArray(boardStateToUse) || boardStateToUse.length === 0) {
                    pveLocalStonePlacementLockRef.current = false;
                    setPendingMove(null);
                    return;
                }
                const boardSize = session.settings.boardSize;
                if (x === -1 || y === -1) {
                    pveLocalStonePlacementLockRef.current = false;
                    setPendingMove(null);
                    return;
                }
                if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) {
                    pveLocalStonePlacementLockRef.current = false;
                    setPendingMove(null);
                    return;
                }

                const opponentPlayerEnum = myPlayerEnum === Player.Black ? Player.White : Player.Black;

                if (restrictIntro1OnboardingMove && session.isSinglePlayer) {
                    if (x !== ONBOARDING_INTRO1_FORCED_CAPTURE_POINT.x || y !== ONBOARDING_INTRO1_FORCED_CAPTURE_POINT.y) {
                        flashBoardRuleMessage('튜토리얼: 표시된 자리에 두세요.');
                        pveLocalStonePlacementLockRef.current = false;
                        setPendingMove(null);
                        return;
                    }
                }

                let moveResult;
                try {
                    moveResult = processMoveClient(
                        boardStateToUse,
                        { x, y, player: myPlayerEnum },
                        session.koInfo,
                        session.moveHistory?.length || 0,
                        { ignoreSuicide: false, isSinglePlayer: true, opponentPlayer: opponentPlayerEnum }
                    );
                } catch (e) {
                    console.error('[Game] Confirm move processMoveClient error:', e);
                    pveLocalStonePlacementLockRef.current = false;
                    setPendingMove(null);
                    return;
                }
                if (!moveResult.isValid) {
                    if (moveResult.reason === 'ko') showKoRuleFlash();
                    pveLocalStonePlacementLockRef.current = false;
                    setPendingMove(null);
                    return;
                }

                if (
                    restrictIntro1OnboardingMove &&
                    session.isSinglePlayer &&
                    x === ONBOARDING_INTRO1_FORCED_CAPTURE_POINT.x &&
                    y === ONBOARDING_INTRO1_FORCED_CAPTURE_POINT.y
                ) {
                    setIntro1DemoMoveDone(true);
                    window.dispatchEvent(new CustomEvent(ONBOARDING_INGAME_SP_INTRO1_DEMO_DONE_EVENT));
                }

                actionType = isTower ? ('TOWER_CLIENT_MOVE' as any) : ('SINGLE_PLAYER_CLIENT_MOVE' as any);
                payload = {
                    gameId,
                    x,
                    y,
                    newBoardState: moveResult.newBoardState,
                    capturedStones: moveResult.capturedStones,
                    newKoInfo: moveResult.newKoInfo,
                    // 히든 배치 상태에서는 히든 착수로 처리(타워 21층+ 등)
                    ...(gameStatus === 'hidden_placing' ? { isHidden: true } : {}),
                };
            } else {
                // 온라인 게임(전략바둑 AI 대국 포함): 서버에서 검증/반영
                actionType = 'PLACE_STONE';
                const boardStateToUse = restoredBoardState || session.boardState;
                const opponentPlayerEnum = myPlayerEnum === Player.Black ? Player.White : Player.Black;
                let isOpponentHiddenReveal = false;
                if (gameStatus === 'hidden_placing' && boardStateToUse && session.moveHistory) {
                    const stoneAtTarget = boardStateToUse[y][x];
                    const moveIndexAtTarget = session.moveHistory.findIndex(m => m.x === x && m.y === y);
                    isOpponentHiddenReveal =
                        stoneAtTarget === opponentPlayerEnum &&
                        moveIndexAtTarget !== -1 &&
                        !!session.hiddenMoves?.[moveIndexAtTarget] &&
                        !(session.permanentlyRevealedStones || []).some(point => point.x === x && point.y === y);
                }
                const activeHiddenPlacement =
                    gameStatus === 'hidden_placing' &&
                    typeof session.itemUseDeadline === 'number' &&
                    session.itemUseDeadline > Date.now();
                payload.isHidden = isOpponentHiddenReveal || activeHiddenPlacement;
                payload.boardState = boardStateToUse;
                payload.moveHistory = session.moveHistory || [];
            }
        }

        if (actionType) {
            const optimisticAiStonePlaceConfirm =
                actionType === 'PLACE_STONE' &&
                session.isAiGame &&
                !session.isSinglePlayer &&
                session.gameCategory !== 'tower' &&
                gameStatus === 'playing' &&
                x >= 0 &&
                y >= 0;
            const boardForOptimisticConfirm =
                session.boardState && Array.isArray(session.boardState) && session.boardState.length > 0
                    ? session.boardState
                    : restoredBoardState || session.boardState;
            const canOptimisticAiPlaceConfirm =
                optimisticAiStonePlaceConfirm &&
                boardForOptimisticConfirm &&
                boardForOptimisticConfirm[y]?.[x] === Player.None;
            if (canOptimisticAiPlaceConfirm && applyOptimisticAiUserMove(x, y)) {
                strategicAiStoneLockRef.current = true;
            }
            setIsMoveInFlight(true);
            const at = actionType;
            void Promise.resolve(handlers.handleAction({ type: at, payload } as ServerAction))
                .then((res) => {
                    const hasErr = res && typeof res === 'object' && 'error' in res && (res as { error?: string }).error;
                    if (hasErr) {
                        setIsMoveInFlight(false);
                        if (at === 'PLACE_STONE') strategicAiStoneLockRef.current = false;
                        const err = String((res as { error: string }).error);
                        if (at === 'PLACE_STONE' && (err.includes('패 모양') || err.includes('코 금지') || (err.includes('바로') && err.includes('따낼')))) {
                            showKoRuleFlash();
                        }
                    } else if (at === 'DICE_PLACE_STONE' || at === 'THIEF_PLACE_STONE') {
                        setIsMoveInFlight(false);
                    }
                })
                .finally(() => {
                    // 성공 경로에서는 AI 응답 후 내 턴이 돌아올 때 effect에서 해제한다.
                });
        }
        setPendingMove(null);
    }, [
        pendingMove,
        gameId,
        handlers,
        gameStatus,
        isMyTurn,
        mode,
        restoredBoardState,
        isMoveInFlight,
        session.gameCategory,
        session.isSinglePlayer,
        session.boardState,
        session.settings.boardSize,
        session.koInfo,
        session.moveHistory,
        session.stonesToPlace,
        myPlayerEnum,
        showKoRuleFlash,
        session.isAiGame,
        applyOptimisticAiUserMove,
        restrictIntro1OnboardingMove,
        flashBoardRuleMessage,
        session.stageId,
        session.hiddenMoves,
        session.permanentlyRevealedStones,
        session.itemUseDeadline,
    ]);

    const handleCancelMove = useCallback(() => setPendingMove(null), []);

    const clearPauseCountdown = useCallback(() => {
        if (pauseCountdownIntervalRef.current) {
            clearInterval(pauseCountdownIntervalRef.current);
            pauseCountdownIntervalRef.current = null;
        }
    }, []);

    const resumeFromPause = useCallback(() => {
        if (!isPaused) return;
        if (resumeCountdown > 0) return;

        setIsPaused(false);
        setResumeCountdown(0);
        setPauseButtonCooldown(5);
        // 싱글플레이/도전의 탑은 클라이언트가 타이머를 직접 조정(로컬 실행)
        // 일반 AI 대국은 서버가 타이머를 관리하므로 여기서 deadline을 조정하지 않음
        const isTower = session.gameCategory === 'tower';
        const shouldAdjustDeadlinesLocally = session.isSinglePlayer || isTower;

        if (shouldAdjustDeadlinesLocally && pauseStartedAtRef.current) {
            const pausedDuration = Date.now() - pauseStartedAtRef.current;
            pauseStartedAtRef.current = null;
            const newTurnDeadline = session.turnDeadline ? session.turnDeadline + pausedDuration : undefined;
            const newItemDeadline = session.itemUseDeadline ? session.itemUseDeadline + pausedDuration : undefined;
            const newSharedDeadline = session.basePlacementDeadline ? session.basePlacementDeadline + pausedDuration : undefined;
            if (newTurnDeadline || newItemDeadline || newSharedDeadline) {
                session.turnDeadline = newTurnDeadline ?? session.turnDeadline;
                session.itemUseDeadline = newItemDeadline ?? session.itemUseDeadline;
                session.basePlacementDeadline = newSharedDeadline ?? session.basePlacementDeadline;
            }
        }
        clearPauseCountdown();
    }, [isPaused, resumeCountdown, clearPauseCountdown, session]);

    const initiatePause = useCallback(() => {
        if (isPaused || pauseButtonCooldown > 0) return;
        audioService.stopTimerWarning();
        pauseStartedAtRef.current = Date.now();
        setIsPaused(true);
        setResumeCountdown(5);
        clearPauseCountdown();
        pauseCountdownIntervalRef.current = setInterval(() => {
            setResumeCountdown(prev => {
                if (prev <= 1) {
                    clearPauseCountdown();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [isPaused, pauseButtonCooldown, clearPauseCountdown]);

    const handlePauseToggle = useCallback(() => {
        const isTower = session.gameCategory === 'tower';
        const isPausableAiGame =
            session.isAiGame &&
            !session.isSinglePlayer &&
            session.gameCategory !== 'tower' &&
            session.gameCategory !== 'singleplayer';
        if (!(session.isSinglePlayer || isTower || isPausableAiGame)) return;
        if (!isPaused) {
            initiatePause();
            if (isPausableAiGame) {
                handlers.handleAction({ type: 'PAUSE_AI_GAME', payload: { gameId: session.id } } as any);
            }
        } else {
            resumeFromPause();
            if (isPausableAiGame) {
                handlers.handleAction({ type: 'RESUME_AI_GAME', payload: { gameId: session.id } } as any);
            }
        }
    }, [isPaused, initiatePause, resumeFromPause, session.isSinglePlayer, session.gameCategory, session.isAiGame, session.id, handlers.handleAction]);

    useEffect(() => {
        if (pauseButtonCooldown <= 0) return;
        const interval = setInterval(() => {
            setPauseButtonCooldown(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [pauseButtonCooldown]);

    const analysisResult = useMemo(() => session.analysisResult?.[currentUser.id] ?? (['ended','no_contest'].includes(gameStatus) ? session.analysisResult?.['system'] : null), [session.analysisResult, currentUser.id, gameStatus]);

    const isNoContestLeaveAvailable = useMemo(() => {
        if (isSpectator || session.isAiGame) return false;
        return !!session.canRequestNoContest?.[currentUser.id];
    }, [session.canRequestNoContest, currentUser.id, isSpectator, session.isAiGame]);

    const handleLeaveOrResignClick = useCallback(() => {
        if (isSpectator) {
            handlers.handleAction({ type: 'LEAVE_SPECTATING' });
            return;
        }
        if (['ended', 'no_contest', 'rematch_pending'].includes(gameStatus)) {
            const actionType = session.isAiGame ? 'LEAVE_AI_GAME' : 'LEAVE_GAME_ROOM';
            // AI/일반 게임 종료 후 나가기 시 해당 종류의 대기실로 이동 (전략/놀이 대기실 AI를 먼저 판별해 싱글·탑으로 잘못 나가는 버그 방지)
            if (session.gameCategory === 'guildwar') {
                sessionStorage.setItem('postGameRedirect', '#/guildwar');
            } else if (session.gameCategory === 'tower') {
                sessionStorage.setItem('postGameRedirect', '#/tower');
            } else if (session.gameCategory === 'adventure') {
                const stageId = session.adventureStageId;
                sessionStorage.setItem('postGameRedirect', stageId ? `#/adventure/${stageId}` : '#/adventure');
            } else if (session.settings?.pairGame) {
                sessionStorage.setItem('postGameRedirect', '#/pair');
            } else if (session.isAiGame && (SPECIAL_GAME_MODES.some(m => m.mode === session.mode) || PLAYFUL_GAME_MODES.some(m => m.mode === session.mode))) {
                const waitingRoomMode = SPECIAL_GAME_MODES.some(m => m.mode === session.mode) ? 'strategic' as const : 'playful' as const;
                sessionStorage.setItem('postGameRedirect', `#/waiting/${waitingRoomMode}`);
            } else if (session.gameCategory === 'singleplayer' || session.isSinglePlayer) {
                sessionStorage.setItem('postGameRedirect', '#/singleplayer');
            } else {
                // 일반 게임(전략/놀이바둑): 전략이면 전략 대기실, 그 외는 놀이바둑 대기실로 이동
                const waitingRoomMode = SPECIAL_GAME_MODES.some(m => m.mode === session.mode) ? 'strategic' as const : 'playful' as const;
                sessionStorage.setItem('postGameRedirect', `#/waiting/${waitingRoomMode}`);
            }
            handlers.handleAction({ type: actionType, payload: { gameId } });
            return;
        }
        if (isNoContestLeaveAvailable) {
            if (window.confirm("상대방의 장고로 인해 페널티 없이 무효 처리하고 나가시겠습니까?")) {
                handlers.handleAction({ type: 'REQUEST_NO_CONTEST_LEAVE', payload: { gameId } });
            }
        } else {
            setConfirmModalType('resign');
        }
    }, [
        isSpectator,
        handlers.handleAction,
        session.isAiGame,
        session.isSinglePlayer,
        session.gameCategory,
        session.adventureStageId,
        session.mode,
        session.settings?.pairGame,
        gameId,
        gameStatus,
        isNoContestLeaveAvailable,
    ]);

    useEffect(() => {
        const gameHash = `#/game/${gameId}`;
        const shouldInterceptBackNavigation =
            !isSpectator &&
            !['ended', 'no_contest', 'rematch_pending'].includes(gameStatus);

        if (!shouldInterceptBackNavigation) return;

        const interceptBackNavigation = () => {
            if (window.location.hash === gameHash) return;
            // 뒤로가기로 경기장을 벗어나려는 경우, 화면은 유지하고 기권/나가기 확인 흐름을 재사용한다.
            replaceAppHash(gameHash);
            handleLeaveOrResignClick();
        };

        // 일부 모바일 웹뷰는 하드웨어 뒤로가기에서 hashchange 또는 popstate 중 하나만 발생시킬 수 있어 둘 다 구독한다.
        window.addEventListener('hashchange', interceptBackNavigation);
        window.addEventListener('popstate', interceptBackNavigation);
        return () => {
            window.removeEventListener('hashchange', interceptBackNavigation);
            window.removeEventListener('popstate', interceptBackNavigation);
        };
    }, [gameId, gameStatus, isSpectator, handleLeaveOrResignClick]);

    useEffect(() => {
        return () => {
            clearPauseCountdown();
        };
    }, [clearPauseCountdown]);

    useEffect(() => {
        const isTower = session.gameCategory === 'tower';
        const isAdventure = session.gameCategory === 'adventure';
        if (!(session.isSinglePlayer || isTower || isAdventure)) return;
        if (isPaused && ['ended', 'no_contest'].includes(gameStatus)) {
            resumeFromPause();
        }
    }, [session.isSinglePlayer, isPaused, gameStatus, resumeFromPause, session.gameCategory]);

    // 게임 ID가 바뀔 때만 일시정지/재개 상태 초기화 (다른 게임으로 이동)
    useEffect(() => {
        setIsPaused(false);
        setResumeCountdown(0);
        setPauseButtonCooldown(0);
        pauseStartedAtRef.current = null;
        clearPauseCountdown();
        setIsBoardLocked(false);
        setLastReceivedServerRevision(session.serverRevision ?? 0);
        pveLocalStonePlacementLockRef.current = false;
        strategicAiStoneLockRef.current = false;
    }, [session.id, clearPauseCountdown]);

    // 같은 게임 내 serverRevision 변경 시: 최신 리비전 반영 및 보드 잠금 해제 (일시정지 상태는 유지)
    useEffect(() => {
        if (session.serverRevision !== undefined) {
            setLastReceivedServerRevision(session.serverRevision);
            setIsBoardLocked(false);
        }
    }, [session.serverRevision]);

    // currentPlayer 변경 감지: AI가 돌을 둔 경우 보드 잠금 (싱글플레이만 — 타워는 클라 수라 serverRevision이 안 올라 잠금이 풀리지 않을 수 있음)
    useEffect(() => {
        if (!session.isSinglePlayer || prevCurrentPlayer === undefined) return;
        const myPl = blackPlayerId === currentUser.id ? Player.Black : whitePlayerId === currentUser.id ? Player.White : Player.None;
        const wasMyTurn = prevCurrentPlayer === myPl;
        const isNowMyTurn = currentPlayer === myPl;

        if (wasMyTurn && !isNowMyTurn) {
            console.log('[Game] AI moved, locking board until serverRevision update', {
                prevCurrentPlayer,
                currentPlayer,
                myPlayerEnum: myPl,
                wasMyTurn,
                isNowMyTurn,
            });
            setIsBoardLocked(true);
        }
    }, [currentPlayer, prevCurrentPlayer, session.isSinglePlayer, currentUser.id, blackPlayerId, whitePlayerId]);

    // serverRevision 변경 감지: 최신 상태를 받은 경우 보드 잠금 해제
    useEffect(() => {
        if (session.isSinglePlayer && session.serverRevision !== undefined) {
            const newRevision = session.serverRevision;
            if (newRevision > lastReceivedServerRevision) {
                setLastReceivedServerRevision(newRevision);
                // 최신 상태를 받았으므로 잠금 해제
                if (isBoardLocked) {
                    console.log('[Game] Received latest serverRevision, unlocking board');
                    setIsBoardLocked(false);
                }
            }
        }
    }, [session.serverRevision, session.isSinglePlayer, lastReceivedServerRevision, isBoardLocked]);

    const aiStuckGameStateSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const aiStuckPostSyncFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastStuckRecoverySyncAtRef = useRef(0);
    const towerAutoScoringRecoveryKeyRef = useRef<string | null>(null);
    const aiStuckWatchRef = useRef({
        id: '',
        gameStatus: '' as GameStatus,
        currentPlayer: Player.None,
        moveHistoryLength: 0,
        useClientSideAi: false,
        isAiGame: false,
        blackPlayerId: '' as string | undefined,
        whitePlayerId: '' as string | undefined,
    });
    const handleActionRef = useRef(handlers.handleAction);
    handleActionRef.current = handlers.handleAction;

    // 도전의 탑: 마지막 착수 직후 자동계가 요청이 유실되거나 새로고침되면,
    // sessionStorage로 복원된 0/N 수순을 기준으로 서버 계가를 재트리거한다.
    useEffect(() => {
        if (!isTower) return;
        if (gameStatus !== 'playing' && gameStatus !== 'hidden_placing') return;
        const autoScoringTurns = Number((sessionWithRestoredPatternStones.settings as any)?.autoScoringTurns);
        if (!Number.isFinite(autoScoringTurns) || autoScoringTurns <= 0) return;

        const moveHistory = sessionWithRestoredPatternStones.moveHistory || [];
        const validMoves = moveHistory.filter((m) => m && m.x !== -1 && m.y !== -1);
        const totalTurns = validMoves.length;
        if (totalTurns < autoScoringTurns) return;

        const boardState = restoredBoardState || sessionWithRestoredPatternStones.boardState;
        const boardSize = sessionWithRestoredPatternStones.settings?.boardSize || 9;
        const boardStateValid =
            Array.isArray(boardState) &&
            boardState.length === boardSize &&
            boardState.every((row: any) => Array.isArray(row) && row.length === boardSize);
        if (!boardStateValid) return;

        const recoveryKey = `${sessionWithRestoredPatternStones.id}:${totalTurns}:${autoScoringTurns}`;
        if (towerAutoScoringRecoveryKeyRef.current === recoveryKey) return;
        towerAutoScoringRecoveryKeyRef.current = recoveryKey;

        const snapshotBoardState = boardState.map((row: any[]) => [...row]);
        const snapshotMoveHistory = moveHistory.map((m: any) => ({ ...m }));
        void handleActionRef.current({
            type: 'PLACE_STONE',
            payload: {
                gameId: sessionWithRestoredPatternStones.id,
                x: -1,
                y: -1,
                triggerAutoScoring: true,
                totalTurns,
                moveHistory: snapshotMoveHistory,
                boardState: snapshotBoardState,
                blackTimeLeft: sessionWithRestoredPatternStones.blackTimeLeft,
                whiteTimeLeft: sessionWithRestoredPatternStones.whiteTimeLeft,
                captures: sessionWithRestoredPatternStones.captures,
                hiddenMoves: sessionWithRestoredPatternStones.hiddenMoves ?? undefined,
                permanentlyRevealedStones: Array.isArray(sessionWithRestoredPatternStones.permanentlyRevealedStones)
                    ? sessionWithRestoredPatternStones.permanentlyRevealedStones
                    : undefined,
            },
        } as unknown as ServerAction).catch((err) => {
            towerAutoScoringRecoveryKeyRef.current = null;
            console.error('[Game] Tower auto-scoring recovery failed:', err);
        });
    }, [
        isTower,
        gameStatus,
        sessionWithRestoredPatternStones.id,
        sessionWithRestoredPatternStones.moveHistory,
        sessionWithRestoredPatternStones.boardState,
        sessionWithRestoredPatternStones.settings,
        sessionWithRestoredPatternStones.blackTimeLeft,
        sessionWithRestoredPatternStones.whiteTimeLeft,
        sessionWithRestoredPatternStones.captures,
        sessionWithRestoredPatternStones.hiddenMoves,
        sessionWithRestoredPatternStones.permanentlyRevealedStones,
        restoredBoardState,
    ]);

    aiStuckWatchRef.current = {
        id: session.id,
        gameStatus,
        currentPlayer,
        moveHistoryLength: session.moveHistory?.length ?? 0,
        useClientSideAi: !!(session.settings as any)?.useClientSideAi,
        isAiGame: !!session.isAiGame,
        blackPlayerId: session.blackPlayerId ?? undefined,
        whitePlayerId: session.whitePlayerId ?? undefined,
    };

    // 모험·길드전 등 Kata 계열 AI 대국: AI(봇) 차례에 일정 시간 착수가 없으면 동기화 → 필요 시 서버 직접 수(클라 AI 폴백)
    useEffect(() => {
        if (aiStuckGameStateSyncTimeoutRef.current) {
            clearTimeout(aiStuckGameStateSyncTimeoutRef.current);
            aiStuckGameStateSyncTimeoutRef.current = null;
        }
        if (aiStuckPostSyncFallbackRef.current) {
            clearTimeout(aiStuckPostSyncFallbackRef.current);
            aiStuckPostSyncFallbackRef.current = null;
        }
        const kataServerAiCategories = new Set(['tower', 'singleplayer', 'guildwar', 'adventure']);
        const isKataServerAiContext =
            !!session.isAiGame &&
            (session.isSinglePlayer || kataServerAiCategories.has(String(session.gameCategory ?? '')));
        const eligibleKataContext =
            session.isAiGame &&
            KATA_STYLE_AI_GO_MODES.has(mode) &&
            (isKataServerAiContext || session.gameCategory !== 'tower');
        if (!eligibleKataContext || !STRATEGIC_AI_STUCK_RECOVERABLE_STATUSES.has(gameStatus)) return;
        if (isKataServerAiContext && gameStatus === 'hidden_reveal_animating') return;

        const manuallyPausedAi =
            session.isAiGame &&
            !session.isSinglePlayer &&
            session.gameCategory !== 'tower' &&
            session.gameCategory !== 'singleplayer' &&
            session.pausedTurnTimeLeft !== undefined &&
            !session.turnDeadline &&
            !session.itemUseDeadline;
        if (manuallyPausedAi) return;

        if (currentPlayer === Player.None) return;

        const currentPlayerId =
            currentPlayer === Player.Black ? session.blackPlayerId : session.whitePlayerId;
        const isAiBotTurn =
            currentPlayerId === AI_USER_ID ||
            (session.isAiGame && currentPlayerId === 'ai-player-01') ||
            (!!currentPlayerId && String(currentPlayerId).startsWith('dungeon-bot-'));
        if (!isAiBotTurn) return;

        const AI_STUCK_NO_MOVE_MS = 12_000;
        const POST_SYNC_FALLBACK_MS = 7_000;
        const STUCK_SYNC_COOLDOWN_MS = 8_000;
        const gameIdForSync = session.id;
        aiStuckGameStateSyncTimeoutRef.current = setTimeout(() => {
            aiStuckGameStateSyncTimeoutRef.current = null;
            const now = Date.now();
            if (now - lastStuckRecoverySyncAtRef.current < STUCK_SYNC_COOLDOWN_MS) return;
            lastStuckRecoverySyncAtRef.current = now;
            const w = aiStuckWatchRef.current;
            if (w.id !== gameIdForSync) return;
            const moveLenBeforeSync = w.moveHistoryLength;
            const useServerAiKick =
                w.isAiGame &&
                (sessionRefForPveAiHiddenFollowup.current.isSinglePlayer ||
                    kataServerAiCategories.has(
                        String(sessionRefForPveAiHiddenFollowup.current.gameCategory ?? ''),
                    ));
            if (useServerAiKick) {
                const latestSession = sessionRefForPveAiHiddenFollowup.current;
                const clientSync = buildPveItemActionClientSync(latestSession);
                void handleActionRef.current({
                    type: 'REQUEST_SERVER_AI_MOVE',
                    payload: clientSync
                        ? { gameId: gameIdForSync, clientSync }
                        : { gameId: gameIdForSync },
                } as ServerAction);
            } else {
                void handleActionRef.current({
                    type: 'REQUEST_GAME_STATE_SYNC',
                    payload: { gameId: gameIdForSync },
                } as ServerAction);
            }

            if (aiStuckPostSyncFallbackRef.current) {
                clearTimeout(aiStuckPostSyncFallbackRef.current);
                aiStuckPostSyncFallbackRef.current = null;
            }
            aiStuckPostSyncFallbackRef.current = setTimeout(() => {
                aiStuckPostSyncFallbackRef.current = null;
                const w2 = aiStuckWatchRef.current;
                if (w2.id !== gameIdForSync) return;
                if (w2.moveHistoryLength !== moveLenBeforeSync) return;
                if (!STRATEGIC_AI_STUCK_RECOVERABLE_STATUSES.has(w2.gameStatus)) return;
                const pid =
                    w2.currentPlayer === Player.Black ? w2.blackPlayerId : w2.whitePlayerId;
                const stillAi =
                    w2.isAiGame &&
                    (pid === AI_USER_ID ||
                        pid === 'ai-player-01' ||
                        (!!pid && String(pid).startsWith('dungeon-bot-')));
                if (!stillAi) return;
                if (useServerAiKick || w2.useClientSideAi) {
                    const latestSession = sessionRefForPveAiHiddenFollowup.current;
                    const clientSync = buildPveItemActionClientSync(latestSession);
                    void handleActionRef.current({
                        type: 'REQUEST_SERVER_AI_MOVE',
                        payload: clientSync
                            ? { gameId: gameIdForSync, clientSync }
                            : { gameId: gameIdForSync },
                    } as ServerAction);
                } else {
                    void handleActionRef.current({
                        type: 'REQUEST_GAME_STATE_SYNC',
                        payload: { gameId: gameIdForSync },
                    } as ServerAction);
                }
            }, POST_SYNC_FALLBACK_MS);
        }, AI_STUCK_NO_MOVE_MS);
        return () => {
            if (aiStuckGameStateSyncTimeoutRef.current) {
                clearTimeout(aiStuckGameStateSyncTimeoutRef.current);
                aiStuckGameStateSyncTimeoutRef.current = null;
            }
            if (aiStuckPostSyncFallbackRef.current) {
                clearTimeout(aiStuckPostSyncFallbackRef.current);
                aiStuckPostSyncFallbackRef.current = null;
            }
        };
    }, [
        session.id,
        session.isAiGame,
        session.isSinglePlayer,
        session.gameCategory,
        session.pausedTurnTimeLeft,
        session.turnDeadline,
        session.itemUseDeadline,
        session.moveHistory?.length,
        (session.settings as any)?.useClientSideAi,
        mode,
        gameStatus,
        currentPlayer,
        session.blackPlayerId,
        session.whitePlayerId,
    ]);

    // 싱글플레이: 클라이언트 측 AI 자동 처리 (서버 부하 최소화)
    // 보드 잠금은 사용자 입력만 막는 것이므로, AI 수 계산은 보드 잠금과 독립적으로 실행
    const aiMoveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastAiMoveRef = useRef<{
        gameId: string;
        moveHistoryLength: number;
        player: Player;
        timestamp: number;
        /** 히든 공개 등으로 수순 길이는 같아도 국면이 바뀐 경우 AI가 다시 계산하도록 구분 */
        revealSig: number;
    } | null>(null);
    
    // moveHistoryLength 변경 시 lastAiMoveRef 검증 및 초기화
    useEffect(() => {
        if (lastAiMoveRef.current) {
            const currentMoveHistoryLength = session.moveHistory?.length || 0;
            // moveHistoryLength가 증가했거나, 타임스탬프가 3초 이상 지났으면 초기화
            const timeSinceLastMove = Date.now() - lastAiMoveRef.current.timestamp;
            if (currentMoveHistoryLength > lastAiMoveRef.current.moveHistoryLength || timeSinceLastMove > 3000) {
                console.log('[Game] Resetting lastAiMoveRef:', {
                    reason: currentMoveHistoryLength > lastAiMoveRef.current.moveHistoryLength ? 'moveHistoryLength increased' : 'timeout',
                    lastMove: lastAiMoveRef.current,
                    currentMoveHistoryLength,
                    timeSinceLastMove
                });
                lastAiMoveRef.current = null;
            }
        }
    }, [session.moveHistory?.length, session.permanentlyRevealedStones?.length]);
    
    useEffect(() => {
        // 이전 timeout이 있으면 취소
        if (aiMoveTimeoutRef.current) {
            clearTimeout(aiMoveTimeoutRef.current);
            aiMoveTimeoutRef.current = null;
        }
        
        const isTower = session.gameCategory === 'tower';
        const isGuildWarGame = session.gameCategory === 'guildwar';
        const isAdventureGame = session.gameCategory === 'adventure';
        const isPlayfulAiGame = session.isAiGame && PLAYFUL_GAME_MODES.some(m => m.mode === mode);
        // 게임이 종료되었거나 일시정지되었거나 플레이 중이 아니면 AI 수를 보내지 않음
        // 놀이바둑 AI 게임도 클라이언트에서 처리
        // 모험: 서버 큐만 기대하면 AI 턴이 영구 정지할 수 있어 타워·길드전과 같이 REQUEST_SERVER_AI_MOVE 복구 경로에 포함
        if (!(session.isSinglePlayer || isTower || isGuildWarGame || isPlayfulAiGame || isAdventureGame) || isPaused || gameStatus !== 'playing') {
            lastAiMoveRef.current = null;
            return;
        }
        if (currentPlayer === Player.None) {
            lastAiMoveRef.current = null;
            return;
        }
        
        // 게임이 제대로 초기화되지 않았으면 AI 수를 보내지 않음
        const boardStateToCheck = restoredBoardState || session.boardState;
        if (!boardStateToCheck || !Array.isArray(boardStateToCheck) || boardStateToCheck.length === 0) return;
        if (!session.blackPlayerId || !session.whitePlayerId) return;
        
        // 게임 ID가 유효한지 확인 (재도전 시 게임 ID가 변경될 수 있음)
        if (!session.id || typeof session.id !== 'string') return;

        const aiPlayerId = currentPlayer === Player.Black ? session.blackPlayerId : session.whitePlayerId;
        // 놀이바둑 AI 게임도 클라이언트에서 처리
        const isAiTurn = aiPlayerId === AI_USER_ID || (session.isAiGame && aiPlayerId === 'ai-player-01');

        // Safety: ai_thinking이 "실제 진행 중"일 때만 AI 전송 차단 (stale ai_thinking 잔존으로 영구 정지 방지)
        const aiThinkingAnim = session.animation as { type?: string; startTime?: number } | undefined;
        const aiThinkingEndTime = (session as any).aiHiddenItemAnimationEndTime as number | undefined;
        const aiThinkingStart = Number(aiThinkingAnim?.startTime ?? 0);
        const aiThinkingFallbackEnd = Number.isFinite(aiThinkingStart) && aiThinkingStart > 0 ? aiThinkingStart + 6050 : 0;
        const aiThinkingEffectiveEnd = Number.isFinite(aiThinkingEndTime as number)
            ? Number(aiThinkingEndTime)
            : aiThinkingFallbackEnd;
        const isServerAiHiddenAnimationInProgress =
            aiThinkingAnim?.type === 'ai_thinking' &&
            Number.isFinite(aiThinkingEffectiveEnd) &&
            aiThinkingEffectiveEnd > Date.now();
        if (isServerAiHiddenAnimationInProgress) {
            lastAiMoveRef.current = null;
            return;
        }

        // 디버깅: AI 차례 판단 로그 (도전의 탑/싱글/길드전에서 상세하게)
        if ((isTower || session.isSinglePlayer || isGuildWarGame) && (currentPlayer === Player.Black || currentPlayer === Player.White)) {
            const logData = {
                gameId: session.id,
                gameCategory: session.gameCategory,
                isTower,
                isSinglePlayer: session.isSinglePlayer,
                currentPlayer,
                'currentPlayer === Player.White': currentPlayer === Player.White,
                'currentPlayer === Player.Black': currentPlayer === Player.Black,
                aiPlayerId,
                AI_USER_ID,
                'aiPlayerId === AI_USER_ID': aiPlayerId === AI_USER_ID,
                isAiTurn,
                blackPlayerId: session.blackPlayerId,
                whitePlayerId: session.whitePlayerId,
                'whitePlayerId === AI_USER_ID': session.whitePlayerId === AI_USER_ID,
                'blackPlayerId === AI_USER_ID': session.blackPlayerId === AI_USER_ID,
                gameStatus,
                lastAiMove: lastAiMoveRef.current,
                moveHistoryLength: session.moveHistory?.length || 0
            };
            const gameLabel = isTower ? 'Tower' : isGuildWarGame ? 'Guild war' : 'Single player';
            console.log(`[Game] ${gameLabel} AI turn check:`, logData);
            if (currentPlayer === Player.White && session.whitePlayerId !== AI_USER_ID) {
                console.error(`[Game] MISMATCH: Current player is White but whitePlayerId is not AI_USER_ID!`, {
                    whitePlayerId: session.whitePlayerId,
                    AI_USER_ID,
                    blackPlayerId: session.blackPlayerId,
                    gameCategory: session.gameCategory,
                    isSinglePlayer: session.isSinglePlayer
                });
            }
            // 싱글플레이에서는 blackPlayerId가 유저 ID여야 하고, whitePlayerId가 AI_USER_ID여야 함
            if (currentPlayer === Player.Black && session.blackPlayerId !== currentUser.id && session.isSinglePlayer) {
                console.error(`[Game] MISMATCH: Single player - Current player is Black but blackPlayerId is not current user!`, {
                    blackPlayerId: session.blackPlayerId,
                    whitePlayerId: session.whitePlayerId,
                    AI_USER_ID,
                    currentUserId: currentUser.id
                });
            }
        }

        if (isAiTurn) {
            const moveCount = session.moveHistory?.length ?? 0;
            const aiTurnIndex = Math.floor(moveCount / 2) + 1; // 지금 둘 차례인 백 = 1번째 AI턴(1), 2번째 AI턴(2), ...
            const hiddenStoneCount = session.settings?.hiddenStoneCount ?? 0;
            const aiIsPlayer1 = session.player1?.id != null && aiPlayerId === session.player1.id;
            const aiHiddenLeft = Number(
                (aiIsPlayer1 ? (session as any).hidden_stones_p1 : (session as any).hidden_stones_p2) ??
                hiddenStoneCount ??
                0
            );
            const maxHiddenTurns = plannedAiHiddenTurns.length || 1;
            // 이미 사용한 히든 턴 수가 계획된 수 이상이면 더 이상 히든 연출하지 않음 (두 번째 AI 수가 히든으로 겹치는 버그 방지)
            const hasHiddenSlotsLeft = aiHiddenItemsUsedCount < maxHiddenTurns;
            // 유저 턴이 한 번이라도 지났으면(이미 히든 연출 실행 후) 다음 AI 수는 반드시 일반 돌
            const neverExecutedHiddenThisGame = !aiHiddenMoveExecutedRef.current;
            const isAiHiddenItemTurn =
                isAiHiddenPresentationStage &&
                aiHiddenLeft > 0 &&
                hasHiddenSlotsLeft &&
                neverExecutedHiddenThisGame &&
                nextAiHiddenItemTurn != null &&
                aiTurnIndex === nextAiHiddenItemTurn;
            if (isAiHiddenItemTurn && aiHiddenItemEffectEndTime == null && isGuildWarGame) {
                aiHiddenMoveExecutedRef.current = false;
                setAiHiddenItemEffectEndTime(Date.now() + 6000);
                return;
            }
            if (aiHiddenItemEffectEndTime != null) return;

            // 게임이 이미 종료되었는지 확인
            if (gameStatus !== 'playing' && (gameStatus === 'ended' || gameStatus === 'no_contest' || gameStatus === 'scoring')) {
                const gameLabel = isTower ? 'Tower' : isGuildWarGame ? 'Guild war' : 'Single player';
                console.log(`[Game] ${gameLabel} game already ended, skipping AI move:`, {
                    gameId: session.id,
                    gameStatus
                });
                return;
            }
            
            console.log('[Game] Entering AI move calculation block:', {
                gameId: session.id,
                gameCategory: session.gameCategory,
                isTower,
                currentPlayer,
                moveHistoryLength: session.moveHistory?.length || 0
            });
            const moveHistoryLength = session.moveHistory?.length || 0;
            
            // 이미 같은 게임, 같은 moveHistory 길이, 같은 플레이어에 대해 AI 수를 보냈는지 확인
            // (중복 전송 방지)
            // 단, AI 수 계산 중이거나 전송 대기 중인 경우(타임스탬프가 2초 이내)는 제외
            const permRevealLen = session.permanentlyRevealedStones?.length ?? 0;
            if (lastAiMoveRef.current &&
                lastAiMoveRef.current.gameId === session.id &&
                lastAiMoveRef.current.moveHistoryLength === moveHistoryLength &&
                lastAiMoveRef.current.player === currentPlayer &&
                lastAiMoveRef.current.revealSig === permRevealLen) {
                const timeSinceLastMove = Date.now() - lastAiMoveRef.current.timestamp;
                // 2초 이내면 아직 전송 대기 중이거나 계산 중일 수 있으므로 무시
                if (timeSinceLastMove < 2000) {
                    console.log('[Game] AI move calculation/transmission in progress, skipping:', {
                        gameId: session.id,
                        lastMove: lastAiMoveRef.current,
                        currentMoveHistoryLength: moveHistoryLength,
                        currentPlayer,
                        timeSinceLastMove
                    });
                    return;
                }
                // 3초 이상 지났으면 초기화하고 재시도
                if (timeSinceLastMove > 3000) {
                    console.log('[Game] lastAiMoveRef timeout, resetting and retrying:', {
                        gameId: session.id,
                        lastMove: lastAiMoveRef.current,
                        timeSinceLastMove
                    });
                    lastAiMoveRef.current = null;
                    // 초기화 후 계속 진행하여 AI 수 재계산
                } else {
                    // 이미 이 상태에 대해 AI 수를 보냈으므로 무시
                    console.log('[Game] AI move already sent, skipping:', {
                        gameId: session.id,
                        lastAiMove: lastAiMoveRef.current,
                        currentMoveHistoryLength: moveHistoryLength,
                        currentPlayer,
                        timeSinceLastMove
                    });
                    return;
                }
            }
            
            // 놀이바둑 게임은 바둑 AI를 사용할 수 없으므로 서버로 전송
            const isPlayfulMode = PLAYFUL_GAME_MODES.some(m => m.mode === mode);
            if (isPlayfulMode) {
                // 놀이바둑 게임은 서버에서 AI 처리 (DICE, ALKKAGI, CURLING, THIEF 등)
                // 서버로 액션 전송하여 AI가 처리하도록 함
                console.log('[Game] Playful AI game - sending action to server for AI processing:', {
                    gameId: session.id,
                    mode,
                    currentPlayer
                });
                // 서버에서 AI가 처리하도록 PLACE_STONE 액션 전송 (서버가 AI 차례를 감지하여 처리)
                handlers.handleAction({
                    type: 'PLACE_STONE',
                    payload: {
                        gameId: session.id,
                        x: -1, // 서버에서 AI가 처리하도록 표시
                        y: -1,
                        isClientAiMove: false,
                    },
                } as ServerAction);
                return;
            }

            // 도전의 탑·싱글플레이·길드전·모험: 서버 Kata(goAiBot) — 클라 전용 수만 반영되므로 clientSync 후 REQUEST_SERVER_AI_MOVE
            if (
                session.gameCategory === 'tower' ||
                session.gameCategory === 'guildwar' ||
                session.gameCategory === 'singleplayer' ||
                session.gameCategory === 'adventure' ||
                session.isSinglePlayer
            ) {
                const currentGameId = session.id;
                const currentGameStatus = session.gameStatus;
                const currentPlayerAtCalculation = currentPlayer;
                const moveHistoryLengthAtCalculation = moveHistoryLength;
                const delay = 1000;
                aiMoveTimeoutRef.current = setTimeout(() => {
                    void (async () => {
                        const currentMoveHistoryLength = session.moveHistory?.length || 0;
                        if (
                            session.gameStatus !== 'playing' ||
                            session.currentPlayer !== currentPlayerAtCalculation ||
                            session.id !== currentGameId ||
                            session.gameStatus !== currentGameStatus ||
                            currentMoveHistoryLength !== moveHistoryLengthAtCalculation
                        ) {
                            lastAiMoveRef.current = null;
                            aiMoveTimeoutRef.current = null;
                            return;
                        }
                        const clientSync = buildPveItemActionClientSync(session);
                        if (!clientSync) {
                            if (process.env.NODE_ENV === 'development') {
                                console.warn('[Game] PVE server AI: missing clientSync', { gameId: currentGameId });
                            }
                            // 새로고침 직후 등으로 로컬 스냅샷이 비어 clientSync를 못 만들면
                            // 즉시 서버 상태를 당겨와 다음 tick에서 AI 착수 요청이 재개되게 한다.
                            void handlers.handleAction({
                                type: 'REQUEST_GAME_STATE_SYNC',
                                payload: { gameId: currentGameId },
                            } as ServerAction);
                            lastAiMoveRef.current = null;
                            aiMoveTimeoutRef.current = null;
                            return;
                        }
                        lastAiMoveRef.current = {
                            gameId: currentGameId,
                            moveHistoryLength: moveHistoryLengthAtCalculation,
                            player: currentPlayerAtCalculation,
                            timestamp: Date.now(),
                            revealSig: session.permanentlyRevealedStones?.length ?? 0,
                        };
                        if (process.env.NODE_ENV === 'development') {
                            console.log('[Game] PVE server AI: REQUEST_SERVER_AI_MOVE', {
                                gameId: currentGameId,
                                gameCategory: session.gameCategory,
                                isSinglePlayer: session.isSinglePlayer,
                                moveHistoryLength: moveHistoryLengthAtCalculation,
                            });
                        }
                        try {
                            const result = await handlers.handleAction({
                                type: 'REQUEST_SERVER_AI_MOVE',
                                payload: { gameId: currentGameId, clientSync },
                            } as ServerAction);
                            const responseGame = ((result as any)?.game ||
                                (result as any)?.clientResponse?.game) as LiveGameSession | undefined;
                            const skippedReason =
                                (result as any)?.skippedReason ||
                                (result as any)?.clientResponse?.skippedReason;
                            const hasGamePayload =
                                !!responseGame;
                            if (!hasGamePayload) {
                                // 서버가 빈 성공 응답만 준 경우 AI 잠금을 즉시 해제해 다음 effect tick에서 재시도한다.
                                console.warn('[Game] PVE server AI returned no game payload, retrying soon:', {
                                    gameId: currentGameId,
                                    moveHistoryLength: moveHistoryLengthAtCalculation,
                                    currentPlayer: currentPlayerAtCalculation,
                                    resultKeys: result && typeof result === 'object' ? Object.keys(result as any) : [],
                                });
                                lastAiMoveRef.current = null;
                            }
                            // 서버가 game payload를 주더라도 실제 착수가 없으면(동일 수순·동일 차례) 잠금을 풀어 재시도한다.
                            const responseStatus = String((responseGame as any)?.gameStatus ?? '');
                            const responseAnimType = String(((responseGame as any)?.animation as { type?: string } | undefined)?.type ?? '');
                            const isServerWaitingState =
                                skippedReason === 'SERVER_AI_WAITING_STATE' ||
                                skippedReason === 'AI_MOVE_STALLED_REQUEUED' ||
                                skippedReason === 'AI_MOVE_FAILED_RETRYING' ||
                                responseStatus === 'missile_animating' ||
                                responseStatus === 'hidden_reveal_animating' ||
                                responseStatus === 'scanning' ||
                                responseStatus === 'scanning_animating' ||
                                responseStatus === 'hidden_final_reveal' ||
                                responseStatus === 'scoring' ||
                                responseStatus === 'ended' ||
                                responseAnimType === 'missile' ||
                                responseAnimType === 'hidden_missile' ||
                                responseAnimType === 'ai_thinking';
                            if (
                                responseGame &&
                                Array.isArray(responseGame.moveHistory) &&
                                responseGame.moveHistory.length <= moveHistoryLengthAtCalculation &&
                                responseGame.currentPlayer === currentPlayerAtCalculation
                            ) {
                                if (isServerWaitingState) {
                                    // 미사일/히든 연출 중 no-progress는 정상 대기 상태다.
                                    // 잠금을 즉시 풀면 REQUEST_SERVER_AI_MOVE가 루프를 돌며 애니/사운드가 무한 재생된다.
                                    if (process.env.NODE_ENV === 'development') {
                                        console.log('[Game] PVE server AI waiting state detected, keeping lock:', {
                                            gameId: currentGameId,
                                            skippedReason,
                                            responseStatus,
                                            responseAnimType,
                                        });
                                    }
                                    return;
                                }
                                console.warn('[Game] PVE server AI response made no progress, retrying soon:', {
                                    gameId: currentGameId,
                                    responseMoveHistoryLength: responseGame.moveHistory.length,
                                    currentPlayer: responseGame.currentPlayer,
                                });
                                lastAiMoveRef.current = null;
                            }
                            if (result && typeof result === 'object' && 'error' in result && (result as any).error) {
                                console.warn('[Game] PVE server AI failed:', (result as any).error);
                                lastAiMoveRef.current = null;
                            }
                        } catch (e) {
                            console.error('[Game] PVE server AI error:', e);
                            lastAiMoveRef.current = null;
                        }
                        aiMoveTimeoutRef.current = null;
                    })();
                }, delay);
            }
        } else {
            // AI 차례가 아니면 lastAiMoveRef 초기화 (다음 AI 차례를 위해)
            lastAiMoveRef.current = null;
        }
        
        // cleanup: 게임 ID가 변경되거나 컴포넌트가 unmount될 때 timeout 취소
        return () => {
            if (aiMoveTimeoutRef.current) {
                clearTimeout(aiMoveTimeoutRef.current);
                aiMoveTimeoutRef.current = null;
            }
        };
    }, [
        session.isSinglePlayer,
        session.gameCategory,
        isPaused,
        gameStatus,
        currentPlayer,
        session.blackPlayerId,
        session.whitePlayerId,
        restoredBoardState,
        session.koInfo,
        session.moveHistory?.length,
        session.settings?.aiDifficulty,
        isBoardLocked,
        session.id,
        session.gameStatus,
        handlers.handleAction,
        aiHiddenItemEffectEndTime,
        isAiHiddenPresentationStage,
        nextAiHiddenItemTurn,
        (session as any).hidden_stones_p1,
        (session as any).hidden_stones_p2,
        session.player1?.id,
        session.animation?.type,
        (session as any).aiHiddenItemAnimationEndTime,
        isGuildWarGame,
    ]);
    
    const globalChat = useMemo(() => waitingRoomChats['global'] || [], [waitingRoomChats]);
    
    const handleAdventureLeaveToMap = useCallback(() => {
        if (!gameId || session.gameCategory !== 'adventure') return;
        setShowResultModal(false);
        const stageId = session.adventureStageId;
        sessionStorage.setItem('postGameRedirect', stageId ? `#/adventure/${stageId}` : '#/adventure');
        handlers.handleAction({ type: 'LEAVE_AI_GAME', payload: { gameId } });
    }, [gameId, session.gameCategory, session.adventureStageId, handlers.handleAction]);

    const handleCloseResults = useCallback(() => {
        setShowResultModal(false);
        if (!session.analysisResult?.['system']) {
            setShowFinalTerritory(false);
        }
        // 도전의 탑·싱글플레이·모험·(전략/놀이 대기실에서 시작한) AI 대국:
        // "확인"은 모달만 닫고 경기장에 머물고, "나가기"에서만 퇴장 후 대기실로 이동
        const isTowerSingleOrAdventure =
            session.gameCategory === 'tower' || session.isSinglePlayer || session.gameCategory === 'adventure';
        const isLobbyAiGame =
            session.isAiGame &&
            (SPECIAL_GAME_MODES.some(m => m.mode === session.mode) || PLAYFUL_GAME_MODES.some(m => m.mode === session.mode));
        if (isTowerSingleOrAdventure || isLobbyAiGame) return;
        // 그 외(PVP 등): 경기 종료 후 결과 모달 "확인" 시 퇴장 + 해당 대기실로 이동
        if ((gameStatus === 'ended' || gameStatus === 'no_contest') && gameId) {
            if (session.settings?.pairGame) {
                sessionStorage.setItem('postGameRedirect', '#/pair');
            } else {
                const waitingRoomMode = SPECIAL_GAME_MODES.some(m => m.mode === session.mode) ? 'strategic' as const : 'playful' as const;
                sessionStorage.setItem('postGameRedirect', `#/waiting/${waitingRoomMode}`);
            }
            const actionType = session.isAiGame ? 'LEAVE_AI_GAME' : 'LEAVE_GAME_ROOM';
            handlers.handleAction({ type: actionType, payload: { gameId } });
        }
    }, [
        session.analysisResult,
        session.gameCategory,
        session.isSinglePlayer,
        session.mode,
        session.settings?.pairGame,
        gameStatus,
        gameId,
        session.isAiGame,
        handlers.handleAction,
    ]);

    // 싱글플레이 게임 설명창 표시 여부
    // 결과 모달과 겹치지 않게: 계가/종료 직후 일시적으로 pending이 섞이는 경우에도 설명창이 위를 덮지 않도록 함
    const showGameDescription = isSinglePlayer && gameStatus === 'pending' && !showResultModal;
    const showTowerGameDescription = isTower && gameStatus === 'pending' && !showResultModal;
    
    // 도전의 탑 배경 이미지 설정
    const towerBackgroundImage = isTower && session.towerFloor 
        ? (session.towerFloor === 100 ? '/images/tower/Tower100.png' : '/images/tower/InTower.png')
        : null;
    
    // 디버깅: 게임 상태 확인
    useEffect(() => {
        if (isSinglePlayer) {
            console.log('[Game] Single player game status:', {
                gameStatus,
                isSinglePlayer,
                showGameDescription,
                gameId: session.id,
                stageId: session.stageId
            });
        }
        if (isTower) {
            console.log('[Game] Tower game status:', {
                gameStatus,
                isTower,
                showTowerGameDescription,
                gameId: session.id,
                towerFloor: session.towerFloor
            });
        }
    }, [isSinglePlayer, isTower, gameStatus, showGameDescription, showTowerGameDescription, session.id, session.stageId, session.towerFloor]);

    const handleStartGame = useCallback(() => {
        console.log('[Game] handleStartGame called', { gameId, gameStatus, isSinglePlayer, isTower, sessionId: session.id });
        if (!gameId) {
            console.error('[Game] handleStartGame: gameId is missing', { sessionId: session.id, gameStatus });
            return;
        }
        
        if (isSinglePlayer) {
            console.log('[Game] handleStartGame: Sending CONFIRM_SINGLE_PLAYER_GAME_START', { gameId, gameStatus });
            handlers.handleAction({ 
                type: 'CONFIRM_SINGLE_PLAYER_GAME_START', 
                payload: { gameId } 
            } as ServerAction).then(result => {
                console.log('[Game] handleStartGame: CONFIRM_SINGLE_PLAYER_GAME_START completed', result);
            }).catch(err => {
                console.error('[Game] handleStartGame: CONFIRM_SINGLE_PLAYER_GAME_START failed', err);
            });
        } else if (isTower) {
            console.log('[Game] handleStartGame: Sending CONFIRM_TOWER_GAME_START', { gameId, gameStatus, isTower });
            handlers.handleAction({ 
                type: 'CONFIRM_TOWER_GAME_START', 
                payload: { gameId } 
            } as ServerAction);
        }
    }, [handlers.handleAction, gameId, isSinglePlayer, isTower, session.id, gameStatus]);

    // 도전의 탑: 싱글플레이와 동일하게 시작 모달에서 시작 버튼을 눌러 확정
    
    // 싱글플레이어/도전의 탑/전략바둑 수순 제한: restoredBoardState + totalTurns/moveHistory 복원을 포함한 표시용 session (PlayerPanel 남은 턴 등에 사용)
    const sessionWithRestoredBoard = useMemo(() => {
        if (!useRefreshSessionStorageMerge) {
            return session;
        }
        // totalTurns·moveHistory·문양돌이 복원된 세션을 베이스로 사용 (새로고침 후 남은 턴이 Max로 초기화되는 버그 방지)
        const base = sessionWithRestoredPatternStones;
        // restoredBoardState가 있으면 보드만 추가로 반영
        if (restoredBoardState && restoredBoardState !== base.boardState) {
            return { ...base, boardState: restoredBoardState };
        }
        return base;
    }, [useRefreshSessionStorageMerge, sessionWithRestoredPatternStones, restoredBoardState]);

    const isServerAiHiddenPresentationActive = session.animation?.type === 'ai_thinking';
    const isClientAiHiddenPresentationActive =
        aiHiddenItemEffectEndTime != null && Date.now() < aiHiddenItemEffectEndTime;
    const isAiHiddenPresentationActive =
        isClientAiHiddenPresentationActive || isServerAiHiddenPresentationActive;

    const sessionWithAiHiddenPresentation = useMemo(() => {
        if (!isClientAiHiddenPresentationActive || aiHiddenItemEffectEndTime == null) {
            return sessionWithRestoredBoard;
        }
        return {
            ...sessionWithRestoredBoard,
            foulInfo: {
                message:
                    session.gameCategory === 'adventure' || session.adventureMonsterCodexId
                        ? '몬스터가 히든 아이템을 사용했습니다!'
                        : 'AI봇이 히든 아이템을 사용했습니다!',
                expiry: aiHiddenItemEffectEndTime,
            },
        };
    }, [isClientAiHiddenPresentationActive, sessionWithRestoredBoard, aiHiddenItemEffectEndTime]);

    const boardGlowForHiddenScanItem =
        gameStatus === 'hidden_placing' ||
            gameStatus === 'scanning' ||
            gameStatus === 'scanning_animating' ||
            isAiHiddenPresentationActive;
    
    const gameProps: GameProps = {
        session: sessionWithAiHiddenPresentation, onAction: handlers.handleAction, currentUser: currentUserWithStatus, waitingRoomChat: globalChat,
        gameChat: gameChat, isSpectator, onlineUsers, activeNegotiation, negotiations: Object.values(negotiations), onViewUser: handlers.openViewingUser,
        onBoardRuleFlash: flashBoardRuleMessage,
    };

    // AI 게임 일시 정지 관련 변수 (gameControlsProps보다 먼저 정의)
    const isPausableAiGame =
        session.isAiGame &&
        !session.isSinglePlayer &&
        session.gameCategory !== 'tower' &&
        session.gameCategory !== 'singleplayer';

    const gameControlsProps = {
        session, isMyTurn, isSpectator, onAction: handlers.handleAction, setShowResultModal, setConfirmModalType, currentUser: currentUserWithStatus,
        onlineUsers, pendingMove, onConfirmMove: handleConfirmMove, onCancelMove: handleCancelMove, settings, isMobile,
        onUpdateFeatureSetting: updateFeatureSetting,
        showResultModal,
        isMoveInFlight,
        isBoardLocked,
        // AI 게임 일시 정지 관련 props
        isPaused: isPausableAiGame ? isPaused : undefined,
        resumeCountdown: isPausableAiGame ? resumeCountdown : undefined,
        pauseButtonCooldown: isPausableAiGame ? pauseButtonCooldown : undefined,
        onPauseToggle: isPausableAiGame ? handlePauseToggle : undefined,
        onOpenRematchSettings: (session.isAiGame && !session.isSinglePlayer && session.gameCategory !== 'tower' && session.gameCategory !== 'singleplayer' && session.gameCategory !== 'guildwar' && session.gameCategory !== 'adventure')
            ? () => setIsAiRematchModalOpen(true)
            : undefined,
        onOpenGameRecordList: handlers.openGameRecordList,
        onLeaveOrResign: handleLeaveOrResignClick,
    };

    if (isSinglePlayer) {
        return (
            <InGameModalLayoutProvider>
            <div
                className={`w-full flex flex-col p-1 lg:p-2 relative max-w-full text-stone-200 min-h-0 ${adventureBackgroundImage ? '' : 'bg-single-player-background'}`}
                style={{
                    height: '100%',
                    maxHeight: '100%',
                    paddingBottom: isMobileSafeArea ? 'env(safe-area-inset-bottom, 0px)' : '0px',
                    ...(adventureBackgroundImage
                        ? {
                              backgroundImage: `url(${adventureBackgroundImage})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              backgroundRepeat: 'no-repeat',
                          }
                        : {}),
                }}
            >
                {showGameDescription && (
                    <SinglePlayerGameDescriptionModal 
                        session={sessionWithRestoredPatternStones}
                        onStart={handleStartGame}
                        currentUser={currentUserWithStatus}
                        onAction={handlers.handleAction}
                    />
                )}
                <Header compact />
                <div className="flex-1 flex flex-row gap-2 min-h-0 overflow-hidden">
                    <main className="flex-1 flex items-center justify-center min-w-0 min-h-0 overflow-hidden">
                        <div className="w-full h-full max-h-full max-w-full flex min-h-0 flex-col items-stretch gap-1 lg:gap-2">
                        <div className="flex w-full flex-shrink-0 justify-center">
                                <div className="min-w-0 w-full flex-1 px-2 pt-1 min-[1025px]:px-1">
                                    <PlayerPanel
                                        {...gameProps}
                                        clientTimes={clientTimes.clientTimes}
                                        isSinglePlayer={true}
                                        isMobile={isMobile}
                                        singlePlayerOnboardingBarHighlight={singlePlayerOnboardingBarHighlight}
                                    />
                                </div>
                            </div>
                            <div className="relative min-h-0 w-full min-w-0 flex-1 overflow-hidden">
                                <div className="absolute inset-0">
                                    <GameArena 
                                        {...gameProps}
                                        isMyTurn={isMyTurn} 
                                        myPlayerEnum={myPlayerEnum} 
                                        handleBoardClick={handleBoardClick} 
                                        isItemModeActive={isItemModeActive} 
                                        showTerritoryOverlay={showFinalTerritory} 
                                        isMobile={isMobile}
                                        pendingMove={pendingMoveForBoard}
                                        myRevealedMoves={session.revealedHiddenMoves?.[currentUser.id] || []}
                                        showLastMoveMarker={settings.features.lastMoveMarker}
                                        captureScoreFloatMinPoints={settings.features.captureScoreAnimation ? 1 : 2}
                                        isSinglePlayerPaused={isPaused}
                                        showBoardGlow={boardGlowForHiddenScanItem}
                                        resumeCountdown={resumeCountdown}
                                        isBoardLocked={isBoardLocked}
                                        isBoardRotated={isBoardRotated}
                                        onToggleBoardRotation={() => setIsBoardRotated((prev: boolean) => !prev)}
                                        onboardingDemoAnchorPoint={intro1OnboardingDemoPoint}
                                        onboardingForcedFirstMovePoint={intro1OnboardingDemoPoint}
                                        intro1TutorialHighlight={intro1OnboardingDemoPoint}
                                    />
                                    {/* 착수 확정: 드래그로 위치 조절 가능 (위치는 기기별 localStorage 저장) */}
                                    {showMoveConfirmPanel && (
                                        <MoveConfirmDraggable
                                            layoutMode={isMobile ? 'mobile' : 'desktop'}
                                            pendingMove={pendingMove}
                                            handleConfirmMove={handleConfirmMove}
                                            mobileConfirm={settings.features.mobileConfirm}
                                            updateFeatureSetting={updateFeatureSetting}
                                            setPendingMove={setPendingMove}
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="flex-shrink-0 w-full flex flex-col gap-1">
                                <TurnDisplay
                                    session={sessionWithAiHiddenPresentation}
                                    isPaused={isPaused}
                                    isMobile={isMobile}
                                    onOpenSidebar={() => setIsMobileSidebarOpen(true)}
                                    onAction={handlers.handleAction}
                                    boardRuleFlashMessage={boardRuleFlashMessage}
                                    viewerUserId={isSpectator ? undefined : currentUser.id}
                                />
                                <SinglePlayerControls {...gameControlsProps} />
                            </div>
                        </div>
                    </main>
                    
                    {!isMobile && (
                        <div
                            className={`relative max-h-full min-h-0 flex-shrink-0 self-stretch transition-[width] duration-200 ${
                                isRightSidebarCollapsed ? 'w-0' : 'w-[320px] xl:w-[360px]'
                            }`}
                        >
                            {!isRightSidebarCollapsed && (
                                <div className="flex h-full max-h-full min-h-0 items-stretch border-l border-gray-700/80 bg-gray-900/50 rounded-r-lg overflow-hidden">
                                    <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
                                        <SinglePlayerSidebar
                                            session={sessionWithRestoredPatternStones}
                                            gameChat={gameChat}
                                            onAction={handlers.handleAction}
                                            currentUser={currentUserWithStatus}
                                            isPaused={isPaused}
                                            resumeCountdown={resumeCountdown}
                                            pauseButtonCooldown={pauseButtonCooldown}
                                            onTogglePause={handlePauseToggle}
                                        />
                                    </div>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsRightSidebarCollapsed(prev => !prev)}
                                className="absolute top-1/2 -left-6 z-[120] -translate-y-1/2 w-7 h-9 flex items-center justify-center rounded-md bg-gray-800/90 hover:bg-gray-700/90 text-gray-300 hover:text-white transition-colors border border-gray-700/80"
                                title={isRightSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
                                aria-label={isRightSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
                            >
                                <span className="text-sm font-bold leading-none">
                                    {isRightSidebarCollapsed ? '<' : '>'}
                                </span>
                            </button>
                        </div>
                    )}
                    
                    {isMobile && (
                        <>
                            <div
                                className={`fixed inset-y-0 right-0 z-50 flex w-[280px] flex-col overflow-hidden bg-secondary shadow-2xl transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
                                style={mobileGameSidebarDrawerStyle}
                            >
                                <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                                    <SinglePlayerSidebar
                                        session={sessionWithRestoredPatternStones}
                                        gameChat={gameChat}
                                        onAction={handlers.handleAction}
                                        currentUser={currentUserWithStatus}
                                        onClose={() => setIsMobileSidebarOpen(false)}
                                        isPaused={isPaused}
                                        resumeCountdown={resumeCountdown}
                                        pauseButtonCooldown={pauseButtonCooldown}
                                        onTogglePause={handlePauseToggle}
                                    />
                                </div>
                            </div>
                            {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsMobileSidebarOpen(false)}></div>}
                        </>
                    )}
                </div>
                
                <GameModals 
                    {...gameProps}
                    confirmModalType={confirmModalType}
                    onHideConfirmModal={() => setConfirmModalType(null)}
                    showResultModal={showResultModal}
                    onCloseResults={handleCloseResults}
                    onOpenGameRecordList={handlers.openGameRecordList}
                    onAdventureLeaveToMap={handleAdventureLeaveToMap}
                />
            </div>
            </InGameModalLayoutProvider>
        );
    }

    if (isTower) {
        return (
            <InGameModalLayoutProvider>
            <div 
                className={`w-full flex flex-col p-1 lg:p-2 relative max-w-full text-stone-200 min-h-0`}
                style={{
                    height: '100%',
                    maxHeight: '100%',
                    paddingBottom: isMobileSafeArea ? 'env(safe-area-inset-bottom, 0px)' : '0px',
                    ...((adventureBackgroundImage || towerBackgroundImage)
                        ? {
                              backgroundImage: `url(${adventureBackgroundImage || towerBackgroundImage})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              backgroundRepeat: 'no-repeat',
                          }
                        : {}),
                }}
            >
                {showTowerGameDescription && (
                    <SinglePlayerGameDescriptionModal 
                        session={sessionWithRestoredPatternStones}
                        onStart={handleStartGame}
                        currentUser={currentUserWithStatus}
                        onAction={handlers.handleAction}
                        onTowerItemPurchase={async (itemId, quantity) => {
                            const gid = sessionWithRestoredPatternStones?.id;
                            await handlers.handleAction({
                                type: 'BUY_TOWER_ITEM',
                                payload: {
                                    itemId,
                                    quantity,
                                    ...(typeof gid === 'string' && gid.startsWith('tower-game-') ? { gameId: gid } : {}),
                                },
                            } as ServerAction);
                        }}
                    />
                )}
                <Header compact />
                <div className="flex-1 flex flex-row gap-2 min-h-0 overflow-hidden">
                    <main className="flex-1 flex items-center justify-center min-w-0 min-h-0 overflow-hidden">
                        <div className="w-full h-full max-h-full max-w-full flex min-h-0 flex-col items-stretch gap-1 lg:gap-2">
                        <div className="flex w-full flex-shrink-0 justify-center">
                            <div className="min-w-0 w-full flex-1 px-2 pt-1 min-[1025px]:px-1">
                                    <PlayerPanel
                                        {...gameProps}
                                        clientTimes={clientTimes.clientTimes}
                                        isSinglePlayer={true}
                                        isMobile={isMobile}
                                        singlePlayerOnboardingBarHighlight={singlePlayerOnboardingBarHighlight}
                                    />
                                </div>
                            </div>
                            <div className="relative min-h-0 w-full min-w-0 flex-1 overflow-hidden">
                                <div className="absolute inset-0">
                                <GameArena 
                                        {...gameProps}
                                        isMyTurn={isMyTurn} 
                                        myPlayerEnum={myPlayerEnum} 
                                        handleBoardClick={handleBoardClick} 
                                        isItemModeActive={isItemModeActive} 
                                        showTerritoryOverlay={showFinalTerritory} 
                                        isMobile={isMobile}
                                        pendingMove={pendingMoveForBoard}
                                        myRevealedMoves={session.revealedHiddenMoves?.[currentUser.id] || []}
                                        showLastMoveMarker={settings.features.lastMoveMarker}
                                        captureScoreFloatMinPoints={settings.features.captureScoreAnimation ? 1 : 2}
                                        isSinglePlayerPaused={isPaused}
                                        showBoardGlow={boardGlowForHiddenScanItem}
                                        resumeCountdown={resumeCountdown}
                                        isBoardLocked={isBoardLocked}
                                        onboardingDemoAnchorPoint={intro1OnboardingDemoPoint}
                                        onboardingForcedFirstMovePoint={intro1OnboardingDemoPoint}
                                        intro1TutorialHighlight={intro1OnboardingDemoPoint}
                                    />
                                {/* 착수 확정: 드래그로 위치 조절 가능 (위치는 기기별 localStorage 저장) */}
                                {showMoveConfirmPanel && (
                                    <MoveConfirmDraggable
                                        layoutMode={isMobile ? 'mobile' : 'desktop'}
                                        pendingMove={pendingMove}
                                        handleConfirmMove={handleConfirmMove}
                                        mobileConfirm={settings.features.mobileConfirm}
                                        updateFeatureSetting={updateFeatureSetting}
                                        setPendingMove={setPendingMove}
                                    />
                                )}
                                </div>
                            </div>
                            <div className="flex-shrink-0 w-full flex flex-col gap-1">
                                <TurnDisplay
                                    session={sessionWithAiHiddenPresentation}
                                    isPaused={isPaused}
                                    isMobile={isMobile}
                                    onOpenSidebar={() => setIsMobileSidebarOpen(true)}
                                    onAction={handlers.handleAction}
                                    boardRuleFlashMessage={boardRuleFlashMessage}
                                    viewerUserId={isSpectator ? undefined : currentUser.id}
                                />
                                <TowerControls {...gameControlsProps} />
                            </div>
                        </div>
                    </main>
                    
                    {!isMobile && (
                        <div
                            className={`relative max-h-full min-h-0 flex-shrink-0 self-stretch transition-[width] duration-200 ${
                                isRightSidebarCollapsed ? 'w-0' : 'w-[320px] xl:w-[360px]'
                            }`}
                        >
                            {!isRightSidebarCollapsed && (
                                <div className="flex h-full max-h-full min-h-0 items-stretch border-l border-gray-700/80 bg-gray-900/50 rounded-r-lg overflow-hidden">
                                    <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
                                        <TowerSidebar
                                            session={sessionWithRestoredPatternStones}
                                            gameChat={gameChat}
                                            onAction={handlers.handleAction}
                                            currentUser={currentUserWithStatus}
                                            onTogglePause={handlePauseToggle}
                                            isPaused={isPaused}
                                            resumeCountdown={resumeCountdown}
                                            pauseButtonCooldown={pauseButtonCooldown}
                                        />
                                    </div>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsRightSidebarCollapsed(prev => !prev)}
                                className="absolute top-1/2 -left-6 z-[120] -translate-y-1/2 w-7 h-9 flex items-center justify-center rounded-md bg-gray-800/90 hover:bg-gray-700/90 text-gray-300 hover:text-white transition-colors border border-gray-700/80"
                                title={isRightSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
                                aria-label={isRightSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
                            >
                                <span className="text-sm font-bold leading-none">
                                    {isRightSidebarCollapsed ? '<' : '>'}
                                </span>
                            </button>
                        </div>
                    )}
                    
                    {isMobile && (
                        <>
                            <div
                                className={`fixed inset-y-0 right-0 z-50 flex w-[280px] flex-col overflow-hidden bg-secondary shadow-2xl transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
                                style={mobileGameSidebarDrawerStyle}
                            >
                                <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                                    <TowerSidebar
                                        session={sessionWithRestoredPatternStones}
                                        gameChat={gameChat}
                                        onAction={handlers.handleAction}
                                        currentUser={currentUserWithStatus}
                                        onClose={() => setIsMobileSidebarOpen(false)}
                                        onTogglePause={handlePauseToggle}
                                        isPaused={isPaused}
                                        resumeCountdown={resumeCountdown}
                                        pauseButtonCooldown={pauseButtonCooldown}
                                    />
                                </div>
                            </div>
                            {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsMobileSidebarOpen(false)}></div>}
                        </>
                    )}
                </div>
                
                <GameModals 
                    {...gameProps}
                    confirmModalType={confirmModalType}
                    onHideConfirmModal={() => setConfirmModalType(null)}
                    showResultModal={showResultModal}
                    onCloseResults={handleCloseResults}
                    onOpenGameRecordList={handlers.openGameRecordList}
                    onAdventureLeaveToMap={handleAdventureLeaveToMap}
                />
            </div>
            </InGameModalLayoutProvider>
        );
    }

    // PVP 게임 배경 이미지 결정
    const isPairIngame = Boolean(session.settings.pairGame?.turnOrder?.length);
    const pairBackgroundImage = session.settings.pairGame ? '/images/bg/pairbg.webp' : null;
    const pvpBackgroundClass = useMemo(() => {
        if (isPairIngame) {
            return '';
        }
        if (isGuildWarGame) {
            return '';
        }
        if (SPECIAL_GAME_MODES.some(m => m.mode === mode)) {
            return 'bg-strategic-background';
        }
        if (PLAYFUL_GAME_MODES.some(m => m.mode === mode)) {
            return 'bg-playful-background';
        }
        return 'bg-tertiary';
    }, [mode, isGuildWarGame, isPairIngame]);

    // AI 게임도 클라이언트 일시 정지 상태 사용 (싱글플레이어와 동일한 방식)
    // isPausableAiGame은 위에서 이미 정의됨
    const effectivePaused = (session.isSinglePlayer || isTower || isPausableAiGame) ? isPaused : false;

    return (
        <InGameModalLayoutProvider>
        <div
            className={`w-full flex flex-col p-1 lg:p-2 relative max-w-full min-h-0 ${adventureBackgroundImage || pairBackgroundImage ? '' : pvpBackgroundClass}`}
            style={{
                height: '100%',
                maxHeight: '100%',
                paddingBottom: isMobileSafeArea ? 'env(safe-area-inset-bottom, 0px)' : '0px',
                ...(adventureBackgroundImage || pairBackgroundImage
                    ? {
                          backgroundImage: `url(${adventureBackgroundImage || pairBackgroundImage})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat',
                      }
                    : isGuildWarGame
                      ? {
                            backgroundImage: "url('/images/guild/guildwar/warmap.png')",
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat',
                        }
                      : {}),
            }}
        >
            {session.disconnectionState && <DisconnectionModal session={session} currentUser={currentUser} />}
            {isAiRematchModalOpen && (
                <AiChallengeModal
                    lobbyType={SPECIAL_GAME_MODES.some(m => m.mode === mode) ? 'strategic' : 'playful'}
                    seedFromSession={{ mode: session.mode, settings: session.settings }}
                    onClose={() => setIsAiRematchModalOpen(false)}
                    onAction={(action) => {
                        // 기존 대국 상태를 깨끗하게 제거하고 새 대국 시작
                        try {
                            sessionStorage.removeItem(`gameState_${session.id}`);
                        } catch {
                            // ignore
                        }
                        setIsAiRematchModalOpen(false);
                        handlers.handleAction(action);
                    }}
                />
            )}
            {/* 전략·놀이바둑 경기장 상단 헤더 (행동력, 재화, 설정 등) */}
            <Header compact />
                <div className="flex-1 flex flex-row gap-2 min-h-0 overflow-hidden">
                <main
                    className={
                        isAdventureGame
                            ? 'flex-1 flex items-center justify-center min-w-0 min-h-0 overflow-hidden'
                            : 'flex-1 flex min-w-0 min-h-0 overflow-hidden items-stretch justify-center'
                    }
                >
                    <div className="w-full h-full max-h-full max-w-full flex min-h-0 flex-col items-stretch gap-1 lg:gap-2">
                        {!isPairIngame && (
                            <div
                                className={
                                    isAdventureGame
                                        ? 'flex w-full flex-shrink-0 justify-center'
                                        : 'flex-shrink-0 w-full flex justify-center'
                                }
                            >
                                <div className="min-w-0 w-full flex-1 px-2 pt-1 min-[1025px]:px-1">
                                    <PlayerPanel
                                        {...gameProps}
                                        clientTimes={clientTimes.clientTimes}
                                        isMobile={isMobile}
                                        isSinglePlayer={isSinglePlayer}
                                        singlePlayerOnboardingBarHighlight={
                                            isSinglePlayer ? singlePlayerOnboardingBarHighlight : null
                                        }
                                    />
                                </div>
                            </div>
                        )}
                        <div className="relative min-h-0 w-full min-w-0 flex-1 overflow-hidden">
                            <div className="absolute inset-0 flex min-h-0 flex-col">
                                <div className="relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden">
                                    <div
                                        className={`flex min-h-0 w-full flex-1 items-center justify-center ${
                                            isAdventureGame ? 'overflow-hidden' : 'overflow-auto'
                                        } ${effectivePaused ? 'opacity-0 pointer-events-none' : 'opacity-100'} transition-opacity duration-500`}
                                    >
                                        {isPairIngame ? (
                                            <div className="flex h-full w-full min-w-0 flex-col overflow-hidden px-1 py-1">
                                                <PairIngameTopPanel
                                                    session={session}
                                                    clientTimes={clientTimes.clientTimes}
                                                    mobile={isMobile}
                                                />
                                                <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-auto">
                                                    <GameArena
                                                        {...gameProps}
                                                        isMyTurn={isMyTurn}
                                                        myPlayerEnum={myPlayerEnum}
                                                        handleBoardClick={handleBoardClick}
                                                        isItemModeActive={isItemModeActive}
                                                        showTerritoryOverlay={showFinalTerritory}
                                                        isMobile={isMobile}
                                                        pendingMove={pendingMoveForBoard}
                                                        myRevealedMoves={session.revealedHiddenMoves?.[currentUser.id] || []}
                                                        showLastMoveMarker={settings.features.lastMoveMarker}
                                                        captureScoreFloatMinPoints={settings.features.captureScoreAnimation ? 1 : 2}
                                                        isBoardRotated={isBoardRotated}
                                                        onToggleBoardRotation={() => setIsBoardRotated((prev: boolean) => !prev)}
                                                        showBoardGlow={boardGlowForHiddenScanItem}
                                                        diceGoPlaceUi={
                                                            settings.features.moveConfirmButtonBox
                                                                ? {
                                                                      mobileConfirm: settings.features.mobileConfirm,
                                                                      onToggleMobileConfirm: (checked) => {
                                                                          updateFeatureSetting('mobileConfirm', checked);
                                                                          if (!checked) setPendingMove(null);
                                                                      },
                                                                      onConfirmMove: handleConfirmMove,
                                                                  }
                                                                : undefined
                                                        }
                                                        onboardingDemoAnchorPoint={intro1OnboardingDemoPoint}
                                                        onboardingForcedFirstMovePoint={intro1OnboardingDemoPoint}
                                                        intro1TutorialHighlight={intro1OnboardingDemoPoint}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <GameArena
                                                {...gameProps}
                                                isMyTurn={isMyTurn}
                                                myPlayerEnum={myPlayerEnum}
                                                handleBoardClick={handleBoardClick}
                                                isItemModeActive={isItemModeActive}
                                                showTerritoryOverlay={showFinalTerritory}
                                                isMobile={isMobile}
                                                pendingMove={pendingMoveForBoard}
                                                myRevealedMoves={session.revealedHiddenMoves?.[currentUser.id] || []}
                                                showLastMoveMarker={settings.features.lastMoveMarker}
                                                captureScoreFloatMinPoints={settings.features.captureScoreAnimation ? 1 : 2}
                                                isBoardRotated={isBoardRotated}
                                                onToggleBoardRotation={() => setIsBoardRotated((prev: boolean) => !prev)}
                                                showBoardGlow={boardGlowForHiddenScanItem}
                                                diceGoPlaceUi={
                                                    settings.features.moveConfirmButtonBox
                                                        ? {
                                                              mobileConfirm: settings.features.mobileConfirm,
                                                              onToggleMobileConfirm: (checked) => {
                                                                  updateFeatureSetting('mobileConfirm', checked);
                                                                  if (!checked) setPendingMove(null);
                                                              },
                                                              onConfirmMove: handleConfirmMove,
                                                          }
                                                        : undefined
                                                }
                                                onboardingDemoAnchorPoint={intro1OnboardingDemoPoint}
                                                onboardingForcedFirstMovePoint={intro1OnboardingDemoPoint}
                                                intro1TutorialHighlight={intro1OnboardingDemoPoint}
                                            />
                                        )}
                                    </div>
                                    {/* 착수 확정: 드래그로 위치 조절 가능 (위치는 기기별 localStorage 저장) */}
                                    {showMoveConfirmPanel && (
                                        <MoveConfirmDraggable
                                            layoutMode={isMobile ? 'mobile' : 'desktop'}
                                            pendingMove={pendingMove}
                                            handleConfirmMove={handleConfirmMove}
                                            mobileConfirm={settings.features.mobileConfirm}
                                            updateFeatureSetting={updateFeatureSetting}
                                            setPendingMove={setPendingMove}
                                        />
                                    )}
                                    {effectivePaused && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none text-white drop-shadow-lg">
                                            <h2 className="text-3xl font-bold tracking-wide">일시 정지</h2>
                                            {resumeCountdown > 0 && (
                                                <p className="text-lg font-semibold text-amber-200">
                                                    재개 가능까지 {resumeCountdown}초
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* 계가 중: 바둑판 위 연출(ScoringOverlay). 싱글/탑은 Arena에서 fullscreen 오버레이 표시 */}
                            {session.gameStatus === 'scoring' &&
                                !session.isSinglePlayer &&
                                session.gameCategory !== 'tower' &&
                                (!session.analysisResult?.['system'] || session.isAnalyzing) && (
                                    <ScoringOverlay />
                                )}
                        </div>
                        <div className={`flex-shrink-0 w-full flex flex-col ${isPairIngame && isMobile ? 'gap-0.5' : 'gap-1'}`}>
                            {!(isPairIngame && isMobile) && (
                                <TurnDisplay
                                    session={turnDisplaySession}
                                    isMobile={isMobile}
                                    onOpenSidebar={isMobile ? openMobileSidebar : undefined}
                                    sidebarNotification={hasNewMessage}
                                    onAction={handlers.handleAction}
                                    boardRuleFlashMessage={boardRuleFlashMessage}
                                    viewerUserId={isSpectator ? undefined : currentUser.id}
                                />
                            )}
                            {isGuildWarTowerStyleUi && mode === GameMode.Missile ? (
                                <GuildWarMissileTowerControls
                                    session={session}
                                    onAction={handlers.handleAction}
                                    setShowResultModal={setShowResultModal}
                                    setConfirmModalType={setConfirmModalType}
                                    isMoveInFlight={isMoveInFlight}
                                    isBoardLocked={isBoardLocked}
                                    isMobile={isMobile}
                                />
                            ) : isGuildWarTowerStyleUi && mode === GameMode.Hidden ? (
                                <GuildWarHiddenTowerControls
                                    session={session}
                                    onAction={handlers.handleAction}
                                    currentUser={currentUserWithStatus}
                                    setShowResultModal={setShowResultModal}
                                    setConfirmModalType={setConfirmModalType}
                                    isMoveInFlight={isMoveInFlight}
                                    isBoardLocked={isBoardLocked}
                                    isMobile={isMobile}
                                />
                            ) : (
                                <GameControls {...gameControlsProps} />
                            )}
                        </div>
                    </div>
                </main>
                
                {!isMobile && (
                    <div
                        className={`relative max-h-full min-h-0 flex-shrink-0 self-stretch transition-[width] duration-200 ${
                            isRightSidebarCollapsed ? 'w-0' : 'w-[320px] xl:w-[360px]'
                        }`}
                    >
                        {!isRightSidebarCollapsed && (
                            <div className="flex h-full max-h-full min-h-0 items-stretch border-l border-gray-700/80 bg-gray-900/50 rounded-r-lg overflow-hidden">
                                <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
                                    {isGuildWarTowerStyleUi ? (
                                        <GuildWarTowerSidebar
                                            session={sessionWithRestoredPatternStones}
                                            gameChat={gameChat}
                                            onAction={handlers.handleAction}
                                            currentUser={currentUserWithStatus}
                                            onTogglePause={isPausableAiGame ? handlePauseToggle : undefined}
                                            isPaused={effectivePaused}
                                            resumeCountdown={resumeCountdown}
                                            pauseButtonCooldown={pauseButtonCooldown}
                                        />
                                    ) : (
                                        <Sidebar
                                            {...gameProps}
                                            onLeaveOrResign={handleLeaveOrResignClick}
                                            isNoContestLeaveAvailable={isNoContestLeaveAvailable}
                                            onTogglePause={isPausableAiGame ? handlePauseToggle : undefined}
                                            isPaused={effectivePaused}
                                            resumeCountdown={resumeCountdown}
                                            pauseButtonCooldown={pauseButtonCooldown}
                                            pauseDisabledBecauseAiTurn={isPausableAiGame && !isMyTurn}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsRightSidebarCollapsed(prev => !prev)}
                            className="absolute top-1/2 -left-6 z-[120] -translate-y-1/2 w-7 h-9 flex items-center justify-center rounded-md bg-gray-800/90 hover:bg-gray-700/90 text-gray-300 hover:text-white transition-colors border border-gray-700/80"
                            title={isRightSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
                            aria-label={isRightSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
                        >
                            <span className="text-sm font-bold leading-none">
                                {isRightSidebarCollapsed ? '<' : '>'}
                            </span>
                        </button>
                    </div>
                )}
                
                {isMobile && (
                    <>
                        <div
                            className={`fixed inset-y-0 right-0 z-50 flex w-[280px] flex-col overflow-hidden bg-secondary shadow-2xl transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
                            style={mobileGameSidebarDrawerStyle}
                        >
                            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                                {isGuildWarTowerStyleUi ? (
                                    <GuildWarTowerSidebar
                                        session={sessionWithRestoredPatternStones}
                                        gameChat={gameChat}
                                        onAction={handlers.handleAction}
                                        currentUser={currentUserWithStatus}
                                        onClose={() => setIsMobileSidebarOpen(false)}
                                        onTogglePause={isPausableAiGame ? handlePauseToggle : undefined}
                                        isPaused={effectivePaused}
                                        resumeCountdown={resumeCountdown}
                                        pauseButtonCooldown={pauseButtonCooldown}
                                    />
                                ) : (
                                    <Sidebar
                                        {...gameProps}
                                        onLeaveOrResign={handleLeaveOrResignClick}
                                        isNoContestLeaveAvailable={isNoContestLeaveAvailable}
                                        onClose={() => setIsMobileSidebarOpen(false)}
                                        onTogglePause={isPausableAiGame ? handlePauseToggle : undefined}
                                        isPaused={effectivePaused}
                                        resumeCountdown={resumeCountdown}
                                        pauseButtonCooldown={pauseButtonCooldown}
                                        pauseDisabledBecauseAiTurn={isPausableAiGame && !isMyTurn}
                                    />
                                )}
                            </div>
                        </div>
                        {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsMobileSidebarOpen(false)}></div>}
                    </>
                )}
            </div>
            
            {isAnalysisActive && analysisResult && (
                <TerritoryAnalysisWindow session={session} result={analysisResult} onClose={() => setIsAnalysisActive(false)} />
            )}
            
            <GameModals 
                {...gameProps}
                confirmModalType={confirmModalType}
                onHideConfirmModal={() => setConfirmModalType(null)}
                showResultModal={showResultModal}
                onCloseResults={handleCloseResults}
                onOpenGameRecordList={handlers.openGameRecordList}
                onAdventureLeaveToMap={handleAdventureLeaveToMap}
            />
        </div>
        </InGameModalLayoutProvider>
    );
};

export default Game;