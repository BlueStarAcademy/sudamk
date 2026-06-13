import React, { useState, useMemo, useEffect, useRef, useCallback, type ReactNode } from 'react';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { LOBBY_MOBILE_HEADER_BACK_BTN_CLASS } from '../game/PreGameDescriptionLayout.js';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH } from '../../constants/ads.js';
import { GameMode, ServerAction, GameSettings, Player, AlkkagiPlacementType, User } from '../../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, DEFAULT_GAME_SETTINGS, STRATEGIC_ACTION_POINT_COST, filterPlayableLobbyGameModes, isPlayableLobbyGameMode } from '../../constants';
import { 
  BOARD_SIZES, TIME_LIMITS, BYOYOMI_COUNTS, BYOYOMI_TIMES, CAPTURE_BOARD_SIZES, 
  CAPTURE_TARGETS, TTAMOK_CAPTURE_TARGETS, SPEED_BOARD_SIZES, SPEED_TIME_LIMITS, BASE_STONE_COUNTS,
  SCAN_COUNTS, MISSILE_BOARD_SIZES, MISSILE_COUNTS,
  ALKKAGI_STONE_COUNTS, ALKKAGI_ROUNDS, ALKKAGI_GAUGE_SPEEDS, ALKKAGI_ITEM_COUNTS,
  CURLING_STONE_COUNTS, CURLING_ROUNDS, CURLING_GAUGE_SPEEDS, CURLING_ITEM_COUNTS,
  HIDDEN_BOARD_SIZES, DICE_GO_ITEM_COUNTS, getScoringTurnLimitOptionsByBoardSize, getAiScoringTurnLimitByBoardSize,
  getCastleCountsByBoardSize, clampCastleCount, getDefaultCastleKomiByBoardSize, getDefaultCastleCountByBoardSize,
  getDefaultChessKomiByBoardSize, getDefaultChessScoringTurnLimit,
  getChessPieceTotalScoreOptions, getDefaultChessPieceTotalScore, clampChessPieceTotalScore,
} from '../../constants/gameSettings.js';
import { profileStepFromKataServerLevel } from '../../shared/utils/strategicAiDifficulty.js';
import { clampGameInt } from '../../shared/utils/gameIntegerField.js';
import {
    clampAiLobbyStrategicItemCaps,
    AI_LOBBY_HIDDEN_ITEM_FIXED,
    AI_LOBBY_KOMI_MAX_INTEGER,
    AI_LOBBY_KOMI_MIN_INTEGER,
    AI_LOBBY_MISSILE_MAX,
    AI_LOBBY_SCAN_MAX,
} from '../../shared/utils/strategicAiLobbyItemCaps.js';
import {
    PAIR_LOBBY_DENSE_SETTING_ROW_CLASS,
    PAIR_LOBBY_DENSE_SETTINGS_RULE_GRID_CLASS,
    LOBBY_DENSE_SETTINGS_GRID_CONTAINER_CLASS,
    LOBBY_DENSE_SETTINGS_RESPONSIVE_COLS_GRID_CLASS,
    LOBBY_HORIZONTAL_MODE_PICKER_ITEM_CLASS,
    LOBBY_HORIZONTAL_MODE_PICKER_ROW_CLASS,
    LOBBY_HORIZONTAL_MODE_PICKER_ROW_LAYOUT_CLASS,
    LOBBY_HORIZONTAL_MODE_PICKER_SCROLL_CLASS,
    PAIR_LOBBY_DENSE_SETTING_VALUE_READONLY_CLASS,
} from '../../shared/constants/pairLobbyDenseSettingFieldLayout.js';
import { getRankedGameSettings } from '../../constants/rankedGameSettings.js';
import {
    buildPairArenaDuoRankedLobbySettingRows,
    pairLobbyDraftBoardSizeOptions,
    sanitizePairLobbyDraftModeSettings,
} from '../../shared/utils/pairLobbyGameSettingRows.js';
import { mixSubRuleDisplayName } from '../../shared/utils/mixSubRuleDisplayName.js';
import {
    applyMixModeSettingsConstraints,
    getMixBoardSizeOptions,
    isMixSubModeCheckboxDisabled,
    normalizeMixedModesSelection,
} from '../../shared/utils/mixModeSettings.js';
import StrategicTimeControlFields from '../game/StrategicTimeControlFields.js';
import { stableStringify } from '../../utils/appUtils.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import {
    baseAiLobbyActionPointCostForModeAndSettings,
    effectiveAiLobbyApCostForUser,
    effectivePairAiLobbyApCostForUser,
    formatActionPointCostWithPetDiscount,
    type PairPetArenaApLobbyChannel,
} from '../../shared/utils/pairPetArenaApDiscount.js';
import {
    type AiChallengeModalChromeKind,
    aiChallengeFeatureTopHairlineClass,
    aiChallengeModalBodyFrameClass,
    aiChallengeModalChromeFromBucket,
    aiChallengeModalDenseSettingsHeadingClass,
    aiChallengeModalGameCardSelectedRingOverlayClass,
    aiChallengeModalGameCardSelectedTitleClass,
    aiChallengeModalGameCardSurfaceClass,
    aiChallengeModalGameModeOverlayTone,
    aiChallengeModalHandheldModeStepShellClass,
    aiChallengeModalHandheldSettingsScrollShellClass,
    aiChallengeModalHandheldSummaryOuterClass,
    aiChallengeModalModePickerColumnClass,
    aiChallengeModalModeTitleTextClass,
    aiChallengeModalMobileNextCtaClass,
    aiChallengeModalPairHandheldNextButtonClass,
} from './waitingLobbyHomePanelStyles.js';

/** AI 로비 모달·방 만들기 임베드별로 분리된 대국 설정 저장 버킷 — NegotiationModal(`preferredGameSettings_${mode}`)과 무관 */
export type AiLobbyPreferredGameSettingsBucket =
    | 'strategic_ai_challenge'
    | 'strategic_room_create_duo_match'
    | 'strategic_room_create_arena_ai'
    | 'playful_ai_challenge'
    | 'playful_room_create_duo_match'
    | 'playful_room_create_arena_ai'
    | 'pair_ai_match_modal'
    | 'pair_start_match_modal'
    | 'pair_room_create_friendly_4p'
    | 'pair_room_create_friendly_2p'
    | 'pair_room_create_duo_match'
    | 'pair_room_create_ai_duel'
    | 'pair_room_create_arena_ai';

interface AiChallengeModalProps {
    lobbyType: 'strategic' | 'playful';
    onClose: () => void;
    /** `configureOnly`일 때는 생략 가능 — 설정만 부모로 넘길 때 사용 */
    onAction?: (action: ServerAction) => void | Promise<unknown>;
    /** 인게임 AI 재대결: 직전 대국 모드·설정을 그대로 반영하고 스코프별 preferredGameSettings에도 저장 */
    /** `settingsByMode`: 방 만들기 임베드 시 모드별 초안 — 없으면 `mode`+`settings`만 사용 */
    seedFromSession?: {
        mode: GameMode;
        settings: GameSettings;
        settingsByMode?: Partial<Record<GameMode, GameSettings>>;
    };
    /** 페어 경기장 등에서 같은 설정 UI를 쓰되 시작 액션만 바꿔야 하는 경우 */
    startActionType?: 'START_AI_GAME' | 'PAIR_START_AI_MATCH' | 'PAIR_START_MATCH';
    transformSettingsBeforeStart?: (mode: GameMode, settings: GameSettings) => GameSettings;
    hideScoringTurnLimit?: boolean;
    title?: string;
    submitLabel?: string;
    /** 임베드 인라인 시작 버튼 비활성(2인 팀 AI 등 부모 게이트) */
    submitDisabled?: boolean;
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
     * AI 로비 중앙 패널·PVP 방 만들기 등: 게임 모드(상단) + 대국 설정(하단)을 한 열로 쌓는다.
     * `embeddedPanel` + (`!configureOnly` 또는 `pairRoomEmbeddedRightSlot`)과 함께 쓴다.
     */
    embeddedPanelStackedLayout?: boolean;
    /** 데스크톱 split: 게임 모드 피커를 좌측 패널로 분리했을 때 중앙에서 숨김 */
    hideInlineModePicker?: boolean;
    /** 부모(AiLobbyWorkspace)가 모드 선택 state를 소유할 때 */
    controlledSelectedGameMode?: GameMode | null;
    onControlledSelectedGameModeChange?: (mode: GameMode) => void;
    /**
     * 페어 방 만들기: 좌측=게임 모드, 우측은 이 함수로 감싼 `대국 설정` 블록 위에 방 이름·종류·공개 등 배치.
     * `configureOnly` + `embeddedPanel` + 전략 로비에서만 사용한다.
     */
    pairRoomEmbeddedRightSlot?: (gameSettingsBlock: ReactNode) => ReactNode;
    /**
     * 페어/전략 방 모달: 우측 열(방 이름·대국 설정) 하단에 고정되는 푸터(취소·만들기 등).
     * 핸드헬드「방 만들기」1단계(게임 모드만)에서는 렌더하지 않는다.
     */
    pairRoomEmbeddedColumnFooter?: ReactNode;
    /** 페어 방 만들기: 대국 설정 필드를 한 줄에 최대한 많이(다열 그리드) */
    pairRoomDenseSettingsGrid?: boolean;
    /**
     * 페어 방 만들기·방 설정 변경(모바일): 1단계=게임 모드, 2단계=방 이름·종류·대국 설정. true면 하단에 취소/다음·뒤로/저장 푸터를 렌더한다.
     * `configureOnly` + `embeddedPanel` + `pairRoomEmbeddedRightSlot` + 좁은 뷰포트와 함께 쓴다.
     */
    pairRoomHandheldCreateStackedFooter?: boolean;
    onPairRoomHandheldCancel?: () => void;
    onPairRoomHandheldSubmit?: () => void | Promise<void>;
    /** 핸드헬드 푸터 버튼 비활성(제출 중 등) */
    pairRoomHandheldBusy?: boolean;
    /** PVP 인라인 방 만들기: 중앙 열(퀵조인·방목록) 높이를 꽉 채움 */
    embeddedPanelFillParent?: boolean;
    /** 페어/전략 방 만들기: 친선전(`duo_match`) 등에서 대국 설정에 AI단계(카타 단계) 숨김 */
    pairRoomHideGoAiLevel?: boolean;
    /** 놀이바둑 친선전 등: 순서·역할 UI 숨김(유저 대전은 자동 랜덤). AI대결 방에서는 숨기지 않음 */
    pairRoomHidePlayerOrderRole?: boolean;
    /** 페어 경기장 2인 랭킹전 방: 공식 랭킹 규칙만 표시·적용(대국 설정 필드 수정 불가) */
    pairDuoRankedLobbyReadOnly?: boolean;
    /**
     * 손님의 방 대국 설정 변경 제안: 게임 모드는 고정(좌측 읽기 전용), 모바일은 설정·방 메타만 단일 단계로 표시.
     */
    pairRoomLobbyChangePropose?: boolean;
    /** 페어 4·2인 친선 + 전략·놀이 친선전(duo_match): 사람 대국 시 제한시간·초읽기 UI 및 저장 시 시계 유지(AI 무제한 덮어쓰기 방지) */
    pairFriendlyHumanClock?: boolean;
    /** 모달 용도·방 종류별 localStorage 분리(전략 「AI와 대결」vs「방 만들기」, 페어 종류별 등) */
    preferredGameSettingsBucket: AiLobbyPreferredGameSettingsBucket;
}

/** `PairPetRankedMatchModeModal` 랭킹 규칙 표와 동일한 모바일 밀집 행 */
const HANDHELD_PAIR_DUO_RANKED_RULE_ROW_EXTRA_CLASS =
    '!py-1 !px-1.5 gap-x-1 [&>label]:text-[10px] [&>label]:!leading-none [&>div:nth-child(2)]:!h-8 [&>div:nth-child(2)]:!min-h-8 [&>div:nth-child(2)]:!px-1 [&>div:nth-child(2)]:!text-[11px] [&>div:nth-child(2)]:!leading-none';

/** 모바일 「AI와 대결」2단계: 한 줄에 설정 카드 2개 — 컨트롤 높이·패딩만 밀집 */
const HANDHELD_STANDALONE_AI_SETTING_ROW_EXTRA_CLASS =
    '!py-1 !px-1.5 gap-x-0.5 [&_select]:!h-9 [&_select]:!min-h-9 [&_select]:!pl-2 [&_select]:!pr-9 [&_select]:!text-[13px] [&_select]:!leading-tight [&_input[type=number]]:!h-9 [&_input[type=number]]:!min-h-9 [&_input[type=number]]:!text-[13px] [&_input[type=number]]:!px-1.5 [&_input[type=number]]:!leading-tight';

/** 핸드헬드 「방 만들기」2단계(임베드): 설정 행·컨트롤을 한 단계 더 밀집(드롭다운 화살표·글자 잘림 완화) */
const HANDHELD_PAIR_ROOM_CREATE_DETAILS_SETTING_ROW_EXTRA_CLASS =
    '!py-0.5 !px-1 gap-x-0.5 [&_select]:!h-8 [&_select]:!min-h-8 [&_select]:!pl-2 [&_select]:!pr-9 [&_select]:!text-left [&_select]:!text-[13px] [&_select]:!leading-tight [&_input[type=number]]:!h-8 [&_input[type=number]]:!min-h-8 [&_input[type=number]]:!text-[12px] [&_input[type=number]]:!px-1 [&_input[type=number]]:!leading-tight';

/**
 * 손님 「조건 변경 제안」모바일: 좌우 2열 그리드 안에서 라벨 열이 찌그러짐 → 라벨을 드롭다운 위(왼쪽) 작은 글씨로만 표시.
 */
const PAIR_LOBBY_CHANGE_PROPOSE_HANDHELD_ROW_CLASS =
    'flex min-w-0 w-full flex-col items-stretch gap-0.5 rounded-lg border border-white/12 bg-zinc-900/45 py-1.5 px-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] [&_select]:!h-8 [&_select]:!min-h-8 [&_select]:!w-full [&_select]:!pl-2 [&_select]:!pr-9 [&_select]:!text-left [&_select]:!text-[12px] [&_select]:!font-semibold [&_select]:!leading-tight [&_input[type=number]]:!h-8 [&_input[type=number]]:!min-h-8 [&_input[type=number]]:!w-full [&_input[type=number]]:!px-2 [&_input[type=number]]:!text-[12px] [&_input[type=number]]:!font-semibold';

