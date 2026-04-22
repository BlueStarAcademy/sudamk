import React from 'react';
import { LiveGameSession, ServerAction, User } from '../types.js';
import Avatar from './Avatar.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import RoundCountdownIndicator from './RoundCountdownIndicator.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { ArenaDuoNumericCumulativeStrip, arenaMidRoundPrimaryButtonClassName } from './game/arenaRoundEndShared.js';

interface DiceRoundSummaryProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const DiceRoundSummary: React.FC<DiceRoundSummaryProps> = ({ session, currentUser, onAction }) => {
    const { id: gameId, player1, player2, diceRoundSummary, roundEndConfirmations, revealEndTime, isAiGame } = session;
    const hasConfirmed = !!(roundEndConfirmations?.[currentUser.id]);
    const isMobileLayout = useIsHandheldDevice(1024);

    if (!diceRoundSummary) return null;

    const { round, scores, diceStats, lastDummyCaptureBonus } = diceRoundSummary;
    const p1Score = scores[player1.id] || 0;
    const p2Score = scores[player2.id] || 0;

    const p1AvatarUrl = AVATAR_POOL.find(a => a.id === player1.avatarId)?.url;
    const p1BorderUrl = BORDER_POOL.find(b => b.id === player1.borderId)?.url;
    const p2AvatarUrl = AVATAR_POOL.find(a => a.id === player2.avatarId)?.url;
    const p2BorderUrl = BORDER_POOL.find(b => b.id === player2.borderId)?.url;

    /** 한 줄·짧은 숫자로 모바일 한 화면에 맞춤 (스크롤 없이) */
    const renderDiceStatsCompact = (playerId: string) => {
        if (!diceStats || !diceStats[playerId]) return null;
        const stats = diceStats[playerId];
        if (stats.totalRolls === 0) {
            return <p className="text-center text-xs leading-tight text-zinc-300 sm:text-sm">굴림 없음</p>;
        }
        return (
            <div className="flex flex-wrap justify-center gap-x-1.5 gap-y-1 font-mono text-[11px] leading-none text-amber-50 tabular-nums sm:gap-x-2 sm:text-xs">
                {Array.from({ length: 6 }, (_, i) => i + 1).map(num => {
                    const count = stats.rolls[num] || 0;
                    const pct = ((count / stats.totalRolls) * 100).toFixed(0);
                    return (
                        <span key={num} className="whitespace-nowrap rounded bg-black/45 px-1.5 py-0.5 ring-1 ring-amber-400/25">
                            {num}:{count}
                            <span className="text-amber-200/90">·{pct}%</span>
                        </span>
                    );
                })}
            </div>
        );
    };

    const isFinalRound = diceRoundSummary.round >= (session.settings.diceGoRounds ?? 3);
    const isTie = p1Score === p2Score;

    let buttonText = '다음 라운드 시작';
    if (isFinalRound) {
        if (isTie) {
            buttonText = '데스매치 시작';
        } else {
            buttonText = '최종 결과 보기';
        }
    }
    if (hasConfirmed) {
        buttonText = '상대 확인 대기';
    }

    const countdownLabel = isFinalRound
        ? isTie
            ? '데스매치 자동 시작까지'
            : '최종 결과 자동 표시까지'
        : '다음 라운드 자동 시작까지';
    const countdownLabelShort = isFinalRound ? (isTie ? '데스매치까지' : '결과까지') : '다음까지';

