/**
 * Game mode definitions and logic
 * Will contain logic for all game modes
 */

export enum GameMode {
  Standard = '클래식 바둑',
  Capture = '따내기 바둑',
  Speed = '스피드 바둑',
  Base = '베이스 바둑',
  Hidden = '히든 바둑',
  Missile = '미사일 바둑',
  Mix = '믹스룰 바둑',
  Dice = '주사위 바둑',
  Omok = '오목',
  Ttamok = '따목',
  Thief = '도둑과 경찰',
  Alkkagi = '알까기',
  Curling = '바둑 컬링',
}

export interface GameModeConfig {
  mode: GameMode;
  name: string;
  description: string;
  category: 'strategic' | 'playful' | 'special';
}

export const STRATEGIC_MODES: GameModeConfig[] = [
  { mode: GameMode.Standard, name: '클래식 바둑', description: '일반적인 클래식 바둑입니다.', category: 'strategic' },
  { mode: GameMode.Capture, name: '따내기 바둑', description: '정해진 개수의 돌을 먼저 따내는 사람이 승리하는 바둑입니다.', category: 'strategic' },
  { mode: GameMode.Speed, name: '스피드 바둑', description: '한 수를 둘 때마다 시간이 추가되는 피셔 방식입니다.', category: 'strategic' },
  { mode: GameMode.Base, name: '베이스 바둑', description: '각자 비밀리에 베이스돌을 놓아 독특한 시작 판을 만듭니다.', category: 'strategic' },
  { mode: GameMode.Hidden, name: '히든 바둑', description: '상대에게 보이지 않는 히든돌을 놓아 허를 찌르는 심리전 바둑입니다.', category: 'strategic' },
  { mode: GameMode.Missile, name: '미사일 바둑', description: '미사일 아이템으로 내 돌을 움직여 전략적인 행마를 구사하는 바둑입니다.', category: 'strategic' },
  { mode: GameMode.Mix, name: '믹스 바둑', description: '여러 규칙을 섞어서 대결하는 모드입니다.', category: 'strategic' },
];

export const PLAYFUL_MODES: GameModeConfig[] = [
  { mode: GameMode.Dice, name: '주사위 바둑', description: '주사위를 굴려 나온 수만큼 돌을 놓는 재미있는 바둑입니다.', category: 'playful' },
  { mode: GameMode.Omok, name: '오목', description: '5개를 연속으로 놓으면 승리하는 게임입니다.', category: 'playful' },
  { mode: GameMode.Ttamok, name: '따목', description: '오목의 변형 게임입니다.', category: 'playful' },
  { mode: GameMode.Thief, name: '도둑과 경찰', description: '도둑과 경찰 역할을 나눠 플레이하는 게임입니다.', category: 'playful' },
  { mode: GameMode.Alkkagi, name: '알까기', description: '알까기 게임입니다.', category: 'playful' },
  { mode: GameMode.Curling, name: '바둑 컬링', description: '바둑판에서 컬링을 하는 게임입니다.', category: 'playful' },
];

/**
 * Get game mode configuration
 */
export function getGameModeConfig(mode: GameMode): GameModeConfig | undefined {
  return [...STRATEGIC_MODES, ...PLAYFUL_MODES].find((config) => config.mode === mode);
}

/**
 * Check if mode is strategic
 */
export function isStrategicMode(mode: GameMode): boolean {
  return STRATEGIC_MODES.some((config) => config.mode === mode);
}

/**
 * Check if mode is playful
 */
export function isPlayfulMode(mode: GameMode): boolean {
  return PLAYFUL_MODES.some((config) => config.mode === mode);
}
