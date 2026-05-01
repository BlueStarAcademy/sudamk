import React from 'react';
import DraggableWindow from '../DraggableWindow.js';
import Button from '../Button.js';

export type PairPetRankedProposalClient = {
    proposalId: string;
    opponentOwnerId: string;
    opponentNickname: string;
    myRating: number;
    opponentRating: number;
    myAccepted: boolean;
    peerAccepted: boolean;
};

export interface PairPetRankedMatchOfferModalProps {
    proposal: PairPetRankedProposalClient;
    isBusy: boolean;
    onAccept: () => void | Promise<void>;
    onReject: () => void | Promise<void>;
    isTopmost?: boolean;
}

const PairPetRankedMatchOfferModal: React.FC<PairPetRankedMatchOfferModalProps> = ({
    proposal,
    isBusy,
    onAccept,
    onReject,
    isTopmost = true,
}) => {
    const waitingPeer = proposal.myAccepted && !proposal.peerAccepted;

    return (
        <DraggableWindow
            title="페어 펫 랭크 매칭"
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
                <p className="text-center text-sm font-bold text-amber-100">상대를 찾았습니다</p>
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
                {waitingPeer ? (
                    <p className="text-center text-xs font-semibold text-slate-300">상대의 수락을 기다리는 중…</p>
                ) : proposal.peerAccepted && !proposal.myAccepted ? (
                    <p className="text-center text-xs font-semibold text-emerald-200/90">상대가 수락했습니다. 수락해 주세요.</p>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        type="button"
                        bare
                        disabled={isBusy}
                        onClick={() => void onReject()}
                        className="rounded-xl border border-rose-400/45 bg-rose-950/55 py-2.5 text-sm font-extrabold text-rose-50"
                    >
                        거절
                    </Button>
                    <Button
                        type="button"
                        bare
                        disabled={isBusy || proposal.myAccepted}
                        onClick={() => void onAccept()}
                        className="rounded-xl border border-emerald-400/50 bg-emerald-900/55 py-2.5 text-sm font-extrabold text-emerald-50 disabled:opacity-45"
                    >
                        {proposal.myAccepted ? '수락함' : '수락'}
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default PairPetRankedMatchOfferModal;
