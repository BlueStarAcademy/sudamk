import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { ArenaChannel } from '../../shared/types/api.js';
import type { ServerAction } from '../../types.js';
import type { GameMode, GameSettings } from '../../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants';
import AiChallengeModal from './AiChallengeModal.js';
import type { ArenaLobbyNavKind } from './ArenaLobbyNavTitleBar.js';
import AlertModal from '../AlertModal.js';

export type PairAiLobbyMatchMode = 'solo' | 'duo';

/** `onEnsureDuoRoom` — `exists`면 서버·클라이언트에 2인 AI 방이 이미 있음 */
export type PairAiDuoRoomEnsureResult = 'ok' | 'exists' | 'error';

export type AiLobbyInlineWorkspaceProps = {
    channel: ArenaChannel;
    onSelectChannel: (target: ArenaLobbyNavKind) => void;
    onAction: (action: ServerAction) => void | Promise<unknown>;
    onPairAiAction?: (action: ServerAction) => void | Promise<unknown>;
    transformPairAiSettings?: (mode: GameMode, settings: GameSettings) => GameSettings;
    hasEquippedPairPet?: boolean;
    isBusy?: boolean;
    className?: string;
    /** 페어 채널 2인 팀 AI — 방 자동 생성·시작 게이트 */
    pairDuoContext?: {
        myRoom: { id: string; roomKind: string } | null;
        canStartAiMatch: boolean;
        startBlockReason?: string;
        onEnsureDuoRoom: () => void | Promise<PairAiDuoRoomEnsureResult | void>;
        onRequestLeaveRoomForModeSwitch?: () => void | Promise<void>;
    };
    /** 솔로↔2인 팀 전환 시 유저 열·모바일 탭이 duo 껍데기 방을 방으로 보지 않게 함 */
    onPairMatchModeChange?: (mode: PairAiLobbyMatchMode) => void;
    /** 페어 2인 팀 AI — 중앙 패널(대국 설정 위)에 표시할 슬롯 UI */
    duoRoomInteriorSlot?: ReactNode;
};

type AiLobbyWorkspaceContextValue = {
    channel: ArenaChannel;
    onSelectChannel: (target: ArenaLobbyNavKind) => void;
    pairMatchMode: PairAiLobbyMatchMode;
    trySetPairMatchMode: (next: PairAiLobbyMatchMode) => void | Promise<void>;
    preferredBucket: ReturnType<typeof resolvePreferredBucket>;
    lobbyType: 'strategic' | 'playful';
    title: string;
    handlePairStart: (action: ServerAction) => void | Promise<unknown>;
    pairSubmitDisabled: boolean;
    onAction: (action: ServerAction) => void | Promise<unknown>;
    transformPairAiSettings?: (mode: GameMode, settings: GameSettings) => GameSettings;
    showPairModePicker: boolean;
    duoRoomInteriorSlot?: ReactNode;
};

const AiLobbyWorkspaceContext = createContext<AiLobbyWorkspaceContextValue | null>(null);

export function useAiLobbyWorkspace(): AiLobbyWorkspaceContextValue {
    const ctx = useContext(AiLobbyWorkspaceContext);
    if (!ctx) throw new Error('AiLobby workspace components must be used within AiLobbyWorkspaceProvider');
    return ctx;
}

function resolvePreferredBucket(channel: ArenaChannel) {
    return channel === 'playful'
        ? ('playful_ai_challenge' as const)
        : channel === 'pair'
          ? ('pair_ai_match_modal' as const)
          : ('strategic_ai_challenge' as const);
}

