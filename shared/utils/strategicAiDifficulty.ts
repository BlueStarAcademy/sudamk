import { getAdventureBaseStrategyXp } from '../constants/adventureStrategyXp.js';
import { getScoringTurnLimitOptionsByBoardSize } from '../../constants/gameSettings.js';

/**
 * 전략바둑 AI 난이도: UI 1~10 단계 ↔ KataServer levelbot 값.
 * (9·10단계는 Kata 값이 3, 5라서 숫자만으로 단계를 판별하면 오해석됨)
 */
export const KATA_SERVER_LEVEL_BY_PROFILE_STEP: Readonly<Record<number, number>> = {
  1: -31,
  2: -25,
  3: -21,
  4: -15,
  5: -12,
  6: -8,
  7: -3,
  8: -1,
  9: 3,
  10: 5,
};

/** 바둑학원 싱글 Kata level(전략 대기실 표와 별도) → 프로필 단계 1~5 */
const SINGLE_PLAYER_ACADEMY_KATA_TO_PROFILE_STEP: Record<number, number> = {
  [-31]: 1,
  [-30]: 2,
  [-29]: 3,
  [-28]: 4,
  [-27]: 5,
};

export function profileStepFromKataServerLevel(kataLevel: number, strategicLobbyKataByStep?: Record<string, number>): number | undefined {
  const academy = SINGLE_PLAYER_ACADEMY_KATA_TO_PROFILE_STEP[kataLevel];
  if (academy !== undefined) return academy;
  if (strategicLobbyKataByStep) {
    for (let step = 1; step <= 10; step++) {
      if (strategicLobbyKataByStep[String(step)] === kataLevel) return step;
    }
  }
  const entry = Object.entries(KATA_SERVER_LEVEL_BY_PROFILE_STEP).find(([, v]) => v === kataLevel);
  return entry ? Math.max(1, Math.min(10, parseInt(entry[0], 10))) : undefined;
}

/**
 * 전략바둑 AI: 대기실 1~10 단계 → 경기장 패널에 보이는 “레벨” 숫자.
 * (실제 강도는 Kata/단계 설정과 동일하고, 표기만 유저 레벨 스케일에 맞춤)
 */
export const STRATEGIC_AI_DISPLAY_LEVEL_BY_PROFILE_STEP: Readonly<Record<number, number>> = {
  1: 1,
  2: 3,
  3: 5,
  4: 10,
  5: 15,
  6: 20,
  7: 25,
  8: 30,
  9: 40,
  10: 50,
};

export function strategicAiDisplayLevelFromProfileStep(profileStep: number): number {
  const s = Math.max(1, Math.min(10, Math.round(profileStep)));
  return STRATEGIC_AI_DISPLAY_LEVEL_BY_PROFILE_STEP[s] ?? s;
}

/**
 * 모험 몬스터 레벨(1~50) → KataServer levelbot (기획 표 — 로비 1~10단계 테이블과 별도).
 * 1=-31, 2=-30, 3=-29, 4=-28, 5=-27, 6~9=-25, 10=-23, 11~15=-21, 16~19=-19, 20=-18,
 * 21~25=-16, 26~29=-15, 30=-12, 31~35=-10, 36~39=-8, 40=-5, 41~45=-3, 46~49=-1, 50=1.
 */
export function adventureMonsterLevelToKataServerLevel(monsterLevel: number): number {
  const lv = Math.max(1, Math.min(50, Math.floor(monsterLevel)));
  if (lv === 1) return -31;
  if (lv === 2) return -30;
  if (lv === 3) return -29;
  if (lv === 4) return -28;
  if (lv === 5) return -27;
  if (lv <= 9) return -25;
  if (lv === 10) return -23;
  if (lv <= 15) return -21;
  if (lv <= 19) return -19;
  if (lv === 20) return -18;
  if (lv <= 25) return -16;
  if (lv <= 29) return -15;
  if (lv === 30) return -12;
  if (lv <= 35) return -10;
  if (lv <= 39) return -8;
  if (lv === 40) return -5;
  if (lv <= 45) return -3;
  if (lv <= 49) return -1;
  return 1;
}

