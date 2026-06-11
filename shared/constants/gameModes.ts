import { GameMode } from '../types/index.js';
import { SPEED_GO_MODE_DESCRIPTION } from './speedTimePressure.js';

/** 로비·모드 선택 등에 쓰는 베이스 바둑 한 줄 설명 */
export const BASE_GO_MODE_DESCRIPTION =
    '베이스돌의 배치를 보고 상대에게 주는 덤을 설정하여 원하는 돌로 두는 바둑으로, 형세분석 능력을 겨룹니다.';

/** 로비·모드 선택 등에 쓰는 히든 바둑 한 줄 설명 */
export const HIDDEN_GO_MODE_DESCRIPTION =
    '상대에게 보이지 않는 한수로 일발역전! 히든, 스캔 아이템을 통해 심리전, 수읽기 능력이 요구됩니다.';

/** 로비·모드 선택 등에 쓰는 미사일 바둑 한 줄 설명 */
export const MISSILE_GO_MODE_DESCRIPTION =
    '미사일 아이템으로 놓여져 있는 내 돌을 이동시켜 변수를 만들어 냅니다.';

/** 로비·모드 선택 등에 쓰는 믹스 바둑 한 줄 설명 */
export const MIX_GO_MODE_DESCRIPTION =
    '2가지 이상의 특수 규칙을 조합한 경기입니다.';

/** 로비·모드 선택 등에 쓰는 일색 바둑 한 줄 설명 */
export const UNIFORM_GO_MODE_DESCRIPTION =
    '모든 돌이 한 가지 색으로 보이는 기억력을 필요로 하는 바둑입니다.';

/** 로비·모드 선택 등에 쓰는 캐슬 바둑 한 줄 설명 */
export const CASTLE_GO_MODE_DESCRIPTION =
    '랜덤 배치된 캐슬을 활용해 영토를 확보하고, 한 돌만 잡아도 승리하는 전략 바둑입니다.';

/** 로비·모드 선택 등에 쓰는 체스 바둑 한 줄 설명 */
export const CHESS_GO_MODE_DESCRIPTION =
    '체스 기물과 바둑을 결합한 전략 바둑입니다. 기물 이동(선택) 후 바둑돌을 놓아 턴을 마칩니다.';

/** 아직 출시 전인 모드 로비 설명 */
export const COMING_SOON_GAME_MODE_DESCRIPTION = '추가 업데이트 준비중';

export type LobbyGameModeDefinition = {
    mode: GameMode;
    name: string;
    description: string;
    available?: boolean;
    image: string;
};

export function isPlayableLobbyGameMode(entry: Pick<LobbyGameModeDefinition, 'available'>): boolean {
    return entry.available !== false;
}

export function filterPlayableLobbyGameModes<T extends Pick<LobbyGameModeDefinition, 'available'>>(
    modes: readonly T[],
): T[] {
    return modes.filter(isPlayableLobbyGameMode);
}

export const SPECIAL_GAME_MODES: LobbyGameModeDefinition[] = [
  { mode: GameMode.Standard, name: "클래식 바둑", description: "일반적인 클래식 바둑입니다.", available: true, image: "/images/simbols/simbol1.webp" },
  { mode: GameMode.Capture, name: "따내기 바둑", description: "정해진 개수의 돌을 먼저 따내는 사람이 승리하는 바둑입니다.", available: true, image: "/images/simbols/simbol2.webp" },
  { mode: GameMode.Speed, name: "스피드 바둑", description: SPEED_GO_MODE_DESCRIPTION, available: true, image: "/images/simbols/simbol3.webp" },
  { mode: GameMode.Base, name: "베이스 바둑", description: BASE_GO_MODE_DESCRIPTION, available: true, image: "/images/simbols/simbol4.webp" },
  { mode: GameMode.Hidden, name: "히든 바둑", description: HIDDEN_GO_MODE_DESCRIPTION, available: true, image: "/images/simbols/simbol5.webp" },
  { mode: GameMode.Missile, name: "미사일 바둑", description: MISSILE_GO_MODE_DESCRIPTION, available: true, image: "/images/simbols/simbol6.webp" },
  { mode: GameMode.Uniform, name: "일색 바둑", description: UNIFORM_GO_MODE_DESCRIPTION, available: true, image: "/images/simbols/simbol7.webp" },
  { mode: GameMode.Castle, name: "캐슬 바둑", description: CASTLE_GO_MODE_DESCRIPTION, available: true, image: "/images/simbols/simbol8.webp" },
  { mode: GameMode.Chess, name: "체스 바둑", description: CHESS_GO_MODE_DESCRIPTION, available: true, image: "/images/simbols/simbol9.webp" },
  { mode: GameMode.Mix, name: "믹스 바둑", description: MIX_GO_MODE_DESCRIPTION, available: true, image: "/images/simbols/simbol10.webp" }
];

export const PLAYFUL_GAME_MODES = [
  { mode: GameMode.Dice, name: "주사위 바둑", description: "서로 주사위를 굴린 숫자만큼 흑돌을 이용할 수 있으며 더 많은 백돌을 따낸쪽이 승리합니다.", available: true, image: "/images/simbols/simbolp1.webp" },
  { mode: GameMode.Thief, name: "도둑과경찰", description: "도둑(흑)과 경찰(백) 역할을 번갈아 맡아 5턴씩 진행하며, 총점으로 승패를 가리는 전략 주사위 게임입니다.", available: true, image: "/images/simbols/simbolp4.webp" },
  { mode: GameMode.Omok, name: "오목", description: "다섯 개의 돌을 먼저 나란히 놓으면 승리하는 클래식 게임입니다.", available: true, image: "/images/simbols/simbolp2.webp" },
  { mode: GameMode.Ttamok, name: "따목", description: "오목을 만들거나 정해진 상대 돌을 먼저 따내면 승리합니다.", available: true, image: "/images/simbols/simbolp3.webp" },
  { mode: GameMode.Alkkagi, name: "알까기", description: "손가락으로 바둑돌을 쳐서 상대방의 돌을 판 밖으로 밀어내는 게임입니다.", available: true, image: "/images/simbols/simbolp5.webp" },
  { mode: GameMode.Curling, name: "컬링", description: "바둑판 위에서 돌을 미끄러뜨려 목표(하우스)에 가장 가깝게 보내 점수를 얻는 게임입니다.", available: true, image: "/images/simbols/simbolp6.webp" }
];
