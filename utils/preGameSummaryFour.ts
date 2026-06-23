import { LiveGameSession, GameMode, GameSettings, SinglePlayerStageInfo } from '../types.js';
import { Player } from '../types/enums.js';
import { getAdventureEncounterCountdownMinutes } from '../shared/utils/adventureBattleBoard.js';
import {
  resolveSinglePlayerSurvivalModeForSession,
  resolveSinglePlayerSurvivalTurnCount,
} from '../shared/utils/singlePlayerStrategicRulePreset.js';
import { formatDiceGoSpecialDiceSummary } from '../shared/utils/diceGoSettings.js';
import { formatThiefSpecialDiceSummary } from '../shared/utils/thiefGoSettings.js';
import { countTowerLobbyItems, getTowerSessionFloor } from './towerPreGameDisplay.js';
import { SPEED_TIME_PRESSURE_SCORING_SECONDS_PER_POINT } from '../shared/constants/speedTimePressure.js';
import {
  pg,
  pgItem,
  pgNone,
  pgJoin,
  pgSpeedPvpHighlight,
  translateGameMode,
} from '../shared/i18n/preGameSummaryText.js';

export type PreGameSpecialHighlight = {
  img: string;
  text: string;
};

export type PreGameGoalVisual = {
  img: string;
  label: string;
  helper?: string;
};

export type PreGameRuleGuide = {
  key: string;
  img: string;
  title: string;
  body: string;
};

/** 게임 정보 모달: 아이콘 + 우하단 숫자 — `title`은 툴팁·접근성용 */
export type PreGameItemSlot = {
  key: string;
  img: string;
  count: number;
  title?: string;
  /** 도전의 탑 가방 수 배지: 0이면 인게임 하단 버튼과 같은 회색 톤 */
  inventoryBadgeMode?: boolean;
  /** 도전의 탑: 보유 0일 때 경기정보 모달에서 상점 열기용(클라이언트가 처리) */
  towerShopOnZero?: boolean;
};

export type PreGameSummaryFour = {
  winGoal: string;
  /** 승리/패배 조건 패널 아랫줄 */
  loseGoal: string;
  scoreFactors: string;
  /** 초읽기·피셔 등 시간 규칙만 (놀이 모드 등 해당 없으면 '없음') */
  timeRules: string;
  /** 모드별 특수 규칙(이미지+문구). 없으면 빈 배열 → UI에서 '없음' */
  specialHighlights: PreGameSpecialHighlight[];
  /** 시작 모달 목표 카드: 기존 모드/아이템 이미지를 크게 재사용 */
  goalVisuals?: {
    win?: PreGameGoalVisual;
    lose?: PreGameGoalVisual;
  };
  /** 시작 모달 하단의 짧은 사용법 안내 */
  ruleGuides?: PreGameRuleGuide[];
  /** 레거시·호환용 한 줄 텍스트 */
  items: string;
  itemSlots: PreGameItemSlot[];
};

function loseTerritory(): string {
  return pg('loseTerritory', { defaultValue: '계가(종합 점수)에서 집이 적거나, 동점·무승부 규칙에 따라 불리하면 패배' });
}

function loseTerritoryAuto(auto: string): string {
  return pg('loseTerritoryAuto', {
    base: loseTerritory(),
    auto,
    defaultValue: `${loseTerritory()} · ${auto}에 못 이기면 패배`,
  });
}

function loseCaptureRace(t: number): string {
  return pg('loseCaptureRace', {
    t,
    defaultValue: `상대가 ${t}점을 먼저 따내면 패배 · 아니면 계가에서 집이 적으면 패배`,
  });
}

/** 바둑판 문양돌과 동일 스프라이트(`GoBoard` 흑 문양) — 게임 설명 모달 하이라이트 */
const PATTERN_STONE_HIGHLIGHT_IMG = '/images/single/BlackDouble.webp';

/** 게임 설명 모달「특수 규칙」— 베이스 모드는 짧은 두 줄로 표시 */
function baseModePregameHighlights(): PreGameSpecialHighlight[] {
  return [
    {
      img: '/images/simbols/simbol4.webp',
      text: pg('basePlacementAnalysis', { defaultValue: '베이스돌 배치 공개 후 형세분석' }),
    },
    {
      img: '/images/simbols/simbol4.webp',
      text: pg('baseKomiSelect', { defaultValue: '상대에게 줄 덤 설정 · 원하는 돌 선택' }),
    },
  ];
}

function mixedList(s: GameSettings): GameMode[] {
  return s.mixedModes ?? [];
}

function hasMix(m: GameMode[], mode: GameMode): boolean {
  return m.includes(mode);
}

function effectiveModesForRules(mode: GameMode, mix: GameMode[]): GameMode[] {
  if (mode === GameMode.Mix) return mix.length ? mix : [];
  return [mode];
}

function usesTerritoryScoring(mode: GameMode, mix: GameMode[]): boolean {
  if (mode === GameMode.Mix) {
    if (mix.length === 0) return true;
    if (hasMix(mix, GameMode.Capture) && mix.length === 1) return false;
    return true;
  }
  return [GameMode.Standard, GameMode.Speed, GameMode.Base, GameMode.Hidden, GameMode.Missile].includes(mode);
}

function autoScoringLine(settings: GameSettings, mode: GameMode, mix: GameMode[]): string | null {
  const n = settings.scoringTurnLimit;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  if (!usesTerritoryScoring(mode, mix)) return null;
  if (mode === GameMode.Capture || hasMix(mix, GameMode.Capture)) {
    return pg('autoScoringCaptureTurn', {
      n,
      defaultValue: `${n}턴(수) 도달 시 자동 계가 진행`,
    });
  }
  return pg('autoScoringTerritoryWin', {
    n,
    defaultValue: `${n}수(턴) 후 자동 계가에서 승리하기`,
  });
}

/** `autoScoringLine`과 짝 — 딱따로(표준·스피드·베이스 등) 자동 계가 시 패배 한 줄 */
function autoScoringLoseLine(settings: GameSettings, mode: GameMode, mix: GameMode[]): string | null {
  const n = settings.scoringTurnLimit;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  if (!usesTerritoryScoring(mode, mix)) return null;
  if (mode === GameMode.Capture || hasMix(mix, GameMode.Capture)) {
    return null;
  }
  return pg('autoScoringTerritoryLose', {
    n,
    defaultValue: `${n}수(턴) 후 자동 계가에서 패배`,
  });
}

function timeLine(settings: GameSettings, mode: GameMode, mix: GameMode[]): string {
  if ([GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Thief].includes(mode)) return pgNone();
  if (
    mode === GameMode.Mix &&
    !hasMix(mix, GameMode.Speed) &&
    mix.every((x) => ![GameMode.Standard, GameMode.Base, GameMode.Hidden, GameMode.Missile, GameMode.Speed].includes(x))
  ) {
    return pgNone();
  }
  const byoyomiCount = settings.byoyomiCount ?? 0;
  const byoyomiTime = settings.byoyomiTime ?? 30;
  const timeIncrement = settings.timeIncrement ?? 0;
  if (!settings.timeLimit || settings.timeLimit <= 0) {
    if (timeIncrement > 0) {
      return pg('fischerOnly', {
        sec: timeIncrement,
        defaultValue: `피셔 ${timeIncrement}초`,
      });
    }
    if (byoyomiCount > 0 && byoyomiTime > 0) {
      return pg('byoyomiOnly', {
        time: byoyomiTime,
        count: byoyomiCount,
        defaultValue: `초읽기만 · ${byoyomiTime}초×${byoyomiCount}회`,
      });
    }
    return pg('noTimeLimit', { defaultValue: '시간 제한 없음' });
  }
  if (timeIncrement > 0) {
    return pg('limitFischer', {
      min: settings.timeLimit,
      sec: timeIncrement,
      defaultValue: `제한 ${settings.timeLimit}분 · 피셔 ${timeIncrement}초`,
    });
  }
  if (byoyomiCount > 0 && byoyomiTime > 0) {
    return pg('limitByoyomi', {
      min: settings.timeLimit,
      time: byoyomiTime,
      count: byoyomiCount,
      defaultValue: `제한 ${settings.timeLimit}분 · 초읽기 ${byoyomiTime}초×${byoyomiCount}회`,
    });
  }
  return pg('limitNoByoyomi', {
    min: settings.timeLimit,
    defaultValue: `제한 ${settings.timeLimit}분 (초읽기 없음)`,
  });
}