/** AI/랭킹 모달 우측 상단: 긴 게임 설명을 짧게 표기 */
function lobbyGameModeBriefDescription(description: string | undefined, fallback: string): string {
    const t = (description || '').trim().replace(/\s+/g, ' ');
    if (!t) return fallback;
    const max = 132;
    if (t.length <= max) return t;
    const slice = t.slice(0, max);
    const sp = slice.lastIndexOf(' ');
    if (sp > 72) return `${slice.slice(0, sp)}…`;
    return `${slice}…`;
}

type LobbyGameModeDefinition = { mode: GameMode; name: string; image: string; description?: string; available?: boolean };

/** UI 표시용: 유효한 선택 모드 → 없으면 플레이 가능 목록 첫 모드(기본 선택과 동일) */
function resolveLobbySelectedGameModeDefinition(
    availableGameModes: LobbyGameModeDefinition[],
    ...modeCandidates: (GameMode | null | undefined)[]
): LobbyGameModeDefinition | undefined {
    const playable = filterPlayableLobbyGameModes(availableGameModes);
    for (const candidate of modeCandidates) {
        if (candidate == null) continue;
        const found = playable.find((m) => m.mode === candidate);
        if (found) return found;
    }
    return playable[0];
}

/** 전략바둑 대기실 「AI와 대결하기」: 베이스돌 최대 4개 */
const AI_CHALLENGE_BASE_STONE_COUNTS = (BASE_STONE_COUNTS as readonly number[]).filter((count) => count <= 4);
/** 전략·페어 「AI와 대결」: 히든 아이템 1개 고정 */
const AI_CHALLENGE_HIDDEN_STONE_COUNTS = [AI_LOBBY_HIDDEN_ITEM_FIXED] as const;
/** 스캔 아이템 최대 3개 */
const AI_CHALLENGE_SCAN_COUNTS = (SCAN_COUNTS as readonly number[]).filter((count) => count <= AI_LOBBY_SCAN_MAX);
/** 미사일 아이템 최대 3개 */
const AI_CHALLENGE_MISSILE_COUNTS = (MISSILE_COUNTS as readonly number[]).filter((count) => count <= AI_LOBBY_MISSILE_MAX);

function aiLobbyPreferredSettingsBucketStorageKey(bucket: AiLobbyPreferredGameSettingsBucket, mode: GameMode): string {
    return `preferredGameSettings_aiLobby_${bucket}_${mode}`;
}

/** 신규 버킷 키 → 과거 공유 스코프 키까지 순차 폴백(방 만들기 전용 버킷은 폴백 없음 — 기존 혼선 방지) */
function readAiLobbyPreferredSettingsJson(bucket: AiLobbyPreferredGameSettingsBucket, mode: GameMode): string | null {
    const primary = localStorage.getItem(aiLobbyPreferredSettingsBucketStorageKey(bucket, mode));
    if (primary != null && primary !== '') return primary;

    if (bucket === 'strategic_ai_challenge') {
        const scoped = localStorage.getItem(`preferredGameSettings_strategic_${mode}`);
        if (scoped != null && scoped !== '') return scoped;
        return localStorage.getItem(`preferredGameSettings_${mode}`);
    }
    if (bucket === 'playful_ai_challenge') {
        const scoped = localStorage.getItem(`preferredGameSettings_playful_${mode}`);
        if (scoped != null && scoped !== '') return scoped;
        return localStorage.getItem(`preferredGameSettings_${mode}`);
    }
    if (bucket === 'pair_ai_match_modal' || bucket === 'pair_start_match_modal') {
        const pairScoped = localStorage.getItem(`preferredGameSettings_pair_${mode}`);
        if (pairScoped != null && pairScoped !== '') return pairScoped;
    }
    return null;
}

function writeAiLobbyPreferredSettingsJson(bucket: AiLobbyPreferredGameSettingsBucket, mode: GameMode, json: string): void {
    localStorage.setItem(aiLobbyPreferredSettingsBucketStorageKey(bucket, mode), json);
}

function getAiChallengeBoardSizes(mode: GameMode, lobbyType: 'strategic' | 'playful'): number[] {
    return [...pairLobbyDraftBoardSizeOptions(mode, lobbyType)];
}

function modeIncludesCaptureRule(mode: GameMode, settings: Pick<GameSettings, 'mixedModes'>): boolean {
    return mode === GameMode.Capture || (mode === GameMode.Mix && Boolean(settings.mixedModes?.includes(GameMode.Capture)));
}

