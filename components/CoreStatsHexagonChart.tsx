import React, { useId, useMemo } from 'react';
import { CoreStat } from '../types.js';

/** 레이더 꼭짓점 순서 (시계 방향, 위부터) — 우측 목록과 동일 순서 */
export const CORE_STAT_RADAR_ORDER: CoreStat[] = [
    CoreStat.Concentration,
    CoreStat.ThinkingSpeed,
    CoreStat.Judgment,
    CoreStat.Calculation,
    CoreStat.CombatPower,
    CoreStat.Stability,
];

export interface CoreStatsHexagonChartProps {
    values: Record<CoreStat, number>;
    /** 있으면 (기본) 대비 장비 보너스를 표시 */
    baseByStat?: Record<CoreStat, number>;
    className?: string;
    /** 모바일에서도 PC와 동일한 2열(그래프+능력치) 레이아웃 강제 */
    desktopLike?: boolean;
    /** 모바일 홈 가독성 향상용 텍스트/그래프 확대 */
    mobileReadable?: boolean;
}

/** 꼭짓점 라벨 (2글자) — 그래프 색인 */
const SHORT_LABELS: Record<CoreStat, string> = {
    [CoreStat.Concentration]: '집중',
    [CoreStat.ThinkingSpeed]: '사고',
    [CoreStat.Judgment]: '판단',
    [CoreStat.Calculation]: '계산',
    [CoreStat.CombatPower]: '전투',
    [CoreStat.Stability]: '안정',
};

const VB = 100;
const CX = 50;
const CY = 50;
const R_DATA = 36;
/** 데이터 폴리곤이 최외곽 테두리에 닿지 않도록 인셋 */
const R_DATA_INSET = 32;
/** 꼭짓점 바깥쪽 라벨 배치 반경 (그리드보다 약간 밖) */
const R_LABEL = 45;

/**
 * 바둑능력(6개 핵심 능력치 합계) 구간별로 육각형 그래프 한 축의 시각적 최댓값.
 * 합이 구간 최대를 넘는 능력치는 그래프에서만 외곽선에 맞춤.
 */
export function radarAxisMaxForBadukAbilityTotal(badukAbilityTotal: number): number {
    const t = Number.isFinite(badukAbilityTotal) ? Math.max(0, badukAbilityTotal) : 0;
    if (t <= 2000) return 300;
    if (t <= 4000) return 600;
    if (t <= 6000) return 900;
    if (t <= 8000) return 1200;
    return 1500;
}

function vertex(angleRad: number, r: number): { x: number; y: number } {
    return {
        x: CX + r * Math.cos(angleRad),
        y: CY + r * Math.sin(angleRad),
    };
}

