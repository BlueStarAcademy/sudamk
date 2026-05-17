import { GameMode } from '../types/enums.js';
import type { GameSettings } from '../types/index.js';
import { getAiScoringTurnLimitByBoardSize } from '../constants/gameSettings.js';

/** 페어 경기장·전략/놀이 AI 방 — `PAIR_START_AI_MATCH` / 인게임 재대결 설정 정규화 */
export function transformPairArenaAiMatchSettings(
    mode: GameMode,
    raw: GameSettings,
    lobbyChannel: 'pair' | 'strategic' | 'playful' = 'pair',
): GameSettings {
    const includesCaptureRule =
        mode === GameMode.Capture ||
        (mode === GameMode.Mix && Boolean(raw.mixedModes?.includes(GameMode.Capture)));
    const playfulArena = lobbyChannel === 'playful';
    const shouldZeroMainClock = !playfulArena;
    const shouldUseFixedTurns = !playfulArena;
    const next: GameSettings = {
        ...raw,
        ...(shouldZeroMainClock
            ? {
                  timeLimit: 0,
                  byoyomiTime: 0,
                  byoyomiCount: 0,
                  timeIncrement: 0,
              }
            : {}),
        scoringTurnLimit: playfulArena
            ? 0
            : includesCaptureRule
              ? 0
              : shouldUseFixedTurns
                ? getAiScoringTurnLimitByBoardSize(raw.boardSize || 19)
                : 0,
    };
    if (includesCaptureRule || !shouldUseFixedTurns || playfulArena) {
        delete (next as { autoScoringTurns?: unknown }).autoScoringTurns;
    }
    return next;
}

export function isPairArenaAiMatchSession(session: {
    settings?: { pairGame?: { pairMode?: string; teamB?: { members?: { id?: string }[] } } };
}): boolean {
    const pg = session.settings?.pairGame;
    if (!pg || pg.pairMode !== 'ai') return false;
    return Boolean(pg.teamB?.members?.some((m) => m.id === 'pair-opponent-ai'));
}
