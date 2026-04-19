import type { LiveGameSession } from '../../shared/types/entities.js';
import { GameCategory, Player } from '../../shared/types/enums.js';
import { aiUserId } from '../aiPlayer.js';

/**
 * 모험 지역 이해도(클래식·스피드 / 베이스 시작 가산점): 경기 시작 시 유저 측 `captures`에 넣어
 * 상단 패널·계가 `liveCaptures`에 포함되게 한다. (계가 `finalizeAnalysisResult`에서는 이중 가산하지 않음)
 */
export function applyAdventureRegionalFlatBonusToHumanCaptures(game: LiveGameSession): void {
    if (game.gameCategory !== GameCategory.Adventure) return;
    const raw = (game as { adventureRegionalHumanFlatScoreBonus?: unknown }).adventureRegionalHumanFlatScoreBonus;
    const advFlat = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
    if (advFlat <= 0) return;
    if (!game.blackPlayerId || !game.whitePlayerId) return;

    const humanIsBlack = game.blackPlayerId !== aiUserId;
    const humanEnum = humanIsBlack ? Player.Black : Player.White;

    if (!game.captures) {
        game.captures = { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 };
    }
    game.captures[humanEnum] = (game.captures[humanEnum] ?? 0) + advFlat;
}
