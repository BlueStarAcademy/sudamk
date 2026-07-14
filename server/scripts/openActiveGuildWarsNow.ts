/**
 * 진행 중(active) 길드전의 startTime을 지금으로 당겨 즉시 입장·플레이 가능하게 한다.
 * endTime은 그대로 유지해 «종료까지» 남은 시간은 변경하지 않는다.
 *
 * 실행:
 *   npm run guild-war:open-now
 *   npm run guild-war:open-now -- --match   (매칭 큐 소진 후 개시 시각 조정)
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

function parseMs(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.length > 0) {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
}

async function main() {
    const runMatch = process.argv.includes('--match');

    const { initializeDatabase } = await import('../db.js');
    await initializeDatabase();

    const db = await import('../db.js');
    const now = Date.now();

    if (runMatch) {
        process.env.GUILD_WAR_MATCH_TEST_MODE = '1';
        const { runGuildWarMatchingTestCycle } = await import('../scheduledTasks.js');
        const wt = process.env.GUILD_WAR_MATCH_TEST_WAR_TYPE;
        const warType = wt === 'weekly' || wt === 'tue_wed' || wt === 'fri_sun' ? wt : 'weekly';
        await runGuildWarMatchingTestCycle({ warType });
        console.log(`[guild-war:open-now] Ran full guild war match test cycle (${warType})`);
    }

    const wars = (await db.getKV<any[]>('activeGuildWars')) || [];
    let updated = 0;

    for (const w of wars) {
        if (w?.status !== 'active') continue;
        const startMs = parseMs(w.startTime);
        const endMs = parseMs(w.endTime);
        if (startMs > 0 && startMs <= now) continue;
        const prevStart = startMs > 0 ? new Date(startMs).toISOString() : '(none)';
        w.startTime = now;
        w.updatedAt = now;
        updated++;
        console.log(
            `[guild-war:open-now] War ${String(w.id).slice(0, 8)}… start ${prevStart} → ${new Date(now).toISOString()}, end kept ${endMs > 0 ? new Date(endMs).toISOString() : '(none)'}`,
        );
    }

    if (updated === 0) {
        console.log('[guild-war:open-now] No active wars with future startTime — nothing to change');
        return;
    }

    await db.setKV('activeGuildWars', wars);

    const guilds = (await db.getKV<Record<string, unknown>>('guilds')) || {};
    let guildsChanged = false;
    for (const w of wars) {
        for (const gid of [w.guild1Id, w.guild2Id]) {
            if (!gid || !(guilds as any)[gid]) continue;
            const g = (guilds as any)[gid];
            if (g.guildWarMatching) {
                delete g.guildWarMatching;
                guildsChanged = true;
            }
        }
    }
    if (guildsChanged) {
        await db.setKV('guilds', guilds);
    }

    try {
        const { broadcast } = await import('../socket.js');
        await broadcast({ type: 'GUILD_WAR_UPDATE', payload: { activeWars: wars } });
        if (guildsChanged) {
            await broadcast({ type: 'GUILD_UPDATE', payload: { guilds } });
        }
    } catch {
        console.warn('[guild-war:open-now] broadcast skipped (no socket server in this process)');
    }

    console.log(`[guild-war:open-now] Done — opened ${updated} war(s) for play now`);
}

main().catch((e) => {
    console.error('[guild-war:open-now]', e);
    process.exit(1);
});
