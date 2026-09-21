import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LiveGameSession, User, Player, ServerAction } from '../types.js';
import Button from './Button.js';
import { resolveArenaSessionPolicy } from '../shared/utils/liveSessionArenaKind.js';
import { preGameCountdownDurationSeconds } from '../shared/constants/preGameCountdown.js';

interface Props {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
    layout?: 'inline' | 'window';
    isSinglePlayer?: boolean;
    isMobile?: boolean;
}

const BaseSameColorPointsBidPanel: React.FC<Props> = ({
    session,
    currentUser,
    onAction,
    layout = 'inline',
    isSinglePlayer = false,
    isMobile = false,
}) => {
    const { t } = useTranslation('game');
    const gameId = session.id;
    const locked = session.baseSameColorTieColor;
    const showCountdown = resolveArenaSessionPolicy(session).matchAxis === 'pvp';
    const { komiBids, komiBiddingDeadline, player1, player2 } = session;
    const pairLobbyOwnerId = (session.settings as { pairGame?: { pairLobbyOwnerId?: string } } | undefined)?.pairGame
        ?.pairLobbyOwnerId;
    const isPairHostBid = Boolean(pairLobbyOwnerId && currentUser.id === pairLobbyOwnerId);
    const bidP1 = komiBids?.[player1.id];
    const bidP2 = komiBids?.[player2.id];
    const myBid = komiBids?.[currentUser.id];
    const activeBidSubjectEarly = isPairHostBid ? (!bidP1 ? player1.id : !bidP2 ? player2.id : null) : null;
    const [komiValue, setKomiValue] = useState(0);
    const countdownTotalSeconds = useMemo(() => preGameCountdownDurationSeconds(session), [
        session.komiBiddingDeadline,
        session.preGameCountdownStartAt,
        session.nigiriStartTime,
    ]);
    const [timer, setTimer] = useState(countdownTotalSeconds);
    const [submitBusy, setSubmitBusy] = useState(false);
    const isSubmittingRef = useRef(false);
    const latest = useRef({ session, onAction, currentUser, komiValue });
    const didAutoSubmitRef = useRef(false);
    useEffect(() => {
        latest.current = { session, onAction, currentUser, komiValue };
    });

    const myStoredChoice = session.baseStoneColorChoices?.[currentUser.id];
    const stoneLabel =
        locked === Player.Black ? t('baseSameColorPoints.blackStone') : locked === Player.White ? t('baseSameColorPoints.whiteStone') : t('baseSameColorPoints.selectedStone');

    const timerPaused = (!isPairHostBid && myBid) || (isPairHostBid && bidP1 && bidP2);
    useEffect(() => {
        if (timerPaused) {
            setTimer(0);
            return;
        }
        if (!showCountdown || !komiBiddingDeadline) {
            setTimer(countdownTotalSeconds);
            return;
        }
        const id = setInterval(() => {
            setTimer(Math.max(0, Math.ceil((komiBiddingDeadline - Date.now()) / 1000)));
        }, 250);
        return () => clearInterval(id);
    }, [timerPaused, komiBiddingDeadline, showCountdown, countdownTotalSeconds]);

    useEffect(() => {
        setKomiValue(0);
    }, [activeBidSubjectEarly]);

    const handleSubmit = useCallback(() => {
        const { session: s, onAction: act, currentUser: u, komiValue: kv } = latest.current;
        const ownerId = (s.settings as { pairGame?: { pairLobbyOwnerId?: string } } | undefined)?.pairGame?.pairLobbyOwnerId;
        const isHost = Boolean(ownerId && u.id === ownerId);
        const bp1 = s.komiBids?.[s.player1.id];
        const bp2 = s.komiBids?.[s.player2.id];
        const subjectId = isHost ? (!bp1 ? s.player1.id : !bp2 ? s.player2.id : null) : u.id;
        if (!locked || (subjectId ? s.komiBids?.[subjectId] : true) || isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setSubmitBusy(true);
        act({
            type: 'UPDATE_KOMI_BID',
            payload: {
                gameId: s.id,
                bid: { color: locked, komi: kv },
                ...(isHost && subjectId ? { bidForUserId: subjectId } : {}),
            },
        });
        setTimeout(() => {
            isSubmittingRef.current = false;
            setSubmitBusy(false);
        }, isHost ? 600 : 4000);
    }, [locked]);

    useEffect(() => {
        if (timerPaused) {
            setSubmitBusy(false);
            isSubmittingRef.current = false;
        }
    }, [timerPaused]);

    useEffect(() => {
        didAutoSubmitRef.current = false;
    }, [session.id, session.gameStatus, komiBiddingDeadline]);

    useEffect(() => {
        if (timerPaused || !showCountdown || !komiBiddingDeadline || isPairHostBid) return;
        if (timer <= 0 && !didAutoSubmitRef.current) {
            didAutoSubmitRef.current = true;
            handleSubmit();
        }
    }, [timer, timerPaused, showCountdown, komiBiddingDeadline, handleSubmit, isPairHostBid]);

    const adjust = (d: number) => {
        setKomiValue((v) => Math.max(0, Math.min(100, v + d)));
    };

    const komiWindowShell =
        'rounded-xl border border-amber-400/20 bg-gradient-to-b from-slate-900/95 via-slate-950/98 to-black/90 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_20px_50px_-20px_rgba(0,0,0,0.85)]';

    const btnSmall = `rounded-lg border border-white/12 bg-white/5 px-1 py-1.5 text-[10px] font-bold text-amber-50/95 transition-colors hover:bg-amber-500/15 disabled:opacity-40 sm:text-xs`;

    const guide =
        myStoredChoice != null
            ? t(layout === 'inline' ? 'baseSameColorPoints.sameColorGuideCompact' : 'baseSameColorPoints.sameColorGuide', {
                  stone: stoneLabel,
              })
            : t(
                  layout === 'inline'
                      ? 'baseSameColorPoints.sameColorGuideGenericCompact'
                      : 'baseSameColorPoints.sameColorGuideGeneric',
              );

    const waitShell = (title: string, hint: string, titleClass: string) => {
        const wait = (
            <div className={`${komiWindowShell} ${layout === 'inline' ? 'px-2 py-1.5' : 'px-3 py-4'} text-center`}>
                <p className={`font-semibold ${titleClass} ${layout === 'inline' ? 'text-[11px] leading-tight' : 'text-sm'}`}>
                    {title}
                </p>
                <p className={`text-stone-400 ${layout === 'inline' ? 'mt-0.5 text-[10px] leading-tight' : 'mt-2 text-xs'}`}>
                    {hint}
                </p>
            </div>
        );
        return layout === 'inline' ? <div className="w-full min-w-0">{wait}</div> : wait;
    };

    if (!locked) return null;

    if (pairLobbyOwnerId && !isPairHostBid) {
        return waitShell(t('baseSameColorPoints.hostSetting'), t('baseSameColorPoints.pleaseWait'), 'text-sky-200/95');
    }

    if (isPairHostBid && bidP1 && bidP2) {
        return waitShell(t('baseSameColorPoints.bothSubmitted'), t('baseSameColorPoints.proceedingNext'), 'text-emerald-300/95');
    }

    if (myBid && !isPairHostBid) {
        return waitShell(t('baseSameColorPoints.submitted'), t('baseSameColorPoints.waitingOpponent'), 'text-emerald-300/95');
    }

    const stepBtn =
        layout === 'inline'
            ? 'inline-flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-md border border-white/12 bg-white/5 px-1.5 text-[11px] font-black tabular-nums text-amber-50/95 transition-colors hover:bg-amber-500/15 disabled:opacity-40'
            : btnSmall;

    const compactControls = (
        <div className="flex min-w-0 items-center gap-1">
            <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                    locked === Player.Black ? 'border-stone-800 bg-stone-900' : 'border-stone-300 bg-stone-200'
                }`}
                title={stoneLabel}
            >
                <span className={locked === Player.Black ? 'text-stone-100' : 'text-stone-900'}>
                    {locked === Player.Black ? '●' : '○'}
                </span>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button type="button" className={stepBtn} onClick={() => adjust(-5)} disabled={komiValue <= 0} aria-label="-5">
                    −5
                </button>
                <button type="button" className={stepBtn} onClick={() => adjust(-1)} disabled={komiValue <= 0} aria-label="-1">
                    −1
                </button>
                <input
                    type="number"
                    min={0}
                    max={100}
                    inputMode="numeric"
                    value={komiValue}
                    onChange={(e) => {
                        const n = Math.floor(Number(e.target.value));
                        if (!Number.isFinite(n)) setKomiValue(0);
                        else setKomiValue(Math.max(0, Math.min(100, n)));
                    }}
                    className={`w-12 shrink-0 rounded-md border border-amber-500/40 bg-black/50 px-1 py-1 text-center font-mono font-bold tabular-nums text-amber-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                        isMobile ? 'h-8 text-base leading-none' : 'h-8 text-sm'
                    }`}
                    aria-label={t('baseSameColorPoints.pointsUnit')}
                />
                <span className="shrink-0 text-[10px] font-semibold text-stone-400">{t('baseSameColorPoints.pointsUnit')}</span>
                <button type="button" className={stepBtn} onClick={() => adjust(1)} disabled={komiValue >= 100} aria-label="+1">
                    +1
                </button>
                <button type="button" className={stepBtn} onClick={() => adjust(5)} disabled={komiValue >= 100} aria-label="+5">
                    +5
                </button>
            </div>
            <button
                type="button"
                onClick={handleSubmit}
                disabled={submitBusy}
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-amber-400/45 bg-amber-800/85 px-2.5 text-[11px] font-bold text-amber-50 disabled:opacity-40"
            >
                {t('baseSameColorPoints.complete')}
            </button>
        </div>
    );

    const compactBody = (
        <div className={`${komiWindowShell} flex w-full min-w-0 flex-col justify-center gap-1 px-2 py-1.5`}>
            {isPairHostBid && activeBidSubjectEarly && (
                <p className="truncate text-center text-[10px] font-bold leading-tight text-amber-200/90">
                    {activeBidSubjectEarly === player1.id
                        ? t('baseSameColorPoints.playerBid', { nickname: player1.nickname })
                        : t('baseSameColorPoints.playerBid', { nickname: player2.nickname })}
                </p>
            )}
            <div className="flex min-w-0 items-center gap-1.5">
                <p className="min-w-0 flex-1 truncate text-[10px] font-medium leading-tight text-stone-300">{guide}</p>
                {showCountdown && komiBiddingDeadline != null && (
                    <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-amber-100">{timer}</span>
                )}
            </div>
            {showCountdown && komiBiddingDeadline != null && (
                <div className="h-1 w-full overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-lime-300"
                        style={{ width: `${(timer / countdownTotalSeconds) * 100}%`, transition: 'width 0.35s linear' }}
                    />
                </div>
            )}
            {compactControls}
        </div>
    );

    const body = (
        <div className={`${komiWindowShell} flex w-full min-w-0 flex-col gap-2 px-2 py-2 sm:px-3`}>
            {isPairHostBid && activeBidSubjectEarly && (
                <p className="text-center text-[10px] font-bold text-amber-200/90 sm:text-[11px]">
                    {activeBidSubjectEarly === player1.id
                        ? t('baseSameColorPoints.playerBid', { nickname: player1.nickname })
                        : t('baseSameColorPoints.playerBid', { nickname: player2.nickname })}
                </p>
            )}
            <p className="text-center text-[10px] font-medium leading-snug text-stone-300 sm:text-[11px]">{guide}</p>
            {showCountdown && komiBiddingDeadline != null && (
                <>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-lime-300"
                            style={{ width: `${(timer / countdownTotalSeconds) * 100}%`, transition: 'width 0.35s linear' }}
                        />
                    </div>
                    <p className="text-center font-mono text-lg font-bold tabular-nums text-amber-100">{timer}</p>
                </>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
                <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
                        locked === Player.Black ? 'border-stone-800 bg-stone-900' : 'border-stone-300 bg-stone-200'
                    }`}
                    title={stoneLabel}
                >
                    <span className={locked === Player.Black ? 'text-stone-100' : 'text-stone-900'}>
                        {locked === Player.Black ? '●' : '○'}
                    </span>
                </div>
                <input
                    type="number"
                    min={0}
                    max={100}
                    value={komiValue}
                    onChange={(e) => {
                        const n = Math.floor(Number(e.target.value));
                        if (!Number.isFinite(n)) setKomiValue(0);
                        else setKomiValue(Math.max(0, Math.min(100, n)));
                    }}
                    className="w-16 rounded-lg border border-amber-500/40 bg-black/50 px-2 py-1 text-center font-mono text-sm font-bold text-amber-100 tabular-nums"
                />
                <span className="text-[11px] text-stone-400">{t('baseSameColorPoints.pointsUnit')}</span>
            </div>
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-6">
                <button type="button" className={btnSmall} onClick={() => adjust(-5)}>
                    -5
                </button>
                <button type="button" className={btnSmall} onClick={() => adjust(-1)}>
                    -1
                </button>
                <button type="button" className={btnSmall} onClick={() => adjust(1)}>
                    +1
                </button>
                <button type="button" className={btnSmall} onClick={() => adjust(5)}>
                    +5
                </button>
                <button type="button" className={btnSmall} onClick={() => setKomiValue(0)}>
                    {t('baseSameColorPoints.reset')}
                </button>
                <Button
                    onClick={handleSubmit}
                    disabled={submitBusy}
                    className="!min-h-[2rem] !rounded-lg !border !border-amber-400/40 !bg-amber-800/80 !px-2 !py-1 !text-[10px] !font-bold !text-amber-50 sm:!text-xs"
                >
                    {t('baseSameColorPoints.complete')}
                </Button>
            </div>
        </div>
    );

    if (layout === 'inline') {
        return <div className="flex w-full min-w-0 max-w-full flex-col">{compactBody}</div>;
    }
    return body;
};

export default BaseSameColorPointsBidPanel;
