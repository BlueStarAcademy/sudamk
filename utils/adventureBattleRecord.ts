import {
    ADVENTURE_MONSTER_MODE_LABELS,
    ADVENTURE_MONSTER_MODES,
    type AdventureMonsterBattleMode,
} from '../constants/adventureConstants.js';
import type { AdventureProfile } from '../types/entities.js';
import { normalizeAdventureProfile } from './adventureUnderstanding.js';

export type AdventureBattleRecordModeRow = {
    mode: AdventureMonsterBattleMode;
    label: string;
    wins: number;
    losses: number;
    winRatePercent: number | null;
};

export type AdventureBattleRecordSummary = {
    caught: number;
    missed: number;
    total: number;
    byMode: AdventureBattleRecordModeRow[];
};

export function formatAdventureModeWinLossRecord(wins: number, losses: number, winRatePercent: number | null): string {
    const pct =
        winRatePercent != null
            ? `(${Number.isInteger(winRatePercent) ? winRatePercent : winRatePercent.toFixed(1)}%)`
            : '(—)';
    return `${wins}승${losses}패${pct}`;
}

export function getAdventureBattleRecordSummary(
    profile: AdventureProfile | null | undefined,
): AdventureBattleRecordSummary {
    const p = normalizeAdventureProfile(profile);
    const caught = Math.max(0, Math.floor(p.monstersDefeatedTotal ?? 0));
    const missed = Math.max(0, Math.floor(p.monstersMissedTotal ?? 0));

    const byMode = ADVENTURE_MONSTER_MODES.map((mode) => {
        const wins = Math.max(0, Math.floor(p.monstersDefeatedByMode?.[mode] ?? 0));
        const losses = Math.max(0, Math.floor(p.monstersMissedByMode?.[mode] ?? 0));
        const total = wins + losses;
        const winRatePercent = total > 0 ? Math.round((wins / total) * 1000) / 10 : null;
        return {
            mode,
            label: ADVENTURE_MONSTER_MODE_LABELS[mode],
            wins,
            losses,
            winRatePercent,
        };
    });

    return { caught, missed, total: caught + missed, byMode };
}