/**
 * @deprecated 모험은 `adventureMonsterLevelToKataServerLevel` 사용. 보상/UI용 근사 단계만 필요할 때.
 */
export function adventureMonsterLevelToKataProfileStep(monsterLevel: number): number {
  const ks = adventureMonsterLevelToKataServerLevel(monsterLevel);
  return profileStepFromKataServerLevel(ks) ?? Math.max(1, Math.min(10, Math.ceil(monsterLevel / 5)));
}

/** 대기실 AI 대국 설정에서 1~10 프로필 단계 (summary·보상용, 서버 makeAiMove 분기와 동일 규칙) */
export function resolveAiLobbyProfileStepFromSettings(
  settings: {
    kataServerLevel?: number;
    goAiBotLevel?: number;
    aiDifficulty?: number;
  },
  strategicLobbyKataByStep?: Record<string, number>,
): number {
  const ks = settings.kataServerLevel;
  if (typeof ks === 'number' && Number.isFinite(ks)) {
    const fromKata = profileStepFromKataServerLevel(ks, strategicLobbyKataByStep);
    if (fromKata != null) return fromKata;
    if (ks >= 1 && ks <= 10) return ks;
  }
  if (typeof settings.goAiBotLevel === 'number' && Number.isFinite(settings.goAiBotLevel)) {
    const g = Math.round(settings.goAiBotLevel);
    if (g >= 1 && g <= 10) return g;
  }
  const ad = settings.aiDifficulty;
  if (typeof ad === 'number' && Number.isFinite(ad)) {
    return Math.max(1, Math.min(10, Math.round(ad)));
  }
  return 1;
}

/**
 * 고정 베이스 보상에 곱하는 배율 (대기실 AI 프로필 1~10단계).
 * 1=1.0, 2=1.2, 3~10은 단계마다 +0.1 (7=1.7, 10=2.0).
 */
const AI_LOBBY_REWARD_MULTIPLIER_BY_PROFILE_STEP: readonly number[] = [
  1.0, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0,
];

export function aiLobbyRewardMultiplierFromProfileStep(profileStep: number): number {
  const t = Math.max(1, Math.min(10, Math.round(profileStep)));
  return AI_LOBBY_REWARD_MULTIPLIER_BY_PROFILE_STEP[t - 1] ?? 1;
}

/**
 * 페어바둑 AI 대국(`summaryService` PAIR_GO 롤 베이스): 3단계를 100% 기준으로 한 단계마다 ±10%p.
 * 예) 1단계 0.8, 2단계 0.9, 3단계 1, 4단계 1.1, …, 10단계 1.7.
 */
export function pairGoAiRewardRelativeToStep3Multiplier(profileStep: number): number {
  const s = Math.max(1, Math.min(10, Math.round(profileStep)));
  return 1 + (s - 3) * 0.1;
}

function strategicLobbyAiBoardXpMultiplier(boardSize: number): number {
  if (boardSize === 13) return 2;
  if (boardSize === 19) return 5;
  return 1;
}

function isMaxScoringTurnLimit(boardSize: number, scoringTurnLimit?: number): boolean {
  if (typeof scoringTurnLimit !== 'number' || !Number.isFinite(scoringTurnLimit) || scoringTurnLimit <= 0) return false;
  const maxLimit = Math.max(...getScoringTurnLimitOptionsByBoardSize(boardSize).filter((v) => v > 0));
  return Number.isFinite(maxLimit) && scoringTurnLimit >= maxLimit;
}

/**
 * 전략바둑 대기실 AI 대결 승리 기본 EXP.
 * - 9줄 모험 기본 EXP를 기준(1x)
 * - 13줄 2배, 19줄 5배 (그 외 판은 1x)
 * - 계가까지 턴을 해당 판의 최대치로 설정하면 +0.5x(총 1.5배 추가 곱)
 */
