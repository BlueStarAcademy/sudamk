import type { LiveGameSession } from '../../shared/types/index.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';

/**
 * GAME_UPDATE에서 boardState를 생략할지.
 * - 싱글/클라이언트 계가 스냅샷 권위 세션: 보드 유지
 * - Kata PVE(usesServerKataAi): 보드 유지 (board-less + clientSync가 AI 돌을 지우던 회귀 방지)
 * - 그 외(인간 PVP 등): 대역폭을 위해 생략 가능
 */
export function shouldOmitBoardStateInBroadcast(game: LiveGameSession): boolean {
    const policy = resolveArenaSessionPolicy(game as any);
    if (policy.kind === 'singleplayer' || game.isSinglePlayer) return false;
    if (policy.isClientAuthoritativeForScoringSnapshot) return false;
    return !policy.usesServerKataAi;
}
