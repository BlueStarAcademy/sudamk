import { GameMode, LiveGameSession, SinglePlayerStageInfo } from '../types.js';
import { SPECIAL_GAME_MODES } from '../shared/constants/gameModes.js';
import {
  resolveSinglePlayerMixedModes,
  resolveSinglePlayerStrategicGameMode,
  resolveSinglePlayerSurvivalModeForSession,
} from '../shared/utils/singlePlayerStrategicRulePreset.js';

export type AcademyModeGuideStep = {
  key: string;
  img: string;
  titleKey: string;
  bodyKey: string;
  bodyParams?: Record<string, string | number>;
};

export type AcademyModeGuideTab = {
  mode: GameMode | 'survival';
  tabLabelKey: string;
  modeIcon: string;
  steps: AcademyModeGuideStep[];
};

export type AcademyModeGuideContext = {
  missileCount?: number;
  hiddenCount?: number;
  scanCount?: number;
};

const MODE_META_IMG: Partial<Record<GameMode, string>> = Object.fromEntries(
  SPECIAL_GAME_MODES.map((m) => [m.mode, m.image]),
) as Partial<Record<GameMode, string>>;

function modeIcon(mode: GameMode): string {
  return MODE_META_IMG[mode] ?? '/images/simbols/simbol1.webp';
}

function mixedList(settings: LiveGameSession['settings']): GameMode[] {
  return settings.mixedModes ?? [];
}

function stepsForMode(mode: GameMode | 'survival', ctx: AcademyModeGuideContext = {}): AcademyModeGuideStep[] {
  const missileCount = ctx.missileCount ?? 0;
  const hiddenCount = ctx.hiddenCount ?? 0;
  const scanCount = ctx.scanCount ?? 0;

  switch (mode) {
    case GameMode.Missile:
      return [
        {
          key: 'missile-item',
          img: '/images/button/missile.webp',
          titleKey: 'game:singlePlayerDesc.modeGuide.missile.step1Title',
          bodyKey:
            missileCount > 0
              ? 'game:singlePlayerDesc.modeGuide.missile.step1BodyItem'
              : 'game:singlePlayerDesc.modeGuide.missile.step1Body',
          bodyParams: missileCount > 0 ? { count: missileCount } : undefined,
        },
        {
          key: 'missile-select',
          img: '/images/button/missile.webp',
          titleKey: 'game:singlePlayerDesc.modeGuide.missile.step2Title',
          bodyKey: 'game:singlePlayerDesc.modeGuide.missile.step2Body',
        },
        {
          key: 'missile-push',
          img: '/images/button/missile.webp',
          titleKey: 'game:singlePlayerDesc.modeGuide.missile.step3Title',
          bodyKey: 'game:singlePlayerDesc.modeGuide.missile.step3Body',
        },
      ];
    case GameMode.Hidden:
      return [
        {
          key: 'hidden-item',
          img: '/images/button/hidden.webp',
          titleKey: 'game:singlePlayerDesc.modeGuide.hidden.step1Title',
          bodyKey:
            hiddenCount > 0
              ? 'game:singlePlayerDesc.modeGuide.hidden.step1BodyItem'
              : 'game:singlePlayerDesc.modeGuide.hidden.step1Body',
          bodyParams: hiddenCount > 0 ? { count: hiddenCount } : undefined,
        },
        {
          key: 'hidden-scan',
          img: '/images/button/scan.webp',
          titleKey: 'game:singlePlayerDesc.modeGuide.hidden.step2Title',
          bodyKey:
            scanCount > 0
              ? 'game:singlePlayerDesc.modeGuide.hidden.step2BodyItem'
              : 'game:singlePlayerDesc.modeGuide.hidden.step2Body',
          bodyParams: scanCount > 0 ? { count: scanCount } : undefined,
        },
        {
          key: 'hidden-tip',
          img: '/images/button/hidden.webp',
          titleKey: 'game:singlePlayerDesc.modeGuide.hidden.step3Title',
          bodyKey: 'game:singlePlayerDesc.modeGuide.hidden.step3Body',
        },
      ];
    case GameMode.Capture:
      return [
        {
          key: 'capture-win',
          img: '/images/simbols/simbol2.webp',
          titleKey: 'game:singlePlayerDesc.modeGuide.capture.step1Title',
          bodyKey: 'game:singlePlayerDesc.modeGuide.capture.step1Body',
        },
        {
          key: 'capture-pattern',
          img: '/images/single/BlackDouble.webp',
          titleKey: 'game:singlePlayerDesc.modeGuide.capture.step2Title',
          bodyKey: 'game:singlePlayerDesc.modeGuide.capture.step2Body',
        },
      ];
    case GameMode.Speed:
      return [
        {
          key: 'speed-time',
          img: '/images/icon/timer.webp',
          titleKey: 'game:singlePlayerDesc.modeGuide.speed.step1Title',
          bodyKey: 'game:singlePlayerDesc.modeGuide.speed.step1Body',
        },
        {
          key: 'speed-score',
          img: '/images/simbols/simbol3.webp',
          titleKey: 'game:singlePlayerDesc.modeGuide.speed.step2Title',
          bodyKey: 'game:singlePlayerDesc.modeGuide.speed.step2Body',
        },
      ];
    case GameMode.Base:
      return [
        {
          key: 'base-layout',
          img: '/images/simbols/simbol4.webp',
          titleKey: 'game:singlePlayerDesc.modeGuide.base.step1Title',
          bodyKey: 'game:singlePlayerDesc.modeGuide.base.step1Body',
        },
        {
          key: 'base-komi',
          img: '/images/simbols/simbol4.webp',
          titleKey: 'game:singlePlayerDesc.modeGuide.base.step2Title',
          bodyKey: 'game:singlePlayerDesc.modeGuide.base.step2Body',
        },
      ];
    case 'survival':
      return [
        {
          key: 'survival-block',
          img: '/images/simbols/simbol1.webp',
          titleKey: 'game:singlePlayerDesc.modeGuide.survival.step1Title',
          bodyKey: 'game:singlePlayerDesc.modeGuide.survival.step1Body',
        },
      ];
    case GameMode.Standard:
    default:
      return [
        {
          key: 'classic-territory',
          img: '/images/simbols/simbol1.webp',
          titleKey: 'game:singlePlayerDesc.modeGuide.classic.step1Title',
          bodyKey: 'game:singlePlayerDesc.modeGuide.classic.step1Body',
        },
        {
          key: 'classic-pass',
          img: '/images/simbols/simbol7.webp',
          titleKey: 'game:singlePlayerDesc.modeGuide.classic.step2Title',
          bodyKey: 'game:singlePlayerDesc.modeGuide.classic.step2Body',
        },
      ];
  }
}