export function strategicLobbyAiWinXp(boardSize?: number, scoringTurnLimit?: number): number {
  const bs = boardSize ?? 9;
  const baseNine = getAdventureBaseStrategyXp(9);
  const boardMul = strategicLobbyAiBoardXpMultiplier(bs);
  const turnMul = isMaxScoringTurnLimit(bs, scoringTurnLimit) ? 1.5 : 1;
  return Math.max(1, Math.round(baseNine * boardMul * turnMul));
}

/** 전략/놀이 대기실에서 시작한 AI 대국(싱글·탑·길드전 제외) */
export function isWaitingRoomAiGame(game: {
  isAiGame?: boolean;
  isSinglePlayer?: boolean;
  gameCategory?: string;
}): boolean {
  if (!game.isAiGame || game.isSinglePlayer) return false;
  const c = game.gameCategory;
  if (c === 'tower' || c === 'singleplayer' || c === 'guildwar' || c === 'adventure') return false;
  return true;
}

/**
 * 페어 AI 대전 상대 펫 UI 표시 레벨 구간: 1단계=1~5, 2단계=6~10, …, 10단계=46~50.
 */
export function pairAiOpponentPetDisplayLevelBoundsForProfileStep(profileStep: number): { min: number; max: number } {
  const s = Math.max(1, Math.min(10, Math.round(profileStep)));
  return { min: (s - 1) * 5 + 1, max: s * 5 };
}

/** 서버: 단계 구간 안에서 표시용 펫 레벨을 한 번 무작위로 고른다. */
export function rollPairAiOpponentPetDisplayLevelForProfileStep(profileStep: number): number {
  const { min, max } = pairAiOpponentPetDisplayLevelBoundsForProfileStep(profileStep);
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** 구버전 세션 등 `pairOpponentPetDisplayLevelByParticipantId`가 없을 때: gameId+좌석 기준 결정론적 값 */
export function deterministicPairAiOpponentPetDisplayLevelFromSeed(seed: string, profileStep: number): number {
  const { min, max } = pairAiOpponentPetDisplayLevelBoundsForProfileStep(profileStep);
  const span = max - min + 1;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return min + (Math.abs(h) % span);
}

type PairAiOpponentPetDisplaySettings = {
  pairGame?: { pairOpponentPetDisplayLevelByParticipantId?: Record<string, number> };
  kataServerLevel?: number;
  goAiBotLevel?: number;
  aiDifficulty?: number;
};

/** 페어 AI 대전 합성 상대 좌석 — 표시용 레벨(실제 카타 레벨과 별개) */
const PAIR_AI_OPPONENT_DISPLAY_LEVEL_IDS = new Set(['pair-opponent-ai', 'pair-opponent-pet']);

export function isPairAiOpponentSyntheticDisplayParticipant(participantId: string): boolean {
  return PAIR_AI_OPPONENT_DISPLAY_LEVEL_IDS.has(participantId);
}

/**
 * `pair-opponent-ai` / `pair-opponent-pet` 합성 상대의 UI 표시 레벨.
 * 서버가 `pairOpponentPetDisplayLevelByParticipantId`에 넣은 값이 있으면 우선, 없으면 gameId+좌석으로 복원.
 */
export function resolvePairAiOpponentPetSyntheticDisplayLevel(
  gameId: string,
  settings: PairAiOpponentPetDisplaySettings | undefined,
  participantId: string,
  strategicLobbyKataByStep?: Record<string, number>,
): number {
  if (!PAIR_AI_OPPONENT_DISPLAY_LEVEL_IDS.has(participantId)) return 1;
  const stored = settings?.pairGame?.pairOpponentPetDisplayLevelByParticipantId?.[participantId];
  if (typeof stored === 'number' && Number.isFinite(stored)) {
    return Math.max(1, Math.min(50, Math.floor(stored)));
  }
  const step = resolveAiLobbyProfileStepFromSettings(settings ?? {}, strategicLobbyKataByStep);
  return deterministicPairAiOpponentPetDisplayLevelFromSeed(`${gameId}:${participantId}`, step);
}