function hexPolygonPoints(r: number): string {
    return CORE_STAT_RADAR_ORDER.map((_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
        const { x, y } = vertex(a, r);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
}

/**
 * 좌측: 육각 레이더 + 꼭짓점 색인 라벨 / 우측: 6개 능력치 상세 목록
 */
const CoreStatsHexagonChart: React.FC<CoreStatsHexagonChartProps> = ({ values, baseByStat, className = '', desktopLike = false, mobileReadable = false }) => {
    const uid = useId().replace(/:/g, '');
    const gradId = `coreStatRadarFill-${uid}`;

    const { dataPoints, labelPositions } = useMemo(() => {
        const badukAbilityTotal = CORE_STAT_RADAR_ORDER.reduce((sum, stat) => {
            const vRaw = values[stat];
            const v = typeof vRaw === 'number' && Number.isFinite(vRaw) ? vRaw : 0;
            return sum + Math.max(0, v);
        }, 0);
        const radarMax = radarAxisMaxForBadukAbilityTotal(badukAbilityTotal);

        const pts = CORE_STAT_RADAR_ORDER.map((stat, i) => {
            const vRaw = values[stat];
            const v = typeof vRaw === 'number' && Number.isFinite(vRaw) ? Math.max(0, vRaw) : 0;
            const vCapped = Math.min(v, radarMax);
            const ratio = radarMax > 0 ? vCapped / radarMax : 0;
            const a = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
            const { x, y } = vertex(a, R_DATA_INSET * ratio);
            return { x, y };
        });

        const labels = CORE_STAT_RADAR_ORDER.map((stat, i) => {
            const a = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
            const p = vertex(a, R_LABEL);
            return { stat, x: p.x, y: p.y };
        });

        return { dataPoints: pts, labelPositions: labels };
    }, [values]);

    const dataPolygon = dataPoints.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

    return (
        <div className={`flex h-full min-h-0 w-full min-w-0 ${desktopLike ? 'flex-row items-stretch gap-2.5' : 'flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3'} ${className}`}>
            <div className={`relative flex shrink-0 flex-col items-center justify-center rounded-xl border border-indigo-500/40 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 px-2.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_10px_30px_-14px_rgba(0,0,0,0.6)] ${desktopLike ? 'w-[min(60%,250px)] max-w-[250px] py-4' : 'sm:w-[min(52%,220px)] sm:max-w-[220px] sm:py-4'}`}>
                <div className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(ellipse_at_30%_20%,rgba(129,140,248,0.08),transparent_50%)]" aria-hidden />
                <svg
                    viewBox={`0 0 ${VB} ${VB}`}
                    className={`relative z-[1] w-full overflow-visible ${desktopLike ? (mobileReadable ? 'h-48 max-w-[235px]' : 'h-44 max-w-[220px]') : 'h-[9.5rem] max-w-[180px] sm:h-44 sm:max-w-[200px]'}`}
                    role="img"
                    aria-label="육각형 능력치 그래프"
                >
                    <defs>
                        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="rgb(129, 140, 248)" stopOpacity="0.5" />
                            <stop offset="100%" stopColor="rgb(52, 211, 153)" stopOpacity="0.38" />
                        </linearGradient>
                    </defs>

                    {/* 최외곽 정육각형 테두리(기준) */}
                    <polygon
                        points={hexPolygonPoints(R_DATA)}
                        fill="none"
                        stroke="rgb(251, 191, 36)"
                        strokeOpacity={0.45}
                        strokeWidth={1.15}
                    />

                    {[1 / 3, 2 / 3, 1].map((scale, idx) => (
                        <polygon
                            key={idx}
                            points={hexPolygonPoints(R_DATA * scale)}
                            fill="none"
                            stroke="currentColor"
                            strokeOpacity={0.10 + idx * 0.05}
                            strokeWidth={0.35}
                            className="text-primary"
                        />
                    ))}

                    {CORE_STAT_RADAR_ORDER.map((_, i) => {
                        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
                        const outer = vertex(a, R_DATA);
                        return (
                            <line
                                key={i}
                                x1={CX}
                                y1={CY}
                                x2={outer.x}
                                y2={outer.y}
                                stroke="currentColor"
                                strokeOpacity={0.14}
                                strokeWidth={0.35}
                                className="text-primary"
                            />
                        );
                    })}

                    <polygon
                        points={dataPolygon}
                        fill={`url(#${gradId})`}
                        stroke="rgb(129, 140, 248)"
                        strokeWidth={0.9}
                        strokeOpacity={0.95}
                    />

                    {dataPoints.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={1.5} fill="rgb(196, 181, 253)" stroke="rgb(99, 102, 241)" strokeWidth={0.45} />
                    ))}

                    {/* 꼭짓점 능력치 색인 — 선명한 스트로크 + 채움 */}
                    {labelPositions.map(({ stat, x, y }) => (
                        <text
                            key={`lbl-${stat}`}
                            x={x}
                            y={y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            paintOrder="stroke fill"
                            stroke="#0f172a"
                            strokeOpacity={0.92}
                            strokeWidth={0.85}
                            fill="#fefce8"
                            fontSize={8.25}
                            fontWeight={800}
                            style={{ letterSpacing: '-0.02em' }}
                            className="select-none"
                        >
                            {SHORT_LABELS[stat]}
                        </text>
                    ))}
                </svg>
            </div>

            <div className={`flex min-h-0 min-w-0 flex-1 flex-col justify-center overflow-hidden ${desktopLike ? 'gap-1.5 py-0.5' : 'gap-0.5 sm:gap-1.5 sm:py-0.5'}`}>
                {CORE_STAT_RADAR_ORDER.map(stat => {
                    const finalV = values[stat] ?? 0;
                    const baseV = baseByStat?.[stat];
                    const bonus = baseV !== undefined ? finalV - baseV : 0;
                    const hasBonus = bonus > 0;
                    return (
                        <div
                            key={stat}
                            className={`flex min-w-0 items-center border-b border-zinc-700/90 last:border-b-0 last:pb-0 ${desktopLike ? 'justify-center pb-1.5' : 'justify-center pb-1 sm:pb-1.5'}`}
                        >
                            <div
                                className={`grid items-center ${desktopLike ? 'w-[12.8rem]' : 'w-full max-w-[16rem]'} ${
                                    desktopLike
                                        ? mobileReadable
                                            ? 'grid-cols-[7rem_2.8rem_3rem] gap-x-1.5'
                                            : 'grid-cols-[6.4rem_2.5rem_2.8rem] gap-x-1.5'
                                        : 'grid-cols-[6.4rem_2.6rem_3rem] gap-x-1'
                                } mx-auto`}
                            >
                                <span
                                    className={`truncate text-right font-semibold leading-tight tracking-tight text-amber-50/95 antialiased ${desktopLike ? (mobileReadable ? 'text-base' : 'text-sm') : 'text-[13px] sm:text-sm'}`}
                                    title={stat}
                                >
                                    {stat}
                                </span>
                                <span className={`shrink-0 text-right font-mono font-bold tabular-nums tracking-tight text-amber-100 ${desktopLike ? (mobileReadable ? 'text-base' : 'text-sm') : 'text-[13px] sm:text-sm'}`}>
                                    {finalV}
                                </span>
                                <span
                                    className={`shrink-0 text-left font-semibold tabular-nums text-emerald-400/95 ${desktopLike ? (mobileReadable ? 'text-sm' : 'text-xs') : 'text-[11px] sm:text-xs'}`}
                                >
                                    {hasBonus ? `(+${bonus})` : ''}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CoreStatsHexagonChart;