export const AiLobbyWorkspaceProvider: React.FC<AiLobbyInlineWorkspaceProps & { children: ReactNode }> = ({
    channel,
    onSelectChannel,
    onAction,
    onPairAiAction,
    transformPairAiSettings,
    hasEquippedPairPet = true,
    isBusy = false,
    pairDuoContext,
    duoRoomInteriorSlot,
    onPairMatchModeChange,
    children,
}) => {
    const { t } = useTranslation('lobby');
    const [pairMatchMode, setPairMatchMode] = useState<PairAiLobbyMatchMode>('solo');
    const [alertMessage, setAlertMessage] = useState<string | null>(null);
    const pairMatchModeRef = useRef<PairAiLobbyMatchMode>('solo');
    const duoAutoCreateInFlightRef = useRef(false);
    /** 자동 생성 실패 시 effect 무한 재시도 방지 — 탭을 바꾸거나 duo 방이 생기면 해제 */
    const duoAutoCreateBlockedRef = useRef(false);
    /** 사용자가 탭을 직접 고른 뒤 서버 방 상태가 따라잡기 전까지 room→mode 동기화를 막는다 */
    const explicitPairMatchModeRef = useRef<PairAiLobbyMatchMode | null>(null);
    const lastSyncedPairRoomKeyRef = useRef<string | null>(null);

    useEffect(() => {
        pairMatchModeRef.current = pairMatchMode;
        onPairMatchModeChange?.(pairMatchMode);
    }, [pairMatchMode, onPairMatchModeChange]);

    useEffect(() => {
        if (channel !== 'pair') return;
        const room = pairDuoContext?.myRoom;
        const roomKey = room ? `${room.id}:${room.roomKind}` : '__none__';

        if (explicitPairMatchModeRef.current === 'solo' && room?.roomKind === 'duo_match') {
            return;
        }
        if (explicitPairMatchModeRef.current === 'duo' && room?.roomKind === 'ai_duel') {
            return;
        }

        if (roomKey === lastSyncedPairRoomKeyRef.current) return;
        lastSyncedPairRoomKeyRef.current = roomKey;

        if (!room) return;
        if (room.roomKind === 'duo_match') {
            setPairMatchMode('duo');
            if (explicitPairMatchModeRef.current === 'duo') explicitPairMatchModeRef.current = null;
        } else if (room.roomKind === 'ai_duel') {
            setPairMatchMode('solo');
            if (explicitPairMatchModeRef.current === 'solo') explicitPairMatchModeRef.current = null;
        }
    }, [channel, pairDuoContext?.myRoom?.id, pairDuoContext?.myRoom?.roomKind]);

    useEffect(() => {
        if (channel !== 'pair' || pairMatchMode !== 'duo' || !pairDuoContext || isBusy) return;
        const room = pairDuoContext.myRoom;
        if (room?.roomKind === 'duo_match') {
            duoAutoCreateBlockedRef.current = false;
            return;
        }
        if (room && room.roomKind !== 'duo_match') return;
        if (duoAutoCreateInFlightRef.current || duoAutoCreateBlockedRef.current) return;
        duoAutoCreateInFlightRef.current = true;
        void Promise.resolve(pairDuoContext.onEnsureDuoRoom())
            .then((result) => {
                if (pairMatchModeRef.current !== 'duo') {
                    void pairDuoContext.onRequestLeaveRoomForModeSwitch?.();
                    return;
                }
                if (result === 'error' || result === 'exists') duoAutoCreateBlockedRef.current = true;
            })
            .finally(() => {
                duoAutoCreateInFlightRef.current = false;
            });
    }, [
        channel,
        pairMatchMode,
        pairDuoContext?.myRoom?.id,
        pairDuoContext?.myRoom?.roomKind,
        pairDuoContext?.onEnsureDuoRoom,
        isBusy,
    ]);

    const finalizePairMatchMode = useCallback(
        async (next: PairAiLobbyMatchMode, needsLeave: boolean) => {
            explicitPairMatchModeRef.current = next;
            lastSyncedPairRoomKeyRef.current = null;
            if (next === 'solo') {
                duoAutoCreateBlockedRef.current = true;
            } else if (next === 'duo') {
                duoAutoCreateBlockedRef.current = false;
            }
            if (needsLeave) {
                await pairDuoContext?.onRequestLeaveRoomForModeSwitch?.();
            }
            setPairMatchMode(next);
        },
        [pairDuoContext],
    );

    const trySetPairMatchMode = useCallback(
        async (next: PairAiLobbyMatchMode) => {
            if (next === pairMatchMode) return;
            const room = pairDuoContext?.myRoom;
            const needsLeave =
                Boolean(room) &&
                ((next === 'duo' && room!.roomKind === 'ai_duel') ||
                    (next === 'solo' && room!.roomKind === 'duo_match'));
            await finalizePairMatchMode(next, needsLeave);
        },
        [pairMatchMode, pairDuoContext, finalizePairMatchMode],
    );

    const handlePairStart = useCallback(
        (action: ServerAction) => {
            if (channel === 'pair' && pairMatchMode === 'solo' && !hasEquippedPairPet) {
                setAlertMessage(t('aiChallengeModal.pairAiPetRequired'));
                return;
            }
            if (channel === 'pair' && pairMatchMode === 'duo') {
                if (!pairDuoContext?.canStartAiMatch) {
                    if (pairDuoContext?.startBlockReason) setAlertMessage(pairDuoContext.startBlockReason);
                    return;
                }
            }
            return (onPairAiAction ?? onAction)(action);
        },
        [channel, pairMatchMode, hasEquippedPairPet, pairDuoContext, onPairAiAction, onAction, t],
    );

    const pairSubmitDisabled = useMemo(() => {
        if (channel !== 'pair') return false;
        if (pairMatchMode === 'solo') return false;
        return !pairDuoContext?.canStartAiMatch;
    }, [channel, pairMatchMode, pairDuoContext?.canStartAiMatch]);

    const preferredBucket = resolvePreferredBucket(channel);
    const lobbyType = channel === 'playful' ? 'playful' : 'strategic';
    const title =
        channel === 'playful'
            ? t('aiChallenge.playful')
            : channel === 'pair'
              ? t('aiChallengeModal.pairAiTitle')
              : t('aiChallenge.strategic');
    const showPairModePicker = channel === 'pair' && Boolean(pairDuoContext);

    const value = useMemo(
        (): AiLobbyWorkspaceContextValue => ({
            channel,
            onSelectChannel,
            pairMatchMode,
            trySetPairMatchMode,
            preferredBucket,
            lobbyType,
            title,
            handlePairStart,
            pairSubmitDisabled,
            onAction,
            transformPairAiSettings,
            showPairModePicker,
            duoRoomInteriorSlot,
        }),
        [
            channel,
            onSelectChannel,
            pairMatchMode,
            trySetPairMatchMode,
            preferredBucket,
            lobbyType,
            title,
            t,
            handlePairStart,
            pairSubmitDisabled,
            onAction,
            transformPairAiSettings,
            showPairModePicker,
            duoRoomInteriorSlot,
        ],
    );

    return (
        <>
            <AiLobbyWorkspaceContext.Provider value={value}>{children}</AiLobbyWorkspaceContext.Provider>
            {alertMessage ? (
                <AlertModal
                    message={alertMessage}
                    onClose={() => setAlertMessage(null)}
                    windowId="pair-ai-lobby-alert"
                />
            ) : null}
        </>
    );
};

