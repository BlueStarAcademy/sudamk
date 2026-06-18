import type { TFunction } from 'i18next';
import type { AdventureMonsterBattleMode } from '../../constants/adventureConstants.js';
import type { AdventureCodexPercentBossBonus } from '../../constants/adventureMonstersCodex.js';
import type { AdventureCodexNormalPercentKind } from '../../utils/adventureCodexComprehension.js';
import type {
    AdventureRegionalSpecialtyBuffEntry,
    AdventureRegionalSpecialtyBuffKind,
} from '../../types/entities.js';
import {
    getRegionalBuffMaxStacks,
    isRegionalBuffEnhanceable,
    migrateRegionalBuffEntry,
    regionalBuffEnhanceCountSuffix,
} from '../../utils/adventureRegionalSpecialtyBuff.js';

type LobbyT = TFunction<'lobby'>;

export function formatAdventureRemainMs(t: LobbyT, ms: number): string {
    if (ms <= 0) return t('adventure.time.zero');
    const sec = Math.ceil(ms / 1000);
    if (sec < 90) return t('adventure.time.seconds', { sec });
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m < 60) {
        return s > 0 ? t('adventure.time.minutesSeconds', { m, s }) : t('adventure.time.minutes', { m });
    }
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return t('adventure.time.hoursMinutes', { h, mm });
}

export function getAdventureMonsterModeLabel(t: LobbyT, mode: AdventureMonsterBattleMode): string {
    return t(`adventure.monsterMode.${mode}`);
}

export function regionalBuffEnhanceSuffix(t: LobbyT, kind: AdventureRegionalSpecialtyBuffKind, stacks: number): string {
    if (!isRegionalBuffEnhanceable(kind)) return '';
    const st = Math.max(1, Math.floor(stacks));
    const max = getRegionalBuffMaxStacks(kind);
    return t('adventure.regionalBuff.enhanceSuffix', { st, max });
}

export function labelRegionalSpecialtyBuffI18n(t: LobbyT, e: AdventureRegionalSpecialtyBuffEntry): string {
    const ent = migrateRegionalBuffEntry(e);
    const st = Math.max(1, Math.floor(ent.stacks ?? 1));
    const sfx = regionalBuffEnhanceSuffix(t, ent.kind, st);
    switch (ent.kind) {
        case 'regional_win_gold_10pct':
            return t('adventure.regionalBuff.winGold', { percent: st * 10, suffix: sfx });
        case 'regional_equip_drop_3pct':
            return t('adventure.regionalBuff.equipDrop', { percent: st * 3, suffix: sfx });
        case 'regional_material_drop_5pct':
            return t('adventure.regionalBuff.materialDrop', { percent: st * 5, suffix: sfx });
        case 'regional_capture_target_plus1':
            return t('adventure.regionalBuff.captureTarget', { value: st, suffix: sfx });
        case 'regional_time_limit_plus20pct':
            return t('adventure.regionalBuff.timeLimit', { percent: st * 20, suffix: sfx });
        case 'regional_monster_respawn_minus10pct':
            return t('adventure.regionalBuff.respawnWait', { percent: Math.min(50, st * 10), suffix: sfx });
        case 'regional_monster_dwell_plus10pct':
            return t('adventure.regionalBuff.monsterDwell', { percent: st * 10, suffix: sfx });
        case 'regional_hidden_scan_plus1':
            return t('adventure.regionalBuff.hiddenScan', { value: st, suffix: sfx });
        case 'regional_base_start_score_plus1':
            return t('adventure.regionalBuff.baseStartScore', { value: st, suffix: sfx });
        case 'regional_classic_start_score_plus1':
            return t('adventure.regionalBuff.classicStartScore', { value: st, suffix: sfx });
        case 'regional_missile_plus1':
            return t('adventure.regionalBuff.missile');
        default:
            return '';
    }
}

export function labelRegionalSpecialtyBuffCompactI18n(t: LobbyT, e: AdventureRegionalSpecialtyBuffEntry): string {
    const ent = migrateRegionalBuffEntry(e);
    const st = Math.max(1, Math.floor(ent.stacks ?? 1));
    const sfx = regionalBuffEnhanceSuffix(t, ent.kind, st);
    switch (ent.kind) {
        case 'regional_win_gold_10pct':
            return t('adventure.regionalBuff.compact.gold', { percent: st * 10, suffix: sfx });
        case 'regional_equip_drop_3pct':
            return t('adventure.regionalBuff.compact.equipDrop', { percent: st * 3, suffix: sfx });
        case 'regional_material_drop_5pct':
            return t('adventure.regionalBuff.compact.materialDrop', { percent: st * 5, suffix: sfx });
        case 'regional_capture_target_plus1':
            return t('adventure.regionalBuff.compact.captureTarget', { value: st, suffix: sfx });
        case 'regional_time_limit_plus20pct':
            return t('adventure.regionalBuff.compact.timeLimit', { percent: st * 20, suffix: sfx });
        case 'regional_monster_respawn_minus10pct':
            return t('adventure.regionalBuff.compact.respawnWait', { percent: Math.min(50, st * 10), suffix: sfx });
        case 'regional_monster_dwell_plus10pct':
            return t('adventure.regionalBuff.compact.monsterDwell', { percent: st * 10, suffix: sfx });
        case 'regional_hidden_scan_plus1':
            return t('adventure.regionalBuff.compact.hiddenScan', { value: st, suffix: sfx });
        case 'regional_base_start_score_plus1':
            return t('adventure.regionalBuff.compact.baseStartScore', { value: st, suffix: sfx });
        case 'regional_classic_start_score_plus1':
            return t('adventure.regionalBuff.compact.classicStartScore', { value: st, suffix: sfx });
        case 'regional_missile_plus1':
            return t('adventure.regionalBuff.compact.missile');
        default:
            return labelRegionalSpecialtyBuffI18n(t, e);
    }
}

export function adventureCodexPercentBossBonusLabel(t: LobbyT, b: AdventureCodexPercentBossBonus): string {
    switch (b.target) {
        case 'core':
            return String(b.stat);
        case 'adventureGold':
            return t('adventure.codex.bossBonus.adventureGold');
        case 'itemDrop':
            return t('adventure.codex.bossBonus.itemDrop');
        case 'materialDrop':
            return t('adventure.codex.bossBonus.materialDrop');
        case 'highGradeEquipment':
            return t('adventure.codex.bossBonus.highGradeEquipment');
        case 'highGradeMaterial':
            return t('adventure.codex.bossBonus.highGradeMaterial');
        default:
            return '';
    }
}

export function adventureCodexNormalPercentLabel(t: LobbyT, kind: AdventureCodexNormalPercentKind): string {
    switch (kind) {
        case 'adventureGold':
            return t('adventure.codex.bossBonus.adventureGold');
        case 'itemDrop':
            return t('adventure.codex.bossBonus.itemDrop');
        case 'materialDrop':
            return t('adventure.codex.bossBonus.materialDrop');
        case 'highGradeEquipment':
            return t('adventure.codex.bossBonus.highGradeEquipment');
        case 'highGradeMaterial':
            return t('adventure.codex.bossBonus.highGradeMaterial');
        default:
            return '';
    }
}
