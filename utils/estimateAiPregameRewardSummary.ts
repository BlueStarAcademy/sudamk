import { LiveGameSession, User, GameMode } from '../types.js';
import { ItemGrade } from '../types/enums.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants.js';
import { ADVENTURE_STRATEGIC_WIN_BASE_GOLD_BY_BOARD_SIZE } from '../shared/constants/adventureStrategicGold.js';
import {
  aiLobbyRewardMultiplierFromProfileStep,
  isWaitingRoomAiGame,
  resolveAiLobbyProfileStepFromSettings,
} from '../shared/utils/strategicAiDifficulty.js';
import { getAdventureChapterRewardPreview, getAdventureChapterRewardVisual } from '../shared/utils/adventureChapterRewardPreview.js';
import type { AdventureStageId } from '../constants/adventureConstants.js';

const PLAYFUL_GOLD_BASE: Record<number, number> = {
  3: 800,
  2: 500,
  1: 200,
};

const ADVENTURE_STRATEGY_XP_BY_BOARD: Record<number, number> = {
  7: 10,
  9: 13,
  11: 15,
  13: 20,
  19: 30,
};

function adventureMonsterLevelXpBonus(levelRaw: unknown): number {
  const level = Math.max(1, Math.min(50, Math.floor(typeof levelRaw === 'number' ? levelRaw : 1)));
  return Math.max(0, Math.floor((level - 1) / 5));
}

function resolveHumanOpponent(session: LiveGameSession, currentUser?: User): { human: User; opponent: User } | null {
  if (!currentUser) return null;
  const { player1, player2 } = session;
  if (player1.id === currentUser.id) return { human: player1, opponent: player2 };
  if (player2.id === currentUser.id) return { human: player2, opponent: player1 };
  return null;
}

function xpLevelMultiplier(human: User, opponent: User, isStrategic: boolean): number {
  const initialLevel = isStrategic ? human.strategyLevel ?? 1 : human.playfulLevel ?? 1;
  const opponentLevel = isStrategic ? opponent.strategyLevel ?? 1 : opponent.playfulLevel ?? 1;
  const levelDiff = opponentLevel - initialLevel;
  const raw = 1 + levelDiff * 0.1;
  return Math.max(0.5, Math.min(1.5, raw));
}

function baseStrategicWinGold(session: LiveGameSession): number {
  const bs = session.settings.boardSize ?? 19;
  return ADVENTURE_STRATEGIC_WIN_BASE_GOLD_BY_BOARD_SIZE[bs] ?? ADVENTURE_STRATEGIC_WIN_BASE_GOLD_BY_BOARD_SIZE[19]!;
}

function basePlayfulWinGold(session: LiveGameSession): number {
  const { mode, settings } = session;
  let rounds = 1;
  if (mode === GameMode.Dice) rounds = settings.diceGoRounds || 3;
  else if (mode === GameMode.Alkkagi) rounds = settings.alkkagiRounds || 1;
  else if (mode === GameMode.Curling) rounds = settings.curlingRounds || 3;
  else if (mode === GameMode.Thief) rounds = 2;
  return PLAYFUL_GOLD_BASE[rounds] ?? PLAYFUL_GOLD_BASE[1]!;
}

/** AI 대국 시작 전 모달 — 이미지 슬롯 전용(문장형 설명 없음) */
export type AiPregameRewardSlot =
  | { kind: 'xp_win_loss'; xpVariant: 'strategy' | 'playful'; winXp: number; lossXp: number }
  | { kind: 'xp_adventure_win'; winXp: number }
  | { kind: 'gold_range'; min: number; max: number; highlight?: 'boss' }
  | { kind: 'gold_point'; amount: number; tone: 'win' | 'loss' }
  | {
      kind: 'equipment_grade_box';
      gradeLabel: string;
      grade: ItemGrade;
      image: string;
    }
  | { kind: 'material_qty_box'; image: string; qtyMin: number; qtyMax: number }
  | { kind: 'icon_only'; image: string };

export type AiPregameRewardVisual = {
  slots: AiPregameRewardSlot[];
  footnote: string;
};

