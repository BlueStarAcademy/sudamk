import React, { useEffect, useId, useState } from 'react';
import { LiveGameSession, ServerAction, Player, User } from '../types.js';
import Avatar from './Avatar.js';
import Button from './Button.js';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import RoundCountdownIndicator from './RoundCountdownIndicator.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';

interface CurlingRoundSummaryProps {
    session: LiveGameSession;
    currentUser: User;
    onAction: (action: ServerAction) => void;
}

type MobileRoundTab = 'board' | 'detail';

const CurlingRoundSummary: React.FC<CurlingRoundSummaryProps> = ({ session, currentUser, onAction }) => {
    const uid = useId().replace(/:/g, '');
    const { id: gameId, curlingRoundSummary, player1, player2, blackPlayerId, whitePlayerId, roundEndConfirmations, isAiGame } = session;
    const hasConfirmed = !!(roundEndConfirmations?.[currentUser.id]);
    const totalRounds = session.settings.curlingRounds || 3;

    const isMobileLayout = useIsHandheldDevice(1025);
    const [mobileTab, setMobileTab] = useState<MobileRoundTab>('board');

    const summaryRound = curlingRoundSummary?.round;
    useEffect(() => {
        setMobileTab('board');
    }, [summaryRound]);

    if (!curlingRoundSummary) return null;

    const { round, black, white, cumulativeScores, stonesState, scoredStones } = curlingRoundSummary;
    const isFinalRound = round >= totalRounds;

    const blackPlayer = blackPlayerId === player1.id ? player1 : player2;
    const whitePlayer = whitePlayerId === player1.id ? player1 : player2;

    const blackAvatarUrl = AVATAR_POOL.find(a => a.id === blackPlayer.avatarId)?.url;
    const blackBorderUrl = BORDER_POOL.find(b => b.id === blackPlayer.borderId)?.url;
    const whiteAvatarUrl = AVATAR_POOL.find(a => a.id === whitePlayer.avatarId)?.url;
    const whiteBorderUrl = BORDER_POOL.find(b => b.id === whitePlayer.borderId)?.url;

    const myPlayerEnum = currentUser.id === blackPlayerId ? Player.Black : Player.White;

    const boardSizePx = 840;
    const center = { x: boardSizePx / 2, y: boardSizePx / 2 };
    const cellSize = boardSizePx / 19;
    const houseRadii = [cellSize * 6, cellSize * 4, cellSize * 2, cellSize * 0.5];
    const houseColors = ['rgba(0, 100, 255, 0.2)', 'rgba(255, 255, 255, 0.2)', 'rgba(255, 0, 0, 0.2)', 'white'];

    const gloss1 = `gloss-curling-summary-${uid}-1`;
    const gloss2 = `gloss-curling-summary-${uid}-2`;
    const glowId = `glow-curling-summary-${uid}`;

    const boardInner = (
        <svg
            viewBox={`0 0 ${boardSizePx} ${boardSizePx}`}
            className="h-full w-full bg-[#c9a06a]"
            preserveAspectRatio="xMidYMid meet"
        >
            <defs>
                <radialGradient id={gloss1}>
                    <stop offset="10%" stopColor="#333" />
                    <stop offset="95%" stopColor="#000" />
                </radialGradient>
                <radialGradient id={gloss2}>
                    <stop offset="10%" stopColor="#fff" />
                    <stop offset="95%" stopColor="#ccc" />
                </radialGradient>
                <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {houseRadii.map((r, i) => (
                <circle key={i} cx={center.x} cy={center.y} r={r} fill={houseColors[i]} />
            ))}

            {stonesState.map(stone => {
                if (!stone.onBoard) return null;
                const score = scoredStones[stone.id];
                const isMyStone = stone.player === myPlayerEnum;
                const displayX = stone.x;
                let displayY: number;
                if (isMyStone) {
                    if (myPlayerEnum === Player.White) {
                        displayY = boardSizePx - stone.y;
                    } else {
                        displayY = stone.y;
                    }
                } else {
                    if (stone.player === Player.White) {
                        displayY = stone.y;
                    } else {
                        displayY = boardSizePx - stone.y;
                    }
                }
                return (
                    <g key={stone.id}>
                        <circle cx={displayX} cy={displayY} r={stone.radius} fill={stone.player === Player.Black ? '#111827' : '#f9fafb'} />
                        <circle cx={displayX} cy={displayY} r={stone.radius} fill={`url(#gloss-curling-summary-${uid}-${stone.player})`} />
                        {score && (
                            <g style={{ pointerEvents: 'none' }}>
                                <circle
                                    cx={displayX}
                                    cy={displayY}
                                    r={stone.radius}
                                    fill="none"
                                    stroke={stone.player === Player.Black ? '#67e8f9' : '#facc15'}
                                    strokeWidth="5"
                                    filter={`url(#${glowId})`}
                                />
                                <text
                                    x={displayX}
                                    y={displayY}
                                    textAnchor="middle"
                                    dy=".35em"
                                    fontSize={stone.radius * 0.9}
                                    fontWeight="bold"
                                    fill={stone.player === Player.Black ? 'white' : 'black'}
                                    stroke="rgba(0,0,0,0.5)"
                                    strokeWidth="0.5px"
                                >
                                    +{score}
                                </text>
                            </g>
                        )}
                    </g>
                );
            })}
        </svg>
    );

    /** 데스크톱: 좁은 창에서도 세로가 넘치지 않도록 상한 */
    const boardSvgDesktop = (
        <div className="mx-auto aspect-square w-full max-h-[min(560px,62vh)] max-w-full min-h-0 overflow-hidden rounded-xl border-2 border-amber-500/30 bg-gradient-to-b from-[#6b5340] via-[#4a3a2a] to-[#2a2118] shadow-[inset_0_2px_0_rgba(255,255,255,0.12),0_12px_40px_-12px_rgba(0,0,0,0.65)] ring-1 ring-amber-400/20 md:max-h-[min(640px,70vh)]">
            <div className="h-full w-full p-[3px]">
                <div className="h-full w-full overflow-hidden rounded-[10px] border border-black/25 shadow-inner">{boardInner}</div>
            </div>
        </div>
    );

    /** 모바일: 탭·푸터·「창 위치 기억」까지 뺀 남는 높이 안에 맞춤 — 고정 dvh는 영역보다 커져 위·아래가 잘릴 수 있음 */
    const boardSvgMobile = (
        <div className="flex min-h-0 min-w-0 flex-1 w-full items-center justify-center">
            <div
                className="relative box-border aspect-square h-full max-h-full w-auto min-h-0 min-w-0 max-w-full overflow-hidden rounded-xl border border-amber-500/35 bg-gradient-to-b from-[#6b5340] via-[#4a3a2a] to-[#2a2118] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_36px_-10px_rgba(0,0,0,0.7)] ring-1 ring-amber-400/25"
            >
                <div className="absolute inset-[2px] overflow-hidden rounded-[10px] border border-black/30 shadow-[inset_0_2px_8px_rgba(0,0,0,0.35)]">
                    {boardInner}
                </div>
            </div>
        </div>
    );

    const detailScoreCardsDesktop = (
        <div className="grid grid-cols-1 gap-3">
            <div className="rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900/90 via-[#12151f] to-[#0a0c12] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-500/10">
                <div className="mb-3 flex items-center gap-3">
                    <Avatar userId={blackPlayer.id} userName={blackPlayer.nickname} size={48} avatarUrl={blackAvatarUrl} borderUrl={blackBorderUrl} />
                    <div className="min-w-0">
                        <p className="truncate text-lg font-bold text-amber-50/95">{blackPlayer.nickname}</p>
                        <p className="text-sm text-slate-400">흑돌</p>
                    </div>
                </div>
                <div className="space-y-2 text-sm text-slate-200/90">
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                        <span className="text-slate-400">하우스</span> <span className="font-semibold tabular-nums">{black.houseScore}점</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                        <span className="text-slate-400">넉아웃</span> <span className="font-semibold tabular-nums">{black.knockoutScore}점</span>
                    </div>
                    <div className="flex flex-col gap-1 pt-1">
                        <div className="flex justify-between text-base">
                            <strong className="text-slate-300">라운드 합계</strong>{' '}
                            <strong className="tabular-nums text-amber-200">{black.total}점</strong>
                        </div>
                        {black.previousKnockoutScore !== undefined && black.previousKnockoutScore > 0 && (
                            <div className="ml-1 flex justify-between text-xs text-slate-500">
                                <span>이전 라운드</span> <span className="tabular-nums">{black.previousKnockoutScore}점</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900/90 via-[#12151f] to-[#0a0c12] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-500/10">
                <div className="mb-3 flex items-center gap-3">
                    <Avatar userId={whitePlayer.id} userName={whitePlayer.nickname} size={48} avatarUrl={whiteAvatarUrl} borderUrl={whiteBorderUrl} />
                    <div className="min-w-0">
                        <p className="truncate text-lg font-bold text-amber-50/95">{whitePlayer.nickname}</p>
                        <p className="text-sm text-slate-400">백돌</p>
                    </div>
                </div>
                <div className="space-y-2 text-sm text-slate-200/90">
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                        <span className="text-slate-400">하우스</span> <span className="font-semibold tabular-nums">{white.houseScore}점</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                        <span className="text-slate-400">넉아웃</span> <span className="font-semibold tabular-nums">{white.knockoutScore}점</span>
                    </div>
                    <div className="flex flex-col gap-1 pt-1">
                        <div className="flex justify-between text-base">
                            <strong className="text-slate-300">라운드 합계</strong>{' '}
                            <strong className="tabular-nums text-amber-200">{white.total}점</strong>
                        </div>
                        {white.previousKnockoutScore !== undefined && white.previousKnockoutScore > 0 && (
                            <div className="ml-1 flex justify-between text-xs text-slate-500">
                                <span>이전 라운드</span> <span className="tabular-nums">{white.previousKnockoutScore}점</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    /** 모바일 상세: 좌·우 흑/백 2열(고정 모달 안에서 블록 단위로 가로·세로 중앙 정렬) */
    const detailScoreCardsMobile = (
        <div className="grid w-full max-w-full shrink-0 grid-cols-2 gap-2">
            <div className="flex min-w-0 flex-col rounded-lg border border-amber-500/30 bg-gradient-to-b from-slate-900/95 via-[#10131c] to-[#080a10] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-inset ring-cyan-500/10">
                <div className="mb-2 flex flex-col items-center gap-1.5 text-center">
                    <Avatar userId={blackPlayer.id} userName={blackPlayer.nickname} size={36} avatarUrl={blackAvatarUrl} borderUrl={blackBorderUrl} />
                    <div className="w-full min-w-0">
                        <p className="truncate text-[11px] font-bold leading-tight text-amber-50/95">{blackPlayer.nickname}</p>
                        <p className="text-[9px] font-medium uppercase tracking-wider text-slate-500">흑</p>
                    </div>
                </div>
                <div className="flex flex-col justify-center gap-1.5 text-[10px] leading-snug text-slate-200/90">
                    <div className="flex items-center justify-between gap-1 border-b border-white/5 pb-1">
                        <span className="shrink-0 text-slate-500">하우스</span>
                        <span className="font-semibold tabular-nums text-amber-100/90">{black.houseScore}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1 border-b border-white/5 pb-1">
                        <span className="shrink-0 text-slate-500">넉아웃</span>
                        <span className="font-semibold tabular-nums text-amber-100/90">{black.knockoutScore}</span>
                    </div>
                    <div className="rounded-md bg-amber-500/10 px-1.5 py-1 text-center">
                        <span className="block text-[8px] font-semibold uppercase tracking-wider text-amber-200/70">합계</span>
                        <span className="text-sm font-bold tabular-nums text-amber-200">{black.total}</span>
                    </div>
                    {black.previousKnockoutScore !== undefined && black.previousKnockoutScore > 0 && (
                        <div className="flex justify-between text-[9px] text-slate-500">
                            <span>이전 넉</span>
                            <span className="tabular-nums">{black.previousKnockoutScore}</span>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex min-w-0 flex-col rounded-lg border border-amber-500/30 bg-gradient-to-b from-slate-900/95 via-[#10131c] to-[#080a10] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-inset ring-amber-400/10">
                <div className="mb-2 flex flex-col items-center gap-1.5 text-center">
                    <Avatar userId={whitePlayer.id} userName={whitePlayer.nickname} size={36} avatarUrl={whiteAvatarUrl} borderUrl={whiteBorderUrl} />
                    <div className="w-full min-w-0">
                        <p className="truncate text-[11px] font-bold leading-tight text-amber-50/95">{whitePlayer.nickname}</p>
                        <p className="text-[9px] font-medium uppercase tracking-wider text-slate-500">백</p>
                    </div>
                </div>
                <div className="flex flex-col justify-center gap-1.5 text-[10px] leading-snug text-slate-200/90">
                    <div className="flex items-center justify-between gap-1 border-b border-white/5 pb-1">
                        <span className="shrink-0 text-slate-500">하우스</span>
                        <span className="font-semibold tabular-nums text-amber-100/90">{white.houseScore}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1 border-b border-white/5 pb-1">
                        <span className="shrink-0 text-slate-500">넉아웃</span>
                        <span className="font-semibold tabular-nums text-amber-100/90">{white.knockoutScore}</span>
                    </div>
                    <div className="rounded-md bg-amber-500/10 px-1.5 py-1 text-center">
                        <span className="block text-[8px] font-semibold uppercase tracking-wider text-amber-200/70">합계</span>
                        <span className="text-sm font-bold tabular-nums text-amber-200">{white.total}</span>
                    </div>
                    {white.previousKnockoutScore !== undefined && white.previousKnockoutScore > 0 && (
                        <div className="flex justify-between text-[9px] text-slate-500">
                            <span>이전 넉</span>
                            <span className="tabular-nums">{white.previousKnockoutScore}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const confirmLabel = isAiGame
        ? isFinalRound
            ? '확인'
            : '다음 라운드 시작'
        : hasConfirmed
          ? '상대방 확인 대기 중...'
          : isFinalRound
            ? '확인'
            : '다음 라운드 시작';

    const cumulativeAndActionsDesktop = (
        <>
            <div className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-slate-800/80 to-slate-950/90 p-3 text-center shadow-inner ring-1 ring-inset ring-white/5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">누적 점수</p>
                <p className="mt-1 font-mono text-2xl font-bold text-amber-50/95">
                    <span className="tabular-nums">흑 {cumulativeScores[Player.Black]}</span>
                    <span className="mx-3 text-slate-500">:</span>
                    <span className="tabular-nums">백 {cumulativeScores[Player.White]}</span>
                </p>
            </div>

            <Button
                onClick={() => onAction({ type: 'CONFIRM_ROUND_END', payload: { gameId } })}
                disabled={!isAiGame && !!hasConfirmed}
                className="mt-4 w-full py-3"
            >
                {confirmLabel}
            </Button>
            <RoundCountdownIndicator
                deadline={session.revealEndTime}
                durationSeconds={10}
                enabled={!isAiGame}
                label={isFinalRound ? '최종 결과 자동 표시까지' : '다음 라운드 자동 시작까지'}
            />
        </>
    );

    const cumulativeAndActionsMobile = (
        <>
            <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-slate-900/95 via-[#141a28] to-slate-900/95 px-3 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-amber-400/10">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/55">누적 점수</p>
                <p className="mt-0.5 font-mono text-lg font-bold leading-tight text-amber-50/95">
                    <span className="tabular-nums">흑 {cumulativeScores[Player.Black]}</span>
                    <span className="mx-2 text-slate-500">:</span>
                    <span className="tabular-nums">백 {cumulativeScores[Player.White]}</span>
                </p>
            </div>

            <div className="mt-2 flex justify-center">
                <Button
                    bare
                    type="button"
                    onClick={() => onAction({ type: 'CONFIRM_ROUND_END', payload: { gameId } })}
                    disabled={!isAiGame && !!hasConfirmed}
                    className="min-h-[2.75rem] min-w-[11rem] max-w-[min(20rem,88vw)] rounded-full border border-amber-400/50 bg-gradient-to-b from-amber-500/95 via-amber-700/90 to-amber-950/95 px-7 py-2 text-[13px] font-bold tracking-tight text-amber-50 shadow-[0_4px_24px_-6px_rgba(251,191,36,0.55),inset_0_1px_0_rgba(255,255,255,0.28)] transition-[transform,box-shadow] active:translate-y-px active:shadow-[0_2px_12px_-4px_rgba(251,191,36,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none"
                >
                    {confirmLabel}
                </Button>
            </div>
            <RoundCountdownIndicator
                deadline={session.revealEndTime}
                durationSeconds={10}
                enabled={!isAiGame}
                label={isFinalRound ? '최종 결과 자동 표시까지' : '다음 라운드 자동 시작까지'}
            />
        </>
    );

    const tabBtnClass = (active: boolean) =>
        `min-h-[2.35rem] flex-1 rounded-lg px-2 py-1.5 text-center text-[11px] font-bold transition-all sm:text-xs ${
            active
                ? 'border border-amber-400/45 bg-gradient-to-b from-amber-500/25 to-amber-900/20 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-amber-400/20'
                : 'border border-transparent text-slate-500 hover:text-slate-300'
        }`;

    return (
        <DraggableWindow
            title={`${round} 라운드 결과`}
            initialWidth={900}
            initialHeight={isMobileLayout ? 636 : undefined}
            windowId="curling-round-summary"
            modal
            mobileViewportFit={isMobileLayout}
            mobileViewportMaxHeightVh={92}
            mobileLockViewportHeight={isMobileLayout}
            bodyPaddingClassName={isMobileLayout ? '!p-0' : undefined}
            bodyScrollable={!isMobileLayout}
        >
            {isMobileLayout ? (
                <>
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden text-white">
                        <div
                            className="flex shrink-0 gap-1 border-b border-amber-500/20 bg-gradient-to-b from-[#161b26] to-[#0b0e14] px-2 py-2"
                            role="tablist"
                            aria-label="라운드 결과 보기"
                        >
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mobileTab === 'board'}
                                className={tabBtnClass(mobileTab === 'board')}
                                onClick={() => setMobileTab('board')}
                            >
                                결과 보드
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mobileTab === 'detail'}
                                className={tabBtnClass(mobileTab === 'detail')}
                                onClick={() => setMobileTab('detail')}
                            >
                                상세 점수
                            </button>
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                            {mobileTab === 'board' ? (
                                <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden px-2 py-2">
                                    <p className="shrink-0 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/65">
                                        라운드 결과 보드
                                    </p>
                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col">{boardSvgMobile}</div>
                                </div>
                            ) : (
                                <div className="flex min-h-0 flex-1 w-full items-center justify-center overflow-hidden px-2 py-2">
                                    {detailScoreCardsMobile}
                                </div>
                            )}
                        </div>
                    </div>
                    <div
                        className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} flex flex-col gap-0 border-t border-amber-500/25 bg-gradient-to-t from-[#07080c] via-[#101522] to-[#141a24] px-3 py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] shadow-[0_-12px_40px_-20px_rgba(0,0,0,0.65)] backdrop-blur-[6px]`}
                    >
                        {cumulativeAndActionsMobile}
                    </div>
                </>
            ) : (
                <div className="flex flex-col gap-4 text-white md:flex-row">
                    <div className="flex w-full flex-shrink-0 flex-col items-center md:w-1/2">
                        <h3 className="mb-2 text-xl font-bold tracking-tight text-amber-100/90">라운드 결과 보드</h3>
                        {boardSvgDesktop}
                    </div>

                    <div className="flex w-full flex-grow flex-col justify-center md:w-1/2">
                        {detailScoreCardsDesktop}
                        <div className="mt-4">{cumulativeAndActionsDesktop}</div>
                    </div>
                </div>
            )}
        </DraggableWindow>
    );
};

export default CurlingRoundSummary;
