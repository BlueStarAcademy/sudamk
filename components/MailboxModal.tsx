import React, { useState, useEffect, useCallback } from 'react';
import { UserWithStatus, Mail, ServerAction, InventoryItem } from '../types.js';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import Button from './Button.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import MailRewardItemTile from './MailRewardItemTile.js';
import { formatGoldAmountKoG, formatWalletDiamonds } from '../shared/utils/walletAmountDisplay.js';
import { CASH_SHOP_PACKAGE_KO_LABEL, type CashShopPackageId } from '../shared/constants/cashShopPackages.js';
import { isMailRewardsClaimExpired } from '../shared/utils/mailRewardsExpiry.js';
import { useKeyedAsyncAction } from '../hooks/useAsyncAction.js';
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../shared/constants/pcShellLayout.js';

interface MailboxModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void | Promise<void>;
    isTopmost?: boolean;
    embedded?: boolean;
}

type MailActionPending = 'claim-one' | 'claim-all' | 'delete-one' | 'delete-all' | null;

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

const shell =
    'rounded-2xl border border-amber-500/20 bg-gradient-to-br from-zinc-950/95 via-zinc-900/90 to-black/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';

const mailScrollClass =
    'custom-mail-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-y-contain pr-1 [-webkit-overflow-scrolling:touch]';

