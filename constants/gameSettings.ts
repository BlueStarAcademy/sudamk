import { GameMode, DiceGoVariant, GameSettings, Player, AlkkagiPlacementType, AlkkagiLayoutType, ItemGrade } from '../types/index.js';
import { SPEED_PER_MOVE_SECONDS } from '../shared/constants/speedTimePressure.js';

// --- Negotiation Settings ---
export const BOARD_SIZES = [19, 13, 9];
export const OMOK_BOARD_SIZES = [19, 15];
export const CAPTURE_BOARD_SIZES = [13, 11, 9, 7];
export const SPEED_BOARD_SIZES = [7, 9, 11, 13, 19];
export const HIDDEN_BOARD_SIZES = [19, 13, 11, 9, 7];
export const THIEF_BOARD_SIZES = [9, 13, 19];
/** 도둑 1턴 + 경찰 1턴 = 1라운드(밤). 역할이 고정된 한 세그먼트당 총 라운드 수 (서버 THIEF_NIGHTS_PER_ROUND와 동일) */
export const THIEF_NIGHTS_PER_SEGMENT = 5;
export const MISSILE_BOARD_SIZES = [19, 13, 9];
export const STRATEGIC_CLASSIC_SPEED_BOARD_SIZES = [9, 13, 19] as const;
export const STRATEGIC_SPECIAL_BOARD_SIZES = [9, 11, 13] as const;
export const CASTLE_BOARD_SIZES = [9, 13] as const;
export const CHESS_BOARD_SIZES = [13] as const;
export type CastleCount = 1 | 2 | 3 | 4 | 5 | 6;
export const CASTLE_COUNTS_BY_BOARD_SIZE: Record<9 | 13, readonly CastleCount[]> = {
  9: [1, 2, 3],
  13: [3, 4, 5, 6],
};
/** @deprecated 보드 크기별 {@link getCastleCountsByBoardSize} 사용 */
export const CASTLE_COUNTS = [1, 2, 3, 4, 5, 6] as const;

export function getCastleCountsByBoardSize(boardSize: number): readonly CastleCount[] {
  if (boardSize === 9) return CASTLE_COUNTS_BY_BOARD_SIZE[9];
  if (boardSize === 13) return CASTLE_COUNTS_BY_BOARD_SIZE[13];
  return CASTLE_COUNTS_BY_BOARD_SIZE[13];
}

export function getDefaultCastleCountByBoardSize(boardSize: number): CastleCount {
  return boardSize === 9 ? 1 : 3;
}

export function getDefaultChessKomiByBoardSize(boardSize: number): number {
  if (boardSize === 13) return 6.5;
  return DEFAULT_KOMI;
}

export function getDefaultChessScoringTurnLimit(): number {
  return 100;
}

export function getDefaultCastleKomiByBoardSize(boardSize: number): number {
  if (boardSize === 9) return 2.5;
  if (boardSize === 13) return 6.5;
  return DEFAULT_KOMI;
}

export function clampCastleCount(value: unknown, boardSize?: number): CastleCount {
  const options = getCastleCountsByBoardSize(boardSize ?? 13);
  const n = typeof value === 'number' ? value : parseInt(String(value ?? options[0]), 10);
  if (!Number.isFinite(n)) return options[0]!;
  for (let i = options.length - 1; i >= 0; i--) {
    if (n >= options[i]!) return options[i]!;
  }
  return options[0]!;
}

export const getStrategicBoardSizesByMode = (mode: GameMode): readonly number[] => {
  if (mode === GameMode.Castle) return CASTLE_BOARD_SIZES;
  if (mode === GameMode.Chess) return CHESS_BOARD_SIZES;
  if (mode === GameMode.Standard || mode === GameMode.Speed || mode === GameMode.Uniform) return STRATEGIC_CLASSIC_SPEED_BOARD_SIZES;
  if (
    mode === GameMode.Capture ||
    mode === GameMode.Base ||
    mode === GameMode.Hidden ||
    mode === GameMode.Missile ||
    mode === GameMode.Mix
  ) {
    return STRATEGIC_SPECIAL_BOARD_SIZES;
  }
  return BOARD_SIZES;
};

