import { GameMode, LiveGameSession, SinglePlayerStageInfo } from '../types.js';
import { Player } from '../types/enums.js';
import {
  resolveSinglePlayerAutoScoringTurnCap,
  resolveSinglePlayerSurvivalModeForSession,
  resolveSinglePlayerSurvivalTurnCount,
} from '../shared/utils/singlePlayerStrategicRulePreset.js';

export type SinglePlayerAcademyGoalDisplay = {
  /** `blackTurnLimit` — 제한턴 내 승리 조건 */
  turnLimit?: number;
  /** `autoScoringTurns` — N턴 후 자동 계가 */
  autoScoringTurns?: number;
  myCaptureTarget?: number;
  opponentCaptureTarget?: number;
  survivalGoal?: { turns: number; opponentTarget: number };
  /** 따내기·살리기·턴 규칙 없는 순수 계가형 */
  showTerritoryGoal?: boolean;
};

function mixedList(settings: LiveGameSession['settings']): GameMode[] {
  return settings.mixedModes ?? [];
}

function effectiveModesForRules(mode: GameMode, mix: GameMode[]): GameMode[] {
  if (mode === GameMode.Mix) return mix.length ? mix : [];
  return [mode];
}

function resolveStageRuleFlags(session: LiveGameSession, stage: SinglePlayerStageInfo) {
  const isSurvivalRules = resolveSinglePlayerSurvivalModeForSession(session, stage);
  const isLegacyRuleInference = stage.strategicRulePreset == null || stage.strategicRulePreset === 'auto';
  const sessionMix = mixedList(session.settings);
  const sessionEm = effectiveModesForRules(session.mode, sessionMix);
  const isCaptureMode =
    !isSurvivalRules &&
    (session.mode === GameMode.Capture ||
      sessionEm.includes(GameMode.Capture) ||
      (isLegacyRuleInference && stage.blackTurnLimit !== undefined));
  return { isSurvivalRules, isCaptureMode, sessionEm };
}

function resolveTurnDisplay(
  session: LiveGameSession,
  stage: SinglePlayerStageInfo,
  isSurvivalRules: boolean,
): Pick<SinglePlayerAcademyGoalDisplay, 'turnLimit' | 'autoScoringTurns'> {
  if (isSurvivalRules) return {};
  const blackLimit =
    typeof stage.blackTurnLimit === 'number' && Number.isFinite(stage.blackTurnLimit) && stage.blackTurnLimit > 0
      ? Math.floor(stage.blackTurnLimit)
      : undefined;
  if (blackLimit != null) return { turnLimit: blackLimit };
  const autoCap = resolveSinglePlayerAutoScoringTurnCap(session.settings, stage);
  if (autoCap != null && autoCap > 0) return { autoScoringTurns: autoCap };
  return {};
}

function resolveCaptureTargets(
  session: LiveGameSession,
  stage: SinglePlayerStageInfo,
  isCaptureMode: boolean,
): { my?: number; opponent?: number } {
  if (!isCaptureMode) return {};
  const effectiveTargets = session.effectiveCaptureTargets;
  const blackTarget = effectiveTargets?.[Player.Black];
  const whiteTarget = effectiveTargets?.[Player.White];
  const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n !== 999;

  if (valid(blackTarget) || valid(whiteTarget)) {
    return {
      my: valid(blackTarget) ? blackTarget : undefined,
      opponent: valid(whiteTarget) ? whiteTarget : undefined,
    };
  }

  const cap = session.settings.captureTarget;
  if (typeof cap === 'number' && Number.isFinite(cap) && cap > 0) {
    return { my: cap, opponent: cap };
  }

  const black = stage.targetScore?.black;
  const white = stage.targetScore?.white;
  if (typeof black === 'number' && black > 0 && typeof white === 'number' && white > 0) {
    return { my: black, opponent: white };
  }
  if (typeof black === 'number' && black > 0) {
    return { my: black };
  }
  return {};
}

/** 바둑학원·도전의 탑 시작 모달용 최소 목표 표시 데이터 */
export function buildSinglePlayerAcademyGoalDisplay(
  session: LiveGameSession,
  stage: SinglePlayerStageInfo,
): SinglePlayerAcademyGoalDisplay {
  const { isSurvivalRules, isCaptureMode } = resolveStageRuleFlags(session, stage);

  if (isSurvivalRules) {
    const settingsSurv = Number((session.settings as { survivalTurns?: number }).survivalTurns ?? 0);
    const turns = settingsSurv > 0 ? settingsSurv : resolveSinglePlayerSurvivalTurnCount(stage);
    const opponentTarget = stage.targetScore?.black ?? 0;
    return {
      survivalGoal: { turns, opponentTarget },
    };
  }

  const turnDisplay = resolveTurnDisplay(session, stage, false);
  const capture = resolveCaptureTargets(session, stage, isCaptureMode);

  const result: SinglePlayerAcademyGoalDisplay = { ...turnDisplay };
  if (capture.my != null) result.myCaptureTarget = capture.my;
  if (capture.opponent != null) result.opponentCaptureTarget = capture.opponent;

  if (
    result.myCaptureTarget == null &&
    result.opponentCaptureTarget == null &&
    result.turnLimit == null &&
    result.autoScoringTurns == null
  ) {
    result.showTerritoryGoal = true;
  }

  return result;
}
