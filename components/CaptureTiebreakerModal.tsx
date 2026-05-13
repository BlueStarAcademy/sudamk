import React, { useState, useEffect } from 'react';
import { LiveGameSession, Player, ServerAction, User } from '../types.js';
import Avatar from './Avatar.js';
import Button from './Button.js';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import PreGameColorRoulette from './PreGameColorRoulette.js';
import { getSessionPlayerDisplayName } from '../utils/gameDisplayNames.js';
import RoundCountdownIndicator from './RoundCountdownIndicator.js';
import { modeIncludesBaseCaptureMix, resolveArenaSessionPolicy } from '../shared/utils/liveSessionArenaKind.js';
import { PRE_GAME_PVP_COUNTDOWN_SECONDS } from '../shared/constants/preGameCountdown.js';

interface CaptureTiebreakerModalProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

const CaptureTiebreakerModal: React.FC<CaptureTiebreakerModalProps> = ({ session, currentUser, onAction }) => {
    const {
        id: gameId,
        player1,
        player2,
        blackPlayerId,
        whitePlayerId,
        effectiveCaptureTargets,
        gameStatus,
        settings,
        preGameConfirmations,
        revealEndTime,
        finalKomi,
    } = session;
    const hasConfirmed = preGameConfirmations?.[currentUser.id];
    const [countdown, setCountdown] = useState(PRE_GAME_PVP_COUNTDOWN_SECONDS);
    const isTiebreaker = gameStatus === 'capture_tiebreaker';
    const isBaseStartConfirmation = gameStatus === 'base_game_start_confirmation';
    const hasRevealCountdown = Boolean(revealEndTime) && resolveArenaSessionPolicy(session).matchAxis === 'pvp';
    const [rouletteDone, setRouletteDone] = useState(() => !isTiebreaker);

    useEffect(() => {
        setRouletteDone(!isTiebreaker);
    }, [isTiebreaker, gameId]);

    useEffect(() => {
        if (!isTiebreaker) return;
        const t = window.setTimeout(() => setRouletteDone(true), 4500);
        return () => window.clearTimeout(t);
    }, [isTiebreaker, gameId]);

    useEffect(() => {
        if (!hasRevealCountdown) {
            setCountdown(0);
            return;
        }
        const deadline = revealEndTime || (Date.now() + PRE_GAME_PVP_COUNTDOWN_SECONDS * 1000);
        const timerId = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            setCountdown(remaining);
        }, 1000);

        return () => {
            clearInterval(timerId);
        };
    }, [hasRevealCountdown, revealEndTime]);

    if (!blackPlayerId || !whitePlayerId) return null;
    if (!isBaseStartConfirmation && !effectiveCaptureTargets) return null;

    const baseCaptureStart = isBaseStartConfirmation && modeIncludesBaseCaptureMix(session.mode, settings);
    const captureTargetsReady = Boolean(effectiveCaptureTargets);
    const showCaptureSummary =
        (gameStatus === 'capture_reveal' || gameStatus === 'capture_tiebreaker') ||
        (baseCaptureStart && captureTargetsReady);

    const blackPlayer = player1.id === blackPlayerId ? player1 : player2;
    const whitePlayer = player1.id === whitePlayerId ? player1 : player2;
    const blackUi = { ...blackPlayer, nickname: getSessionPlayerDisplayName(session, blackPlayer) };
    const whiteUi = { ...whitePlayer, nickname: getSessionPlayerDisplayName(session, whitePlayer) };
    const p1Seat = { ...player1, nickname: getSessionPlayerDisplayName(session, player1) };
    const p2Seat = { ...player2, nickname: getSessionPlayerDisplayName(session, player2) };
    const blackTarget = effectiveCaptureTargets?.[Player.Black];
    const whiteTarget = effectiveCaptureTargets?.[Player.White];
    const baseTargetForCopy = settings.captureTarget ?? 20;
    const winnerBid = Math.max(0, baseTargetForCopy - (whiteTarget ?? baseTargetForCopy));
    const komiLabel = finalKomi != null ? String(finalKomi) : '—';
    const getTitleAndDescription = () => {
        if (isTiebreaker) {
            return {
                title: '흑백 결정 (동점 룰렛)',
                description: '룰렛으로 흑·백이 정해졌습니다.',
            };
        }
        if (isBaseStartConfirmation) {
            if (baseCaptureStart && captureTargetsReady) {
                return {
                    title: '베이스 + 따내기',
                    description: '아래 카드에서 조건을 확인하세요.',
                };
            }
            return {
                title: '베이스 대국 준비',
                description: '아래에서 흑·백·덤을 확인하세요.',
            };
        }

        const winner = blackPlayer;
        return {
            title: '흑백 결정',
            description: `${getSessionPlayerDisplayName(session, winner)} · 흑(선) · 제시 ${winnerBid}점`,
        };
    };

    const { title, description } = getTitleAndDescription();

    const PlayerDisplay = ({
        user,
        color,
        footerTitle,
        footerMain,
        isMe,
    }: {
        user: User;
        color: '흑' | '백';
        footerTitle: string;
        footerMain: React.ReactNode;
        isMe?: boolean;
    }) => {
        const isBlack = color === '흑';
        const panelSurface = isBlack
            ? 'bg-gradient-to-br from-zinc-950 via-slate-900 to-amber-950/40'
            : 'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950';
        const panelBorder = isMe
            ? 'border-[3px] border-cyan-400 shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_10px_32px_-10px_rgba(34,211,238,0.45),0_0_28px_-8px_rgba(6,182,212,0.25)]'
            : isBlack
              ? 'border border-amber-300/40 shadow-xl'
              : 'border border-slate-200/25 shadow-xl';
        return (
            <div className={`relative z-[1] min-w-0 overflow-hidden rounded-2xl p-2.5 text-center sm:p-3 ${panelBorder} ${panelSurface}`}>
                <div className={`absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl ${isBlack ? 'bg-amber-300/20' : 'bg-slate-200/10'}`} />
                <div className="relative flex flex-col items-center">
                    <div className={`rounded-full p-1 ${isBlack ? 'bg-gradient-to-br from-amber-200 to-yellow-600' : 'bg-gradient-to-br from-white to-slate-500'}`}>
                        <Avatar
                            userId={user.id}
                            userName={getSessionPlayerDisplayName(session, user)}
                            size={48}
                            className="border-[3px] border-slate-950"
                        />
                    </div>
                    <p className="mt-2 flex flex-wrap items-center justify-center gap-1 text-sm font-black leading-tight tracking-tight text-white">
                        <span>{getSessionPlayerDisplayName(session, user)}</span>
                        {isMe ? (
                            <span className="rounded-md bg-cyan-400/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-cyan-100">
                                나
                            </span>
                        ) : null}
                    </p>
                    <div className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold ${
                        isBlack ? 'bg-amber-300 text-slate-950' : 'bg-slate-100 text-slate-950'
                    }`}>
                        <span className={`h-2 w-2 rounded-full ${isBlack ? 'bg-slate-950' : 'bg-white ring-1 ring-slate-400'}`} />
                        {color}{isBlack ? ' · 선공' : ' · 후공'}
                    </div>
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
                        <div className="text-[11px] font-semibold text-slate-400">{footerTitle}</div>
                        <div className="text-sm font-black leading-snug text-slate-50 sm:text-base">{footerMain}</div>
                    </div>
                </div>
            </div>
        );
    };

    const showAssignmentGrid = !isTiebreaker || rouletteDone;

    const seatFooterForBlack = showCaptureSummary
        ? {
              title: currentUser.id === blackPlayerId ? '내 승리 조건' : '흑 승리 조건',
              main: (
                  <>
                      <span className="text-yellow-300">{blackTarget}</span>
                      <span className="ml-1 text-sm font-bold text-slate-400">점 따내기</span>
                  </>
              ),
          }
        : {
              title: currentUser.id === blackPlayerId ? '내 역할' : '역할',
              main: <span className="text-amber-200">선공 (흑)</span>,
          };
    const seatFooterForWhite = showCaptureSummary
        ? {
              title: currentUser.id === whitePlayerId ? '내 승리 조건' : '백 승리 조건',
              main: (
                  <>
                      <span className="text-yellow-300">{whiteTarget}</span>
                      <span className="ml-1 text-sm font-bold text-slate-400">점 따내기</span>
                  </>
              ),
          }
        : {
              title: currentUser.id === whitePlayerId ? '내 덤 (백)' : '덤 (백)',
              main: (
                  <>
                      <span className="text-cyan-200">{komiLabel}</span>
                      <span className="ml-1 text-sm font-bold text-slate-400">집</span>
                  </>
              ),
          };

    return (
        <DraggableWindow
            title={title}
            initialWidth={isTiebreaker ? 430 : 392}
            shrinkHeightToContent
            windowId={isBaseStartConfirmation ? 'base-start-unified' : 'capture-tiebreaker'}
            transparentModalBackdrop
            headerShowTitle
            hideFooter
            mobileViewportFit
            mobileViewportMaxHeightCss="calc(100dvh - 8px)"
            mobileViewportDvhBottomGapPx={8}
            bodyPaddingClassName="p-0 sm:p-0"
            bodyNoScroll
            containerExtraClassName="!max-w-[min(94vw,24.5rem)]"
        >
            <>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col items-start overflow-x-hidden overflow-y-auto overscroll-y-contain px-2 pt-2 sm:px-2.5 sm:pt-2.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    <div className="relative mx-auto w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-amber-300/20 bg-gradient-to-b from-slate-950 via-slate-900 to-zinc-950 px-2.5 pb-2 pt-2.5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)] sm:px-3 sm:pb-2 sm:pt-3">
                <div className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-20 -right-12 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />
                <div className="relative flex min-h-0 w-full flex-col gap-2 sm:gap-2.5">
                {isTiebreaker && (
                    <PreGameColorRoulette
                        participantsInDisplayOrder={[p1Seat, p2Seat]}
                        blackPlayer={blackUi}
                        whitePlayer={whiteUi}
                        durationMs={4200}
                        title="흑·백 룰렛"
                        subtitle="동점 2차 입찰"
                        onComplete={() => setRouletteDone(true)}
                        suppressHeader
                    />
                )}

                <div className="text-center">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200/95">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                        {isBaseStartConfirmation ? '시작 전 확인' : '제시 결과'}
                    </div>
                    <h2 className="mt-2 text-lg font-black tracking-tight text-white sm:text-xl">{title}</h2>
                    <p className="mt-1.5 text-xs leading-snug text-slate-400 sm:text-[13px]">{description}</p>
                </div>

                {showAssignmentGrid && (
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <PlayerDisplay
                            user={blackPlayer}
                            color="흑"
                            footerTitle={seatFooterForBlack.title}
                            footerMain={seatFooterForBlack.main}
                            isMe={currentUser.id === blackPlayerId}
                        />
                        <PlayerDisplay
                            user={whitePlayer}
                            color="백"
                            footerTitle={seatFooterForWhite.title}
                            footerMain={seatFooterForWhite.main}
                            isMe={currentUser.id === whitePlayerId}
                        />
                    </div>
                )}

                {showAssignmentGrid && showCaptureSummary && (
                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-700/80 bg-slate-950/60 px-2.5 py-1.5 text-center leading-none sm:rounded-2xl sm:px-3 sm:py-2">
                        <div>
                            <div className="text-[11px] leading-tight text-slate-500">기본 목표</div>
                            <div className="pt-0.5 text-lg font-black leading-none text-slate-100">{settings.captureTarget ?? 20}</div>
                        </div>
                        <div>
                            <div className="text-[11px] leading-tight text-slate-500">제시 점수</div>
                            <div className="pt-0.5 text-lg font-black leading-none text-amber-300">{winnerBid}</div>
                        </div>
                    </div>
                )}

                {showAssignmentGrid && isBaseStartConfirmation && !showCaptureSummary && (
                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-700/80 bg-slate-950/60 px-2.5 py-1.5 text-center leading-none sm:rounded-2xl sm:px-3 sm:py-2">
                        <div>
                            <div className="text-[11px] leading-tight text-slate-500">규칙</div>
                            <div className="pt-0.5 text-lg font-black leading-none text-slate-100">베이스</div>
                        </div>
                        <div>
                            <div className="text-[11px] leading-tight text-slate-500">덤 (백)</div>
                            <div className="pt-0.5 text-lg font-black leading-none text-amber-300">{komiLabel}</div>
                        </div>
                    </div>
                )}
                {hasRevealCountdown && showAssignmentGrid ? (
                    <RoundCountdownIndicator
                        deadline={revealEndTime}
                        durationSeconds={PRE_GAME_PVP_COUNTDOWN_SECONDS}
                        label="자동 진행까지"
                        labelShort="자동 진행"
                    />
                ) : null}
                </div>
                    </div>
                </div>
                <div
                    className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} flex min-w-0 justify-center overflow-x-hidden border-t border-white/10 bg-slate-950/98 px-2.5 py-2 pb-[max(0.45rem,env(safe-area-inset-bottom,0px))] pt-2 sm:px-3 sm:py-2.5`}
                >
                    <Button
                        colorScheme="none"
                        disabledWithoutDim
                        onClick={() =>
                            onAction(
                                isBaseStartConfirmation
                                    ? { type: 'CONFIRM_BASE_REVEAL', payload: { gameId } }
                                    : { type: 'CONFIRM_CAPTURE_REVEAL', payload: { gameId } },
                            )
                        }
                        disabled={!!hasConfirmed || (isTiebreaker && !rouletteDone)}
                        className={[
                            '!w-full !max-w-[min(100%,18.5rem)] !whitespace-normal !rounded-full !border !border-emerald-400/45',
                            '!bg-gradient-to-b !from-emerald-500 !to-emerald-700 !px-4 !py-2.5 !text-center !text-[13px] !font-black !leading-tight !text-white !shadow-[0_6px_20px_-6px_rgba(16,185,129,0.55)]',
                            'transition-[filter,transform] hover:!brightness-110 active:!scale-[0.98]',
                            'focus:!outline-none focus-visible:!ring-2 focus-visible:!ring-emerald-300/70 focus-visible:!ring-offset-2 focus-visible:!ring-offset-slate-950',
                            'disabled:!cursor-not-allowed disabled:!opacity-50 disabled:!shadow-none disabled:hover:!brightness-100 disabled:active:!scale-100',
                        ].join(' ')}
                    >
                        {hasConfirmed
                            ? '경기 시작 준비 완료'
                            : isTiebreaker && !rouletteDone
                              ? '룰렛 결과 확인 중...'
                              : hasRevealCountdown
                                ? `대국 시작 (${countdown})`
                                : '대국 시작'}
                    </Button>
                </div>
            </>
        </DraggableWindow>
    );
};

export default CaptureTiebreakerModal;
