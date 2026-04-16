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

export function profileStepFromKataServerLevel(kataLevel: number): number | undefined {
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
 * 모험 몬스터 레벨(1~50) → 전략 AI Kata 프로필 단계(1~10).
 * `KATA_SERVER_LEVEL_BY_PROFILE_STEP`·`resolveAiLobbyProfileStepFromSettings`와 동일 체계.
 */
export function adventureMonsterLevelToKataProfileStep(monsterLevel: number): number {
  const lv = Math.max(1, Math.min(50, Math.floor(monsterLevel)));
  if (lv <= 3) return 1;
  if (lv <= 7) return 2;
  if (lv <= 10) return 3;
  if (lv <= 15) return 4;
  if (lv <= 20) return 5;
  if (lv <= 25) return 6;
  if (lv <= 30) return 7;
  if (lv <= 35) return 8;
  if (lv <= 45) return 9;
  return 10;
}

/** 대기실 AI 대국 설정에서 1~10 프로필 단계 (summary·보상용, 서버 makeAiMove 분기와 동일 규칙) */
export function resolveAiLobbyProfileStepFromSettings(settings: {
  kataServerLevel?: number;
  goAiBotLevel?: number;
  aiDifficulty?: number;
}): number {
  const ks = settings.kataServerLevel;
  if (typeof ks === 'number' && Number.isFinite(ks)) {
    const fromKata = profileStepFromKataServerLevel(ks);
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
 * 고정 베이스 보상에 곱하는 배율: 1단계=1배, 2단계=1.2배, …, 10단계=2배 (1 + 단계×0.1, 단계≥2).
 */
export function aiLobbyRewardMultiplierFromProfileStep(profileStep: number): number {
  const t = Math.max(1, Math.min(10, Math.round(profileStep)));
  if (t <= 1) return 1;
  return 1 + t * 0.1;
}

function strategicLobbyAiBoardXpMultiplier(boardSize: number): number {
  if (boardSize === 13) return 1.5;
  if (boardSize === 19) return 2.5;
  return 1;
}

function isMaxScoringTurnLimit(boardSize: number, scoringTurnLimit?: number): boolean {
  if (typeof scoringTurnLimit !== 'number' || !Number.isFinite(scoringTurnLimit) || scoringTurnLimit <= 0) return false;
  const maxLimit = Math.max(...getScoringTurnLimitOptionsByBoardSize(boardSize).filter((v) => v > 0));
  return Number.isFinite(maxLimit) && scoringTurnLimit >= maxLimit;
}

/**
 * 전략바둑 대기실 AI 대결 승리 기본 EXP.
 * - 9줄 승리 EXP를 기준(1x)
 * - 13줄 1.5x, 19줄 2.5x
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