/** AI 대국 시작 전 모달용: 슬롯 데이터만(표시는 AiPregameRewardVisualStrip) */
export function buildAiPregameRewardVisual(session: LiveGameSession, currentUser?: User): AiPregameRewardVisual | null {
  if (!session.isAiGame) return null;
  if (session.isSinglePlayer || session.gameCategory === 'tower') return null;

  const isStrategic = SPECIAL_GAME_MODES.some((m) => m.mode === session.mode);
  const isPlayful = PLAYFUL_GAME_MODES.some((m) => m.mode === session.mode);

  if (session.gameCategory === 'adventure' && session.adventureStageId) {
    try {
      const p = getAdventureChapterRewardPreview(session.adventureStageId as AdventureStageId);
      const visual = getAdventureChapterRewardVisual(session.adventureStageId as AdventureStageId);
      const bs = session.adventureBoardSize ?? session.settings.boardSize ?? 9;
      const baseXp = ADVENTURE_STRATEGY_XP_BY_BOARD[bs] ?? ADVENTURE_STRATEGY_XP_BY_BOARD[9]!;
      const winXp = baseXp + adventureMonsterLevelXpBonus(session.adventureMonsterLevel);
      const slots: AiPregameRewardSlot[] = [{ kind: 'xp_adventure_win', winXp }];
      slots.push({
        kind: 'gold_range',
        min: p.goldNormalRange.min,
        max: p.goldNormalRange.max,
      });
      if (p.goldBoss19Range) {
        slots.push({
          kind: 'gold_range',
          min: p.goldBoss19Range.min,
          max: p.goldBoss19Range.max,
          highlight: 'boss',
        });
      }
      slots.push({
        kind: 'equipment_grade_box',
        gradeLabel: p.equipmentGradeRange,
        grade: visual.equipmentMaxTier.grade,
        image: visual.equipmentMaxTier.image,
      });
      for (const m of visual.materials.slice(0, 4)) {
        slots.push({
          kind: 'material_qty_box',
          image: m.image,
          qtyMin: m.qtyMin,
          qtyMax: m.qtyMax,
        });
      }
      return {
        slots,
        footnote: '※ 승리·스테이지·이해도·버프에 따라 실제 지급이 달라질 수 있습니다.',
      };
    } catch {
      return {
        slots: [{ kind: 'icon_only', image: '/images/Box/EquipmentBox1.png' }],
        footnote: '※ 맵·도감에서 보상 정보를 확인할 수 있습니다.',
      };
    }
  }

  if (session.gameCategory === 'guildwar') {
    return {
      slots: [
        { kind: 'icon_only', image: '/images/icon/Gold.png' },
        { kind: 'icon_only', image: '/images/icon/Zem.png' },
      ],
      footnote: '※ 전투 결과·별·길드 규칙에 따라 지급이 달라집니다.',
    };
  }

  if (!isStrategic && !isPlayful) {
    return {
      slots: [{ kind: 'icon_only', image: '/images/icon/Gold.png' }],
      footnote: '※ 결과 화면에서 지급 내역을 확인할 수 있습니다.',
    };
  }

  const pair = resolveHumanOpponent(session, currentUser);
  const levelMul = pair ? xpLevelMultiplier(pair.human, pair.opponent, isStrategic) : 1;
  const lobbyMul =
    isWaitingRoomAiGame(session) ? aiLobbyRewardMultiplierFromProfileStep(resolveAiLobbyProfileStepFromSettings(session.settings)) : 1;

  const aiPenalty = 0.2;
  const winXp = Math.round(100 * aiPenalty * levelMul * lobbyMul);
  const lossXp = Math.round(25 * aiPenalty * levelMul * lobbyMul);

  const baseGoldWin = isStrategic ? baseStrategicWinGold(session) : basePlayfulWinGold(session);
  const goldWin = Math.round(baseGoldWin * aiPenalty);
  const goldLoss = Math.round(goldWin * 0.25);

  const xpVariant: 'strategy' | 'playful' = isStrategic ? 'strategy' : 'playful';

  return {
    slots: [
      { kind: 'xp_win_loss', xpVariant, winXp, lossXp },
      { kind: 'gold_point', amount: goldWin, tone: 'win' },
      { kind: 'gold_point', amount: goldLoss, tone: 'loss' },
    ],
    footnote: '※ EXP·골드는 대국 진행량·버프에 따라 달라질 수 있습니다.',
  };
}