function territoryScoreParts(settings: GameSettings, mode: GameMode, mix: GameMode[]): string[] {
  const parts: string[] = [
    pg('factorTerritory', { defaultValue: '영토' }),
    pg('factorCaptured', { defaultValue: '따낸 돌' }),
    pg('factorDead', { defaultValue: '사석' }),
    pg('factorKomi', { defaultValue: '덤(백)' }),
  ];
  const em = effectiveModesForRules(mode, mix);
  if (em.includes(GameMode.Base)) {
    parts.push(pg('factorBaseBonus', { defaultValue: '베이스 보너스' }));
  }
  if (em.includes(GameMode.Hidden)) {
    parts.push(pg('factorHiddenBonus', { defaultValue: '히든 보너스' }));
  }
  if (em.includes(GameMode.Speed)) {
    parts.push(
      pg('factorSpeedBonus', {
        sec: SPEED_TIME_PRESSURE_SCORING_SECONDS_PER_POINT,
        defaultValue: `수당 ${SPEED_TIME_PRESSURE_SCORING_SECONDS_PER_POINT}초 초과→상대 +1`,
      }),
    );
  }
  if (em.includes(GameMode.Missile)) {
    parts.push(pg('factorMissileEffect', { defaultValue: '미사일 연출 반영' }));
  }
  return parts;
}

/** 모험 경기 안내 모달: 한 줄·짧은 토큰 (줄바꿈 최소화) */
function adventureScoreFactorsShort(mode: GameMode, mix: GameMode[]): string {
  if (mode === GameMode.Capture) {
    return pg('factorAdventureCaptureShort', { defaultValue: '따내기 · 문양 2점' });
  }
  const parts: string[] = [pg('factorAdventureBase', { defaultValue: '기본 계가' })];
  const em = effectiveModesForRules(mode, mix);
  if (em.includes(GameMode.Base)) {
    parts.push(pg('factorAdventureBaseStone5', { defaultValue: '베이스돌 5점' }));
  }
  if (em.includes(GameMode.Hidden)) {
    parts.push(pg('factorAdventureHidden', { defaultValue: '히든' }));
  }
  if (em.includes(GameMode.Speed)) {
    parts.push(pg('factorAdventureSpeed', { defaultValue: '시간' }));
  }
  if (em.includes(GameMode.Missile)) {
    parts.push(pg('factorAdventureMissile', { defaultValue: '미사일' }));
  }
  return pgJoin(parts);
}

/**
 * 아이템 줄: 실제 대국 모드에만 해당하는 항목만 표시.
 * 단일 모드(컬링 등)일 때는 `settings.mixedModes`에 남은 기본값(Hidden 등)을 따르지 않음 — Mix일 때만 mixedModes 사용.
 * 개수 0인 종류는 문구에서 제외.
 */
function itemLine(settings: GameSettings, mode: GameMode, mix: GameMode[]): string {
  const chunks: string[] = [];
  const effectiveModes = mode === GameMode.Mix ? mix : [mode];

  if (effectiveModes.includes(GameMode.Hidden)) {
    const h = settings.hiddenStoneCount ?? 0;
    const s = settings.scanCount ?? 0;
    if (h > 0) {
      chunks.push(pg('itemHidden', { n: h, defaultValue: `히든 ${h}개` }));
    }
    if (s > 0) {
      chunks.push(pg('itemScan', { n: s, defaultValue: `스캔 ${s}개` }));
    }
  }
  if (effectiveModes.includes(GameMode.Missile)) {
    const n = settings.missileCount ?? 0;
    if (n > 0) {
      chunks.push(pg('itemMissile', { n, defaultValue: `미사일 ${n}개` }));
    }
  }
  if (effectiveModes.includes(GameMode.Dice)) {
    const o = settings.oddDiceCount ?? 0;
    const e = settings.evenDiceCount ?? 0;
    const l = settings.lowDiceCount ?? 0;
    const h = settings.highDiceCount ?? 0;
    if (o + e + l + h > 0) {
      const summary = formatDiceGoSpecialDiceSummary(settings);
      chunks.push(
        pg('itemSpecialDice', {
          summary,
          defaultValue: `특수주사위 ${summary}`,
        }),
      );
    }
  }
  if (effectiveModes.includes(GameMode.Thief)) {
    const th = settings.thiefHigh36ItemCount ?? 0;
    const tn = settings.thiefNoOneItemCount ?? 0;
    if (th + tn > 0) {
      const summary = formatThiefSpecialDiceSummary(settings);
      chunks.push(
        pg('itemSpecialDice', {
          summary,
          defaultValue: `특수주사위 ${summary}`,
        }),
      );
    }
  }
  if (effectiveModes.includes(GameMode.Alkkagi)) {
    const slow = settings.alkkagiSlowItemCount ?? 0;
    const aim = settings.alkkagiAimingLineItemCount ?? 0;
    if (slow > 0 || aim > 0) {
      chunks.push(
        pg('itemSlowAim', {
          slow,
          aim,
          defaultValue: `슬로우 ${slow} · 조준 ${aim}`,
        }),
      );
    }
  }
  if (effectiveModes.includes(GameMode.Curling)) {
    const slow = settings.curlingSlowItemCount ?? 0;
    const aim = settings.curlingAimingLineItemCount ?? 0;
    if (slow > 0 || aim > 0) {
      chunks.push(
        pg('itemSlowAim', {
          slow,
          aim,
          defaultValue: `슬로우 ${slow} · 조준 ${aim}`,
        }),
      );
    }
  }
  return chunks.length ? pgJoin(chunks) : pgNone();
}

function buildItemSlots(settings: GameSettings, mode: GameMode, mix: GameMode[]): PreGameItemSlot[] {
  const slots: PreGameItemSlot[] = [];
  const effectiveModes = mode === GameMode.Mix ? mix : [mode];

  if (effectiveModes.includes(GameMode.Hidden)) {
    const h = settings.hiddenStoneCount ?? 0;
    const s = settings.scanCount ?? 0;
    if (h > 0) {
      slots.push({
        key: 'hidden',
        img: '/images/button/hidden.webp',
        count: h,
        title: pgItem('hiddenStone', { defaultValue: '히든 돌' }),
      });
    }
    if (s > 0) {
      slots.push({
        key: 'scan',
        img: '/images/button/scan.webp',
        count: s,
        title: pgItem('scan', { defaultValue: '스캔' }),
      });
    }
  }
  if (effectiveModes.includes(GameMode.Missile)) {
    const n = settings.missileCount ?? 0;
    if (n > 0) {
      slots.push({
        key: 'missile',
        img: '/images/button/missile.webp',
        count: n,
        title: pgItem('missile', { defaultValue: '미사일' }),
      });
    }
  }
  if (effectiveModes.includes(GameMode.Dice)) {
    const o = settings.oddDiceCount ?? 0;
    const e = settings.evenDiceCount ?? 0;
    const l = settings.lowDiceCount ?? 0;
    const h = settings.highDiceCount ?? 0;
    const diceImg = '/images/simbols/simbolp1.webp';
    if (o > 0) {
      slots.push({
        key: 'dice-odd',
        img: diceImg,
        count: o,
        title: pgItem('diceOdd', { defaultValue: '홀수 주사위 아이템' }),
      });
    }
    if (e > 0) {
      slots.push({
        key: 'dice-even',
        img: diceImg,
        count: e,
        title: pgItem('diceEven', { defaultValue: '짝수 주사위 아이템' }),
      });
    }
    if (l > 0) {
      slots.push({
        key: 'dice-low',
        img: diceImg,
        count: l,
        title: pgItem('diceLow', { defaultValue: '낮은 수(1~3) 주사위 아이템' }),
      });
    }
    if (h > 0) {
      slots.push({
        key: 'dice-high',
        img: diceImg,
        count: h,
        title: pgItem('diceHigh', { defaultValue: '높은 수(4~6) 주사위 아이템' }),
      });
    }
  }
  if (effectiveModes.includes(GameMode.Alkkagi)) {
    const slow = settings.alkkagiSlowItemCount ?? 0;
    const aim = settings.alkkagiAimingLineItemCount ?? 0;
    if (slow > 0) {
      slots.push({
        key: 'alk-slow',
        img: '/images/button/slow.webp',
        count: slow,
        title: pgItem('slow', { defaultValue: '슬로우' }),
      });
    }
    if (aim > 0) {
      slots.push({
        key: 'alk-aim',
        img: '/images/button/target.webp',
        count: aim,
        title: pgItem('aimLine', { defaultValue: '조준선' }),
      });
    }
  }
  if (effectiveModes.includes(GameMode.Curling)) {
    const slow = settings.curlingSlowItemCount ?? 0;
    const aim = settings.curlingAimingLineItemCount ?? 0;
    if (slow > 0) {
      slots.push({
        key: 'curl-slow',
        img: '/images/button/slow.webp',
        count: slow,
        title: pgItem('slow', { defaultValue: '슬로우' }),
      });
    }
    if (aim > 0) {
      slots.push({
        key: 'curl-aim',
        img: '/images/button/target.webp',
        count: aim,
        title: pgItem('aimLine', { defaultValue: '조준선' }),
      });
    }
  }
  return slots;
}

