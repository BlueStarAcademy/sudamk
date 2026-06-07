import { GameMode } from '../types/index.js';
import type { GameRecord, LiveGameSession } from '../types/index.js';
import { GameCategory } from '../types/enums.js';

/** 해당 대국(gameId)이 이미 기보 목록에 있으면 중복 저장 방지·버튼 비활성화에 사용 */
export function userHasSavedGameRecordForGameId(
    savedGameRecords: GameRecord[] | undefined | null,
    gameId: string
): boolean {
    if (!savedGameRecords?.length) return false;
    return savedGameRecords.some((r) => r.gameId === gameId);
}

/** 기보 저장 API·UI에 쓰는 종료(또는 유사) 상태 */
export const GAME_RECORD_SAVEABLE_GAME_STATUSES = ['ended', 'scoring', 'no_contest', 'rematch_pending'] as const;

export const GAME_RECORD_SNAPSHOT_STATUSES = [...GAME_RECORD_SAVEABLE_GAME_STATUSES] as const;

/** 기보 저장 API·UI에 쓰는 세션 최소 필드 */
export type SessionLikeForGameRecord = {
    mode: GameMode;
    isSinglePlayer?: boolean;
    isAiGame?: boolean;
    gameCategory?: GameCategory;
    gameStatus?: string;
    shortGameNoContest?: boolean;
};

/** 사람 vs 사람 PVP 대국(전략·놀이·페어). AI·PVE·모험·탑·길드전 제외 */
export function isPvpHumanGameRecordEligible(session: SessionLikeForGameRecord): boolean {
    if (session.isSinglePlayer) return false;
    if (session.isAiGame) return false;
    const cat = session.gameCategory;
    if (
        cat === GameCategory.SinglePlayer ||
        cat === GameCategory.Tower ||
        cat === GameCategory.Adventure ||
        cat === GameCategory.GuildWar
    ) {
        return false;
    }
    return true;
}

/** @deprecated 이름 유지 — `isPvpHumanGameRecordEligible`와 동일 */
export function isStrategicPvpForGameRecord(session: SessionLikeForGameRecord): boolean {
    return isPvpHumanGameRecordEligible(session);
}

export function isGameStatusSaveableForRecord(gameStatus: string): boolean {
    return (GAME_RECORD_SAVEABLE_GAME_STATUSES as readonly string[]).includes(gameStatus);
}

/** 서버가 표시한 10수 미만 규정 무효 대국 — 기보 저장 불가 */
export function isShortGameStrategicNoContest(session: SessionLikeForGameRecord): boolean {
    return !!session.shortGameNoContest;
}

export function isGameRecordParticipant(
    session: Pick<LiveGameSession, 'player1' | 'player2' | 'settings'>,
    userId: string,
): boolean {
    if (session.player1?.id === userId || session.player2?.id === userId) return true;
    const seats = session.settings?.pairGame?.turnOrder;
    if (seats?.some((s) => s.kind === 'user' && s.participantId === userId)) return true;
    return false;
}

/** PVP 기보 UI·저장 API 공통 조건 (무효 대국 중 「10수 미만」만 제외) */
export function canSaveStrategicPvpGameRecord(session: SessionLikeForGameRecord): boolean {
    if (!session.gameStatus || !isGameStatusSaveableForRecord(session.gameStatus)) return false;
    if (!isPvpHumanGameRecordEligible(session)) return false;
    if (isShortGameStrategicNoContest(session)) return false;
    return true;
}

/** DB/GC 이후 클라이언트 sessionStorage·대국실 세션으로 기보 저장 복구 */
export function resolveClientRecordSessionSnapshot(
    gameId: string,
    userId: string,
    snapshot: unknown,
): LiveGameSession | null {
    if (!snapshot || typeof snapshot !== 'object') return null;
    const game = snapshot as LiveGameSession;
    if (game.id !== gameId) return null;
    if (!isPvpHumanGameRecordEligible(game)) return null;
    if (!game.gameStatus || !isGameStatusSaveableForRecord(game.gameStatus)) return null;
    if (!isGameRecordParticipant(game, userId)) return null;
    if (!Array.isArray(game.moveHistory) || game.moveHistory.length === 0) return null;
    if (!game.player1?.id || !game.player2?.id) return null;
    return game;
}

/** 기보 슬롯(10개) 만석일 때 저장 버튼·서버 오류 안내에 공통 사용 */
export const GAME_RECORD_SLOT_FULL_MESSAGE =
    '기보는 최대 10개까지 저장할 수 있습니다. 기보 관리에서 예전 기보를 삭제한 뒤 다시 저장해 주세요.';
