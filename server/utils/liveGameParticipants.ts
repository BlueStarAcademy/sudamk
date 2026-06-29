import type { LiveGameSession } from '../../types/index.js';
import { Player } from '../../types/index.js';
import { getPairHumanParticipantIds, resolvePairUserPlayerEnum } from '../../shared/utils/pairGameTurn.js';

export function getLiveGameHumanParticipantIds(game: Pick<LiveGameSession, 'player1' | 'player2' | 'settings'>): Set<string> {
    const ids = new Set<string>();
    if (game.player1?.id) ids.add(game.player1.id);
    if (game.player2?.id) ids.add(game.player2.id);
    if (game.settings?.pairGame) {
        for (const id of getPairHumanParticipantIds(game.settings.pairGame)) {
            if (id) ids.add(id);
        }
    }
    return ids;
}

export function isLiveGameHumanParticipant(
    game: Pick<LiveGameSession, 'player1' | 'player2' | 'settings'>,
    userId: string,
): boolean {
    return getLiveGameHumanParticipantIds(game).has(userId);
}

export function resolveLiveGamePlayerEnumForUser(
    game: Pick<LiveGameSession, 'blackPlayerId' | 'whitePlayerId' | 'settings'>,
    userId: string,
): Player.Black | Player.White | null {
    const pairPlayer = resolvePairUserPlayerEnum(game.settings, userId);
    if (pairPlayer) return pairPlayer;
    if (game.blackPlayerId === userId) return Player.Black;
    if (game.whitePlayerId === userId) return Player.White;
    return null;
}

export function resolveOpponentPlayerEnumForUser(
    game: Pick<LiveGameSession, 'blackPlayerId' | 'whitePlayerId' | 'settings'>,
    userId: string,
): Player.Black | Player.White | null {
    const mine = resolveLiveGamePlayerEnumForUser(game, userId);
    if (mine === Player.Black) return Player.White;
    if (mine === Player.White) return Player.Black;
    return null;
}
