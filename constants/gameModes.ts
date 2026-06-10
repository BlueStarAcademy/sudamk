import { GameMode } from '../types/index.js';
import { SPEED_GO_MODE_DESCRIPTION } from '../shared/constants/speedTimePressure.js';
import { BASE_GO_MODE_DESCRIPTION, HIDDEN_GO_MODE_DESCRIPTION, MISSILE_GO_MODE_DESCRIPTION, MIX_GO_MODE_DESCRIPTION, UNIFORM_GO_MODE_DESCRIPTION } from '../shared/constants/gameModes.js';

export const SPECIAL_GAME_MODES = [
  { mode: GameMode.Standard, name: "클래식 바둑", description: "일반적인 클래식 바둑입니다.", available: true, image: "/images/simbols/simbol1.webp" },
  { mode: GameMode.Capture, name: "따내기 바둑", description: "정해진 개수의 돌을 먼저 따내는 사람이 승리하는 바둑입니다.", available: true, image: "/images/simbols/simbol2.webp" },
  { mode: GameMode.Speed, name: "스피드 바둑", description: SPEED_GO_MODE_DESCRIPTION, available: true, image: "/images/simbols/simbol3.webp" },
  { mode: GameMode.Base, name: "베이스 바둑", description: BASE_GO_MODE_DESCRIPTION, available: true, image: "/images/simbols/simbol4.webp" },
  { mode: GameMode.Hidden, name: "히든 바둑", description: HIDDEN_GO_MODE_DESCRIPTION, available: true, image: "/images/simbols/simbol5.webp" },
  { mode: GameMode.Missile, name: "미사일 바둑", description: MISSILE_GO_MODE_DESCRIPTION, available: true, image: "/images/simbols/simbol6.webp" },
  { mode: GameMode.Uniform, name: "일색 바둑", description: UNIFORM_GO_MODE_DESCRIPTION, available: true, image: "/images/simbols/simbol8.webp" },
  { mode: GameMode.Mix, name: "믹스 바둑", description: MIX_GO_MODE_DESCRIPTION, available: true, image: "/images/simbols/simbol7.webp" }
];

export const PLAYFUL_GAME_MODES = [
  { mode: GameMode.Dice, name: "주사위 바둑", description: "서로 주사위를 굴린 숫자만큼 흑돌을 이용할 수 있으며 더 많은 백돌을 따낸쪽이 승리합니다.", available: true, image: "/images/simbols/simbolp1.webp" },
  { mode: GameMode.Thief, name: "도둑과경찰", description: "도둑(흑)과 경찰(백) 역할을 번갈아 맡아 5턴씩 진행하며, 총점으로 승패를 가리는 전략 주사위 게임입니다.", available: true, image: "/images/simbols/simbolp4.webp" },
  { mode: GameMode.Omok, name: "오목", description: "다섯 개의 돌을 먼저 나란히 놓으면 승리하는 클래식 게임입니다.", available: true, image: "/images/simbols/simbolp2.webp" },
  { mode: GameMode.Ttamok, name: "따목", description: "오목을 만들거나 정해진 상대 돌을 먼저 따내면 승리합니다.", available: true, image: "/images/simbols/simbolp3.webp" },
  { mode: GameMode.Alkkagi, name: "알까기", description: "손가락으로 바둑돌을 쳐서 상대방의 돌을 판 밖으로 밀어내는 게임입니다.", available: true, image: "/images/simbols/simbolp5.webp" },
  { mode: GameMode.Curling, name: "컬링", description: "바둑판 위에서 돌을 미끄러뜨려 목표(하우스)에 가장 가깝게 보내 점수를 얻는 게임입니다.", available: true, image: "/images/simbols/simbolp6.webp" }
];
