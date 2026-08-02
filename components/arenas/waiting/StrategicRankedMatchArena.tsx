import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserStatus } from '../../../types.js';
import { SPECIAL_GAME_MODES } from '../../../constants.js';
import { useAppContext } from '../../../hooks/useAppContext.js';
import { APP_HOME_HASH, replaceAppHash } from '../../../utils/appUtils.js';
import RankedMatchPanel from '../../waiting-room/RankedMatchPanel.js';
import MatchFoundModal from '../../waiting-room/MatchFoundModal.js';

export type StrategicMatchQueueKind = 'ranked' | 'normal';

export type StrategicRankedMatchArenaProps = {
    /** 홈 중앙 퀵유틸 뷰어 인라인 — 자체 뒤로가기 헤더 숨김 */
    embedded?: boolean;
    onClose?: () => void;
    /** 익명 큐: 랭킹전 / 일반전 (미지정 시 내부 탭으로 전환) */
    queueKind?: StrategicMatchQueueKind;
    /** true면 대국 설정 패널 좌열 상단에 랭킹전/일반전 탭 표시 */
    showQueueKindTabs?: boolean;
};

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
    } = useAppContext();
    const currentUserId = currentUserWithStatus?.id || '';
    const hasEnteredRef = useRef(false);
    const handleActionRef = useRef(handlers.handleAction);
    handleActionRef.current = handlers.handleAction;

    const [queueKindState, setQueueKindState] = useState<StrategicMatchQueueKind>(
        queueKindProp ?? 'ranked',
    );
    const queueKind = showQueueKindTabs ? queueKindState : (queueKindProp ?? 'ranked');

    useEffect(() => {
        if (!showQueueKindTabs && queueKindProp) {
            setQueueKindState(queueKindProp);
        }
    }, [queueKindProp, showQueueKindTabs]);

    const [isMatching, setIsMatching] = useState(false);
    const [matchingStartTime, setMatchingStartTime] = useState(0);
    const [matchBusy, setMatchBusy] = useState(false);

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
    }, [rankedMatchingQueue, currentUserWithStatus?.id, queueKind]);

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

    const leaveQueueAndLobby = useCallback(() => {
        void handlers.handleAction({ type: 'CANCEL_RANKED_MATCHING' }).catch(() => undefined);
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

    const selectQueueKind = useCallback(
        (next: StrategicMatchQueueKind) => {
            if (next === queueKind) return;
            if (isMatching) {
                void handlers.handleAction({ type: 'CANCEL_RANKED_MATCHING' }).catch(() => undefined);
                setIsMatching(false);
                setMatchingStartTime(0);
            }
            setQueueKindState(next);
        },
        [queueKind, isMatching, handlers],
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

            {rankedMatchProposal ? (
                <MatchFoundModal
                    proposal={rankedMatchProposal}
                    currentUserId={currentUserId}
                    queueKind={queueKind}
                    isBusy={matchBusy}
                    onAccept={() => void respondMatch(true)}
                    onReject={() => void respondMatch(false)}
                    onDeadlineElapsed={() => {
                        handlers.clearRankedMatchProposal?.();
                    }}
                />
            ) : null}
        </div>
    );
};

export default StrategicRankedMatchArena;
