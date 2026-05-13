import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LiveGameSession, User, Player, ServerAction } from '../types.js';
import Button from './Button.js';
import { resolveArenaSessionPolicy } from '../shared/utils/liveSessionArenaKind.js';
import { PRE_GAME_PVP_COUNTDOWN_SECONDS } from '../shared/constants/preGameCountdown.js';

const BID_SEC = PRE_GAME_PVP_COUNTDOWN_SECONDS;

interface Props {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
    layout?: 'inline' | 'window';
    isSinglePlayer?: boolean;
}

const BaseSameColorPointsBidPanel: React.FC<Props> = ({
    session,
    currentUser,
    onAction,
    layout = 'inline',
    isSinglePlayer = false,
}) => {
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
    const [timer, setTimer] = useState(BID_SEC);
    const [submitBusy, setSubmitBusy] = useState(false);
    const isSubmittingRef = useRef(false);
    const latest = useRef({ session, onAction, currentUser, komiValue });
    const didAutoSubmitRef = useRef(false);
    useEffect(() => {
        latest.current = { session, onAction, currentUser, komiValue };
    });

    const myStoredChoice = session.baseStoneColorChoices?.[currentUser.id];
    const stoneLabel =
        locked === Player.Black ? '검은돌' : locked === Player.White ? '흰돌' : '선택한 돌';

    const timerPaused = (!isPairHostBid && myBid) || (isPairHostBid && bidP1 && bidP2);
    useEffect(() => {
        if (timerPaused) {
            setTimer(0);
            return;
        }
        if (!showCountdown || !komiBiddingDeadline) {
            setTimer(BID_SEC);
            return;
        }
        const id = setInterval(() => {
            setTimer(Math.max(0, Math.ceil((komiBiddingDeadline - Date.now()) / 1000)));
        }, 250);
        return () => clearInterval(id);
    }, [timerPaused, komiBiddingDeadline, showCountdown]);

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

    if (!locked) return null;

    if (pairLobbyOwnerId && !isPairHostBid) {
        const waitGuest = (
            <div className={`${komiWindowShell} px-3 py-4 text-center`}>
                <p className="text-sm font-semibold text-sky-200/95">방장이 점수(덤) 설정을 진행합니다</p>
                <p className="mt-2 text-xs text-stone-400">잠시만 기다려 주세요.</p>
            </div>
        );
        return layout === 'inline' ? <div className="w-full min-w-0">{waitGuest}</div> : waitGuest;
    }

    if (isPairHostBid && bidP1 && bidP2) {
        const waitBoth = (
            <div className={`${komiWindowShell} px-3 py-4 text-center`}>
                <p className="text-sm font-semibold text-emerald-300/95">양쪽 점수 설정을 전송했습니다</p>
                <p className="mt-2 text-xs text-stone-400">다음 단계로 진행 중입니다.</p>
            </div>
        );
        return layout === 'inline' ? <div className="w-full min-w-0">{waitBoth}</div> : waitBoth;
    }

    if (myBid && !isPairHostBid) {
        const wait = (
            <div className={`${komiWindowShell} px-3 py-4 text-center`}>
                <p className="text-sm font-semibold text-emerald-300/95">점수 설정을 전송했습니다</p>
                <p className="mt-2 text-xs text-stone-400">상대 설정을 기다리는 중입니다.</p>
            </div>
        );
        return layout === 'inline' ? <div className="w-full min-w-0">{wait}</div> : wait;
    }

    const guide =
        myStoredChoice != null
            ? `서로 같은 돌을 골랐습니다. ${stoneLabel}로 두기 위해 몇 점을 상대방에게 줄까요?`
            : '상대와 같은 돌을 선택했습니다. 제시할 점수를 정하세요.';

    const body = (
        <div className={`${komiWindowShell} flex w-full min-w-0 flex-col gap-2 px-2 py-2 sm:px-3`}>
            {isPairHostBid && activeBidSubjectEarly && (
                <p className="text-center text-[10px] font-bold text-amber-200/90 sm:text-[11px]">
                    {activeBidSubjectEarly === player1.id
                        ? `${player1.nickname} 측 점수 제시`
                        : `${player2.nickname} 측 점수 제시`}
                </p>
            )}
            <p className="text-center text-[10px] font-medium leading-snug text-stone-300 sm:text-[11px]">{guide}</p>
            {showCountdown && komiBiddingDeadline != null && (
                <>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-lime-300"
                            style={{ width: `${(timer / BID_SEC) * 100}%`, transition: 'width 0.35s linear' }}
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
                <span className="text-[11px] text-stone-400">집</span>
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
                    초기화
                </button>
                <Button
                    onClick={handleSubmit}
                    disabled={submitBusy}
                    className="!min-h-[2rem] !rounded-lg !border !border-amber-400/40 !bg-amber-800/80 !px-2 !py-1 !text-[10px] !font-bold !text-amber-50 sm:!text-xs"
                >
                    완료
                </Button>
            </div>
        </div>
    );

    if (layout === 'inline') {
        return <div className="flex w-full min-w-0 max-w-full flex-col gap-1">{body}</div>;
    }
    return body;
};

export default BaseSameColorPointsBidPanel;