function tabLabelKeyForMode(mode: GameMode | 'survival'): string {
  if (mode === 'survival') return 'game:singlePlayerDesc.modeGuide.survival.tab';
  const map: Partial<Record<GameMode, string>> = {
    [GameMode.Standard]: 'gameModes:standard',
    [GameMode.Capture]: 'gameModes:capture',
    [GameMode.Speed]: 'gameModes:speed',
    [GameMode.Base]: 'gameModes:base',
    [GameMode.Hidden]: 'gameModes:hidden',
    [GameMode.Missile]: 'gameModes:missile',
    [GameMode.Mix]: 'gameModes:mix',
  };
  return map[mode] ?? 'gameModes:standard';
}

function tabForMode(mode: GameMode | 'survival', ctx: AcademyModeGuideContext): AcademyModeGuideTab {
  const gameMode = mode === 'survival' ? GameMode.Capture : mode;
  return {
    mode,
    tabLabelKey: tabLabelKeyForMode(mode),
    modeIcon: mode === 'survival' ? '/images/simbols/simbol1.webp' : modeIcon(gameMode),
    steps: stepsForMode(mode, ctx),
  };
}

/** 스테이지·세션 기준 모드 가이드 탭 목록 (믹스는 서브모드별 탭) */
export function resolveSinglePlayerAcademyModeGuideTabs(
  session: LiveGameSession,
  stage: SinglePlayerStageInfo,
  ctx: AcademyModeGuideContext = {},
): AcademyModeGuideTab[] {
  if (resolveSinglePlayerSurvivalModeForSession(session, stage)) {
    return [tabForMode('survival', ctx)];
  }

  const resolvedMode = resolveSinglePlayerStrategicGameMode(stage);
  if (resolvedMode === GameMode.Mix || session.mode === GameMode.Mix) {
    const mixFromSession = mixedList(session.settings);
    const mixFromStage = resolveSinglePlayerMixedModes(stage);
    const mix = mixFromSession.length >= 2 ? mixFromSession : mixFromStage;
    return mix.map((m) => tabForMode(m, ctx));
  }

  const mode = session.mode === GameMode.Mix ? resolvedMode : session.mode;
  return [tabForMode(mode, ctx)];
}
