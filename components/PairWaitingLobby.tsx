import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import PcLobbyCenterRightColumn from './shell/PcLobbyCenterRightColumn.js';
import PcLobbyQuickRailColumn from './shell/PcLobbyQuickRailColumn.js';
import QuickAccessSidebar from './QuickAccessSidebar.js';
import {
    PC_HOME_LEFT_COLUMN_CLASS,
    PC_LOBBY_DESKTOP_SHELL_PADDING_CLASS,
    PC_LOBBY_THREE_COLUMN_ROW_GAP_CLASS,
    PC_LOBBY_USERS_COLUMN_CLASS,
} from '../shared/constants/pcShellLayout.js';
import PlayerList from './waiting-room/PlayerList.js';
import MatchFoundModal from './waiting-room/MatchFoundModal.js';
import {
    userInUnifiedArenaLobbyUserList,
    userMatchesAggregateWaitingLobby,
} from './waiting-room/aggregateWaitingLobbyUserFilter.js';
import { ArenaLobbyNavTitleBar, type ArenaLobbyNavKind } from './waiting-room/ArenaLobbyNavTitleBar.js';
import { ArenaLobbySwitchGrid } from './waiting-room/ArenaLobbySwitchGrid.js';
import {
    AiLobbyCenterPanel,
    AiLobbyMobileWorkspace,
    AiLobbyStandaloneCenterPanel,
    AiLobbyWorkspaceProvider,
    useAiLobbyWorkspace,
    type PairAiLobbyMatchMode,
} from './waiting-room/AiLobbyInlineWorkspace.js';
import { mergeArenaEntranceAvailability } from '../constants/arenaEntrance.js';
import { isClientAdmin } from '../utils/clientAdmin.js';
import PairRoomSeatGrid, { type PairSeatMember } from './pair/PairRoomSeatGrid.js';
import PairRoomChatPanel, { type PairRoomChatScope } from './pair/PairRoomChatPanel.js';
import type { PairLobbyPetSnapshot, PairRoomChatLine, ArenaLobbyIntent } from '../types/api.js';
import type { InventoryItem } from '../types.js';
import PairPartnerInviteModal from './pair/PairPartnerInviteModal.js';
import PairPetRankedMatchOfferModal from './pair/PairPetRankedMatchOfferModal.js';
import PairPetRankedMatchModeModal, { resolveMyPairRankedTierForPairArena } from './pair/PairPetRankedMatchModeModal.js';
import AiChallengeModal, { type AiLobbyPreferredGameSettingsBucket } from './waiting-room/AiChallengeModal.js';
import RankedMatchPanel from './waiting-room/RankedMatchPanel.js';
import ChatWindow from './waiting-room/ChatWindow.js';
import { mergeWaitingRoomPublicChatMessages } from '../shared/utils/waitingRoomGlobalChatMerge.js';
import { GameMode, type GameSettings, type ServerAction } from '../types.js';
import {
    AVATAR_POOL,
    BORDER_POOL,
    DEFAULT_GAME_SETTINGS,
    PLAYFUL_GAME_MODES,
    RANKING_TIERS,
    SPECIAL_GAME_MODES,
    STRATEGIC_ACTION_POINT_COST,
    PLAYFUL_ACTION_POINT_COST,
} from '../constants.js';
import {
    baseAiLobbyActionPointCostForModeAndSettings,
    effectivePairAiLobbyApCostForUser,
    effectivePairRankedApCostForUser,
    effectiveStrategicRankedQueueApCostForUser,
    formatActionPointCostWithPetDiscount,
} from '../shared/utils/pairPetArenaApDiscount.js';
import { useScreenGuide } from '../hooks/useScreenGuide.js';
import ScreenGuideModal from './ScreenGuideModal.js';
import {
    type WaitingLobbyPanelTone,
    pairLobbyListFilterSelectClassForTone,
    pairLobbyOrphanInGamePillClass,
    pairLobbyOrphanRoomChipInGameClass,
    pairLobbyOrphanRoomChipJoinableClass,
    pairLobbyQuickJoinInnerWellClass,
    pairLobbyQuickJoinRoomNumberGoBtnClass,
    pairLobbyQuickJoinRoomNumberInputClass,
    pairLobbyQuickJoinRoomNumberRowClass,
    pairLobbyQuickJoinToolbarClass,
    pairLobbyRoomEmptyRowShellClass,
    pairLobbyRoomEmptySlotNumClass,
    pairLobbyRoomFilledCardShellClass,
    pairLobbyRoomFilledCardShellHandheldExtraClass,
    pairLobbyRoomInGameJoinSlotClass,
    pairLobbyRoomInGameJoinSlotTextClass,
    pairLobbyRoomJoinButtonClass,
    pairLobbyGameModeBadgeClass,
    pairLobbyRoomKindBadgeClass,
    pairLobbyRoomListOuterShellClass,
    pairLobbyRoomListScrollAreaClass,
    pairLobbyRoomSlotNumOccupiedClass,
    pairAggregateRoomInteriorActionBarClass,
    pairAggregateRoomInteriorActionBarHandheldClass,
    pairAggregateRoomInteriorDetailColumnHeaderClass,
    pairAggregateRoomInteriorDetailColumnOuterClass,
    pairAggregateRoomInteriorGameModeColumnClass,
    pairAggregateRoomInteriorGameModeColumnHeaderClass,
    pairAggregateRoomInteriorGameModeIconDropShadowClass,
    pairAggregateRoomInteriorGameModeNameBoxClass,
    pairAggregateRoomInteriorGameSettingsHeadingRowClass,
    pairAggregateRoomInteriorGameSettingsOuterClass,
    pairAggregateRoomInteriorHeaderDividerDesktopClass,
    pairAggregateRoomInteriorHeaderDividerHandheldClass,
    pairAggregateRoomInteriorShellClass,
    pairAggregateRoomInteriorShellHandheldClass,
    pairAggregateRoomInteriorTeamBoxClass,
    pairAggregateRoomInteriorTeamBoxHandheldClass,
    pairAggregateRoomInteriorTitleTextClass,
    pairAggregateRoomInteriorVisibilityPrivateClass,
    waitingLobbyPcCenterColumnClass,
    waitingLobbyPcPanelShellClass,
    waitingLobbyPcPanelTopHairlineClassFor,
    waitingLobbyToneFromPairChannel,
} from './waiting-room/waitingLobbyHomePanelStyles.js';
import { WaitingLobbyAnnouncementBoard, type WaitingLobbyAnnouncementBoardMode } from './waiting-room/WaitingLobbyAnnouncementBoard.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { UserStatus, type User, type UserWithStatus } from '../types.js';
import { PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE } from '../shared/constants/pairHatchery.js';
import {
    PAIR_LOBBY_FOCUS_ROOM_TAB_SESSION_KEY,
    PAIR_LOBBY_GRID_SLOT_COUNT,
    PAIR_ROOM_TITLE_MAX_CHARS,
    POST_GAME_PAIR_ROOM_RESTORE_SESSION_KEY,
    clampPairRoomTitle,
    pairLobbyGridSlotFromRoomCode,
} from '../shared/constants/pairArena.js';
import { getPairPetDefinition, getPairPetDisplayName } from '../shared/constants/petLobby.js';
import { getAiScoringTurnLimitByBoardSize } from '../shared/constants/gameSettings.js';
import { RANKED_STRATEGIC_MODES, getRankedGameSettings } from '../constants/rankedGameSettings.js';
import { PAIR_GO_GAME_MODES } from '../shared/utils/pairGameTurn.js';
import { getEquippedPairPetInventoryRow } from '../shared/utils/pairEquippedPet.js';
import { resolvePairPetMetaFromInventoryRow } from '../shared/utils/pairPetRoll.js';
import { readPairRankedBlock } from '../shared/utils/unifiedRankedStatsMigration.js';
import {
    buildPairLobbySettingChangeDiffRows,
    buildPairRoomLobbyGameSettingRows,
    normalizePairListRoomKind,
    pairLobbyGameModeIconAndName,
    pairLobbyScheduledGameModeLabel,
    sanitizePairLobbyDraftModeSettings,
    truncatePlayfulLobbySettingDisplayValue,
} from '../shared/utils/pairLobbyGameSettingRows.js';
import PairLobbySettingChangeDiffTable from './waiting-room/PairLobbySettingChangeDiffTable.js';
import { replaceAppHash, stableStringify } from '../utils/appUtils.js';
import {
    arenaLobbyHash,
    isPairAiDuoInviteOnlyRoom,
    isPairRoomVisibleInLobbyIntent,
    pairRoomRequiresLeaveConfirmation,
    roomKindsForLobbyDestination,
    isRoomKindAllowedForLobby,
} from '../shared/utils/arenaLobbyDestination.js';
import type { PairAiDuoRoomEnsureResult } from './waiting-room/AiLobbyInlineWorkspace.js';

const PAIR_ALREADY_IN_ROOM_SERVER_ERROR = '이미 참여 중인 페어 방이 있습니다.';
import { getCurrentSeason, getPreviousSeason } from '../utils/timeUtils.js';

function pairLobbyPairModeOrDefault(mode: unknown): GameMode {
    return typeof mode === 'string' && PAIR_GO_GAME_MODES.includes(mode as GameMode)
        ? (mode as GameMode)
        : GameMode.Standard;
}

function tierMetaByName(name: string | null | undefined) {
    if (!name) return null;
    return RANKING_TIERS.find((t) => t.name === name) ?? null;
}

/** `seasonHistory[시즌].pair` 문자열 기준 역대 최고 티어 + 시즌명 */
function computePairArenaAllTimeBestSeasonRecord(
    seasonHistory: UserWithStatus['seasonHistory'],
): { tierName: string; seasonName: string } | null {
    if (!seasonHistory || typeof seasonHistory !== 'object') return null;
    const tierOrder = RANKING_TIERS.map((t) => t.name);
    let best: { tierName: string; seasonName: string; idx: number } | null = null;
    for (const seasonName of Object.keys(seasonHistory)) {
        const hist = seasonHistory[seasonName];
        const stored =
            hist && typeof hist === 'object' && typeof (hist as Record<string, unknown>).pair === 'string'
                ? ((hist as Record<string, unknown>).pair as string)
                : undefined;
        if (!stored || stored === '미참여' || !tierOrder.includes(stored)) continue;
        const idx = tierOrder.indexOf(stored);
        const next = { tierName: stored, seasonName, idx };
        if (!best || idx < best.idx || (idx === best.idx && seasonName > best.seasonName)) {
            best = next;
        }
    }
    return best ? { tierName: best.tierName, seasonName: best.seasonName } : null;
}

function formatElapsedHhMmSs(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** 페어 경기장 중앙 그리드: 1번~N번 슬롯(방 코드가 정수와 일치할 때만 매칭) */
const PAIR_LOBBY_ROOM_SLOT_COLS = 1;
const PAIR_LOBBY_ROOM_SLOT_ROWS = Math.ceil(PAIR_LOBBY_GRID_SLOT_COUNT / PAIR_LOBBY_ROOM_SLOT_COLS);
/** 스크롤 뷰포트 측정 전·최소 높이 가정용 행 높이(px) — PC는 뷰÷10, 모바일은 더 큰 카드용 별도 계산 */
const PAIR_LOBBY_ROOM_SLOT_ROW_FALLBACK_PX = 58;
const PAIR_LOBBY_ROOM_SLOT_ROW_FALLBACK_HANDHELD_PX = 88;
/** 스크롤 뷰포트 측정 전·가상화 범위 계산용 최소 높이(px) */
const PAIR_LOBBY_ROOM_SLOT_VIEWPORT_FALLBACK_PX = 560;
const PAIR_LOBBY_ROOM_SLOT_VIEWPORT_FALLBACK_HANDHELD_PX = 400;
/** 입장 직후 그리드 슬롯 선로드(측정 전 5칸만 fetch 되는 문제 방지) */
const PAIR_LOBBY_ROOM_SLOT_INITIAL_FETCH_DESKTOP = 30;
const PAIR_LOBBY_ROOM_SLOT_INITIAL_FETCH_HANDHELD = 18;
const PAIR_LOBBY_ROOM_SLOT_VIRTUAL_OVERSCAN_ROWS = 4;

/** 방 내부 채팅: 전송 성공 후 전송 UI 비활성화 시간(ms) */
const PAIR_ROOM_INTERIOR_CHAT_SEND_COOLDOWN_MS = 3000;

/** 슬롯 번호 정사각형 한 변 (행 높이에 비례) */
function pairLobbySlotBoxPxForRow(rowH: number): number {
    return Math.max(32, Math.min(54, Math.round(rowH * 0.5)));
}

/** 입장 버튼 — 번호 박스보다 크게 (행 패딩·테두리를 빼고 카드 안에 맞춤) */
function pairLobbyJoinButtonBoxPxForRow(rowH: number): number {
    const fitInRow = Math.max(32, rowH - 12);
    const target = Math.round(rowH * 0.64);
    return Math.min(fitInRow, Math.max(36, Math.min(66, target)));
}

/** 방 목록 세로 스크롤 — 얇은 트랙·썸 (Firefox + WebKit) */
const PAIR_LOBBY_ROOM_LIST_SCROLLBAR_CLASS =
    '[scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.32)_transparent] [&::-webkit-scrollbar]:w-[3px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/40 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/55';

type RoomKind = 'ai_duel' | 'duo_match' | 'friendly_4p' | 'friendly_2p' | 'arena_ai';
export type PairWaitingLobbyChannel = 'pair' | 'strategic' | 'playful';

const PAIR_LOBBY_PRESENCE_CLIENT_ID_SESSION_KEY = 'sudamr_pair_lobby_presence_client_id';

/** 전략·놀이 집계 AI 등 — `AiLobbyWorkspaceProvider` 없이 중앙·유저 2열 + 퀵레일 */
const PcLobbyCenterRightWorkspace: React.FC<{
    center: React.ReactNode;
    usersPanel: React.ReactNode;
}> = ({ center, usersPanel }) => (
    <div className={`flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden ${PC_LOBBY_THREE_COLUMN_ROW_GAP_CLASS}`}>
        <PcLobbyCenterRightColumn center={center} right={usersPanel} rightClassName={PC_LOBBY_USERS_COLUMN_CLASS} />
        <PcLobbyQuickRailColumn />
    </div>
);

/** 페어 AI — `AiLobbyWorkspaceProvider` 안에서만 사용 (2인 팀 모드에 따라 유저 열 전환) */
const PairAiDesktopMainWorkspace: React.FC<{
    center: React.ReactNode;
    usersPanel: React.ReactNode;
    duoUsersPanel: React.ReactNode;
}> = ({ center, usersPanel, duoUsersPanel }) => {
    const { pairMatchMode } = useAiLobbyWorkspace();
    return (
        <div className={`flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden ${PC_LOBBY_THREE_COLUMN_ROW_GAP_CLASS}`}>
            <PcLobbyCenterRightColumn
                center={center}
                right={pairMatchMode === 'duo' ? duoUsersPanel : usersPanel}
                rightClassName={PC_LOBBY_USERS_COLUMN_CLASS}
            />
            <PcLobbyQuickRailColumn />
        </div>
    );
};
type Visibility = 'public' | 'private';

type PairRoom = {
    id: string;
    code: string;
    mode: 'pvp' | 'ai';
    pairMode: 'pvp' | 'ai';
    roomKind: RoomKind;
    visibility: Visibility;
    passwordProtected: boolean;
    phase?: 'waiting' | 'ready' | 'matching' | 'match_pending' | 'in_game';
    title: string;
    ownerId: string;
    ownerName: string;
    partnerId?: string;
    partnerName?: string;
    ownerReady: boolean;
    partnerReady: boolean;
    matchStartedAt?: number;
    pairPetMatchingQueuedAt?: number;
    pairDuoRankedLobbyProposal?: { proposalId: string; mode: GameMode; proposedAt: number };
    pairRankedPetProposal?: {
        proposalId: string;
        opponentOwnerId: string;
        opponentNickname: string;
        myRating: number;
        opponentRating: number;
        myAccepted: boolean;
        peerAccepted: boolean;
        acceptDeadlineAt?: number;
        matchKind?: 'pet' | 'duo_human';
        myPartnerAccepted?: boolean;
        peerPartnerAccepted?: boolean;
    };
    selectedGameMode?: GameMode;
    settings?: GameSettings;
    createdAt: number;
    teamA?: { members?: Array<{ id: string; name: string; kind: string; ready?: boolean }> };
    teamB?: { members?: Array<{ id: string; name: string; kind: string; ready?: boolean }> };
    pairChatMessages?: PairRoomChatLine[];
    extraPairMembers?: Array<{ id: string; name: string; ready?: boolean }>;
    /** 서버 목록·브로드캐스트에서 내려주는 유저 착석 수 */
    listOccupiedHumans?: number;
    pairRoomKickedUserIds?: string[];
    ownerLobbyPet?: PairLobbyPetSnapshot;
    opponentLobbyPet?: PairLobbyPetSnapshot;
    lobbyChannel?: 'pair' | 'strategic' | 'playful';
    pairLobbySettingChangeProposal?: {
        proposalId: string;
        fromUserId: string;
        fromUserName: string;
        createdAt: number;
        payload: {
            title?: string;
            visibility?: Visibility;
            password?: string;
            roomKind?: RoomKind;
            selectedGameMode?: GameMode;
            settings?: GameSettings;
        };
    };
    pairLobbySettingChangeCooldownUntil?: Record<string, number>;
    pairOwnerStartDeadlineAt?: number;
    pairGuestJoinOrder?: string[];
    pairPetRankedQueueShell?: boolean;
    pairAiDuoInviteShell?: boolean;
};

/** 페어 AI 로비 2인 팀 — 초대 전용 팀 로비(플래그 없는 구형 방 포함) */
function isPairAiDuoTeamLobbyContext(
    room: PairRoom | null | undefined,
    lobbyIntent: 'pvp' | 'ai',
    lobbyChannel: PairWaitingLobbyChannel,
): boolean {
    return Boolean(lobbyIntent === 'ai' && lobbyChannel === 'pair' && room?.roomKind === 'duo_match');
}

function pairLobbyMyRoomTabLabel(
    room: PairRoom,
    lobbyIntent: 'pvp' | 'ai',
    lobbyChannel: PairWaitingLobbyChannel,
): string {
    if (isPairAiDuoTeamLobbyContext(room, lobbyIntent, lobbyChannel)) return '파트너';
    return `${room.code}번방`;
}

/** 모바일: 페어 AI 2인 팀 — 파트너 슬롯은 AI설정 탭에 통합, 별도 「파트너」탭 숨김 */
function showHandheldPairLobbyMyRoomTab(
    room: PairRoom | null | undefined,
    lobbyIntent: 'pvp' | 'ai',
    lobbyChannel: PairWaitingLobbyChannel,
): boolean {
    if (!room) return false;
    if (isPairAiDuoTeamLobbyContext(room, lobbyIntent, lobbyChannel)) return false;
    return true;
}

function handheldPairLobbyRoomFocusTab(
    room: PairRoom,
    lobbyIntent: 'pvp' | 'ai',
    lobbyChannel: PairWaitingLobbyChannel,
): 'room' | 'ai' {
    if (isPairAiDuoTeamLobbyContext(room, lobbyIntent, lobbyChannel)) return 'ai';
    return 'room';
}

function lobbySpectatorPetSnapshotToInventoryItem(snap: PairLobbyPetSnapshot): InventoryItem | null {
    const tid = snap.templateId;
    const meta = snap.pairPetMeta;
    const grade = snap.grade;
    if (!tid || !meta || grade === undefined) return null;
    const def = getPairPetDefinition(tid);
    const image = snap.image ?? def?.image ?? '';
    return {
        id: `pair-lobby-spectator-${tid}-${snap.displayName}`,
        name: snap.displayName,
        description: def?.description ?? '',
        type: 'material',
        slot: null,
        quantity: 1,
        level: 1,
        isEquipped: false,
        createdAt: Date.now(),
        image,
        grade,
        stars: 0,
        templateId: tid,
        pairPetMeta: meta,
    };
}

function mergePairSeatRowPetPortraits(params: {
    room: PairRoom;
    members: Array<{ id: string; name: string; kind: string; ready?: boolean }>;
    currentUserId: string;
    viewerPortrait: string | null;
    viewerPetDisplayName: string | null;
    viewerPetName: string | null;
    viewerPetLevel: number | null;
}): PairSeatMember[] {
    const { room, members, currentUserId, viewerPortrait, viewerPetDisplayName, viewerPetName, viewerPetLevel } = params;
    const ownerId = room.ownerId;
    const oppHumanId = room.extraPairMembers?.[0]?.id;
    return members.map((m) => {
        const base: PairSeatMember = { id: m.id, name: m.name, kind: m.kind, ready: m.ready };
        if (!m.id.startsWith('pet-ai-')) return base;
        const petOwnerUserId = m.id.slice('pet-ai-'.length);
        if (petOwnerUserId === currentUserId) {
            const lobbyPetFallback =
                petOwnerUserId === ownerId
                    ? room.ownerLobbyPet?.image ?? null
                    : oppHumanId === currentUserId
                      ? room.opponentLobbyPet?.image ?? null
                      : null;
            const portrait = viewerPortrait ?? lobbyPetFallback;
            if (!viewerPetName && !portrait) return base;
            const lineName = viewerPetName || '내 펫';
            const lineLevel = viewerPetLevel != null ? `Lv.${viewerPetLevel}` : null;
            const label = viewerPetDisplayName ?? (lineLevel ? `${lineLevel} ${lineName}` : lineName);
            return {
                ...base,
                name: label,
                petLineLevel: lineLevel,
                petLineName: lineName,
                subLabel: '장착 펫',
                portraitSrc: portrait,
            };
        }
        if (petOwnerUserId === ownerId && room.ownerLobbyPet) {
            const lp = room.ownerLobbyPet;
            return {
                ...base,
                name: `Lv.${lp.level} ${lp.displayName}`,
                petLineLevel: `Lv.${lp.level}`,
                petLineName: lp.displayName,
                portraitSrc: lp.image ?? base.portraitSrc,
                subLabel: '장착 펫',
            };
        }
        if (oppHumanId && petOwnerUserId === oppHumanId && room.opponentLobbyPet) {
            const lp = room.opponentLobbyPet;
            return {
                ...base,
                name: `Lv.${lp.level} ${lp.displayName}`,
                petLineLevel: `Lv.${lp.level}`,
                petLineName: lp.displayName,
                portraitSrc: lp.image ?? base.portraitSrc,
                subLabel: '장착 펫',
            };
        }
        return base;
    });
}

function enrichPairSeatMembersWithLobbyAvatars(
    members: PairSeatMember[],
    avatarByUserId: Map<string, { avatarUrl?: string | null; borderUrl?: string | null }>,
): PairSeatMember[] {
    return members.map((m) => {
        if (String(m.id).startsWith('pet-ai-')) return m;
        const ex = avatarByUserId.get(m.id);
        if (!ex) return m;
        return { ...m, avatarUrl: ex.avatarUrl ?? m.avatarUrl, borderUrl: ex.borderUrl ?? m.borderUrl };
    });
}

/** 페어 경기장 방 만들기: 4인·2인 친선만 (펫 페어 랭킹·AI는 유저 목록 상단 패널) */
const ROOM_KIND_OPTIONS: { value: RoomKind; label: string }[] = [
    { value: 'friendly_4p', label: '4인 친선' },
    { value: 'friendly_2p', label: '2인 친선' },
    { value: 'duo_match', label: '2인 AI대전' },
];

/** 전략·놀이 방 만들기: 친선전만 — 선택 UI는 옵션이 2개 이상일 때만 표시 */
const STRATEGIC_PLAYFUL_CREATE_ROOM_KIND_OPTIONS: { value: RoomKind; label: string }[] = [{ value: 'duo_match', label: '친선전' }];

function resolveCreateModalRoomKind(
    lobbyChannel: PairWaitingLobbyChannel,
    lobbyIntent: ArenaLobbyIntent,
    hasEquippedPairPet: boolean,
): RoomKind {
    const kindOptions = pairLobbyCreateModalRoomKindOptions(lobbyChannel, lobbyIntent);
    let rk: RoomKind = kindOptions[0]?.value ?? (lobbyChannel === 'pair' ? 'friendly_4p' : 'duo_match');
    if (
        !normalizeStoredRoomKind(rk) ||
        !isRoomKindAllowedForLobby(rk, { intent: lobbyIntent, channel: lobbyChannel })
    ) {
        rk = kindOptions[0]?.value ?? (lobbyChannel === 'pair' ? 'friendly_4p' : 'duo_match');
    }
    if (rk === 'friendly_2p' && !hasEquippedPairPet) {
        rk = kindOptions.find((o) => o.value !== 'friendly_2p')?.value ?? rk;
    }
    return rk;
}

function loadCreateModalDraftBundleForRoomKind(
    lobbyChannel: PairWaitingLobbyChannel,
    rk: RoomKind,
): PairCreateModalDraftBundle {
    const doc = loadPairLobbyCreatePrefsDoc(lobbyChannel);
    const slotRaw = doc?.draftsByRoomKind[rk];
    const norm = normalizeRoomKindDraftSlot(slotRaw, lobbyChannel);
    if (norm) return buildDraftBundleFromNormalizedSlot(norm, lobbyChannel, rk);
    return defaultDraftBundleForLobbyChannel(lobbyChannel);
}

function pairLobbyCreateModalRoomKindOptions(
    lobbyChannel: PairWaitingLobbyChannel,
    lobbyIntent: ArenaLobbyIntent,
): readonly { value: RoomKind; label: string }[] {
    const dest = { intent: lobbyIntent, channel: lobbyChannel };
    const kinds = roomKindsForLobbyDestination(dest);
    const labelFor = (k: RoomKind) => roomKindLabel(k, lobbyChannel);
    return kinds.map((value) => ({ value, label: labelFor(value) }));
}

/** 모바일 방 내부 하단 액션 버튼 — 세로 폭 최소화 */
const PAIR_ROOM_HANDHELD_ACTION_BTN =
    'px-2 py-1.5 text-[11px] leading-tight rounded-lg border-2 font-extrabold transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-45';

function roomKindLabel(kind: RoomKind | undefined, lobbyChannel: PairWaitingLobbyChannel = 'pair'): string {
    if (!kind) return '';
    if (kind === 'arena_ai') return 'AI와 대결';
    if (kind === 'ai_duel') return '펫 페어';
    if (lobbyChannel === 'pair' && kind === 'duo_match') return '2인 AI대전';
    if (lobbyChannel === 'strategic' || lobbyChannel === 'playful') {
        if (kind === 'duo_match') return '친선전';
        if (kind === 'friendly_4p') return '4인 친선';
        if (kind === 'friendly_2p') return '2인 친선';
    }
    const o = ROOM_KIND_OPTIONS.find((x) => x.value === kind);
    return o?.label ?? String(kind);
}

function pairAiLobbyActionPointCostLabel(
    mode: GameMode | undefined,
    settings: GameSettings | undefined,
    lobbyChannel: PairWaitingLobbyChannel,
    user: { inventory: unknown[]; equippedPairPetTemplateId?: string | null; equippedPairPetInventoryItemId?: string | null } | null | undefined,
): string {
    const resolvedMode = mode ?? GameMode.Standard;
    const base = baseAiLobbyActionPointCostForModeAndSettings(resolvedMode, settings ?? {});
    if (!user) return String(base);
    const eff = effectivePairAiLobbyApCostForUser(user as User, resolvedMode, settings ?? {}, {
        lobbyChannel,
    });
    return formatActionPointCostWithPetDiscount(base, eff);
}

/** 페어/경기장 랭킹전 매칭 — 대기실 랭킹전과 동일하게 로비·선택 모드 기준 행동력 */
function pairRankedLobbyActionPointCost(
    lobbyChannel: PairWaitingLobbyChannel,
    selectedMode: GameMode | undefined,
): number {
    if (lobbyChannel === 'playful') return PLAYFUL_ACTION_POINT_COST;
    if (lobbyChannel === 'strategic') return STRATEGIC_ACTION_POINT_COST;
    if (!selectedMode) return STRATEGIC_ACTION_POINT_COST;
    if (SPECIAL_GAME_MODES.some((m) => m.mode === selectedMode)) return STRATEGIC_ACTION_POINT_COST;
    if (PLAYFUL_GAME_MODES.some((m) => m.mode === selectedMode)) return PLAYFUL_ACTION_POINT_COST;
    return STRATEGIC_ACTION_POINT_COST;
}

/** 목록 카드에서 참가 자리(4칸) 표시 여부 — roomKind 누락·문자열 불일치 보완 */
function pairListIsFriendlyFour(room: PairRoom): boolean {
    const normalized = normalizePairListRoomKind(room);
    if (normalized === 'friendly_4p') return true;
    const rk = String(room.roomKind ?? '').trim();
    if (rk === 'friendly_4p') return true;
    if (
        normalized === 'duo_match' ||
        normalized === 'ai_duel' ||
        normalized === 'friendly_2p' ||
        rk === 'duo_match' ||
        rk === 'ai_duel' ||
        rk === 'friendly_2p'
    ) {
        return false;
    }

    const title = String(room.title || '');
    if (/님의\s*4인\s*페어방/i.test(title)) return true;
    if (/\b4인\s*친선\b/i.test(title) || /\b친선\s*4인\b/i.test(title)) return true;
    return false;
}

/** 방이 속한 경기장(전략·페어·놀이) — 목록 배지·툴팁 */
function pairRoomArenaChannelMeta(
    room: PairRoom,
    channelFallback: PairWaitingLobbyChannel = 'pair',
): { short: string; badgeClass: string } {
    const ch = room.lobbyChannel ?? channelFallback;
    if (ch === 'strategic') return { short: '전략', badgeClass: 'border-cyan-400/50 bg-cyan-950/55 text-cyan-100' };
    if (ch === 'playful') return { short: '놀이', badgeClass: 'border-amber-400/50 bg-amber-950/55 text-amber-100' };
    return { short: '페어', badgeClass: 'border-violet-400/50 bg-violet-950/55 text-violet-100' };
}

/** 목록·필터·카드 배지에 공통으로 쓰는 방 종류 */
function pairLobbyListDisplayRoomKind(room: PairRoom, channelFallback?: PairWaitingLobbyChannel): RoomKind {
    const n = normalizePairListRoomKind(room);
    if (n) return n;
    const ch = room.lobbyChannel ?? channelFallback;
    /** 전략·놀이 경기장에는 4인 친선이 없음 — roomKind 누락 시 페어 로비용 제목 휴리스틱이 오판하지 않게 함 */
    if (ch === 'strategic' || ch === 'playful') {
        if (room.partnerId && String(room.partnerId).startsWith('pet-ai-')) return 'arena_ai';
        return 'duo_match';
    }
    if (pairListIsFriendlyFour(room)) return 'friendly_4p';
    return room.roomKind;
}

type PairLobbyListRoomKindFilter = 'all' | RoomKind;

function pairLobbyListRoomKindFilterOptionsForChannel(
    lobbyChannel: 'pair' | 'strategic' | 'playful',
    lobbyIntent: ArenaLobbyIntent = 'pvp',
): ReadonlyArray<{ value: PairLobbyListRoomKindFilter; label: string }> {
    const all = { value: 'all' as const, label: '전체(방 종류)' };
    if (lobbyChannel === 'playful') {
        const opts: Array<{ value: PairLobbyListRoomKindFilter; label: string }> = [
            all,
            { value: 'duo_match', label: '친선전' },
        ];
        if (lobbyIntent === 'ai') opts.push({ value: 'arena_ai', label: 'AI와 대결' });
        return opts;
    }
    if (lobbyChannel === 'strategic') {
        const opts: Array<{ value: PairLobbyListRoomKindFilter; label: string }> = [
            all,
            { value: 'duo_match', label: '친선전' },
        ];
        if (lobbyIntent === 'ai') opts.push({ value: 'arena_ai', label: 'AI와 대결' });
        return opts;
    }
    const opts: Array<{ value: PairLobbyListRoomKindFilter; label: string }> = [
        all,
        { value: 'friendly_4p', label: '4인 친선' },
        { value: 'friendly_2p', label: '2인 친선' },
    ];
    if (lobbyIntent === 'ai') opts.push({ value: 'duo_match', label: '2인 AI대전' });
    return opts;
}

function pairLobbyListGameModeFilterShortLabel(name: string): string {
    const t = name.trim();
    return t.replace(/\s*바둑\s*$/u, '').trim() || t;
}

function pairLobbyListGameModeFilterOptionsForChannel(
    lobbyChannel: 'pair' | 'strategic' | 'playful',
): ReadonlyArray<{ value: 'all' | GameMode; label: string }> {
    const allGameModes = { value: 'all' as const, label: '전체(게임 모드)' };
    if (lobbyChannel === 'strategic') {
        return [
            allGameModes,
            ...SPECIAL_GAME_MODES.map((g) => ({
                value: g.mode,
                label: pairLobbyListGameModeFilterShortLabel(g.name),
            })),
        ];
    }
    if (lobbyChannel === 'playful') {
        return [
            allGameModes,
            ...PLAYFUL_GAME_MODES.map((g) => ({
                value: g.mode,
                label: pairLobbyListGameModeFilterShortLabel(g.name),
            })),
        ];
    }
    /** 페어 경기장: 친선 방은 전략바둑 모드만 — 놀이바둑 모드는 목록에 없음 */
    return [
        allGameModes,
        ...SPECIAL_GAME_MODES.map((g) => ({
            value: g.mode,
            label: pairLobbyListGameModeFilterShortLabel(g.name),
        })),
    ];
}

function memberKindIsUser(kind: string | undefined): boolean {
    return String(kind || '').toLowerCase() === 'user';
}

/** 인게임 세션의 pairGame.roomId가 이 방과 같은 껍데기 경기인지(랭크 병합 방은 `pair-ranked-a-b` 형태) */
function pairShellGameRoomIdMatchesMyRoom(shellRoomId: unknown, myRoomId: string): boolean {
    if (typeof shellRoomId !== 'string' || !myRoomId) return false;
    if (shellRoomId === myRoomId) return true;
    if (shellRoomId.startsWith('pair-ranked-') && shellRoomId.includes(myRoomId)) return true;
    return false;
}

/** 서버 `leavePairWaitingRoomIfPresent`와 동일 기준 — owner/partner/extra 외에 팀 멤버에만 있어도 방 소속 */
function userInPairRoomClient(room: PairRoom, userId: string): boolean {
    if (!userId) return false;
    if (room.ownerId === userId || room.partnerId === userId) return true;
    if ((room.extraPairMembers ?? []).some((m) => m.id === userId)) return true;
    const members = [...(room.teamA?.members ?? []), ...(room.teamB?.members ?? [])];
    return members.some((m) => memberKindIsUser(m.kind) && m.id === userId);
}

function countHumanUsersInPairRoom(room: PairRoom): number {
    const members = [...(room.teamA?.members ?? []), ...(room.teamB?.members ?? [])];
    const userMembers = members.filter((m) => memberKindIsUser(m.kind));
    /** 팀 스냅샷이 잠깐 2명만 있거나 빈 슬롯일 때도 `ownerId`·`partnerId`·`extraPairMembers` 기준으로 정원을 맞춤 */
    const idsFromSlots = new Set<string>();
    if (room.ownerId) idsFromSlots.add(room.ownerId);
    if (room.partnerId && !String(room.partnerId).startsWith('pet-ai-')) idsFromSlots.add(room.partnerId);
    for (const m of room.extraPairMembers ?? []) {
        if (m?.id && !String(m.id).startsWith('pet-ai-')) idsFromSlots.add(m.id);
    }
    const fromSlots = idsFromSlots.size;
    if (userMembers.length > 0) {
        return Math.max(new Set(userMembers.map((m) => m.id)).size, fromSlots);
    }
    return fromSlots;
}

/** 목록·빠른참가 입장 — 인간 자리가 꽉 찬 방은 클릭 불가(서버 `friendly_4p`·`friendly_2p`·`duo_match` 정원과 동일) */
function pairRoomListIsAtHumanCapacity(room: PairRoom, listRoomKind: RoomKind): boolean {
    const n = countHumanUsersInPairRoom(room);
    if (listRoomKind === 'friendly_2p') return n >= 2;
    if (listRoomKind === 'friendly_4p') return n >= 4;
    if (listRoomKind === 'duo_match') return (room.lobbyChannel ?? 'pair') === 'pair' ? n >= 2 : n >= 4;
    return false;
}

/** 팀 행이 인간 착석으로 볼 수 있는지(kind 누락·별칭 대비) */
function pairLobbyRowLooksLikeHumanUser(row: { id?: string; kind?: string } | undefined): boolean {
    if (!row?.id || String(row.id).startsWith('pet-ai-')) return false;
    if (String(row.id).startsWith('pair-opponent')) return false;
    const k = String(row.kind || '').toLowerCase();
    if (k === 'pet' || k === 'ai') return false;
    return memberKindIsUser(row.kind) || k === '' || k === 'player';
}

/** owner·partner·extra·팀 스냅샷을 합친 인간 id — 팀에만 있거나 슬롯에만 있는 유저가 빠지면 준비 UI와 canStart가 어긋남 */
function pairLobbyCollectHumanUserIds(room: PairRoom): Set<string> {
    const ids = new Set<string>();
    if (room.ownerId) ids.add(room.ownerId);
    if (room.partnerId && !String(room.partnerId).startsWith('pet-ai-')) ids.add(room.partnerId);
    for (const m of room.extraPairMembers ?? []) {
        if (m?.id && !String(m.id).startsWith('pet-ai-')) ids.add(m.id);
    }
    for (const row of [...(room.teamA?.members ?? []), ...(room.teamB?.members ?? [])]) {
        if (pairLobbyRowLooksLikeHumanUser(row)) ids.add(row.id);
    }
    return ids;
}

function pairLobbySlotReadyStrict(room: PairRoom, userId: string): boolean {
    if (room.partnerId === userId) return room.partnerReady === true;
    const ex = room.extraPairMembers?.find((e) => e.id === userId);
    return ex ? ex.ready === true : false;
}

/** 팀 스냅샷·슬롯 필드 중 하나라도 준비면 true(둘 다 거짓일 때만 미준비) */
function pairLobbyEffectiveHumanReady(room: PairRoom, userId: string): boolean {
    if (!userId || userId === room.ownerId) return true;
    const rows = [...(room.teamA?.members ?? []), ...(room.teamB?.members ?? [])];
    const tMember = rows.find((m) => m.id === userId);
    const slot = pairLobbySlotReadyStrict(room, userId);
    if (tMember?.ready === true || slot) return true;
    if (tMember?.ready === false && !slot) return false;
    return slot;
}

function pairLobbyAllNonOwnerHumansReady(room: PairRoom | null | undefined): boolean {
    if (!room) return true;
    for (const id of pairLobbyCollectHumanUserIds(room)) {
        if (id === room.ownerId) continue;
        if (!pairLobbyEffectiveHumanReady(room, id)) return false;
    }
    return true;
}

function pairLobbyHasAnyNonOwnerHuman(room: PairRoom | null | undefined): boolean {
    if (!room) return false;
    for (const id of pairLobbyCollectHumanUserIds(room)) {
        if (id !== room.ownerId) return true;
    }
    return false;
}

/**
 * 전략·놀이 duo 친선: 정원은 집계 인원 4명, 또는 팀별 2+2.
 * `duo_match`는 서버 `syncDuoMatchPairSeatAssignments`가 인간을 teamA에만 두는 경우가 많아
 * teamB 인간 0명이면 기존 로직이 항상 실패함 → 방장+파트너(2인)만 있어도 정원 충족으로 본다.
 */
function pairLobbyArenaFriendlyDuoCapacityOk(room: PairRoom): boolean {
    const n = countHumanUsersInPairRoom(room);
    if (n >= 4) return true;
    if (room.roomKind === 'duo_match' && n >= 2) return true;
    const hu = (members: Array<{ id: string; name: string; kind: string; ready?: boolean }> | undefined) =>
        (members ?? []).filter((m) => pairLobbyRowLooksLikeHumanUser(m)).length;
    return hu(room.teamA?.members) >= 2 && hu(room.teamB?.members) >= 2;
}

function normalizeRoomNumberInput(raw: string): string {
    return raw.replace(/^#/, '').replace(/\s/g, '').toUpperCase();
}

/** 구버전: 채널 구분 없이 한 키에만 저장되던 값(페어 로비 마이그레이션용) */
const PAIR_LOBBY_LEGACY_CREATE_PREFS_KEY = 'sudamr_pair_lobby_last_create_room_prefs_v1';

/** 방 종류당 게임 모드별 대국 설정(모드 전환 시 서로 덮어쓰지 않음) */
type PairLobbyMultiDraftSlot = {
    settingsByMode: Partial<Record<GameMode, GameSettings>>;
    lastMode?: GameMode;
};

type PairCreateModalDraftBundle = {
    mode: GameMode;
    settings: GameSettings;
    settingsByMode: Partial<Record<GameMode, GameSettings>>;
};

type PairLobbyStoredCreatePrefsFlat = {
    roomKind: RoomKind;
    mode: GameMode;
    settings: GameSettings;
};

type PairLobbyStoredCreatePrefsDoc = {
    v: 3;
    lastRoomKind?: RoomKind;
    draftsByRoomKind: Partial<Record<RoomKind, PairLobbyMultiDraftSlot>>;
};

function pairLobbyPrefsPrimaryStorageKey(ch: PairWaitingLobbyChannel): string {
    if (ch === 'strategic') return 'sudamr_pair_lobby_last_create_strategic_prefs_v2';
    if (ch === 'playful') return 'sudamr_pair_lobby_last_create_playful_prefs_v2';
    return 'sudamr_pair_lobby_last_create_pair_prefs_v2';
}

function pairLobbyPrefsV1StorageKey(ch: PairWaitingLobbyChannel): string {
    if (ch === 'strategic') return 'sudamr_pair_lobby_last_create_strategic_prefs_v1';
    if (ch === 'playful') return 'sudamr_pair_lobby_last_create_playful_prefs_v1';
    return 'sudamr_pair_lobby_last_create_pair_prefs_v1';
}

function isValidStoredModeForLobbyChannel(mode: unknown, ch: PairWaitingLobbyChannel): mode is GameMode {
    if (typeof mode !== 'string') return false;
    if (ch === 'playful') return PLAYFUL_GAME_MODES.some((m) => m.mode === mode);
    return SPECIAL_GAME_MODES.some((m) => m.mode === mode);
}

function pairLobbyDraftLobbyType(ch: PairWaitingLobbyChannel): 'strategic' | 'playful' {
    return ch === 'playful' ? 'playful' : 'strategic';
}

/** 전략·놀이·페어 채널 간 `settingsByMode`에 섞인 모드 키 제거 */
function filterSettingsByModeForLobbyChannel(
    settingsByMode: Partial<Record<GameMode, GameSettings>>,
    ch: PairWaitingLobbyChannel,
): Partial<Record<GameMode, GameSettings>> {
    const lobbyType = pairLobbyDraftLobbyType(ch);
    const filtered: Partial<Record<GameMode, GameSettings>> = {};
    for (const gm of Object.keys(settingsByMode) as GameMode[]) {
        if (!isValidStoredModeForLobbyChannel(gm, ch)) continue;
        const raw = settingsByMode[gm];
        if (!raw) continue;
        filtered[gm] = sanitizePairLobbyDraftModeSettings(gm, raw, lobbyType);
    }
    return filtered;
}

function defaultCreateDraftGameForLobbyChannel(ch: PairWaitingLobbyChannel): { mode: GameMode; settings: GameSettings } {
    const firstPlayful = PLAYFUL_GAME_MODES[0]?.mode ?? GameMode.Standard;
    return {
        mode: ch === 'playful' ? firstPlayful : GameMode.Standard,
        settings: { ...DEFAULT_GAME_SETTINGS },
    };
}

function normalizeStoredRoomKind(raw: unknown): RoomKind | null {
    if (raw === 'ai_duel' || raw === 'duo_match' || raw === 'friendly_4p' || raw === 'friendly_2p' || raw === 'arena_ai') return raw;
    return null;
}

function parsePairLobbyStoredCreatePrefsFlatJson(raw: string, ch: PairWaitingLobbyChannel): PairLobbyStoredCreatePrefsFlat | null {
    const parsed = JSON.parse(raw) as Partial<PairLobbyStoredCreatePrefsFlat>;
    if (!parsed || typeof parsed !== 'object') return null;
    const roomKind = normalizeStoredRoomKind(parsed.roomKind);
    if (!roomKind) return null;
    const mode = parsed.mode as GameMode;
    if (!isValidStoredModeForLobbyChannel(mode, ch)) return null;
    const settings =
        parsed.settings && typeof parsed.settings === 'object'
            ? ({ ...DEFAULT_GAME_SETTINGS, ...(parsed.settings as GameSettings) } as GameSettings)
            : ({ ...DEFAULT_GAME_SETTINGS } as GameSettings);
    return { roomKind, mode, settings };
}

function migrateFlatToDocV3(flat: PairLobbyStoredCreatePrefsFlat): PairLobbyStoredCreatePrefsDoc {
    return {
        v: 3,
        lastRoomKind: flat.roomKind,
        draftsByRoomKind: {
            [flat.roomKind]: {
                lastMode: flat.mode,
                settingsByMode: { [flat.mode]: { ...DEFAULT_GAME_SETTINGS, ...flat.settings } },
            },
        },
    };
}

/** 로컬 저장 슬롯: v2 `{mode,settings}` 또는 v3 `settingsByMode` 모두 수용 */
function normalizeRoomKindDraftSlot(raw: unknown, ch: PairWaitingLobbyChannel): PairLobbyMultiDraftSlot | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    if (o.settingsByMode && typeof o.settingsByMode === 'object' && !Array.isArray(o.settingsByMode)) {
        const settingsByMode: Partial<Record<GameMode, GameSettings>> = {};
        for (const [k, v] of Object.entries(o.settingsByMode as Record<string, unknown>)) {
            if (!isValidStoredModeForLobbyChannel(k, ch)) continue;
            if (v && typeof v === 'object') {
                settingsByMode[k as GameMode] = { ...DEFAULT_GAME_SETTINGS, ...(v as GameSettings) } as GameSettings;
            }
        }
        const lastMode = isValidStoredModeForLobbyChannel(o.lastMode, ch) ? (o.lastMode as GameMode) : undefined;
        return Object.keys(settingsByMode).length > 0 ? { settingsByMode, lastMode } : null;
    }
    const mode = o.mode;
    if (!isValidStoredModeForLobbyChannel(mode, ch)) return null;
    const st = o.settings;
    const settings =
        st && typeof st === 'object'
            ? ({ ...DEFAULT_GAME_SETTINGS, ...(st as GameSettings) } as GameSettings)
            : ({ ...DEFAULT_GAME_SETTINGS } as GameSettings);
    return { settingsByMode: { [mode as GameMode]: settings }, lastMode: mode as GameMode };
}

function parsePairLobbyCreatePrefsDocFromRaw(raw: string, ch: PairWaitingLobbyChannel): PairLobbyStoredCreatePrefsDoc | null {
    try {
        const parsed = JSON.parse(raw) as Partial<PairLobbyStoredCreatePrefsDoc> & Partial<PairLobbyStoredCreatePrefsFlat> & {
            v?: number;
            draftsByRoomKind?: Record<string, unknown>;
        };
        if (parsed && typeof parsed === 'object' && parsed.draftsByRoomKind && typeof parsed.draftsByRoomKind === 'object') {
            const draftsByRoomKind: PairLobbyStoredCreatePrefsDoc['draftsByRoomKind'] = {};
            for (const [key, slotRaw] of Object.entries(parsed.draftsByRoomKind)) {
                const rk = normalizeStoredRoomKind(key);
                if (!rk) continue;
                const norm = normalizeRoomKindDraftSlot(slotRaw, ch);
                if (norm) draftsByRoomKind[rk] = norm;
            }
            if (Object.keys(draftsByRoomKind).length === 0) return null;
            const lr = normalizeStoredRoomKind(parsed.lastRoomKind);
            return { v: 3, lastRoomKind: lr ?? undefined, draftsByRoomKind };
        }
        const flat = parsePairLobbyStoredCreatePrefsFlatJson(raw, ch);
        return flat ? migrateFlatToDocV3(flat) : null;
    } catch {
        return null;
    }
}

function loadPairLobbyCreatePrefsDoc(ch: PairWaitingLobbyChannel): PairLobbyStoredCreatePrefsDoc | null {
    if (typeof localStorage === 'undefined') return null;
    const keys: string[] = [pairLobbyPrefsPrimaryStorageKey(ch), pairLobbyPrefsV1StorageKey(ch)];
    if (ch === 'pair') keys.push(PAIR_LOBBY_LEGACY_CREATE_PREFS_KEY);
    for (const key of keys) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const doc = parsePairLobbyCreatePrefsDocFromRaw(raw, ch);
            if (doc && Object.keys(doc.draftsByRoomKind).length > 0) return doc;
        } catch {
            // try next key
        }
    }
    return null;
}

