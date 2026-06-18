import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tx } from '../../shared/i18n/runtimeText.js';
import { useTranslation } from 'react-i18next';
import { LiveGameSession, ServerAction, User } from '../../types.js';
import Button from '../Button.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';
import { PRE_GAME_PVP_COUNTDOWN_SECONDS } from '../../shared/constants/preGameCountdown.js';

type BaseCaptureMixBidFooterStripProps = {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void | Promise<unknown>;
    isMobile: boolean;
};

const stepButtons = [10, 5, 3, 1] as const;

const BaseCaptureMixBidFooterStrip: React.FC<BaseCaptureMixBidFooterStripProps> = ({
    const { t } = useTranslation('game');
    session,
    currentUser,
    onAction,
    isMobile,
}) => {
    const { player1, player2, bids, biddingRound, captureBidDeadline, settings, captureFirstRoundTieBidSnapshot } = session;
    const [localBid, setLocalBid] = useState(1);
    const [countdown, setCountdown] = useState(PRE_GAME_PVP_COUNTDOWN_SECONDS);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const lastBiddingRoundRef = useRef(biddingRound);
    const latestRef = useRef({ session, currentUser, onAction });

    useEffect(() => {
        latestRef.current = { session, currentUser, onAction };
    }, [session, currentUser, onAction]);

    useEffect(() => {
        if (biddingRound !== lastBiddingRoundRef.current) {
            setLocalBid(1);
            setIsSubmitting(false);
            lastBiddingRoundRef.current = biddingRound;
        }
    }, [biddingRound]);

    const pairGame = settings.pairGame;
    const myPairTeam = useMemo(() => {
        if (!pairGame) return null;
        if (pairGame.teamA.members.some((m) => m.kind === 'user' && m.id === currentUser.id)) return 'teamA' as const;
        if (pairGame.teamB.members.some((m) => m.kind === 'user' && m.id === currentUser.id)) return 'teamB' as const;
        return null;
    }, [pairGame, currentUser.id]);

    const pairCaptainId = useMemo(() => {
        if (!pairGame || !myPairTeam) return null;
        return pairGame[myPairTeam].members.find((m) => m.kind === 'user')?.id ?? null;
    }, [pairGame, myPairTeam]);

    const isPairBidViewer = Boolean(pairGame && myPairTeam);
    const canSubmitPairBid = !isPairBidViewer || pairCaptainId === currentUser.id;
    const myBidSubjectId = myPairTeam === 'teamA' ? player1.id : myPairTeam === 'teamB' ? player2.id : currentUser.id;
    const opponentSubjectId =
        myPairTeam === 'teamA' ? player2.id : myPairTeam === 'teamB' ? player1.id : currentUser.id === player1.id ? player2.id : player1.id;
    const opponent = opponentSubjectId === player1.id ? player1 : player2;
    const myBid = bids?.[myBidSubjectId];
    const opponentBid = bids?.[opponentSubjectId];
    const bothHaveBid = typeof myBid === 'number' && typeof opponentBid === 'number';
    const hasBidCountdown = Boolean(captureBidDeadline) && resolveArenaSessionPolicy(session).matchAxis === 'pvp';

    const baseTarget = settings.captureTarget || 20;
    const maxBid = Math.max(1, baseTarget - 1);
    const effectiveLocalBid = Math.min(localBid, maxBid);
    const whiteTargetIfWin = Math.max(1, baseTarget - effectiveLocalBid);

    useEffect(() => {
        setLocalBid((prev) => Math.max(1, Math.min(maxBid, prev)));
    }, [maxBid]);

    const handleBidSubmit = useCallback(() => {
        const { session: s, currentUser: u, onAction: act } = latestRef.current;
        const pg = s.settings.pairGame;
        const team =
            pg?.teamA.members.some((m) => m.kind === 'user' && m.id === u.id)
                ? 'teamA'
                : pg?.teamB.members.some((m) => m.kind === 'user' && m.id === u.id)
                  ? 'teamB'
                  : null;
        const subjectId = team === 'teamA' ? s.player1.id : team === 'teamB' ? s.player2.id : u.id;
        const captainId = team ? pg?.[team].members.find((m) => m.kind === 'user')?.id : null;
        const myCurrentBid = s.bids?.[subjectId];
        if ((team && captainId !== u.id) || typeof myCurrentBid === 'number' || isSubmitting) return;
        setIsSubmitting(true);
        void act({ type: 'UPDATE_CAPTURE_BID', payload: { gameId: s.id, bid: localBid } });
        window.setTimeout(() => setIsSubmitting(false), 4000);
    }, [isSubmitting, localBid]);

    useEffect(() => {
        if (typeof myBid === 'number' || !hasBidCountdown || !captureBidDeadline) {
            setCountdown(0);
            return;
        }
        const timerId = window.setInterval(() => {
            const remaining = Math.max(0, Math.ceil((captureBidDeadline - Date.now()) / 1000));
            setCountdown(remaining);
            if (remaining <= 0) window.clearInterval(timerId);
        }, 1000);
        return () => window.clearInterval(timerId);
    }, [myBid, hasBidCountdown, captureBidDeadline]);

    const adjustBid = useCallback(
        (amount: number) => {
            if (typeof myBid === 'number') return;
            setLocalBid((prev) => Math.max(1, Math.min(maxBid, prev + amount)));
        },
        [myBid, maxBid],
    );

    const progressPercent = useMemo(
        () => Math.max(0, Math.min(100, (countdown / PRE_GAME_PVP_COUNTDOWN_SECONDS) * 100)),
        [countdown],
    );

    const viewerInGame = currentUser.id === player1.id || currentUser.id === player2.id || Boolean(myPairTeam);

    const firstRoundSnapP1 = captureFirstRoundTieBidSnapshot?.[player1.id];
    const firstRoundSnapP2 = captureFirstRoundTieBidSnapshot?.[player2.id];
    const showFirstRoundBidSnapshot =
        biddingRound === 2 &&
        typeof firstRoundSnapP1 === 'number' &&
        typeof firstRoundSnapP2 === 'number';

    const firstRoundSnapshotRow = showFirstRoundBidSnapshot ? (
        <div className="flex w-full min-w-0 flex-col items-center gap-1 rounded-lg border border-amber-500/20 bg-black/25 px-2 py-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400/90">{t('baseCaptureMix.round1')}</span>
            <div className="flex w-full min-w-0 items-center justify-center gap-3">
                <div className="flex min-w-0 flex-col items-center rounded-md border border-white/10 bg-black/35 px-2.5 py-1 text-center">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{player1.nickname}</span>
                    <span className="font-mono text-lg font-black tabular-nums text-amber-200/90">{firstRoundSnapP1}</span>
                </div>
                <span className="text-[10px] font-black text-slate-600">VS</span>
                <div className="flex min-w-0 flex-col items-center rounded-md border border-white/10 bg-black/35 px-2.5 py-1 text-center">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500">{player2.nickname}</span>
                    <span className="font-mono text-lg font-black tabular-nums text-amber-200/90">{firstRoundSnapP2}</span>
                </div>
            </div>
        </div>
    ) : null;

    if (!viewerInGame) {
        return (
            <div className="flex w-full min-w-0 items-center justify-center rounded-xl border border-slate-600/50 bg-gradient-to-r from-slate-950/95 via-zinc-950/90 to-slate-950/95 px-3 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <p className="text-[11px] font-semibold tracking-wide text-slate-400 sm:text-xs">{t('baseCaptureMix.waitingBothBids')}</p>
            </div>
        );
    }

    if (bothHaveBid) {
        const p1Bid = bids![player1.id]!;
        const p2Bid = bids![player2.id]!;
        const isTie = p1Bid === p2Bid;
        let winnerLine = '';
        if (!isTie) {
            const winner = p1Bid > p2Bid ? player1 : player2;
            const wBid = Math.max(p1Bid, p2Bid);
            winnerLine = t('baseCaptureMix.winnerLine', { name: winner.nickname, bid: wBid, target: Math.max(1, baseTarget - wBid) });
        } else {
            const sameNumericTieAsFirst =
                biddingRound === 2 &&
                typeof firstRoundSnapP1 === 'number' &&
                p1Bid === firstRoundSnapP1 &&
                p2Bid === firstRoundSnapP1;
            winnerLine =
                biddingRound === 2
                    ? sameNumericTieAsFirst
                        ? t('baseCaptureMix.tieRandomBoth')
                        : t('baseCaptureMix.tieRandom')
                    : t('baseCaptureMix.tieRebid');
        }
        return (
            <div className="flex w-full min-w-0 flex-col gap-2 rounded-xl border border-amber-400/25 bg-gradient-to-br from-zinc-950 via-slate-950 to-zinc-950 px-3 py-2.5 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.05)] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                {firstRoundSnapshotRow}
                <div className="flex min-w-0 flex-1 items-center justify-center gap-3 sm:justify-start">
                    <div className="flex min-w-0 flex-col items-center rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-center sm:px-4">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                            {player1.nickname}
                            {biddingRound === 2 ? t('baseCaptureMix.round2Suffix') : ''}
                        </span>
                        <span className="font-mono text-xl font-black tabular-nums text-amber-200">{p1Bid}</span>
                    </div>
                    <span className="text-xs font-black text-slate-600">VS</span>
                    <div className="flex min-w-0 flex-col items-center rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-center sm:px-4">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                            {player2.nickname}
                            {biddingRound === 2 ? t('baseCaptureMix.round2Suffix') : ''}
                        </span>
                        <span className="font-mono text-xl font-black tabular-nums text-amber-200">{p2Bid}</span>
                    </div>
                </div>
                <div className="min-w-0 flex-1 text-center sm:text-right">
                    <p className="text-[11px] font-semibold leading-snug text-amber-100/95 sm:text-xs">{winnerLine}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{isTie && biddingRound === 1 ? t('baseCaptureMix.pleaseWait') : t('baseCaptureMix.proceedingNext')}</p>
                </div>
            </div>
        );
    }

    if (typeof myBid === 'number') {
        return (
            <div className="flex w-full min-w-0 flex-col gap-2 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/50 via-slate-950 to-slate-950 px-3 py-2 shadow-[inset_0_1px_0_rgba(16,185,129,0.12)]">
                {firstRoundSnapshotRow}
                <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="relative flex h-2 w-2 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                    <span className="text-[11px] font-bold text-emerald-200/95 sm:text-xs">{t('baseCaptureMix.bidConfirmed', { bid: myBid })}</span>
                </div>
                <p className="min-w-0 truncate text-right text-[10px] text-slate-400 sm:text-[11px]">{t('baseCaptureMix.waitingOpponentBid', { name: opponent.nickname })}</p>
                </div>
            </div>
        );
    }

    const buttonsDisabled = typeof myBid === 'number' || !canSubmitPairBid;

    const stepBtnClass =
        'min-h-[2.1rem] rounded-lg border px-0 text-[12px] font-black tabular-nums shadow-sm transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35 sm:min-h-[2rem] sm:text-[11px]';

    const stepper = (
        <div className="grid w-full max-w-[19rem] shrink-0 grid-cols-4 gap-1.5 sm:max-w-[20.5rem]">
            {stepButtons.map((n) => (
                <button
                    key={`p${n}`}
                    type="button"
                    disabled={buttonsDisabled || localBid + n > maxBid}
                    onClick={() => adjustBid(n)}
                    className={`${stepBtnClass} border-amber-500/40 bg-gradient-to-b from-amber-200/20 to-amber-950/35 text-amber-50 hover:border-amber-300/60 hover:from-amber-200/30`}
                >
                    +{n}
                </button>
            ))}
            {stepButtons.map((n) => (
                <button
                    key={`m${n}`}
                    type="button"
                    disabled={buttonsDisabled || localBid - n < 1}
                    onClick={() => adjustBid(-n)}
                    className={`${stepBtnClass} border-slate-600/85 bg-gradient-to-b from-slate-800 to-black text-slate-100 hover:border-slate-500`}
                >
                    −{n}
                </button>
            ))}
        </div>
    );

    return (
        <div
            className={`flex w-full min-w-0 flex-col gap-2 rounded-2xl border border-amber-400/25 bg-gradient-to-b from-[#0f141c] via-[#111827] to-[#080a0e] shadow-[0_12px_40px_-16px_rgba(0,0,0,0.78),inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-amber-500/10 ${isMobile ? 'p-2' : 'p-2.5'}`}
        >
            {firstRoundSnapshotRow}
            {/* 한 덩어리: 기본 · 큰 제시 숫자 · 확정을 가깝게 한 줄(줄바꿈 시에도 중앙 정렬) */}
            <div className="mx-auto flex w-full max-w-[min(100%,28rem)] flex-wrap items-stretch justify-center gap-2 sm:max-w-[min(100%,32rem)] sm:gap-2.5">
                <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-xl border border-cyan-400/30 bg-gradient-to-b from-cyan-950/60 to-slate-950/80 px-2 py-2 shadow-inner">
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-200/80">{t('baseCaptureMix.defaultLabel')}</span>
                    <span className="mt-0.5 font-mono text-xl font-black tabular-nums leading-none text-cyan-50 sm:text-2xl">{baseTarget}</span>
                </div>

                <div className="flex min-w-[9.5rem] flex-1 basis-[10rem] flex-col justify-center rounded-xl border-2 border-amber-400/45 bg-gradient-to-b from-black/80 via-amber-950/25 to-black/90 px-3 py-2 shadow-[0_0_24px_-8px_rgba(251,191,36,0.22),inset_0_1px_0_rgba(255,255,255,0.06)] sm:min-w-[11rem] sm:px-3.5 sm:py-2.5">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200/90">{t('baseCaptureMix.bidLabel')}</span>
                        {hasBidCountdown ? (
                            <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-amber-200">{countdown}s</span>
                        ) : (
                            <span className="text-[10px] font-semibold text-slate-500">{t('baseCaptureMix.unlimited')}</span>
                        )}
                    </div>
                    <div className="mt-1 flex items-end justify-center gap-1">
                        <span className="font-mono text-[2.35rem] font-black leading-none tracking-tight text-amber-100 sm:text-[2.75rem]">
                            {effectiveLocalBid}
                        </span>
                        <span className="pb-1 text-sm font-bold text-amber-200/70">{t('baseCaptureMix.pointsUnit')}</span>
                    </div>
                    {hasBidCountdown ? (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 transition-[width] duration-1000 linear"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    ) : null}
                </div>

                <Button
                    bare
                    onClick={handleBidSubmit}
                    disabled={isSubmitting || buttonsDisabled}
                    className={[
                        'flex min-h-[4.5rem] min-w-[5.75rem] shrink-0 items-center justify-center rounded-xl border px-2.5 text-center shadow-lg transition sm:min-h-[4.75rem] sm:min-w-[6.25rem]',
                        isSubmitting || buttonsDisabled
                            ? 'cursor-not-allowed border-slate-700 bg-slate-800/85 text-slate-500 opacity-60'
                            : 'border-amber-300/55 bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 text-slate-950 hover:brightness-105 active:scale-[0.98]',
                    ].join(' ')}
                >
                    <span className="text-center text-[12px] font-black leading-snug tracking-wide sm:text-[13px]">
                        {isSubmitting ? t('baseCaptureMix.submitting') : !canSubmitPairBid ? t('baseCaptureMix.hostBid') : t('baseCaptureMix.confirmBid')}
                    </span>
                </Button>
            </div>

            <p className="mx-auto mt-1.5 max-w-[min(100%,26rem)] text-center text-[10px] leading-snug text-slate-400 sm:text-[11px]">
                {t('baseCaptureMix.blackTargetHint', { target: whiteTargetIfWin, base: baseTarget })}
            </p>

            <div className="mx-auto mt-2 flex w-full justify-center border-t border-white/[0.06] pt-2">{stepper}</div>
        </div>
    );
};

export default BaseCaptureMixBidFooterStrip;
