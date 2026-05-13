import React, { useEffect, useState } from 'react';
import { LiveGameSession, User, Player, ServerAction } from '../types.js';
import { resolveArenaSessionPolicy } from '../shared/utils/liveSessionArenaKind.js';
import { PRE_GAME_PVP_COUNTDOWN_SECONDS } from '../shared/constants/preGameCountdown.js';

const COLOR_CHOICE_SEC = PRE_GAME_PVP_COUNTDOWN_SECONDS;

const komiWindowShell =
    'rounded-xl border border-amber-400/20 bg-gradient-to-b from-slate-900/95 via-slate-950/98 to-black/90 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_20px_50px_-20px_rgba(0,0,0,0.85)]';

interface Props {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
    layout?: 'inline' | 'window';
    isSinglePlayer?: boolean;
}

const BaseStoneColorChoicePanel: React.FC<Props> = ({
    session,
    currentUser,
    onAction,
    layout = 'inline',
    isSinglePlayer = false,
}) => {
    const gameId = session.id;
    const showCountdown = resolveArenaSessionPolicy(session).matchAxis === 'pvp';
    const pairLobbyOwnerId = (session.settings as { pairGame?: { pairLobbyOwnerId?: string } } | undefined)?.pairGame
        ?.pairLobbyOwnerId;
    const isPairHostChoice = Boolean(pairLobbyOwnerId && currentUser.id === pairLobbyOwnerId);
    const { player1, player2 } = session;
    const choiceP1 = session.baseStoneColorChoices?.[player1.id] ?? null;
    const choiceP2 = session.baseStoneColorChoices?.[player2.id] ?? null;
    const myChoice = isPairHostChoice ? null : session.baseStoneColorChoices?.[currentUser.id] ?? null;
    const [timer, setTimer] = useState(COLOR_CHOICE_SEC);

    const colorChoicePhaseDone = isPairHostChoice ? choiceP1 != null && choiceP2 != null : myChoice != null;

    useEffect(() => {
        if (colorChoicePhaseDone) {
            setTimer(0);
            return;
        }
        const d = session.baseColorChoiceDeadline;
        if (!d || !showCountdown) {
            setTimer(COLOR_CHOICE_SEC);
            return;
        }
        const tick = () => setTimer(Math.max(0, Math.ceil((d - Date.now()) / 1000)));
        tick();
        const id = setInterval(tick, 250);
        return () => clearInterval(id);
    }, [colorChoicePhaseDone, session.baseColorChoiceDeadline, showCountdown]);

    const btnBase = `rounded-lg border text-center font-bold transition-colors ${
        isSinglePlayer
            ? 'border-amber-500/50 bg-amber-900/40 text-amber-50 hover:bg-amber-800/45'
            : 'border-cyan-400/45 bg-cyan-950/50 text-cyan-50 hover:bg-cyan-900/45'
    } min-h-[2.6rem] w-11 shrink-0 px-1.5 py-2 text-sm sm:w-12 sm:px-2 sm:text-base`;

    if (pairLobbyOwnerId && !isPairHostChoice) {
        const waitGuest = (
            <div className={`${komiWindowShell} flex w-full min-w-0 flex-col gap-2 px-2 py-3 sm:px-3`}>
                <p className="text-center text-[11px] font-semibold text-sky-200/95 sm:text-xs">방장이 양쪽 선호 돌을 선택합니다.</p>
                <p className="text-center text-[10px] text-stone-400 sm:text-[11px]">잠시만 기다려 주세요.</p>
            </div>
        );
        return layout === 'inline' ? <div className="flex w-full min-w-0 max-w-full flex-col gap-1">{waitGuest}</div> : waitGuest;
    }

    const renderChoiceRow = (label: string, subjectId: string, stored: typeof choiceP1) => (
        <div className="flex w-full min-w-0 flex-col gap-1.5">
            <p className="text-center text-[10px] font-bold text-amber-100/90 sm:text-[11px]">{label}</p>
            <div className="flex w-full min-w-0 justify-center gap-2">
                <button
                    type="button"
                    disabled={stored != null}
                    onClick={() =>
                        stored == null &&
                        onAction({
                            type: 'SUBMIT_BASE_STONE_COLOR_CHOICE',
                            payload: { gameId, color: Player.Black, choiceForUserId: subjectId },
                        })
                    }
                    className={`${btnBase} ${stored === Player.Black ? 'ring-2 ring-amber-300/80' : ''} ${stored != null && stored !== Player.Black ? 'opacity-40' : ''}`}
                >
                    흑
                </button>
                <button
                    type="button"
                    disabled={stored != null}
                    onClick={() =>
                        stored == null &&
                        onAction({
                            type: 'SUBMIT_BASE_STONE_COLOR_CHOICE',
                            payload: { gameId, color: Player.White, choiceForUserId: subjectId },
                        })
                    }
                    className={`${btnBase} ${stored === Player.White ? 'ring-2 ring-slate-200/70' : ''} ${stored != null && stored !== Player.White ? 'opacity-40' : ''}`}
                >
                    백
                </button>
            </div>
        </div>
    );

    const body = (
        <div className={`${komiWindowShell} flex w-full min-w-0 flex-col gap-2 px-2 py-2 sm:px-3`}>
            <p className="text-center text-[11px] font-semibold leading-snug text-stone-200 sm:text-xs">
                {isPairHostChoice ? '방장: 양 참가자의 선호 돌을 차례로 선택하세요.' : '마음에 드는 돌을 선택하세요.'}
            </p>
            {showCountdown && session.baseColorChoiceDeadline != null && (
                <>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300"
                            style={{ width: `${(timer / COLOR_CHOICE_SEC) * 100}%`, transition: 'width 0.35s linear' }}
                        />
                    </div>
                    <p className="text-center font-mono text-lg font-bold tabular-nums text-amber-100">{timer}</p>
                </>
            )}
            {isPairHostChoice ? (
                <div className="flex w-full min-w-0 flex-col gap-3">
                    {renderChoiceRow(`${player1.nickname} (참가자 1)`, player1.id, choiceP1)}
                    {renderChoiceRow(`${player2.nickname} (참가자 2)`, player2.id, choiceP2)}
                </div>
            ) : (
                <div className="flex w-full min-w-0 justify-center gap-2">
                    <button
                        type="button"
                        disabled={myChoice != null}
                        onClick={() => myChoice == null && onAction({ type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', payload: { gameId, color: Player.Black } })}
                        className={`${btnBase} ${myChoice === Player.Black ? 'ring-2 ring-amber-300/80' : ''} ${myChoice != null && myChoice !== Player.Black ? 'opacity-40' : ''}`}
                    >
                        흑
                    </button>
                    <button
                        type="button"
                        disabled={myChoice != null}
                        onClick={() => myChoice == null && onAction({ type: 'SUBMIT_BASE_STONE_COLOR_CHOICE', payload: { gameId, color: Player.White } })}
                        className={`${btnBase} ${myChoice === Player.White ? 'ring-2 ring-slate-200/70' : ''} ${myChoice != null && myChoice !== Player.White ? 'opacity-40' : ''}`}
                    >
                        백
                    </button>
                </div>
            )}
            {!isPairHostChoice && myChoice != null && (
                <p className="text-center text-[10px] text-emerald-300/95 sm:text-[11px]">선택을 전송했습니다. 상대 선택을 기다립니다.</p>
            )}
            {isPairHostChoice && choiceP1 != null && choiceP2 != null && (
                <p className="text-center text-[10px] text-emerald-300/95 sm:text-[11px]">양쪽 선택을 전송했습니다.</p>
            )}
        </div>
    );

    if (layout === 'inline') {
        return <div className="flex w-full min-w-0 max-w-full flex-col gap-1">{body}</div>;
    }
    return body;
};

export default BaseStoneColorChoicePanel;
