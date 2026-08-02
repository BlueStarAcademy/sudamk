import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserStatus } from '../../../types.js';
import { SPECIAL_GAME_MODES } from '../../../constants.js';
import { useAppContext } from '../../../hooks/useAppContext.js';
import { APP_HOME_HASH, replaceAppHash } from '../../../utils/appUtils.js';
import RankedMatchPanel, { type ArenaMatchQueueKind } from '../../waiting-room/RankedMatchPanel.js';
import MatchFoundModal from '../../waiting-room/MatchFoundModal.js';
import PairPetRankedMatchOfferModal from '../../pair/PairPetRankedMatchOfferModal.js';

export type StrategicMatchQueueKind = ArenaMatchQueueKind;

export type StrategicRankedMatchArenaProps = {
    /** 홈 중앙 퀵유틸 뷰어 인라인 — 자체 뒤로가기 헤더 숨김 */
    embedded?: boolean;
    onClose?: () => void;
    /** 익명 큐: 랭킹전 / 페어랭킹전 / 일반전 (미지정 시 내부 탭으로 전환) */
    queueKind?: StrategicMatchQueueKind;
    /** true면 대국 설정 패널 좌열 상단에 랭킹전/페어랭킹전/일반전 탭 표시 */
    showQueueKindTabs?: boolean;
};

function userInPairRoomClient(
    room: {
        ownerId?: string;
        partnerId?: string;
        extraPairMembers?: { id?: string }[];
        teamA?: { members?: { kind?: string; id?: string }[] };
        teamB?: { members?: { kind?: string; id?: string }[] };
    },
    userId: string,
): boolean {
    if (!userId) return false;
    if (room.ownerId === userId || room.partnerId === userId) return true;
    if ((room.extraPairMembers ?? []).some((m) => m.id === userId)) return true;
    const members = [...(room.teamA?.members ?? []), ...(room.teamB?.members ?? [])];
    return members.some((m) => m.kind === 'user' && m.id === userId);
}

/**
 * 전략 PVP 매칭 전용 뷰: 시즌 정보 + 종목 선택/매칭.
 * `embedded`면 홈 화면 전환 없이 중앙 뷰어에 표시.
 */