    return (
        <DraggableWindow
            title={`${round}라운드 집계`}
            headerShowTitle
            windowId="dice-round-summary"
            initialWidth={640}
            shrinkHeightToContent
            hideFooter
            bodyScrollable={false}
            bodyNoScroll
            bodyPaddingClassName="p-2.5 sm:p-4 max-[380px]:p-2"
            containerExtraClassName="!rounded-2xl !shadow-[0_24px_64px_-16px_rgba(0,0,0,0.65),0_0_0_1px_rgba(251,191,36,0.12)]"
            mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 12px))"
        >
            <div className="relative flex h-full min-h-0 flex-col gap-2 text-amber-50/95 sm:gap-3">
                <div className="pointer-events-none absolute inset-0 -z-10 rounded-xl bg-[radial-gradient(ellipse_at_50%_0%,rgba(251,191,36,0.14),transparent_55%),radial-gradient(ellipse_at_80%_100%,rgba(59,130,246,0.08),transparent_45%)]" />

                <p className="text-center text-sm font-medium leading-snug text-zinc-200 sm:text-[15px]">
                    백을 모두 포획해 라운드가 끝났습니다.
                </p>

                <div className="relative overflow-hidden rounded-xl border border-amber-400/20 bg-gradient-to-b from-zinc-800/90 to-zinc-950/95 p-2 shadow-inner shadow-black/40 sm:p-3">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/35 to-transparent" />
                    <div className="flex min-h-0 items-center justify-between gap-3 sm:gap-4">
                        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
                            <Avatar userId={player1.id} userName={player1.nickname} size={56} avatarUrl={p1AvatarUrl} borderUrl={p1BorderUrl} />
                            <p
                                className="w-full max-w-[31vw] text-center text-[13px] font-semibold leading-tight text-amber-50 break-words sm:max-w-[9rem] sm:text-base"
                                title={player1.nickname}
                            >
                                {player1.nickname}
                            </p>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
                            <Avatar userId={player2.id} userName={player2.nickname} size={56} avatarUrl={p2AvatarUrl} borderUrl={p2BorderUrl} />
                            <p
                                className="w-full max-w-[31vw] text-center text-[13px] font-semibold leading-tight text-amber-50 break-words sm:max-w-[9rem] sm:text-base"
                                title={player2.nickname}
                            >
                                {player2.nickname}
                            </p>
                        </div>
                    </div>
                    <div className="mt-2 sm:mt-2.5">
                        <ArenaDuoNumericCumulativeStrip leftScore={p1Score} rightScore={p2Score} compact={isMobileLayout} scoresOnly />
                    </div>
                    {lastDummyCaptureBonus && lastDummyCaptureBonus.amount > 0 && (
                        <span className="mt-2 block max-w-[min(92vw,22rem)] text-center text-[11px] font-semibold leading-tight text-amber-200 sm:text-xs">
                            마지막 더미 포획 보너스:{' '}
                            {(lastDummyCaptureBonus.playerId === player1.id ? player1.nickname : player2.nickname) ?? '플레이어'}
                            <span className="ml-1 font-mono tabular-nums text-amber-200">+{lastDummyCaptureBonus.amount}</span>
                        </span>
                    )}
                </div>

                {!isAiGame && diceStats && (
                    <div className="min-h-0 shrink rounded-lg border border-amber-500/15 bg-zinc-900/55 p-2 ring-1 ring-inset ring-white/[0.04] sm:p-2.5">
                        <h3 className="mb-1.5 text-center text-xs font-bold uppercase tracking-wide text-amber-100 sm:mb-2 sm:text-sm">
                            {round}라운드 주사위 분포
                        </h3>
                        <div className="grid min-h-0 grid-cols-2 gap-1.5 sm:gap-2">
                            <div className="min-w-0 rounded-md border border-white/5 bg-black/25 p-1.5 sm:p-2">
                                <p
                                    className="mb-1 line-clamp-2 text-center text-xs font-semibold leading-tight text-zinc-200 break-words sm:text-sm"
                                    title={player1.nickname}
                                >
                                    {player1.nickname}
                                </p>
                                {renderDiceStatsCompact(player1.id)}
                            </div>
                            <div className="min-w-0 rounded-md border border-white/5 bg-black/25 p-1.5 sm:p-2">
                                <p
                                    className="mb-1 line-clamp-2 text-center text-xs font-semibold leading-tight text-zinc-200 break-words sm:text-sm"
                                    title={player2.nickname}
                                >
                                    {player2.nickname}
                                </p>
                                {renderDiceStatsCompact(player2.id)}
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-auto flex min-h-0 shrink-0 flex-col items-center gap-1.5 pt-0.5">
                    <Button
                        bare
                        onClick={() => onAction({ type: 'CONFIRM_ROUND_END', payload: { gameId } })}
                        disabled={!!hasConfirmed}
                        title={hasConfirmed ? undefined : buttonText}
                        className={arenaMidRoundPrimaryButtonClassName(isMobileLayout)}
                    >
                        {buttonText}
                    </Button>
                    {!isAiGame && (
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

export default DiceRoundSummary;
