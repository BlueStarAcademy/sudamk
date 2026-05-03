import React, { useEffect, useMemo, useRef, useState } from 'react';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';
import { audioService } from '../../services/audioService.js';

export type PairPetRankedProposalClient = {
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

export interface PairPetRankedMatchOfferModalProps {
    proposal: PairPetRankedProposalClient;
    isBusy: boolean;
    onAccept: () => void | Promise<void>;
    onReject: () => void | Promise<void>;
    /** 내 슬롯(방장/파트너) 수락 여부 — 서버 동기 스냅샷 기준 */
    viewerHasAccepted: boolean;
    /** 수락 버튼을 누를 수 있는지(페어 펫 랭크는 방장만, 2인 페어 랭크는 방장+파트너) */
    viewerCanAccept: boolean;
    /** 현재 보는 유저가 이 방의 방장인지(대기 안내 문구용) */
    viewerIsOwner: boolean;
    /** 수락 마감 후 서버 만료 반영용(짧게 재동기) */
    onDeadlineElapsed?: () => void;
    isTopmost?: boolean;
    /** 2인 페어 팀 랭크 매칭 수락 UI */
    variant?: 'pet' | 'duo_human';
}

const PairPetRankedMatchOfferModal: React.FC<PairPetRankedMatchOfferModalProps> = ({
    proposal,
    isBusy,
    onAccept,
    onReject,
    viewerHasAccepted,
    viewerCanAccept,
    viewerIsOwner,
    onDeadlineElapsed,
    isTopmost = true,
    variant = 'pet',
}) => {
    const deadlineMs = useMemo(() => {
        if (typeof proposal.acceptDeadlineAt === 'number') return proposal.acceptDeadlineAt;
        return Date.now() + 20_000;
    }, [proposal.acceptDeadlineAt, proposal.proposalId]);

    const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000)));
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

    const duo = variant === 'duo_human' || proposal.matchKind === 'duo_human';
    const waitingPeer = proposal.myAccepted && !proposal.peerAccepted;
    const waitingMyPartner = duo && viewerIsOwner && proposal.myAccepted && proposal.peerAccepted && !proposal.myPartnerAccepted;
    const waitingPeerPartner =
        duo && proposal.myAccepted && proposal.peerAccepted && proposal.myPartnerAccepted && !proposal.peerPartnerAccepted;
    const waitingOwnerAsPartner = duo && !viewerIsOwner && viewerCanAccept && !proposal.myAccepted;

    return (
        <DraggableWindow
            title={duo ? '2인 페어 랭크 매칭' : '페어 펫 랭크 매칭'}
            onClose={() => {
                if (!isBusy) void onReject();
            }}
            windowId="pair-pet-ranked-match-offer"
            initialWidth={440}
            closeOnOutsideClick={false}
            isTopmost={isTopmost}
            zIndex={85}
            skipSavedPosition
            variant="store"
            mobileViewportFit
            mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - 16px))"
        >
            <div className="flex flex-col gap-4 px-1 pb-2 pt-1 sm:px-2">
                <p className="text-center text-base font-black text-amber-50">매칭이 되었습니다</p>
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
                <div className="rounded-xl border border-yellow-500/40 bg-gradient-to-br from-yellow-950/60 via-amber-950/50 to-yellow-950/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <div className="text-center">
                        <p className="text-xs font-semibold text-yellow-200/80">상대</p>
                        <p className="mt-1 truncate text-lg font-black text-yellow-50">{proposal.opponentNickname}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-2">
                            <p className="font-semibold text-slate-400">내 점수</p>
                            <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-cyan-200">{proposal.myRating}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-2">
                            <p className="font-semibold text-slate-400">상대 점수</p>
                            <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-amber-200">{proposal.opponentRating}</p>
                        </div>
                    </div>
                </div>
                {duo ? (
                    <div className="space-y-1.5 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[0.7rem] font-semibold text-slate-300 sm:text-xs">
                        <p className="text-center text-slate-400">팀 수락 현황</p>
                        <p>
                            우리 팀 방장:{' '}
                            <span className={proposal.myAccepted ? 'text-emerald-300' : 'text-slate-500'}>
                                {proposal.myAccepted ? '수락' : '대기'}
                            </span>
                            {' · '}
                            파트너:{' '}
                            <span className={proposal.myPartnerAccepted ? 'text-emerald-300' : 'text-slate-500'}>
                                {proposal.myPartnerAccepted ? '수락' : '대기'}
                            </span>
                        </p>
                        <p>
                            상대 팀 방장:{' '}
                            <span className={proposal.peerAccepted ? 'text-emerald-300' : 'text-slate-500'}>
                                {proposal.peerAccepted ? '수락' : '대기'}
                            </span>
                            {' · '}
                            파트너:{' '}
                            <span className={proposal.peerPartnerAccepted ? 'text-emerald-300' : 'text-slate-500'}>
                                {proposal.peerPartnerAccepted ? '수락' : '대기'}
                            </span>
                        </p>
                    </div>
                ) : waitingPeer ? (
                    <p className="text-center text-xs font-semibold text-slate-300">상대의 수락을 기다리는 중…</p>
                ) : proposal.peerAccepted && !proposal.myAccepted ? (
                    <p className="text-center text-xs font-semibold text-emerald-200/90">상대가 수락했습니다. 수락해 주세요.</p>
                ) : null}
                {duo && waitingOwnerAsPartner ? (
                    <p className="text-center text-xs font-semibold text-slate-300">우리 팀 방장의 수락을 기다리는 중…</p>
                ) : null}
                {duo && waitingMyPartner ? (
                    <p className="text-center text-xs font-semibold text-slate-300">우리 팀 파트너의 수락을 기다리는 중…</p>
                ) : null}
                {duo && waitingPeerPartner ? (
                    <p className="text-center text-xs font-semibold text-slate-300">상대 팀 파트너의 수락을 기다리는 중…</p>
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
                        disabled={isBusy || viewerHasAccepted || secondsLeft <= 0 || !viewerCanAccept}
                        onClick={() => void onAccept()}
                        className="rounded-xl border border-emerald-400/50 bg-emerald-900/55 py-2.5 text-sm font-extrabold text-emerald-50 disabled:opacity-45"
                    >
                        {viewerHasAccepted ? '수락함' : '수락'}
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default PairPetRankedMatchOfferModal;
