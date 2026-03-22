import { GameMode } from '../types/index.js';
import type { GameRecord } from '../types/index.js';
import { GameCategory } from '../types/enums.js';
import { SPECIAL_GAME_MODES } from '../constants/gameModes.js';

/** 해당 대국(gameId)이 이미 기보 목록에 있으면 중복 저장 방지·버튼 비활성화에 사용 */
export function userHasSavedGameRecordForGameId(
    savedGameRecords: GameRecord[] | undefined | null,
    gameId: string
): boolean {
    if (!savedGameRecords?.length) return false;
    return savedGameRecords.some((r) => r.gameId === gameId);
}

/** 전략바둑 + 사람 대 사람(PVP). 일반 로비는 gameCategory가 Normal일 수 있음. */
export type SessionLikeForGameRecord = {
    mode: GameMode;
    isSinglePlayer?: boolean;
    isAiGame?: boolean;
    gameCategory?: GameCategory;
    gameStatus?: string;
    shortGameNoContest?: boolean;
};

export function isStrategicPvpForGameRecord(session: SessionLikeForGameRecord): boolean {
    const isStrategic = SPECIAL_GAME_MODES.some((m) => m.mode === session.mode);
    if (!isStrategic) return false;
    if (session.isSinglePlayer) return false;
    if (session.isAiGame) return false;
    const cat = session.gameCategory;
    if (cat === GameCategory.SinglePlayer || cat === GameCategory.Tower) return false;
    return true;
}

/** 기보 저장 API·UI에 쓰는 종료(또는 유사) 상태 */
export const GAME_RECORD_SAVEABLE_GAME_STATUSES = ['ended', 'scoring', 'no_contest', 'rematch_pending'] as const;

export function isGameStatusSaveableForRecord(gameStatus: string): boolean {
    return (GAME_RECORD_SAVEABLE_GAME_STATUSES as readonly string[]).includes(gameStatus);
}

/** 서버가 표시한 10수 미만 규정 무효 대국 — 기보 저장 불가 */
export function isShortGameStrategicNoContest(session: SessionLikeForGameRecord): boolean {
    return !!session.shortGameNoContest;
}

/** 전략 PVP 기보 UI·저장 API 공통 조건 (무효 대국 중 「10수 미만」만 제외) */
export function canSaveStrategicPvpGameRecord(session: SessionLikeForGameRecord): boolean {
    if (!session.gameStatus || !isGameStatusSaveableForRecord(session.gameStatus)) return false;
    if (!isStrategicPvpForGameRecord(session)) return false;
    if (isShortGameStrategicNoContest(session)) return false;
    return true;
}

/** 기보 슬롯(10개) 만석일 때 저장 버튼·서버 오류 안내에 공통 사용 */
export const GAME_RECORD_SLOT_FULL_MESSAGE =
    '기보는 최대 10개까지 저장할 수 있습니다. 기보 관리에서 예전 기보를 삭제한 뒤 다시 저장해 주세요.';
