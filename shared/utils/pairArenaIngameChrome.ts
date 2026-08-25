import type { LiveGameSession } from '../types/entities.js';

/**
 * 페어 전용 인게임 크롬(`PairIngameTopPanel`·페어 배경 등)을 쓸 세션인지 판별한다.
 * - `pair`·`friendly`: 페어 경기장, 홈/훈련장 친선·훈련 머신 페어 AI 등 — 팀별 2좌석(유저+펫 / AI+펫) UI
 * - `strategic`·`playful`: 집계 경기장 듀오·펫 AI — 일반 `PlayerPanel` 레일 유지
 */
export function sessionUsesPairArenaIngameChrome(session: Pick<LiveGameSession, 'settings'>): boolean {
    const pg = session.settings?.pairGame;
    if (!pg?.turnOrder?.length) return false;
    const ch = pg.lobbyChannel ?? 'pair';
    if (ch === 'strategic' || ch === 'playful') return false;
    return true;
}