export const getScoringTurnLimitOptionsByBoardSize = (boardSize: number): readonly number[] => {
  switch (boardSize) {
    case 7:
      return [0, 30, 40, 50];
    case 9:
      return [0, 40, 50, 60, 70, 80];
    case 11:
      return [0, 50, 60, 70, 80, 90, 100];
    case 13:
      return [0, 60, 70, 80, 90, 100, 110, 120];
    case 19:
      return [0, 100, 120, 140, 160, 180, 200];
    default:
      return [0];
  }
};

export const getAiScoringTurnLimitByBoardSize = (boardSize: number): number => {
  switch (boardSize) {
    case 7:
      return 30;
    case 9:
      return 50;
    case 11:
      return 60;
    case 13:
      return 80;
    case 19:
      return 200;
    default:
      return Math.max(1, Math.ceil(boardSize * boardSize * 0.7));
  }
};
export const CAPTURE_TARGETS = [5, 10, 15, 20, 25, 30];
export const CAPTURE_BID_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const TTAMOK_CAPTURE_TARGETS = [10, 20, 30];
export const HIDDEN_STONE_COUNTS = [1, 2, 3];
export const SCAN_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const MISSILE_COUNTS = Array.from({ length: 15 }, (_, i) => i + 1);
export const TIME_LIMITS = [ // in minutes
  { value: 0, label: '없음' },
  { value: 5, label: '5분' },
  { value: 10, label: '10분' },
  { value: 15, label: '15분' },
  { value: 20, label: '20분' },
  { value: 30, label: '30분' },
  { value: 40, label: '40분' },
  { value: 50, label: '50분' },
  { value: 60, label: '1시간' },
  { value: 120, label: '2시간' },
  { value: 180, label: '3시간' },
];
export const SPEED_TIME_LIMITS = [ // in minutes
  { value: 1, label: '1분' },
  { value: 3, label: '3분' },
  { value: 5, label: '5분' },
  { value: 10, label: '10분' },
  { value: 20, label: '20분' },
  { value: 30, label: '30분' },
];
export const BYOYOMI_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const BYOYOMI_TIMES = [10, 20, 30, 40, 50, 60]; // in seconds
export const BASE_STONE_COUNTS = [3, 4, 5, 6, 7, 8, 9, 10];
export const DEFAULT_KOMI = 6.5;
export const FISCHER_INCREMENT_SECONDS = 5;
/** 피셔 방식 메인 제한시간 최소값(분). '없음'(0) 불가 */
export const FISCHER_MIN_TIME_LIMIT_MINUTES = 1;
/** 스피드 바둑·믹스(스피드 포함) 피셔 추가초 선택지 */
export const FISCHER_INCREMENT_SECONDS_OPTIONS = [3, 5, 10, 15, 20, 30] as const;

export function normalizeFischerIncrementSeconds(value: number | undefined): number {
  if (
    typeof value === 'number' &&
    (FISCHER_INCREMENT_SECONDS_OPTIONS as readonly number[]).includes(value)
  ) {
    return value;
  }
  return FISCHER_INCREMENT_SECONDS;
}

export type MainTimeControlStyle = 'byoyomi' | 'fischer';

export function resolveTimeControlStyle(
  settings: Pick<GameSettings, 'timeIncrement'>,
): MainTimeControlStyle {
  return (settings.timeIncrement ?? 0) > 0 ? 'fischer' : 'byoyomi';
}

/** 메인 시계: 초읽기 방식 (수당 10초 오버레이와 별개) */
export function applyByoyomiTimeControl(settings: GameSettings): GameSettings {
  return {
    ...settings,
    timeIncrement: 0,
    byoyomiTime: BYOYOMI_TIMES.includes(settings.byoyomiTime) ? settings.byoyomiTime : 30,
    byoyomiCount: BYOYOMI_COUNTS.includes(settings.byoyomiCount) ? settings.byoyomiCount : 3,
  };
}

