/**
 * 관리자 모니터링: WebSocket 동시 접속 피크, 시간대별 부하, 메모리·이벤트 루프 지연 알림.
 * KV 키 serverLoadMetricsV1 — 프로세스 재시작 후에도 피크·시간대 통계 유지.
 */
import { monitorEventLoopDelay } from 'node:perf_hooks';

const KV_KEY = 'serverLoadMetricsV1';

const REPLICA_LIMIT_MB = parseInt(process.env.RAILWAY_REPLICA_MEMORY_LIMIT_MB || '0', 10);
const MEM_LIMIT_MB = REPLICA_LIMIT_MB > 0 ? REPLICA_LIMIT_MB : process.env.RAILWAY_ENVIRONMENT ? 512 : 2048;
const RSS_WARN_RATIO = 0.72;
const RSS_CRIT_RATIO = 0.88;
const HEAP_WARN_RATIO = 0.88;
const LAG_WARN_MS = 120;
const LAG_CRIT_MS = 350;
const WS_SOFT_WARN = 800;
const WS_SOFT_CRIT = 1500;
const MAX_HOURLY_KEYS = 744;
const MAX_ALERTS = 120;
const ALERT_DEDUP_MS = 4 * 60 * 1000;

export type WebSocketConnStats = {
    totalWs: number;
    authenticatedUsers: number;
    authenticatedSockets: number;
};

type HourlyBucket = {
    maxUsers: number;
    maxTotalWs: number;
    lastAt: string;
};

type PersistedV1 = {
    v: 1;
    peak: {
        totalWs: number;
        totalWsAt: string;
        authenticatedUsers: number;
        authenticatedUsersAt: string;
        authenticatedSockets: number;
        authenticatedSocketsAt: string;
    };
    hourly: Record<string, HourlyBucket>;
    alerts: Array<{ at: string; level: 'warn' | 'critical'; code: string; message: string }>;
};

let persisted: PersistedV1 | null = null;
let loadPromise: Promise<PersistedV1> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistDirty = false;

const elHistogram = monitorEventLoopDelay({ resolution: 20 });
elHistogram.enable();

let lastAlertAtByCode: Record<string, number> = {};

function defaultPersisted(): PersistedV1 {
    const z = new Date(0).toISOString();
    return {
        v: 1,
        peak: {
            totalWs: 0,
            totalWsAt: z,
            authenticatedUsers: 0,
            authenticatedUsersAt: z,
            authenticatedSockets: 0,
            authenticatedSocketsAt: z,
        },
        hourly: {},
        alerts: [],
    };
}

async function loadPersisted(): Promise<PersistedV1> {
    if (persisted) return persisted;
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
        try {
            const kv = await import('./repositories/kvRepository.js');
            const raw = await kv.getKV<PersistedV1>(KV_KEY);
            if (raw && raw.v === 1 && raw.peak && typeof raw.hourly === 'object') {
                persisted = {
                    ...raw,
                    alerts: Array.isArray(raw.alerts) ? raw.alerts.slice(-MAX_ALERTS) : [],
                };
                return persisted;
            }
        } catch {
            // ignore
        }
        persisted = defaultPersisted();
        return persisted;
    })();
    try {
        return await loadPromise;
    } finally {
        loadPromise = null;
    }
}

function trimHourly(hourly: Record<string, HourlyBucket>): Record<string, HourlyBucket> {
    const keys = Object.keys(hourly).sort();
    if (keys.length <= MAX_HOURLY_KEYS) return hourly;
    const next: Record<string, HourlyBucket> = {};
    for (const k of keys.slice(-MAX_HOURLY_KEYS)) {
        next[k] = hourly[k]!;
    }
    return next;
}

function schedulePersist() {
    persistDirty = true;
    if (persistTimer) return;
    persistTimer = setTimeout(() => {
        persistTimer = null;
        void flushPersist();
    }, 4000);
}

