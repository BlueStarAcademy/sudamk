import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Button from './Button.js';
import QuickAccessSidebar, { PC_QUICK_RAIL_COLUMN_CLASS } from './QuickAccessSidebar.js';
import PlayerList from './waiting-room/PlayerList.js';
import PairRoomSeatGrid, { type PairSeatMember } from './pair/PairRoomSeatGrid.js';
import PairRoomChatPanel, { type PairRoomChatScope } from './pair/PairRoomChatPanel.js';
import type { PairRoomChatLine } from '../types/api.js';
import PairPetLobbyPanel from './pair/PairPetLobbyPanel.js';
import PairPartnerInviteModal from './pair/PairPartnerInviteModal.js';
import PairPetRankedMatchOfferModal from './pair/PairPetRankedMatchOfferModal.js';
import AiChallengeModal from './waiting-room/AiChallengeModal.js';
import { GameMode, type GameSettings, type ServerAction } from '../types.js';
import {
    waitingLobbyPcCenterColumnClass,
    waitingLobbyPcPanelShellClass,
    waitingLobbyPcPanelTopHairlineClassFor,
} from './waiting-room/waitingLobbyHomePanelStyles.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { UserStatus } from '../types.js';
import { PAIR_HATCHERY_PET_INVENTORY_FULL_MESSAGE } from '../shared/constants/pairHatchery.js';
import { PAIR_ROOM_TITLE_MAX_CHARS, clampPairRoomTitle } from '../shared/constants/pairArena.js';
import { getPairPetDefinition, getPairPetDisplayName } from '../shared/constants/petLobby.js';
import { getEquippedPairPetInventoryRow } from '../shared/utils/pairEquippedPet.js';
import { resolvePairPetMetaFromInventoryRow } from '../shared/utils/pairPetRoll.js';
import { replaceAppHash } from '../utils/appUtils.js';

function formatElapsedHhMmSs(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

type RoomKind = 'ai_duel' | 'duo_match' | 'friendly_4p';
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
    pairRankedPetProposal?: {
        proposalId: string;
        opponentOwnerId: string;
        opponentNickname: string;
        myRating: number;
        opponentRating: number;
        myAccepted: boolean;
        peerAccepted: boolean;
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
};

const ROOM_KIND_OPTIONS: { value: RoomKind; label: string; hint: string }[] = [
    { value: 'friendly_4p', label: '4인 친선', hint: '2:2 친선 페어 (매칭 시작은 준비 중일 수 있음)' },
    { value: 'duo_match', label: '2인 페어', hint: '다른 유저 1명과 팀을 이루어 대국' },
    { value: 'ai_duel', label: '펫 페어', hint: '장착한 펫과 팀을 이루어 랭킹 매칭 또는 AI 대전' },
];

/** 로비 시안 프레임과 구분 — 방 안은 바이올렛·인디고 실내 톤 */
const PAIR_ROOM_INTERIOR_SHELL =
    'rounded-2xl border border-violet-400/38 bg-gradient-to-br from-violet-950/90 via-indigo-950/[0.78] to-zinc-950 ' +
    'p-3 shadow-[0_0_40px_-12px_rgba(139,92,246,0.42),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-violet-500/22';
const PAIR_ROOM_INTERIOR_HEADER_RULE = 'border-b border-violet-400/22 pb-3';
const PAIR_ROOM_INTERIOR_TEAM_BOX =
    'rounded-xl border border-violet-400/26 bg-black/45 p-2 shadow-inner ring-1 ring-violet-500/[0.08]';
const PAIR_ROOM_INTERIOR_ACTION_BAR =
    'grid shrink-0 gap-2 rounded-2xl border border-violet-400/32 bg-gradient-to-r from-violet-950/60 via-indigo-950/45 to-zinc-950/85 p-2 ring-1 ring-violet-500/18';

function roomKindLabel(kind: RoomKind | undefined): string {
    if (!kind) return '';
    const o = ROOM_KIND_OPTIONS.find((x) => x.value === kind);
    return o?.label ?? String(kind);
}

/** 서버·구버전 페이로드에서 방 종류 문자열 통일 */
function normalizePairListRoomKind(room: PairRoom): RoomKind | undefined {
    const raw = (room as unknown as { room_kind?: string }).room_kind ?? room.roomKind;
    if (raw === 'friendly_4p' || raw === 'friendly4p') return 'friendly_4p';
    if (raw === 'duo_match' || raw === 'duoMatch') return 'duo_match';
    if (raw === 'ai_duel' || raw === 'aiDuel') return 'ai_duel';
    if (typeof raw === 'string' && ['friendly_4p', 'duo_match', 'ai_duel'].includes(raw)) {
        return raw as RoomKind;
    }
    // roomKind 누락 시 서버 기본 제목 패턴 (PAIR_CREATE_ROOM)
    if (
        (raw === undefined || raw === null || raw === '') &&
        /님의\s*4인\s*페어방/i.test(String(room.title || ''))
    ) {
        return 'friendly_4p';
    }
    return undefined;
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
        rk === 'duo_match' ||
        rk === 'ai_duel'
    ) {
        return false;
    }

    const title = String(room.title || '');
    if (/님의\s*4인\s*페어방/i.test(title)) return true;
    if (/\b4인\s*친선\b/i.test(title) || /\b친선\s*4인\b/i.test(title)) return true;
    return false;
}

function memberKindIsUser(kind: string | undefined): boolean {
    return String(kind || '').toLowerCase() === 'user';
}

function countHumanUsersInPairRoom(room: PairRoom): number {
    const members = [...(room.teamA?.members ?? []), ...(room.teamB?.members ?? [])];
    const userMembers = members.filter((m) => memberKindIsUser(m.kind));
    if (userMembers.length > 0) {
        return new Set(userMembers.map((m) => m.id)).size;
    }
    let n = 1;
    if (room.partnerId && !String(room.partnerId).startsWith('pet-ai-')) n += 1;
    return n;
}

/** 4인 친선: 유저가 착석한 칸 수 (0~4). 서버 `listOccupiedHumans` 우선 */
function friendlyFourOccupiedHumans(room: PairRoom): number {
    if (!pairListIsFriendlyFour(room)) return 0;
    const listed = room.listOccupiedHumans;
    if (typeof listed === 'number' && Number.isFinite(listed) && listed >= 0) {
        return Math.min(4, Math.floor(listed));
    }
    return Math.min(4, countHumanUsersInPairRoom(room));
}