function buildSinglePlayerStageItemSlots(
  stage: SinglePlayerStageInfo,
  opts?: {
    /** 실제 대국 모드(스테이지 JSON에 남은 미사일·히든 수와 불일치할 때 슬롯 숨김) */
    session?: Pick<LiveGameSession, 'mode' | 'settings'>;
    /** 도전의 탑: 스테이지에 허용된 종류는 아이콘 유지, 배지는 가방 보유 수(0 포함) */
    towerOwned?: { missile: number; hidden: number; scan: number; turnAdd: number } | null;
    towerShopOnZero?: boolean;
    /** 도전의 탑 1~20층: 턴 추가 슬롯 표시 */
    towerSessionFloor?: number;
  }
): PreGameItemSlot[] {
  const slots: PreGameItemSlot[] = [];
  const sm = stage.missileCount ?? 0;
  const sh = stage.hiddenCount ?? 0;
  const ss = stage.scanCount ?? 0;
  const owned = opts?.towerOwned ?? null;
  const shopZero = !!opts?.towerShopOnZero;
  const floor = opts?.towerSessionFloor;
  const showTurnAddSlot =
    shopZero && typeof floor === 'number' && Number.isFinite(floor) && floor >= 1 && floor <= 20;

  const sess = opts?.session;
  const mix = sess ? mixedList(sess.settings) : [];
  const em = sess ? effectiveModesForRules(sess.mode, mix) : null;
  const showMissileSlot = !em || em.includes(GameMode.Missile);
  const showHiddenScanSlots = !em || em.includes(GameMode.Hidden);

  if (showTurnAddSlot) {
    slots.push({
      key: 'turn-add',
      img: '/images/button/addturn.webp',
      count: owned ? owned.turnAdd : 0,
      title: pgItem('turnAdd', { defaultValue: '턴 추가' }),
      inventoryBadgeMode: true,
      towerShopOnZero: shopZero,
    });
  }
  if (showMissileSlot && sm > 0) {
    slots.push({
      key: 'missile',
      img: '/images/button/missile.webp',
      count: owned ? owned.missile : sm,
      title: pgItem('missile', { defaultValue: '미사일' }),
      inventoryBadgeMode: !!owned,
      towerShopOnZero: shopZero,
    });
  }
  if (showHiddenScanSlots && sh > 0) {
    slots.push({
      key: 'hidden',
      img: '/images/button/hidden.webp',
      count: owned ? owned.hidden : sh,
      title: pgItem('hiddenStone', { defaultValue: '히든 돌' }),
      inventoryBadgeMode: !!owned,
      towerShopOnZero: shopZero,
    });
  }
  if (showHiddenScanSlots && ss > 0) {
    slots.push({
      key: 'scan',
      img: '/images/button/scan.webp',
      count: owned ? owned.scan : ss,
      title: pgItem('scan', { defaultValue: '스캔' }),
      inventoryBadgeMode: !!owned,
      towerShopOnZero: shopZero,
    });
  }
  return slots;
}

function mixWinGoal(settings: GameSettings, mix: GameMode[]): string {
  const cap = hasMix(mix, GameMode.Capture);
  const auto = autoScoringLine(settings, GameMode.Mix, mix);
  const tail = mix.filter((m) => m !== GameMode.Standard);
  if (cap) {
    const t = settings.captureTarget ?? 20;
    const base = pg('mixCaptureWin', {
      t,
      defaultValue: `따내기 ${t}점 선달성 시 즉시 승리 · 미달성 시 계가 후 집 비교`,
    });
    return auto
      ? pg('mixCaptureWinWithAuto', {
          t,
          auto,
          defaultValue: `${base} · ${auto}`,
        })
      : base;
  }
  if (auto) {
    return pg('mixAutoTerritoryWin', {
      auto,
      defaultValue: `${auto} — 집이 많은 쪽 승리`,
    });
  }
  if (tail.length) {
    const modes = tail.map((m) => translateGameMode(m)).join(', ');
    return pg('mixComboTail', {
      modes,
      defaultValue: `조합(${modes}) — 종료 시 규칙에 따라 승패 결정`,
    });
  }
  return pg('mixDefaultEnd', { defaultValue: '종료 시 규칙에 따라 승패 결정' });
}

function mixScoreFactors(settings: GameSettings, mix: GameMode[]): string {
  const parts: string[] = [];
  if (hasMix(mix, GameMode.Capture)) {
    parts.push(pg('factorCaptureScore', { defaultValue: '따내기 점수' }));
  }
  const terr =
    hasMix(mix, GameMode.Standard) ||
    hasMix(mix, GameMode.Speed) ||
    hasMix(mix, GameMode.Base) ||
    hasMix(mix, GameMode.Hidden) ||
    hasMix(mix, GameMode.Missile);
  if (terr) {
    parts.push(...territoryScoreParts(settings, GameMode.Mix, mix));
  }
  const dedup = [...new Set(parts)];
  return dedup.length ? pgJoin(dedup) : pg('factorMixFallback', { defaultValue: '모드 조합에 따름' });
}

function mixSpecialHighlights(
  settings: GameSettings,
  mix: GameMode[],
  includeFischerGuide: boolean = true
): PreGameSpecialHighlight[] {
  const h: PreGameSpecialHighlight[] = [];
  if (hasMix(mix, GameMode.Capture)) {
    h.push({
      img: PATTERN_STONE_HIGHLIGHT_IMG,
      text: pg('highlightPatternStone2', { defaultValue: '문양돌 따내기 2점' }),
    });
  }
  if (hasMix(mix, GameMode.Base)) {
    h.push(...baseModePregameHighlights());
  }
  if (hasMix(mix, GameMode.Hidden)) {
    h.push({
      img: '/images/button/hidden.webp',
      text: pg('highlightHiddenScan', { defaultValue: '히든 착수 · 스캔으로 탐색' }),
    });
  }
  if (hasMix(mix, GameMode.Missile)) {
    h.push({
      img: '/images/button/missile.webp',
      text: pg('highlightMissileMove', { defaultValue: '미사일로 돌 직선 이동' }),
    });
  }
  if (hasMix(mix, GameMode.Speed) && includeFischerGuide) {
    h.push({ img: '/images/icon/timer.webp', text: pgSpeedPvpHighlight() });
  }
  const auto = autoScoringLine(settings, GameMode.Mix, mix);
  if (auto) {
    h.push({ img: '/images/simbols/simbol10.webp', text: auto });
  }
  return h;
}