export const AiLobbyPairMatchModeTabs: React.FC<{ className?: string }> = ({ className }) => {
    const { t } = useTranslation('lobby');
    const { showPairModePicker, pairMatchMode, trySetPairMatchMode } = useAiLobbyWorkspace();
    if (!showPairModePicker) return null;
    return (
        <div
            className={`grid shrink-0 grid-cols-2 gap-1 rounded-xl border border-fuchsia-500/30 bg-black/30 p-1 ${className ?? ''}`}
            role="tablist"
            aria-label={t('aiChallengeModal.pairAiFormAria')}
        >
            <button
                type="button"
                onClick={() => void trySetPairMatchMode('solo')}
                aria-pressed={pairMatchMode === 'solo'}
                className={`rounded-lg px-2 py-1.5 text-xs font-extrabold sm:py-2 sm:text-sm ${
                    pairMatchMode === 'solo'
                        ? 'bg-fuchsia-600 text-fuchsia-50'
                        : 'text-fuchsia-100 hover:bg-fuchsia-950/45'
                }`}
            >
                {t('aiChallengeModal.soloTab')}
            </button>
            <button
                type="button"
                onClick={() => void trySetPairMatchMode('duo')}
                aria-pressed={pairMatchMode === 'duo'}
                className={`rounded-lg px-2 py-1.5 text-xs font-extrabold sm:py-2 sm:text-sm ${
                    pairMatchMode === 'duo'
                        ? 'bg-violet-600 text-violet-50'
                        : 'text-violet-100 hover:bg-violet-950/45'
                }`}
            >
                {t('aiChallengeModal.duoTab')}
            </button>
        </div>
    );
};

/** 페어 AI 데스크톱 좌측: 2인 팀 선택 시 슬롯 패널만 */
export const AiLobbyPairLeftChrome: React.FC<{ className?: string; roomInteriorSlot?: ReactNode }> = ({
    className,
    roomInteriorSlot,
}) => {
    const { pairMatchMode } = useAiLobbyWorkspace();
    if (pairMatchMode !== 'duo' || !roomInteriorSlot) return null;
    return (
        <div className={`mt-auto flex min-h-0 flex-1 flex-col overflow-hidden ${className ?? ''}`}>
            {roomInteriorSlot}
        </div>
    );
};

const aiChallengeModalShellClass =
    'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/20 shadow-inner ring-1 ring-white/[0.06]';

