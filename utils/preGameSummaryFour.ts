import { LiveGameSession, GameMode, GameSettings, SinglePlayerStageInfo } from '../types.js';
import { Player } from '../types/enums.js';
import { getAdventureEncounterCountdownMinutes } from '../shared/utils/adventureBattleBoard.js';
import { countTowerLobbyItems, getTowerSessionFloor } from './towerPreGameDisplay.js';

export type PreGameSpecialHighlight = {
  img: string;
  text: string;
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
  /** 레거시·호환용 한 줄 텍스트 */
  items: string;
  itemSlots: PreGameItemSlot[];
};

const NONE = '없음';

const LOSE_TERRITORY = '계가(종합 점수)에서 집이 적거나, 동점·무승부 규칙에 따라 불리하면 패배';
const LOSE_TERRITORY_AUTO = (auto: string) => `${LOSE_TERRITORY} · ${auto}에 못 이기면 패배`;
const LOSE_CAPTURE_RACE = (t: number) =>
  `상대가 ${t}점을 먼저 따내면 패배 · 아니면 계가에서 집이 적으면 패배`;
const LOSE_MIX = '종료 시 따내기·계가 등에서 상대가 승리 조건을 먼저 충족하거나 불리하면 패배';

/** 바둑판 문양돌과 동일 스프라이트(`GoBoard` 흑 문양) — 게임 설명 모달 하이라이트 */
const PATTERN_STONE_HIGHLIGHT_IMG = '/images/single/BlackDouble.png';

function defaultBaseStoneCount(settings: GameSettings): number {
  return settings.baseStones ?? 4;
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
    return `${n}턴(수) 도달 시 자동 계가 진행`;
  }
  return `${n}수(턴) 후 자동 계가에서 승리하기`;
}

/** `autoScoringLine`과 짝 — 딱따로(표준·스피드·베이스 등) 자동 계가 시 패배 한 줄 */
function autoScoringLoseLine(settings: GameSettings, mode: GameMode, mix: GameMode[]): string | null {
  const n = settings.scoringTurnLimit;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  if (!usesTerritoryScoring(mode, mix)) return null;
  if (mode === GameMode.Capture || hasMix(mix, GameMode.Capture)) {
    return null;
  }
  return `${n}수(턴) 후 자동 계가에서 패배`;
}

function timeLine(settings: GameSettings, mode: GameMode, mix: GameMode[]): string {
  if ([GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Thief].includes(mode)) return NONE;
  if (
    mode === GameMode.Mix &&
    !hasMix(mix, GameMode.Speed) &&
    mix.every((x) => ![GameMode.Standard, GameMode.Base, GameMode.Hidden, GameMode.Missile, GameMode.Speed].includes(x))
  ) {
    return NONE;
  }
  const byoyomiCount = settings.byoyomiCount ?? 0;
  const byoyomiTime = settings.byoyomiTime ?? 30;
  if (!settings.timeLimit || settings.timeLimit <= 0) {
    if (byoyomiCount > 0 && byoyomiTime > 0) {
      return `초읽기만 · ${byoyomiTime}초×${byoyomiCount}회`;
    }
    return '시간 제한 없음';
  }
  if (mode === GameMode.Speed || hasMix(mix, GameMode.Speed)) {
    return `피셔 · 본전 ${settings.timeLimit}분 + ${settings.timeIncrement ?? 0}초/수`;
  }
  if (byoyomiCount > 0 && byoyomiTime > 0) {
    return `제한 ${settings.timeLimit}분 · 초읽기 ${byoyomiTime}초×${byoyomiCount}회`;
  }
  return `제한 ${settings.timeLimit}분 (초읽기 없음)`;
}