function singlePlayerStageTimeRules(
  _stage: SinglePlayerStageInfo,
  isSpeedMode: boolean,
  settings?: GameSettings,
): string {
  /** 싱글/탑 비스피드: 서버에서 제한시간·초읽기 미적용 — 스테이지 JSON의 분/초읽기는 표시하지 않음 */
  if (isSpeedMode) {
    const mainMin = settings?.timeLimit ?? 0;
    if (mainMin > 0) {
      return pg('spTimeMainFischer', {
        min: mainMin,
        sec: SPEED_TIME_PRESSURE_SCORING_SECONDS_PER_POINT,
        defaultValue: `메인 ${mainMin}분 · 수당 ${SPEED_TIME_PRESSURE_SCORING_SECONDS_PER_POINT}초 초읽기`,
      });
    }
    return pg('spTimeFischerOnly', {
      sec: SPEED_TIME_PRESSURE_SCORING_SECONDS_PER_POINT,
      defaultValue: `수당 ${SPEED_TIME_PRESSURE_SCORING_SECONDS_PER_POINT}초 초읽기`,
    });
  }
  return pg('spTimeUnlimited', { defaultValue: '제한없음' });
}

function singlePlayerStageHighlights(
  session: LiveGameSession,
  stage: SinglePlayerStageInfo,
  /** 미사일·히든·스캔·턴 추가 표시용 개수(싱글: 스테이지, 탑: 가방 보유 / 탑 1~20만 turnAdd) */
  disp: { missile: number; hidden: number; scan: number; turnAdd?: number }
): PreGameSpecialHighlight[] {
  const h: PreGameSpecialHighlight[] = [];
  const isSurvivalRules = resolveSinglePlayerSurvivalModeForSession(session, stage);
  const isLegacyRuleInference = stage.strategicRulePreset == null || stage.strategicRulePreset === 'auto';
  const mix = mixedList(session.settings);
  const em = effectiveModesForRules(session.mode, mix);
  const isCaptureMode =
    !isSurvivalRules &&
    (session.mode === GameMode.Capture ||
      em.includes(GameMode.Capture) ||
      (isLegacyRuleInference && stage.blackTurnLimit !== undefined));
  if (
    (stage.placements.blackPattern > 0 || stage.placements.whitePattern > 0) &&
    (isCaptureMode || isSurvivalRules)
  ) {
    h.push({
      img: PATTERN_STONE_HIGHLIGHT_IMG,
      text: pg('highlightPatternStone2', { defaultValue: '문양돌 따내기 2점' }),
    });
  }
  if (session.mode === GameMode.Base || em.includes(GameMode.Base)) {
    h.push(...baseModePregameHighlights());
  }
  if (isSurvivalRules) {
    const settingsSurv = Number((session.settings as any)?.survivalTurns ?? 0);
    const survN = settingsSurv > 0 ? settingsSurv : resolveSinglePlayerSurvivalTurnCount(stage);
    h.push({
      img: '/images/simbols/simbol1.webp',
      text: pg('highlightSurvival', {
        n: survN,
        defaultValue: `살리기 바둑 · 백 ${survN}턴 내 목표 점수`,
      }),
    });
  }
  if (
    stage.autoScoringTurns &&
    stage.autoScoringTurns > 0 &&
    !isCaptureMode &&
    usesTerritoryScoring(session.mode, mix)
  ) {
    h.push({
      img: '/images/simbols/simbol7.webp',
      text: pg('highlightAutoScoring', {
        n: stage.autoScoringTurns,
        defaultValue: `${stage.autoScoringTurns}수 후 자동 계가`,
      }),
    });
  }
  if (stage.blackTurnLimit && !isSurvivalRules) {
    h.push({
      img: '/images/icon/timer.webp',
      text: pg('highlightBlackTurnLimit', {
        n: stage.blackTurnLimit,
        defaultValue: `흑 ${stage.blackTurnLimit}턴 제한`,
      }),
    });
  }
  const missileN = disp.missile;
  const hiddenN = disp.hidden;
  const scanN = disp.scan;
  const turnAddN = disp.turnAdd;
  if (typeof turnAddN === 'number' && turnAddN > 0) {
    h.push({
      img: '/images/button/addturn.webp',
      text: pg('highlightTurnAdd', {
        n: turnAddN,
        defaultValue: `턴 추가 ${turnAddN}개`,
      }),
    });
  }
  if (em.includes(GameMode.Missile) && missileN > 0) {
    h.push({
      img: '/images/button/missile.webp',
      text: pg('highlightMissile', {
        n: missileN,
        defaultValue: `미사일 ${missileN}개`,
      }),
    });
  }
  if (em.includes(GameMode.Hidden) && (hiddenN > 0 || scanN > 0)) {
    h.push({
      img: '/images/button/hidden.webp',
      text: pg('highlightHiddenScanCounts', {
        hidden: hiddenN,
        scan: scanN,
        defaultValue: `히든 ${hiddenN}개 · 스캔 ${scanN}개`,
      }),
    });
  }
  return h;
}

function singlePlayerGoalVisuals(
  session: LiveGameSession,
  stage: SinglePlayerStageInfo,
  flags: {
    isSurvivalRules: boolean;
    isCaptureMode: boolean;
    isSpeedMode: boolean;
  }
): NonNullable<PreGameSummaryFour['goalVisuals']> {
  if (flags.isSurvivalRules) {
    const settingsSurv = Number((session.settings as any)?.survivalTurns ?? 0);
    const survN = settingsSurv > 0 ? settingsSurv : resolveSinglePlayerSurvivalTurnCount(stage);
    return {
      win: {
        img: '/images/simbols/simbol1.webp',
        label: pg('goalSurvivalWinLabel', { defaultValue: '백 막기' }),
        helper: pg('goalSurvivalWinHelper', {
          n: survN,
          defaultValue: `${survN}턴 동안 백 목표를 막기`,
        }),
      },
      lose: {
        img: PATTERN_STONE_HIGHLIGHT_IMG,
        label: pg('goalSurvivalLoseLabel', { defaultValue: '백 성공' }),
        helper: pg('goalSurvivalLoseHelper', { defaultValue: '백이 목표를 만들면 실패' }),
      },
    };
  }

  if (flags.isCaptureMode) {
    return {
      win: {
        img: PATTERN_STONE_HIGHLIGHT_IMG,
        label: pg('goalCaptureWinLabel', { defaultValue: '따내기' }),
        helper: pg('goalCaptureWinHelper', { defaultValue: '상대 돌을 둘러싸면 점수' }),
      },
      lose: {
        img: stage.blackTurnLimit ? '/images/icon/timer.webp' : '/images/simbols/simbol2.webp',
        label: stage.blackTurnLimit
          ? pg('goalCaptureLoseTurnLabel', { defaultValue: '턴 초과' })
          : pg('goalCaptureLoseFirstLabel', { defaultValue: '상대 선취' }),
        helper: stage.blackTurnLimit
          ? pg('goalCaptureLoseTurnHelper', {
              n: stage.blackTurnLimit,
              defaultValue: `${stage.blackTurnLimit}턴 안에 못 하면 실패`,
            })
          : pg('goalCaptureLoseFirstHelper', { defaultValue: '상대가 먼저 따내면 실패' }),
      },
    };
  }

  if (flags.isSpeedMode) {
    return {
      win: {
        img: '/images/icon/timer.webp',
        label: pg('goalSpeedWinLabel', { defaultValue: '빠르게' }),
        helper: pg('goalSpeedWinHelper', { defaultValue: '시간을 지키며 집 만들기' }),
      },
      lose: {
        img: '/images/simbols/simbol7.webp',
        label: pg('goalSpeedLoseLabel', { defaultValue: '점수 열세' }),
        helper: pg('goalSpeedLoseHelper', { defaultValue: '집이 적으면 실패' }),
      },
    };
  }

  if (stage.autoScoringTurns && stage.autoScoringTurns > 0) {
    return {
      win: {
        img: '/images/simbols/simbol7.webp',
        label: pg('goalAutoWinLabel', { defaultValue: '집 많이' }),
        helper: pg('goalAutoWinHelper', {
          n: stage.autoScoringTurns,
          defaultValue: `${stage.autoScoringTurns}수 후 집 계산`,
        }),
      },
      lose: {
        img: '/images/icon/timer.webp',
        label: pg('goalAutoLoseLabel', { defaultValue: '집 부족' }),
        helper: pg('goalAutoLoseHelper', {
          n: stage.autoScoringTurns,
          defaultValue: `${stage.autoScoringTurns}수 때 불리하면 실패`,
        }),
      },
    };
  }

  return {
    win: {
      img: '/images/simbols/simbol1.webp',
      label: pg('goalDefaultWinLabel', { defaultValue: '집 만들기' }),
      helper: pg('goalDefaultWinHelper', { defaultValue: '영역을 둘러 집을 만들기' }),
    },
    lose: {
      img: '/images/simbols/simbol7.webp',
      label: pg('goalDefaultLoseLabel', { defaultValue: '집 부족' }),
      helper: pg('goalDefaultLoseHelper', { defaultValue: '집이 적으면 실패' }),
    },
  };
}

