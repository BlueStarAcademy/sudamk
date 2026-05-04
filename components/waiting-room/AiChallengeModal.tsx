import React, { useState, useMemo, useEffect, useRef, useCallback, type ReactNode } from 'react';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import {
    LOBBY_MOBILE_BTN_PRIMARY_CLASS,
    LOBBY_MOBILE_BTN_SECONDARY_CLASS,
    LOBBY_MOBILE_HEADER_BACK_BTN_CLASS,
    LOBBY_MOBILE_MODAL_FOOTER_CLASS,
} from '../game/PreGameDescriptionLayout.js';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH } from '../../constants/ads.js';
import { GameMode, ServerAction, GameSettings, Player, AlkkagiPlacementType } from '../../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, DEFAULT_GAME_SETTINGS, STRATEGIC_ACTION_POINT_COST, PLAYFUL_ACTION_POINT_COST, aiUserId } from '../../constants';
import { 
  BOARD_SIZES, TIME_LIMITS, BYOYOMI_COUNTS, BYOYOMI_TIMES, CAPTURE_BOARD_SIZES, 
  CAPTURE_TARGETS, TTAMOK_CAPTURE_TARGETS, SPEED_BOARD_SIZES, SPEED_TIME_LIMITS, BASE_STONE_COUNTS,
  SCAN_COUNTS, MISSILE_BOARD_SIZES, MISSILE_COUNTS,
  ALKKAGI_STONE_COUNTS, ALKKAGI_ROUNDS, ALKKAGI_GAUGE_SPEEDS, ALKKAGI_ITEM_COUNTS,
  CURLING_STONE_COUNTS, CURLING_ROUNDS, CURLING_GAUGE_SPEEDS, CURLING_ITEM_COUNTS,
  OMOK_BOARD_SIZES, HIDDEN_BOARD_SIZES, DICE_GO_ITEM_COUNTS, getStrategicBoardSizesByMode, getScoringTurnLimitOptionsByBoardSize, getAiScoringTurnLimitByBoardSize
} from '../../constants/gameSettings.js';
import Avatar from '../Avatar.js';
import { profileStepFromKataServerLevel } from '../../shared/utils/strategicAiDifficulty.js';
import { MAX_GAME_INTEGER_INPUT } from '../../shared/constants/numericLimits.js';
import { clampGameInt } from '../../shared/utils/gameIntegerField.js';
import {
    diceGoUnifiedSpecialDiceCounts,
    getDiceGoUnifiedSpecialDiceCount,
} from '../../shared/utils/diceGoSettings.js';
import {
    getThiefUnifiedSpecialDiceCount,
    thiefUnifiedSpecialDiceCounts,
} from '../../shared/utils/thiefGoSettings.js';
import {
    clampAiLobbyStrategicItemCaps,
    AI_LOBBY_HIDDEN_ITEM_FIXED,
    AI_LOBBY_MISSILE_MAX,
    AI_LOBBY_SCAN_MAX,
} from '../../shared/utils/strategicAiLobbyItemCaps.js';
import { PAIR_LOBBY_DENSE_SETTING_ROW_CLASS } from '../../shared/constants/pairLobbyDenseSettingFieldLayout.js';

interface AiChallengeModalProps {
    lobbyType: 'strategic' | 'playful';
    onClose: () => void;
    /** `configureOnly`일 때는 생략 가능 — 설정만 부모로 넘길 때 사용 */
    onAction?: (action: ServerAction) => void | Promise<unknown>;
    /** 인게임 AI 재대결: 직전 대국 모드·설정을 그대로 반영하고 preferredGameSettings에도 저장 */
    seedFromSession?: { mode: GameMode; settings: GameSettings };
    /** 페어 경기장 등에서 같은 설정 UI를 쓰되 시작 액션만 바꿔야 하는 경우 */
    startActionType?: 'START_AI_GAME' | 'PAIR_START_AI_MATCH' | 'PAIR_START_MATCH';
    transformSettingsBeforeStart?: (mode: GameMode, settings: GameSettings) => GameSettings;
    hideScoringTurnLimit?: boolean;
    title?: string;
    submitLabel?: string;
    showActionPointCost?: boolean;
    /** 대국 시작 없이 모드·설정만 확정(페어 방 만들기·방 변경 등) */
    configureOnly?: boolean;
    onConfigureApply?: (mode: GameMode, settings: GameSettings) => void;
    /**
     * true면 DraggableWindow·별도 배경 없이 본문만 렌더(부모 모달 안에 삽입).
     * `configureOnly`와 함께 쓰며, 설정 변경 시 `onConfigureApply`로 부모 상태를 갱신한다.
     */
    embeddedPanel?: boolean;
    /**
     * 페어 방 만들기: 좌측=게임 종류, 우측은 이 함수로 감싼 `대국 설정` 블록 위에 방 이름·종류·공개 등 배치.
     * `configureOnly` + `embeddedPanel` + 전략 로비에서만 사용한다.
     */
    pairRoomEmbeddedRightSlot?: (gameSettingsBlock: ReactNode) => ReactNode;
    /**
     * 페어/전략 방 모달: 우측 열(방 이름·대국 설정) 하단에 고정되는 푸터(취소·만들기 등).
     * 핸드헬드「방 만들기」1단계(게임 종류만)에서는 렌더하지 않는다.
     */
    pairRoomEmbeddedColumnFooter?: ReactNode;
    /** 페어 방 만들기: 대국 설정 필드를 한 줄에 최대한 많이(다열 그리드) */
    pairRoomDenseSettingsGrid?: boolean;
    /**
     * 페어 방 만들기·방 설정 변경(모바일): 1단계=게임 종류, 2단계=방 이름·종류·대국 설정. true면 하단에 취소/다음·뒤로/저장 푸터를 렌더한다.
     * `configureOnly` + `embeddedPanel` + `pairRoomEmbeddedRightSlot` + 좁은 뷰포트와 함께 쓴다.
     */
    pairRoomHandheldCreateStackedFooter?: boolean;
    onPairRoomHandheldCancel?: () => void;
    onPairRoomHandheldSubmit?: () => void | Promise<void>;
    /** 핸드헬드 푸터 버튼 비활성(제출 중 등) */
    pairRoomHandheldBusy?: boolean;
    /** 페어/전략 방 만들기: 친선전(`duo_match`) 등에서 대국 설정에 AI단계(카타 단계) 숨김 */
    pairRoomHideGoAiLevel?: boolean;
    /** 놀이바둑 친선전 등: 순서·역할 UI 숨김(유저 대전은 자동 랜덤). AI대결 방에서는 숨기지 않음 */
    pairRoomHidePlayerOrderRole?: boolean;
}

/** 전략바둑 대기실 「AI와 대결하기」: 베이스돌 최대 4개 */
const AI_CHALLENGE_BASE_STONE_COUNTS = (BASE_STONE_COUNTS as readonly number[]).filter((count) => count <= 4);
/** 전략·페어 「AI와 대결」: 히든 아이템 1개 고정 */
const AI_CHALLENGE_HIDDEN_STONE_COUNTS = [AI_LOBBY_HIDDEN_ITEM_FIXED] as const;
/** 스캔 아이템 최대 3개 */
const AI_CHALLENGE_SCAN_COUNTS = (SCAN_COUNTS as readonly number[]).filter((count) => count <= AI_LOBBY_SCAN_MAX);
/** 미사일 아이템 최대 3개 */
const AI_CHALLENGE_MISSILE_COUNTS = (MISSILE_COUNTS as readonly number[]).filter((count) => count <= AI_LOBBY_MISSILE_MAX);

function getAiChallengeBoardSizes(mode: GameMode, lobbyType: 'strategic' | 'playful'): number[] {
    if (lobbyType === 'strategic') {
        const restrictedStrategicModes: GameMode[] = [
            GameMode.Capture,
            GameMode.Base,
            GameMode.Hidden,
            GameMode.Missile,
            GameMode.Mix,
        ];
        if (restrictedStrategicModes.includes(mode)) {
            return [9, 13];
        }
        return [9, 13, 19];
    }

    if (mode === GameMode.Omok || mode === GameMode.Ttamok) return [...OMOK_BOARD_SIZES];
    if (mode === GameMode.Thief) return [9, 13, 19];
    return [...getStrategicBoardSizesByMode(mode)];
}

function modeIncludesCaptureRule(mode: GameMode, settings: Pick<GameSettings, 'mixedModes'>): boolean {
    return mode === GameMode.Capture || (mode === GameMode.Mix && Boolean(settings.mixedModes?.includes(GameMode.Capture)));
}

