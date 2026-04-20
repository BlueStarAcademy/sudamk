import React from 'react';

const STAR_FILLED = '/images/guild/guildwar/clearstar.png';

export type GuildWarUnifiedScoreboardProps = {
    blueStars: number;
    redStars: number;
    blueHouse: number;
    redHouse: number;
    compact?: boolean;
    /** 집 합이 0이면 집 줄 숨김 */
    hideHouseWhenZero?: boolean;
    /** 카드 외곽 톤: 길드홈 패널 안에서는 얇게 */
    variant?: 'default' | 'embedded';
};

/**
 * 길드전 청(좌)·홍(우) 별·집점수 + 중앙 VS + 우세 비율 막대(별·집 가중).
 * 길드 전쟁 화면·길드홈 War 패널 공통.
 */
export const GuildWarUnifiedScoreboard: React.FC<GuildWarUnifiedScoreboardProps> = ({
    blueStars,
    redStars,
    blueHouse,
    redHouse,
    compact,
    hideHouseWhenZero,
    variant = 'default',
}) => {
    const totalStars = blueStars + redStars;
    const totalHouse = blueHouse + redHouse;
    const showHouseRow = !(hideHouseWhenZero && totalHouse <= 0);
    let bluePressure = 0.5;
    if (totalStars <= 0 && totalHouse <= 0) bluePressure = 0.5;
    else if (totalStars <= 0) bluePressure = totalHouse > 0 ? blueHouse / totalHouse : 0.5;
    else if (totalHouse <= 0) bluePressure = blueStars / totalStars;
    else {
        const ns = blueStars / totalStars;
        if (!showHouseRow || totalHouse <= 0) {
            bluePressure = ns;
        } else {
            const nh = blueHouse / totalHouse;
            bluePressure = ns * 0.42 + nh * 0.58;
        }
    }
    const p = Math.min(0.985, Math.max(0.015, bluePressure));
    const pct = `${(p * 100).toFixed(2)}%`;
    const starImg = compact ? 'h-3 w-3' : 'h-4 w-4 sm:h-5 sm:w-5';
    const numSm = compact ? 'text-lg' : 'text-2xl sm:text-3xl';
    const numXs = compact ? 'text-[11px]' : 'text-sm sm:text-base';
    const pad = compact ? 'px-2 py-2' : 'px-4 py-3.5 sm:px-5 sm:py-4';
    const shell =
        variant === 'embedded'
            ? `rounded-xl border border-amber-500/25 bg-gradient-to-b from-black/45 via-stone-950/65 to-black/50 shadow-inner ring-1 ring-white/[0.05] ${pad}`
            : `rounded-2xl border border-amber-300/40 bg-gradient-to-b from-black/70 via-slate-950/80 to-black/75 shadow-[0_12px_40px_rgba(0,0,0,0.5)] ring-1 ring-white/[0.07] backdrop-blur-md ${pad}`;

    const starScoreRow = (n: number) => (
        <div className="flex items-center justify-center gap-1 opacity-95">
            <img src={STAR_FILLED} alt="" className={starImg} />
            <span className={`font-black tabular-nums leading-none text-white ${numSm}`}>{n}</span>
        </div>
    );

    const gridGapClass = compact ? 'gap-1' : 'gap-2 sm:gap-3';

    return (
        <div className={`w-full ${shell}`}>
            <div
                className={`grid items-center ${
                    compact ? `grid-cols-[1fr_minmax(0,7rem)_1fr] ${gridGapClass}` : `grid-cols-[1fr_minmax(0,11rem)_1fr] ${gridGapClass}`
                }`}
            >
                <div className="flex min-w-0 flex-col items-center gap-0.5 text-sky-100">
                    {starScoreRow(blueStars)}
                    {showHouseRow ? (
                        <span className={`font-semibold tabular-nums text-cyan-200/90 ${numXs}`}>집 {blueHouse.toLocaleString()}</span>
                    ) : null}
                </div>

                <div className="relative flex min-w-0 flex-col items-center justify-center gap-1.5">
                    <span
                        className={`font-black tracking-[0.2em] text-amber-200/90 ${compact ? 'text-[9px]' : 'text-xs sm:text-sm'}`}
                        style={{ textShadow: '0 1px 8px rgba(0,0,0,0.85)' }}
                    >
                        VS
                    </span>
                    <div className="relative w-full">
                        <div
                            className={`pointer-events-none absolute left-1/2 top-0 z-[1] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-amber-200/55 to-transparent ${
                                compact ? 'h-2' : 'h-2.5 sm:h-3'
                            }`}
                            aria-hidden
                        />
                        <div
                            className={`relative overflow-hidden rounded-full ring-1 ring-black/50 ${compact ? 'h-2' : 'h-2.5 sm:h-3'}`}
                            style={{
                                background: `linear-gradient(90deg,
                                    rgb(2 132 199) 0%,
                                    rgb(56 189 248) ${pct},
                                    rgb(244 63 94) ${pct},
                                    rgb(190 18 60) 100%)`,
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
                            }}
                        />
                        <div
                            className="pointer-events-none absolute inset-y-0 z-[2] w-0.5 rounded-full bg-amber-100/90 shadow-[0_0_10px_rgba(254,243,199,0.65)]"
                            style={{ left: pct, transform: 'translateX(-50%)' }}
                            title={`좌측 우세 약 ${(p * 100).toFixed(0)}% (별·집점)`}
                            aria-hidden
                        />
                    </div>
                </div>

                <div className="flex min-w-0 flex-col items-center gap-0.5 text-rose-100">
                    {starScoreRow(redStars)}
                    {showHouseRow ? (
                        <span className={`font-semibold tabular-nums text-rose-200/90 ${numXs}`}>집 {redHouse.toLocaleString()}</span>
                    ) : null}
                </div>
            </div>
        </div>
    );
};