async function flushPersist() {
    if (!persistDirty || !persisted) return;
    persistDirty = false;
    try {
        const kv = await import('./repositories/kvRepository.js');
        const toSave: PersistedV1 = {
            ...persisted,
            hourly: trimHourly(persisted.hourly),
            alerts: persisted.alerts.slice(-MAX_ALERTS),
        };
        persisted = toSave;
        await kv.setKV(KV_KEY, toSave);
    } catch (e) {
        console.warn('[ServerLoadMetrics] persist failed:', (e as Error)?.message);
        persistDirty = true;
    }
}

function pushAlert(p: PersistedV1, level: 'warn' | 'critical', code: string, message: string) {
    const now = Date.now();
    const last = lastAlertAtByCode[code] || 0;
    if (now - last < ALERT_DEDUP_MS) return;
    lastAlertAtByCode[code] = now;
    p.alerts.push({ at: new Date().toISOString(), level, code, message });
    schedulePersist();
}

function mergePeak(p: PersistedV1['peak'], s: WebSocketConnStats, at: string): boolean {
    let changed = false;
    if (s.totalWs > p.totalWs) {
        p.totalWs = s.totalWs;
        p.totalWsAt = at;
        changed = true;
    }
    if (s.authenticatedUsers > p.authenticatedUsers) {
        p.authenticatedUsers = s.authenticatedUsers;
        p.authenticatedUsersAt = at;
        changed = true;
    }
    if (s.authenticatedSockets > p.authenticatedSockets) {
        p.authenticatedSockets = s.authenticatedSockets;
        p.authenticatedSocketsAt = at;
        changed = true;
    }
    return changed;
}

function updateHourly(p: PersistedV1, s: WebSocketConnStats, at: string): boolean {
    const hourKey = at.slice(0, 13);
    const cur = p.hourly[hourKey] || { maxUsers: 0, maxTotalWs: 0, lastAt: at };
    const nu = Math.max(cur.maxUsers, s.authenticatedUsers);
    const nw = Math.max(cur.maxTotalWs, s.totalWs);
    if (nu === cur.maxUsers && nw === cur.maxTotalWs) return false;
    p.hourly[hourKey] = { maxUsers: nu, maxTotalWs: nw, lastAt: at };
    return true;
}

/** WebSocket 연결/인증/종료 시 socket.ts에서 호출 (디바운스). */
let wsDebounce: ReturnType<typeof setTimeout> | null = null;
let pendingWsGetter: (() => WebSocketConnStats) | null = null;

export function scheduleWebSocketMetricsSample(getStats: () => WebSocketConnStats): void {
    pendingWsGetter = getStats;
    if (wsDebounce) return;
    wsDebounce = setTimeout(() => {
        wsDebounce = null;
        const fn = pendingWsGetter;
        pendingWsGetter = null;
        if (!fn) return;
        void applyWebSocketSnapshot(fn());
    }, 250);
}

async function applyWebSocketSnapshot(s: WebSocketConnStats): Promise<void> {
    const p = await loadPersisted();
    const at = new Date().toISOString();
    const a = mergePeak(p.peak, s, at);
    const b = updateHourly(p, s, at);
    if (a || b) schedulePersist();
}

function busiestHourFromHourly(hourly: Record<string, HourlyBucket>): {
    key: string | null;
    maxUsers: number;
    maxTotalWs: number;
    lastAt: string | null;
} {
    let bestKey: string | null = null;
    let maxUsers = 0;
    let maxTotalWs = 0;
    let lastAt: string | null = null;
    for (const [k, v] of Object.entries(hourly)) {
        if (v.maxUsers > maxUsers || (v.maxUsers === maxUsers && v.maxTotalWs > maxTotalWs)) {
            bestKey = k;
            maxUsers = v.maxUsers;
            maxTotalWs = v.maxTotalWs;
            lastAt = v.lastAt;
        }
    }
    return { key: bestKey, maxUsers, maxTotalWs, lastAt };
}

