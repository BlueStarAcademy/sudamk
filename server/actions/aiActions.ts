import type { ServerAction, User, VolatileState } from '../../shared/types/index.js';
import { Player } from '../../shared/types/enums.js';
import * as db from '../db.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../shared/constants/index.js';
import { aiUserId } from '../aiPlayer.js';

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
  if (!game.isAiGame) return { error: 'Not an AI game.' };
  if (game.gameStatus !== 'pending') return { error: '게임이 이미 시작되었거나 시작할 수 없는 상태입니다.' };

  // 권한 체크: 게임 참가자만 시작 가능 (관전자는 불가)
  const isParticipant = user.id === game.player1?.id || user.id === game.player2?.id;
  if (!isParticipant) return { error: 'Only participants can start the game.' };

  const now = Date.now();

  // Minimal "negotiation-like" object for initializer functions that need settings/mode
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
    } else if (isPlayful) {
      const { initializePlayfulGame } = await import('../modes/playful.js');
      await initializePlayfulGame(game as any, neg, now);
    } else {
      return { error: 'Unsupported game mode.' };
    }

    // Ensure currentPlayer is set when transitioning to playing
    if (game.gameStatus === 'playing' && game.currentPlayer === Player.None) {
      game.currentPlayer = Player.Black;
      console.log(`[handleAiAction] Set currentPlayer to Black for game ${game.id}`);
    }

    // 게임 시작 시 첫 턴이 AI인 경우 aiTurnStartTime 설정
    if (game.isAiGame && game.currentPlayer !== Player.None) {
      const currentPlayerId = game.currentPlayer === Player.Black ? game.blackPlayerId : game.whitePlayerId;
      if (currentPlayerId === aiUserId) {
        game.aiTurnStartTime = now;
        console.log(`[handleAiAction] AI turn at game start, game ${game.id}, setting aiTurnStartTime to now: ${now}`);
      } else {
        // 사용자 턴으로 시작하므로 aiTurnStartTime을 undefined로 설정
        game.aiTurnStartTime = undefined;
        console.log(`[handleAiAction] User turn at game start, game ${game.id}, clearing aiTurnStartTime`);
      }
    }

    // 게임 시작 시간 설정
    if (!game.gameStartTime) {
      game.gameStartTime = now;
    }

    await db.saveGame(game);
    updateGameCache(game);

    const { broadcastToGameParticipants } = await import('../socket.js');
    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);

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

