import type { ServerAction, User, VolatileState } from '../../shared/types/index.js';
import { Player } from '../../shared/types/enums.js';
import * as db from '../db.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../shared/constants/index.js';

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
  if (game.gameStatus === 'playing' && (game as any).currentPlayer === 0) {
    // Player.None === 0 in enum
    (game as any).currentPlayer = Player.Black;
  }

  await db.saveGame(game);
  updateGameCache(game);

  const { broadcastToGameParticipants } = await import('../socket.js');
  broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);

  const gameCopy = JSON.parse(JSON.stringify(game));
  return { clientResponse: { success: true, gameId: game.id, game: gameCopy } };
}

