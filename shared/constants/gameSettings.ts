import { GameMode, DiceGoVariant, GameSettings, Player, AlkkagiPlacementType, AlkkagiLayoutType, ItemGrade } from '../types/index.js';

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
/** 미사일 이동: 출발~도착까지 고정 시간(ms). 거리가 멀수록 시각적 속도만 빨라짐(선형 보간). 서버·클라이언트 동기화용. */
export const MISSILE_FLIGHT_DURATION_MS = 3000;
export const STRATEGIC_CLASSIC_SPEED_BOARD_SIZES = [9, 13, 19] as const;
export const STRATEGIC_SPECIAL_BOARD_SIZES = [9, 11, 13] as const;
export const getStrategicBoardSizesByMode = (mode: GameMode): readonly number[] => {
  if (mode === GameMode.Standard || mode === GameMode.Speed) return STRATEGIC_CLASSIC_SPEED_BOARD_SIZES;
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
export const TIME_BONUS_SECONDS_PER_POINT = 5;
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
  goAiBotLevel: 5,
  kataServerLevel: -12,
};

// --- Dice Go Settings ---
export const DICE_GO_INITIAL_WHITE_STONES_BY_ROUND = [15, 25, 35];
/** ???? ?? ????? ??? ???? ??? ??????) ?? ?? */
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
export const PLAYFUL_AI_BATCH_STONE_INTERVAL_MS = 900;

// --- Curling Settings ---
export const CURLING_STONE_COUNTS = [3, 5, 7];
export const CURLING_TURN_TIME_LIMIT = 30;
export const CURLING_GAUGE_SPEEDS = [
  { value: 1000, label: 'x1 (느림)' },
  { value: 700, label: 'x2 (보통)' },
  { value: 400, label: 'x3 (빠름)' },
];