function renderAttachmentsBlock(m: Mail, compact?: boolean) {
    if (m.attachments == null) return null;
    const innerScroll =
        compact === true
            ? 'max-h-none overflow-visible'
            : 'h-[min(11rem,26vh)] overflow-y-auto sm:h-[min(12rem,28vh)]';

    return (
        <div className="mt-3 shrink-0 sm:mt-4">
            <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-zinc-900/90 to-black/80 p-3 shadow-lg sm:p-4">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-bold tracking-wide text-amber-100/90 sm:mb-3">
                    <span className="h-px w-8 max-w-[2rem] shrink-0 bg-gradient-to-r from-transparent to-amber-500/40" aria-hidden />
                    첨부 보상
                    <span className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-500/40" aria-hidden />
                </h4>
                {m.attachmentsClaimed ? (
                    <p className="py-5 text-center text-sm text-zinc-500 sm:py-6">수령이 완료되었습니다.</p>
                ) : isMailRewardsClaimExpired(m) ? (
                    <p className="rounded-xl border border-amber-900/40 bg-amber-950/25 px-3 py-4 text-center text-sm leading-relaxed text-amber-200/90 sm:px-4 sm:py-5">
                        수령 기간이 만료되어 보상을 받을 수 없습니다. 필요하면 이 우편을 삭제할 수 있습니다.
                    </p>
                ) : (
                    <div className={`custom-mail-scroll overflow-x-hidden pr-1 ${innerScroll}`} role="region" aria-label="첨부 보상 목록">
                        <div className="mb-3 flex flex-wrap gap-2 text-sm sm:mb-4 sm:gap-3">
                            {(m.attachments.actionPoints ?? 0) > 0 ? (
                                <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-950/30 px-2.5 py-1.5 text-[13px] font-medium text-emerald-200 sm:px-3 sm:py-2 sm:text-sm">
                                    ⚡ {m.attachments.actionPoints!.toLocaleString()} 행동력
                                </span>
                            ) : null}
                            {(m.attachments.guildCoins ?? 0) > 0 ? (
                                <span className="inline-flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-950/25 px-2.5 py-1.5 text-[13px] font-medium text-amber-100 sm:px-3 sm:py-2 sm:text-sm">
                                    <img src="/images/guild/tokken.webp" alt="" className="h-5 w-5" />
                                    {m.attachments.guildCoins!.toLocaleString()} 길드코인
                                </span>
                            ) : null}
                            {(m.attachments.researchPoints ?? 0) > 0 ? (
                                <span className="inline-flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-950/25 px-2.5 py-1.5 text-[13px] font-medium text-purple-100 sm:px-3 sm:py-2 sm:text-sm">
                                    <img src="/images/guild/button/guildlab.webp" alt="" className="h-5 w-5" />
                                    {m.attachments.researchPoints!.toLocaleString()} RP
                                </span>
                            ) : null}
                            {(m.attachments.gold ?? 0) > 0 ? (
                                <span className="inline-flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-950/25 px-2.5 py-1.5 text-[13px] font-medium text-amber-100 sm:px-3 sm:py-2 sm:text-sm">
                                    <img src="/images/icon/Gold.webp" alt="" className="h-5 w-5" />
                                    {formatGoldAmountKoG(m.attachments.gold!)} 골드
                                </span>
                            ) : null}
                            {(m.attachments.diamonds ?? 0) > 0 ? (
                                <span className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-950/25 px-2.5 py-1.5 text-[13px] font-medium text-cyan-100 sm:px-3 sm:py-2 sm:text-sm">
                                    <img src="/images/icon/Zem.webp" alt="" className="h-5 w-5" />
                                    {formatWalletDiamonds(m.attachments.diamonds!)} 다이아
                                </span>
                            ) : null}
                        </div>
                        {(() => {
                            const pkgs = m.attachments!.cashShopPackages;
                            if (!pkgs?.length) return null;
                            return (
                                <div className="mb-3 flex flex-wrap gap-2 text-[13px] sm:mb-4 sm:text-sm">
                                    {pkgs.map((p, idx) => (
                                        <span
                                            key={`${p.packageId}-${idx}`}
                                            className="inline-flex items-center gap-2 rounded-lg border border-violet-500/25 bg-violet-950/30 px-2.5 py-1.5 font-medium text-violet-100 sm:px-3 sm:py-2"
                                        >
                                            패키지 {CASH_SHOP_PACKAGE_KO_LABEL[p.packageId as CashShopPackageId] ?? p.packageId} × {p.quantity}
                                        </span>
                                    ))}
                                </div>
                            );
                        })()}
                        {(() => {
                            const rawItems = m.attachments!.items;
                            if (rawItems == null) return null;
                            const asArray = Array.isArray(rawItems)
                                ? rawItems
                                : typeof rawItems === 'object'
                                  ? Object.values(rawItems as Record<string, unknown>)
                                  : [];
                            const list = asArray.filter((x): x is InventoryItem => x != null && typeof x === 'object');
                            if (list.length === 0) return null;
                            return (
                                <div className="flex flex-wrap justify-center gap-x-3 gap-y-4 pb-1 sm:justify-start sm:gap-x-4 sm:gap-y-5">
                                    {list.map((raw, index) => (
                                        <MailRewardItemTile key={raw.id ?? `${m.id}-att-${index}`} item={raw} variant="lg" />
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
}

const MailboxModal: React.FC<MailboxModalProps> = ({ currentUser: propCurrentUser, onClose, onAction, isTopmost, embedded = false }) => {
    const { currentUserWithStatus } = useAppContext();
    const isHandheld = useIsHandheldDevice(1025);
    const mailAction = useKeyedAsyncAction();

    const currentUser = currentUserWithStatus || propCurrentUser;
    const { mail } = currentUser;

    const [detailMail, setDetailMail] = useState<Mail | null>(null);
    const [remainingTime, setRemainingTime] = useState<string | null>(null);

    const mailActionPending = mailAction.pendingKey as MailActionPending;

    useEffect(() => {
        if (!detailMail) return;
        const updated = mail.find((x) => x.id === detailMail.id);
        if (updated) {
            if (JSON.stringify(updated) !== JSON.stringify(detailMail)) {
                setDetailMail(updated);
            }
        } else {
            setDetailMail(null);
        }
    }, [mail, detailMail]);

    useEffect(() => {
        if (detailMail && !detailMail.isRead) {
            onAction({ type: 'MARK_MAIL_AS_READ', payload: { mailId: detailMail.id } });
        }
    }, [detailMail, onAction]);

    useEffect(() => {
        if (detailMail?.expiresAt) {
            const tick = () => setRemainingTime(formatRemainingTime(detailMail.expiresAt!));
            tick();
            const interval = setInterval(tick, 60000);
            return () => clearInterval(interval);
        }
        setRemainingTime(null);
    }, [detailMail]);

    const handleClaim = useCallback(() => {
        if (
            detailMail?.attachments &&
            !detailMail.attachmentsClaimed &&
            !isMailRewardsClaimExpired(detailMail)
        ) {
            void mailAction.run('claim-one', async () => {
                await onAction({ type: 'CLAIM_MAIL_ATTACHMENTS', payload: { mailId: detailMail.id } });
            });
        }
    }, [detailMail, onAction, mailAction]);

    const handleDelete = useCallback(() => {
        if (!detailMail) return;
        void mailAction.run('delete-one', async () => {
            await onAction({ type: 'DELETE_MAIL', payload: { mailId: detailMail.id } });
            setDetailMail(null);
        });
    }, [detailMail, onAction, mailAction]);

    const hasUnclaimedMail = mail.some(
        (m) => m.attachments && !m.attachmentsClaimed && !isMailRewardsClaimExpired(m)
    );
    const hasClaimedMail = mail.some((m) => m.attachmentsClaimed);

    const handleClaimAll = () => {
        void mailAction.run('claim-all', async () => {
            await onAction({ type: 'CLAIM_ALL_MAIL_ATTACHMENTS' });
        });
    };

    const handleDeleteAllClaimed = () => {
        if (window.confirm('수령 완료된 모든 메일을 삭제하시겠습니까?')) {
            void mailAction.run('delete-all', async () => {
                await onAction({ type: 'DELETE_ALL_CLAIMED_MAIL' });
                setDetailMail((d) => (d && d.attachmentsClaimed ? null : d));
            });
        }
    };

    const detailMailRewardExpired = Boolean(detailMail && isMailRewardsClaimExpired(detailMail));
    const claimDisabled =
        !detailMail?.attachments ||
        Boolean(detailMail.attachmentsClaimed) ||
        detailMailRewardExpired ||
        mailAction.isAnyPending;

    const premiumDeleteClass =
        'group relative flex min-h-[48px] min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl border border-rose-400/40 ' +
        'bg-gradient-to-b from-rose-900/95 via-red-950/98 to-zinc-950 px-3 py-3 text-[14px] font-semibold tracking-wide text-rose-50 sm:min-h-[50px] sm:px-4 sm:text-[15px] ' +
        'shadow-[0_10px_36px_-14px_rgba(225,29,72,0.55),inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.35)] ' +
        'ring-1 ring-inset ring-white/10 transition-[transform,box-shadow,border-color,filter] duration-200 ' +
        'hover:border-rose-300/55 hover:from-rose-800/95 hover:shadow-[0_14px_40px_-12px_rgba(244,63,94,0.5)] active:scale-[0.98] ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ' +
        'disabled:pointer-events-none disabled:opacity-50';

    const premiumClaimClass =
        'relative flex min-h-[48px] min-w-0 flex-[1.15] items-center justify-center gap-2 overflow-hidden rounded-2xl border border-emerald-300/50 ' +
        'bg-gradient-to-b from-emerald-400/98 via-emerald-600/96 to-emerald-950/95 px-3 py-3 text-[14px] font-bold tracking-[0.04em] text-white sm:min-h-[50px] sm:px-5 sm:text-[15px] ' +
        'shadow-[0_12px_40px_-14px_rgba(16,185,129,0.55),inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(0,0,0,0.22)] ' +
        'ring-1 ring-inset ring-white/15 transition-[transform,box-shadow,border-color,filter] duration-200 ' +
        'hover:border-emerald-200/60 hover:from-emerald-300 hover:via-emerald-500 hover:to-emerald-900 hover:shadow-[0_16px_48px_-12px_rgba(52,211,153,0.45)] active:scale-[0.98] ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ' +
        'disabled:pointer-events-none disabled:border-zinc-600/40 disabled:from-zinc-700/80 disabled:via-zinc-800/90 disabled:to-zinc-900 disabled:text-zinc-400 ' +
        'disabled:shadow-none disabled:ring-zinc-600/30';

    const detailFooter = detailMail ? (
        <div
            className={`flex w-full flex-row items-stretch gap-2.5 sm:gap-3 ${
                isHandheld ? '' : 'pt-1'
            }`}
        >
            <button type="button" onClick={handleDelete} disabled={mailAction.isAnyPending} className={premiumDeleteClass}>
                <span
                    className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent opacity-60 transition-opacity group-hover:opacity-80"
                    aria-hidden
                />
                <span className="relative">{mailActionPending === 'delete-one' ? '삭제 중...' : '삭제'}</span>
            </button>
            <button type="button" onClick={handleClaim} disabled={claimDisabled} className={premiumClaimClass}>
                <span
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.22),transparent_55%)]"
                    aria-hidden
                />
                <span className="relative drop-shadow-sm">
                    {mailActionPending === 'claim-one'
                        ? '수령 중...'
                        : detailMail.attachmentsClaimed
                          ? '수령 완료'
                          : detailMailRewardExpired
                            ? '만료됨'
                            : '보상 받기'}
                </span>
            </button>
        </div>
    ) : null;

    const listPanel = (
        <div className={`flex min-h-0 flex-1 flex-col ${shell} p-3 sm:p-4`}>
            <div className="mb-3 flex shrink-0 items-center justify-between gap-2 border-b border-amber-500/15 pb-3">
                <h3 className="bg-gradient-to-r from-amber-100 to-amber-300 bg-clip-text text-lg font-bold tracking-tight text-transparent sm:text-xl">
                    받은 우편
                </h3>
                <span className="rounded-full border border-amber-500/25 bg-black/40 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-amber-200/90">
                    {mail.length}
                </span>
            </div>
            <div className="mb-3 flex shrink-0 flex-row items-stretch gap-2">
                <Button
                    onClick={handleClaimAll}
                    disabled={!hasUnclaimedMail || mailAction.isAnyPending}
                    colorScheme="green"
                    className="!min-h-[42px] min-w-0 flex-1 !rounded-xl !py-2.5 !text-xs font-semibold shadow-lg shadow-emerald-900/20 sm:!text-sm"
                >
                    {mailActionPending === 'claim-all' ? '수령 중...' : '일괄 수령'}
                </Button>
                <Button
                    onClick={handleDeleteAllClaimed}
                    disabled={!hasClaimedMail || mailAction.isAnyPending}
                    colorScheme="red"
                    className="!min-h-[42px] min-w-0 flex-1 !rounded-xl !border !border-red-500/30 !bg-red-950/40 !px-2 !py-2 !text-[11px] leading-snug hover:!bg-red-900/50 sm:!px-3 sm:!text-sm"
                >
                    {mailActionPending === 'delete-all' ? '삭제 중...' : '수령 완료 메일 삭제'}
                </Button>
            </div>
            <ul className={mailScrollClass}>
                {mail.length === 0 ? (
                    <li className="rounded-xl border border-dashed border-white/10 py-12 text-center text-sm text-zinc-500">우편이 없습니다.</li>
                ) : (
                    mail.map((m) => {
                        const open = detailMail?.id === m.id;
                        return (
                            <li key={m.id}>
                                <button
                                    type="button"
                                    onClick={() => setDetailMail(m)}
                                    className={`w-full rounded-xl border px-3 py-3 text-left transition-all duration-200 active:scale-[0.99] sm:py-2.5 ${
                                        open
                                            ? 'border-amber-400/55 bg-gradient-to-r from-amber-950/90 via-amber-900/35 to-transparent shadow-[0_0_24px_rgba(251,191,36,0.18)]'
                                            : 'border-transparent bg-white/[0.03] hover:border-amber-500/25 hover:bg-white/[0.07]'
                                    }`}
                                >
                                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
                                        <span className="truncate font-medium text-zinc-400">{m.from}</span>
                                        {!m.isRead ? (
                                            <span className="shrink-0 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                                                New
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-zinc-100 sm:text-sm">{m.title}</p>
                                    {m.attachments && !m.attachmentsClaimed ? (
                                        <p
                                            className={`mt-1 text-[11px] font-medium ${
                                                isMailRewardsClaimExpired(m)
                                                    ? 'text-amber-500/90'
                                                    : 'text-emerald-400/90'
                                            }`}
                                        >
                                            {isMailRewardsClaimExpired(m) ? '보상 만료' : '보상 미수령'}
                                        </p>
                                    ) : m.attachments ? (
                                        <p className="mt-1 text-[11px] text-zinc-600">수령 완료</p>
                                    ) : null}
                                    <p className="mt-1.5 text-[11px] font-medium text-amber-400/70">상세 보기</p>
                                </button>
                            </li>
                        );
                    })
                )}
            </ul>
        </div>
    );

    const detailBody = detailMail ? (
        <>
            <div className="shrink-0 border-b border-amber-500/15 bg-gradient-to-r from-black/60 via-zinc-950/80 to-black/60 px-4 py-2.5 sm:px-5 sm:py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-zinc-500 sm:text-xs">
                    <span>
                        보낸 사람: <span className="font-medium text-amber-200/80">{detailMail.from}</span>
                    </span>
                    {remainingTime ? (
                        <span className="flex items-center gap-1.5">
                            <span className="h-1 w-1 rounded-full bg-amber-400/80" aria-hidden />
                            남은 시간: <span className="font-semibold tabular-nums text-amber-300">{remainingTime}</span>
                        </span>
                    ) : null}
                </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-2 sm:px-5 sm:py-4">
                <div className="custom-mail-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
                    <div className="shrink-0 rounded-xl border border-white/5 bg-black/35 p-3 text-[15px] leading-relaxed text-zinc-300 shadow-inner sm:p-4 sm:text-sm">
                        <div className="whitespace-pre-wrap">{detailMail.message}</div>
                    </div>
                    {renderAttachmentsBlock(detailMail, isHandheld)}
                </div>
                {!isHandheld ? <div className="mt-3 shrink-0 border-t border-white/5 pt-3">{detailFooter}</div> : null}
            </div>
        </>
    ) : null;

    if (embedded) {
        return (
            <div className={`${PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS} flex min-h-0 flex-1 flex-col`}>
                {detailMail ? (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setDetailMail(null)}
                            className="mb-2 shrink-0 self-start rounded-lg border border-white/15 bg-black/35 px-3 py-1.5 text-sm font-semibold text-amber-100"
                        >
                            목록으로
                        </button>
                        {detailBody}
                        <div className="mt-3 shrink-0 border-t border-white/5 pt-3">{detailFooter}</div>
                    </div>
                ) : (
                    <div className="flex min-h-0 flex-1 flex-col">{listPanel}</div>
                )}
            </div>
        );
    }

    return (
        <>
            <DraggableWindow
                title="우편함"
                onClose={onClose}
                windowId="mailbox"
                initialWidth={520}
                initialHeight={720}
                isTopmost={isTopmost && !detailMail}
                bodyScrollable={!isHandheld}
                mobileLockViewportHeight={isHandheld}
                hideFooter={isHandheld}
                mobileViewportMaxHeightVh={isHandheld ? 94 : undefined}
                mobileViewportDvhBottomGapPx={isHandheld ? 12 : undefined}
                bodyPaddingClassName={isHandheld ? '!p-1.5 !pt-1 sm:!p-2' : undefined}
            >
                <div className={`flex min-h-0 flex-1 flex-col ${isHandheld ? 'h-full' : 'h-[min(640px,calc(100vh-8rem))]'}`}>
                    {listPanel}
                    <style>{`
                        .custom-mail-scroll::-webkit-scrollbar { width: 6px; }
                        .custom-mail-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; }
                        .custom-mail-scroll::-webkit-scrollbar-thumb { background: rgba(245, 158, 11, 0.25); border-radius: 4px; }
                    `}</style>
                </div>
            </DraggableWindow>

            {detailMail ? (
                <DraggableWindow
                    title="우편 상세"
                    titleContent={
                        <span className="line-clamp-2 text-left text-base font-bold leading-tight text-amber-50 sm:text-lg">
                            {detailMail.title}
                        </span>
                    }
                    headerShowTitle
                    onClose={() => setDetailMail(null)}
                    windowId="mailboxDetail"
                initialWidth={560}
                initialHeight={640}
                isTopmost={Boolean(isTopmost)}
                bodyScrollable={!isHandheld}
                    mobileLockViewportHeight={isHandheld}
                    hideFooter
                    mobileViewportMaxHeightVh={isHandheld ? 92 : undefined}
                    mobileViewportDvhBottomGapPx={isHandheld ? 10 : undefined}
                    bodyPaddingClassName={isHandheld ? '!p-1.5 sm:!p-2' : '!p-3 sm:!p-4'}
                    skipSavedPosition
                >
                    {isHandheld ? (
                        <>
                            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                                {detailBody}
                                <style>{`
                                    .custom-mail-scroll::-webkit-scrollbar { width: 6px; }
                                    .custom-mail-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; }
                                    .custom-mail-scroll::-webkit-scrollbar-thumb { background: rgba(245, 158, 11, 0.25); border-radius: 4px; }
                                `}</style>
                            </div>
                            <div
                                className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} border-t border-amber-500/25 bg-gradient-to-t from-zinc-950 via-zinc-900/98 to-zinc-900/95 px-2.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]`}
                            >
                                {detailFooter}
                            </div>
                        </>
                    ) : (
                        <div className="flex max-h-[min(640px,calc(100vh-10rem))] min-h-[320px] flex-col overflow-hidden">
                            {detailBody}
                            <style>{`
                                .custom-mail-scroll::-webkit-scrollbar { width: 6px; }
                                .custom-mail-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; }
                                .custom-mail-scroll::-webkit-scrollbar-thumb { background: rgba(245, 158, 11, 0.25); border-radius: 4px; }
                            `}</style>
                        </div>
                    )}
                </DraggableWindow>
            ) : null}
        </>
    );
};

export default MailboxModal;