function territoryScoreParts(settings: GameSettings, mode: GameMode, mix: GameMode[]): string[] {
  const parts: string[] = ['영토', '따낸 돌', '사석', '덤(백)'];
  const em = effectiveModesForRules(mode, mix);
  if (em.includes(GameMode.Base)) parts.push('베이스 보너스');
  if (em.includes(GameMode.Hidden)) parts.push('히든 보너스');
  if (em.includes(GameMode.Speed)) parts.push('시간 보너스');
  if (em.includes(GameMode.Missile)) parts.push('미사일 연출 반영');
  return parts;
}

/** 모험 경기 안내 모달: 한 줄·짧은 토큰 (줄바꿈 최소화) */
function adventureScoreFactorsShort(mode: GameMode, mix: GameMode[]): string {
  if (mode === GameMode.Capture) {
    return '따내기 · 문양 2점';
  }
  const parts: string[] = ['기본 계가'];
  const em = effectiveModesForRules(mode, mix);
  if (em.includes(GameMode.Base)) parts.push('베이스돌 5점');
  if (em.includes(GameMode.Hidden)) parts.push('히든');
  if (em.includes(GameMode.Speed)) parts.push('시간');
  if (em.includes(GameMode.Missile)) parts.push('미사일');
  return parts.join(' · ');
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
    if (h > 0) chunks.push(`히든 ${h}개`);
    if (s > 0) chunks.push(`스캔 ${s}개`);
  }
  if (effectiveModes.includes(GameMode.Missile)) {
    const n = settings.missileCount ?? 0;
    if (n > 0) chunks.push(`미사일 ${n}개`);
  }
  if (effectiveModes.includes(GameMode.Dice)) {
    const o = settings.oddDiceCount ?? 0;
    const e = settings.evenDiceCount ?? 0;
    const l = settings.lowDiceCount ?? 0;
    const h = settings.highDiceCount ?? 0;
    if (o + e + l + h > 0) chunks.push(`주사위 아이템 홀${o}·짝${e}·저${l}·고${h}`);
  }
  if (effectiveModes.includes(GameMode.Alkkagi)) {
    const slow = settings.alkkagiSlowItemCount ?? 0;
    const aim = settings.alkkagiAimingLineItemCount ?? 0;
    if (slow > 0 || aim > 0) {
      chunks.push(`슬로우 ${slow} · 조준 ${aim}`);
    }
  }
  if (effectiveModes.includes(GameMode.Curling)) {
    const slow = settings.curlingSlowItemCount ?? 0;
    const aim = settings.curlingAimingLineItemCount ?? 0;
    if (slow > 0 || aim > 0) {
      chunks.push(`슬로우 ${slow} · 조준 ${aim}`);
    }
  }
  return chunks.length ? chunks.join(' · ') : NONE;
}