/** 피셔 방식 제한시간 선택지 ('없음' 제외, 비스피드는 1분 포함) */
export function getFischerTimeLimitOptions(isSpeed = false): ReadonlyArray<{ value: number; label: string }> {
  const min = FISCHER_MIN_TIME_LIMIT_MINUTES;
  if (isSpeed) {
    return SPEED_TIME_LIMITS.filter((t) => t.value >= min);
  }
  const filtered = TIME_LIMITS.filter((t) => t.value >= min);
  if (filtered.some((t) => t.value === min)) {
    return filtered;
  }
  return [{ value: min, label: `${min}분` }, ...filtered];
}

export function normalizeFischerTimeLimitMinutes(value: number | undefined, isSpeed = false): number {
  const options = getFischerTimeLimitOptions(isSpeed);
  const min = FISCHER_MIN_TIME_LIMIT_MINUTES;
  const raw = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  if (raw < min) {
    return min;
  }
  const allowed = options.map((t) => t.value);
  if (allowed.includes(raw)) {
    return raw;
  }
  return allowed[0] ?? min;
}

/** 메인 시계: 피셔 방식 */
export function applyFischerTimeControl(settings: GameSettings, isSpeed = false): GameSettings {
  return {
    ...settings,
    byoyomiTime: 0,
    byoyomiCount: 0,
    timeLimit: normalizeFischerTimeLimitMinutes(settings.timeLimit, isSpeed),
    timeIncrement: normalizeFischerIncrementSeconds(settings.timeIncrement),
  };
}

/** 비스피드·스피드 공통: 메인 byoyomi/fischer 상호 배타 정규화 */
export function normalizeMainTimeControl(settings: GameSettings, isSpeed = false): GameSettings {
  if (resolveTimeControlStyle(settings) === 'fischer') {
    return applyFischerTimeControl(settings, isSpeed);
  }
  return applyByoyomiTimeControl(settings);
}

/**
 * 스피드: 사용자 메인 byoyomi/fischer 유지. 수당 10초는 SPEED_PER_MOVE_SECONDS 상수로 처리.
 * @deprecated 레거시 호환 — {@link normalizeSpeedMainTimeControl} 사용
 */
export function applySpeedByoyomiDefaults(settings: GameSettings): GameSettings {
  return normalizeSpeedMainTimeControl(settings);
}

/** 스피드 메인 시계만 정규화 (byoyomiTime을 10으로 덮어쓰지 않음) */
export function normalizeSpeedMainTimeControl(settings: GameSettings): GameSettings {
  return normalizeMainTimeControl(settings, true);
}

/** @deprecated {@link applySpeedByoyomiDefaults} */
export function applySpeedFischerDefaults(settings: GameSettings): GameSettings {
  return applySpeedByoyomiDefaults(settings);
}
export const DICE_GO_ITEM_COUNTS = [0, 1, 2, 3, 4, 5];
export const ALKKAGI_ITEM_COUNTS = [0, 1, 2, 3];
export const ALKKAGI_ROUNDS = [1, 2, 3] as const;
export const CURLING_ROUNDS = [1, 2, 3] as const;
export const CURLING_ITEM_COUNTS = [0, 1, 2, 3, 4, 5];

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  boardSize: 19,
  timeLimit: 10,
  byoyomiCount: 3,
  byoyomiTime: 30,
  baseStones: 4,
  diceGoVariant: DiceGoVariant.Basic,
  diceGoRounds: 3,
  oddDiceCount: 1,
  evenDiceCount: 1,
  lowDiceCount: 1,
  highDiceCount: 1,
  thiefHigh36ItemCount: 1,
  thiefNoOneItemCount: 1,
  captureTarget: 20,
  timeIncrement: 5,
  hiddenStoneCount: 2,
  scanCount: 5,
  missileCount: 5,
  mixedModes: [GameMode.Hidden, GameMode.Speed],
  hasOverlineForbidden: true,
  has33Forbidden: true,
  alkkagiPlacementType: AlkkagiPlacementType.TurnByTurn,
  alkkagiLayout: AlkkagiLayoutType.Normal,
  alkkagiStoneCount: 5,
  alkkagiGaugeSpeed: 700,
  alkkagiSlowItemCount: 2,
  alkkagiAimingLineItemCount: 2,
  alkkagiRounds: 1,
  curlingStoneCount: 5,
  curlingGaugeSpeed: 700,
  curlingSlowItemCount: 2,
  curlingAimingLineItemCount: 2,
  curlingRounds: 3,
  komi: DEFAULT_KOMI,
  player1Color: Player.Black,
  aiDifficulty: 1,
  goAiBotLevel: 5, // Gnugo 단계 1~10 (전략 AI)
  /** 전략바둑 AI 난이도 UI 기본(5단계) — 미설정 시 셀렉트와 동일하게 -12 */
  kataServerLevel: -12,
};

