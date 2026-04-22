import React from 'react';
import { LiveGameSession, ServerAction, User, ThiefRoundSummary as ThiefRoundSummaryType } from '../types.js';
import Avatar from './Avatar.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import RoundCountdownIndicator from './RoundCountdownIndicator.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants';

interface ThiefRoundSummaryProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const renderPlayerSummary = (summary: ThiefRoundSummaryType['player1'], user: User) => {
    const avatarUrl = AVATAR_POOL.find(a => a.id === user.avatarId)?.url;
    const borderUrl = BORDER_POOL.find(b => b.id === user.borderId)?.url;
    const isThief = summary.role === 'thief';
    return (
        <div className="flex min-h-0 min-w-0 flex-col items-stretch rounded-lg border border-white/[0.09] bg-gradient-to-b from-zinc-800/75 to-zinc-950/90 p-2 shadow-inner shadow-black/30 ring-1 ring-inset ring-amber-500/15 sm:p-2.5">
            <div className="flex flex-col items-center gap-1">
                <Avatar userId={user.id} userName={user.nickname} size={52} avatarUrl={avatarUrl} borderUrl={borderUrl} />
                <p
                    className="line-clamp-2 w-full max-w-full px-0.5 text-center text-[13px] font-semibold leading-tight text-amber-50 break-words sm:text-base"
                    title={user.nickname}
                >
                    {user.nickname}
                </p>
                <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 sm:text-xs ${
                        isThief
                            ? 'bg-amber-500/25 text-amber-100 ring-amber-400/35'
                            : 'bg-sky-600/35 text-sky-100 ring-sky-400/30'
                    }`}
                >
                    {isThief ? '도둑' : '경찰'}
                </span>
            </div>
            <dl className="mt-2 space-y-1.5 border-t border-white/15 pt-2 text-xs leading-tight text-zinc-200 sm:text-sm">
                <div className="flex items-baseline justify-between gap-1">
                    <dt className="shrink-0 text-zinc-300">{isThief ? '생존' : '검거'}</dt>
                    <dd className="min-w-0 text-right font-mono text-[15px] font-bold tabular-nums text-amber-100 sm:text-base">
                        {summary.roundScore}
                        <span className="ml-0.5 font-sans text-[11px] font-normal text-zinc-300">개</span>
                    </dd>
                </div>
                <div className="flex items-baseline justify-between gap-1 border-t border-white/10 pt-1.5">
                    <dt className="shrink-0 text-zinc-300">누적</dt>
                    <dd className="font-mono text-[1.05rem] font-bold tabular-nums text-amber-200 sm:text-xl">{summary.cumulativeScore}</dd>
                </div>
            </dl>
        </div>
    );
};

const ThiefRoundSummary: React.FC<ThiefRoundSummaryProps> = ({ session, currentUser, onAction }) => {
    const { id: gameId, player1, player2, thiefRoundSummary, roundEndConfirmations, revealEndTime } = session;
    const hasConfirmed = !!(roundEndConfirmations?.[currentUser.id]);

    if (!thiefRoundSummary) return null;

    const { round, isDeathmatch, player1: summaryP1, player2: summaryP2 } = thiefRoundSummary;

    const title = isDeathmatch ? `데스매치 ${round - 2} 종료` : `${round}라운드 집계`;

    let description = '';
    if (isDeathmatch) {
        description = '동점으로 데스매치를 이어갑니다.';
    } else if (round < 2) {
        description = '역할을 바꿔 다음 라운드를 진행합니다.';
    } else {
        description = '2라운드 종료. 동점이면 데스매치입니다.';
    }

    const btnLabel = hasConfirmed ? '상대 확인 대기' : '다음 라운드';
    const countdownLabel = isDeathmatch ? '다음 데스매치 자동 시작까지' : '다음 라운드 자동 시작까지';
    const countdownLabelShort = isDeathmatch ? '데스매치까지' : '다음까지';

    return (
        <DraggableWindow
            title={title}
            headerShowTitle
            windowId="thief-round-summary"
            initialWidth={560}
            shrinkHeightToContent
            hideFooter
            bodyScrollable={false}
            bodyNoScroll
            bodyPaddingClassName="p-2.5 sm:p-4 max-[380px]:p-2"
            containerExtraClassName="!rounded-2xl !shadow-[0_24px_64px_-16px_rgba(0,0,0,0.65),0_0_0_1px_rgba(251,191,36,0.12)]"
            mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 12px))"
        >
            <div className="relative flex h-full min-h-0 flex-col gap-2 text-amber-50/95 sm:gap-3">
                <div className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-[radial-gradient(ellipse_at_30%_0%,rgba(251,191,36,0.12),transparent_50%),radial-gradient(ellipse_at_100%_80%,rgba(56,189,248,0.1),transparent_42%)]" />

                <p className="text-center text-sm font-medium leading-snug text-zinc-200 sm:text-[15px]">{description}</p>

                <div className="grid min-h-0 shrink grid-cols-2 gap-1.5 sm:gap-2">
                    {renderPlayerSummary(summaryP1, player1)}
                    {renderPlayerSummary(summaryP2, player2)}
                </div>

                <div className="mt-auto flex min-h-0 shrink-0 flex-col gap-1.5 pt-0.5">
                    <Button
                        bare
                        onClick={() => onAction({ type: 'CONFIRM_ROUND_END', payload: { gameId } })}
                        disabled={hasConfirmed}
                        title={hasConfirmed ? undefined : btnLabel}
                        className={`w-full rounded-xl border px-2 py-2.5 text-sm font-bold shadow-lg transition sm:py-3 sm:text-base ${
                            hasConfirmed
                                ? 'cursor-not-allowed border-zinc-600 bg-zinc-800/80 text-zinc-500'
                                : 'border-amber-400/40 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-700 text-zinc-950 shadow-amber-900/30 hover:from-amber-300 hover:to-amber-600 active:scale-[0.99]'
                        }`}
                    >
                        {btnLabel}
                    </Button>
                    {!session.isAiGame && revealEndTime != null && (
                        <RoundCountdownIndicator
                            deadline={revealEndTime}
                            durationSeconds={20}
                            label={countdownLabel}
                            labelShort={countdownLabelShort}
                        />
                    )}
                </div>
            </div>
        </DraggableWindow>
    );
};

export default ThiefRoundSummary;