function normalizeAiScoringTurnLimit(mode: GameMode, settings: GameSettings): GameSettings {
    if (!SPECIAL_GAME_MODES.some(m => m.mode === mode)) return settings;
    if (modeIncludesCaptureRule(mode, settings)) {
        const next = { ...settings, scoringTurnLimit: 0 };
        delete (next as any).autoScoringTurns;
        return next;
    }
    return {
        ...settings,
        scoringTurnLimit: getAiScoringTurnLimitByBoardSize(settings.boardSize || DEFAULT_GAME_SETTINGS.boardSize),
    };
}

/** 종료된 대국 session.settings → AI 도전 모달 초기값 (NegotiationModal과 유사 검증) */
function mergeSeedIntoChallengeSettings(mode: GameMode, sessionSettings: GameSettings): GameSettings {
    let newSettings: GameSettings = { ...DEFAULT_GAME_SETTINGS, ...sessionSettings };
    if (mode === GameMode.Base) {
        newSettings.komi = 0.5;
    }
    if (mode === GameMode.Mix && newSettings.mixedModes?.includes(GameMode.Base) && newSettings.mixedModes?.includes(GameMode.Capture)) {
        newSettings.mixedModes = newSettings.mixedModes.filter(m => m !== GameMode.Base);
    }
    if (!newSettings.player1Color) {
        newSettings.player1Color = Player.Black;
    }
    const validBoardSizes = getStrategicBoardSizesByMode(mode);
    if (!validBoardSizes.includes(newSettings.boardSize)) {
        newSettings.boardSize = validBoardSizes[0] as GameSettings['boardSize'];
    }
    if (mode === GameMode.Alkkagi) {
        const validSpeeds = ALKKAGI_GAUGE_SPEEDS.map(s => s.value);
        if (newSettings.alkkagiGaugeSpeed != null && !validSpeeds.includes(newSettings.alkkagiGaugeSpeed)) {
            delete (newSettings as any).alkkagiGaugeSpeed;
        }
        if (newSettings.alkkagiStoneCount != null && !(ALKKAGI_STONE_COUNTS as readonly number[]).includes(newSettings.alkkagiStoneCount)) {
            delete (newSettings as any).alkkagiStoneCount;
        }
    }
    if (mode === GameMode.Curling) {
        const validSpeeds = CURLING_GAUGE_SPEEDS.map(s => s.value);
        if (newSettings.curlingGaugeSpeed != null && !validSpeeds.includes(newSettings.curlingGaugeSpeed)) {
            delete (newSettings as any).curlingGaugeSpeed;
        }
        if (newSettings.curlingStoneCount != null && !(CURLING_STONE_COUNTS as readonly number[]).includes(newSettings.curlingStoneCount)) {
            delete (newSettings as any).curlingStoneCount;
        }
    }
    if (newSettings.baseStones != null && !AI_CHALLENGE_BASE_STONE_COUNTS.includes(newSettings.baseStones)) {
        delete (newSettings as any).baseStones;
    }
    return clampAiLobbyStrategicItemCaps(mode, normalizeAiScoringTurnLimit(mode, newSettings));
}

const GameCard: React.FC<{
    mode: GameMode;
    image: string;
    displayName: string;
    onSelect: (mode: GameMode) => void;
    isSelected: boolean;
    compact?: boolean;
}> = ({ mode, image, displayName, onSelect, isSelected, compact }) => {
    const [imgError, setImgError] = useState(false);
    const imgH = compact ? 68 : 100;
    const pad = compact ? 6 : 8;
    const titlePx = compact ? 12 : 14;

    return (
        <div
            className={`box-border bg-panel text-on-panel rounded-lg flex flex-col items-center text-center transition-all transform touch-manipulation border-2 ${
                isSelected
                    ? compact
                        ? 'cursor-pointer border-violet-400 ring-2 ring-violet-400/70 ring-offset-2 ring-offset-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_10px_28px_-8px_rgba(139,92,246,0.45)] active:scale-[0.98]'
                        : 'cursor-pointer border-purple-400 shadow-lg ring-2 ring-purple-500/60 active:scale-[0.98]'
                    : 'border-transparent shadow-lg cursor-pointer active:scale-[0.98] hover:border-purple-400/45 hover:ring-1 hover:ring-purple-400/35'
            }`}
            style={{ padding: `${pad}px`, gap: compact ? '3px' : '4px' }}
            onClick={() => onSelect(mode)}
        >
            <div
                className="w-full flex-shrink-0 bg-tertiary rounded-md flex items-center justify-center text-tertiary overflow-hidden shadow-inner relative"
                style={{ height: `${imgH}px`, marginBottom: compact ? '2px' : '4px', padding: '4px' }}
            >
                {!imgError ? (
                    <img
                        src={image}
                        alt={displayName}
                        className="w-full h-full object-contain"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <span style={{ fontSize: compact ? '11px' : '13px' }}>{displayName}</span>
                )}
            </div>
            <div className="flex-grow flex flex-col w-full min-w-0">
                <h3 className="font-bold leading-tight text-primary truncate px-0.5" style={{ fontSize: `${titlePx}px`, marginBottom: '2px' }}>
                    {displayName}
                </h3>
            </div>
        </div>
    );
};