/** 전략·놀이 AI — 중앙 인라인 게임모드+설정 */
export const AiLobbyStandaloneCenterPanel: React.FC<{
    channel: 'strategic' | 'playful';
    onAction: (action: ServerAction) => void | Promise<unknown>;
    className?: string;
    /** PVP↔AI 전환 시 설정·버튼 상태 초기화 */
    remountKey?: string;
}> = React.memo(({ channel, onAction, className, remountKey = 'pvp' }) => {
    const { t } = useTranslation('lobby');
    const lobbyType = channel === 'playful' ? 'playful' : 'strategic';
    const preferredBucket = resolvePreferredBucket(channel);
    const title = channel === 'playful' ? t('aiChallenge.playful') : t('aiChallenge.strategic');
    return (
        <div className={`flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden ${className ?? ''}`}>
            <div className={aiChallengeModalShellClass}>
                <AiChallengeModal
                    key={`ai-standalone-${channel}-${remountKey}`}
                    embeddedPanel
                    embeddedPanelStackedLayout
                    lobbyType={lobbyType}
                    preferredGameSettingsBucket={preferredBucket}
                    onClose={() => {}}
                    onAction={onAction}
                    startActionType="START_AI_GAME"
                    title={title}
                    submitLabel={t('aiChallengeModal.startAiDuel')}
                />
            </div>
        </div>
    );
});

/** 페어 AI 중앙: 인라인 게임모드+설정 (+ 2인 팀 슬롯) */
export const AiLobbyCenterPanel: React.FC<{ className?: string }> = ({ className }) => {
    const { t } = useTranslation('lobby');
    const {
        channel,
        pairMatchMode,
        preferredBucket,
        lobbyType,
        title,
        handlePairStart,
        pairSubmitDisabled,
        transformPairAiSettings,
        duoRoomInteriorSlot,
    } = useAiLobbyWorkspace();

    return (
        <div className={`flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden ${className ?? ''}`}>
            <AiLobbyPairMatchModeTabs />
            {pairMatchMode === 'duo' && duoRoomInteriorSlot ? (
                <div className="flex min-h-0 max-h-[min(42%,22rem)] shrink-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/25 p-2 shadow-inner ring-1 ring-white/[0.06] sm:max-h-[min(38%,24rem)] sm:p-2.5">
                    {duoRoomInteriorSlot}
                </div>
            ) : null}
            <div className={`${aiChallengeModalShellClass} min-h-0 flex-1`}>
                <AiChallengeModal
                    key={`ai-inline-center-${channel}-${pairMatchMode}`}
                    embeddedPanel
                    embeddedPanelStackedLayout
                    pairRoomDenseSettingsGrid
                    lobbyType={lobbyType}
                    preferredGameSettingsBucket={preferredBucket}
                    onClose={() => {}}
                    onAction={handlePairStart}
                    startActionType="PAIR_START_AI_MATCH"
                    title={title}
                    submitLabel={t('aiChallengeModal.startAiGame')}
                    submitDisabled={pairSubmitDisabled}
                    showActionPointCost
                    transformSettingsBeforeStart={transformPairAiSettings}
                    hideScoringTurnLimit
                />
            </div>
        </div>
    );
};

/** 모바일 페어 AI: 솔로/2인 탭 + 인라인 설정 (+ 2인 팀 슬롯) */
export const AiLobbyMobileWorkspace: React.FC<{ className?: string }> = ({ className }) => {
    const { t } = useTranslation('lobby');
    const {
        channel,
        pairMatchMode,
        preferredBucket,
        lobbyType,
        title,
        handlePairStart,
        pairSubmitDisabled,
        transformPairAiSettings,
        duoRoomInteriorSlot,
    } = useAiLobbyWorkspace();

    return (
        <div className={`flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden ${className ?? ''}`}>
            <AiLobbyPairMatchModeTabs />
            {pairMatchMode === 'duo' && duoRoomInteriorSlot ? (
                <div className="flex min-h-0 max-h-[min(46%,20rem)] shrink-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/25 p-1.5 shadow-inner ring-1 ring-white/[0.06]">
                    {duoRoomInteriorSlot}
                </div>
            ) : null}
            <div className={`${aiChallengeModalShellClass} min-h-0 flex-1`}>
                <AiChallengeModal
                    key={`ai-inline-mobile-${channel}-${pairMatchMode}`}
                    embeddedPanel
                    embeddedPanelStackedLayout
                    pairRoomDenseSettingsGrid
                    lobbyType={lobbyType}
                    preferredGameSettingsBucket={preferredBucket}
                    onClose={() => {}}
                    onAction={handlePairStart}
                    startActionType="PAIR_START_AI_MATCH"
                    title={title}
                    submitLabel={t('aiChallengeModal.startAiGame')}
                    submitDisabled={pairSubmitDisabled}
                    showActionPointCost
                    transformSettingsBeforeStart={transformPairAiSettings}
                    hideScoringTurnLimit
                />
            </div>
        </div>
    );
};

/** @deprecated Prefer channel-specific parts */
const AiLobbyInlineWorkspace: React.FC<AiLobbyInlineWorkspaceProps> = (props) => (
    <AiLobbyWorkspaceProvider {...props}>
        <AiLobbyMobileWorkspace className={props.className} />
    </AiLobbyWorkspaceProvider>
);

export default AiLobbyInlineWorkspace;
