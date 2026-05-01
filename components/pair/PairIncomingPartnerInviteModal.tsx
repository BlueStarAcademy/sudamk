import React, { useEffect, useState } from 'react';
import Button from '../Button.js';

export type PairIncomingInvitePayload = {
    id: string;
    roomTitle: string;
    roomCode: string;
    inviterName: string;
    createdAt: number;
};

const INVITE_TTL_MS = 30_000;

type Props = {
    invite: PairIncomingInvitePayload;
    isBusy: boolean;
    onAccept: () => void | Promise<void>;
    onDecline: () => void | Promise<void>;
};

const PairIncomingPartnerInviteModal: React.FC<Props> = ({ invite, isBusy, onAccept, onDecline }) => {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 200);
        return () => window.clearInterval(id);
    }, []);

    const msLeft = invite.createdAt + INVITE_TTL_MS - now;
    const secLeft = Math.max(0, Math.ceil(msLeft / 1000));
    const expired = msLeft <= 0;

    return (
        <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            role="presentation"
            onClick={() => {
                if (!isBusy && !expired) void onDecline();
            }}
        >
            <div
                className="flex h-[min(520px,90vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-cyan-400/40 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black shadow-2xl ring-1 ring-white/10"
                role="dialog"
                aria-modal
                aria-labelledby="pair-incoming-invite-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="shrink-0 border-b border-white/10 px-5 py-4 text-center">
                    <h2 id="pair-incoming-invite-title" className="text-lg font-extrabold tracking-tight text-cyan-50">
                        페어 방 초대
                    </h2>
                    <p className="mt-2 text-sm font-bold text-white">
                        <span className="text-cyan-200">{invite.inviterName}</span>님이 파트너로 초대했습니다
                    </p>
                </div>
                <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 px-5 py-4">
                    <div className="rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-center">
                        <p className="truncate text-sm font-semibold text-slate-200" title={invite.roomTitle}>
                            {invite.roomTitle}
                        </p>
                        <p className="mt-1 text-sm text-slate-300">
                            방 번호 <span className="font-mono font-bold tabular-nums text-amber-200">{invite.roomCode}</span>
                        </p>
                    </div>
                    <p className={`text-center text-xs font-semibold ${expired ? 'text-rose-300' : 'text-slate-400'}`}>
                        {expired ? '초대 시간이 만료되었습니다.' : `응답 대기 ${secLeft}초 후 자동 취소`}
                    </p>
                </div>
                <div className="shrink-0 grid grid-cols-2 gap-3 border-t border-white/10 p-4">
                    <Button
                        type="button"
                        bare
                        disabled={isBusy || expired}
                        onClick={() => void onDecline()}
                        className="rounded-xl border border-white/20 bg-zinc-800/70 py-3 text-sm font-bold text-zinc-200"
                    >
                        거절
                    </Button>
                    <Button
                        type="button"
                        bare
                        disabled={isBusy || expired}
                        onClick={() => void onAccept()}
                        className="rounded-xl border border-emerald-400/50 bg-emerald-900/55 py-3 text-sm font-extrabold text-emerald-50"
                    >
                        수락
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default PairIncomingPartnerInviteModal;
