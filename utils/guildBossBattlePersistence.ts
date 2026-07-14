import type { BattleLogEntry, GuildBossBattleResult } from '../types/index.js';

export const GUILD_BOSS_LOG_PLAYBACK_MS = 1600;

const STORAGE_KEY = 'sudamr_pendingGuildBossBattle';
const PENDING_TTL_MS = 60 * 60 * 1000;

export type GuildBossBattleSubmitContext = {
    rankUserId: string;
    preBattleGuildHp: number | undefined;
    bossId: string;
    bossName: string;
    guildId: string;
};

export type GuildBossBattleModalResult = GuildBossBattleResult & {
    bossName: string;
    previousRank?: number | null;
    currentRank?: number | null;
};

export type PendingGuildBossBattle = {
    userId: string;
    guildId: string;
    submitContext: GuildBossBattleSubmitContext;
    simulationResult: GuildBossBattleResult;
    logIndex: number;
    battleLog: BattleLogEntry[];
    userHp: number;
    currentBattleDamage: number;
    simulatedBossHp: number;
    startedAt: number;
    /** 서버 확정 결과 (재생만 남은 상태) */
    confirmedBattleResult?: GuildBossBattleModalResult;
};

function readRaw(): PendingGuildBossBattle | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as PendingGuildBossBattle;
    } catch {
        return null;
    }
}

function writeRaw(pending: PendingGuildBossBattle | null): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
        if (!pending) {
            sessionStorage.removeItem(STORAGE_KEY);
            return;
        }
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
    } catch (err) {
        console.warn('[GuildBoss] Failed to persist pending battle', err);
    }
}

export function savePendingGuildBossBattle(pending: PendingGuildBossBattle): void {
    writeRaw(pending);
}

export function clearPendingGuildBossBattle(): void {
    writeRaw(null);
}

export function loadPendingGuildBossBattle(
    userId: string,
    guildId: string,
    currentBossId: string,
): PendingGuildBossBattle | null {
    const pending = readRaw();
    if (!pending) return null;
    if (pending.userId !== userId || pending.guildId !== guildId) return null;
    if (pending.submitContext.bossId !== currentBossId) return null;
    if (!pending.simulationResult?.battleLog?.length) return null;
    if (Date.now() - pending.startedAt > PENDING_TTL_MS) {
        clearPendingGuildBossBattle();
        return null;
    }
    return pending;
}