function normalizeRoomNumberInput(raw: string): string {
    return raw.replace(/^#/, '').replace(/\s/g, '').toUpperCase();
}

const PAIR_JOIN_PASSWORD_ERROR = '비밀번호가 일치하지 않습니다.';

type JoinPasswordModal = {
    roomId?: string;
    code?: string;
    roomTitle: string;
};

const PairWaitingLobby: React.FC = () => {
    const { isNativeMobile } = useNativeMobileShell();
    const isHandheld = useIsHandheldDevice(1024);
    const {
        currentUserWithStatus,
        onlineUsers,
        handlers,
        pairRooms,
        pairRoomChatByRoomId,
        negotiations,
        pairInviteCooldownUntilByInviteeId,
        rankedMatchFound,
    } = useAppContext();
    const [joinRoomNumber, setJoinRoomNumber] = useState('');
    const [joinPasswordModal, setJoinPasswordModal] = useState<JoinPasswordModal | null>(null);
    const [joinPasswordDraft, setJoinPasswordDraft] = useState('');
    const [userTab, setUserTab] = useState<'users' | 'friends' | 'guild'>('users');
    const [pairLobbyMobileTab, setPairLobbyMobileTab] = useState<'pet' | 'rooms' | 'users'>('rooms');
    const [isBusy, setIsBusy] = useState(false);

    const [createRoomModalOpen, setCreateRoomModalOpen] = useState(false);
    const [createModalTitle, setCreateModalTitle] = useState('');
    const [createModalRoomKind, setCreateModalRoomKind] = useState<RoomKind>('duo_match');
    const [createModalVisibility, setCreateModalVisibility] = useState<Visibility>('public');
    const [createModalPassword, setCreateModalPassword] = useState('');
    const [partnerInviteModalOpen, setPartnerInviteModalOpen] = useState(false);
    const [partnerInviteTargetSlot, setPartnerInviteTargetSlot] = useState<{ team: 'teamA' | 'teamB'; index: 0 | 1 } | null>(null);
    const [pairMatchSettingsModalOpen, setPairMatchSettingsModalOpen] = useState(false);
    const [pairAiChallengeModalOpen, setPairAiChallengeModalOpen] = useState(false);
    const [localInviteCooldownUntilByInviteeId, setLocalInviteCooldownUntilByInviteeId] = useState<Record<string, number>>({});
    const [cooldownUiTick, setCooldownUiTick] = useState(0);
    /** 뒤로가기 등으로 해시가 바뀐 뒤 복귀시킬 목적지(방 퇴장 확인용) */
    const [pairLeaveNavTargetHash, setPairLeaveNavTargetHash] = useState<string | null>(null);

    useEffect(() => {
        const id = window.setInterval(() => setCooldownUiTick((t) => t + 1), 500);
        return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
        handlers.handleAction({ type: 'PAIR_SET_LOBBY_SCREEN', payload: { active: true } }).catch(() => undefined);
        return () => {
            handlers.handleAction({ type: 'PAIR_SET_LOBBY_SCREEN', payload: { active: false } }).catch(() => undefined);
        };
    }, [handlers]);

    useEffect(() => {
        handlers.handleAction({ type: 'PAIR_SYNC' }).catch(() => undefined);
        handlers.handleAction({ type: 'FRIEND_SYNC' }).catch(() => undefined);
    }, [handlers]);

    const mergedInviteCooldownUntilByInviteeId = useMemo(
        () => ({ ...pairInviteCooldownUntilByInviteeId, ...localInviteCooldownUntilByInviteeId }),
        [pairInviteCooldownUntilByInviteeId, localInviteCooldownUntilByInviteeId, cooldownUiTick]
    );

    const rooms = useMemo(() => Object.values((pairRooms || {}) as Record<string, PairRoom>), [pairRooms]);
    const currentUserId = currentUserWithStatus?.id || '';
    const lobbyTone = 'strategic' as const;

    useEffect(() => {
        if (!rankedMatchFound?.gameId || !currentUserId) return;
        const matched =
            rankedMatchFound.player1?.id === currentUserId ||
            rankedMatchFound.player2?.id === currentUserId;
        if (matched) replaceAppHash(`/game/${rankedMatchFound.gameId}`);
    }, [rankedMatchFound, currentUserId]);

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
    /** 경기 중(in_game) 껍데기 방도 소속 방으로 인정 — 인게임에서 복귀 시 같은 방 UI·중복 입장 방지 유지 */
    const myRoom = useMemo(
        () =>
            rooms.find(
                (r) =>
                    r.ownerId === currentUserId ||
                    r.partnerId === currentUserId ||
                    (r.extraPairMembers ?? []).some((m) => m.id === currentUserId),
            ) || null,
        [rooms, currentUserId],
    );
    /** 방에 참여 중이어도 전체 방 목록에는 그대로 표시한다. (입장 버튼만 비활성 조건으로 제어) */
    const sortedRoomsForPublicList = useMemo(
        () => sortedRooms,
        [sortedRooms],
    );

    const isPairPetRoom = myRoom?.roomKind === 'ai_duel';
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

    useEffect(() => {
        if (!myRoom) {
            setPairLeaveNavTargetHash(null);
            return;
        }
        const pairHash = '#/pair';
        const onHashOrPop = () => {
            const h = window.location.hash || '';
            if (!h || h === pairHash) return;
            setPairLeaveNavTargetHash(h);
            replaceAppHash(pairHash);
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
        if (createRoomModalOpen && createModalRoomKind === 'ai_duel' && !hasEquippedPairPet) {
            setCreateModalRoomKind('duo_match');
        }
    }, [createRoomModalOpen, createModalRoomKind, hasEquippedPairPet]);
    const friendSet = useMemo(() => new Set(currentUserWithStatus?.friendIds || []), [currentUserWithStatus?.friendIds]);
    const guildId = currentUserWithStatus?.guildId;

    const pairUsers = useMemo(() => onlineUsers.filter((u) => (
        u.status === UserStatus.Waiting || u.status === UserStatus.Online || u.status === UserStatus.Resting
    )), [onlineUsers]);

    const displayedUsers = useMemo(() => {
        if (userTab === 'friends') return pairUsers.filter((u) => friendSet.has(u.id));
        if (userTab === 'guild') return pairUsers.filter((u) => guildId && u.guildId === guildId);
        return pairUsers;
    }, [userTab, pairUsers, friendSet, guildId]);

    const openCreateRoomModal = () => {
        if (!currentUserWithStatus) return;
        if (myRoom) return window.alert('이미 참여 중인 방이 있습니다.');
        setCreateModalTitle(clampPairRoomTitle(`${currentUserWithStatus.nickname}님의 페어방`));
        setCreateModalRoomKind('duo_match');
        setCreateModalVisibility('public');
        setCreateModalPassword('');
        setCreateRoomModalOpen(true);
        if (isHandheld) setPairLobbyMobileTab('rooms');
    };

    const applyAction = async (action: any) => {
        setIsBusy(true);
        try {
            const result = await handlers.handleAction(action);
            const error = (result as any)?.error;
            if (error) return window.alert(error);
            const gameId = (result as any)?.gameId || (result as any)?.clientResponse?.gameId;
            if (gameId) window.location.hash = `#/game/${gameId}`;
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

    const submitCreateRoomFromModal = async () => {
        if (!currentUserId) return;
        if (myRoom) return window.alert('이미 참여 중인 방이 있습니다.');
        setIsBusy(true);
        try {
            const result = await handlers.handleAction({
                type: 'PAIR_CREATE_ROOM',
                payload: {
                    roomKind: createModalRoomKind,
                    title: clampPairRoomTitle(createModalTitle) || undefined,
                    visibility: createModalVisibility,
                    password: createModalVisibility === 'private' ? createModalPassword : undefined,
                },
            });
            const error = (result as any)?.error;
            if (error) {
                window.alert(error);
                return;
            }
            const gameId = (result as any)?.gameId || (result as any)?.clientResponse?.gameId;
            if (gameId) window.location.hash = `#/game/${gameId}`;
            setCreateRoomModalOpen(false);
        } finally {
            setIsBusy(false);
        }
    };

    const attemptJoinRoom = async (opts: { roomId?: string; code?: string }) => {
        if (!currentUserId || myRoom) return;
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
            if (gameId) window.location.hash = `#/game/${gameId}`;
        } finally {
            setIsBusy(false);
        }
    };

    const quickJoin = (roomId: string) => {
        void attemptJoinRoom({ roomId });
    };

    const quickParticipate = async () => {
        if (myRoom) return window.alert('이미 참여 중인 방이 있습니다.');
        const target = sortedRooms.find(
            (r) =>
                !r.partnerId &&
                r.ownerId !== currentUserId &&
                r.roomKind !== 'ai_duel' &&
                (r.phase ?? 'waiting') !== 'in_game' &&
                r.phase !== 'matching' &&
                r.phase !== 'match_pending',
        );
        if (!target) return window.alert('빠른참가 가능한 방이 없습니다.');
        void attemptJoinRoom({ roomId: target.id });
    };

    const joinByRoomNumber = () => {
        if (myRoom) return window.alert('이미 참여 중인 방이 있습니다.');
        const normalized = normalizeRoomNumberInput(joinRoomNumber);
        if (!normalized) return window.alert('방 번호를 입력하세요.');
        void attemptJoinRoom({ code: normalized });
    };

    const submitJoinPasswordModal = async () => {
        if (!joinPasswordModal || !currentUserId || myRoom) return;
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
            if (gameId) window.location.hash = `#/game/${gameId}`;
            setJoinPasswordModal(null);
            setJoinPasswordDraft('');
        } finally {
            setIsBusy(false);
        }
    };

    const leaveRoom = async () => applyAction({ type: 'PAIR_LEAVE_ROOM' });
    const cancelPairPetMatching = async () => applyAction({ type: 'PAIR_CANCEL_PAIR_PET_MATCHING' } as ServerAction);
    const respondPairPetRankedMatch = async (accept: boolean) => {
        const p = myRoom?.pairRankedPetProposal;
        if (!p) return;
        await applyAction({
            type: 'PAIR_RESPOND_PAIR_PET_RANKED_MATCH',
            payload: { proposalId: p.proposalId, accept },
        } as ServerAction);
    };

    const confirmPairLeaveNav = async () => {
        const dest = pairLeaveNavTargetHash;
        setPairLeaveNavTargetHash(null);
        if (!dest) return;
        setIsBusy(true);
        try {
            const result = await handlers.handleAction({ type: 'PAIR_LEAVE_ROOM' });
            const error = (result as { error?: string } | undefined)?.error;
            if (error) {
                window.alert(error);
                return;
            }
            window.location.hash = dest.startsWith('#') ? dest : `#${dest}`;
        } finally {
            setIsBusy(false);
        }
    };

    const cancelPairLeaveNav = () => setPairLeaveNavTargetHash(null);
    const setReady = async (ready: boolean) => applyAction({ type: 'PAIR_SET_READY', payload: { ready } });
    const startMatch = () => setPairMatchSettingsModalOpen(true);
    const openPairAiMatchSettings = () => setPairAiChallengeModalOpen(true);
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
    const transformPairAiSettings = useCallback((_mode: GameMode, raw: GameSettings): GameSettings => {
        const next: GameSettings = {
            ...raw,
            timeLimit: 0,
            byoyomiTime: 0,
            byoyomiCount: 0,
            timeIncrement: 0,
            scoringTurnLimit: 0,
        };
        delete (next as any).autoScoringTurns;
        return next;
    }, []);
    const applyRoomKindNow = async (roomKind: RoomKind) => {
        const room = myRoom;
        if (!room || room.ownerId !== currentUserId) return;
        if (roomKind === room.roomKind) return;
        await applyAction({ type: 'PAIR_SET_ROOM_KIND', payload: { roomKind } });
    };

    const sendPairRoomChat = async (payload: { text: string; scope: PairRoomChatScope }) => {
        const room = myRoom;
        if (!room || !currentUserId) return;
        const result = await handlers.handleAction({
            type: 'PAIR_SEND_ROOM_CHAT',
            payload: { roomId: room.id, text: payload.text, scope: payload.scope },
        });
        const error = (result as any)?.error;
        if (error) window.alert(error);
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
        if (!u?.equippedPairPetTemplateId) return { name: null as string | null, level: null as number | null };
        const row = getEquippedPairPetInventoryRow(u);
        if (!row) {
            return {
                name: getPairPetDefinition(u.equippedPairPetTemplateId)?.displayName ?? '내 펫',
                level: null,
            };
        }
        const meta = resolvePairPetMetaFromInventoryRow(row);
        return {
            name: getPairPetDisplayName(row),
            level: Math.max(1, Math.floor(meta.level) || 1),
        };
    }, [currentUserWithStatus]);

    if (!currentUserWithStatus) return <div className="flex h-full items-center justify-center">로딩 중...</div>;

    const isOwner = myRoom?.ownerId === currentUserId;
    const isPartner = myRoom?.partnerId === currentUserId;
    const extraMemberForMe = myRoom?.extraPairMembers?.find((m) => m.id === currentUserId);
    const isExtraPairMember = Boolean(extraMemberForMe);
    const currentUserPairReady = isPartner ? Boolean(myRoom?.partnerReady) : Boolean(extraMemberForMe?.ready);
    const isDuoPairRoom = myRoom?.roomKind === 'duo_match';
    const petPairOpponent = isPairPetRoom ? myRoom?.extraPairMembers?.[0] : undefined;
    const duoPairAiPartnerReady = Boolean(
        isDuoPairRoom &&
            ((myRoom?.partnerId && !String(myRoom.partnerId).startsWith('pet-ai-') && myRoom.partnerReady) ||
                (myRoom?.extraPairMembers ?? []).some((m) => m.ready)),
    );
    const pairRoomHumanCount = myRoom ? countHumanUsersInPairRoom(myRoom) : 0;
    const friendlyTooCrowdedForModeShrink = Boolean(myRoom?.roomKind === 'friendly_4p' && pairRoomHumanCount >= 3);
    const canStart = Boolean(
        myRoom &&
        isOwner &&
        !isPairRoomMatching &&
        !isPairRoomMatchPending &&
        myRoom.roomKind !== 'friendly_4p' &&
        (isPairPetRoom ? (!petPairOpponent || petPairOpponent.ready) : myRoom.partnerReady),
    );
    const canStartAiMatch = Boolean(
        myRoom &&
        isOwner &&
        ((isPairPetRoom && !petPairOpponent) || duoPairAiPartnerReady) &&
        !isPairRoomMatching &&
        !isPairRoomMatchPending,
    );
    const showReadyButton = Boolean(myRoom && !isOwner && (isPartner || isExtraPairMember));
    const roomActionButtonCount =
        (showReadyButton ? 1 : 0) +
        1 +
        (isPairPetRoom || isDuoPairRoom ? 1 : 0) +
        1;
    const roomActionGridClass =
        roomActionButtonCount >= 4
            ? 'grid-cols-4'
            : roomActionButtonCount === 3
              ? 'grid-cols-3'
              : 'grid-cols-2';

    const seatTeamAMembers = useMemo((): PairSeatMember[] | undefined => {
        if (!myRoom?.teamA?.members?.length) return undefined;
        return myRoom.teamA.members.map((m) => ({
            id: m.id,
            name: m.name,
            kind: m.kind,
            ready: m.ready,
            ...(m.id === `pet-ai-${currentUserId}` && viewerEquippedPairPetInfo.name
                ? {
                      name: viewerEquippedPairPetInfo.name,
                      subLabel: viewerEquippedPairPetInfo.level ? `Lv.${viewerEquippedPairPetInfo.level}` : '장착 펫',
                      portraitSrc: viewerEquippedPairPetPortraitSrc,
                  }
                : {}),
        }));
    }, [currentUserId, myRoom?.id, myRoom?.teamA?.members, viewerEquippedPairPetInfo, viewerEquippedPairPetPortraitSrc]);

    const seatTeamBMembers = useMemo((): PairSeatMember[] | undefined => {
        if (myRoom?.roomKind === 'ai_duel') {
            const opponent = myRoom.extraPairMembers?.[0];
            return opponent
                ? [
                      { id: opponent.id, name: opponent.name, kind: 'user', ready: opponent.ready },
                      { id: `pet-ai-${opponent.id}`, name: `${opponent.name}의 펫`, kind: 'pet', ready: true },
                  ]
                : undefined;
        }
        if (!myRoom?.teamB?.members?.length) return undefined;
        return myRoom.teamB.members
            .filter((m) => !String(m.id).startsWith('pair-opponent-'))
            .map((m) => ({
                id: m.id,
                name: m.name,
                kind: m.kind,
                ready: m.ready,
            }));
    }, [myRoom?.id, myRoom?.roomKind, myRoom?.extraPairMembers, myRoom?.teamB?.members]);

    const openViewerEquippedPairPetDetail = useCallback(() => {
        const u = currentUserWithStatus;
        if (!u?.equippedPairPetTemplateId) return;
        const row = getEquippedPairPetInventoryRow(u);
        if (row) handlers.openPairPetDetailModal(row, 'view');
    }, [currentUserWithStatus, handlers]);

    const userListPanel = (
        <>
            <div className="grid shrink-0 grid-cols-3 gap-1 border-b border-white/10 bg-black/25 p-1">
                <button type="button" onClick={() => setUserTab('users')} className={`rounded-lg px-2 py-1 text-xs font-bold ${userTab === 'users' ? 'bg-cyan-500 text-cyan-950' : 'text-cyan-100 hover:bg-cyan-950/45'}`}>전체</button>
                <button type="button" onClick={() => setUserTab('friends')} className={`rounded-lg px-2 py-1 text-xs font-bold ${userTab === 'friends' ? 'bg-violet-500 text-violet-950' : 'text-violet-100 hover:bg-violet-950/45'}`}>친구</button>
                <button type="button" onClick={() => setUserTab('guild')} className={`rounded-lg px-2 py-1 text-xs font-bold ${userTab === 'guild' ? 'bg-amber-500 text-amber-950' : 'text-amber-100 hover:bg-amber-950/45'}`}>길드원</button>
            </div>
            <PlayerList
                users={displayedUsers}
                mode="pair"
                onAction={handlers.handleAction}
                currentUser={currentUserWithStatus}
                negotiations={Object.values(negotiations || {})}
                onViewUser={handlers.openViewingUser}
                lobbyType="strategic"
                userCount={displayedUsers.length}
                disableStatusSelect={Boolean(myRoom)}
            />
        </>
    );

    const renderPairLobbyCenterColumn = () => (
                <div className={waitingLobbyPcCenterColumnClass(lobbyTone)}>
                    <div className={waitingLobbyPcPanelTopHairlineClassFor(lobbyTone)} aria-hidden />
                    {myRoom ? (
                        <div className={`flex min-h-0 shrink-0 flex-col gap-3 ${PAIR_ROOM_INTERIOR_SHELL}`}>
                            <div className={`flex flex-col gap-2 ${PAIR_ROOM_INTERIOR_HEADER_RULE}`}>
                                <div
                                    className={`flex w-full flex-nowrap items-center justify-between gap-x-2 ${
                                        isPairPetRoom ? 'min-h-[3.5rem] sm:min-h-16' : ''
                                    }`}
                                >
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-nowrap items-center gap-x-2 overflow-hidden">
                                        <span className="shrink-0 font-mono text-sm font-extrabold tabular-nums text-amber-200/95 drop-shadow-[0_0_10px_rgba(251,191,36,0.18)]">
                                            #{myRoom.code}
                                        </span>
                                        <span
                                            className="min-w-0 truncate bg-gradient-to-r from-violet-50 to-indigo-100 bg-clip-text text-sm font-extrabold text-transparent"
                                            title={myRoom.title}
                                        >
                                            {myRoom.title}
                                        </span>
                                        <span
                                            className={`shrink-0 rounded-lg border px-2 py-1 text-[11px] font-extrabold sm:text-xs ${
                                                myRoom.visibility === 'private'
                                                    ? 'border-violet-400/45 bg-violet-950/55 text-violet-100'
                                                    : 'border-emerald-400/40 bg-emerald-950/45 text-emerald-100'
                                            }`}
                                        >
                                            {myRoom.visibility === 'private' ? '비공개' : '공개'}
                                            {myRoom.passwordProtected ? ' · 암호' : ''}
                                        </span>
                                    </div>
                                    {isPairPetRoom ? (
                                        <div
                                            className={`pointer-events-none flex shrink-0 items-center gap-2 rounded-xl border-2 px-2.5 py-1.5 sm:gap-2.5 sm:px-3 sm:py-2 ${
                                                isPairRoomMatching
                                                    ? 'pointer-events-auto border-yellow-500/55 bg-gradient-to-br from-yellow-900/45 via-amber-900/35 to-yellow-900/45 shadow-[0_4px_20px_rgba(234,179,8,0.25)]'
                                                    : 'border-transparent bg-transparent shadow-none'
                                            }`}
                                            aria-hidden={!isPairRoomMatching}
                                        >
                                            {isPairRoomMatching ? (
                                                <>
                                                    <div className="relative h-9 w-9 shrink-0 sm:h-10 sm:w-10">
                                                        <div className="absolute inset-0 rounded-full border-[3px] border-yellow-400 border-t-transparent animate-spin sm:border-4" />
                                                        <div
                                                            className="absolute inset-1.5 rounded-full border-[3px] border-amber-400 border-t-transparent animate-spin sm:inset-2 sm:border-4"
                                                            style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
                                                        />
                                                    </div>
                                                    <div className="min-w-0 text-right">
                                                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-yellow-200/95 sm:text-xs">
                                                            매칭중
                                                        </p>
                                                        <p className="font-mono text-xs font-bold tabular-nums text-yellow-50 sm:text-sm">
                                                            {formatElapsedHhMmSs(matchElapsedSec)}
                                                        </p>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex items-center gap-2 opacity-0" aria-hidden>
                                                    <div className="relative h-9 w-9 shrink-0 sm:h-10 sm:w-10" />
                                                    <div className="min-w-0 text-right">
                                                        <p className="text-[10px] font-extrabold uppercase tracking-wide sm:text-xs">매칭중</p>
                                                        <p className="font-mono text-xs font-bold tabular-nums sm:text-sm">00:00:00</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {ROOM_KIND_OPTIONS.map((o) => {
                                        const isCurrent = myRoom.roomKind === o.value;
                                        const blockDuoOrPet =
                                            friendlyTooCrowdedForModeShrink && (o.value === 'duo_match' || o.value === 'ai_duel');
                                        const hasRealHumanPartner = Boolean(
                                            myRoom.partnerId && !String(myRoom.partnerId).startsWith('pet-ai-'),
                                        );
                                        const canSwitchToPetPairInRoom =
                                            hasEquippedPairPet &&
                                            isOwner &&
                                            !hasRealHumanPartner &&
                                            pairRoomHumanCount === 1;
                                        const blockPetFromNonPet =
                                            o.value === 'ai_duel' && myRoom.roomKind !== 'ai_duel' && !canSwitchToPetPairInRoom;
                                        const disabled =
                                            !isOwner || isBusy || isCurrent || blockDuoOrPet || blockPetFromNonPet;
                                        const hintTitle = blockDuoOrPet
                                            ? '4인 친선에 유저가 3명 이상이면 2인 페어·펫 페어로 변경할 수 없습니다.'
                                            : blockPetFromNonPet
                                              ? '펫 페어로 바꾸려면 페어 펫을 장착하고, 방에 본인만 있어야 합니다.'
                                              : o.hint;
                                        return (
                                            <button
                                                key={o.value}
                                                type="button"
                                                disabled={disabled}
                                                title={!isOwner ? undefined : hintTitle}
                                                onClick={() => void applyRoomKindNow(o.value)}
                                                className={`min-w-0 shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-extrabold transition sm:px-3 sm:text-xs ${
                                                    isCurrent
                                                        ? 'border-amber-400/75 bg-amber-950/60 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_0_20px_-8px_rgba(251,191,36,0.25)]'
                                                        : 'border-violet-400/22 bg-violet-950/35 text-violet-100/90 hover:border-violet-300/48 hover:bg-violet-900/40 hover:text-white'
                                                } disabled:pointer-events-none ${isOwner ? 'disabled:opacity-45' : isCurrent ? 'disabled:!opacity-100' : 'disabled:opacity-40'}`}
                                            >
                                                {o.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className={`min-h-0 shrink-0 ${PAIR_ROOM_INTERIOR_TEAM_BOX}`}>
                                <PairRoomSeatGrid
                                    roomKind={myRoom.roomKind}
                                    ownerId={myRoom.ownerId}
                                    ownerName={myRoom.ownerName}
                                    partnerId={myRoom.partnerId}
                                    partnerName={myRoom.partnerName}
                                    ownerReady={myRoom.ownerReady}
                                    partnerReady={myRoom.partnerReady}
                                    teamAMembers={seatTeamAMembers}
                                    teamBMembers={seatTeamBMembers}
                                    viewerId={currentUserId}
                                    viewerEquippedPairPetPortraitSrc={viewerEquippedPairPetPortraitSrc}
                                    viewerEquippedPairPetName={viewerEquippedPairPetInfo.name}
                                    viewerEquippedPairPetLevel={viewerEquippedPairPetInfo.level}
                                    onViewSeatUserProfile={(userId) => {
                                        if (!userId || userId.startsWith('pet-ai-')) return;
                                        handlers.openViewingUser(userId);
                                    }}
                                    onViewOwnerEquippedPetDetail={openViewerEquippedPairPetDetail}
                                    onInvitePartnerSlot={
                                        isOwner && myRoom.roomKind === 'duo_match'
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
                                            myRoom.roomKind === 'ai_duel')
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
                                />
                            </div>
                            <div className="min-h-0 shrink-0">
                                <PairRoomChatPanel
                                    roomId={myRoom.id}
                                    messages={pairRoomChatByRoomId[myRoom.id] || []}
                                    currentUserId={currentUserId}
                                    disabled={isBusy}
                                    variant="interior"
                                    onSend={sendPairRoomChat}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="relative flex min-h-[2.25rem] shrink-0 items-center overflow-hidden rounded-2xl border border-cyan-300/25 bg-gradient-to-r from-slate-950 via-cyan-950/45 to-slate-950 px-3 py-1.5">
                            <div className="relative w-full text-center text-xs font-extrabold leading-snug text-cyan-50 sm:text-sm">방만들기에서 종류를 고르면 그에 맞는 페어 방이 열립니다.</div>
                        </div>
                    )}
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-2">
                        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-dashed border-white/15 bg-black/20 p-2">
                            <div className="flex flex-wrap justify-center gap-3">
                                {sortedRoomsForPublicList.map((room) => {
                                    const listRoomKind =
                                        normalizePairListRoomKind(room) ??
                                        (pairListIsFriendlyFour(room) ? ('friendly_4p' as RoomKind) : room.roomKind);
                                    const roomInMatch =
                                        (room.phase ?? 'waiting') === 'in_game' || room.phase === 'match_pending';
                                    const aiDuelJoinable =
                                        listRoomKind === 'ai_duel' &&
                                        room.ownerId !== currentUserId &&
                                        !myRoom &&
                                        !roomInMatch &&
                                        hasUsablePairPetForJoin &&
                                        countHumanUsersInPairRoom(room) < 2;
                                    const joinable =
                                        aiDuelJoinable ||
                                        (!room.partnerId &&
                                            room.ownerId !== currentUserId &&
                                            !myRoom &&
                                            listRoomKind !== 'ai_duel' &&
                                            !roomInMatch);
                                    const occupiedHumans = friendlyFourOccupiedHumans(room);
                                    const showFriendlySlots = pairListIsFriendlyFour(room);
                                    const visibilityBadge =
                                        room.visibility === 'private'
                                            ? 'border-violet-400/40 bg-violet-950/55 text-violet-100'
                                            : 'border-emerald-400/35 bg-emerald-950/40 text-emerald-100';
                                    return (
                                        <div
                                            key={room.id}
                                            className="flex w-[14.25rem] shrink-0 flex-col gap-2 rounded-xl border border-white/12 bg-black/35 p-2.5 text-xs shadow-sm sm:w-[15rem] sm:gap-2.5 sm:p-3"
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2 sm:gap-y-0.5">
                                                    <span className="shrink-0 font-mono text-xs font-extrabold tabular-nums text-amber-200">
                                                        #{room.code}
                                                    </span>
                                                    <span className="min-w-0 w-full whitespace-normal break-words text-[13px] font-extrabold leading-snug text-white sm:text-sm">
                                                        {room.title}
                                                    </span>
                                                </div>
                                                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                                                    {roomInMatch ? (
                                                        <span className="rounded-md border border-cyan-400/40 bg-cyan-950/70 px-1.5 py-0.5 text-[10px] font-extrabold text-cyan-100">
                                                            경기중
                                                        </span>
                                                    ) : null}
                                                    <span
                                                        className={`rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold ${visibilityBadge}`}
                                                    >
                                                        {room.visibility === 'private' ? '비공개' : '공개'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-[11px] leading-snug text-slate-300">
                                                <span className="font-bold text-violet-200/95">{roomKindLabel(listRoomKind)}</span>
                                                <span className="mx-1 text-slate-600">·</span>
                                                <span className="text-slate-400">방장</span>{' '}
                                                <span className="font-bold text-slate-100">{room.ownerName}</span>
                                            </div>
                                            {showFriendlySlots ? (
                                                <div
                                                    className="flex w-full select-none items-center justify-center gap-1.5 rounded-lg border border-white/25 bg-black/55 px-1 py-2 shadow-inner ring-1 ring-white/10"
                                                    role="img"
                                                    aria-label={`유저 착석 ${occupiedHumans}명, 빈 자리 ${4 - occupiedHumans}`}
                                                >
                                                    {[0, 1, 2, 3].map((i) =>
                                                        i < occupiedHumans ? (
                                                            <div
                                                                key={i}
                                                                className="h-6 w-6 shrink-0 rounded border-2 border-emerald-400/90 bg-emerald-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] sm:h-7 sm:w-7"
                                                                aria-hidden
                                                            />
                                                        ) : (
                                                            <div
                                                                key={i}
                                                                className="h-6 w-6 shrink-0 rounded border-2 border-zinc-400 bg-transparent shadow-none sm:h-7 sm:w-7"
                                                                aria-hidden
                                                            />
                                                        ),
                                                    )}
                                                </div>
                                            ) : null}
                                            <button
                                                type="button"
                                                disabled={!joinable || isBusy}
                                                onClick={() => quickJoin(room.id)}
                                                className={`mt-auto rounded-lg border px-2 py-1.5 text-[11px] font-extrabold sm:text-xs ${joinable ? 'border-cyan-300/55 bg-cyan-900/45 text-cyan-100' : 'border-zinc-700 bg-zinc-900/60 text-zinc-500'}`}
                                            >
                                                입장
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="mt-2 shrink-0 border-t border-white/[0.08] pt-2">
                            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
                                <Button
                                    bare
                                    type="button"
                                    disabled={isBusy || Boolean(myRoom)}
                                    onClick={openCreateRoomModal}
                                    className="min-w-0 shrink-0 rounded-md border border-emerald-400/30 bg-gradient-to-b from-emerald-800/40 via-emerald-950/70 to-black/80 px-4 py-2 text-[11px] font-semibold tracking-wide text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_8px_24px_-8px_rgba(16,185,129,0.35)] ring-1 ring-emerald-500/15 transition hover:border-emerald-300/45 hover:from-emerald-700/45 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_28px_-6px_rgba(52,211,153,0.28)] disabled:pointer-events-none disabled:opacity-45 sm:px-5 sm:text-xs"
                                >
                                    방만들기
                                </Button>
                                <Button
                                    bare
                                    type="button"
                                    disabled={isBusy || Boolean(myRoom)}
                                    onClick={() => void quickParticipate()}
                                    className="min-w-0 shrink-0 rounded-md border border-cyan-400/28 bg-gradient-to-b from-cyan-900/35 via-slate-950/80 to-black/80 px-4 py-2 text-[11px] font-semibold tracking-wide text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_24px_-8px_rgba(34,211,238,0.28)] ring-1 ring-cyan-400/12 transition hover:border-cyan-300/42 hover:from-cyan-800/40 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_10px_28px_-6px_rgba(34,211,238,0.22)] disabled:pointer-events-none disabled:opacity-45 sm:px-5 sm:text-xs"
                                >
                                    빠른참가
                                </Button>
                                <div className="flex min-w-0 max-w-full items-stretch gap-1 rounded-md border border-amber-400/25 bg-black/40 py-0.5 pl-2 pr-0.5 shadow-inner ring-1 ring-amber-500/10">
                                    <input
                                        value={joinRoomNumber}
                                        onChange={(e) => setJoinRoomNumber(normalizeRoomNumberInput(e.target.value))}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !isBusy && !myRoom) joinByRoomNumber();
                                        }}
                                        placeholder="방 번호"
                                        maxLength={12}
                                        disabled={Boolean(myRoom)}
                                        className="w-[6.5rem] shrink-0 border-0 bg-transparent py-1.5 text-center text-[11px] font-mono font-semibold tracking-wider text-amber-100 outline-none placeholder:text-amber-200/35 sm:w-[7.5rem] sm:text-xs"
                                    />
                                    <button
                                        type="button"
                                        disabled={isBusy || Boolean(myRoom)}
                                        onClick={() => joinByRoomNumber()}
                                        className="shrink-0 rounded border border-amber-400/40 bg-gradient-to-b from-amber-900/50 to-amber-950/80 px-2.5 py-1 text-[11px] font-bold text-amber-50 transition hover:border-amber-300/55 disabled:pointer-events-none disabled:opacity-45 sm:px-3 sm:text-xs"
                                    >
                                        입장
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    {myRoom && (
                        <div className={`${PAIR_ROOM_INTERIOR_ACTION_BAR} ${roomActionGridClass}`}>
                            {showReadyButton && (
                                <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => setReady(!currentUserPairReady)}
                                    className="rounded-xl border border-emerald-400/50 bg-emerald-950/55 px-3 py-2 text-sm font-extrabold text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-emerald-300/55 hover:bg-emerald-900/50 disabled:pointer-events-none disabled:opacity-45"
                                >
                                    준비
                                </button>
                            )}
                            {isPairPetRoom && isPairRoomMatching && isOwner ? (
                                <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void cancelPairPetMatching()}
                                    className="rounded-xl border border-rose-400/50 bg-rose-950/55 px-3 py-2 text-sm font-extrabold text-rose-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-rose-300/55 hover:bg-rose-900/50 disabled:pointer-events-none disabled:opacity-45"
                                >
                                    매칭 취소
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled={isBusy || !canStart}
                                    onClick={startMatch}
                                    className="rounded-xl border border-indigo-400/50 bg-indigo-950/55 px-3 py-2 text-sm font-extrabold text-indigo-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-indigo-300/55 hover:bg-indigo-900/50 disabled:pointer-events-none disabled:opacity-45"
                                >
                                    매칭 시작
                                </button>
                            )}
                            {(isPairPetRoom || isDuoPairRoom) && (
                                <button
                                    type="button"
                                    disabled={isBusy || !canStartAiMatch}
                                    onClick={openPairAiMatchSettings}
                                    className="rounded-xl border border-fuchsia-400/50 bg-fuchsia-950/55 px-3 py-2 text-sm font-extrabold text-fuchsia-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-fuchsia-300/55 hover:bg-fuchsia-900/50 disabled:pointer-events-none disabled:opacity-45"
                                >
                                    AI 대전
                                </button>
                            )}
                            <button
                                type="button"
                                disabled={isBusy}
                                onClick={leaveRoom}
                                className="rounded-xl border border-rose-400/50 bg-rose-950/45 px-3 py-2 text-sm font-extrabold text-rose-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-rose-300/50 hover:bg-rose-900/45 disabled:pointer-events-none disabled:opacity-45"
                            >
                                방 나가기
                            </button>
                        </div>
                    )}
                </div>
    );

    return (
        <div
            className={`bg-lobby-shell-strategic text-primary flex h-full min-h-0 w-full flex-1 flex-col ${
                isHandheld
                    ? 'min-h-0 gap-2 overflow-hidden px-2 pb-2 pt-2'
                    : isNativeMobile
                      ? 'gap-2 overflow-y-auto px-2 pb-2 pt-2'
                      : 'px-3 pb-3 pt-3'
            }`}
        >
            {createRoomModalOpen && (
                <div
                    className={`fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm ${
                        isHandheld ? 'flex flex-col justify-end p-0 sm:p-3 sm:justify-center' : 'flex items-center justify-center p-3'
                    }`}
                    role="presentation"
                    onClick={() => !isBusy && setCreateRoomModalOpen(false)}
                >
                    <div
                        className={`relative flex w-full flex-col border border-amber-400/40 bg-gradient-to-b from-zinc-900 to-black shadow-2xl shadow-black/60 ring-1 ring-white/10 ${
                            isHandheld
                                ? 'max-h-[min(92dvh,720px)] rounded-t-2xl border-b-0 sm:max-h-none sm:rounded-2xl sm:border-b'
                                : 'max-h-[90vh] max-w-md overflow-hidden rounded-2xl'
                        }`}
                        role="dialog"
                        aria-modal
                        aria-labelledby="pair-create-room-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 ${isHandheld ? 'pb-2' : 'pb-4'}`}
                        >
                            <h2 id="pair-create-room-title" className="text-center text-base font-extrabold text-amber-100">
                                페어 방 만들기
                            </h2>
                            <p className="mt-1 text-center text-sm text-amber-200/75">방 종류에 따라 매칭·입장 방식이 달라집니다.</p>

                            <label className="mt-4 block text-xs font-bold text-cyan-100">
                                방 이름 <span className="font-semibold text-slate-400">(최대 {PAIR_ROOM_TITLE_MAX_CHARS}자)</span>
                            </label>
                            <input
                                value={createModalTitle}
                                onChange={(e) => setCreateModalTitle(clampPairRoomTitle(e.target.value))}
                                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none ring-0 focus:border-cyan-400/50"
                                placeholder="방 이름"
                                maxLength={PAIR_ROOM_TITLE_MAX_CHARS}
                                autoComplete="off"
                            />
                            <p className="mt-1 text-right text-[10px] font-semibold text-slate-500">
                                {[...createModalTitle].length}/{PAIR_ROOM_TITLE_MAX_CHARS}
                            </p>

                            <div className="mt-4 text-xs font-bold text-cyan-100">방 종류</div>
                            <div className="mt-2 flex flex-col gap-2">
                                {ROOM_KIND_OPTIONS.map((opt) => {
                                    const petPairLocked = opt.value === 'ai_duel' && !hasEquippedPairPet;
                                    const sel = createModalRoomKind === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            disabled={petPairLocked}
                                            onClick={() => {
                                                if (petPairLocked) {
                                                    window.alert('펫 페어 방을 만들려면 페어 펫을 장착해야 합니다.');
                                                    return;
                                                }
                                                setCreateModalRoomKind(opt.value);
                                            }}
                                            className={`rounded-xl border px-3 py-2.5 text-left transition ${
                                                petPairLocked
                                                    ? 'cursor-not-allowed border-white/5 bg-zinc-950/60 opacity-50'
                                                    : sel
                                                      ? 'border-cyan-400/60 bg-cyan-950/50 ring-1 ring-cyan-300/25'
                                                      : 'border-white/10 bg-black/30 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="text-sm font-extrabold text-white">{opt.label}</div>
                                            <div className="mt-0.5 text-sm text-slate-400">
                                                {petPairLocked ? '페어 펫 장착 후 선택할 수 있습니다.' : opt.hint}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <select
                                    value={createModalVisibility}
                                    onChange={(e) => setCreateModalVisibility(e.target.value as Visibility)}
                                    className="rounded-xl border border-white/15 bg-black/35 px-2 py-2 text-xs text-slate-100"
                                >
                                    <option value="public">공개방</option>
                                    <option value="private">비공개방</option>
                                </select>
                                <input
                                    value={createModalPassword}
                                    onChange={(e) => setCreateModalPassword(e.target.value)}
                                    disabled={createModalVisibility !== 'private'}
                                    placeholder="비밀번호 (2자 이상)"
                                    className="rounded-xl border border-white/15 bg-black/35 px-2 py-2 text-xs text-slate-100 disabled:opacity-45"
                                />
                            </div>
                        </div>

                        <div
                            className={`grid shrink-0 grid-cols-2 gap-2 border-t border-white/10 bg-black/50 px-4 pt-3 ${
                                isHandheld ? 'pb-[max(0.75rem,env(safe-area-inset-bottom))]' : 'pb-4'
                            }`}
                        >
                            <Button
                                type="button"
                                disabled={isBusy}
                                onClick={() => setCreateRoomModalOpen(false)}
                                colorScheme="none"
                                className="!justify-center rounded-xl border border-white/20 bg-zinc-800/60 !py-2.5 !text-sm !font-bold !text-zinc-200"
                            >
                                취소
                            </Button>
                            <Button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void submitCreateRoomFromModal()}
                                colorScheme="none"
                                className="!justify-center rounded-xl border border-emerald-400/50 bg-emerald-900/55 !py-2.5 !text-sm !font-extrabold !text-emerald-50"
                            >
                                만들기
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

            {myRoom?.pairRankedPetProposal && (
                <PairPetRankedMatchOfferModal
                    proposal={myRoom.pairRankedPetProposal}
                    isBusy={isBusy}
                    onAccept={() => void respondPairPetRankedMatch(true)}
                    onReject={() => void respondPairPetRankedMatch(false)}
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
                    negotiations={Object.values(negotiations || {})}
                    onViewUser={handlers.openViewingUser}
                    inviteTargetSlot={partnerInviteTargetSlot}
                />
            )}

            {pairLeaveNavTargetHash && (
                <div
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
                    role="presentation"
                    onClick={() => !isBusy && cancelPairLeaveNav()}
                >
                    <div
                        className="w-full max-w-sm rounded-2xl border border-amber-400/40 bg-gradient-to-b from-zinc-900 to-black p-5 shadow-2xl ring-1 ring-white/10"
                        role="dialog"
                        aria-modal
                        aria-labelledby="pair-leave-nav-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 id="pair-leave-nav-title" className="text-center text-base font-extrabold text-amber-100">
                            페어 경기장
                        </h2>
                        <p className="mt-3 text-center text-sm leading-relaxed text-slate-200">
                            참여한 방에서 나가집니다. 계속하시겠습니까?
                        </p>
                        <div className="mt-5 grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                bare
                                disabled={isBusy}
                                onClick={cancelPairLeaveNav}
                                className="rounded-xl border border-white/20 bg-zinc-800/70 py-2.5 text-sm font-bold text-zinc-200"
                            >
                                취소
                            </Button>
                            <Button
                                type="button"
                                bare
                                disabled={isBusy}
                                onClick={() => void confirmPairLeaveNav()}
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
                    <QuickAccessSidebar mobileHeaderStrip className="shrink-0 z-[15]" />
                    <div className="flex w-full shrink-0 items-center gap-2 rounded-xl border border-cyan-400/45 bg-black/25 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
                        <button
                            type="button"
                            onClick={() => {
                                window.location.hash = '#/profile';
                            }}
                            className="relative z-[1] shrink-0 transition-transform active:scale-90 hover:drop-shadow-lg"
                            aria-label="뒤로가기"
                        >
                            <img src="/images/button/back.png" alt="" className="h-9 w-9 sm:h-10 sm:w-10" />
                        </button>
                        <h1 className="relative z-[1] min-w-0 flex-1 truncate text-left text-base font-bold sm:text-lg lg:text-xl bg-gradient-to-r from-cyan-100 via-sky-100 to-cyan-200 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(34,211,238,0.22)]">
                            페어 경기장
                        </h1>
                    </div>
                    <div className="grid shrink-0 grid-cols-3 gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
                        <button
                            type="button"
                            onClick={() => setPairLobbyMobileTab('pet')}
                            className={`rounded-lg px-2 py-2 text-xs font-extrabold ${
                                pairLobbyMobileTab === 'pet'
                                    ? 'bg-cyan-500 text-cyan-950'
                                    : 'text-cyan-100 hover:bg-cyan-950/45'
                            }`}
                        >
                            펫
                        </button>
                        <button
                            type="button"
                            onClick={() => setPairLobbyMobileTab('rooms')}
                            className={`rounded-lg px-2 py-2 text-xs font-extrabold ${
                                pairLobbyMobileTab === 'rooms'
                                    ? 'bg-violet-500 text-violet-950'
                                    : 'text-violet-100 hover:bg-violet-950/45'
                            }`}
                        >
                            방목록
                        </button>
                        <button
                            type="button"
                            onClick={() => setPairLobbyMobileTab('users')}
                            className={`rounded-lg px-2 py-2 text-xs font-extrabold ${
                                pairLobbyMobileTab === 'users'
                                    ? 'bg-amber-500 text-amber-950'
                                    : 'text-amber-100 hover:bg-amber-950/45'
                            }`}
                        >
                            유저목록
                        </button>
                    </div>
                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                        {pairLobbyMobileTab === 'pet' ? (
                            <div
                                className={`${waitingLobbyPcPanelShellClass('playful')} mx-0 flex min-h-0 flex-1 flex-col overflow-hidden p-2`}
                            >
                                <PairPetLobbyPanel
                                    currentUser={currentUserWithStatus}
                                    currentUserId={currentUserId}
                                    isBusy={isBusy}
                                    applyPetAction={applyPetAction}
                                />
                            </div>
                        ) : pairLobbyMobileTab === 'rooms' ? (
                            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-0.5">
                                {renderPairLobbyCenterColumn()}
                            </div>
                        ) : (
                            <div
                                className={`${waitingLobbyPcPanelShellClass(lobbyTone)} flex min-h-0 flex-1 flex-col overflow-hidden`}
                            >
                                {userListPanel}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex h-full min-h-0 w-full flex-1 flex-row gap-2 overflow-hidden">
                    <div className="flex h-full min-h-0 w-[min(43%,500px)] min-w-[292px] max-w-[500px] shrink-0 flex-col gap-2 overflow-hidden">
                        <div className="flex w-full shrink-0 items-center gap-2 rounded-xl border border-cyan-400/45 bg-black/25 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:gap-2.5 sm:p-2">
                            <button
                                type="button"
                                onClick={() => {
                                    window.location.hash = '#/profile';
                                }}
                                className="relative z-[1] shrink-0 transition-transform active:scale-90 hover:drop-shadow-lg"
                                aria-label="뒤로가기"
                            >
                                <img src="/images/button/back.png" alt="" className="h-9 w-9 sm:h-10 sm:w-10" />
                            </button>
                            <h1 className="relative z-[1] min-w-0 flex-1 truncate text-left text-base font-bold sm:text-lg lg:text-xl bg-gradient-to-r from-cyan-100 via-sky-100 to-cyan-200 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(34,211,238,0.22)]">
                                페어 경기장
                            </h1>
                        </div>
                        <div className={`${waitingLobbyPcPanelShellClass('playful')} flex min-h-0 flex-1 flex-col overflow-hidden p-3`}>
                            <PairPetLobbyPanel
                                currentUser={currentUserWithStatus}
                                currentUserId={currentUserId}
                                isBusy={isBusy}
                                applyPetAction={applyPetAction}
                            />
                        </div>
                    </div>
                    {renderPairLobbyCenterColumn()}
                    <div className="flex h-full min-h-0 shrink-0 flex-1 flex-row gap-2 overflow-hidden">
                        <div className="flex h-full min-h-0 min-w-[25rem] max-w-[34rem] flex-1 flex-col gap-2 overflow-hidden">
                            <div className={`${waitingLobbyPcPanelShellClass(lobbyTone)} flex min-h-0 flex-1 flex-col overflow-hidden`}>
                                {userListPanel}
                            </div>
                        </div>
                        <aside className={`flex h-full min-h-0 ${PC_QUICK_RAIL_COLUMN_CLASS} flex-col overflow-hidden`}>
                            <div className="flex h-full min-h-0 flex-col rounded-xl border-2 border-amber-600/55 bg-gradient-to-br from-zinc-900 via-amber-950 to-zinc-950 p-1 shadow-xl shadow-black/40">
                                <QuickAccessSidebar fillHeight />
                            </div>
                        </aside>
                    </div>
                </div>
            )}
            {pairAiChallengeModalOpen && (
                <AiChallengeModal
                    lobbyType="strategic"
                    seedFromSession={pairGameSeed}
                    onClose={() => setPairAiChallengeModalOpen(false)}
                    onAction={applyAction}
                    startActionType="PAIR_START_AI_MATCH"
                    title={isDuoPairRoom ? '2인 페어 AI 대전' : '펫 페어 AI 대전'}
                    submitLabel="AI 대전 시작"
                    transformSettingsBeforeStart={transformPairAiSettings}
                    hideScoringTurnLimit
                />
            )}
            {pairMatchSettingsModalOpen && (
                <AiChallengeModal
                    lobbyType="strategic"
                    seedFromSession={pairGameSeed}
                    onClose={() => setPairMatchSettingsModalOpen(false)}
                    onAction={applyAction}
                    startActionType="PAIR_START_MATCH"
                    title="페어바둑 대국 설정"
                    submitLabel={isPairPetRoom ? '매칭 시작' : '대국 시작'}
                    showActionPointCost={false}
                    transformSettingsBeforeStart={transformPairAiSettings}
                    hideScoringTurnLimit
                />
            )}
        </div>
    );
};

export default PairWaitingLobby;