function singlePlayerRuleGuides(
  session: LiveGameSession,
  stage: SinglePlayerStageInfo,
  disp: { missile: number; hidden: number; scan: number; turnAdd?: number },
  flags: {
    isSurvivalRules: boolean;
    isCaptureMode: boolean;
    isSpeedMode: boolean;
  }
): PreGameRuleGuide[] {
  const guides: PreGameRuleGuide[] = [];
  const mix = mixedList(session.settings);
  const em = effectiveModesForRules(session.mode, mix);
  const add = (guide: PreGameRuleGuide) => {
    if (!guides.some((row) => row.key === guide.key)) guides.push(guide);
  };

  if (stage.blackTurnLimit && !flags.isSurvivalRules) {
    add({
      key: 'turn-limit',
      img: '/images/icon/timer.webp',
      title: pg('guideTurnLimitTitle', { defaultValue: '턴 제한' }),
      body: pg('guideTurnLimitBody', {
        n: stage.blackTurnLimit,
        defaultValue: `${stage.blackTurnLimit}턴 안에 끝내기`,
      }),
    });
  }

  if (flags.isSurvivalRules) {
    const settingsSurv = Number((session.settings as any)?.survivalTurns ?? 0);
    const survN = settingsSurv > 0 ? settingsSurv : resolveSinglePlayerSurvivalTurnCount(stage);
    add({
      key: 'survival',
      img: '/images/simbols/simbol1.webp',
      title: pg('guideSurvivalTitle', { defaultValue: '막기' }),
      body: pg('guideSurvivalBody', {
        n: survN,
        defaultValue: `${survN}턴 동안 백 목표 막기`,
      }),
    });
  }

  if (
    stage.autoScoringTurns &&
    stage.autoScoringTurns > 0 &&
    !flags.isCaptureMode &&
    usesTerritoryScoring(session.mode, mix)
  ) {
    add({
      key: 'auto-scoring',
      img: '/images/simbols/simbol7.webp',
      title: pg('guideAutoScoringTitle', { defaultValue: '계가' }),
      body: pg('guideAutoScoringBody', {
        n: stage.autoScoringTurns,
        defaultValue: `${stage.autoScoringTurns}수 후 집 계산`,
      }),
    });
  }

  if (
    (stage.placements.blackPattern > 0 || stage.placements.whitePattern > 0) &&
    (flags.isCaptureMode || flags.isSurvivalRules)
  ) {
    add({
      key: 'pattern-stone',
      img: PATTERN_STONE_HIGHLIGHT_IMG,
      title: pg('guidePatternStoneTitle', { defaultValue: '문양돌' }),
      body: pg('guidePatternStoneBody', { defaultValue: '따내면 2점' }),
    });
  }

  if (flags.isSpeedMode) {
    add({
      key: 'speed',
      img: '/images/icon/timer.webp',
      title: pg('guideSpeedTitle', { defaultValue: '스피드' }),
      body: pg('guideSpeedBody', { defaultValue: '늦게 두면 상대 +1점' }),
    });
  }

  if (typeof disp.turnAdd === 'number' && disp.turnAdd > 0) {
    add({
      key: 'turn-add',
      img: '/images/button/addturn.webp',
      title: pg('guideTurnAddTitle', { defaultValue: '턴 추가' }),
      body: pg('guideTurnAddBody', { defaultValue: '제한 턴 늘리기' }),
    });
  }

  if (em.includes(GameMode.Missile) && disp.missile > 0) {
    add({
      key: 'missile',
      img: '/images/button/missile.webp',
      title: pg('guideMissileTitle', { defaultValue: '미사일' }),
      body: pg('guideMissileBody', { defaultValue: '돌을 골라 직선 밀기' }),
    });
  }

  if (em.includes(GameMode.Hidden) && (disp.hidden > 0 || disp.scan > 0)) {
    add({
      key: 'hidden-scan',
      img: '/images/button/hidden.webp',
      title: pg('guideHiddenScanTitle', { defaultValue: '히든 · 스캔' }),
      body: pg('guideHiddenScanBody', {
        hidden: disp.hidden,
        scan: disp.scan,
        defaultValue: `숨기기 ${disp.hidden} · 찾기 ${disp.scan}`,
      }),
    });
  }

  return guides;
}

function buildAdventurePreGameSummary(session: LiveGameSession): PreGameSummaryFour {
  const { mode, settings } = session;
  const mix = mixedList(settings);
  const bs = settings.boardSize ?? session.adventureBoardSize ?? 9;
  const mins = getAdventureEncounterCountdownMinutes(bs);
  const timeRules = pg('advTimeLimit', {
    mins,
    defaultValue: `${mins}분 제한`,
  });

  if (mode === GameMode.Capture) {
    return {
      winGoal: pg('advCaptureWin', { defaultValue: '따내기 승리' }),
      loseGoal: pg('advCaptureLose', { defaultValue: '따내기 패배 · 시간 초과' }),
      scoreFactors: adventureScoreFactorsShort(mode, mix),
      timeRules,
      specialHighlights: [],
      items: itemLine(settings, mode, mix),
      itemSlots: buildItemSlots(settings, mode, mix),
    };
  }

  const limit = settings.scoringTurnLimit;
  const hasAuto = typeof limit === 'number' && limit > 0;
  const winGoal = hasAuto
    ? pg('advTerritoryWinAuto', {
        n: limit,
        defaultValue: `계가 승리 · ${limit}수 자동`,
      })
    : pg('advTerritoryWin', { defaultValue: '계가 승리' });
  const loseGoal = pg('advTerritoryLose', { defaultValue: '계가 패배 · 시간 초과' });
  const scoreFactors = adventureScoreFactorsShort(mode, mix);

  return {
    winGoal,
    loseGoal,
    scoreFactors,
    timeRules,
    specialHighlights: [],
    items: itemLine(settings, mode, mix),
    itemSlots: buildItemSlots(settings, mode, mix),
  };
}

/**
 * 인게임 시작 전 모달용 요약 (승리·패배 조건 / 점수 요인 / 시간 규칙 / 아이템 + 특수 규칙 행)
 */