const AiChallengeModal: React.FC<AiChallengeModalProps> = ({
    lobbyType,
    onClose,
    onAction,
    seedFromSession,
    startActionType = 'START_AI_GAME',
    transformSettingsBeforeStart,
    hideScoringTurnLimit = false,
    title = 'AI와 대결하기',
    submitLabel = '시작',
    showActionPointCost = true,
    configureOnly = false,
    onConfigureApply,
    embeddedPanel = false,
    pairRoomEmbeddedRightSlot,
    pairRoomEmbeddedColumnFooter,
    pairRoomDenseSettingsGrid = false,
    pairRoomHandheldCreateStackedFooter = false,
    onPairRoomHandheldCancel,
    onPairRoomHandheldSubmit,
    pairRoomHandheldBusy = false,
    pairRoomHideGoAiLevel = false,
    pairRoomHidePlayerOrderRole = false,
}) => {
    const availableGameModes = lobbyType === 'strategic' ? SPECIAL_GAME_MODES : PLAYFUL_GAME_MODES;
    const [selectedGameMode, setSelectedGameMode] = useState<GameMode | null>(() => {
        if (seedFromSession?.mode && availableGameModes.some(m => m.mode === seedFromSession.mode)) {
            return seedFromSession.mode;
        }
        return availableGameModes[0]?.mode || null;
    });
    const [settings, setSettings] = useState<GameSettings>(DEFAULT_GAME_SETTINGS);
    const prevSelectedGameModeRef = useRef<GameMode | null>(null);
    const [mobileStep, setMobileStep] = useState<'pickMode' | 'settings'>(() => (seedFromSession ? 'settings' : 'pickMode'));
    /** 페어 방 만들기(핸드헬드): 게임 종류 → 방 이름·설정 */
    const [pairEmbedMobileStep, setPairEmbedMobileStep] = useState<'game' | 'details'>('game');
    const seedHydratedRef = useRef(false);
    /** 부모(Game)가 매 프레임 새 객체를 넘겨도 시드 적용·localStorage 로직이 중복 실행되지 않게 첫 렌더 값만 사용 */
    const frozenSeedRef = useRef<typeof seedFromSession>(undefined);
    if (frozenSeedRef.current === undefined) {
        frozenSeedRef.current = seedFromSession;
    }

    const actionPointCost = useMemo(() => {
        if (!selectedGameMode) return STRATEGIC_ACTION_POINT_COST;
        if (SPECIAL_GAME_MODES.some(m => m.mode === selectedGameMode)) return STRATEGIC_ACTION_POINT_COST;
        if (PLAYFUL_GAME_MODES.some(m => m.mode === selectedGameMode)) return PLAYFUL_ACTION_POINT_COST;
        return STRATEGIC_ACTION_POINT_COST;
    }, [selectedGameMode]);

    const { isNativeMobile } = useNativeMobileShell();
    const isCompactViewport = useIsHandheldDevice(1024);
    const isMobile = isNativeMobile || isCompactViewport;
    /** 부모 모달에 끼워 넣을 때는 PC용 2열 레이아웃을 써서 한 화면에 종류+설정을 둔다 */
    const layoutMobile = isMobile && !embeddedPanel && !pairRoomEmbeddedRightSlot;
    /** PC: 캔버스(scale) 내 고정 프레임. 모바일: 뷰포트 맞춤으로 별도 레이아웃 */
    const calculatedWidth = isMobile ? 720 : 900;
    const calculatedHeight = isMobile ? 720 : 780;
    const mobileTextScale = 1.0;

    const selectedGameDefinition = useMemo(() => {
        return availableGameModes.find(mode => mode.mode === selectedGameMode);
    }, [availableGameModes, selectedGameMode]);

    // 게임 모드 변경 시 설정 초기화 (재대결 시드는 직전 대국 설정을 우선·localStorage에 동기화)
    useEffect(() => {
        if (!selectedGameMode) return;

        const seed = frozenSeedRef.current;
        if (seed && selectedGameMode === seed.mode && !seedHydratedRef.current) {
            seedHydratedRef.current = true;
            const merged = mergeSeedIntoChallengeSettings(seed.mode, seed.settings);
            setSettings(merged);
            try {
                localStorage.setItem(`preferredGameSettings_${selectedGameMode}`, JSON.stringify(merged));
            } catch (e) {
                console.error('Failed to persist AI rematch seed settings', e);
            }
            return;
        }

        const savedSettings = localStorage.getItem(`preferredGameSettings_${selectedGameMode}`);
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                if (selectedGameMode === GameMode.Alkkagi && parsed.alkkagiItemCount != null && parsed.alkkagiSlowItemCount == null && parsed.alkkagiAimingLineItemCount == null) {
                    parsed.alkkagiSlowItemCount = parsed.alkkagiItemCount;
                    parsed.alkkagiAimingLineItemCount = parsed.alkkagiItemCount;
                }
                if (parsed.mixedModes && parsed.mixedModes.includes(GameMode.Base) && parsed.mixedModes.includes(GameMode.Capture)) {
                    parsed.mixedModes = parsed.mixedModes.filter((m: GameMode) => m !== GameMode.Base);
                }
                const mergedPrefs = clampAiLobbyStrategicItemCaps(selectedGameMode, { ...DEFAULT_GAME_SETTINGS, ...parsed });
                setSettings(normalizeAiScoringTurnLimit(selectedGameMode, mergedPrefs));
            } catch {
                setSettings(
                    normalizeAiScoringTurnLimit(
                        selectedGameMode,
                        clampAiLobbyStrategicItemCaps(selectedGameMode, { ...DEFAULT_GAME_SETTINGS }),
                    ),
                );
            }
        } else {
            setSettings(
                normalizeAiScoringTurnLimit(
                    selectedGameMode,
                    clampAiLobbyStrategicItemCaps(selectedGameMode, { ...DEFAULT_GAME_SETTINGS }),
                ),
            );
        }
    }, [selectedGameMode]);

    useEffect(() => {
        if (!selectedGameMode) return;
        const boardSizeOptions = getAiChallengeBoardSizes(selectedGameMode, lobbyType);
        if (!boardSizeOptions.includes(settings.boardSize)) {
            handleSettingChange('boardSize', boardSizeOptions[0] as GameSettings['boardSize']);
        }
    }, [selectedGameMode, settings.boardSize, lobbyType]);

    useEffect(() => {
        if (hideScoringTurnLimit) return;
        if (!selectedGameMode) return;
        const requiredLimit = modeIncludesCaptureRule(selectedGameMode, settings)
            ? 0
            : getAiScoringTurnLimitByBoardSize(settings.boardSize);
        const currentLimit = settings.scoringTurnLimit ?? 0;
        if (currentLimit !== requiredLimit) {
            handleSettingChange('scoringTurnLimit', requiredLimit);
        }
    }, [hideScoringTurnLimit, selectedGameMode, settings.boardSize, settings.mixedModes, settings.scoringTurnLimit]);

    const handleSettingChange = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
        setSettings(prev => {
            let newSettings = { ...prev, [key]: value };
            if (newSettings.mixedModes) {
                const isBaseSelected = newSettings.mixedModes.includes(GameMode.Base);
                const isCaptureSelected = newSettings.mixedModes.includes(GameMode.Capture);
                if (isBaseSelected && isCaptureSelected) {
                    newSettings.mixedModes = newSettings.mixedModes.filter(m => m !== GameMode.Base);
                }
            }
            if (selectedGameMode && (key === 'boardSize' || key === 'mixedModes')) {
                newSettings = normalizeAiScoringTurnLimit(selectedGameMode, newSettings);
            }
            if (selectedGameMode) {
                newSettings = clampAiLobbyStrategicItemCaps(selectedGameMode, newSettings);
                localStorage.setItem(`preferredGameSettings_${selectedGameMode}`, JSON.stringify(newSettings));
            }
            return newSettings;
        });
    };

    const handleMixedModeChange = (subMode: GameMode, checked: boolean) => {
        setSettings(prev => {
            let nextMixed = checked
                ? [...(prev.mixedModes || []), subMode]
                : (prev.mixedModes || []).filter(m => m !== subMode);
            if (nextMixed.includes(GameMode.Base) && nextMixed.includes(GameMode.Capture)) {
                nextMixed = nextMixed.filter(m => m !== GameMode.Base);
            }
            let newSettings = normalizeAiScoringTurnLimit(selectedGameMode ?? GameMode.Mix, { ...prev, mixedModes: nextMixed });
            if (selectedGameMode) {
                newSettings = clampAiLobbyStrategicItemCaps(selectedGameMode, newSettings);
                localStorage.setItem(`preferredGameSettings_${selectedGameMode}`, JSON.stringify(newSettings));
            }
            return newSettings;
        });
    };

    // 믹스로 전환 시 mixedModes가 비어 있으면 PVP 기본과 같이 유효한 조합을 채움 (신청 화면에서 규칙 선택이 보이도록)
    useEffect(() => {
        if (selectedGameMode !== GameMode.Mix) {
            prevSelectedGameModeRef.current = selectedGameMode;
            return;
        }
        const justEnteredMix = prevSelectedGameModeRef.current !== GameMode.Mix;
        prevSelectedGameModeRef.current = selectedGameMode;
        if (!justEnteredMix) return;

        setSettings(prev => {
            if (prev.mixedModes && prev.mixedModes.length >= 2) return prev;
            const defaults = DEFAULT_GAME_SETTINGS.mixedModes?.filter(Boolean) ?? [];
            const nextMixed =
                prev.mixedModes && prev.mixedModes.length === 1
                    ? [...prev.mixedModes, defaults.find(m => !prev.mixedModes!.includes(m)) ?? GameMode.Hidden]
                    : (defaults.length >= 2 ? defaults : [GameMode.Hidden, GameMode.Speed]);
            const next = clampAiLobbyStrategicItemCaps(
                GameMode.Mix,
                normalizeAiScoringTurnLimit(GameMode.Mix, { ...prev, mixedModes: nextMixed }),
            );
            localStorage.setItem(`preferredGameSettings_${GameMode.Mix}`, JSON.stringify(next));
            return next;
        });
    }, [selectedGameMode]);

    const buildFinalSettingsForApply = useCallback((): { mode: GameMode; settings: GameSettings } | null => {
        if (!selectedGameMode) return null;
        if (selectedGameMode === GameMode.Mix && (!settings.mixedModes || settings.mixedModes.length < 2)) {
            return null;
        }
        const useClientSideAi = false;
        const timeUnlimitedSettings: Partial<GameSettings> = {
            timeLimit: 0,
            byoyomiTime: 0,
            byoyomiCount: 0,
            timeIncrement: 0,
        };
        const defaultKataWhenUnset = -12;
        const kataResolved =
            typeof settings.kataServerLevel === 'number' && Number.isFinite(settings.kataServerLevel)
                ? settings.kataServerLevel
                : defaultKataWhenUnset;
        const aiProfileStep =
            profileStepFromKataServerLevel(kataResolved) ??
            (lobbyType === 'strategic' ? 5 : (settings.goAiBotLevel ?? settings.aiDifficulty ?? 5));
        const mergedSettings: GameSettings = {
            ...settings,
            ...timeUnlimitedSettings,
            useClientSideAi,
            ...(lobbyType === 'strategic'
                ? {
                      kataServerLevel: kataResolved,
                      goAiBotLevel: aiProfileStep,
                      aiDifficulty: aiProfileStep,
                  }
                : {}),
        };
        const normalizedSettings = clampAiLobbyStrategicItemCaps(
            selectedGameMode,
            normalizeAiScoringTurnLimit(selectedGameMode, mergedSettings),
        );
        const finalSettings = transformSettingsBeforeStart
            ? transformSettingsBeforeStart(selectedGameMode, normalizedSettings)
            : normalizedSettings;
        return { mode: selectedGameMode, settings: finalSettings };
    }, [selectedGameMode, settings, transformSettingsBeforeStart, lobbyType]);

    const lastEmbeddedPushKeyRef = useRef('');
    useEffect(() => {
        if (!embeddedPanel || !configureOnly || !onConfigureApply) return;
        const built = buildFinalSettingsForApply();
        if (!built) return;
        const key = `${built.mode}\0${JSON.stringify(built.settings)}`;
        if (key === lastEmbeddedPushKeyRef.current) return;
        lastEmbeddedPushKeyRef.current = key;
        onConfigureApply(built.mode, built.settings);
    }, [embeddedPanel, configureOnly, onConfigureApply, buildFinalSettingsForApply]);

    const handleChallenge = async () => {
        if (!selectedGameMode) return;
        if (selectedGameMode === GameMode.Mix && (!settings.mixedModes || settings.mixedModes.length < 2)) {
            window.alert('믹스룰은 규칙을 2개 이상 선택해야 합니다.');
            return;
        }
        const built = buildFinalSettingsForApply();
        if (!built) return;
        const { mode, settings: finalSettings } = built;

        if (configureOnly && onConfigureApply) {
            onConfigureApply(mode, finalSettings);
            if (!embeddedPanel) onClose();
            return;
        }
        if (!onAction) return;
        await onAction({
            type: startActionType,
            payload: {
                mode,
                settings: finalSettings,
            },
        } as ServerAction);
        onClose();
    };

    // 게임 모드별 설정 UI 렌더링
    const renderGameSettings = () => {
        if (!selectedGameMode) {
            if (pairRoomEmbeddedRightSlot) {
                return <div className="min-h-[4.5rem]" aria-hidden />;
            }
            return (
                <div className="text-center text-gray-400 py-8">
                    좌측에서 게임 종류를 선택하세요
                </div>
            );
        }

        const showBoardSize = ![GameMode.Alkkagi, GameMode.Curling, GameMode.Dice].includes(selectedGameMode);
        const showKomi = ![GameMode.Capture, GameMode.Omok, GameMode.Ttamok, GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Thief, GameMode.Base].includes(selectedGameMode);
        // AI 대국은 모두 시간 무제한이므로, 제한시간/초읽기 관련 UI는 항상 숨긴다.
        const showTimeControls = false;
        const showCaptureTarget = selectedGameMode === GameMode.Capture;
        const showTtamokCaptureTarget = selectedGameMode === GameMode.Ttamok;
        const showBaseStones = selectedGameMode === GameMode.Base;
        const showHiddenStones = selectedGameMode === GameMode.Hidden;
        const showMissileCount = selectedGameMode === GameMode.Missile;
        const showMixModeSelection = selectedGameMode === GameMode.Mix;
        const showDiceGoSettings = selectedGameMode === GameMode.Dice;
        const showAlkkagiSettings = selectedGameMode === GameMode.Alkkagi;
        const showCurlingSettings = selectedGameMode === GameMode.Curling;
        const showThiefSettings = selectedGameMode === GameMode.Thief;
        // 도둑과 경찰은 역할 설정으로 대체되므로 순서 설정에서 제외
        const showPlayerColor = [GameMode.Dice, GameMode.Alkkagi, GameMode.Curling].includes(selectedGameMode);
        const showOmokForbiddenRules = selectedGameMode === GameMode.Omok;
        const showTtamokForbiddenRules = selectedGameMode === GameMode.Ttamok;

        const showGoAiLevel = lobbyType === 'strategic' && !pairRoomHideGoAiLevel;
        const captureRuleSelected = modeIncludesCaptureRule(selectedGameMode, settings);
        const showScoringTurnLimit = !hideScoringTurnLimit && showGoAiLevel && !captureRuleSelected;

        const AI_LEVELS = [
            { value: -31, label: '1단계' },
            { value: -25, label: '2단계' },
            { value: -21, label: '3단계' },
            { value: -15, label: '4단계' },
            { value: -12, label: '5단계' },
            { value: -8,  label: '6단계' },
            { value: -3,  label: '7단계' },
            { value: -1,  label: '8단계' },
            { value: 3,   label: '9단계' },
            { value: 5,   label: '10단계' },
        ];

        const boardSizeOptions = selectedGameMode != null ? getAiChallengeBoardSizes(selectedGameMode, lobbyType) : BOARD_SIZES;
        const requiredScoringTurnLimit = getAiScoringTurnLimitByBoardSize(settings.boardSize);
        const scoringTurnLimitOptions = getScoringTurnLimitOptionsByBoardSize(settings.boardSize);
        const nonZeroScoringTurnLimitOptions = scoringTurnLimitOptions.includes(requiredScoringTurnLimit)
            ? [requiredScoringTurnLimit]
            : [requiredScoringTurnLimit];

        const defaultSettingRowClass = 'grid grid-cols-2 gap-2 items-center';
        const settingRowClass = pairRoomDenseSettingsGrid ? PAIR_LOBBY_DENSE_SETTING_ROW_CLASS : defaultSettingRowClass;

        return (
            <div
                className={
                    pairRoomDenseSettingsGrid
                        ? pairRoomEmbeddedRightSlot
                            ? 'grid w-full min-h-0 auto-rows-min min-w-0 content-center justify-center gap-x-2.5 gap-y-2 overflow-y-auto pr-1 grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(14rem,14rem))] [&>div]:min-w-0'
                            : 'grid h-full auto-rows-min min-w-0 justify-center gap-x-2.5 gap-y-2 overflow-y-auto pr-1 grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(14rem,14rem))] [&>div]:min-w-0'
                        : 'flex h-full flex-col gap-2 overflow-y-auto pr-2'
                }
            >
                {showGoAiLevel && (
                    <div className={settingRowClass}>
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>AI단계</label>
                        <select
                            value={settings.kataServerLevel ?? -12}
                            onChange={e => handleSettingChange('kataServerLevel', parseInt(e.target.value, 10))}
                            className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            {AI_LEVELS.map(({ value, label }) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                )}

                {showBoardSize && (
                    <div className={settingRowClass}>
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>판 크기</label>
                        <select 
                            value={settings.boardSize} 
                            onChange={e => handleSettingChange('boardSize', parseInt(e.target.value, 10) as GameSettings['boardSize'])}
                            className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            {boardSizeOptions.map(size => (
                                <option key={size} value={size}>{size}줄</option>
                            ))}
                        </select>
                    </div>
                )}

                {showScoringTurnLimit && (
                    <div className={settingRowClass}>
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>계가까지 턴</label>
                        <select 
                            value={requiredScoringTurnLimit}
                            onChange={e => handleSettingChange('scoringTurnLimit', parseInt(e.target.value, 10))}
                            disabled
                            className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            {nonZeroScoringTurnLimitOptions.map(limit => (
                                <option key={limit} value={limit}>
                                    {`${limit}수`}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {showMixModeSelection && (() => {
                    const isBaseSelected = settings.mixedModes?.includes(GameMode.Base);
                    const isCaptureSelected = settings.mixedModes?.includes(GameMode.Capture);
                    const mixEmbedCompactHeader = pairRoomDenseSettingsGrid && pairRoomEmbeddedRightSlot;
                    const mixCheckboxes = SPECIAL_GAME_MODES.filter(
                        (m) => m.mode !== GameMode.Standard && m.mode !== GameMode.Mix,
                    ).map((m) => {
                        const isDisabledByConflict =
                            (m.mode === GameMode.Base && isCaptureSelected) ||
                            (m.mode === GameMode.Capture && isBaseSelected);
                        return (
                            <label
                                key={m.mode}
                                className={`flex items-center gap-1.5 rounded-md text-gray-200 ${
                                    pairRoomDenseSettingsGrid
                                        ? `h-7 shrink-0 flex-nowrap whitespace-nowrap py-0.5 pl-1 pr-1.5 sm:gap-2 sm:pl-1.5 sm:pr-2 ${isDisabledByConflict ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} bg-gray-700/50`
                                        : `gap-2 p-2 ${isDisabledByConflict ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} bg-gray-700/50`
                                }`}
                                style={{
                                    fontSize: pairRoomDenseSettingsGrid
                                        ? `${Math.max(10, Math.round(11 * mobileTextScale))}px`
                                        : `${Math.max(12, Math.round(14 * mobileTextScale))}px`,
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={settings.mixedModes?.includes(m.mode) ?? false}
                                    onChange={(e) => handleMixedModeChange(m.mode, e.target.checked)}
                                    disabled={isDisabledByConflict}
                                    className={`flex-shrink-0 ${pairRoomDenseSettingsGrid ? 'h-3.5 w-3.5 sm:h-4 sm:w-4' : 'h-4 w-4'}`}
                                />
                                <span className="leading-tight">{m.name}</span>
                            </label>
                        );
                    });
                    return (
                        <div
                            className={`w-full border-t border-gray-700 ${pairRoomDenseSettingsGrid ? 'col-span-full mt-1 space-y-2 pt-2' : 'mt-1 space-y-3 pt-3'}`}
                        >
                            {mixEmbedCompactHeader ? (
                                <div className="min-w-0 space-y-1">
                                    <h3
                                        className="mb-0 font-semibold leading-tight text-gray-300"
                                        style={{ fontSize: `${Math.max(12, Math.round(13 * mobileTextScale))}px` }}
                                    >
                                        믹스룰 (2개 이상)
                                    </h3>
                                    <div className="flex min-h-[1.75rem] min-w-0 flex-nowrap gap-1 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                        {mixCheckboxes}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className={pairRoomDenseSettingsGrid ? 'flex flex-wrap items-end gap-x-2 gap-y-1' : ''}>
                                        <h3
                                            className={`font-semibold text-gray-300 ${pairRoomDenseSettingsGrid ? 'mb-0 shrink-0 leading-none' : 'mb-1'}`}
                                            style={{ fontSize: `${Math.max(14, Math.round(16 * mobileTextScale))}px` }}
                                        >
                                            믹스룰 조합 (2개 이상 선택)
                                        </h3>
                                        {!pairRoomEmbeddedRightSlot ? (
                                            <p className="text-gray-500 text-xs leading-snug">
                                                PVP 신청 화면과 같이, 함께 적용할 규칙을 고릅니다. (클래식 바둑은 기본으로 포함됩니다.)
                                            </p>
                                        ) : null}
                                    </div>
                                    <div
                                        className={
                                            pairRoomDenseSettingsGrid
                                                ? 'flex min-w-0 flex-nowrap gap-1 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
                                                : 'grid grid-cols-2 gap-2 text-sm'
                                        }
                                    >
                                        {mixCheckboxes}
                                    </div>
                                </>
                            )}
                            {pairRoomDenseSettingsGrid ? (
                                <div className="grid min-w-0 grid-cols-2 gap-2">
                                    {settings.mixedModes?.includes(GameMode.Base) && (
                                        <div className={settingRowClass}>
                                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>베이스돌 개수</label>
                                            <select
                                                value={settings.baseStones}
                                                onChange={(e) => handleSettingChange('baseStones', parseInt(e.target.value, 10))}
                                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                            >
                                                {AI_CHALLENGE_BASE_STONE_COUNTS.map((c) => (
                                                    <option key={c} value={c}>
                                                        {c}개
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {settings.mixedModes?.includes(GameMode.Hidden) && (
                                        <>
                                            <div className={settingRowClass}>
                                                <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>히든돌 개수</label>
                                                <select
                                                    value={settings.hiddenStoneCount}
                                                    onChange={(e) => handleSettingChange('hiddenStoneCount', parseInt(e.target.value, 10))}
                                                    className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                                    style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                                >
                                                    {AI_CHALLENGE_HIDDEN_STONE_COUNTS.map((c) => (
                                                        <option key={c} value={c}>
                                                            {c}개
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className={settingRowClass}>
                                                <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>스캔 개수</label>
                                                <select
                                                    value={settings.scanCount ?? AI_LOBBY_SCAN_MAX}
                                                    onChange={(e) => handleSettingChange('scanCount', parseInt(e.target.value, 10))}
                                                    className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                                    style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                                >
                                                    {AI_CHALLENGE_SCAN_COUNTS.map((c) => (
                                                        <option key={c} value={c}>
                                                            {c}개
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </>
                                    )}
                                    {settings.mixedModes?.includes(GameMode.Missile) && (
                                        <div className={settingRowClass}>
                                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>미사일 개수</label>
                                            <select
                                                value={settings.missileCount ?? 3}
                                                onChange={(e) => handleSettingChange('missileCount', parseInt(e.target.value, 10))}
                                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                            >
                                                {AI_CHALLENGE_MISSILE_COUNTS.map((c) => (
                                                    <option key={c} value={c}>
                                                        {c}개
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {settings.mixedModes?.includes(GameMode.Capture) && (
                                        <div className={settingRowClass}>
                                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>목표점수</label>
                                            <select
                                                value={settings.captureTarget}
                                                onChange={(e) => handleSettingChange('captureTarget', parseInt(e.target.value, 10))}
                                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                            >
                                                {CAPTURE_TARGETS.map((t) => (
                                                    <option key={t} value={t}>
                                                        {t}개
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {settings.mixedModes && settings.mixedModes.length < 2 ? (
                                        <p className="col-span-2 text-amber-300/90 text-xs">규칙을 2개 이상 선택해 주세요.</p>
                                    ) : null}
                                </div>
                            ) : (
                                <>
                                    {settings.mixedModes?.includes(GameMode.Base) && (
                                        <div className={settingRowClass}>
                                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>베이스돌 개수</label>
                                            <select
                                                value={settings.baseStones}
                                                onChange={(e) => handleSettingChange('baseStones', parseInt(e.target.value, 10))}
                                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                            >
                                                {AI_CHALLENGE_BASE_STONE_COUNTS.map((c) => (
                                                    <option key={c} value={c}>
                                                        {c}개
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {settings.mixedModes?.includes(GameMode.Hidden) && (
                                        <>
                                            <div className={settingRowClass}>
                                                <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>히든돌 개수</label>
                                                <select
                                                    value={settings.hiddenStoneCount}
                                                    onChange={(e) => handleSettingChange('hiddenStoneCount', parseInt(e.target.value, 10))}
                                                    className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                                    style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                                >
                                                    {AI_CHALLENGE_HIDDEN_STONE_COUNTS.map((c) => (
                                                        <option key={c} value={c}>
                                                            {c}개
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className={settingRowClass}>
                                                <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>스캔 개수</label>
                                                <select
                                                    value={settings.scanCount ?? AI_LOBBY_SCAN_MAX}
                                                    onChange={(e) => handleSettingChange('scanCount', parseInt(e.target.value, 10))}
                                                    className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                                    style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                                >
                                                    {AI_CHALLENGE_SCAN_COUNTS.map((c) => (
                                                        <option key={c} value={c}>
                                                            {c}개
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </>
                                    )}
                                    {settings.mixedModes?.includes(GameMode.Missile) && (
                                        <div className={settingRowClass}>
                                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>미사일 개수</label>
                                            <select
                                                value={settings.missileCount ?? 3}
                                                onChange={(e) => handleSettingChange('missileCount', parseInt(e.target.value, 10))}
                                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                            >
                                                {AI_CHALLENGE_MISSILE_COUNTS.map((c) => (
                                                    <option key={c} value={c}>
                                                        {c}개
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {settings.mixedModes?.includes(GameMode.Capture) && (
                                        <div className={settingRowClass}>
                                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>목표점수</label>
                                            <select
                                                value={settings.captureTarget}
                                                onChange={(e) => handleSettingChange('captureTarget', parseInt(e.target.value, 10))}
                                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                            >
                                                {CAPTURE_TARGETS.map((t) => (
                                                    <option key={t} value={t}>
                                                        {t}개
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {settings.mixedModes && settings.mixedModes.length < 2 ? (
                                        <p className="text-amber-300/90 text-xs">규칙을 2개 이상 선택해 주세요.</p>
                                    ) : null}
                                </>
                            )}
                        </div>
                    );
                })()}

                {showKomi && (
                    <div className={settingRowClass}>
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>덤 (백)</label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                step="1" 
                                min={0}
                                max={MAX_GAME_INTEGER_INPUT}
                                value={Math.floor(settings.komi)} 
                                onChange={(e) =>
                                    handleSettingChange(
                                        'komi',
                                        clampGameInt(parseInt(e.target.value, 10) || 0, { min: 0, max: MAX_GAME_INTEGER_INPUT }) + 0.5,
                                    )
                                }
                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            />
                            <span className="font-bold text-gray-300 whitespace-nowrap" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>.5 집</span>
                        </div>
                    </div>
                )}

                {showTimeControls && (
                    <>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>제한 시간</label>
                            <select 
                                value={settings.timeLimit} 
                                onChange={e => handleSettingChange('timeLimit', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {TIME_LIMITS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>초읽기</label>
                            <div className="flex gap-2">
                                <select 
                                    value={settings.byoyomiTime} 
                                    onChange={e => handleSettingChange('byoyomiTime', parseInt(e.target.value))}
                                    className="flex-1 bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
                                    style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                >
                                    {BYOYOMI_TIMES.map(t => <option key={t} value={t}>{t}초</option>)}
                                </select>
                                <select 
                                    value={settings.byoyomiCount} 
                                    onChange={e => handleSettingChange('byoyomiCount', parseInt(e.target.value))}
                                    className="flex-1 bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2"
                                    style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                >
                                    {BYOYOMI_COUNTS.map(c => <option key={c} value={c}>{c}회</option>)}
                                </select>
                            </div>
                        </div>
                    </>
                )}

                {showCaptureTarget && (
                    <div className={settingRowClass}>
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>포획 목표</label>
                        <select 
                            value={settings.captureTarget} 
                            onChange={e => handleSettingChange('captureTarget', parseInt(e.target.value))}
                            className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            {CAPTURE_TARGETS.map(t => <option key={t} value={t}>{t}점</option>)}
                        </select>
                    </div>
                )}

                {showTtamokCaptureTarget && (
                    <div className={settingRowClass}>
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>포획 목표</label>
                        <select 
                            value={settings.captureTarget || 5} 
                            onChange={e => handleSettingChange('captureTarget', parseInt(e.target.value))}
                            className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            {TTAMOK_CAPTURE_TARGETS.map(t => <option key={t} value={t}>{t}점</option>)}
                        </select>
                    </div>
                )}

                {showOmokForbiddenRules && (
                    <>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>삼삼 금지</label>
                            <input 
                                type="checkbox" 
                                checked={settings.has33Forbidden ?? true} 
                                onChange={e => handleSettingChange('has33Forbidden', e.target.checked)} 
                                className="w-5 h-5"
                            />
                        </div>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>육목 이상 금지</label>
                            <input 
                                type="checkbox" 
                                checked={settings.hasOverlineForbidden ?? true} 
                                onChange={e => handleSettingChange('hasOverlineForbidden', e.target.checked)} 
                                className="w-5 h-5"
                            />
                        </div>
                    </>
                )}

                {showTtamokForbiddenRules && (
                    <>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>삼삼 금지</label>
                            <input 
                                type="checkbox" 
                                checked={settings.has33Forbidden ?? true} 
                                onChange={e => handleSettingChange('has33Forbidden', e.target.checked)} 
                                className="w-5 h-5"
                            />
                        </div>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>육목 이상 금지</label>
                            <input 
                                type="checkbox" 
                                checked={settings.hasOverlineForbidden ?? true} 
                                onChange={e => handleSettingChange('hasOverlineForbidden', e.target.checked)} 
                                className="w-5 h-5"
                            />
                        </div>
                    </>
                )}

                {showPlayerColor && !pairRoomHidePlayerOrderRole && (
                    <div className={settingRowClass}>
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>순서</label>
                        <select 
                            value={settings.player1Color === Player.Black ? 'black' : settings.player1Color === Player.White ? 'white' : 'random'} 
                            onChange={e => {
                                if (e.target.value === 'black') {
                                    handleSettingChange('player1Color', Player.Black);
                                } else if (e.target.value === 'white') {
                                    handleSettingChange('player1Color', Player.White);
                                } else {
                                    handleSettingChange('player1Color', undefined);
                                }
                            }}
                            className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            <option value="random">랜덤</option>
                            <option value="black">{selectedGameMode === GameMode.Dice ? '선공' : '선공 (흑)'}</option>
                            <option value="white">{selectedGameMode === GameMode.Dice ? '후공' : '후공 (백)'}</option>
                        </select>
                    </div>
                )}

                {showThiefSettings && (
                    <>
                    {!pairRoomHidePlayerOrderRole ? (
                    <div className={settingRowClass}>
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>역할</label>
                        <select 
                            value={settings.player1Color === Player.Black ? 'thief' : settings.player1Color === Player.White ? 'police' : 'random'} 
                            onChange={e => {
                                if (e.target.value === 'thief') {
                                    handleSettingChange('player1Color', Player.Black);
                                } else if (e.target.value === 'police') {
                                    handleSettingChange('player1Color', Player.White);
                                } else {
                                    handleSettingChange('player1Color', undefined);
                                }
                            }}
                            className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            <option value="random">랜덤</option>
                            <option value="thief">도둑 (흑)</option>
                            <option value="police">경찰 (백)</option>
                        </select>
                    </div>
                    ) : null}
                    <div className={settingRowClass}>
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>특수주사위</label>
                        <select
                            value={getThiefUnifiedSpecialDiceCount(settings)}
                            onChange={e => {
                                const count = parseInt(e.target.value, 10);
                                setSettings((prev) => {
                                    let newSettings = { ...prev, ...thiefUnifiedSpecialDiceCounts(count) };
                                    if (newSettings.mixedModes) {
                                        const isBaseSelected = newSettings.mixedModes.includes(GameMode.Base);
                                        const isCaptureSelected = newSettings.mixedModes.includes(GameMode.Capture);
                                        if (isBaseSelected && isCaptureSelected) {
                                            newSettings.mixedModes = newSettings.mixedModes.filter((m) => m !== GameMode.Base);
                                        }
                                    }
                                    if (selectedGameMode) {
                                        newSettings = clampAiLobbyStrategicItemCaps(selectedGameMode, newSettings);
                                        localStorage.setItem(
                                            `preferredGameSettings_${selectedGameMode}`,
                                            JSON.stringify(newSettings),
                                        );
                                    }
                                    return newSettings;
                                });
                            }}
                            className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            {DICE_GO_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개 (유형당)</option>)}
                        </select>
                    </div>
                    </>
                )}

                {showBaseStones && (
                    <div className={settingRowClass}>
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>베이스 돌</label>
                        <select 
                            value={settings.baseStones} 
                            onChange={e => handleSettingChange('baseStones', parseInt(e.target.value))}
                            className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            {AI_CHALLENGE_BASE_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                        </select>
                    </div>
                )}

                {showHiddenStones && (
                    <>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>히든아이템</label>
                            <select 
                                value={settings.hiddenStoneCount} 
                                onChange={e => handleSettingChange('hiddenStoneCount', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {AI_CHALLENGE_HIDDEN_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>스캔아이템</label>
                            <select 
                                value={settings.scanCount || AI_LOBBY_SCAN_MAX} 
                                onChange={e => handleSettingChange('scanCount', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {AI_CHALLENGE_SCAN_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                    </>
                )}

                {showMissileCount && (
                    <div className={settingRowClass}>
                        <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>미사일 개수</label>
                        <select 
                            value={settings.missileCount || 3} 
                            onChange={e => handleSettingChange('missileCount', parseInt(e.target.value))}
                            className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            {AI_CHALLENGE_MISSILE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                        </select>
                    </div>
                )}

                {showDiceGoSettings && (
                    <>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>라운드</label>
                            <select 
                                value={settings.diceGoRounds ?? 3} 
                                onChange={e => handleSettingChange('diceGoRounds', parseInt(e.target.value, 10) as 1 | 2 | 3)}
                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {[1, 2, 3].map(r => <option key={r} value={r}>{r}라운드</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>특수주사위</label>
                            <select 
                                value={getDiceGoUnifiedSpecialDiceCount(settings)} 
                                onChange={e => {
                                    const count = parseInt(e.target.value, 10);
                                    setSettings((prev) => {
                                        let newSettings = { ...prev, ...diceGoUnifiedSpecialDiceCounts(count) };
                                        if (newSettings.mixedModes) {
                                            const isBaseSelected = newSettings.mixedModes.includes(GameMode.Base);
                                            const isCaptureSelected = newSettings.mixedModes.includes(GameMode.Capture);
                                            if (isBaseSelected && isCaptureSelected) {
                                                newSettings.mixedModes = newSettings.mixedModes.filter((m) => m !== GameMode.Base);
                                            }
                                        }
                                        if (selectedGameMode) {
                                            newSettings = clampAiLobbyStrategicItemCaps(selectedGameMode, newSettings);
                                            localStorage.setItem(
                                                `preferredGameSettings_${selectedGameMode}`,
                                                JSON.stringify(newSettings),
                                            );
                                        }
                                        return newSettings;
                                    });
                                }}
                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {DICE_GO_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개 (유형당)</option>)}
                            </select>
                        </div>
                    </>
                )}

                {showAlkkagiSettings && (
                    <>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>돌 개수</label>
                            <select 
                                value={settings.alkkagiStoneCount ?? 5} 
                                onChange={e => handleSettingChange('alkkagiStoneCount', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {ALKKAGI_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>라운드</label>
                            <select 
                                value={settings.alkkagiRounds ?? 3} 
                                onChange={e => handleSettingChange('alkkagiRounds', parseInt(e.target.value) as 1 | 2 | 3)}
                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {ALKKAGI_ROUNDS.map(r => <option key={r} value={r}>{r}라운드</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>배치 방식</label>
                            <select 
                                value={settings.alkkagiPlacementType ?? AlkkagiPlacementType.TurnByTurn} 
                                onChange={e => handleSettingChange('alkkagiPlacementType', e.target.value as AlkkagiPlacementType)}
                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {Object.values(AlkkagiPlacementType).map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>힘 속도</label>
                            <select 
                                value={settings.alkkagiGaugeSpeed ?? 700} 
                                onChange={e => handleSettingChange('alkkagiGaugeSpeed', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {ALKKAGI_GAUGE_SPEEDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>슬로우</label>
                            <select 
                                value={settings.alkkagiSlowItemCount ?? 2} 
                                onChange={e => handleSettingChange('alkkagiSlowItemCount', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {ALKKAGI_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>조준선</label>
                            <select 
                                value={settings.alkkagiAimingLineItemCount ?? 2} 
                                onChange={e => handleSettingChange('alkkagiAimingLineItemCount', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {ALKKAGI_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                    </>
                )}

                {showCurlingSettings && (
                    <>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>돌 개수</label>
                            <select 
                                value={settings.curlingStoneCount ?? 5} 
                                onChange={e => handleSettingChange('curlingStoneCount', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {CURLING_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>라운드</label>
                            <select 
                                value={settings.curlingRounds ?? 3} 
                                onChange={e => handleSettingChange('curlingRounds', parseInt(e.target.value) as 1 | 2 | 3)}
                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {CURLING_ROUNDS.map(r => <option key={r} value={r}>{r}라운드</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>힘 속도</label>
                            <select 
                                value={settings.curlingGaugeSpeed ?? 700} 
                                onChange={e => handleSettingChange('curlingGaugeSpeed', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {CURLING_GAUGE_SPEEDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>슬로우</label>
                            <select 
                                value={settings.curlingSlowItemCount ?? 2} 
                                onChange={e => handleSettingChange('curlingSlowItemCount', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {CURLING_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className="font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>조준선</label>
                            <select 
                                value={settings.curlingAimingLineItemCount ?? 2} 
                                onChange={e => handleSettingChange('curlingAimingLineItemCount', parseInt(e.target.value))}
                                className="w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2"
                                style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                            >
                                {CURLING_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                    </>
                )}
            </div>
        );
    };

    const opponentSubtitle = selectedGameDefinition ? `${selectedGameDefinition.name} 봇` : '게임 종류를 선택하세요';

    const mobileHeaderBack =
        layoutMobile && mobileStep === 'settings' ? (
            <button
                type="button"
                className={LOBBY_MOBILE_HEADER_BACK_BTN_CLASS}
                onClick={(e) => {
                    e.stopPropagation();
                    setMobileStep('pickMode');
                }}
            >
                뒤로
            </button>
        ) : undefined;

    const embeddedShellClass =
        'flex min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-violet-400/40 bg-gradient-to-br from-zinc-900/95 via-zinc-950/98 to-black/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-violet-500/15';

    const desktopModePickerInner = (
        <>
            <h3
                className="mb-3 shrink-0 font-bold text-purple-300"
                style={{ fontSize: `${Math.max(15, Math.round(19 * mobileTextScale))}px` }}
            >
                게임 종류 선택
            </h3>
            <div className="grid min-h-0 flex-1 touch-pan-y grid-cols-2 gap-2 overflow-y-auto overscroll-y-contain pr-2 [-webkit-overflow-scrolling:touch]">
                {availableGameModes.map((game) => (
                    <GameCard
                        key={game.mode}
                        mode={game.mode}
                        image={game.image}
                        displayName={game.name ?? String(game.mode)}
                        onSelect={setSelectedGameMode}
                        isSelected={selectedGameMode === game.mode}
                    />
                ))}
            </div>
        </>
    );

    const desktopGameSettingsBlock = (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {!(pairRoomDenseSettingsGrid && pairRoomEmbeddedRightSlot) ? (
                <h4
                    className="mb-2 flex-shrink-0 font-semibold text-gray-300"
                    style={{ fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                >
                    대국 설정
                </h4>
            ) : null}
            <div
                className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 ${
                    pairRoomDenseSettingsGrid && pairRoomEmbeddedRightSlot ? 'flex flex-col justify-center' : ''
                }`}
            >
                {renderGameSettings()}
            </div>
        </div>
    );

    const innerBody = layoutMobile ? (
                <div
                    className="relative flex min-h-0 max-h-[min(94dvh,880px)] flex-1 flex-col gap-2 overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-zinc-900/92 via-zinc-950/96 to-black/95 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_24px_64px_-28px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06] sm:gap-3 sm:p-3"
                >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" aria-hidden />
                    {/* 상대(AI) 프로필 — 항상 표시 */}
                    <div className="relative z-[1] shrink-0 rounded-xl border border-purple-500/35 bg-gray-900/65 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        <div className="flex items-start gap-2.5">
                            <Avatar userId={aiUserId} userName="AI" size={52} className="shrink-0 border-2 border-purple-500" />
                            <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-purple-200 text-base leading-tight">AI</h3>
                                <p className="text-xs text-gray-400 mt-0.5 leading-snug">{opponentSubtitle}</p>
                                {selectedGameDefinition ? (
                                    <div className="mt-2 border-t border-white/10 pt-2">
                                        <p className="text-[11px] font-semibold text-gray-400 mb-0.5">게임 설명</p>
                                        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-4">
                                            {selectedGameDefinition.description || '선택된 게임에 대한 설명이 없습니다.'}
                                        </p>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    {mobileStep === 'pickMode' ? (
                        <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                            <h3 className="shrink-0 text-sm font-bold tracking-tight text-amber-100/95">게임 종류 선택</h3>
                            <p className="shrink-0 text-[11px] leading-snug text-zinc-500">항목을 눌러 선택한 뒤 아래에서 대국 설정으로 이동하세요.</p>
                            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pr-0.5 -mr-0.5">
                                <div className="grid grid-cols-2 gap-2 pb-1">
                                    {availableGameModes.map((game) => (
                                        <GameCard
                                            key={game.mode}
                                            mode={game.mode}
                                            image={game.image}
                                            displayName={game.name ?? String(game.mode)}
                                            onSelect={setSelectedGameMode}
                                            isSelected={selectedGameMode === game.mode}
                                            compact
                                        />
                                    ))}
                                </div>
                            </div>
                            <div
                                className={`shrink-0 -mx-2 -mb-2 mt-1 flex flex-col gap-2.5 rounded-b-2xl sm:-mx-3 sm:-mb-3 ${LOBBY_MOBILE_MODAL_FOOTER_CLASS}`}
                            >
                                <Button
                                    bare
                                    colorScheme="none"
                                    onClick={() => setMobileStep('settings')}
                                    disabled={!selectedGameMode}
                                    className={`${LOBBY_MOBILE_BTN_PRIMARY_CLASS} ${!selectedGameMode ? '!cursor-not-allowed !opacity-45 !hover:brightness-100' : ''}`}
                                >
                                    다음 — 대국 설정
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                            <h3 className="shrink-0 text-sm font-bold tracking-tight text-amber-100/95">대국 설정</h3>
                            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pr-1 -mr-0.5 rounded-lg border border-white/5 bg-black/20 p-1.5">
                                {renderGameSettings()}
                            </div>
                            <div
                                className={`shrink-0 -mx-2 -mb-2 mt-1 flex flex-col gap-2.5 rounded-b-2xl sm:flex-row sm:-mx-3 sm:-mb-3 ${LOBBY_MOBILE_MODAL_FOOTER_CLASS}`}
                            >
                                <Button
                                    bare
                                    colorScheme="none"
                                    onClick={onClose}
                                    className={LOBBY_MOBILE_BTN_SECONDARY_CLASS}
                                >
                                    취소
                                </Button>
                                <Button
                                    bare
                                    colorScheme="none"
                                    onClick={handleChallenge}
                                    disabled={!selectedGameMode}
                                    className={`${LOBBY_MOBILE_BTN_PRIMARY_CLASS} sm:flex-[1.35] ${!selectedGameMode ? '!cursor-not-allowed !opacity-45 !hover:brightness-100' : ''}`}
                                >
                                    {showActionPointCost ? `${submitLabel} (⚡${actionPointCost})` : submitLabel}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex h-full">
                    <div className="flex w-1/3 min-w-0 flex-col rounded-l-lg border-r border-gray-700 bg-tertiary/30 p-4 text-on-panel">
                        {desktopModePickerInner}
                    </div>

                    <div className="flex w-2/3 min-w-0 flex-col rounded-r-lg bg-primary p-4">
                        {!(embeddedPanel && configureOnly) ? (
                            <div className="mb-4 flex-shrink-0 rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                                <div className="mb-3 flex items-center gap-3">
                                    <Avatar userId={aiUserId} userName="AI" size={54} className="border-2 border-purple-500" />
                                    <div>
                                        <h3
                                            className="font-bold text-purple-300"
                                            style={{ fontSize: `${Math.max(15, Math.round(19 * mobileTextScale))}px` }}
                                        >
                                            AI
                                        </h3>
                                        <p className="text-gray-400" style={{ fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>
                                            {selectedGameDefinition ? `${selectedGameDefinition.name} 봇` : 'AI 봇'}
                                        </p>
                                    </div>
                                </div>
                                {selectedGameDefinition && (
                                    <div className="mt-3 border-t border-gray-700 pt-3">
                                        <h4
                                            className="mb-2 font-semibold text-gray-300"
                                            style={{ fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                                        >
                                            게임 설명
                                        </h4>
                                        <p
                                            className="text-tertiary leading-relaxed"
                                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                        >
                                            {selectedGameDefinition.description || '선택된 게임에 대한 설명이 없습니다.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : null}

                        {desktopGameSettingsBlock}

                        {!(embeddedPanel && configureOnly) ? (
                            <div className="mt-4 flex flex-shrink-0 justify-end gap-3 border-t border-gray-700 pt-4">
                                <Button
                                    onClick={onClose}
                                    colorScheme="gray"
                                    className="min-h-[2.75rem] px-5 py-2.5 font-semibold"
                                    style={{ fontSize: `${Math.max(15, Math.round(17 * mobileTextScale))}px` }}
                                >
                                    취소
                                </Button>
                                <Button
                                    onClick={handleChallenge}
                                    colorScheme="purple"
                                    disabled={!selectedGameMode}
                                    className="min-h-[2.75rem] px-5 py-2.5 font-semibold"
                                    style={{ fontSize: `${Math.max(15, Math.round(17 * mobileTextScale))}px` }}
                                >
                                    {showActionPointCost ? `${submitLabel} (⚡${actionPointCost})` : submitLabel}
                                </Button>
                            </div>
                        ) : null}
                    </div>
                </div>
            );

    if (embeddedPanel && configureOnly && pairRoomEmbeddedRightSlot) {
        const handheldStackedCreate = pairRoomHandheldCreateStackedFooter && isMobile;
        const handheldPairCreateFooterClass =
            'grid shrink-0 grid-cols-2 gap-1.5 border-t border-white/10 bg-black/50 px-3 pt-2 pb-[max(0.65rem,env(safe-area-inset-bottom))]';
        const handheldStackedFooterBtn =
            '!justify-center rounded-xl !py-2 !text-xs disabled:cursor-not-allowed disabled:opacity-60';
        const showPairEmbeddedColumnFooter =
            Boolean(pairRoomEmbeddedColumnFooter) && !(handheldStackedCreate && pairEmbedMobileStep === 'game');

        if (handheldStackedCreate) {
            return (
                <div className={`${embeddedShellClass} flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden`}>
                    {pairEmbedMobileStep === 'game' ? (
                        <>
                            <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-gray-700 bg-tertiary/30 p-2.5 text-on-panel sm:p-4">
                                <h3 className="mb-1.5 shrink-0 text-xs font-bold tracking-tight text-amber-100/95 sm:text-base">
                                    게임 종류 선택
                                </h3>
                                <p className="mb-1.5 shrink-0 text-[10px] leading-snug text-zinc-500">
                                    항목을 눌러 선택한 뒤 다음으로 이동하세요.
                                </p>
                                <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
                                    <div className="grid grid-cols-2 gap-1.5 pb-0.5">
                                        {availableGameModes.map((game) => (
                                            <GameCard
                                                key={game.mode}
                                                mode={game.mode}
                                                image={game.image}
                                                displayName={game.name ?? String(game.mode)}
                                                onSelect={setSelectedGameMode}
                                                isSelected={selectedGameMode === game.mode}
                                                compact
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className={handheldPairCreateFooterClass}>
                                <Button
                                    type="button"
                                    colorScheme="none"
                                    disabled={pairRoomHandheldBusy}
                                    onClick={() => onPairRoomHandheldCancel?.()}
                                    className={`${handheldStackedFooterBtn} border border-white/20 bg-zinc-800/60 !font-bold !text-zinc-200`}
                                >
                                    취소
                                </Button>
                                <Button
                                    type="button"
                                    colorScheme="none"
                                    disabled={pairRoomHandheldBusy || !selectedGameMode}
                                    onClick={() => setPairEmbedMobileStep('details')}
                                    className={`${handheldStackedFooterBtn} border border-violet-400/50 bg-violet-900/55 !font-extrabold !text-violet-50`}
                                >
                                    다음
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                            <div className="flex shrink-0 items-center gap-1.5 border-b border-white/10 bg-black/30 px-2.5 py-1.5">
                                <button type="button" className={LOBBY_MOBILE_HEADER_BACK_BTN_CLASS} onClick={() => setPairEmbedMobileStep('game')}>
                                    뒤로
                                </button>
                                <span className="min-w-0 flex-1 text-xs font-extrabold leading-tight text-cyan-100">
                                    방 정보·대국 설정
                                </span>
                            </div>
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
                                    {pairRoomEmbeddedRightSlot(desktopGameSettingsBlock)}
                                </div>
                                {showPairEmbeddedColumnFooter ? (
                                    <div className={handheldPairCreateFooterClass}>{pairRoomEmbeddedColumnFooter}</div>
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div className={`${embeddedShellClass} min-h-0 flex-1`}>
                <div className="flex min-h-0 min-w-0 max-h-[min(78vh,740px)] flex-1 flex-col overflow-hidden lg:max-h-[min(82vh,760px)] lg:flex-row">
                    {/* 모바일 세로 레이아웃: shrink-0만 있으면 열 높이가 콘텐츠 전체로 늘어나 overflow-y-auto가 동작하지 않음 */}
                    <div className="flex min-h-0 max-h-[min(50dvh,28rem)] flex-col overflow-hidden border-b border-gray-700 bg-tertiary/30 p-3 text-on-panel sm:p-4 lg:max-h-none lg:min-h-[11rem] lg:w-[min(42%,24rem)] lg:min-w-[18rem] lg:max-w-[24rem] lg:shrink-0 lg:border-b-0 lg:border-r">
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                            {desktopModePickerInner}
                        </div>
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain lg:overflow-hidden lg:min-h-0">
                            {pairRoomEmbeddedRightSlot(desktopGameSettingsBlock)}
                        </div>
                        {showPairEmbeddedColumnFooter ? (
                            <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/10 bg-black/50 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-4">
                                {pairRoomEmbeddedColumnFooter}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        );
    }

    if (embeddedPanel && configureOnly) {
        return (
            <div className={embeddedShellClass}>
                <div className="max-h-[min(58vh,560px)] min-h-[240px] min-w-0 overflow-x-auto overflow-y-auto overscroll-contain md:max-h-[min(70vh,640px)]">
                    {innerBody}
                </div>
            </div>
        );
    }

    return (
        <DraggableWindow
            title={title}
            onClose={onClose}
            windowId="ai-challenge"
            initialWidth={calculatedWidth}
            initialHeight={calculatedHeight}
            uniformPcScale={!isMobile}
            bodyScrollable={!isMobile}
            bodyNoScroll={isMobile}
            isTopmost
            variant={isMobile ? 'store' : undefined}
            headerShowTitle={isMobile}
            headerContent={mobileHeaderBack}
            mobileViewportFit={isMobile}
            mobileViewportMaxHeightVh={isMobile ? NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH : undefined}
            bodyPaddingClassName={isMobile ? '!p-2' : undefined}
        >
            {innerBody}
        </DraggableWindow>
    );
};

export default AiChallengeModal;
