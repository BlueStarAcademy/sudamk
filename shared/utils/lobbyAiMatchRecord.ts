import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants/gameModes.js';

type ModeStatsRow = { wins?: number; losses?: number; aiWins?: number; aiLosses?: number };

/**
 * 전략·놀이 경기장 대기실 AI 대국 전적 — `user.stats[GameMode].aiWins` / `aiLosses` 합계.
 * (`wins` / `losses`는 PVP만 집계되도록 서버에서 분리)
 */
export function sumLobbyAiMatchRecordFromStats(
    stats: Record<string, ModeStatsRow> | null | undefined,
    kind: 'strategic' | 'playful',
): { wins: number; losses: number } {
    const modes = kind === 'strategic' ? SPECIAL_GAME_MODES : PLAYFUL_GAME_MODES;
    let wins = 0;
    let losses = 0;
    for (const m of modes) {
        const row = stats?.[m.mode];
        if (!row) continue;
        wins += row.aiWins ?? 0;
        losses += row.aiLosses ?? 0;
    }
    return { wins, losses };
}