// --- Dice Go Settings ---
export const DICE_GO_INITIAL_WHITE_STONES_BY_ROUND = [15, 25, 35];
/** 주사위바둑: 백 돌 그룹 최소 개수(규칙 검증용) */
export const DICE_GO_MIN_WHITE_GROUPS = 8;
export const DICE_GO_LAST_CAPTURE_BONUS_BY_TOTAL_ROUNDS = [5, 7, 10];
export const DICE_GO_TURN_ROLL_TIME = 30;
export const DICE_GO_TURN_CHOICE_TIME = 30;
export const DICE_GO_MAIN_ROLL_TIME = 30;
export const DICE_GO_MAIN_PLACE_TIME = 30;
export const DICE_GO_VARIANT_NAMES = {
  [DiceGoVariant.Basic]: '기본 규칙',
};

// --- Alkkagi Settings ---
export const ALKKAGI_STONE_COUNTS = [3, 5, 7, 9];
export const ALKKAGI_TURN_TIME_LIMIT = 30;
export const ALKKAGI_PLACEMENT_TIME_LIMIT = 30;
export const ALKKAGI_SIMULTANEOUS_PLACEMENT_TIME_LIMIT = 30;
export const ALKKAGI_GAUGE_SPEEDS = [
  { value: 1000, label: 'x1 (느림)' },
  { value: 700, label: 'x2 (보통)' },
  { value: 400, label: 'x3 (빠름)' },
];
export const BATTLE_PLACEMENT_ZONES: { [key in Player.Black | Player.White]: { x: number, y: number, width: number, height: number }[] } = {
    [Player.Black]: [
        { x: 7, y: 4, width: 5, height: 2 },
        { x: 4, y: 7, width: 2, height: 4 },
        { x: 13, y: 7, width: 2, height: 4 },
        { x: 7, y: 13, width: 2, height: 2 },
        { x: 10, y: 13, width: 2, height: 2 },
    ],
    [Player.White]: [
        { x: 4, y: 4, width: 2, height: 2 },
        { x: 13, y: 4, width: 2, height: 2 },
        { x: 7, y: 7, width: 5, height: 2 },
        { x: 7, y: 10, width: 5, height: 2 },
    ],
};
export const PLAYFUL_MODE_FOUL_LIMIT = 5;

/** AI가 선공으로 플레이 화면에 진입할 때 클라이언트가 상태·애니메이션을 받을 시간 (ms) */
export const AI_GAME_FIRST_MOVE_DELAY_MS = 2000;

/** 주사위바둑/도둑과경찰 등: AI가 연속 착수할 때 돌 사이 최소 간격 (메인 루프·AI 큐 공통) */
export const PLAYFUL_AI_BATCH_STONE_INTERVAL_MS = 500;

/** 주사위바둑/도둑과경찰 AI 굴림 애니 길이 (유저 굴림 1500ms와 별도) */
export const PLAYFUL_AI_DICE_ROLL_ANIMATION_MS = 1000;

/** AI 큐: 주사위/도둑 AI 굴림 직전 짧은 대기 */
export const PLAYFUL_AI_QUEUE_PRE_ACTION_DELAY_MS = 350;

// --- Curling Settings ---
export const CURLING_STONE_COUNTS = [3, 5, 7];
export const CURLING_TURN_TIME_LIMIT = 30;
export const CURLING_GAUGE_SPEEDS = [
  { value: 1000, label: 'x1 (느림)' },
  { value: 700, label: 'x2 (보통)' },
  { value: 400, label: 'x3 (빠름)' },
];
