import { GameCategory } from '../types/enums.js';
import type { LiveGameSession } from '../types/entities.js';
import { SPECIAL_GAME_MODES } from '../constants/gameModes.js';
import { arenaChannelForGameSession } from './arenaChannel.js';
import { pairPetKataPhaseFromTotalPly, type PairPetKataPhase } from '../constants/pairArena.js';
import { resolveArenaKind } from './liveSessionArenaKind.js';

/**
 * 전략·페어 경기장(놀이 로비 제외)에서 대국이 끝난 시점의 흑·백 합산 수순이 속한
 * 초반/중반/종반(`pairPetKataPhaseFromTotalPly`와 동일)에 따라 골드·EXP에 곱할 배율.
 *
 * - 종반: 1.0, 중반: 0.6, 초반: 0.3
 * - 모험·탑·길드전·싱글·놀이 채널(`playful`) 등은 null → 서버 기존 보상식 유지
 */
export function resolveLiveArenaPhaseGoldXpMultiplier(
    game: Pick<LiveGameSession, 'mode' | 'settings' | 'moveHistory' | 'gameCategory' | 'isSinglePlayer'>,
): number | null {
    if (!SPECIAL_GAME_MODES.some((m) => m.mode === game.mode)) {
        return null;
    }
    if (game.isSinglePlayer) return null;
    const kind = resolveArenaKind(game as any);
    if (kind !== GameCategory.Normal) return null;
    const cat = String(game.gameCategory ?? '');
    if (cat === 'adventure') return null;

    const ch = arenaChannelForGameSession(game as any);
    if (ch === 'playful') return null;

    const boardSize = game.settings?.boardSize ?? 19;
    const totalPly = Math.max(1, game.moveHistory?.length ?? 0);
    const phase: PairPetKataPhase = pairPetKataPhaseFromTotalPly(boardSize, totalPly);
    if (phase === 'opening') return 0.3;
    if (phase === 'midgame') return 0.6;
    return 1.0;
}