export function getPreGameSummaryFour(
  session: LiveGameSession,
  stage?: SinglePlayerStageInfo,
  /** 도전의 탑 전용: 대기실 가방과 동일한 미사일·히든·스캔 표시 개수 */
  towerLobbyInventory?: Array<{ name?: string; id?: string; quantity?: number; source?: string | null }>
): PreGameSummaryFour {
  const { mode, settings } = session;
  const mix = mixedList(settings);

  if (stage) {
    return getSinglePlayerStageSummary(session, stage, towerLobbyInventory);
  }

  if (session.gameCategory === 'adventure') {
    return buildAdventurePreGameSummary(session);
  }

  /** 길드전 AI 판: 일반 모드 요약을 쓰되 승·패 문구만 짧게 (인게임 경기시작 모달과 동일 톤) */
  if (String(session.gameCategory ?? '') === 'guildwar') {
    const stripped = { ...session, gameCategory: undefined } as LiveGameSession;
    const base = getPreGameSummaryFour(stripped, undefined, towerLobbyInventory);
    const cap = settings.captureTarget ?? 20;
    const limit = settings.scoringTurnLimit;
    const hasAuto = typeof limit === 'number' && Number.isFinite(limit) && limit > 0;
    if (mode === GameMode.Capture) {
      return {
        ...base,
        winGoal: hasAuto
          ? pg('gwCaptureWinAuto', {
              cap,
              limit,
              defaultValue: `${cap}점 선취 또는 ${limit}턴 계가 승`,
            })
          : pg('gwCaptureWin', {
              cap,
              defaultValue: `${cap}점 먼저 따내면 승리`,
            }),
        loseGoal: pg('gwCaptureLose', {
          cap,
          defaultValue: `상대 ${cap}점 선취`,
        }),
      };
    }
    return {
      ...base,
      winGoal: hasAuto
        ? pg('gwTerritoryWinAuto', {
            limit,
            defaultValue: `계가 집 다수 승 · ${limit}수 자동 계가`,
          })
        : pg('gwTerritoryWin', { defaultValue: '계가에서 집이 많으면 승리' }),
      loseGoal: pg('gwTerritoryLose', { defaultValue: '계가 열세 · 시간 초과' }),
    };
  }

  if (mode === GameMode.Mix) {
    return {
      winGoal: mixWinGoal(settings, mix),
      loseGoal: pg('loseMix', {
        defaultValue: '종료 시 따내기·계가 등에서 상대가 승리 조건을 먼저 충족하거나 불리하면 패배',
      }),
      scoreFactors: mixScoreFactors(settings, mix),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: mixSpecialHighlights(settings, mix, !session.isAiGame),
      items: itemLine(settings, mode, mix),
      itemSlots: buildItemSlots(settings, GameMode.Mix, mix),
    };
  }

  if (mode === GameMode.Capture) {
    const t = settings.captureTarget ?? 20;
    const auto = autoScoringLine(settings, mode, mix);
    return {
      winGoal: auto
        ? pg('captureWinWithAuto', {
            t,
            auto,
            defaultValue: `상대 돌 ${t}점 먼저 따내기 · ${auto}`,
          })
        : pg('captureWin', {
            t,
            defaultValue: `상대 돌 ${t}점 먼저 따내기`,
          }),
      loseGoal: loseCaptureRace(t),
      scoreFactors: pg('factorCaptureNoTerritory', { defaultValue: '따내기 점수(집 계산 없음)' }),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: [
        {
          img: PATTERN_STONE_HIGHLIGHT_IMG,
          text: pg('highlightPatternStone2', { defaultValue: '문양돌 따내기 2점' }),
        },
      ],
      items: pgNone(),
      itemSlots: [],
    };
  }

  if (mode === GameMode.Speed) {
    const auto = autoScoringLine(settings, mode, mix);
    const autoLose = autoScoringLoseLine(settings, mode, mix);
    return {
      winGoal: auto ?? pg('speedTerritoryWinDefault', { defaultValue: '계가 후 종합 점수가 높은 쪽 승리' }),
      loseGoal:
        autoLose ??
        (auto
          ? loseTerritoryAuto(auto)
          : pg('speedTerritoryLoseDefault', { defaultValue: '계가 후 종합 점수가 낮으면 패배' })),
      scoreFactors: pgJoin(territoryScoreParts(settings, mode, mix)),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: session.isAiGame
        ? []
        : [{ img: '/images/icon/timer.webp', text: pgSpeedPvpHighlight() }],
      items: pgNone(),
      itemSlots: [],
    };
  }

  if (mode === GameMode.Base) {
    const auto = autoScoringLine(settings, mode, mix);
    const autoLose = autoScoringLoseLine(settings, mode, mix);
    return {
      winGoal: auto ?? pg('territoryWinDefault', { defaultValue: '계가 후 집이 많은 쪽 승리' }),
      loseGoal: autoLose ?? (auto ? loseTerritoryAuto(auto) : loseTerritory()),
      scoreFactors: pgJoin(territoryScoreParts(settings, mode, mix)),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: baseModePregameHighlights(),
      items: pgNone(),
      itemSlots: [],
    };
  }

  if (mode === GameMode.Hidden) {
    const auto = autoScoringLine(settings, mode, mix);
    const autoLose = autoScoringLoseLine(settings, mode, mix);
    return {
      winGoal: auto ?? pg('territoryWinDefault', { defaultValue: '계가 후 집이 많은 쪽 승리' }),
      loseGoal: autoLose ?? (auto ? loseTerritoryAuto(auto) : loseTerritory()),
      scoreFactors: pgJoin(territoryScoreParts(settings, mode, mix)),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: [
        {
          img: '/images/button/hidden.webp',
          text: pg('highlightHiddenScan', { defaultValue: '히든 착수 · 스캔으로 탐색' }),
        },
      ],
      items: itemLine(settings, mode, mix),
      itemSlots: buildItemSlots(settings, GameMode.Hidden, mix),
    };
  }

  if (mode === GameMode.Missile) {
    const auto = autoScoringLine(settings, mode, mix);
    const autoLose = autoScoringLoseLine(settings, mode, mix);
    return {
      winGoal: auto ?? pg('territoryWinDefault', { defaultValue: '계가 후 집이 많은 쪽 승리' }),
      loseGoal: autoLose ?? (auto ? loseTerritoryAuto(auto) : loseTerritory()),
      scoreFactors: pgJoin(territoryScoreParts(settings, mode, mix)),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: [
        {
          img: '/images/button/missile.webp',
          text: pg('highlightMissileMove', { defaultValue: '미사일로 돌 직선 이동' }),
        },
      ],
      items: itemLine(settings, mode, mix),
      itemSlots: buildItemSlots(settings, GameMode.Missile, mix),
    };
  }

  if (mode === GameMode.Standard) {
    const auto = autoScoringLine(settings, mode, mix);
    const autoLose = autoScoringLoseLine(settings, mode, mix);
    return {
      winGoal: auto ?? pg('territoryWinDefault', { defaultValue: '계가 후 집이 많은 쪽 승리' }),
      loseGoal: autoLose ?? (auto ? loseTerritoryAuto(auto) : loseTerritory()),
      scoreFactors: pgJoin(territoryScoreParts(settings, mode, mix)),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: auto ? [{ img: '/images/simbols/simbol7.webp', text: auto }] : [],
      items: pgNone(),
      itemSlots: [],
    };
  }

  if (mode === GameMode.Castle) {
    const castles = settings.castleCount ?? 1;
    return {
      winGoal: pg('castleWin', {
        defaultValue: '상대 돌 1개 이상 따내면 즉시 승리 · 유효수 없으면 영토 계가',
      }),
      loseGoal: pg('castleLose', {
        defaultValue: '상대에게 1돌이라도 잡히면 패배 · 계가에서 집이 적으면 패배',
      }),
      scoreFactors: pg('factorCastle', { defaultValue: '확정 영토 · 따낸 돌 · 덤(백)' }),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: [
        {
          img: '/images/simbols/simbol4.webp',
          text: pg('castleHighlightCount', {
            castles,
            defaultValue: `캐슬 ${castles}개 · 완성 영토 진입 불가`,
          }),
        },
        {
          img: '/images/simbols/simbol2.webp',
          text: pg('castleHighlightCapture', { defaultValue: '1돌 포획 시 즉시 승리' }),
        },
      ],
      items: pgNone(),
      itemSlots: [],
    };
  }

  if (mode === GameMode.Chess) {
    const budget = settings.chessPieceTotalScore ?? (settings.boardSize === 9 ? 9 : 15);
    return {
      winGoal: pg('chessWin', { defaultValue: '정해진 수순 후 계가' }),
      loseGoal: pg('chessLose', { defaultValue: '계가에서 패배 · 킹 포획 시 즉시 패배' }),
      scoreFactors: pg('factorChess', { defaultValue: '영토 · 따낸 돌 · 사석 · 기물 포획 · 덤(백)' }),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: [
        {
          img: '/images/simbols/simbol9.webp',
          text: pg('chessHighlightBudget', {
            budget,
            defaultValue: `기물 총점수 ${budget}점 예산 내 직접 배치(킹 2번째 줄 중앙 고정)`,
          }),
        },
        {
          img: '/images/simbols/simbol9.webp',
          text: pg('chessHighlightMovement', {
            defaultValue: '기물돌을 체스의 움직임으로 매 턴 1회씩 움직일 수 있음(횟수 제한)',
          }),
        },
      ],
      items: pgNone(),
      itemSlots: [],
    };
  }

  if (mode === GameMode.Omok) {
    const f33 = settings.has33Forbidden
      ? pg('omok33Forbidden', { defaultValue: '쌍삼 금지' })
      : pg('omok33Allowed', { defaultValue: '쌍삼 허용' });
    const fo = settings.hasOverlineForbidden
      ? pg('omokOverlineForbidden', { defaultValue: '장목 금지' })
      : pg('omokOverlineAllowed', { defaultValue: '장목 허용' });
    return {
      winGoal: pg('omokWin', { defaultValue: '가로·세로·대각 5목 먼저 완성' }),
      loseGoal: pg('omokLose', { defaultValue: '상대가 먼저 5목을 완성하면 패배' }),
      scoreFactors: pg('factorOmok', { defaultValue: '목(승부) — 집 계산 없음' }),
      timeRules: pgNone(),
      specialHighlights: [{ img: '/images/simbols/simbolp2.webp', text: pgJoin([f33, fo]) }],
      items: pgNone(),
      itemSlots: [],
    };
  }

  if (mode === GameMode.Ttamok) {
    const cap = settings.captureTarget ?? 5;
    const f33 = settings.has33Forbidden
      ? pg('omok33Forbidden', { defaultValue: '쌍삼 금지' })
      : pg('omok33Allowed', { defaultValue: '쌍삼 허용' });
    const fo = settings.hasOverlineForbidden
      ? pg('omokOverlineForbidden', { defaultValue: '장목 금지' })
      : pg('omokOverlineAllowed', { defaultValue: '장목 허용' });
    return {
      winGoal: pg('ttamokWin', {
        cap,
        defaultValue: `5목 선완성 또는 따내기 ${cap}점 선달성`,
      }),
      loseGoal: pg('ttamokLose', {
        cap,
        defaultValue: `상대가 먼저 5목을 완성하거나 따내기 ${cap}점을 먼저 달성하면 패배`,
      }),
      scoreFactors: pg('factorTtamok', { defaultValue: '목 승리 또는 따내기 점수' }),
      timeRules: pgNone(),
      specialHighlights: [
        { img: '/images/simbols/simbolp2.webp', text: pgJoin([f33, fo]) },
        {
          img: '/images/simbols/simbol2.webp',
          text: pg('ttamokHighlightCapture', {
            cap,
            defaultValue: `따내기 ${cap}점 선달성 시 승리`,
          }),
        },
      ],
      items: pgNone(),
      itemSlots: [],
    };
  }

  if (mode === GameMode.Dice) {
    const r = settings.diceGoRounds ?? 3;
    return {
      winGoal: pg('diceWin', {
        r,
        defaultValue: `${r}라운드 후 누적 점수가 높은 쪽 승리`,
      }),
      loseGoal: pg('diceLose', {
        r,
        defaultValue: `${r}라운드 종료 후 누적 점수가 낮으면 패배`,
      }),
      scoreFactors: pg('factorDice', {
        defaultValue: '라운드별 백돌 따내기 점수 · 마지막 따내기 보너스',
      }),
      timeRules: pgNone(),
      specialHighlights: [
        {
          img: '/images/simbols/simbolp1.webp',
          text: pg('diceHighlightRules', { defaultValue: '주사위 눈만큼 흑 착수 · 백은 활로에만 배치' }),
        },
      ],
      items: itemLine(settings, mode, mix),
      itemSlots: buildItemSlots(settings, GameMode.Dice, mix),
    };
  }

  if (mode === GameMode.Thief) {
    return {
      winGoal: pg('thiefWin', { defaultValue: '5턴×라운드 진행 후 총점이 높은 쪽 승리' }),
      loseGoal: pg('thiefLose', { defaultValue: '라운드 종료 후 총점이 낮으면 패배' }),
      scoreFactors: pg('factorThief', { defaultValue: '라운드별 획득 점수 합산' }),
      timeRules: pgNone(),
      specialHighlights: [
        {
          img: '/images/simbols/simbolp4.webp',
          text: pg('thiefHighlightRoles', { defaultValue: '도둑(흑)·경찰(백) 역할 교대' }),
        },
      ],
      items: pgNone(),
      itemSlots: [],
    };
  }

  if (mode === GameMode.Alkkagi) {
    return {
      winGoal: pg('alkkagiWin', { defaultValue: '상대 돌 모두 넉아웃' }),
      loseGoal: pg('alkkagiLose', { defaultValue: '내 돌 모두 넉아웃' }),
      scoreFactors: pg('factorAlkkagi', { defaultValue: '판 밖으로 나간 상대 돌 수' }),
      timeRules: pgNone(),
      specialHighlights: [
        {
          img: '/images/simbols/simbolp5.webp',
          text: pg('alkkagiHighlightGauge', { defaultValue: '게이지로 힘 조절 · 벽 반사' }),
        },
      ],
      items: itemLine(settings, mode, mix),
      itemSlots: buildItemSlots(settings, GameMode.Alkkagi, mix),
    };
  }

  if (mode === GameMode.Curling) {
    return {
      winGoal: pg('curlingWin', { defaultValue: '라운드 합산 점수가 높은 쪽 승리' }),
      loseGoal: pg('curlingLose', { defaultValue: '합산 점수가 낮으면 패배' }),
      scoreFactors: pg('factorCurling', { defaultValue: '하우스(목표)에 가까운 스톤 점수' }),
      timeRules: pgNone(),
      specialHighlights: [
        {
          img: '/images/simbols/simbolp6.webp',
          text: pg('curlingHighlightRules', { defaultValue: '스톤 미끄러뜨리기 · 라운드제' }),
        },
      ],
      items: itemLine(settings, mode, mix),
      itemSlots: buildItemSlots(settings, GameMode.Curling, mix),
    };
  }

  return {
    winGoal: pg('fallbackWin', { defaultValue: '대국 진행에 따라 승패 결정' }),
    loseGoal: pg('fallbackLose', { defaultValue: '대국 진행에 따라 패배가 결정되면 패배' }),
    scoreFactors: pg('factorFallback', { defaultValue: '모드 안내 참고' }),
    timeRules: pgNone(),
    specialHighlights: [],
    items: pgNone(),
    itemSlots: [],
  };
}