function evalRuntimeAlerts(
    p: PersistedV1,
    rssMb: number,
    heapRatio: number,
    lagMs: number,
    stats: WebSocketConnStats,
): void {
    const rssRatio = MEM_LIMIT_MB > 0 ? rssMb / MEM_LIMIT_MB : 0;
    if (rssRatio >= RSS_CRIT_RATIO) {
        pushAlert(p, 'critical', 'rss_high', `RSS ${rssMb}MB ≈ ${Math.round(rssRatio * 100)}% of 설정 한도 ${MEM_LIMIT_MB}MB (과부하·재시작 위험)`);
    } else if (rssRatio >= RSS_WARN_RATIO) {
        pushAlert(p, 'warn', 'rss_elevated', `RSS ${rssMb}MB ≈ ${Math.round(rssRatio * 100)}% of 한도 ${MEM_LIMIT_MB}MB`);
    }
    if (heapRatio >= HEAP_WARN_RATIO) {
        pushAlert(p, 'warn', 'heap_high', `Heap 사용 ${Math.round(heapRatio * 100)}% — 메모리 압박 가능`);
    }
    if (lagMs >= LAG_CRIT_MS) {
        pushAlert(p, 'critical', 'event_loop_lag', `이벤트 루프 지연 평균 ~${Math.round(lagMs)}ms — 처리 지연·타임아웃 위험`);
    } else if (lagMs >= LAG_WARN_MS) {
        pushAlert(p, 'warn', 'event_loop_lag', `이벤트 루프 지연 평균 ~${Math.round(lagMs)}ms`);
    }
    if (stats.totalWs >= WS_SOFT_CRIT) {
        pushAlert(p, 'critical', 'ws_connections_very_high', `동시 WebSocket ${stats.totalWs}개 — 브로드캐스트·메모리 부담 큼`);
    } else if (stats.totalWs >= WS_SOFT_WARN) {
        pushAlert(p, 'warn', 'ws_connections_high', `동시 WebSocket ${stats.totalWs}개 — 확장 시 병목 가능`);
    }
}

let monitoringStarted = false;

export function startServerLoadMonitoring(): void {
    if (monitoringStarted) return;
    monitoringStarted = true;
    setInterval(() => {
        void monitoringTick();
    }, 60_000);
    void monitoringTick();
}

async function monitoringTick(): Promise<void> {
    let stats: WebSocketConnStats = {
        totalWs: 0,
        authenticatedUsers: 0,
        authenticatedSockets: 0,
    };
    try {
        const { getWebSocketConnectionStats } = await import('./socket.js');
        stats = getWebSocketConnectionStats();
        await applyWebSocketSnapshot(stats);
    } catch {
        // socket 미초기화 등
    }

    const lagMeanNs = elHistogram.mean;
    const lagMs = lagMeanNs / 1e6;
    elHistogram.reset();

    const mem = process.memoryUsage();
    const rssMb = Math.round(mem.rss / 1024 / 1024);
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMb = Math.max(1, Math.round(mem.heapTotal / 1024 / 1024));
    const heapRatio = heapTotalMb > 0 ? mem.heapUsed / mem.heapTotal : 0;

    const p = await loadPersisted();
    evalRuntimeAlerts(p, rssMb, heapRatio, lagMs, stats);
}

