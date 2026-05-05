import type { LiveGameSession } from '../types/entities.js';

/**
 * `#/pair` 페어 경기장에서 시작한 대국만 페어 전용 인게임 크롬(PairIngameTopPanel·전용 배경 등)을 쓴다.
 * 전략·놀이 집계 로비(`lobbyChannel` strategic/playful)에서의 듀오·펫 AI전은 규칙상 `pairGame`이 있어도 집계 경기장 UX(일반 PlayerPanel 레일)를 유지한다.
 */
export function sessionUsesPairArenaIngameChrome(session: Pick<LiveGameSession, 'settings'>): boolean {
    const pg = session.settings?.pairGame;
    if (!pg?.turnOrder?.length) return false;
    const ch = pg.lobbyChannel ?? 'pair';
    return ch === 'pair';
}