function normalizeAiScoringTurnLimit(mode: GameMode, settings: GameSettings): GameSettings {
    if (!SPECIAL_GAME_MODES.some(m => m.mode === mode)) return settings;
    if (mode === GameMode.Chess) {
        const bs = (settings.boardSize === 9 ? 9 : 13) as GameSettings['boardSize'];
        return {
            ...settings,
            boardSize: bs,
            komi: getDefaultChessKomiByBoardSize(bs),
            scoringTurnLimit: getDefaultChessScoringTurnLimit(),
            chessPieceTotalScore: clampChessPieceTotalScore(
                settings.chessPieceTotalScore ?? getDefaultChessPieceTotalScore(bs),
                bs,
            ),
        };
    }
    if (mode === GameMode.Castle || modeIncludesCaptureRule(mode, settings)) {
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
function mergeSeedIntoChallengeSettings(
    mode: GameMode,
    sessionSettings: GameSettings,
    lobbyType: 'strategic' | 'playful',
): GameSettings {
    let newSettings: GameSettings = { ...DEFAULT_GAME_SETTINGS, ...sessionSettings };
    if (mode === GameMode.Base) {
        newSettings.komi = 0.5;
    }
    if (!newSettings.player1Color) {
        newSettings.player1Color = Player.Black;
    }
    newSettings = sanitizePairLobbyDraftModeSettings(mode, newSettings, lobbyType);
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

/**
 * 비-2인랭킹전 `buildFinalSettingsForApply`와 동일 파이프라인.
 * 임베드 방 만들기에서 시드를 `mergeSeed`만 반영하면 로컬 `settings`와 부모로 푸시되는 값이 달라
 * `onConfigureApply` ↔ `seedFromSession` 이 매 렌더 반복된다.
 */
function finalizeNonDuoLobbyDraftForApply(
    mode: GameMode,
    draft: GameSettings,
    lobbyType: 'strategic' | 'playful',
    pairFriendlyHumanClock: boolean,
    transformSettingsBeforeStart?: (m: GameMode, s: GameSettings) => GameSettings,
): GameSettings {
    const useClientSideAi = false;
    const timeUnlimitedSettings: Partial<GameSettings> = {
        timeLimit: 0,
        byoyomiTime: 0,
        byoyomiCount: 0,
        timeIncrement: 0,
    };
    const defaultKataWhenUnset = -12;
    const kataResolved =
        typeof draft.kataServerLevel === 'number' && Number.isFinite(draft.kataServerLevel)
            ? draft.kataServerLevel
            : defaultKataWhenUnset;
    const aiProfileStep =
        profileStepFromKataServerLevel(kataResolved) ??
        (lobbyType === 'strategic' ? 5 : (draft.goAiBotLevel ?? draft.aiDifficulty ?? 5));
    const mergedSettings: GameSettings = {
        ...draft,
        ...(pairFriendlyHumanClock ? {} : timeUnlimitedSettings),
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
        mode,
        normalizeAiScoringTurnLimit(mode, mergedSettings),
    );
    return transformSettingsBeforeStart ? transformSettingsBeforeStart(mode, normalizedSettings) : normalizedSettings;
}

/** 임베드 방 만들기: `settingsByMode`·시드에서 대상 모드의 대국 설정을 `buildFinalSettingsForApply`와 동일 파이프라인으로 결정 */
function resolveEmbeddedConfigureSeedSettings(
    targetMode: GameMode,
    live: { mode?: GameMode; settings?: GameSettings; settingsByMode?: Partial<Record<GameMode, GameSettings>> } | undefined,
    lobbyType: 'strategic' | 'playful',
    pairFriendlyHumanClock: boolean,
    transformSettingsBeforeStart?: (m: GameMode, s: GameSettings) => GameSettings,
): GameSettings {
    const perMode = live?.settingsByMode?.[targetMode];
    const seedSettingsForMode =
        perMode ?? (live?.mode === targetMode && live.settings ? live.settings : undefined);
    if (seedSettingsForMode) {
        const cleaned = mergeSeedIntoChallengeSettings(targetMode, seedSettingsForMode, lobbyType);
        return finalizeNonDuoLobbyDraftForApply(
            targetMode,
            cleaned,
            lobbyType,
            pairFriendlyHumanClock,
            transformSettingsBeforeStart,
        );
    }
    const cleaned = mergeSeedIntoChallengeSettings(targetMode, { ...DEFAULT_GAME_SETTINGS }, lobbyType);
    return finalizeNonDuoLobbyDraftForApply(
        targetMode,
        cleaned,
        lobbyType,
        pairFriendlyHumanClock,
        transformSettingsBeforeStart,
    );
}

const GameModeDescriptionBanner: React.FC<{
    modeName: string;
    modeImage: string;
    descriptionText: string;
    chromeKind: AiChallengeModalChromeKind;
}> = ({ modeName, modeImage, descriptionText, chromeKind }) => {
    const tone = aiChallengeModalGameModeOverlayTone(chromeKind);

    return (
        <div
            className={`mb-2 shrink-0 rounded-xl border-2 px-3 py-2.5 sm:mb-2.5 sm:px-3.5 sm:py-3 ${tone.panel}`}
            role="status"
            aria-live="polite"
        >
            <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/20 bg-black/35 p-1 shadow-inner sm:h-12 sm:w-12">
                    <img src={modeImage} alt="" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className={`text-sm font-extrabold leading-snug sm:text-base ${tone.title}`}>{modeName}</h4>
                    <p className="mt-0.5 max-h-[5.5rem] overflow-y-auto text-[11px] font-medium leading-relaxed text-zinc-100/95 sm:text-xs">
                        {descriptionText}
                    </p>
                </div>
            </div>
        </div>
    );
};

const GameModePickerSection: React.FC<{
    className?: string;
    chromeKind: AiChallengeModalChromeKind;
    selectedMode: { name: string; image: string; description?: string } | null | undefined;
    descriptionFallback: string;
    /** 믹스 바둑 등 설정 UI가 설명 역할을 할 때 말풍선 오버레이 생략 */
    suppressDescriptionOverlay?: boolean;
    children: ReactNode;
}> = ({ className, chromeKind, selectedMode, descriptionFallback, suppressDescriptionOverlay = false, children }) => {
    const descriptionText = selectedMode
        ? lobbyGameModeBriefDescription(selectedMode.description, descriptionFallback)
        : null;
    return (
        <div className={`flex flex-col ${className ?? ''}`}>
            {selectedMode && descriptionText && !suppressDescriptionOverlay ? (
                <GameModeDescriptionBanner
                    modeName={selectedMode.name}
                    modeImage={selectedMode.image}
                    descriptionText={descriptionText}
                    chromeKind={chromeKind}
                />
            ) : null}
            {children}
        </div>
    );
};

const GameCard: React.FC<{
    mode: GameMode;
    image: string;
    displayName: string;
    onSelect: (mode: GameMode) => void;
    isSelected: boolean;
    compact?: boolean;
    /** 가로 스크롤 피커: 카드 너비를 제목 길이에 맞춤(줄임표 없음) */
    scrollStripItem?: boolean;
    chromeKind: AiChallengeModalChromeKind;
    disabled?: boolean;
}> = ({ mode, image, displayName, onSelect, isSelected, compact, scrollStripItem, chromeKind, disabled = false }) => {
    const [imgError, setImgError] = useState(false);
    /** `PairPetRankedMatchModeModal`의 `ModePickCard`와 동일 높이·간격(이름 아래 불필요한 flex-grow 공간 제거) */
    const imgH = compact ? 70 : 88;

    return (
        <div
            className={`${aiChallengeModalGameCardSurfaceClass(chromeKind, isSelected, Boolean(compact))} relative rounded-lg ${
                scrollStripItem ? 'w-max max-w-none' : ''
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${isSelected ? 'z-[15]' : 'z-0'}`}
            onClick={() => {
                if (!disabled) onSelect(mode);
            }}
        >
            {isSelected ? (
                <span
                    className={`pointer-events-none absolute inset-0 z-20 rounded-[inherit] ${aiChallengeModalGameCardSelectedRingOverlayClass(chromeKind)}`}
                    aria-hidden
                />
            ) : null}
            <div
                className="relative z-[1] flex w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-tertiary p-1 text-tertiary shadow-inner"
                style={{ height: `${imgH}px` }}
            >
                {!imgError ? (
                    <img
                        src={image}
                        alt={displayName}
                        className="h-full w-full object-contain"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <span className={compact ? 'text-xs' : 'text-sm'}>{displayName}</span>
                )}
            </div>
            <h3
                className={`relative z-[1] text-primary w-full shrink-0 px-0.5 text-center font-bold ${
                    scrollStripItem ? 'whitespace-nowrap leading-snug' : 'min-w-0 leading-snug'
                } ${compact ? 'text-xs' : 'text-sm sm:text-base'} ${
                    isSelected ? aiChallengeModalGameCardSelectedTitleClass(chromeKind) : ''
                }`}
            >
                {displayName}
            </h3>
        </div>
    );
};

/** AI 로비 좌측 패널 — 게임 모드 가로/그리드 피커 */
export type AiChallengeModePickerStripProps = {
    lobbyType: 'strategic' | 'playful';
    preferredGameSettingsBucket: AiLobbyPreferredGameSettingsBucket;
    selectedGameMode: GameMode | null;
    onSelectGameMode: (mode: GameMode) => void;
    className?: string;
    verticalGrid?: boolean;
};

export const AiChallengeModePickerStrip: React.FC<AiChallengeModePickerStripProps> = ({
    lobbyType,
    preferredGameSettingsBucket,
    selectedGameMode,
    onSelectGameMode,
    className,
    verticalGrid = false,
}) => {
    const modalChrome = useMemo(
        () => aiChallengeModalChromeFromBucket(preferredGameSettingsBucket),
        [preferredGameSettingsBucket],
    );
    const modeTitleToneClass = aiChallengeModalModeTitleTextClass(modalChrome);
    const lobbyGameModes = useMemo(
        () => (lobbyType === 'strategic' ? SPECIAL_GAME_MODES : PLAYFUL_GAME_MODES),
        [lobbyType],
    );
    const modeBriefFallbackForPicker =
        lobbyType === 'strategic'
            ? '판 크기·시간·AI 난이도 등은 아래 대국 설정에서 조정합니다.'
            : '대국 옵션은 아래 설정에서 조정합니다.';
    const selectedModeDefinition = useMemo(
        () => resolveLobbySelectedGameModeDefinition(lobbyGameModes, selectedGameMode),
        [lobbyGameModes, selectedGameMode],
    );
    const displaySelectedGameMode = selectedModeDefinition?.mode ?? null;
    return (
        <GameModePickerSection
            className={`shrink-0 border-white/10 bg-gradient-to-b from-black/35 to-black/15 px-2 py-2.5 sm:px-2.5 ${
                verticalGrid ? 'flex min-h-0 flex-1 flex-col overflow-hidden border-t' : 'border-b px-2.5 py-3'
            } ${className ?? ''}`}
            chromeKind={modalChrome}
            selectedMode={selectedModeDefinition}
            descriptionFallback={modeBriefFallbackForPicker}
        >
            <div className="mb-2 flex shrink-0 items-baseline justify-between gap-2">
                <h3 className={`text-sm font-extrabold tracking-tight ${modeTitleToneClass}`}>게임 모드 선택</h3>
                <span className="shrink-0 text-[10px] font-semibold text-zinc-500 sm:text-[11px]">
                    {lobbyGameModes.length}종
                </span>
            </div>
            <div
                className={
                    verticalGrid
                        ? 'grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]'
                        : `${LOBBY_HORIZONTAL_MODE_PICKER_ROW_CLASS} md:grid md:min-h-0 md:max-h-none md:grid-cols-2 md:gap-2 md:overflow-x-hidden md:overflow-y-auto lg:grid-cols-2`
                }
            >
                {lobbyGameModes.map((game) => (
                    <div
                        key={game.mode}
                        className={verticalGrid ? 'min-w-0' : `${LOBBY_HORIZONTAL_MODE_PICKER_ITEM_CLASS} md:w-auto md:shrink`}
                    >
                        <GameCard
                            mode={game.mode}
                            image={game.image}
                            displayName={game.name ?? String(game.mode)}
                            onSelect={onSelectGameMode}
                            isSelected={displaySelectedGameMode === game.mode}
                            compact
                            scrollStripItem={!verticalGrid}
                            chromeKind={modalChrome}
                            disabled={!isPlayableLobbyGameMode(game)}
                        />
                    </div>
                ))}
            </div>
        </GameModePickerSection>
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
    submitDisabled = false,
    showActionPointCost = true,
    configureOnly = false,
    onConfigureApply,
    embeddedPanel = false,
    embeddedPanelStackedLayout = false,
    hideInlineModePicker = false,
    controlledSelectedGameMode,
    onControlledSelectedGameModeChange,
    pairRoomEmbeddedRightSlot,
    pairRoomEmbeddedColumnFooter,
    pairRoomDenseSettingsGrid = false,
    pairRoomHandheldCreateStackedFooter = false,
    onPairRoomHandheldCancel,
    onPairRoomHandheldSubmit,
    pairRoomHandheldBusy = false,
    embeddedPanelFillParent = false,
    pairRoomHideGoAiLevel = false,
    pairRoomHidePlayerOrderRole = false,
    pairDuoRankedLobbyReadOnly = false,
    pairRoomLobbyChangePropose = false,
    pairFriendlyHumanClock = false,
    preferredGameSettingsBucket,
}) => {
    const { currentUser: appCurrentUser } = useAppContext();
    const prefsBucket = preferredGameSettingsBucket;
    const modalChrome = useMemo(
        () => aiChallengeModalChromeFromBucket(preferredGameSettingsBucket),
        [preferredGameSettingsBucket],
    );
    const embeddedShellClass = aiChallengeModalBodyFrameClass(modalChrome);
    const embeddedPanelShellClass = embeddedPanelFillParent
        ? `${embeddedShellClass} min-h-0 flex-1`
        : embeddedShellClass;
    const modePickerColumnClassName = aiChallengeModalModePickerColumnClass(modalChrome);
    const modeTitleToneClass = aiChallengeModalModeTitleTextClass(modalChrome);
    const denseSettingsHeadingToneClass = aiChallengeModalDenseSettingsHeadingClass(modalChrome);
    const mobileNextCtaChromeClass = aiChallengeModalMobileNextCtaClass(modalChrome);
    const pairHandheldNextChromeClass = aiChallengeModalPairHandheldNextButtonClass(modalChrome);
    const lobbyGameModes = useMemo(
        () => (lobbyType === 'strategic' ? SPECIAL_GAME_MODES : PLAYFUL_GAME_MODES),
        [lobbyType],
    );
    const playableGameModes = useMemo(
        () => filterPlayableLobbyGameModes(lobbyGameModes),
        [lobbyGameModes],
    );
    const isModeControlled =
        controlledSelectedGameMode !== undefined && onControlledSelectedGameModeChange !== undefined;
    const [selectedGameMode, setSelectedGameMode] = useState<GameMode | null>(() => {
        if (
            controlledSelectedGameMode &&
            playableGameModes.some((m) => m.mode === controlledSelectedGameMode)
        ) {
            return controlledSelectedGameMode;
        }
        if (seedFromSession?.mode && playableGameModes.some(m => m.mode === seedFromSession.mode)) {
            return seedFromSession.mode;
        }
        return playableGameModes[0]?.mode || null;
    });
    const effectiveSelectedGameMode = isModeControlled ? controlledSelectedGameMode : selectedGameMode;

    useEffect(() => {
        if (!isModeControlled || !controlledSelectedGameMode) return;
        if (controlledSelectedGameMode !== selectedGameMode) {
            setSelectedGameMode(controlledSelectedGameMode);
        }
    }, [isModeControlled, controlledSelectedGameMode, selectedGameMode]);
    const [settings, setSettings] = useState<GameSettings>(DEFAULT_GAME_SETTINGS);
    const prevSelectedGameModeRef = useRef<GameMode | null>(null);
    const [mobileStep, setMobileStep] = useState<'pickMode' | 'settings'>(() => (seedFromSession ? 'settings' : 'pickMode'));
    /** 페어 방 만들기(핸드헬드): 게임 모드 → 방 이름·설정 — 손님 변경 제안은 details만 */
    const [pairEmbedMobileStep, setPairEmbedMobileStep] = useState<'game' | 'details'>(() =>
        pairRoomLobbyChangePropose ? 'details' : 'game',
    );
    const seedHydratedRef = useRef(false);
    /** 부모(Game)가 매 프레임 새 객체를 넘겨도 시드 적용·localStorage 로직이 중복 실행되지 않게 첫 렌더 값만 사용 */
    const frozenSeedRef = useRef<typeof seedFromSession>(undefined);
    if (frozenSeedRef.current === undefined) {
        frozenSeedRef.current = seedFromSession;
    }
    /** 임베드 방 만들기: 부모 시드 객체 참조가 매 렌더 바뀌어도 내용이 같으면 이펙트가 도지 않게 fingerprint 사용 */
    const embeddedSeedLiveRef = useRef(seedFromSession);
    embeddedSeedLiveRef.current = seedFromSession;
    const embeddedParentDraftFingerprint =
        embeddedPanel && configureOnly
            ? `${seedFromSession?.mode ?? ''}\0${stableStringify(seedFromSession?.settings ?? {})}\0${stableStringify(seedFromSession?.settingsByMode ?? {})}`
            : '__no_embed_parent_sync__';
    const lastEmbeddedPushKeyRef = useRef('');

    const aiApLobbyChannel = useMemo((): PairPetArenaApLobbyChannel => {
        if (startActionType === 'START_AI_GAME') {
            return lobbyType === 'playful' ? 'playful' : 'strategic';
        }
        if (preferredGameSettingsBucket.includes('playful')) return 'playful';
        if (preferredGameSettingsBucket.includes('strategic')) return 'strategic';
        return 'pair';
    }, [startActionType, lobbyType, preferredGameSettingsBucket]);

    const actionPointCostDisplay = useMemo(() => {
        if (!selectedGameMode) return String(STRATEGIC_ACTION_POINT_COST);
        const base = baseAiLobbyActionPointCostForModeAndSettings(selectedGameMode, settings);
        if (!appCurrentUser) return String(base);
        const eff =
            startActionType === 'START_AI_GAME'
                ? effectiveAiLobbyApCostForUser(appCurrentUser as User, selectedGameMode, settings)
                : effectivePairAiLobbyApCostForUser(appCurrentUser as User, selectedGameMode, settings, {
                      lobbyChannel: aiApLobbyChannel,
                  });
        return formatActionPointCostWithPetDiscount(base, eff);
    }, [selectedGameMode, settings, appCurrentUser, startActionType, aiApLobbyChannel]);

    const { isNativeMobile } = useNativeMobileShell();
    const isCompactViewport = useIsHandheldDevice(1024);
    const isMobile = isNativeMobile || isCompactViewport;
    /** 페어·전략·놀이 AI 경기장 탭(임베드) — 모바일에서도 단계별(모드 → 설정) 마법사 */
    const isEmbeddedAiLobbyMobileWizard = Boolean(
        embeddedPanel && embeddedPanelStackedLayout && !configureOnly && !pairRoomEmbeddedRightSlot,
    );
    /** 독립 AI 모달 또는 임베드 AI 로비(모바일). 방 만들기 임베드(`pairRoomEmbeddedRightSlot`)는 별도 2단계 */
    const layoutMobile = Boolean(
        isMobile && !pairRoomEmbeddedRightSlot && (!embeddedPanel || isEmbeddedAiLobbyMobileWizard),
    );
    /**
     * 모바일: `DraggableWindow` + `mobileViewportFit`일 때 실제 폭은 min(initialWidth, 뷰포트 상한).
     * 방 만들기 전면 시트(`w-full` + max vw)와 같이 가로를 최대한 쓰려면 설계 폭을 충분히 크게 두어 상한만 적용되게 한다.
     */
    const calculatedWidth = isMobile ? 1600 : 928;
    const calculatedHeight = isMobile ? 680 : 803;
    const mobileTextScale = 1.0;

      /** 방 만들기 우측·로비 임베드 AI 패널: 밀집 2열 대국 설정 그리드 (독립 AI 모달은 자동 적용) */
    const useLobbyDenseGameSettingsLayout =
        pairRoomDenseSettingsGrid ||
        (!embeddedPanel && !configureOnly) ||
        (embeddedPanel && embeddedPanelStackedLayout && !configureOnly);

    const selectedGameDefinition = useMemo(
        () => resolveLobbySelectedGameModeDefinition(lobbyGameModes, effectiveSelectedGameMode, selectedGameMode),
        [lobbyGameModes, effectiveSelectedGameMode, selectedGameMode],
    );
    const displaySelectedGameMode = selectedGameDefinition?.mode ?? null;

    /** 목록 첫 모드가 기본 선택 — state가 비어 있거나 무효면 즉시 맞춤 */
    useEffect(() => {
        const defaultMode = playableGameModes[0]?.mode ?? null;
        if (!defaultMode) return;
        if (selectedGameMode != null && playableGameModes.some((m) => m.mode === selectedGameMode)) return;
        setSelectedGameMode(defaultMode);
    }, [playableGameModes, selectedGameMode]);

    // 게임 모드 변경 시 설정 초기화 (재대결 시드는 직전 대국 설정을 우선·localStorage에 동기화)
    useEffect(() => {
        if (!selectedGameMode) return;
        if (pairDuoRankedLobbyReadOnly) return;

        /**
         * 페어/전략·놀이 「방 만들기」임베드: 부모 `createModalDraftGame`이 단일 출처.
         * 선택 모드와 `seed.mode`가 달라도 `settingsByMode[선택모드]`가 있으면 그걸 써야 모드 전환 시 설정이 롤링되지 않음.
         */
        if (embeddedPanel && configureOnly && !pairDuoRankedLobbyReadOnly) {
            const live = embeddedSeedLiveRef.current;
            const canonical = resolveEmbeddedConfigureSeedSettings(
                selectedGameMode,
                live ?? undefined,
                lobbyType,
                pairFriendlyHumanClock,
                transformSettingsBeforeStart,
            );
            const canonicalKey = `${selectedGameMode}\0${stableStringify(canonical)}`;
            if (canonicalKey === lastEmbeddedPushKeyRef.current) return;
            setSettings((prev) => (stableStringify(prev) === stableStringify(canonical) ? prev : canonical));
            return;
        }

        const seed = frozenSeedRef.current;
        if (seed && selectedGameMode === seed.mode && !seedHydratedRef.current) {
            seedHydratedRef.current = true;
            const merged = mergeSeedIntoChallengeSettings(seed.mode, seed.settings, lobbyType);
            setSettings(merged);
            try {
                writeAiLobbyPreferredSettingsJson(prefsBucket, selectedGameMode, JSON.stringify(merged));
            } catch (e) {
                console.error('Failed to persist AI rematch seed settings', e);
            }
            return;
        }

        const savedSettings = readAiLobbyPreferredSettingsJson(prefsBucket, selectedGameMode);
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                if (selectedGameMode === GameMode.Alkkagi && parsed.alkkagiItemCount != null && parsed.alkkagiSlowItemCount == null && parsed.alkkagiAimingLineItemCount == null) {
                    parsed.alkkagiSlowItemCount = parsed.alkkagiItemCount;
                    parsed.alkkagiAimingLineItemCount = parsed.alkkagiItemCount;
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
    }, [
        selectedGameMode,
        pairDuoRankedLobbyReadOnly,
        embeddedPanel,
        configureOnly,
        embeddedParentDraftFingerprint,
        transformSettingsBeforeStart,
        lobbyType,
        pairFriendlyHumanClock,
        prefsBucket,
    ]);

    useEffect(() => {
        if (!pairDuoRankedLobbyReadOnly || !embeddedSeedLiveRef.current?.mode) return;
        const m = embeddedSeedLiveRef.current.mode;
        if (playableGameModes.some((a) => a.mode === m) && selectedGameMode !== m) {
            setSelectedGameMode(m);
        }
    }, [pairDuoRankedLobbyReadOnly, embeddedParentDraftFingerprint, playableGameModes, selectedGameMode]);

    /** 임베드 방 만들기: 부모 시드의 mode가 바뀐 경우에만 자식 모드 동기화 (클릭마다 되돌리면 설명이 스와핑됨) */
    const lastSyncedEmbeddedParentModeRef = useRef<GameMode | null | undefined>(undefined);
    useEffect(() => {
        if (!embeddedPanel || !configureOnly || pairDuoRankedLobbyReadOnly) return;
        const parentMode = embeddedSeedLiveRef.current?.mode ?? null;
        if (lastSyncedEmbeddedParentModeRef.current === undefined) {
            lastSyncedEmbeddedParentModeRef.current = parentMode;
            return;
        }
        if (parentMode === lastSyncedEmbeddedParentModeRef.current) return;
        lastSyncedEmbeddedParentModeRef.current = parentMode;
        if (parentMode && playableGameModes.some((a) => a.mode === parentMode)) {
            setSelectedGameMode(parentMode);
        }
    }, [embeddedPanel, configureOnly, pairDuoRankedLobbyReadOnly, embeddedParentDraftFingerprint, playableGameModes]);

    useEffect(() => {
        if (!pairDuoRankedLobbyReadOnly || !selectedGameMode) return;
        const base: GameSettings = { ...DEFAULT_GAME_SETTINGS, ...getRankedGameSettings(selectedGameMode) };
        const next = transformSettingsBeforeStart?.(selectedGameMode, base) ?? base;
        setSettings((prev) => (stableStringify(prev) === stableStringify(next) ? prev : next));
    }, [pairDuoRankedLobbyReadOnly, selectedGameMode, transformSettingsBeforeStart]);

    useEffect(() => {
        if (!selectedGameMode) return;
        if (pairDuoRankedLobbyReadOnly) return;
        /** 임베드: `resolveEmbeddedConfigureSeedSettings`·부모 푸시가 이미 판 크기를 정규화 — 여기서 다시 고치면 시드↔푸시 루프 */
        if (embeddedPanel && configureOnly) return;
        const boardSizeOptions = getAiChallengeBoardSizes(selectedGameMode, lobbyType);
        const rawCur = settings.boardSize as unknown;
        const curNum =
            typeof rawCur === 'number' && Number.isFinite(rawCur)
                ? rawCur
                : typeof rawCur === 'string' && String(rawCur).trim() !== ''
                  ? Number.parseInt(String(rawCur), 10)
                  : NaN;
        /** 비정규 타입(문자열 boardSize 등)만 숫자로 통일. 자동 보정은 localStorage에 쓰지 않아 PVP↔AI 전환·시드 동기화 루프를 막는다 */
        if (!Number.isFinite(curNum) || !boardSizeOptions.includes(curNum)) {
            setSettings((prev) => {
                const next = clampAiLobbyStrategicItemCaps(
                    selectedGameMode,
                    normalizeAiScoringTurnLimit(selectedGameMode, {
                        ...prev,
                        boardSize: boardSizeOptions[0] as GameSettings['boardSize'],
                    }),
                );
                return stableStringify(prev) === stableStringify(next) ? prev : next;
            });
        } else if (typeof rawCur === 'string') {
            setSettings((prev) => {
                const next = clampAiLobbyStrategicItemCaps(
                    selectedGameMode,
                    normalizeAiScoringTurnLimit(selectedGameMode, {
                        ...prev,
                        boardSize: curNum as GameSettings['boardSize'],
                    }),
                );
                return stableStringify(prev) === stableStringify(next) ? prev : next;
            });
        }
    }, [selectedGameMode, settings.boardSize, lobbyType, pairDuoRankedLobbyReadOnly, embeddedPanel, configureOnly]);

    useEffect(() => {
        if (pairDuoRankedLobbyReadOnly) return;
        if (hideScoringTurnLimit) return;
        if (!selectedGameMode) return;
        const requiredLimit =
            selectedGameMode === GameMode.Chess
                ? getDefaultChessScoringTurnLimit()
                : modeIncludesCaptureRule(selectedGameMode, settings)
                  ? 0
                  : getAiScoringTurnLimitByBoardSize(settings.boardSize);
        const currentLimit = settings.scoringTurnLimit ?? 0;
        if (currentLimit !== requiredLimit) {
            setSettings((prev) => {
                const next = clampAiLobbyStrategicItemCaps(
                    selectedGameMode,
                    normalizeAiScoringTurnLimit(selectedGameMode, { ...prev, scoringTurnLimit: requiredLimit }),
                );
                return stableStringify(prev) === stableStringify(next) ? prev : next;
            });
        }
    }, [hideScoringTurnLimit, selectedGameMode, settings.boardSize, settings.mixedModes, settings.scoringTurnLimit, pairDuoRankedLobbyReadOnly]);

    const handleSettingChange = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
        if (pairDuoRankedLobbyReadOnly) return;
        setSettings(prev => {
            let newSettings = { ...prev, [key]: value };
            if (selectedGameMode === GameMode.Castle && key === 'boardSize') {
                const boardSize = Number(value);
                newSettings.komi = getDefaultCastleKomiByBoardSize(boardSize);
                newSettings.castleCount = clampCastleCount(
                    newSettings.castleCount ?? getDefaultCastleCountByBoardSize(boardSize),
                    boardSize,
                );
            }
            if (selectedGameMode === GameMode.Chess && key === 'boardSize') {
                const boardSize = Number(value);
                newSettings.komi = getDefaultChessKomiByBoardSize(boardSize);
                newSettings.chessPieceTotalScore = getDefaultChessPieceTotalScore(boardSize);
            }
            if (selectedGameMode === GameMode.Chess && key === 'chessPieceTotalScore') {
                newSettings.chessPieceTotalScore = clampChessPieceTotalScore(value, newSettings.boardSize ?? 13);
            }
            if (selectedGameMode === GameMode.Mix && key === 'mixedModes') {
                newSettings = applyMixModeSettingsConstraints(newSettings);
            }
            if (selectedGameMode && (key === 'boardSize' || key === 'mixedModes')) {
                newSettings = normalizeAiScoringTurnLimit(selectedGameMode, newSettings);
            }
            if (selectedGameMode) {
                newSettings = clampAiLobbyStrategicItemCaps(selectedGameMode, newSettings);
                if (!(embeddedPanel && configureOnly)) {
                    try {
                        writeAiLobbyPreferredSettingsJson(prefsBucket, selectedGameMode, JSON.stringify(newSettings));
                    } catch {
                        /* ignore quota / private mode */
                    }
                }
            }
            return newSettings;
        });
    };

    const handleMixedModeChange = (subMode: GameMode, checked: boolean) => {
        if (pairDuoRankedLobbyReadOnly) return;
        setSettings(prev => {
            const nextMixed = normalizeMixedModesSelection(prev.mixedModes, subMode, checked);
            let newSettings = applyMixModeSettingsConstraints(
                normalizeAiScoringTurnLimit(selectedGameMode ?? GameMode.Mix, { ...prev, mixedModes: nextMixed }),
            );
            if (selectedGameMode) {
                newSettings = clampAiLobbyStrategicItemCaps(selectedGameMode, newSettings);
                if (!(embeddedPanel && configureOnly)) {
                    try {
                        writeAiLobbyPreferredSettingsJson(prefsBucket, selectedGameMode, JSON.stringify(newSettings));
                    } catch {
                        /* ignore */
                    }
                }
            }
            return newSettings;
        });
    };

    // 믹스로 전환 시 mixedModes가 비어 있으면 PVP 기본과 같이 유효한 조합을 채움 (신청 화면에서 규칙 선택이 보이도록)
    useEffect(() => {
        if (pairDuoRankedLobbyReadOnly) return;
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
            if (!(embeddedPanel && configureOnly)) {
                try {
                    writeAiLobbyPreferredSettingsJson(prefsBucket, GameMode.Mix, JSON.stringify(next));
                } catch {
                    /* ignore */
                }
            }
            return next;
        });
    }, [selectedGameMode, pairDuoRankedLobbyReadOnly, embeddedPanel, configureOnly, prefsBucket]);

    const buildFinalSettingsForApply = useCallback((): { mode: GameMode; settings: GameSettings } | null => {
        if (!selectedGameMode) return null;
        if (selectedGameMode === GameMode.Mix && (!settings.mixedModes || settings.mixedModes.length < 2)) {
            return null;
        }
        /** 2인 랭킹전 방 만들기: UI·부모 초안과 동일하게 공식 프리셋만 사용 (`normalizeAiScoringTurnLimit` 등으로 점수가 왔다갔다 하지 않게) */
        if (pairDuoRankedLobbyReadOnly) {
            const base: GameSettings = { ...DEFAULT_GAME_SETTINGS, ...getRankedGameSettings(selectedGameMode) };
            const rankedSettings = transformSettingsBeforeStart?.(selectedGameMode, base) ?? base;
            return { mode: selectedGameMode, settings: { ...rankedSettings, useClientSideAi: false } };
        }
        return {
            mode: selectedGameMode,
            settings: finalizeNonDuoLobbyDraftForApply(
                selectedGameMode,
                settings,
                lobbyType,
                pairFriendlyHumanClock,
                transformSettingsBeforeStart,
            ),
        };
    }, [selectedGameMode, settings, transformSettingsBeforeStart, lobbyType, pairDuoRankedLobbyReadOnly, pairFriendlyHumanClock]);

    /** 방 만들기 임베드: 모드 전환 직전 부모에 현재 모드 초안을 밀어 넣고, 다음 모드 설정을 같은 틱에 반영해 셀렉트 롤링·한 프레임 어긋남 방지 */
    const selectGameModeForLobby = useCallback(
        (mode: GameMode) => {
            const picked = lobbyGameModes.find((m) => m.mode === mode);
            if (picked && !isPlayableLobbyGameMode(picked)) return;
            if (isModeControlled && onControlledSelectedGameModeChange) {
                onControlledSelectedGameModeChange(mode);
                if (!(embeddedPanel && configureOnly)) return;
            }
            if (pairDuoRankedLobbyReadOnly) {
                setSelectedGameMode(mode);
                return;
            }
            if (embeddedPanel && configureOnly && !pairDuoRankedLobbyReadOnly) {
                if (onConfigureApply && selectedGameMode && selectedGameMode !== mode) {
                    const built = buildFinalSettingsForApply();
                    if (built) onConfigureApply(built.mode, built.settings);
                }
                const liveSnapshot = embeddedSeedLiveRef.current;
                const canonical = resolveEmbeddedConfigureSeedSettings(
                    mode,
                    liveSnapshot ?? undefined,
                    lobbyType,
                    pairFriendlyHumanClock,
                    transformSettingsBeforeStart,
                );
                setSelectedGameMode(mode);
                setSettings((prev) => (stableStringify(prev) === stableStringify(canonical) ? prev : canonical));
                if (onConfigureApply) {
                    onConfigureApply(mode, canonical);
                    lastEmbeddedPushKeyRef.current = `${mode}\0${stableStringify(canonical)}`;
                    lastSyncedEmbeddedParentModeRef.current = mode;
                }
                return;
            }
            setSelectedGameMode(mode);
        },
        [
            isModeControlled,
            onControlledSelectedGameModeChange,
            pairDuoRankedLobbyReadOnly,
            embeddedPanel,
            configureOnly,
            onConfigureApply,
            selectedGameMode,
            buildFinalSettingsForApply,
            lobbyType,
            pairFriendlyHumanClock,
            transformSettingsBeforeStart,
            lobbyGameModes,
        ],
    );
    useEffect(() => {
        if (!embeddedPanel || !configureOnly || !onConfigureApply) return;
        const built = buildFinalSettingsForApply();
        if (!built) return;
        const key = `${built.mode}\0${stableStringify(built.settings)}`;
        if (key === lastEmbeddedPushKeyRef.current) return;
        const live = embeddedSeedLiveRef.current;
        const parentSlice =
            live?.settingsByMode?.[built.mode] ??
            (live?.mode === built.mode && live.settings ? live.settings : undefined);
        if (parentSlice && stableStringify(parentSlice) === stableStringify(built.settings)) {
            lastEmbeddedPushKeyRef.current = key;
            return;
        }
        lastEmbeddedPushKeyRef.current = key;
        onConfigureApply(built.mode, built.settings);
        lastSyncedEmbeddedParentModeRef.current = built.mode;
    }, [embeddedPanel, configureOnly, onConfigureApply, buildFinalSettingsForApply, embeddedParentDraftFingerprint]);

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

    /** 방 만들기 임베드(핸드헬드)·「방 정보·대국 설정」단계에서만 그리드·타이포 추가 축소 */
    const handheldPairRoomDetailsCompact = Boolean(
        useLobbyDenseGameSettingsLayout &&
            pairRoomEmbeddedRightSlot &&
            isMobile &&
            pairRoomHandheldCreateStackedFooter &&
            pairEmbedMobileStep === 'details',
    );
    /** 손님 조건 변경 제안 모달(모바일): 라벨·드롭다운 가로 2분할 대신 세로 스택 + 바깥은 1열 그리드 */
    const proposeMobileStackedLayout = Boolean(pairRoomLobbyChangePropose && isMobile && pairRoomEmbeddedRightSlot);
    /** PC·모바일 방 만들기·AI 경기장 임베드: 대국 설정 드롭다운을 가로 3열 */
    const pairRoomCreateThreeColumnGrid = Boolean(
        useLobbyDenseGameSettingsLayout &&
            !proposeMobileStackedLayout &&
            (pairRoomEmbeddedRightSlot ||
                (embeddedPanel && embeddedPanelStackedLayout && !configureOnly)) &&
            (!isMobile ||
                (pairRoomHandheldCreateStackedFooter && pairEmbedMobileStep === 'details')),
    );

    // 게임 모드별 설정 UI 렌더링
    const renderGameSettings = () => {
        if (!selectedGameMode) {
            if (pairRoomEmbeddedRightSlot) {
                return <div className="min-h-[4.5rem]" aria-hidden />;
            }
            return (
                <div className="text-center text-gray-400 py-8">
                    좌측에서 게임 모드를 선택하세요
                </div>
            );
        }

        if (pairDuoRankedLobbyReadOnly) {
            const ruleRows = buildPairArenaDuoRankedLobbySettingRows(selectedGameMode);
            const handheldCompact = isMobile && pairRoomHandheldCreateStackedFooter;
            return (
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden pr-1 text-on-panel">
                    <p className="text-[11px] leading-snug text-amber-100/95 sm:text-xs">
                        2인 랭킹전은 팀당 <span className="font-bold text-amber-200">유저 2명</span>이 한 팀이 되어, 다른 팀(유저 2명)과 매칭됩니다. 아래 규칙은 선택한 종목의{' '}
                        <span className="font-bold">공식 랭킹전 설정</span>과 동일하며 변경할 수 없습니다.
                    </p>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-cyan-100 sm:text-sm">랭킹전 적용 규칙</p>
                        <h4 className="mb-0 mt-1.5 flex-shrink-0 text-xs font-semibold text-gray-300 sm:mt-2 sm:text-sm">대국 설정</h4>
                        {ruleRows.length > 0 ? (
                            <div
                                className={
                                    handheldCompact
                                        ? `${LOBBY_DENSE_SETTINGS_GRID_CONTAINER_CLASS} mt-1.5 ${LOBBY_DENSE_SETTINGS_RESPONSIVE_COLS_GRID_CLASS} sm:mt-2`
                                        : pairRoomCreateThreeColumnGrid
                                          ? `${LOBBY_DENSE_SETTINGS_GRID_CONTAINER_CLASS} mt-1.5 ${LOBBY_DENSE_SETTINGS_RESPONSIVE_COLS_GRID_CLASS} sm:mt-2`
                                          : pairRoomEmbeddedRightSlot
                                            ? 'mt-1.5 grid w-full min-w-0 grid-cols-2 content-start justify-center gap-x-2.5 gap-y-2 sm:mt-2 [&>div]:min-w-0'
                                            : `mt-1.5 sm:mt-2 ${PAIR_LOBBY_DENSE_SETTINGS_RULE_GRID_CLASS}`
                                }
                            >
                                {ruleRows.map((row, idx) => (
                                    <div
                                        key={`${row.label}:${idx}`}
                                        className={`${PAIR_LOBBY_DENSE_SETTING_ROW_CLASS}${
                                            handheldCompact ? ` ${HANDHELD_PAIR_DUO_RANKED_RULE_ROW_EXTRA_CLASS}` : ''
                                        }`}
                                    >
                                        <label className={`flex-shrink-0 font-semibold text-gray-300 ${handheldCompact ? '' : 'text-sm'}`}>
                                            {row.label}
                                        </label>
                                        <div className={PAIR_LOBBY_DENSE_SETTING_VALUE_READONLY_CLASS} title={row.value}>
                                            {row.value}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-2 text-sm text-zinc-400">표시할 규칙이 없습니다.</p>
                        )}
                    </div>
                </div>
            );
        }

        const denseSettings = useLobbyDenseGameSettingsLayout;
        /** 핸드헬드 「방 만들기」2단계만 극소 타이포 — 그 외 로비·AI 임베드는 가독성 우선 */
        const lobbySettingsTypographyCompact = Boolean(denseSettings && handheldPairRoomDetailsCompact);
        /** 단독 AI 모달(모바일): `PAIR_LOBBY_DENSE_SETTINGS_RULE_GRID_CLASS`의 14rem 열 때문에 1열로 붕괴하지 않도록 2열 고정 */
        const handheldStandaloneAiSettingsGrid = Boolean(denseSettings && layoutMobile);
        /** 로비 임베드 AI(전략·놀이·페어) 모바일: 드롭다운 설정을 가로 2열로 */
        const embeddedStackedAiSettingsGrid = Boolean(
            denseSettings &&
                embeddedPanel &&
                embeddedPanelStackedLayout &&
                !configureOnly &&
                !pairRoomEmbeddedRightSlot &&
                !pairRoomCreateThreeColumnGrid,
        );
        const aiSettingsTwoColumnGrid = handheldStandaloneAiSettingsGrid || embeddedStackedAiSettingsGrid;
        /** 핸드헬드 「방 만들기」2단계: 드롭다운·라벨을 단독 AI 모달 본문과 동일한 본문 크기(text-sm)에 맞춤 */
        const handheldRoomCreateDenseTypography = Boolean(denseSettings && isMobile && pairRoomHandheldCreateStackedFooter);
        const gameSettingsSelectClass = proposeMobileStackedLayout
            ? 'h-9 min-h-9 w-full box-border rounded-lg border border-white/15 bg-black/35 pl-2 pr-9 text-left text-sm font-semibold leading-tight text-slate-100 outline-none ring-0 focus:border-cyan-400/50 disabled:opacity-50'
            : denseSettings
              ? lobbySettingsTypographyCompact
                  ? 'h-8 min-h-8 w-full min-w-0 box-border rounded-lg border border-white/15 bg-black/35 pl-2 pr-9 text-left text-[13px] font-semibold leading-tight text-slate-100 outline-none ring-0 focus:border-cyan-400/50 disabled:opacity-50'
                  : aiSettingsTwoColumnGrid
                    ? 'h-9 min-h-9 w-full min-w-0 box-border rounded-lg border border-white/15 bg-black/35 pl-2 pr-9 text-left text-sm font-semibold leading-tight text-slate-100 outline-none ring-0 focus:border-cyan-400/50 disabled:opacity-50'
                    : 'h-10 min-h-10 w-full min-w-[5.5rem] box-border rounded-lg border border-white/15 bg-black/35 pl-2 pr-10 text-left text-sm font-semibold text-slate-100 outline-none ring-0 focus:border-cyan-400/50 disabled:opacity-50'
              : 'w-full bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5 lg:p-2';
        const gameSettingsSelectFlexClass = proposeMobileStackedLayout
            ? 'h-9 min-h-9 w-full flex-1 box-border rounded-lg border border-white/15 bg-black/35 pl-2 pr-9 text-left text-sm font-semibold leading-tight text-slate-100 outline-none ring-0 focus:border-cyan-400/50'
            : denseSettings
              ? lobbySettingsTypographyCompact
                  ? 'h-8 min-h-8 w-full min-w-0 flex-1 box-border rounded-lg border border-white/15 bg-black/35 pl-2 pr-9 text-left text-[13px] font-semibold leading-tight text-slate-100 outline-none ring-0 focus:border-cyan-400/50'
                  : aiSettingsTwoColumnGrid
                    ? 'h-9 min-h-9 w-full min-w-0 flex-1 box-border rounded-lg border border-white/15 bg-black/35 pl-2 pr-9 text-left text-sm font-semibold leading-tight text-slate-100 outline-none ring-0 focus:border-cyan-400/50'
                    : 'h-10 min-h-10 w-full min-w-[5.5rem] flex-1 box-border rounded-lg border border-white/15 bg-black/35 pl-2 pr-10 text-left text-sm font-semibold text-slate-100 outline-none ring-0 focus:border-cyan-400/50'
              : 'flex-1 bg-gray-700 border border-gray-600 text-center text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2';
        const denseLobbyAccentLabelClass = lobbyType === 'playful' ? 'text-amber-100' : 'text-cyan-100';
        const gameSettingsLabelClass = proposeMobileStackedLayout
            ? lobbyType === 'playful'
                ? 'pl-0.5 text-left text-xs font-bold leading-snug text-amber-100/90 sm:text-[13px]'
                : 'pl-0.5 text-left text-xs font-bold leading-snug text-cyan-100/90 sm:text-[13px]'
            : denseSettings
              ? lobbySettingsTypographyCompact
                  ? `min-w-0 w-full text-left text-[10px] font-bold leading-tight ${denseLobbyAccentLabelClass}`
                  : handheldRoomCreateDenseTypography
                    ? `min-w-0 w-full text-left text-sm font-bold leading-tight ${denseLobbyAccentLabelClass}`
                    : aiSettingsTwoColumnGrid
                      ? `min-w-0 w-full text-left text-xs font-bold leading-tight sm:text-[13px] ${denseLobbyAccentLabelClass}`
                      : `min-w-0 w-full text-left text-sm font-bold leading-tight ${denseLobbyAccentLabelClass}`
              : 'font-semibold text-gray-300 flex-shrink-0 text-sm sm:text-base';

        const showBoardSize = ![GameMode.Alkkagi, GameMode.Curling, GameMode.Dice].includes(selectedGameMode);
        const showKomi = ![GameMode.Capture, GameMode.Omok, GameMode.Ttamok, GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Thief, GameMode.Base, GameMode.Chess].includes(selectedGameMode);
        /** 알까기·컬링·주사위·도둑은 시계 UI 없음. 페어 4인·2인 친선은 사람 대전이므로 시계 표시 */
        const modesWithoutClockUi = [GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Thief];
        const mixModes = settings.mixedModes ?? [];
        const isMixMode = selectedGameMode === GameMode.Mix;
        const showSpeedTimeControls =
            selectedGameMode === GameMode.Speed || (isMixMode && mixModes.includes(GameMode.Speed));
        const showCastleCount = selectedGameMode === GameMode.Castle || (isMixMode && mixModes.includes(GameMode.Castle));
        const showChessPieceTotalScore = selectedGameMode === GameMode.Chess && settings.boardSize === 13;
        const showTimeControls =
            pairFriendlyHumanClock &&
            !modesWithoutClockUi.includes(selectedGameMode);
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
        const showScoringTurnLimit = !hideScoringTurnLimit && showGoAiLevel && !captureRuleSelected && selectedGameMode !== GameMode.Castle && selectedGameMode !== GameMode.Chess;

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

        const boardSizeOptions =
            selectedGameMode === GameMode.Mix
                ? getMixBoardSizeOptions(settings.mixedModes)
                : selectedGameMode != null
                  ? getAiChallengeBoardSizes(selectedGameMode, lobbyType)
                  : BOARD_SIZES;
        const requiredScoringTurnLimit = getAiScoringTurnLimitByBoardSize(settings.boardSize);
        const scoringTurnLimitOptions = getScoringTurnLimitOptionsByBoardSize(settings.boardSize);
        const nonZeroScoringTurnLimitOptions = scoringTurnLimitOptions.includes(requiredScoringTurnLimit)
            ? [requiredScoringTurnLimit]
            : [requiredScoringTurnLimit];

        const defaultSettingRowClass = 'grid grid-cols-2 gap-2 items-center';
        const settingRowClass = proposeMobileStackedLayout
            ? PAIR_LOBBY_CHANGE_PROPOSE_HANDHELD_ROW_CLASS
            : denseSettings
              ? `${PAIR_LOBBY_DENSE_SETTING_ROW_CLASS}${
                    handheldPairRoomDetailsCompact
                        ? ` ${HANDHELD_PAIR_ROOM_CREATE_DETAILS_SETTING_ROW_EXTRA_CLASS}`
                        : aiSettingsTwoColumnGrid
                          ? ` ${HANDHELD_STANDALONE_AI_SETTING_ROW_EXTRA_CLASS}`
                          : ''
                }`
              : defaultSettingRowClass;

        const useResponsiveDenseSettingsGrid = Boolean(
            denseSettings &&
                (aiSettingsTwoColumnGrid ||
                    pairRoomCreateThreeColumnGrid ||
                    (handheldPairRoomDetailsCompact && pairRoomEmbeddedRightSlot)),
        );
        const denseSettingsGridClass = proposeMobileStackedLayout
            ? 'grid w-full min-h-0 auto-rows-min min-w-0 grid-cols-1 content-start gap-y-1.5 overflow-y-auto overflow-x-hidden pr-1 [&>div]:min-w-0'
            : useResponsiveDenseSettingsGrid
              ? `${LOBBY_DENSE_SETTINGS_RESPONSIVE_COLS_GRID_CLASS} h-full max-h-full`
              : pairRoomEmbeddedRightSlot
                ? 'grid w-full min-h-0 auto-rows-min min-w-0 content-start justify-center gap-x-2.5 gap-y-2 overflow-y-auto overflow-x-hidden pr-1 grid-cols-2 [&>div]:min-w-0'
                : pairRoomCreateThreeColumnGrid
                  ? `${LOBBY_DENSE_SETTINGS_RESPONSIVE_COLS_GRID_CLASS} h-full max-h-full`
                  : `${PAIR_LOBBY_DENSE_SETTINGS_RULE_GRID_CLASS} h-full max-h-full overflow-y-auto overflow-x-hidden pr-1`;

        return (
            <div
                className={
                    denseSettings
                        ? pairRoomEmbeddedRightSlot
                            ? proposeMobileStackedLayout
                                ? denseSettingsGridClass
                                : `${LOBBY_DENSE_SETTINGS_GRID_CONTAINER_CLASS} min-h-0 flex-1 ${denseSettingsGridClass}${
                                      handheldPairRoomDetailsCompact ? ' gap-x-1 gap-y-0.5' : ''
                                  }`
                            : useResponsiveDenseSettingsGrid || pairRoomCreateThreeColumnGrid
                              ? `${LOBBY_DENSE_SETTINGS_GRID_CONTAINER_CLASS} min-h-0 flex-1 ${denseSettingsGridClass}`
                              : denseSettingsGridClass
                        : 'flex h-full flex-col gap-2 overflow-y-auto pr-2'
                }
            >
                {showGoAiLevel && (
                    <div className={settingRowClass}>
                        <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>AI단계</label>
                        <select
                            value={settings.kataServerLevel ?? -12}
                            onChange={e => handleSettingChange('kataServerLevel', parseInt(e.target.value, 10))}
                            className={gameSettingsSelectClass}
                            style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                        >
                            {AI_LEVELS.map(({ value, label }) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                )}

                {showBoardSize && (
                    <div className={settingRowClass}>
                        <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>판 크기</label>
                        <select 
                            value={settings.boardSize} 
                            onChange={e => handleSettingChange('boardSize', parseInt(e.target.value, 10) as GameSettings['boardSize'])}
                            className={gameSettingsSelectClass}
                            style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                        >
                            {boardSizeOptions.map(size => (
                                <option key={size} value={size}>{size}줄</option>
                            ))}
                        </select>
                    </div>
                )}

                {showScoringTurnLimit && (
                    <div className={settingRowClass}>
                        <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>계가까지 턴</label>
                        <select 
                            value={requiredScoringTurnLimit}
                            onChange={e => handleSettingChange('scoringTurnLimit', parseInt(e.target.value, 10))}
                            disabled
                            className={gameSettingsSelectClass}
                            style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
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
                    const mixEmbedCompactHeader = denseSettings && pairRoomEmbeddedRightSlot;
                    const mixCheckboxes = SPECIAL_GAME_MODES.filter(
                        (m) => m.mode !== GameMode.Standard && m.mode !== GameMode.Mix && isPlayableLobbyGameMode(m),
                    ).map((m) => {
                        const mixDisabled = isMixSubModeCheckboxDisabled(settings.mixedModes, m.mode);
                        return (
                            <label
                                key={m.mode}
                                className={`flex items-center rounded-md text-gray-200 ${
                                    denseSettings
                                        ? handheldStandaloneAiSettingsGrid
                                            ? `min-h-[2rem] w-full flex-wrap gap-1 border border-white/12 bg-gray-800/55 px-1.5 py-1 ${mixDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`
                                            : `h-7 shrink-0 flex-nowrap gap-1.5 whitespace-nowrap py-0.5 pl-1 pr-1.5 sm:gap-2 sm:pl-1.5 sm:pr-2 ${mixDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer bg-gray-700/50'}`
                                        : `gap-2 p-2 ${mixDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer bg-gray-700/50'}`
                                }`}
                                style={{
                                    fontSize: denseSettings
                                        ? lobbySettingsTypographyCompact
                                            ? `${Math.max(10, Math.round(10 * mobileTextScale))}px`
                                            : handheldStandaloneAiSettingsGrid
                                              ? `${Math.max(12, Math.round(12 * mobileTextScale))}px`
                                              : `${Math.max(13, Math.round(13 * mobileTextScale))}px`
                                        : `${Math.max(13, Math.round(15 * mobileTextScale))}px`,
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={settings.mixedModes?.includes(m.mode) ?? false}
                                    onChange={(e) => handleMixedModeChange(m.mode, e.target.checked)}
                                    disabled={mixDisabled || pairRoomLobbyChangePropose}
                                    title={mixDisabled ? '따내기와 캐슬은 동시에 선택할 수 없습니다.' : undefined}
                                    className={`flex-shrink-0 ${
                                        denseSettings
                                            ? handheldStandaloneAiSettingsGrid
                                                ? 'h-3 w-3'
                                                : 'h-3.5 w-3.5 sm:h-4 sm:w-4'
                                            : 'h-4 w-4'
                                    }`}
                                />
                                <span className="leading-tight">{mixSubRuleDisplayName(m.name)}</span>
                            </label>
                        );
                    });
                    const mixModeSettingFields = (
                        <>
                            {settings.mixedModes?.includes(GameMode.Base) && (
                                <div className={settingRowClass}>
                                    <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>베이스돌 개수</label>
                                    <select
                                        value={settings.baseStones}
                                        disabled={pairRoomLobbyChangePropose}
                                        onChange={(e) => handleSettingChange('baseStones', parseInt(e.target.value, 10))}
                                        className={gameSettingsSelectClass}
                                        style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
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
                                        <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>히든돌 개수</label>
                                        <select
                                            value={settings.hiddenStoneCount}
                                            onChange={(e) => handleSettingChange('hiddenStoneCount', parseInt(e.target.value, 10))}
                                            className={gameSettingsSelectClass}
                                            style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                                        >
                                            {AI_CHALLENGE_HIDDEN_STONE_COUNTS.map((c) => (
                                                <option key={c} value={c}>
                                                    {c}개
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className={settingRowClass}>
                                        <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>스캔 개수</label>
                                        <select
                                            value={settings.scanCount ?? AI_LOBBY_SCAN_MAX}
                                            onChange={(e) => handleSettingChange('scanCount', parseInt(e.target.value, 10))}
                                            className={gameSettingsSelectClass}
                                            style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
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
                                    <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>미사일 개수</label>
                                    <select
                                        value={settings.missileCount ?? 3}
                                        onChange={(e) => handleSettingChange('missileCount', parseInt(e.target.value, 10))}
                                        className={gameSettingsSelectClass}
                                        style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
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
                                    <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>목표점수</label>
                                    <select
                                        value={settings.captureTarget}
                                        disabled={pairRoomLobbyChangePropose}
                                        onChange={(e) => handleSettingChange('captureTarget', parseInt(e.target.value, 10))}
                                        className={gameSettingsSelectClass}
                                        style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                                    >
                                        {CAPTURE_TARGETS.map((t) => (
                                            <option key={t} value={t}>
                                                {t}개
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {settings.mixedModes?.includes(GameMode.Castle) && (
                                <div className={settingRowClass}>
                                    <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>캐슬</label>
                                    <select
                                        value={settings.castleCount ?? getDefaultCastleCountByBoardSize(settings.boardSize ?? 13)}
                                        disabled={pairRoomLobbyChangePropose}
                                        onChange={(e) => handleSettingChange('castleCount', parseInt(e.target.value, 10) as GameSettings['castleCount'])}
                                        className={gameSettingsSelectClass}
                                        style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                                    >
                                        {getCastleCountsByBoardSize(settings.boardSize ?? 13).map((c) => (
                                            <option key={c} value={c}>
                                                {c}개
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </>
                    );
                    return (
                        <>
                            <div
                                className={`w-full min-w-0 border-t border-gray-700 ${denseSettings ? 'col-span-full mt-1 pt-2' : 'mt-1 pt-3'}`}
                            >
                                {mixEmbedCompactHeader ? (
                                    <div className="min-w-0 space-y-1">
                                        <h3
                                            className="mb-0 text-sm font-semibold leading-tight text-gray-300 sm:text-[15px]"
                                        >
                                            믹스룰
                                        </h3>
                                        <div className="flex min-h-[1.75rem] min-w-0 flex-nowrap gap-1 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                            {mixCheckboxes}
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <h3
                                            className={`font-semibold text-gray-300 ${denseSettings ? 'mb-1 text-sm sm:text-[15px]' : 'mb-1 text-base'}`}
                                        >
                                            믹스룰
                                        </h3>
                                        <div
                                            className={
                                                denseSettings
                                                    ? handheldStandaloneAiSettingsGrid
                                                        ? 'grid min-w-0 grid-cols-2 gap-1'
                                                        : 'flex min-w-0 flex-nowrap gap-1 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
                                                    : 'grid grid-cols-2 gap-2 text-sm'
                                            }
                                        >
                                            {mixCheckboxes}
                                        </div>
                                    </>
                                )}
                            </div>
                            {mixModeSettingFields}
                        </>
                    );
                })()}

                {showKomi && (
                    <div className={settingRowClass}>
                        <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>덤 (백)</label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                step="1" 
                                min={AI_LOBBY_KOMI_MIN_INTEGER}
                                max={AI_LOBBY_KOMI_MAX_INTEGER}
                                disabled={pairRoomLobbyChangePropose}
                                value={Math.floor(settings.komi)} 
                                onChange={(e) =>
                                    handleSettingChange(
                                        'komi',
                                        clampGameInt(parseInt(e.target.value, 10) || AI_LOBBY_KOMI_MIN_INTEGER, {
                                            min: AI_LOBBY_KOMI_MIN_INTEGER,
                                            max: AI_LOBBY_KOMI_MAX_INTEGER,
                                        }) + 0.5,
                                    )
                                }
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            />
                            <span className="font-bold text-gray-300 whitespace-nowrap" style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}>.5 집</span>
                        </div>
                    </div>
                )}

                {showTimeControls && (
                    <StrategicTimeControlFields
                        settings={settings}
                        onSettingsChange={setSettings}
                        isSpeed={showSpeedTimeControls}
                        variant="custom"
                        rowClassName={settingRowClass}
                        labelClassName={gameSettingsLabelClass}
                        selectClassName={gameSettingsSelectClass}
                        labelStyle={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                        selectStyle={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                    />
                )}

                {showCaptureTarget && (
                    <div className={settingRowClass}>
                        <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>포획 목표</label>
                        <select 
                            value={settings.captureTarget} 
                            disabled={pairRoomLobbyChangePropose}
                            onChange={e => handleSettingChange('captureTarget', parseInt(e.target.value))}
                            className={gameSettingsSelectClass}
                            style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                        >
                            {CAPTURE_TARGETS.map(t => <option key={t} value={t}>{t}점</option>)}
                        </select>
                    </div>
                )}

                {showTtamokCaptureTarget && (
                    <div className={settingRowClass}>
                        <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>포획 목표</label>
                        <select 
                            value={settings.captureTarget || 5} 
                            disabled={pairRoomLobbyChangePropose}
                            onChange={e => handleSettingChange('captureTarget', parseInt(e.target.value))}
                            className={gameSettingsSelectClass}
                            style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                        >
                            {TTAMOK_CAPTURE_TARGETS.map(t => <option key={t} value={t}>{t}점</option>)}
                        </select>
                    </div>
                )}

                {showOmokForbiddenRules && (
                    <>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>삼삼 금지</label>
                            <input 
                                type="checkbox" 
                                checked={settings.has33Forbidden ?? true} 
                                onChange={e => handleSettingChange('has33Forbidden', e.target.checked)} 
                                className="w-5 h-5"
                            />
                        </div>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>장목 금지</label>
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
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>삼삼 금지</label>
                            <input 
                                type="checkbox" 
                                checked={settings.has33Forbidden ?? true} 
                                onChange={e => handleSettingChange('has33Forbidden', e.target.checked)} 
                                className="w-5 h-5"
                            />
                        </div>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>장목 금지</label>
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
                        <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>순서</label>
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
                            className={gameSettingsSelectClass}
                            style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
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
                        <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>역할</label>
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
                            className={gameSettingsSelectClass}
                            style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                        >
                            <option value="random">랜덤</option>
                            <option value="thief">도둑 (흑)</option>
                            <option value="police">경찰 (백)</option>
                        </select>
                    </div>
                    ) : null}
                    <div className={settingRowClass}>
                        <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>(고)주사위</label>
                        <select
                            value={settings.thiefHigh36ItemCount ?? 1}
                            onChange={(e) => handleSettingChange('thiefHigh36ItemCount', parseInt(e.target.value, 10))}
                            className={gameSettingsSelectClass}
                            style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                        >
                            {DICE_GO_ITEM_COUNTS.map((c) => (
                                <option key={c} value={c}>
                                    {c}개
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className={settingRowClass}>
                        <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>방지주사위</label>
                        <select
                            value={settings.thiefNoOneItemCount ?? 1}
                            onChange={(e) => handleSettingChange('thiefNoOneItemCount', parseInt(e.target.value, 10))}
                            className={gameSettingsSelectClass}
                            style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                        >
                            {DICE_GO_ITEM_COUNTS.map((c) => (
                                <option key={c} value={c}>
                                    {c}개
                                </option>
                            ))}
                        </select>
                    </div>
                    </>
                )}

                {showBaseStones && (
                    <div className={settingRowClass}>
                        <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>베이스 돌</label>
                        <select 
                            value={settings.baseStones} 
                            disabled={pairRoomLobbyChangePropose}
                            onChange={e => handleSettingChange('baseStones', parseInt(e.target.value))}
                            className={gameSettingsSelectClass}
                            style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                        >
                            {AI_CHALLENGE_BASE_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                        </select>
                    </div>
                )}

                {showHiddenStones && (
                    <>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>히든아이템</label>
                            <select 
                                value={settings.hiddenStoneCount} 
                                onChange={e => handleSettingChange('hiddenStoneCount', parseInt(e.target.value))}
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {AI_CHALLENGE_HIDDEN_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>스캔아이템</label>
                            <select 
                                value={settings.scanCount || AI_LOBBY_SCAN_MAX} 
                                onChange={e => handleSettingChange('scanCount', parseInt(e.target.value))}
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {AI_CHALLENGE_SCAN_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                    </>
                )}

                {showMissileCount && (
                    <div className={settingRowClass}>
                        <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>미사일 개수</label>
                        <select 
                            value={settings.missileCount || 3} 
                            onChange={e => handleSettingChange('missileCount', parseInt(e.target.value))}
                            className={gameSettingsSelectClass}
                            style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                        >
                            {AI_CHALLENGE_MISSILE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                        </select>
                    </div>
                )}

                {selectedGameMode === GameMode.Chess && settings.boardSize === 9 && (
                    <div className={settingRowClass}>
                        <label className={gameSettingsLabelClass}>기물 총점수</label>
                        <div className={gameSettingsSelectClass}>9점 (고정)</div>
                    </div>
                )}

                {showChessPieceTotalScore && (
                    <div className={settingRowClass}>
                        <label className={gameSettingsLabelClass}>기물 총점수</label>
                        <select
                            value={settings.chessPieceTotalScore ?? getDefaultChessPieceTotalScore(13)}
                            onChange={(e) => handleSettingChange('chessPieceTotalScore', parseInt(e.target.value, 10))}
                            className={gameSettingsSelectClass}
                        >
                            {getChessPieceTotalScoreOptions(13).map((score) => (
                                <option key={score} value={score}>
                                    {score}점
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {showCastleCount && (
                    <>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>캐슬</label>
                            <select
                                value={settings.castleCount ?? getDefaultCastleCountByBoardSize(settings.boardSize ?? 13)}
                                onChange={e => handleSettingChange('castleCount', parseInt(e.target.value, 10) as GameSettings['castleCount'])}
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {getCastleCountsByBoardSize(settings.boardSize ?? 13).map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                    </>
                )}

                {showDiceGoSettings && (
                    <>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>라운드</label>
                            <select 
                                value={settings.diceGoRounds ?? 3} 
                                onChange={e => handleSettingChange('diceGoRounds', parseInt(e.target.value, 10) as 1 | 2 | 3)}
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {[1, 2, 3].map(r => <option key={r} value={r}>{r}라운드</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>홀수주사위</label>
                            <select
                                value={settings.oddDiceCount ?? 1}
                                onChange={(e) => handleSettingChange('oddDiceCount', parseInt(e.target.value, 10))}
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {DICE_GO_ITEM_COUNTS.map((c) => (
                                    <option key={c} value={c}>
                                        {c}개
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>짝수주사위</label>
                            <select
                                value={settings.evenDiceCount ?? 1}
                                onChange={(e) => handleSettingChange('evenDiceCount', parseInt(e.target.value, 10))}
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {DICE_GO_ITEM_COUNTS.map((c) => (
                                    <option key={c} value={c}>
                                        {c}개
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>(고)주사위</label>
                            <select
                                value={settings.highDiceCount ?? 1}
                                onChange={(e) => handleSettingChange('highDiceCount', parseInt(e.target.value, 10))}
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {DICE_GO_ITEM_COUNTS.map((c) => (
                                    <option key={c} value={c}>
                                        {c}개
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>(저)주사위</label>
                            <select
                                value={settings.lowDiceCount ?? 1}
                                onChange={(e) => handleSettingChange('lowDiceCount', parseInt(e.target.value, 10))}
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {DICE_GO_ITEM_COUNTS.map((c) => (
                                    <option key={c} value={c}>
                                        {c}개
                                    </option>
                                ))}
                            </select>
                        </div>
                    </>
                )}

                {showAlkkagiSettings && (
                    <>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>돌 개수</label>
                            <select 
                                value={settings.alkkagiStoneCount ?? 5} 
                                onChange={e => handleSettingChange('alkkagiStoneCount', parseInt(e.target.value))}
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {ALKKAGI_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>라운드</label>
                            <select 
                                value={settings.alkkagiRounds ?? 3} 
                                onChange={e => handleSettingChange('alkkagiRounds', parseInt(e.target.value) as 1 | 2 | 3)}
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {ALKKAGI_ROUNDS.map(r => <option key={r} value={r}>{r}라운드</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>배치 방식</label>
                            <select 
                                value={settings.alkkagiPlacementType ?? AlkkagiPlacementType.TurnByTurn} 
                                onChange={e => handleSettingChange('alkkagiPlacementType', e.target.value as AlkkagiPlacementType)}
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {Object.values(AlkkagiPlacementType).map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>힘 속도</label>
                            <select 
                                value={settings.alkkagiGaugeSpeed ?? 700} 
                                onChange={e => handleSettingChange('alkkagiGaugeSpeed', parseInt(e.target.value))}
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {ALKKAGI_GAUGE_SPEEDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>슬로우</label>
                            <select 
                                value={settings.alkkagiSlowItemCount ?? 2} 
                                onChange={e => handleSettingChange('alkkagiSlowItemCount', parseInt(e.target.value))}
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {ALKKAGI_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>조준선</label>
                            <select 
                                value={settings.alkkagiAimingLineItemCount ?? 2} 
                                onChange={e => handleSettingChange('alkkagiAimingLineItemCount', parseInt(e.target.value))}
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {ALKKAGI_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                    </>
                )}

                {showCurlingSettings && (
                    <>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>돌 개수</label>
                            <select 
                                value={settings.curlingStoneCount ?? 5} 
                                onChange={e => handleSettingChange('curlingStoneCount', parseInt(e.target.value))}
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {CURLING_STONE_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>라운드</label>
                            <select 
                                value={settings.curlingRounds ?? 3} 
                                onChange={e => handleSettingChange('curlingRounds', parseInt(e.target.value) as 1 | 2 | 3)}
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {CURLING_ROUNDS.map(r => <option key={r} value={r}>{r}라운드</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>힘 속도</label>
                            <select 
                                value={settings.curlingGaugeSpeed ?? 700} 
                                onChange={e => handleSettingChange('curlingGaugeSpeed', parseInt(e.target.value))}
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {CURLING_GAUGE_SPEEDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>슬로우</label>
                            <select 
                                value={settings.curlingSlowItemCount ?? 2} 
                                onChange={e => handleSettingChange('curlingSlowItemCount', parseInt(e.target.value))}
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {CURLING_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                        <div className={settingRowClass}>
                            <label className={gameSettingsLabelClass} style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}>조준선</label>
                            <select 
                                value={settings.curlingAimingLineItemCount ?? 2} 
                                onChange={e => handleSettingChange('curlingAimingLineItemCount', parseInt(e.target.value))}
                                className={gameSettingsSelectClass}
                                style={denseSettings ? undefined : { fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {CURLING_ITEM_COUNTS.map(c => <option key={c} value={c}>{c}개</option>)}
                            </select>
                        </div>
                    </>
                )}
            </div>
        );
    };

    const useStackedInlineLayout = embeddedPanel && embeddedPanelStackedLayout && !configureOnly;
    const pairRoomConfigureStackedLayout = Boolean(
        embeddedPanelStackedLayout && embeddedPanel && configureOnly && pairRoomEmbeddedRightSlot,
    );

    const modeBriefFallback =
        useStackedInlineLayout || pairRoomConfigureStackedLayout
            ? lobbyType === 'strategic'
                ? '위에서 게임 모드를 고른 뒤, 아래에서 판 크기·시간·AI 난이도 등을 설정합니다.'
                : '위에서 놀이 모드를 고른 뒤, 아래에서 대국 옵션을 설정합니다.'
            : lobbyType === 'strategic'
              ? '왼쪽에서 게임 모드를 고른 뒤, 아래에서 판 크기·시간·AI 난이도 등을 설정합니다.'
              : '왼쪽에서 놀이 모드를 고른 뒤, 아래에서 대국 옵션을 설정합니다.';

    /** 모바일 단독 AI 모달 상단과 동일: 선택 모드 아이콘 + 간략 설명 */
    const selectedModeBriefSummaryPanel = (
        <div className="relative z-[1] shrink-0 rounded-xl border border-white/10 bg-black/25 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="flex items-stretch gap-2.5">
                <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1 self-start sm:w-[5.25rem]">
                    {selectedGameDefinition ? (
                        <>
                            <div className="flex h-14 w-full items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-zinc-800/85 p-1 shadow-inner sm:h-16">
                                <img src={selectedGameDefinition.image} alt="" className="max-h-full max-w-full object-contain" />
                            </div>
                            <span
                                className={`w-full text-center text-[11px] font-extrabold leading-tight line-clamp-2 ${modeTitleToneClass}`}
                            >
                                {selectedGameDefinition.name}
                            </span>
                        </>
                    ) : (
                        <span className="text-center text-[10px] leading-snug text-zinc-500">모드를 선택하세요</span>
                    )}
                </div>
                <div className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2">
                    <p className="text-[11px] leading-snug text-zinc-300 line-clamp-5">
                        {lobbyGameModeBriefDescription(selectedGameDefinition?.description, modeBriefFallback)}
                    </p>
                </div>
            </div>
        </div>
    );

    /** PC 방 만들기 임베드 우측 열 상단 — `innerBody` 우측과 동일한 타이포·레이아웃 */
    const embeddedPcRightColumnModeBriefPanel = (
        <div className="shrink-0 rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="flex items-stretch gap-4">
                <div className="flex w-[5.5rem] shrink-0 flex-col items-center gap-2 sm:w-28">
                    {selectedGameDefinition ? (
                        <>
                            <div className="flex h-[4.5rem] w-full items-center justify-center overflow-hidden rounded-xl border border-white/12 bg-zinc-800/90 p-1.5 shadow-inner sm:h-24">
                                <img src={selectedGameDefinition.image} alt="" className="max-h-full max-w-full object-contain" />
                            </div>
                            <h4
                                className={`w-full text-center font-bold leading-snug line-clamp-3 ${modeTitleToneClass}`}
                                style={{ fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                            >
                                {selectedGameDefinition.name}
                            </h4>
                        </>
                    ) : (
                        <span
                            className="text-center text-zinc-500"
                            style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                        >
                            게임 모드를 선택하세요
                        </span>
                    )}
                </div>
                <div className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
                    <p
                        className="text-tertiary leading-relaxed"
                        style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                    >
                        {lobbyGameModeBriefDescription(selectedGameDefinition?.description, modeBriefFallback)}
                    </p>
                </div>
            </div>
        </div>
    );

    const desktopModePickerInner = (
        <>
            <h3 className="mb-2 shrink-0 text-sm font-bold tracking-tight text-amber-100/95 sm:mb-3 sm:text-base">
                게임 모드 선택
            </h3>
            <div className="grid min-h-0 flex-1 touch-pan-y grid-cols-2 gap-2 overflow-y-auto overscroll-y-contain pr-2 sm:gap-3 [-webkit-overflow-scrolling:touch]">
                {lobbyGameModes.map((game) => (
                    <GameCard
                        key={game.mode}
                        mode={game.mode}
                        image={game.image}
                        displayName={game.name ?? String(game.mode)}
                        onSelect={selectGameModeForLobby}
                        isSelected={displaySelectedGameMode === game.mode}
                        chromeKind={modalChrome}
                        disabled={!isPlayableLobbyGameMode(game)}
                    />
                ))}
            </div>
        </>
    );

    const desktopGameSettingsBlock = (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {!(useLobbyDenseGameSettingsLayout && pairRoomEmbeddedRightSlot) ? (
                <h4
                    className={`mb-2 flex-shrink-0 font-semibold ${
                        useLobbyDenseGameSettingsLayout ? denseSettingsHeadingToneClass : 'text-gray-300'
                    }`}
                    style={{ fontSize: `${Math.max(14, Math.round(16 * mobileTextScale))}px` }}
                >
                    대국 설정
                </h4>
            ) : null}
            <div
                className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 ${
                    useLobbyDenseGameSettingsLayout && pairRoomEmbeddedRightSlot
                        ? handheldPairRoomDetailsCompact
                            ? 'flex flex-col justify-start'
                            : 'flex flex-col justify-center'
                        : ''
                }`}
            >
                {renderGameSettings()}
            </div>
        </div>
    );

    /** 방 만들기 임베드(`embeddedShellClass`)와 동일한 본문 테두리·배경 */
    const standaloneLobbyFrameClass = embeddedShellClass;

    /** 페어 핸드헬드 「방 만들기」2단계 푸터(`handheldPairCreateFooterClass`)와 동일 */
    const handheldAiDetailsFooterClass =
        'grid shrink-0 grid-cols-2 gap-1.5 border-t border-white/10 bg-black/50 px-3 pt-2 pb-[max(0.65rem,env(safe-area-inset-bottom))]';
    const handheldStackedFooterBtnClass =
        '!justify-center rounded-xl !py-2 !text-xs disabled:cursor-not-allowed disabled:opacity-60';

    const stackedInlineModeDescriptionBanner =
        selectedGameDefinition && !hideInlineModePicker ? (
            <GameModeDescriptionBanner
                modeName={selectedGameDefinition.name}
                modeImage={selectedGameDefinition.image}
                descriptionText={lobbyGameModeBriefDescription(selectedGameDefinition.description, modeBriefFallback)}
                chromeKind={modalChrome}
            />
        ) : null;

    const stackedInlineModePickerStrip = (
        <div className="shrink-0 border-b border-white/10 bg-gradient-to-b from-black/35 to-black/15 px-2.5 py-2.5 sm:px-3.5 sm:py-3">
            {stackedInlineModeDescriptionBanner}
            <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className={`text-sm font-extrabold tracking-tight ${modeTitleToneClass}`}>게임 모드 선택</h3>
                <span className="shrink-0 text-[10px] font-semibold text-zinc-500 sm:text-[11px]">
                    {lobbyGameModes.length}종
                </span>
            </div>
            <div className={LOBBY_HORIZONTAL_MODE_PICKER_ROW_CLASS}>
                {lobbyGameModes.map((game) => (
                    <div key={game.mode} className={LOBBY_HORIZONTAL_MODE_PICKER_ITEM_CLASS}>
                        <GameCard
                            mode={game.mode}
                            image={game.image}
                            displayName={game.name ?? String(game.mode)}
                            onSelect={selectGameModeForLobby}
                            isSelected={displaySelectedGameMode === game.mode}
                            compact
                            scrollStripItem
                            chromeKind={modalChrome}
                            disabled={!isPlayableLobbyGameMode(game)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );

    const stackedInlineStartFooter = (
        <div className="shrink-0 border-t border-white/10 bg-gradient-to-t from-black/70 via-black/50 to-black/30 px-2.5 py-2.5 sm:px-3.5 sm:py-3">
            <Button
                type="button"
                onClick={handleChallenge}
                colorScheme="none"
                disabled={!selectedGameMode || submitDisabled}
                className="min-h-[2.85rem] w-full rounded-xl border border-emerald-400/55 bg-gradient-to-r from-emerald-900/70 via-emerald-800/65 to-teal-900/60 px-5 py-2.5 text-sm font-extrabold text-emerald-50 shadow-[0_8px_24px_-8px_rgba(16,185,129,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] sm:min-h-[3rem] sm:text-base disabled:cursor-not-allowed disabled:opacity-45"
            >
                {showActionPointCost ? `${submitLabel} (⚡${actionPointCostDisplay})` : submitLabel}
            </Button>
        </div>
    );

    const mobileWizardOuterClass = isEmbeddedAiLobbyMobileWizard
        ? 'relative flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-hidden p-1.5 sm:gap-2 sm:p-2'
        : `${standaloneLobbyFrameClass} relative flex min-h-0 max-h-[min(94dvh,880px)] flex-1 flex-col gap-2 overflow-hidden p-2 sm:gap-2.5 sm:p-2.5`;

    const mobileWizardStartButtonLabel = showActionPointCost
        ? `${submitLabel} (⚡${actionPointCostDisplay})`
        : submitLabel;

    const stackedInlineBody = (
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {!hideInlineModePicker ? stackedInlineModePickerStrip : null}
            <div
                className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-2.5 py-2 sm:px-3.5 sm:py-2.5 ${
                    hideInlineModePicker ? '' : 'border-t border-white/8'
                }`}
            >
                {desktopGameSettingsBlock}
            </div>
            <div className="relative z-40 shrink-0">{stackedInlineStartFooter}</div>
        </div>
    );

    const innerBody = layoutMobile ? (
                <div className={mobileWizardOuterClass}>
                    {!isEmbeddedAiLobbyMobileWizard && modalChrome === 'ai_feature' ? (
                        <span className={aiChallengeFeatureTopHairlineClass} aria-hidden />
                    ) : null}
                    {mobileStep === 'settings' || !isEmbeddedAiLobbyMobileWizard ? (
                        <div className={aiChallengeModalHandheldSummaryOuterClass(modalChrome)}>
                            {selectedModeBriefSummaryPanel}
                        </div>
                    ) : null}

                    {mobileStep === 'pickMode' ? (
                        <div className={`${aiChallengeModalHandheldModeStepShellClass(modalChrome)} flex min-h-0 flex-1 flex-col overflow-hidden`}>
                            <GameModePickerSection
                                className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
                                chromeKind={modalChrome}
                                selectedMode={selectedGameDefinition}
                                descriptionFallback={modeBriefFallback}
                            >
                                <div className="flex shrink-0 flex-col gap-1 border-b border-white/10 pb-2">
                                    <h3 className={`text-sm font-extrabold tracking-tight ${modeTitleToneClass}`}>게임 모드 선택</h3>
                                    <p className="text-[11px] font-medium leading-snug text-zinc-400/95">
                                        항목을 눌러 선택한 뒤 「다음」에서 대국 설정으로 이동합니다.
                                    </p>
                                </div>
                                <div className={`min-h-0 flex-1 py-2 ${LOBBY_HORIZONTAL_MODE_PICKER_SCROLL_CLASS}`}>
                                    <div className={`${LOBBY_HORIZONTAL_MODE_PICKER_ROW_LAYOUT_CLASS} min-h-0 pb-1`}>
                                        {lobbyGameModes.map((game) => (
                                            <div key={game.mode} className={LOBBY_HORIZONTAL_MODE_PICKER_ITEM_CLASS}>
                                                <GameCard
                                                    mode={game.mode}
                                                    image={game.image}
                                                    displayName={game.name ?? String(game.mode)}
                                                    onSelect={selectGameModeForLobby}
                                                    isSelected={displaySelectedGameMode === game.mode}
                                                    compact
                                                    scrollStripItem
                                                    chromeKind={modalChrome}
                                                    disabled={!isPlayableLobbyGameMode(game)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </GameModePickerSection>
                            <div className={`relative z-40 shrink-0 ${handheldAiDetailsFooterClass}`}>
                                <div className="col-span-2 flex justify-center px-0.5">
                                    <Button
                                        bare
                                        colorScheme="none"
                                        onClick={() => setMobileStep('settings')}
                                        disabled={!selectedGameMode}
                                        className={`${mobileNextCtaChromeClass} w-full max-w-[min(20rem,92vw)]`}
                                    >
                                        다음 — 대국 설정
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div
                            className="relative z-[2] isolate flex min-h-0 flex-1 flex-col overflow-hidden bg-[#070708]"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="relative z-[1] flex shrink-0 items-center gap-1.5 border-b border-white/10 bg-black/30 px-2.5 py-1.5">
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
                                <span
                                    className={`min-w-0 flex-1 text-sm font-extrabold leading-tight ${
                                        useLobbyDenseGameSettingsLayout ? denseSettingsHeadingToneClass : modeTitleToneClass
                                    }`}
                                >
                                    대국 설정
                                </span>
                            </div>
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 pb-1 pt-2">
                                <div className={`min-h-0 min-w-0 flex-1 ${aiChallengeModalHandheldSettingsScrollShellClass(modalChrome)}`}>
                                    {renderGameSettings()}
                                </div>
                            </div>
                            <div className={handheldAiDetailsFooterClass}>
                                {isEmbeddedAiLobbyMobileWizard ? (
                                    <div className="col-span-2">
                                        <Button
                                            type="button"
                                            bare
                                            colorScheme="none"
                                            onClick={handleChallenge}
                                            disabled={!selectedGameMode || submitDisabled}
                                            className={`${handheldStackedFooterBtnClass} ${pairHandheldNextChromeClass} w-full !py-2.5 !text-sm`}
                                        >
                                            {mobileWizardStartButtonLabel}
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <Button
                                            type="button"
                                            bare
                                            colorScheme="none"
                                            onClick={onClose}
                                            className={`${handheldStackedFooterBtnClass} border border-white/20 bg-zinc-800/60 !font-bold !text-zinc-200`}
                                        >
                                            취소
                                        </Button>
                                        <Button
                                            type="button"
                                            bare
                                            colorScheme="none"
                                            onClick={handleChallenge}
                                            disabled={!selectedGameMode || submitDisabled}
                                            className={`${handheldStackedFooterBtnClass} ${pairHandheldNextChromeClass}`}
                                        >
                                            {mobileWizardStartButtonLabel}
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : useStackedInlineLayout ? (
                stackedInlineBody
            ) : (
                <div
                    className={
                        embeddedPanel
                            ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
                            : `${standaloneLobbyFrameClass} flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden`
                    }
                >
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:max-h-[min(82vh,760px)] lg:flex-row">
                        <div className={modePickerColumnClassName}>
                            <GameModePickerSection
                                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                                chromeKind={modalChrome}
                                selectedMode={selectedGameDefinition}
                                descriptionFallback={modeBriefFallback}
                            >
                                {desktopModePickerInner}
                            </GameModePickerSection>
                        </div>

                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-primary text-on-panel">
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden p-3 sm:p-4">
                                {!(embeddedPanel && configureOnly) ? (
                                    <div className="mb-3 shrink-0 rounded-xl border border-white/10 bg-black/25 p-3">
                                        <div className="flex items-stretch gap-4">
                                            <div className="flex w-[5.5rem] shrink-0 flex-col items-center gap-2 sm:w-28">
                                                {selectedGameDefinition ? (
                                                    <>
                                                        <div className="flex h-[4.5rem] w-full items-center justify-center overflow-hidden rounded-xl border border-white/12 bg-zinc-800/90 p-1.5 shadow-inner sm:h-24">
                                                            <img
                                                                src={selectedGameDefinition.image}
                                                                alt=""
                                                                className="max-h-full max-w-full object-contain"
                                                            />
                                                        </div>
                                                        <h4
                                                            className={`w-full text-center font-bold leading-snug line-clamp-3 ${modeTitleToneClass}`}
                                                            style={{ fontSize: `${Math.max(13, Math.round(15 * mobileTextScale))}px` }}
                                                        >
                                                            {selectedGameDefinition.name}
                                                        </h4>
                                                    </>
                                                ) : (
                                                    <span
                                                        className="text-center text-zinc-500"
                                                        style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                                    >
                                                        게임 모드를 선택하세요
                                                    </span>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
                                                <p
                                                    className="text-tertiary leading-relaxed"
                                                    style={{ fontSize: `${Math.max(12, Math.round(14 * mobileTextScale))}px` }}
                                                >
                                                    {lobbyGameModeBriefDescription(selectedGameDefinition?.description, modeBriefFallback)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                {useLobbyDenseGameSettingsLayout && !pairRoomEmbeddedRightSlot && !(embeddedPanel && configureOnly) ? (
                                    <div className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-white/10 pt-2 sm:pt-2.5">
                                        {desktopGameSettingsBlock}
                                    </div>
                                ) : (
                                    desktopGameSettingsBlock
                                )}

                                {!(embeddedPanel && configureOnly) ? (
                                    <div className="mt-3 flex shrink-0 justify-end gap-2 border-t border-white/10 pt-3 sm:mt-4 sm:gap-3 sm:pt-4">
                                        {!(embeddedPanel && !configureOnly) ? (
                                            <Button
                                                type="button"
                                                onClick={onClose}
                                                colorScheme="none"
                                                className="min-h-[2.75rem] rounded-xl border border-white/20 bg-zinc-800/60 px-5 py-2.5 text-sm font-bold text-zinc-200 sm:min-h-[2.85rem] sm:text-base"
                                            >
                                                취소
                                            </Button>
                                        ) : null}
                                        <Button
                                            type="button"
                                            onClick={handleChallenge}
                                            colorScheme="none"
                                            disabled={!selectedGameMode}
                                            className="min-h-[2.75rem] rounded-xl border border-emerald-400/50 bg-emerald-900/55 px-5 py-2.5 text-sm font-extrabold text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] sm:min-h-[2.85rem] sm:text-base disabled:cursor-not-allowed disabled:opacity-45"
                                        >
                                            {showActionPointCost ? `${submitLabel} (⚡${actionPointCostDisplay})` : submitLabel}
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        </div>
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

        /** 손님 변경 제안: 모바일에서 게임 모드 단계 생략(고정 모드 요약 + 설정 폼만) */
        if (handheldStackedCreate && pairRoomLobbyChangePropose) {
            return (
                <div className={`${embeddedPanelShellClass} relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden`}>
                    <div className="shrink-0 px-2.5 pt-2.5">{selectedModeBriefSummaryPanel}</div>
                    <div className="relative z-[2] isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#070708]">
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pt-2">
                            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
                                {pairRoomEmbeddedRightSlot(desktopGameSettingsBlock)}
                            </div>
                            {pairRoomEmbeddedColumnFooter ? (
                                <div className={handheldPairCreateFooterClass}>{pairRoomEmbeddedColumnFooter}</div>
                            ) : null}
                        </div>
                    </div>
                </div>
            );
        }

        if (handheldStackedCreate) {
            return (
                <div className={`${embeddedPanelShellClass} relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden`}>
                    <div className={`shrink-0 px-2.5 pt-2.5 ${pairEmbedMobileStep === 'details' ? 'pointer-events-none' : ''}`}>
                        {selectedModeBriefSummaryPanel}
                    </div>
                    {pairEmbedMobileStep === 'game' ? (
                        <>
                            <GameModePickerSection
                                className={`${modePickerColumnClassName} flex min-h-0 flex-1 flex-col overflow-hidden p-2.5 sm:p-4`}
                                chromeKind={modalChrome}
                                selectedMode={selectedGameDefinition}
                                descriptionFallback={modeBriefFallback}
                            >
                                <h3 className="mb-2 shrink-0 text-sm font-bold tracking-tight text-amber-100/95">게임 모드 선택</h3>
                                <div className={`min-h-0 flex-1 ${LOBBY_HORIZONTAL_MODE_PICKER_SCROLL_CLASS}`}>
                                    <div className={`${LOBBY_HORIZONTAL_MODE_PICKER_ROW_LAYOUT_CLASS} min-h-0 pb-1`}>
                                        {lobbyGameModes.map((game) => (
                                            <div key={game.mode} className={LOBBY_HORIZONTAL_MODE_PICKER_ITEM_CLASS}>
                                                <GameCard
                                                    mode={game.mode}
                                                    image={game.image}
                                                    displayName={game.name ?? String(game.mode)}
                                                    onSelect={selectGameModeForLobby}
                                                    isSelected={displaySelectedGameMode === game.mode}
                                                    compact
                                                    scrollStripItem
                                                    chromeKind={modalChrome}
                                                    disabled={!isPlayableLobbyGameMode(game)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </GameModePickerSection>
                            <div className={`relative z-40 shrink-0 ${handheldPairCreateFooterClass}`}>
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
                                    className={`${handheldStackedFooterBtn} ${pairHandheldNextChromeClass}`}
                                >
                                    다음
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div
                            className="relative z-[2] isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#070708]"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="relative z-[1] flex shrink-0 items-center gap-1.5 border-b border-white/10 bg-black/30 px-2.5 py-1.5">
                                <button type="button" className={LOBBY_MOBILE_HEADER_BACK_BTN_CLASS} onClick={() => setPairEmbedMobileStep('game')}>
                                    뒤로
                                </button>
                                <span className={`min-w-0 flex-1 text-sm font-extrabold leading-tight ${modeTitleToneClass}`}>
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

        if (pairRoomConfigureStackedLayout && !handheldStackedCreate) {
            return (
                <div className={`${embeddedPanelShellClass} relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden`}>
                    {stackedInlineModePickerStrip}
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-white/8">
                        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-1 pb-1 pt-2 sm:px-2 sm:pb-2">
                            {pairRoomEmbeddedRightSlot(desktopGameSettingsBlock)}
                        </div>
                        {showPairEmbeddedColumnFooter ? (
                            <div className="relative z-40 grid shrink-0 grid-cols-2 gap-2 border-t border-white/10 bg-black/50 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-4">
                                {pairRoomEmbeddedColumnFooter}
                            </div>
                        ) : null}
                    </div>
                </div>
            );
        }

        return (
            <div className={`${embeddedPanelShellClass} min-h-0 flex-1`}>
                <div
                    className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row ${
                        embeddedPanelFillParent ? '' : 'max-h-[min(78vh,740px)] lg:max-h-[min(82vh,760px)]'
                    }`}
                >
                    {/* 모바일 세로 레이아웃: shrink-0만 있으면 열 높이가 콘텐츠 전체로 늘어나 overflow-y-auto가 동작하지 않음 */}
                    <div className={modePickerColumnClassName}>
                        <GameModePickerSection
                            className="flex min-h-0 flex-1 flex-col overflow-hidden"
                            chromeKind={modalChrome}
                            selectedMode={pairRoomLobbyChangePropose ? null : selectedGameDefinition}
                            descriptionFallback={modeBriefFallback}
                        >
                            {pairRoomLobbyChangePropose ? (
                                <>
                                    <h3 className="mb-2 shrink-0 px-3 pt-3 text-sm font-bold tracking-tight text-amber-100/95 sm:mb-3 sm:px-4 sm:pt-4 sm:text-base">
                                        게임 모드 (방장 설정·변경 불가)
                                    </h3>
                                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 pb-3 sm:px-4 sm:pb-4">
                                        {embeddedPcRightColumnModeBriefPanel}
                                    </div>
                                </>
                            ) : (
                                desktopModePickerInner
                            )}
                        </GameModePickerSection>
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                        {!pairRoomLobbyChangePropose ? (
                            <div className="shrink-0 border-b border-white/10 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
                                {embeddedPcRightColumnModeBriefPanel}
                            </div>
                        ) : null}
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

    if (embeddedPanel && !configureOnly) {
        return (
            <div className={`${embeddedShellClass} flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden`}>
                {embeddedPanelStackedLayout ? (
                    innerBody
                ) : (
                    <div className="min-h-[240px] min-w-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain">
                        {innerBody}
                    </div>
                )}
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
            variant="store"
            containerExtraClassName="rounded-2xl"
            headerShowTitle={isMobile && mobileStep === 'pickMode'}
            headerContent={undefined}
            mobileViewportFit={isMobile}
            mobileViewportMaxHeightVh={isMobile ? NATIVE_MOBILE_MODAL_MAX_HEIGHT_VH : undefined}
            bodyPaddingClassName="!p-2 sm:!p-2.5"
        >
            {innerBody}
        </DraggableWindow>
    );
};

export default AiChallengeModal;
