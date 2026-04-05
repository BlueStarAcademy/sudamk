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

/** 전략/놀이 대기실에서 시작한 AI 대국(싱글·탑·길드전 제외) */
export function isWaitingRoomAiGame(game: {
  isAiGame?: boolean;
  isSinglePlayer?: boolean;
  gameCategory?: string;
}): boolean {
  if (!game.isAiGame || game.isSinglePlayer) return false;
  const c = game.gameCategory;
  if (c === 'tower' || c === 'singleplayer' || c === 'guildwar') return false;
  return true;
}
