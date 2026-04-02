import React, { useState, useEffect } from 'react';
import { UserWithStatus, Mail, ServerAction, InventoryItem } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { audioService } from '../services/audioService.js';
import { useAppContext } from '../hooks/useAppContext.js';
import MailRewardItemTile from './MailRewardItemTile.js';

interface MailboxModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    isTopmost?: boolean;
}

const formatRemainingTime = (expiresAt: number): string => {
    const remainingSeconds = Math.max(0, (expiresAt - Date.now()) / 1000);
    if (remainingSeconds === 0) return '만료됨';

    const days = Math.floor(remainingSeconds / (24 * 3600));
    const hours = Math.floor((remainingSeconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);

    if (days > 0) return `${days}일 ${hours}시간`;
    if (hours > 0) return `${hours}시간 ${minutes}분`;
    return `${minutes}분`;
};

const MailboxModal: React.FC<MailboxModalProps> = ({ currentUser: propCurrentUser, onClose, onAction, isTopmost }) => {
    const { currentUserWithStatus } = useAppContext();

    const currentUser = currentUserWithStatus || propCurrentUser;

    const { mail } = currentUser;
    const [selectedMail, setSelectedMail] = useState<Mail | null>(mail.length > 0 ? mail[0] : null);
    const [remainingTime, setRemainingTime] = useState<string | null>(null);

    useEffect(() => {
        if (selectedMail) {
            const updatedVersion = mail.find((m) => m.id === selectedMail.id);
            if (updatedVersion) {
                if (JSON.stringify(updatedVersion) !== JSON.stringify(selectedMail)) {
                    setSelectedMail(updatedVersion);
                }
            } else {
                setSelectedMail(mail.length > 0 ? mail[0] : null);
            }
        } else if (mail.length > 0) {
            setSelectedMail(mail[0]);
        }
    }, [mail, selectedMail]);

    useEffect(() => {
        if (selectedMail && !selectedMail.isRead) {
            onAction({ type: 'MARK_MAIL_AS_READ', payload: { mailId: selectedMail.id } });
        }
    }, [selectedMail, onAction]);

    useEffect(() => {
        if (selectedMail?.expiresAt) {
            const updateTimer = () => {
                setRemainingTime(formatRemainingTime(selectedMail.expiresAt!));
            };
            updateTimer();
            const interval = setInterval(updateTimer, 60000);
            return () => clearInterval(interval);
        }
        setRemainingTime(null);
    }, [selectedMail]);

    const handleClaim = () => {
        if (selectedMail && selectedMail.attachments && !selectedMail.attachmentsClaimed) {
            audioService.claimReward();
            onAction({ type: 'CLAIM_MAIL_ATTACHMENTS', payload: { mailId: selectedMail.id } });
        }
    };

    const handleDelete = () => {
        if (selectedMail) {
            const nextMailIndex = mail.findIndex((m) => m.id === selectedMail.id) - 1;
            onAction({ type: 'DELETE_MAIL', payload: { mailId: selectedMail.id } });
            setSelectedMail(mail.length > 1 ? mail[Math.max(0, nextMailIndex)] : null);
        }
    };

    const hasUnclaimedMail = mail.some((m) => m.attachments && !m.attachmentsClaimed);
    const hasClaimedMail = mail.some((m) => m.attachmentsClaimed);

    const handleClaimAll = () => {
        audioService.claimReward();
        onAction({ type: 'CLAIM_ALL_MAIL_ATTACHMENTS' });
    };

    const handleDeleteAllClaimed = () => {
        if (window.confirm('수령 완료된 모든 메일을 삭제하시겠습니까?')) {
            onAction({ type: 'DELETE_ALL_CLAIMED_MAIL' });
            const remainingMail = mail.filter((m) => !m.attachmentsClaimed);
            setSelectedMail(remainingMail.length > 0 ? remainingMail[0] : null);
        }
    };

    const shell =
        'rounded-2xl border border-amber-500/20 bg-gradient-to-br from-zinc-950/95 via-zinc-900/90 to-black/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';

    return (
        <DraggableWindow title="우편함" onClose={onClose} windowId="mailbox" initialWidth={960} initialHeight={780} isTopmost={isTopmost}>
            <div className="flex h-[min(640px,calc(100vh-8rem))] gap-5 p-1">
                {/* 목록 */}
                <aside className={`flex w-[min(100%,420px)] min-w-[300px] shrink-0 flex-col ${shell} p-4`}>
                    <div className="mb-4 flex items-center justify-between gap-2 border-b border-amber-500/15 pb-3">
                        <h3 className="bg-gradient-to-r from-amber-100 to-amber-300 bg-clip-text text-lg font-bold tracking-tight text-transparent">
                            받은 우편
                        </h3>
                        <span className="rounded-full border border-amber-500/25 bg-black/40 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-amber-200/90">
                            {mail.length}
                        </span>
                    </div>
                    <div className="mb-3 flex flex-col gap-2">
                        <Button
                            onClick={handleClaimAll}
                            disabled={!hasUnclaimedMail}
                            colorScheme="green"
                            className="!rounded-xl !py-2.5 !text-sm font-semibold shadow-lg shadow-emerald-900/20"
                        >
                            일괄 수령
                        </Button>
                        <Button
                            onClick={handleDeleteAllClaimed}
                            disabled={!hasClaimedMail}
                            colorScheme="red"
                            className="!rounded-xl !border !border-red-500/30 !bg-red-950/40 !py-2 !text-sm hover:!bg-red-900/50"
                        >
                            수령 완료 메일 삭제
                        </Button>
                    </div>
                    <ul className="custom-mail-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
                        {mail.length === 0 ? (
                            <li className="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-zinc-500">우편이 없습니다.</li>
                        ) : (
                            mail.map((m) => {
                                const selected = selectedMail?.id === m.id;
                                return (
                                    <li key={m.id}>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedMail(m)}
                                            className={`w-full rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${
                                                selected
                                                    ? 'border-amber-400/50 bg-gradient-to-r from-amber-950/80 via-amber-900/25 to-transparent shadow-[0_0_20px_rgba(251,191,36,0.12)]'
                                                    : 'border-transparent bg-white/[0.03] hover:border-amber-500/20 hover:bg-white/[0.06]'
                                            }`}
                                        >
                                            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                                                <span className="truncate font-medium text-zinc-400">{m.from}</span>
                                                {!m.isRead ? (
                                                    <span className="shrink-0 rounded-full bg-amber-500/90 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-black">
                                                        New
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-100">{m.title}</p>
                                            {m.attachments && !m.attachmentsClaimed ? (
                                                <p className="mt-1 text-[10px] font-medium text-emerald-400/90">보상 미수령</p>
                                            ) : m.attachments ? (
                                                <p className="mt-1 text-[10px] text-zinc-600">수령 완료</p>
                                            ) : null}
                                        </button>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </aside>

                {/* 본문 */}
                <div className={`flex min-w-0 flex-1 flex-col ${shell} overflow-hidden`}>
                    {selectedMail ? (
                        <>
                            <div className="border-b border-amber-500/15 bg-gradient-to-r from-black/60 via-zinc-950/80 to-black/60 px-5 py-4">
                                <h2 className="text-xl font-bold tracking-tight text-zinc-50 md:text-2xl">{selectedMail.title}</h2>
                                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                                    <span>
                                        보낸 사람: <span className="font-medium text-amber-200/80">{selectedMail.from}</span>
                                    </span>
                                    {remainingTime ? (
                                        <span className="flex items-center gap-1.5">
                                            <span className="h-1 w-1 rounded-full bg-amber-400/80" aria-hidden />
                                            남은 시간:{' '}
                                            <span className="font-semibold tabular-nums text-amber-300">{remainingTime}</span>
                                        </span>
                                    ) : null}
                                </div>
                            </div>

                            <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
                                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/5 bg-black/35 p-4 text-sm leading-relaxed text-zinc-300 shadow-inner">
                                    <div className="whitespace-pre-wrap">{selectedMail.message}</div>
                                </div>

                                {selectedMail.attachments ? (
                                    <div className="mt-4 shrink-0">
                                        <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-zinc-900/90 to-black/80 p-4 shadow-lg">
                                            <h4 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide text-amber-100/90">
                                                <span className="h-px w-8 max-w-[2rem] shrink-0 bg-gradient-to-r from-transparent to-amber-500/40" aria-hidden />
                                                첨부 보상
                                                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-500/40" aria-hidden />
                                            </h4>
                                            {selectedMail.attachmentsClaimed ? (
                                                <p className="py-6 text-center text-sm text-zinc-500">수령이 완료되었습니다.</p>
                                            ) : (
                                                <div
                                                    className="custom-mail-scroll h-[min(12rem,28vh)] overflow-y-auto overflow-x-hidden pr-1"
                                                    role="region"
                                                    aria-label="첨부 보상 목록"
                                                >
                                                    <div className="mb-4 flex flex-wrap gap-3 text-sm">
                                                        {(selectedMail.attachments.actionPoints ?? 0) > 0 ? (
                                                            <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-950/30 px-3 py-2 font-medium text-emerald-200">
                                                                ⚡ {selectedMail.attachments.actionPoints!.toLocaleString()} 행동력
                                                            </span>
                                                        ) : null}
                                                        {(selectedMail.attachments.guildCoins ?? 0) > 0 ? (
                                                            <span className="inline-flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-950/25 px-3 py-2 font-medium text-amber-100">
                                                                <img src="/images/guild/tokken.png" alt="" className="h-5 w-5" />
                                                                {selectedMail.attachments.guildCoins!.toLocaleString()} 길드코인
                                                            </span>
                                                        ) : null}
                                                        {(selectedMail.attachments.researchPoints ?? 0) > 0 ? (
                                                            <span className="inline-flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-950/25 px-3 py-2 font-medium text-purple-100">
                                                                <img src="/images/guild/button/guildlab.png" alt="" className="h-5 w-5" />
                                                                {selectedMail.attachments.researchPoints!.toLocaleString()} RP
                                                            </span>
                                                        ) : null}
                                                        {(selectedMail.attachments.gold ?? 0) > 0 ? (
                                                            <span className="inline-flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-950/25 px-3 py-2 font-medium text-amber-100">
                                                                <img src="/images/icon/Gold.png" alt="" className="h-5 w-5" />
                                                                {selectedMail.attachments.gold!.toLocaleString()} 골드
                                                            </span>
                                                        ) : null}
                                                        {(selectedMail.attachments.diamonds ?? 0) > 0 ? (
                                                            <span className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-950/25 px-3 py-2 font-medium text-cyan-100">
                                                                <img src="/images/icon/Zem.png" alt="" className="h-5 w-5" />
                                                                {selectedMail.attachments.diamonds!.toLocaleString()} 다이아
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {(() => {
                                                        const rawItems = selectedMail.attachments.items;
                                                        if (rawItems == null) return null;
                                                        const asArray = Array.isArray(rawItems)
                                                            ? rawItems
                                                            : typeof rawItems === 'object'
                                                              ? Object.values(rawItems as Record<string, unknown>)
                                                              : [];
                                                        const list = asArray.filter(
                                                            (x): x is InventoryItem =>
                                                                x != null && typeof x === 'object'
                                                        );
                                                        if (list.length === 0) return null;
                                                        return (
                                                            <div className="flex flex-wrap justify-center gap-x-4 gap-y-5 pb-1 sm:justify-start">
                                                                {list.map((raw, index) => (
                                                                    <MailRewardItemTile
                                                                        key={raw.id ?? `${selectedMail.id}-att-${index}`}
                                                                        item={raw}
                                                                        variant="lg"
                                                                    />
                                                                ))}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : null}

                                <div className="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
                                    <Button
                                        onClick={handleDelete}
                                        colorScheme="red"
                                        className="!rounded-xl !border !border-red-500/35 !bg-red-950/35 !px-5 hover:!bg-red-900/45"
                                    >
                                        삭제
                                    </Button>
                                    <Button
                                        onClick={handleClaim}
                                        colorScheme="green"
                                        disabled={!selectedMail.attachments || selectedMail.attachmentsClaimed}
                                        className="!rounded-xl !px-8 !py-2.5 !text-base !font-bold shadow-lg shadow-emerald-900/30"
                                    >
                                        {selectedMail.attachmentsClaimed ? '수령 완료' : '보상 받기'}
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
                            <div className="rounded-full border border-amber-500/20 bg-amber-500/5 p-6 text-4xl opacity-80">✉️</div>
                            <p className="text-sm font-medium text-zinc-500">선택된 우편이 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>
            <style>{`
                .custom-mail-scroll::-webkit-scrollbar { width: 6px; }
                .custom-mail-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; }
                .custom-mail-scroll::-webkit-scrollbar-thumb { background: rgba(245, 158, 11, 0.25); border-radius: 4px; }
            `}</style>
        </DraggableWindow>
    );
};

export default MailboxModal;