function savePairLobbyCreatePrefsDoc(ch: PairWaitingLobbyChannel, doc: PairLobbyStoredCreatePrefsDoc) {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(pairLobbyPrefsPrimaryStorageKey(ch), JSON.stringify(doc));
    } catch {
        // ignore
    }
}

function upsertPairLobbyCreateDraft(
    prevDoc: PairLobbyStoredCreatePrefsDoc | null,
    rk: RoomKind,
    slot: PairLobbyMultiDraftSlot,
): PairLobbyStoredCreatePrefsDoc {
    const draftsByRoomKind = { ...(prevDoc?.draftsByRoomKind ?? {}), [rk]: slot };
    return { v: 3, lastRoomKind: rk, draftsByRoomKind };
}

function defaultDraftBundleForLobbyChannel(ch: PairWaitingLobbyChannel): PairCreateModalDraftBundle {
    const d = defaultCreateDraftGameForLobbyChannel(ch);
    return { mode: d.mode, settings: d.settings, settingsByMode: { [d.mode]: d.settings } };
}

/** 저장 슬롯 → 초안 병합(reconcile만). UI 파이프라인용 transform은 호출부에서 적용 */
function buildDraftBundleFromNormalizedSlot(
    slot: PairLobbyMultiDraftSlot,
    lobbyChannel: PairWaitingLobbyChannel,
    roomKind: RoomKind,
): PairCreateModalDraftBundle {
    const defaults = defaultCreateDraftGameForLobbyChannel(lobbyChannel);
    const modesWithData = (Object.keys(slot.settingsByMode) as GameMode[]).filter((gm) =>
        isValidStoredModeForLobbyChannel(gm, lobbyChannel),
    );
    const settingsByMode: Partial<Record<GameMode, GameSettings>> = {};
    const sourceModes = modesWithData.length > 0 ? modesWithData : [defaults.mode];
    const lobbyType = pairLobbyDraftLobbyType(lobbyChannel);
    for (const gm of sourceModes) {
        const raw = sanitizePairLobbyDraftModeSettings(
            gm,
            { ...DEFAULT_GAME_SETTINGS, ...(slot.settingsByMode[gm] ?? {}) },
            lobbyType,
        );
        settingsByMode[gm] = reconcilePairLobbyDraftOnOpen(lobbyChannel, roomKind, gm, raw);
    }
    let mode: GameMode = defaults.mode;
    if (
        slot.lastMode &&
        isValidStoredModeForLobbyChannel(slot.lastMode, lobbyChannel) &&
        settingsByMode[slot.lastMode]
    ) {
        mode = slot.lastMode;
    } else if (modesWithData.length > 0 && settingsByMode[modesWithData[0]!]) {
        mode = modesWithData[0]!;
    }
    if (!settingsByMode[mode]) {
        mode = defaults.mode;
        const raw = sanitizePairLobbyDraftModeSettings(
            mode,
            { ...DEFAULT_GAME_SETTINGS, ...defaults.settings },
            lobbyType,
        );
        settingsByMode[mode] = reconcilePairLobbyDraftOnOpen(lobbyChannel, roomKind, mode, raw);
    }
    return {
        mode,
        settings: settingsByMode[mode]!,
        settingsByMode: filterSettingsByModeForLobbyChannel(settingsByMode, lobbyChannel),
    };
}

function bundleToPersistedSlot(
    bundle: PairCreateModalDraftBundle,
    ch: PairWaitingLobbyChannel,
): PairLobbyMultiDraftSlot {
    const lobbyType = pairLobbyDraftLobbyType(ch);
    const merged: Partial<Record<GameMode, GameSettings>> = {
        ...filterSettingsByModeForLobbyChannel(bundle.settingsByMode, ch),
        [bundle.mode]: sanitizePairLobbyDraftModeSettings(bundle.mode, bundle.settings, lobbyType),
    };
    return { settingsByMode: merged, lastMode: bundle.mode };
}

function applyDraftBundleTransforms(
    bundle: PairCreateModalDraftBundle,
    transformDraft: (mode: GameMode, raw: GameSettings) => GameSettings,
    ch: PairWaitingLobbyChannel,
): PairCreateModalDraftBundle {
    const lobbyType = pairLobbyDraftLobbyType(ch);
    const settingsByMode: Partial<Record<GameMode, GameSettings>> = {};
    for (const gm of Object.keys(bundle.settingsByMode) as GameMode[]) {
        if (!isValidStoredModeForLobbyChannel(gm, ch)) continue;
        const raw = bundle.settingsByMode[gm];
        if (raw) {
            settingsByMode[gm] = transformDraft(
                gm,
                sanitizePairLobbyDraftModeSettings(gm, raw, lobbyType),
            );
        }
    }
    const mode = bundle.mode;
    const base = settingsByMode[mode] ?? bundle.settings;
    const settings = transformDraft(mode, sanitizePairLobbyDraftModeSettings(mode, base, lobbyType));
    settingsByMode[mode] = settings;
    return {
        mode,
        settings,
        settingsByMode: filterSettingsByModeForLobbyChannel(settingsByMode, ch),
    };
}

function pairLobbyPreferredBucketForEmbeddedRoomCreate(
    lobbyChannel: PairWaitingLobbyChannel,
    roomKind: RoomKind,
): AiLobbyPreferredGameSettingsBucket {
    if (lobbyChannel === 'strategic') {
        return roomKind === 'arena_ai' ? 'strategic_room_create_arena_ai' : 'strategic_room_create_duo_match';
    }
    if (lobbyChannel === 'playful') {
        return roomKind === 'arena_ai' ? 'playful_room_create_arena_ai' : 'playful_room_create_duo_match';
    }
    switch (roomKind) {
        case 'friendly_4p':
            return 'pair_room_create_friendly_4p';
        case 'friendly_2p':
            return 'pair_room_create_friendly_2p';
        case 'duo_match':
            return 'pair_room_create_duo_match';
        case 'ai_duel':
            return 'pair_room_create_ai_duel';
        case 'arena_ai':
            return 'pair_room_create_arena_ai';
        default:
            return 'pair_room_create_friendly_4p';
    }
}

/** 마지막 저장분에 방 종류와 어긋난 시계·덤이 남은 경우 보정 (예: AI무제한 상태가 친선/듀오 초안에 그대로 저장됨) */
function reconcilePairLobbyDraftOnOpen(
    lobbyChannel: PairWaitingLobbyChannel,
    roomKind: RoomKind,
    mode: GameMode,
    settings: GameSettings,
): GameSettings {
    const ranked = getRankedGameSettings(mode);
    const aiShell = roomKind === 'ai_duel' || roomKind === 'arena_ai';
    const s = { ...settings };
    if (aiShell && lobbyChannel !== 'playful') {
        return { ...s, timeLimit: 0, byoyomiTime: 0, byoyomiCount: 0, timeIncrement: 0 };
    }
    const deadClock =
        (s.timeLimit ?? 0) === 0 &&
        (s.byoyomiTime ?? 0) === 0 &&
        (s.byoyomiCount ?? 0) === 0 &&
        (s.timeIncrement ?? 0) === 0;
    const aggregateHumanDuo =
        (lobbyChannel === 'strategic' || lobbyChannel === 'playful') && roomKind === 'duo_match';

    const mergeRankedClockAndKomi = (base: GameSettings) =>
        ({
            ...base,
            boardSize: ranked.boardSize ?? base.boardSize,
            timeLimit: ranked.timeLimit ?? base.timeLimit,
            byoyomiTime: ranked.byoyomiTime ?? base.byoyomiTime,
            byoyomiCount: ranked.byoyomiCount ?? base.byoyomiCount,
            timeIncrement: ranked.timeIncrement ?? base.timeIncrement,
            ...(mode === GameMode.Base ? {} : { komi: ranked.komi ?? base.komi }),
        }) as GameSettings;

    if (aggregateHumanDuo && deadClock) {
        return mergeRankedClockAndKomi(s);
    }
    return s;
}

const PAIR_JOIN_PASSWORD_ERROR = '비밀번호가 일치하지 않습니다.';

type JoinPasswordModal = {
    roomId?: string;
    code?: string;
    roomTitle: string;
};

export type PairWaitingLobbyProps = {
    lobbyChannel?: PairWaitingLobbyChannel;
    lobbyIntent?: ArenaLobbyIntent;
};