function buildItemSlots(settings: GameSettings, mode: GameMode, mix: GameMode[]): PreGameItemSlot[] {
  const slots: PreGameItemSlot[] = [];
  const effectiveModes = mode === GameMode.Mix ? mix : [mode];

  if (effectiveModes.includes(GameMode.Hidden)) {
    const h = settings.hiddenStoneCount ?? 0;
    const s = settings.scanCount ?? 0;
    if (h > 0) slots.push({ key: 'hidden', img: '/images/button/hidden.png', count: h, title: '히든 돌' });
    if (s > 0) slots.push({ key: 'scan', img: '/images/button/scan.png', count: s, title: '스캔' });
  }
  if (effectiveModes.includes(GameMode.Missile)) {
    const n = settings.missileCount ?? 0;
    if (n > 0) slots.push({ key: 'missile', img: '/images/button/missile.png', count: n, title: '미사일' });
  }
  if (effectiveModes.includes(GameMode.Dice)) {
    const o = settings.oddDiceCount ?? 0;
    const e = settings.evenDiceCount ?? 0;
    const l = settings.lowDiceCount ?? 0;
    const h = settings.highDiceCount ?? 0;
    const diceImg = '/images/simbols/simbolp1.png';
    if (o > 0) slots.push({ key: 'dice-odd', img: diceImg, count: o, title: '홀수 주사위 아이템' });
    if (e > 0) slots.push({ key: 'dice-even', img: diceImg, count: e, title: '짝수 주사위 아이템' });
    if (l > 0) slots.push({ key: 'dice-low', img: diceImg, count: l, title: '낮은 수(1~3) 주사위 아이템' });
    if (h > 0) slots.push({ key: 'dice-high', img: diceImg, count: h, title: '높은 수(4~6) 주사위 아이템' });
  }
  if (effectiveModes.includes(GameMode.Alkkagi)) {
    const slow = settings.alkkagiSlowItemCount ?? 0;
    const aim = settings.alkkagiAimingLineItemCount ?? 0;
    if (slow > 0) slots.push({ key: 'alk-slow', img: '/images/button/slow.png', count: slow, title: '슬로우' });
    if (aim > 0) slots.push({ key: 'alk-aim', img: '/images/button/target.png', count: aim, title: '조준선' });
  }
  if (effectiveModes.includes(GameMode.Curling)) {
    const slow = settings.curlingSlowItemCount ?? 0;
    const aim = settings.curlingAimingLineItemCount ?? 0;
    if (slow > 0) slots.push({ key: 'curl-slow', img: '/images/button/slow.png', count: slow, title: '슬로우' });
    if (aim > 0) slots.push({ key: 'curl-aim', img: '/images/button/target.png', count: aim, title: '조준선' });
  }
  return slots;
}

