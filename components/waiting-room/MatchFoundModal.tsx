import React, { useEffect, useMemo, useRef, useState } from 'react';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import Avatar from '../Avatar.js';
import { audioService } from '../../services/audioService.js';

export type RankedMatchProposalPlayer = {
    id: string;
    nickname: string;
    rating: number;
    winChange: number;
    lossChange: number;
    accepted: boolean;
};

export type RankedMatchProposalClient = {
    proposalId: string;
    acceptDeadlineAt: number;
    player1: RankedMatchProposalPlayer;
    player2: RankedMatchProposalPlayer;
};

interface MatchFoundModalProps {
    proposal: RankedMatchProposalClient;
    currentUserId: string;
    isBusy?: boolean;
    onAccept: () => void | Promise<void>;
    onReject: () => void | Promise<void>;
    onDeadlineElapsed?: () => void;
}

const ACCEPT_WINDOW_SECONDS = 30;

const MatchFoundModal: React.FC<MatchFoundModalProps> = ({
    proposal,
    currentUserId,
    isBusy = false,
    onAccept,
    onReject,
    onDeadlineElapsed,
}) => {
    const isPlayer1 = currentUserId === proposal.player1.id;
    const myInfo = isPlayer1 ? proposal.player1 : proposal.player2;
    const opponentInfo = isPlayer1 ? proposal.player2 : proposal.player1;
    const myAccepted = myInfo.accepted;
    const peerAccepted = opponentInfo.accepted;

    const deadlineMs = useMemo(
        () => proposal.acceptDeadlineAt || Date.now() + ACCEPT_WINDOW_SECONDS * 1000,
        [proposal.acceptDeadlineAt, proposal.proposalId],
    );

    const [secondsLeft, setSecondsLeft] = useState(() =>
        Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)),
    );
    const deadlineSyncStartedRef = useRef(false);

    useEffect(() => {
        audioService.myTurn();
    }, [proposal.proposalId]);

    useEffect(() => {
        deadlineSyncStartedRef.current = false;
        const tick = () => setSecondsLeft(Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)));
        tick();
        const id = window.setInterval(tick, 250);
        return () => window.clearInterval(id);
    }, [deadlineMs, proposal.proposalId]);

    useEffect(() => {
        if (secondsLeft > 0 || !onDeadlineElapsed) return;
        if (deadlineSyncStartedRef.current) return;
        deadlineSyncStartedRef.current = true;
        onDeadlineElapsed();
        const intervalId = window.setInterval(() => onDeadlineElapsed(), 2500);
        return () => window.clearInterval(intervalId);
    }, [secondsLeft, onDeadlineElapsed]);

    const timerPercent = Math.max(0, Math.min(100, (secondsLeft / ACCEPT_WINDOW_SECONDS) * 100));

    return (
        <DraggableWindow
            title="랭킹전 매칭"
            windowId="match-found"
            onClose={() => {
                if (!isBusy) void onReject();
            }}
            initialWidth={600}
            closeOnOutsideClick={false}
            isTopmost
            skipSavedPosition
            variant="store"
            mobileViewportFit
            mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - 16px))"
        >
            <div className="flex flex-col gap-5 p-4 sm:p-6">
                <div className="text-center">
                    <p className="text-lg font-black text-amber-50 sm:text-xl">매칭이 되었습니다</p>
                    <p className="mt-1 text-sm font-semibold text-amber-100/85">시간 내로 매칭을 수락하세요.</p>
                </div>

                <div
                    className={`rounded-xl border px-3 py-2 text-center text-sm font-black tabular-nums ${
                        secondsLeft <= 5 && secondsLeft > 0
                            ? 'border-rose-400/55 bg-rose-950/50 text-rose-100'
                            : secondsLeft <= 0
                              ? 'border-slate-500/45 bg-slate-950/55 text-slate-200'
                              : 'border-amber-400/40 bg-black/40 text-amber-100'
                    }`}
                >
                    {secondsLeft > 0 ? `남은 시간 ${secondsLeft}초` : '수락 시간이 지났습니다'}
                </div>

                <div className="w-full overflow-hidden rounded-full border border-amber-500/35 bg-amber-950/40">
                    <div
                        className={`h-2 transition-all duration-300 ${
                            secondsLeft <= 5 ? 'bg-rose-500' : 'bg-amber-400'
                        }`}
                        style={{ width: `${timerPercent}%` }}
                    />
                </div>

                <div className="flex items-center justify-center gap-6 sm:gap-8">
                    <div className="flex flex-1 flex-col items-center gap-3">
                        <Avatar userId={myInfo.id} userName={myInfo.nickname} size={72} />
                        <div className="text-center">
                            <p className="text-base font-bold text-white">{myInfo.nickname}</p>
                            <p className="text-sm text-gray-300">랭킹: {myInfo.rating}점</p>
                        </div>
                        <div className="w-full rounded-lg border border-blue-700/50 bg-blue-900/30 p-3">
                            <p className="mb-1 text-xs text-blue-300">예상 점수 변동</p>
                            <p className="text-sm font-semibold text-green-400">승리: +{myInfo.winChange}점</p>
                            <p className="text-sm font-semibold text-red-400">패배: {myInfo.lossChange}점</p>
                        </div>
                        <p className={`text-xs font-bold ${myAccepted ? 'text-emerald-300' : 'text-slate-400'}`}>
                            {myAccepted ? '수락함' : '수락 대기'}
                        </p>
                    </div>

                    <div className="text-3xl font-bold text-yellow-400 sm:text-4xl">VS</div>

                    <div className="flex flex-1 flex-col items-center gap-3">
                        <Avatar userId={opponentInfo.id} userName={opponentInfo.nickname} size={72} />
                        <div className="text-center">
                            <p className="text-base font-bold text-white">{opponentInfo.nickname}</p>
                            <p className="text-sm text-gray-300">랭킹: {opponentInfo.rating}점</p>
                        </div>
                        <div className="w-full rounded-lg border border-gray-700/50 bg-gray-800/50 p-3">
                            <p className="mb-1 text-xs text-gray-400">상대방 랭킹</p>
                            <p className="text-sm text-gray-300">{opponentInfo.rating}점</p>
                        </div>
                        <p className={`text-xs font-bold ${peerAccepted ? 'text-emerald-300' : 'text-slate-400'}`}>
                            {peerAccepted ? '수락함' : '수락 대기'}
                        </p>
                    </div>
                </div>

                {myAccepted && !peerAccepted ? (
                    <p className="text-center text-xs font-semibold text-slate-300">상대의 수락을 기다리는 중…</p>
                ) : peerAccepted && !myAccepted ? (
                    <p className="text-center text-xs font-semibold text-emerald-200/90">상대가 수락했습니다. 수락해 주세요.</p>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                    <Button
                        type="button"
                        bare
                        disabled={isBusy || secondsLeft <= 0}
                        onClick={() => void onReject()}
                        className="rounded-xl border border-rose-400/45 bg-rose-950/55 py-2.5 text-sm font-extrabold text-rose-50"
                    >
                        거절
                    </Button>
                    <Button
                        type="button"
                        bare
                        disabled={isBusy || myAccepted || secondsLeft <= 0}
                        onClick={() => void onAccept()}
                        className="rounded-xl border border-emerald-400/50 bg-emerald-900/55 py-2.5 text-sm font-extrabold text-emerald-50 disabled:opacity-45"
                    >
                        {myAccepted ? '수락함' : '수락'}
                    </Button>
                </div>

                <div className="text-center text-xs text-gray-400">
                    <p>거절하거나 시간 내 수락하지 않으면 매칭이 취소됩니다.</p>
                    <p>이미 수락한 경우, 상대가 거절·시간 초과 시 매칭 대기 상태와 우선순위가 유지됩니다.</p>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default MatchFoundModal;
