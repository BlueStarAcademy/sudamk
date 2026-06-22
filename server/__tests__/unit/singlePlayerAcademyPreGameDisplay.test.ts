import { describe, expect, it } from 'vitest';
import { GameMode, Player, SinglePlayerLevel } from '../../../shared/types/enums.js';
import type { LiveGameSession, SinglePlayerStageInfo } from '../../../types.js';
import { buildSinglePlayerAcademyGoalDisplay } from '../../../utils/singlePlayerAcademyPreGameDisplay.js';
import { resolveSinglePlayerAcademyModeGuideTabs } from '../../../utils/singlePlayerAcademyModeGuide.js';

function baseStage(overrides: Partial<SinglePlayerStageInfo> = {}): SinglePlayerStageInfo {
  return {
    id: 'intro-1',
    name: '스테이지 1',
    level: SinglePlayerLevel.입문,
    actionPointCost: 1,
    boardSize: 9,
    targetScore: { black: 5, white: 5 },
    placements: { black: 0, white: 0, blackPattern: 0, whitePattern: 0 },
    timeControl: { type: 'byoyomi', mainTime: 0 },
    rewards: { firstClear: { gold: 100, exp: 10 }, repeatClear: { gold: 0, exp: 0 } },
    ...overrides,
  };
}

function baseSession(overrides: Partial<LiveGameSession> = {}): LiveGameSession {
  return {
    id: 'g1',
    mode: GameMode.Capture,
    settings: { mixedModes: [] },
    isSinglePlayer: true,
    ...overrides,
  } as LiveGameSession;
}

describe('buildSinglePlayerAcademyGoalDisplay', () => {
  it('shows turn limit and capture vs when both apply', () => {
    const stage = baseStage({ blackTurnLimit: 20 });
    const session = baseSession({
      effectiveCaptureTargets: { [Player.Black]: 10, [Player.White]: 8 },
    });
    const goals = buildSinglePlayerAcademyGoalDisplay(session, stage);
    expect(goals.turnLimit).toBe(20);
    expect(goals.myCaptureTarget).toBe(10);
    expect(goals.opponentCaptureTarget).toBe(8);
    expect(goals.showTerritoryGoal).toBeUndefined();
  });

  it('shows territory goal only for classic scoring stages', () => {
    const stage = baseStage({
      strategicRulePreset: 'classic',
      targetScore: { black: 0, white: 0 },
    });
    const session = baseSession({ mode: GameMode.Standard });
    const goals = buildSinglePlayerAcademyGoalDisplay(session, stage);
    expect(goals.showTerritoryGoal).toBe(true);
    expect(goals.turnLimit).toBeUndefined();
    expect(goals.myCaptureTarget).toBeUndefined();
  });

  it('shows survival goal line data', () => {
    const stage = baseStage({
      strategicRulePreset: 'survival',
      survivalTurns: 12,
      targetScore: { black: 7, white: 5 },
    });
    const session = baseSession({
      mode: GameMode.Capture,
      settings: { isSurvivalMode: true, survivalTurns: 12, mixedModes: [] },
    });
    const goals = buildSinglePlayerAcademyGoalDisplay(session, stage);
    expect(goals.survivalGoal).toEqual({ turns: 12, opponentTarget: 7 });
    expect(goals.turnLimit).toBeUndefined();
  });

  it('uses autoScoringTurns as auto scoring label when no blackTurnLimit', () => {
    const stage = baseStage({
      strategicRulePreset: 'classic',
      autoScoringTurns: 40,
      targetScore: { black: 0, white: 0 },
    });
    const session = baseSession({ mode: GameMode.Standard });
    const goals = buildSinglePlayerAcademyGoalDisplay(session, stage);
    expect(goals.autoScoringTurns).toBe(40);
    expect(goals.turnLimit).toBeUndefined();
    expect(goals.showTerritoryGoal).toBeUndefined();
  });
});

describe('resolveSinglePlayerAcademyModeGuideTabs', () => {
  it('returns one tab per mixed strategic mode', () => {
    const stage = baseStage({
      strategicRulePreset: 'mix',
      mixedStrategicModes: [GameMode.Speed, GameMode.Missile],
    });
    const session = baseSession({
      mode: GameMode.Mix,
      settings: { mixedModes: [GameMode.Speed, GameMode.Missile] },
    });
    const tabs = resolveSinglePlayerAcademyModeGuideTabs(session, stage);
    expect(tabs.map((t) => t.mode)).toEqual([GameMode.Speed, GameMode.Missile]);
  });
});
