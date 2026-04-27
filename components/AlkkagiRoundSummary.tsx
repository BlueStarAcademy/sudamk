import React from 'react';
import { LiveGameSession, ServerAction, User, Player, AlkkagiStone } from '../types.js';
import Avatar from './Avatar.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import RoundCountdownIndicator from './RoundCountdownIndicator.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { ArenaBlackWhiteCumulativeStrip, arenaMidRoundPrimaryButtonClassName } from './game/arenaRoundEndShared.js';

interface AlkkagiRoundSummaryProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const AlkkagiRoundSummary: React.FC<AlkkagiRoundSummaryProps> = ({ session, currentUser, onAction }) => {
    const { id: gameId, player1, player2, blackPlayerId, whitePlayerId, roundEndConfirmations, revealEndTime, alkkagiRoundSummary, alkkagiStones } = session;
    const hasConfirmed = !!(roundEndConfirmations?.[currentUser.id]);
    const isMobileLayout = useIsHandheldDevice(1024);

    if (!alkkagiRoundSummary) return null;

    const winnerUser = player1.id === alkkagiRoundSummary.winnerId ? player1 : player2;
    const blackPlayer = blackPlayerId === player1.id ? player1 : player2;
    const whitePlayer = whitePlayerId === player1.id ? player1 : player2;
    const blackEnum = blackPlayer.id === blackPlayerId ? Player.Black : Player.White;
    const whiteEnum = whitePlayer.id === blackPlayerId ? Player.Black : Player.White;
    const blackStonesLeft = alkkagiStones?.filter((s: AlkkagiStone) => s.player === blackEnum && s.onBoard).length ?? 0;
    const whiteStonesLeft = alkkagiStones?.filter((s: AlkkagiStone) => s.player === whiteEnum && s.onBoard).length ?? 0;

    const blackAvatarUrl = AVATAR_POOL.find((a) => a.id === blackPlayer.avatarId)?.url;
    const blackBorderUrl = BORDER_POOL.find((b) => b.id === blackPlayer.borderId)?.url;
    const whiteAvatarUrl = AVATAR_POOL.find((a) => a.id === whitePlayer.avatarId)?.url;
    const whiteBorderUrl = BORDER_POOL.find((b) => b.id === whitePlayer.borderId)?.url;

    const history = session.alkkagiRoundHistory || [];
    const blackForTotal = history.reduce((sum, r) => sum + Math.max(0, Number(r.blackKnockout ?? 0)), 0);
    const blackAgainstTotal = history.reduce((sum, r) => sum + Math.max(0, Number(r.whiteKnockout ?? 0)), 0);
    const whiteForTotal = history.reduce((sum, r) => sum + Math.max(0, Number(r.whiteKnockout ?? 0)), 0);
    const whiteAgainstTotal = history.reduce((sum, r) => sum + Math.max(0, Number(r.blackKnockout ?? 0)), 0);

    return (
        <DraggableWindow
            title={`${alkkagiRoundSummary.round}라운드 집계`}
            headerShowTitle
            windowId="alkkagi-round-summary"
            initialWidth={620}
            skipSavedPosition
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
                <p className="text-center text-sm font-medium leading-snug text-zinc-200 sm:text-[15px]">
                    {winnerUser.nickname}님이 이번 라운드에서 승리했습니다.
                </p>

                <div className="grid min-h-0 shrink grid-cols-2 gap-1.5 sm:gap-2">
                    <div className="flex min-h-0 min-w-0 flex-col items-center rounded-lg border border-white/[0.09] bg-gradient-to-b from-zinc-800/75 to-zinc-950/90 p-2 shadow-inner shadow-black/30 ring-1 ring-inset ring-amber-500/15 sm:p-2.5">
                        <Avatar userId={blackPlayer.id} userName={blackPlayer.nickname} size={52} avatarUrl={blackAvatarUrl} borderUrl={blackBorderUrl} />
                        <p className="mt-1 text-center text-sm font-bold text-amber-50">{blackPlayer.nickname}</p>
                        <p className="mt-1 text-xs text-zinc-300">남은 돌 {blackStonesLeft}개</p>
                        <p className="mt-1 text-[11px] text-zinc-200">득점 {blackForTotal} / 실점 {blackAgainstTotal}</p>
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-col items-center rounded-lg border border-white/[0.09] bg-gradient-to-b from-zinc-800/75 to-zinc-950/90 p-2 shadow-inner shadow-black/30 ring-1 ring-inset ring-amber-500/15 sm:p-2.5">
                        <Avatar userId={whitePlayer.id} userName={whitePlayer.nickname} size={52} avatarUrl={whiteAvatarUrl} borderUrl={whiteBorderUrl} />
                        <p className="mt-1 text-center text-sm font-bold text-amber-50">{whitePlayer.nickname}</p>
                        <p className="mt-1 text-xs text-zinc-300">남은 돌 {whiteStonesLeft}개</p>
                        <p className="mt-1 text-[11px] text-zinc-200">득점 {whiteForTotal} / 실점 {whiteAgainstTotal}</p>
                    </div>
                </div>

                <div className="min-h-0 shrink-0">
                    <ArenaBlackWhiteCumulativeStrip blackScore={blackForTotal} whiteScore={whiteForTotal} compact={isMobileLayout} />
                </div>

                <div className="mt-auto flex min-h-0 shrink-0 flex-col items-center gap-1.5 pt-0.5">
                    <Button
                        bare
                        onClick={() => onAction({ type: 'CONFIRM_ROUND_END', payload: { gameId } })}
                        disabled={hasConfirmed}
                        className={arenaMidRoundPrimaryButtonClassName(isMobileLayout)}
                    >
                        {hasConfirmed ? '확인 대기 중' : '다음 라운드'}
                    </Button>
                    {!session.isAiGame && revealEndTime != null && (
                        <RoundCountdownIndicator
                            deadline={revealEndTime}
                            durationSeconds={30}
                            label="다음 라운드 자동 시작까지"
                            labelShort="다음까지"
                        />
                    )}
                </div>
            </div>
        </DraggableWindow>
    );
};

export default AlkkagiRoundSummary;