function getSinglePlayerStageSummary(
  session: LiveGameSession,
  stage: SinglePlayerStageInfo,
  towerLobbyInventory?: Array<{ name?: string; id?: string; quantity?: number; source?: string | null }>
): PreGameSummaryFour {
  const effectiveTargets = session.effectiveCaptureTargets;
  const blackTarget = effectiveTargets?.[Player.Black];
  const whiteTarget = effectiveTargets?.[Player.White];
  const isSurvivalRules = resolveSinglePlayerSurvivalModeForSession(session, stage);
  const isLegacyRuleInference = stage.strategicRulePreset == null || stage.strategicRulePreset === 'auto';
  const sessionMix = mixedList(session.settings);
  const sessionEm = effectiveModesForRules(session.mode, sessionMix);
  const isCaptureMode =
    !isSurvivalRules &&
    (session.mode === GameMode.Capture ||
      sessionEm.includes(GameMode.Capture) ||
      (isLegacyRuleInference && stage.blackTurnLimit !== undefined));
  const isSpeedMode = !isCaptureMode && !isSurvivalRules && stage.timeControl.type === 'fischer';

  /** 싱글/탑: 플레이어는 항상 흑 — 짧은 문구 + 유저(흑) 시점 */
  let winGoal = pg('spDefaultWin', { defaultValue: '스테이지 조건 충족 시 승리' });
  let loseGoal = pg('spDefaultLose', { defaultValue: '조건 미달 시 패배' });
  if (isSurvivalRules) {
    const settingsSurv = Number((session.settings as any)?.survivalTurns ?? 0);
    const survN =
      settingsSurv > 0 ? settingsSurv : resolveSinglePlayerSurvivalTurnCount(stage);
    const tgt = stage.targetScore.black;
    winGoal = pg('spSurvivalWin', {
      n: survN,
      tgt,
      defaultValue: `${survN}턴 내 백 ${tgt}점 미달성`,
    });
    loseGoal = pg('spSurvivalLose', {
      n: survN,
      tgt,
      defaultValue: `${survN}턴 내 백 ${tgt}점 달성`,
    });
  } else if (isCaptureMode) {
    if (stage.blackTurnLimit && typeof blackTarget === 'number' && blackTarget !== 999) {
      if (typeof whiteTarget === 'number' && whiteTarget !== 999) {
        winGoal = pg('spCaptureTurnWin', {
          limit: stage.blackTurnLimit,
          target: blackTarget,
          defaultValue: `${stage.blackTurnLimit}턴 내 ${blackTarget}점 획득`,
        });
        loseGoal = pg('spCaptureTurnLoseBoth', {
          limit: stage.blackTurnLimit,
          target: whiteTarget,
          defaultValue: `${stage.blackTurnLimit}턴 초과 / 백 ${whiteTarget}점 획득`,
        });
      } else {
        winGoal = pg('spCaptureTurnWin', {
          limit: stage.blackTurnLimit,
          target: blackTarget,
          defaultValue: `${stage.blackTurnLimit}턴 내 ${blackTarget}점 획득`,
        });
        loseGoal = pg('spCaptureTurnLoseMiss', {
          limit: stage.blackTurnLimit,
          defaultValue: `${stage.blackTurnLimit}턴 내 목표 미달`,
        });
      }
    } else if (typeof blackTarget === 'number' && blackTarget !== 999 && typeof whiteTarget === 'number' && whiteTarget !== 999) {
      winGoal = pg('spCaptureRaceWin', {
        target: blackTarget,
        defaultValue: `${blackTarget}점 먼저 획득`,
      });
      loseGoal = pg('spCaptureRaceLose', {
        target: whiteTarget,
        defaultValue: `백 ${whiteTarget}점 먼저 획득`,
      });
    } else if (typeof session.settings.captureTarget === 'number') {
      const cap = session.settings.captureTarget;
      winGoal = pg('spCaptureCapWin', {
        cap,
        defaultValue: `${cap}점 먼저 획득`,
      });
      loseGoal = pg('spCaptureCapLose', {
        cap,
        defaultValue: `백이 ${cap}점 먼저 획득`,
      });
    } else {
      winGoal = pg('spCaptureGoalWin', { defaultValue: '목표점수 달성' });
      loseGoal = pg('spCaptureGoalLose', { defaultValue: '백이 목표 먼저 달성' });
    }
  } else if (isSpeedMode) {
    winGoal = pg('spSpeedWin', { defaultValue: '계가 종합점수에서 승리' });
    loseGoal = pg('spSpeedLose', { defaultValue: '계가에서 패배' });
  } else if (
    stage.autoScoringTurns &&
    stage.autoScoringTurns > 0 &&
    usesTerritoryScoring(session.mode, sessionMix)
  ) {
    winGoal = pg('spAutoScoringWin', {
      n: stage.autoScoringTurns,
      defaultValue: `${stage.autoScoringTurns}수 계가 후 승리`,
    });
    loseGoal = pg('spAutoScoringLose', {
      n: stage.autoScoringTurns,
      defaultValue: `${stage.autoScoringTurns}수 계가 후 패배`,
    });
  } else if (isLegacyRuleInference && stage.blackTurnLimit && stage.targetScore.black > 0) {
    winGoal = pg('spLegacyTurnWin', {
      limit: stage.blackTurnLimit,
      target: stage.targetScore.black,
      defaultValue: `${stage.blackTurnLimit}턴 내 ${stage.targetScore.black}점 이상`,
    });
    loseGoal = pg('spLegacyTurnLose', {
      limit: stage.blackTurnLimit,
      defaultValue: `${stage.blackTurnLimit}턴 내 목표 미달`,
    });
  } else if (isLegacyRuleInference && stage.targetScore.black > 0 && stage.targetScore.white > 0) {
    winGoal = pg('spLegacyTerritoryWin', {
      black: stage.targetScore.black,
      white: stage.targetScore.white,
      defaultValue: `계가 흑 ${stage.targetScore.black}집+ · 백 ${stage.targetScore.white}집+`,
    });
    loseGoal = pg('spLegacyTerritoryLose', { defaultValue: '목표 집수 미달' });
  } else {
    winGoal = pg('spTerritoryWin', { defaultValue: '계가 시 집이 더 많으면 승' });
    loseGoal = pg('spTerritoryLose', { defaultValue: '계가에서 열세' });
  }

  let scoreFactors = pg('factorStageDefault', { defaultValue: '스테이지·모드에 따름' });
  if (isCaptureMode || isSurvivalRules) {
    const hasPatternStone =
      (stage.placements.blackPattern ?? 0) > 0 || (stage.placements.whitePattern ?? 0) > 0;
    scoreFactors = hasPatternStone
      ? pg('factorStageCapturePattern', { defaultValue: '따내기 점수\n문양돌 2점' })
      : pg('factorStageCapture', { defaultValue: '따내기 점수' });
  } else if (isSpeedMode) {
    scoreFactors = pg('factorStageSpeed', { defaultValue: '영토 · 따낸 돌 · 사석 · 덤\n시간 보너스' });
  } else if (session.mode === GameMode.Capture) {
    scoreFactors = pg('factorStageCapture', { defaultValue: '따내기 점수' });
  } else {
    scoreFactors = pgJoin([
      pg('factorTerritory', { defaultValue: '영토' }),
      pg('factorCaptured', { defaultValue: '따낸 돌' }),
      pg('factorDead', { defaultValue: '사석' }),
      pg('factorKomi', { defaultValue: '덤(백)' }),
    ], ' · ');
  }

  const towerOwned =
    session.gameCategory === 'tower' && towerLobbyInventory !== undefined
      ? countTowerLobbyItems(towerLobbyInventory)
      : null;

  const towerFloor = session.gameCategory === 'tower' ? getTowerSessionFloor(session) : 0;
  const showTowerTurnAdd = session.gameCategory === 'tower' && towerFloor >= 1 && towerFloor <= 20;
  const turnAddDisp = showTowerTurnAdd ? (towerOwned?.turnAdd ?? 0) : undefined;

  const itemBits: string[] = [];
  const mBase = towerOwned ? towerOwned.missile : (stage.missileCount ?? 0);
  const hBase = towerOwned ? towerOwned.hidden : (stage.hiddenCount ?? 0);
  const sBase = towerOwned ? towerOwned.scan : (stage.scanCount ?? 0);
  const mDisp = sessionEm.includes(GameMode.Missile) ? mBase : 0;
  const hDisp = sessionEm.includes(GameMode.Hidden) ? hBase : 0;
  const sDisp = sessionEm.includes(GameMode.Hidden) ? sBase : 0;
  if (typeof turnAddDisp === 'number' && turnAddDisp > 0) {
    itemBits.push(
      pg('highlightTurnAdd', {
        n: turnAddDisp,
        defaultValue: `턴 추가 ${turnAddDisp}개`,
      }),
    );
  }
  if (mDisp > 0) {
    itemBits.push(
      pg('itemMissile', {
        n: mDisp,
        defaultValue: `미사일 ${mDisp}개`,
      }),
    );
  }
  if (hDisp > 0) {
    itemBits.push(
      pg('itemHidden', {
        n: hDisp,
        defaultValue: `히든 ${hDisp}개`,
      }),
    );
  }
  if (sDisp > 0) {
    itemBits.push(
      pg('itemScan', {
        n: sDisp,
        defaultValue: `스캔 ${sDisp}개`,
      }),
    );
  }

  const specialHighlights = singlePlayerStageHighlights(session, stage, {
    missile: mDisp,
    hidden: hDisp,
    scan: sDisp,
    turnAdd: typeof turnAddDisp === 'number' ? turnAddDisp : undefined,
  });
  const stageRuleDisplay = {
    missile: mDisp,
    hidden: hDisp,
    scan: sDisp,
    turnAdd: typeof turnAddDisp === 'number' ? turnAddDisp : undefined,
  };
  const stageRuleFlags = { isSurvivalRules, isCaptureMode, isSpeedMode };

  return {
    winGoal,
    loseGoal,
    scoreFactors,
    timeRules: singlePlayerStageTimeRules(stage, isSpeedMode, session.settings),
    specialHighlights,
    goalVisuals: singlePlayerGoalVisuals(session, stage, stageRuleFlags),
    ruleGuides: singlePlayerRuleGuides(session, stage, stageRuleDisplay, stageRuleFlags),
    items: itemBits.length ? pgJoin(itemBits) : pgNone(),
    itemSlots: buildSinglePlayerStageItemSlots(stage, {
      session,
      towerOwned,
      towerShopOnZero: session.gameCategory === 'tower',
      towerSessionFloor: session.gameCategory === 'tower' ? towerFloor : undefined,
    }),
  };
}