const StrategicRankedMatchArena: React.FC<StrategicRankedMatchArenaProps> = ({
    embedded = false,
    onClose,
    queueKind: queueKindProp,
    showQueueKindTabs = false,
}) => {
    const { t } = useTranslation('lobby');
    const {
        currentUserWithStatus,
        handlers,
        rankedMatchFound,
        rankedMatchProposal,
        rankedMatchingQueue,
        pairRooms,
    } = useAppContext();
    const currentUserId = currentUserWithStatus?.id || '';
    const hasEnteredRef = useRef(false);
    const handleActionRef = useRef(handlers.handleAction);
    handleActionRef.current = handlers.handleAction;

    const [queueKindState, setQueueKindState] = useState<StrategicMatchQueueKind>(
        queueKindProp ?? 'ranked',
    );
    const queueKind = showQueueKindTabs ? queueKindState : (queueKindProp ?? 'ranked');
    const isPairRanked = queueKind === 'pairRanked';

    useEffect(() => {
        if (!showQueueKindTabs && queueKindProp) {
            setQueueKindState(queueKindProp);
        }
    }, [queueKindProp, showQueueKindTabs]);

    const [isMatching, setIsMatching] = useState(false);
    const [matchingStartTime, setMatchingStartTime] = useState(0);
    const [matchBusy, setMatchBusy] = useState(false);

    const myPairRoom = useMemo(() => {
        if (!currentUserId) return null;
        const rooms = Object.values((pairRooms || {}) as Record<string, any>);
        return rooms.find((r) => userInPairRoomClient(r, currentUserId)) ?? null;
    }, [pairRooms, currentUserId]);

    useEffect(() => {
        if (!currentUserWithStatus || hasEnteredRef.current) return;
        if (currentUserWithStatus.status === UserStatus.InGame && currentUserWithStatus.gameId) {
            hasEnteredRef.current = true;
            return;
        }
        const isAlready =
            currentUserWithStatus.status === UserStatus.Waiting ||
            currentUserWithStatus.status === UserStatus.Resting;
        const modeMatches =
            !currentUserWithStatus.mode ||
            SPECIAL_GAME_MODES.some((x) => x.mode === currentUserWithStatus.mode);
        if (!isAlready || !modeMatches) {
            hasEnteredRef.current = true;
            void handleActionRef.current({
                type: 'ENTER_WAITING_ROOM',
                payload: { mode: 'strategic', lobbyIntent: 'pvp' },
            });
        } else {
            hasEnteredRef.current = true;
        }
    }, [currentUserWithStatus]);

    useEffect(() => {
        if (isPairRanked) {
            const matching =
                myPairRoom?.phase === 'matching' &&
                Boolean(myPairRoom?.pairPetRankedQueueShell) &&
                !myPairRoom?.pairRankedPetProposal;
            if (matching) {
                setIsMatching(true);
                setMatchingStartTime(
                    typeof myPairRoom?.pairPetMatchingQueuedAt === 'number'
                        ? myPairRoom.pairPetMatchingQueuedAt
                        : Date.now(),
                );
            } else if (!myPairRoom?.pairRankedPetProposal) {
                setIsMatching(false);
                setMatchingStartTime(0);
            }
            return;
        }
        const uid = currentUserWithStatus?.id;
        const qKey = queueKind === 'normal' ? 'normal' : 'strategic';
        const entry = uid
            ? (rankedMatchingQueue as Record<string, Record<string, { startTime: number }> | undefined> | undefined)?.[
                  qKey
              ]?.[uid]
            : undefined;
        if (entry) {
            setIsMatching(true);
            setMatchingStartTime(entry.startTime);
        } else {
            setIsMatching(false);
            setMatchingStartTime(0);
        }
    }, [rankedMatchingQueue, currentUserWithStatus?.id, queueKind, isPairRanked, myPairRoom]);

    useEffect(() => {
        if (!rankedMatchFound?.gameId || !currentUserId) return;
        const matched =
            rankedMatchFound.player1?.id === currentUserId ||
            rankedMatchFound.player2?.id === currentUserId;
        if (matched) {
            handlers.clearRankedMatchFound?.();
            if (embedded) {
                handlers.closeQuickUtilityPanel?.();
            }
            replaceAppHash(`/game/${rankedMatchFound.gameId}`);
        }
    }, [rankedMatchFound, currentUserId, handlers, embedded]);

    useEffect(() => {
        if (!isPairRanked) return;
        const gameId = currentUserWithStatus?.gameId;
        if (
            currentUserWithStatus?.status === UserStatus.InGame &&
            typeof gameId === 'string' &&
            gameId
        ) {
            if (embedded) {
                handlers.closeQuickUtilityPanel?.();
            }
            replaceAppHash(`/game/${gameId}`);
        }
    }, [
        isPairRanked,
        currentUserWithStatus?.status,
        currentUserWithStatus?.gameId,
        embedded,
        handlers,
    ]);

    const leaveQueueAndLobby = useCallback(() => {
        void handlers.handleAction({ type: 'CANCEL_RANKED_MATCHING' }).catch(() => undefined);
        void handlers.handleAction({ type: 'PAIR_CANCEL_PAIR_PET_MATCHING' }).catch(() => undefined);
        void handlers.handleAction({ type: 'LEAVE_WAITING_ROOM' }).catch(() => undefined);
    }, [handlers]);

    const leaveToHome = useCallback(() => {
        leaveQueueAndLobby();
        if (onClose) {
            onClose();
            return;
        }
        window.location.hash = APP_HOME_HASH;
    }, [leaveQueueAndLobby, onClose]);

    const respondMatch = useCallback(
        async (accept: boolean) => {
            if (!rankedMatchProposal?.proposalId || matchBusy) return;
            setMatchBusy(true);
            try {
                await handlers.handleAction({
                    type: 'RESPOND_RANKED_MATCH',
                    payload: { proposalId: rankedMatchProposal.proposalId, accept },
                });
            } finally {
                setMatchBusy(false);
            }
        },
        [rankedMatchProposal?.proposalId, matchBusy, handlers],
    );

    const respondPairPetRankedMatch = useCallback(
        async (accept: boolean) => {
            const p = myPairRoom?.pairRankedPetProposal;
            if (!p?.proposalId || matchBusy) return;
            setMatchBusy(true);
            try {
                await handlers.handleAction({
                    type: 'PAIR_RESPOND_PAIR_PET_RANKED_MATCH',
                    payload: { proposalId: p.proposalId, accept },
                });
            } finally {
                setMatchBusy(false);
            }
        },
        [myPairRoom?.pairRankedPetProposal, matchBusy, handlers],
    );

    const selectQueueKind = useCallback(
        (next: StrategicMatchQueueKind) => {
            if (next === queueKind) return;
            void handlers.handleAction({ type: 'CANCEL_RANKED_MATCHING' }).catch(() => undefined);
            void handlers.handleAction({ type: 'PAIR_CANCEL_PAIR_PET_MATCHING' }).catch(() => undefined);
            setIsMatching(false);
            setMatchingStartTime(0);
            setQueueKindState(next);
        },
        [queueKind, handlers],
    );

    if (!currentUserWithStatus) {
        return (
            <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center text-zinc-400">
                …
            </div>
        );
    }

    const panel = (
        <RankedMatchPanel
            key={queueKind}
            layout="dedicated"
            currentUser={currentUserWithStatus}
            onAction={handlers.handleAction}
            isMatching={isMatching}
            matchingStartTime={matchingStartTime}
            queueKind={queueKind}
            onSelectQueueKind={showQueueKindTabs ? selectQueueKind : undefined}
            onMatchingStateChange={(matching, startTime) => {
                setIsMatching(matching);
                setMatchingStartTime(startTime);
            }}
            onCancelMatching={() => {
                setIsMatching(false);
                setMatchingStartTime(0);
            }}
        />
    );

    const pairProposal = myPairRoom?.pairRankedPetProposal;
    const viewerIsOwner = Boolean(currentUserId && currentUserId === myPairRoom?.ownerId);
    const viewerCanAccept = Boolean(currentUserId && currentUserId === myPairRoom?.ownerId);
    const viewerHasAccepted = !currentUserId || !pairProposal
        ? true
        : currentUserId === myPairRoom?.ownerId
          ? Boolean(pairProposal.myAccepted)
          : true;

    return (
        <div
            className={
                embedded
                    ? 'flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden'
                    : 'bg-lobby-shell-strategic text-primary flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden'
            }
        >
            <div
                className={
                    embedded
                        ? 'flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden'
                        : 'mx-auto flex h-full min-h-0 w-full max-w-5xl flex-1 flex-col gap-2 overflow-hidden px-2 py-2 sm:px-3 sm:py-3 lg:max-w-6xl'
                }
            >
                {!embedded ? (
                    <div className="flex shrink-0 items-center gap-2 rounded-xl border border-amber-400/40 bg-black/30 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-2">
                        <button
                            type="button"
                            onClick={leaveToHome}
                            className="relative z-[1] shrink-0 transition-transform active:scale-90 hover:drop-shadow-lg"
                            aria-label={t('arenaLobby.back')}
                        >
                            <img src="/images/button/back.webp" alt="" className="h-9 w-9 sm:h-10 sm:w-10" />
                        </button>
                        <div className="min-w-0 flex-1">
                            <h1 className="truncate text-base font-black tracking-wide text-amber-50 sm:text-lg lg:text-xl">
                                {t('arenaLobby.destinationTitle.matchArena', '경기장')}
                            </h1>
                            <p className="truncate text-[11px] font-medium text-amber-100/65 sm:text-xs">
                                {queueKind === 'normal'
                                    ? t('ranked.normalDedicatedSubtitle', '티어 반영 없는 익명 매칭')
                                    : queueKind === 'pairRanked'
                                      ? t(
                                            'ranked.pairDedicatedSubtitle',
                                            '펫과 함께하는 페어 시즌 랭킹 매칭',
                                        )
                                      : t('ranked.dedicatedSubtitle', '시즌 티어가 반영되는 공식 매칭')}
                            </p>
                        </div>
                    </div>
                ) : null}

                <div
                    className={
                        embedded
                            ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                            : 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-amber-400/25 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                    }
                >
                    <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{panel}</div>
                </div>
            </div>

            {rankedMatchProposal && !isPairRanked ? (
                <MatchFoundModal
                    proposal={rankedMatchProposal}
                    currentUserId={currentUserId}
                    queueKind={queueKind === 'normal' ? 'normal' : 'ranked'}
                    isBusy={matchBusy}
                    onAccept={() => void respondMatch(true)}
                    onReject={() => void respondMatch(false)}
                    onDeadlineElapsed={() => {
                        handlers.clearRankedMatchProposal?.();
                    }}
                />
            ) : null}

            {pairProposal ? (
                <PairPetRankedMatchOfferModal
                    proposal={pairProposal}
                    isBusy={matchBusy}
                    onAccept={() => void respondPairPetRankedMatch(true)}
                    onReject={() => void respondPairPetRankedMatch(false)}
                    viewerHasAccepted={viewerHasAccepted}
                    viewerCanAccept={viewerCanAccept}
                    viewerIsOwner={viewerIsOwner}
                    onDeadlineElapsed={() => {
                        void handleActionRef.current({ type: 'PAIR_SYNC' } as any);
                    }}
                    variant="pet"
                />
            ) : null}
        </div>
    );
};

export default StrategicRankedMatchArena;
