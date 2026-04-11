import React, { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '../../utils/apiConfig.js';
import Button from '../Button.js';
import AdminPageHeader from './AdminPageHeader.js';
import { adminCard, adminCardTitle, adminPageNarrow, adminSectionGap } from './adminChrome.js';

type AdminServerMetricsPayload = {
    serverTime: string;
    uptimeSec: number;
    memLimitMbAssumed: number;
    now: {
        totalWs: number;
        authenticatedUsers: number;
        authenticatedSockets: number;
        volatileOnlineUsers?: number;
    };
    memory: {
        rssMb: number;
        heapUsedMb: number;
        heapTotalMb: number;
        externalMb: number;
        rssToLimitRatio: number | null;
        heapUsedToTotalRatio: number;
    };
    eventLoopLagMsMean: number;
    peaks: {
        totalWs: number;
        totalWsAt: string;
        authenticatedUsers: number;
        authenticatedUsersAt: string;
        authenticatedSockets: number;
        authenticatedSocketsAt: string;
    };
    busiestHourUtc: {
        key: string | null;
        maxUsers: number;
        maxTotalWs: number;
        lastAt: string | null;
    };
    hourlyRecent: Array<{ key: string; maxUsers: number; maxTotalWs: number; lastAt: string }>;
    recentAlerts: Array<{ at: string; level: 'warn' | 'critical'; code: string; message: string }>;
    thresholds: {
        rssWarnRatio: number;
        rssCritRatio: number;
        heapWarnRatio: number;
        lagWarnMs: number;
        lagCritMs: number;
        wsSoftWarn: number;
        wsSoftCrit: number;
    };
};

interface ServerMonitoringPanelProps {
    currentUserId: string;
    onBack: () => void;
}

type MetricsMobileTab = 'live' | 'peaks' | 'hours' | 'health';

const isUnsetPeak = (iso: string) => !iso || iso.startsWith('1970-');

function formatKst(iso: string): string {
    if (isUnsetPeak(iso)) return '—';
    try {
        return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'medium' });
    } catch {
        return iso;
    }
}

function hourKeyToKstLabel(key: string): string {
    if (!key || key.length < 13) return key;
    try {
        const [d, h] = key.split('T');
        if (!d || h === undefined) return key;
        const hour = parseInt(h, 10);
        if (Number.isNaN(hour)) return key;
        const utc = new Date(`${d}T${String(hour).padStart(2, '0')}:00:00.000Z`);
        return utc.toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            month: 'short',
            day: 'numeric',
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    } catch {
        return key;
    }
}

function formatUptime(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h >= 48) return `${Math.floor(h / 24)}일 ${h % 24}시간`;
    if (h > 0) return `${h}시간 ${m}분`;
    return `${m}분`;
}

const monitorCardClass = `${adminCard} border-amber-500/10 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.45)]`;