const PairWaitingLobby: React.FC<PairWaitingLobbyProps> = ({ lobbyChannel = 'pair', lobbyIntent = 'pvp' }) => {
    const { isNativeMobile } = useNativeMobileShell();
    const isHandheld = useIsHandheldDevice(1024);
    const {
        currentUserWithStatus,
        onlineUsers,
        handlers,
        pairRooms,
        liveGames,
        pairRoomChatByRoomId,
        pairInviteCooldownUntilByInviteeId,
        rankedMatchFound,
        rankedMatchProposal,
        rankedMatchingQueue,
        arenaEntranceAvailability,
        arenaEntranceFromServer,
        waitingRoomChats,
    } = useAppContext();
    const mergedPublicChatMessages = useMemo(
        () => mergeWaitingRoomPublicChatMessages(waitingRoomChats),
        [waitingRoomChats],
    );
    const [joinRoomNumber, setJoinRoomNumber] = useState('');
    const [pairLobbyListRoomKindFilter, setPairLobbyListRoomKindFilter] = useState<PairLobbyListRoomKindFilter>('all');
    const [pairLobbyListGameModeFilter, setPairLobbyListGameModeFilter] = useState<'all' | GameMode>('all');
    const [joinPasswordModal, setJoinPasswordModal] = useState<JoinPasswordModal | null>(null);
    const [joinPasswordDraft, setJoinPasswordDraft] = useState('');
    const [userTab, setUserTab] = useState<'users' | 'friends' | 'guild'>('users');
    const [pairLobbyMobileTab, setPairLobbyMobileTab] = useState<
        'rooms' | 'room' | 'users' | 'ranked' | 'ai' | 'rankedAi'
    >('rooms');
    /** PC·모바일 우측(유저 열): 방 내부 UI ↔ 유저 목록 ↔ AI대결(전략·놀이 집계만) */
    const [pairLobbyRightTab, setPairLobbyRightTab] = useState<'room' | 'users' | 'ai'>('room');
    /** PVP 중앙 열: 방목록 ↔ 내 방(N번방) */
    const [pairLobbyCenterTab, setPairLobbyCenterTab] = useState<'rooms' | 'room'>('rooms');
    /** 페어 AI 솔로↔2인 팀 — 유저 열·모바일 탭이 duo 껍데기 방을 방으로 보지 않게 동기화 */
    const [pairAiLobbyMatchMode, setPairAiLobbyMatchMode] = useState<PairAiLobbyMatchMode>('solo');
    const [isBusy, setIsBusy] = useState(false);
    const [pairRoomChatSendCooldownUi, setPairRoomChatSendCooldownUi] = useState(false);
    const pairRoomChatSendCooldownRef = useRef(false);
    const pairRoomChatSendInFlightRef = useRef(false);
    const pairRoomChatCooldownTimerRef = useRef<number | null>(null);
    const [rankedMatchBusy, setRankedMatchBusy] = useState(false);
    /** 슬롯 1~100 그리드 — `PAIR_LOBBY_ROOM_GRID_SLICE`로 채우고, `pairRooms`로 동기 */
    const [lobbyGridRooms, setLobbyGridRooms] = useState<Record<string, PairRoom>>({});
    const hasEnteredAggregateLobby = useRef(false);
    /** 제출 시점에 항상 최신 경기장 채널을 쓰도록 함(모달 비동기·탭 전환 등으로 클로저가 옛값을 잡는 경우 방지) */
    const lobbyChannelRef = useRef<PairWaitingLobbyChannel>(lobbyChannel);
    const lobbyIntentRef = useRef<ArenaLobbyIntent>(lobbyIntent);
    const intentNavDebounceRef = useRef<number | null>(null);
    const handleActionRef = useRef(handlers.handleAction);
    /** 방 만들기: 방 종류 변경 직전 값 — 시계·덤이 AI무제한/친선·랭킹 프리셋 사이에 섞이지 않게 동기화 */
    const prevCreateModalRoomKindForClockRef = useRef<RoomKind | null>(null);
    /** 인게임「대기실로」복귀 시 POST_GAME_PAIR_ROOM_RESTORE 한 번만 처리 */
    const postGamePairRoomRestoreDoneRef = useRef(false);
    useEffect(() => {
        lobbyChannelRef.current = lobbyChannel;
    }, [lobbyChannel]);
    useEffect(() => {
        lobbyIntentRef.current = lobbyIntent;
    }, [lobbyIntent]);
    useEffect(() => {
        handleActionRef.current = handlers.handleAction;
    }, [handlers.handleAction]);
    const stableLobbyHandleAction = useCallback(
        (action: ServerAction) => handleActionRef.current(action),
        [],
    );
    useEffect(() => {
        hasEnteredAggregateLobby.current = false;
    }, [lobbyChannel, lobbyIntent]);
    useEffect(() => {
        postGamePairRoomRestoreDoneRef.current = false;
    }, [lobbyChannel]);

    const pvpArenaScreenGuide = useScreenGuide('pvpArena');

    const aggregateLobbyMode = lobbyChannel === 'strategic' || lobbyChannel === 'playful' ? lobbyChannel : null;
    /** 모바일 상단 탭에 「랭킹전」 분리 표시 (전략 집계·페어 본로비) */
    const showHandheldRankedTab = lobbyChannel === 'strategic' || lobbyChannel === 'pair';

    const pairLobbyListRoomKindFilterOptions = useMemo(
        () => pairLobbyListRoomKindFilterOptionsForChannel(lobbyChannel, lobbyIntent),
        [lobbyChannel, lobbyIntent],
    );
    const pairLobbyListGameModeFilterOptions = useMemo(
        () => pairLobbyListGameModeFilterOptionsForChannel(lobbyChannel),
        [lobbyChannel],
    );

    useEffect(() => {
        setPairLobbyListRoomKindFilter((prev) =>
            pairLobbyListRoomKindFilterOptionsForChannel(lobbyChannel, lobbyIntent).some((o) => o.value === prev)
                ? prev
                : 'all',
        );
        setPairLobbyListGameModeFilter((prev) =>
            pairLobbyListGameModeFilterOptionsForChannel(lobbyChannel).some((o) => o.value === prev) ? prev : 'all',
        );
    }, [lobbyChannel, lobbyIntent]);

    useEffect(() => {
        try {
            if (lobbyChannel !== 'pair') return;
            if (sessionStorage.getItem('sudamr_pair_lobby_open_pet_tab') === '1') {
                sessionStorage.removeItem('sudamr_pair_lobby_open_pet_tab');
                handlers.openPetManagementModal({ modal: true });
            }
        } catch {
            // ignore
        }
    }, [lobbyChannel, handlers]);

    /** 전략/놀이: 펫은 퀵메뉴 모달로 — PVP는 방목록, AI는 AI설정이 기본 탭 */
    useEffect(() => {
        if (lobbyIntent === 'ai') {
            setPairLobbyMobileTab('ai');
            return;
        }
        if (lobbyChannel === 'strategic' || lobbyChannel === 'playful') {
            setPairLobbyMobileTab('rooms');
        } else {
            setPairLobbyMobileTab((t) => (t === 'rankedAi' || t === 'ai' ? 'rooms' : t));
        }
    }, [lobbyChannel, lobbyIntent]);

    useEffect(() => {
        if (!showHandheldRankedTab && (pairLobbyMobileTab === 'ranked' || pairLobbyMobileTab === 'rankedAi')) {
            setPairLobbyMobileTab('rooms');
        }
    }, [showHandheldRankedTab, pairLobbyMobileTab]);

    useEffect(() => {
        if (pairLobbyMobileTab === 'rankedAi') {
            setPairLobbyMobileTab(showHandheldRankedTab && lobbyIntent === 'pvp' ? 'ranked' : 'rooms');
        }
    }, [pairLobbyMobileTab, showHandheldRankedTab, lobbyIntent]);

    useEffect(() => {
        if (!aggregateLobbyMode || !currentUserWithStatus) return;
        if (isClientAdmin(currentUserWithStatus)) return;
        const m = mergeArenaEntranceAvailability(arenaEntranceAvailability);
        if (aggregateLobbyMode === 'strategic' && !m.strategicLobby) replaceAppHash('#/profile');
        if (aggregateLobbyMode === 'playful' && !m.playfulLobby) replaceAppHash('#/profile');
    }, [aggregateLobbyMode, arenaEntranceAvailability, currentUserWithStatus]);

    useEffect(() => {
        if (!aggregateLobbyMode || !currentUserWithStatus || hasEnteredAggregateLobby.current) return;
        const isAlready =
            currentUserWithStatus.status === UserStatus.Waiting || currentUserWithStatus.status === UserStatus.Resting;
        const modeMatches =
            !currentUserWithStatus.mode ||
            (aggregateLobbyMode === 'strategic' && SPECIAL_GAME_MODES.some((x) => x.mode === currentUserWithStatus.mode)) ||
            (aggregateLobbyMode === 'playful' && PLAYFUL_GAME_MODES.some((x) => x.mode === currentUserWithStatus.mode));
        if (!isAlready || !modeMatches) {
            hasEnteredAggregateLobby.current = true;
            void handleActionRef.current({
                type: 'ENTER_WAITING_ROOM',
                payload: { mode: aggregateLobbyMode, lobbyIntent },
            });
        } else {
            hasEnteredAggregateLobby.current = true;
        }
    }, [aggregateLobbyMode, currentUserWithStatus, lobbyIntent]);

    useEffect(() => {
        if (!rankedMatchFound?.gameId || !currentUserId) return;
        const matched =
            rankedMatchFound.player1?.id === currentUserId ||
            rankedMatchFound.player2?.id === currentUserId;
        if (matched) {
            handlers.clearRankedMatchFound?.();
            pairShellGameNavAllowIdRef.current = rankedMatchFound.gameId;
            replaceAppHash(`/game/${rankedMatchFound.gameId}`);
        }
    }, [rankedMatchFound, currentUserId, handlers]);

    const respondAggregateRankedMatch = useCallback(
        async (accept: boolean) => {
            if (!rankedMatchProposal?.proposalId || rankedMatchBusy) return;
            setRankedMatchBusy(true);
            try {
                await handlers.handleAction({
                    type: 'RESPOND_RANKED_MATCH',
                    payload: { proposalId: rankedMatchProposal.proposalId, accept },
                });
                if (!accept) {
                    handlers.clearRankedMatchProposal?.();
                }
            } finally {
                setRankedMatchBusy(false);
            }
        },
        [rankedMatchProposal?.proposalId, rankedMatchBusy, handlers],
    );

    useEffect(() => {
        if (lobbyChannel !== 'strategic') {
            setAggregateLobbyRankedMatching(false);
            setAggregateLobbyRankedMatchingStartTime(0);
            return;
        }
        const uid = currentUserWithStatus?.id;
        const userEntry = uid
            ? (rankedMatchingQueue as { strategic?: Record<string, { startTime: number }> } | undefined)?.strategic?.[uid]
            : undefined;
        if (userEntry) {
            setAggregateLobbyRankedMatching(true);
            setAggregateLobbyRankedMatchingStartTime(userEntry.startTime);
        } else {
            setAggregateLobbyRankedMatching(false);
            setAggregateLobbyRankedMatchingStartTime(0);
        }
    }, [rankedMatchingQueue, currentUserWithStatus?.id, lobbyChannel]);

    useEffect(() => {
        if (aggregateLobbyMode) setUserTab('users');
    }, [aggregateLobbyMode]);

    const [pairLobbyRoomForm, setPairLobbyRoomForm] = useState<'closed' | 'create' | 'edit' | 'propose'>('closed');
    /** 방장: 대국 설정 변경 제안 — 알림(notice) → 제안 내용 검토(review) */
    const [ownerLobbySettingProposalStep, setOwnerLobbySettingProposalStep] = useState<'none' | 'notice' | 'review'>('none');
    const ownerLobbyProposalNoticeIdRef = useRef<string | null>(null);
    const preLobbyChangeProposalDigestRef = useRef<string | null>(null);
    const guestLobbyProposalOutcomeShownIdRef = useRef<string | null>(null);
    const prevPairLobbySettingProposalRef = useRef<
        | { proposalId: string; fromUserId: string; fromUserName: string; createdAt: number; payload: unknown }
        | undefined
    >(undefined);
    const [guestLobbyChangeProposalOutcome, setGuestLobbyChangeProposalOutcome] = useState<'accepted' | 'rejected' | null>(
        null,
    );
    const [guestLobbyChangeProposeConfirmOpen, setGuestLobbyChangeProposeConfirmOpen] = useState(false);
    /** 핸드헬드「페어 방 만들기」모달: AiChallengeModal 단계 초기화용 키 */
    const [pairCreateRoomModalNonce, setPairCreateRoomModalNonce] = useState(0);
    const [createModalTitle, setCreateModalTitle] = useState('');
    const [createModalRoomKind, setCreateModalRoomKind] = useState<RoomKind>(() =>
        resolveCreateModalRoomKind(lobbyChannel, lobbyIntent, false),
    );
    const [createModalVisibility, setCreateModalVisibility] = useState<Visibility>('public');
    const [createModalPassword, setCreateModalPassword] = useState('');
    /** 비밀번호 칸: 안내 placeholder는 포커스 시 숨김, 비우고 블러하면 다시 표시 */
    const [createModalPasswordFieldFocused, setCreateModalPasswordFieldFocused] = useState(false);
    const [createModalDraftGame, setCreateModalDraftGame] = useState<PairCreateModalDraftBundle>(() => {
        const rk = resolveCreateModalRoomKind(lobbyChannel, lobbyIntent, false);
        return loadCreateModalDraftBundleForRoomKind(lobbyChannel, rk);
    });

    const [partnerInviteModalOpen, setPartnerInviteModalOpen] = useState(false);
    const [partnerInviteTargetSlot, setPartnerInviteTargetSlot] = useState<{ team: 'teamA' | 'teamB'; index: 0 | 1 } | null>(null);
    const [pairMatchSettingsModalOpen, setPairMatchSettingsModalOpen] = useState(false);
    const [pairRankedMatchModalOpen, setPairRankedMatchModalOpen] = useState(false);
    const [strategicArenaRankedModalOpen, setStrategicArenaRankedModalOpen] = useState(false);
    const [duoRankedMatchModalOpen, setDuoRankedMatchModalOpen] = useState(false);
    /** 페어 경기장 본로비: 유저 목록 상단에서 펫 페어 랭킹전 모달 */
    const [pairLobbyPetRankedModalOpen, setPairLobbyPetRankedModalOpen] = useState(false);
    /** 전략·놀이 집계 로비: 유저 목록 상단 `RankedMatchPanel`과 동기 */
    const [aggregateLobbyRankedMatching, setAggregateLobbyRankedMatching] = useState(false);
    const [aggregateLobbyRankedMatchingStartTime, setAggregateLobbyRankedMatchingStartTime] = useState(0);
    /** 페어 본로비: 유저 목록 상단 AI(페어 껍데기) */
    const [kickConfirmModal, setKickConfirmModal] = useState<{ userId: string; userName: string } | null>(null);
    const [kickConfirmBusy, setKickConfirmBusy] = useState(false);
    const [delegateConfirmModal, setDelegateConfirmModal] = useState<{ userId: string; userName: string } | null>(null);
    const [delegateConfirmBusy, setDelegateConfirmBusy] = useState(false);
    const [localInviteCooldownUntilByInviteeId, setLocalInviteCooldownUntilByInviteeId] = useState<Record<string, number>>({});
    const [cooldownUiTick, setCooldownUiTick] = useState(0);
    /** 뒤로가기 등으로 해시가 바뀐 뒤 복귀시킬 목적지(방 퇴장 확인용) */
    const [pairLeaveNavTargetHash, setPairLeaveNavTargetHash] = useState<string | null>(null);
    /** 방 참여 중 경기장 탭(전략/페어/놀이) 전환 시 — 해시 이동과 동일하게 나가기 확인 후 이동 */
    const [pendingArenaNavTarget, setPendingArenaNavTarget] = useState<ArenaLobbyNavKind | null>(null);
    const [pendingIntentNavTarget, setPendingIntentNavTarget] = useState<ArenaLobbyIntent | null>(null);
    const pairLobbyPresenceClientIdRef = useRef<string | null>(null);
    /** handleAction 직후 `hashchange`가 리렌더보다 먼저 오는 경우 — 페어 껍데기 경기장 입장은 가로채지 않음 */
    const pairShellGameNavAllowIdRef = useRef<string | null>(null);

    const getPairLobbyPresenceClientId = () => {
        if (pairLobbyPresenceClientIdRef.current) {
            return pairLobbyPresenceClientIdRef.current;
        }
        try {
            const stored = sessionStorage.getItem(PAIR_LOBBY_PRESENCE_CLIENT_ID_SESSION_KEY);
            if (stored) {
                pairLobbyPresenceClientIdRef.current = stored;
                return stored;
            }
        } catch {
            // ignore
        }
        const id =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `pair-lobby-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        pairLobbyPresenceClientIdRef.current = id;
        try {
            sessionStorage.setItem(PAIR_LOBBY_PRESENCE_CLIENT_ID_SESSION_KEY, id);
        } catch {
            // ignore
        }
        return id;
    };

    useEffect(() => {
        lobbyChannelRef.current = lobbyChannel;
        lobbyIntentRef.current = lobbyIntent;

        const clientId = getPairLobbyPresenceClientId();
        let lastActiveKey = '';
        let lastActiveAt = 0;

        const markActive = (force = false) => {
            const ch = lobbyChannelRef.current;
            const intent = lobbyIntentRef.current;
            const key = `${clientId}|${ch}|${intent}`;
            const now = Date.now();
            if (!force && key === lastActiveKey && now - lastActiveAt < 1000) return;
            lastActiveKey = key;
            lastActiveAt = now;
            void handleActionRef.current({
                type: 'PAIR_SET_LOBBY_SCREEN',
                payload: {
                    active: true,
                    clientId,
                    lobbyChannel: ch,
                    lobbyIntent: intent,
                },
            }).catch(() => undefined);
        };

        markActive(true);
        const heartbeatId = window.setInterval(() => markActive(true), 15000);
        return () => {
            window.clearInterval(heartbeatId);
            if (intentNavDebounceRef.current != null) {
                window.clearTimeout(intentNavDebounceRef.current);
                intentNavDebounceRef.current = null;
            }
            void handleActionRef.current({
                type: 'PAIR_SET_LOBBY_SCREEN',
                payload: {
                    active: false,
                    clientId,
                    lobbyChannel: lobbyChannelRef.current,
                    lobbyIntent: lobbyIntentRef.current,
                },
            }).catch(() => undefined);
        };
    }, [lobbyChannel, lobbyIntent]);

    useEffect(() => {
        handleActionRef.current({ type: 'PAIR_SYNC' }).catch(() => undefined);
        handleActionRef.current({ type: 'FRIEND_SYNC' }).catch(() => undefined);
    }, []);

    const mergedInviteCooldownUntilByInviteeId = useMemo(
        () => ({ ...pairInviteCooldownUntilByInviteeId, ...localInviteCooldownUntilByInviteeId }),
        [pairInviteCooldownUntilByInviteeId, localInviteCooldownUntilByInviteeId],
    );

    const pairRoomsAllChannels = useMemo(
        () => Object.values((pairRooms || {}) as Record<string, PairRoom>),
        [pairRooms],
    );
    const currentUserId = currentUserWithStatus?.id || '';
    const roomsAllInLobbyChannel = useMemo(
        () => pairRoomsAllChannels.filter((r) => (r.lobbyChannel ?? 'pair') === lobbyChannel),
        [pairRoomsAllChannels, lobbyChannel],
    );
    const lobbyDestination = useMemo(
        () => ({ intent: lobbyIntent, channel: lobbyChannel }),
        [lobbyIntent, lobbyChannel],
    );
    const roomVisibleInLobby = useCallback(
        (r: PairRoom) => isPairRoomVisibleInLobbyIntent(r, lobbyDestination, currentUserId),
        [lobbyDestination, currentUserId],
    );
    /** intent·pairMode·껍데기 방 규칙으로 목록 노출 방 필터 */
    const rooms = useMemo(
        () => roomsAllInLobbyChannel.filter(roomVisibleInLobby),
        [roomsAllInLobbyChannel, roomVisibleInLobby],
    );
    const pairPetRankedQueueCountsByMode = useMemo(() => {
        const counts: Partial<Record<GameMode, number>> = {};
        for (const m of RANKED_STRATEGIC_MODES) counts[m] = 0;
        for (const r of roomsAllInLobbyChannel) {
            if ((r.lobbyChannel ?? 'pair') !== 'pair') continue;
            if (r.roomKind !== 'ai_duel' || r.phase !== 'matching') continue;
            if ((r.extraPairMembers?.length ?? 0) > 0) continue;
            const m = pairLobbyPairModeOrDefault(r.selectedGameMode);
            if (!RANKED_STRATEGIC_MODES.includes(m)) continue;
            counts[m] = (counts[m] ?? 0) + 1;
        }
        return counts;
    }, [roomsAllInLobbyChannel]);
    /** 전략·놀이 경기장 2인 페어 듀오 랭킹전 큐 — 모드별 대기 팀 수 (페어 본로비는 펫 랭킹만 별도 큐) */
    const duoPairRankedQueueCountsByMode = useMemo(() => {
        const counts: Partial<Record<GameMode, number>> = {};
        for (const m of RANKED_STRATEGIC_MODES) counts[m] = 0;
        for (const r of roomsAllInLobbyChannel) {
            const ch = r.lobbyChannel ?? 'pair';
            if (ch !== 'strategic' && ch !== 'playful') continue;
            if (r.roomKind !== 'duo_match' || r.phase !== 'matching') continue;
            if (r.pairDuoRankedLobbyProposal || r.pairRankedPetProposal) continue;
            const m = pairLobbyPairModeOrDefault(r.selectedGameMode);
            if (!RANKED_STRATEGIC_MODES.includes(m)) continue;
            counts[m] = (counts[m] ?? 0) + 1;
        }
        return counts;
    }, [roomsAllInLobbyChannel]);
    /** 전역 전략바둑 랭킹 매칭 큐 — 모드별 대기 인원(선택 모드에 포함된 유저 수) */
    const strategicRankedQueueCountsByMode = useMemo(() => {
        const counts: Partial<Record<GameMode, number>> = {};
        for (const m of RANKED_STRATEGIC_MODES) counts[m] = 0;
        const q = rankedMatchingQueue?.strategic as Record<string, { selectedModes?: GameMode[] }> | undefined;
        if (!q || typeof q !== 'object') return counts;
        for (const entry of Object.values(q)) {
            const modes = entry?.selectedModes;
            if (!Array.isArray(modes)) continue;
            for (const mode of modes) {
                if (RANKED_STRATEGIC_MODES.includes(mode)) counts[mode] = (counts[mode] ?? 0) + 1;
            }
        }
        return counts;
    }, [rankedMatchingQueue]);
    /** 현재 탭 경기장과 무관하게, 어느 채널 방이든 소속이면 참여 중으로 본다 */
    const myRoomAnyLobbyChannel = useMemo(
        () => pairRoomsAllChannels.find((r) => userInPairRoomClient(r, currentUserId)) ?? null,
        [pairRoomsAllChannels, currentUserId],
    );
    const userParticipatingInAnyPairRoom = Boolean(myRoomAnyLobbyChannel);
    const isPairAiWaitingLobby = lobbyChannel === 'pair' && lobbyIntent === 'ai';
    /** PVP 방만 이동 시 나가기 확인 — 페어 AI 대전·AI 로비 껍데기 방은 자유 이동 */
    const pairRoomBlockingNavigation = Boolean(
        !isPairAiWaitingLobby &&
            myRoomAnyLobbyChannel &&
            pairRoomRequiresLeaveConfirmation(myRoomAnyLobbyChannel),
    );
    const lobbyTone: WaitingLobbyPanelTone =
        lobbyChannel === 'playful' ? 'playful' : lobbyChannel === 'pair' ? 'pair' : 'strategic';

    const pairLobbyListFilterSelectClassResolved = useMemo(
        () => pairLobbyListFilterSelectClassForTone(lobbyTone, false),
        [lobbyTone],
    );
    const pairLobbyListFilterSelectClassHandheldResolved = useMemo(
        () => pairLobbyListFilterSelectClassForTone(lobbyTone, true),
        [lobbyTone],
    );

    const waitingLobbyGlass =
        aggregateLobbyMode === 'strategic' || aggregateLobbyMode === 'playful'
            ? 'backdrop-blur-xl backdrop-saturate-150 will-change-[backdrop-filter] [transform:translateZ(0)]'
            : '';

    const usersInAggregateLobby = useMemo(() => {
        if (!aggregateLobbyMode || !currentUserWithStatus) return [] as UserWithStatus[];
        const isStrategicLobby = aggregateLobbyMode === 'strategic';
        const matchesIntent = (u: { lobbyIntent?: ArenaLobbyIntent }) =>
            !u.lobbyIntent || u.lobbyIntent === lobbyIntent;
        const all = onlineUsers.filter((u) => u && userInUnifiedArenaLobbyUserList(u) && matchesIntent(u));
        const me = all.find((u) => u.id === currentUserWithStatus.id);
        if (!me) {
            const { waitingLobby: _w, mode: _m, ...userBase } = currentUserWithStatus;
            const currentUserInRoom: UserWithStatus = {
                ...userBase,
                status: UserStatus.Waiting,
                waitingLobby: isStrategicLobby ? 'strategic' : 'playful',
                arenaChannel: isStrategicLobby ? 'strategic' : 'playful',
                lobbyIntent,
            };
            return [currentUserInRoom, ...all];
        }
        return [me, ...all.filter((u) => u.id !== currentUserWithStatus.id)];
    }, [aggregateLobbyMode, onlineUsers, currentUserWithStatus, lobbyIntent]);

    const leaveAiShellRoomSilently = useCallback(() => {
        const room = myRoomAnyLobbyChannel;
        if (!room) return;
        if (!isPairAiWaitingLobby && pairRoomRequiresLeaveConfirmation(room)) return;
        void handlers.handleAction({ type: 'PAIR_LEAVE_ROOM' }).catch(() => undefined);
    }, [myRoomAnyLobbyChannel, handlers, isPairAiWaitingLobby]);

    const navigateArenaTab = useCallback(
        (target: ArenaLobbyNavKind) => {
            if (target === (lobbyChannel as ArenaLobbyNavKind)) return;
            if (pairRoomBlockingNavigation) {
                setPendingArenaNavTarget(target);
                return;
            }
            leaveAiShellRoomSilently();
            if (lobbyChannel === 'strategic' || lobbyChannel === 'playful') {
                void handlers.handleAction({ type: 'LEAVE_WAITING_ROOM' });
            }
            replaceAppHash(arenaLobbyHash({ intent: lobbyIntent, channel: target }));
        },
        [lobbyChannel, lobbyIntent, handlers, pairRoomBlockingNavigation, leaveAiShellRoomSilently],
    );

    const navigateIntentTab = useCallback(
        (target: ArenaLobbyIntent) => {
            if (target === lobbyIntent) return;
            if (pairRoomBlockingNavigation) {
                setPendingIntentNavTarget(target);
                return;
            }
            setPairLobbyRoomForm('closed');
            if (intentNavDebounceRef.current != null) {
                window.clearTimeout(intentNavDebounceRef.current);
            }
            intentNavDebounceRef.current = window.setTimeout(() => {
                intentNavDebounceRef.current = null;
                leaveAiShellRoomSilently();
                if (lobbyChannel === 'strategic' || lobbyChannel === 'playful') {
                    void handlers.handleAction({ type: 'LEAVE_WAITING_ROOM' });
                }
                replaceAppHash(arenaLobbyHash({ intent: target, channel: lobbyChannel }));
            }, 120);
        },
        [lobbyChannel, lobbyIntent, handlers, pairRoomBlockingNavigation, leaveAiShellRoomSilently],
    );

    const backToProfile = useCallback(() => {
        window.location.hash = '#/profile';
        if (lobbyChannel === 'strategic' || lobbyChannel === 'playful') {
            void handlers.handleAction({ type: 'LEAVE_WAITING_ROOM' }).catch(() => undefined);
        }
    }, [lobbyChannel, handlers]);

    const titleHeadingClass =
        lobbyChannel === 'playful'
            ? 'relative z-[1] min-w-0 flex-1 truncate text-left text-sm font-bold text-amber-50 sm:text-lg lg:text-xl drop-shadow-[0_0_14px_rgba(251,191,36,0.2)]'
            : lobbyChannel === 'pair'
              ? 'relative z-[1] min-w-0 flex-1 truncate text-left text-sm font-bold sm:text-lg lg:text-xl bg-gradient-to-r from-violet-200 via-fuchsia-200 to-violet-300 bg-clip-text text-transparent drop-shadow-[0_0_16px_rgba(167,139,250,0.35)]'
              : 'relative z-[1] min-w-0 flex-1 truncate text-left text-sm font-bold sm:text-lg lg:text-xl bg-gradient-to-r from-cyan-100 via-sky-100 to-cyan-200 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(34,211,238,0.22)]';

    const pairRoomCodeSortKey = (code: string): number => {
        const s = String(code).trim();
        const n = parseInt(s, 10);
        return Number.isFinite(n) && n >= 1 && String(n) === s ? n : Number.MAX_SAFE_INTEGER;
    };
    const sortedRooms = useMemo(
        () =>
            [...rooms].sort((a, b) => {
                const ka = pairRoomCodeSortKey(a.code);
                const kb = pairRoomCodeSortKey(b.code);
                if (ka !== kb) return ka - kb;
                return a.createdAt - b.createdAt;
            }),
        [rooms],
    );

    const roomMatchesPairLobbyListFilters = useCallback(
        (r: PairRoom) => {
            if (pairLobbyListRoomKindFilter !== 'all') {
                if (pairLobbyListDisplayRoomKind(r, lobbyChannel) !== pairLobbyListRoomKindFilter) return false;
            }
            if (pairLobbyListGameModeFilter !== 'all' && r.selectedGameMode !== pairLobbyListGameModeFilter) {
                return false;
            }
            return true;
        },
        [pairLobbyListRoomKindFilter, pairLobbyListGameModeFilter, lobbyChannel],
    );
    /** 경기 중(in_game) 껍데기 방도 소속 방으로 인정 — 인게임에서 복귀 시 같은 방 UI·중복 입장 방지 유지 */
    const myRoom = useMemo(
        () => rooms.find((r) => userInPairRoomClient(r, currentUserId)) || null,
        [rooms, currentUserId],
    );
    /** 솔로 모드에서 남은 2인 AI 초대 껍데기 방은 유저 열·모바일 방 탭에 노출하지 않음 */
    const myRoomForUsersColumnChrome = useMemo(() => {
        if (!myRoom) return null;
        if (
            lobbyChannel === 'pair' &&
            lobbyIntent === 'ai' &&
            pairAiLobbyMatchMode === 'solo' &&
            isPairAiDuoInviteOnlyRoom(myRoom)
        ) {
            return null;
        }
        return myRoom;
    }, [myRoom, lobbyChannel, lobbyIntent, pairAiLobbyMatchMode]);

    const showHandheldMyRoomTab = useMemo(
        () => showHandheldPairLobbyMyRoomTab(myRoomForUsersColumnChrome, lobbyIntent, lobbyChannel),
        [myRoomForUsersColumnChrome, lobbyIntent, lobbyChannel],
    );

    /** 활성 쿨다운이 있을 때만 500ms 틱 — 전략 AI 대기실(방 없음) 등에서는 전체 로비 리렌더 방지 */
    useEffect(() => {
        const lobbyChangeCooldownUntil = myRoom?.pairLobbySettingChangeCooldownUntil?.[currentUserId];
        const lobbyChangeCooldownActive =
            typeof lobbyChangeCooldownUntil === 'number' && lobbyChangeCooldownUntil > Date.now();
        const inviteCooldownActive = Object.values({
            ...pairInviteCooldownUntilByInviteeId,
            ...localInviteCooldownUntilByInviteeId,
        }).some((until) => until > Date.now());
        if (!lobbyChangeCooldownActive && !inviteCooldownActive) {
            return;
        }
        const id = window.setInterval(() => setCooldownUiTick((t) => t + 1), 500);
        return () => window.clearInterval(id);
    }, [
        myRoom,
        currentUserId,
        pairInviteCooldownUntilByInviteeId,
        localInviteCooldownUntilByInviteeId,
    ]);

    /** 페어 펫 랭킹전 큐 껍데기로 매칭 대기 중 — 중앙 슬롯 목록에는 비표시, 포커스는 랭킹 패널(전략 경기장 랭킹전과 동일) */
    const isPairPetRankedQueueShellMatching = Boolean(
        lobbyChannel === 'pair' &&
            myRoom?.roomKind === 'ai_duel' &&
            myRoom.pairPetRankedQueueShell &&
            myRoom.phase === 'matching' &&
            !myRoom.pairRankedPetProposal,
    );
    const pairRankedMatchApButtonLabel = useMemo(() => {
        const base = pairRankedLobbyActionPointCost(lobbyChannel, myRoom?.selectedGameMode);
        if (!currentUserWithStatus) return String(base);
        const eff = effectivePairRankedApCostForUser(currentUserWithStatus as User, base, { lobbyChannel });
        return formatActionPointCostWithPetDiscount(base, eff);
    }, [lobbyChannel, myRoom?.selectedGameMode, currentUserWithStatus]);
    const strategicArenaRankedApButtonLabel = useMemo(() => {
        if (!currentUserWithStatus) return String(STRATEGIC_ACTION_POINT_COST);
        const eff = effectiveStrategicRankedQueueApCostForUser(currentUserWithStatus as User);
        return formatActionPointCostWithPetDiscount(STRATEGIC_ACTION_POINT_COST, eff);
    }, [currentUserWithStatus]);
    /** 전략·놀이 경기장 `duo_match` 친선 대기(랭킹 제안·매칭 단계 제외) — UI는 페어 4칸이 아닌 팀당 1슬롯·「경기 시작」 흐름 */
    const isArenaFriendlyDuoWaitingRoom = Boolean(
        myRoom?.roomKind === 'duo_match' &&
            (lobbyChannel === 'strategic' || lobbyChannel === 'playful') &&
            !myRoom?.pairDuoRankedLobbyProposal &&
            ((myRoom?.phase ?? 'waiting') === 'waiting' || myRoom?.phase === 'ready'),
    );
    /** 2인 페어(`duo_match`) 듀오 인간 랭킹전: 전략 경기장에서 랭킹/제안/매칭 단계일 때만 — 놀이/페어는 제외 */
    const isDuoArenaRanked = Boolean(
        myRoom?.roomKind === 'duo_match' && lobbyChannel === 'strategic' && !isArenaFriendlyDuoWaitingRoom,
    );

    const handheldLobbyMainTabGridColsClass = useMemo(() => {
        let n = 0;
        if (lobbyIntent === 'pvp') n += 1;
        if (showHandheldMyRoomTab) n += 1;
        n += 1;
        if (lobbyIntent === 'ai') n += 1;
        if (showHandheldRankedTab && lobbyIntent === 'pvp') n += 1;
        if (n <= 3) return 'grid-cols-3';
        if (n === 4) return 'grid-cols-4';
        if (n === 5) return 'grid-cols-5';
        return 'grid-cols-6';
    }, [showHandheldMyRoomTab, lobbyIntent, showHandheldRankedTab]);

    useEffect(() => {
        if (!isHandheld || pairLobbyMobileTab !== 'room') return;
        if (!showHandheldMyRoomTab) {
            setPairLobbyMobileTab(lobbyIntent === 'ai' ? 'ai' : 'users');
        }
    }, [isHandheld, pairLobbyMobileTab, showHandheldMyRoomTab, lobbyIntent]);

    useEffect(() => {
        if (lobbyIntent === 'ai' && pairLobbyMobileTab === 'rooms') {
            setPairLobbyMobileTab('ai');
        } else if (lobbyIntent === 'pvp' && pairLobbyMobileTab === 'ai') {
            setPairLobbyMobileTab('rooms');
        }
    }, [lobbyIntent, pairLobbyMobileTab]);

    useEffect(() => {
        if (!aggregateLobbyMode && lobbyIntent !== 'ai' && pairLobbyMobileTab === 'ai') {
            setPairLobbyMobileTab('users');
        }
    }, [aggregateLobbyMode, pairLobbyMobileTab, lobbyIntent]);

    useEffect(() => {
        if (!aggregateLobbyMode && pairLobbyRightTab === 'ai') setPairLobbyRightTab('users');
    }, [aggregateLobbyMode, pairLobbyRightTab]);

    /** 페어 랭킹전 대기(모바일): 랭킹 탭으로 포커스 — PC는 `pairLobbyRightTab` 이펙트·분할 숨김으로 처리 */
    useEffect(() => {
        if (!isPairPetRankedQueueShellMatching || !isHandheld) return;
        setPairLobbyMobileTab('ranked');
    }, [isPairPetRankedQueueShellMatching, isHandheld]);

    /** PC: AI 대결 카드는 좌측 패널로 옮겨 우측 「AI대결」탭 제거 */
    useEffect(() => {
        if (isHandheld || !aggregateLobbyMode) return;
        if (pairLobbyRightTab === 'ai') setPairLobbyRightTab('users');
    }, [aggregateLobbyMode, isHandheld, pairLobbyRightTab]);

    /** 페어 AI 솔로 전환 시 유저 열을 방 탭이 아닌 목록으로 */
    useEffect(() => {
        if (lobbyChannel !== 'pair' || lobbyIntent !== 'ai' || pairAiLobbyMatchMode !== 'solo') return;
        setPairLobbyRightTab('users');
        if (isHandheld && pairLobbyMobileTab === 'room' && !myRoomForUsersColumnChrome) {
            setPairLobbyMobileTab('ai');
        }
    }, [lobbyChannel, lobbyIntent, pairAiLobbyMatchMode, isHandheld, pairLobbyMobileTab, myRoomForUsersColumnChrome]);

    /** 방 입장 시 우측을 방 탭으로 — 펫 랭킹 큐 껍데기 방(PC)은 방 UI 대신 유저 열(랭킹·매칭 패널) 유지 (AI·비-PVP) */
    useEffect(() => {
        if (!myRoomForUsersColumnChrome || lobbyIntent === 'pvp') return;
        if (isPairPetRankedQueueShellMatching && !isHandheld) {
            setPairLobbyRightTab('users');
            return;
        }
        setPairLobbyRightTab('room');
    }, [
        myRoomForUsersColumnChrome,
        myRoomForUsersColumnChrome?.id,
        lobbyIntent,
        isHandheld,
        isPairPetRankedQueueShellMatching,
    ]);

    /** PVP PC: 참여 중인 방이 생기면 중앙 열을 내 방 탭으로 */
    useEffect(() => {
        if (!myRoom || lobbyIntent !== 'pvp' || isHandheld) return;
        if (isPairPetRankedQueueShellMatching) return;
        setPairLobbyCenterTab('room');
    }, [myRoom?.id, lobbyIntent, isHandheld, isPairPetRankedQueueShellMatching]);

    useEffect(() => {
        if (!myRoom) {
            setPairLobbyCenterTab('rooms');
            setPairLobbyMobileTab((t) => (t === 'room' ? (lobbyIntent === 'ai' ? 'ai' : 'rooms') : t));
            setPairRankedMatchModalOpen(false);
            setDuoRankedMatchModalOpen(false);
            setStrategicArenaRankedModalOpen(false);
            setPairLobbyPetRankedModalOpen(false);
            setPendingArenaNavTarget(null);
        }
    }, [myRoom, lobbyIntent]);

    /** 방 퇴장·강퇴 등으로 `myRoom`이 없어지면 제안/수정 모달이 열린 채로 남는 문제 방지 */
    useEffect(() => {
        if (!myRoom && (pairLobbyRoomForm === 'propose' || pairLobbyRoomForm === 'edit')) {
            setPairLobbyRoomForm('closed');
        }
    }, [myRoom, pairLobbyRoomForm]);

    useEffect(() => {
        if (!isHandheld || !myRoom?.id) return;
        if (
            myRoom.pairPetRankedQueueShell &&
            myRoom.phase === 'matching' &&
            !myRoom.pairRankedPetProposal
        ) {
            return;
        }
        setPairLobbyMobileTab(handheldPairLobbyRoomFocusTab(myRoom, lobbyIntent, lobbyChannel));
    }, [
        isHandheld,
        myRoom?.id,
        myRoom?.roomKind,
        myRoom?.pairPetRankedQueueShell,
        myRoom?.phase,
        myRoom?.pairRankedPetProposal,
        lobbyIntent,
        lobbyChannel,
    ]);

    /** 초대 수락 직후 등: 펫/방목록에 머물지 않고 N번방 탭으로 이동(모바일) */
    useEffect(() => {
        if (!isHandheld || !myRoom?.id) return;
        try {
            if (sessionStorage.getItem(PAIR_LOBBY_FOCUS_ROOM_TAB_SESSION_KEY) !== '1') return;
            sessionStorage.removeItem(PAIR_LOBBY_FOCUS_ROOM_TAB_SESSION_KEY);
            setPairLobbyMobileTab(handheldPairLobbyRoomFocusTab(myRoom, lobbyIntent, lobbyChannel));
        } catch {
            // ignore
        }
    }, [isHandheld, myRoom?.id, myRoom?.roomKind, lobbyIntent, lobbyChannel]);

    useEffect(() => {
        pairRoomChatSendCooldownRef.current = false;
        pairRoomChatSendInFlightRef.current = false;
        setPairRoomChatSendCooldownUi(false);
        if (pairRoomChatCooldownTimerRef.current != null) {
            window.clearTimeout(pairRoomChatCooldownTimerRef.current);
            pairRoomChatCooldownTimerRef.current = null;
        }
    }, [myRoom?.id]);

    /** 필터 적용 전체(고아 방·빠른참가 등) — 서버 `pairRooms` 기준 */
    const sortedRoomsMatchingFilters = useMemo(
        () => sortedRooms.filter(roomMatchesPairLobbyListFilters),
        [sortedRooms, roomMatchesPairLobbyListFilters],
    );

    /** 슬롯 그리드에 표시할 방만 — 슬롯 구간 요청으로 채운 `lobbyGridRooms` */
    const sortedLobbyGridRoomsForPublicList = useMemo(() => {
        const list = Object.values(lobbyGridRooms).filter((r) => (r.lobbyChannel ?? 'pair') === lobbyChannel);
        return [...list]
            .sort((a, b) => {
                const ka = pairRoomCodeSortKey(a.code);
                const kb = pairRoomCodeSortKey(b.code);
                if (ka !== kb) return ka - kb;
                return a.createdAt - b.createdAt;
            })
            .filter(roomMatchesPairLobbyListFilters);
    }, [lobbyGridRooms, lobbyChannel, roomMatchesPairLobbyListFilters]);

    /** 그리드 슬롯별 방: 가상 스크롤 구간(`lobbyGridRooms`) + 전체 채널 목록 보강 — 경기 시작 후에도 번호 점유·상태가 보이게 함 */
    const roomBySlotNumberForLobbyGrid = useMemo(() => {
        const m = new Map<number, PairRoom>();
        const hideOwnRankedShellId =
            isPairPetRankedQueueShellMatching && myRoom?.id ? myRoom.id : null;
        const tryPlace = (room: PairRoom) => {
            if (hideOwnRankedShellId && room.id === hideOwnRankedShellId) return;
            const sn = pairLobbyGridSlotFromRoomCode(room.code);
            if (sn === null) return;
            if (!m.has(sn)) m.set(sn, room);
        };
        for (const room of sortedLobbyGridRoomsForPublicList) tryPlace(room);
        for (const room of sortedRoomsMatchingFilters) tryPlace(room);
        return m;
    }, [
        sortedLobbyGridRoomsForPublicList,
        sortedRoomsMatchingFilters,
        isPairPetRankedQueueShellMatching,
        myRoom?.id,
    ]);

    const orphanPairRoomsForLobbyGrid = useMemo(
        () =>
            sortedRoomsMatchingFilters.filter(
                (r) =>
                    pairLobbyGridSlotFromRoomCode(r.code) === null &&
                    !r.pairPetRankedQueueShell &&
                    !isPairAiDuoInviteOnlyRoom(r),
            ),
        [sortedRoomsMatchingFilters],
    );

    const [pairLobbySlotGridViewport, setPairLobbySlotGridViewport] = useState({ scrollTop: 0, clientHeight: 0 });
    const pairLobbySlotGridScrollRef = useRef<HTMLDivElement>(null);
    const fetchedGridSlotsRef = useRef<Set<number>>(new Set());
    const lobbyGridSliceRequestSeqRef = useRef(0);
    const lobbyGridSliceDebounceRef = useRef<number | null>(null);

    const onPairLobbySlotGridScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        setPairLobbySlotGridViewport({ scrollTop: el.scrollTop, clientHeight: el.clientHeight });
    }, []);

    useLayoutEffect(() => {
        const el = pairLobbySlotGridScrollRef.current;
        if (!el) return;
        const sync = () =>
            setPairLobbySlotGridViewport((prev) => ({
                scrollTop: el.scrollTop,
                clientHeight: el.clientHeight || prev.clientHeight,
            }));
        sync();
        const ro = new ResizeObserver(() => sync());
        ro.observe(el);
        return () => ro.disconnect();
    }, [pairLobbyMobileTab, pairLobbyCenterTab, pairLobbyRoomForm, lobbyChannel, lobbyIntent]);

    const pairLobbySlotGridEffectiveViewportHeightPx = useMemo(() => {
        const measured = pairLobbySlotGridViewport.clientHeight;
        const fallback = isHandheld
            ? PAIR_LOBBY_ROOM_SLOT_VIEWPORT_FALLBACK_HANDHELD_PX
            : PAIR_LOBBY_ROOM_SLOT_VIEWPORT_FALLBACK_PX;
        if (measured >= 72) return measured;
        return Math.max(measured, fallback);
    }, [pairLobbySlotGridViewport.clientHeight, isHandheld]);

    /** PC: 한 화면에 약 10행. 모바일: 카드 가독성 유지하며 7~8행 노출 */
    const pairLobbySlotRowHeightPx = useMemo(() => {
        const ch = pairLobbySlotGridEffectiveViewportHeightPx;
        if (ch < 40) return isHandheld ? PAIR_LOBBY_ROOM_SLOT_ROW_FALLBACK_HANDHELD_PX : PAIR_LOBBY_ROOM_SLOT_ROW_FALLBACK_PX;
        if (isHandheld) {
            return Math.max(68, Math.min(104, Math.round(ch / 8)));
        }
        return Math.max(36, Math.min(72, Math.round(ch / 10)));
    }, [pairLobbySlotGridEffectiveViewportHeightPx, isHandheld]);

    const pairLobbySlotGridVisibleRange = useMemo(() => {
        const rh = pairLobbySlotRowHeightPx;
        const maxRow = PAIR_LOBBY_ROOM_SLOT_ROWS - 1;
        const ch = Math.max(1, pairLobbySlotGridEffectiveViewportHeightPx);
        const st = pairLobbySlotGridViewport.scrollTop;
        const buf = PAIR_LOBBY_ROOM_SLOT_VIRTUAL_OVERSCAN_ROWS;
        const firstRow = Math.max(0, Math.floor(st / rh) - buf);
        const lastVisibleRow = Math.min(maxRow, Math.ceil((st + ch) / rh) - 1);
        const lastRow = Math.max(firstRow, Math.min(maxRow, lastVisibleRow + buf));
        return { firstRow, lastRow };
    }, [
        pairLobbySlotGridViewport.scrollTop,
        pairLobbySlotGridEffectiveViewportHeightPx,
        pairLobbySlotRowHeightPx,
    ]);

    useEffect(() => {
        fetchedGridSlotsRef.current = new Set();
        setLobbyGridRooms({});
        lobbyGridSliceRequestSeqRef.current += 1;
    }, [lobbyChannel]);

    useEffect(() => {
        if (!pairRooms) return;
        const fetched = fetchedGridSlotsRef.current;
        if (fetched.size === 0) return;
        setLobbyGridRooms(() => {
            const next: Record<string, PairRoom> = {};
            for (const [id, r] of Object.entries(pairRooms)) {
                const rr = r as PairRoom;
                if ((rr.lobbyChannel ?? 'pair') !== lobbyChannel) continue;
                const sn = pairLobbyGridSlotFromRoomCode(rr.code);
                if (sn != null && fetched.has(sn)) {
                    next[id] = rr;
                }
            }
            return next;
        });
    }, [pairRooms, lobbyChannel]);

    const fetchLobbyGridSlice = useCallback(
        async (fromSlot: number, toSlot: number) => {
            const from = Math.max(1, Math.min(PAIR_LOBBY_GRID_SLOT_COUNT, Math.min(fromSlot, toSlot)));
            const to = Math.max(1, Math.min(PAIR_LOBBY_GRID_SLOT_COUNT, Math.max(fromSlot, toSlot)));
            let anyMissing = false;
            for (let s = from; s <= to; s++) {
                if (!fetchedGridSlotsRef.current.has(s)) {
                    anyMissing = true;
                    break;
                }
            }
            if (!anyMissing) return;
            const seq = ++lobbyGridSliceRequestSeqRef.current;
            try {
                const result = await handlers.handleAction({
                    type: 'PAIR_LOBBY_ROOM_GRID_SLICE',
                    payload: { lobbyChannel, lobbyIntent, fromSlot: from, toSlot: to },
                } as ServerAction);
                if (seq !== lobbyGridSliceRequestSeqRef.current) return;
                const partial = (result as any)?.clientResponse?.pairRooms as Record<string, PairRoom> | undefined;
                for (let s = from; s <= to; s++) fetchedGridSlotsRef.current.add(s);
                setLobbyGridRooms((prev) => {
                    const next: Record<string, PairRoom> = { ...prev };
                    for (const [id, r] of Object.entries(prev)) {
                        const rr = r as PairRoom;
                        if ((rr.lobbyChannel ?? 'pair') !== lobbyChannel) continue;
                        const sn = pairLobbyGridSlotFromRoomCode(rr.code);
                        if (sn != null && sn >= from && sn <= to) delete next[id];
                    }
                    if (partial && typeof partial === 'object') {
                        for (const [id, r] of Object.entries(partial)) {
                            const room = r as PairRoom;
                            if (!roomVisibleInLobby(room)) continue;
                            next[id] = room;
                        }
                    }
                    return next;
                });
            } catch {
                /* ignore */
            }
        },
        [handlers, lobbyChannel, lobbyIntent, roomVisibleInLobby],
    );

    useEffect(() => {
        const initialEnd = isHandheld
            ? PAIR_LOBBY_ROOM_SLOT_INITIAL_FETCH_HANDHELD
            : PAIR_LOBBY_ROOM_SLOT_INITIAL_FETCH_DESKTOP;
        void fetchLobbyGridSlice(1, initialEnd);
    }, [lobbyChannel, lobbyIntent, fetchLobbyGridSlice, isHandheld]);

    useEffect(() => {
        if (lobbyGridSliceDebounceRef.current) {
            window.clearTimeout(lobbyGridSliceDebounceRef.current);
        }
        lobbyGridSliceDebounceRef.current = window.setTimeout(() => {
            lobbyGridSliceDebounceRef.current = null;
            const first = pairLobbySlotGridVisibleRange.firstRow;
            const last = pairLobbySlotGridVisibleRange.lastRow;
            void fetchLobbyGridSlice(first + 1, last + 1);
        }, 90);
        return () => {
            if (lobbyGridSliceDebounceRef.current) {
                window.clearTimeout(lobbyGridSliceDebounceRef.current);
                lobbyGridSliceDebounceRef.current = null;
            }
        };
    }, [pairLobbySlotGridVisibleRange.firstRow, pairLobbySlotGridVisibleRange.lastRow, fetchLobbyGridSlice]);

    const isPairPetRoom = myRoom?.roomKind === 'ai_duel';
    const isFriendlyTwoPetRoom = myRoom?.roomKind === 'friendly_2p';
    const isPairRoomMatching = myRoom?.phase === 'matching';
    const isPairRoomMatchPending = myRoom?.phase === 'match_pending';
    const matchQueuedAt = myRoom?.pairPetMatchingQueuedAt;
    const [matchElapsedSec, setMatchElapsedSec] = useState(0);
    useEffect(() => {
        if (!isPairRoomMatching || !matchQueuedAt) {
            setMatchElapsedSec(0);
            return;
        }
        const tick = () => setMatchElapsedSec(Math.floor((Date.now() - matchQueuedAt) / 1000));
        tick();
        const id = window.setInterval(tick, 1000);
        return () => window.clearInterval(id);
    }, [isPairRoomMatching, matchQueuedAt]);

    const myRoomRef = useRef(myRoom);
    const liveGamesRef = useRef(liveGames);
    const currentUserWithStatusRef = useRef(currentUserWithStatus);
    useEffect(() => {
        myRoomRef.current = myRoom;
    }, [myRoom]);
    useEffect(() => {
        liveGamesRef.current = liveGames;
    }, [liveGames]);
    useEffect(() => {
        currentUserWithStatusRef.current = currentUserWithStatus;
    }, [currentUserWithStatus]);

    useEffect(() => {
        if (!myRoom) {
            setPairLeaveNavTargetHash(null);
            setPendingArenaNavTarget(null);
            return;
        }
        const lobbyHomeHash = arenaLobbyHash({
            intent: lobbyIntentRef.current,
            channel: lobbyChannelRef.current,
        });
        const onHashOrPop = () => {
            const h = window.location.hash || '';
            if (!h || h === lobbyHomeHash) return;
            const room = myRoomRef.current;
            if (!room) return;

            const gameHashMatch = /^#\/game\/([^/?#]+)/.exec(h);
            if (gameHashMatch) {
                const gid = gameHashMatch[1];
                if (pairShellGameNavAllowIdRef.current === gid) {
                    pairShellGameNavAllowIdRef.current = null;
                    return;
                }
                const viewer = currentUserWithStatusRef.current;
                if (viewer?.gameId && viewer.gameId === gid) return;
                const lg = (liveGamesRef.current as Record<string, { settings?: { pairGame?: { roomId?: string } } }> | undefined)?.[gid];
                const shellRoomId = lg?.settings?.pairGame?.roomId;
                if (pairShellGameRoomIdMatchesMyRoom(shellRoomId, room.id)) return;
            }

            const inPairAiWaitingLobby =
                lobbyChannelRef.current === 'pair' && lobbyIntentRef.current === 'ai';
            if (inPairAiWaitingLobby || !pairRoomRequiresLeaveConfirmation(room)) {
                void handleActionRef.current({ type: 'PAIR_LEAVE_ROOM' }).catch(() => undefined);
                return;
            }

            setPairLeaveNavTargetHash(h);
            replaceAppHash(lobbyHomeHash);
        };
        window.addEventListener('hashchange', onHashOrPop);
        window.addEventListener('popstate', onHashOrPop);
        return () => {
            window.removeEventListener('hashchange', onHashOrPop);
            window.removeEventListener('popstate', onHashOrPop);
        };
    }, [myRoom?.id]);

    const hasEquippedPairPet = Boolean(currentUserWithStatus?.equippedPairPetTemplateId);
    const hasUsablePairPetForJoin = Boolean(
        currentUserWithStatus?.equippedPairPetTemplateId ||
            (currentUserWithStatus ? getEquippedPairPetInventoryRow(currentUserWithStatus) : null),
    );
    useEffect(() => {
        if (
            !isRoomKindAllowedForLobby(createModalRoomKind, { intent: lobbyIntent, channel: lobbyChannel })
        ) {
            setCreateModalRoomKind(resolveCreateModalRoomKind(lobbyChannel, lobbyIntent, hasEquippedPairPet));
        }
    }, [lobbyChannel, lobbyIntent, createModalRoomKind, hasEquippedPairPet]);
    useEffect(() => {
        if (pairLobbyRoomForm !== 'closed' && createModalRoomKind === 'friendly_2p' && !hasEquippedPairPet) {
            setCreateModalRoomKind(resolveCreateModalRoomKind(lobbyChannel, lobbyIntent, hasEquippedPairPet));
        }
    }, [pairLobbyRoomForm, createModalRoomKind, hasEquippedPairPet, lobbyChannel, lobbyIntent]);

    useEffect(() => {
        if (createModalVisibility !== 'private') setCreateModalPasswordFieldFocused(false);
    }, [createModalVisibility]);

    useEffect(() => {
        if (pairLobbyRoomForm !== 'create') return;
        const roomKindForStore =
            createModalRoomKind === 'friendly_2p' && !hasEquippedPairPet
                ? lobbyChannel === 'pair'
                    ? 'friendly_4p'
                    : 'duo_match'
                : createModalRoomKind;
        const ch = lobbyChannelRef.current;
        const prevDoc = loadPairLobbyCreatePrefsDoc(ch);
        savePairLobbyCreatePrefsDoc(
            ch,
            upsertPairLobbyCreateDraft(prevDoc, roomKindForStore, bundleToPersistedSlot(createModalDraftGame, ch)),
        );
    }, [pairLobbyRoomForm, createModalRoomKind, createModalDraftGame, hasEquippedPairPet, lobbyChannel]);

    const friendSet = useMemo(() => new Set(currentUserWithStatus?.friendIds || []), [currentUserWithStatus?.friendIds]);
    const guildId = currentUserWithStatus?.guildId;

    const pairUsers = useMemo(
        () =>
            onlineUsers.filter(
                (u) =>
                    userInUnifiedArenaLobbyUserList(u) &&
                    (!u.lobbyIntent || u.lobbyIntent === lobbyIntent) &&
                    ((u.inPairLobby && (u.arenaChannel ?? 'pair') === lobbyChannel) ||
                        (!u.inPairLobby && aggregateLobbyMode != null)),
            ),
        [onlineUsers, lobbyIntent, lobbyChannel, aggregateLobbyMode],
    );

    const displayedUsers = useMemo(() => {
        if (userTab === 'friends') return pairUsers.filter((u) => friendSet.has(u.id));
        if (userTab === 'guild') return pairUsers.filter((u) => guildId && u.guildId === guildId);
        return pairUsers;
    }, [userTab, pairUsers, friendSet, guildId]);

    const playersForLobbyUserList = useMemo(() => {
        if (!aggregateLobbyMode || !currentUserWithStatus) return displayedUsers;
        const uid = currentUserWithStatus.id;
        if (userTab === 'friends') {
            return usersInAggregateLobby.filter((u) => u.id === uid || friendSet.has(u.id));
        }
        if (userTab === 'guild') {
            return usersInAggregateLobby.filter((u) => u.id === uid || (!!guildId && u.guildId === guildId));
        }
        return usersInAggregateLobby;
    }, [aggregateLobbyMode, currentUserWithStatus, userTab, usersInAggregateLobby, friendSet, guildId, displayedUsers]);

    const openCreateRoomModal = () => {
        if (!currentUserWithStatus) return;
        if (myRoomAnyLobbyChannel) return window.alert('이미 참여 중인 방이 있습니다.');
        const nick = currentUserWithStatus.nickname;
        const defaultRoomTitle =
            lobbyChannel === 'strategic'
                ? `${nick}님의 전략바둑방`
                : lobbyChannel === 'playful'
                  ? `${nick}님의 놀이바둑방`
                  : `${nick}님의 페어방`;
        setCreateModalTitle(clampPairRoomTitle(defaultRoomTitle));
        const rk = resolveCreateModalRoomKind(lobbyChannel, lobbyIntent, hasEquippedPairPet);
        setCreateModalRoomKind(rk);
        setCreateModalVisibility('public');
        setCreateModalPassword('');
        setCreateModalPasswordFieldFocused(false);
        const baseBundleOc = loadCreateModalDraftBundleForRoomKind(lobbyChannel, rk);
        setCreateModalDraftGame(applyDraftBundleTransforms(baseBundleOc, transformPairDraftLobbySettings, lobbyChannel));
        setPairCreateRoomModalNonce((n) => n + 1);
        setPairLobbyRoomForm('create');
        if (lobbyIntent === 'pvp') {
            setPairLobbyCenterTab('rooms');
        }
        if (isHandheld) setPairLobbyMobileTab('rooms');
    };

    const createAiDuoMatchRoom = useCallback(async (): Promise<PairAiDuoRoomEnsureResult> => {
        if (!currentUserWithStatus) return 'error';
        const existing = myRoomAnyLobbyChannel;
        if (existing) {
            if (isPairAiDuoInviteOnlyRoom(existing)) return 'exists';
            window.alert('이미 참여 중인 방이 있습니다.');
            return 'error';
        }
        setIsBusy(true);
        try {
            const result = await handlers.handleAction({
                type: 'PAIR_CREATE_ROOM',
                payload: {
                    roomKind: 'duo_match',
                    lobbyChannel: 'pair',
                    lobbyIntent: 'ai',
                    visibility: 'public',
                    selectedGameMode: GameMode.Standard,
                    settings: { ...DEFAULT_GAME_SETTINGS },
                },
            } as ServerAction);
            const error = (result as { error?: string } | undefined)?.error;
            if (error === PAIR_ALREADY_IN_ROOM_SERVER_ERROR) {
                await handlers.handleAction({ type: 'PAIR_SYNC' } as ServerAction).catch(() => undefined);
                return 'exists';
            }
            if (error) {
                window.alert(error);
                return 'error';
            }
            return 'ok';
        } finally {
            setIsBusy(false);
        }
    }, [currentUserWithStatus, myRoomAnyLobbyChannel, handlers]);

    const openEditRoomModal = () => {
        if (!myRoom || myRoom.ownerId !== currentUserId) return;
        if (
            myRoom.phase === 'matching' ||
            myRoom.phase === 'match_pending' ||
            (myRoom.phase ?? 'waiting') === 'in_game' ||
            myRoom.pairRankedPetProposal ||
            myRoom.pairDuoRankedLobbyProposal
        ) {
            window.alert('매칭·대국 중에는 방 설정을 바꿀 수 없습니다.');
            return;
        }
        setCreateModalTitle(clampPairRoomTitle(myRoom.title));
        setCreateModalRoomKind(myRoom.roomKind);
        setCreateModalVisibility(myRoom.visibility);
        setCreateModalPassword('');
        setCreateModalPasswordFieldFocused(false);
        const edMode = myRoom.selectedGameMode ?? GameMode.Standard;
        const edSettings = { ...DEFAULT_GAME_SETTINGS, ...(myRoom.settings ?? {}) };
        setCreateModalDraftGame({
            mode: edMode,
            settings: edSettings,
            settingsByMode: { [edMode]: edSettings },
        });
        setPairLobbyRoomForm('edit');
        if (isHandheld) setPairLobbyMobileTab('rooms');
    };

    const openProposeLobbyChangeModal = () => {
        if (!myRoom || myRoom.ownerId === currentUserId) return;
        if (lobbyChannel !== 'strategic' && lobbyChannel !== 'playful' && lobbyChannel !== 'pair') return;
        if (
            myRoom.phase === 'matching' ||
            myRoom.phase === 'match_pending' ||
            (myRoom.phase ?? 'waiting') === 'in_game' ||
            myRoom.pairRankedPetProposal ||
            myRoom.pairDuoRankedLobbyProposal
        ) {
            window.alert('매칭·대국 중에는 변경을 제안할 수 없습니다.');
            return;
        }
        if (myRoom.pairLobbySettingChangeProposal) {
            window.alert('처리 중인 변경 제안이 있습니다.');
            return;
        }
        const until = myRoom.pairLobbySettingChangeCooldownUntil?.[currentUserId];
        if (typeof until === 'number' && until > Date.now()) {
            window.alert(`거절 후 ${Math.ceil((until - Date.now()) / 1000)}초 뒤에 다시 제안할 수 있습니다.`);
            return;
        }
        const isPartnerHere = Boolean(currentUserId && myRoom.partnerId === currentUserId);
        const extraHere = currentUserId
            ? myRoom.extraPairMembers?.find((m) => m.id === currentUserId)
            : undefined;
        const guestLobbyChangeProposeReady =
            isPartnerHere ? Boolean(myRoom.partnerReady) : Boolean(extraHere?.ready);
        if (guestLobbyChangeProposeReady) {
            window.alert('준비 완료 상태에서는 변경 제안을 할 수 없습니다.');
            return;
        }
        setCreateModalTitle(clampPairRoomTitle(myRoom.title));
        setCreateModalRoomKind(myRoom.roomKind);
        setCreateModalVisibility(myRoom.visibility);
        setCreateModalPassword('');
        setCreateModalPasswordFieldFocused(false);
        const prMode = myRoom.selectedGameMode ?? GameMode.Standard;
        const prSettings = { ...DEFAULT_GAME_SETTINGS, ...(myRoom.settings ?? {}) };
        setCreateModalDraftGame({
            mode: prMode,
            settings: prSettings,
            settingsByMode: { [prMode]: prSettings },
        });
        setPairLobbyRoomForm('propose');
        /** 변경 제안은 방 안에서 진행 — 모바일에서 방목록 탭으로 빠지지 않고 N번방 탭 유지 */
        if (isHandheld) setPairLobbyMobileTab('room');
    };


    const applyAction = async (action: any) => {
        setIsBusy(true);
        try {
            const result = await handlers.handleAction(action);
            const error = (result as any)?.error;
            if (error) return window.alert(error);
            const gameId =
                (result as any)?.gameId ||
                (result as any)?.clientResponse?.gameId ||
                (typeof (result as any)?.data?.gameId === 'string' ? (result as any).data.gameId : undefined);
            if (gameId) {
                pairShellGameNavAllowIdRef.current = gameId;
                window.location.hash = `#/game/${gameId}`;
            }
            return result;
        } finally {
            setIsBusy(false);
        }
    };

    const applyPetAction = async (action: ServerAction) => {
        setIsBusy(true);
        try {
            const result = await handlers.handleAction(action);
            const error = (result as any)?.error;
            if (error && error !== PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE) window.alert(error);
            return result;
        } finally {
            setIsBusy(false);
        }
    };

    const focusPairLobbyMyRoomTab = useCallback(() => {
        if (lobbyIntentRef.current === 'pvp') {
            setPairLobbyCenterTab('room');
        }
        if (isHandheld) {
            const room = myRoom ?? myRoomForUsersColumnChrome;
            setPairLobbyMobileTab(
                room ? handheldPairLobbyRoomFocusTab(room, lobbyIntent, lobbyChannel) : 'room',
            );
        }
    }, [isHandheld, myRoom, myRoomForUsersColumnChrome, lobbyIntent, lobbyChannel]);

    const submitPairRoomFormModal = async () => {
        if (!currentUserId) return;
        if (pairLobbyRoomForm === 'create' && myRoomAnyLobbyChannel) {
            return window.alert('이미 참여 중인 방이 있습니다.');
        }
        if (pairLobbyRoomForm === 'edit' && (!myRoom || myRoom.ownerId !== currentUserId)) return;
        if (
            pairLobbyRoomForm === 'propose' &&
            (!myRoom ||
                myRoom.ownerId === currentUserId ||
                (lobbyChannel !== 'strategic' && lobbyChannel !== 'playful' && lobbyChannel !== 'pair'))
        )
            return;
        const pwTrim = createModalPassword.trim();
        if (pairLobbyRoomForm !== 'propose' && createModalVisibility === 'private') {
            if (pairLobbyRoomForm === 'create') {
                if (pwTrim.length !== 4) {
                    window.alert('비공개방 비밀번호는 4자로 입력해 주세요.');
                    return;
                }
            } else if (myRoom?.visibility === 'public' && pwTrim.length !== 4) {
                window.alert('비공개방으로 바꿀 때는 비밀번호 4자를 입력해 주세요.');
                return;
            } else if (pwTrim.length > 0 && pwTrim.length !== 4) {
                window.alert('비공개방 비밀번호는 4자로 입력해 주세요.');
                return;
            }
        }
        setIsBusy(true);
        try {
            if (pairLobbyRoomForm === 'create') {
                const ch = lobbyChannelRef.current;
                const roomKindForCreate =
                    ch === 'strategic' || ch === 'playful'
                        ? createModalRoomKind === 'arena_ai' || createModalRoomKind === 'duo_match'
                            ? createModalRoomKind
                            : 'duo_match'
                        : createModalRoomKind === 'friendly_2p' && !hasEquippedPairPet
                          ? 'friendly_4p'
                          : createModalRoomKind;
                const result = await handlers.handleAction({
                    type: 'PAIR_CREATE_ROOM',
                    payload: {
                        roomKind: roomKindForCreate,
                        title: clampPairRoomTitle(createModalTitle) || undefined,
                        visibility: createModalVisibility,
                        password: createModalVisibility === 'private' ? createModalPassword : undefined,
                        selectedGameMode: createModalDraftGame.mode,
                        settings: createModalDraftGame.settings,
                        lobbyChannel: lobbyChannelRef.current,
                        lobbyIntent: lobbyIntentRef.current,
                    },
                });
                const error = (result as any)?.error;
                if (error) {
                    window.alert(error);
                    return;
                }
                const chCreate = lobbyChannelRef.current;
                savePairLobbyCreatePrefsDoc(
                    chCreate,
                    upsertPairLobbyCreateDraft(
                        loadPairLobbyCreatePrefsDoc(chCreate),
                        roomKindForCreate,
                        bundleToPersistedSlot(createModalDraftGame, chCreate),
                    ),
                );
                const gameId = (result as any)?.gameId || (result as any)?.clientResponse?.gameId;
                if (gameId) {
                    pairShellGameNavAllowIdRef.current = gameId;
                    window.location.hash = `#/game/${gameId}`;
                }
                setPairLobbyRoomForm('closed');
                focusPairLobbyMyRoomTab();
            } else if (pairLobbyRoomForm === 'edit') {
                const result = await handlers.handleAction({
                    type: 'PAIR_UPDATE_ROOM_LOBBY',
                    payload: {
                        title: clampPairRoomTitle(createModalTitle) || undefined,
                        visibility: createModalVisibility,
                        ...(createModalVisibility === 'private' && createModalPassword.trim().length === 4
                            ? { password: createModalPassword.trim() }
                            : {}),
                        roomKind: createModalRoomKind,
                        selectedGameMode: createModalDraftGame.mode,
                        settings: createModalDraftGame.settings,
                    },
                });
                const error = (result as any)?.error;
                if (error) {
                    window.alert(error);
                    return;
                }
                const chEdit = (myRoom?.lobbyChannel as PairWaitingLobbyChannel | undefined) ?? lobbyChannelRef.current;
                const rkEdit =
                    createModalRoomKind === 'friendly_2p' && !hasEquippedPairPet ? 'friendly_4p' : createModalRoomKind;
                savePairLobbyCreatePrefsDoc(
                    chEdit,
                    upsertPairLobbyCreateDraft(
                        loadPairLobbyCreatePrefsDoc(chEdit),
                        rkEdit,
                        bundleToPersistedSlot(createModalDraftGame, chEdit),
                    ),
                );
                setPairLobbyRoomForm('closed');
            } else if (pairLobbyRoomForm === 'propose') {
                if (!myRoom) return;
                const preDigest = stableStringify({
                    settings: myRoom.settings,
                    title: myRoom.title,
                    visibility: myRoom.visibility,
                    roomKind: myRoom.roomKind,
                    selectedGameMode: myRoom.selectedGameMode,
                });
                const result = await handlers.handleAction({
                    type: 'PAIR_PROPOSE_STRATEGIC_LOBBY_SETTING_CHANGE',
                    payload: {
                        roomId: myRoom.id,
                        roomKind: myRoom.roomKind,
                        selectedGameMode: myRoom.selectedGameMode,
                        settings: createModalDraftGame.settings,
                    },
                });
                const error = (result as any)?.error;
                if (error) {
                    window.alert(error);
                    return;
                }
                preLobbyChangeProposalDigestRef.current = preDigest;
                setPairLobbyRoomForm('closed');
                if (isHandheld) setPairLobbyMobileTab('room');
            }
        } finally {
            setIsBusy(false);
        }
    };

    const pairLobbyProposeSettingDiffRows = useMemo(() => {
        if (pairLobbyRoomForm !== 'propose' || !myRoom) return [];
        return buildPairLobbySettingChangeDiffRows(
            {
                selectedGameMode: myRoom.selectedGameMode,
                settings: myRoom.settings,
                roomKind: myRoom.roomKind,
                lobbyChannel: myRoom.lobbyChannel ?? lobbyChannel,
            },
            createModalDraftGame.settings,
            { lobbyChannelFallback: lobbyChannel },
        );
    }, [pairLobbyRoomForm, myRoom, createModalDraftGame.settings, lobbyChannel]);

    const pairLobbyProposeHasChanges = pairLobbyProposeSettingDiffRows.length > 0;

    useEffect(() => {
        if (pairLobbyRoomForm !== 'propose') setGuestLobbyChangeProposeConfirmOpen(false);
    }, [pairLobbyRoomForm]);

    const handlePairLobbyRoomFormPrimarySubmit = () => {
        if (pairLobbyRoomForm === 'propose') {
            if (!pairLobbyProposeHasChanges) return;
            setGuestLobbyChangeProposeConfirmOpen(true);
            return;
        }
        void submitPairRoomFormModal();
    };

    const attemptJoinRoom = async (opts: { roomId?: string; code?: string }) => {
        if (!currentUserId || myRoomAnyLobbyChannel) return;
        const codeUpper = opts.code ? normalizeRoomNumberInput(opts.code) : undefined;
        const target = opts.roomId
            ? rooms.find((r) => r.id === opts.roomId)
            : codeUpper
              ? rooms.find((r) => r.code === codeUpper)
              : undefined;

        if (target && (target.phase ?? 'waiting') === 'in_game') {
            window.alert('경기 진행 중인 방에는 입장할 수 없습니다.');
            return;
        }
        if (target && (target.phase === 'matching' || target.phase === 'match_pending')) {
            window.alert('매칭 중인 방에는 입장할 수 없습니다.');
            return;
        }

        if (target?.visibility === 'private') {
            setJoinPasswordModal({
                roomId: target.id,
                code: target.code,
                roomTitle: target.title,
            });
            setJoinPasswordDraft('');
            return;
        }

        setIsBusy(true);
        try {
            const payload = opts.roomId ? { roomId: opts.roomId } : { code: codeUpper! };
            const result = await handlers.handleAction({ type: 'PAIR_JOIN_ROOM', payload });
            const error = (result as any)?.error;
            if (error === PAIR_JOIN_PASSWORD_ERROR) {
                setJoinPasswordModal({
                    roomId: opts.roomId,
                    code: codeUpper || target?.code,
                    roomTitle: target?.title || '비공개 방',
                });
                setJoinPasswordDraft('');
                return;
            }
            if (error) {
                window.alert(error);
                return;
            }
            const gameId = (result as any)?.gameId || (result as any)?.clientResponse?.gameId;
            if (gameId) {
                pairShellGameNavAllowIdRef.current = gameId;
                window.location.hash = `#/game/${gameId}`;
            }
        } finally {
            setIsBusy(false);
        }
    };

    const quickJoin = (roomId: string) => {
        void attemptJoinRoom({ roomId });
    };

    const joinByRoomNumber = () => {
        if (myRoomAnyLobbyChannel) return window.alert('이미 참여 중인 방이 있습니다.');
        const normalized = normalizeRoomNumberInput(joinRoomNumber);
        if (!normalized) return window.alert('방 번호를 입력하세요.');
        void attemptJoinRoom({ code: normalized });
    };

    const submitJoinPasswordModal = async () => {
        if (!joinPasswordModal || !currentUserId || myRoomAnyLobbyChannel) return;
        const pw = joinPasswordDraft.trim();
        if (!pw) return window.alert('비밀번호를 입력하세요.');
        setIsBusy(true);
        try {
            const payload: { roomId?: string; code?: string; password: string } = { password: pw };
            if (joinPasswordModal.roomId) payload.roomId = joinPasswordModal.roomId;
            else if (joinPasswordModal.code) payload.code = normalizeRoomNumberInput(joinPasswordModal.code);
            else return;
            const result = await handlers.handleAction({ type: 'PAIR_JOIN_ROOM', payload });
            const error = (result as any)?.error;
            if (error) {
                window.alert(error);
                return;
            }
            const gameId = (result as any)?.gameId || (result as any)?.clientResponse?.gameId;
            if (gameId) {
                pairShellGameNavAllowIdRef.current = gameId;
                window.location.hash = `#/game/${gameId}`;
            }
            setJoinPasswordModal(null);
            setJoinPasswordDraft('');
        } finally {
            setIsBusy(false);
        }
    };

    const leaveRoom = async () => {
        const result = await applyAction({ type: 'PAIR_LEAVE_ROOM' });
        if (result && (result as { error?: string }).error) return;
        setPairLobbyRoomForm('closed');
        await handlers.handleAction({ type: 'PAIR_SYNC' } as ServerAction).catch(() => undefined);
    };
    const cancelPairPetMatching = async () => applyAction({ type: 'PAIR_CANCEL_PAIR_PET_MATCHING' } as ServerAction);
    const respondPairPetRankedMatch = async (accept: boolean) => {
        const p = myRoom?.pairRankedPetProposal;
        if (!p) return;
        await applyAction({
            type: 'PAIR_RESPOND_PAIR_PET_RANKED_MATCH',
            payload: { proposalId: p.proposalId, accept },
        } as ServerAction);
    };

    const confirmLeaveNav = async () => {
        const dest = pairLeaveNavTargetHash;
        const arenaPending = pendingArenaNavTarget;
        const intentPending = pendingIntentNavTarget;
        setPairLeaveNavTargetHash(null);
        setPendingArenaNavTarget(null);
        setPendingIntentNavTarget(null);
        if (!dest && arenaPending == null && intentPending == null) return;
        setIsBusy(true);
        try {
            const result = await handlers.handleAction({ type: 'PAIR_LEAVE_ROOM' });
            const error = (result as { error?: string } | undefined)?.error;
            if (error) {
                window.alert(error);
                return;
            }
            setPairLobbyRoomForm('closed');
            await handlers.handleAction({ type: 'PAIR_SYNC' } as ServerAction).catch(() => undefined);
            if (arenaPending != null || intentPending != null) {
                if (lobbyChannel === 'strategic' || lobbyChannel === 'playful') {
                    await handlers.handleAction({ type: 'LEAVE_WAITING_ROOM' }).catch(() => undefined);
                }
                const nextIntent = intentPending ?? lobbyIntent;
                const nextChannel = arenaPending ?? lobbyChannel;
                replaceAppHash(arenaLobbyHash({ intent: nextIntent, channel: nextChannel }));
            } else if (dest) {
                window.location.hash = dest.startsWith('#') ? dest : `#${dest}`;
            }
        } finally {
            setIsBusy(false);
        }
    };

    const cancelLeaveNav = () => {
        setPairLeaveNavTargetHash(null);
        setPendingArenaNavTarget(null);
        setPendingIntentNavTarget(null);
    };
    const setReady = async (ready: boolean) => applyAction({ type: 'PAIR_SET_READY', payload: { ready } });
    const proposeDuoRankedMatchWithMode = async (mode: GameMode) => {
        setIsBusy(true);
        try {
            const result = await handlers.handleAction({ type: 'PAIR_PROPOSE_DUO_RANKED_MATCH', payload: { mode } } as ServerAction);
            const error = (result as { error?: string } | undefined)?.error;
            if (error) {
                window.alert(error);
                return;
            }
            setDuoRankedMatchModalOpen(false);
        } finally {
            setIsBusy(false);
        }
    };
    const ackDuoRankedMatch = async (accept: boolean) => {
        setIsBusy(true);
        try {
            const result = await handlers.handleAction({ type: 'PAIR_ACK_DUO_RANKED_MATCH', payload: { accept } } as ServerAction);
            const error = (result as { error?: string } | undefined)?.error;
            if (error) {
                window.alert(error);
                return;
            }
        } finally {
            setIsBusy(false);
        }
    };
    const cancelDuoRankedLobbyProposal = async () => {
        setIsBusy(true);
        try {
            const result = await handlers.handleAction({ type: 'PAIR_CANCEL_DUO_RANKED_LOBBY_PROPOSAL' } as ServerAction);
            const error = (result as { error?: string } | undefined)?.error;
            if (error) window.alert(error);
        } finally {
            setIsBusy(false);
        }
    };
    const queuePairPetRankedWithMode = async (mode: GameMode) => {
        setIsBusy(true);
        try {
            if (lobbyChannel === 'pair') {
                if (myRoom && (myRoom.roomKind !== 'ai_duel' || !myRoom.pairPetRankedQueueShell)) {
                    window.alert('페어 랭킹전을 시작하려면 다른 페어 방에서 나와 주세요.');
                    return;
                }
                if (myRoom && myRoom.ownerId !== currentUserId) {
                    window.alert('방장만 랭킹전 매칭을 시작할 수 있습니다.');
                    return;
                }
                const result = await handlers.handleAction({ type: 'PAIR_QUEUE_PET_RANKED', payload: { mode } } as ServerAction);
                const error = (result as { error?: string } | undefined)?.error;
                if (error) {
                    window.alert(error);
                    return;
                }
                const gameId =
                    (result as { gameId?: string; clientResponse?: { gameId?: string } } | undefined)?.gameId ||
                    (result as { clientResponse?: { gameId?: string } } | undefined)?.clientResponse?.gameId;
                if (gameId) {
                    pairShellGameNavAllowIdRef.current = gameId;
                    window.location.hash = `#/game/${gameId}`;
                }
                setPairRankedMatchModalOpen(false);
                setPairLobbyPetRankedModalOpen(false);
                return;
            }
            const result = await handlers.handleAction({ type: 'PAIR_START_MATCH', payload: { mode } } as ServerAction);
            const error = (result as { error?: string } | undefined)?.error;
            if (error) {
                window.alert(error);
                return;
            }
            const gameId = (result as { gameId?: string; clientResponse?: { gameId?: string } } | undefined)?.gameId ||
                (result as { clientResponse?: { gameId?: string } } | undefined)?.clientResponse?.gameId;
            if (gameId) {
                pairShellGameNavAllowIdRef.current = gameId;
                window.location.hash = `#/game/${gameId}`;
            }
            setPairRankedMatchModalOpen(false);
            setPairLobbyPetRankedModalOpen(false);
        } finally {
            setIsBusy(false);
        }
    };
    const queueStrategicRankedWithMode = async (mode: GameMode) => {
        setIsBusy(true);
        try {
            const result = await handlers.handleAction({
                type: 'START_RANKED_MATCHING',
                payload: { lobbyType: 'strategic' as const, selectedModes: [mode] },
            } as ServerAction);
            const error = (result as { error?: string } | undefined)?.error;
            if (error) {
                window.alert(error);
                return;
            }
            setStrategicArenaRankedModalOpen(false);
        } finally {
            setIsBusy(false);
        }
    };
    const cancelStrategicRankedMatching = async () => {
        setIsBusy(true);
        try {
            const result = await handlers.handleAction({ type: 'CANCEL_RANKED_MATCHING' } as ServerAction);
            const error = (result as { error?: string } | undefined)?.error;
            if (error) window.alert(error);
        } finally {
            setIsBusy(false);
        }
    };

    const handlePairLobbyAiChallengeAction = async (action: ServerAction) => {
        if (action.type !== 'PAIR_START_AI_MATCH') {
            return handlers.handleAction(action);
        }
        setIsBusy(true);
        try {
            const payload = (action as { payload?: { mode?: GameMode; settings?: GameSettings } }).payload ?? {};
            const mode = payload.mode ?? GameMode.Standard;
            const settings = payload.settings;
            if (myRoom && myRoom.roomKind !== 'ai_duel' && myRoom.roomKind !== 'duo_match' && myRoom.roomKind !== 'arena_ai') {
                window.alert(
                    'AI 대전은 펫 페어(기존 방)·전략·놀이 친선(듀오)·경기장 AI 방에서만 시작할 수 있습니다. 펫 페어 새 방은 유저 목록 상단 「페어 AI 대전」에서 만드세요.',
                );
                return;
            }
            if (myRoom && myRoom.ownerId !== currentUserId) {
                window.alert('방장만 AI 대전을 시작할 수 있습니다.');
                return;
            }
            const startPayload =
                settings !== undefined && typeof settings === 'object'
                    ? { mode, settings, ...(myRoom?.id ? { roomId: myRoom.id } : {}) }
                    : { mode, ...(myRoom?.id ? { roomId: myRoom.id } : {}) };
            const result = await handlers.handleAction({
                type: 'PAIR_START_AI_MATCH',
                payload: startPayload,
            } as ServerAction);
            const error = (result as { error?: string } | undefined)?.error;
            if (error) {
                window.alert(error);
                return;
            }
            const gameId = (result as { gameId?: string; clientResponse?: { gameId?: string } } | undefined)?.gameId ||
                (result as { clientResponse?: { gameId?: string } } | undefined)?.clientResponse?.gameId;
            if (gameId) {
                pairShellGameNavAllowIdRef.current = gameId;
                window.location.hash = `#/game/${gameId}`;
            }
        } finally {
            setIsBusy(false);
        }
    };

    const pairGameSeed = useMemo(
        () => ({
            mode: myRoom?.selectedGameMode ?? GameMode.Standard,
            settings: myRoom?.settings ?? {
                boardSize: 19,
                komi: 6.5,
                timeLimit: 0,
                byoyomiTime: 0,
                byoyomiCount: 0,
            } as GameSettings,
        }),
        [myRoom?.selectedGameMode, myRoom?.settings],
    );

    const transformPairAiSettings = useCallback(
        (
            _mode: GameMode,
            raw: GameSettings,
            opts?: { forceFixedTurns?: boolean; stripMainClock?: boolean },
        ): GameSettings => {
            const includesCaptureRule =
                _mode === GameMode.Capture ||
                (_mode === GameMode.Mix && Boolean(raw.mixedModes?.includes(GameMode.Capture)));
            const playfulArena = myRoom?.lobbyChannel === 'playful';
            const aiShellRoom = myRoom?.roomKind === 'ai_duel' || myRoom?.roomKind === 'arena_ai';
            /** 인간 친선·듀오 친선은 방에 저장된 제한시간·초읽기(또는 피셔)를 그대로 인게임에 넘긴다. AI 전용 방만 메인 시계를 끈다. */
            const stripMainClock =
                typeof opts?.stripMainClock === 'boolean' ? opts.stripMainClock : aiShellRoom;
            const shouldZeroMainClock = stripMainClock && !playfulArena;
            const shouldUseFixedTurns =
                playfulArena
                    ? false
                    : opts?.forceFixedTurns !== undefined
                      ? opts.forceFixedTurns
                      : aiShellRoom;
            const next: GameSettings = {
                ...raw,
                ...(shouldZeroMainClock
                    ? {
                          timeLimit: 0,
                          byoyomiTime: 0,
                          byoyomiCount: 0,
                          timeIncrement: 0,
                      }
                    : {}),
                scoringTurnLimit: playfulArena
                    ? 0
                    : includesCaptureRule
                      ? 0
                      : shouldUseFixedTurns
                        ? getAiScoringTurnLimitByBoardSize(raw.boardSize || 19)
                        : 0,
            };
            if (includesCaptureRule || !shouldUseFixedTurns || playfulArena) delete (next as any).autoScoringTurns;
            return next;
        },
        [myRoom?.roomKind, myRoom?.lobbyChannel],
    );

    /** 인간 친선류: 방 설정이 이미 있으면 모달 없이 `PAIR_START_MATCH` → `applyAction`이 gameId로 인게임 이동 */
    const startMatch = () => {
        if (myRoom?.roomKind === 'ai_duel' && lobbyChannel === 'pair') {
            setPairRankedMatchModalOpen(true);
            return;
        }
        if (isDuoArenaRanked) {
            setDuoRankedMatchModalOpen(true);
            return;
        }
        const arenaFriendlyDuoInline = Boolean(
            (lobbyChannel === 'playful' || lobbyChannel === 'strategic') && myRoom?.roomKind === 'duo_match',
        );
        if (
            myRoom &&
            myRoom.roomKind !== 'arena_ai' &&
            myRoom.roomKind !== 'ai_duel' &&
            (myRoom.roomKind === 'friendly_4p' || myRoom.roomKind === 'friendly_2p' || arenaFriendlyDuoInline)
        ) {
            const mode = myRoom.selectedGameMode ?? GameMode.Standard;
            const raw = { ...DEFAULT_GAME_SETTINGS, ...(myRoom.settings ?? {}) };
            const settings = transformPairAiSettings(mode, raw);
            void applyAction({ type: 'PAIR_START_MATCH', payload: { mode, settings } } as ServerAction);
            return;
        }
        setPairMatchSettingsModalOpen(true);
    };

    const startPairAiFromRoomSettings = async () => {
        if (!myRoom) return;
            const mode = myRoom.selectedGameMode ?? GameMode.Standard;
            const raw = { ...DEFAULT_GAME_SETTINGS, ...(myRoom.settings ?? {}) };
            const settings = transformPairAiSettings(mode, raw);
            await applyAction({
                type: 'PAIR_START_AI_MATCH',
                payload: { mode, settings, ...(myRoom.id ? { roomId: myRoom.id } : {}) },
            } as ServerAction);
    };

    const transformPairDraftLobbySettings = useCallback((_mode: GameMode, raw: GameSettings): GameSettings => {
        const includesCaptureRule =
            _mode === GameMode.Capture ||
            (_mode === GameMode.Mix && Boolean(raw.mixedModes?.includes(GameMode.Capture)));
        const shouldUseFixedTurns =
            createModalRoomKind === 'ai_duel' ||
            createModalRoomKind === 'arena_ai' ||
            (lobbyChannel === 'pair' && createModalRoomKind === 'duo_match');
        const playfulLobby = lobbyChannel === 'playful';
        const next: GameSettings = {
            ...raw,
            ...(shouldUseFixedTurns && !playfulLobby
                ? {
                      timeLimit: 0,
                      byoyomiTime: 0,
                      byoyomiCount: 0,
                      timeIncrement: 0,
                  }
                : {}),
            scoringTurnLimit: playfulLobby
                ? 0
                : includesCaptureRule
                  ? 0
                  : shouldUseFixedTurns
                    ? getAiScoringTurnLimitByBoardSize(raw.boardSize || 19)
                    : 0,
        };
        if (includesCaptureRule || !shouldUseFixedTurns || playfulLobby) delete (next as any).autoScoringTurns;
        if (lobbyChannel === 'playful' && createModalRoomKind === 'duo_match') {
            delete (next as any).player1Color;
        }
        return next;
    }, [createModalRoomKind, lobbyChannel]);

    /** 경기 종료 후 집계·페어 경기장으로 돌아올 때, 이전에 머물던 페어 방으로 포커스(모바일 N번방 탭·필요 시 재입장) */
    useEffect(() => {
        if (postGamePairRoomRestoreDoneRef.current) return;
        if (lobbyChannel !== 'pair' && !aggregateLobbyMode) return;
        let storedId: string | null = null;
        try {
            storedId = sessionStorage.getItem(POST_GAME_PAIR_ROOM_RESTORE_SESSION_KEY);
        } catch {
            /* ignore */
        }
        if (!storedId) return;
        const room = rooms.find((r) => r.id === storedId);
        if (!room) return;

        postGamePairRoomRestoreDoneRef.current = true;
        try {
            sessionStorage.removeItem(POST_GAME_PAIR_ROOM_RESTORE_SESSION_KEY);
        } catch {
            /* ignore */
        }

        if (myRoom?.id === storedId || myRoomAnyLobbyChannel?.id === storedId) {
            if (isHandheld) {
                try {
                    sessionStorage.setItem(PAIR_LOBBY_FOCUS_ROOM_TAB_SESSION_KEY, '1');
                } catch {
                    /* ignore */
                }
                setPairLobbyMobileTab(handheldPairLobbyRoomFocusTab(room, lobbyIntent, lobbyChannel));
            }
            return;
        }
        if (!myRoomAnyLobbyChannel) {
            void attemptJoinRoom({ roomId: storedId });
        }
    }, [
        aggregateLobbyMode,
        lobbyChannel,
        rooms,
        myRoom?.id,
        myRoomAnyLobbyChannel?.id,
        isHandheld,
        attemptJoinRoom,
    ]);

    useEffect(() => {
        if (pairLobbyRoomForm === 'closed') {
            prevCreateModalRoomKindForClockRef.current = null;
            return;
        }
        const prevKind = prevCreateModalRoomKindForClockRef.current;
        if (prevKind === null) {
            prevCreateModalRoomKindForClockRef.current = createModalRoomKind;
            return;
        }
        if (prevKind === createModalRoomKind) return;

        prevCreateModalRoomKindForClockRef.current = createModalRoomKind;

        setCreateModalDraftGame((d) => {
            const doc = loadPairLobbyCreatePrefsDoc(lobbyChannel);
            const savedRaw = doc?.draftsByRoomKind[createModalRoomKind];
            const normSaved = normalizeRoomKindDraftSlot(savedRaw, lobbyChannel);
            if (normSaved) {
                const built = buildDraftBundleFromNormalizedSlot(normSaved, lobbyChannel, createModalRoomKind);
                return applyDraftBundleTransforms(built, transformPairDraftLobbySettings, lobbyChannel);
            }

            const mode = d.mode;
            const ranked = getRankedGameSettings(mode);

            const aiShell = (rk: RoomKind) => rk === 'ai_duel' || rk === 'arena_ai';
            const humanFriendlyFamily = (rk: RoomKind) =>
                rk === 'friendly_4p' ||
                rk === 'friendly_2p' ||
                ((lobbyChannel === 'strategic' || lobbyChannel === 'playful') && rk === 'duo_match');

            let patch: GameSettings | null = null;

            if (aiShell(prevKind) && humanFriendlyFamily(createModalRoomKind)) {
                patch = {
                    ...d.settings,
                    boardSize: ranked.boardSize ?? d.settings.boardSize,
                    timeLimit: ranked.timeLimit ?? d.settings.timeLimit,
                    byoyomiTime: ranked.byoyomiTime ?? d.settings.byoyomiTime,
                    byoyomiCount: ranked.byoyomiCount ?? d.settings.byoyomiCount,
                    timeIncrement: ranked.timeIncrement ?? d.settings.timeIncrement,
                    ...(mode === GameMode.Base ? {} : { komi: ranked.komi ?? d.settings.komi }),
                };
            } else if (humanFriendlyFamily(prevKind) && aiShell(createModalRoomKind)) {
                patch = {
                    ...d.settings,
                    timeLimit: 0,
                    byoyomiTime: 0,
                    byoyomiCount: 0,
                    timeIncrement: 0,
                };
            }

            if (!patch) return d;
            const settings = transformPairDraftLobbySettings(mode, patch);
            return { mode, settings, settingsByMode: { ...d.settingsByMode, [mode]: settings } };
        });
    }, [pairLobbyRoomForm, createModalRoomKind, lobbyChannel, transformPairDraftLobbySettings]);

    useEffect(() => {
        if (pairLobbyRoomForm !== 'closed') return;
        const rk = resolveCreateModalRoomKind(lobbyChannel, lobbyIntent, hasEquippedPairPet);
        setCreateModalRoomKind(rk);
        setCreateModalDraftGame(
            applyDraftBundleTransforms(
                loadCreateModalDraftBundleForRoomKind(lobbyChannel, rk),
                transformPairDraftLobbySettings,
                lobbyChannel,
            ),
        );
    }, [lobbyChannel, lobbyIntent, pairLobbyRoomForm, hasEquippedPairPet, transformPairDraftLobbySettings]);

    const pairDraftSettingsFingerprint = stableStringify(createModalDraftGame.settings);
    const pairDraftSettingsByModeFingerprint = stableStringify(createModalDraftGame.settingsByMode);
    const pairDraftGameSeed = useMemo(
        () => ({
            mode: createModalDraftGame.mode,
            settings: createModalDraftGame.settings,
            settingsByMode: createModalDraftGame.settingsByMode,
        }),
        [createModalDraftGame.mode, pairDraftSettingsFingerprint, pairDraftSettingsByModeFingerprint],
    );

    const handlePairDraftConfigureApply = useCallback(
        (mode: GameMode, settings: GameSettings) => {
            setCreateModalDraftGame((prev) => {
                const lockedMode =
                    pairLobbyRoomForm === 'propose' && myRoom?.selectedGameMode != null ? myRoom.selectedGameMode : mode;
                if (prev.mode === lockedMode && stableStringify(prev.settings) === stableStringify(settings)) return prev;
                /** 자식 `buildFinalSettingsForApply` 결과를 그대로 저장 — sanitize 재적용 시 resolveEmbedded와 왕복 루프 */
                const settingsByMode = filterSettingsByModeForLobbyChannel(
                    { ...prev.settingsByMode, [prev.mode]: prev.settings },
                    lobbyChannel,
                );
                settingsByMode[lockedMode] = settings;
                return {
                    mode: lockedMode,
                    settings,
                    settingsByMode: filterSettingsByModeForLobbyChannel(settingsByMode, lobbyChannel),
                };
            });
        },
        [pairLobbyRoomForm, myRoom?.selectedGameMode, lobbyChannel],
    );

    const sendPairRoomChat = async (payload: { text: string; scope: PairRoomChatScope }) => {
        if (pairRoomChatSendCooldownRef.current || pairRoomChatSendInFlightRef.current) return;
        const room = myRoom;
        if (!room || !currentUserId) return;
        pairRoomChatSendInFlightRef.current = true;
        try {
            const result = await handlers.handleAction({
                type: 'PAIR_SEND_ROOM_CHAT',
                payload: { roomId: room.id, text: payload.text, scope: payload.scope },
            });
            const error = (result as { error?: string } | undefined)?.error;
            if (error) return;
            if (pairRoomChatCooldownTimerRef.current != null) {
                window.clearTimeout(pairRoomChatCooldownTimerRef.current);
            }
            pairRoomChatSendCooldownRef.current = true;
            setPairRoomChatSendCooldownUi(true);
            pairRoomChatCooldownTimerRef.current = window.setTimeout(() => {
                pairRoomChatCooldownTimerRef.current = null;
                pairRoomChatSendCooldownRef.current = false;
                setPairRoomChatSendCooldownUi(false);
            }, PAIR_ROOM_INTERIOR_CHAT_SEND_COOLDOWN_MS);
        } finally {
            pairRoomChatSendInFlightRef.current = false;
        }
    };

    const viewerEquippedPairPetPortraitSrc = useMemo(() => {
        const u = currentUserWithStatus;
        if (!u?.equippedPairPetTemplateId) return null;
        const row = getEquippedPairPetInventoryRow(u);
        if (row?.image) return row.image;
        return getPairPetDefinition(u.equippedPairPetTemplateId)?.image ?? null;
    }, [currentUserWithStatus]);

    const viewerEquippedPairPetInfo = useMemo(() => {
        const u = currentUserWithStatus;
        if (!u?.equippedPairPetTemplateId) return { name: null as string | null, level: null as number | null, displayName: null as string | null };
        const row = getEquippedPairPetInventoryRow(u);
        if (!row) {
            const name = getPairPetDefinition(u.equippedPairPetTemplateId)?.displayName ?? '내 펫';
            return {
                name,
                level: null,
                displayName: name,
            };
        }
        const meta = resolvePairPetMetaFromInventoryRow(row);
        const level = Math.max(1, Math.floor(meta.level) || 1);
        const name = getPairPetDisplayName(row);
        return {
            name,
            level,
            displayName: `Lv.${level} ${name}`,
        };
    }, [currentUserWithStatus]);

    const pairLobbyRankedStrip = useMemo(() => {
        const tierInfo = resolveMyPairRankedTierForPairArena(currentUserWithStatus ?? null);
        const blk =
            currentUserWithStatus != null
                ? readPairRankedBlock(currentUserWithStatus.stats as User['stats'])
                : { wins: 0, losses: 0 };
        return { ...tierInfo, wins: blk.wins, losses: blk.losses };
    }, [currentUserWithStatus]);

    const pairLobbyPairRankedCurrentSeasonName = getCurrentSeason().name;
    const pairLobbyPairRankedAllTimeBest = useMemo(() => {
        if (!currentUserWithStatus) return null;
        const fromHistory = computePairArenaAllTimeBestSeasonRecord(currentUserWithStatus.seasonHistory);
        if (fromHistory) return fromHistory;
        const pt = currentUserWithStatus.previousSeasonTier;
        if (pt && RANKING_TIERS.some((t) => t.name === pt)) {
            return { tierName: pt, seasonName: getPreviousSeason().name };
        }
        return null;
    }, [currentUserWithStatus]);

    const pairLobbyPairRankedIsFirstSeason = useMemo(() => {
        if (!currentUserWithStatus) return true;
        const prevSeason = getPreviousSeason();
        const history = currentUserWithStatus.seasonHistory?.[prevSeason.name];
        const hasPrevData = history && typeof history === 'object' && Object.keys(history).length > 0;
        return !hasPrevData && !currentUserWithStatus.previousSeasonTier;
    }, [currentUserWithStatus]);

    const pairLobbyPairRankedBestSeasonSameAsCurrent = useMemo(() => {
        if (pairLobbyPairRankedIsFirstSeason) return true;
        if (!pairLobbyPairRankedAllTimeBest) return true;
        if (pairLobbyPairRankedAllTimeBest.seasonName === pairLobbyPairRankedCurrentSeasonName) return true;
        return false;
    }, [pairLobbyPairRankedIsFirstSeason, pairLobbyPairRankedAllTimeBest, pairLobbyPairRankedCurrentSeasonName]);

    if (!currentUserWithStatus) return <div className="flex h-full items-center justify-center">로딩 중...</div>;

    const showPairLobbyPetRankedPanelMatching = Boolean(
        lobbyChannel === 'pair' &&
            myRoom?.roomKind === 'ai_duel' &&
            myRoom.phase === 'matching' &&
            !myRoom.pairRankedPetProposal,
    );
    const pairRankedPanelFormatWait = (totalSec: number) => {
        const s = Math.max(0, Math.floor(totalSec));
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const inStrategicRankedQueue = Boolean(
        currentUserWithStatus.id &&
            rankedMatchingQueue &&
            typeof rankedMatchingQueue === 'object' &&
            (rankedMatchingQueue as { strategic?: Record<string, unknown> }).strategic?.[currentUserWithStatus.id],
    );
    /** 페어 랭킹전 큐·경기장 단독 랭킹 큐 대기 중에는 준비 해제 불가(서버와 동일 조건) */
    const rankedMatchingBlocksPartnerUnready = isPairRoomMatching || inStrategicRankedQueue;

    const getPairLobbyJoinableFromListRoom = (room: PairRoom) => {
        const listRoomKind = pairLobbyListDisplayRoomKind(room, lobbyChannel);
        const roomInMatch = (room.phase ?? 'waiting') === 'in_game' || room.phase === 'match_pending';
        if (pairRoomListIsAtHumanCapacity(room, listRoomKind)) return false;
        const friendlyTwoPetJoinable =
            listRoomKind === 'friendly_2p' &&
            room.ownerId !== currentUserId &&
            !userParticipatingInAnyPairRoom &&
            !roomInMatch &&
            hasUsablePairPetForJoin &&
            countHumanUsersInPairRoom(room) < 2;
        return (
            friendlyTwoPetJoinable ||
            (!room.partnerId &&
                room.ownerId !== currentUserId &&
                !userParticipatingInAnyPairRoom &&
                listRoomKind !== 'ai_duel' &&
                listRoomKind !== 'friendly_2p' &&
                listRoomKind !== 'arena_ai' &&
                !roomInMatch)
        );
    };

    const isOwner = myRoom?.ownerId === currentUserId;

    const [pairOwnerStartDeadlineTick, setPairOwnerStartDeadlineTick] = useState(0);
    useEffect(() => {
        if (!myRoom?.pairOwnerStartDeadlineAt) return;
        const id = window.setInterval(() => setPairOwnerStartDeadlineTick((t) => t + 1), 1000);
        return () => window.clearInterval(id);
    }, [myRoom?.pairOwnerStartDeadlineAt]);
    const pairOwnerStartDeadlineRemainingSec = useMemo(() => {
        if (!myRoom?.pairOwnerStartDeadlineAt) return null;
        return Math.max(0, Math.ceil((myRoom.pairOwnerStartDeadlineAt - Date.now()) / 1000));
    }, [myRoom?.pairOwnerStartDeadlineAt, pairOwnerStartDeadlineTick]);

    useEffect(() => {
        if (!isOwner || !myRoom?.pairLobbySettingChangeProposal) {
            ownerLobbyProposalNoticeIdRef.current = null;
            setOwnerLobbySettingProposalStep('none');
            return;
        }
        const id = myRoom.pairLobbySettingChangeProposal.proposalId;
        if (ownerLobbyProposalNoticeIdRef.current !== id) {
            ownerLobbyProposalNoticeIdRef.current = id;
            setOwnerLobbySettingProposalStep('notice');
        }
    }, [isOwner, myRoom?.pairLobbySettingChangeProposal]);

    useEffect(() => {
        const prev = prevPairLobbySettingProposalRef.current;
        const cur = myRoom?.pairLobbySettingChangeProposal;
        if (currentUserId && prev?.fromUserId === currentUserId && !cur && myRoom) {
            if (guestLobbyProposalOutcomeShownIdRef.current !== prev.proposalId) {
                const postDigest = stableStringify({
                    settings: myRoom.settings,
                    title: myRoom.title,
                    visibility: myRoom.visibility,
                    roomKind: myRoom.roomKind,
                    selectedGameMode: myRoom.selectedGameMode,
                });
                const preDigest = preLobbyChangeProposalDigestRef.current;
                const proposedPayload = prev.payload as { settings?: GameSettings } | undefined;
                const diffVsProposed = buildPairLobbySettingChangeDiffRows(
                    {
                        selectedGameMode: myRoom.selectedGameMode,
                        settings: myRoom.settings,
                        roomKind: myRoom.roomKind,
                        lobbyChannel: myRoom.lobbyChannel ?? lobbyChannel,
                    },
                    proposedPayload?.settings,
                    { lobbyChannelFallback: lobbyChannel },
                );
                const outcome: 'accepted' | 'rejected' =
                    preDigest != null
                        ? postDigest === preDigest
                            ? 'rejected'
                            : 'accepted'
                        : diffVsProposed.length === 0
                          ? 'accepted'
                          : 'rejected';
                guestLobbyProposalOutcomeShownIdRef.current = prev.proposalId;
                setGuestLobbyChangeProposalOutcome(outcome);
            }
            preLobbyChangeProposalDigestRef.current = null;
        }
        prevPairLobbySettingProposalRef.current = cur ?? undefined;
    }, [myRoom, currentUserId, lobbyChannel]);

    const isPartner = myRoom?.partnerId === currentUserId;
    const extraMemberForMe = myRoom?.extraPairMembers?.find((m) => m.id === currentUserId);
    const isExtraPairMember = Boolean(extraMemberForMe);
    const currentUserPairReady = isPartner ? Boolean(myRoom?.partnerReady) : Boolean(extraMemberForMe?.ready);
    const isArenaStrategicAiRoom = myRoom?.roomKind === 'arena_ai';
    const isDuoPairRoom = myRoom?.roomKind === 'duo_match';
    const isPairChannelDuoAiRoom = Boolean(lobbyChannel === 'pair' && isDuoPairRoom);
    const isArenaFriendlyDuoRoom = Boolean(
        (lobbyChannel === 'playful' || lobbyChannel === 'strategic') && myRoom?.roomKind === 'duo_match',
    );
    const petPairOpponent = isPairPetRoom || isFriendlyTwoPetRoom ? myRoom?.extraPairMembers?.[0] : undefined;
    const duoPairAiPartnerReady = Boolean(
        isDuoPairRoom &&
            ((myRoom?.partnerId && !String(myRoom.partnerId).startsWith('pet-ai-') && myRoom.partnerReady) ||
                (myRoom?.extraPairMembers ?? []).some((m) => m.ready)),
    );
    /** 방장 제외 인간 전원 준비 — 팀 스냅샷·슬롯 필드 불일치 시에도 좌석 UI와 동일하게 판정 */
    const pairLobbyHumanGuestsReadyForOwnerActions = (() => {
        const room = myRoom;
        if (!room) return true;
        return pairLobbyAllNonOwnerHumansReady(room);
    })();
    const pairOwnerStartCountdownOnStartButton = Boolean(
        isOwner &&
            pairOwnerStartDeadlineRemainingSec != null &&
            pairOwnerStartDeadlineRemainingSec > 0 &&
            pairLobbyHumanGuestsReadyForOwnerActions &&
            pairLobbyHasAnyNonOwnerHuman(myRoom),
    );
    /** 2인 친선: 상대 입장·준비(팀/슬롯 통합) — 대표 펫은 서버에서 검증 */
    const friendlyTwoPetStartRequirementsMet = Boolean(
        myRoom && petPairOpponent && pairLobbyAllNonOwnerHumansReady(myRoom),
    );
    const canStart = Boolean(
        myRoom &&
            isOwner &&
            !isPairRoomMatching &&
            !isPairRoomMatchPending &&
            myRoom.roomKind !== 'arena_ai' &&
            !isDuoArenaRanked &&
            (isPairPetRoom || isFriendlyTwoPetRoom
                ? isFriendlyTwoPetRoom
                    ? friendlyTwoPetStartRequirementsMet
                    : (!petPairOpponent || pairLobbyEffectiveHumanReady(myRoom, petPairOpponent.id)) &&
                          pairLobbyHumanGuestsReadyForOwnerActions
                : isArenaFriendlyDuoRoom
                  ? pairLobbyArenaFriendlyDuoCapacityOk(myRoom) && pairLobbyHumanGuestsReadyForOwnerActions
                  : myRoom.roomKind === 'friendly_4p'
                    ? Boolean(
                          countHumanUsersInPairRoom(myRoom) >= 4 && pairLobbyHumanGuestsReadyForOwnerActions,
                      )
                    : pairLobbyHasAnyNonOwnerHuman(myRoom) && pairLobbyHumanGuestsReadyForOwnerActions),
    );
    const canOpenDuoRankedModal = Boolean(
        isOwner &&
            isDuoArenaRanked &&
            myRoom &&
            myRoom.partnerId &&
            !String(myRoom.partnerId).startsWith('pet-ai-') &&
            !isPairRoomMatching &&
            !isPairRoomMatchPending &&
            !myRoom.pairDuoRankedLobbyProposal &&
            (myRoom.phase ?? 'waiting') === 'waiting' &&
            pairLobbyHumanGuestsReadyForOwnerActions,
    );
    const canStartAiMatch = Boolean(
        myRoom &&
            isOwner &&
            !((lobbyChannel === 'playful' || lobbyChannel === 'strategic') && myRoom.roomKind === 'duo_match') &&
            pairLobbyHumanGuestsReadyForOwnerActions &&
            (isArenaStrategicAiRoom || (isPairPetRoom && !petPairOpponent) || duoPairAiPartnerReady) &&
            !isPairRoomMatching &&
            !isPairRoomMatchPending,
    );
    const pairAiDuoStartBlockReason = useMemo(() => {
        if (!myRoom || myRoom.roomKind !== 'duo_match') {
            return isBusy ? '2인 AI 방을 준비하는 중입니다.' : '2인 AI 방을 여는 중입니다.';
        }
        if (!isOwner) return '방장만 AI 대전을 시작할 수 있습니다.';
        const hasPartner = Boolean(myRoom.partnerId && !String(myRoom.partnerId).startsWith('pet-ai-'));
        if (!hasPartner) return '좌측 패널에서 파트너를 초대해 주세요.';
        if (!duoPairAiPartnerReady) return '파트너 준비완료를 기다려 주세요.';
        return undefined;
    }, [myRoom, isOwner, duoPairAiPartnerReady, isBusy]);
    /** 필터된 `myRoom`이 비어도 서버·전체 채널에 2인 AI 껍데기 방이 있으면 인식 */
    const pairAiLobbyDuoRoom = useMemo(() => {
        if (myRoom?.roomKind === 'duo_match' && isPairAiDuoInviteOnlyRoom(myRoom)) return myRoom;
        if (myRoomAnyLobbyChannel && isPairAiDuoInviteOnlyRoom(myRoomAnyLobbyChannel)) return myRoomAnyLobbyChannel;
        return myRoom?.roomKind === 'duo_match' ? myRoom : null;
    }, [myRoom, myRoomAnyLobbyChannel]);
    const pairAiDuoLobbyContext = useMemo(() => {
        if (lobbyChannel !== 'pair' || lobbyIntent !== 'ai') return undefined;
        const duoRoom = pairAiLobbyDuoRoom;
        const activeRoom =
            myRoom?.roomKind === 'ai_duel'
                ? { id: myRoom.id, roomKind: myRoom.roomKind }
                : duoRoom
                  ? { id: duoRoom.id, roomKind: duoRoom.roomKind }
                  : myRoom
                    ? { id: myRoom.id, roomKind: myRoom.roomKind }
                    : null;
        return {
            myRoom: activeRoom,
            canStartAiMatch: Boolean(canStartAiMatch && duoRoom?.roomKind === 'duo_match'),
            startBlockReason: pairAiDuoStartBlockReason,
            onEnsureDuoRoom: createAiDuoMatchRoom,
            onRequestLeaveRoomForModeSwitch: () => leaveRoom(),
        };
    }, [
        lobbyChannel,
        lobbyIntent,
        myRoom,
        pairAiLobbyDuoRoom,
        canStartAiMatch,
        pairAiDuoStartBlockReason,
        createAiDuoMatchRoom,
        leaveRoom,
    ]);
    const showReadyButton = Boolean(myRoom && !isOwner && (isPartner || isExtraPairMember));
    const showPairRankedPetDuoMatchingCancelButton = Boolean(
        myRoom &&
            (isPairPetRoom || isDuoArenaRanked) &&
            isPairRoomMatching &&
            (isOwner || isPartner || isExtraPairMember),
    );
    const roomActionButtonCount =
        (showReadyButton ? 1 : 0) +
        (showPairRankedPetDuoMatchingCancelButton ? 1 : isOwner ? 1 : 0) +
        (isOwner &&
        (isPairPetRoom ||
            isArenaStrategicAiRoom)
            ? 1
            : 0) +
        1;
    const roomActionGridClass =
        roomActionButtonCount >= 4
            ? 'grid-cols-4'
            : roomActionButtonCount === 3
              ? 'grid-cols-3'
              : 'grid-cols-2';

    const pairLobbyAvatarByUserId = useMemo(() => {
        const map = new Map<string, { avatarUrl?: string | null; borderUrl?: string | null }>();
        const put = (u: { id: string; avatarId?: string; borderId?: string } | null | undefined) => {
            if (!u?.id) return;
            const avatarUrl = AVATAR_POOL.find((a) => a.id === u.avatarId)?.url;
            const borderUrl = BORDER_POOL.find((b) => b.id === u.borderId)?.url;
            map.set(u.id, { avatarUrl, borderUrl });
        };
        put(currentUserWithStatus);
        for (const u of onlineUsers) put(u);
        return map;
    }, [currentUserWithStatus, onlineUsers]);
    const pairLobbyStatusByUserId = useMemo(() => {
        const map = new Map<string, UserWithStatus>();
        if (currentUserWithStatus?.id) map.set(currentUserWithStatus.id, currentUserWithStatus);
        for (const u of onlineUsers) {
            if (u?.id) map.set(u.id, u);
        }
        return map;
    }, [currentUserWithStatus, onlineUsers]);
    const seatStatusOverlayByUserId = useMemo((): Record<string, string> => {
        if (!myRoom?.ownerId) return {};
        /** 방은 대기실로 돌아왔는데 소켓/스냅샷상 `UserStatus.InGame`이 남는 경우 배지가 안 사라지는 것을 막음 */
        if (myRoom.phase !== 'in_game') return {};
        const out: Record<string, string> = {};
        const ownerStatus = pairLobbyStatusByUserId.get(myRoom.ownerId);
        if (ownerStatus?.status === UserStatus.InGame) {
            out[myRoom.ownerId] = '참여중';
        }
        const pid = myRoom.partnerId;
        if (pid && !String(pid).startsWith('pet-ai-')) {
            const partnerStatus = pairLobbyStatusByUserId.get(pid);
            if (partnerStatus?.status === UserStatus.InGame) {
                out[pid] = '참여중';
            }
        }
        return out;
    }, [myRoom?.ownerId, myRoom?.partnerId, myRoom?.phase, pairLobbyStatusByUserId]);

    const seatTeamAMembers = useMemo((): PairSeatMember[] | undefined => {
        if (!myRoom?.teamA?.members?.length) return undefined;
        const merged = mergePairSeatRowPetPortraits({
            room: myRoom,
            members: myRoom.teamA.members,
            currentUserId,
            viewerPortrait: viewerEquippedPairPetPortraitSrc,
            viewerPetDisplayName: viewerEquippedPairPetInfo.displayName,
            viewerPetName: viewerEquippedPairPetInfo.name,
            viewerPetLevel: viewerEquippedPairPetInfo.level,
        });
        return enrichPairSeatMembersWithLobbyAvatars(merged, pairLobbyAvatarByUserId);
    }, [
        currentUserId,
        myRoom,
        myRoom?.teamA?.members,
        myRoom?.ownerLobbyPet,
        myRoom?.opponentLobbyPet,
        myRoom?.extraPairMembers,
        viewerEquippedPairPetInfo,
        viewerEquippedPairPetPortraitSrc,
        pairLobbyAvatarByUserId,
    ]);

    const seatTeamBMembers = useMemo((): PairSeatMember[] | undefined => {
        if (!myRoom?.teamB?.members?.length) return undefined;
        let rows: PairSeatMember[];
        if (myRoom.roomKind === 'ai_duel' || myRoom.roomKind === 'friendly_2p') {
            rows = mergePairSeatRowPetPortraits({
                room: myRoom,
                members: myRoom.teamB.members,
                currentUserId,
                viewerPortrait: viewerEquippedPairPetPortraitSrc,
                viewerPetDisplayName: viewerEquippedPairPetInfo.displayName,
                viewerPetName: viewerEquippedPairPetInfo.name,
                viewerPetLevel: viewerEquippedPairPetInfo.level,
            });
        } else {
            rows = myRoom.teamB.members
                .filter((m) => !String(m.id).startsWith('pair-opponent-'))
                .map((m) => ({
                    id: m.id,
                    name: m.name,
                    kind: m.kind,
                    ready: m.ready,
                }));
        }
        return enrichPairSeatMembersWithLobbyAvatars(rows, pairLobbyAvatarByUserId);
    }, [
        currentUserId,
        myRoom,
        myRoom?.roomKind,
        myRoom?.teamB?.members,
        myRoom?.ownerLobbyPet,
        myRoom?.opponentLobbyPet,
        myRoom?.extraPairMembers,
        viewerEquippedPairPetInfo,
        viewerEquippedPairPetPortraitSrc,
        pairLobbyAvatarByUserId,
    ]);

    const resolveKickTargetDisplayName = (userId: string): string => {
        if (!myRoom) return '유저';
        if (myRoom.ownerId === userId) return myRoom.ownerName;
        if (myRoom.partnerId === userId) return myRoom.partnerName || '유저';
        const ex = myRoom.extraPairMembers?.find((m) => m.id === userId);
        if (ex) return ex.name;
        for (const row of [...(seatTeamAMembers ?? []), ...(seatTeamBMembers ?? [])]) {
            if (row.id === userId) return row.name;
        }
        return '유저';
    };

    const openKickConfirmForUser = (userId: string) => {
        if (!myRoom || myRoom.ownerId !== currentUserId) return;
        if (!userId || userId === currentUserId || userId.startsWith('pet-ai-')) return;
        setDelegateConfirmModal(null);
        setKickConfirmModal({ userId, userName: resolveKickTargetDisplayName(userId) });
    };

    const openDelegateConfirmForUser = (userId: string) => {
        if (!myRoom || myRoom.ownerId !== currentUserId) return;
        if (!userId || userId === currentUserId || userId.startsWith('pet-ai-')) return;
        setKickConfirmModal(null);
        setDelegateConfirmModal({ userId, userName: resolveKickTargetDisplayName(userId) });
    };

    const confirmKickFromModal = async () => {
        if (!kickConfirmModal || !myRoom || myRoom.ownerId !== currentUserId) return;
        setKickConfirmBusy(true);
        try {
            const result = await handlers.handleAction({
                type: 'PAIR_KICK_ROOM_MEMBER',
                payload: { roomId: myRoom.id, targetUserId: kickConfirmModal.userId },
            } as ServerAction);
            const error = (result as { error?: string } | undefined)?.error;
            if (error) window.alert(error);
        } finally {
            setKickConfirmModal(null);
            setKickConfirmBusy(false);
        }
    };

    const confirmDelegateFromModal = async () => {
        if (!delegateConfirmModal || !myRoom || myRoom.ownerId !== currentUserId) return;
        setDelegateConfirmBusy(true);
        try {
            const result = await handlers.handleAction({
                type: 'PAIR_DELEGATE_ROOM_OWNERSHIP',
                payload: { roomId: myRoom.id, targetUserId: delegateConfirmModal.userId },
            } as ServerAction);
            const error = (result as { error?: string } | undefined)?.error;
            if (error) window.alert(error);
        } finally {
            setDelegateConfirmModal(null);
            setDelegateConfirmBusy(false);
        }
    };

    const openViewerEquippedPairPetDetail = useCallback(() => {
        const u = currentUserWithStatus;
        if (!u?.equippedPairPetTemplateId) return;
        const row = getEquippedPairPetInventoryRow(u);
        if (row) handlers.openPairPetDetailModal(row, 'view');
    }, [currentUserWithStatus, handlers]);

    const openLobbySpectatorPairPetDetail = useCallback(
        (petAiParticipantId: string) => {
            if (!myRoom || !petAiParticipantId.startsWith('pet-ai-')) return;
            const petOwnerUserId = petAiParticipantId.slice('pet-ai-'.length);
            const snap =
                petOwnerUserId === myRoom.ownerId
                    ? myRoom.ownerLobbyPet
                    : petOwnerUserId === myRoom.extraPairMembers?.[0]?.id
                      ? myRoom.opponentLobbyPet
                      : undefined;
            const item = snap ? lobbySpectatorPetSnapshotToInventoryItem(snap) : null;
            if (item) handlers.openPairPetDetailModal(item, 'view');
        },
        [handlers, myRoom],
    );

    const renderPairLobbyPairRankedStats = (embeddedInUsersColumn = false) => {
        if (lobbyChannel !== 'pair') return null;
        return (
            <div
                className={
                    embeddedInUsersColumn
                        ? 'shrink-0 overflow-hidden px-2 pt-2 pb-1 sm:px-2.5 sm:pt-2.5'
                        : `${waitingLobbyPcPanelShellClass(lobbyTone)} mb-2 shrink-0 overflow-hidden p-2`
                }
            >
                <div
                    className={`relative flex min-h-0 flex-col overflow-visible text-on-panel ${
                        isHandheld ? 'overflow-y-auto overflow-x-hidden p-2' : 'overflow-x-auto p-3 sm:p-3.5'
                    }`}
                >
                    <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-br from-indigo-900/10 via-purple-900/5 to-blue-900/10" />
                    <div
                        className={`relative z-10 mb-2 flex-shrink-0 border-b-2 border-transparent pb-2 ${
                            isHandheld
                                ? 'flex flex-row flex-nowrap items-center justify-between gap-1'
                                : 'mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-3'
                        }`}
                    >
                        <div className={`flex min-w-0 flex-1 items-center ${isHandheld ? 'gap-1.5' : 'gap-2 sm:gap-3'}`}>
                            <div
                                className={`h-6 w-1 flex-shrink-0 rounded-full bg-gradient-to-b from-yellow-400 via-amber-500 to-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.5)] ${
                                    isHandheld ? '' : 'sm:h-8'
                                }`}
                            />
                            <h2
                                className={`min-w-0 truncate bg-gradient-to-r from-white via-yellow-200 to-white bg-clip-text font-bold text-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${
                                    isHandheld ? 'text-sm leading-tight' : 'whitespace-nowrap text-xl lg:text-2xl'
                                }`}
                            >
                                페어 랭킹전
                            </h2>
                        </div>
                        {showPairLobbyPetRankedPanelMatching ? (
                            <Button
                                type="button"
                                colorScheme="none"
                                disabled={isBusy}
                                onClick={() => void cancelPairPetMatching()}
                                className={`shrink-0 font-bold text-white transition-all duration-200 ${
                                    isHandheld
                                        ? '!w-auto !rounded-md !border !border-red-400/30 !bg-gradient-to-r from-red-600/90 via-rose-600/90 to-red-600/90 !px-1.5 !py-1 !text-[0.65rem] shadow-sm hover:from-red-500 hover:via-rose-500 hover:to-red-500 sm:!text-xs'
                                        : '!flex-shrink-0 !rounded-lg !border !border-red-400/30 !bg-gradient-to-r from-red-600/90 via-rose-600/90 to-red-600/90 !px-3 !py-2 !text-xs shadow-[0_2px_12px_rgba(220,38,38,0.4)] hover:border-red-300/50 hover:from-red-500 hover:via-rose-500 hover:to-red-500 hover:shadow-[0_4px_16px_rgba(220,38,38,0.5)]'
                                }`}
                            >
                                <span className="flex items-center justify-center gap-1">
                                    <span>✕</span>
                                    <span>취소</span>
                                </span>
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                colorScheme="none"
                                disabled={isBusy}
                                onClick={() => {
                                    if (!hasEquippedPairPet) {
                                        window.alert('페어 랭킹전을 이용하려면 페어 펫을 장착해야 합니다.');
                                        return;
                                    }
                                    if (myRoom && (myRoom.roomKind !== 'ai_duel' || !myRoom.pairPetRankedQueueShell)) {
                                        window.alert(
                                            '이미 참여 중인 방이 있습니다. 펫 페어 랭킹전은 다른 페어 방에서 나온 뒤 유저 목록 상단에서 시작해 주세요.',
                                        );
                                        return;
                                    }
                                    if (myRoom && myRoom.ownerId !== currentUserId) {
                                        window.alert('방장만 랭킹전 매칭을 시작할 수 있습니다.');
                                        return;
                                    }
                                    setPairLobbyPetRankedModalOpen(true);
                                }}
                                className={`shrink-0 font-bold text-white transition-all duration-200 ${
                                    isHandheld
                                        ? '!w-auto !rounded-md !border !border-green-400/30 !bg-gradient-to-r from-green-600/90 via-emerald-600/90 to-green-600/90 !px-1.5 !py-1 !text-[0.65rem] shadow-sm hover:from-green-500 hover:via-emerald-500 hover:to-green-500 sm:!text-xs'
                                        : '!flex-shrink-0 !rounded-lg !border !border-green-400/30 !bg-gradient-to-r from-green-600/90 via-emerald-600/90 to-green-600/90 !px-3 !py-2 !text-xs shadow-[0_2px_12px_rgba(34,197,94,0.4)] hover:border-green-300/50 hover:from-green-500 hover:via-emerald-500 hover:to-green-500 hover:shadow-[0_4px_16px_rgba(34,197,94,0.5)]'
                                }`}
                            >
                                <span className={`flex items-center justify-center ${isHandheld ? 'gap-0.5' : 'gap-1.5'}`}>
                                    <span className={isHandheld ? 'text-[0.65rem] sm:text-xs' : ''}>⚔️</span>
                                    <span className={isHandheld ? 'text-[0.65rem] sm:text-xs' : ''}>
                                        {`${isHandheld ? '시작' : '랭킹전 시작'} (⚡${pairRankedMatchApButtonLabel})`}
                                    </span>
                                </span>
                            </Button>
                        )}
                    </div>
                    <div className="relative z-10 flex flex-col gap-2">
                        {showPairLobbyPetRankedPanelMatching ? (
                            <div className="relative flex-shrink-0 overflow-hidden rounded-xl border-2 border-yellow-500/60 bg-gradient-to-br from-yellow-900/50 via-amber-900/40 to-yellow-900/50 p-3 shadow-[0_8px_32px_rgba(234,179,8,0.4)] sm:p-4">
                                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-transparent to-yellow-500/20 animate-pulse" />
                                <div className="relative z-10 flex flex-col gap-3 sm:gap-4">
                                    <div className="flex items-center justify-center gap-2 sm:gap-3">
                                        <div className="relative h-10 w-10 sm:h-14 sm:w-14">
                                            <div className="absolute inset-0 rounded-full border-4 border-yellow-400 border-t-transparent animate-spin" />
                                            <div
                                                className="absolute inset-2 rounded-full border-4 border-amber-400 border-t-transparent animate-spin"
                                                style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
                                            />
                                        </div>
                                        <span className="whitespace-nowrap text-sm font-bold text-yellow-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] sm:text-xl">
                                            매칭 중...
                                        </span>
                                    </div>
                                    <div className="rounded-lg border border-yellow-400/30 bg-gradient-to-r from-yellow-900/60 to-amber-900/60 px-2 py-1.5 sm:p-3">
                                        <div className="flex min-w-0 flex-nowrap items-center justify-between gap-2">
                                            <span className="shrink-0 whitespace-nowrap text-[10px] font-medium text-yellow-200 sm:text-sm">
                                                대기 시간
                                            </span>
                                            <span className="shrink-0 whitespace-nowrap font-mono text-base font-bold tabular-nums text-yellow-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] sm:text-2xl">
                                                {pairRankedPanelFormatWait(matchElapsedSec)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                                <div className="group relative overflow-hidden rounded-lg border-2 border-blue-500/50 bg-gradient-to-br from-blue-900/40 via-indigo-900/30 to-purple-900/40 p-2.5 shadow-[0_4px_20px_rgba(59,130,246,0.3)] sm:p-3">
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-transparent to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                                    <div className="relative z-10 flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between gap-1 border-b border-blue-400/30 pb-1.5">
                                            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-300 sm:text-xs">
                                                현재 시즌
                                            </p>
                                            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <img
                                                    src={pairLobbyRankedStrip.tier.icon}
                                                    alt=""
                                                    className="h-9 w-9 flex-shrink-0 object-contain drop-shadow-[0_2px_8px_rgba(59,130,246,0.5)] transition-transform duration-300 group-hover:scale-110 sm:h-10 sm:w-10"
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p
                                                    className={`break-words text-sm font-bold leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] ${pairLobbyRankedStrip.tier.color}`}
                                                >
                                                    {pairLobbyRankedStrip.tier.name}
                                                </p>
                                                <p className="mt-0.5 text-[10px] font-medium leading-snug text-blue-300/90 sm:text-xs">
                                                    {pairLobbyPairRankedCurrentSeasonName}
                                                    {pairLobbyPairRankedIsFirstSeason ? ' (첫 시즌)' : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="rounded-md border border-blue-500/30 bg-gradient-to-r from-blue-900/50 to-indigo-900/50 p-2">
                                            <div className="flex items-baseline justify-between gap-2">
                                                <span className="shrink-0 text-[10px] font-medium text-blue-300/90 sm:text-xs">
                                                    현재 점수
                                                </span>
                                                <span className="text-right font-mono text-base font-bold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] sm:text-lg">
                                                    {Math.round(pairLobbyRankedStrip.score).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="border-t border-blue-400/20 pt-1.5 text-[10px] leading-snug text-blue-300/80 sm:text-xs">
                                                {pairLobbyRankedStrip.wins}승 {pairLobbyRankedStrip.losses}패 · 승률{' '}
                                                <span className="font-bold text-blue-200">
                                                    {(() => {
                                                        const g = pairLobbyRankedStrip.wins + pairLobbyRankedStrip.losses;
                                                        return g > 0 ? ((pairLobbyRankedStrip.wins / g) * 100).toFixed(0) : '0';
                                                    })()}
                                                    %
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 pt-0.5 text-[10px] sm:text-xs">
                                            <span className="shrink-0 font-medium text-blue-300/80">시즌 최고</span>
                                            <span className="break-all text-right font-mono font-semibold tabular-nums text-blue-200">
                                                {Math.round(pairLobbyRankedStrip.score).toLocaleString()}점
                                                {pairLobbyPairRankedIsFirstSeason ? ' (동일)' : ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="group relative overflow-hidden rounded-lg border-2 border-amber-500/50 bg-gradient-to-br from-amber-900/40 via-yellow-900/30 to-orange-900/40 p-2.5 shadow-[0_4px_20px_rgba(251,191,36,0.3)] sm:p-3">
                                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-orange-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                                    <div className="relative z-10 flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between gap-1 border-b border-amber-400/30 pb-1.5">
                                            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-300 sm:text-xs">
                                                최고 시즌
                                            </p>
                                            <span className="text-xs">⭐</span>
                                        </div>
                                        {pairLobbyPairRankedBestSeasonSameAsCurrent ? (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        <img
                                                            src={pairLobbyRankedStrip.tier.icon}
                                                            alt=""
                                                            className="h-9 w-9 flex-shrink-0 object-contain drop-shadow-[0_2px_8px_rgba(251,191,36,0.5)] transition-transform duration-300 group-hover:scale-110 sm:h-10 sm:w-10"
                                                        />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p
                                                            className={`break-words text-sm font-bold leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] ${pairLobbyRankedStrip.tier.color}`}
                                                        >
                                                            {pairLobbyRankedStrip.tier.name}
                                                        </p>
                                                        <p className="mt-0.5 text-[10px] font-medium leading-snug text-amber-300/90 sm:text-xs">
                                                            {pairLobbyPairRankedCurrentSeasonName}
                                                            {pairLobbyPairRankedIsFirstSeason ? ' (첫 시즌)' : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="rounded-md border border-amber-500/30 bg-gradient-to-r from-amber-900/50 to-yellow-900/50 p-2">
                                                    <p className="text-center font-mono text-base font-bold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] sm:text-lg">
                                                        {Math.round(pairLobbyRankedStrip.score).toLocaleString()}점
                                                    </p>
                                                    <p className="border-t border-amber-400/20 pt-1.5 text-center text-[10px] leading-snug text-amber-300/80 sm:text-xs">
                                                        {pairLobbyRankedStrip.wins}승 {pairLobbyRankedStrip.losses}패 · 승률{' '}
                                                        <span className="font-bold text-amber-200">
                                                            {(() => {
                                                                const g = pairLobbyRankedStrip.wins + pairLobbyRankedStrip.losses;
                                                                return g > 0 ? ((pairLobbyRankedStrip.wins / g) * 100).toFixed(0) : '0';
                                                            })()}
                                                            %
                                                        </span>
                                                    </p>
                                                </div>
                                            </>
                                        ) : pairLobbyPairRankedAllTimeBest ? (
                                            <>
                                                <div className="flex items-center gap-2 py-1">
                                                    <div className="relative shrink-0">
                                                        <img
                                                            src={
                                                                tierMetaByName(pairLobbyPairRankedAllTimeBest.tierName)?.icon ??
                                                                RANKING_TIERS[RANKING_TIERS.length - 1]!.icon
                                                            }
                                                            alt=""
                                                            className="h-9 w-9 object-contain drop-shadow-[0_2px_8px_rgba(251,191,36,0.45)] sm:h-10 sm:w-10"
                                                        />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p
                                                            className={`break-words text-sm font-bold leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] ${
                                                                tierMetaByName(pairLobbyPairRankedAllTimeBest.tierName)?.color ??
                                                                'text-amber-200'
                                                            }`}
                                                        >
                                                            {pairLobbyPairRankedAllTimeBest.tierName}
                                                        </p>
                                                        <p className="mt-0.5 whitespace-nowrap text-[10px] font-semibold text-amber-200/90 sm:text-xs">
                                                            {pairLobbyPairRankedAllTimeBest.seasonName}
                                                        </p>
                                                    </div>
                                                </div>
                                                <p className="border-t border-amber-400/20 pt-1 text-center text-[10px] text-amber-300/80 sm:text-xs">
                                                    역대 최고 등급
                                                </p>
                                            </>
                                        ) : (
                                            <div className="flex flex-1 flex-col justify-center py-2">
                                                <p className="text-center text-xs text-amber-300/70">-</p>
                                                <p className="mt-0.5 text-center text-[10px] text-amber-300/70 sm:text-xs">
                                                    역대 최고 등급
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderStrategicPvpRankedMatchPanel = (embeddedInUsersColumn = false) => {
        if (!(aggregateLobbyMode === 'strategic' && lobbyIntent === 'pvp')) return null;
        const panel = (
            <RankedMatchPanel
                currentUser={currentUserWithStatus}
                onAction={handlers.handleAction}
                isMatching={aggregateLobbyRankedMatching}
                matchingStartTime={aggregateLobbyRankedMatchingStartTime}
                shrinkToContent
                onMatchingStateChange={(isMatching, startTime) => {
                    setAggregateLobbyRankedMatching(isMatching);
                    setAggregateLobbyRankedMatchingStartTime(startTime);
                }}
                onCancelMatching={() => {
                    setAggregateLobbyRankedMatching(false);
                    setAggregateLobbyRankedMatchingStartTime(0);
                }}
            />
        );
        if (embeddedInUsersColumn) {
            return (
                <div className="shrink-0 overflow-hidden px-2 pt-2 pb-1 sm:px-2.5 sm:pt-2.5">{panel}</div>
            );
        }
        return (
            <div className={`${waitingLobbyPcPanelShellClass(lobbyTone)} mb-2 shrink-0 overflow-hidden p-2`}>
                {panel}
            </div>
        );
    };

    const renderLobbyLeftRankedSection = (opts?: { embeddedInUsersColumn?: boolean }) => {
        const embeddedInUsersColumn = opts?.embeddedInUsersColumn ?? false;
        return (
            <>
                {lobbyChannel === 'strategic' && lobbyIntent === 'pvp'
                    ? renderStrategicPvpRankedMatchPanel(embeddedInUsersColumn)
                    : null}
                {lobbyChannel === 'pair' && lobbyIntent === 'pvp'
                    ? renderPairLobbyPairRankedStats(embeddedInUsersColumn)
                    : null}
            </>
        );
    };

    const showPvpRankedInLeftPanel =
        lobbyIntent === 'pvp' && (lobbyChannel === 'strategic' || lobbyChannel === 'pair');

    const desktopLobbyChatConfig = useMemo(() => {
        if (aggregateLobbyMode === 'strategic') {
            return { mode: 'strategic' as const, prefix: '[전략바둑]' };
        }
        if (aggregateLobbyMode === 'playful') {
            return { mode: 'playful' as const, prefix: '[놀이바둑]' };
        }
        if (lobbyChannel === 'pair') {
            return { mode: 'global' as const, prefix: '[페어바둑]' };
        }
        return null;
    }, [aggregateLobbyMode, lobbyChannel]);

    const desktopLobbyChatPanel =
        !isHandheld && desktopLobbyChatConfig ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div
                    className={`${waitingLobbyPcPanelShellClass(lobbyTone)} flex min-h-0 flex-1 flex-col overflow-hidden`}
                >
                    <ChatWindow
                        messages={mergedPublicChatMessages}
                        mode={desktopLobbyChatConfig.mode}
                        onAction={handlers.handleAction}
                        onViewUser={handlers.openViewingUser}
                        locationPrefix={desktopLobbyChatConfig.prefix}
                        compactTournamentMobile
                    />
                </div>
            </div>
        ) : null;

    const aiLobbyWorkspaceProps = useMemo(
        () => ({
            channel: lobbyChannel,
            onSelectChannel: navigateArenaTab,
            onAction: handlers.handleAction,
            onPairAiAction: (a: ServerAction) => void handlePairLobbyAiChallengeAction(a),
            transformPairAiSettings,
            hasEquippedPairPet,
            isBusy,
            pairDuoContext: pairAiDuoLobbyContext,
            onPairMatchModeChange: setPairAiLobbyMatchMode,
        }),
        [
            lobbyChannel,
            navigateArenaTab,
            handlers.handleAction,
            handlePairLobbyAiChallengeAction,
            transformPairAiSettings,
            hasEquippedPairPet,
            isBusy,
            pairAiDuoLobbyContext,
        ],
    );

    const pairLobbyAnnouncementBoardMode = useMemo(
        (): WaitingLobbyAnnouncementBoardMode =>
            lobbyChannel === 'playful' ? 'playful' : lobbyChannel === 'strategic' ? 'strategic' : 'pair',
        [lobbyChannel],
    );

    const pairLobbyAnnouncementBoardEl = useMemo(
        () => (
            <div className="relative z-[2] shrink-0 px-0.5 pt-0.5 sm:px-1">
                <WaitingLobbyAnnouncementBoard mode={pairLobbyAnnouncementBoardMode} />
            </div>
        ),
        [pairLobbyAnnouncementBoardMode],
    );

    const renderAiLobbyAnnouncement = () => pairLobbyAnnouncementBoardEl;

    const aggregateAiDesktopCenterColumn = useMemo(() => {
        if (!aggregateLobbyMode) return null;
        return (
            <div className={waitingLobbyPcCenterColumnClass(lobbyTone)}>
                <div className={waitingLobbyPcPanelTopHairlineClassFor(lobbyTone)} aria-hidden />
                {pairLobbyAnnouncementBoardEl}
                <AiLobbyStandaloneCenterPanel
                    channel={aggregateLobbyMode}
                    onAction={stableLobbyHandleAction}
                    className="min-h-0 flex-1 p-1.5 sm:p-2"
                    remountKey={lobbyIntent}
                />
            </div>
        );
    }, [
        aggregateLobbyMode,
        lobbyTone,
        pairLobbyAnnouncementBoardEl,
        stableLobbyHandleAction,
        lobbyIntent,
    ]);

    const renderAiLobbyDesktopCenterShell = (centerPanel: React.ReactNode) => (
        <div className={waitingLobbyPcCenterColumnClass(lobbyTone)}>
            <div className={waitingLobbyPcPanelTopHairlineClassFor(lobbyTone)} aria-hidden />
            {renderAiLobbyAnnouncement()}
            {centerPanel}
        </div>
    );

    const renderDesktopAiLobbyUsersPanel = (opts?: { forceUsersOnly?: boolean }) => {
        const forceUsersOnly = opts?.forceUsersOnly ?? false;
        const showRankedAboveUsers = !forceUsersOnly && showPvpRankedInLeftPanel && lobbyIntent === 'pvp';
        return (
            <div className={`${waitingLobbyPcPanelShellClass(lobbyTone)} flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden`}>
                {showRankedAboveUsers ? (
                    <div className="shrink-0 border-b border-white/10">{renderLobbyLeftRankedSection({ embeddedInUsersColumn: true })}</div>
                ) : null}
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    {renderPairLobbyUsersColumn(opts)}
                </div>
            </div>
        );
    };

    const renderDesktopCenterRightWorkspace = (
        center: React.ReactNode,
        usersOpts?: { forceUsersOnly?: boolean },
    ) => (
        <div className={`flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden ${PC_LOBBY_THREE_COLUMN_ROW_GAP_CLASS}`}>
            <PcLobbyCenterRightColumn
                center={center}
                right={renderDesktopAiLobbyUsersPanel(usersOpts)}
                rightClassName={PC_LOBBY_USERS_COLUMN_CLASS}
            />
            <PcLobbyQuickRailColumn />
        </div>
    );

    const pairLobbyPlayerListSection = (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <PlayerList
                    users={playersForLobbyUserList}
                    mode={aggregateLobbyMode ?? 'pair'}
                    onAction={handlers.handleAction}
                    currentUser={currentUserWithStatus}
                    onViewUser={handlers.openViewingUser}
                    lobbyType={aggregateLobbyMode === 'playful' ? 'playful' : 'strategic'}
                    userCount={playersForLobbyUserList.length}
                    disableStatusSelect={Boolean(myRoom)}
                    pairAlignedNativeCompact={Boolean(aggregateLobbyMode && isHandheld)}
                    showArenaPartnerInviteBlockToggle
                    listScopeTabs={
                        <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-black/25 p-1">
                            <button
                                type="button"
                                onClick={() => setUserTab('users')}
                                className={`rounded-lg px-2 py-1 text-xs font-bold ${userTab === 'users' ? 'bg-cyan-500 text-cyan-950' : 'text-cyan-100 hover:bg-cyan-950/45'}`}
                            >
                                전체
                            </button>
                            <button
                                type="button"
                                onClick={() => setUserTab('friends')}
                                className={`rounded-lg px-2 py-1 text-xs font-bold ${userTab === 'friends' ? 'bg-violet-500 text-violet-950' : 'text-violet-100 hover:bg-violet-950/45'}`}
                            >
                                친구
                            </button>
                            <button
                                type="button"
                                onClick={() => setUserTab('guild')}
                                className={`rounded-lg px-2 py-1 text-xs font-bold ${userTab === 'guild' ? 'bg-amber-500 text-amber-950' : 'text-amber-100 hover:bg-amber-950/45'}`}
                            >
                                길드원
                            </button>
                        </div>
                    }
                />
            </div>
    );

    const pairLobbyMobileUsersTabPanel = (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">{pairLobbyPlayerListSection}</div>
    );

    const userListPanel = (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/20 shadow-inner ring-1 ring-white/[0.06]">
                {pairLobbyPlayerListSection}
            </div>
        </div>
    );

    /** 방 입장 후에도 하단 액션(매칭·방 나가기)이 잘리지 않도록, 목록+퀵조인은 스크롤 영역에 두고 액션 바는 고정 */
    const pairLobbySlotBoxPx = pairLobbySlotBoxPxForRow(pairLobbySlotRowHeightPx);
    const pairLobbyJoinButtonBoxPx = pairLobbyJoinButtonBoxPxForRow(pairLobbySlotRowHeightPx);
    const pairLobbyRoomListBlock = (
        <div className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${pairLobbyRoomListOuterShellClass(lobbyTone)}`}>
            <div
                ref={pairLobbySlotGridScrollRef}
                onScroll={onPairLobbySlotGridScroll}
                className={`min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-1 [-webkit-overflow-scrolling:touch] sm:p-1.5 ${pairLobbyRoomListScrollAreaClass(lobbyTone)} ${PAIR_LOBBY_ROOM_LIST_SCROLLBAR_CLASS}`}
            >
                <div
                    className="flex flex-col"
                    style={{ minHeight: PAIR_LOBBY_ROOM_SLOT_ROWS * pairLobbySlotRowHeightPx }}
                >
                    {pairLobbySlotGridVisibleRange.firstRow > 0 ? (
                        <div
                            aria-hidden
                            style={{
                                height: pairLobbySlotGridVisibleRange.firstRow * pairLobbySlotRowHeightPx,
                            }}
                        />
                    ) : null}
                    {Array.from(
                        { length: pairLobbySlotGridVisibleRange.lastRow - pairLobbySlotGridVisibleRange.firstRow + 1 },
                        (_, i) => pairLobbySlotGridVisibleRange.firstRow + i,
                    ).map((row) => {
                        const slotIdx0 = row * PAIR_LOBBY_ROOM_SLOT_COLS;
                        const slotNumber = slotIdx0 + 1;
                        const room = roomBySlotNumberForLobbyGrid.get(slotNumber);
                        const numBoxStyle = { width: pairLobbySlotBoxPx, height: pairLobbySlotBoxPx };
                        const joinButtonPx = isHandheld
                            ? Math.max(34, Math.round(pairLobbyJoinButtonBoxPx * 0.9))
                            : pairLobbyJoinButtonBoxPx;
                        const joinButtonBoxStyle = {
                            width: joinButtonPx,
                            height: joinButtonPx,
                        };
                        const numTextClass = isHandheld
                            ? 'text-[11px] font-extrabold'
                            : pairLobbySlotRowHeightPx >= 56
                              ? 'text-base font-extrabold sm:text-lg'
                              : 'text-sm font-extrabold sm:text-base';
                        if (!room) {
                            return (
                                <div
                                    key={`empty-${slotNumber}`}
                                    className="flex shrink-0 px-0.5"
                                    style={{ height: pairLobbySlotRowHeightPx }}
                                    aria-label={`${slotNumber}번 슬롯, 방 없음`}
                                >
                                    <div
                                        className={`flex h-full min-h-0 w-full min-w-0 items-stretch gap-2 overflow-hidden px-2 py-1 ${pairLobbyRoomEmptyRowShellClass(lobbyTone)}`}
                                    >
                                        <div className="flex shrink-0 flex-col items-center justify-center gap-1 self-stretch py-0.5">
                                            <div
                                                style={numBoxStyle}
                                                className={`flex shrink-0 items-center justify-center ${pairLobbyRoomEmptySlotNumClass(lobbyTone)}`}
                                            >
                                                <span className={numTextClass}>{slotNumber}</span>
                                            </div>
                                        </div>
                                        <div className="min-h-0 min-w-0 flex-1 rounded-md bg-black/10" aria-hidden />
                                    </div>
                                </div>
                            );
                        }
                        const listRoomKind = pairLobbyListDisplayRoomKind(room, lobbyChannel);
                        const arenaCh = pairRoomArenaChannelMeta(room, lobbyChannel);
                        const roomRowTone = waitingLobbyToneFromPairChannel(room.lobbyChannel ?? lobbyChannel);
                        const roomInMatch =
                            (room.phase ?? 'waiting') === 'in_game' || room.phase === 'match_pending';
                        const roomInLiveGame = (room.phase ?? 'waiting') === 'in_game';
                        const joinable = getPairLobbyJoinableFromListRoom(room);
                        const gameModeTitle = pairLobbyScheduledGameModeLabel(room.selectedGameMode) || '미정';
                        const visibilityBadgeClass =
                            room.visibility === 'private'
                                ? 'border-violet-400/45 bg-violet-950/55 text-violet-100'
                                : 'border-emerald-400/38 bg-emerald-950/40 text-emerald-100';
                        return (
                            <div
                                key={room.id}
                                className="flex shrink-0 px-0.5"
                                style={{ height: pairLobbySlotRowHeightPx }}
                            >
                                <div
                                    className={`${pairLobbyRoomFilledCardShellClass(roomRowTone)} ${
                                        isHandheld ? pairLobbyRoomFilledCardShellHandheldExtraClass : 'overflow-hidden px-2 py-1'
                                    }`}
                                >
                                    <div className="flex shrink-0 flex-col items-center justify-center self-stretch py-0.5">
                                        <div
                                            style={numBoxStyle}
                                            className={`flex shrink-0 items-center justify-center ${pairLobbyRoomSlotNumOccupiedClass(roomRowTone)}`}
                                            aria-hidden
                                        >
                                            <span className={numTextClass}>{slotNumber}</span>
                                        </div>
                                    </div>
                                    <div
                                        className={`flex min-h-0 flex-col justify-center ${
                                            isHandheld ? 'min-w-0 flex-1 overflow-hidden' : 'min-w-0 flex-1 overflow-hidden'
                                        }`}
                                        title={room.title}
                                    >
                                        <div
                                            className={`flex min-w-0 items-center gap-0.5 sm:gap-1 ${isHandheld ? 'flex-nowrap' : 'flex-wrap'}`}
                                        >
                                            <span
                                                className={`shrink-0 rounded border px-1 py-0.5 font-extrabold leading-none sm:px-1.5 sm:text-xs ${visibilityBadgeClass} ${
                                                    isHandheld ? 'text-[10px]' : 'text-[11px]'
                                                }`}
                                            >
                                                {room.visibility === 'private' ? '비공개' : '공개'}
                                            </span>
                                            {room.passwordProtected ? (
                                                <span className="shrink-0 rounded border border-amber-400/45 bg-amber-950/55 px-1 py-0.5 text-[10px] font-extrabold leading-none text-amber-100 sm:px-1.5 sm:text-xs">
                                                    암호
                                                </span>
                                            ) : null}
                                            {!(lobbyChannel === 'playful' && arenaCh.short === '놀이') ? (
                                                <span
                                                    className={`shrink-0 rounded border px-1 py-0.5 font-extrabold leading-none sm:px-1.5 sm:text-xs ${arenaCh.badgeClass} ${
                                                        isHandheld ? 'text-[10px]' : 'text-[11px]'
                                                    }`}
                                                    title={
                                                        arenaCh.short === '전략'
                                                            ? '전략바둑 경기장'
                                                            : arenaCh.short === '놀이'
                                                              ? '놀이바둑 경기장'
                                                              : '페어 경기장'
                                                    }
                                                >
                                                    {arenaCh.short}
                                                </span>
                                            ) : null}
                                            <span
                                                className={`min-w-0 flex-1 truncate font-extrabold leading-tight text-white sm:text-base ${
                                                    isHandheld ? 'text-[11px]' : 'text-sm leading-tight'
                                                }`}
                                                title={room.title}
                                            >
                                                {room.title}
                                            </span>
                                        </div>
                                    </div>
                                    <div
                                        className={`flex min-h-0 flex-col items-end justify-center gap-0.5 text-right sm:max-w-[50%] ${
                                            isHandheld
                                                ? 'min-w-0 max-w-[34%] shrink overflow-hidden'
                                                : 'min-w-0 max-w-[46%] shrink-0 overflow-hidden'
                                        }`}
                                    >
                                        <div
                                            className={`flex min-w-0 w-full items-center justify-end gap-0.5 leading-snug sm:gap-1 sm:text-sm ${
                                                isHandheld ? 'flex-nowrap text-[10px]' : 'flex-wrap text-xs'
                                            }`}
                                        >
                                            <span
                                                className={`shrink-0 ${pairLobbyRoomKindBadgeClass(roomRowTone)} ${
                                                    isHandheld ? 'text-[10px]' : 'text-[11px]'
                                                }`}
                                            >
                                                {roomKindLabel(listRoomKind, lobbyChannel)}
                                            </span>
                                            <span
                                                className={pairLobbyGameModeBadgeClass(roomRowTone, isHandheld)}
                                                title={gameModeTitle}
                                            >
                                                {gameModeTitle}
                                            </span>
                                        </div>
                                        <div
                                            className={`w-full min-w-0 truncate text-slate-200 sm:text-sm ${
                                                isHandheld ? 'text-[10px]' : 'text-xs'
                                            }`}
                                        >
                                            <span className="font-semibold text-slate-500">방장</span>{' '}
                                            <span className="font-bold text-slate-100">{room.ownerName}</span>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 flex-none items-center justify-center self-stretch py-0.5">
                                        {roomInLiveGame ? (
                                            <div
                                                style={joinButtonBoxStyle}
                                                className={pairLobbyRoomInGameJoinSlotClass(roomRowTone)}
                                                aria-label={`${slotNumber}번 방 경기 중`}
                                                title="경기 진행 중"
                                            >
                                                <span
                                                    className={`${pairLobbyRoomInGameJoinSlotTextClass(roomRowTone)} ${
                                                        isHandheld ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'
                                                    }`}
                                                >
                                                    경기중
                                                </span>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={!joinable || isBusy || userParticipatingInAnyPairRoom}
                                                onClick={() => quickJoin(room.id)}
                                                aria-label={`${slotNumber}번 방 입장`}
                                                style={joinButtonBoxStyle}
                                                className={pairLobbyRoomJoinButtonClass(roomRowTone, joinable)}
                                            >
                                                입장
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {pairLobbySlotGridVisibleRange.lastRow < PAIR_LOBBY_ROOM_SLOT_ROWS - 1 ? (
                        <div
                            aria-hidden
                            style={{
                                height:
                                    (PAIR_LOBBY_ROOM_SLOT_ROWS - 1 - pairLobbySlotGridVisibleRange.lastRow) *
                                    pairLobbySlotRowHeightPx,
                            }}
                        />
                    ) : null}
                </div>
            </div>
            {orphanPairRoomsForLobbyGrid.length > 0 ? (
                <div className="mt-1 shrink-0 border-t border-white/10 px-1 py-1.5">
                    <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        번호 1~100 밖의 방
                    </div>
                    <div className={`flex max-h-16 flex-wrap gap-1 overflow-y-auto ${PAIR_LOBBY_ROOM_LIST_SCROLLBAR_CLASS}`}>
                        {orphanPairRoomsForLobbyGrid.map((room) => {
                            const orphanAc = pairRoomArenaChannelMeta(room, lobbyChannel);
                            const orphanTone = waitingLobbyToneFromPairChannel(room.lobbyChannel ?? lobbyChannel);
                            const orphanInGame = (room.phase ?? 'waiting') === 'in_game';
                            if (orphanInGame) {
                                return (
                                    <div
                                        key={room.id}
                                        className={pairLobbyOrphanRoomChipInGameClass(orphanTone)}
                                        title={`${room.title} — 경기 진행 중`}
                                    >
                                        {!(lobbyChannel === 'playful' && orphanAc.short === '놀이') ? (
                                            <span
                                                className={`shrink-0 rounded border px-1 py-px text-[9px] font-black ${orphanAc.badgeClass}`}
                                            >
                                                {orphanAc.short}
                                            </span>
                                        ) : null}
                                        <span className="min-w-0 truncate">{room.title}</span>
                                        <span className={pairLobbyOrphanInGamePillClass(orphanTone)}>경기중</span>
                                    </div>
                                );
                            }
                            return (
                                <button
                                    key={room.id}
                                    type="button"
                                    disabled={isBusy || userParticipatingInAnyPairRoom || !getPairLobbyJoinableFromListRoom(room)}
                                    onClick={() => quickJoin(room.id)}
                                    className={pairLobbyOrphanRoomChipJoinableClass(orphanTone)}
                                    title={room.title}
                                >
                                    {!(lobbyChannel === 'playful' && orphanAc.short === '놀이') ? (
                                        <span className={`shrink-0 rounded border px-1 py-px text-[9px] font-black ${orphanAc.badgeClass}`}>
                                            {orphanAc.short}
                                        </span>
                                    ) : null}
                                    <span className="min-w-0 truncate">{room.title}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );

    const pairLobbyRoomQuickJoinToolbar = (
        <div className={pairLobbyQuickJoinToolbarClass(lobbyTone)}>
            <div
                className={`rounded-xl shadow-inner ${pairLobbyQuickJoinInnerWellClass(lobbyTone)} ${
                    isHandheld ? 'px-1.5 py-1.5' : 'px-2 py-2 sm:px-2.5 sm:py-2'
                }`}
            >
                <div
                    className={
                        isHandheld
                            ? 'flex min-w-0 flex-nowrap items-center gap-1'
                            : 'flex flex-wrap items-center justify-center gap-2 sm:gap-2.5'
                    }
                >
                    {lobbyChannel === 'pair' ? (
                        <>
                            <label className="sr-only" htmlFor="pair-lobby-room-kind-filter">
                                방 종류 필터
                            </label>
                            <select
                                id="pair-lobby-room-kind-filter"
                                value={pairLobbyListRoomKindFilter}
                                onChange={(e) => setPairLobbyListRoomKindFilter(e.target.value as PairLobbyListRoomKindFilter)}
                                disabled={userParticipatingInAnyPairRoom}
                                className={
                                    isHandheld ? pairLobbyListFilterSelectClassHandheldResolved : pairLobbyListFilterSelectClassResolved
                                }
                            >
                                {pairLobbyListRoomKindFilterOptions.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </>
                    ) : null}
                    <label className="sr-only" htmlFor="pair-lobby-game-mode-filter">
                        게임 모드 필터
                    </label>
                    <select
                        id="pair-lobby-game-mode-filter"
                        value={pairLobbyListGameModeFilter}
                        onChange={(e) => {
                            const v = e.target.value;
                            setPairLobbyListGameModeFilter(v === 'all' ? 'all' : (v as GameMode));
                        }}
                        disabled={userParticipatingInAnyPairRoom}
                        className={isHandheld ? pairLobbyListFilterSelectClassHandheldResolved : pairLobbyListFilterSelectClassResolved}
                    >
                        {pairLobbyListGameModeFilterOptions.map((o) => (
                            <option key={o.value === 'all' ? 'all' : o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                    <div
                        className={`flex min-w-0 shrink-0 items-center gap-1.5 ${
                            isHandheld ? 'flex-nowrap' : 'flex-wrap sm:flex-nowrap'
                        }`}
                    >
                        <div
                            className={`flex shrink-0 items-stretch ${pairLobbyQuickJoinRoomNumberRowClass(lobbyTone)} ${
                                isHandheld ? 'min-w-0 gap-0.5 py-0.5 pl-1 pr-0.5' : 'min-w-0 max-w-full gap-1 py-0.5 pl-2 pr-0.5'
                            }`}
                        >
                            <input
                                value={joinRoomNumber}
                                onChange={(e) => setJoinRoomNumber(normalizeRoomNumberInput(e.target.value))}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !isBusy && !userParticipatingInAnyPairRoom) joinByRoomNumber();
                                }}
                                placeholder="방 번호"
                                maxLength={12}
                                disabled={userParticipatingInAnyPairRoom}
                                className={pairLobbyQuickJoinRoomNumberInputClass(lobbyTone, isHandheld)}
                            />
                            <button
                                type="button"
                                disabled={isBusy || userParticipatingInAnyPairRoom}
                                onClick={() => joinByRoomNumber()}
                                className={pairLobbyQuickJoinRoomNumberGoBtnClass(lobbyTone, isHandheld)}
                            >
                                입장
                            </button>
                        </div>
                        <Button
                            bare
                            type="button"
                            disabled={
                                isBusy ||
                                (userParticipatingInAnyPairRoom &&
                                    !(lobbyIntent === 'pvp' && pairLobbyRoomForm === 'create'))
                            }
                            onClick={() => {
                                if (lobbyIntent === 'pvp' && pairLobbyRoomForm === 'create') {
                                    if (!isBusy) setPairLobbyRoomForm('closed');
                                    return;
                                }
                                openCreateRoomModal();
                            }}
                            className={`min-w-0 shrink-0 rounded-md border px-3 py-1.5 text-[10px] font-semibold tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] ring-1 transition disabled:pointer-events-none disabled:opacity-45 sm:px-5 sm:py-2 sm:text-xs ${
                                lobbyIntent === 'pvp' && pairLobbyRoomForm === 'create'
                                    ? 'border-white/25 bg-zinc-800/70 text-zinc-100 ring-white/10 hover:border-white/35 hover:bg-zinc-700/70'
                                    : 'border-emerald-400/30 bg-gradient-to-b from-emerald-800/40 via-emerald-950/70 to-black/80 text-emerald-50 shadow-[0_8px_24px_-8px_rgba(16,185,129,0.35)] ring-emerald-500/15 hover:border-emerald-300/45 hover:from-emerald-700/45 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_28px_-6px_rgba(52,211,153,0.28)]'
                            }`}
                        >
                            {lobbyIntent === 'pvp' && pairLobbyRoomForm === 'create' ? '취소' : '방만들기'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );

    const pairLobbyRightTabButtonClass = (active: boolean, tone: 'violet' | 'fuchsia' | 'amber') => {
        const on =
            tone === 'violet'
                ? 'bg-violet-500 text-violet-950'
                : tone === 'fuchsia'
                  ? 'bg-fuchsia-600 text-fuchsia-50'
                  : 'bg-amber-500 text-amber-950';
        const off =
            tone === 'violet'
                ? 'text-violet-100 hover:bg-violet-950/45'
                : tone === 'fuchsia'
                  ? 'text-fuchsia-100 hover:bg-fuchsia-950/40'
                  : 'text-amber-100 hover:bg-amber-950/45';
        return `rounded-lg px-2 py-1.5 text-xs font-extrabold transition sm:py-2 sm:text-sm ${active ? on : off}`;
    };

    /** 방 내부 — `isHandheld`일 때 채팅·하단 액션 등 밀도 높은 UI */
    const renderPairLobbyRoomInteriorPanel = (opts?: { pairAiDuoSlotsOnly?: boolean }) => {
        if (!myRoom) return null;
        void cooldownUiTick;
        const lobbyChangeCooldownMs = myRoom.pairLobbySettingChangeCooldownUntil?.[currentUserId];
        const lobbyChangeOnCooldown = typeof lobbyChangeCooldownMs === 'number' && lobbyChangeCooldownMs > Date.now();
        const strategicLobbyChangeProposeDisabled =
            isBusy ||
            isPairRoomMatching ||
            isPairRoomMatchPending ||
            (myRoom.phase ?? 'waiting') === 'in_game' ||
            Boolean(myRoom.pairRankedPetProposal) ||
            Boolean(myRoom.pairDuoRankedLobbyProposal) ||
            Boolean(myRoom.pairLobbySettingChangeProposal) ||
            lobbyChangeOnCooldown ||
            currentUserPairReady;
        const strategicLobbyChangeProposeTitle = lobbyChangeOnCooldown
            ? `거절 후 ${Math.max(0, Math.ceil(((lobbyChangeCooldownMs as number) - Date.now()) / 1000))}초 뒤에 다시 제안할 수 있습니다.`
            : myRoom.pairLobbySettingChangeProposal
              ? '처리 중인 변경 제안이 있습니다.'
              : currentUserPairReady
                ? '준비 완료 상태에서는 변경 제안을 할 수 없습니다.'
                : undefined;
        const useHandheldRoomChrome = isHandheld;
        const isPairAiDuoInviteLobby = isPairAiDuoTeamLobbyContext(myRoom, lobbyIntent, lobbyChannel);
        const pairAiDuoSlotsOnly = Boolean(
            opts?.pairAiDuoSlotsOnly ?? (lobbyIntent === 'ai' && isPairAiDuoInviteLobby && useHandheldRoomChrome),
        );
        const hidePairChat = lobbyIntent === 'ai';
        const scheduledGameVisual = isPairAiDuoInviteLobby
            ? null
            : pairLobbyGameModeIconAndName(myRoom.selectedGameMode);
        const scheduledGameDetailRows = isPairAiDuoInviteLobby
            ? []
            : buildPairRoomLobbyGameSettingRows(myRoom, { lobbyChannelFallback: lobbyChannel });
        const showScheduledGameSettings = Boolean(scheduledGameVisual);
        const pcInlineSeatsBesideSettings = !useHandheldRoomChrome && showScheduledGameSettings;
        const pairRoomSeatGridBoxEl = (
            <div
                className={`min-h-0 min-w-0 ${
                    useHandheldRoomChrome
                        ? `shrink-0 ${pairAggregateRoomInteriorTeamBoxHandheldClass(lobbyTone)} overflow-x-auto`
                        : pcInlineSeatsBesideSettings
                          ? 'w-full'
                          : `shrink-0 ${pairAggregateRoomInteriorTeamBoxClass(lobbyTone)}`
                }`}
            >
                <PairRoomSeatGrid
                    compact={useHandheldRoomChrome}
                    seatChromeTone={lobbyTone}
                    oneSlotPerTeam={Boolean(
                        (aggregateLobbyMode && myRoom.roomKind === 'arena_ai') ||
                            ((lobbyChannel === 'playful' || lobbyChannel === 'strategic') &&
                                myRoom.roomKind === 'duo_match'),
                    )}
                    arenaAiGameMode={
                        myRoom.roomKind === 'arena_ai' ||
                        myRoom.roomKind === 'duo_match' ||
                        myRoom.roomKind === 'ai_duel'
                            ? myRoom.selectedGameMode
                            : undefined
                    }
                    pairAiLobbyRoomId={
                        myRoom.roomKind === 'duo_match' || myRoom.roomKind === 'ai_duel' ? myRoom.id : undefined
                    }
                    pairAiLobbySettings={
                        myRoom.roomKind === 'duo_match' || myRoom.roomKind === 'ai_duel' ? myRoom.settings : undefined
                    }
                    hideDuoAiOpponentColumn={lobbyChannel === 'pair' && myRoom.roomKind === 'duo_match'}
                    roomKind={myRoom.roomKind}
                    ownerId={myRoom.ownerId}
                    ownerName={myRoom.ownerName}
                    partnerId={myRoom.partnerId}
                    partnerName={myRoom.partnerName}
                    ownerReady={myRoom.ownerReady}
                    partnerReady={myRoom.partnerReady}
                    teamAMembers={seatTeamAMembers}
                    teamBMembers={seatTeamBMembers}
                    statusOverlayByUserId={seatStatusOverlayByUserId}
                    viewerId={currentUserId}
                    viewerEquippedPairPetPortraitSrc={viewerEquippedPairPetPortraitSrc}
                    viewerEquippedPairPetName={viewerEquippedPairPetInfo.name}
                    viewerEquippedPairPetLevel={viewerEquippedPairPetInfo.level}
                    onViewSeatUserProfile={(userId) => {
                        if (!userId || userId.startsWith('pet-ai-')) return;
                        handlers.openViewingUser(userId);
                    }}
                    onViewOwnerEquippedPetDetail={openViewerEquippedPairPetDetail}
                    onViewOtherSeatPetDetail={
                        myRoom.roomKind === 'ai_duel' || myRoom.roomKind === 'friendly_2p'
                            ? openLobbySpectatorPairPetDetail
                            : undefined
                    }
                    onInvitePartnerSlot={
                        isOwner && myRoom.roomKind === 'duo_match' && lobbyChannel !== 'playful'
                            ? () => {
                                  setPartnerInviteTargetSlot({ team: 'teamA', index: 1 });
                                  setPartnerInviteModalOpen(true);
                              }
                            : undefined
                    }
                    onInviteEmptySlot={
                        isOwner &&
                        (myRoom.roomKind === 'duo_match' ||
                            myRoom.roomKind === 'friendly_4p' ||
                            myRoom.roomKind === 'friendly_2p')
                            ? (team, index) => {
                                  setPartnerInviteTargetSlot({ team, index });
                                  setPartnerInviteModalOpen(true);
                              }
                            : undefined
                    }
                    onCommitSeatAssignments={
                        isOwner
                            ? async (teamA, teamB) => {
                                  const result = await handlers.handleAction({
                                      type: 'PAIR_SET_SEAT_ASSIGNMENTS',
                                      payload: { roomId: myRoom.id, teamA, teamB },
                                  } as ServerAction);
                                  const error = (result as { error?: string } | undefined)?.error;
                                  if (error) window.alert(error);
                              }
                            : undefined
                    }
                    onKickRoomMemberRequest={isOwner ? openKickConfirmForUser : undefined}
                    onDelegateRoomOwnershipRequest={isOwner ? openDelegateConfirmForUser : undefined}
                    kickUiDisabled={
                        isBusy ||
                        isPairRoomMatching ||
                        isPairRoomMatchPending ||
                        (myRoom.phase ?? 'waiting') === 'in_game'
                    }
                />
            </div>
        );
        const scheduledGameSettingsBlock = scheduledGameVisual ? (
            <div
                className={
                    pcInlineSeatsBesideSettings
                        ? 'w-full min-w-0 rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 sm:px-3 sm:py-2.5'
                        : pairAggregateRoomInteriorGameSettingsOuterClass(lobbyTone, useHandheldRoomChrome)
                }
            >
                <div className={pairAggregateRoomInteriorGameSettingsHeadingRowClass(lobbyTone, useHandheldRoomChrome)}>
                    대국 설정
                </div>
                <div
                    className={`flex w-full min-w-0 flex-row items-stretch ${
                        useHandheldRoomChrome ? 'mt-1.5 gap-2' : 'mt-2.5 gap-2.5 sm:mt-3 sm:gap-3'
                    }`}
                >
                    <div className={pairAggregateRoomInteriorGameModeColumnClass(lobbyTone, useHandheldRoomChrome)}>
                        <div className={pairAggregateRoomInteriorGameModeColumnHeaderClass(lobbyTone, useHandheldRoomChrome)}>
                            게임 모드
                        </div>
                        <div
                            className={`flex min-h-0 flex-1 flex-col items-center justify-center ${
                                useHandheldRoomChrome ? 'gap-1' : 'gap-2 sm:gap-2.5'
                            }`}
                        >
                            <img
                                src={scheduledGameVisual.image}
                                alt=""
                                className={`shrink-0 object-contain ${pairAggregateRoomInteriorGameModeIconDropShadowClass(lobbyTone)} ${
                                    useHandheldRoomChrome ? 'h-[3rem] w-[3rem]' : 'h-[4.5rem] w-[4.5rem] sm:h-[5.25rem] sm:w-[5.25rem]'
                                }`}
                            />
                            <div className={pairAggregateRoomInteriorGameModeNameBoxClass(lobbyTone, useHandheldRoomChrome)}>
                                {scheduledGameVisual.name}
                            </div>
                        </div>
                    </div>
                    <div className={pairAggregateRoomInteriorDetailColumnOuterClass(lobbyTone)}>
                        <div className={pairAggregateRoomInteriorDetailColumnHeaderClass(lobbyTone, useHandheldRoomChrome)}>
                            세부 조건
                        </div>
                        <div
                            className={`min-h-0 flex-1 overflow-y-auto ${
                                useHandheldRoomChrome
                                    ? 'max-h-[min(8.5rem,26vh)] px-1.5 py-1'
                                    : 'max-h-[min(14rem,34vh)] px-2 py-2 sm:px-2.5 sm:py-2.5'
                            }`}
                        >
                            {scheduledGameDetailRows.length > 0 ? (
                                <dl
                                    className={
                                        useHandheldRoomChrome
                                            ? 'grid grid-cols-2 gap-1.5'
                                            : 'grid grid-cols-2 gap-1.5 sm:gap-2'
                                    }
                                >
                                    {scheduledGameDetailRows.map((row) => (
                                        <div
                                            key={`${row.label}:${row.value}`}
                                            className={`flex min-h-0 flex-col gap-0.5 rounded-lg border border-white/12 bg-black/55 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:gap-1 sm:px-2 sm:py-1.5`}
                                        >
                                            <dt
                                                className={`min-w-0 w-full text-slate-400 [overflow-wrap:anywhere] ${useHandheldRoomChrome ? 'text-[9px] leading-tight' : 'text-[11px] leading-snug sm:text-xs'}`}
                                            >
                                                {row.label}
                                            </dt>
                                            <dd
                                                className={`min-w-0 w-full font-bold leading-tight text-slate-100 [overflow-wrap:anywhere] sm:leading-snug ${
                                                    useHandheldRoomChrome ? 'text-[9px]' : 'text-[11px] sm:text-xs'
                                                }`}
                                            >
                                                {lobbyChannel === 'playful'
                                                    ? truncatePlayfulLobbySettingDisplayValue(row.value)
                                                    : row.value}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            ) : (
                                <p
                                    className={`rounded-lg border border-dashed border-white/15 bg-black/40 px-2 py-3 text-center leading-snug text-slate-500 ${useHandheldRoomChrome ? 'text-[13px]' : 'text-sm'}`}
                                >
                                    표시할 세부 설정이 없습니다.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        ) : null;
        const roomSettingsAndSeatsBlock = useHandheldRoomChrome ? (
            <>
                {scheduledGameSettingsBlock}
                {pairRoomSeatGridBoxEl}
            </>
        ) : (
            <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,46%)] items-center gap-3">
                {scheduledGameSettingsBlock ? <div className="min-h-0 min-w-0 self-center">{scheduledGameSettingsBlock}</div> : null}
                <div className="flex min-h-0 min-w-0 items-center justify-center self-center overflow-x-auto">{pairRoomSeatGridBoxEl}</div>
            </div>
        );
        const chatPanelEl = (
            <PairRoomChatPanel
                roomId={myRoom.id}
                messages={pairRoomChatByRoomId[myRoom.id] || []}
                currentUserId={currentUserId}
                disabled={isBusy || pairRoomChatSendCooldownUi}
                variant="interior"
                interiorLobbyTone={lobbyTone}
                compact={useHandheldRoomChrome}
                fillAvailableHeight
                roomOnlyChat={!!aggregateLobbyMode}
                onSend={sendPairRoomChat}
            />
        );
        const roomHeaderSettingsAndSeats = (
            <>
                {isPairAiDuoInviteLobby && useHandheldRoomChrome ? (
                    <p className="shrink-0 rounded-lg border border-violet-400/35 bg-violet-950/40 px-2 py-1.5 text-center text-[10px] font-bold leading-snug text-violet-100 sm:text-xs">
                        대국 설정·시작은 AI 탭에서 진행합니다.
                    </p>
                ) : null}
                {!isPairAiDuoInviteLobby ? (
                <div
                    className={`flex w-full min-w-0 shrink-0 flex-col ${
                        useHandheldRoomChrome
                            ? pairAggregateRoomInteriorHeaderDividerHandheldClass(lobbyTone)
                            : pairAggregateRoomInteriorHeaderDividerDesktopClass(lobbyTone)
                    }`}
                >
                                <div
                                    className="flex w-full flex-wrap items-center justify-between gap-x-1.5 gap-y-2 sm:gap-x-2"
                                >
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-nowrap items-center gap-x-1.5 overflow-hidden sm:gap-x-2">
                                        {!isPairAiDuoInviteLobby ? (
                                            <>
                                                <span
                                                    className={`shrink-0 font-mono font-extrabold tabular-nums text-amber-200/95 drop-shadow-[0_0_10px_rgba(251,191,36,0.18)] ${useHandheldRoomChrome ? 'text-[11px]' : 'text-sm'}`}
                                                >
                                                    #{myRoom.code}
                                                </span>
                                                <span
                                                    className={`${pairAggregateRoomInteriorTitleTextClass(lobbyTone)} ${useHandheldRoomChrome ? 'text-[11px]' : 'text-sm'}`}
                                                    title={myRoom.title}
                                                >
                                                    {myRoom.title}
                                                </span>
                                            </>
                                        ) : null}
                                        <span
                                            className={`shrink-0 whitespace-nowrap rounded-md border font-extrabold sm:rounded-lg ${
                                                useHandheldRoomChrome ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px] sm:text-xs'
                                            } border-sky-400/45 bg-sky-950/50 text-sky-100`}
                                            title="방 종류"
                                        >
                                            {roomKindLabel(pairLobbyListDisplayRoomKind(myRoom, lobbyChannel), lobbyChannel)}
                                        </span>
                                        {!isPairAiDuoInviteLobby ? (
                                            <span
                                                className={
                                                    myRoom.visibility === 'private'
                                                        ? pairAggregateRoomInteriorVisibilityPrivateClass(lobbyTone, useHandheldRoomChrome)
                                                        : `shrink-0 rounded-md border font-extrabold sm:rounded-lg ${
                                                              useHandheldRoomChrome ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px] sm:text-xs'
                                                          } border-emerald-400/40 bg-emerald-950/45 text-emerald-100`
                                                }
                                            >
                                                {myRoom.visibility === 'private' ? '비공개' : '공개'}
                                                {myRoom.passwordProtected ? ' · 암호' : ''}
                                            </span>
                                        ) : null}
                                    </div>
                                    {isOwner && !isPairAiDuoInviteLobby ? (
                                        <button
                                            type="button"
                                            disabled={
                                                isBusy ||
                                                isPairRoomMatching ||
                                                isPairRoomMatchPending ||
                                                (myRoom.phase ?? 'waiting') === 'in_game' ||
                                                Boolean(myRoom.pairDuoRankedLobbyProposal)
                                            }
                                            onClick={() => openEditRoomModal()}
                                            className={`shrink-0 rounded-lg border border-amber-400/45 bg-amber-950/50 font-extrabold text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-amber-300/55 hover:bg-amber-900/45 disabled:pointer-events-none disabled:opacity-45 ${
                                                useHandheldRoomChrome ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-[11px] sm:text-xs'
                                            }`}
                                        >
                                            방 변경
                                        </button>
                                    ) : lobbyChannel === 'strategic' || lobbyChannel === 'playful' || lobbyChannel === 'pair' ? (
                                        <button
                                            type="button"
                                            disabled={strategicLobbyChangeProposeDisabled}
                                            title={strategicLobbyChangeProposeTitle}
                                            onClick={() => openProposeLobbyChangeModal()}
                                            className={`shrink-0 rounded-lg border border-cyan-400/45 bg-cyan-950/50 font-extrabold text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-cyan-300/55 hover:bg-cyan-900/45 disabled:pointer-events-none disabled:opacity-45 ${
                                                useHandheldRoomChrome ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-[11px] sm:text-xs'
                                            }`}
                                        >
                                            변경 제안
                                        </button>
                                    ) : null}
                                    {isPairRoomMatching && (isPairPetRoom || isDuoArenaRanked) ? (
                                        <div
                                            className={`pointer-events-auto flex shrink-0 items-center rounded-lg border-2 border-yellow-500/55 bg-gradient-to-br from-yellow-900/45 via-amber-900/35 to-yellow-900/45 shadow-[0_4px_20px_rgba(234,179,8,0.25)] sm:rounded-xl ${
                                                useHandheldRoomChrome ? 'gap-1.5 px-2 py-1' : 'gap-2 px-2.5 py-1.5 sm:gap-2.5 sm:px-3 sm:py-2'
                                            }`}
                                        >
                                            <div className={`relative shrink-0 ${useHandheldRoomChrome ? 'h-7 w-7' : 'h-9 w-9 sm:h-10 sm:w-10'}`}>
                                                <div
                                                    className={`absolute inset-0 rounded-full border-yellow-400 border-t-transparent animate-spin ${useHandheldRoomChrome ? 'border-2' : 'border-[3px] sm:border-4'}`}
                                                />
                                                <div
                                                    className={`absolute rounded-full border-amber-400 border-t-transparent animate-spin ${useHandheldRoomChrome ? 'inset-1 border-2' : 'inset-1.5 border-[3px] sm:inset-2 sm:border-4'}`}
                                                    style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
                                                />
                                            </div>
                                            <div className="min-w-0 text-right">
                                                <p
                                                    className={`font-extrabold uppercase tracking-wide text-yellow-200/95 ${useHandheldRoomChrome ? 'text-[9px]' : 'text-[10px] sm:text-xs'}`}
                                                >
                                                    매칭중
                                                </p>
                                                <p
                                                    className={`font-mono font-bold tabular-nums text-yellow-50 ${useHandheldRoomChrome ? 'text-[10px]' : 'text-xs sm:text-sm'}`}
                                                >
                                                    {formatElapsedHhMmSs(matchElapsedSec)}
                                                </p>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                                {roomSettingsAndSeatsBlock}
                            </div>
                ) : (
                    pairRoomSeatGridBoxEl
                )}
            </>
        );
        if (pairAiDuoSlotsOnly) {
            return (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden gap-2">
                    {pairRoomSeatGridBoxEl}
                    {showReadyButton ? (
                        <button
                            type="button"
                            disabled={isBusy || (currentUserPairReady && rankedMatchingBlocksPartnerUnready)}
                            title={
                                currentUserPairReady && rankedMatchingBlocksPartnerUnready
                                    ? '랭킹전 매칭 중에는 준비를 해제할 수 없습니다.'
                                    : undefined
                            }
                            onClick={() => {
                                if (currentUserPairReady && rankedMatchingBlocksPartnerUnready) return;
                                void setReady(!currentUserPairReady);
                            }}
                            aria-label={currentUserPairReady ? '준비 해제' : '준비'}
                            className={
                                useHandheldRoomChrome
                                    ? `${PAIR_ROOM_HANDHELD_ACTION_BTN} border-emerald-300/70 bg-gradient-to-b from-emerald-600/90 to-emerald-950/95 text-emerald-50 shadow-[0_3px_12px_-4px_rgba(16,185,129,0.45),inset_0_1px_0_rgba(255,255,255,0.1)]`
                                    : `rounded-lg border-2 border-emerald-300/70 bg-gradient-to-b from-emerald-600/90 to-emerald-950/95 px-4 py-3.5 text-sm font-extrabold leading-tight text-emerald-50 shadow-[0_6px_20px_-6px_rgba(16,185,129,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-45 sm:rounded-xl min-h-[3.35rem]`
                            }
                        >
                            {currentUserPairReady ? '준비 해제' : '준비'}
                        </button>
                    ) : null}
                </div>
            );
        }
        return (
            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className={`flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden ${useHandheldRoomChrome ? 'gap-1.5' : 'gap-2'}`}>
                    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
                        <div
                            className={`flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden ${
                                useHandheldRoomChrome ? `gap-2 ${pairAggregateRoomInteriorShellHandheldClass(lobbyTone)}` : 'gap-2'
                            }`}
                        >
                            {roomHeaderSettingsAndSeats}
                            {!hidePairChat ? (
                                <div
                                    className={`flex min-w-0 flex-1 flex-col min-h-0 ${useHandheldRoomChrome ? 'pt-0.5' : 'pt-1'}`}
                                >
                                    {chatPanelEl}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
                <div
                    className={`${
                        useHandheldRoomChrome
                            ? pairAggregateRoomInteriorActionBarHandheldClass(lobbyTone)
                            : pairAggregateRoomInteriorActionBarClass(lobbyTone)
                    } shrink-0 ${roomActionGridClass} ${useHandheldRoomChrome ? 'mt-1.5' : 'mt-2'} pb-[max(0px,env(safe-area-inset-bottom))]`}
                >
                    {showReadyButton && (
                        <button
                            type="button"
                            disabled={isBusy || (currentUserPairReady && rankedMatchingBlocksPartnerUnready)}
                            title={
                                currentUserPairReady && rankedMatchingBlocksPartnerUnready
                                    ? '랭킹전 매칭 중에는 준비를 해제할 수 없습니다.'
                                    : undefined
                            }
                            onClick={() => {
                                if (currentUserPairReady && rankedMatchingBlocksPartnerUnready) return;
                                void setReady(!currentUserPairReady);
                            }}
                            aria-label={currentUserPairReady ? '준비 해제' : '준비'}
                            className={
                                useHandheldRoomChrome
                                    ? `${PAIR_ROOM_HANDHELD_ACTION_BTN} border-emerald-300/70 bg-gradient-to-b from-emerald-600/90 to-emerald-950/95 text-emerald-50 shadow-[0_3px_12px_-4px_rgba(16,185,129,0.45),inset_0_1px_0_rgba(255,255,255,0.1)]`
                                    : `rounded-lg border-2 border-emerald-300/70 bg-gradient-to-b from-emerald-600/90 to-emerald-950/95 px-4 py-3.5 text-sm font-extrabold leading-tight text-emerald-50 shadow-[0_6px_20px_-6px_rgba(16,185,129,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-45 sm:rounded-xl min-h-[3.35rem]`
                            }
                        >
                            {currentUserPairReady ? '준비 해제' : '준비'}
                        </button>
                    )}
                    {showPairRankedPetDuoMatchingCancelButton && (
                        <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void cancelPairPetMatching()}
                            className={
                                useHandheldRoomChrome
                                    ? `${PAIR_ROOM_HANDHELD_ACTION_BTN} border-orange-400/75 bg-gradient-to-b from-orange-700/90 to-zinc-950/95 text-orange-50 shadow-[0_3px_12px_-4px_rgba(249,115,22,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]`
                                    : `rounded-lg border-2 border-orange-400/75 bg-gradient-to-b from-orange-700/90 to-zinc-950/95 px-4 py-3.5 text-sm font-extrabold text-orange-50 shadow-[0_6px_20px_-6px_rgba(249,115,22,0.45),inset_0_1px_0_rgba(255,255,255,0.1)] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-45 sm:rounded-xl min-h-[3.35rem]`
                            }
                        >
                            매칭 취소
                        </button>
                    )}
                    {isOwner &&
                        ((isPairPetRoom || isDuoArenaRanked) && isPairRoomMatching ? null : isDuoArenaRanked && isOwner && myRoom?.pairDuoRankedLobbyProposal ? (
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void cancelDuoRankedLobbyProposal()}
                                className={
                                    useHandheldRoomChrome
                                        ? `${PAIR_ROOM_HANDHELD_ACTION_BTN} border-orange-400/75 bg-gradient-to-b from-orange-700/90 to-zinc-950/95 text-orange-50 shadow-[0_3px_12px_-4px_rgba(249,115,22,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]`
                                        : `rounded-lg border-2 border-orange-400/75 bg-gradient-to-b from-orange-700/90 to-zinc-950/95 px-4 py-3.5 text-sm font-extrabold text-orange-50 shadow-[0_6px_20px_-6px_rgba(249,115,22,0.45),inset_0_1px_0_rgba(255,255,255,0.1)] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-45 sm:rounded-xl min-h-[3.35rem]`
                                }
                            >
                                제안 취소
                            </button>
                        ) : isDuoArenaRanked ? (
                            <button
                                type="button"
                                disabled={isBusy || !canOpenDuoRankedModal}
                                onClick={() => setDuoRankedMatchModalOpen(true)}
                                className={
                                    useHandheldRoomChrome
                                        ? `${PAIR_ROOM_HANDHELD_ACTION_BTN} border-amber-400/80 bg-gradient-to-b from-amber-600/95 to-amber-950/95 text-amber-50 shadow-[0_3px_12px_-4px_rgba(251,191,36,0.45),inset_0_1px_0_rgba(255,255,255,0.1)]`
                                        : `rounded-lg border-2 border-amber-400/80 bg-gradient-to-b from-amber-600/95 to-amber-950/95 px-4 py-3.5 text-sm font-extrabold text-amber-50 shadow-[0_6px_22px_-6px_rgba(251,191,36,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-45 sm:rounded-xl min-h-[3.35rem]`
                                }
                            >
                                랭킹전 매칭 (⚡{pairRankedMatchApButtonLabel})
                            </button>
                        ) : !aggregateLobbyMode && isArenaStrategicAiRoom && lobbyChannel === 'strategic' && inStrategicRankedQueue ? (
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void cancelStrategicRankedMatching()}
                                className={
                                    useHandheldRoomChrome
                                        ? `${PAIR_ROOM_HANDHELD_ACTION_BTN} border-orange-400/75 bg-gradient-to-b from-orange-700/90 to-zinc-950/95 text-orange-50 shadow-[0_3px_12px_-4px_rgba(249,115,22,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]`
                                        : `rounded-lg border-2 border-orange-400/75 bg-gradient-to-b from-orange-700/90 to-zinc-950/95 px-4 py-3.5 text-sm font-extrabold text-orange-50 shadow-[0_6px_20px_-6px_rgba(249,115,22,0.45),inset_0_1px_0_rgba(255,255,255,0.1)] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-45 sm:rounded-xl min-h-[3.35rem]`
                                }
                            >
                                매칭 취소
                            </button>
                        ) : !aggregateLobbyMode && isArenaStrategicAiRoom && lobbyChannel === 'strategic' ? (
                            <button
                                type="button"
                                disabled={isBusy || !pairLobbyHumanGuestsReadyForOwnerActions}
                                onClick={() => setStrategicArenaRankedModalOpen(true)}
                                className={
                                    useHandheldRoomChrome
                                        ? `${PAIR_ROOM_HANDHELD_ACTION_BTN} border-amber-400/80 bg-gradient-to-b from-amber-600/95 to-amber-950/95 text-amber-50 shadow-[0_3px_12px_-4px_rgba(251,191,36,0.45),inset_0_1px_0_rgba(255,255,255,0.1)]`
                                        : `rounded-lg border-2 border-amber-400/80 bg-gradient-to-b from-amber-600/95 to-amber-950/95 px-4 py-3.5 text-sm font-extrabold text-amber-50 shadow-[0_6px_22px_-6px_rgba(251,191,36,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-45 sm:rounded-xl min-h-[3.35rem]`
                                }
                            >
                                랭킹전 매칭 (⚡{strategicArenaRankedApButtonLabel})
                            </button>
                        ) : aggregateLobbyMode && isArenaStrategicAiRoom ? null : lobbyChannel === 'pair' && isPairPetRoom ? null : isPairAiDuoInviteLobby ? null : (
                            <button
                                type="button"
                                disabled={isBusy || !(isPairChannelDuoAiRoom ? canStartAiMatch : canStart)}
                                onClick={isPairChannelDuoAiRoom ? () => void startPairAiFromRoomSettings() : startMatch}
                                className={
                                    useHandheldRoomChrome
                                        ? `${PAIR_ROOM_HANDHELD_ACTION_BTN} border-amber-400/80 bg-gradient-to-b from-amber-600/95 to-amber-950/95 text-amber-50 shadow-[0_3px_12px_-4px_rgba(251,191,36,0.45),inset_0_1px_0_rgba(255,255,255,0.1)]`
                                        : `rounded-lg border-2 border-amber-400/80 bg-gradient-to-b from-amber-600/95 to-amber-950/95 px-4 py-3.5 text-sm font-extrabold text-amber-50 shadow-[0_6px_22px_-6px_rgba(251,191,36,0.55),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-45 sm:rounded-xl min-h-[3.35rem]`
                                }
                            >
                                {isPairChannelDuoAiRoom ? (
                                    'AI대전 시작'
                                ) : isPairPetRoom ? (
                                    `랭킹전 매칭 (⚡${pairRankedMatchApButtonLabel})`
                                ) : myRoom?.roomKind === 'friendly_4p' ||
                                  myRoom?.roomKind === 'friendly_2p' ||
                                  (aggregateLobbyMode && !isDuoArenaRanked) ||
                                  (isArenaFriendlyDuoRoom && !isDuoArenaRanked) ? (
                                    pairOwnerStartCountdownOnStartButton ? (
                                        <span className="inline-flex items-center justify-center gap-2">
                                            <span>경기 시작</span>
                                            <span
                                                className={`font-mono font-black tabular-nums leading-none ${
                                                    useHandheldRoomChrome ? 'text-base' : 'text-lg'
                                                }`}
                                            >
                                                {pairOwnerStartDeadlineRemainingSec}
                                            </span>
                                        </span>
                                    ) : (
                                        '경기 시작'
                                    )
                                ) : (
                                    '매칭 시작'
                                )}
                            </button>
                        ))}
                    {isOwner &&
                        (isPairPetRoom ||
                            isArenaStrategicAiRoom) &&
                        !(aggregateLobbyMode && isArenaStrategicAiRoom) &&
                        !(lobbyChannel === 'pair' && isPairPetRoom) && (
                        <button
                            type="button"
                            disabled={isBusy || !canStartAiMatch}
                            onClick={() => void startPairAiFromRoomSettings()}
                            className={
                                useHandheldRoomChrome
                                    ? `${PAIR_ROOM_HANDHELD_ACTION_BTN} border-sky-400/75 bg-gradient-to-b from-sky-600/90 to-sky-950/95 text-sky-50 shadow-[0_3px_12px_-4px_rgba(56,189,248,0.45),inset_0_1px_0_rgba(255,255,255,0.1)]`
                                    : `rounded-lg border-2 border-sky-400/75 bg-gradient-to-b from-sky-600/90 to-sky-950/95 px-4 py-3.5 text-sm font-extrabold text-sky-50 shadow-[0_6px_20px_-6px_rgba(56,189,248,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-45 sm:rounded-xl min-h-[3.35rem]`
                            }
                        >
                            AI 대전 (⚡{pairAiLobbyActionPointCostLabel(myRoom.selectedGameMode, myRoom.settings, lobbyChannel, currentUserWithStatus)})
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={isBusy}
                        onClick={leaveRoom}
                        className={
                            useHandheldRoomChrome
                                ? `${PAIR_ROOM_HANDHELD_ACTION_BTN} border-zinc-500/70 bg-gradient-to-b from-zinc-700/90 to-zinc-950/95 text-zinc-100 shadow-[0_3px_10px_-4px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]`
                                : `rounded-lg border-2 border-zinc-500/70 bg-gradient-to-b from-zinc-700/90 to-zinc-950/95 px-4 py-3.5 text-sm font-extrabold text-zinc-100 shadow-[0_6px_18px_-6px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-45 sm:rounded-xl min-h-[3.35rem]`
                        }
                    >
                        방 나가기
                    </button>
                </div>
            </div>
        );
    };

    const pairAiDuoRoomInteriorSlot =
        myRoom?.roomKind === 'duo_match'
            ? renderPairLobbyRoomInteriorPanel({ pairAiDuoSlotsOnly: true })
            : undefined;

    const renderPairLobbyMobileAiSettingsTabPanel = () =>
        lobbyChannel === 'pair' ? (
            <div className={`${waitingLobbyPcPanelShellClass(lobbyTone)} flex min-h-0 flex-1 flex-col overflow-hidden p-1.5 sm:p-2`}>
                <AiLobbyWorkspaceProvider {...aiLobbyWorkspaceProps} duoRoomInteriorSlot={pairAiDuoRoomInteriorSlot}>
                    <AiLobbyMobileWorkspace className="min-h-0 flex-1" />
                </AiLobbyWorkspaceProvider>
            </div>
        ) : (
            <div className={`${waitingLobbyPcPanelShellClass(lobbyTone)} flex min-h-0 flex-1 flex-col overflow-hidden p-1.5 sm:p-2`}>
                <AiLobbyStandaloneCenterPanel
                    channel={lobbyChannel}
                    onAction={stableLobbyHandleAction}
                    className="min-h-0 flex-1"
                    remountKey={lobbyIntent}
                />
            </div>
        );

    const pvpInlineRoomCreate = lobbyIntent === 'pvp' && pairLobbyRoomForm === 'create';
    const showPairLobbyRoomFormModal = pairLobbyRoomForm !== 'closed' && !pvpInlineRoomCreate;
    const showPvpCenterRoomTabs = Boolean(
        lobbyIntent === 'pvp' &&
            myRoom &&
            !pvpInlineRoomCreate &&
            !(isPairPetRankedQueueShellMatching && !isHandheld),
    );

    const pairLobbyRoomFormTitle =
        pairLobbyRoomForm === 'edit'
            ? lobbyChannel === 'strategic'
                ? '전략바둑 방 설정'
                : lobbyChannel === 'playful'
                  ? '놀이바둑 방 설정'
                  : '페어 방 설정'
            : pairLobbyRoomForm === 'propose'
              ? lobbyChannel === 'strategic'
                  ? '전략바둑 조건 변경 제안'
                  : lobbyChannel === 'playful'
                    ? '놀이바둑 조건 변경 제안'
                    : '대국 조건 변경 제안'
              : lobbyChannel === 'strategic'
                ? '전략바둑 방 만들기'
                : lobbyChannel === 'playful'
                  ? '놀이바둑 방 만들기'
                  : '페어 방 만들기';

    const renderPairLobbyRoomFormAiChallengeModal = () => (
        <AiChallengeModal
            key={
                pairLobbyRoomForm === 'create'
                    ? `pair-room-create-${pairCreateRoomModalNonce}-${createModalRoomKind}`
                    : pairLobbyRoomForm === 'propose'
                      ? `pair-room-propose-${myRoom?.id ?? 'x'}`
                      : `pair-room-edit`
            }
            embeddedPanel
            embeddedPanelStackedLayout={lobbyIntent === 'pvp' && pairLobbyRoomForm === 'create'}
            embeddedPanelFillParent={lobbyIntent === 'pvp' && pairLobbyRoomForm === 'create'}
            configureOnly
            pairRoomLobbyChangePropose={pairLobbyRoomForm === 'propose'}
            lobbyType={lobbyChannel === 'playful' ? 'playful' : 'strategic'}
            preferredGameSettingsBucket={pairLobbyPreferredBucketForEmbeddedRoomCreate(lobbyChannel, createModalRoomKind)}
            seedFromSession={pairDraftGameSeed}
            onClose={() => {
                if (!isBusy) setPairLobbyRoomForm('closed');
            }}
            onConfigureApply={handlePairDraftConfigureApply}
            transformSettingsBeforeStart={transformPairDraftLobbySettings}
            title=""
            submitLabel="이 설정으로 저장"
            showActionPointCost={false}
            hideScoringTurnLimit={
                lobbyChannel === 'playful' ||
                (lobbyChannel === 'pair' && createModalRoomKind === 'friendly_2p') ||
                (createModalRoomKind !== 'ai_duel' &&
                    createModalRoomKind !== 'arena_ai' &&
                    (lobbyChannel !== 'pair' || createModalRoomKind !== 'friendly_2p'))
            }
            pairRoomHideGoAiLevel={
                lobbyChannel === 'playful' ||
                createModalRoomKind === 'friendly_4p' ||
                createModalRoomKind === 'friendly_2p' ||
                (lobbyChannel === 'strategic' && createModalRoomKind === 'duo_match')
            }
            pairDuoRankedLobbyReadOnly={false}
            pairFriendlyHumanClock={
                (lobbyChannel === 'pair' &&
                    (createModalRoomKind === 'friendly_4p' || createModalRoomKind === 'friendly_2p')) ||
                ((lobbyChannel === 'strategic' || lobbyChannel === 'playful') && createModalRoomKind === 'duo_match')
            }
            pairRoomHidePlayerOrderRole={lobbyChannel === 'playful' && createModalRoomKind === 'duo_match'}
            pairRoomDenseSettingsGrid
            pairRoomHandheldCreateStackedFooter={
                isHandheld &&
                (pairLobbyRoomForm === 'create' || pairLobbyRoomForm === 'edit' || pairLobbyRoomForm === 'propose')
            }
            pairRoomHandheldBusy={isBusy}
            onPairRoomHandheldCancel={() => {
                if (!isBusy) setPairLobbyRoomForm('closed');
            }}
            onPairRoomHandheldSubmit={() => handlePairLobbyRoomFormPrimarySubmit()}
            pairRoomEmbeddedColumnFooter={
                <>
                    <Button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setPairLobbyRoomForm('closed')}
                        colorScheme="none"
                        className={`!justify-center rounded-xl border border-white/20 bg-zinc-800/60 !font-bold !text-zinc-200 ${
                            isHandheld ? '!py-2 !text-xs' : '!py-2.5 !text-sm'
                        }`}
                    >
                        취소
                    </Button>
                    <Button
                        type="button"
                        disabled={isBusy || (pairLobbyRoomForm === 'propose' && !pairLobbyProposeHasChanges)}
                        title={
                            pairLobbyRoomForm === 'propose' && !pairLobbyProposeHasChanges
                                ? '변경된 대국 설정이 없습니다.'
                                : undefined
                        }
                        onClick={() => handlePairLobbyRoomFormPrimarySubmit()}
                        colorScheme="none"
                        className={`!justify-center rounded-xl border border-emerald-400/50 bg-emerald-900/55 !font-extrabold !text-emerald-50 ${
                            isHandheld ? '!py-2 !text-xs' : '!py-2.5 !text-sm'
                        }`}
                    >
                        {pairLobbyRoomForm === 'edit' ? '저장' : pairLobbyRoomForm === 'propose' ? '제안하기' : '만들기'}
                    </Button>
                </>
            }
            pairRoomEmbeddedRightSlot={(gameSettingsBlock) => (
                <div
                    className={`flex min-h-0 w-full min-w-0 flex-1 flex-col bg-primary text-on-panel ${
                        isHandheld ? 'gap-1 p-2' : 'gap-0 p-3 sm:p-4'
                    }`}
                >
                    {pairLobbyRoomForm === 'propose' ? (
                        <p className="shrink-0 rounded-lg border border-amber-500/25 bg-amber-950/20 px-2 py-2 text-center text-[10px] font-semibold leading-snug text-amber-100/90 sm:text-xs">
                            방 이름·공개 여부는 방장 설정이며, 변경 제안에 포함되지 않습니다.
                        </p>
                    ) : isHandheld ? (
                        <div className="flex min-w-0 shrink-0 flex-col gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                                <label
                                    htmlFor="pair-create-room-title-input"
                                    className="w-[3.25rem] shrink-0 text-sm font-bold leading-tight text-cyan-100"
                                >
                                    방 이름
                                </label>
                                <input
                                    id="pair-create-room-title-input"
                                    value={createModalTitle}
                                    onChange={(e) => setCreateModalTitle(clampPairRoomTitle(e.target.value))}
                                    className="h-9 min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-2 text-sm text-slate-100 outline-none ring-0 focus:border-cyan-400/50"
                                    maxLength={PAIR_ROOM_TITLE_MAX_CHARS}
                                    autoComplete="off"
                                />
                            </div>
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <label className="sr-only" htmlFor="pair-create-room-visibility">
                                    공개 여부
                                </label>
                                <select
                                    id="pair-create-room-visibility"
                                    value={createModalVisibility}
                                    onChange={(e) => setCreateModalVisibility(e.target.value as Visibility)}
                                    className="h-9 min-w-0 flex-1 rounded-lg border border-white/15 bg-black/35 px-2 text-sm font-semibold text-slate-100"
                                >
                                    <option value="public">공개방</option>
                                    <option value="private">비공개방</option>
                                </select>
                                <input
                                    id="pair-create-room-password-input"
                                    type="password"
                                    value={createModalPassword}
                                    onChange={(e) => setCreateModalPassword(e.target.value)}
                                    onFocus={() => {
                                        if (createModalVisibility === 'private') {
                                            setCreateModalPasswordFieldFocused(true);
                                        }
                                    }}
                                    onBlur={() => setCreateModalPasswordFieldFocused(false)}
                                    disabled={createModalVisibility !== 'private'}
                                    placeholder={
                                        createModalVisibility === 'private' &&
                                        !createModalPasswordFieldFocused &&
                                        createModalPassword.length === 0
                                            ? '암호 4자'
                                            : undefined
                                    }
                                    aria-label="비공개 방 비밀번호 4자"
                                    maxLength={4}
                                    inputMode="text"
                                    autoComplete="new-password"
                                    className="h-9 w-[6.75rem] shrink-0 rounded-lg border border-white/15 bg-black/35 px-2 text-left text-sm text-slate-100 placeholder:text-slate-500 disabled:opacity-45"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex min-w-0 shrink-0 flex-nowrap items-center gap-x-2 overflow-x-auto pb-0.5 sm:gap-x-2.5">
                            <label
                                htmlFor="pair-create-room-title-input"
                                className="shrink-0 text-xs font-bold text-cyan-100 whitespace-nowrap"
                            >
                                방 이름
                            </label>
                            <input
                                id="pair-create-room-title-input"
                                value={createModalTitle}
                                onChange={(e) => setCreateModalTitle(clampPairRoomTitle(e.target.value))}
                                className="h-9 min-w-0 w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-2.5 text-sm text-slate-100 outline-none ring-0 focus:border-cyan-400/50"
                                maxLength={PAIR_ROOM_TITLE_MAX_CHARS}
                                autoComplete="off"
                            />
                            <label className="sr-only" htmlFor="pair-create-room-visibility">
                                공개 여부
                            </label>
                            <select
                                id="pair-create-room-visibility"
                                value={createModalVisibility}
                                onChange={(e) => setCreateModalVisibility(e.target.value as Visibility)}
                                className="h-9 w-[5.75rem] shrink-0 rounded-lg border border-white/15 bg-black/35 px-1.5 text-sm font-semibold text-slate-100 sm:w-[6rem] sm:px-2"
                            >
                                <option value="public">공개방</option>
                                <option value="private">비공개방</option>
                            </select>
                            <input
                                id="pair-create-room-password-input"
                                type="password"
                                value={createModalPassword}
                                onChange={(e) => setCreateModalPassword(e.target.value)}
                                onFocus={() => {
                                    if (createModalVisibility === 'private') {
                                        setCreateModalPasswordFieldFocused(true);
                                    }
                                }}
                                onBlur={() => setCreateModalPasswordFieldFocused(false)}
                                disabled={createModalVisibility !== 'private'}
                                placeholder={
                                    createModalVisibility === 'private' &&
                                    !createModalPasswordFieldFocused &&
                                    createModalPassword.length === 0
                                        ? '(비밀번호 4자)'
                                        : undefined
                                }
                                aria-label="비공개 방 비밀번호 4자"
                                maxLength={4}
                                inputMode="text"
                                autoComplete="new-password"
                                className="h-9 min-w-[7.25rem] w-[8.5rem] shrink-0 rounded-lg border border-white/15 bg-black/35 px-2 text-left text-xs text-slate-100 placeholder:text-slate-500 disabled:opacity-45 sm:min-w-[7.75rem] sm:w-[9.25rem] sm:tracking-widest"
                            />
                        </div>
                    )}
                    {pairLobbyRoomForm !== 'propose' &&
                    pairLobbyCreateModalRoomKindOptions(lobbyChannel, lobbyIntent).length > 1 ? (
                        <>
                            <hr className={`shrink-0 border-white/10 ${isHandheld ? 'my-2' : 'my-2.5'}`} />
                            <div className="shrink-0">
                                <div className={`font-bold text-cyan-100 ${isHandheld ? 'text-sm' : 'text-xs'}`}>방 종류</div>
                                <div
                                    className={`grid ${
                                        isHandheld
                                            ? 'grid-cols-2'
                                            : `grid-cols-1 ${lobbyChannel === 'pair' ? 'sm:grid-cols-2' : ''}`
                                    } ${isHandheld ? 'mt-1 gap-1' : 'mt-1.5 gap-1.5 sm:gap-2'}`}
                                >
                                    {pairLobbyCreateModalRoomKindOptions(lobbyChannel, lobbyIntent).map((opt) => {
                                        const petPairLocked =
                                            lobbyChannel === 'pair' && opt.value === 'friendly_2p' && !hasEquippedPairPet;
                                        const sel = createModalRoomKind === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                disabled={petPairLocked}
                                                onClick={() => {
                                                    if (petPairLocked) {
                                                        window.alert('이 방 종류를 만들려면 페어 펫을 장착해야 합니다.');
                                                        return;
                                                    }
                                                    setCreateModalRoomKind(opt.value);
                                                }}
                                                className={`flex min-w-0 flex-col items-center justify-center rounded-lg border px-1 text-center transition sm:rounded-xl sm:px-2 ${
                                                    isHandheld ? 'min-h-[2rem] py-1' : 'min-h-[2.75rem] py-2'
                                                } ${
                                                    petPairLocked
                                                        ? 'cursor-not-allowed border-white/5 bg-zinc-950/60 opacity-50'
                                                        : sel
                                                          ? 'border-cyan-400/60 bg-cyan-950/50 ring-1 ring-cyan-300/25'
                                                          : 'border-white/10 bg-black/30 hover:border-white/20'
                                                }`}
                                            >
                                                <div
                                                    className={`font-extrabold leading-tight text-white ${
                                                        isHandheld ? 'text-[10px]' : 'text-[11px] sm:text-sm'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <hr className={`shrink-0 border-white/10 ${isHandheld ? 'my-2' : 'my-2.5'}`} />
                        </>
                    ) : null}
                    <div
                        className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-white/10 ${
                            isHandheld ? 'mt-1 pt-1.5' : 'mt-2 pt-2'
                        }`}
                    >
                        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
                            {gameSettingsBlock}
                        </div>
                    </div>
                </div>
            )}
        />
    );

    const renderPairLobbyCenterColumn = () => (
        <div className={waitingLobbyPcCenterColumnClass(lobbyTone)}>
            <div className={waitingLobbyPcPanelTopHairlineClassFor(lobbyTone)} aria-hidden />
            {!(pvpInlineRoomCreate && isHandheld) ? pairLobbyAnnouncementBoardEl : null}
            {pvpInlineRoomCreate ? (
                <div
                    className={`mx-0.5 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden sm:mx-1 ${pairLobbyRoomListOuterShellClass(lobbyTone)}`}
                >
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-1 sm:p-1.5">
                        {renderPairLobbyRoomFormAiChallengeModal()}
                    </div>
                </div>
            ) : (
                <>
                    <div className="shrink-0">{pairLobbyRoomQuickJoinToolbar}</div>
                    {showPvpCenterRoomTabs && myRoom ? (
                <>
                    <div className="mx-0.5 shrink-0 sm:mx-1">
                        <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/25 p-1">
                            <button
                                type="button"
                                onClick={() => setPairLobbyCenterTab('rooms')}
                                className={pairLobbyRightTabButtonClass(pairLobbyCenterTab === 'rooms', 'violet')}
                            >
                                방목록
                            </button>
                            <button
                                type="button"
                                onClick={() => setPairLobbyCenterTab('room')}
                                className={`min-w-0 truncate ${pairLobbyRightTabButtonClass(pairLobbyCenterTab === 'room', 'fuchsia')}`}
                                title={pairLobbyMyRoomTabLabel(myRoom, lobbyIntent, lobbyChannel)}
                            >
                                {pairLobbyMyRoomTabLabel(myRoom, lobbyIntent, lobbyChannel)}
                            </button>
                        </div>
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                        {pairLobbyCenterTab === 'rooms' ? (
                            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                                {pairLobbyRoomListBlock}
                            </div>
                        ) : (
                            <div
                                className={`${waitingLobbyPcPanelShellClass(lobbyTone)} mx-0.5 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-1.5 sm:mx-1 sm:p-2`}
                            >
                                {renderPairLobbyRoomInteriorPanel()}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{pairLobbyRoomListBlock}</div>
            )}
                </>
            )}
        </div>
    );

    const arenaLobbySwitchGridEl = (
        <ArenaLobbySwitchGrid
            channel={lobbyChannel}
            intent={lobbyIntent}
            onSelectChannel={navigateArenaTab}
            onSelectIntent={navigateIntentTab}
            currentUser={currentUserWithStatus}
            arenaEntranceFromServer={arenaEntranceFromServer}
            arenaEntranceAvailability={arenaEntranceAvailability}
            layout={isHandheld ? 'scroll' : 'grid'}
        />
    );

    /** PC 페어 랭킹 큐 껍데기 방: 「N번방」·방 내부 UI를 숨겨 방 생성처럼 보이지 않게 함. PVP는 중앙 열 탭으로 분리 */
    const showRoomUserSplitInUsersColumn = Boolean(
        lobbyIntent !== 'pvp' &&
            myRoomForUsersColumnChrome &&
            (!isHandheld || aggregateLobbyMode) &&
            !(isPairPetRankedQueueShellMatching && !isHandheld),
    );

    const handheldOrDesktopUsersColumnPanel = isHandheld ? pairLobbyMobileUsersTabPanel : userListPanel;

    const renderPairLobbyUsersColumn = (opts?: { forceUsersOnly?: boolean }) => {
        const forceUsersOnly = opts?.forceUsersOnly ?? false;
        const showRoomSplit = !forceUsersOnly && showRoomUserSplitInUsersColumn;
        return (
        <>
            {showRoomSplit && myRoomForUsersColumnChrome ? (
                <>
                    <div
                        className="grid shrink-0 grid-cols-2 gap-1 border-b border-white/10 bg-black/25 p-1"
                    >
                        <button
                            type="button"
                            onClick={() => setPairLobbyRightTab('room')}
                            className={pairLobbyRightTabButtonClass(pairLobbyRightTab === 'room', 'violet')}
                        >
                            {pairLobbyMyRoomTabLabel(myRoomForUsersColumnChrome, lobbyIntent, lobbyChannel)}
                        </button>
                        <button
                            type="button"
                            onClick={() => setPairLobbyRightTab('users')}
                            className={pairLobbyRightTabButtonClass(pairLobbyRightTab === 'users', 'amber')}
                        >
                            유저목록
                        </button>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-1.5 sm:p-2">
                        {pairLobbyRightTab === 'room' ? (
                            renderPairLobbyRoomInteriorPanel()
                        ) : (
                            handheldOrDesktopUsersColumnPanel
                        )}
                    </div>
                </>
            ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{handheldOrDesktopUsersColumnPanel}</div>
            )}
        </>
        );
    };

    return (
        <div
            className={`${
                lobbyChannel === 'playful'
                    ? 'bg-lobby-shell-playful'
                    : lobbyChannel === 'pair'
                      ? 'bg-lobby-shell-pair'
                      : 'bg-lobby-shell-strategic'
            } text-primary flex h-full min-h-0 w-full flex-1 flex-col ${
                isHandheld
                    ? 'min-h-0 gap-2 overflow-hidden px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2'
                    : isNativeMobile
                      ? 'gap-2 overflow-y-auto px-2 pb-2 pt-2'
                      : PC_LOBBY_DESKTOP_SHELL_PADDING_CLASS
            }`}
        >
            {showPairLobbyRoomFormModal && (
                <div
                    className={`fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm ${
                        isHandheld ? 'flex flex-col justify-end p-0 sm:p-3 sm:justify-center' : 'flex items-center justify-center p-3'
                    }`}
                    role="presentation"
                    onClick={() => !isBusy && setPairLobbyRoomForm('closed')}
                >
                    <div
                        className={`relative flex w-full flex-col border border-amber-400/40 bg-gradient-to-b from-zinc-900 to-black shadow-2xl shadow-black/60 ring-1 ring-white/10 ${
                            isHandheld
                                ? 'max-h-[min(97dvh,calc(100dvh-env(safe-area-inset-bottom)-10px))] rounded-t-2xl border-b-0 sm:max-h-none sm:rounded-2xl sm:border-b'
                                : 'max-h-[min(96vh,960px)] max-w-[min(98vw,58rem)] overflow-hidden rounded-2xl'
                        }`}
                        role="dialog"
                        aria-modal
                        aria-labelledby="pair-create-room-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            disabled={isBusy}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isBusy) setPairLobbyRoomForm('closed');
                            }}
                            className="absolute right-2 top-2 z-[2] shrink-0 rounded-lg border border-white/20 bg-zinc-900/90 px-3 py-1.5 text-xs font-bold text-zinc-200 shadow-md ring-1 ring-white/10 transition hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:right-3 sm:top-3 sm:px-3.5 sm:py-2 sm:text-sm"
                        >
                            닫기
                        </button>
                        <div
                            className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${isHandheld ? 'px-3 pb-2 pt-3' : 'px-4 pb-4 pt-4'}`}
                        >
                            <h2
                                id="pair-create-room-title"
                                className={`shrink-0 text-center font-extrabold text-amber-100 ${
                                    isHandheld ? 'px-8 text-sm leading-snug' : 'px-14 text-base sm:px-16'
                                }`}
                            >
                                {pairLobbyRoomFormTitle}
                            </h2>

                            <div className="mt-3 flex min-h-0 min-w-0 flex-1 flex-col">
                                {renderPairLobbyRoomFormAiChallengeModal()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {delegateConfirmModal && (
                <div
                    className="fixed inset-0 z-[82] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
                    role="presentation"
                    onClick={() => !delegateConfirmBusy && setDelegateConfirmModal(null)}
                >
                    <div
                        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-violet-400/35 bg-gradient-to-b from-zinc-900 to-black p-4 shadow-2xl shadow-black/60 ring-1 ring-white/10"
                        role="dialog"
                        aria-modal
                        aria-labelledby="pair-delegate-confirm-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 id="pair-delegate-confirm-title" className="text-center text-base font-extrabold text-violet-100">
                            방장 위임
                        </h2>
                        <p className="mt-3 text-center text-sm text-slate-200">
                            <span className="font-bold text-white">{delegateConfirmModal.userName}</span>님에게 방장을 위임하시겠습니까?
                        </p>
                        <p className="mt-2 text-center text-xs leading-relaxed text-slate-500">
                            위임이 완료되면 해당 유저가 방장 권한을 갖고, 귀하는 일반 참가자로 남습니다.
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                bare
                                disabled={delegateConfirmBusy}
                                onClick={() => setDelegateConfirmModal(null)}
                                className="rounded-xl border border-white/20 bg-zinc-800/60 py-2.5 text-sm font-bold text-zinc-200"
                            >
                                취소
                            </Button>
                            <Button
                                type="button"
                                bare
                                disabled={delegateConfirmBusy}
                                onClick={() => void confirmDelegateFromModal()}
                                className="rounded-xl border border-violet-400/55 bg-violet-950/55 py-2.5 text-sm font-extrabold text-violet-50"
                            >
                                위임
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {kickConfirmModal && (
                <div
                    className="fixed inset-0 z-[81] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
                    role="presentation"
                    onClick={() => !kickConfirmBusy && setKickConfirmModal(null)}
                >
                    <div
                        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-rose-400/35 bg-gradient-to-b from-zinc-900 to-black p-4 shadow-2xl shadow-black/60 ring-1 ring-white/10"
                        role="dialog"
                        aria-modal
                        aria-labelledby="pair-kick-confirm-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 id="pair-kick-confirm-title" className="text-center text-base font-extrabold text-rose-100">
                            강퇴 확인
                        </h2>
                        <p className="mt-3 text-center text-sm text-slate-200">
                            <span className="font-bold text-white">{kickConfirmModal.userName}</span>님을 방에서보내겠습니까?
                        </p>
                        <p className="mt-2 text-center text-xs leading-relaxed text-slate-500">
                            강퇴된 유저는 방장 초대를 수락하기 전까지 이 방에 들어올 수 없습니다.
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                bare
                                disabled={kickConfirmBusy}
                                onClick={() => setKickConfirmModal(null)}
                                className="rounded-xl border border-white/20 bg-zinc-800/60 py-2.5 text-sm font-bold text-zinc-200"
                            >
                                취소
                            </Button>
                            <Button
                                type="button"
                                bare
                                disabled={kickConfirmBusy}
                                onClick={() => void confirmKickFromModal()}
                                className="rounded-xl border border-rose-400/55 bg-rose-950/55 py-2.5 text-sm font-extrabold text-rose-50"
                            >
                                강퇴
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {joinPasswordModal && (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
                    role="presentation"
                    onClick={() => !isBusy && setJoinPasswordModal(null)}
                >
                    <div
                        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-violet-400/35 bg-gradient-to-b from-zinc-900 to-black p-4 shadow-2xl shadow-black/60 ring-1 ring-white/10"
                        role="dialog"
                        aria-modal
                        aria-labelledby="pair-join-password-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 id="pair-join-password-title" className="text-center text-base font-extrabold text-violet-100">방 입장</h2>
                        <p className="mt-1 truncate text-center text-xs text-slate-400" title={joinPasswordModal.roomTitle}>{joinPasswordModal.roomTitle}</p>
                        <p className="mt-0.5 text-center text-xs text-violet-200/80">비공개 방입니다. 비밀번호를 입력하세요.</p>
                        <label className="mt-4 block text-xs font-bold text-cyan-100">비밀번호</label>
                        <input
                            type="password"
                            value={joinPasswordDraft}
                            onChange={(e) => setJoinPasswordDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !isBusy) void submitJoinPasswordModal();
                            }}
                            className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/45"
                            placeholder="비밀번호"
                            autoComplete="off"
                        />
                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                bare
                                disabled={isBusy}
                                onClick={() => setJoinPasswordModal(null)}
                                className="rounded-xl border border-white/20 bg-zinc-800/60 py-2.5 text-sm font-bold text-zinc-200"
                            >
                                취소
                            </Button>
                            <Button
                                type="button"
                                bare
                                disabled={isBusy}
                                onClick={() => void submitJoinPasswordModal()}
                                className="rounded-xl border border-violet-400/50 bg-violet-950/55 py-2.5 text-sm font-extrabold text-violet-50"
                            >
                                입장
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {isOwner &&
            myRoom &&
            (lobbyChannel === 'strategic' || lobbyChannel === 'playful' || lobbyChannel === 'pair') &&
            myRoom.pairLobbySettingChangeProposal &&
            ownerLobbySettingProposalStep === 'notice' ? (
                <div
                    className="fixed inset-0 z-[86] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
                    role="dialog"
                    aria-modal
                    aria-labelledby="pair-lobby-change-notice-title"
                >
                    <div
                        className="w-full max-w-sm rounded-2xl border border-amber-400/35 bg-gradient-to-b from-zinc-900 to-black p-5 shadow-2xl shadow-black/60 ring-1 ring-white/10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 id="pair-lobby-change-notice-title" className="text-center text-base font-extrabold text-amber-50">
                            대국 설정 변경제안
                        </h2>
                        <p className="mt-3 text-center text-sm leading-relaxed text-amber-100/90">대국 설정 변경제안이 왔습니다.</p>
                        <div className="mt-5 grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                bare
                                disabled={isBusy}
                                onClick={() =>
                                    void applyAction({
                                        type: 'PAIR_RESPOND_STRATEGIC_LOBBY_SETTING_CHANGE',
                                        payload: { roomId: myRoom.id, accept: false },
                                    })
                                }
                                className="rounded-xl border border-rose-400/50 bg-rose-950/55 py-2.5 text-sm font-black text-rose-50"
                            >
                                거절
                            </Button>
                            <Button
                                type="button"
                                bare
                                disabled={isBusy}
                                onClick={() => setOwnerLobbySettingProposalStep('review')}
                                className="rounded-xl border border-emerald-400/55 bg-emerald-900/55 py-2.5 text-sm font-black text-emerald-50"
                            >
                                확인
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}

            {isOwner &&
            myRoom &&
            (lobbyChannel === 'strategic' || lobbyChannel === 'playful' || lobbyChannel === 'pair') &&
            myRoom.pairLobbySettingChangeProposal &&
            ownerLobbySettingProposalStep === 'review' ? (
                <DraggableWindow
                    title="대국 설정 변경 제안"
                    windowId={`pair-lobby-setting-proposal-${myRoom.pairLobbySettingChangeProposal.proposalId}`}
                    isTopmost
                    variant="store"
                    initialWidth={isHandheld ? 380 : 540}
                    shrinkHeightToContent
                    closeOnOutsideClick={false}
                    skipSavedPosition
                    mobileViewportFit
                    bodyPaddingClassName="p-0"
                    zIndex={85}
                >
                    {(() => {
                        const prop = myRoom.pairLobbySettingChangeProposal!;
                        const pl = prop.payload;
                        const proposedMode = pl.selectedGameMode ?? myRoom.selectedGameMode ?? GameMode.Standard;
                        const gameVisual = pairLobbyGameModeIconAndName(proposedMode);
                        const settingDiffRows = buildPairLobbySettingChangeDiffRows(
                            {
                                selectedGameMode: myRoom.selectedGameMode,
                                settings: myRoom.settings,
                                roomKind: myRoom.roomKind,
                                lobbyChannel: myRoom.lobbyChannel ?? lobbyChannel,
                            },
                            pl.settings,
                            { lobbyChannelFallback: lobbyChannel },
                        );
                        return (
                            <div className="relative overflow-hidden">
                                <div
                                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_-18%,rgba(251,191,36,0.22),transparent_55%),linear-gradient(165deg,rgba(24,24,27,0.98)0%,rgba(9,9,11,0.99)48%,rgba(59,40,7,0.28)100%)]"
                                    aria-hidden
                                />
                                <div className="relative px-4 pb-5 pt-5 text-center sm:px-6 sm:pb-6 sm:pt-6">
                                    <p className="text-sm font-bold leading-snug text-amber-100/95 sm:text-base">
                                        <span className="font-black text-amber-50">{prop.fromUserName}</span>님의 제안
                                        내용입니다. 기존 설정과 제안 내용을 비교한 뒤 수락 또는 거절해 주세요.
                                    </p>
                                    <p className="mx-auto mt-3 max-w-md text-[0.68rem] leading-relaxed text-slate-400 sm:text-xs">
                                        방 이름·공개 여부·게임 모드는 방장 설정이며 변경 제안에 포함되지 않습니다.
                                    </p>
                                    <div className="mx-auto mt-4 max-w-md rounded-lg border border-violet-400/25 bg-violet-950/20 px-2 py-2 text-left sm:px-3 sm:py-2.5">
                                        <div className="flex items-center gap-2.5 sm:gap-3">
                                            <img
                                                src={gameVisual.image}
                                                alt=""
                                                className="h-10 w-10 shrink-0 object-contain sm:h-11 sm:w-11"
                                                loading="lazy"
                                            />
                                            <p className="min-w-0 flex-1 text-sm font-extrabold leading-snug text-white sm:text-base">
                                                {gameVisual.name}
                                            </p>
                                        </div>
                                        <div className="mt-3">
                                            <PairLobbySettingChangeDiffTable
                                                rows={settingDiffRows}
                                                playfulTruncate={lobbyChannel === 'playful'}
                                                compact
                                            />
                                        </div>
                                    </div>
                                    <div className="mx-auto mt-5 flex max-w-md flex-col items-stretch justify-end gap-2.5 sm:flex-row sm:justify-end sm:gap-3">
                                        <Button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() =>
                                                void applyAction({
                                                    type: 'PAIR_RESPOND_STRATEGIC_LOBBY_SETTING_CHANGE',
                                                    payload: { roomId: myRoom.id, accept: false },
                                                })
                                            }
                                            colorScheme="none"
                                            className="w-full min-w-[8rem] !rounded-full !border !border-rose-400/50 !bg-rose-950/55 !px-6 !py-2.5 !text-sm !font-black !text-rose-50 hover:!border-rose-300/60 disabled:!opacity-40 sm:ml-auto sm:w-auto"
                                        >
                                            거절
                                        </Button>
                                        <Button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() =>
                                                void applyAction({
                                                    type: 'PAIR_RESPOND_STRATEGIC_LOBBY_SETTING_CHANGE',
                                                    payload: { roomId: myRoom.id, accept: true },
                                                })
                                            }
                                            colorScheme="none"
                                            className="w-full min-w-[8rem] !rounded-full !border !border-emerald-400/55 !bg-emerald-900/55 !px-6 !py-2.5 !text-sm !font-black !text-emerald-50 hover:!border-emerald-300/65 disabled:!opacity-40 sm:w-auto"
                                        >
                                            제안 수락
                                        </Button>
                                    </div>
                                    <p className="mx-auto mt-3 max-w-md text-center text-[0.65rem] leading-relaxed text-slate-500 sm:text-xs">
                                        제안자가 방을 나가면 제안은 자동으로 취소됩니다.
                                    </p>
                                </div>
                            </div>
                        );
                    })()}
                </DraggableWindow>
            ) : null}

            {guestLobbyChangeProposeConfirmOpen && pairLobbyRoomForm === 'propose' && myRoom ? (
                <div
                    className="fixed inset-0 z-[88] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm"
                    role="dialog"
                    aria-modal
                    aria-labelledby="pair-lobby-guest-propose-confirm-title"
                    onClick={() => !isBusy && setGuestLobbyChangeProposeConfirmOpen(false)}
                >
                    <div
                        className="w-full max-w-md overflow-hidden rounded-2xl border border-cyan-400/35 bg-gradient-to-b from-zinc-900 to-black shadow-2xl shadow-black/60 ring-1 ring-white/10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="border-b border-white/10 px-4 py-4 text-center sm:px-5">
                            <h2
                                id="pair-lobby-guest-propose-confirm-title"
                                className="text-base font-extrabold text-cyan-50 sm:text-lg"
                            >
                                대국 설정 변경 제안
                            </h2>
                            <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">
                                아래 내용으로 방장에게 변경을 제안합니다. 기존 설정과 제안 내용을 확인해 주세요.
                            </p>
                        </div>
                        <div className="px-4 py-4 sm:px-5">
                            <div className="mb-3 flex items-center gap-2.5 rounded-lg border border-violet-400/25 bg-violet-950/20 px-2.5 py-2">
                                {(() => {
                                    const gameVisual = pairLobbyGameModeIconAndName(
                                        myRoom.selectedGameMode ?? GameMode.Standard,
                                    );
                                    return (
                                        <>
                                            <img
                                                src={gameVisual.image}
                                                alt=""
                                                className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10"
                                                loading="lazy"
                                            />
                                            <p className="min-w-0 flex-1 text-sm font-extrabold leading-snug text-white">
                                                {gameVisual.name}
                                            </p>
                                        </>
                                    );
                                })()}
                            </div>
                            <PairLobbySettingChangeDiffTable
                                rows={pairLobbyProposeSettingDiffRows}
                                playfulTruncate={lobbyChannel === 'playful'}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2 border-t border-white/10 px-4 py-4 sm:px-5">
                            <Button
                                type="button"
                                bare
                                disabled={isBusy}
                                onClick={() => setGuestLobbyChangeProposeConfirmOpen(false)}
                                className="rounded-xl border border-white/20 bg-zinc-800/60 py-2.5 text-sm font-bold text-zinc-200"
                            >
                                취소
                            </Button>
                            <Button
                                type="button"
                                bare
                                disabled={isBusy || !pairLobbyProposeHasChanges}
                                onClick={() => {
                                    setGuestLobbyChangeProposeConfirmOpen(false);
                                    void submitPairRoomFormModal();
                                }}
                                className="rounded-xl border border-emerald-400/55 bg-emerald-900/55 py-2.5 text-sm font-black text-emerald-50"
                            >
                                제안하기
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}

            {guestLobbyChangeProposalOutcome ? (
                <div
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
                    role="dialog"
                    aria-modal
                    aria-labelledby="pair-lobby-guest-proposal-outcome-title"
                >
                    <div
                        className={`w-full max-w-sm rounded-2xl border bg-gradient-to-b from-zinc-900 to-black p-5 shadow-2xl ring-1 ring-white/10 ${
                            guestLobbyChangeProposalOutcome === 'accepted'
                                ? 'border-emerald-400/40'
                                : 'border-slate-500/40'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2
                            id="pair-lobby-guest-proposal-outcome-title"
                            className={`text-center text-base font-extrabold ${
                                guestLobbyChangeProposalOutcome === 'accepted' ? 'text-emerald-50' : 'text-slate-100'
                            }`}
                        >
                            변경 제안
                        </h2>
                        <p
                            className={`mt-3 text-center text-sm leading-relaxed ${
                                guestLobbyChangeProposalOutcome === 'accepted' ? 'text-emerald-100/90' : 'text-slate-300'
                            }`}
                        >
                            {guestLobbyChangeProposalOutcome === 'accepted'
                                ? '변경 제안이 수락되었습니다. 방장이 제안 내용을 반영했습니다.'
                                : '변경 제안이 거절되었습니다.'}
                        </p>
                        <Button
                            type="button"
                            bare
                            className={`mt-5 w-full rounded-xl py-2.5 text-sm font-extrabold ${
                                guestLobbyChangeProposalOutcome === 'accepted'
                                    ? 'border border-emerald-400/55 bg-emerald-900/55 text-emerald-50'
                                    : 'border border-cyan-400/45 bg-cyan-950/50 text-cyan-50'
                            }`}
                            onClick={() => setGuestLobbyChangeProposalOutcome(null)}
                        >
                            확인
                        </Button>
                    </div>
                </div>
            ) : null}

            {myRoom?.pairRankedPetProposal &&
                (() => {
                    const p = myRoom.pairRankedPetProposal;
                    const duoRanked = myRoom.roomKind === 'duo_match' || p.matchKind === 'duo_human';
                    const viewerIsOwner = Boolean(currentUserId && currentUserId === myRoom.ownerId);
                    const viewerCanAccept = Boolean(
                        currentUserId &&
                            (currentUserId === myRoom.ownerId ||
                                (duoRanked && currentUserId === myRoom.partnerId)),
                    );
                    const viewerHasAccepted =
                        !currentUserId || !p
                            ? true
                            : currentUserId === myRoom.ownerId
                              ? p.myAccepted
                              : currentUserId === myRoom.partnerId
                                ? Boolean(p.myPartnerAccepted)
                                : true;
                    return (
                        <PairPetRankedMatchOfferModal
                            proposal={p}
                            isBusy={isBusy}
                            onAccept={() => void respondPairPetRankedMatch(true)}
                            onReject={() => void respondPairPetRankedMatch(false)}
                            viewerHasAccepted={viewerHasAccepted}
                            viewerCanAccept={viewerCanAccept}
                            viewerIsOwner={viewerIsOwner}
                            onDeadlineElapsed={() => {
                                void handleActionRef.current({ type: 'PAIR_SYNC' } as ServerAction);
                            }}
                            variant={myRoom.roomKind === 'duo_match' ? 'duo_human' : 'pet'}
                        />
                    );
                })()}
            {duoRankedMatchModalOpen && myRoom?.roomKind === 'duo_match' && isDuoArenaRanked && (
                <PairPetRankedMatchModeModal
                    variant="duo_arena"
                    initialMode={myRoom.selectedGameMode ?? GameMode.Standard}
                    queueCountByMode={duoPairRankedQueueCountsByMode}
                    currentUser={currentUserWithStatus}
                    isBusy={isBusy}
                    onClose={() => !isBusy && setDuoRankedMatchModalOpen(false)}
                    onQueue={(mode) => void proposeDuoRankedMatchWithMode(mode)}
                />
            )}
            {myRoom?.pairDuoRankedLobbyProposal &&
                myRoom.partnerId === currentUserId &&
                currentUserWithStatus && (
                    <PairPetRankedMatchModeModal
                        variant="duo_arena"
                        hideModePicker
                        initialMode={myRoom.pairDuoRankedLobbyProposal.mode}
                        queueCountByMode={duoPairRankedQueueCountsByMode}
                        currentUser={currentUserWithStatus}
                        isBusy={isBusy}
                        onClose={() => !isBusy && void ackDuoRankedMatch(false)}
                        onQueue={() => void ackDuoRankedMatch(true)}
                    />
                )}
            {partnerInviteModalOpen && currentUserWithStatus && (
                <PairPartnerInviteModal
                    onClose={() => {
                        setPartnerInviteModalOpen(false);
                        setPartnerInviteTargetSlot(null);
                    }}
                    currentUser={currentUserWithStatus}
                    currentUserId={currentUserId}
                    onlineUsers={onlineUsers}
                    friendIds={currentUserWithStatus.friendIds || []}
                    guildId={currentUserWithStatus.guildId}
                    cooldownUntilByInviteeId={mergedInviteCooldownUntilByInviteeId}
                    onRegisterLocalCooldown={(inviteeId, untilMs) => {
                        setLocalInviteCooldownUntilByInviteeId((prev) => ({ ...prev, [inviteeId]: untilMs }));
                    }}
                    onAction={handlers.handleAction}
                    onViewUser={handlers.openViewingUser}
                    inviteTargetSlot={partnerInviteTargetSlot}
                />
            )}

            {(pairLeaveNavTargetHash || pendingArenaNavTarget || pendingIntentNavTarget) && (
                <div
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
                    role="presentation"
                    onClick={() => !isBusy && cancelLeaveNav()}
                >
                    <div
                        className="w-full max-w-sm rounded-2xl border border-amber-400/40 bg-gradient-to-b from-zinc-900 to-black p-5 shadow-2xl ring-1 ring-white/10"
                        role="dialog"
                        aria-modal
                        aria-labelledby="pair-leave-nav-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 id="pair-leave-nav-title" className="text-center text-base font-extrabold text-amber-100">
                            {pendingArenaNavTarget === 'strategic'
                                ? '전략바둑 경기장으로 이동'
                                : pendingArenaNavTarget === 'playful'
                                  ? '놀이바둑 경기장으로 이동'
                                  : pendingArenaNavTarget === 'pair'
                                    ? '페어 경기장으로 이동'
                                    : lobbyChannel === 'strategic'
                                      ? '전략바둑 경기장'
                                      : lobbyChannel === 'playful'
                                        ? '놀이바둑 경기장'
                                        : '페어 경기장'}
                        </h2>
                        <p className="mt-3 text-center text-sm leading-relaxed text-slate-200">
                            {pendingArenaNavTarget
                                ? '다른 경기장으로 이동하면 참여 중인 방에서 나가집니다. 계속하시겠습니까?'
                                : '참여한 방에서 나가집니다. 계속하시겠습니까?'}
                        </p>
                        <div className="mt-5 grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                bare
                                disabled={isBusy}
                                onClick={cancelLeaveNav}
                                className="rounded-xl border border-white/20 bg-zinc-800/70 py-2.5 text-sm font-bold text-zinc-200"
                            >
                                취소
                            </Button>
                            <Button
                                type="button"
                                bare
                                disabled={isBusy}
                                onClick={() => void confirmLeaveNav()}
                                className="rounded-xl border border-rose-400/50 bg-rose-950/60 py-2.5 text-sm font-extrabold text-rose-50"
                            >
                                확인
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {isHandheld ? (
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                    {/* 네이티브 모바일: App이 헤더 아래에 퀵스트립을 통일 표시(#/pair·#/waiting/* 포함). 비네이티브 좁은 화면만 로비 상단에 동일 래퍼로 표시 */}
                    {!isNativeMobile && (
                        <div className="relative z-[45] w-full min-w-0 shrink-0">
                            <QuickAccessSidebar mobileHeaderStrip />
                        </div>
                    )}
                    <ArenaLobbyNavTitleBar
                        kind={lobbyChannel as ArenaLobbyNavKind}
                        lobbyIntent={lobbyIntent}
                        onBackToProfile={backToProfile}
                        titleHeadingClass={titleHeadingClass}
                    />
                    {!(pvpInlineRoomCreate && isHandheld) ? arenaLobbySwitchGridEl : null}
                    <div
                        className={`grid shrink-0 gap-0.5 rounded-xl border border-white/10 bg-black/30 p-0.5 sm:gap-1 sm:p-1 ${handheldLobbyMainTabGridColsClass}`}
                    >
                        {lobbyIntent === 'pvp' ? (
                            <button
                                type="button"
                                onClick={() => setPairLobbyMobileTab('rooms')}
                                className={`min-w-0 rounded-lg px-1 py-1.5 text-[0.58rem] font-extrabold leading-tight sm:px-2 sm:py-2 sm:text-xs ${
                                    pairLobbyMobileTab === 'rooms'
                                        ? 'bg-violet-500 text-violet-950'
                                        : 'text-violet-100 hover:bg-violet-950/45'
                                }`}
                                title={
                                    lobbyChannel === 'playful'
                                        ? '놀이바둑 방 목록'
                                        : lobbyChannel === 'strategic'
                                          ? '전략바둑 방 목록'
                                          : '페어 방 목록'
                                }
                            >
                                방목록
                            </button>
                        ) : null}
                        {showHandheldMyRoomTab && myRoomForUsersColumnChrome ? (
                            <button
                                type="button"
                                onClick={() => setPairLobbyMobileTab('room')}
                                title={pairLobbyMyRoomTabLabel(myRoomForUsersColumnChrome, lobbyIntent, lobbyChannel)}
                                className={`min-w-0 truncate rounded-lg px-1 py-1.5 text-[0.58rem] font-extrabold leading-tight sm:px-2 sm:py-2 sm:text-xs ${
                                    pairLobbyMobileTab === 'room'
                                        ? 'bg-fuchsia-600 text-fuchsia-50'
                                        : 'text-fuchsia-100 hover:bg-fuchsia-950/40'
                                }`}
                            >
                                {pairLobbyMyRoomTabLabel(myRoomForUsersColumnChrome, lobbyIntent, lobbyChannel)}
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => setPairLobbyMobileTab('users')}
                            className={`min-w-0 rounded-lg px-1 py-1.5 text-[0.58rem] font-extrabold leading-tight sm:px-2 sm:py-2 sm:text-xs ${
                                pairLobbyMobileTab === 'users'
                                    ? 'bg-amber-500 text-amber-950'
                                    : 'text-amber-100 hover:bg-amber-950/45'
                            }`}
                            title={
                                aggregateLobbyMode === 'playful'
                                    ? '접속 중인 유저 목록'
                                    : aggregateLobbyMode
                                      ? '유저 목록'
                                      : lobbyChannel === 'pair' && showHandheldRankedTab
                                        ? '유저 목록'
                                        : '유저 목록 · 페어 AI 대전'
                            }
                        >
                            유저목록
                        </button>
                        {lobbyIntent === 'ai' ? (
                            <button
                                type="button"
                                onClick={() => setPairLobbyMobileTab('ai')}
                                className={`min-w-0 rounded-lg px-1 py-1.5 text-[0.58rem] font-extrabold leading-tight sm:px-2 sm:py-2 sm:text-xs ${
                                    pairLobbyMobileTab === 'ai'
                                        ? 'bg-violet-600 text-violet-50'
                                        : 'text-violet-100 hover:bg-violet-950/45'
                                }`}
                                title="AI 대전 설정"
                            >
                                AI설정
                            </button>
                        ) : null}
                        {showHandheldRankedTab && lobbyIntent === 'pvp' ? (
                            <button
                                type="button"
                                onClick={() => setPairLobbyMobileTab('ranked')}
                                className={`min-w-0 rounded-lg px-1 py-1.5 text-[0.58rem] font-extrabold leading-tight sm:px-2 sm:py-2 sm:text-xs ${
                                    pairLobbyMobileTab === 'ranked'
                                        ? 'bg-cyan-500 text-cyan-950'
                                        : 'text-cyan-100 hover:bg-cyan-950/45'
                                }`}
                                title="랭킹전 매칭"
                            >
                                랭킹전
                            </button>
                        ) : null}
                    </div>
                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                        {pairLobbyMobileTab === 'rooms' ? (
                            <div
                                className={`flex min-h-0 flex-1 flex-col overflow-hidden px-0.5 ${
                                    pvpInlineRoomCreate && isHandheld ? 'min-h-0 flex-1' : ''
                                }`}
                            >
                                {renderPairLobbyCenterColumn()}
                            </div>
                        ) : pairLobbyMobileTab === 'room' ? (
                            myRoomForUsersColumnChrome ? (
                                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-0.5">
                                    {renderPairLobbyRoomInteriorPanel()}
                                </div>
                            ) : (
                                <div className="flex min-h-0 flex-1 items-center justify-center px-2 text-center text-xs text-slate-400">
                                    방 정보를 불러오는 중…
                                </div>
                            )
                        ) : pairLobbyMobileTab === 'ai' && lobbyIntent === 'ai' ? (
                            renderPairLobbyMobileAiSettingsTabPanel()
                        ) : pairLobbyMobileTab === 'ranked' && showHandheldRankedTab && lobbyIntent === 'pvp' ? (
                            <div className={`${waitingLobbyPcPanelShellClass(lobbyTone)} flex min-h-0 flex-1 flex-col overflow-hidden p-1.5 sm:p-2`}>
                                {renderLobbyLeftRankedSection()}
                            </div>
                        ) : (
                            <div
                                className={`${waitingLobbyPcPanelShellClass(lobbyTone)} flex min-h-0 flex-1 flex-col overflow-hidden`}
                            >
                                {renderPairLobbyUsersColumn()}
                            </div>
                        )}
                    </div>
                </div>
            ) : lobbyIntent === 'ai' && lobbyChannel === 'pair' ? (
                <AiLobbyWorkspaceProvider {...aiLobbyWorkspaceProps} duoRoomInteriorSlot={pairAiDuoRoomInteriorSlot}>
                    <div className={`flex h-full min-h-0 w-full flex-1 flex-row overflow-hidden ${PC_LOBBY_THREE_COLUMN_ROW_GAP_CLASS}`}>
                        <div className={`flex h-full min-h-0 ${PC_HOME_LEFT_COLUMN_CLASS} flex-col gap-2 overflow-hidden`}>
                            <ArenaLobbyNavTitleBar
                                kind={lobbyChannel as ArenaLobbyNavKind}
                                lobbyIntent={lobbyIntent}
                                onBackToProfile={backToProfile}
                                titleHeadingClass={`${titleHeadingClass} text-base sm:text-lg lg:text-xl`}
                            />
                            {arenaLobbySwitchGridEl}
                            {desktopLobbyChatPanel}
                        </div>
                        <PairAiDesktopMainWorkspace
                            center={renderAiLobbyDesktopCenterShell(
                                <AiLobbyCenterPanel className="min-h-0 flex-1 p-1.5 sm:p-2" />,
                            )}
                            usersPanel={renderDesktopAiLobbyUsersPanel()}
                            duoUsersPanel={renderDesktopAiLobbyUsersPanel({ forceUsersOnly: true })}
                        />
                    </div>
                </AiLobbyWorkspaceProvider>
            ) : lobbyIntent === 'ai' && aggregateLobbyMode ? (
                <div className={`flex h-full min-h-0 w-full flex-1 flex-row overflow-hidden ${PC_LOBBY_THREE_COLUMN_ROW_GAP_CLASS}`}>
                    <div className={`flex h-full min-h-0 ${PC_HOME_LEFT_COLUMN_CLASS} flex-col gap-2 overflow-hidden`}>
                        <ArenaLobbyNavTitleBar
                            kind={lobbyChannel as ArenaLobbyNavKind}
                            lobbyIntent={lobbyIntent}
                            onBackToProfile={backToProfile}
                            titleHeadingClass={`${titleHeadingClass} text-base sm:text-lg lg:text-xl`}
                        />
                        {arenaLobbySwitchGridEl}
                        {desktopLobbyChatPanel}
                    </div>
                    {aggregateAiDesktopCenterColumn ? (
                        <PcLobbyCenterRightWorkspace
                            center={aggregateAiDesktopCenterColumn}
                            usersPanel={renderDesktopAiLobbyUsersPanel()}
                        />
                    ) : null}
                </div>
            ) : (
                <div className={`flex h-full min-h-0 w-full flex-1 flex-row overflow-hidden ${PC_LOBBY_THREE_COLUMN_ROW_GAP_CLASS}`}>
                    <div className={`flex h-full min-h-0 ${PC_HOME_LEFT_COLUMN_CLASS} flex-col gap-2 overflow-hidden`}>
                        <ArenaLobbyNavTitleBar
                            kind={lobbyChannel as ArenaLobbyNavKind}
                            lobbyIntent={lobbyIntent}
                            onBackToProfile={backToProfile}
                            titleHeadingClass={`${titleHeadingClass} text-base sm:text-lg lg:text-xl`}
                        />
                        {arenaLobbySwitchGridEl}
                        {desktopLobbyChatPanel}
                    </div>
                    {renderDesktopCenterRightWorkspace(
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{renderPairLobbyCenterColumn()}</div>,
                    )}
                </div>
            )}
            {((pairRankedMatchModalOpen && myRoom?.roomKind === 'ai_duel' && lobbyChannel === 'pair') ||
                pairLobbyPetRankedModalOpen) && (
                <PairPetRankedMatchModeModal
                    initialMode={myRoom?.selectedGameMode ?? GameMode.Standard}
                    queueCountByMode={pairPetRankedQueueCountsByMode}
                    currentUser={currentUserWithStatus}
                    isBusy={isBusy}
                    onClose={() => {
                        setPairRankedMatchModalOpen(false);
                        setPairLobbyPetRankedModalOpen(false);
                    }}
                    onQueue={(mode) => void queuePairPetRankedWithMode(mode)}
                />
            )}
            {strategicArenaRankedModalOpen && myRoom?.roomKind === 'arena_ai' && lobbyChannel === 'strategic' && (
                <PairPetRankedMatchModeModal
                    variant="strategic_arena"
                    initialMode={myRoom.selectedGameMode ?? GameMode.Standard}
                    queueCountByMode={strategicRankedQueueCountsByMode}
                    currentUser={currentUserWithStatus}
                    isBusy={isBusy}
                    onClose={() => setStrategicArenaRankedModalOpen(false)}
                    onQueue={(mode) => void queueStrategicRankedWithMode(mode)}
                />
            )}
            {pairMatchSettingsModalOpen && (
                <AiChallengeModal
                    lobbyType={lobbyChannel === 'playful' ? 'playful' : 'strategic'}
                    preferredGameSettingsBucket="pair_start_match_modal"
                    seedFromSession={pairGameSeed}
                    onClose={() => setPairMatchSettingsModalOpen(false)}
                    onAction={applyAction}
                    startActionType="PAIR_START_MATCH"
                    title="페어바둑 대국 설정"
                    submitLabel="대국 시작"
                    showActionPointCost={false}
                    transformSettingsBeforeStart={transformPairAiSettings}
                    hideScoringTurnLimit
                />
            )}
            {aggregateLobbyMode && rankedMatchProposal && currentUserWithStatus && (
                <MatchFoundModal
                    proposal={rankedMatchProposal}
                    currentUserId={currentUserWithStatus.id}
                    isBusy={rankedMatchBusy || isBusy}
                    onAccept={() => void respondAggregateRankedMatch(true)}
                    onReject={() => void respondAggregateRankedMatch(false)}
                    onDeadlineElapsed={() => {
                        handlers.clearRankedMatchProposal?.();
                    }}
                />
            )}
            {pvpArenaScreenGuide.isOpen && (
                <ScreenGuideModal
                    guideId="pvpArena"
                    onClose={pvpArenaScreenGuide.close}
                    onDismissForever={pvpArenaScreenGuide.dismissForever}
                />
            )}
        </div>
    );
};

export default PairWaitingLobby;