export type AdminServerMetricsPayload = {
    serverTime: string;
    uptimeSec: number;
    memLimitMbAssumed: number;
    now: WebSocketConnStats & { volatileOnlineUsers?: number };
    memory: {
        rssMb: number;
        heapUsedMb: number;
        heapTotalMb: number;
        externalMb: number;
        rssToLimitRatio: number | null;
        heapUsedToTotalRatio: number;
    };
    eventLoopLagMsMean: number;
    peaks: PersistedV1['peak'];
    busiestHourUtc: { key: string | null; maxUsers: number; maxTotalWs: number; lastAt: string | null };
    hourlyRecent: Array<{ key: string; maxUsers: number; maxTotalWs: number; lastAt: string }>;
    recentAlerts: PersistedV1['alerts'];
    thresholds: {
        rssWarnRatio: number;
        rssCritRatio: number;
        heapWarnRatio: number;
        lagWarnMs: number;
        lagCritMs: number;
        wsSoftWarn: number;
        wsSoftCrit: number;
    };
    /** KataServer Move API 설정·선택적 연결 프로브(`probeKata=1`) */
    kataServer?: {
        moveApiConfigured: boolean;
        host: string | null;
        timeoutMs: number;
        authKeyConfigured: boolean;
        probe?: {
            ok: boolean;
            latencyMs?: number;
            httpStatus?: number;
            error?: string;
            sampleMove?: string;
        };
    };
};

export async function buildAdminServerMetricsPayload(
    volatileOnlineUsers: number,
    options?: { probeKataServer?: boolean },
): Promise<AdminServerMetricsPayload> {
    const p = await loadPersisted();
    let stats: WebSocketConnStats = {
        totalWs: 0,
        authenticatedUsers: 0,
        authenticatedSockets: 0,
    };
    try {
        const { getWebSocketConnectionStats } = await import('./socket.js');
        stats = getWebSocketConnectionStats();
    } catch {
        // ignore
    }

    const lagMeanNs = elHistogram.mean;
    const lagMs = lagMeanNs / 1e6;

    const mem = process.memoryUsage();
    const rssMb = Math.round(mem.rss / 1024 / 1024);
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMb = Math.max(1, Math.round(mem.heapTotal / 1024 / 1024));
    const externalMb = Math.round(mem.external / 1024 / 1024);
    const rssToLimitRatio = MEM_LIMIT_MB > 0 ? rssMb / MEM_LIMIT_MB : null;

    const hourlyKeys = Object.keys(p.hourly).sort();
    const recentKeys = hourlyKeys.slice(-72);
    const hourlyRecent = recentKeys.map((key) => {
        const b = p.hourly[key]!;
        return { key, maxUsers: b.maxUsers, maxTotalWs: b.maxTotalWs, lastAt: b.lastAt };
    });

    let kataServer: AdminServerMetricsPayload['kataServer'];
    try {
        const { getKataServerConfigSummary, probeKataServerConnection } = await import('./kataServerService.js');
        kataServer = { ...getKataServerConfigSummary() };
        if (options?.probeKataServer) {
            kataServer.probe = await probeKataServerConnection();
        }
    } catch {
        kataServer = undefined;
    }

    return {
        serverTime: new Date().toISOString(),
        uptimeSec: Math.round(process.uptime()),
        memLimitMbAssumed: MEM_LIMIT_MB,
        now: { ...stats, volatileOnlineUsers },
        memory: {
            rssMb,
            heapUsedMb,
            heapTotalMb,
            externalMb,
            rssToLimitRatio,
            heapUsedToTotalRatio: heapTotalMb > 0 ? mem.heapUsed / mem.heapTotal : 0,
        },
        eventLoopLagMsMean: Math.round(lagMs * 10) / 10,
        peaks: { ...p.peak },
        busiestHourUtc: busiestHourFromHourly(p.hourly),
        hourlyRecent,
        recentAlerts: p.alerts.slice(-40),
        thresholds: {
            rssWarnRatio: RSS_WARN_RATIO,
            rssCritRatio: RSS_CRIT_RATIO,
            heapWarnRatio: HEAP_WARN_RATIO,
            lagWarnMs: LAG_WARN_MS,
            lagCritMs: LAG_CRIT_MS,
            wsSoftWarn: WS_SOFT_WARN,
            wsSoftCrit: WS_SOFT_CRIT,
        },
        kataServer,
    };
}
