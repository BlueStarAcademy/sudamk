import type { ServerAction, User, VolatileState } from '../../shared/types/index.js';
import { Player } from '../../shared/types/enums.js';
import * as db from '../db.js';
import { DEFAULT_GAME_SETTINGS, getAiScoringTurnLimitByBoardSize, getDefaultChessScoringTurnLimit, clampChessScoringTurnLimit, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../shared/constants/index.js';
import { GameMode } from '../../shared/types/enums.js';
import { aiUserId, scheduleAiTurnStartForFreshUi } from '../aiPlayer.js';
import {
    getAdventureEncounterCountdownMinutes,
    getAdventureDesignScoringTurnLimit,
} from '../../shared/utils/adventureBattleBoard.js';
import { applyAdventureRegionalFlatBonusToHumanCaptures } from '../utils/adventureHeadStartCaptures.js';
import { modeIncludesCaptureRule, resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';

function normalizeStrategicAiScoringSettings(game: any): void {
  if (!SPECIAL_GAME_MODES.some((m) => m.mode === game.mode)) return;
  const preMergePolicy = resolveArenaSessionPolicy(game);

  game.settings = { ...DEFAULT_GAME_SETTINGS, ...(game.settings || {}) };
  if (game.mode === GameMode.Chess) {
    const chessBoard = game.settings.boardSize === 9 ? 9 : 13;
    (game.settings as { scoringTurnLimit?: number }).scoringTurnLimit = clampChessScoringTurnLimit(
      (game.settings as { scoringTurnLimit?: number }).scoringTurnLimit,
      chessBoard,
    );
    return;
  }
  if (modeIncludesCaptureRule(game.mode, game.settings)) {
    game.settings.scoringTurnLimit = 0;
    delete game.settings.autoScoringTurns;
    return;
  }
  const gc = String((game as any).gameCategory ?? '');
  if (gc === 'guildwar') {
    const aut = (game.settings as any)?.autoScoringTurns;
    const stl = (game.settings as any)?.scoringTurnLimit;
    if (typeof aut === 'number' && aut > 0) {
      (game.settings as any).scoringTurnLimit = aut;
      return;
    }
    if (typeof stl === 'number' && stl > 0) {
      return;
    }
  }
  // 모험: 로비 AI 기본값(`getAiScoringTurnLimitByBoardSize`의 11줄=85 등)으로 덮지 않고, 판 크기별 설계 상한으로 고정
  if (preMergePolicy.usesAdventureScoringCap) {
    const rawBs = Number(game.settings?.boardSize ?? game.adventureBoardSize);
    const bs = Number.isFinite(rawBs) && rawBs > 0 ? Math.floor(rawBs) : 19;
    const cap = getAdventureDesignScoringTurnLimit(bs);
    if (cap != null && cap > 0) {
      game.settings.scoringTurnLimit = cap;
    }
    return;
  }
  game.settings.scoringTurnLimit = getAiScoringTurnLimitByBoardSize(
    game.settings.boardSize || DEFAULT_GAME_SETTINGS.boardSize,
  );
}

export async function handleAiAction(
  volatileState: VolatileState,
  action: ServerAction & { userId: string },
  user: User
): Promise<{ clientResponse?: any; error?: string }> {
  const { type, payload } = action as any;

  if (type !== 'CONFIRM_AI_GAME_START') {
    return { error: 'Unknown AI action.' };
  }

  const { gameId } = payload || {};
  if (!gameId || typeof gameId !== 'string') {
    return { error: 'Invalid gameId.' };
  }

  const { getCachedGame, updateGameCache } = await import('../gameCache.js');
  let game = await getCachedGame(gameId);
  if (!game) {
    game = await db.getLiveGame(gameId);
  }

  if (!game) return { error: 'Game not found.' };
  const aiStartPolicy = resolveArenaSessionPolicy(game as any);
  if (!game.isAiGame && !aiStartPolicy.usesServerKataAi) return { error: 'Not an AI game.' };
  if (game.gameStatus !== 'pending') return { error: '게임이 이미 시작되었거나 시작할 수 없는 상태입니다.' };

  // 권한 체크: 게임 참가자만 시작 가능 (관전자는 불가)
  const isParticipant = user.id === game.player1?.id || user.id === game.player2?.id;
  if (!isParticipant) return { error: 'Only participants can start the game.' };

  const { clearAiSession } = await import('../aiSessionManager.js');
  clearAiSession(gameId);

  const now = Date.now();
  normalizeStrategicAiScoringSettings(game as any);

  // 로비 `START_AI_GAME`는 negotiationActions에서 이미 `pairGame`을 제거한다.
  // 페어 경기장 AI(`PAIR_START_AI_MATCH` → pairMode `ai`, 상대 팀 `pair-opponent-ai`)는 유지해야
  // CONFIRM 직후 일반 전략 AI 대국으로 바뀌는 버그가 나지 않는다.
  const p2 = game.player2 as { id?: string } | undefined;
  if (p2?.id === aiUserId && game.settings) {
    const pg = (game.settings as { pairGame?: { pairMode?: string; teamB?: { members?: { id?: string }[] } } }).pairGame;
    const isPairArenaVsAi =
      pg?.pairMode === 'ai' || pg?.teamB?.members?.some((m) => m.id === 'pair-opponent-ai');
    if (!isPairArenaVsAi) {
      delete (game.settings as { pairGame?: unknown }).pairGame;
    }
  }

  // Minimal "negotiation-like" object for initializer functions that need settings/mode.
  // game.settings는 START_AI_GAME 시 클라이언트에서 받은 전체 설정(계가까지 턴, 초읽기 등)을 그대로 유지.
  const neg = {
    challenger: game.player1,
    opponent: game.player2,
    mode: game.mode,
    settings: game.settings,
    proposerId: game.player1.id,
    status: 'pending',
    deadline: 0,
    id: 'neg-ai-start',
  } as any;

  const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === game.mode);
  const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === game.mode);

  try {
    if (isStrategic) {
      const { initializeStrategicGame } = await import('../modes/standard.js');
      initializeStrategicGame(game as any, neg, now);
      applyAdventureRegionalFlatBonusToHumanCaptures(game as any);
    } else if (isPlayful) {
      const { initializePlayfulGame } = await import('../modes/playful.js');
      await initializePlayfulGame(game as any, neg, now);
    } else {
      return { error: 'Unsupported game mode.' };
    }

    const postInit = game as any;

    // Ensure currentPlayer is set when transitioning to playing
    if (postInit.gameStatus === 'playing' && postInit.currentPlayer === Player.None) {
      postInit.currentPlayer = Player.Black;
      console.log(`[handleAiAction] Set currentPlayer to Black for game ${game.id}`);
    }

    // 게임 시작 시 첫 턴이 AI인 경우 aiTurnStartTime 설정
    if (resolveArenaSessionPolicy(postInit).usesServerKataAi && postInit.currentPlayer !== Player.None) {
      const currentPlayerId = postInit.currentPlayer === Player.Black ? postInit.blackPlayerId : postInit.whitePlayerId;
      if (currentPlayerId === aiUserId || (currentPlayerId && String(currentPlayerId).startsWith('dungeon-bot-'))) {
        scheduleAiTurnStartForFreshUi(postInit, now);
        console.log(`[handleAiAction] AI turn at game start, game ${game.id}, deferred aiTurnStartTime by first-move delay`);
      } else {
        // 사용자 턴으로 시작하므로 aiTurnStartTime을 undefined로 설정
        postInit.aiTurnStartTime = undefined;
        console.log(`[handleAiAction] User turn at game start, game ${game.id}, clearing aiTurnStartTime`);
      }
    }

    // playing 진입 시 `transitionToPlaying`에서 설정. 경로 누락 시에만 보조 설정
    if (
      postInit.gameCategory === 'adventure' &&
      postInit.gameStatus === 'playing' &&
      postInit.adventureEncounterDeadlineMs == null
    ) {
      const bs = postInit.settings?.boardSize ?? postInit.adventureBoardSize ?? 9;
      const mins = getAdventureEncounterCountdownMinutes(bs);
      const durMult = Math.max(0.5, Math.min(3, Number(postInit.adventureEncounterDurationMultiplier) || 1));
      postInit.adventureEncounterDeadlineMs = now + mins * 60 * 1000 * durMult;
    }

    // 실제 대국(playing) 전에는 설정하지 않음 — nigiri_reveal 등은 transitionToPlaying에서 설정
    if (postInit.gameStatus === 'playing' && !postInit.gameStartTime) {
      postInit.gameStartTime = now;
    }

    const { seedStrategicPetHintBonusPresetsForGame } = await import('../strategicPetHintAction.js');
    if (postInit.gameStatus === 'playing') {
      void seedStrategicPetHintBonusPresetsForGame(postInit as any).catch((e: unknown) =>
        console.warn('[seedStrategicPetHintBonusPresetsForGame]', e instanceof Error ? e.message : e),
      );
    }

    const { normalizeChessGoSession } = await import('../../shared/utils/chessGoRules.js');
    const { GameMode } = await import('../../shared/types/enums.js');
    if (postInit.mode === GameMode.Chess) {
        const normalized = normalizeChessGoSession(postInit as any);
        Object.assign(postInit, normalized);
    }

    await db.saveGame(game);
    updateGameCache(game);

    const { broadcastToGameParticipants } = await import('../socket.js');
    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);

    // AI 선공 첫 수는 scheduleAiTurnStartForFreshUi로 지연 후 메인 루프에서 처리 (클라이언트가 플레이 UI·애니메이션을 받을 시간 확보)

    let gameCopy: any;
    try {
      gameCopy = JSON.parse(JSON.stringify(game));
    } catch {
      gameCopy = game; // 직렬화 실패 시 원본 반환 (순환 참조 등)
    }
    return { clientResponse: { success: true, gameId: game.id, game: gameCopy } };
  } catch (err: any) {
    console.error('[CONFIRM_AI_GAME_START] Error:', err?.message || err, err?.stack);
    return { error: err?.message || '경기 시작 처리 중 오류가 발생했습니다.' };
  }
}

