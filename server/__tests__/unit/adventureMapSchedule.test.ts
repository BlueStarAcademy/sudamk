import { describe, expect, it } from 'vitest';
import { getAdventureStageById } from '../../../constants/adventureConstants.js';
import { isAdventureChapterBossCodexId } from '../../../constants/adventureMonstersCodex.js';
import {
    adventureMapMsUntilDisappear,
    adventureMapMsUntilNextAppearance,
    buildAdventureMapMonstersFromSchedule,
    compareAdventureMapMonstersForSchedule,
    getAdventureMapActiveDwellWindow,
    getAdventureMapCycleParams,
    resolveAdventureMapSpawnSlot,
} from '../../../shared/utils/adventureMapSchedule.js';

describe('adventureMapSchedule', () => {
    const stage = getAdventureStageById('lake_park');
    if (!stage) throw new Error('missing lake_park stage');

    it('assigns distinct staggered phases per spawn slot', () => {
        const sorted = [...stage.monsters].sort(compareAdventureMapMonstersForSchedule);
        const phases = sorted.map((row, index) => {
            const isBoss = isAdventureChapterBossCodexId(row.codexId);
            const spawnSlot = { spawnSlotIndex: index, spawnSlotCount: sorted.length };
            return getAdventureMapCycleParams(stage.id, row.codexId, isBoss, 1, 1, spawnSlot).phase;
        });
        const unique = new Set(phases);
        expect(unique.size).toBeGreaterThan(1);
    });

    it('active dwell window end matches built monster expiresAt', () => {
        const nowMs = 1_700_000_000_000;
        const monsters = buildAdventureMapMonstersFromSchedule(stage, nowMs, {});
        for (const m of monsters) {
            expect(m.windowStartMs).toBeLessThan(m.expiresAt);
            const boss = isAdventureChapterBossCodexId(m.codexId);
            const spawnSlot = resolveAdventureMapSpawnSlot(stage.monsters, m.codexId);
            const window = getAdventureMapActiveDwellWindow(nowMs, stage.id, m.codexId, boss, undefined, 1, 1, spawnSlot);
            expect(window).not.toBeNull();
            expect(window!.windowEnd).toBe(m.expiresAt);
            expect(window!.windowStart).toBe(m.windowStartMs);
        }
    });

    it('reports disappear ms while on schedule dwell', () => {
        const nowMs = 1_700_000_000_000;
        const monsters = buildAdventureMapMonstersFromSchedule(stage, nowMs, {});
        expect(monsters.length).toBeGreaterThan(0);
        const m = monsters[0]!;
        const boss = isAdventureChapterBossCodexId(m.codexId);
        const spawnSlot = resolveAdventureMapSpawnSlot(stage.monsters, m.codexId);
        const disappear = adventureMapMsUntilDisappear(nowMs, stage.id, m.codexId, boss, undefined, 1, 1, spawnSlot);
        expect(disappear).toBeGreaterThan(0);
        expect(disappear).toBe(m.expiresAt - nowMs);
        const untilAppear = adventureMapMsUntilNextAppearance(
            nowMs,
            stage.id,
            m.codexId,
            boss,
            undefined,
            1,
            1,
            spawnSlot,
        );
        expect(untilAppear).toBe(0);
    });
});
