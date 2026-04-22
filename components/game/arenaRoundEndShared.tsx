import React from 'react';
import { arenaPostGameButtonClass } from './arenaPostGameButtonStyles.js';

/** 결과 모달(`GameSummaryModal`)과 동일한 바둑돌 SVG — 라운드 집계 모달에서 재사용 */
export const GoStoneIcon: React.FC<{ color: 'black' | 'white'; className?: string }> = ({ color, className = 'h-7 w-7' }) => {
    const uid = React.useId().replace(/:/g, '');
    const gradId = `gstone-${color}-${uid}`;
    return (
        <span className={`inline-flex shrink-0 ${className}`} aria-hidden title={color === 'black' ? '흑' : '백'}>
            <svg viewBox="0 0 36 36" className="h-full w-full drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
                <defs>
                    <radialGradient id={gradId} cx="32%" cy="28%" r="72%">
                        {color === 'black' ? (
                            <>
                                <stop offset="0%" stopColor="#d1d5db" />
                                <stop offset="38%" stopColor="#374151" />
                                <stop offset="100%" stopColor="#020617" />
                            </>
                        ) : (
                            <>
                                <stop offset="0%" stopColor="#ffffff" />
                                <stop offset="35%" stopColor="#f4f1e8" />
                                <stop offset="100%" stopColor="#9d978a" />
                            </>
                        )}
                    </radialGradient>
                </defs>
                <circle cx="18" cy="18" r="15" fill={`url(#${gradId})`} />
                <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke={color === 'black' ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.22)'}
                    strokeWidth="1"
                />
            </svg>
        </span>
    );
};

/** 컬링·알까기 결과 모달의 `CurlingAlkkagiTotalScoreRow`와 동일 톤 — 흑/백 누적 점수 한 줄 */
export const ArenaBlackWhiteCumulativeStrip: React.FC<{
    blackScore: number;
    whiteScore: number;
    compact?: boolean;
}> = ({ blackScore, whiteScore, compact }) => {
    const stoneCls = compact ? 'h-6 w-6 sm:h-7 sm:w-7' : 'h-7 w-7 sm:h-8 sm:w-8';
    const numCls = compact
        ? 'text-base font-bold tabular-nums tracking-tight text-amber-50 sm:text-lg'
        : 'text-2xl font-bold tabular-nums tracking-tight text-amber-50 sm:text-3xl';
    return (
        <div>
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/28 bg-gradient-to-b from-slate-900/96 via-slate-950/98 to-black px-3 py-2.5 text-center shadow-[0_16px_44px_-22px_rgba(0,0,0,0.75)] ring-1 ring-inset ring-amber-500/14 sm:px-4 sm:py-3.5">
                <div
                    className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/25 to-transparent"
                    aria-hidden
                />
                <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4">
                    <div className="flex items-center gap-2">
                        <GoStoneIcon color="black" className={stoneCls} />
                        <span className={`font-mono ${numCls}`}>{blackScore}</span>
                    </div>
                    <span className="select-none text-base font-extralight text-slate-600 sm:text-xl" aria-hidden>
                        ·
                    </span>
                    <div className="flex items-center gap-2">
                        <GoStoneIcon color="white" className={stoneCls} />
                        <span className={`font-mono ${numCls}`}>{whiteScore}</span>
                    </div>
                </div>
            </div>
            <p className="relative mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/40">누적 점수</p>
        </div>
    );
};

/** 주사위·도둑 등 흑/백이 아닌 1:1 누적 — 결과 모달 컬링 스트립과 같은 셸 */
export const ARENA_DUO_SCORE_STRIP_SHELL =
    'relative mx-auto w-full overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#12151f] via-[#0b0e14] to-[#06080c] shadow-[0_12px_40px_-18px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-inset ring-amber-400/12';

export const ArenaDuoNumericCumulativeStrip: React.FC<{
    /** `scoresOnly`가 아닐 때만 사용(스트립 좌우 닉네임) */
    leftNickname?: string;
    rightNickname?: string;
    leftScore: number;
    rightScore: number;
    compact?: boolean;
    /** true: 중앙 점수만(닉네임은 상단 아바타 행 등에서 처리) */
    scoresOnly?: boolean;
}> = ({ leftNickname = '', rightNickname = '', leftScore, rightScore, compact, scoresOnly }) => {
    const pad = compact ? 'px-3 py-2.5' : 'px-4 py-3 sm:px-5 sm:py-3.5';
    const nickCls = compact ? 'text-[10px] sm:text-xs' : 'text-xs';
    const scoreCls = compact
        ? 'text-[1.35rem] leading-none min-[400px]:text-[1.65rem] sm:text-3xl'
        : 'text-3xl sm:text-4xl';

    const centerScores = (
        <div className={`flex shrink-0 items-center justify-center gap-0.5 font-mono tabular-nums tracking-tight ${scoreCls}`}>
            <span className="bg-gradient-to-b from-white via-amber-50 to-amber-200/90 bg-clip-text font-black text-transparent drop-shadow-[0_2px_18px_rgba(251,191,36,0.22)]">
                {leftScore}
            </span>
            <span className="px-0.5 text-lg font-extralight text-slate-600 sm:text-2xl" aria-hidden>
                :
            </span>
            <span className="bg-gradient-to-b from-white via-amber-50 to-amber-200/90 bg-clip-text font-black text-transparent drop-shadow-[0_2px_18px_rgba(251,191,36,0.22)]">
                {rightScore}
            </span>
        </div>
    );

    return (
        <div>
            <div className={`${ARENA_DUO_SCORE_STRIP_SHELL} ${pad}`}>
                <div
                    className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent"
                    aria-hidden
                />
                {scoresOnly ? (
                    <div className={`relative flex items-center justify-center py-1 ${compact ? 'min-h-[2.75rem]' : 'min-h-[3.25rem] sm:min-h-[3.75rem]'}`}>
                        {centerScores}
                    </div>
                ) : (
                    <div className={`relative flex items-stretch justify-between gap-2 ${compact ? 'min-h-[3.75rem]' : 'min-h-[4.25rem] sm:min-h-[5rem]'}`}>
                        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-center">
                            <span className={`max-w-full truncate px-0.5 font-medium text-slate-500 ${nickCls}`} title={leftNickname}>
                                {leftNickname}
                            </span>
                        </div>
                        <div className="mx-1 flex w-px shrink-0 self-stretch bg-gradient-to-b from-transparent via-amber-500/25 to-transparent sm:mx-2" aria-hidden />
                        {centerScores}
                        <div className="mx-1 flex w-px shrink-0 self-stretch bg-gradient-to-b from-transparent via-amber-500/25 to-transparent sm:mx-2" aria-hidden />
                        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-center">
                            <span className={`max-w-full truncate px-0.5 font-medium text-slate-500 ${nickCls}`} title={rightNickname}>
                                {rightNickname}
                            </span>
                        </div>
                    </div>
                )}
            </div>
            <p className="relative mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/40">누적 점수</p>
        </div>
    );
};

/** 결과 모달 하단 버튼과 동일 계열 — 가로는 중간 집계용으로만 제한 */
export function arenaMidRoundPrimaryButtonClassName(isMobile: boolean): string {
    return `${arenaPostGameButtonClass('neutral', isMobile, 'modal')} !w-auto min-w-[9.25rem] max-w-[12.25rem] mx-auto`;
}