const ServerMonitoringPanel: React.FC<ServerMonitoringPanelProps> = ({ currentUserId, onBack }) => {
    const [data, setData] = useState<AdminServerMetricsPayload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [mobileTab, setMobileTab] = useState<MetricsMobileTab>('live');

    const fetchMetrics = useCallback(async () => {
        setLoading(true);
        setError(null);
        const q = new URLSearchParams({ userId: currentUserId });
        const candidates = [
            getApiUrl(`/api/admin/server-metrics?${q}`),
            getApiUrl(`/admin/server-metrics?${q}`),
            `/api/admin/server-metrics?${q}`,
            `/admin/server-metrics?${q}`,
        ];
        let lastErr: string | null = null;
        for (const url of candidates) {
            try {
                const res = await fetch(url);
                if (!res.ok) {
                    const j = await res.json().catch(() => ({}));
                    lastErr = (j as { message?: string }).message || `HTTP ${res.status}`;
                    continue;
                }
                const json = (await res.json()) as AdminServerMetricsPayload;
                setData(json);
                setLoading(false);
                return;
            } catch (e: any) {
                lastErr = e?.message || String(e);
            }
        }
        setError(lastErr || '조회 실패');
        setLoading(false);
    }, [currentUserId]);

    useEffect(() => {
        void fetchMetrics();
        const id = setInterval(() => void fetchMetrics(), 12_000);
        return () => clearInterval(id);
    }, [fetchMetrics]);

    const rssRatio = data?.memory.rssToLimitRatio ?? null;
    const heapRatio = data?.memory.heapUsedToTotalRatio ?? 0;
    const lag = data?.eventLoopLagMsMean ?? 0;

    const mobileTabs: { id: MetricsMobileTab; label: string }[] = [
        { id: 'live', label: '실시간' },
        { id: 'peaks', label: '역대 피크' },
        { id: 'hours', label: '시간대' },
        { id: 'health', label: '부하·경고' },
    ];

    if (!data) {
        return (
            <div className={`${adminPageNarrow} ${adminSectionGap}`}>
                <AdminPageHeader
                    title="서버 부하 · 동시접속"
                    subtitle="WebSocket·메모리·이벤트 루프 지표를 확인합니다."
                    onBack={onBack}
                    rightSlot={
                        <Button type="button" colorScheme="gray" onClick={() => void fetchMetrics()} disabled={loading} className="!text-sm">
                            {loading ? '불러오는 중…' : '새로고침'}
                        </Button>
                    }
                />
                {error && (
                    <div className="rounded-xl border border-red-500/35 bg-gradient-to-br from-red-950/60 to-red-950/30 px-4 py-3 text-sm text-red-100 shadow-inner backdrop-blur-sm">
                        {error}
                    </div>
                )}
                {loading && !error && <p className="text-center text-sm text-gray-500">데이터를 불러오는 중…</p>}
            </div>
        );
    }

    const liveSection = (
        <section className={monitorCardClass}>
            <div className="mb-4 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-base" aria-hidden>
                    ◉
                </span>
                <h2 className={`${adminCardTitle} mb-0 border-0 pb-0`}>지금 상태</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
                <Metric label="WebSocket (전체)" value={data.now.totalWs} hint="인증 전·탭 합산" accent="cyan" />
                <Metric label="인증 유저(고유)" value={data.now.authenticatedUsers} hint="AUTH 완료 수" accent="amber" />
                <Metric label="인증 소켓" value={data.now.authenticatedSockets} hint="다중 탭 포함" accent="violet" />
                <Metric label="앱 온라인(추정)" value={data.now.volatileOnlineUsers ?? 0} hint="userConnections 키" accent="emerald" />
            </div>
            <div className="mt-4 rounded-xl border border-color/35 bg-black/20 px-3 py-2.5 text-[11px] leading-relaxed text-gray-500 sm:text-xs">
                <span className="text-gray-400">서버 시각</span> {formatKst(data.serverTime)}
                <span className="mx-2 text-color/40">·</span>
                <span className="text-gray-400">가동</span> {formatUptime(data.uptimeSec)}
                <span className="mx-2 text-color/40">·</span>
                <span className="text-gray-400">가정 메모리 한도</span> {data.memLimitMbAssumed}MB
                {rssRatio == null ? <span className="text-gray-600"> (한도 미설정 시 기본값)</span> : null}
            </div>
        </section>
    );

    const peaksSection = (
        <section className={monitorCardClass}>
            <div className="mb-4 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-base" aria-hidden>
                    ▲
                </span>
                <h2 className={`${adminCardTitle} mb-0 border-0 pb-0`}>역대 최대 동시접속</h2>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-gray-500">KV에 누적된 최댓값입니다. 레플리카가 여러 개면 인스턴스별로 다를 수 있습니다.</p>
            <div className="space-y-2 text-sm">
                <PeakRow title="동시 WebSocket" n={data.peaks.totalWs} at={data.peaks.totalWsAt} />
                <PeakRow title="동시 인증 유저" n={data.peaks.authenticatedUsers} at={data.peaks.authenticatedUsersAt} />
                <PeakRow title="동시 인증 소켓" n={data.peaks.authenticatedSockets} at={data.peaks.authenticatedSocketsAt} />
            </div>
        </section>
    );

    const busiestBlock = (
        <>
            <div className="mb-4 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-base" aria-hidden>
                    ⏱
                </span>
                <h2 className={`${adminCardTitle} mb-0 border-0 pb-0`}>가장 붐볐던 시간대</h2>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-gray-500">UTC 시간대 버킷 기준으로 집계된 최고 혼잡 구간입니다.</p>
            {data.busiestHourUtc.key ? (
                <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/25 to-transparent p-4 text-sm">
                    <p className="text-xs text-gray-500">한국 시각 기준</p>
                    <p className="mt-1 text-lg font-semibold tracking-tight text-amber-100/95">{hourKeyToKstLabel(data.busiestHourUtc.key)}</p>
                    <p className="mt-1 font-mono text-[11px] text-gray-500">UTC 키 {data.busiestHourUtc.key}:00</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-color/30 pt-3">
                        <div>
                            <p className="text-[11px] uppercase tracking-wider text-gray-500">최대 인증 유저</p>
                            <p className="font-mono text-xl text-primary">{data.busiestHourUtc.maxUsers}</p>
                        </div>
                        <div>
                            <p className="text-[11px] uppercase tracking-wider text-gray-500">최대 WS</p>
                            <p className="font-mono text-xl text-primary">{data.busiestHourUtc.maxTotalWs}</p>
                        </div>
                    </div>
                    {data.busiestHourUtc.lastAt && (
                        <p className="mt-3 text-xs text-gray-500">갱신 {formatKst(data.busiestHourUtc.lastAt)}</p>
                    )}
                </div>
            ) : (
                <p className="text-sm text-gray-500">아직 시간대 샘플이 없습니다.</p>
            )}
        </>
    );

    const hourlyTableSection =
        data.hourlyRecent.length > 0 ? (
            <div className={`${monitorCardClass} overflow-hidden p-0 sm:p-0`}>
                <div className="border-b border-color/40 bg-black/25 px-5 py-4 sm:px-6">
                    <h3 className="text-sm font-semibold tracking-tight text-primary">최근 시간대 요약</h3>
                    <p className="mt-0.5 text-[11px] text-gray-500">최대 72구간 · 최신순</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[280px] border-collapse text-left text-xs">
                        <thead>
                            <tr className="border-b border-color/50 bg-secondary/30 text-[11px] uppercase tracking-wide text-gray-500">
                                <th className="px-4 py-3 font-medium sm:px-5">구간 (KST)</th>
                                <th className="px-3 py-3 font-medium">유저</th>
                                <th className="px-3 py-3 font-medium">WS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...data.hourlyRecent].reverse().map((row) => (
                                <tr key={row.key} className="border-b border-color/35 transition-colors hover:bg-secondary/20">
                                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-300 sm:px-5">{hourKeyToKstLabel(row.key)}</td>
                                    <td className="px-3 py-2.5 font-mono text-amber-200/90">{row.maxUsers}</td>
                                    <td className="px-3 py-2.5 font-mono text-cyan-200/85">{row.maxTotalWs}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        ) : null;

    const hoursSection = (
        <>
            <section className={monitorCardClass}>{busiestBlock}</section>
            {hourlyTableSection != null ? <div className="mt-4 space-y-0 sm:mt-6">{hourlyTableSection}</div> : null}
        </>
    );

    const healthSection = (
        <section className={monitorCardClass}>
            <div className="mb-4 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 text-base" aria-hidden>
                    ⚡
                </span>
                <h2 className={`${adminCardTitle} mb-0 border-0 pb-0`}>부하 · 주의 신호</h2>
            </div>
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-emerald-500/15 bg-gradient-to-br from-emerald-950/20 to-secondary/20 p-4 shadow-inner">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400/90">메모리</h3>
                    <ul className="space-y-1.5 text-xs text-gray-400">
                        <li>
                            RSS <span className="font-mono text-primary">{data.memory.rssMb}</span> MB
                            {rssRatio != null ? (
                                <span className="text-gray-500"> ({Math.round(rssRatio * 100)}% / 한도 {data.memLimitMbAssumed}MB)</span>
                            ) : null}
                        </li>
                        <li>
                            Heap{' '}
                            <span className="font-mono text-primary">
                                {data.memory.heapUsedMb} / {data.memory.heapTotalMb}
                            </span>{' '}
                            MB ({Math.round(heapRatio * 100)}%)
                        </li>
                        <li>
                            External <span className="font-mono text-primary">{data.memory.externalMb}</span> MB
                        </li>
                    </ul>
                    <p className="mt-3 border-t border-color/30 pt-3 text-[11px] leading-relaxed text-amber-200/80">
                        RSS가 한도의 약 {Math.round(data.thresholds.rssCritRatio * 100)}% 부근이면 재시작 안내가 나갈 수 있습니다.
                    </p>
                </div>
                <div className="rounded-xl border border-sky-500/15 bg-gradient-to-br from-sky-950/20 to-secondary/20 p-4 shadow-inner">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-400/90">이벤트 루프 · 연결</h3>
                    <p className="mb-2 text-xs text-gray-400">
                        지연 평균(약 1분){' '}
                        <span className="font-mono text-lg text-sky-200">{lag}</span> <span className="text-gray-500">ms</span>
                    </p>
                    <ul className="space-y-1 text-[11px] text-gray-500">
                        <li>
                            지연 경고 ≥ {data.thresholds.lagWarnMs}ms · 위험 ≥ {data.thresholds.lagCritMs}ms
                        </li>
                        <li>
                            WS 경고 ≥ {data.thresholds.wsSoftWarn} · 위험 ≥ {data.thresholds.wsSoftCrit}
                        </li>
                        <li>Heap 경고 ≥ {Math.round(data.thresholds.heapWarnRatio * 100)}%</li>
                    </ul>
                </div>
            </div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">최근 자동 기록</h3>
            {data.recentAlerts.length === 0 ? (
                <p className="rounded-lg border border-color/30 bg-secondary/20 py-6 text-center text-sm text-gray-500">기록된 경고가 없습니다.</p>
            ) : (
                <ul className="max-h-60 space-y-2 overflow-y-auto pr-1 text-xs sm:max-h-72">
                    {[...data.recentAlerts].reverse().map((a, i) => (
                        <li
                            key={`${a.at}-${a.code}-${i}`}
                            className={`rounded-xl border px-3 py-2.5 ${
                                a.level === 'critical'
                                    ? 'border-red-500/40 bg-gradient-to-r from-red-950/50 to-red-950/20 text-red-100'
                                    : 'border-amber-500/35 bg-gradient-to-r from-amber-950/40 to-amber-950/10 text-amber-100'
                            }`}
                        >
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <span className="text-[11px] opacity-70">{formatKst(a.at)}</span>
                                <span className="font-mono text-[11px] opacity-90">{a.code}</span>
                            </div>
                            <p className="mt-1 leading-snug">{a.message}</p>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );

    return (
        <div className={`${adminPageNarrow} ${adminSectionGap}`}>
            <AdminPageHeader
                title="서버 부하 · 동시접속"
                subtitle="WebSocket·피크·시간대·리소스 지표를 한곳에서 확인합니다."
                onBack={onBack}
                rightSlot={
                    <Button type="button" colorScheme="gray" onClick={() => void fetchMetrics()} disabled={loading} className="!text-sm">
                        {loading ? '불러오는 중…' : '새로고침'}
                    </Button>
                }
            />

            {error && (
                <div className="rounded-xl border border-red-500/35 bg-gradient-to-br from-red-950/60 to-red-950/30 px-4 py-3 text-sm text-red-100 shadow-inner backdrop-blur-sm">
                    {error}
                </div>
            )}

            {/* 모바일 탭 */}
            <div className="lg:hidden">
                <div
                    className="sticky top-0 z-20 -mx-1 mb-4 border-b border-color/40 bg-primary/95 px-1 pb-3 pt-0 backdrop-blur-md"
                    role="tablist"
                    aria-label="모니터 구역"
                >
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
                        {mobileTabs.map((tab) => {
                            const active = mobileTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setMobileTab(tab.id)}
                                    className={`shrink-0 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-all sm:text-sm ${
                                        active
                                            ? 'border-cyan-400/45 bg-gradient-to-b from-cyan-500/20 to-amber-500/10 text-amber-50 shadow-inner'
                                            : 'border-color/50 bg-secondary/40 text-gray-400 hover:border-color hover:bg-secondary/60 hover:text-primary'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="min-h-[10rem]" role="tabpanel">
                    {mobileTab === 'live' && liveSection}
                    {mobileTab === 'peaks' && peaksSection}
                    {mobileTab === 'hours' && hoursSection}
                    {mobileTab === 'health' && healthSection}
                </div>
            </div>

            {/* 데스크톱: 2열 + 전폭 테이블 */}
            <div className="hidden lg:block">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start xl:gap-8">
                    <div className="space-y-6 xl:space-y-8">
                        {liveSection}
                        {peaksSection}
                    </div>
                    <div className="space-y-6 xl:space-y-8">
                        <section className={monitorCardClass}>
                            {busiestBlock}
                        </section>
                        {healthSection}
                    </div>
                </div>
                {hourlyTableSection != null && <div className="mt-6 xl:mt-8">{hourlyTableSection}</div>}
            </div>
        </div>
    );
};

const accentBar: Record<string, string> = {
    cyan: 'from-cyan-400/80 to-cyan-600/40',
    amber: 'from-amber-400/80 to-amber-600/40',
    violet: 'from-violet-400/70 to-violet-600/40',
    emerald: 'from-emerald-400/70 to-emerald-600/40',
};

const Metric: React.FC<{ label: string; value: number; hint?: string; accent?: keyof typeof accentBar }> = ({
    label,
    value,
    hint,
    accent = 'cyan',
}) => (
    <div className="group relative overflow-hidden rounded-xl border border-color/40 bg-gradient-to-br from-secondary/40 to-black/20 px-4 py-3 shadow-inner transition-all hover:border-amber-500/20">
        <div
            className={`absolute left-0 top-0 h-full w-1 bg-gradient-to-b ${accentBar[accent] ?? accentBar.cyan}`}
            aria-hidden
        />
        <p className="pl-2 text-[11px] font-medium text-gray-500">{label}</p>
        <p className="pl-2 font-mono text-2xl font-semibold tracking-tight text-primary tabular-nums">{value}</p>
        {hint && <p className="mt-1 pl-2 text-[10px] leading-snug text-gray-600">{hint}</p>}
    </div>
);

const PeakRow: React.FC<{ title: string; n: number; at: string }> = ({ title, n, at }) => (
    <div className="flex flex-col gap-1 rounded-xl border border-color/35 bg-secondary/25 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <span className="text-sm text-gray-400">{title}</span>
        <span className="font-mono text-xl font-semibold tabular-nums text-amber-100/95">{n}</span>
        <span className="w-full text-[11px] text-gray-500 sm:w-auto sm:text-right">
            {isUnsetPeak(at) ? '아직 기록 없음' : formatKst(at)}
        </span>
    </div>
);

export default ServerMonitoringPanel;