function buildSinglePlayerStageItemSlots(
  stage: SinglePlayerStageInfo,
  opts?: {
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

  if (showTurnAddSlot) {
    slots.push({
      key: 'turn-add',
      img: '/images/button/addturn.png',
      count: owned ? owned.turnAdd : 0,
      title: '턴 추가',
      inventoryBadgeMode: true,
      towerShopOnZero: shopZero,
    });
  }
  if (sm > 0) {
    slots.push({
      key: 'missile',
      img: '/images/button/missile.png',
      count: owned ? owned.missile : sm,
      title: '미사일',
      inventoryBadgeMode: !!owned,
      towerShopOnZero: shopZero,
    });
  }
  if (sh > 0) {
    slots.push({
      key: 'hidden',
      img: '/images/button/hidden.png',
      count: owned ? owned.hidden : sh,
      title: '히든 돌',
      inventoryBadgeMode: !!owned,
      towerShopOnZero: shopZero,
    });
  }
  if (ss > 0) {
    slots.push({
      key: 'scan',
      img: '/images/button/scan.png',
      count: owned ? owned.scan : ss,
      title: '스캔',
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
    const base = `따내기 ${t}점 선달성 시 즉시 승리 · 미달성 시 계가 후 집 비교`;
    return auto ? `${base} · ${auto}` : base;
  }
  if (auto) {
    return `${auto} — 집이 많은 쪽 승리`;
  }
  return tail.length ? `조합(${tail.join(', ')}) — 종료 시 규칙에 따라 승패 결정` : '종료 시 규칙에 따라 승패 결정';
}

function mixScoreFactors(settings: GameSettings, mix: GameMode[]): string {
  const parts: string[] = [];
  if (hasMix(mix, GameMode.Capture)) parts.push('따내기 점수');
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
  return dedup.length ? dedup.join(' · ') : '모드 조합에 따름';
}

function mixSpecialHighlights(
  settings: GameSettings,
  mix: GameMode[],
  includeFischerGuide: boolean = true
): PreGameSpecialHighlight[] {
  const h: PreGameSpecialHighlight[] = [];
  const bs = defaultBaseStoneCount(settings);
  if (hasMix(mix, GameMode.Capture)) {
    h.push({ img: PATTERN_STONE_HIGHLIGHT_IMG, text: '문양돌 따내기 2점' });
  }
  if (hasMix(mix, GameMode.Base)) {
    h.push({
      img: '/images/simbols/simbol4.png',
      text: `비밀 베이스돌 최대 ${bs}개 · 공개 후 덤/색 입찰 · 계가 보너스`,
    });
  }
  if (hasMix(mix, GameMode.Hidden)) {
    h.push({ img: '/images/button/hidden.png', text: '히든 착수 · 스캔으로 탐색' });
  }
  if (hasMix(mix, GameMode.Missile)) {
    h.push({ img: '/images/button/missile.png', text: '미사일로 돌 직선 이동' });
  }
  if (hasMix(mix, GameMode.Speed) && includeFischerGuide) {
    h.push({ img: '/images/icon/timer.png', text: '피셔 시계 · 착수당 시간 가산 · 계가 시 시간 보너스' });
  }
  const auto = autoScoringLine(settings, GameMode.Mix, mix);
  if (auto) {
    h.push({ img: '/images/simbols/simbol7.png', text: auto });
  }
  return h;
}

function singlePlayerStageTimeRules(stage: SinglePlayerStageInfo): string {
  const tc = stage.timeControl;
  /** 싱글/탑 비스피드: 서버에서 제한시간·초읽기 미적용 — 스테이지 JSON의 분/초읽기는 표시하지 않음 */
  if (tc.type === 'fischer') {
    return `피셔 · 본전 ${tc.mainTime}분 + ${tc.increment ?? 0}초/수`;
  }
  return '제한없음';
}

function singlePlayerStageHighlights(
  session: LiveGameSession,
  stage: SinglePlayerStageInfo,
  /** 미사일·히든·스캔·턴 추가 표시용 개수(싱글: 스테이지, 탑: 가방 보유 / 탑 1~20만 turnAdd) */
  disp: { missile: number; hidden: number; scan: number; turnAdd?: number }
): PreGameSpecialHighlight[] {
  const h: PreGameSpecialHighlight[] = [];
  const isCaptureMode = stage.blackTurnLimit !== undefined || session.mode === GameMode.Capture;
  const bs = defaultBaseStoneCount(session.settings);

  if ((stage.placements.blackPattern > 0 || stage.placements.whitePattern > 0) && isCaptureMode) {
    h.push({ img: PATTERN_STONE_HIGHLIGHT_IMG, text: '문양돌 따내기 2점' });
  }
  if (session.mode === GameMode.Base) {
    h.push({
      img: '/images/simbols/simbol4.png',
      text: `비밀 베이스돌 최대 ${bs}개 · 공개 시 계가 보너스`,
    });
  }
  if (stage.survivalTurns) {
    h.push({
      img: '/images/simbols/simbol1.png',
      text: `살리기 바둑 · 백 ${stage.survivalTurns}턴 내 목표 점수`,
    });
  }
  if (stage.autoScoringTurns && stage.autoScoringTurns > 0) {
    h.push({ img: '/images/simbols/simbol7.png', text: `${stage.autoScoringTurns}수 후 자동 계가` });
  }
  if (stage.blackTurnLimit) {
    h.push({ img: '/images/icon/timer.png', text: `흑 ${stage.blackTurnLimit}턴 제한` });
  }
  const missileN = disp.missile;
  const hiddenN = disp.hidden;
  const scanN = disp.scan;
  const turnAddN = disp.turnAdd;
  if (typeof turnAddN === 'number' && turnAddN > 0) {
    h.push({ img: '/images/button/addturn.png', text: `턴 추가 ${turnAddN}개` });
  }
  if (missileN > 0) {
    h.push({ img: '/images/button/missile.png', text: `미사일 ${missileN}개` });
  }
  if (hiddenN > 0 || scanN > 0) {
    h.push({
      img: '/images/button/hidden.png',
      text: `히든 ${hiddenN}개 · 스캔 ${scanN}개`,
    });
  }
  return h;
}

function buildAdventurePreGameSummary(session: LiveGameSession): PreGameSummaryFour {
  const { mode, settings } = session;
  const mix = mixedList(settings);
  const bs = settings.boardSize ?? session.adventureBoardSize ?? 9;
  const mins = getAdventureEncounterCountdownMinutes(bs);
  const timeRules = `${mins}분 제한`;

  if (mode === GameMode.Capture) {
    return {
      winGoal: '따내기 승리',
      loseGoal: '따내기 패배 · 시간 초과',
      scoreFactors: adventureScoreFactorsShort(mode, mix),
      timeRules,
      specialHighlights: [],
      items: itemLine(settings, mode, mix),
      itemSlots: buildItemSlots(settings, mode, mix),
    };
  }

  const limit = settings.scoringTurnLimit;
  const hasAuto = typeof limit === 'number' && limit > 0;
  const winGoal = hasAuto ? `계가 승리 · ${limit}수 자동` : '계가 승리';
  const loseGoal = '계가 패배 · 시간 초과';
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
  const bs = defaultBaseStoneCount(settings);

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
        winGoal: hasAuto ? `${cap}점 선취 또는 ${limit}턴 계가 승` : `${cap}점 먼저 따내면 승리`,
        loseGoal: `상대 ${cap}점 선취`,
      };
    }
    return {
      ...base,
      winGoal: hasAuto ? `계가 집 다수 승 · ${limit}수 자동 계가` : '계가에서 집이 많으면 승리',
      loseGoal: '계가 열세 · 시간 초과',
    };
  }

  if (mode === GameMode.Mix) {
    return {
      winGoal: mixWinGoal(settings, mix),
      loseGoal: LOSE_MIX,
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
      winGoal: auto ? `상대 돌 ${t}점 먼저 따내기 · ${auto}` : `상대 돌 ${t}점 먼저 따내기`,
      loseGoal: LOSE_CAPTURE_RACE(t),
      scoreFactors: '따내기 점수(집 계산 없음)',
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: [{ img: PATTERN_STONE_HIGHLIGHT_IMG, text: '문양돌 따내기 2점' }],
      items: NONE,
      itemSlots: [],
    };
  }

  if (mode === GameMode.Speed) {
    const auto = autoScoringLine(settings, mode, mix);
    const autoLose = autoScoringLoseLine(settings, mode, mix);
    return {
      winGoal: auto ?? '계가 후 종합 점수가 높은 쪽 승리',
      loseGoal: autoLose ?? (auto ? LOSE_TERRITORY_AUTO(auto) : '계가 후 종합 점수가 낮으면 패배'),
      scoreFactors: territoryScoreParts(settings, mode, mix).join(' · '),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: session.isAiGame
        ? []
        : [{ img: '/images/icon/timer.png', text: '피셔 시계 · 사용 시간에 따른 계가 시간 보너스' }],
      items: NONE,
      itemSlots: [],
    };
  }

  if (mode === GameMode.Base) {
    const auto = autoScoringLine(settings, mode, mix);
    const autoLose = autoScoringLoseLine(settings, mode, mix);
    return {
      winGoal: auto ?? '계가 후 집이 많은 쪽 승리',
      loseGoal: autoLose ?? (auto ? LOSE_TERRITORY_AUTO(auto) : LOSE_TERRITORY),
      scoreFactors: territoryScoreParts(settings, mode, mix).join(' · '),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: [
        {
          img: '/images/simbols/simbol4.png',
          text: `비밀 베이스돌 최대 ${bs}개 · 공개 후 덤/색 입찰 · 계가 보너스`,
        },
      ],
      items: NONE,
      itemSlots: [],
    };
  }

  if (mode === GameMode.Hidden) {
    const auto = autoScoringLine(settings, mode, mix);
    const autoLose = autoScoringLoseLine(settings, mode, mix);
    return {
      winGoal: auto ?? '계가 후 집이 많은 쪽 승리',
      loseGoal: autoLose ?? (auto ? LOSE_TERRITORY_AUTO(auto) : LOSE_TERRITORY),
      scoreFactors: territoryScoreParts(settings, mode, mix).join(' · '),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: [{ img: '/images/button/hidden.png', text: '히든 착수 · 스캔으로 탐색' }],
      items: itemLine(settings, mode, mix),
      itemSlots: buildItemSlots(settings, GameMode.Hidden, mix),
    };
  }

  if (mode === GameMode.Missile) {
    const auto = autoScoringLine(settings, mode, mix);
    const autoLose = autoScoringLoseLine(settings, mode, mix);
    return {
      winGoal: auto ?? '계가 후 집이 많은 쪽 승리',
      loseGoal: autoLose ?? (auto ? LOSE_TERRITORY_AUTO(auto) : LOSE_TERRITORY),
      scoreFactors: territoryScoreParts(settings, mode, mix).join(' · '),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: [{ img: '/images/button/missile.png', text: '미사일로 돌 직선 이동' }],
      items: itemLine(settings, mode, mix),
      itemSlots: buildItemSlots(settings, GameMode.Missile, mix),
    };
  }

  if (mode === GameMode.Standard) {
    const auto = autoScoringLine(settings, mode, mix);
    const autoLose = autoScoringLoseLine(settings, mode, mix);
    return {
      winGoal: auto ?? '계가 후 집이 많은 쪽 승리',
      loseGoal: autoLose ?? (auto ? LOSE_TERRITORY_AUTO(auto) : LOSE_TERRITORY),
      scoreFactors: territoryScoreParts(settings, mode, mix).join(' · '),
      timeRules: timeLine(settings, mode, mix),
      specialHighlights: auto ? [{ img: '/images/simbols/simbol7.png', text: auto }] : [],
      items: NONE,
      itemSlots: [],
    };
  }

  if (mode === GameMode.Omok) {
    const f33 = settings.has33Forbidden ? '쌍삼 금지' : '쌍삼 허용';
    const fo = settings.hasOverlineForbidden ? '장목 금지' : '장목 허용';
    return {
      winGoal: '가로·세로·대각 5목 먼저 완성',
      loseGoal: '상대가 먼저 5목을 완성하면 패배',
      scoreFactors: '목(승부) — 집 계산 없음',
      timeRules: NONE,
      specialHighlights: [{ img: '/images/simbols/simbolp2.png', text: `${f33} · ${fo}` }],
      items: NONE,
      itemSlots: [],
    };
  }

  if (mode === GameMode.Ttamok) {
    const cap = settings.captureTarget ?? 5;
    const f33 = settings.has33Forbidden ? '쌍삼 금지' : '쌍삼 허용';
    const fo = settings.hasOverlineForbidden ? '장목 금지' : '장목 허용';
    return {
      winGoal: `5목 선완성 또는 따내기 ${cap}점 선달성`,
      loseGoal: `상대가 먼저 5목을 완성하거나 따내기 ${cap}점을 먼저 달성하면 패배`,
      scoreFactors: '목 승리 또는 따내기 점수',
      timeRules: NONE,
      specialHighlights: [
        { img: '/images/simbols/simbolp2.png', text: `${f33} · ${fo}` },
        { img: '/images/simbols/simbol2.png', text: `따내기 ${cap}점 선달성 시 승리` },
      ],
      items: NONE,
      itemSlots: [],
    };
  }

  if (mode === GameMode.Dice) {
    const r = settings.diceGoRounds ?? 3;
    return {
      winGoal: `${r}라운드 후 누적 점수가 높은 쪽 승리`,
      loseGoal: `${r}라운드 종료 후 누적 점수가 낮으면 패배`,
      scoreFactors: '라운드별 백돌 따내기 점수 · 마지막 따내기 보너스',
      timeRules: NONE,
      specialHighlights: [{ img: '/images/simbols/simbolp1.png', text: '주사위 눈만큼 흑 착수 · 백은 활로에만 배치' }],
      items: itemLine(settings, mode, mix),
      itemSlots: buildItemSlots(settings, GameMode.Dice, mix),
    };
  }

  if (mode === GameMode.Thief) {
    return {
      winGoal: '5턴×라운드 진행 후 총점이 높은 쪽 승리',
      loseGoal: '라운드 종료 후 총점이 낮으면 패배',
      scoreFactors: '라운드별 획득 점수 합산',
      timeRules: NONE,
      specialHighlights: [{ img: '/images/simbols/simbolp4.png', text: '도둑(흑)·경찰(백) 역할 교대' }],
      items: NONE,
      itemSlots: [],
    };
  }

  if (mode === GameMode.Alkkagi) {
    return {
      winGoal: '라운드별로 상대 돌을 판 밖으로 더 많이 밀어낸 쪽 승',
      loseGoal: '라운드에서 상대보다 적게 밀어내면 패배',
      scoreFactors: '판 밖으로 나간 상대 돌 수',
      timeRules: NONE,
      specialHighlights: [{ img: '/images/simbols/simbolp5.png', text: '게이지로 힘 조절 · 벽 반사' }],
      items: itemLine(settings, mode, mix),
      itemSlots: buildItemSlots(settings, GameMode.Alkkagi, mix),
    };
  }

  if (mode === GameMode.Curling) {
    return {
      winGoal: '라운드 합산 점수가 높은 쪽 승리',
      loseGoal: '합산 점수가 낮으면 패배',
      scoreFactors: '하우스(목표)에 가까운 스톤 점수',
      timeRules: NONE,
      specialHighlights: [{ img: '/images/simbols/simbolp6.png', text: '스톤 미끄러뜨리기 · 라운드제' }],
      items: itemLine(settings, mode, mix),
      itemSlots: buildItemSlots(settings, GameMode.Curling, mix),
    };
  }

  return {
    winGoal: '대국 진행에 따라 승패 결정',
    loseGoal: '대국 진행에 따라 패배가 결정되면 패배',
    scoreFactors: '모드 안내 참고',
    timeRules: NONE,
    specialHighlights: [],
    items: NONE,
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
  const isCaptureMode = stage.blackTurnLimit !== undefined || session.mode === GameMode.Capture;
  const isSpeedMode = !isCaptureMode && stage.timeControl.type === 'fischer';

  /** 싱글/탑: 플레이어는 항상 흑 — 짧은 문구 + 유저(흑) 시점 */
  let winGoal = '스테이지 조건 충족 시 승리';
  let loseGoal = '조건 미달 시 패배';
  if (stage.survivalTurns) {
    const tgt = stage.targetScore.black;
    winGoal = `${stage.survivalTurns}턴 내 백 ${tgt}점 미달성`;
    loseGoal = `${stage.survivalTurns}턴 내 백 ${tgt}점 달성`;
  } else if (isCaptureMode) {
    if (stage.blackTurnLimit && typeof blackTarget === 'number' && blackTarget !== 999) {
      if (typeof whiteTarget === 'number' && whiteTarget !== 999) {
        winGoal = `${stage.blackTurnLimit}턴 내 ${blackTarget}점 획득`;
        loseGoal = `${stage.blackTurnLimit}턴 초과 / 백 ${whiteTarget}점 획득`;
      } else {
        winGoal = `${stage.blackTurnLimit}턴 내 ${blackTarget}점 획득`;
        loseGoal = `${stage.blackTurnLimit}턴 내 목표 미달`;
      }
    } else if (typeof blackTarget === 'number' && blackTarget !== 999 && typeof whiteTarget === 'number' && whiteTarget !== 999) {
      winGoal = `${blackTarget}점 먼저 획득`;
      loseGoal = `백 ${whiteTarget}점 먼저 획득`;
    } else if (typeof session.settings.captureTarget === 'number') {
      const cap = session.settings.captureTarget;
      winGoal = `${cap}점 먼저 획득`;
      loseGoal = `백이 ${cap}점 먼저 획득`;
    } else {
      winGoal = '따내기 목표 달성';
      loseGoal = '백이 목표 먼저 달성';
    }
  } else if (isSpeedMode) {
    winGoal = '계가 종합점수에서 승리';
    loseGoal = '계가에서 패배';
  } else if (stage.autoScoringTurns && stage.autoScoringTurns > 0) {
    winGoal = `${stage.autoScoringTurns}수 계가 후 승리`;
    loseGoal = `${stage.autoScoringTurns}수 계가 후 패배`;
  } else if (stage.blackTurnLimit && stage.targetScore.black > 0) {
    winGoal = `${stage.blackTurnLimit}턴 내 ${stage.targetScore.black}점 이상`;
    loseGoal = `${stage.blackTurnLimit}턴 내 목표 미달`;
  } else if (stage.targetScore.black > 0 && stage.targetScore.white > 0) {
    winGoal = `계가 흑 ${stage.targetScore.black}집+ · 백 ${stage.targetScore.white}집+`;
    loseGoal = '목표 집수 미달';
  } else {
    winGoal = '계가 시 집이 더 많으면 승';
    loseGoal = '계가에서 열세';
  }

  let scoreFactors = '스테이지·모드에 따름';
  if (isCaptureMode) {
    const hasPatternStone =
      (stage.placements.blackPattern ?? 0) > 0 || (stage.placements.whitePattern ?? 0) > 0;
    scoreFactors = hasPatternStone ? '따내기 점수\n문양돌 2점' : '따내기 점수';
  } else if (isSpeedMode) {
    scoreFactors = '영토 · 따낸 돌 · 사석 · 덤\n시간 보너스';
  } else if (session.mode === GameMode.Capture) {
    scoreFactors = '따내기 점수';
  } else {
    scoreFactors = '영토 · 따낸 돌 · 사석 · 덤(백)';
  }

  const towerOwned =
    session.gameCategory === 'tower' && towerLobbyInventory !== undefined
      ? countTowerLobbyItems(towerLobbyInventory)
      : null;

  const towerFloor = session.gameCategory === 'tower' ? getTowerSessionFloor(session) : 0;
  const showTowerTurnAdd = session.gameCategory === 'tower' && towerFloor >= 1 && towerFloor <= 20;
  const turnAddDisp = showTowerTurnAdd ? (towerOwned?.turnAdd ?? 0) : undefined;

  const itemBits: string[] = [];
  const mDisp = towerOwned ? towerOwned.missile : (stage.missileCount ?? 0);
  const hDisp = towerOwned ? towerOwned.hidden : (stage.hiddenCount ?? 0);
  const sDisp = towerOwned ? towerOwned.scan : (stage.scanCount ?? 0);
  if (typeof turnAddDisp === 'number' && turnAddDisp > 0) itemBits.push(`턴 추가 ${turnAddDisp}개`);
  if (mDisp > 0) itemBits.push(`미사일 ${mDisp}개`);
  if (hDisp > 0) itemBits.push(`히든 ${hDisp}개`);
  if (sDisp > 0) itemBits.push(`스캔 ${sDisp}개`);

  const specialHighlights = singlePlayerStageHighlights(session, stage, {
    missile: mDisp,
    hidden: hDisp,
    scan: sDisp,
    turnAdd: typeof turnAddDisp === 'number' ? turnAddDisp : undefined,
  });

  return {
    winGoal,
    loseGoal,
    scoreFactors,
    timeRules: singlePlayerStageTimeRules(stage),
    specialHighlights,
    items: itemBits.length ? itemBits.join(' · ') : NONE,
    itemSlots: buildSinglePlayerStageItemSlots(stage, {
      towerOwned,
      towerShopOnZero: session.gameCategory === 'tower',
      towerSessionFloor: session.gameCategory === 'tower' ? towerFloor : undefined,
    }),
  };
}
